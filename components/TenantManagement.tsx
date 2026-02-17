import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Users, Plus, Trash2, ChevronLeft, Shield, Eye, Wrench, UserPlus, Calendar, Link2, Copy, Check, Settings, ToggleLeft, ToggleRight, Save, KeyRound } from 'lucide-react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Form';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';
import { useAuth, ALL_PAGES } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import type { TenantWithUsers, TenantUser } from '../types';

type TabType = 'users' | 'settings';

const TenantManagement: React.FC = () => {
  const { isSuperAdmin, user } = useAuth();

  // State
  const [tenants, setTenants] = useState<TenantWithUsers[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Record<string, TabType>>({});
  const [tenantUsers, setTenantUsers] = useState<Record<string, TenantUser[]>>({});
  const [loadingUsers, setLoadingUsers] = useState<string | null>(null);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Modals
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [showAddUserForTenant, setShowAddUserForTenant] = useState<string | null>(null);
  const [editPermissionsUser, setEditPermissionsUser] = useState<{ user: TenantUser; tenantId: string } | null>(null);
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

  // Edit tenant settings (inline)
  const [editingSettings, setEditingSettings] = useState<Record<string, { name: string; slug: string }>>({});
  const [savingTenant, setSavingTenant] = useState<string | null>(null);

  // Edit permissions
  const [editPerms, setEditPerms] = useState<string[]>([]);

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
      if (!activeTab[tenantId]) setActiveTab(prev => ({ ...prev, [tenantId]: 'users' }));
      if (!tenantUsers[tenantId]) loadTenantUsers(tenantId);
    }
  };

  // ── Copy Link ─────────────────────────────────────────────
  const copyTenantLink = (slug: string) => {
    const link = `${window.location.origin}/a/${slug}/`;
    navigator.clipboard.writeText(link);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2000);
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

  // ── Save Tenant Settings ──────────────────────────────────
  const handleSaveTenantSettings = async (tenantId: string) => {
    const settings = editingSettings[tenantId];
    if (!settings) return;
    setSavingTenant(tenantId);
    try {
      await callManageTenants('update-tenant', {
        tenantId,
        name: settings.name.trim() || undefined,
        slug: settings.slug.trim() || undefined,
      });
      await loadTenants();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'slug_exists') alert('ה-slug כבר קיים, בחר אחר');
    } finally {
      setSavingTenant(null);
    }
  };

  // ── Toggle Tenant Active ──────────────────────────────────
  const handleToggleActive = async (tenantId: string, currentActive: boolean) => {
    try {
      await callManageTenants('update-tenant', { tenantId, isActive: !currentActive });
      await loadTenants();
    } catch (err) {
      console.error('Failed to toggle active:', err);
    }
  };

  // ── Update User Role (inline) ─────────────────────────────
  const handleUpdateUserRole = async (userId: string, newRole: string, tenantId: string) => {
    try {
      await callManageTenants('update-tenant-user', { userId, role: newRole });
      await loadTenantUsers(tenantId);
    } catch (err) {
      console.error('Failed to update user role:', err);
    }
  };

  // ── Save User Permissions ─────────────────────────────────
  const handleSavePermissions = async () => {
    if (!editPermissionsUser) return;
    setFormLoading(true);
    try {
      await callManageTenants('update-tenant-user', {
        userId: editPermissionsUser.user.userId,
        pagePermissions: editPerms,
      });
      setEditPermissionsUser(null);
      await loadTenantUsers(editPermissionsUser.tenantId);
    } catch (err) {
      console.error('Failed to save permissions:', err);
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
      await loadTenantUsers(showAddUserForTenant);
      await loadTenants();
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">סוכנויות</p>
          <p className="text-2xl font-black text-white">{tenants.length}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">פעילות</p>
          <p className="text-2xl font-black text-emerald-400">{tenants.filter(t => t.isActive).length}</p>
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
          const tab = activeTab[tenant.id] || 'users';
          const tenantLink = `${window.location.origin}/a/${tenant.slug}/`;

          // Init editing settings
          if (isExpanded && !editingSettings[tenant.id]) {
            setEditingSettings(prev => ({ ...prev, [tenant.id]: { name: tenant.name, slug: tenant.slug } }));
          }

          return (
            <Card key={tenant.id} noPadding>
              {/* Tenant Header Row */}
              <button
                onClick={() => toggleExpand(tenant.id)}
                className="w-full flex items-center gap-4 p-5 hover:bg-white/[0.02] transition-colors text-right"
              >
                <div className={`p-2.5 rounded-xl ${isExpanded ? 'bg-primary/10 text-primary' : tenant.isActive ? 'bg-white/5 text-gray-400' : 'bg-red-500/10 text-red-400'} transition-colors`}>
                  <Building2 size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className={`text-base font-bold truncate ${tenant.isActive ? 'text-white' : 'text-gray-500'}`}>{tenant.name}</h3>
                    {tenant.slug && (
                      <span className="text-xs text-gray-600 font-mono bg-white/5 px-1.5 py-0.5 rounded" dir="ltr">
                        {tenant.slug}
                      </span>
                    )}
                    {!tenant.isActive && <Badge variant="danger">מושהית</Badge>}
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
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); copyTenantLink(tenant.slug); }}
                    className="p-2 rounded-lg hover:bg-primary/10 text-gray-500 hover:text-primary transition-colors"
                    title="העתק לינק ישיר"
                  >
                    {copiedSlug === tenant.slug ? <Check size={14} className="text-emerald-400" /> : <Link2 size={14} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowAddUserForTenant(tenant.id); resetUserForm(); }}
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

              {/* Expanded Content */}
              {isExpanded && (
                <div className="border-t border-white/5">
                  {/* Tabs */}
                  <div className="flex border-b border-white/5">
                    <button
                      onClick={() => setActiveTab(prev => ({ ...prev, [tenant.id]: 'users' }))}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                        tab === 'users' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-300'
                      }`}
                    >
                      <Users size={14} />
                      משתמשים ({users.length})
                    </button>
                    <button
                      onClick={() => setActiveTab(prev => ({ ...prev, [tenant.id]: 'settings' }))}
                      className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 ${
                        tab === 'settings' ? 'text-primary border-primary' : 'text-gray-500 border-transparent hover:text-gray-300'
                      }`}
                    >
                      <Settings size={14} />
                      הגדרות סוכנות
                    </button>
                  </div>

                  {/* Tab: Users */}
                  {tab === 'users' && (
                    <div className="bg-white/[0.01]">
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

                              {/* Role selector */}
                              {!u.isSuperAdmin ? (
                                <select
                                  value={u.role}
                                  onChange={(e) => handleUpdateUserRole(u.userId, e.target.value, tenant.id)}
                                  className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 outline-none focus:border-primary/50"
                                >
                                  <option value="admin">מנהל</option>
                                  <option value="viewer">צופה</option>
                                  <option value="freelancer">פרילנסר</option>
                                </select>
                              ) : (
                                getRoleBadge(u.role, u.isSuperAdmin)
                              )}

                              {/* Permissions button */}
                              {!u.isSuperAdmin && u.role !== 'admin' && (
                                <button
                                  onClick={() => {
                                    setEditPermissionsUser({ user: u, tenantId: tenant.id });
                                    setEditPerms(u.pagePermissions || []);
                                  }}
                                  className="p-1.5 rounded-lg hover:bg-white/5 text-gray-600 hover:text-white transition-colors"
                                  title="ערוך הרשאות"
                                >
                                  <KeyRound size={14} />
                                </button>
                              )}

                              {/* Delete */}
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
                          <div className="px-5 py-3">
                            <button
                              onClick={() => { setShowAddUserForTenant(tenant.id); resetUserForm(); }}
                              className="flex items-center gap-2 text-primary hover:text-primary/80 text-xs transition-colors"
                            >
                              <Plus size={14} />
                              הוסף משתמש
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab: Settings */}
                  {tab === 'settings' && (
                    <div className="p-5 space-y-5 bg-white/[0.01]">
                      {/* Direct Link */}
                      <div>
                        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">לינק ישיר לסוכנות</label>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 font-mono truncate" dir="ltr">
                            {tenantLink}
                          </div>
                          <button
                            onClick={() => copyTenantLink(tenant.slug)}
                            className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors flex-shrink-0"
                            title="העתק"
                          >
                            {copiedSlug === tenant.slug ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Editable fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">שם הסוכנות</label>
                          <input
                            value={editingSettings[tenant.id]?.name ?? tenant.name}
                            onChange={e => setEditingSettings(prev => ({
                              ...prev,
                              [tenant.id]: { ...prev[tenant.id], name: e.target.value }
                            }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-primary/50"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-2">Slug</label>
                          <input
                            value={editingSettings[tenant.id]?.slug ?? tenant.slug}
                            onChange={e => setEditingSettings(prev => ({
                              ...prev,
                              [tenant.id]: { ...prev[tenant.id], slug: e.target.value }
                            }))}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono outline-none focus:border-primary/50"
                            dir="ltr"
                          />
                        </div>
                      </div>

                      {/* Active toggle */}
                      <div className="flex items-center justify-between bg-white/5 rounded-lg p-4">
                        <div>
                          <div className="text-sm text-white font-medium">סטטוס סוכנות</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {tenant.isActive ? 'הסוכנות פעילה ומשתמשים יכולים להתחבר' : 'הסוכנות מושהית'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleActive(tenant.id, tenant.isActive)}
                          className={`p-1 rounded-lg transition-colors ${tenant.isActive ? 'text-emerald-400' : 'text-gray-600'}`}
                          title={tenant.isActive ? 'השהה סוכנות' : 'הפעל סוכנות'}
                        >
                          {tenant.isActive ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                        </button>
                      </div>

                      {/* Save button */}
                      <div className="flex justify-end">
                        <Button
                          onClick={() => handleSaveTenantSettings(tenant.id)}
                          disabled={savingTenant === tenant.id}
                          icon={<Save size={16} />}
                        >
                          {savingTenant === tenant.id ? 'שומר...' : 'שמור שינויים'}
                        </Button>
                      </div>
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

      {/* ── Add User Modal ───────────────────────────────────── */}
      <Modal
        isOpen={!!showAddUserForTenant}
        onClose={() => { setShowAddUserForTenant(null); resetUserForm(); }}
        title={`הוספת משתמש ל${tenants.find(t => t.id === showAddUserForTenant)?.name || 'סוכנות'}`}
        size="md"
      >
        <div className="space-y-4">
          <Input label="שם תצוגה" value={newUserName} onChange={e => setNewUserName(e.target.value)} placeholder="שם מלא" />
          <Input label="אימייל" type="email" value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} placeholder="user@example.com" dir="ltr" />
          <Input label="סיסמה" type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} placeholder="לפחות 6 תווים" dir="ltr" />
          <Select label="תפקיד" value={newUserRole} onChange={e => setNewUserRole(e.target.value)}>
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
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => { setShowAddUserForTenant(null); resetUserForm(); }}>ביטול</Button>
            <Button onClick={handleCreateUser} disabled={formLoading} icon={<UserPlus size={16} />}>
              {formLoading ? 'יוצר...' : 'צור משתמש'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Edit Permissions Modal ────────────────────────────── */}
      <Modal
        isOpen={!!editPermissionsUser}
        onClose={() => setEditPermissionsUser(null)}
        title={`הרשאות עמודים — ${editPermissionsUser?.user.displayName || ''}`}
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500">סמן את העמודים שהמשתמש יוכל לגשת אליהם:</p>
          <div className="grid grid-cols-2 gap-2">
            {ALL_PAGES.map(page => (
              <label
                key={page.key}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/[0.07] cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={editPerms.includes(page.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setEditPerms(prev => [...prev, page.key]);
                    } else {
                      setEditPerms(prev => prev.filter(p => p !== page.key));
                    }
                  }}
                  className="rounded border-white/20 bg-white/5 text-primary focus:ring-primary/50"
                />
                <span className="text-sm text-gray-300">{page.label}</span>
              </label>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="ghost" onClick={() => setEditPermissionsUser(null)}>ביטול</Button>
            <Button onClick={handleSavePermissions} disabled={formLoading} icon={<Save size={16} />}>
              {formLoading ? 'שומר...' : 'שמור הרשאות'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Confirm Delete User Modal ────────────────────────── */}
      <Modal isOpen={!!confirmDeleteUserId} onClose={() => setConfirmDeleteUserId(null)} title="הסרת משתמש" size="md">
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
