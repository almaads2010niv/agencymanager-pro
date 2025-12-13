import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')
  
    console.log('🔑 מנסה להתחבר עם:', email)
  
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
  
    console.log('📊 תוצאה:', { data, error })
  
    if (error) {
      console.error('❌ שגיאה:', error)
      setMessage('שגיאה: ' + error.message)
    } else {
      console.log('✅ הצלחה! Session:', data.session)
      setMessage('התחברת בהצלחה!')
    }
  
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#1a1a1a'
    }}>
      <div style={{
        background: '#2a2a2a',
        padding: '40px',
        borderRadius: '10px',
        width: '100%',
        maxWidth: '400px',
        direction: 'rtl'
      }}>
        <h1 style={{ color: 'white', marginBottom: '30px', textAlign: 'center' }}>
          התחברות למערכת
        </h1>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'white', display: 'block', marginBottom: '5px' }}>
              אימייל
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #444',
                background: '#1a1a1a',
                color: 'white'
              }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: 'white', display: 'block', marginBottom: '5px' }}>
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '5px',
                border: '1px solid #444',
                background: '#1a1a1a',
                color: 'white'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#555' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '16px'
            }}
          >
            {loading ? 'מתחבר...' : 'התחבר'}
          </button>

          {message && (
            <p style={{
              marginTop: '20px',
              color: message.includes('שגיאה') ? '#ef4444' : '#10b981',
              textAlign: 'center'
            }}>
              {message}
            </p>
          )}
        </form>
      </div>
    </div>
  )
}