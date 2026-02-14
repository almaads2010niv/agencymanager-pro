import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (error) setError(error.message)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'white', padding: '0 16px' }}>
      <form onSubmit={onLogin} style={{ width: '100%', maxWidth: 360, background: '#1b1b1b', padding: 24, borderRadius: 12 }}>
        <div style={{ fontSize: 18, marginBottom: 16 }}>ברוך הבא</div>

        <label style={{ display: 'block', marginBottom: 6 }}>אימייל</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          required
          aria-label="אימייל"
          style={{ width: '100%', padding: 10, marginBottom: 12, boxSizing: 'border-box' }}
        />

        <label style={{ display: 'block', marginBottom: 6 }}>סיסמה</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
          aria-label="סיסמה"
          style={{ width: '100%', padding: 10, marginBottom: 12, boxSizing: 'border-box' }}
        />

        {error && <div style={{ color: 'salmon', marginBottom: 12 }} role="alert">{error}</div>}

        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: 12, background: '#e53935', color: 'white', border: 0, borderRadius: 8 }}
        >
          {loading ? 'מתחבר...' : 'התחבר'}
        </button>

        <div style={{ fontSize: 12, opacity: 0.8, marginTop: 12 }}>
          אם שכחת סיסמה: השתמש באפשרות שחזור סיסמה בלוח הניהול של Supabase
        </div>
      </form>
    </div>
  )
}
