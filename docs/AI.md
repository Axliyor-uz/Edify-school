# AI — Gemini Features, Credit Systems & TTS

> **Agent workflow:** read this BEFORE touching any AI generation route, credit/limit logic, `lib/ai/*`, analytics chat, or TTS. Update this doc in the same change whenever you alter behavior described here. Index: [README.md](README.md).

**Last verified:** 2026-07-12 (commit `7c31a96`).

## Purpose & scope

Every Google Gemini-powered feature, the credit/limit systems that meter them, and the TTS route. All Gemini calls use model **`gemini-2.5-flash`** with `GEMINI_API_KEY`. Two call styles: the `@google/generative-ai` SDK (analyze route only) and raw `fetch` to `generativelanguage.googleapis.com/.../gemini-2.5-flash:generateContent` (all teacher create routes).

## Gemini features

| Feature | Route | Caller | Notes |
|---|---|---|---|
| Analytics mentor chat | `app/api/analyze/route.ts` | `app/teacher/analytics/page.tsx` | `action:'initial'` (3-bullet summary, student vs classroom mode) or `action:'chat'`; `systemInstruction` + `startChat({history})`; uz/ru/en |
| AI DTM MCQ generator | `app/teacher/create/ai/api/route.ts` | `create/ai/page.tsx` | `responseSchema` array `{q,o[4],a,e}` temp 0.3 → mapped to `{question.uz, options.A–D, answer, explanation.uz, difficultyId}` |
| Free-prompt MCQ | `app/teacher/create/by_user_input/api/route.ts` | same-dir page | temp 0.25 |
| Image → MCQ (multimodal) | `app/teacher/create/by_image/api/route.tsx` | same-dir page | base64 `inlineData`; guardrail output `{error:'invalid_image', items}`; temp 0.1; **the only route that feature-gates** (`checkUserPermission(userId,'IMAGE_AI',count)`) |
| Specialized-school MCQ | `app/teacher/create/ixtisoslashtirilgan_maktab/api/route.ts` | same-dir page | olympiad difficulty; temp 0.35 |
| Public-school (maktab) MCQ | `app/teacher/create/maktab/api/route.ts` | same-dir page | **First tries local JSON banks in Firebase Storage** (`structure.json` registry, bucket `scanqr-64512.firebasestorage.app`, RAM cache, artificial 3.5s delay), falls back to Gemini; temp 0.25 |
| BSB-CHSB summative | `app/teacher/create/bsb-chsb/api/route.ts` | same-dir page | mixed types (mcq/short_answer/open_ended/matching/true_false) from a `distribution`; output `{t,p,to,q,o,a,m,ru,e}` type-branched |
| IELTS writing estimate | `app/api/ielts/analyze-writing/route.ts` | student review page + teacher IELTS grading form | raw fetch, JSON `responseSchema` `{ta,cc,lr,gra,feedback{uz,ru,en}}` temp 0.2; result **cached on the attempt** (`aiEstimate`) so one Gemini call per attempt ever; limit: `ielts_ai_usage/{uid}_{date}` UTC daily counter (System-C pattern, env `IELTS_AI_WRITING_DAILY_LIMIT` default 5, check→generate→increment). See [IELTS.md](IELTS.md). |

⚠️ `app/teacher/analytics/page.tsx` also calls `/api/stt` — **that route does not exist** (dead reference).

## The THREE credit systems (know which one a flow uses)

### A — Daily (`lib/ai/aiLimitsHelper.ts` → `consumeAiCredits`) — **DEAD CODE**
Fields on `users/{uid}`: `aiDailyQuestionLimit` (fallback 50), `aiQuestionUsedToday`, `aiQuestionLastResetDate`; lazy reset by `Asia/Tashkent` date. **Nothing calls `consumeAiCredits`, and `hooks/useAiLimits.ts` is never imported.** The fields survive only as legacy fallbacks in admin UIs (`app/admin/teachers/page.tsx`, `MembershipTab.tsx`). Do not build on this system; prefer B.

### B — Monthly SaaS (`lib/ai/featureGatekeeper.ts`) — **LIVE, used by all 6 teacher create routes**
- Fields on `users/{uid}`: `includedFeatures[]`, `currentLimits.monthlyAiQuestions` (fallback 100), `usage.aiQuestionsUsed`, `usage.aiLimitResetDate` (display only).
- `checkUserPermission(userId, featureKey, requestedCount)`: feature-lock check → `FEATURE_LOCKED`; `monthlyAiQuestions >= 5000` means **unlimited**; else over-limit → `LIMIT_REACHED`.
- `deductMonthlyAiCredits(userId, actualCount)`: `FieldValue.increment` merge; no-op if ≤ 0.
- Plans (`plansData.ts`): Free 100 / mid 1000 / top 5000 (=unlimited). Admin edits + usage reset: `app/admin/membership/`, `admin/teachers/[id]/_components/MembershipTab.tsx`. UI display: `hooks/useMonthlyLimit.ts`, `teacher/subscription/page.tsx`, teacher layout.
- **Pattern (mandatory for new AI flows): check permission → call Gemini → deduct only the actual generated count** so failed generations don't burn credits. All 6 routes follow the check/deduct-actual shape, **but only `by_image` calls the real gatekeeper** — the other 5 inline a copy of the limit math (no feature-lock, drift risk). When touching those routes, prefer migrating them to `checkUserPermission`.

### C — Per-day server counter `ai_usage/{userId}_{YYYY-MM-DD}` — **LIVE, analyze route only**
- Written/read ONLY by `app/api/analyze/route.ts`: reads `count`, 429s at limit, increments +1 per request (`{count, userId, date}` merge, `FieldValue.increment`).
- **The route is authenticated.** It requires `Authorization: Bearer <idToken>`; the **uid comes from the verified token, never from the body**. It was previously unauthenticated and took `userId` from the request body — i.e. an open Gemini proxy that could also spend another user's quota.
- **The limit is server-owned**: `AI_ANALYZE_DAILY_LIMIT` env (default 15). It used to arrive as `dailyLimit` in the request body (from Remote Config), so the caller chose their own cap and the check was decorative. ⚠️ Never reintroduce a client-supplied limit.
- Date key is **UTC** (`toISOString().split('T')[0]`), unlike A/B which use Asia/Tashkent.
- Uses the **Admin SDK** (`adminDb`), like every other AI route. Firestore rules for `ai_usage` are therefore `read, write: if false` — no client may touch the counter. (Before: client SDK in a server route + world-open rules, so anyone could zero their own usage.)

## TTS — `app/api/tts/route.ts`

`msedge-tts` (Azure neural), output MP3 24kHz/48kbit mono. Voice hardcoded `uz-UZ-SardorNeural` — the `voice` param is ignored (female `MadinaNeural` commented out). Writes a temp file via `tts.toFile(os.tmpdir(), ...)`, reads + unlinks, returns the buffer. `export const dynamic = 'force-dynamic'` is **required** (native module + fs); any new route using native modules/fs must do the same. No auth, no rate limit, no credit check. Bottom half of the file is a commented-out Muxlisa implementation.

## Invariants & traps

- Unlimited threshold `>= 5000` is duplicated in ~8 places (gatekeeper, `useMonthlyLimit`, and inline in 5 routes) — changing plan numbers requires touching all of them.
- Check→deduct is **non-atomic** everywhere (read then `increment`) — concurrent requests can overshoot limits. Accepted for now; don't assume the counters are exact.
- The `maktab` local-DB branch deducts monthly AI credits even when questions come from the static bank (charging AI credits for non-AI content) — known quirk, decide deliberately before "fixing".
- `deductMonthlyAiCredits` failures are swallowed (returns false, callers ignore) — no refund path.
- Analytics (System C) usage is invisible in the subscription/admin UIs, which surface only System B.
- Timezone: A/B use Asia/Tashkent day boundaries; C uses UTC.

## Known dead code (verified 2026-07-12)

`consumeAiCredits`, `hooks/useAiLimits.ts`, the daily-limit fields as an enforcement mechanism, `/api/stt` fetch in analytics, commented Muxlisa TTS, commented "50→100" limit upgrade hack.

## How to verify changes

`npm run dev`; exercise a teacher create flow and watch `users/{uid}.usage.aiQuestionsUsed` increment by the actual generated count (and NOT increment on generation failure); for analytics, watch `ai_usage/{uid}_{date}`. Requires `GEMINI_API_KEY` in `.env.local`.
