// Supabase Edge Function: proposal-webhook
// Handles proposal events: viewed, rejected, signed
// Sends email notifications via Resend + Telegram
// Deploy: npx supabase functions deploy proposal-webhook --project-ref rxckkozbkrabpjdgyxqm --no-verify-jwt

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Telegram notification helper ──────────────────────────────
async function sendTelegramNotification(botToken: string, chatId: string, text: string): Promise<void> {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('Telegram notification error:', err)
  }
}

// ── Email via Resend helper ───────────────────────────────────
async function sendResendEmail(
  apiKey: string,
  to: string,
  subject: string,
  html: string,
  fromName?: string
): Promise<void> {
  try {
    const fromAddress = fromName
      ? `${fromName} <niv@alma-ads.co.il>`
      : 'Alma Ads <niv@alma-ads.co.il>'

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject,
        html,
      }),
    })

    if (!response.ok) {
      const errBody = await response.text().catch(() => '')
      console.error('Resend API error:', response.status, errBody)
    } else {
      console.log(`Email sent to ${to}`)
    }
  } catch (err) {
    console.error('Email send error:', err)
  }
}

// ── Email template: Agency notification ───────────────────────
function buildAgencyNotificationEmail(params: {
  agencyName: string
  proposalName: string
  businessName: string
  signerName: string
  signerEmail: string
  selectedPackage: string
  signedAt: string
  proposalUrl: string
  brandColor: string
}): string {
  const { agencyName, proposalName, businessName, signerName, signerEmail, selectedPackage, signedAt, proposalUrl, brandColor } = params
  const dateStr = new Date(signedAt).toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const ctaHtml = proposalUrl
    ? `<a href="${proposalUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;margin-top:8px;">צפה בהצעה</a>`
    : ''

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${brandColor};padding:28px 32px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">&#127881;</div>
            <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">הצעת מחיר נחתמה!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">הצעה חדשה נחתמה במערכת <strong>${agencyName}</strong>:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;">
              <tr><td style="padding:10px 14px;background:#f8fafc;font-weight:bold;border:1px solid #e2e8f0;color:#334155;font-size:13px;width:120px;">שם ההצעה</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-size:14px;">${proposalName}</td></tr>
              <tr><td style="padding:10px 14px;background:#f8fafc;font-weight:bold;border:1px solid #e2e8f0;color:#334155;font-size:13px;">עסק</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-size:14px;">${businessName}</td></tr>
              <tr><td style="padding:10px 14px;background:#f8fafc;font-weight:bold;border:1px solid #e2e8f0;color:#334155;font-size:13px;">חותם</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-size:14px;">${signerName} (${signerEmail})</td></tr>
              <tr><td style="padding:10px 14px;background:#f8fafc;font-weight:bold;border:1px solid #e2e8f0;color:#334155;font-size:13px;">חבילה</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-size:14px;font-weight:600;">${selectedPackage}</td></tr>
              <tr><td style="padding:10px 14px;background:#f8fafc;font-weight:bold;border:1px solid #e2e8f0;color:#334155;font-size:13px;">נחתם בתאריך</td><td style="padding:10px 14px;border:1px solid #e2e8f0;color:#1e293b;font-size:14px;">${dateStr}</td></tr>
            </table>
            ${ctaHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">${agencyName} — הודעה אוטומטית מ-AgencyManager Pro</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ── Email template: Client confirmation ───────────────────────
function buildClientConfirmationEmail(params: {
  agencyName: string
  proposalName: string
  signerName: string
  selectedPackage: string
  proposalUrl: string
  brandColor: string
  logoUrl?: string
}): string {
  const { agencyName, proposalName, signerName, selectedPackage, proposalUrl, brandColor, logoUrl } = params
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${agencyName}" style="max-height:48px;margin-bottom:12px;" />`
    : ''
  const ctaHtml = proposalUrl
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td align="center"><a href="${proposalUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">צפה בהצעה</a></td></tr></table>`
    : ''

  return `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${brandColor};padding:28px 32px;text-align:center;">
            ${logoHtml}
            <div style="font-size:28px;margin-bottom:4px;">&#10004;&#65039;</div>
            <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">ההצעה נחתמה בהצלחה</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="margin:0 0 12px;color:#1e293b;font-size:16px;font-weight:600;">שלום ${signerName},</p>
            <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.7;">תודה שבחרת ב-<strong>${agencyName}</strong>! ההצעה <strong>"${proposalName}"</strong> נחתמה בהצלחה.</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin:16px 0;">
              <tr><td style="padding:16px 20px;">
                <p style="margin:0;color:#166534;font-size:14px;"><span style="font-size:18px;">&#128230;</span> <strong>חבילה שנבחרה:</strong> ${selectedPackage}</p>
              </td></tr>
            </table>
            <p style="margin:16px 0 4px;color:#64748b;font-size:14px;">ניתן לצפות בהצעה בכל עת:</p>
            ${ctaHtml}
            <p style="margin:24px 0 0;color:#475569;font-size:14px;line-height:1.6;">ניצור איתך קשר בקרוב כדי להתחיל לעבוד יחד!</p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
            <p style="margin:0;color:#94a3b8;font-size:12px;">${agencyName} — הודעה אוטומטית</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { proposalId, action } = body

    if (!proposalId) {
      return new Response(
        JSON.stringify({ error: 'proposalId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create admin client to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)

    // Fetch the proposal to get tenant_id and details
    const { data: proposal, error: fetchError } = await adminClient
      .from('proposals')
      .select('*')
      .eq('id', proposalId)
      .single()

    if (fetchError || !proposal) {
      return new Response(
        JSON.stringify({ error: 'Proposal not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const proposalName = proposal.proposal_name || 'ללא שם'
    const businessName = proposal.proposal_data?.businessName || proposal.proposal_data?.business_name || 'לא ידוע'
    const tenantId = proposal.tenant_id

    // Get notification settings for this tenant (Telegram + Resend + brand)
    const getNotificationSettings = async () => {
      const { data: settings } = await adminClient
        .from('settings')
        .select('telegram_bot_token, telegram_chat_id, resend_api_key, notification_email, agency_name, owner_name, logo_storage_path, brand_primary_color')
        .eq('tenant_id', tenantId)
        .single()
      return settings
    }

    // ── Action: viewed ────────────────────────────────────────
    if (action === 'viewed') {
      // Only update if current status is 'sent' (don't downgrade from signed/rejected)
      if (proposal.status === 'sent') {
        const { error: updateError } = await adminClient
          .from('proposals')
          .update({ status: 'viewed', viewed_at: new Date().toISOString() })
          .eq('id', proposalId)

        if (updateError) {
          console.error('Failed to update proposal viewed status:', updateError)
          return new Response(
            JSON.stringify({ error: 'Failed to update proposal' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      return new Response(
        JSON.stringify({ success: true, action: 'viewed' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Action: rejected ──────────────────────────────────────
    if (action === 'rejected') {
      const { error: updateError } = await adminClient
        .from('proposals')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', proposalId)

      if (updateError) {
        console.error('Failed to update proposal rejected status:', updateError)
        return new Response(
          JSON.stringify({ error: 'Failed to update proposal' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Send Telegram notification
      const settings = await getNotificationSettings()
      if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
        const message = `❌ הצעה נדחתה: ${proposalName} — ${businessName}`
        await sendTelegramNotification(settings.telegram_bot_token, settings.telegram_chat_id, message)
      }

      return new Response(
        JSON.stringify({ success: true, action: 'rejected' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Default action: signature submission ──────────────────
    // Support both nested (body.signature.*) and flat (body.*) field formats
    const sig = body.signature || body
    const name = sig.name
    const idNumber = sig.idNumber
    const email = sig.email
    const signatureImage = sig.signatureImage
    const selectedPackage = sig.selectedPackage

    if (!name || !idNumber || !email || !signatureImage || !selectedPackage) {
      console.error('Missing fields. body keys:', Object.keys(body), 'sig keys:', Object.keys(sig))
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, idNumber, email, signatureImage, selectedPackage' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const signatureData = {
      name,
      idNumber,
      email,
      signatureImage,
      selectedPackage,
      signedAt: sig.signedAt || new Date().toISOString(),
    }

    const { error: updateError } = await adminClient
      .from('proposals')
      .update({
        signature_data: signatureData,
        status: 'signed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', proposalId)

    if (updateError) {
      console.error('Failed to save signature:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to save signature' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // ── Send notifications ────────────────────────────────────
    const settings = await getNotificationSettings()

    // Telegram notification
    if (settings?.telegram_bot_token && settings?.telegram_chat_id) {
      const message = `🎉 הצעה נחתמה!\n📋 ${proposalName}\n🏢 ${businessName}\n📦 חבילת ${selectedPackage}\n✍️ ${name} (${email})`
      await sendTelegramNotification(settings.telegram_bot_token, settings.telegram_chat_id, message)
    }

    // Email notifications via Resend
    if (settings?.resend_api_key) {
      const brandColor = settings.brand_primary_color || '#14b8a6'
      const agencyName = settings.agency_name || 'Alma Ads'
      const proposalUrl = proposal.public_url || ''

      // Resolve logo URL from storage path
      let logoUrl: string | undefined
      if (settings.logo_storage_path) {
        logoUrl = `${supabaseUrl}/storage/v1/object/public/logos/${settings.logo_storage_path}`
      }

      // 1. Email to agency owner
      if (settings.notification_email) {
        await sendResendEmail(
          settings.resend_api_key,
          settings.notification_email,
          `הצעה נחתמה: ${proposalName} — ${businessName}`,
          buildAgencyNotificationEmail({
            agencyName,
            proposalName,
            businessName,
            signerName: name,
            signerEmail: email,
            selectedPackage,
            signedAt: signatureData.signedAt,
            proposalUrl,
            brandColor,
          }),
          agencyName
        )
      }

      // 2. Email to the signing client
      if (email) {
        await sendResendEmail(
          settings.resend_api_key,
          email,
          `ההצעה שלך נחתמה בהצלחה — ${agencyName}`,
          buildClientConfirmationEmail({
            agencyName,
            proposalName,
            signerName: name,
            selectedPackage,
            proposalUrl,
            brandColor,
            logoUrl,
          }),
          agencyName
        )
      }
    }

    return new Response(
      JSON.stringify({ success: true, action: 'signed' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('Proposal webhook error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
