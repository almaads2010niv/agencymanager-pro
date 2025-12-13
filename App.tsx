import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import type { Session } from '@supabase/supabase-js'
import Login from './components/Login'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // בדיקה ראשונית
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('🔍 Initial session:', session)
      setSession(session)
      setLoading(false)
    })

    // האזנה לשינויים ב-auth - זה החלק החשוב!
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('🔔 Auth changed:', _event, session)
      setSession(session)
    })

    // ניקוי
    return () => subscription.unsubscribe()
  }, [])

  // מסך טעינה
  if (loading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#1a1a1a',
        color: 'white',
        fontSize: '24px'
      }}>
        טוען...
      </div>
    )
  }

  // אם אין session - הצג התחברות
  if (!session) {
    return <Login />
  }

  // יש session - הצג את האפליקציה
  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '40px',
      background: '#1a1a1a',
      color: 'white',
      direction: 'rtl'
    }}>
      <div style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        background: '#2a2a2a',
        padding: '30px',
        borderRadius: '10px'
      }}>
        <h1 style={{ marginBottom: '20px' }}>🎉 ברוך הבא למערכת!</h1>
        <p style={{ fontSize: '18px', marginBottom: '30px' }}>
          אימייל: <strong>{session.user.email}</strong>
        </p>
        <button 
          onClick={() => {
            console.log('🚪 מתנתק...')
            supabase.auth.signOut()
          }}
          style={{
            padding: '12px 30px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          התנתק
        </button>
      </div>
    </div>
  )
}