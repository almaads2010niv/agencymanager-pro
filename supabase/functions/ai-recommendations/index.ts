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
    let pdfLeadId = ''

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
      pdfLeadId = (formData.get('leadId') as string) || ''
      if (pdfLeadId) {
        const leadId = pdfLeadId
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

    // 7. If PDF was uploaded, extract structured personality data and save/update
    let extractedPersonality = null
    if (pdfFileData) {
      // Ask Gemini to extract structured personality data from the PDF
      // NOTE: We always extract (even if personality exists) to update with latest PDF data
      const extractPrompt = `מצורף דוח אבחון אישיות Signals OS בפורמט PDF.
חלץ ממנו את **כל** הנתונים בפורמט JSON בלבד (ללא markdown, ללא backticks).

חשוב מאוד: שמור את הטקסט **המלא** מהדוח — אל תתמצת ואל תקצר! העתק פסקאות שלמות כפי שהן.

{
  "primary_archetype": "WINNER|STAR|DREAMER|HEART|ANCHOR",
  "secondary_archetype": "WINNER|STAR|DREAMER|HEART|ANCHOR",
  "confidence_level": "HIGH|MEDIUM|LOW",
  "churn_risk": "HIGH|MEDIUM|LOW",
  "scores": { "WINNER": 0-10, "STAR": 0-10, "DREAMER": 0-10, "HEART": 0-10, "ANCHOR": 0-10 },
  "smart_tags": ["תגית1", "תגית2"],
  "sales_cheat_sheet": {
    "how_to_speak": "הטקסט המלא מהדוח על איך לדבר עם הנבדק, כולל טון ושאלות מכיילות",
    "what_not_to_do": "הטקסט המלא מהדוח על מה לא לעשות — כל הנקודות",
    "closing_speed": "מהיר|בינוני|איטי",
    "best_offers": "הטקסט המלא על סוג ההצעות שיעבדו הכי טוב",
    "best_social_proof": "הטקסט המלא על הוכחות חברתיות מומלצות",
    "red_flags": "הטקסט המלא על דגלים אדומים וסיכונים",
    "followup_plan": "הטקסט המלא על תוכנית מעקב ומיקוד onboarding",
    "closing_line": "משפט הסגירה המומלץ מהדוח — ציטוט מדויק",
    "calibration_questions": "כל השאלות המכיילות מהדוח, מופרדות ב-|",
    "fomo_message": "הודעת FOMO מהדוח אם קיימת",
    "call_script": "תסריט השיחה המלא מהדוח — פתיחה, שאלות, מכירה, סגירה",
    "recommended_channels": ["ערוץ1"]
  },
  "retention_cheat_sheet": {
    "onboarding_focus": "הטקסט המלא על מיקוד onboarding",
    "habit_building": "הטקסט המלא על בניית הרגלים",
    "community_hook": "הטקסט המלא על וו קהילתי",
    "risk_moments": "הטקסט המלא על רגעי סיכון ונטישה, כולל מסגרת הזמן",
    "save_offer": "הטקסט המלא על הצעת הצלה",
    "cadence": "הטקסט המלא על תדירות קשר מומלצת"
  },
  "business_report": "הטקסט המלא של 'דוח מודיעין עסקי' — כל הפסקאות כפי שהן, כולל שורת פרופיל, סיכון נטישה, המלצות מכירה, שאלות מכיילות, מה לא לעשות, משפט סגירה, מיקוד onboarding, תסריט שיחה",
  "user_report": "הטקסט המלא של 'דוח משתמש' — כל הפסקאות כפי שהן"
}

אם אין מספיק מידע בדוח לשדה מסוים, כתוב מחרוזת ריקה "".
החזר רק JSON תקני, בלי שום טקסט נוסף.`

      try {
        const extractParts: Record<string, unknown>[] = [{ text: extractPrompt }]
        const base64PdfForExtract = btoa(String.fromCharCode(...pdfFileData))
        extractParts.unshift({
          inline_data: { mime_type: pdfMimeType, data: base64PdfForExtract },
        })

        const extractRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${geminiApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: extractParts }],
              generationConfig: { temperature: 0.2, maxOutputTokens: 8192 },
            }),
          }
        )

        if (extractRes.ok) {
          const extractResult = await extractRes.json()
          const extractTextParts = extractResult.candidates?.[0]?.content?.parts || []
          let rawJson = ''
          for (const part of extractTextParts) {
            if (part.text) rawJson += part.text
          }
          // Clean up potential markdown fences
          rawJson = rawJson.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          try {
            extractedPersonality = JSON.parse(rawJson)
          } catch {
            // Try to extract JSON from response
            const jsonMatch = rawJson.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
              try { extractedPersonality = JSON.parse(jsonMatch[0]) } catch { /* ignore */ }
            }
          }
        }
      } catch (extractErr) {
        console.error('Personality extraction error:', extractErr)
        // Non-fatal — we still have the recommendations
      }

      // Save extracted personality to signals_personality table
      if (extractedPersonality && pdfLeadId) {
        const ep = extractedPersonality
        const now = new Date().toISOString()

        // Build rich sales_cheat_sheet — include all new fields from expanded extraction
        const salesSheet = ep.sales_cheat_sheet || {}
        const retentionSheet = ep.retention_cheat_sheet || {}

        const upsertData = {
          id: crypto.randomUUID(),
          lead_id: pdfLeadId,
          client_id: null,
          analysis_id: `pdf-upload-${Date.now()}`,
          tenant_id: callerTenantId,
          subject_name: entityName || '',
          subject_email: '',
          subject_phone: '',
          primary_archetype: ep.primary_archetype || 'WINNER',
          secondary_archetype: ep.secondary_archetype || 'STAR',
          confidence_level: ep.confidence_level || 'MEDIUM',
          churn_risk: ep.churn_risk || 'MEDIUM',
          scores: ep.scores || {},
          smart_tags: ep.smart_tags || [],
          user_report: ep.user_report || null,
          business_report: ep.business_report || null,
          sales_cheat_sheet: salesSheet,
          retention_cheat_sheet: retentionSheet,
          result_url: null,
          lang: 'he',
          questionnaire_version: 'pdf-import',
          received_at: now,
          updated_at: now,
        }

        // Upsert — if personality already exists for this lead, update it
        const { error: upsertError } = await adminClient
          .from('signals_personality')
          .upsert(upsertData, { onConflict: 'lead_id' })

        if (upsertError) {
          console.error('Failed to save extracted personality:', upsertError)
          // Try insert without onConflict (lead_id might not have unique constraint)
          const { error: insertError } = await adminClient
            .from('signals_personality')
            .insert(upsertData)
          if (insertError) {
            console.error('Insert fallback also failed:', insertError)
          }
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      recommendation,
      extractedPersonality: extractedPersonality || undefined,
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
