-- ============================================================
-- Freelancer Role Migration
-- Adds freelancer-scoped RLS policies
-- Run AFTER supabase-multi-tenant-migration.sql
-- ============================================================

-- 1. Helper function: check if current user is a freelancer
CREATE OR REPLACE FUNCTION is_freelancer()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'freelancer'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 2. Update clients SELECT — freelancers only see assigned clients
DROP POLICY IF EXISTS "clients_select" ON clients;
CREATE POLICY "clients_select" ON clients FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      NOT (SELECT is_freelancer())
      OR assigned_to = auth.uid()
    )
  );

-- 3. Update leads SELECT — freelancers only see assigned leads
DROP POLICY IF EXISTS "leads_select" ON leads;
CREATE POLICY "leads_select" ON leads FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      NOT (SELECT is_freelancer())
      OR assigned_to = auth.uid()
    )
  );

-- 4. Freelancers can update leads assigned to them
DROP POLICY IF EXISTS "leads_update" ON leads;
CREATE POLICY "leads_update" ON leads FOR UPDATE
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      (SELECT is_admin())
      OR created_by = auth.uid()
      OR assigned_to = auth.uid()
    )
  );

-- 5. Deals — freelancers see only deals of their assigned clients
DROP POLICY IF EXISTS "deals_select" ON deals;
CREATE POLICY "deals_select" ON deals FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      NOT (SELECT is_freelancer())
      OR client_id IN (SELECT client_id FROM clients WHERE assigned_to = auth.uid())
    )
  );

-- 6. Calendar events — freelancers see all events in their tenant
-- (no change needed, already tenant-scoped)

-- 7. Client notes — freelancers see notes of their assigned clients
DROP POLICY IF EXISTS "client_notes_select" ON client_notes;
CREATE POLICY "client_notes_select" ON client_notes FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      NOT (SELECT is_freelancer())
      OR client_id IN (SELECT client_id FROM clients WHERE assigned_to = auth.uid())
    )
  );

-- 8. Lead notes — freelancers see notes of their assigned leads
DROP POLICY IF EXISTS "lead_notes_select" ON lead_notes;
CREATE POLICY "lead_notes_select" ON lead_notes FOR SELECT
  TO authenticated
  USING (
    tenant_id = current_tenant_id()
    AND (
      NOT (SELECT is_freelancer())
      OR lead_id IN (SELECT lead_id FROM leads WHERE assigned_to = auth.uid())
    )
  );

-- NOTE: Expenses, payments, retainer_changes, settings stay admin/viewer only.
-- Freelancers don't have page access to those pages anyway.

-- ============================================================
-- DONE! Freelancer role can now see only assigned clients/leads.
-- ============================================================
