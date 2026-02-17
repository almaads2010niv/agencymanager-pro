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

---

## סשן 12 (17.02.2026) — מולטי-טננט + פרילנסר + הקלטה + רעיונות + מאגר ידע

**מה ביקשת:**
סעיפים 4, 7, 8, 9, 10 מהרודמאפ ביחד — 5 פיצ'רים:
1. הקלטה קולית מהדפדפן + AI סיכום
2. עמוד רעיונות (קנבן per-client) + AI generate
3. דף מקור ידע — העלאת מסמכים + AI סיכום
4. מיני מערכת לפרילנסרים — תפקיד freelancer עם נראות מצומצמת
5. מולטי-טננט — הפרדת עסקים עם tenant_id

**מה עשיתי:**

### 1. מולטי-טננט
- טבלת tenants חדשה + tenant_id UUID בכל 15 הטבלאות
- Helper functions: `current_tenant_id()`, `is_admin()`
- כל ה-RLS policies עודכנו עם `tenant_id = current_tenant_id()`
- AuthContext: +tenantId, +tenantName

### 2. תפקיד פרילנסר
- UserRole חדש: 'freelancer'
- RLS: פרילנסר רואה רק לקוחות/לידים עם `assigned_to = auth.uid()`
- DEFAULT_FREELANCER_PERMISSIONS: dashboard, clients, leads, deals, calendar
- Dashboard מיני לפרילנסרים (לקוחות + לידים שמוקצים לו)
- Layout: badge אמבר עם אייקון Wrench + תווית "פרילנסר"
- Settings: בחירת תפקיד (פרילנסר/צופה) ביצירת משתמש

### 3. הקלטה קולית מהדפדפן
- Hook חדש: `useVoiceRecorder` — MediaRecorder + AudioContext + AnalyserNode
- קומפוננטה: VoiceRecorderButton — 3 מצבים (idle/recording/processing)
- אוטומטית: הקלטה → העלאה → תמלול → סיכום AI → שמירה כנוטה
- שולב בClientProfile ו-LeadProfile ליד "העלה הקלטה"

### 4. עמוד רעיונות (Kanban)
- טבלת ideas חדשה (5 סטטוסים: draft/active/in_progress/done/archived)
- @dnd-kit גרירה בין עמודות
- פילטר לפי לקוח, חיפוש, priority badges, due dates
- AI Generate: Edge Function generate-idea עם Gemini 2.0 Flash-Lite
- Ideas.tsx: קנבן מלא עם מודלים ל-add/edit/delete

### 5. מאגר ידע (Knowledge Base)
- טבלת knowledge_articles (7 קטגוריות, full-text search)
- Storage bucket 'knowledge' (20MB, PDF/docs/images)
- AI Summarize: Edge Function summarize-document
- KnowledgeBase.tsx: חיפוש, טאבים קטגוריות, רשת כרטיסים, העלאת קובץ

**מה נשאר להריץ (בסדר!):**
1. SQL: `supabase-multi-tenant-migration.sql` (ראשון!)
2. SQL: `supabase-freelancer-migration.sql`
3. SQL: `supabase-ideas-migration.sql`
4. SQL: `supabase-knowledge-migration.sql`
5. Deploy: `npx supabase functions deploy create-user --project-ref rxckkozbkrabpjdgyxqm`
6. Deploy: `npx supabase functions deploy generate-idea --project-ref rxckkozbkrabpjdgyxqm`
7. Deploy: `npx supabase functions deploy summarize-document --project-ref rxckkozbkrabpjdgyxqm`
8. Git commit + push

---

## סשן 13 (17.02.2026) — באג פיקסים + שיפורי פיצ'רים

**מה ביקשת:**
תיקון שגיאת POST 400 בהוצאות, + שיפורים בקנבן ובסוכנים.

**מה עשיתי:**
- **תיקון INSERT 400 בהוצאות:** current_tenant_id() מחזיר NULL → תוקן עם COALESCE + withTenant fallback
- **תיקון Kanban drag & drop:** attributes היו על grip handle ולא על root — תוקן
- **מיון עמודות בלידים:** כל 8 העמודות sortable (היה רק 2)
- **AI Ideas + Social scraping:** 3 שדות URL (פייסבוק, אינסטגרם, אתר) → Edge Function שולף תוכן ומנתח

---

## סשן 14 (17.02.2026) — Slug Routing + ניהול סוכנויות

**מה ביקשת:**
ניתוב לפי slug, דף ניהול סוכנויות לסופר אדמין, לינק ישיר לכל סוכנות.

**מה עשיתי:**
- **HashRouter → BrowserRouter:** מיגרציה מלאה
- **URL חדש:** `/a/:tenantSlug/*` (למשל `/a/my-agency/dashboard`)
- **TenantManagement.tsx:** רשימת סוכנויות, הוספה/עריכה, ניהול משתמשים, העתקת לינק
- **Edge Function manage-tenants:** list/create/update/add-user/remove-user/update-tenant-user

---

## סשן 15 (17.02.2026) — 🔒 תיקון קריטי: בידוד נתונים בין סוכנויות

**מה ביקשת:**
"הסוכנות הסקיפים עדיין רואה את הנתונים שלי" → בדוק וסגור את כל הפרצות.

**מה עשיתי:**

### 🚨 בעיית בידוד נתונים (7 שכבות של תיקונים!)

1. **current_tenant_id() דולף:** COALESCE fallback ל-DEFAULT_TENANT → כל משתמש חדש ראה את הנתונים הראשיים
   - תיקון: fallback ל-UUID בלתי אפשרי (000...000)

2. **AuthContext יוצר אוטומטית user_roles:** כל login חדש קיבל גישה לטננט ברירת מחדל
   - תיקון: לא יוצר אוטומטית, מציג NoTenantScreen

3. **RLS Permissive — הבעיה האמיתית:** פוליסות USING(true) ישנות + חדשות = OR = הכל גלוי!
   - תיקון: DROP ALL old policies, יצירת פוליסות חדשות strict ל-19 טבלאות
   - FORCE ROW LEVEL SECURITY על הכל

4. **signals-webhook hardcoded DEFAULT_TENANT:**
   - תיקון: dynamic tenant resolution מ-webhook secret → matched entity → fallback

5. **Settings שורה אחת (id=1) לכולם:**
   - תיקון: PK שונה מ-id ל-tenant_id, הוסר id column

6. **Edge Functions קוראים settings בלי tenant filter:**
   - תיקון: כל 8 Edge Functions עודכנו עם .eq('tenant_id', callerTenantId)

7. **Settings 409 Conflict:**
   - תיקון: DROP PK on id, ADD PRIMARY KEY (tenant_id)

### ✅ פיצ'ר חדש: Toggle שכיר/ה
- עמודת `is_salaried` boolean בsettings
- Toggle switch בSettings.tsx
- שדה משכורת מופיע רק כשהטוגל פעיל

### SQL שהורץ:
- `supabase-fix-tenant-isolation.sql`
- `supabase-fix-rls-complete.sql`
- `supabase-fix-settings-tenant.sql`
- `supabase-fix-settings-pk.sql`

### Edge Functions שנפרסו מחדש: כל 8 + signals-webhook

### Commits: 9368bd4, ca805be, 35b80d3, 26d135e

---

## סשן 16 (17.02.2026) — Signals OS: שליחת שאלון + PDF → המלצות AI

**מה ביקשת:**
1. "למה שאני מכניס ליד חדש אני לא יכול לשלוח לו שאלון SIGNAL"
2. "אם אני רוצה להדביק את ה-PDF של האבחון ואז שה-AI ייצר לי המלצות בבלוק המלצות AI"
3. "אם זה מפעולה יזומה של שליחת הלינק מה-CRM אז הוובהוק ישלח את זה ואז אני רוצה המלצות"
4. "צבא של סוכני AI יעשו למערכת הזאת" — מה אפשר להוסיף
5. עדכון קבצי LOG

**מה עשיתי:**

### 1. בלוק Signals OS בפרופיל ליד (LeadProfile.tsx)
- **מצב 1 (אין נתוני אישיות):**
  - אינדיקטור אמבר "טרם נשלח שאלון"
  - כפתור WhatsApp ירוק — שולח הודעה מוכנה עם לינק מותאם (email, name, phone, lead_id)
  - כפתור "העתק לינק לשאלון"
  - תצוגה מקדימה של ההודעה
  - כפתור "העלה PDF של אבחון → קבל המלצות AI"
- **מצב 2 (יש נתוני אישיות):**
  - כל תצוגת הארכיטיפים כמו קודם
  - + כפתור "העלה PDF לניתוח מעמיק"
  - + כפתור "ייצר המלצות AI" (מנתוני personality)

### 2. העלאת PDF אבחון → המלצות AI
- המשתמש מעלה PDF של דוח Signals OS
- ה-PDF נשלח כ-FormData ל-Edge Function `ai-recommendations`
- Gemini 3 Pro קורא את ה-PDF (inline_data) ומייצר המלצות מעמיקות:
  - ניתוח פרופיל אישיותי
  - איך לדבר עם הליד
  - מה לא לעשות
  - סוג ההצעה שתעבוד הכי טוב

### 3. Auto-trigger המלצות מוובהוק
- כשנתוני personality מגיעים מ-Signals OS → useEffect מזהה ומפעיל `handleGetRecommendations` אוטומטית
- רק אם אין המלצות קיימות (לא מכפיל)

### 4. Edge Function `ai-recommendations` שודרג
- תומך ב-JSON (קיים) + FormData עם PDF (חדש)
- PDF מועבר ל-Gemini כ-base64 inline_data
- Prompt מורחב: 9 סעיפי המלצות (במקום 5) כשיש PDF
- maxOutputTokens הועלה ל-4096

### 5. צבא סוכני AI — חזון
- 10 סוכנים אפשריים ב-3 רמות (lead nurture, alerts, reports, proposals, scheduling, content, billing...)
- ארכיטקטורה: Agent Orchestrator + Edge Functions + Cron

### Commits: 746146d (בלוק Signals), 2dcfb64 (PDF + auto-trigger)
### Edge Functions deployed: ai-recommendations

---

## סשן 17 (17.02.2026) — ייבוא לקוחות עבר מאקסל

**מה ביקשת:**
"יש לי קובץ ישן של לקוחות עבר. אפשר שתסרוק אותו ותשתול אותו בלידים? יש בו שם, עסק, טלפון ושאר העמודות לא רלוונטיות. מבחינת סטטוס ליד — לא רלוונטי. מבחינת תאריך — 1.1.26. אני רוצה מאגר מידע."

**מה עשיתי:**
- קראתי את `לקוחות פוטנציאליים.xlsx` (177 שורות) עם Node.js xlsx library
- נרמלתי טלפונים: `+972` → `0`, הסרת מקפים/רווחים, `#ERROR!` → ריק
- יצרתי סקריפט Node.js שמכניס ישירות ל-Supabase דרך REST API:
  - סטטוס: `"לא רלוונטי"`
  - תאריך: `2026-01-01`
  - ערוץ מקור: `"אחר"`
  - הערות: קטגוריה מקורית (לידים/מוצר)
- הרצתי ב-4 batches של 50 — **177 לידים יובאו בהצלחה!**
- אומת ב-SQL Editor: 187 לידים בסטטוס "לא רלוונטי" (177 חדשים + 10 קיימים)

### כלים ששימשו:
- `xlsx` npm package לקריאת אקסל
- `npx supabase projects api-keys` לקבלת service_role key
- Supabase REST API: `POST /rest/v1/leads` עם service_role Bearer
