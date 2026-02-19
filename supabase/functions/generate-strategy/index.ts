// Supabase Edge Function: generate-strategy
// Generates comprehensive strategy & action plan via Gemini 3 Pro
// Server-side CRM context gathering (like ai-notebook) + structured JSON output
// Deploy: npx supabase functions deploy generate-strategy --project-ref rxckkozbkrabpjdgyxqm

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
      .select('tenant_id')
      .eq('user_id', user.id)
      .single()
    const callerTenantId = callerRole?.tenant_id

    const { data: settings } = await adminClient
      .from('settings')
      .select('gemini_api_key')
      .eq('tenant_id', callerTenantId)
      .single()

    if (!settings?.gemini_api_key) {
      return new Response(JSON.stringify({
        success: false,
        error: 'מפתח Gemini API לא מוגדר. הגדר אותו בעמוד ההגדרות.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Parse request
    const body = await req.json()
    const { entityId, entityType } = body as {
      entityId: string
      entityType: 'client' | 'lead'
    }

    if (!entityId || !entityType) {
      return new Response(JSON.stringify({ success: false, error: 'חסר entityId או entityType' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================================
    // 4. Server-side CRM context gathering (like ai-notebook)
    // ============================================================
    let entityContext = ''
    const entityLabel = entityType === 'client' ? 'לקוח' : 'ליד'
    let entityName = ''

    if (entityType === 'client') {
      const { data: client } = await adminClient
        .from('clients')
        .select('*')
        .eq('client_id', entityId)
        .single()

      if (client) {
        entityName = client.business_name || client.client_name
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

      // Expenses
      const { data: expenses } = await adminClient
        .from('expenses')
        .select('supplier_name, amount, expense_date, expense_type')
        .eq('client_id', entityId)
        .order('expense_date', { ascending: false })
        .limit(10)
      if (expenses?.length) {
        entityContext += `\n--- הוצאות ספקים (${expenses.length}) ---\n`
        for (const e of expenses) {
          entityContext += `${e.supplier_name}: ₪${e.amount} (${e.expense_date}) [${e.expense_type}]\n`
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
        entityName = lead.business_name || lead.lead_name
        entityContext += `--- פרטי ${entityLabel} ---
שם: ${lead.lead_name}
עסק: ${lead.business_name || 'לא צוין'}
טלפון: ${lead.phone || 'לא צוין'}
אימייל: ${lead.email || 'לא צוין'}
מקור: ${lead.source_channel}
סטטוס: ${lead.status}
תקציב משוער: ₪${lead.estimated_budget || 0}
ערך מצוטט: ₪${lead.quoted_monthly_value || 0}
שירותים מבוקשים: ${lead.interested_services || '[]'}
הערות: ${lead.notes || 'אין'}
תאריך קשר הבא: ${lead.next_contact_date || 'לא נקבע'}
---\n`
      }
    }

    // Notes (both client and lead)
    const notesTable = entityType === 'client' ? 'client_notes' : 'lead_notes'
    const notesFK = entityType === 'client' ? 'client_id' : 'lead_id'
    const { data: notes } = await adminClient
      .from(notesTable)
      .select('content, created_by_name, created_at, note_type')
      .eq(notesFK, entityId)
      .order('created_at', { ascending: false })
      .limit(30)
    if (notes?.length) {
      entityContext += `\n--- הערות (${notes.length}) ---\n`
      for (const n of notes) {
        const typeTag = n.note_type === 'transcript_summary' ? '[סיכום שיחה]'
          : n.note_type === 'recommendation_summary' ? '[סיכום המלצות]'
          : n.note_type === 'proposal_focus' ? '[מיקוד הצעה]'
          : ''
        entityContext += `[${n.created_at}] ${n.created_by_name} ${typeTag}: ${n.content.substring(0, 500)}\n`
      }
    }

    // Call Transcripts
    const { data: transcripts } = await adminClient
      .from('call_transcripts')
      .select('summary, call_date, participants, transcript')
      .eq(entityType === 'client' ? 'client_id' : 'lead_id', entityId)
      .order('call_date', { ascending: false })
      .limit(10)
    if (transcripts?.length) {
      entityContext += `\n--- תמלולי שיחות (${transcripts.length}) ---\n`
      for (const t of transcripts) {
        entityContext += `[${t.call_date}] ${t.participants || ''}:\nסיכום: ${t.summary?.substring(0, 800) || 'ללא סיכום'}\n`
        if (t.transcript) {
          entityContext += `תמליל: ${t.transcript.substring(0, 1000)}\n`
        }
        entityContext += '---\n'
      }
    }

    // AI Recommendations
    const { data: recs } = await adminClient
      .from('ai_recommendations')
      .select('recommendation, created_at, created_by_name')
      .eq(entityType === 'client' ? 'client_id' : 'lead_id', entityId)
      .order('created_at', { ascending: false })
      .limit(5)
    if (recs?.length) {
      entityContext += `\n--- המלצות AI קודמות (${recs.length}) ---\n`
      for (const r of recs) {
        entityContext += `[${r.created_at}] ${r.created_by_name}: ${r.recommendation.substring(0, 800)}\n---\n`
      }
    }

    // WhatsApp Messages
    const { data: waMessages } = await adminClient
      .from('whatsapp_messages')
      .select('message_text, message_purpose, sent_by_name, sent_at')
      .eq(entityType === 'client' ? 'client_id' : 'lead_id', entityId)
      .order('sent_at', { ascending: false })
      .limit(20)
    if (waMessages?.length) {
      entityContext += `\n--- הודעות WhatsApp (${waMessages.length}) ---\n`
      for (const m of waMessages) {
        entityContext += `[${m.sent_at}] ${m.sent_by_name} (${m.message_purpose}): ${m.message_text.substring(0, 300)}\n`
      }
    }

    // Signals Personality
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
        if (sales.best_offers) entityContext += `הצעות שעובדות: ${sales.best_offers}\n`
        if (sales.red_flags) entityContext += `דגלים אדומים: ${sales.red_flags}\n`
        if (sales.closing_strategy) entityContext += `אסטרטגיית סגירה: ${sales.closing_strategy}\n`
      }
      const retention = personality.retention_cheat_sheet as Record<string, string> | null
      if (retention) {
        if (retention.onboarding_focus) entityContext += `מיקוד אונבורדינג: ${retention.onboarding_focus}\n`
        if (retention.risk_moments) entityContext += `רגעי סיכון: ${retention.risk_moments}\n`
      }
      const v2 = personality.business_intel_v2 as Record<string, unknown> | null
      if (v2?.heroCard) {
        const hero = v2.heroCard as Record<string, unknown>
        entityContext += `פרופיל: ${hero.profileLine || ''}\n`
        entityContext += `סיכוי סגירה: ${hero.closeRate || ''}%\n`
      }
      entityContext += '---\n'
    }

    // Competitor Reports
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

    // ============================================================
    // 5. Build strategy prompt
    // ============================================================
    const prompt = `אתה יועץ אסטרטגי בכיר לסוכנויות שיווק דיגיטלי בישראל.
אתה מומחה בניתוח עסקי עמוק — לא רק ברמת הסימפטומים, אלא ברמת שורש הבעיות והמנגנונים.

קיבלת את כל המידע הקיים על ה${entityLabel} "${entityName}" ממערכת ה-CRM:

${entityContext}

על סמך כל המידע, צור מסמך אסטרטגי מקיף שכולל:

1. **ניתוח מצב קיים** — חפור לעומק:
   - מה עובד טוב (דברים שכדאי להמשיך)
   - מה לא עובד (בעיות אמיתיות, לא רק סימפטומים)
   - תלויות (על מה העסק נשען — אנרגיה של בעלים? לקוח אחד דומיננטי? ערוץ שיווק אחד?)
   - סיכונים (מה יכול להשתבש)
   - הזדמנויות (כסף שמונח על השולחן — דאטה ישן, הפניות, שיתופי פעולה)

2. **תוכנית עבודה מפורטת** ב-3 שלבים (30/60/90 ימים):
   - כל שלב עם כותרת, תיאור כללי, ופעולות ממוספרות
   - כל פעולה: שם, תיאור קצר, מי אחראי (סוכנות/לקוח/שניהם), ומדד הצלחה (KPI)
   - שלב 1 = יסודות ו-Quick Wins
   - שלב 2 = מנגנוני צמיחה
   - שלב 3 = הרחבה ואוטומציה

3. **מדדי הצלחה (KPIs)** — 3-5 מדדים מרכזיים עם יעד ומסגרת זמן

${personality ? `4. **המלצות מבוססות אישיות** — על סמך הפרופיל האישיותי (Signals OS), התאם את הטון, הגישה ואופן ההצגה של התוכנית ל${entityLabel}.` : ''}

החזר את התשובה כ-JSON בלבד, בדיוק במבנה הזה (ללא markdown, ללא code fences, JSON טהור):
{
  "summary": "פסקת סיכום מנהלים של 2-3 משפטים",
  "situationAnalysis": {
    "whatsWorking": ["נקודה 1", "נקודה 2"],
    "whatsNotWorking": ["בעיה 1", "בעיה 2"],
    "dependencies": ["תלות 1"],
    "risks": ["סיכון 1"],
    "opportunities": ["הזדמנות 1"]
  },
  "actionPlan": [
    {
      "phaseLabel": "שלב 1: 30 ימים ראשונים — יסודות ו-Quick Wins",
      "phaseSummary": "תיאור כללי של השלב",
      "actions": [
        {
          "number": 1,
          "title": "שם הפעולה",
          "description": "תיאור קצר ומעשי",
          "owner": "סוכנות/לקוח/שניהם",
          "kpi": "מדד הצלחה"
        }
      ]
    }
  ],
  "kpis": [
    { "label": "שם המדד", "target": "יעד מספרי", "timeframe": "מסגרת זמן" }
  ]
}

חשוב:
- כתוב הכל בעברית
- היה ספציפי ומעשי, לא גנרי
- כל פעולה צריכה להיות משהו שאפשר לעשות מחר בבוקר
- אל תחזור על מה שכבר נאמר בהמלצות קודמות — תן ערך חדש
- נתח לעומק, לא ברמה שטחית. זהה דפוסים, מנגנונים שבורים, כסף שנזרק
- אם יש מידע אישיותי, התאם את הגישה`

    // ============================================================
    // 6. Call Gemini 3 Pro
    // ============================================================
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${settings.gemini_api_key}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 8192,
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error('Gemini API error:', errText)
      return new Response(JSON.stringify({ success: false, error: 'שגיאה בקריאה ל-Gemini API' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiResponse.json()

    // Filter thinking parts
    const rawText = (geminiData.candidates?.[0]?.content?.parts || [])
      .filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
      .map((part: { text: string }) => part.text)
      .join('')
      .trim()

    if (!rawText) {
      return new Response(JSON.stringify({ success: false, error: 'לא התקבלה תשובה מ-AI' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ============================================================
    // 7. Parse JSON with multi-level fallback
    // ============================================================
    let planData = null

    // Try 1: Direct parse
    try {
      planData = JSON.parse(rawText)
    } catch {
      // Try 2: Extract JSON from markdown code fences
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          planData = JSON.parse(jsonMatch[1].trim())
        } catch { /* continue to fallback */ }
      }

      // Try 3: Find first { to last }
      if (!planData) {
        const firstBrace = rawText.indexOf('{')
        const lastBrace = rawText.lastIndexOf('}')
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          try {
            planData = JSON.parse(rawText.substring(firstBrace, lastBrace + 1))
          } catch { /* use raw text fallback */ }
        }
      }
    }

    // Validate structure
    if (planData && (!planData.situationAnalysis || !planData.actionPlan)) {
      // Partial parse — keep raw text too
      console.warn('Partial JSON structure detected')
    }

    return new Response(JSON.stringify({
      success: true,
      plan: planData || {},
      rawText,
      entityName,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('generate-strategy error:', err)
    return new Response(JSON.stringify({
      success: false,
      error: `שגיאה פנימית: ${err instanceof Error ? err.message : 'Unknown error'}`,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
