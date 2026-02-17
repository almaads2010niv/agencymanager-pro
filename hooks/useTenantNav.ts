import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * Hook שעוטף useNavigate ומוסיף prefix של tenant slug אוטומטית.
 *
 * Usage:
 *   const { tn, tPath } = useTenantNav();
 *   tn('/clients')           // navigates to /a/{slug}/clients
 *   tPath('/clients')        // returns string "/a/{slug}/clients"
 *   tn(`/clients/${id}`)     // navigates to /a/{slug}/clients/{id}
 */
export function useTenantNav() {
  const navigate = useNavigate();
  const { tenantSlug } = useAuth();

  const prefix = tenantSlug ? `/a/${tenantSlug}` : '';

  const tPath = useCallback((path: string): string => {
    if (path === '/') return `${prefix}/`;
    return `${prefix}${path}`;
  }, [prefix]);

  const tn = useCallback((path: string) => {
    navigate(tPath(path));
  }, [navigate, tPath]);

  return { tn, tPath, navigate };
}
