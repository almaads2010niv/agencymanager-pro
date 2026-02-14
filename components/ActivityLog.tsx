import React from 'react';
import { useData } from '../contexts/DataContext';
import { Users, UserPlus, Briefcase, Receipt, CreditCard, ArrowRightLeft, Trash2, Edit2, Zap } from 'lucide-react';

const getActivityIcon = (actionType: string) => {
  if (actionType.includes('client')) return <Users size={14} />;
  if (actionType.includes('lead_converted')) return <ArrowRightLeft size={14} />;
  if (actionType.includes('lead')) return <UserPlus size={14} />;
  if (actionType.includes('deal')) return <Briefcase size={14} />;
  if (actionType.includes('expense')) return <Receipt size={14} />;
  if (actionType.includes('payment') || actionType.includes('generated')) return <CreditCard size={14} />;
  return <Zap size={14} />;
};

const getActivityColor = (actionType: string) => {
  if (actionType.includes('added') || actionType.includes('converted') || actionType.includes('generated')) return 'text-emerald-400 bg-emerald-400/10';
  if (actionType.includes('updated')) return 'text-primary bg-primary/10';
  if (actionType.includes('deleted')) return 'text-red-400 bg-red-400/10';
  return 'text-gray-400 bg-white/5';
};

const getActionBadge = (actionType: string) => {
  if (actionType.includes('added')) return <Edit2 size={10} className="text-emerald-400" />;
  if (actionType.includes('updated')) return <Edit2 size={10} className="text-primary" />;
  if (actionType.includes('deleted')) return <Trash2 size={10} className="text-red-400" />;
  if (actionType.includes('converted')) return <ArrowRightLeft size={10} className="text-violet-400" />;
  if (actionType.includes('generated')) return <Zap size={10} className="text-amber-400" />;
  return null;
};

const formatTimeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'עכשיו';
  if (diffMins < 60) return `לפני ${diffMins} דקות`;
  if (diffHours < 24) return `לפני ${diffHours} שעות`;
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  return date.toLocaleDateString('he-IL');
};

interface ActivityLogProps {
  limit?: number;
}

const ActivityLog: React.FC<ActivityLogProps> = ({ limit = 15 }) => {
  const { activities } = useData();

  const recentActivities = activities.slice(0, limit);

  if (recentActivities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-600">
        <Zap size={32} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">אין פעילות אחרונה</p>
        <p className="text-xs text-gray-700 mt-1">פעולות שתבצע יופיעו כאן</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {recentActivities.map((activity, index) => (
        <div
          key={activity.id}
          className="flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/[0.02] transition-colors group"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          {/* Timeline dot */}
          <div className="relative flex flex-col items-center">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${getActivityColor(activity.actionType)}`}>
              {getActivityIcon(activity.actionType)}
            </div>
            {index < recentActivities.length - 1 && (
              <div className="w-px h-3 bg-white/5 mt-1" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-200 truncate">{activity.description}</span>
              {getActionBadge(activity.actionType)}
            </div>
          </div>

          {/* Time */}
          <span className="text-[10px] text-gray-600 whitespace-nowrap flex-shrink-0 group-hover:text-gray-500 transition-colors">
            {formatTimeAgo(activity.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
};

export default ActivityLog;
