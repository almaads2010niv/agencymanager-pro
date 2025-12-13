import { createClient } from '@supabase/supabase-js'

// 🔍 בדיקה - אתה תראה את זה בקונסול
console.log('=== DEBUG START ===')
console.log('URL:', import.meta.env.VITE_SUPABASE_URL)
console.log('Has Key:', !!import.meta.env.VITE_SUPABASE_ANON_KEY)
console.log('=== DEBUG END ===')

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ MISSING ENV!')
  console.error('URL:', supabaseUrl)
  console.error('Key:', supabaseAnonKey ? 'EXISTS' : 'MISSING')
  throw new Error('Missing Supabase environment variables')
}

console.log('✅ Supabase client created!')

export const supabase = createClient(supabaseUrl, supabaseAnonKey)