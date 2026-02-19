// Supabase Edge Function: competitor-scout
// AI-powered competitor analysis via Gemini
// Deploy: npx supabase functions deploy competitor-scout --project-ref rxckkozbkrabpjdgyxqm

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

    // 2. Get Gemini API key
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
        error: 'מפתח Gemini API לא מוגדר. הגדר אותו בעמוד ההגדרות.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiApiKey = settings.gemini_api_key

    // 3. Parse request
    const body = await req.json()
    const {
      businessName,
      industry,
      website,
      services: clientServices,
      additionalContext,
      entityId,
      entityType,
    } = body as {
      businessName: string
      industry: string
      website?: string
      services?: string[]
      additionalContext?: string
      entityId: string
      entityType: 'client' | 'lead'
    }

    if (!businessName) {
      return new Response(JSON.stringify({ error: 'שם העסק נדרש' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 4. Build Gemini prompt
    const prompt = `אתה אנליסט תחרותי מומחה בשיווק דיגיטלי ובעסקים בישראל. נתח את הנוף התחרותי עבור העסק הבא:

שם עסק: ${businessName}
${industry ? `תחום: ${industry}` : 'תחום: נא לזהות מהמידע הנוסף'}
${website ? `אתר: ${website}` : ''}
${clientServices?.length ? `שירותים שאנחנו מספקים ללקוח: ${clientServices.join(', ')}` : ''}
${additionalContext ? `מידע נוסף על העסק:\n${additionalContext}` : ''}

${!industry ? `חשוב: אם התחום לא צוין, נסה לזהות את התחום מתוך שם העסק, האתר, והמידע הנוסף. השתמש במידע הזה כדי לזהות מתחרים בתחום הנכון.` : ''}

בצע ניתוח תחרותי מקיף. זהה את המתחרים של **העסק עצמו** (לא של סוכנות השיווק).
ענה בפורמט JSON הבא בלבד (ללא markdown, ללא backticks):
{
  "summary": "סיכום קצר של הנוף התחרותי (2-3 משפטים) — כולל התחום שזיהית",
  "competitors": [
    {
      "name": "שם המתחרה",
      "description": "מה הם עושים",
      "strengths": ["חוזקה 1", "חוזקה 2"],
      "weaknesses": ["חולשה 1", "חולשה 2"],
      "estimatedSize": "קטן/בינוני/גדול",
      "threatLevel": "LOW/MEDIUM/HIGH",
      "differentiator": "מה מבדיל אותם"
    }
  ],
  "opportunities": ["הזדמנות 1", "הזדמנות 2", "הזדמנות 3"],
  "threats": ["איום 1", "איום 2"],
  "recommendations": [
    {
      "title": "כותרת המלצה",
      "description": "פירוט ההמלצה",
      "priority": "HIGH/MEDIUM/LOW"
    }
  ],
  "marketTrends": ["מגמה 1", "מגמה 2", "מגמה 3"]
}

חשוב:
- זהה 3-5 מתחרים רלוונטיים **של העסק** בשוק הישראלי
- המתחרים צריכים להיות עסקים באותו תחום, לא סוכנויות שיווק
- התמקד בתחום הספציפי של העסק (נסה לזהות מהמידע אם לא צוין)
- תן המלצות אקטיביות ומעשיות לסוכנות השיווק — איך למצב את הלקוח מול המתחרים
- הערך את רמת האיום של כל מתחרה
- ענה בעברית בלבד
- ענה ב-JSON טהור בלבד, ללא טקסט נוסף`

    // 5. Call Gemini API
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${geminiApiKey}`

    const geminiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 4096,
        },
      }),
    })

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text()
      console.error('Gemini API error:', errText)
      return new Response(JSON.stringify({ error: 'שגיאה בקריאה ל-Gemini API' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const geminiData = await geminiResponse.json()
    const rawText = (geminiData.candidates?.[0]?.content?.parts || [])
      .filter((part: { text?: string; thought?: boolean }) => part.text && !part.thought)
      .map((part: { text: string }) => part.text)
      .join('')
      .trim()

    // 6. Parse JSON response (with fallback)
    let analysisResult: Record<string, unknown>
    try {
      // Try direct parse
      analysisResult = JSON.parse(rawText)
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch?.[1]) {
        try {
          analysisResult = JSON.parse(jsonMatch[1].trim())
        } catch {
          // Last resort: try to find JSON object
          const braceStart = rawText.indexOf('{')
          const braceEnd = rawText.lastIndexOf('}')
          if (braceStart >= 0 && braceEnd > braceStart) {
            try {
              analysisResult = JSON.parse(rawText.substring(braceStart, braceEnd + 1))
            } catch {
              return new Response(JSON.stringify({ error: 'שגיאה בפענוח תשובת AI', raw: rawText.substring(0, 500) }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              })
            }
          } else {
            return new Response(JSON.stringify({ error: 'שגיאה בפענוח תשובת AI' }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          }
        }
      } else {
        const braceStart = rawText.indexOf('{')
        const braceEnd = rawText.lastIndexOf('}')
        if (braceStart >= 0 && braceEnd > braceStart) {
          analysisResult = JSON.parse(rawText.substring(braceStart, braceEnd + 1))
        } else {
          return new Response(JSON.stringify({ error: 'שגיאה בפענוח תשובת AI' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // 7. Store report in DB
    const reportId = crypto.randomUUID()
    const { error: insertError } = await adminClient.from('competitor_reports').insert({
      id: reportId,
      entity_id: entityId,
      entity_type: entityType,
      business_name: businessName,
      industry: industry || null,
      website: website || null,
      analysis: analysisResult,
      created_by: user.id,
      created_at: new Date().toISOString(),
      tenant_id: callerTenantId,
    })

    if (insertError) {
      console.error('Insert error:', insertError)
      // Still return the analysis even if storage fails
    }

    // 8. Log activity
    await adminClient.from('activity_log').insert({
      id: crypto.randomUUID(),
      action_type: 'competitor_analysis',
      entity_type: entityType,
      entity_id: entityId,
      description: `ניתוח תחרותי בוצע עבור ${businessName} (${(analysisResult.competitors as Array<unknown>)?.length || 0} מתחרים זוהו)`,
      created_at: new Date().toISOString(),
      tenant_id: callerTenantId,
    })

    return new Response(JSON.stringify({
      success: true,
      reportId,
      analysis: analysisResult,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Competitor scout error:', err)
    return new Response(JSON.stringify({ error: 'שגיאה פנימית' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
