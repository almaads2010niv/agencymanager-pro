// Supabase Edge Function: summarize-document
// Summarizes documents using Gemini AI for knowledge base
// Supports: JSON body (text content) + FormData with file (PDF/images)
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

    // 3. Parse request — JSON or FormData (with file)
    const contentType = req.headers.get('content-type') || ''
    let textContent = ''
    let fileName = ''
    let fileData: Uint8Array | null = null
    let fileMimeType = ''

    if (contentType.includes('multipart/form-data')) {
      // FormData mode — file uploaded
      const formData = await req.formData()
      const file = formData.get('file') as File | null
      fileName = (formData.get('fileName') as string) || ''
      textContent = (formData.get('textContent') as string) || ''

      if (file) {
        fileData = new Uint8Array(await file.arrayBuffer())
        fileMimeType = file.type || 'application/pdf'
        if (!fileName) fileName = file.name
      }
    } else {
      // JSON mode — text content only
      const body = await req.json()
      textContent = body.textContent || ''
      fileName = body.fileName || ''
    }

    if (!textContent && !fileData) {
      return new Response(JSON.stringify({ error: 'textContent or file is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build prompt
    const prompt = `אתה עוזר לניהול ידע בסוכנות שיווק דיגיטלי.
סכם את המסמך הבא וסווג אותו.

${fileName ? `שם קובץ: ${fileName}` : ''}

${textContent ? `תוכן טקסט:\n---\n${textContent.substring(0, 15000)}\n---` : 'התוכן נמצא בקובץ המצורף. קרא אותו וסכם.'}

החזר תשובה כ-JSON בפורמט הבא בלבד (ללא טקסט נוסף):
{
  "summary": "סיכום תמציתי ב-3-5 משפטים בעברית, מבוסס על התוכן האמיתי של המסמך",
  "suggestedCategory": "אחת מ: strategy | marketing | design | dev | operations | finance | general",
  "suggestedTags": ["תג1", "תג2", "תג3"]
}

ודא ש:
- הסיכום מבוסס על **תוכן המסמך בפועל** (לא על שם הקובץ)
- הסיכום תמציתי וברור
- הקטגוריה מתאימה לתוכן
- 3-5 תגים רלוונטיים בעברית`

    // 5. Build Gemini request parts
    const parts: Record<string, unknown>[] = [{ text: prompt }]

    if (fileData) {
      // Add file as inline data (PDF, image, etc.)
      const base64File = btoa(String.fromCharCode(...fileData))
      parts.unshift({
        inline_data: {
          mime_type: fileMimeType,
          data: base64File,
        },
      })
    }

    // Use gemini-2.0-flash for file reading (supports PDF), lite for text-only
    const model = fileData ? 'gemini-2.0-flash' : 'gemini-2.0-flash-lite'
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.gemini_api_key}`

    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1500,
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
