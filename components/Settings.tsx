import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth, ALL_PAGES, PagePermission } from '../contexts/AuthContext';
import { Download, Upload, Save, Users, Trash2, Plus, Shield, Eye, Edit2, ChevronDown, KeyRound, Sparkles, Palette, Brain, Copy, Check, ImageIcon, X, Send, FileText } from 'lucide-react';
import type { ProposalPhase, ProposalPackage } from '../types';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Form';
import { Badge } from './ui/Badge';
import { Modal } from './ui/Modal';

const Settings: React.FC = () => {
  const { settings, services, updateSettings, updateServices, exportData, importData, saveApiKeys, saveSignalsWebhookSecret, saveTelegramBotToken, uploadLogo, deleteLogo } = useData();
  const { isAdmin, user, allUsers, refreshUsers, addUser, removeUser, updateUserRole, updateUserPermissions, updateUserDisplayName } = useAuth();
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newViewerName, setNewViewerName] = useState('');
  const [newViewerEmail, setNewViewerEmail] = useState('');
  const [newViewerPassword, setNewViewerPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<'viewer' | 'freelancer'>('freelancer');
  const [showAddUser, setShowAddUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  // API keys — separate local state, never loaded from settings to keep them off the frontend
  const [apiCanvaKey, setApiCanvaKey] = useState('');
  const [apiCanvaTemplateId, setApiCanvaTemplateId] = useState(settings.canvaTemplateId || '');
  const [apiGeminiKey, setApiGeminiKey] = useState('');
  const [signalsWebhookSecret, setSignalsWebhookSecret] = useState('');
  const [signalsSecretSaved, setSignalsSecretSaved] = useState(false);
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
  const [apiKeysSaved, setApiKeysSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramTokenSaved, setTelegramTokenSaved] = useState(false);
  // Service editing state
  const [editingServiceKey, setEditingServiceKey] = useState<string | null>(null);
  const [editingServiceLabel, setEditingServiceLabel] = useState('');
  const [newServiceLabel, setNewServiceLabel] = useState('');
  const [showAddService, setShowAddService] = useState(false);

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
            {/* Toggle שכיר */}
            <div className="flex items-center justify-between bg-[#0B1121] p-4 rounded-xl border border-white/5">
              <span className="text-gray-200 text-sm font-medium">שכיר/ה?</span>
              <button
                role="switch"
                aria-checked={localSettings.isSalaried}
                onClick={() => setLocalSettings({...localSettings, isSalaried: !localSettings.isSalaried, employeeSalary: !localSettings.isSalaried ? localSettings.employeeSalary : 0})}
                className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${localSettings.isSalaried ? 'bg-green-500' : 'bg-gray-600'}`}
              >
                <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${localSettings.isSalaried ? '-translate-x-1.5' : '-translate-x-6'}`} />
              </button>
            </div>
            {localSettings.isSalaried && (
              <Input label="משכורת שכיר חודשית (₪)" type="number" value={localSettings.employeeSalary || ''} onFocus={e => { if (e.target.value === '0') e.target.value = ''; }} onChange={e => setLocalSettings({...localSettings, employeeSalary: Number(e.target.value) || 0})} />
            )}
            <div className="flex justify-end pt-4 border-t border-white/5">
                <Button onClick={handleSaveSettings} icon={<Save size={18} />}>שמור שינויים</Button>
            </div>
        </div>
      </Card>

      {/* PDF Branding — Logo + Colors */}
      {isAdmin && (
        <Card>
          <CardHeader title="מיתוג מסמכים (PDF)" />
          <div className="space-y-6">
            {/* Logo Upload */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <ImageIcon size={18} className="text-primary" />
                <span className="text-white font-bold text-sm">לוגו</span>
              </div>
              <div className="flex items-center gap-4">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="h-16 w-auto rounded-lg border border-white/10 bg-white/5 object-contain p-1" />
                ) : (
                  <div className="h-16 w-24 rounded-lg border-2 border-dashed border-white/10 flex items-center justify-center text-gray-600 text-xs">
                    אין לוגו
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    icon={<Upload size={14} />}
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                  >
                    {logoUploading ? 'מעלה...' : settings.logoUrl ? 'החלף לוגו' : 'העלה לוגו'}
                  </Button>
                  {settings.logoUrl && (
                    <Button
                      variant="danger"
                      icon={<Trash2 size={14} />}
                      onClick={async () => { await deleteLogo(); }}
                    >
                      הסר לוגו
                    </Button>
                  )}
                  <span className="text-[10px] text-gray-500">PNG, JPG, WebP או SVG · עד 2MB</span>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  ref={logoInputRef}
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      alert('הקובץ גדול מדי (מקסימום 2MB)');
                      return;
                    }
                    setLogoUploading(true);
                    await uploadLogo(file);
                    setLogoUploading(false);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>

            {/* Color Palette */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Palette size={18} className="text-amber-400" />
                <span className="text-white font-bold text-sm">פלטת צבעים למסמכים</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">צבע ראשי</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localSettings.brandPrimaryColor}
                      onChange={e => setLocalSettings({ ...localSettings, brandPrimaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <Input
                      value={localSettings.brandPrimaryColor}
                      onChange={e => setLocalSettings({ ...localSettings, brandPrimaryColor: e.target.value })}
                      className="flex-1 font-mono text-xs"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">צבע משני</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localSettings.brandSecondaryColor}
                      onChange={e => setLocalSettings({ ...localSettings, brandSecondaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <Input
                      value={localSettings.brandSecondaryColor}
                      onChange={e => setLocalSettings({ ...localSettings, brandSecondaryColor: e.target.value })}
                      className="flex-1 font-mono text-xs"
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1.5">צבע הדגשה</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={localSettings.brandAccentColor}
                      onChange={e => setLocalSettings({ ...localSettings, brandAccentColor: e.target.value })}
                      className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
                    />
                    <Input
                      value={localSettings.brandAccentColor}
                      onChange={e => setLocalSettings({ ...localSettings, brandAccentColor: e.target.value })}
                      className="flex-1 font-mono text-xs"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Color Preview */}
              <div className="flex items-center gap-2 mt-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
                <span className="text-xs text-gray-500 ms-2">תצוגה מקדימה:</span>
                <div className="flex-1 h-6 rounded-md overflow-hidden flex">
                  <div style={{ background: localSettings.brandPrimaryColor }} className="flex-1" />
                  <div style={{ background: localSettings.brandSecondaryColor }} className="flex-1" />
                  <div style={{ background: localSettings.brandAccentColor }} className="flex-1" />
                </div>
              </div>
              <div className="text-xs text-gray-500">
                הצבעים ישמשו לכותרות, קווים ואלמנטים גרפיים במסמכי PDF שיוצאים ללקוחות.
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button onClick={handleSaveSettings} icon={<Save size={18} />}>שמור מיתוג</Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="ניהול שירותים" />
        <p className="text-xs text-gray-500 mb-4">שירותים שתגדיר כאן יופיעו בכרטיס ליד ולקוח. לחץ על שם שירות כדי לערוך.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {services.map((service, index) => (
             <div key={service.serviceKey} className="flex items-center justify-between bg-[#0B1121] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
               {editingServiceKey === service.serviceKey ? (
                 <form className="flex items-center gap-2 flex-1" onSubmit={e => {
                   e.preventDefault();
                   if (editingServiceLabel.trim()) {
                     const newServices = [...services];
                     newServices[index] = { ...newServices[index], label: editingServiceLabel.trim() };
                     updateServices(newServices);
                   }
                   setEditingServiceKey(null);
                 }}>
                   <input
                     autoFocus
                     className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm text-white flex-1 outline-none focus:border-primary"
                     value={editingServiceLabel}
                     onChange={e => setEditingServiceLabel(e.target.value)}
                     onBlur={() => {
                       if (editingServiceLabel.trim() && editingServiceLabel.trim() !== service.label) {
                         const newServices = [...services];
                         newServices[index] = { ...newServices[index], label: editingServiceLabel.trim() };
                         updateServices(newServices);
                       }
                       setEditingServiceKey(null);
                     }}
                   />
                 </form>
               ) : (
                 <button
                   className="text-gray-200 text-sm font-medium text-right hover:text-primary transition-colors cursor-pointer"
                   onClick={() => {
                     setEditingServiceKey(service.serviceKey);
                     setEditingServiceLabel(service.label);
                   }}
                   title="לחץ לעריכת שם השירות"
                 >
                   {service.label}
                 </button>
               )}
               <div className="flex items-center gap-2">
                 {isAdmin && (
                   <button
                     className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                     title="מחק שירות"
                     onClick={() => {
                       const newServices = services.filter((_, i) => i !== index);
                       updateServices(newServices);
                     }}
                   >
                     <Trash2 size={14} />
                   </button>
                 )}
                 <button
                    role="switch"
                    aria-checked={service.isActive}
                    aria-label={`${service.label} - ${service.isActive ? 'פעיל' : 'כבוי'}`}
                    onClick={() => {
                       const newServices = [...services];
                       newServices[index] = { ...newServices[index], isActive: !newServices[index].isActive };
                       updateServices(newServices);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 duration-300 ${service.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-gray-700'}`}
                 >
                   <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${service.isActive ? 'translate-x-0' : 'ltr:-translate-x-5 rtl:translate-x-5'}`}></div>
                 </button>
               </div>
             </div>
           ))}
           {/* Add new service */}
           {showAddService ? (
             <form className="flex items-center gap-2 bg-[#0B1121] p-4 rounded-xl border border-dashed border-primary/30" onSubmit={e => {
               e.preventDefault();
               if (newServiceLabel.trim()) {
                 const key = newServiceLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_א-ת]/g, '') + '_' + Date.now();
                 updateServices([...services, { serviceKey: key, label: newServiceLabel.trim(), isActive: true }]);
                 setNewServiceLabel('');
                 setShowAddService(false);
               }
             }}>
               <input
                 autoFocus
                 className="bg-transparent border border-white/20 rounded px-2 py-1 text-sm text-white flex-1 outline-none focus:border-primary"
                 placeholder="שם השירות החדש..."
                 value={newServiceLabel}
                 onChange={e => setNewServiceLabel(e.target.value)}
                 onBlur={() => { if (!newServiceLabel.trim()) setShowAddService(false); }}
               />
               <button type="submit" className="text-primary hover:text-primary/80"><Check size={16} /></button>
               <button type="button" onClick={() => { setShowAddService(false); setNewServiceLabel(''); }} className="text-gray-500 hover:text-gray-300"><X size={16} /></button>
             </form>
           ) : (
             <button
               onClick={() => setShowAddService(true)}
               className="flex items-center justify-center gap-2 bg-[#0B1121] p-4 rounded-xl border border-dashed border-white/10 hover:border-primary/30 text-gray-500 hover:text-primary text-sm transition-all"
             >
               <Plus size={16} /> הוסף שירות
             </button>
           )}
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
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <Input label="שם תצוגה" value={newViewerName} onChange={e => setNewViewerName(e.target.value)} placeholder="שם המשתמש" />
                  <Input label="אימייל" type="email" value={newViewerEmail} onChange={e => setNewViewerEmail(e.target.value)} placeholder="email@example.com" />
                  <Input label="סיסמה ראשונית" type="password" value={newViewerPassword} onChange={e => setNewViewerPassword(e.target.value)} placeholder="לפחות 6 תווים" />
                  <Select label="תפקיד" value={newUserRole} onChange={e => setNewUserRole(e.target.value as 'viewer' | 'freelancer')}>
                    <option value="freelancer">פרילנסר</option>
                    <option value="viewer">צופה</option>
                  </Select>
                </div>
                {userError && <div className="text-red-400 text-sm">{userError}</div>}
                <div className="text-xs text-gray-500 space-y-1">
                  <div><KeyRound size={12} className="inline me-1" /> <strong>איך זה עובד:</strong></div>
                  <div>1. הזן שם, אימייל, סיסמה ותפקיד למשתמש החדש</div>
                  <div>2. שלח לו את הלינק + פרטי ההתחברות: <span className="text-primary select-all font-mono">{window.location.origin}</span></div>
                  <div>3. <strong>פרילנסר</strong> = רואה רק לקוחות/לידים שהוקצו לו | <strong>צופה</strong> = רואה דשבורד ולידים בלבד</div>
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => { setShowAddUser(false); setUserError(null); }}>ביטול</Button>
                  <Button onClick={async () => {
                    if (!newViewerName.trim()) { setUserError('שם תצוגה נדרש'); return; }
                    if (!newViewerEmail.trim()) { setUserError('אימייל נדרש'); return; }
                    if (!newViewerPassword || newViewerPassword.length < 6) { setUserError('סיסמה חייבת להכיל לפחות 6 תווים'); return; }
                    const err = await addUser(newViewerEmail, newViewerName, newViewerPassword, newUserRole);
                    if (err) setUserError(err);
                    else {
                      setNewViewerName('');
                      setNewViewerEmail('');
                      setNewViewerPassword('');
                      setNewUserRole('freelancer');
                      setShowAddUser(false);
                      setUserError(null);
                    }
                  }}>הוסף משתמש</Button>
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
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Palette size={18} className="text-violet-400" />
                  <span className="text-white font-bold text-sm">Canva — הצעות מחיר</span>
                </div>
                {settings.hasCanvaKey && <span className="text-emerald-400 text-xs">✓ מפתח מוגדר</span>}
              </div>
              <Input
                label="Canva API Key"
                type="password"
                value={apiCanvaKey}
                onChange={e => { setApiCanvaKey(e.target.value); setApiKeysSaved(false); }}
                placeholder={settings.hasCanvaKey ? '••••••• (מפתח קיים — הזן חדש לעדכון)' : 'cnv_...'}
              />
              <Input
                label="Canva Template ID"
                value={apiCanvaTemplateId}
                onChange={e => { setApiCanvaTemplateId(e.target.value); setApiKeysSaved(false); }}
                placeholder="DAG..."
              />
            </div>

            {/* Gemini */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-amber-400" />
                  <span className="text-white font-bold text-sm">Gemini Pro — המלצות AI</span>
                </div>
                {settings.hasGeminiKey && <span className="text-emerald-400 text-xs">✓ מפתח מוגדר</span>}
              </div>
              <Input
                label="Gemini API Key"
                type="password"
                value={apiGeminiKey}
                onChange={e => { setApiGeminiKey(e.target.value); setApiKeysSaved(false); }}
                placeholder={settings.hasGeminiKey ? '••••••• (מפתח קיים — הזן חדש לעדכון)' : 'AI...'}
              />
            </div>

            {/* Signals OS */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Brain size={18} className="text-violet-400" />
                  <span className="text-white font-bold text-sm">Signals OS — מודיעין אישיותי</span>
                </div>
                {settings.hasSignalsWebhookSecret && <span className="text-emerald-400 text-xs">✓ סוד מוגדר</span>}
              </div>
              <Input
                label="Webhook Secret"
                type="password"
                value={signalsWebhookSecret}
                onChange={e => { setSignalsWebhookSecret(e.target.value); setSignalsSecretSaved(false); }}
                placeholder={settings.hasSignalsWebhookSecret ? '••••••• (סוד קיים — הזן חדש לעדכון)' : 'הגדר סוד לאימות webhooks'}
              />
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Webhook URL (להגדרה ב-Signals OS)</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-black/30 text-gray-300 px-3 py-2 rounded-lg border border-white/5 overflow-x-auto" dir="ltr">
                    {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signals-webhook`}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signals-webhook`);
                      setWebhookUrlCopied(true);
                      setTimeout(() => setWebhookUrlCopied(false), 2000);
                    }}
                    className="p-2 rounded-lg hover:bg-white/5 transition-colors"
                    title="העתק URL"
                  >
                    {webhookUrlCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-gray-400" />}
                  </button>
                </div>
              </div>
              {signalsSecretSaved && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                  סוד Webhook נשמר בהצלחה ✓
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={async () => {
                  if (signalsWebhookSecret) {
                    await saveSignalsWebhookSecret(signalsWebhookSecret);
                    setSignalsSecretSaved(true);
                    setSignalsWebhookSecret('');
                  }
                }} icon={<Save size={16} />} variant="ghost">שמור סוד</Button>
              </div>
            </div>

            {/* Telegram Bot */}
            <div className="p-4 bg-[#0B1121] rounded-xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Send size={18} className="text-blue-400" />
                  <span className="text-white font-bold text-sm">Telegram Bot</span>
                </div>
                {settings.hasTelegramBotToken && <span className="text-emerald-400 text-xs">✓ טוקן מוגדר</span>}
              </div>
              <Input
                label="Bot Token (מ-@BotFather)"
                type="password"
                value={telegramToken}
                onChange={e => { setTelegramToken(e.target.value); setTelegramTokenSaved(false); }}
                placeholder={settings.hasTelegramBotToken ? '••••••• (טוקן קיים)' : 'הדבק את הטוקן מ-BotFather'}
              />
              <div className="space-y-2">
                <label className="block text-xs text-gray-400">Webhook URL (להגדרה ב-Telegram)</label>
                <code className="block text-xs bg-black/30 text-gray-300 px-3 py-2 rounded-lg border border-white/5 overflow-x-auto" dir="ltr">
                  {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/telegram-webhook`}
                </code>
                <div className="text-xs text-gray-500 mt-1">
                  לאחר שמירת הטוקן, הגדר webhook דרך: <code className="text-gray-400" dir="ltr">https://api.telegram.org/bot&lt;TOKEN&gt;/setWebhook?url=&lt;URL&gt;</code>
                </div>
              </div>
              <div className="text-xs text-gray-500 space-y-1">
                <div><strong>פקודות הבוט:</strong></div>
                <div>/stats — סטטיסטיקות מהירות</div>
                <div>/search &lt;שם&gt; — חיפוש לקוח/ליד</div>
                <div>/note &lt;שם&gt;: &lt;הערה&gt; — הוסף הערה</div>
                <div>הודעה קולית / תמונה → AI מעבד אוטומטית</div>
              </div>
              {telegramTokenSaved && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                  טוקן Telegram נשמר בהצלחה ✓
                </div>
              )}
              <div className="flex justify-end pt-2">
                <Button onClick={async () => {
                  if (telegramToken) {
                    await saveTelegramBotToken(telegramToken);
                    setTelegramTokenSaved(true);
                    setTelegramToken('');
                  }
                }} icon={<Save size={16} />} variant="ghost">שמור טוקן</Button>
              </div>
            </div>

            <div className="text-xs text-gray-500 p-3 bg-white/[0.02] rounded-lg">
              🔒 המפתחות נשמרים בצד השרת בלבד ולא נטענים לדפדפן. רק Edge Functions ניגשים אליהם.
            </div>

            {apiKeysSaved && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm">
                מפתחות API נשמרו בהצלחה ✓
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-white/5">
              <Button onClick={async () => {
                const keys: { canvaApiKey?: string; canvaTemplateId?: string; geminiApiKey?: string } = {};
                if (apiCanvaKey) keys.canvaApiKey = apiCanvaKey;
                keys.canvaTemplateId = apiCanvaTemplateId;
                if (apiGeminiKey) keys.geminiApiKey = apiGeminiKey;
                await saveApiKeys(keys);
                setApiKeysSaved(true);
                setApiCanvaKey('');
                setApiGeminiKey('');
              }} icon={<Save size={18} />}>שמור מפתחות</Button>
            </div>
          </div>
        </Card>
      )}

      {/* Proposal Templates (admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><FileText size={18} className="text-amber-400" /> תבניות הצעות מחיר</span>} subtitle="ברירת מחדל לשלבי עבודה, חבילות ותנאים" />
          <div className="mt-4 space-y-6">
            {/* Default Phases */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-300">שלבי ברירת מחדל</h4>
                <button
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  onClick={() => {
                    const current = localSettings.proposalPhasesTemplate || [];
                    setLocalSettings({
                      ...localSettings,
                      proposalPhasesTemplate: [...current, { number: current.length + 1, title: '', description: '' }],
                    });
                  }}
                >
                  <Plus size={12} /> הוסף שלב
                </button>
              </div>
              <div className="space-y-2">
                {(localSettings.proposalPhasesTemplate || []).map((phase: ProposalPhase, idx: number) => (
                  <div key={idx} className="bg-white/5 rounded-xl p-3 border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">שלב {idx + 1}</span>
                      <button className="text-red-400 hover:text-red-300 text-xs" onClick={() => {
                        const newPhases = (localSettings.proposalPhasesTemplate || []).filter((_: ProposalPhase, i: number) => i !== idx).map((p: ProposalPhase, i: number) => ({ ...p, number: i + 1 }));
                        setLocalSettings({ ...localSettings, proposalPhasesTemplate: newPhases });
                      }}>הסר</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="כותרת"
                        value={phase.title}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newPhases = [...(localSettings.proposalPhasesTemplate || [])];
                          newPhases[idx] = { ...newPhases[idx], title: e.target.value };
                          setLocalSettings({ ...localSettings, proposalPhasesTemplate: newPhases });
                        }}
                      />
                      <Input
                        placeholder="משך (למשל: שבוע 1)"
                        value={phase.duration || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newPhases = [...(localSettings.proposalPhasesTemplate || [])];
                          newPhases[idx] = { ...newPhases[idx], duration: e.target.value };
                          setLocalSettings({ ...localSettings, proposalPhasesTemplate: newPhases });
                        }}
                      />
                    </div>
                    <Input
                      placeholder="תיאור"
                      value={phase.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const newPhases = [...(localSettings.proposalPhasesTemplate || [])];
                        newPhases[idx] = { ...newPhases[idx], description: e.target.value };
                        setLocalSettings({ ...localSettings, proposalPhasesTemplate: newPhases });
                      }}
                      className="mt-2"
                    />
                  </div>
                ))}
                {(!localSettings.proposalPhasesTemplate || localSettings.proposalPhasesTemplate.length === 0) && (
                  <p className="text-xs text-gray-600 text-center py-2">אין שלבי ברירת מחדל. לחץ "הוסף שלב" כדי להגדיר תבנית.</p>
                )}
              </div>
            </div>

            {/* Default Packages */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-gray-300">חבילות ברירת מחדל</h4>
                <button
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                  onClick={() => {
                    const current = localSettings.proposalPackagesTemplate || [];
                    setLocalSettings({
                      ...localSettings,
                      proposalPackagesTemplate: [...current, { name: '', isRecommended: false, services: [], monthlyPrice: 0 }],
                    });
                  }}
                >
                  <Plus size={12} /> הוסף חבילה
                </button>
              </div>
              <div className="space-y-2">
                {(localSettings.proposalPackagesTemplate || []).map((pkg: ProposalPackage, idx: number) => (
                  <div key={idx} className={`bg-white/5 rounded-xl p-3 border ${pkg.isRecommended ? 'border-amber-500/40' : 'border-white/10'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">חבילה {idx + 1}</span>
                        <label className="flex items-center gap-1 text-xs text-amber-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={pkg.isRecommended}
                            onChange={(e) => {
                              const newPkgs = (localSettings.proposalPackagesTemplate || []).map((p: ProposalPackage, i: number) => ({ ...p, isRecommended: i === idx ? e.target.checked : false }));
                              setLocalSettings({ ...localSettings, proposalPackagesTemplate: newPkgs });
                            }}
                            className="rounded border-white/20"
                          />
                          מומלצת
                        </label>
                      </div>
                      <button className="text-red-400 hover:text-red-300 text-xs" onClick={() => {
                        setLocalSettings({
                          ...localSettings,
                          proposalPackagesTemplate: (localSettings.proposalPackagesTemplate || []).filter((_: ProposalPackage, i: number) => i !== idx),
                        });
                      }}>הסר</button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="שם החבילה"
                        value={pkg.name}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newPkgs = [...(localSettings.proposalPackagesTemplate || [])];
                          newPkgs[idx] = { ...newPkgs[idx], name: e.target.value };
                          setLocalSettings({ ...localSettings, proposalPackagesTemplate: newPkgs });
                        }}
                      />
                      <Input
                        placeholder="מחיר חודשי"
                        type="number"
                        value={pkg.monthlyPrice || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const newPkgs = [...(localSettings.proposalPackagesTemplate || [])];
                          newPkgs[idx] = { ...newPkgs[idx], monthlyPrice: Number(e.target.value) };
                          setLocalSettings({ ...localSettings, proposalPackagesTemplate: newPkgs });
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(!localSettings.proposalPackagesTemplate || localSettings.proposalPackagesTemplate.length === 0) && (
                  <p className="text-xs text-gray-600 text-center py-2">אין חבילות ברירת מחדל. לחץ "הוסף חבילה" כדי להגדיר תבנית.</p>
                )}
              </div>
            </div>

            {/* Default Terms */}
            <div>
              <h4 className="text-sm font-semibold text-gray-300 mb-2">תנאים ברירת מחדל</h4>
              <Textarea
                value={(localSettings.proposalTermsTemplate || []).join('\n')}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setLocalSettings({ ...localSettings, proposalTermsTemplate: e.target.value.split('\n') });
                }}
                rows={4}
                placeholder="כל שורה תהפוך לתנאי ברשימת התנאים..."
              />
            </div>

            {/* Save button */}
            <div className="flex justify-end pt-3 border-t border-white/5">
              <Button onClick={() => {
                updateSettings(localSettings);
              }} icon={<Save size={16} />}>שמור תבניות</Button>
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
