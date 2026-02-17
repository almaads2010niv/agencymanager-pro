// Supabase Edge Function: generate-whatsapp-messages
// Generates 3 WhatsApp message variants via Gemini API
// Deploy: npx supabase functions deploy generate-whatsapp-messages --project-ref rxckkozbkrabpjdgyxqm

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
    const { entityType, entityName, purpose, purposeLabel, notes, transcripts, additionalContext, personality } = await req.json()

    // 4. Build context from notes, transcripts, and personality
    const notesText = (notes || [])
      .slice(0, 5) // Last 5 notes for context
      .map((n: { content: string; createdByName: string; createdAt: string }) =>
        `[${n.createdAt}] ${n.createdByName}: ${n.content}`
      )
      .join('\n')

    const transcriptsText = (transcripts || [])
      .slice(0, 3) // Last 3 transcripts
      .map((ct: { summary: string; callDate: string }) =>
        `שיחה מתאריך ${ct.callDate}: ${ct.summary || 'ללא סיכום'}`
      )
      .join('\n')

    const entityLabel = entityType === 'client' ? 'לקוח' : 'ליד'

    // 5. Build personality context if available (from Signals OS)
    const archetypeNames: Record<string, string> = {
      WINNER: 'המנצח', STAR: 'הכוכב', DREAMER: 'החולם',
      HEART: 'הלב', ANCHOR: 'העוגן',
    }

    let personalityContext = ''
    let personalityStyleGuide = ''
    if (personality?.primary) {
      const primaryHeb = archetypeNames[personality.primary] || personality.primary
      const secondaryHeb = personality.secondary ? (archetypeNames[personality.secondary] || personality.secondary) : ''

      personalityContext = `\n🧠 פרופיל אישיות Signals OS:
- ארכיטיפ ראשי: ${primaryHeb}${secondaryHeb ? ` | משני: ${secondaryHeb}` : ''}
- סיכון נטישה: ${personality.churnRisk || 'לא ידוע'}
${personality.smartTags?.length ? `- תגיות חכמות: ${personality.smartTags.join(', ')}` : ''}`

      const cheat = personality.salesCheatSheet
      if (cheat) {
        personalityStyleGuide = `\n⚡ חובה — התאם את ההודעה לפרופיל האישיות:
- איך לדבר איתו: ${cheat.how_to_speak || 'לא ידוע'}
- ממה להימנע בהחלט: ${cheat.what_not_to_do || 'לא ידוע'}
- מהירות סגירה: ${cheat.closing_speed || 'לא ידוע'}
- הצעות שעובדות: ${cheat.best_offers || 'לא ידוע'}
- הוכחה חברתית שעובדת: ${cheat.best_social_proof || 'לא ידוע'}
- דגלים אדומים — אם תגיד את זה הוא יברח: ${cheat.red_flags || 'לא ידוע'}`
      }
    }

    const hasPersonality = !!personality?.primary

    // 6. Build prompt for WhatsApp message generation
    const prompt = `אתה מנהל חשבון בסוכנות שיווק דיגיטלי בישראל בשם "עלמה?".
צריך לכתוב 3 וריאנטים של הודעת WhatsApp קצרה ומקצועית עבור ${entityLabel}: "${entityName}".

מטרת ההודעה: ${purposeLabel || purpose}

${additionalContext ? `הקשר נוסף: ${additionalContext}` : ''}
${personalityContext}
${personalityStyleGuide}

${notesText ? `הערות אחרונות:\n${notesText}` : ''}

${transcriptsText ? `סיכומי שיחות אחרונות:\n${transcriptsText}` : ''}

דרישות:
- כל הודעה 1-3 משפטים בלבד (קצרה, מתאימה לוואטסאפ)
${hasPersonality
  ? `- 🧠 חובה: התאם את הטון, השפה והגישה לפרופיל האישיות שלמעלה!
- וריאנט 1: סגנון שהכי מתאים לארכיטיפ הראשי שלו
- וריאנט 2: סגנון חלופי שעדיין מתאים לפרופיל
- וריאנט 3: סגנון ישיר, עם טריגר שמתאים לאישיות`
  : `- טון מקצועי אך ידידותי וחם
- וריאנט 1: סגנון רשמי-מקצועי
- וריאנט 2: סגנון ידידותי וחם
- וריאנט 3: סגנון ישיר ותכליתי`}
- בעברית
- פנה בשם: ${entityName}
- אל תכלול אמוג'ים מיותרים

החזר בדיוק בפורמט JSON הבא (מערך של 3 מחרוזות):
["הודעה 1", "הודעה 2", "הודעה 3"]

החזר רק את ה-JSON, בלי טקסט נוסף, בלי markdown, בלי backticks.`

    // 6. Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1024,
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
        status: 200, // Return 200 so frontend can read the error details
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Parse response (gemini-2.0-flash-lite: simple text, no thinking parts)
    const geminiResult = await geminiRes.json()
    const parts = geminiResult.candidates?.[0]?.content?.parts || []
    let rawText = ''
    for (const part of parts) {
      if (part.text) {
        rawText += part.text
      }
    }

    let messages: string[] = []
    try {
      // With responseMimeType: 'application/json', response should be clean JSON
      // Try direct parse first
      const parsed = JSON.parse(rawText.trim())
      if (Array.isArray(parsed)) {
        messages = parsed
      } else if (parsed && Array.isArray(parsed.messages)) {
        messages = parsed.messages
      }
    } catch {
      try {
        // Fallback: extract JSON array from response (handles markdown code fences)
        const jsonMatch = rawText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          messages = JSON.parse(jsonMatch[0])
        }
      } catch {
        // Last resort: split by numbered lines
        messages = rawText
          .split(/\d+[.)]\s*/)
          .map((s: string) => s.replace(/^["']|["']$/g, '').trim())
          .filter((s: string) => s.length > 0)
          .slice(0, 3)
      }
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Gemini לא הצליח ליצור הודעות. נסה שוב.',
        debug: `parts=${parts.length}, rawLen=${rawText.length}, raw=${rawText.substring(0, 300)}`,
      }), {
        status: 200, // Return 200 so frontend can read the error details
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      messages: messages.slice(0, 3), // Ensure max 3
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: `Internal server error: ${err instanceof Error ? err.message : String(err)}`,
    }), {
      status: 200, // Return 200 so frontend can read the error details
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
