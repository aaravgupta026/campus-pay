# Campus Pay Frontend README

## Purpose
Campus Pay is a static web app frontend for quick UPI payments, spend tracking, and account-based sync.

## Frontend Files
- `index.html`: Main UI layout and script/style includes.
- `styles.css`: Full visual styling for auth, payment cards, analytics, and history.
- `script.js`: App logic for auth, payment flow, local data, cloud sync, exports, scanner, and geolocation sorting.
- `assets/campus-pay-brand.svg`: Brand icon used for header and favicon.

## UI Sections (Current)
1. Brand and subtitle
2. Hello banner (changes after login)
3. Location enable card
4. Payment-first shop list
5. Auth card (Google + Email/Password)
6. Dashboard (total + export/share + reset)
7. Analytics (month/year + month/year export)
8. Recent history list
9. QR scanner modal

## Frontend Features Implemented
- Google sign-in
- Email/password sign-in and account creation
- Sign-out
- Greeting with user name
- UPI app selection per shop
- Update QR and optional instant pay flow
- Shop-level reset and invalid QR reporting
- Location-based ordering with fallback to most-used ordering
- CSV export (full), selected month export, year summary export
- Share summary report

## Run / Deploy
- Hosted as static frontend (Vercel recommended).
- Works directly from static hosting; no Node server required.

## Important Notes
- Browser localStorage is used as primary local cache.
- Firestore sync is used when user is authenticated.
- Keep Firebase script versions aligned in `index.html`.
