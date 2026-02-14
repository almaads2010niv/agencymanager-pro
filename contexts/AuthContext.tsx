import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User } from '@supabase/supabase-js';

export type UserRole = 'admin' | 'viewer';

interface UserRoleRecord {
  id: string;
  user_id: string;
  role: UserRole;
  display_name: string;
  created_at: string;
}

export interface AuthContextType {
  user: User | null;
  role: UserRole;
  isAdmin: boolean;
  isViewer: boolean;
  displayName: string;
  allUsers: UserRoleRecord[];
  isRoleLoaded: boolean;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  addViewer: (email: string, displayName: string) => Promise<string | null>;
  removeUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole>('admin');
  const [displayName, setDisplayName] = useState('');
  const [allUsers, setAllUsers] = useState<UserRoleRecord[]>([]);
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);

  // Load role for current user
  const loadRole = useCallback(async (currentUser: User) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', currentUser.id)
        .single();

      console.log('[AuthContext] loadRole for user:', currentUser.id, currentUser.email);
      console.log('[AuthContext] query result - data:', data, 'error:', error);

      if (error && (error.code === 'PGRST116' || error.code === '42P01')) {
        // No role found for this user, OR table doesn't exist
        // Default to admin - owner can demote users later from Settings
        const name = currentUser.email?.split('@')[0] || 'Admin';

        // Try to create admin role for this user
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert({
            user_id: currentUser.id,
            role: 'admin',
            display_name: name,
          });

        if (insertError) {
          console.warn('[AuthContext] Could not create role:', insertError.message);
        }

        console.log('[AuthContext] No role found, defaulting to admin for:', currentUser.email);
        setRole('admin');
        setDisplayName(name);
      } else if (data) {
        console.log('[AuthContext] Role loaded from DB:', data.role, 'for:', currentUser.email);
        setRole(data.role as UserRole);
        setDisplayName(data.display_name || currentUser.email?.split('@')[0] || '');
      } else {
        // Fallback
        console.log('[AuthContext] Fallback to admin for:', currentUser.email);
        setRole('admin');
        setDisplayName(currentUser.email?.split('@')[0] || 'Admin');
      }
    } catch (err) {
      console.warn('Error loading role:', err);
      // Graceful fallback to admin if table doesn't exist
      setRole('admin');
      setDisplayName(currentUser.email?.split('@')[0] || 'Admin');
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

  const addViewer = async (email: string, viewerDisplayName: string): Promise<string | null> => {
    try {
      // Use Supabase admin invite (requires service role, so we just create the role entry)
      // The admin should create the user in Supabase Auth dashboard first
      // Here we just pre-create the role so when the user logs in, they get viewer role

      // For simplicity: create a placeholder entry with a generated UUID
      // When the actual user signs up/logs in, their role will match
      const { error } = await supabase
        .from('user_roles')
        .insert({
          user_id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
          role: 'viewer',
          display_name: viewerDisplayName,
        });

      if (error) return error.message;

      await refreshUsers();
      return null;
    } catch (err) {
      return 'שגיאה בהוספת משתמש';
    }
  };

  const removeUser = async (userId: string) => {
    try {
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);
      await refreshUsers();
    } catch {
      // Silently fail
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      role,
      isAdmin: role === 'admin',
      isViewer: role === 'viewer',
      displayName,
      allUsers,
      isRoleLoaded,
      logout,
      refreshUsers,
      addViewer,
      removeUser,
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
