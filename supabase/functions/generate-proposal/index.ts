// Supabase Edge Function: generate-proposal
// Generates a price proposal PDF via Canva Connect API
// Deploy: npx supabase functions deploy generate-proposal --project-ref rxckkozbkrabpjdgyxqm

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

    // 2. Get Canva API key from settings (via service role)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey)
    const { data: settings } = await adminClient
      .from('settings')
      .select('canva_api_key, canva_template_id')
      .single()

    if (!settings?.canva_api_key || !settings?.canva_template_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Canva API key or template ID not configured. Set them in Settings.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const canvaApiKey = settings.canva_api_key
    const templateId = settings.canva_template_id

    // 3. Parse request body (lead data for autofill)
    const { leadName, businessName, quotedMonthlyValue, services, phone, email } = await req.json()

    // 4. Create design from brand template with autofill
    const autofillData: Record<string, unknown>[] = []

    if (businessName) autofillData.push({ type: 'text', key: 'business_name', value: businessName })
    if (leadName) autofillData.push({ type: 'text', key: 'client_name', value: leadName })
    if (quotedMonthlyValue) autofillData.push({ type: 'text', key: 'price', value: `₪${quotedMonthlyValue}` })
    if (services) autofillData.push({ type: 'text', key: 'services', value: services })
    if (phone) autofillData.push({ type: 'text', key: 'phone', value: phone })
    if (email) autofillData.push({ type: 'text', key: 'email', value: email })
    autofillData.push({ type: 'text', key: 'date', value: new Date().toLocaleDateString('he-IL') })

    // Step A: Create autofill job
    const createRes = await fetch(`https://api.canva.com/rest/v1/autofills`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${canvaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_template_id: templateId,
        data: Object.fromEntries(autofillData.map(d => [d.key, d])),
      }),
    })

    if (!createRes.ok) {
      const errText = await createRes.text()
      return new Response(JSON.stringify({
        success: false,
        error: `Canva autofill failed (${createRes.status}): ${errText}`,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const autofillResult = await createRes.json()
    const jobId = autofillResult.job?.id

    if (!jobId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Canva autofill did not return a job ID',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step B: Poll for completion (up to 30 seconds)
    let designId: string | null = null
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000))
      const pollRes = await fetch(`https://api.canva.com/rest/v1/autofills/${jobId}`, {
        headers: { 'Authorization': `Bearer ${canvaApiKey}` },
      })
      const pollData = await pollRes.json()

      if (pollData.job?.status === 'success') {
        designId = pollData.job.result?.design?.id
        break
      } else if (pollData.job?.status === 'failed') {
        return new Response(JSON.stringify({
          success: false,
          error: 'Canva autofill job failed',
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    if (!designId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Canva autofill timed out',
      }), {
        status: 504,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step C: Export design to PDF
    const exportRes = await fetch(`https://api.canva.com/rest/v1/designs/${designId}/exports`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${canvaApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ format: { type: 'pdf' } }),
    })

    if (!exportRes.ok) {
      // If PDF export fails, return the Canva design URL instead
      return new Response(JSON.stringify({
        success: true,
        designUrl: `https://www.canva.com/design/${designId}`,
        pdfUrl: null,
        message: 'Design created - PDF export not available. Open design in Canva.',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const exportResult = await exportRes.json()
    const exportJobId = exportResult.job?.id

    // Step D: Poll for PDF export completion
    let pdfUrl: string | null = null
    if (exportJobId) {
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const pollRes = await fetch(`https://api.canva.com/rest/v1/designs/${designId}/exports/${exportJobId}`, {
          headers: { 'Authorization': `Bearer ${canvaApiKey}` },
        })
        const pollData = await pollRes.json()

        if (pollData.job?.status === 'success') {
          pdfUrl = pollData.job.result?.url || null
          break
        } else if (pollData.job?.status === 'failed') {
          break
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      designUrl: `https://www.canva.com/design/${designId}`,
      pdfUrl,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
