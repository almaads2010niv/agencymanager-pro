// Supabase Edge Function: process-receipt
// Extracts expense data from receipt images using Gemini Vision API
// Deploy: npx supabase functions deploy process-receipt --project-ref rxckkozbkrabpjdgyxqm

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
    const { imageBase64, mimeType } = await req.json()

    if (!imageBase64 || !mimeType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'נדרשים imageBase64 ו-mimeType',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Call Gemini Vision API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`

    const prompt = `אתה מנתח קבלות ומסמכים פיננסיים. נתח את תמונת הקבלה/חשבונית הבאה וחלץ את המידע הבא בפורמט JSON בלבד:

{
  "supplierName": "שם הספק/עסק",
  "amount": 0.00,
  "date": "YYYY-MM-DD",
  "category": "אחת מ: Media, Freelancer, Tool, Other",
  "description": "תיאור קצר של הפריט/שירות",
  "confidence": 0.0 עד 1.0
}

כללים:
- supplierName: שם העסק/ספק כפי שמופיע בקבלה
- amount: הסכום הסופי כולל מע"מ (מספר, ללא סימן מטבע)
- date: תאריך הקבלה בפורמט YYYY-MM-DD. אם לא ברור, השתמש בתאריך היום
- category: קטגוריה מתאימה - Media (פרסום/מדיה), Freelancer (שירותי פרילנס), Tool (כלי/תוכנה), Other (אחר)
- description: תיאור קצר של המוצר/שירות
- confidence: רמת ביטחון בדיוק הנתונים (0.0-1.0)

החזר JSON בלבד, ללא טקסט נוסף, ללא markdown.`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBase64,
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text()
      console.error('Gemini API error:', errorText)
      return new Response(JSON.stringify({
        success: false,
        error: 'שגיאה ב-Gemini API: ' + geminiResponse.status,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiResponse.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // 5. Parse JSON from response (strip markdown code blocks if present)
    let extracted
    try {
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      extracted = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse Gemini response:', rawText)
      return new Response(JSON.stringify({
        success: false,
        error: 'לא הצלחתי לנתח את תגובת ה-AI',
        rawResponse: rawText,
      }), {
        status: 422,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 6. Validate and return
    const result = {
      supplierName: extracted.supplierName || 'לא זוהה',
      amount: typeof extracted.amount === 'number' ? extracted.amount : parseFloat(extracted.amount) || 0,
      date: extracted.date || new Date().toISOString().split('T')[0],
      category: ['Media', 'Freelancer', 'Tool', 'Other'].includes(extracted.category) ? extracted.category : 'Other',
      description: extracted.description || '',
      confidence: typeof extracted.confidence === 'number' ? Math.min(1, Math.max(0, extracted.confidence)) : 0.5,
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('process-receipt error:', err)
    return new Response(JSON.stringify({
      success: false,
      error: 'שגיאה פנימית: ' + (err instanceof Error ? err.message : String(err)),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
