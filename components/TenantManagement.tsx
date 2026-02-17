import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, Plus, Trash2, ChevronDown, ChevronLeft, Shield, Eye, Wrench, UserPlus, Edit3, Calendar } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Form';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { TenantWithUsers, TenantUser } from '../types';

const TenantManagement: React.FC = () => {
  const { isSuperAdmin, user } = useAuth();

  // State
  const [tenants, setTenants] = useState<TenantWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);

  // Modals
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddUserForTenant, setShowAddUserForTenant] = useState<string | null>(null);
  const [editingTenant, setEditingTenant] = useState<TenantWithUsers | null>(null);
  const [confirmDeleteUserId, setConfirmDeleteUserId] = useState<{ userId: string; name: string; tenantId: string } | null>(null);

  // New Tenant form
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantSlug, setNewTenantSlug] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // New User form
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('admin');

  // Edit Tenant form
  const [editTenantName, setEditTenantName] = useState('');

  // ── API Helper ────────────────────────────────────────────
  const callManageTenants = useCallback(async (action: string, params: Record<string, unknown> = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('No session');

    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-tenants`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ action, ...params }),
    });

    const result = await res.json();
    if (!res.ok || result.error) throw new Error(result.error || 'Request failed');
    return result;
  }, []);

  // ── Load Tenants ──────────────────────────────────────────
  const loadTenants = useCallback(async () => {
    try {
      setLoading(true);
      const result = await callManageTenants('list-tenants');
      setTenants(result.tenants || []);
    } catch (err) {
      console.error('Failed to load tenants:', err);
    } finally {
      setLoading(false);
    }
  }, [callManageTenants]);

  useEffect(() => {
    if (isSuperAdmin) loadTenants();
  }, [isSuperAdmin, loadTenants]);

  // ── Load Tenant Users ─────────────────────────────────────
  const loadTenantUsers = useCallback(async (tenantId: string) => {
    try {
      setLoadingUsers(tenantId);
      const result = await callManageTenants('get-tenant-users', { tenantId });
      setTenantUsers(prev => ({ ...prev, [tenantId]: result.users || [] }));
    } catch (err) {
      console.error('Failed to load tenant users:', err);
    } finally {
      setLoadingUsers(null);
    }
  }, [callManageTenants]);

  // ── Toggle Expand ─────────────────────────────────────────
  const toggleExpand = (tenantId: string) => {
    if (expandedTenantId === tenantId) {
      setExpandedTenantId(null);
    } else {
      setExpandedTenantId(tenantId);
      if (!tenantUsers[tenantId]) {
        loadTenantUsers(tenantId);
      }
    }
  };

  // ── Create Tenant ─────────────────────────────────────────
  const handleCreateTenant = async () => {
    if (!newTenantName.trim()) { setFormError('נא להזין שם סוכנות'); return; }
    setFormLoading(true);
    setFormError('');
    try {
      await callManageTenants('create-tenant', {
        name: newTenantName.trim(),
        slug: newTenantSlug.trim() || undefined,
      });
      setShowAddTenant(false);
      setNewTenantName('');
      setNewTenantSlug('');
      await loadTenants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFormError(msg === 'slug_exists' ? 'ה-slug כבר קיים, בחר אחר' : msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Update Tenant Name ────────────────────────────────────
  const handleUpdateTenant = async () => {
    if (!editingTenant || !editTenantName.trim()) return;
    setFormLoading(true);
    setFormError('');
    try {
      await callManageTenants('update-tenant', {
        tenantId: editingTenant.id,
        name: editTenantName.trim(),
      });
      setEditingTenant(null);
      await loadTenants();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Create User for Tenant ────────────────────────────────
  const handleCreateUser = async () => {
    if (!showAddUserForTenant) return;
    if (!newUserEmail.trim() || !newUserPassword || !newUserName.trim()) {
      setFormError('נא למלא את כל השדות');
      return;
    }
    if (newUserPassword.length < 6) {
      setFormError('סיסמה חייבת להיות לפחות 6 תווים');
      return;
    }
    setFormLoading(true);
    setFormError('');
    try {
      await callManageTenants('create-tenant-user', {
        tenantId: showAddUserForTenant,
        email: newUserEmail.trim(),
        password: newUserPassword,
        displayName: newUserName.trim(),
        role: newUserRole,
      });
      setShowAddUserForTenant(null);
      resetUserForm();
      // Reload the tenant's users
      await loadTenantUsers(showAddUserForTenant);
      await loadTenants(); // Update user count
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFormError(msg === 'email_exists' ? 'כתובת מייל כבר קיימת במערכת' : msg);
    } finally {
      setFormLoading(false);
    }
  };

  // ── Remove User ───────────────────────────────────────────
  const handleRemoveUser = async () => {
    if (!confirmDeleteUserId) return;
    setFormLoading(true);
    try {
      await callManageTenants('remove-tenant-user', { userId: confirmDeleteUserId.userId });
      setConfirmDeleteUserId(null);
      await loadTenantUsers(confirmDeleteUserId.tenantId);
      await loadTenants();
    } catch (err) {
      console.error('Failed to remove user:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const resetUserForm = () => {
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserName('');
    setNewUserRole('admin');
    setFormError('');
  };

  const getRoleBadge = (role: string, isSA: boolean) => {
    if (isSA) return <Badge variant="warning">סופר מנהל</Badge>;
    switch (role) {
      case 'admin': return <Badge variant="primary">מנהל</Badge>;
      case 'freelancer': return <Badge variant="info">פרילנסר</Badge>;
      default: return <Badge variant="neutral">צופה</Badge>;
    }
  };

  // ── Access Guard ──────────────────────────────────────────
  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="text-center max-w-md">
          <Shield size={48} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">גישה חסומה</h2>
          <p className="text-gray-400">עמוד זה זמין רק לסופר מנהלים.</p>
        </Card>
      </div>
    );
  }

  // ── Loading State ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-gray-400 animate-pulse">טוען סוכנויות...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <Building2 className="text-primary" size={28} />
          ניהול סוכנויות
        </h2>
        <Button onClick={() => { setShowAddTenant(true); setFormError(''); }} icon={<Plus size={18} />}>
          סוכנות חדשה
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">סוכנויות</p>
          <p className="text-2xl font-black text-white">{tenants.length}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">סה"כ משתמשים</p>
          <p className="text-2xl font-black text-blue-400">{tenants.reduce((sum, t) => sum + t.userCount, 0)}</p>
        </Card>
        <Card className="text-center hidden md:block">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">סוכנות אחרונה</p>
          <p className="text-lg font-bold text-secondary truncate">
            {tenants.length > 0 ? tenants[tenants.length - 1].name : '-'}
          </p>
        </Card>
      </div>

      {/* Tenants List */}
      <div className="space-y-3">
        {tenants.map(tenant => {
          const isExpanded = expandedTenantId === tenant.id;
          const users = tenantUsers[tenant.id] || [];
          const isLoadingThisUsers = loadingUsers === tenant.id;

          return (
            <Card key={tenant.id} noPadding>
              {/* Tenant Header Row */}
              <button
                onClick={() => toggleExpand(tenant.id)}
                className="w-full flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-colors text-right"
              >
                <div className={`p-2.5 rounded-xl ${isExpanded ? 'bg-primary/10 text-primary' : 'bg-white/5 text-gray-400'} transition-colors`}>
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white truncate">{tenant.name}</h3>
                    {tenant.slug && (
                      <span className="text-xs text-gray-600 font-mono bg-white/5 px-1.5 py-0.5 rounded" dir="ltr">
                        {tenant.slug}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {tenant.userCount} משתמשים
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(tenant.createdAt).toLocaleDateString('he-IL')}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingTenant(tenant);
                      setEditTenantName(tenant.name);
                      setFormError('');
                    }}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors"
                    title="ערוך שם"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddUserForTenant(tenant.id);
                      resetUserForm();
                    }}
                    className="p-2 rounded-lg hover:bg-primary/10 text-gray-500 hover:text-primary transition-colors"
                    title="הוסף משתמש"
                  >
                    <UserPlus size={14} />
                  </button>
                  <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                    <ChevronLeft size={18} className="text-gray-500" />
                  </div>
                </div>
              </button>

              {/* Expanded: Users List */}
              {isExpanded && (
                <div className="border-t border-white/5 bg-white/[0.01]">
                  {isLoadingThisUsers ? (
                    <div className="p-6 text-center text-gray-500 animate-pulse text-sm">טוען משתמשים...</div>
                  ) : users.length === 0 ? (
                    <div className="p-6 text-center text-gray-600 text-sm">
                      אין משתמשים לסוכנות זו
                      <button
                        onClick={() => { setShowAddUserForTenant(tenant.id); resetUserForm(); }}
                        className="block mx-auto mt-2 text-primary hover:underline text-xs"
                      >
                        הוסף משתמש ראשון
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-white/5">
                      {users.map(u => (
                        <div key={u.id} className="flex items-center gap-3 px-5 py-3">
                          <div className={`p-1.5 rounded-lg ${
                            u.isSuperAdmin ? 'bg-amber-500/10 text-amber-400'
                            : u.role === 'admin' ? 'bg-primary/10 text-primary'
                            : u.role === 'freelancer' ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-violet-500/10 text-violet-400'
                          }`}>
                            {u.isSuperAdmin ? <Shield size={14} /> : u.role === 'admin' ? <Shield size={14} /> : u.role === 'freelancer' ? <Wrench size={14} /> : <Eye size={14} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white font-medium truncate">{u.displayName}</div>
                            <div className="text-xs text-gray-500 truncate" dir="ltr">{u.email}</div>
                          </div>
                          {getRoleBadge(u.role, u.isSuperAdmin)}
                          {u.userId !== user?.id && !u.isSuperAdmin && (
                            <button
                              onClick={() => setConfirmDeleteUserId({ userId: u.userId, name: u.displayName, tenantId: tenant.id })}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-600 hover:text-red-400 transition-colors"
                              title="הסר משתמש"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {tenants.length === 0 && !loading && (
        <Card className="text-center py-12">
          <Building2 size={48} className="text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-white mb-2">אין סוכנויות</h3>
          <p className="text-gray-500 mb-4">צור את הסוכנות הראשונה כדי להתחיל.</p>
          <Button onClick={() => setShowAddTenant(true)} icon={<Plus size={16} />}>סוכנות חדשה</Button>
        </Card>
      )}

      {/* ── Add Tenant Modal ─────────────────────────────────── */}
      <Modal isOpen={showAddTenant} onClose={() => setShowAddTenant(false)} title="סוכנות חדשה" size="md">
        <div className="space-y-4">
          <Input
            label="שם הסוכנות"
            value={newTenantName}
            onChange={e => {
              setNewTenantName(e.target.value);
              // Auto-generate slug
              if (!newTenantSlug || newTenantSlug === newTenantName.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim()) {
                setNewTenantSlug(e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim());
              }
            }}
            placeholder="לדוגמה: סוכנות דיגיטל XYZ"
          />
          <Input
            label="Slug (מזהה ייחודי)"
            value={newTenantSlug}
            onChange={e => setNewTenantSlug(e.target.value)}
            placeholder="xyz-digital"
            dir="ltr"
          />
          <p className="text-xs text-gray-500">
            ה-Slug הוא מזהה ייחודי לסוכנות באנגלית. נוצר אוטומטית מהשם.
          </p>
          {formError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setShowAddTenant(false)}>ביטול</Button>
            <Button onClick={handleCreateTenant} disabled={formLoading}>
              {formLoading ? 'יוצר...' : 'צור סוכנות'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Tenant Modal ────────────────────────────────── */}
      <Modal isOpen={!!editingTenant} onClose={() => setEditingTenant(null)} title="עריכת סוכנות" size="md">
        <div className="space-y-4">
          <Input
            label="שם הסוכנות"
            value={editTenantName}
            onChange={e => setEditTenantName(e.target.value)}
          />
          {formError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setEditingTenant(null)}>ביטול</Button>
            <Button onClick={handleUpdateTenant} disabled={formLoading}>
              {formLoading ? 'שומר...' : 'שמור'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Add User Modal ───────────────────────────────────── */}
      <Modal
        isOpen={!!showAddUserForTenant}
        onClose={() => { setShowAddUserForTenant(null); resetUserForm(); }}
        title={`הוספת משתמש לסוכנות ${tenants.find(t => t.id === showAddUserForTenant)?.name || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="שם תצוגה"
            value={newUserName}
            onChange={e => setNewUserName(e.target.value)}
            placeholder="שם מלא"
          />
          <Input
            label="אימייל"
            type="email"
            value={newUserEmail}
            onChange={e => setNewUserEmail(e.target.value)}
            placeholder="user@example.com"
            dir="ltr"
          />
          <Input
            label="סיסמה"
            type="password"
            value={newUserPassword}
            onChange={e => setNewUserPassword(e.target.value)}
            placeholder="לפחות 6 תווים"
            dir="ltr"
          />
          <Select
            label="תפקיד"
            value={newUserRole}
            onChange={e => setNewUserRole(e.target.value)}
          >
            <option value="admin">מנהל (Admin)</option>
            <option value="viewer">צופה (Viewer)</option>
            <option value="freelancer">פרילנסר (Freelancer)</option>
          </Select>
          <div className="text-xs text-gray-500 bg-white/5 rounded-lg p-3 space-y-1">
            <p><strong className="text-gray-300">מנהל:</strong> גישה מלאה לכל העמודים</p>
            <p><strong className="text-gray-300">פרילנסר:</strong> רואה רק לקוחות שמוקצים לו</p>
            <p><strong className="text-gray-300">צופה:</strong> דשבורד ולידים בלבד</p>
          </div>
          {formError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {formError}
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => { setShowAddUserForTenant(null); resetUserForm(); }}>ביטול</Button>
            <Button onClick={handleCreateUser} disabled={formLoading} icon={<UserPlus size={16} />}>
              {formLoading ? 'יוצר...' : 'צור משתמש'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete User Modal ────────────────────────── */}
      <Modal
        isOpen={!!confirmDeleteUserId}
        onClose={() => setConfirmDeleteUserId(null)}
        title="הסרת משתמש"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            האם להסיר את <span className="text-white font-bold">{confirmDeleteUserId?.name}</span> מהמערכת?
          </p>
          <p className="text-xs text-red-400/70">פעולה זו תמחק את המשתמש לצמיתות.</p>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setConfirmDeleteUserId(null)}>ביטול</Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleRemoveUser} disabled={formLoading}>
              {formLoading ? 'מוחק...' : 'הסר משתמש'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TenantManagement;
