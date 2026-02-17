import { Service, AgencySettings } from './types';

export const INITIAL_SERVICES: Service[] = [
  { serviceKey: 'facebook_ads', label: 'קמפיינים בפייסבוק', isActive: true },
  { serviceKey: 'instagram_ads', label: 'קמפיינים באינסטגרם', isActive: true },
  { serviceKey: 'tiktok_ads', label: 'קמפיינים בטיקטוק', isActive: true },
  { serviceKey: 'google_ads', label: 'Google Ads', isActive: true },
  { serviceKey: 'taboola', label: 'Taboola/Outbrain', isActive: true },
  { serviceKey: 'easy', label: 'Easy קידום', isActive: true },
  { serviceKey: 'google_my_business', label: 'Google My Business', isActive: true },
  { serviceKey: 'social_management', label: 'ניהול סושיאל אורגני', isActive: true },
  { serviceKey: 'consulting', label: 'ייעוץ אסטרטגי', isActive: true },
  { serviceKey: 'graphics', label: 'עיצוב גרפי', isActive: true },
  { serviceKey: 'video_editing', label: 'עריכת וידאו', isActive: true },
  { serviceKey: 'mailing_sms', label: 'דיוור, SMS', isActive: true },
];

export const DEFAULT_SETTINGS: AgencySettings = {
  agencyName: 'הסוכנות שלי',
  ownerName: 'מנהל',
  targetMonthlyRevenue: 50000,
  targetMonthlyGrossProfit: 30000,
  employeeSalary: 20000,
  isSalaried: false,
  hasCanvaKey: false,
  hasGeminiKey: false,
  hasSignalsWebhookSecret: false,
};

export const MESSAGE_PURPOSES = [
  { key: 'follow_up', label: 'מעקב' },
  { key: 'meeting_reminder', label: 'תזכורת פגישה' },
  { key: 'proposal_sent', label: 'הצעת מחיר' },
  { key: 'thank_you', label: 'תודה' },
  { key: 'check_in', label: 'בדיקת סטטוס' },
  { key: 'intro', label: 'הכרות ראשונית' },
  { key: 'renewal', label: 'חידוש חוזה' },
  { key: 'service_update', label: 'עדכון שירות' },
  { key: 'performance_report', label: 'דוח ביצועים' },
  { key: 'custom', label: 'אחר' },
] as const;
