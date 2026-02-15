// Supabase Edge Function: transcribe-audio
// Transcribes audio recordings via Gemini API with the user's fixed prompt
// Uses Gemini Files API for large audio files (avoids memory limits)
// Deploy: npx supabase functions deploy transcribe-audio --project-ref rxckkozbkrabpjdgyxqm

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Upload audio to Gemini Files API (resumable upload, no memory issues)
async function uploadToGeminiFiles(
  audioUrl: string,
  mimeType: string,
  geminiApiKey: string
): Promise<string> {
  // 1. Download audio from Supabase Storage as a buffer
  const audioRes = await fetch(audioUrl)
  if (!audioRes.ok) {
    throw new Error(`Failed to download audio: ${audioRes.status}`)
  }
  const audioBytes = await audioRes.arrayBuffer()
  const contentLength = audioBytes.byteLength

  // 2. Initiate resumable upload to Gemini Files API
  const initRes = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${geminiApiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(contentLength),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { display_name: `recording_${Date.now()}` },
      }),
    }
  )

  if (!initRes.ok) {
    const errText = await initRes.text()
    throw new Error(`Gemini Files API init failed (${initRes.status}): ${errText}`)
  }

  // 3. Get the upload URL from response headers
  const uploadUrl = initRes.headers.get('x-goog-upload-url')
  if (!uploadUrl) {
    throw new Error('No upload URL returned from Gemini Files API')
  }

  // 4. Upload the actual audio bytes
  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Length': String(contentLength),
      'X-Goog-Upload-Offset': '0',
      'X-Goog-Upload-Command': 'upload, finalize',
    },
    body: audioBytes,
  })

  if (!uploadRes.ok) {
    const errText = await uploadRes.text()
    throw new Error(`Gemini file upload failed (${uploadRes.status}): ${errText}`)
  }

  // 5. Extract file URI from response
  const fileInfo = await uploadRes.json()
  const fileUri = fileInfo?.file?.uri
  if (!fileUri) {
    throw new Error('No file URI returned from Gemini Files API')
  }

  return fileUri
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
    const { audioUrl, entityName, businessName, mimeType } = await req.json()

    if (!audioUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'חסר קישור לקובץ הקלטה',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Upload audio to Gemini Files API (avoids Edge Function memory limits)
    const audioMimeType = mimeType || 'audio/mpeg'
    let fileUri: string
    try {
      fileUri = await uploadToGeminiFiles(audioUrl, audioMimeType, geminiApiKey)
    } catch (uploadErr) {
      const msg = uploadErr instanceof Error ? uploadErr.message : 'Unknown upload error'
      return new Response(JSON.stringify({
        success: false,
        error: `שגיאה בהעלאת קובץ ל-Gemini: ${msg}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 5. Build the user's exact transcription prompt
    const contactName = entityName || 'הלקוח'
    const business = businessName || 'העסק'

    const prompt = `השיחה הבאה היא בעברית. תתמלל אותה בעברית בלבד.

תתמלל לי את השיחה הבאה, מילה במילה, דיוק של 100%, שהתנהלה בין ניב מ"עלמה?" סוכנות שיווק לבין "${contactName}", "${business}"
התמלול יראה כך:
ניב: xxxx
${contactName}: yyyy

רווח כפול בין כל דובר

חשוב מאוד: כשתסיים את התמלול, כתוב את הסימן הבא בשורה נפרדת:
---SUMMARY_START---

ואז תסכם לי את השיחה שאתעד אותה במערכת ה CRM שלי.
מה התיעוד אמור להראות?
פרופיל הלקוח
צרכי הלקוח
במה כדאי להתמקד מבחינת סוכנות השיווק בשיחות המכירה איתו
תאריך חזרה עתידי מומלץ
מה כדאי לעשות הלאה
כותרת לכל קטגוריה בתיעוד`

    // 6. Call Gemini API with fileUri (no inline data = no memory pressure)
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                file_data: {
                  mime_type: audioMimeType,
                  file_uri: fileUri,
                },
              },
              { text: prompt },
            ],
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 65536,
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

    // Gemini 2.5 may return thinking content in parts — extract the text part
    const parts = geminiResult.candidates?.[0]?.content?.parts || []
    let fullText = ''
    for (const part of parts) {
      if (part.text && !part.thought) {
        fullText += part.text
      }
    }

    if (!fullText) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Gemini לא הצליח לתמלל את ההקלטה. נסה שוב.',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 7. Split response into transcript and summary
    let transcript = fullText
    let summary = ''

    // First try: explicit separator we asked for
    const separatorIndex = fullText.indexOf('---SUMMARY_START---')
    if (separatorIndex > 0) {
      transcript = fullText.substring(0, separatorIndex).trim()
      summary = fullText.substring(separatorIndex + '---SUMMARY_START---'.length).trim()
    } else {
      // Fallback: Look for CRM summary section markers (with or without markdown formatting)
      const summaryPatterns = [
        /\n\s*#{1,3}\s*סיכום\s*(שיחה\s*)?(ל-?\s*)?CRM/i,
        /\n\s*\*{1,2}\s*סיכום\s*(שיחה\s*)?(ל-?\s*)?CRM\s*[-:]*\s*\*{0,2}/i,
        /\n\s*#{1,3}\s*סיכום השיחה/,
        /\n\s*\*{1,2}\s*סיכום השיחה\s*[-:]*\s*\*{0,2}/,
        /\n\s*#{1,3}\s*תיעוד\s*(ה)?שיחה/,
        /\n\s*\*{1,2}\s*תיעוד\s*(ה)?שיחה\s*[-:]*\s*\*{0,2}/,
        /\n\s*#{1,3}\s*סיכום לתיעוד/,
        /\n\s*#{1,3}\s*תיעוד CRM/,
        /\n\s*\*{1,2}\s*תיעוד CRM\s*[-:]*\s*\*{0,2}/,
        /\n\s*#{1,3}\s*פרופיל הלקוח/,
        /\n\s*\*{1,2}\s*פרופיל הלקוח\s*[-:]*\s*\*{0,2}/,
      ]

      for (const pattern of summaryPatterns) {
        const match = fullText.match(pattern)
        if (match && match.index !== undefined && match.index > 0) {
          transcript = fullText.substring(0, match.index).trim()
          summary = fullText.substring(match.index).trim()
          break
        }
      }

      // Last resort: if no summary found and text is long enough, use last 30%
      if (!summary && fullText.length > 500) {
        const splitPoint = Math.floor(fullText.length * 0.7)
        const nearestNewline = fullText.indexOf('\n', splitPoint)
        if (nearestNewline > 0) {
          transcript = fullText.substring(0, nearestNewline).trim()
          summary = fullText.substring(nearestNewline).trim()
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transcript,
      summary,
      fullText,
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
