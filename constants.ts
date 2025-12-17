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
};

export const STORAGE_KEY = 'agency_manager_db_v1';
