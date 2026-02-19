// Supabase Edge Function: proposal-webhook
// Handles proposal events: viewed, rejected, signed
// Deploy: npx supabase functions deploy proposal-webhook --project-ref rxckkozbkrabpjdgyxqm --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Telegram notification helper ──────────────────────────────
async function sendTelegramNotification(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('Telegram notification error:', err)
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { proposalId, action } = body

    if (!proposalId) {
      return new Response(
        JSON.stringify({ error: 'proposalId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the proposal to get tenant_id and details
    const { data: proposal, error: fetchError } = await adminClient
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (fetchError || !proposal) {
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const proposalName = proposal.proposal_name || 'ללא שם'
    const businessName = proposal.proposal_data?.businessName || proposal.proposal_data?.business_name || 'לא ידוע'
    const tenantId = proposal.tenant_id

    // Get Telegram settings for this tenant
    const getTelegramSettings = async () => {
      const { data: settings } = await adminClient
        .from('settings')
        .select('telegram_bot_token, telegram_chat_id')
        .eq('tenant_id', tenantId)
        .single()
      return settings
    }

    // ── Action: viewed ────────────────────────────────────────
    if (action === 'viewed') {
      // Only update if current status is 'sent' (don't downgrade from signed/rejected)
      if (proposal.status === 'sent') {
        const { error: updateError } = await adminClient
          .from('proposals')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', proposalId)

        if (updateError) {
          console.error('Failed to update proposal viewed status:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update proposal' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: 'viewed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Action: rejected ──────────────────────────────────────
    if (action === 'rejected') {
      const { error: updateError } = await adminClient
        .from('proposals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', proposalId)

      if (updateError) {
        console.error('Failed to update proposal rejected status:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update proposal' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Send Telegram notification
      const settings = await getTelegramSettings()
      if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
        const message = `❌ הצעה נדחתה: ${proposalName} — ${businessName}`
        await sendTelegramNotification(settings.telegram_bot_token, settings.telegram_chat_id, message)
      }

      return new Response(
        JSON.stringify({ success: true, action: 'rejected' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Default action: signature submission ──────────────────
    const { name, idNumber, email, signatureImage, selectedPackage } = body

    if (!name || !idNumber || !email || !signatureImage || !selectedPackage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, idNumber, email, signatureImage, selectedPackage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const signatureData = {
      name,
      idNumber,
      email,
      signatureImage,
      selectedPackage,
      signedAt: new Date().toISOString(),
    }

    const { error: updateError } = await adminClient
      .from('proposals')
      .update({
        signature_data: signatureData,
        status: 'signed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('Failed to save signature:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save signature' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Send Telegram notification
    const settings = await getTelegramSettings()
    if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
      const message = `🎉 הצעה נחתמה!\n📋 ${proposalName}\n🏢 ${businessName}\n📦 חבילת ${selectedPackage}\n✍️ ${name} (${email})`
      await sendTelegramNotification(settings.telegram_bot_token, settings.telegram_chat_id, message)
    }

    return new Response(
      JSON.stringify({ success: true, action: 'signed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Proposal webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
