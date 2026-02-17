// Supabase Edge Function: summarize-document
// Summarizes documents using Gemini AI for knowledge base
// Deploy: npx supabase functions deploy summarize-document --project-ref rxckkozbkrabpjdgyxqm

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

    // 2. Get Gemini API key from settings
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

    // 3. Parse request body
    const { textContent, fileName } = await req.json()

    if (!textContent) {
      return new Response(JSON.stringify({ error: 'textContent is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build prompt
    const prompt = `אתה עוזר לניהול ידע בסוכנות שיווק דיגיטלי.
סכם את המסמך הבא וסווג אותו.

${fileName ? `שם קובץ: ${fileName}` : ''}

תוכן המסמך:
---
${textContent.substring(0, 15000)}
---

החזר תשובה כ-JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "summary": "סיכום תמציתי ב-3-5 משפטים בעברית",
  "suggestedCategory": "אחת מ: strategy | marketing | design | development | operations | finance | general",
  "suggestedTags": ["תג1", "תג2", "תג3"]
}

ודא ש:
- הסיכום תמציתי וברור
- הקטגוריה מתאימה לתוכן
- 3-5 תגים רלוונטיים בעברית`

    // 5. Call Gemini API (2.0-flash-lite for reliable JSON)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${settings.gemini_api_key}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
        },
      }),
    })

    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      return new Response(JSON.stringify({ success: false, error: `Gemini API error: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData.candidates?.[0]?.content?.parts
      ?.filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
      ?.map((part: { text: string }) => part.text)
      ?.join('') || ''

    // 6. Parse JSON from response
    let result = { summary: '', suggestedCategory: 'general', suggestedTags: [] as string[] }
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        result = {
          summary: parsed.summary || '',
          suggestedCategory: parsed.suggestedCategory || 'general',
          suggestedTags: Array.isArray(parsed.suggestedTags) ? parsed.suggestedTags : [],
        }
      }
    } catch {
      // If JSON parse fails, use the raw text as summary
      result.summary = rawText.substring(0, 500)
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error: ' + String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
