import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).send('Missing proposal ID');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).send('Server configuration error');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data, error } = await supabase
    .from('proposals')
    .select('html_content')
    .eq('id', id)
    .single();

  if (error || !data?.html_content) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
        <head><meta charset="UTF-8"><title>לא נמצא</title></head>
        <body style="display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;background:#1a1a2e;color:#fff;">
          <div style="text-align:center;">
            <h1 style="font-size:3rem;margin-bottom:1rem;">404</h1>
            <p style="font-size:1.2rem;color:#aaa;">ההצעה לא נמצאה או שפג תוקפה</p>
          </div>
        </body>
      </html>
    `);
  }

  res.setHeader('Content-Type', 'text/html; charset=UTF-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400');
  return res.status(200).send(data.html_content);
}
