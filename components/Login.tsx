import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type Mode = 'login' | 'forgot';

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('login')

  const switchMode = (newMode: Mode) => {
    setMode(newMode)
    setError(null)
    setSuccess(null)
    setPassword('')
  }

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)
    if (error) {
      if (error.message === 'Invalid login credentials') setError('אימייל או סיסמה שגויים')
      else if (error.message === 'Email not confirmed') setError('יש לאשר את האימייל לפני התחברות. בדוק את תיבת הדואר.')
      else setError(error.message)
    }
  }

  const onForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!email.trim()) {
      setError('יש להזין אימייל')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    })

    setLoading(false)
    if (error) setError(error.message)
    else setSuccess('קישור לאיפוס סיסמה נשלח לאימייל שלך.')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'white', padding: '0 16px', background: '#0B1121' }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.5px' }}>AgencyManager</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>ניהול סוכנות דיגיטלית</div>
        </div>

        <form
          onSubmit={mode === 'login' ? onLogin : onForgotPassword}
          style={{
            background: '#151C2C',
            padding: 28,
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>
            {mode === 'login' ? 'התחברות' : 'שחזור סיסמה'}
          </div>

          {/* Email */}
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>אימייל</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            required
            aria-label="אימייל"
            style={{
              width: '100%', padding: 11, marginBottom: 14, boxSizing: 'border-box',
              background: '#0B1121', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
              color: 'white', fontSize: 14, outline: 'none',
            }}
          />

          {/* Password - only in login mode */}
          {mode === 'login' && (
            <>
              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#aaa' }}>סיסמה</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
                aria-label="סיסמה"
                style={{
                  width: '100%', padding: 11, marginBottom: 14, boxSizing: 'border-box',
                  background: '#0B1121', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                  color: 'white', fontSize: 14, outline: 'none',
                }}
              />
            </>
          )}

          {/* Error / Success */}
          {error && <div style={{ color: '#f87171', marginBottom: 12, fontSize: 13, padding: '8px 12px', background: 'rgba(248,113,113,0.08)', borderRadius: 8 }} role="alert">{error}</div>}
          {success && <div style={{ color: '#4ade80', marginBottom: 12, fontSize: 13, padding: '8px 12px', background: 'rgba(74,222,128,0.08)', borderRadius: 8 }} role="status">{success}</div>}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: 13, background: '#e53935',
              color: 'white', border: 0, borderRadius: 10, fontWeight: 700, fontSize: 15,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            {loading ? '...' : mode === 'login' ? 'התחבר' : 'שלח קישור איפוס'}
          </button>

          {/* Mode Switchers */}
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            {mode === 'login' && (
              <button type="button" onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: '#666', fontSize: 12, cursor: 'pointer' }}>
                שכחתי סיסמה
              </button>
            )}
            {mode === 'forgot' && (
              <button type="button" onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer' }}>
                חזור להתחברות
              </button>
            )}
          </div>

          {/* Info for new users */}
          {mode === 'login' && (
            <div style={{ marginTop: 16, fontSize: 11, color: '#555', textAlign: 'center', lineHeight: 1.6 }}>
              פרילנסר חדש? קבל פרטי התחברות מהמנהל שלך
            </div>
          )}
        </form>
      </div>
    </div>
  )
}
