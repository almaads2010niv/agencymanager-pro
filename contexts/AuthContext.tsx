import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'viewer' | 'freelancer';

// All available page permission keys
export type PagePermission =
  | 'dashboard'
  | 'clients'
  | 'leads'
  | 'deals'
  | 'expenses'
  | 'debts'
  | 'profit_loss'
  | 'tax_calculator'
  | 'calendar'
  | 'ideas'
  | 'knowledge'
  | 'settings';

export const ALL_PAGES: { key: PagePermission; label: string; path: string }[] = [
  { key: 'dashboard', label: '\u05D3\u05E9\u05D1\u05D5\u05E8\u05D3', path: '/' },
  { key: 'clients', label: '\u05DC\u05E7\u05D5\u05D7\u05D5\u05EA', path: '/clients' },
  { key: 'leads', label: '\u05DC\u05D9\u05D3\u05D9\u05DD', path: '/leads' },
  { key: 'deals', label: '\u05E4\u05E8\u05D5\u05D9\u05E7\u05D8\u05D9\u05DD', path: '/deals' },
  { key: 'expenses', label: '\u05D4\u05D5\u05E6\u05D0\u05D5\u05EA', path: '/expenses' },
  { key: 'debts', label: '\u05D7\u05D5\u05D1\u05D5\u05EA \u05DC\u05E7\u05D5\u05D7\u05D5\u05EA', path: '/debts' },
  { key: 'profit_loss', label: '\u05D3\u05D5\u05D7 \u05E8\u05D5\u05D5\u05D7 \u05D5\u05D4\u05E4\u05E1\u05D3', path: '/profit-loss' },
  { key: 'tax_calculator', label: '\u05DE\u05D7\u05E9\u05D1\u05D5\u05DF \u05DE\u05E1', path: '/tax-calculator' },
  { key: 'calendar', label: '\u05DC\u05D5\u05D7 \u05E9\u05E0\u05D4', path: '/calendar' },
  { key: 'ideas', label: '\u05E8\u05E2\u05D9\u05D5\u05E0\u05D5\u05EA', path: '/ideas' },
  { key: 'knowledge', label: '\u05DE\u05D0\u05D2\u05E8 \u05D9\u05D3\u05E2', path: '/knowledge' },
  { key: 'settings', label: '\u05D4\u05D2\u05D3\u05E8\u05D5\u05EA', path: '/settings' },
];

// Default permissions for viewer - just dashboard and leads
export const DEFAULT_VIEWER_PERMISSIONS: PagePermission[] = ['dashboard', 'leads'];

// Default permissions for freelancer - dashboard + assigned clients/leads/deals + calendar
export const DEFAULT_FREELANCER_PERMISSIONS: PagePermission[] = ['dashboard', 'clients', 'leads', 'deals', 'calendar'];

interface UserRoleRecord {
  id: string;
  user_id: string;
  email?: string;
  role: UserRole;
  display_name: string;
  created_at: string;
  page_permissions?: string; // JSON array of PagePermission keys
  tenant_id?: string;
  is_super_admin?: boolean;
}

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isViewer: boolean;
  isFreelancer: boolean;
  isSuperAdmin: boolean;
  tenantId: string | null;
  tenantName: string;
  displayName: string;
  allUsers: UserRoleRecord[];
  isRoleLoaded: boolean;
  pagePermissions: PagePermission[];
  hasPageAccess: (page: PagePermission) => boolean;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  addUser: (email: string, displayName: string, password: string, role: UserRole) => Promise<string | null>;
  removeUser: (userId: string) => Promise<string | null>;
  updateUserRole: (userId: string, newRole: UserRole) => Promise<string | null>;
  updateUserPermissions: (userId: string, permissions: PagePermission[]) => Promise<string | null>;
  updateUserDisplayName: (userId: string, newName: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Safe JSON parse helper for page_permissions
function safeParsePermissions(raw: string | undefined | null, fallback: PagePermission[]): PagePermission[] {
  if (!raw) return fallback;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed as PagePermission[];
    return fallback;
  } catch {
    return fallback;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('admin');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState('');
  const [allUsers, setAllUsers] = useState<UserRoleRecord[]>([]);
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);
  const [pagePermissions, setPagePermissions] = useState<PagePermission[]>(ALL_PAGES.map(p => p.key));

  // Load role for current user
  const loadRole = useCallback(async (currentUser: User) => {
    try {
      // 1. First try matching by user_id
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      if (data && !error) {
        // Found by user_id -- update email if not set
        if (!data.email && currentUser.email) {
          await supabase.from('user_roles').update({ email: currentUser.email }).eq('user_id', currentUser.id);
        }
        const userRole = data.role as UserRole;
        setRole(userRole);
        setIsSuperAdmin(!!data.is_super_admin);
        setDisplayName(data.display_name || currentUser.email?.split('@')[0] || '');
        setTenantId(data.tenant_id || null);

        // Load tenant name
        if (data.tenant_id) {
          const { data: tenant } = await supabase.from('tenants').select('name').eq('id', data.tenant_id).single();
          if (tenant) setTenantName(tenant.name);
        }

        // Parse page permissions
        const defaultPerms = userRole === 'admin' ? ALL_PAGES.map(p => p.key)
          : userRole === 'freelancer' ? DEFAULT_FREELANCER_PERMISSIONS
          : DEFAULT_VIEWER_PERMISSIONS;
        const perms = safeParsePermissions(data.page_permissions, defaultPerms);
        setPagePermissions(perms);
        return;
      }

      // 2. No match by user_id -- try matching by email (for pre-created viewer roles)
      if (currentUser.email) {
        const { data: emailMatch, error: emailError } = await supabase
          .from('user_roles')
          .select('*')
          .eq('email', currentUser.email)
          .single();

        if (emailMatch && !emailError) {
          // Found by email -- update user_id to the real auth id
          await supabase.from('user_roles')
            .update({ user_id: currentUser.id })
            .eq('email', currentUser.email);
          const userRole = emailMatch.role as UserRole;
          setRole(userRole);
          setIsSuperAdmin(!!emailMatch.is_super_admin);
          setDisplayName(emailMatch.display_name || currentUser.email.split('@')[0] || '');
          setTenantId(emailMatch.tenant_id || null);

          if (emailMatch.tenant_id) {
            const { data: tenant } = await supabase.from('tenants').select('name').eq('id', emailMatch.tenant_id).single();
            if (tenant) setTenantName(tenant.name);
          }

          const defaultPerms = userRole === 'admin' ? ALL_PAGES.map(p => p.key)
            : userRole === 'freelancer' ? DEFAULT_FREELANCER_PERMISSIONS
            : DEFAULT_VIEWER_PERMISSIONS;
          const perms = safeParsePermissions(emailMatch.page_permissions, defaultPerms);
          setPagePermissions(perms);
          return;
        }
      }

      // 3. No role found at all -- check if ANY roles exist
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true });

      // First user ever = admin; otherwise default to viewer (least privilege)
      const isFirstUser = count === 0 || count === null;
      const defaultRole: UserRole = isFirstUser ? 'admin' : 'viewer';
      const name = currentUser.email?.split('@')[0] || 'User';
      const defaultPerms = defaultRole === 'admin' ? ALL_PAGES.map(p => p.key) : DEFAULT_VIEWER_PERMISSIONS;

      await supabase
        .from('user_roles')
        .insert({
          user_id: currentUser.id,
          email: currentUser.email || null,
          role: defaultRole,
          display_name: name,
          page_permissions: JSON.stringify(defaultPerms),
          tenant_id: '00000000-0000-0000-0000-000000000001',
        });

      setRole(defaultRole);
      setDisplayName(name);
      setPagePermissions(defaultPerms);
    } catch {
      // Graceful fallback to viewer if table doesn't exist (least privilege)
      setRole('viewer');
      setDisplayName(currentUser.email?.split('@')[0] || 'User');
      setPagePermissions(DEFAULT_VIEWER_PERMISSIONS);
    } finally {
      setIsRoleLoaded(true);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        await loadRole(session.user);
      } else {
        setIsRoleLoaded(true);
      }
    };
    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user || null;
      setUser(newUser);
      if (newUser) {
        loadRole(newUser);
      } else {
        setRole('viewer');
        setDisplayName('');
        setPagePermissions(DEFAULT_VIEWER_PERMISSIONS);
        setIsRoleLoaded(true);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [loadRole]);

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setRole('viewer');
    setDisplayName('');
    setPagePermissions(DEFAULT_VIEWER_PERMISSIONS);
  };

  const refreshUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        setAllUsers(data as UserRoleRecord[]);
      }
    } catch {
      // Table might not exist
    }
  }, []);

  // Load all users on mount for admin
  useEffect(() => {
    if (role === 'admin' && isRoleLoaded) {
      refreshUsers();
    }
  }, [role, isRoleLoaded, refreshUsers]);

  const hasPageAccess = useCallback((page: PagePermission): boolean => {
    if (role === 'admin') return true;
    return pagePermissions.includes(page);
  }, [role, pagePermissions]);

  const addUser = async (email: string, newUserDisplayName: string, password: string, newUserRole: UserRole = 'viewer'): Promise<string | null> => {
    try {
      // Check for duplicate email first
      const trimmedEmail = email.toLowerCase().trim();
      const existingUser = allUsers.find(u => u.email === trimmedEmail);
      if (existingUser) return 'משתמש עם אימייל זה כבר קיים במערכת';

      if (!password || password.length < 6) {
        return 'סיסמה חייבת להכיל לפחות 6 תווים';
      }

      // Call Edge Function to create the Auth user + user_roles entry
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email: trimmedEmail,
          password,
          displayName: newUserDisplayName,
          role: newUserRole,
          tenantId,
        },
      });

      if (error) {
        return 'שגיאה בחיבור לשרת: ' + error.message;
      }

      // Edge Function returns { success, userId, email } or { error }
      if (data?.error) {
        if (data.error === 'email_exists') return 'משתמש עם אימייל זה כבר רשום ב-Supabase Auth';
        if (data.error === 'Only admins can create users') return 'רק מנהלים יכולים ליצור משתמשים';
        return 'שגיאה: ' + data.error;
      }

      await refreshUsers();
      return null;
    } catch (err) {
      return 'שגיאה בהוספת משתמש. ודא שה-Edge Function פעיל.';
    }
  };

  const removeUser = async (userId: string): Promise<string | null> => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        if (error.code === '42501') return 'אין הרשאה למחוק משתמשים. בדוק את ה-RLS policies ב-Supabase.';
        return 'שגיאה במחיקה: ' + error.message;
      }

      // Optimistic local update + refresh from DB
      setAllUsers(prev => prev.filter(u => u.user_id !== userId));
      await refreshUsers();
      return null;
    } catch {
      return 'שגיאה במחיקת משתמש';
    }
  };

  const updateUserRole = async (userId: string, newRole: UserRole): Promise<string | null> => {
    try {
      const perms = newRole === 'admin' ? ALL_PAGES.map(p => p.key)
        : newRole === 'freelancer' ? DEFAULT_FREELANCER_PERMISSIONS
        : DEFAULT_VIEWER_PERMISSIONS;
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole, page_permissions: JSON.stringify(perms) })
        .eq('user_id', userId);

      if (error) {
        if (error.code === '42501') return 'אין הרשאה לשנות תפקידים. בדוק את ה-RLS policies ב-Supabase.';
        return 'שגיאה בעדכון תפקיד: ' + error.message;
      }

      // If updating own user, update local state
      if (user && userId === user.id) {
        setRole(newRole);
        setPagePermissions(perms);
      }
      await refreshUsers();
      return null;
    } catch {
      return 'שגיאה בעדכון תפקיד';
    }
  };

  const updateUserPermissions = async (userId: string, permissions: PagePermission[]): Promise<string | null> => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ page_permissions: JSON.stringify(permissions) })
        .eq('user_id', userId);

      if (error) {
        if (error.code === '42501') return 'אין הרשאה לשנות הרשאות. בדוק את ה-RLS policies ב-Supabase.';
        return 'שגיאה בעדכון הרשאות: ' + error.message;
      }

      // If updating own user, update local state
      if (user && userId === user.id) {
        setPagePermissions(permissions);
      }
      await refreshUsers();
      return null;
    } catch {
      return 'שגיאה בעדכון הרשאות';
    }
  };

  const updateUserDisplayName = async (userId: string, newName: string): Promise<string | null> => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ display_name: newName })
        .eq('user_id', userId);

      if (error) {
        if (error.code === '42501') return 'אין הרשאה לשנות שם. בדוק את ה-RLS policies ב-Supabase.';
        return 'שגיאה בעדכון שם: ' + error.message;
      }

      if (user && userId === user.id) {
        setDisplayName(newName);
      }
      await refreshUsers();
      return null;
    } catch {
      return 'שגיאה בעדכון שם';
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAdmin: role === 'admin',
      isViewer: role === 'viewer',
      isFreelancer: role === 'freelancer',
      isSuperAdmin,
      tenantId,
      tenantName,
      displayName,
      allUsers,
      isRoleLoaded,
      pagePermissions,
      hasPageAccess,
      logout,
      refreshUsers,
      addUser,
      removeUser,
      updateUserRole,
      updateUserPermissions,
      updateUserDisplayName,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
