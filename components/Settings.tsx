import React, { useState, useRef, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { useAuth } from '../contexts/AuthContext';
import { Download, Upload, Save, Users, Trash2, Plus, Shield, Eye } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Checkbox } from './ui/Form';
import { Modal } from './ui/Modal';

const Settings: React.FC = () => {
  const { settings, services, updateSettings, updateServices, exportData, importData } = useData();
  const { isAdmin, allUsers, refreshUsers, addViewer, removeUser } = useAuth();
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newViewerName, setNewViewerName] = useState('');
  const [newViewerEmail, setNewViewerEmail] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

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
          <CardHeader title="ניהול משתמשים" />
          <div className="space-y-4">
            {/* Existing users */}
            <div className="space-y-2">
              {allUsers.map(u => (
                <div key={u.id} className="flex items-center justify-between bg-[#0B1121] p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-violet-500/10 text-violet-400'}`}>
                      {u.role === 'admin' ? <Shield size={16} /> : <Eye size={16} />}
                    </div>
                    <div>
                      <div className="text-white text-sm font-medium">{u.display_name}</div>
                      <div className="text-[10px] text-gray-500">{u.role === 'admin' ? 'מנהל' : 'צופה (פרילנסר)'}</div>
                    </div>
                  </div>
                  {u.role !== 'admin' && (
                    <Button variant="ghost" onClick={() => setConfirmRemoveId(u.user_id)} className="p-1.5 text-red-400 hover:text-red-300" icon={<Trash2 size={14} />} aria-label="הסר משתמש" />
                  )}
                </div>
              ))}
              {allUsers.length === 0 && (
                <div className="text-center text-gray-600 py-6 text-sm">
                  לא נמצאו משתמשים (טבלת user_roles לא קיימת בסופאבייס)
                </div>
              )}
            </div>

            {/* Add viewer */}
            {showAddUser ? (
              <div className="p-4 bg-[#0B1121] rounded-xl border border-white/10 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Input label="שם תצוגה" value={newViewerName} onChange={e => setNewViewerName(e.target.value)} placeholder="שם הפרילנסר" />
                  <Input label="אימייל" type="email" value={newViewerEmail} onChange={e => setNewViewerEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                {userError && <div className="text-red-400 text-sm">{userError}</div>}
                <div className="text-xs text-gray-500">
                  * הפרילנסר צריך להירשם ב-Supabase Auth עם אותו אימייל. לאחר ההרשמה הוא יקבל הרשאת צפייה אוטומטית.
                </div>
                <div className="flex gap-3 justify-end">
                  <Button variant="ghost" onClick={() => { setShowAddUser(false); setUserError(null); }}>ביטול</Button>
                  <Button onClick={async () => {
                    if (!newViewerName.trim()) { setUserError('שם תצוגה נדרש'); return; }
                    const err = await addViewer(newViewerEmail, newViewerName);
                    if (err) setUserError(err);
                    else {
                      setNewViewerName('');
                      setNewViewerEmail('');
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
            <Button variant="danger" onClick={() => { if (confirmRemoveId) { removeUser(confirmRemoveId); setConfirmRemoveId(null); } }}>הסר משתמש</Button>
          </div>
        </div>
      </Modal>

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