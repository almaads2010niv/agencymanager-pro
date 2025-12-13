import React, { useState, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { Download, Upload, Save } from 'lucide-react';
import { Card, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { Input, Checkbox } from './ui/Form';

const Settings: React.FC = () => {
  const { settings, services, updateSettings, updateServices, exportData, importData } = useData();
  const [localSettings, setLocalSettings] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
                    onClick={() => {
                       const newServices = [...services];
                       newServices[index].isActive = !newServices[index].isActive;
                       updateServices(newServices);
                    }}
                    className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 duration-300 ${service.isActive ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]' : 'bg-gray-700'}`}
                 >
                   <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${service.isActive ? 'translate-x-0' : '-translate-x-5'}`}></div>
                 </button>
               </div>
             </div>
           ))}
        </div>
      </Card>

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
                <div className="text-sm text-gray-500 mt-1">שחזר מגיבוי (דרוס קיים)</div>
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