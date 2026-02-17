-- ============================================================
-- DIAGNOSTIC: Check RLS status on ALL tables
-- Run this in Supabase SQL Editor to see what's protected
-- ============================================================

-- 1. Check which tables have RLS ENABLED
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'clients', 'leads', 'deals', 'expenses', 'payments', 'settings',
    'activity_log', 'retainer_changes', 'client_notes', 'lead_notes',
    'call_transcripts', 'ai_recommendations', 'whatsapp_messages',
    'signals_personality', 'calendar_events', 'ideas', 'knowledge_articles',
    'user_roles', 'tenants', 'tenant_users'
  )
ORDER BY tablename;

-- 2. Check ALL active policies on ALL tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Test current_tenant_id() for current user
SELECT current_tenant_id() as my_tenant_id;

-- 4. Count rows per tenant in key tables (use service role or super admin)
SELECT 'clients' as tbl, tenant_id, count(*) FROM clients GROUP BY tenant_id
UNION ALL
SELECT 'leads', tenant_id, count(*) FROM leads GROUP BY tenant_id
UNION ALL
SELECT 'deals', tenant_id, count(*) FROM deals GROUP BY tenant_id
UNION ALL
SELECT 'expenses', tenant_id, count(*) FROM expenses GROUP BY tenant_id
UNION ALL
SELECT 'payments', tenant_id, count(*) FROM payments GROUP BY tenant_id;
