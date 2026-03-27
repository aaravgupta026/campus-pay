# Campus Pay Project Status and Next Phase

## What Is Done Till Now
1. GitHub repository initialized and multiple commits pushed.
2. Core payment UI with shop cards and UPI deep links.
3. Dynamic QR update for shops and custom shop creation.
4. Export and share spending reports.
5. Custom branding/favicon added.
6. Payment-first layout implemented.
7. Greeting banner implemented (`Hello, <name>` after auth).
8. Google auth integrated.
9. Email/password auth integrated.
10. Geolocation sorting integrated with fallback ordering.
11. Month and year analytics + CSV exports implemented.
12. Firestore sync logic implemented for authenticated users.
13. Email/password auth added in UI and logic.
14. Extended UPI app list includes Amazon Pay, Samsung Wallet, MobiKwik, and YONO SBI.

## Current Known Risk / Debug Focus
1. Sign-in may complete but UI not updating if stale deployment/browser cache is used.
2. Firestore writes may fail if rules do not match collection path.
3. Vercel may show old build if deploy not finished or cached.
4. Dual Firestore path writes exist temporarily and should be normalized after final rules decision.

## Architecture Decision (Now)
1. Do not remove Firebase immediately.
2. Firebase Auth + Firestore are already Google Cloud services and currently the fastest stable path.
3. Use Google Cloud Console for project governance and monitoring.
4. Plan optional migration of data APIs to Cloud Run in a later phase.

## Immediate Verification Checklist
1. Confirm latest Vercel deployment commit hash equals latest GitHub commit.
2. Hard refresh app (`Ctrl+F5`).
3. Login using email/password and Google.
4. Verify greeting updates and signed-in panel appears.
5. Make one payment and confirm Firestore write in console.

## Next Phase (Planned)
1. Add small on-screen debug panel:
   - auth state
   - current uid
   - last cloud write status
   - last cloud read status
2. Move Firebase config to environment-based setup (safer than plaintext config file).
3. Normalize to one Firestore schema (remove fallback path after rules are final).
4. Add monthly/yearly dashboard charts.
5. Add report filter by shop and app.
6. Add cloud backup/restore for custom shops and app preferences.
7. Optional phase: Cloud Run API layer with verified Google identity token.

## Important Workflow Rule for New Chat
Before deleting or refactoring anything:
1. Read `README-frontend.md`
2. Read `README-backend.md`
3. Read this file
4. Confirm active deployment and Firebase rules first
