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

---

## סשן 18 (17.02.2026) — WhatsApp מותאם אישיות + חילוץ PDF + העתקת מפתחות

**מה ביקשת:**
1. "ביקשתי גם פעולת ווצאפ מיועדת בהתאם ל-Signals" — הודעות WhatsApp צריכות להיות מותאמות לפרופיל אישיות
2. "בבלוק של סיגנל, אני לא יכול לערוך את תוכן שליחת השאלון ללקוח" — הודעת שאלון hardcoded
3. "מה קורה שאני מזין ידנית את ה-PDF? למה אין לי גם את האפשרות?" — PDF לא שומר אישיות ל-DB
4. "תכניס את כל המפתחות שיש לי בסוכנות הראשית לסוכנות השניה הסקיפים"
5. "כל מה שאנו מפתחים כרגע בראשי, עובר/יעבור לכולם כן?"

**מה עשיתי:**

### 1. WhatsApp מותאם אישיות Signals
- Edge Function `generate-whatsapp-messages` מקבל עכשיו `personality` param
- בונה הקשר אישיות (ארכיטיפ, סיכון נטישה, תגיות חכמות)
- מדריך סגנון: איך לדבר, ממה להימנע, מהירות סגירה, הצעות שעובדות, דגלים אדומים
- כשיש personality → 3 וריאנטים מותאמים לארכיטיפ (לא גנריים)
- LeadProfile: badge סגול, כפתור "🧠 צור הודעות מותאמות"

### 2. הודעת שאלון ניתנת לעריכה
- שינוי מטקסט hardcoded → textarea עם edit/reset
- מצבים: `signalsMessageEditing`, `signalsMessageText`
- כפתורי "ערוך הודעה" / "חזור לטקסט ברירת מחדל"

### 3. PDF → חילוץ אישיות → שמירה ל-DB
- בעיה: טבלת `signals_personality` הייתה ריקה! PDF יצר רק המלצות טקסט, לא שמר אישיות מובנית
- תיקון: שלב 7 חדש ב-`ai-recommendations`:
  - Gemini 2.0-flash-lite מחלץ JSON מובנה (ארכיטיפ, ציונים, cheat sheets)
  - Upsert ל-signals_personality (questionnaire_version: 'pdf-import')
  - pdfLeadId הורם ל-scope חיצוני
- LeadProfile: delay 1.5 שניות אחרי PDF upload לסנכרון realtime

### 4. העתקת מפתחות API לסוכנות הסקיפים
- העתקת `gemini_api_key` + `signals_webhook_secret` מעלמה? להסקיפים
- PATCH דרך Supabase REST API עם service_role key

### 5. תשובה: Code → כל הסוכנויות?
- **Frontend (Vercel):** ✅ אוטומטי — git push → deploy לכולם
- **Edge Functions:** ✅ אחרי deploy — פונקציה אחת לכולם
- **נתונים:** ❌ מופרדים — RLS + tenant_id
- **הגדרות (keys):** ❌ מופרדים — כל סוכנות מגדירה בנפרד

### Edge Functions deployed: generate-whatsapp-messages, ai-recommendations
### Commits: a3c36e9, ebf1e29, bada4ad

---

## סשן 19 (18.02.2026) — תיקון PDF מלא + הורדת קבצים + סיכום אמיתי + תכנון צבא סוכנים

**מה ביקשת:**
1. "אין קליטה מלאה של דוח המודיעין" — PDF של Signals OS נחתך לשורות קצרות
2. "אין לי אפשרות להוריד" במאגר ידע — חסר כפתור הורדה
3. "הסיכום לא נכון כי התסריט מדבר על קאנטרי והסיכום מדבר על סוכנות" — סיכום מבוסס על שם קובץ
4. "בוא נמשיך לדבר על צבא של סוכנים" — תכנון מלא + בחירת סוכנים
5. "אני רוצה שתרשום בפרויקט קובץ רעיונות NIV_IDEAS.txt"

**מה עשיתי:**

### 1. תיקון חילוץ PDF מלא
- בעיה: Prompt ביקש "תיאור קצר" → Gemini תימצת הכל לשורה אחת
- תיקון: Prompt מבקש **טקסט מלא** ("אל תתמצת ואל תקצר!")
- שדות חדשים: closing_line, calibration_questions, fomo_message, call_script
- user_report + business_report נשמרים (היו null)
- maxOutputTokens: 2048 → 8192
- הוסר התנאי `!personality` — תמיד מעדכן מ-PDF חדש
- UI: בלוקים חדשים "דוח מודיעין עסקי" + "דוח אישי"
- UI: cheat sheets תומכים טקסט ארוך (whitespace-pre-wrap)

### 2. כפתור הורדה במאגר ידע
- אייקון Download בכרטיס (hover)
- כפתור "הורד" במודל עריכה ליד שם הקובץ

### 3. תיקון סיכום מסמכים
- בעיה: Frontend שלח רק `"קובץ: שם_הקובץ"` — Gemini המציא סיכום מדמיון!
- תיקון: Edge Function מקבל את **הקובץ עצמו** כ-FormData
- Gemini 2.0-flash (לא lite) קורא PDF דרך inline_data
- Frontend שולח FormData עם הקובץ, לא JSON עם שם

### 4. תכנון צבא סוכני AI
- דיון על ההבדל בין אוטומציות לסוכני AI
- הצגת 18 סוכנים אפשריים ב-3 רמות
- ניב בחר 11 סוכנים + הוסיף 3 רעיונות חדשים:
  - **#19 מרגל תחרותי**: ליד חדש → סקירת מתחרים + FOMO מותאם לארכיטיפ
  - **#20 נוטבוק חכם**: context brain per client (כמו Google NotebookLM ב-CRM)
  - **#21 סוכן על**: תאר את העסק → המערכת בונה סוכן AI מותאם
- סדר בנייה: 4 גלים (שבועות 1-2, 3-4, 5-8, חודש 3+)

### 5. NIV_IDEAS.txt
- קובץ רעיונות מלא בroot של הפרויקט
- 14 סוכנים עם הסבר מפורט לכל אחד
- ארכיטקטורה, טבלאות DB חדשות, תלויות, סדר בנייה

### Edge Functions deployed: ai-recommendations, summarize-document
### Commits: faf132f, a5f9290, bc427d8
### New files: NIV_IDEAS.txt

---

## סשן 20 (19.02.2026) — 8 רעיונות חדשים + סנכרון Signals V2

**מה ביקשת:**
1. 8 רעיונות חדשים לפיצ'רים (טלגרם, תסריטים, מתחרים, notebook, PDF, salesforce, שירותים דינמיים, היסטוריית רכישות)
2. שילוב דוגמת PDF של תוכנית עבודה (סטודיו נירית ממן) כבסיס לעיצוב
3. לוגו + פלטת צבעים מותאמת per-tenant למסמכים
4. סנכרון Signals OS V2 → AMP (מנגנון ניתוח אישיות השתנה)

**מה מצאתי בחקירת Signals OS V2 vs AMP:**

### 🔄 מה השתנה ב-Signals OS (שחסר ב-AMP):
- **Business Intelligence V2** — שכבה שלמה חדשה:
  - HeroCard (פרופיל מהיר: ארכיטיפ, סיכון, כוכבי עדיפות, אחוז סגירה)
  - 3 Action Items (מתועדפים עם why + how)
  - Quick Script (פתיחה + שאלת מפתח + סגירה)
  - תסריט 5 דלתות מלא (דיאלוג מילה-במילה לכל מצב)
  - Profile Briefing (מי מולך, חוזקות, חולשות, מטרה)
  - Post-Call Checklist + Retention Notes
- **מערכת 7 דומיינים** (פיטנס, סטודיו, בעל עסק, נדל"ן, קוסמטיקה, קואצ'ינג, חינוך)
- **User Strengths** (3-4 תכונות)
- **שדות DB חסרים:** business_intel_v2 JSONB, lang, questionnaire_version

### מה תקין (זהה בין שני הפרויקטים):
- 5 ארכיטיפים (WINNER, STAR, DREAMER, HEART, ANCHOR)
- חישוב ציונים, churn risk, smart tags, cheat sheets
- מבנה webhook בסיסי

**מה עשיתי:**
- חקירה מעמיקה של שני הפרויקטים (Signals OS vs AMP)
- מיפוי מלא של 18 נקודות שונות
- תכנון סדר בנייה ל-8 הפיצ'רים + שלב 0 (סנכרון V2)
- עדכון NIV_IDEAS.txt עם Part 7 (8 פיצ'רים) + Part 8 (סדר בנייה מעודכן)
- עדכון NIV_PROMPT.md

### סדר בנייה שנקבע:
0. סנכרון Signals V2 (DB + webhook + interfaces + UI)
1. שירותים דינמיים (פתיחת המוצר לשוק)
2. היסטוריית רכישות + LTV
3. תסריט שיחה דינאמי (5 דלתות)
4. PDF ניתוח מצב + תוכנית עבודה (עם לוגו + צבעים per-tenant)
5. סקירת מתחרים
6. AI Notebook
7. Telegram Bot
8. פיצ'רים Salesforce/Monday (שוטף)

### דגשים למסמכי PDF:
- שיטת window.print() + Heebo Base64 font (מ-Signals OS)
- לוגו של הסוכנות/עסק בראש המסמך (העלאה ב-Settings)
- פלטת צבעים מותאמת per-tenant (primary, secondary, accent)
- עיצוב לפי דוגמת "תוכנית עבודה — סטודיו נירית ממן"

---

## סשן 21 (19.02.2026) — תיקוני PDF + אסטרטגיה + עמודים מונפשים + עריכה

**מה ביקשת:**
1. תיקון נראות כפתורי PDF — לא גלויים
2. הוספת AI Notebook ללידים (חסר)
3. בלוק "אסטרטגיה ותוכנית עבודה" — מחליף את הflow הידני (ChatGPT → Canva → PDF)
4. עמוד מונפש שיתווסף לבלוק האסטרטגיה (לא נפרד)
5. תיקון צבעים כהים של קוביות KPI בעמוד לקוחות
6. כפתור מפורש להסרת לוגו
7. לינק ייעודי שניתן לשתף עם הלקוח לעמוד מונפש
8. אפשרות עריכה של תוכנית אסטרטגית לפני שליחה ללקוח
9. עדכון קבצי MEMORY + PROJECT_STORY + NIV_PROMPT

**מה עשיתי:**

### PDF Dropdown:
- שינוי מ-hover dropdown ל-click toggle עם state
- שינוי שם מ"PDF" ל"ייצוא PDF"
- הוספת dropdown מלא ללידים (היה רק כפתור בודד)

### AI Notebook בלידים:
- הוספת state, handler, UI מלא עם quick prompts
- הוספה ל-LEAD_SECTIONS לסדר בלוקים

### אסטרטגיה ותוכנית עבודה (פיצ'ר חדש מלא):
- **DB:** טבלת strategy_plans עם plan_data JSONB
- **Edge Function:** generate-strategy (~465 שורות)
  - איסוף כל המידע מה-CRM בצד שרת
  - prompt בעברית ליועץ אסטרטגי בכיר
  - gemini-3-pro-preview, JSON מובנה עם fallback
- **Types:** 7 interfaces חדשים (StrategyPlan, StrategyPlanData וכו')
- **DataContext:** CRUD מלא (add, update, delete, publish)
- **PDF:** generateStrategyPdf עם helpers מותאמים
- **UI:** בלוק מלא בלקוחות + לידים עם כרטיסים מתרחבים

### עמוד מונפש:
- utils/animatedStrategy.ts (~450 שורות)
- אנימציות CSS + IntersectionObserver + חיצי SVG
- צבעי מותג, Heebo, RTL, print-friendly
- נפתח בחלון חדש

### תיקון קוביות KPI:
- שינוי מ-bg-[#151C2C] ל-bg-surface/80 backdrop-blur-md (סגנון glass)
- הוספת hover borders צבעוניים

### הסרת לוגו:
- הסרת כפתור X קטן ב-hover
- הוספת כפתור "הסר לוגו" מפורש עם variant="danger"

### לינקים שיתופיים:
- באקט storage חדש: strategy-pages (public, HTML)
- עמודה public_url בטבלת strategy_plans
- publishStrategyPage() — העלאת HTML לstorage, קבלת URL ציבורי
- כפתור "פרסם לינק" + תצוגת URL + העתקה ללוח
- "עדכן לינק" מחדש את ה-HTML כשיש שינויים

### מודל עריכת אסטרטגיה:
- updateStrategyPlan() ב-DataContext
- מודל עריכה מלא (size="xl"):
  - תקציר מנהלים
  - ניתוח מצב (5 שדות textarea)
  - שלבי תוכנית (עריכה/מחיקה/הוספת פעולות)
  - KPIs (עריכה/מחיקה)
- אוטו-פרסום מחדש אם יש URL ציבורי

### Edge Functions:
- generate-strategy (חדש)

### קבצים שנוצרו:
- supabase/migrations/20260219150000_add_strategy_plans.sql
- supabase/migrations/20260219160000_strategy_public_url.sql
- supabase/functions/generate-strategy/index.ts
- utils/animatedStrategy.ts

---

## סשן 22 (19.02.2026) — תיקון לינקים ציבוריים (Vercel API Proxy)

**מה ביקשת:**
- לינקים ציבוריים להצעות ותוכניות אסטרטגיות מציגים ג'יבריש/טקסט רגיל

**מה עשיתי:**

### תיקון קריטי — Vercel API Route Proxy:
- **בעיה:** Supabase Storage שומר על Content-Type: text/plain + sandbox CSP לקבצי HTML
- **פתרון:** שמירת HTML בעמודה חדשה `html_content` ב-DB, הגשה דרך Vercel serverless functions
- API routes חדשים: `/api/p/[id]` (הצעות) + `/api/s/[id]` (אסטרטגיה)
- `vercel.json` עודכן עם rewrites לפני SPA catch-all
- `publishProposalPage` + `publishStrategyPage` עברו לשמירה ב-DB + URL של Vercel
- הוספת `SUPABASE_SERVICE_ROLE_KEY` ל-Vercel env vars

### קבצים חדשים:
- api/p/[id].ts, api/s/[id].ts
- supabase/migrations/20260219170538_add_html_content_columns.sql

---

## סשן 23 (19.02.2026) — שכפול הצעות + המלצות + סוויפ + טלגרם

**מה ביקשת:**
1. אפשרות לשכפל הצעת מחיר קיימת
2. סידור מחדש של ההמלצות, סוויפ באצבע, "קרא עוד"
3. 15 רעיונות פורצי דרך ל-CRM
4. תיקון בוט טלגרם — לא מוצא לידים בשם, לא מגיב לאודיו

**מה עשיתי:**

### שכפול הצעת מחיר:
- כפתור "שכפל" ב-LeadProfile ליד כפתור "ערוך"
- מעתיק proposalData, מאפס id/status/publicUrl
- שם חדש: "שם הצעה (העתק)"

### סידור המלצות מחדש:
- בי קיור → גרייט שייפ → UFC → SMOOVEE → שאר

### סוויפ באצבע:
- touch events על קרוסלת ההמלצות
- זיהוי תנועה אופקית vs גלילה אנכית
- סף 50px לסוויפ, מאפס טיימר אוטומטי

### "קרא עוד":
- CSS line-clamp ל-3 שורות
- checkTruncation() בודק overflow אחרי 500ms
- כפתור toggle "קרא עוד" / "הצג פחות"

### תיקון בוט טלגרם:
- **חיפוש חכם (findEntity):** חיפוש ב-lead_name + business_name + client_name + business_name
- חיפוש דו-כיווני: "חיפוש מכיל שם" וגם "שם מכיל חיפוש"
- **אודיו כמסמך:** קבצי אודיו (.m4a, .mp3 וכו') שנשלחים כמסמכים מנותבים לתמלול
- **טיפול בשגיאות:** הודעת שגיאה נשלחת למשתמש במקום שקט
- פונקציות שעודכנו: add_note, reschedule, update_field, update_lead_status, update_client_status, add_deal, reminder, signals_profile

### 15 רעיונות פורצי דרך:
- נכתבו ל-NIV_IDEAS.txt Part 9
- Deal Momentum Score, Revenue Intelligence, Ghost Lead Detection,
  Client Health Heatmap, Smart Proposal A/B, Conversation Intelligence,
  Psychological Pricing, Client Cloning, Auto Case Studies, Churn Prediction,
  Meeting Prep Briefing, Revenue Attribution, Engagement Scoring,
  Win/Loss Analysis, Micro-Commitment Funnel

---

## סשן 24 (19.02.2026) — מיילים על חתימת הצעת מחיר + אימות דומיין

**מה ביקשת:**
1. "מפליא אותי שפיתחת הצעת מחיר חכמה, מונפשת, חתימה דיגיטלית ולא חשבת על מייל שיוציא את ההצעה החתומה" — חסר מייל בחתימת הצעה
2. "חתימה על הצעה לא מתקבלת! לא נשלחת ללקוח ולא לדואר שלי" — HTTP 400 ב-webhook
3. "אני מאשר הכל. אל תשלח לי הודעות אישור. רק הודעה סופית שהכל בוצע" — עבודה אוטונומית

**מה עשיתי:**

### 1. תיקון HTTP 400 ב-proposal-webhook
- **בעיה:** הקליינט שולח `{ signature: { name, email, ... } }` אבל ה-webhook ציפה למבנה שטוח
- **תיקון:** `const sig = body.signature || body` — תומך בשני הפורמטים

### 2. מערכת מיילים מלאה עם Resend API
- **SQL Migration:** עמודות `resend_api_key` + `notification_email` בטבלת settings
- **Types + Constants:** `hasResendKey`, `notificationEmail` ב-AgencySettings
- **DataContext:** `saveResendApiKey()` — שמירת מפתח Resend (כמו Telegram)
- **Settings.tsx:** כרטיס "Resend Email" חדש עם שדות API key + notification email

### 3. שכתוב מלא של proposal-webhook (~398 שורות)
- **sendResendEmail()** — helper function לשליחה
- **buildAgencyNotificationEmail()** — מייל RTL עברי ממותג לבעל הסוכנות:
  - שם ליד, עסק, חבילה שנבחרה, פרטי חתימה, לינק להצעה
- **buildClientConfirmationEmail()** — מייל RTL עברי ממותג ללקוח החותם:
  - תודה, חבילה שנבחרה, שלבים הבאים, פרטי סוכנות
- שני מיילים: (1) לnotification_email (בעל סוכנות), (2) לemail של החותם
- צבעי מותג מsettings, שם סוכנות, לוגו

### 4. אימות דומיין alma-ads.co.il ב-Resend
- כתובת שולח **זמנית**: `onboarding@resend.dev` (עובד ללא אימות DNS)
- הוספת הדומיין alma-ads.co.il ב-Resend (אזור EU Ireland)
- DNS records שנוצרו:
  - DKIM: TXT, `resend._domainkey`
  - SPF: MX + TXT על `send`
  - DMARC: TXT על `_dmarc`
- **נשאר:** להוסיף DNS records בממשק הדומיין (Hostinger), אחרי אימות — להחליף חזרה ל-`niv@alma-ads.co.il`

### Edge Functions deployed: proposal-webhook
### Commits: cd34d8c (תיקון 400), 2bc460a (מיילים)
