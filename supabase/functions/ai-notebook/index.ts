// Supabase Edge Function: ai-notebook
// Context-aware AI chat per client/lead — CRM NotebookLM
// Deploy: npx supabase functions deploy ai-notebook --project-ref rxckkozbkrabpjdgyxqm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ARCHETYPE_NAMES: Record<string, string> = {
  WINNER: 'ווינר', STAR: 'סטאר', DREAMER: 'חולם', HEART: 'לב', ANCHOR: 'עוגן',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: authError } = await callerClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Get tenant + Gemini key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: callerRole } = await adminClient
      .from('user_roles')
      .select('tenant_id, display_name')
      .eq('user_id', user.id)
      .single()
    const callerTenantId = callerRole?.tenant_id
    const callerName = callerRole?.display_name || 'Unknown'

    const { data: settings } = await adminClient
      .from('settings')
      .select('gemini_api_key')
      .eq('tenant_id', callerTenantId)
      .single()

    if (!settings?.gemini_api_key) {
      return new Response(JSON.stringify({
        error: 'מפתח Gemini API לא מוגדר. הגדר אותו בעמוד ההגדרות.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Parse request
    const body = await req.json()
    const {
      entityId,
      entityType,
      message,
      chatHistory = [],
    } = body as {
      entityId: string
      entityType: 'client' | 'lead'
      message: string
      chatHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'הודעה ריקה' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build CRM context — gather all entity data
    let entityContext = ''
    const entityLabel = entityType === 'client' ? 'לקוח' : 'ליד'

    if (entityType === 'client') {
      const { data: client } = await adminClient
        .from('clients')
        .select('*')
        .eq('client_id', entityId)
        .single()

      if (client) {
        entityContext += `--- פרטי ${entityLabel} ---
שם: ${client.client_name}
עסק: ${client.business_name || 'לא צוין'}
טלפון: ${client.phone || 'לא צוין'}
אימייל: ${client.email || 'לא צוין'}
תחום: ${client.industry || 'לא צוין'}
דירוג: ${client.rating}
סטטוס: ${client.status}
ריטיינר חודשי: ₪${client.monthly_retainer}
עלות ספקים חודשית: ₪${client.supplier_cost_monthly}
רמת מאמץ: ${client.effort_level}
תאריך הצטרפות: ${client.join_date}
שירותים: ${client.services || '[]'}
הערות כלליות: ${client.notes || 'אין'}
---\n`
      }

      // Deals
      const { data: deals } = await adminClient
        .from('deals')
        .select('deal_name, deal_amount, deal_date, deal_status')
        .eq('client_id', entityId)
        .order('deal_date', { ascending: false })
        .limit(10)
      if (deals?.length) {
        entityContext += `\n--- פרויקטים (${deals.length}) ---\n`
        for (const d of deals) {
          entityContext += `${d.deal_name}: ₪${d.deal_amount} (${d.deal_date}) [${d.deal_status}]\n`
        }
      }

      // Payments
      const { data: payments } = await adminClient
        .from('payments')
        .select('period_month, amount_due, amount_paid, payment_status')
        .eq('client_id', entityId)
        .order('period_month', { ascending: false })
        .limit(6)
      if (payments?.length) {
        entityContext += `\n--- תשלומים (אחרונים 6) ---\n`
        for (const p of payments) {
          entityContext += `${p.period_month}: חיוב ₪${p.amount_due} / שולם ₪${p.amount_paid} [${p.payment_status}]\n`
        }
      }
    } else {
      // Lead
      const { data: lead } = await adminClient
        .from('leads')
        .select('*')
        .eq('lead_id', entityId)
        .single()

      if (lead) {
        entityContext += `--- פרטי ${entityLabel} ---
שם: ${lead.lead_name}
עסק: ${lead.business_name || 'לא צוין'}
טלפון: ${lead.phone || 'לא צוין'}
אימייל: ${lead.email || 'לא צוין'}
מקור: ${lead.source_channel}
סטטוס: ${lead.status}
ערך מצוטט: ₪${lead.quoted_monthly_value}
שירותים מעוניין: ${lead.interested_services || '[]'}
הערות: ${lead.notes || 'אין'}
---\n`
      }
    }

    // Notes
    const notesTable = entityType === 'client' ? 'client_notes' : 'lead_notes'
    const notesFK = entityType === 'client' ? 'client_id' : 'lead_id'
    const { data: notes } = await adminClient
      .from(notesTable)
      .select('content, created_by_name, created_at, note_type')
      .eq(notesFK, entityId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (notes?.length) {
      entityContext += `\n--- הערות (${notes.length}) ---\n`
      for (const n of notes) {
        const noteTypeLabel = n.note_type === 'personality_insight' ? '[אישיות]' : n.note_type === 'transcript_summary' ? '[סיכום שיחה]' : ''
        entityContext += `[${n.created_at}] ${n.created_by_name} ${noteTypeLabel}: ${n.content.substring(0, 500)}\n`
      }
    }

    // Transcripts
    const { data: transcripts } = await adminClient
      .from('call_transcripts')
      .select('summary, call_date, participants')
      .eq(entityType === 'client' ? 'client_id' : 'lead_id', entityId)
      .order('call_date', { ascending: false })
      .limit(5)
    if (transcripts?.length) {
      entityContext += `\n--- סיכומי שיחות (${transcripts.length}) ---\n`
      for (const t of transcripts) {
        entityContext += `[${t.call_date}] ${t.participants}: ${t.summary?.substring(0, 500) || 'ללא סיכום'}\n`
      }
    }

    // Personality data
    const { data: personality } = await adminClient
      .from('signals_personality')
      .select('primary_archetype, secondary_archetype, confidence_level, churn_risk, smart_tags, sales_cheat_sheet, retention_cheat_sheet, business_intel_v2')
      .eq(entityType === 'client' ? 'client_id' : 'lead_id', entityId)
      .maybeSingle()
    if (personality) {
      entityContext += `\n--- מודיעין אישיותי (Signals OS) ---
ארכיטיפ: ${ARCHETYPE_NAMES[personality.primary_archetype] || personality.primary_archetype} / ${ARCHETYPE_NAMES[personality.secondary_archetype] || personality.secondary_archetype}
סיכון נטישה: ${personality.churn_risk}
ביטחון: ${personality.confidence_level}
תגיות: ${JSON.stringify(personality.smart_tags || [])}
`
      const sales = personality.sales_cheat_sheet as Record<string, string> | null
      if (sales) {
        if (sales.how_to_speak) entityContext += `איך לדבר: ${sales.how_to_speak}\n`
        if (sales.what_not_to_do) entityContext += `ממה להימנע: ${sales.what_not_to_do}\n`
      }
      const v2 = personality.business_intel_v2 as Record<string, unknown> | null
      if (v2?.heroCard) {
        const hero = v2.heroCard as Record<string, unknown>
        entityContext += `פרופיל: ${hero.profileLine || ''}\n`
        entityContext += `סיכוי סגירה: ${hero.closeRate || ''}%\n`
      }
      entityContext += '---\n'
    }

    // Competitor reports
    const { data: compReports } = await adminClient
      .from('competitor_reports')
      .select('analysis, created_at')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .limit(1)
    if (compReports?.length) {
      const analysis = compReports[0].analysis as Record<string, unknown>
      if (analysis?.summary) {
        entityContext += `\n--- ניתוח תחרותי ---\n${analysis.summary}\n---\n`
      }
    }

    // 5. Build system prompt
    const systemPrompt = `אתה עוזר AI חכם ומקצועי בתוך מערכת CRM לסוכנויות שיווק דיגיטלי בישראל.
תפקידך לעזור למשתמש (${callerName}) לנהל את ה${entityLabel} בצורה הטובה ביותר.

יש לך גישה למידע הבא על ה${entityLabel}:

${entityContext}

הנחיות:
- ענה בעברית
- היה קצר, מדויק ופרקטי
- השתמש במידע שיש לך כדי לתת תשובות מותאמות אישית
- אם שואלים שאלה שאין לך מספיק מידע עליה, אמור זאת בכנות
- הצע פעולות קונקרטיות ומעשיות
- אם יש מידע אישיותי (Signals OS), שלב אותו בתשובות על תקשורת עם ה${entityLabel}
- אתה יכול לנתח מגמות, לזהות בעיות, להמליץ על פעולות`

    // 6. Build Gemini conversation
    const geminiContents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: `מובן. יש לי את כל המידע על ה${entityLabel}. במה אוכל לעזור?` }] },
    ]

    // Add chat history
    for (const msg of chatHistory.slice(-10)) {
      geminiContents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      })
    }

    // Add current message
    geminiContents.push({
      role: 'user',
      parts: [{ text: message }],
    })

    // 7. Call Gemini
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${settings.gemini_api_key}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: geminiContents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048,
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error('Gemini API error:', errText)
      return new Response(JSON.stringify({ error: 'שגיאה בקריאה ל-Gemini API' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiResponse.json()
    const reply = (geminiData.candidates?.[0]?.content?.parts || [])
      .filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
      .map((part: { text: string }) => part.text)
      .join('')
      .trim()

    if (!reply) {
      return new Response(JSON.stringify({ error: 'לא התקבלה תשובה מ-AI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 8. Save both messages to DB
    const now = new Date().toISOString()
    await adminClient.from('ai_notebook_messages').insert([
      {
        entity_id: entityId,
        entity_type: entityType,
        role: 'user',
        content: message,
        created_by: user.id,
        created_at: now,
        tenant_id: callerTenantId,
      },
      {
        entity_id: entityId,
        entity_type: entityType,
        role: 'assistant',
        content: reply,
        created_by: user.id,
        created_at: new Date(Date.now() + 1).toISOString(), // +1ms to ensure ordering
        tenant_id: callerTenantId,
      },
    ])

    return new Response(JSON.stringify({
      success: true,
      reply,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('AI Notebook error:', err)
    return new Response(JSON.stringify({ error: 'שגיאה פנימית' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
