# NIV PROMPT — AgencyManager Pro
> סיכום פרומפטים ותשובות לכל סשן עבודה

---

## סשן 1 (14.02.2026) — אודיט ותיקון באגים

**מה ביקשת:**
תבדוק את הקוד ותמצא דברים שבורים או בעייתיים.

**מה עשיתי:**
סריקה מלאה של כל הקוד. מצאתי 19 בעיות ב-4 רמות חומרה ותיקנתי הכל:
- טיפוסי `any` בכל מקום → יצרתי interfaces מסודרים (ClientRow, LeadRow וכו')
- JSON.parse ללא try-catch → helper בטוח
- convertLeadToClient לא אטומי → הוספתי rollback
- console.log של דיבוג → הוסרו
- confirm() native → מודלים מעוצבים
- בעיות RTL (ml/mr → ms/me)
- נגישות (aria-labels, role)
- ועוד 12 תיקונים

---

## סשן 2 (14.02.2026) — 9 פיצ'רים חדשים

**מה ביקשת:**
רשימה של 9 פיצ'רים שרצית (הכל חוץ מ-PDF reports):
1. מחשבון מס ישראלי
2. מערכת הרשאות רב-משתמשית
3. תיקון YoY Growth
4. Badge התראות בסיידבר
5. עריכה/מחיקת הוצאות
6. יצירת חובות חודשיים אוטומטית
7. דף פרופיל לקוח
8. חיפוש גלובלי (Ctrl+K)
9. לוג פעילות

**מה עשיתי:**
בניתי את כל 9 הפיצ'רים:
- **מחשבון מס:** מדרגות מס 2025-2026, ביטוח לאומי, נקודות זיכוי, שכיר+עצמאי. דף ייעודי + KPI בדשבורד
- **הרשאות:** admin/viewer, AuthContext חדש, סיידבר מותנה, הרשאות ברמת דף
- **YoY:** החלפת 10% hardcoded בחישוב אמיתי
- **Badges:** לידים באיחור + חובות לא שולמו
- **הוצאות:** CRUD מלא עם מודלים לעריכה/מחיקה
- **חובות אוטומטיים:** כפתור שיוצר records לכל הלקוחות הפעילים
- **פרופיל לקוח:** /clients/:id עם כל ההיסטוריה
- **חיפוש:** CommandPalette עם ניווט מקלדת
- **לוג:** activity_log בsupabase + תצוגה בדשבורד

---

## סשן 3 (14.02.2026) — תמה, תיקון Viewer, העלאת קבצים

**מה ביקשת:**
מצב בהיר/כהה, תיקון תפקיד viewer, העלאת חוזים ללקוחות.

**מה עשיתי:**
- Toggle בהיר/כהה בדשבורד עם ThemeContext
- תיקון viewer שלא קיבל הרשאות נכון
- מערכת העלאת קבצים (חוזים/מסמכים) בפרופיל לקוח
- Storage bucket "contracts" בSupabase

---

## סשן 4 (14.02.2026) — היסטוריית ריטיינר, הרשאות מתקדמות, RLS

**מה ביקשת:**
מעקב שינויי ריטיינר, הרשאות ברמת דף ל-viewers, RLS מלא, סנכרון משתמשים.

**מה עשיתי:**
- טבלת retainer_changes למעקב שינויי מחיר
- page_permissions JSON עם בחירה אילו דפים viewer רואה
- RLS policies לכל הטבלאות
- תיקון סנכרון — התאמה לפי email לviewers שנוצרו מראש
- תיקון UUID casting ב-RLS

---

## סשן 5 (14.02.2026) — Edge Function, נראות לידים, CRM מתקדם

**מה ביקשת:**
- אדמין יוצר חשבונות (לא הרשמה עצמית) — דחית את הגישה של self-registration
- Viewer רואה מערכת ריקה — צריך תיקון
- שדרוגי CRM: מטפל מוקצה, היסטוריית הערות, לחיצה לצפייה

**מה עשיתי:**
- **Edge Function create-user:** אדמין יוצר חשבון ישירות, בלי הרשמה עצמית
- **תיקון נראות:** RLS + frontend — viewers רואים את כל הלידים
- **CRM מתקדם:**
  - assigned_to (מטפל) על לקוחות עם dropdown
  - טבלת client_notes עם היסטוריה
  - שורת טבלה לחיצה → פרופיל
  - Quick stats bar, effort dots, inline editing

---

## סשן 6 (15.02.2026) — שדרוג ניהול לידים + AI + הצעות מחיר

**מה ביקשת:**
דף פרופיל ליד, תמלולי שיחות, המלצות AI, יצירת הצעות מחיר עם Canva.

**מה עשיתי:**
- **LeadProfile.tsx:** דף CRM מלא ללידים (דומה לClientProfile)
- **תמלולים:** טבלת call_transcripts, הזנה ידנית + העלאת אודיו
- **המלצות AI:** Edge Function עם Gemini, טבלת ai_recommendations, כרטיסים מתרחבים
- **הצעות Canva:** Edge Function שמתחבר ל-Canva Connect API, autofill template, export PDF
- **אבטחה:** API keys עוברים לserver-side בלבד

---

## סשן 7 (15.02.2026) — הודעות WhatsApp + תמלול אודיו

**מה ביקשת:**
יצירת הודעות WhatsApp חכמות ותמלול הקלטות שיחה.

**מה עשיתי:**
- **WhatsApp:** Edge Function שיוצר 3 וריאנטים (רשמי/חברי/ישיר), 10 סוגי מטרות, היסטוריית הודעות, wa.me deep link
- **תמלול:** Edge Function עם Gemini, העלאה לStorage, prompt בעברית עם זיהוי דוברים

---

## סשן 8 (15.02.2026) — תיקוני תמלול + Gemini Files API

**מה ביקשת:**
תמלול לא עובד — תתקן.

**מה עשיתי:**
6 iterations של תיקונים:
1. שיפור הודעות שגיאה
2. תיקון MIME type ל-M4A/MP4
3. הסרת תווים עבריים מנתיבי storage (400 Bad Request)
4. שיפור prompt עם separator מפורש
5. שדרוג ל-gemini-2.5-flash לאיכות עברית
6. **מעבר ל-Gemini Files API** — פתר את שגיאת הזיכרון 546 ב-Edge Functions. קבצי אודיו עולים קודם ל-Gemini file storage, ואז נשלחים כ-file_uri

---

## סשן 9 (15.02.2026) — סיכומי AI, עריכה inline, תיקון WhatsApp, שדרוג Gemini

**מה ביקשת:**
סיכומים אוטומטיים מAI, עריכת פרופילים, ותיקון WhatsApp שלא עובד.

**מה עשיתי:**
- **סיכומי AI:** 3 סוגים (תמלול, המלצות, הצעת מחיר) — Edge Function חדש
- **עריכה inline:** מודלי עריכה מלאים בClientProfile ו-LeadProfile
- **שדרוג Gemini:** ai-recommendations ו-summary → gemini-3-pro-preview
- **תיקון WhatsApp (4 ניסיונות!):**
  - ניסיון 1: responseMimeType → נכשל (לא נתמך ב-2.5-flash REST)
  - ניסיון 2: הסרת שדות לא נתמכים → עדיין ריק
  - ניסיון 3: שינוי status codes + debug → אישר שrawText ריק
  - ניסיון 4 (פתרון): מעבר ל-gemini-2.0-flash-lite — אין thinking parts, JSON אמין

---

## סשן 10 (16.02.2026) — שילוב Signals OS

**מה ביקשת:**
לחבר את Signals OS (מערכת אישיות/ארכיטיפים) לAMP כדי לראות אישיות של לידים.

**מה עשיתי:**
- Webhook מSignals OS → Edge Function בSupabase → עדכון ליד עם archetype
- עמודות חדשות: archetype, archetype_description על leads
- תצוגת אישיות מלאה בLeadProfile
- Badge אישיות בכרטיסי Kanban (אייקון Brain + שם ארכיטיפ)
- לינק embeddable עם email pre-filled לשאלון

---

## סשן 11 (17.02.2026) — Kanban + לוח שנה + סריקת קבלות AI

**מה ביקשת:**
3 פיצ'רים: (1) קנבן עם drag & drop ברוחב מלא, (2) לוח שנה חדש עם אירועים, (3) סריקת קבלות AI.

**מה עשיתי:**

### 1. Kanban Drag & Drop
- התקנת @dnd-kit (core, sortable, utilities)
- Layout מלא-רוחב ל-/leads ו-/calendar
- שכתוב מלא של KanbanView עם DndContext, עמודות droppable, כרטיסים sortable
- DragOverlay (ghost card), closestCorners collision
- כרטיסים מועשרים: שם, WhatsApp, עסק, טלפון, ערך, source, מטפל, תאריך מגע הבא, badge אישיות

### 2. לוח שנה
- טבלת calendar_events חדשה (SQL migration)
- react-big-calendar עם locale עברי
- 5 סוגי אירועים: שיחה, פגישה, זום, משימה, תזכורת
- Month/Week/Day + אירועים וירטואליים מתאריכי מגע של לידים
- מודלים ליצירה/עריכה/מחיקה עם קישור ללקוח/ליד

### 3. סריקת קבלות AI
- Edge Function process-receipt עם Gemini 2.0 Flash Vision
- חילוץ: ספק, סכום, תאריך, קטגוריה, תיאור מקבלה
- Storage bucket לקבלות
- מודל דו-שלבי: העלאה+תצוגה מקדימה → סקירה+עריכה → שמירת הוצאה
- מדד ביטחון עם צבעים (ירוק/צהוב/אדום)

**מה נשאר להריץ:**
1. SQL: `supabase-calendar-migration.sql`
2. SQL: `supabase-receipts-migration.sql`
3. Deploy: `npx supabase functions deploy process-receipt --project-ref rxckkozbkrabpjdgyxqm`
4. Git commit + push
