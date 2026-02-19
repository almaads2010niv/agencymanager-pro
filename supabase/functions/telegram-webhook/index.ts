// Supabase Edge Function: telegram-webhook
// Smart CRM Bot — understands Hebrew text & voice, executes CRM actions automatically
// Deploy: npx supabase functions deploy telegram-webhook --project-ref rxckkozbkrabpjdgyxqm --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── AI Model — using Gemini 2.5 Pro for best quality ─────────
const GEMINI_MODEL = 'gemini-3-pro-preview'

// ── Types ────────────────────────────────────────────────────
interface CRMIntent {
  action: 'multi_action' | 'add_note' | 'add_lead' | 'update_lead_status' | 'update_client_status' | 'update_field' | 'reschedule' | 'add_deal' | 'search' | 'signals_profile' | 'stats' | 'help' | 'reminder' | 'unknown'
  entity_name?: string
  entity_type?: 'client' | 'lead'
  note_content?: string
  status?: string
  // Field updates
  field_name?: string
  field_value?: string
  // Reschedule
  new_date?: string
  // Deal
  deal_name?: string
  deal_amount?: number
  // Search
  search_query?: string
  // Add lead
  lead_phone?: string
  lead_business?: string
  lead_source?: string
  lead_services?: string
  lead_value?: number
  // Reminder
  reminder_text?: string
  // Multi-action: array of sub-intents
  sub_actions?: CRMIntent[]
  raw_text: string
}

// ── Telegram API helpers ─────────────────────────────────────
async function sendTelegramMessage(botToken: string, chatId: string, text: string, parseMode = 'HTML'): Promise<void> {
  // Telegram limits: 4096 chars per message
  if (text.length > 4000) {
    const chunks = text.match(/.{1,4000}/gs) || [text]
    for (const chunk of chunks) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: parseMode }),
      })
    }
  } else {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
    })
  }
}

async function sendTypingAction(botToken: string, chatId: string): Promise<void> {
  await fetch(`https://api.telegram.org/bot${botToken}/sendChatAction`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
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

// ── Gemini helper ────────────────────────────────────────────
async function callGemini(
  geminiKey: string,
  prompt: string,
  model = GEMINI_MODEL,
  temperature = 0.2,
  maxTokens = 2048,
  inlineData?: { mimeType: string; data: string }
): Promise<string> {
  const parts: Array<Record<string, unknown>> = []
  if (inlineData) {
    parts.push({ inlineData })
  }
  parts.push({ text: prompt })

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`

  let res: Response
  try {
    res = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    })
  } catch (fetchErr) {
    console.error('Gemini fetch error:', fetchErr)
    return ''
  }

  if (!res.ok) {
    const errText = await res.text()
    console.error(`Gemini HTTP ${res.status}:`, errText.substring(0, 500))
    return ''
  }

  const data = await res.json()

  // Check for API errors
  if (data.error) {
    console.error('Gemini API error:', JSON.stringify(data.error))
    return ''
  }

  // Check for blocked content
  if (data.candidates?.[0]?.finishReason === 'SAFETY') {
    console.error('Gemini content blocked by safety filters')
    return ''
  }

  const allParts = data.candidates?.[0]?.content?.parts || []

  // Filter out thinking parts (gemini-3-pro has thinking parts with thought: true)
  const textParts = allParts.filter((p: { text?: string; thought?: boolean }) => p.text && !p.thought)
  const result = textParts.map((p: { text: string }) => p.text).join('').trim()

  if (!result) {
    // If all parts are thinking-only, try to use them as fallback
    const anyText = allParts.filter((p: { text?: string }) => p.text).map((p: { text: string }) => p.text).join('').trim()
    if (anyText) {
      console.warn('Gemini: only thinking parts found, using as fallback')
      return anyText
    }
    console.error('Gemini empty result. Candidates:', JSON.stringify(data.candidates?.slice(0, 1)).substring(0, 500))
  }

  return result
}

// ── Date helper ──────────────────────────────────────────────
function parseHebrewDate(dateStr: string): string | null {
  const now = new Date()
  const lower = dateStr.trim()

  // Relative dates
  if (lower === 'מחר' || lower === 'מחרת') {
    const d = new Date(now); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
  }
  if (lower === 'מחרתיים') {
    const d = new Date(now); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0]
  }
  if (lower.includes('עוד שבוע') || lower.includes('בעוד שבוע')) {
    const d = new Date(now); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]
  }
  if (lower.includes('עוד יומיים') || lower.includes('בעוד יומיים')) {
    const d = new Date(now); d.setDate(d.getDate() + 2); return d.toISOString().split('T')[0]
  }
  if (lower.includes('עוד 3 ימים') || lower.includes('בעוד שלושה ימים')) {
    const d = new Date(now); d.setDate(d.getDate() + 3); return d.toISOString().split('T')[0]
  }

  // Hebrew day names → next occurrence
  const dayMap: Record<string, number> = {
    'ראשון': 0, 'שני': 1, 'שלישי': 2, 'רביעי': 3, 'חמישי': 4, 'שישי': 5, 'שבת': 6,
    'יום ראשון': 0, 'יום שני': 1, 'יום שלישי': 2, 'יום רביעי': 3, 'יום חמישי': 4, 'יום שישי': 5,
  }
  for (const [name, dayNum] of Object.entries(dayMap)) {
    if (lower.includes(name)) {
      const currentDay = now.getDay()
      let daysUntil = dayNum - currentDay
      if (daysUntil <= 0) daysUntil += 7
      const d = new Date(now); d.setDate(d.getDate() + daysUntil); return d.toISOString().split('T')[0]
    }
  }

  // Try ISO format or DD/MM/YYYY
  const isoMatch = lower.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`

  const dmyMatch = lower.match(/(\d{1,2})[\/\.](\d{1,2})[\/\.]?(\d{2,4})?/)
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0')
    const month = dmyMatch[2].padStart(2, '0')
    const year = dmyMatch[3] ? (dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3]) : String(now.getFullYear())
    return `${year}-${month}-${day}`
  }

  // Fallback — return the string as-is for Gemini to have parsed it
  if (/\d{4}-\d{2}-\d{2}/.test(lower)) return lower

  return null
}

// ── Intent Recognition Engine ────────────────────────────────
async function recognizeIntent(geminiKey: string, text: string): Promise<CRMIntent> {
  const today = new Date().toISOString().split('T')[0]
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  const todayName = dayNames[new Date().getDay()]

  const prompt = `אתה מנוע זיהוי כוונות חכם עבור מערכת CRM של סוכנות שיווק דיגיטלי.
המשתמש שלח הודעה בעברית. נתח וזהה מה הוא רוצה **לעשות בפועל** במערכת.

חשוב מאוד:
- אם ההודעה כוללת כמה פעולות (למשל "קבעתי פגישה עם חני למחר ב-15:00 ודיברנו על קמפיין פייסבוק") — השתמש ב-multi_action עם מערך sub_actions!
- אם המשתמש מדבר על הזזת/דחיית/קביעת פגישה/תאריך → reschedule
- אם המשתמש מדבר על עדכון שדה כמו טלפון/הצעת מחיר/שם עסק → update_field

היום: ${today} (יום ${todayName})

פעולות אפשריות:
1. multi_action — הודעה שכוללת כמה פעולות (למשל: "קבעתי פגישה עם חני למחר ודיברנו על ניהול פייסבוק" = reschedule + add_note + update_lead_status)
2. reschedule — הזזת/קביעת פגישה (למשל: "הפגישה עם מנשה נדחתה ליום חמישי", "קבעתי פגישה עם חני למחר")
3. update_field — עדכון שדה (למשל: "תעדכן טלפון של ניב ל-0501234567")
4. add_note — הוספת הערה (למשל: "תרשום אצל ניב שביקש הצעת מחיר")
5. add_lead — ליד חדש (למשל: "ליד חדש: דני כהן, 0501234567")
6. update_lead_status — עדכון סטטוס ליד (למשל: "ניב עבר לנקבעה פגישה")
7. update_client_status — עדכון סטטוס לקוח (למשל: "מאיה עברה למושהה")
8. add_deal — פרויקט/עסקה חדשה
9. search — חיפוש (למשל: "מה עם ניב?")
10. signals_profile — פרופיל Signals OS (למשל: "פרופיל signals של אריה טל", "אישיות של מנשה")
11. stats — סטטיסטיקות
12. reminder — תזכורת
13. help — עזרה
14. unknown — לא ברור

סטטוסים לליד: חדש, נוצר קשר, נשלחה הצעה, נקבעה פגישה, ממתין להחלטה, נסגר בהצלחה, אבוד, לא רלוונטי
סטטוסים ללקוח: פעיל, מושהה, בתהליך עזיבה, עזב

ההודעה: "${text}"

ענה אך ורק ב-JSON תקין, ללא markdown, ללא backticks.
אם multi_action, כלול מערך sub_actions עם כל הפעולות:
{
  "action": "multi_action|reschedule|update_field|add_note|add_lead|update_lead_status|update_client_status|add_deal|search|signals_profile|stats|reminder|help|unknown",
  "entity_name": "שם",
  "entity_type": "client|lead",
  "note_content": "הערה",
  "status": "סטטוס",
  "field_name": "phone|email|quoted_monthly_value|monthly_retainer|business_name",
  "field_value": "ערך",
  "new_date": "מחר|יום חמישי|עוד שבוע|2025-03-15",
  "deal_name": "שם פרויקט",
  "deal_amount": 0,
  "search_query": "חיפוש",
  "lead_phone": "טלפון",
  "lead_business": "עסק",
  "lead_source": "מקור",
  "lead_services": "שירותים",
  "lead_value": 0,
  "reminder_text": "תזכורת",
  "sub_actions": [{"action": "reschedule", "entity_name": "חני", "new_date": "מחר"}, {"action": "add_note", "entity_name": "חני", "note_content": "דיברנו על..."}],
  "raw_text": "${text}"
}`

  const result = await callGemini(geminiKey, prompt, GEMINI_MODEL, 0.1, 1024)

  try {
    // Try to parse JSON directly
    const parsed = JSON.parse(result)
    parsed.raw_text = text
    return parsed as CRMIntent
  } catch {
    // Try to extract JSON from response
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        parsed.raw_text = text
        return parsed as CRMIntent
      } catch {
        // Fall through
      }
    }
    return { action: 'unknown', raw_text: text }
  }
}

// ── CRM Action Executors ─────────────────────────────────────

async function executeAddNote(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim()
  const noteContent = intent.note_content?.trim()

  if (!entityName || !noteContent) {
    return '❌ לא הצלחתי לזהות את שם הלקוח/ליד או את תוכן ההערה.\nנסה: "תרשום אצל <שם>: <הערה>"'
  }

  // Search clients first
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name')
    .eq('tenant_id', tenantId)
    .ilike('client_name', `%${entityName}%`)
    .limit(3)

  if (clients?.length === 1) {
    await adminClient.from('client_notes').insert({
      id: crypto.randomUUID(),
      client_id: clients[0].client_id,
      content: noteContent,
      created_by: 'telegram',
      created_by_name: 'Telegram Bot 🤖',
      created_at: new Date().toISOString(),
      note_type: 'manual',
      tenant_id: tenantId,
    })
    return `✅ <b>הערה נוספה ללקוח ${clients[0].client_name}</b>\n📝 ${noteContent}`
  }

  // Search leads
  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name')
    .eq('tenant_id', tenantId)
    .ilike('lead_name', `%${entityName}%`)
    .limit(3)

  if (leads?.length === 1) {
    await adminClient.from('lead_notes').insert({
      id: crypto.randomUUID(),
      lead_id: leads[0].lead_id,
      content: noteContent,
      created_by: 'telegram',
      created_by_name: 'Telegram Bot 🤖',
      created_at: new Date().toISOString(),
      note_type: 'manual',
      tenant_id: tenantId,
    })
    return `✅ <b>הערה נוספה לליד ${leads[0].lead_name}</b>\n📝 ${noteContent}`
  }

  // Multiple matches
  const allMatches = [
    ...(clients || []).map(c => c.client_name),
    ...(leads || []).map(l => l.lead_name),
  ]
  if (allMatches.length > 1) {
    return `⚠️ נמצאו כמה תוצאות עבור "${entityName}":\n${allMatches.map(n => `• ${n}`).join('\n')}\nנסה להיות יותר ספציפי.`
  }

  return `❌ לא נמצא לקוח או ליד בשם "${entityName}"`
}

async function executeReschedule(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim()
  if (!entityName) {
    return '❌ לא הצלחתי לזהות שם. נסה: "תזיז את ניב ליום חמישי"'
  }

  const dateStr = intent.new_date?.trim()
  if (!dateStr) {
    return '❌ לא הצלחתי לזהות תאריך. נסה: "הפגישה עם ניב נדחתה למחר"'
  }

  const parsedDate = parseHebrewDate(dateStr)
  if (!parsedDate) {
    return `❌ לא הצלחתי להבין את התאריך "${dateStr}". נסה: מחר, יום חמישי, עוד שבוע, או 15/03`
  }

  // Search leads first (more likely to reschedule leads)
  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name, next_contact_date')
    .eq('tenant_id', tenantId)
    .ilike('lead_name', `%${entityName}%`)
    .limit(3)

  if (leads?.length === 1) {
    const oldDate = leads[0].next_contact_date
      ? new Date(leads[0].next_contact_date).toLocaleDateString('he-IL')
      : 'לא נקבע'

    const { error } = await adminClient
      .from('leads')
      .update({ next_contact_date: `${parsedDate}T10:00:00.000Z` })
      .eq('lead_id', leads[0].lead_id)

    if (error) return `❌ שגיאה בעדכון: ${error.message}`

    const newDateFormatted = new Date(parsedDate).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
    return `✅ <b>פגישה עם ${leads[0].lead_name} הוזֿזה</b>\n📅 ${oldDate} → <b>${newDateFormatted}</b>`
  }

  // Search clients
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name, next_review_date')
    .eq('tenant_id', tenantId)
    .ilike('client_name', `%${entityName}%`)
    .limit(3)

  if (clients?.length === 1) {
    const oldDate = clients[0].next_review_date
      ? new Date(clients[0].next_review_date).toLocaleDateString('he-IL')
      : 'לא נקבע'

    const { error } = await adminClient
      .from('clients')
      .update({ next_review_date: `${parsedDate}T10:00:00.000Z` })
      .eq('client_id', clients[0].client_id)

    if (error) return `❌ שגיאה בעדכון: ${error.message}`

    const newDateFormatted = new Date(parsedDate).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
    return `✅ <b>פגישה עם ${clients[0].client_name} הוזזה</b>\n📅 ${oldDate} → <b>${newDateFormatted}</b>`
  }

  // Multiple matches
  const allMatches = [
    ...(leads || []).map(l => l.lead_name),
    ...(clients || []).map(c => c.client_name),
  ]
  if (allMatches.length > 1) {
    return `⚠️ נמצאו כמה תוצאות:\n${allMatches.map(n => `• ${n}`).join('\n')}\nנסה להיות יותר ספציפי.`
  }

  return `❌ לא נמצא לקוח או ליד בשם "${entityName}"`
}

async function executeUpdateField(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim()
  const fieldName = intent.field_name?.trim()
  const fieldValue = intent.field_value?.trim()

  if (!entityName || !fieldName || !fieldValue) {
    return '❌ לא הצלחתי לזהות מה לעדכן.\nנסה: "תעדכן טלפון של ניב ל-0501234567"'
  }

  // Map field names to DB columns
  const fieldMap: Record<string, { lead_col: string; client_col: string; label: string; isNumber?: boolean }> = {
    phone: { lead_col: 'phone', client_col: 'phone', label: '📱 טלפון' },
    email: { lead_col: 'email', client_col: 'email', label: '📧 אימייל' },
    quoted_monthly_value: { lead_col: 'quoted_monthly_value', client_col: 'monthly_retainer', label: '💰 הצעת מחיר', isNumber: true },
    monthly_retainer: { lead_col: 'quoted_monthly_value', client_col: 'monthly_retainer', label: '💰 ריטיינר חודשי', isNumber: true },
    business_name: { lead_col: 'business_name', client_col: 'business_name', label: '🏢 שם עסק' },
    notes: { lead_col: 'notes', client_col: 'notes', label: '📝 הערות' },
    next_contact_date: { lead_col: 'next_contact_date', client_col: 'next_review_date', label: '📅 תאריך קשר הבא' },
  }

  const fieldConfig = fieldMap[fieldName]
  if (!fieldConfig) {
    return `❌ שדה לא מוכר: "${fieldName}"\nשדות אפשריים: טלפון, אימייל, הצעת מחיר, שם עסק, הערות`
  }

  const dbValue = fieldConfig.isNumber ? Number(fieldValue.replace(/[^\d.]/g, '')) : fieldValue

  // Search leads
  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name')
    .eq('tenant_id', tenantId)
    .ilike('lead_name', `%${entityName}%`)
    .limit(3)

  if (leads?.length === 1) {
    const { error } = await adminClient
      .from('leads')
      .update({ [fieldConfig.lead_col]: dbValue })
      .eq('lead_id', leads[0].lead_id)

    if (error) return `❌ שגיאה בעדכון: ${error.message}`
    return `✅ <b>ליד ${leads[0].lead_name} עודכן</b>\n${fieldConfig.label}: <b>${fieldValue}</b>`
  }

  // Search clients
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name')
    .eq('tenant_id', tenantId)
    .ilike('client_name', `%${entityName}%`)
    .limit(3)

  if (clients?.length === 1) {
    const { error } = await adminClient
      .from('clients')
      .update({ [fieldConfig.client_col]: dbValue })
      .eq('client_id', clients[0].client_id)

    if (error) return `❌ שגיאה בעדכון: ${error.message}`
    return `✅ <b>לקוח ${clients[0].client_name} עודכן</b>\n${fieldConfig.label}: <b>${fieldValue}</b>`
  }

  const allMatches = [...(leads || []).map(l => l.lead_name), ...(clients || []).map(c => c.client_name)]
  if (allMatches.length > 1) {
    return `⚠️ נמצאו כמה תוצאות:\n${allMatches.map(n => `• ${n}`).join('\n')}\nנסה להיות יותר ספציפי.`
  }

  return `❌ לא נמצא לקוח או ליד בשם "${entityName}"`
}

async function executeAddDeal(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim()
  const dealName = intent.deal_name?.trim()
  const dealAmount = intent.deal_amount || 0

  if (!entityName || !dealName) {
    return '❌ לא הצלחתי לזהות פרטי הפרויקט.\nנסה: "פרויקט חדש לניב: בניית אתר 5000 שקל"'
  }

  // Find client
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name')
    .eq('tenant_id', tenantId)
    .ilike('client_name', `%${entityName}%`)
    .limit(3)

  let clientId = ''
  let clientName = entityName

  if (clients?.length === 1) {
    clientId = clients[0].client_id
    clientName = clients[0].client_name
  } else {
    // Try leads
    const { data: leads } = await adminClient
      .from('leads')
      .select('lead_id, lead_name')
      .eq('tenant_id', tenantId)
      .ilike('lead_name', `%${entityName}%`)
      .limit(1)
    if (leads?.length) {
      clientId = leads[0].lead_id
      clientName = leads[0].lead_name
    }
  }

  const { error } = await adminClient.from('deals').insert({
    deal_id: crypto.randomUUID(),
    client_id: clientId || null,
    deal_name: dealName,
    deal_type: 'פרויקט',
    deal_amount: dealAmount,
    deal_date: new Date().toISOString(),
    deal_status: 'In_progress',
    supplier_cost: 0,
    notes: `נוצר מטלגרם: ${intent.raw_text}`,
    tenant_id: tenantId,
  })

  if (error) return `❌ שגיאה בהוספת פרויקט: ${error.message}`

  let msg = `✅ <b>פרויקט חדש נוסף</b>\n📦 ${dealName}\n👤 ${clientName}`
  if (dealAmount) msg += `\n💰 ₪${dealAmount.toLocaleString()}`
  msg += `\n📊 סטטוס: <b>בתהליך</b>`
  return msg
}

async function executeAddLead(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const leadName = intent.entity_name?.trim()
  if (!leadName) {
    return '❌ לא הצלחתי לזהות שם לליד החדש.\nנסה: "ליד חדש: <שם>, טלפון <מספר>"'
  }

  const leadId = crypto.randomUUID()
  const now = new Date().toISOString()

  const { error } = await adminClient.from('leads').insert({
    lead_id: leadId,
    lead_name: leadName,
    business_name: intent.lead_business || '',
    phone: intent.lead_phone || '',
    email: '',
    source_channel: intent.lead_source || 'WhatsApp',
    interested_services: intent.lead_services ? [intent.lead_services] : [],
    notes: `נוצר מטלגרם: ${intent.raw_text}`,
    next_contact_date: now,
    status: 'חדש',
    quoted_monthly_value: intent.lead_value || 0,
    created_at: now,
    created_by: 'telegram',
    assigned_to: null,
    tenant_id: tenantId,
  })

  if (error) {
    console.error('Add lead error:', error)
    return `❌ שגיאה בהוספת ליד: ${error.message}`
  }

  let details = `✅ <b>ליד חדש נוסף: ${leadName}</b>\n`
  if (intent.lead_phone) details += `📱 ${intent.lead_phone}\n`
  if (intent.lead_business) details += `🏢 ${intent.lead_business}\n`
  if (intent.lead_value) details += `💰 ₪${intent.lead_value}\n`
  details += `\nסטטוס: <b>חדש</b> 🆕`

  return details
}

async function executeUpdateLeadStatus(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim()
  const newStatus = intent.status?.trim()

  if (!entityName || !newStatus) {
    return '❌ לא הצלחתי לזהות את שם הליד או הסטטוס.\nנסה: "ניב עבר לנקבעה פגישה"'
  }

  const validStatuses = ['חדש', 'נוצר קשר', 'נשלחה הצעה', 'נקבעה פגישה', 'ממתין להחלטה', 'נסגר בהצלחה', 'אבוד', 'לא רלוונטי']
  if (!validStatuses.includes(newStatus)) {
    return `❌ סטטוס לא תקין: "${newStatus}"\nסטטוסים אפשריים: ${validStatuses.join(', ')}`
  }

  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name, status')
    .eq('tenant_id', tenantId)
    .ilike('lead_name', `%${entityName}%`)
    .limit(3)

  if (!leads?.length) {
    return `❌ לא נמצא ליד בשם "${entityName}"`
  }
  if (leads.length > 1) {
    return `⚠️ נמצאו ${leads.length} לידים:\n${leads.map(l => `• ${l.lead_name} (${l.status})`).join('\n')}\nנסה להיות יותר ספציפי.`
  }

  const lead = leads[0]
  const oldStatus = lead.status

  const { error } = await adminClient
    .from('leads')
    .update({ status: newStatus })
    .eq('lead_id', lead.lead_id)

  if (error) {
    return `❌ שגיאה בעדכון: ${error.message}`
  }

  return `✅ <b>ליד ${lead.lead_name} עודכן</b>\n📊 ${oldStatus} ← → <b>${newStatus}</b>`
}

async function executeUpdateClientStatus(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim()
  const newStatus = intent.status?.trim()

  if (!entityName || !newStatus) {
    return '❌ לא הצלחתי לזהות את שם הלקוח או הסטטוס.\nנסה: "מאיה עברה למושהה"'
  }

  const validStatuses = ['פעיל', 'מושהה', 'בתהליך עזיבה', 'עזב']
  if (!validStatuses.includes(newStatus)) {
    return `❌ סטטוס לא תקין: "${newStatus}"\nסטטוסים אפשריים: ${validStatuses.join(', ')}`
  }

  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name, status')
    .eq('tenant_id', tenantId)
    .ilike('client_name', `%${entityName}%`)
    .limit(3)

  if (!clients?.length) {
    return `❌ לא נמצא לקוח בשם "${entityName}"`
  }
  if (clients.length > 1) {
    return `⚠️ נמצאו ${clients.length} לקוחות:\n${clients.map(c => `• ${c.client_name} (${c.status})`).join('\n')}\nנסה להיות יותר ספציפי.`
  }

  const client = clients[0]
  const oldStatus = client.status

  const { error } = await adminClient
    .from('clients')
    .update({ status: newStatus })
    .eq('client_id', client.client_id)

  if (error) {
    return `❌ שגיאה בעדכון: ${error.message}`
  }

  return `✅ <b>לקוח ${client.client_name} עודכן</b>\n📊 ${oldStatus} ← → <b>${newStatus}</b>`
}

async function executeSearch(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const query = (intent.search_query || intent.entity_name || intent.raw_text).trim().toLowerCase()

  // Search clients
  const { data: clients } = await adminClient
    .from('clients')
    .select('client_id, client_name, business_name, phone, status, monthly_retainer, rating')
    .eq('tenant_id', tenantId)

  const matchedClients = (clients || []).filter(c =>
    c.client_name?.toLowerCase().includes(query) ||
    c.business_name?.toLowerCase().includes(query) ||
    c.phone?.includes(query)
  )

  // Search leads
  const { data: leads } = await adminClient
    .from('leads')
    .select('lead_id, lead_name, business_name, phone, status, quoted_monthly_value, next_contact_date')
    .eq('tenant_id', tenantId)

  const matchedLeads = (leads || []).filter(l =>
    l.lead_name?.toLowerCase().includes(query) ||
    l.business_name?.toLowerCase().includes(query) ||
    l.phone?.includes(query)
  )

  if (matchedClients.length === 0 && matchedLeads.length === 0) {
    return `🔍 לא נמצאו תוצאות עבור "<b>${query}</b>"`
  }

  let result = ''

  if (matchedClients.length > 0) {
    result += '<b>🏢 לקוחות:</b>\n'
    for (const c of matchedClients.slice(0, 5)) {
      const ratingEmoji = c.rating === 'A_plus' ? '⭐' : c.rating === 'A' ? '🌟' : ''
      result += `• <b>${c.client_name}</b> ${ratingEmoji}\n`
      result += `  ${c.business_name || '-'} | ${c.status}\n`
      result += `  💰 ₪${(c.monthly_retainer || 0).toLocaleString()}/חודש`
      if (c.phone) result += ` | 📱 ${c.phone}`
      result += '\n\n'
    }
  }

  if (matchedLeads.length > 0) {
    result += '<b>🎯 לידים:</b>\n'
    for (const l of matchedLeads.slice(0, 5)) {
      result += `• <b>${l.lead_name}</b>\n`
      result += `  ${l.business_name || '-'} | ${l.status}\n`
      if (l.quoted_monthly_value) result += `  💰 ₪${l.quoted_monthly_value.toLocaleString()}`
      if (l.phone) result += ` | 📱 ${l.phone}`
      result += '\n\n'
    }
  }

  // Also get recent notes for single match
  if (matchedClients.length === 1 && matchedLeads.length === 0) {
    const { data: notes } = await adminClient
      .from('client_notes')
      .select('content, created_at, created_by_name')
      .eq('client_id', matchedClients[0].client_id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (notes?.length) {
      result += '<b>📝 הערות אחרונות:</b>\n'
      for (const n of notes) {
        const date = new Date(n.created_at).toLocaleDateString('he-IL')
        result += `• ${n.content.substring(0, 80)} <i>(${n.created_by_name}, ${date})</i>\n`
      }
    }
  }

  if (matchedLeads.length === 1 && matchedClients.length === 0) {
    const { data: notes } = await adminClient
      .from('lead_notes')
      .select('content, created_at, created_by_name')
      .eq('lead_id', matchedLeads[0].lead_id)
      .order('created_at', { ascending: false })
      .limit(3)

    if (notes?.length) {
      result += '<b>📝 הערות אחרונות:</b>\n'
      for (const n of notes) {
        const date = new Date(n.created_at).toLocaleDateString('he-IL')
        result += `• ${n.content.substring(0, 80)} <i>(${n.created_by_name}, ${date})</i>\n`
      }
    }
  }

  return result.trim()
}

async function executeSignalsProfile(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const entityName = intent.entity_name?.trim() || intent.search_query?.trim()
  if (!entityName) {
    return '❌ לא הצלחתי לזהות שם. נסה: "פרופיל signals של אריה טל"'
  }

  // Search signals_personality by subject_name
  const { data: profiles } = await adminClient
    .from('signals_personality')
    .select('*')
    .eq('tenant_id', tenantId)
    .ilike('subject_name', `%${entityName}%`)
    .order('received_at', { ascending: false })
    .limit(3)

  // If not found by tenant_id, try without (Signals OS might use different tenant format)
  let matchedProfiles = profiles
  if (!matchedProfiles?.length) {
    const { data: allProfiles } = await adminClient
      .from('signals_personality')
      .select('*')
      .ilike('subject_name', `%${entityName}%`)
      .order('received_at', { ascending: false })
      .limit(3)
    matchedProfiles = allProfiles
  }

  if (!matchedProfiles?.length) {
    // Also try searching by lead_name/client_name to find linked profiles
    const { data: leads } = await adminClient
      .from('leads')
      .select('lead_id, lead_name')
      .ilike('lead_name', `%${entityName}%`)
      .limit(1)

    if (leads?.length) {
      const { data: linkedProfiles } = await adminClient
        .from('signals_personality')
        .select('*')
        .eq('lead_id', leads[0].lead_id)
        .order('received_at', { ascending: false })
        .limit(1)

      if (linkedProfiles?.length) matchedProfiles = linkedProfiles
    }

    if (!matchedProfiles?.length) {
      return `❌ לא נמצא פרופיל Signals OS עבור "${entityName}"\nוודא שמילאת שאלון Signals OS עבור האיש הזה.`
    }
  }

  const p = matchedProfiles[0]

  // Build archetype emoji map
  const archetypeEmoji: Record<string, string> = {
    'WINNER': '🏆', 'STAR': '⭐', 'DREAMER': '💭', 'HEART': '❤️', 'ANCHOR': '⚓'
  }
  const archetypeNames: Record<string, string> = {
    'WINNER': 'Winner — מנצח', 'STAR': 'Star — כוכב', 'DREAMER': 'Dreamer — חולם',
    'HEART': 'Heart — לב', 'ANCHOR': 'Anchor — עוגן'
  }

  const primaryEmoji = archetypeEmoji[p.primary_archetype] || '🔮'
  const secondaryEmoji = archetypeEmoji[p.secondary_archetype] || ''

  let result = `<b>${primaryEmoji} פרופיל Signals OS — ${p.subject_name}</b>\n\n`

  // Primary + Secondary archetype
  result += `<b>ארכיטיפ ראשי:</b> ${primaryEmoji} ${archetypeNames[p.primary_archetype] || p.primary_archetype}\n`
  result += `<b>ארכיטיפ משני:</b> ${secondaryEmoji} ${archetypeNames[p.secondary_archetype] || p.secondary_archetype}\n`
  result += `<b>רמת ביטחון:</b> ${p.confidence_level}\n`
  result += `<b>סיכון נטישה:</b> ${p.churn_risk === 'HIGH' ? '🔴 גבוה' : p.churn_risk === 'MEDIUM' ? '🟡 בינוני' : '🟢 נמוך'}\n`

  // Smart tags
  if (p.smart_tags && Array.isArray(p.smart_tags) && p.smart_tags.length > 0) {
    result += `<b>תגיות:</b> ${p.smart_tags.slice(0, 5).join(', ')}\n`
  }

  // Scores
  if (p.scores && typeof p.scores === 'object') {
    result += '\n<b>📊 ציונים:</b>\n'
    const scoreEntries = Object.entries(p.scores) as [string, number][]
    for (const [arch, score] of scoreEntries) {
      const bar = '█'.repeat(Math.round((score / 100) * 10)) + '░'.repeat(10 - Math.round((score / 100) * 10))
      result += `  ${archetypeEmoji[arch] || ''} ${arch}: ${bar} ${score}%\n`
    }
  }

  // Business Intel V2 — Hero Card
  if (p.business_intel_v2) {
    const biz = p.business_intel_v2 as Record<string, unknown>
    const hero = biz.heroCard as Record<string, unknown> | undefined
    if (hero) {
      result += `\n<b>🎯 תובנה עסקית:</b>\n`
      if (hero.profileLine) result += `${hero.profileLine}\n`
      if (hero.topStrength) result += `💪 חוזקה: ${hero.topStrength}\n`
      if (hero.topRisk) result += `⚠️ סיכון: ${hero.topRisk}\n`
      if (hero.urgency) result += `⏰ דחיפות: ${hero.urgency}\n`
      if (hero.closeRate) result += `📈 סיכוי סגירה: ${hero.closeRate}%\n`
    }

    // Action items
    const actions = biz.actionItems as Array<Record<string, unknown>> | undefined
    if (actions?.length) {
      result += '\n<b>📋 פעולות מומלצות:</b>\n'
      for (const a of actions.slice(0, 3)) {
        result += `${a.priority}. ${a.action}\n   💡 ${a.why}\n`
      }
    }

    // Quick script
    const script = biz.quickScript as Record<string, unknown> | undefined
    if (script) {
      result += '\n<b>💬 סקריפט מהיר:</b>\n'
      if (script.opener) result += `🎬 פתיח: "${script.opener}"\n`
      if (script.keyQuestion) result += `❓ שאלה: "${script.keyQuestion}"\n`
      if (script.closeLine) result += `🤝 סגירה: "${script.closeLine}"\n`
    }
  }

  // Sales cheat sheet
  if (p.sales_cheat_sheet && typeof p.sales_cheat_sheet === 'object' && Object.keys(p.sales_cheat_sheet).length > 0) {
    result += '\n<b>📋 טיפים למכירה:</b>\n'
    const entries = Object.entries(p.sales_cheat_sheet).slice(0, 5)
    for (const [key, val] of entries) {
      if (Array.isArray(val)) {
        result += `• <b>${key}:</b> ${val.slice(0, 3).join(', ')}\n`
      } else {
        result += `• <b>${key}:</b> ${String(val).substring(0, 120)}\n`
      }
    }
  }

  // Retention cheat sheet
  if (p.retention_cheat_sheet && typeof p.retention_cheat_sheet === 'object' && Object.keys(p.retention_cheat_sheet).length > 0) {
    result += '\n<b>🔒 טיפים לשימור:</b>\n'
    const entries = Object.entries(p.retention_cheat_sheet).slice(0, 4)
    for (const [key, val] of entries) {
      result += `• <b>${key}:</b> ${String(val).substring(0, 120)}\n`
    }
  }

  // User report (summary)
  if (p.user_report) {
    const reportSnippet = p.user_report.substring(0, 300).replace(/<[^>]*>/g, '')
    result += `\n<b>📄 דוח אישיות:</b>\n${reportSnippet}${p.user_report.length > 300 ? '...' : ''}\n`
  }

  return result.trim()
}

async function executeStats(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string
): Promise<string> {
  // Try with tenant_id first, fallback to all data if empty (handles pre-multi-tenant data)
  let { data: clients } = await adminClient
    .from('clients')
    .select('status, monthly_retainer, supplier_cost_monthly, rating')
    .eq('tenant_id', tenantId)

  if (!clients?.length) {
    // Fallback: get all clients (might be pre-tenant-migration data)
    const { data: allClients } = await adminClient
      .from('clients')
      .select('status, monthly_retainer, supplier_cost_monthly, rating')
    clients = allClients
  }

  let { data: leads } = await adminClient
    .from('leads')
    .select('status, created_at')
    .eq('tenant_id', tenantId)

  if (!leads?.length) {
    const { data: allLeads } = await adminClient
      .from('leads')
      .select('status, created_at')
    leads = allLeads
  }

  let { data: deals } = await adminClient
    .from('deals')
    .select('deal_status, deal_amount, supplier_cost')
    .eq('tenant_id', tenantId)

  if (!deals?.length) {
    const { data: allDeals } = await adminClient
      .from('deals')
      .select('deal_status, deal_amount, supplier_cost')
    deals = allDeals
  }

  const activeClients = (clients || []).filter(c => c.status === 'פעיל')
  const totalRevenue = activeClients.reduce((s, c) => s + (c.monthly_retainer || 0), 0)
  const totalCost = activeClients.reduce((s, c) => s + (c.supplier_cost_monthly || 0), 0)
  const grossProfit = totalRevenue - totalCost

  const newLeads = (leads || []).filter(l => l.status === 'חדש').length
  const contactedLeads = (leads || []).filter(l => l.status === 'נוצר קשר').length
  const meetingLeads = (leads || []).filter(l => l.status === 'נקבעה פגישה').length
  const wonLeads = (leads || []).filter(l => l.status === 'נסגר בהצלחה').length
  const totalLeads = (leads || []).length

  const activeDeals = (deals || []).filter(d => d.deal_status === 'In_progress').length
  const dealRevenue = (deals || []).reduce((s, d) => s + (d.deal_amount || 0), 0)

  return `<b>📊 דשבורד מהיר</b>

<b>🏢 לקוחות</b>
• פעילים: <b>${activeClients.length}</b> / ${(clients || []).length} סה"כ
• הכנסה חודשית: <b>₪${totalRevenue.toLocaleString()}</b>
• עלויות ספקים: ₪${totalCost.toLocaleString()}
• רווח גולמי: <b>₪${grossProfit.toLocaleString()}</b>

<b>🎯 לידים</b>
• חדשים: <b>${newLeads}</b>
• נוצר קשר: ${contactedLeads}
• נקבעה פגישה: ${meetingLeads}
• נסגר בהצלחה: ${wonLeads} ✅
• סה"כ: ${totalLeads}

<b>📦 פרויקטים</b>
• בתהליך: ${activeDeals}
• סה"כ הכנסות: ₪${dealRevenue.toLocaleString()}`
}

async function executeReminder(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  intent: CRMIntent
): Promise<string> {
  const reminderText = intent.reminder_text || intent.raw_text
  const entityName = intent.entity_name

  // Find entity if mentioned
  let clientId: string | null = null
  let leadId: string | null = null

  if (entityName) {
    const { data: clients } = await adminClient
      .from('clients')
      .select('client_id')
      .eq('tenant_id', tenantId)
      .ilike('client_name', `%${entityName}%`)
      .limit(1)
    if (clients?.length) clientId = clients[0].client_id

    if (!clientId) {
      const { data: leads } = await adminClient
        .from('leads')
        .select('lead_id')
        .eq('tenant_id', tenantId)
        .ilike('lead_name', `%${entityName}%`)
        .limit(1)
      if (leads?.length) leadId = leads[0].lead_id
    }
  }

  // Save as calendar event (tomorrow 10:00)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  const { error } = await adminClient.from('calendar_events').insert({
    id: crypto.randomUUID(),
    title: `🔔 ${reminderText.substring(0, 100)}`,
    event_type: 'reminder',
    start_time: tomorrow.toISOString(),
    all_day: false,
    description: `תזכורת מטלגרם: ${reminderText}`,
    client_id: clientId,
    lead_id: leadId,
    created_by: 'telegram',
    created_by_name: 'Telegram Bot 🤖',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    tenant_id: tenantId,
  })

  if (error) {
    // Fallback — save as a note if calendar_events table doesn't exist
    console.error('Calendar insert error:', error)
    return `⚠️ לא הצלחתי לשמור תזכורת ביומן.\n📝 תזכורת: ${reminderText}`
  }

  const dateStr = tomorrow.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })
  return `✅ <b>תזכורת נשמרה ליומן</b>\n📅 ${dateStr} בשעה 10:00\n🔔 ${reminderText}${entityName ? `\n👤 קשור ל: ${entityName}` : ''}`
}

// ── Voice Transcription + Intent ─────────────────────────────
async function transcribeAndExecute(
  geminiKey: string,
  audioBase64: string,
  adminClient: ReturnType<typeof createClient>,
  tenantId: string
): Promise<{ response: string; action: string; transcription: string }> {
  // Step 1: Transcribe
  const transcription = await callGemini(
    geminiKey,
    'תמלל את ההקלטה הזאת לעברית. תן רק את התמלול, בלי הסברים נוספים.',
    GEMINI_MODEL,
    0.2,
    1024,
    { mimeType: 'audio/ogg', data: audioBase64 }
  )

  if (!transcription) {
    return {
      response: '❌ לא הצלחתי לתמלל את ההודעה הקולית. נסה שוב.',
      action: 'voice_transcription_failed',
      transcription: '',
    }
  }

  // Step 2: Recognize intent from transcription
  const intent = await recognizeIntent(geminiKey, transcription)

  // Step 3: Execute the action
  const { response, action } = await executeIntent(intent, adminClient, tenantId, geminiKey)

  return {
    response: `<b>🎤 תמלול:</b> <i>${transcription}</i>\n\n${response}`,
    action: `voice_${action}`,
    transcription,
  }
}

// ── Master Intent Router ─────────────────────────────────────
async function executeIntent(
  intent: CRMIntent,
  adminClient: ReturnType<typeof createClient>,
  tenantId: string,
  geminiKey: string
): Promise<{ response: string; action: string }> {
  switch (intent.action) {
    case 'multi_action': {
      // Execute multiple actions sequentially
      const subActions = intent.sub_actions || []
      if (!subActions.length) {
        // Fallback: treat as single action with note
        return {
          response: '⚠️ לא זוהו פעולות ספציפיות. נסה שוב.',
          action: 'multi_action_empty',
        }
      }
      const results: string[] = []
      const actionNames: string[] = []
      for (const sub of subActions) {
        sub.raw_text = sub.raw_text || intent.raw_text
        try {
          const { response, action } = await executeIntent(sub, adminClient, tenantId, geminiKey)
          results.push(response)
          actionNames.push(action)
        } catch (err) {
          console.error('Sub-action error:', err)
          results.push(`❌ שגיאה בביצוע ${sub.action}`)
        }
      }
      return {
        response: `<b>🔄 ${subActions.length} פעולות בוצעו:</b>\n\n${results.join('\n\n')}`,
        action: `multi:${actionNames.join('+')}`,
      }
    }

    case 'reschedule':
      return {
        response: await executeReschedule(adminClient, tenantId, intent),
        action: 'reschedule',
      }

    case 'update_field':
      return {
        response: await executeUpdateField(adminClient, tenantId, intent),
        action: 'update_field',
      }

    case 'add_deal':
      return {
        response: await executeAddDeal(adminClient, tenantId, intent),
        action: 'add_deal',
      }

    case 'add_note':
      return {
        response: await executeAddNote(adminClient, tenantId, intent),
        action: 'add_note',
      }

    case 'add_lead':
      return {
        response: await executeAddLead(adminClient, tenantId, intent),
        action: 'add_lead',
      }

    case 'update_lead_status':
      return {
        response: await executeUpdateLeadStatus(adminClient, tenantId, intent),
        action: 'update_lead_status',
      }

    case 'update_client_status':
      return {
        response: await executeUpdateClientStatus(adminClient, tenantId, intent),
        action: 'update_client_status',
      }

    case 'search':
      return {
        response: await executeSearch(adminClient, tenantId, intent),
        action: 'search',
      }

    case 'signals_profile':
      return {
        response: await executeSignalsProfile(adminClient, tenantId, intent),
        action: 'signals_profile',
      }

    case 'stats':
      return {
        response: await executeStats(adminClient, tenantId),
        action: 'stats',
      }

    case 'reminder':
      return {
        response: await executeReminder(adminClient, tenantId, intent),
        action: 'reminder',
      }

    case 'help':
      return {
        response: getHelpMessage(),
        action: 'help',
      }

    default: {
      // Unknown intent — use AI chat as fallback with CRM context
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

      const aiResponse = await callGemini(
        geminiKey,
        `אתה עוזר AI חכם של סוכנות שיווק דיגיטלי. הנה נתוני CRM:\n${crmContext}\n\nהודעת המשתמש: ${intent.raw_text}\n\nענה בקצרה ובעברית. אם יש פעולה ספציפית שצריך לעשות ב-CRM, ציין אותה.`,
        GEMINI_MODEL,
        0.7,
        1024
      )

      return {
        response: aiResponse || '❌ לא התקבלה תשובה מ-AI',
        action: 'ai_chat',
      }
    }
  }
}

// ── Help message ─────────────────────────────────────────────
function getHelpMessage(): string {
  return `<b>🤖 Agency Manager Bot</b>
<i>מבצע פעולות אמיתיות במערכת!</i>

<b>📅 הזזת פגישות:</b>
• "הפגישה עם מנשה נדחתה ליום חמישי"
• "תזיז את ניב למחר"
• "קשר הבא עם דני בעוד שבוע"

<b>📊 עדכון סטטוס:</b>
• "ניב עבר לנקבעה פגישה"
• "מאיה עברה למושהה"

<b>✏️ עדכון שדות:</b>
• "תעדכן טלפון של ניב ל-0501234567"
• "הצעת מחיר של מנשה 5000"

<b>📝 הערות:</b>
• "תרשום אצל ניב שביקש הצעת מחיר"

<b>➕ הוספה:</b>
• "ליד חדש: דני כהן, 0501234567"
• "פרויקט חדש לניב: אתר 5000 שקל"

<b>🔍 חיפוש:</b>
• "מה עם ניב?" / "חפש דני"

<b>🔮 Signals OS:</b>
• "פרופיל signals של אריה טל"
• "אישיות של מנשה"

<b>📊 סטטיסטיקות:</b>
• "מה המצב?" / "כמה לקוחות?"

<b>🎤 הודעות קוליות:</b>
הקלט הודעה קולית — הבוט יתמלל ויבצע!

<b>📎 קבצים ותמונות:</b>
• שלח תמונה + "שמור במאגר הידע" — שמירה + ניתוח
• שלח תמונה + "קבלה" / "חשבונית" — העלאה לקבלות
• שלח מסמך (PDF/Word) — נשמר אוטומטית במאגר הידע
• שלח מסמך + "קבלה" — נשמר כקבלה

/stats — דשבורד | /search — חיפוש | /help — עזרה`
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
      // Try to register
      const anyWithToken = (allSettings || []).find(
        (s: { telegram_bot_token: string | null; telegram_chat_id: string | null }) =>
          s.telegram_bot_token && !s.telegram_chat_id
      )
      if (anyWithToken?.telegram_bot_token) {
        await adminClient
          .from('settings')
          .update({ telegram_chat_id: chatId })
          .eq('tenant_id', anyWithToken.tenant_id)

        await sendTelegramMessage(
          anyWithToken.telegram_bot_token,
          chatId,
          `✅ <b>הבוט מחובר למערכת!</b>\n\n${getHelpMessage()}`
        )
        return new Response('OK', { status: 200 })
      }
      return new Response('OK', { status: 200 })
    }

    const botToken = matchedSetting.telegram_bot_token
    let tenantId = matchedSetting.tenant_id
    const geminiKey = matchedSetting.gemini_api_key

    // Smart tenant resolution: if tenant_id returns no clients, try to find actual tenant_id from data
    const { count: clientCount } = await adminClient
      .from('clients')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (!clientCount || clientCount === 0) {
      // Try to find the real tenant_id by looking at what clients exist
      const { data: anyClient } = await adminClient
        .from('clients')
        .select('tenant_id')
        .limit(1)
      if (anyClient?.length && anyClient[0].tenant_id) {
        tenantId = anyClient[0].tenant_id
        console.log(`Tenant ID resolved from clients: ${tenantId}`)
      }
    }

    // Show typing indicator
    await sendTypingAction(botToken, chatId)

    let responseText = ''
    let actionTaken = ''
    let messageType = 'text'

    // ── Route: Slash commands (fast path) ──────────────
    if (text.startsWith('/stats')) {
      responseText = await executeStats(adminClient, tenantId)
      actionTaken = 'stats'

    } else if (text.startsWith('/search ')) {
      const query = text.replace('/search ', '').trim()
      const intent: CRMIntent = { action: 'search', search_query: query, raw_text: text }
      responseText = await executeSearch(adminClient, tenantId, intent)
      actionTaken = 'search'

    } else if (text.startsWith('/note ')) {
      const noteText = text.replace('/note ', '').trim()
      const colonIdx = noteText.indexOf(':')
      if (colonIdx > 0) {
        const intent: CRMIntent = {
          action: 'add_note',
          entity_name: noteText.substring(0, colonIdx).trim(),
          note_content: noteText.substring(colonIdx + 1).trim(),
          raw_text: text,
        }
        responseText = await executeAddNote(adminClient, tenantId, intent)
      } else {
        responseText = 'פורמט: /note <שם>: <תוכן ההערה>'
      }
      actionTaken = 'add_note'

    } else if (text.startsWith('/help') || text.startsWith('/start')) {
      responseText = getHelpMessage()
      actionTaken = 'help'

    } else if (message.voice || message.audio) {
      // ── Voice message — transcribe + execute ─────────
      messageType = 'voice'
      const fileId = message.voice?.file_id || message.audio?.file_id

      if (!fileId || !geminiKey) {
        responseText = '❌ נדרש מפתח Gemini API לעיבוד הודעות קוליות'
      } else {
        const fileUrl = await getTelegramFileUrl(botToken, fileId)
        if (!fileUrl) {
          responseText = '❌ לא הצלחתי לגשת לקובץ האודיו'
        } else {
          const audioRes = await fetch(fileUrl)
          const audioBuffer = await audioRes.arrayBuffer()
          const audioBase64 = btoa(
            new Uint8Array(audioBuffer).reduce((s, b) => s + String.fromCharCode(b), '')
          )

          const result = await transcribeAndExecute(geminiKey, audioBase64, adminClient, tenantId)
          responseText = result.response
          actionTaken = result.action
        }
      }

    } else if (message.photo) {
      // ── Image — analyze with Gemini + optionally save to Knowledge Base or Expenses ──
      messageType = 'photo'
      const photo = message.photo[message.photo.length - 1]
      if (photo?.file_id && geminiKey) {
        const fileUrl = await getTelegramFileUrl(botToken, photo.file_id)
        if (fileUrl) {
          const imgRes = await fetch(fileUrl)
          const imgBuffer = await imgRes.arrayBuffer()
          const imgBytes = new Uint8Array(imgBuffer)
          const imgBase64 = btoa(
            imgBytes.reduce((s, b) => s + String.fromCharCode(b), '')
          )

          const captionLower = (text || '').toLowerCase()
          const wantsKnowledge = captionLower.includes('מאגר') || captionLower.includes('ידע') || captionLower.includes('שמור') || captionLower.includes('knowledge')
          const wantsReceipt = captionLower.includes('קבלה') || captionLower.includes('חשבונית') || captionLower.includes('הוצאה') || captionLower.includes('receipt') || captionLower.includes('expense')

          // Always analyze the image first
          const analysis = await callGemini(
            geminiKey,
            text
              ? `ההודעה: "${text}"\nנתח את התמונה הזו בהקשר של ניהול לקוחות וסוכנות שיווק. אם יש טקסט בתמונה, תמלל אותו. ענה בעברית.`
              : 'נתח את התמונה הזו בהקשר של ניהול לקוחות וסוכנות שיווק. אם יש טקסט בתמונה, תמלל אותו. ענה בעברית.',
            GEMINI_MODEL,
            0.5,
            1024,
            { mimeType: 'image/jpeg', data: imgBase64 }
          )

          let uploadResult = ''

          // Upload to Knowledge Base
          if (wantsKnowledge) {
            try {
              const storageName = `telegram_${Date.now()}.jpg`
              const { error: uploadErr } = await adminClient.storage
                .from('knowledge')
                .upload(storageName, imgBytes.buffer, { contentType: 'image/jpeg', upsert: false })

              if (uploadErr) {
                console.error('Knowledge upload error:', uploadErr)
                uploadResult = '\n\n⚠️ שגיאה בהעלאה למאגר הידע: ' + uploadErr.message
              } else {
                // Generate signed URL (1 year expiry) for download
                const { data: signedUrlData } = await adminClient.storage
                  .from('knowledge')
                  .createSignedUrl(storageName, 365 * 24 * 3600)
                const downloadUrl = signedUrlData?.signedUrl || storageName

                // Use the caption as title directly
                const articleTitle = text?.trim() || `תמונה מטלגרם — ${new Date().toLocaleDateString('he-IL')}`

                await adminClient.from('knowledge_articles').insert({
                  id: crypto.randomUUID(),
                  title: articleTitle,
                  content: analysis || 'תמונה שנשלחה מטלגרם',
                  summary: (analysis || '').substring(0, 200),
                  category: 'כללי',
                  tags: ['טלגרם', 'תמונה'],
                  file_url: downloadUrl,
                  file_name: storageName,
                  file_type: 'image/jpeg',
                  is_ai_generated: false,
                  created_by: 'telegram',
                  created_by_name: 'Telegram Bot 🤖',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  tenant_id: tenantId,
                })
                uploadResult = '\n\n✅ <b>התמונה נשמרה במאגר הידע!</b> 📚'
              }
            } catch (err) {
              console.error('Knowledge save error:', err)
              uploadResult = '\n\n⚠️ שגיאה בשמירה למאגר הידע'
            }
          }

          // Upload to Receipts
          if (wantsReceipt) {
            try {
              const receiptName = `telegram_${Date.now()}.jpg`
              const { error: uploadErr } = await adminClient.storage
                .from('receipts')
                .upload(receiptName, imgBytes.buffer, { contentType: 'image/jpeg', upsert: false })

              if (uploadErr) {
                console.error('Receipt upload error:', uploadErr)
                uploadResult += '\n\n⚠️ שגיאה בהעלאת קבלה: ' + uploadErr.message
              } else {
                uploadResult += `\n\n✅ <b>הקבלה הועלתה בהצלחה!</b> 🧾\nנתיב: ${receiptName}\nאפשר לשייך אותה להוצאה דרך האתר.`
              }
            } catch (err) {
              console.error('Receipt upload error:', err)
              uploadResult += '\n\n⚠️ שגיאה בהעלאת קבלה'
            }
          }

          responseText = analysis
            ? `<b>📷 ניתוח תמונה:</b>\n${analysis}${uploadResult}`
            : `❌ לא הצלחתי לנתח את התמונה${uploadResult}`
          actionTaken = wantsKnowledge ? 'image_to_knowledge' : wantsReceipt ? 'image_to_receipt' : 'image_analysis'
        }
      }

    } else if (message.document) {
      // ── Document — save to Knowledge Base or Receipts ──────────
      messageType = 'document'
      const doc = message.document
      if (doc?.file_id) {
        const fileUrl = await getTelegramFileUrl(botToken, doc.file_id)
        const fileName = doc.file_name || `document_${Date.now()}`
        const mimeType = doc.mime_type || 'application/octet-stream'

        if (fileUrl) {
          const docRes = await fetch(fileUrl)
          const docBuffer = await docRes.arrayBuffer()
          const docBytes = new Uint8Array(docBuffer)

          const captionLower = (text || '').toLowerCase()
          const wantsReceipt = captionLower.includes('קבלה') || captionLower.includes('חשבונית') || captionLower.includes('הוצאה') || captionLower.includes('receipt') || captionLower.includes('expense')
          // Default: save documents to knowledge base unless explicitly receipt
          const wantsKnowledge = !wantsReceipt

          if (wantsKnowledge) {
            try {
              const safeName = `telegram_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
              const { error: uploadErr } = await adminClient.storage
                .from('knowledge')
                .upload(safeName, docBytes.buffer, { contentType: mimeType, upsert: false })

              if (uploadErr) {
                responseText = `⚠️ שגיאה בהעלאת מסמך: ${uploadErr.message}`
              } else {
                // Generate signed URL (1 year expiry) for download
                const { data: signedUrlData } = await adminClient.storage
                  .from('knowledge')
                  .createSignedUrl(safeName, 365 * 24 * 3600)
                const downloadUrl = signedUrlData?.signedUrl || safeName

                // Use the caption as title directly (don't strip Hebrew keywords)
                const articleTitle = text?.trim() || fileName

                // Try AI extraction if the document is a supported type (PDF, text)
                let aiSummary = ''
                const isTextType = mimeType.includes('text') || mimeType.includes('pdf') || mimeType.includes('json')
                if (geminiKey && isTextType && docBytes.length < 500_000) {
                  try {
                    const docBase64 = btoa(docBytes.reduce((s, b) => s + String.fromCharCode(b), ''))
                    aiSummary = await callGemini(
                      geminiKey,
                      'סכם את תוכן המסמך הזה בעברית. תן סיכום קצר (2-3 משפטים) ונקודות מפתח.',
                      GEMINI_MODEL,
                      0.3,
                      1024,
                      { mimeType, data: docBase64 }
                    )
                  } catch { /* ignore AI errors — still save the doc */ }
                }

                await adminClient.from('knowledge_articles').insert({
                  id: crypto.randomUUID(),
                  title: articleTitle,
                  content: aiSummary || `מסמך: ${fileName}`,
                  summary: aiSummary ? aiSummary.substring(0, 200) : `קובץ: ${fileName}`,
                  category: 'כללי',
                  tags: ['טלגרם', 'מסמך'],
                  file_url: downloadUrl,
                  file_name: fileName,
                  file_type: mimeType,
                  is_ai_generated: false,
                  created_by: 'telegram',
                  created_by_name: 'Telegram Bot 🤖',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  tenant_id: tenantId,
                })

                responseText = `✅ <b>המסמך נשמר במאגר הידע!</b> 📚\n📄 ${fileName}`
                if (aiSummary) responseText += `\n\n<b>📝 סיכום:</b>\n${aiSummary.substring(0, 500)}`
              }
            } catch (err) {
              console.error('Document knowledge save error:', err)
              responseText = '⚠️ שגיאה בשמירת מסמך'
            }
            actionTaken = 'document_to_knowledge'
          } else {
            // Upload as receipt
            try {
              const safeName = `telegram_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9._\-]/g, '_')}`
              const { error: uploadErr } = await adminClient.storage
                .from('receipts')
                .upload(safeName, docBytes.buffer, { contentType: mimeType, upsert: false })

              if (uploadErr) {
                responseText = `⚠️ שגיאה בהעלאת קבלה: ${uploadErr.message}`
              } else {
                responseText = `✅ <b>הקבלה/חשבונית הועלתה!</b> 🧾\n📄 ${fileName}\nאפשר לשייך אותה להוצאה דרך האתר.`
              }
            } catch (err) {
              console.error('Document receipt save error:', err)
              responseText = '⚠️ שגיאה בהעלאת קבלה'
            }
            actionTaken = 'document_to_receipt'
          }
        }
      }

    } else if (text && !text.startsWith('/') && geminiKey) {
      // ── Free text — AI intent recognition + execution ─
      const intent = await recognizeIntent(geminiKey, text)
      const result = await executeIntent(intent, adminClient, tenantId, geminiKey)
      responseText = result.response
      actionTaken = result.action
    }

    // Send response
    if (responseText) {
      await sendTelegramMessage(botToken, chatId, responseText)
    }

    // Log message
    try {
      await adminClient.from('telegram_messages').insert({
        chat_id: chatId,
        message_type: messageType,
        content: text || `[${messageType}]`,
        ai_response: responseText?.substring(0, 5000) || null,
        action_taken: actionTaken || null,
        tenant_id: tenantId,
        created_at: new Date().toISOString(),
      })
    } catch (logError) {
      console.error('Log insert error:', logError)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('Telegram webhook error:', err)
    return new Response('OK', { status: 200 }) // Always return 200 to Telegram
  }
})
