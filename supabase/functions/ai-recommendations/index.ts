// Supabase Edge Function: ai-recommendations
// Generates AI-powered recommendations via Gemini API
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
    // Get caller tenant_id
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

    // 3. Parse request body
    const { entityType, entityName, notes, transcripts, additionalContext, personality } = await req.json()

    // 4. Build prompt
    const notesText = (notes || [])
      .map((n: { content: string; createdByName: string; createdAt: string }) =>
        `[${n.createdAt}] ${n.createdByName}: ${n.content}`
      )
      .join('\n')

    const transcriptsText = (transcripts || [])
      .map((ct: { summary: string; callDate: string; transcript: string }) => {
        const transcriptSnippet = ct.transcript?.length > 3000
          ? ct.transcript.substring(0, 3000) + '...'
          : ct.transcript || ''
        return `--- שיחה מתאריך ${ct.callDate} ---\nסיכום: ${ct.summary || 'ללא סיכום'}\nתמלול: ${transcriptSnippet}`
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
      personalityContext = `\n--- מודיעין אישיותי (Signals OS) ---
ארכיטיפ ראשי: ${archNames[personality.primary] || personality.primary}
ארכיטיפ משני: ${archNames[personality.secondary] || personality.secondary}
סיכון נטישה: ${churnLabels[personality.churnRisk] || personality.churnRisk}
רמת ביטחון: ${confLabels[personality.confidenceLevel] || personality.confidenceLevel}
תגיות חכמות: ${(personality.smartTags || []).join(', ')}
${personality.salesCheatSheet?.how_to_speak ? `איך לדבר: ${personality.salesCheatSheet.how_to_speak}` : ''}
${personality.salesCheatSheet?.what_not_to_do ? `ממה להימנע: ${personality.salesCheatSheet.what_not_to_do}` : ''}
${personality.salesCheatSheet?.red_flags ? `דגלים אדומים: ${personality.salesCheatSheet.red_flags}` : ''}
${personality.salesCheatSheet?.best_offers ? `הצעות מומלצות: ${personality.salesCheatSheet.best_offers}` : ''}
${personality.retentionCheatSheet?.onboarding_focus ? `דגש באונבורדינג: ${personality.retentionCheatSheet.onboarding_focus}` : ''}
${personality.retentionCheatSheet?.risk_moments ? `רגעי סיכון: ${personality.retentionCheatSheet.risk_moments}` : ''}
---\n`
    }

    const prompt = `אתה מנהל חשבון בכיר בסוכנות שיווק דיגיטלי בישראל. נתונים על ${entityLabel}: "${entityName}"

${additionalContext ? `מידע נוסף: ${additionalContext}` : ''}
${personalityContext}
${notesText ? `הערות:\n${notesText}` : 'אין הערות'}

${transcriptsText ? `תמלולי שיחות:\n${transcriptsText}` : 'אין תמלולי שיחות'}

בהתבסס על כל המידע למעלה${personalityContext ? ', כולל נתוני אישיות Signals OS,' : ''} תן המלצות מעשיות וספציפיות:
1. מה הצעד הבא שצריך לעשות עם ${entityLabel === 'לקוח' ? 'הלקוח' : 'הליד'} הזה?
2. מה הסיכונים או ההזדמנויות שצריך לשים לב אליהם?
3. האם יש שירותים נוספים שכדאי להציע?
4. המלצות לשיפור היחסים והתקשורת
${personalityContext ? '5. המלצות ספציפיות בהתבסס על הפרופיל האישיותי (ארכיטיפ, סגנון תקשורת, סיכוני נטישה)' : ''}

ענה בעברית, בצורה מסודרת עם כותרות ברורות. היה ספציפי ומעשי.`

    // 5. Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
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
    const parts = geminiResult.candidates?.[0]?.content?.parts || []
    let recommendation = ''
    for (const part of parts) {
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
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
