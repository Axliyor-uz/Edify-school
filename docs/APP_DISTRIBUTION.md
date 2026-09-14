# APP_DISTRIBUTION — self-hosted Android APK releases

Direct-APK distribution for the **Edify Manager** Android app (repo:
`/home/matimatik/AndroidStudioProjects/EdifyManager`) until it ships on Google
Play. The web side is intentionally dumb: two static files + one page.

## Files

| Path | Serves at | What |
|---|---|---|
| `public/app/version.json` | `edify.uz/app/version.json` | Latest-release manifest. The Android app fetches it on EVERY launch (update gate). |
| `public/app/edify-manager.apk` | `edify.uz/app/edify-manager.apk` | The current signed release APK (replaced each release; git history keeps old blobs). |
| `app/(public)/app/page.tsx` | `edify.uz/app` | Uzbek download page — imports `version.json` at build time, so page + files always deploy in lockstep. |
| `next.config.ts` `headers()` | — | `Cache-Control: no-cache, must-revalidate` on `/app/version.json` so clients never see a stale version. |

## version.json contract

```json
{
  "app": "uz.wasp2ai.edifymanager",   // informational
  "versionCode": 2,                    // MUST equal the APK's versionCode
  "versionName": "1.1",                // shown in app + on the page
  "apkUrl": "https://edify.uz/app/edify-manager.apk?v=2",  // bump ?v= each release (cache-bust)
  "forceUpdate": false,                // true = installed older apps are blocked until updated
  "changelog": "…",                    // Uzbek, shown in app + on the page
  "minAndroid": "7.0"                  // page display only (app minSdk 24)
}
```

Android reads `versionCode`, `versionName`, `forceUpdate`, `changelog` (unknown
keys ignored); it opens the `/app` **page**, not `apkUrl` — `apkUrl` is used by
the page's download button.

## Release procedure

Driven from the Android repo — full checklist lives in its
`docs/app-updates.md`. Web-side steps only:

1. Copy the new signed APK over `public/app/edify-manager.apk`.
2. Edit `public/app/version.json`: bump `versionCode` (must match the APK),
   `versionName`, `?v=` in `apkUrl`, set `forceUpdate`, write Uzbek `changelog`.
3. Deploy the web app. Done — installed apps pick it up on next launch.

**Rollback**: revert both files and redeploy. Never lower `versionCode` below
what real users already installed, or they'll be prompted to "update" to an
older build that Android will refuse to install over the newer one.

## Privacy policies (`/privacy`)

Play Store requires a public privacy-policy URL per app. One data file drives
everything: `app/(public)/privacy/policies.ts` — `POLICIES` record, one entry
per app (slug, appName, packageId, sections in English).

- `/privacy` — index listing every policy (renders from POLICIES).
- `/privacy/<slug>` — full policy page (`[slug]/page.tsx`, `dynamicParams=false`
  so unknown slugs 404). Current: `/privacy/manager` (uz.wasp2ai.edifymanager).
- **Adding a policy for another app** (student/teacher/parent APK): add ONE
  entry to POLICIES — page + index row appear automatically. Reuse
  `CONTACT_SECTION`; set `lastUpdated`; bump `lastUpdated` on every text change.
  The URL to give Play is `https://edify.uz/privacy/<slug>` and must stay stable.

## Invariants & traps

- `versionCode` in version.json must NEVER be ahead of the actual APK in
  `public/app/` — users would be sent to download a build that doesn't clear
  the gate, looping them forever (gate blocks, "installed" version still old).
- Keep the APK filename stable (`edify-manager.apk`) and cache-bust via the
  `?v=` query only.
- The APK must be signed with the Android repo's release keystore
  (`app/edify-manager.jks`, git-ignored there). A debug- or differently-signed
  APK will fail to install over existing installs.
- Route `/app` (page) and `/app/*.json|apk` (public assets) coexist — don't
  create a `public/app/index.html`.
- When the app later ships on Google Play: Play-installed apps skip the gate
  automatically (installer-package check in the Android app). Keep this page
  for sideload users or turn it into a Play link.
