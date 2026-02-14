import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { DataProvider } from './contexts/DataContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { supabase } from './lib/supabaseClient'

import Layout from './components/Layout'
import Dashboard from './components/Dashboard'
import Clients from './components/Clients'
import Leads from './components/Leads'
import Deals from './components/Deals'
import Expenses from './components/Expenses'
import Debts from './components/Debts'
import Settings from './components/Settings'
import TaxCalculator from './components/TaxCalculator'
import ClientProfile from './components/ClientProfile'
import ProfitLoss from './components/ProfitLoss'
import Login from './components/Login'

// Inner component that waits for role to load before rendering
function AppContent() {
  const { isRoleLoaded } = useAuth()

  if (!isRoleLoaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'white', background: '#0B1121' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
          <div>טוען...</div>
        </div>
      </div>
    )
  }

  return (
    <DataProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/clients/:clientId" element={<ClientProfile />} />
            <Route path="/leads" element={<Leads />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/expenses" element={<Expenses />} />
            <Route path="/debts" element={<Debts />} />
            <Route path="/tax-calculator" element={<TaxCalculator />} />
            <Route path="/profit-loss" element={<ProfitLoss />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Layout>
      </Router>
    </DataProvider>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'white', background: '#0B1121' }}>
        טוען...
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
