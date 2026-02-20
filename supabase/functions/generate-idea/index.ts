// Supabase Edge Function: generate-idea
// Generates AI-powered marketing ideas for clients via Gemini
// Optionally scrapes FB/IG/Website for context-aware ideas
// Deploy: npx supabase functions deploy generate-idea --project-ref rxckkozbkrabpjdgyxqm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Simple URL content fetcher — grabs text from a URL
async function fetchUrlContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000) // 8s timeout

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgencyManagerBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'he,en;q=0.5',
      },
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!res.ok) return null

    const html = await res.text()

    // Extract useful text: strip HTML tags, scripts, styles
    const cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    // Limit to first 2000 chars to stay within token limits
    return cleaned.substring(0, 2000) || null
  } catch {
    return null
  }
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

    // 3. Parse request body
    const { clientName, businessName, industry, services, notes, facebookUrl, websiteUrl, instagramUrl } = await req.json()

    // 4. Scrape URLs in parallel (if provided)
    const scrapePromises: Promise<{ source: string; content: string | null }>[] = []

    if (facebookUrl) {
      scrapePromises.push(
        fetchUrlContent(facebookUrl).then(content => ({ source: 'Facebook', content }))
      )
    }
    if (instagramUrl) {
      scrapePromises.push(
        fetchUrlContent(instagramUrl).then(content => ({ source: 'Instagram', content }))
      )
    }
    if (websiteUrl) {
      scrapePromises.push(
        fetchUrlContent(websiteUrl).then(content => ({ source: 'אתר אינטרנט', content }))
      )
    }

    const scrapeResults = await Promise.all(scrapePromises)
    const scrapedData = scrapeResults
      .filter(r => r.content)
      .map(r => `--- ${r.source} ---\n${r.content}`)
      .join('\n\n')

    // 5. Build prompt
    let prompt = `אתה מנהל חשבונות בכיר בסוכנות שיווק דיגיטלי ישראלית.
צור 5 רעיונות שיווקיים יצירתיים ומעשיים עבור הלקוח הבא.

שם לקוח: ${clientName || 'לא צוין'}
שם עסק: ${businessName || 'לא צוין'}
תחום: ${industry || 'לא צוין'}
שירותים נוכחיים: ${(services || []).join(', ') || 'לא צוין'}
${notes ? `הערות: ${notes}` : ''}`

    if (scrapedData) {
      prompt += `

ניתוח הנוכחות הדיגיטלית של הלקוח (נסרק אוטומטית):
${scrapedData}

השתמש במידע שנסרק כדי:
- לזהות נושאים ותכנים שהעסק כבר מפרסם
- לזהות חורים ופערים בנוכחות הדיגיטלית
- להציע רעיונות שמשלימים את הפעילות הקיימת
- להתייחס לטון, סגנון ושפה שהעסק משתמש בהם`
    }

    if (facebookUrl) prompt += `\nלינק פייסבוק: ${facebookUrl}`
    if (instagramUrl) prompt += `\nלינק אינסטגרם: ${instagramUrl}`
    if (websiteUrl) prompt += `\nלינק אתר: ${websiteUrl}`

    prompt += `

החזר תשובה כ-JSON array בפורמט הבא בלבד (ללא טקסט נוסף):
[
  {
    "title": "כותרת קצרה של הרעיון",
    "description": "תיאור מפורט של הרעיון ב-2-3 משפטים",
    "category": "קטגוריה (content/social/advertising/email/seo/branding/automation/events)"
  }
]

ודא שהרעיונות:
- מותאמים לתחום העסק${scrapedData ? ' ולנוכחות הדיגיטלית שנסרקה' : ''}
- מעשיים ויישומיים
- מגוונים (לא רק מאותו סוג)
- בעברית`

    // 6. Call Gemini API (using 2.0-flash-lite for reliable JSON)
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${settings.gemini_api_key}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2000,
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

    // 7. Parse JSON from response
    let ideas = []
    try {
      // Try to extract JSON array from the response
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        ideas = JSON.parse(jsonMatch[0])
      }
    } catch {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to parse AI response',
        rawText,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      ideas,
      scrapedSources: scrapeResults.filter(r => r.content).map(r => r.source),
    }), {
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
