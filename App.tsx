import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom'
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
import LeadProfile from './components/LeadProfile'
import ProfitLoss from './components/ProfitLoss'
import CalendarPage from './components/Calendar'
import Ideas from './components/Ideas'
import KnowledgeBase from './components/KnowledgeBase'
import TenantManagement from './components/TenantManagement'
import Login from './components/Login'

const LoadingScreen = () => (
  <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'white', background: '#0B1121' }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⏳</div>
      <div>טוען...</div>
    </div>
  </div>
)

// Guard: validates URL slug matches user's tenant
function TenantRouteGuard() {
  const { tenantSlug, isRoleLoaded } = useAuth()
  const { tenantSlug: urlSlug } = useParams()

  if (!isRoleLoaded) return <LoadingScreen />

  // If URL slug doesn't match user's tenant, redirect to correct slug
  if (tenantSlug && urlSlug !== tenantSlug) {
    return <Navigate to={`/a/${tenantSlug}/`} replace />
  }

  return (
    <Layout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="clients" element={<Clients />} />
        <Route path="clients/:clientId" element={<ClientProfile />} />
        <Route path="leads" element={<Leads />} />
        <Route path="leads/:leadId" element={<LeadProfile />} />
        <Route path="deals" element={<Deals />} />
        <Route path="expenses" element={<Expenses />} />
        <Route path="debts" element={<Debts />} />
        <Route path="tax-calculator" element={<TaxCalculator />} />
        <Route path="profit-loss" element={<ProfitLoss />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="ideas" element={<Ideas />} />
        <Route path="knowledge" element={<KnowledgeBase />} />
        <Route path="settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}

// Inner component that waits for role to load before rendering
function AppContent() {
  const { isRoleLoaded, tenantSlug, isSuperAdmin } = useAuth()

  if (!isRoleLoaded) return <LoadingScreen />

  return (
    <DataProvider>
      <Routes>
        {/* System routes — no slug prefix */}
        <Route path="/tenants" element={
          isSuperAdmin ? <Layout><TenantManagement /></Layout> : <Navigate to={tenantSlug ? `/a/${tenantSlug}/` : '/'} replace />
        } />

        {/* Tenant routes — under /a/:tenantSlug */}
        <Route path="/a/:tenantSlug/*" element={<TenantRouteGuard />} />

        {/* Root redirect to tenant-scoped dashboard */}
        <Route path="/" element={
          tenantSlug ? <Navigate to={`/a/${tenantSlug}/`} replace /> : <LoadingScreen />
        } />

        {/* Catch-all: redirect to tenant dashboard */}
        <Route path="*" element={
          tenantSlug ? <Navigate to={`/a/${tenantSlug}/`} replace /> : <LoadingScreen />
        } />
      </Routes>
    </DataProvider>
  )
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Handle old hash-based URLs (backward compatibility)
  useEffect(() => {
    if (window.location.hash.startsWith('#/')) {
      const path = window.location.hash.slice(1) // e.g. "/clients"
      window.history.replaceState(null, '', path)
    }
  }, [])

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
    return (
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </Router>
    )
  }

  return (
    <Router>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </Router>
  )
}

export default App
