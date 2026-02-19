// Supabase Edge Function: telegram-webhook
// Receives Telegram messages (text, voice, image) and routes to CRM actions
// Deploy: npx supabase functions deploy telegram-webhook --project-ref rxckkozbkrabpjdgyxqm
//
// Setup:
// 1. Create bot via @BotFather on Telegram
// 2. Save bot token in Settings
// 3. Set webhook URL: https://api.telegram.org/bot<TOKEN>/setWebhook?url=<SUPABASE_URL>/functions/v1/telegram-webhook

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Telegram API helpers ─────────────────────────────────────
async function sendTelegramMessage(botToken: string, chatId: string, text: string, parseMode = 'HTML'): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  })
}

async function getTelegramFileUrl(botToken: string, fileId: string): Promise<string | null> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`)
  const data = await res.json()
  if (data.ok && data.result?.file_path) {
    return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`
  }
  return null
}

// ── CRM search helpers ───────────────────────────────────────
async function searchCRM(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  query: string
): Promise<string> {
  const lowerQuery = query.toLowerCase().trim()

  // Search clients
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name, business_name, phone, status, monthly_retainer')
    .eq('tenant_id', tenantId)

  const matchedClients = (clients || []).filter(c =>
    c.client_name?.toLowerCase().includes(lowerQuery) ||
    c.business_name?.toLowerCase().includes(lowerQuery) ||
    c.phone?.includes(lowerQuery)
  )

  // Search leads
  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name, business_name, phone, status, quoted_monthly_value')
    .eq('tenant_id', tenantId)

  const matchedLeads = (leads || []).filter(l =>
    l.lead_name?.toLowerCase().includes(lowerQuery) ||
    l.business_name?.toLowerCase().includes(lowerQuery) ||
    l.phone?.includes(lowerQuery)
  )

  if (matchedClients.length === 0 && matchedLeads.length === 0) {
    return `לא נמצאו תוצאות עבור "${query}"`
  }

  let result = ''
  if (matchedClients.length > 0) {
    result += '<b>🏢 לקוחות:</b>\n'
    for (const c of matchedClients.slice(0, 5)) {
      result += `• <b>${c.client_name}</b> (${c.business_name || '-'}) — ${c.status} | ₪${c.monthly_retainer}/חודש\n`
    }
  }
  if (matchedLeads.length > 0) {
    result += '\n<b>🎯 לידים:</b>\n'
    for (const l of matchedLeads.slice(0, 5)) {
      result += `• <b>${l.lead_name}</b> (${l.business_name || '-'}) — ${l.status} | ₪${l.quoted_monthly_value}\n`
    }
  }

  return result
}

// ── Quick stats ──────────────────────────────────────────────
async function getQuickStats(adminClient: ReturnType<typeof createClient>, tenantId: string): Promise<string> {
  const { data: clients } = await adminClient
    .from('clients')
    .select('status, monthly_retainer')
    .eq('tenant_id', tenantId)

  const { data: leads } = await adminClient
    .from('leads')
    .select('status')
    .eq('tenant_id', tenantId)

  const activeClients = (clients || []).filter(c => c.status === 'פעיל')
  const totalRevenue = activeClients.reduce((s, c) => s + (c.monthly_retainer || 0), 0)
  const newLeads = (leads || []).filter(l => l.status === 'חדש').length
  const totalLeads = (leads || []).length

  return `<b>📊 סטטיסטיקות מהירות</b>

🏢 לקוחות פעילים: <b>${activeClients.length}</b>
💰 הכנסה חודשית: <b>₪${totalRevenue.toLocaleString()}</b>
🎯 לידים פתוחים: <b>${newLeads}</b> חדשים / ${totalLeads} סה"כ`
}

// ── Add note to entity ───────────────────────────────────────
async function addNote(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  entityName: string,
  noteContent: string
): Promise<string> {
  // Search for entity
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name')
    .eq('tenant_id', tenantId)
    .ilike('client_name', `%${entityName}%`)
    .limit(1)

  if (clients?.length) {
    await adminClient.from('client_notes').insert({
      id: crypto.randomUUID(),
      client_id: clients[0].client_id,
      content: noteContent,
      created_by: 'telegram',
      created_by_name: 'Telegram Bot',
      created_at: new Date().toISOString(),
      note_type: 'manual',
      tenant_id: tenantId,
    })
    return `✅ הערה נוספה ללקוח <b>${clients[0].client_name}</b>`
  }

  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name')
    .eq('tenant_id', tenantId)
    .ilike('lead_name', `%${entityName}%`)
    .limit(1)

  if (leads?.length) {
    await adminClient.from('lead_notes').insert({
      id: crypto.randomUUID(),
      lead_id: leads[0].lead_id,
      content: noteContent,
      created_by: 'telegram',
      created_by_name: 'Telegram Bot',
      created_at: new Date().toISOString(),
      note_type: 'manual',
      tenant_id: tenantId,
    })
    return `✅ הערה נוספה לליד <b>${leads[0].lead_name}</b>`
  }

  return `❌ לא נמצא לקוח או ליד בשם "${entityName}"`
}

// ── Main handler ─────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    const update = await req.json()
    const message = update.message || update.edited_message
    if (!message) {
      return new Response('OK', { status: 200 })
    }

    const chatId = String(message.chat.id)
    const text = message.text || message.caption || ''

    // Find tenant by chat_id
    const { data: allSettings } = await adminClient
      .from('settings')
      .select('telegram_bot_token, telegram_chat_id, tenant_id, gemini_api_key')

    const matchedSetting = (allSettings || []).find(
      (s: { telegram_chat_id: string | null }) => s.telegram_chat_id === chatId
    )

    if (!matchedSetting?.telegram_bot_token) {
      // Try to find any setting with a bot token for registration
      const anyWithToken = (allSettings || []).find(
        (s: { telegram_bot_token: string | null }) => s.telegram_bot_token
      )
      if (anyWithToken?.telegram_bot_token && !anyWithToken.telegram_chat_id) {
        // Auto-register this chat
        await adminClient
          .from('settings')
          .update({ telegram_chat_id: chatId })
          .eq('tenant_id', anyWithToken.tenant_id)

        await sendTelegramMessage(
          anyWithToken.telegram_bot_token,
          chatId,
          '✅ <b>Chat registered!</b>\nBot is now linked to your CRM.\n\nCommands:\n/stats — Quick dashboard\n/search <name> — Search CRM\n/note <name>: <text> — Add note\n\nOr just send a text/voice message for AI processing.'
        )
        return new Response('OK', { status: 200 })
      }
      return new Response('OK', { status: 200 }) // No matching tenant
    }

    const botToken = matchedSetting.telegram_bot_token
    const tenantId = matchedSetting.tenant_id
    const geminiKey = matchedSetting.gemini_api_key
    let responseText = ''
    let actionTaken = ''
    let messageType = 'text'

    // ── Route commands ───────────────────────────────────
    if (text.startsWith('/stats')) {
      responseText = await getQuickStats(adminClient, tenantId)
      actionTaken = 'stats'
    } else if (text.startsWith('/search ')) {
      const query = text.replace('/search ', '').trim()
      responseText = await searchCRM(adminClient, tenantId, query)
      actionTaken = 'search'
    } else if (text.startsWith('/note ')) {
      const noteText = text.replace('/note ', '').trim()
      const colonIdx = noteText.indexOf(':')
      if (colonIdx > 0) {
        const entityName = noteText.substring(0, colonIdx).trim()
        const noteContent = noteText.substring(colonIdx + 1).trim()
        responseText = await addNote(adminClient, tenantId, entityName, noteContent)
        actionTaken = 'add_note'
      } else {
        responseText = 'פורמט: /note <שם לקוח>: <תוכן ההערה>'
      }
    } else if (text.startsWith('/help') || text.startsWith('/start')) {
      responseText = `<b>🤖 Agency Manager Bot</b>

<b>פקודות:</b>
/stats — סטטיסטיקות מהירות
/search <שם> — חיפוש לקוח/ליד
/note <שם>: <הערה> — הוסף הערה
/help — עזרה

<b>חכם:</b>
• שלח הודעת טקסט חופשית → AI ינתח ויענה
• שלח הודעה קולית → תומלל אוטומטית ותעובד
• שלח תמונה → AI ינתח את התוכן`
      actionTaken = 'help'

    } else if (message.voice || message.audio) {
      // Voice message — transcribe with Gemini
      messageType = 'voice'
      const fileId = message.voice?.file_id || message.audio?.file_id
      if (fileId && geminiKey) {
        const fileUrl = await getTelegramFileUrl(botToken, fileId)
        if (fileUrl) {
          // Download voice file
          const audioRes = await fetch(fileUrl)
          const audioBuffer = await audioRes.arrayBuffer()
          const audioBase64 = btoa(
            new Uint8Array(audioBuffer).reduce((s, b) => s + String.fromCharCode(b), '')
          )

          // Transcribe with Gemini
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'audio/ogg', data: audioBase64 } },
                  { text: 'תמלל את ההקלטה הזאת לעברית. אם יש תוכן עסקי, תן גם סיכום קצר. ענה בעברית.' }
                ]
              }],
              generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
            }),
          })

          const geminiData = await geminiRes.json()
          const transcription = (geminiData.candidates?.[0]?.content?.parts || [])
            .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
            .map((p: { text: string }) => p.text)
            .join('')
            .trim()

          responseText = transcription
            ? `<b>🎤 תמלול:</b>\n${transcription}`
            : '❌ לא הצלחתי לתמלל את ההודעה הקולית'
          actionTaken = 'voice_transcription'
        }
      } else {
        responseText = 'נדרש מפתח Gemini API לתמלול הודעות קוליות'
      }

    } else if (message.photo) {
      // Image — analyze with Gemini
      messageType = 'photo'
      const photo = message.photo[message.photo.length - 1] // Highest resolution
      if (photo?.file_id && geminiKey) {
        const fileUrl = await getTelegramFileUrl(botToken, photo.file_id)
        if (fileUrl) {
          const imgRes = await fetch(fileUrl)
          const imgBuffer = await imgRes.arrayBuffer()
          const imgBase64 = btoa(
            new Uint8Array(imgBuffer).reduce((s, b) => s + String.fromCharCode(b), '')
          )

          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
          const geminiRes = await fetch(geminiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{
                role: 'user',
                parts: [
                  { inlineData: { mimeType: 'image/jpeg', data: imgBase64 } },
                  { text: text || 'נתח את התמונה הזו בהקשר של ניהול לקוחות וסוכנות שיווק. אם יש טקסט בתמונה, תמלל אותו. ענה בעברית.' }
                ]
              }],
              generationConfig: { temperature: 0.5, maxOutputTokens: 1024 },
            }),
          })

          const geminiData = await geminiRes.json()
          const analysis = (geminiData.candidates?.[0]?.content?.parts || [])
            .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
            .map((p: { text: string }) => p.text)
            .join('')
            .trim()

          responseText = analysis
            ? `<b>📷 ניתוח תמונה:</b>\n${analysis}`
            : '❌ לא הצלחתי לנתח את התמונה'
          actionTaken = 'image_analysis'
        }
      }

    } else if (text && !text.startsWith('/') && geminiKey) {
      // Free text — AI response with CRM context
      // Get quick CRM summary for context
      const { data: recentClients } = await adminClient
        .from('clients')
        .select('client_name, status, monthly_retainer')
        .eq('tenant_id', tenantId)
        .eq('status', 'פעיל')
        .limit(10)

      const { data: recentLeads } = await adminClient
        .from('leads')
        .select('lead_name, status')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })
        .limit(5)

      const crmContext = `לקוחות פעילים: ${(recentClients || []).map(c => `${c.client_name} (₪${c.monthly_retainer})`).join(', ')}.
לידים אחרונים: ${(recentLeads || []).map(l => `${l.lead_name} [${l.status}]`).join(', ')}.`

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: `אתה עוזר AI של סוכנות שיווק דיגיטלי. הנה נתוני CRM:\n${crmContext}\n\nהודעת המשתמש: ${text}\n\nענה בקצרה ובעברית. אם יש פעולה ספציפית שצריך לעשות ב-CRM, ציין אותה.` }] }
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
      })

      const geminiData = await geminiRes.json()
      responseText = (geminiData.candidates?.[0]?.content?.parts || [])
        .filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
        .map((p: { text: string }) => p.text)
        .join('')
        .trim()

      if (!responseText) responseText = '❌ לא התקבלה תשובה מ-AI'
      actionTaken = 'ai_chat'
    }

    // Send response
    if (responseText) {
      // Split long messages (Telegram 4096 char limit)
      if (responseText.length > 4000) {
        const chunks = responseText.match(/.{1,4000}/gs) || [responseText]
        for (const chunk of chunks) {
          await sendTelegramMessage(botToken, chatId, chunk)
        }
      } else {
        await sendTelegramMessage(botToken, chatId, responseText)
      }
    }

    // Log message
    await adminClient.from('telegram_messages').insert({
      chat_id: chatId,
      message_type: messageType,
      content: text || `[${messageType}]`,
      ai_response: responseText?.substring(0, 5000) || null,
      action_taken: actionTaken || null,
      tenant_id: tenantId,
      created_at: new Date().toISOString(),
    })

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    return new Response('OK', { status: 200 }) // Always return 200 to Telegram
  }
})
