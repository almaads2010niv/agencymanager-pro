import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth, ALL_PAGES, PagePermission } from '../contexts/AuthContext';
import { Download, Upload, Save, Users, Trash2, Plus, Shield, Eye, Edit2, ChevronDown, KeyRound, Sparkles, Palette } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select } from './ui/Form';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

const Settings: React.FC = () => {
  const { settings, services, updateSettings, updateServices, exportData, importData } = useData();
  const { isAdmin, user, allUsers, refreshUsers, addViewer, removeUser, updateUserRole, updateUserPermissions, updateUserDisplayName } = useAuth();
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newViewerName, setNewViewerName] = useState('');
  const [newViewerEmail, setNewViewerEmail] = useState('');
  const [newViewerPassword, setNewViewerPassword] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const showActionError = (msg: string | null) => {
    if (!msg) return;
    setActionError(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  useEffect(() => {
    if (isAdmin) refreshUsers();
  }, [isAdmin, refreshUsers]);

  const handleSaveSettings = () => {
    updateSettings(localSettings);
    alert('הגדרות נשמרו בהצלחה');
  };

  const handleExport = () => {
    const dataStr = exportData();
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `agency_backup_${new Date().toISOString().slice(0,10)}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importData(content);
        if (success) alert('נתונים יובאו בהצלחה! רענן את העמוד אם הנתונים לא מתעדכנים מיידית.');
        else alert('שגיאה ביבוא הנתונים. וודא שהקובץ תקין.');
      }
    };
    reader.onerror = () => {
      alert('שגיאה בקריאת הקובץ. נסה שוב.');
    };
    reader.readAsText(file);
  };

  // Safe parse for user's page_permissions from allUsers records
  const parseUserPermissions = (u: typeof allUsers[0]): PagePermission[] => {
    if (!u.page_permissions) {
      return u.role === 'admin' ? ALL_PAGES.map(p => p.key) : ['dashboard', 'leads'] as PagePermission[];
    }
    try {
      const parsed = typeof u.page_permissions === 'string' ? JSON.parse(u.page_permissions) : u.page_permissions;
      if (Array.isArray(parsed)) return parsed as PagePermission[];
      return u.role === 'admin' ? ALL_PAGES.map(p => p.key) : ['dashboard', 'leads'] as PagePermission[];
    } catch {
      return u.role === 'admin' ? ALL_PAGES.map(p => p.key) : ['dashboard', 'leads'] as PagePermission[];
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <h2 className="text-3xl font-black text-white tracking-tight">הגדרות מערכת</h2>

      <Card>
        <CardHeader title="פרופיל ויעדים" />
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input label="שם הסוכנות" value={localSettings.agencyName} onChange={e => setLocalSettings({...localSettings, agencyName: e.target.value})} />
                <Input label="שם הבעלים" value={localSettings.ownerName} onChange={e => setLocalSettings({...localSettings, ownerName: e.target.value})} />
                <Input label="יעד הכנסות חודשי (₪)" type="number" value={localSettings.targetMonthlyRevenue} onChange={e => setLocalSettings({...localSettings, targetMonthlyRevenue: Number(e.target.value)})} />
                <Input label="יעד רווח חודשי (₪)" type="number" value={localSettings.targetMonthlyGrossProfit} onChange={e => setLocalSettings({...localSettings, targetMonthlyGrossProfit: Number(e.target.value)})} />
            </div>
            <Input label="משכורת שכיר חודשית (₪)" type="number" value={localSettings.employeeSalary || ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setLocalSettings({...localSettings, employeeSalary: Number(e.target.value) || 0})} />
            <div className="flex justify-end pt-4 border-t border-white/5">
                <Button onClick={handleSaveSettings} icon={<Save size={18} />}>שמור שינויים</Button>
            </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="ניהול שירותים" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {services.map((service, index) => (
             <div key={service.serviceKey} className="flex items-center justify-between bg-[#0B1121] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
               <span className="text-gray-200 text-sm font-medium">{service.label}</span>
               <div className="flex items-center gap-2">
                 <button
                    role="switch"
                    aria-checked={service.isActive}
                    aria-label={`${service.label} - ${service.isActive ? 'פעיל' : 'כבוי'}`}
                    onClick={() => {
                       const newServices = [...services];
                       newServices[index].isActive = !newServices[index].isActive;
                       updateServices(newServices);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 duration-300 ${service.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-gray-700'}`}
                 >
                   <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${service.isActive ? 'translate-x-0' : 'ltr:-translate-x-5 rtl:translate-x-5'}`}></div>
                 </button>
               </div>
             </div>
           ))}
        </div>
      </Card>

      {/* User Management - Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader title="ניהול משתמשים והרשאות" />
          {actionError && (
            <div className="mb-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
              <span>{actionError}</span>
              <button onClick={() => setActionError(null)} className="text-red-400/60 hover:text-red-300 ms-3">✕</button>
            </div>
          )}
          <div className="space-y-3">
            {allUsers.map(u => {
              const isExpanded = expandedUserId === u.user_id;
              const isCurrentUser = user?.id === u.user_id;
              const userPerms = parseUserPermissions(u);

              return (
                <div key={u.id} className="bg-[#0B1121] rounded-xl border border-white/5 overflow-hidden">
                  {/* User Header Row */}
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
                    onClick={() => setExpandedUserId(isExpanded ? null : u.user_id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`p-2 rounded-lg ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-400'}`}>
                        {u.role === 'admin' ? <Shield size={18} /> : <Eye size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingNameId === u.user_id ? (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <Input
                              value={editNameValue}
                              onChange={e => setEditNameValue(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={async e => {
                                if (e.key === 'Enter') {
                                  const err = await updateUserDisplayName(u.user_id, editNameValue);
                                  showActionError(err);
                                  setEditingNameId(null);
                                }
                                if (e.key === 'Escape') setEditingNameId(null);
                              }}
                            />
                            <Button
                              variant="ghost"
                              className="p-1 text-emerald-400 hover:text-emerald-300"
                              onClick={async () => {
                                const err = await updateUserDisplayName(u.user_id, editNameValue);
                                showActionError(err);
                                setEditingNameId(null);
                              }}
                            >
                              <Save size={14} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-white font-medium text-sm truncate">{u.display_name}</span>
                            <button
                              onClick={e => { e.stopPropagation(); setEditingNameId(u.user_id); setEditNameValue(u.display_name); }}
                              className="p-0.5 rounded text-gray-600 hover:text-gray-300 transition-colors"
                              title="ערוך שם"
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] text-gray-500 truncate">{u.email || 'אין אימייל'}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant={u.role === 'admin' ? 'primary' : 'info'}>{u.role === 'admin' ? 'מנהל' : 'צופה'}</Badge>
                      <ChevronDown size={16} className={`transition-transform duration-200 text-gray-500 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 space-y-4 border-t border-white/5 pt-4">
                      {/* Role Switch */}
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-400 w-24">הרשאה:</span>
                        <div className="flex-1" onClick={e => e.stopPropagation()}>
                          <Select
                            value={u.role}
                            onChange={async e => {
                              const newRole = e.target.value as 'admin' | 'viewer';
                              if (isCurrentUser && u.role === 'admin' && newRole === 'viewer') {
                                if (!window.confirm('בטוח? הורדת הרשאת מנהל מעצמך תמנע ממך גישה להגדרות.')) return;
                              }
                              const err = await updateUserRole(u.user_id, newRole);
                              showActionError(err);
                            }}
                            className="h-9 text-sm"
                          >
                            <option value="admin">מנהל (גישה מלאה)</option>
                            <option value="viewer">צופה (הרשאות מותאמות)</option>
                          </Select>
                        </div>
                      </div>

                      {/* Page Permissions - only show for viewers */}
                      {u.role === 'viewer' && (
                        <div>
                          <div className="text-sm text-gray-400 mb-3">עמודים מורשים:</div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {ALL_PAGES.map(page => (
                              <label
                                key={page.key}
                                className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 hover:border-white/10 cursor-pointer transition-all text-sm"
                                onClick={e => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  checked={userPerms.includes(page.key)}
                                  onChange={async e => {
                                    e.stopPropagation();
                                    const newPerms = e.target.checked
                                      ? [...userPerms, page.key]
                                      : userPerms.filter(p => p !== page.key);
                                    const permErr = await updateUserPermissions(u.user_id, newPerms);
                                    showActionError(permErr);
                                  }}
                                  className="rounded bg-white/5 border-white/20 text-primary focus:ring-primary cursor-pointer"
                                />
                                <span className="text-gray-300">{page.label}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {u.role === 'admin' && (
                        <div className="text-xs text-gray-500 italic p-2 bg-white/[0.02] rounded-lg">
                          מנהלים מקבלים גישה מלאה לכל העמודים באופן אוטומטי.
                        </div>
                      )}

                      {/* Delete button - can't delete yourself */}
                      {!isCurrentUser && (
                        <div className="flex justify-end pt-2 border-t border-white/5">
                          <Button variant="ghost" onClick={() => setConfirmRemoveId(u.user_id)} className="text-red-400 hover:text-red-300 text-xs" icon={<Trash2 size={14} />}>
                            הסר משתמש
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {allUsers.length === 0 && (
              <div className="text-center text-gray-600 py-6 text-sm">
                לא נמצאו משתמשים (טבלת user_roles לא קיימת בסופאבייס)
              </div>
            )}

            {/* Add viewer section */}
            {showAddUser ? (
              <div className="p-4 bg-[#0B1121] rounded-xl border border-white/10 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Input label="שם תצוגה" value={newViewerName} onChange={e => setNewViewerName(e.target.value)} placeholder="שם הפרילנסר" />
                  <Input label="אימייל" type="email" value={newViewerEmail} onChange={e => setNewViewerEmail(e.target.value)} placeholder="email@example.com" />
                  <Input label="סיסמה ראשונית" type="password" value={newViewerPassword} onChange={e => setNewViewerPassword(e.target.value)} placeholder="לפחות 6 תווים" />
                </div>
                {userError && <div className="text-red-400 text-sm">{userError}</div>}
                <div className="text-xs text-gray-500 space-y-1">
                  <div><KeyRound size={12} className="inline me-1" /> <strong>איך זה עובד:</strong></div>
                  <div>1. הזן שם, אימייל וסיסמה ראשונית לפרילנסר</div>
                  <div>2. שלח לו את הלינק + פרטי ההתחברות: <span className="text-primary select-all font-mono">{window.location.origin}</span></div>
                  <div>3. הפרילנסר נכנס עם האימייל והסיסמה שהגדרת (יכול לשנות סיסמה דרך "שכחתי סיסמה")</div>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => { setShowAddUser(false); setUserError(null); }}>ביטול</Button>
                  <Button onClick={async () => {
                    if (!newViewerName.trim()) { setUserError('שם תצוגה נדרש'); return; }
                    if (!newViewerEmail.trim()) { setUserError('אימייל נדרש'); return; }
                    if (!newViewerPassword || newViewerPassword.length < 6) { setUserError('סיסמה חייבת להכיל לפחות 6 תווים'); return; }
                    const err = await addViewer(newViewerEmail, newViewerName, newViewerPassword);
                    if (err) setUserError(err);
                    else {
                      setNewViewerName('');
                      setNewViewerEmail('');
                      setNewViewerPassword('');
                      setShowAddUser(false);
                      setUserError(null);
                    }
                  }}>הוסף צופה</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" onClick={() => setShowAddUser(true)} icon={<Plus size={16} />}>הוסף פרילנסר</Button>
            )}
          </div>
        </Card>
      )}

      {/* Confirm Remove Modal */}
      <Modal isOpen={!!confirmRemoveId} onClose={() => setConfirmRemoveId(null)} title="הסרת משתמש" size="md">
        <div className="space-y-6">
          <p className="text-gray-300">האם אתה בטוח שברצונך להסיר את המשתמש? הוא לא יוכל להיכנס למערכת יותר.</p>
          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost" onClick={() => setConfirmRemoveId(null)}>ביטול</Button>
            <Button variant="danger" onClick={async () => { if (confirmRemoveId) { const err = await removeUser(confirmRemoveId); showActionError(err); setConfirmRemoveId(null); } }}>הסר משתמש</Button>
          </div>
        </div>
      </Modal>

      {/* External Integrations - Admin only */}
      {isAdmin && (
        <Card>
          <CardHeader title="אינטגרציות חיצוניות" />
          <div className="space-y-6">
            {/* Canva */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={18} className="text-violet-400" />
                <span className="text-white font-bold text-sm">Canva — הצעות מחיר</span>
              </div>
              <Input
                label="Canva API Key"
                type="password"
                value={localSettings.canvaApiKey || ''}
                onChange={e => setLocalSettings({ ...localSettings, canvaApiKey: e.target.value })}
                placeholder="cnv_..."
              />
              <Input
                label="Canva Template ID"
                value={localSettings.canvaTemplateId || ''}
                onChange={e => setLocalSettings({ ...localSettings, canvaTemplateId: e.target.value })}
                placeholder="DAG..."
              />
            </div>

            {/* Gemini */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-amber-400" />
                <span className="text-white font-bold text-sm">Gemini Pro — המלצות AI</span>
              </div>
              <Input
                label="Gemini API Key"
                type="password"
                value={localSettings.geminiApiKey || ''}
                onChange={e => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                placeholder="AI..."
              />
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button onClick={handleSaveSettings} icon={<Save size={18} />}>שמור שינויים</Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="גיבוי ושחזור" />
        <div className="flex flex-col md:flex-row gap-6">
          <button onClick={handleExport} className="flex-1 group bg-[#0B1121] border border-white/10 hover:border-primary/50 hover:shadow-glow-primary p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all duration-300">
            <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <Download size={32} />
            </div>
            <div className="text-center">
                <div className="font-bold text-white text-lg">ייצוא נתונים (Backup)</div>
                <div className="text-sm text-gray-500 mt-1">הורד קובץ JSON של כל המידע</div>
            </div>
          </button>

          <button onClick={() => fileInputRef.current?.click()} className="flex-1 group bg-[#0B1121] border border-white/10 hover:border-secondary/50 hover:shadow-glow-secondary p-8 rounded-2xl flex flex-col items-center justify-center gap-4 transition-all duration-300">
            <div className="p-4 rounded-full bg-secondary/10 text-secondary group-hover:scale-110 transition-transform">
                <Upload size={32} />
            </div>
            <div className="text-center">
                <div className="font-bold text-white text-lg">ייבוא נתונים (Restore)</div>
                <div className="text-sm text-gray-500 mt-1">שחזר מגיבוי (דורס קיים)</div>
            </div>
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImport}
          />
        </div>
      </Card>
    </div>
  );
};

export default Settings;
