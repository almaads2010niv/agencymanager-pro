// Supabase Edge Function: ai-recommendations
// Generates AI-powered recommendations via Gemini API
// Supports: JSON body (regular) + FormData with PDF (Signals OS report upload)
// Deploy: npx supabase functions deploy ai-recommendations --project-ref rxckkozbkrabpjdgyxqm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Verify authenticated user
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

    // 2. Get Gemini API key from settings (via service role)
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

    const geminiApiKey = settings.gemini_api_key

    // 3. Parse request — JSON or FormData (with PDF)
    const contentType = req.headers.get('content-type') || ''
    let entityType = 'lead'
    let entityName = ''
    let notes: { content: string; createdByName: string; createdAt: string }[] = []
    let transcripts: { summary: string; callDate: string; transcript?: string }[] = []
    let additionalContext = ''
    let personality: Record<string, unknown> | null = null
    let pdfFileData: Uint8Array | null = null
    let pdfMimeType = 'application/pdf'

    if (contentType.includes('multipart/form-data')) {
      // ===== PDF upload mode =====
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      entityType = (formData.get('entityType') as string) || 'lead'
      entityName = (formData.get('entityName') as string) || ''
      additionalContext = (formData.get('additionalContext') as string) || ''

      try { notes = JSON.parse((formData.get('notes') as string) || '[]') } catch { notes = [] }
      try { transcripts = JSON.parse((formData.get('transcripts') as string) || '[]') } catch { transcripts = [] }

      if (file) {
        pdfFileData = new Uint8Array(await file.arrayBuffer())
        pdfMimeType = file.type || 'application/pdf'
      }

      // Also try to get personality data from the lead's signals_personality in DB
      const leadId = formData.get('leadId') as string
      if (leadId) {
        const { data: sigPers } = await adminClient
          .from('signals_personality')
          .select('*')
          .eq('lead_id', leadId)
          .maybeSingle()
        if (sigPers) {
          personality = {
            primary: sigPers.primary_archetype,
            secondary: sigPers.secondary_archetype,
            confidenceLevel: sigPers.confidence_level,
            churnRisk: sigPers.churn_risk,
            smartTags: sigPers.smart_tags,
            salesCheatSheet: sigPers.sales_cheat_sheet,
            retentionCheatSheet: sigPers.retention_cheat_sheet,
          }
        }
      }
    } else {
      // ===== Regular JSON mode =====
      const body = await req.json()
      entityType = body.entityType || 'lead'
      entityName = body.entityName || ''
      notes = body.notes || []
      transcripts = body.transcripts || []
      additionalContext = body.additionalContext || ''
      personality = body.personality || null
    }

    // 4. Build prompt
    const notesText = notes
      .map((n) => `[${n.createdAt}] ${n.createdByName}: ${n.content}`)
      .join('\n')

    const transcriptsText = transcripts
      .map((ct) => {
        const transcriptSnippet = ct.transcript?.length && ct.transcript.length > 3000
          ? ct.transcript.substring(0, 3000) + '...'
          : ct.transcript || ''
        return `--- שיחה מתאריך ${ct.callDate} ---\nסיכום: ${ct.summary || 'ללא סיכום'}\n${transcriptSnippet ? `תמלול: ${transcriptSnippet}` : ''}`
      })
      .join('\n\n')

    const entityLabel = entityType === 'client' ? 'לקוח' : 'ליד'

    // Build personality context if available
    const archNames: Record<string, string> = {
      WINNER: 'ווינר', STAR: 'סטאר', DREAMER: 'חולם', HEART: 'לב', ANCHOR: 'עוגן',
    }
    const churnLabels: Record<string, string> = { HIGH: 'גבוה', MEDIUM: 'בינוני', LOW: 'נמוך' }
    const confLabels: Record<string, string> = { HIGH: 'גבוהה', MEDIUM: 'בינונית', LOW: 'נמוכה' }

    let personalityContext = ''
    if (personality) {
      const p = personality as Record<string, unknown>
      const salesSheet = (p.salesCheatSheet || {}) as Record<string, string>
      const retSheet = (p.retentionCheatSheet || {}) as Record<string, string>
      personalityContext = `\n--- מודיעין אישיותי (Signals OS) ---
ארכיטיפ ראשי: ${archNames[p.primary as string] || p.primary}
ארכיטיפ משני: ${archNames[p.secondary as string] || p.secondary}
סיכון נטישה: ${churnLabels[p.churnRisk as string] || p.churnRisk}
רמת ביטחון: ${confLabels[p.confidenceLevel as string] || p.confidenceLevel}
תגיות חכמות: ${((p.smartTags as string[]) || []).join(', ')}
${salesSheet.how_to_speak ? `איך לדבר: ${salesSheet.how_to_speak}` : ''}
${salesSheet.what_not_to_do ? `ממה להימנע: ${salesSheet.what_not_to_do}` : ''}
${salesSheet.red_flags ? `דגלים אדומים: ${salesSheet.red_flags}` : ''}
${salesSheet.best_offers ? `הצעות מומלצות: ${salesSheet.best_offers}` : ''}
${retSheet.onboarding_focus ? `דגש באונבורדינג: ${retSheet.onboarding_focus}` : ''}
${retSheet.risk_moments ? `רגעי סיכון: ${retSheet.risk_moments}` : ''}
---\n`
    }

    const pdfInstruction = pdfFileData
      ? `\n\n*** חשוב: מצורף דוח PDF של אבחון אישיות Signals OS. נתח את כל המידע בדוח ושלב אותו בהמלצות שלך. ***
בהתבסס על הדוח, הוסף:
6. ניתוח מעמיק של הפרופיל האישיותי — מה אומר הדוח על סגנון קבלת החלטות, מוטיבציות, וחסמים
7. איך לדבר עם הליד הזה — טון, מילים, סגנון שכנוע מותאם אישית
8. מה לא לעשות — טעויות שיגרמו לו להתנגד או לברוח
9. סוג ההצעה שתעבוד הכי טוב — איך למסגר את השירות בדיוק בשפה שלו\n`
      : ''

    const prompt = `אתה מנהל חשבון בכיר בסוכנות שיווק דיגיטלי בישראל. נתונים על ${entityLabel}: "${entityName}"

${additionalContext ? `מידע נוסף: ${additionalContext}` : ''}
${personalityContext}
${notesText ? `הערות:\n${notesText}` : 'אין הערות'}

${transcriptsText ? `תמלולי שיחות:\n${transcriptsText}` : 'אין תמלולי שיחות'}

בהתבסס על כל המידע למעלה${personalityContext ? ', כולל נתוני אישיות Signals OS,' : ''}${pdfFileData ? ' וה-PDF המצורף,' : ''} תן המלצות מעשיות וספציפיות:
1. מה הצעד הבא שצריך לעשות עם ${entityLabel === 'לקוח' ? 'הלקוח' : 'הליד'} הזה?
2. מה הסיכונים או ההזדמנויות שצריך לשים לב אליהם?
3. האם יש שירותים נוספים שכדאי להציע?
4. המלצות לשיפור היחסים והתקשורת
${personalityContext || pdfFileData ? '5. המלצות ספציפיות בהתבסס על הפרופיל האישיותי (ארכיטיפ, סגנון תקשורת, סיכוני נטישה)' : ''}
${pdfInstruction}

ענה בעברית, בצורה מסודרת עם כותרות ברורות. היה ספציפי ומעשי.`

    // 5. Build Gemini request — with or without PDF
    const parts: Record<string, unknown>[] = [{ text: prompt }]

    if (pdfFileData) {
      // Add PDF as inline data
      const base64Pdf = btoa(String.fromCharCode(...pdfFileData))
      parts.unshift({
        inline_data: {
          mime_type: pdfMimeType,
          data: base64Pdf,
        },
      })
    }

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return new Response(JSON.stringify({
        success: false,
        error: `Gemini API error (${geminiRes.status}): ${errText}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Handle Gemini 3 thinking parts
    const geminiResult = await geminiRes.json()
    const resultParts = geminiResult.candidates?.[0]?.content?.parts || []
    let recommendation = ''
    for (const part of resultParts) {
      if (part.text && !part.thought) {
        recommendation += part.text
      }
    }

    if (!recommendation) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Gemini did not return a recommendation',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      recommendation,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('ai-recommendations error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
