// Supabase Edge Function: signals-webhook
// Receives personality analysis data from Signals OS and stores it in Agency Manager Pro
// Deploy: npx supabase functions deploy signals-webhook --project-ref rxckkozbkrabpjdgyxqm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

const ARCHETYPE_NAMES_HE: Record<string, string> = {
  WINNER: 'ווינר',
  STAR: 'סטאר',
  DREAMER: 'חולם',
  HEART: 'לב',
  ANCHOR: 'עוגן',
}

const CHURN_LABELS_HE: Record<string, string> = {
  HIGH: 'גבוה',
  MEDIUM: 'בינוני',
  LOW: 'נמוך',
}

const CONFIDENCE_LABELS_HE: Record<string, string> = {
  HIGH: 'גבוהה',
  MEDIUM: 'בינונית',
  LOW: 'נמוכה',
}

// Default tenant as last resort fallback
const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Validate webhook secret
    // Try to find settings by the webhook's tenant_id, fallback to any settings with matching secret
    const { data: allSettings } = await adminClient
      .from('settings')
      .select('signals_webhook_secret, tenant_id')

    const receivedSecret =
      req.headers.get('x-webhook-secret') ||
      new URL(req.url).searchParams.get('secret')

    // Find which tenant this webhook belongs to based on the secret
    let webhookTenantId: string | null = null
    if (allSettings && receivedSecret) {
      const matchingSetting = allSettings.find(
        (s: { signals_webhook_secret: string | null }) =>
          s.signals_webhook_secret && s.signals_webhook_secret === receivedSecret
      )
      if (matchingSetting) {
        webhookTenantId = matchingSetting.tenant_id
      }
    }

    // If secret was provided but no match found → reject
    if (receivedSecret && !webhookTenantId && allSettings?.some((s: { signals_webhook_secret: string | null }) => s.signals_webhook_secret)) {
      return new Response(JSON.stringify({ error: 'Invalid webhook secret' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Parse payload
    const payload = await req.json()

    // Handle test webhook
    if (payload.event === 'webhook.test') {
      return new Response(JSON.stringify({ success: true, message: 'Test webhook received successfully' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (payload.event !== 'analysis.completed') {
      return new Response(JSON.stringify({ error: `Unknown event type: ${payload.event}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Match lead by email (primary) or phone (fallback)
    const email = payload.subject?.email?.trim().toLowerCase()
    const phone = payload.subject?.phone?.trim()
    let leadId: string | null = null
    let isNewLead = false
    let resolvedTenantId = webhookTenantId // Start with tenant from webhook secret

    if (email) {
      const { data: leadByEmail } = await adminClient
        .from('leads')
        .select('lead_id, tenant_id')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()
      if (leadByEmail) {
        leadId = leadByEmail.lead_id
        // Inherit tenant from the matched lead
        if (!resolvedTenantId) resolvedTenantId = leadByEmail.tenant_id
      }
    }

    if (!leadId && phone) {
      const normalizedPhone = phone.replace(/[\s\-()]/g, '')
      const { data: allLeads } = await adminClient
        .from('leads')
        .select('lead_id, phone, tenant_id')

      if (allLeads) {
        const match = allLeads.find((l: { lead_id: string; phone: string; tenant_id: string }) => {
          const lPhone = (l.phone || '').replace(/[\s\-()]/g, '')
          return (
            lPhone === normalizedPhone ||
            lPhone.replace(/^0/, '+972') === normalizedPhone ||
            normalizedPhone.replace(/^0/, '+972') === lPhone
          )
        })
        if (match) {
          leadId = match.lead_id
          if (!resolvedTenantId) resolvedTenantId = match.tenant_id
        }
      }
    }

    // Also check clients table if no lead found
    if (!leadId && email) {
      const { data: clientByEmail } = await adminClient
        .from('clients')
        .select('client_id, tenant_id')
        .ilike('email', email)
        .limit(1)
        .maybeSingle()

      if (clientByEmail) {
        // Inherit tenant from matched client
        const clientTenantId = resolvedTenantId || clientByEmail.tenant_id || DEFAULT_TENANT

        // Store personality data for the client directly (no lead_id)
        const personalityId = crypto.randomUUID()
        const { error: upsertErr } = await adminClient
          .from('signals_personality')
          .upsert({
            id: personalityId,
            lead_id: null,
            client_id: clientByEmail.client_id,
            analysis_id: payload.analysis_id,
            tenant_id: payload.tenant_id,
            tenant_id_fk: clientTenantId,
            subject_name: payload.subject.full_name,
            subject_email: payload.subject.email,
            subject_phone: payload.subject.phone || null,
            scores: payload.analysis.scores,
            primary_archetype: payload.analysis.primary,
            secondary_archetype: payload.analysis.secondary,
            confidence_level: payload.analysis.confidence_level,
            churn_risk: payload.analysis.churn_risk,
            smart_tags: payload.analysis.smart_tags,
            user_report: payload.analysis.user_report,
            business_report: payload.analysis.business_report,
            sales_cheat_sheet: payload.analysis.sales_cheat_sheet,
            retention_cheat_sheet: payload.analysis.retention_cheat_sheet,
            result_url: payload.result_url,
            lang: payload.lang,
            questionnaire_version: payload.questionnaire_version,
            received_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'client_id' })

        if (upsertErr) {
          console.error('Client personality upsert error:', upsertErr)
        }

        // Log activity
        await adminClient.from('activity_log').insert({
          id: crypto.randomUUID(),
          action_type: 'personality_received',
          entity_type: 'client',
          entity_id: clientByEmail.client_id,
          description: `נתוני אישיות התקבלו מ-Signals OS: ${ARCHETYPE_NAMES_HE[payload.analysis.primary] || payload.analysis.primary}/${ARCHETYPE_NAMES_HE[payload.analysis.secondary] || payload.analysis.secondary}`,
          created_at: new Date().toISOString(),
          tenant_id: clientTenantId,
        })

        return new Response(JSON.stringify({
          success: true,
          client_id: clientByEmail.client_id,
          message: 'Personality data stored for existing client',
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    // Final tenant resolution: webhook secret > matched entity > default
    const finalTenantId = resolvedTenantId || DEFAULT_TENANT

    // 4. If no matching lead or client, create new lead
    if (!leadId) {
      leadId = crypto.randomUUID()
      isNewLead = true
      await adminClient.from('leads').insert({
        lead_id: leadId,
        created_at: new Date().toISOString(),
        lead_name: payload.subject.full_name || 'Unknown',
        business_name: '',
        phone: payload.subject.phone || '',
        email: payload.subject.email || '',
        source_channel: 'Website',
        interested_services: '[]',
        notes: '',
        next_contact_date: new Date().toISOString(),
        status: 'חדש',
        quoted_monthly_value: 0,
        related_client_id: null,
        created_by: null,
        assigned_to: null,
        tenant_id: finalTenantId,
      })
    }

    // 5. Upsert personality data
    const personalityId = crypto.randomUUID()
    const { error: upsertError } = await adminClient
      .from('signals_personality')
      .upsert({
        id: personalityId,
        lead_id: leadId,
        analysis_id: payload.analysis_id,
        tenant_id: payload.tenant_id,
        tenant_id_fk: finalTenantId,
        subject_name: payload.subject.full_name,
        subject_email: payload.subject.email,
        subject_phone: payload.subject.phone || null,
        scores: payload.analysis.scores,
        primary_archetype: payload.analysis.primary,
        secondary_archetype: payload.analysis.secondary,
        confidence_level: payload.analysis.confidence_level,
        churn_risk: payload.analysis.churn_risk,
        smart_tags: payload.analysis.smart_tags,
        user_report: payload.analysis.user_report,
        business_report: payload.analysis.business_report,
        sales_cheat_sheet: payload.analysis.sales_cheat_sheet,
        retention_cheat_sheet: payload.analysis.retention_cheat_sheet,
        result_url: payload.result_url,
        lang: payload.lang,
        questionnaire_version: payload.questionnaire_version,
        received_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'lead_id' })

    if (upsertError) {
      console.error('Upsert error:', upsertError)
      return new Response(JSON.stringify({ error: 'Failed to store personality data', details: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Auto-create personality_insight note
    const primary = payload.analysis.primary
    const secondary = payload.analysis.secondary
    const salesSheet = payload.analysis.sales_cheat_sheet || {}

    let noteContent = `🧠 ניתוח אישיות Signals OS\nארכיטיפ ראשי: ${ARCHETYPE_NAMES_HE[primary] || primary} | משני: ${ARCHETYPE_NAMES_HE[secondary] || secondary}\nרמת ביטחון: ${CONFIDENCE_LABELS_HE[payload.analysis.confidence_level] || payload.analysis.confidence_level}\nסיכון נטישה: ${CHURN_LABELS_HE[payload.analysis.churn_risk] || payload.analysis.churn_risk}`

    if (payload.analysis.smart_tags?.length > 0) {
      noteContent += `\nתגיות: ${payload.analysis.smart_tags.join(', ')}`
    }
    if (salesSheet.how_to_speak) {
      noteContent += `\n\n💬 איך לדבר: ${salesSheet.how_to_speak}`
    }
    if (salesSheet.what_not_to_do) {
      noteContent += `\n🚫 ממה להימנע: ${salesSheet.what_not_to_do}`
    }
    if (salesSheet.red_flags) {
      noteContent += `\n🚩 דגלים אדומים: ${salesSheet.red_flags}`
    }
    if (payload.result_url) {
      noteContent += `\n\n📊 קישור לדוח המלא: ${payload.result_url}`
    }
    if (isNewLead) {
      noteContent += `\n\n📌 ליד נוצר אוטומטית מ-Signals OS`
    }

    await adminClient.from('lead_notes').insert({
      id: crypto.randomUUID(),
      lead_id: leadId,
      content: noteContent,
      created_by: 'system',
      created_by_name: 'Signals OS',
      created_at: new Date().toISOString(),
      note_type: 'personality_insight',
      source_id: payload.analysis_id,
      tenant_id: finalTenantId,
    })

    // 7. Log activity
    const activityDesc = isNewLead
      ? `ליד חדש נוצר אוטומטית מ-Signals OS: ${payload.subject.full_name} (${ARCHETYPE_NAMES_HE[primary] || primary}/${ARCHETYPE_NAMES_HE[secondary] || secondary})`
      : `נתוני אישיות התקבלו מ-Signals OS: ${ARCHETYPE_NAMES_HE[primary] || primary}/${ARCHETYPE_NAMES_HE[secondary] || secondary}`

    await adminClient.from('activity_log').insert({
      id: crypto.randomUUID(),
      action_type: isNewLead ? 'lead_created_signals' : 'personality_received',
      entity_type: 'lead',
      entity_id: leadId,
      description: activityDesc,
      created_at: new Date().toISOString(),
      tenant_id: finalTenantId,
    })

    // 8. Return success
    return new Response(JSON.stringify({
      success: true,
      lead_id: leadId,
      is_new_lead: isNewLead,
      message: isNewLead
        ? 'New lead created and personality data stored'
        : 'Personality data stored for existing lead',
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
