// Supabase Edge Function: generate-ai-summary
// Generates AI summaries for transcripts or recommendations, saved as notes
// Deploy: npx supabase functions deploy generate-ai-summary --project-ref rxckkozbkrabpjdgyxqm

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
    const { data: settings } = await adminClient
      .from('settings')
      .select('gemini_api_key')
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
    const { summaryType, transcript, transcriptSummary, recommendation, entityName, additionalContext } = await req.json()

    if (!summaryType || !['transcript_summary', 'recommendation_summary', 'proposal_focus'].includes(summaryType)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'סוג סיכום לא חוקי',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build prompt based on summary type
    let prompt = ''

    if (summaryType === 'transcript_summary') {
      if (!transcript && !transcriptSummary) {
        return new Response(JSON.stringify({
          success: false,
          error: 'חסר תמלול או סיכום לעיבוד',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Use existing summary if available, otherwise use the transcript
      const sourceText = transcriptSummary
        ? `סיכום קיים של השיחה:\n${transcriptSummary}`
        : `תמלול השיחה (קטע):\n${(transcript || '').substring(0, 5000)}`

      prompt = `אתה מנהל חשבון בכיר בסוכנות שיווק דיגיטלי "עלמה?" בישראל.

${entityName ? `שם הלקוח/ליד: "${entityName}"` : ''}
${additionalContext ? `מידע נוסף: ${additionalContext}` : ''}

${sourceText}

סכם את השיחה לתיעוד במערכת CRM בצורה מסודרת. הסיכום חייב לכלול את הכותרות הבאות:

## פרופיל הלקוח
(תיאור קצר של הלקוח, העסק שלו, והרקע)

## צרכי הלקוח
(מה הלקוח מחפש, מה הבעיות שלו)

## במה כדאי להתמקד בשיחות המכירה
(נקודות מפתח לשיחות עתידיות)

## תאריך חזרה עתידי מומלץ
(מתי כדאי ליצור קשר שוב ולמה)

## מה כדאי לעשות הלאה
(צעדים הבאים ספציפיים)

ענה בעברית בלבד. היה תמציתי אך ספציפי.`
    } else if (summaryType === 'recommendation_summary') {
      if (!recommendation) {
        return new Response(JSON.stringify({
          success: false,
          error: 'חסר המלצת AI לעיבוד',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      prompt = `אתה מנהל חשבון בכיר בסוכנות שיווק דיגיטלי "עלמה?" בישראל.

${entityName ? `שם הלקוח/ליד: "${entityName}"` : ''}
${additionalContext ? `מידע נוסף: ${additionalContext}` : ''}

המלצת AI שנוצרה:
${recommendation.substring(0, 5000)}

מתוך ההמלצה, חלץ סיכום תמציתי בפורמט הבא:

## המלצה עיקרית
(משפט אחד שמסכם את ההמלצה המרכזית)

## פעולות מומלצות
(3-5 פעולות ספציפיות עם סימון ✅ לכל פעולה)

## תובנות מפתח
(2-3 תובנות חשובות מההמלצה)

ענה בעברית בלבד. היה תמציתי ומעשי.`
    } else if (summaryType === 'proposal_focus') {
      // proposal_focus: analyze transcript/recommendation to guide price proposal
      if (!transcript && !transcriptSummary && !recommendation) {
        return new Response(JSON.stringify({
          success: false,
          error: 'חסר תמלול, סיכום או המלצה ליצירת מיקוד הצעת מחיר',
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Build source text from all available inputs
      let sourceText = ''
      if (transcriptSummary) {
        sourceText += `סיכום שיחה:\n${transcriptSummary}\n\n`
      }
      if (transcript) {
        sourceText += `תמלול שיחה (קטע):\n${(transcript || '').substring(0, 5000)}\n\n`
      }
      if (recommendation) {
        sourceText += `המלצת AI:\n${(recommendation || '').substring(0, 3000)}\n\n`
      }

      prompt = `אתה מנהל חשבון בכיר בסוכנות שיווק דיגיטלי "עלמה?" בישראל.
אתה מתכונן להגיש הצעת מחיר ללקוח/ליד.

${entityName ? `שם הלקוח/ליד: "${entityName}"` : ''}
${additionalContext ? `מידע נוסף: ${additionalContext}` : ''}

${sourceText}

בהתבסס על כל המידע הזמין, צור מסמך מיקוד להצעת מחיר בפורמט הבא:

## שירותים מומלצים להציע
(רשימת שירותים ספציפיים שכדאי לכלול בהצעה, עם הסבר קצר למה כל שירות רלוונטי)

## נקודות כאב שזוהו
(בעיות ואתגרים שהלקוח ציין או שניתן לזהות — אלו יהפכו לנקודות מכירה)

## הצעת ערך — מה יגרום להם להגיד כן
(מה הכי מהדהד עם הלקוח הזה, מה הערך המוסף שלנו, איזה תוצאות להדגיש)

## מה לא להציע / סיכונים
(שירותים או גישות שכדאי להימנע מהם, דגלים אדומים, ציפיות לא מציאותיות)

## טון מומלץ להצעה
(רשמי/ידידותי, טכני/פשוט, דחיפות/סבלנות — ותיאור קצר של הגישה)

ענה בעברית בלבד. היה ספציפי ומעשי. כל סעיף צריך להיות ממוקד ללקוח הספציפי הזה.`
    }

    // 5. Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return new Response(JSON.stringify({
        success: false,
        error: `Gemini API error (${geminiRes.status}): ${errText.substring(0, 500)}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiResult = await geminiRes.json()

    // Handle Gemini 2.5 thinking parts
    const parts = geminiResult.candidates?.[0]?.content?.parts || []
    let summaryText = ''
    for (const part of parts) {
      if (part.text && !part.thought) {
        summaryText += part.text
      }
    }

    if (!summaryText) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Gemini לא הצליח ליצור סיכום. נסה שוב.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      summary: summaryText.trim(),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Internal server error'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
