# Campus Pay Backend (Google Cloud) README

## Backend Model
Backend is serverless on Google Cloud using Firebase-managed services right now:
- Firebase Authentication (Google Cloud Identity layer)
- Cloud Firestore (Google Cloud NoSQL)

No custom backend server is present in this repo.

## Architecture Point (Important)
Firebase is already part of Google Cloud. So using Firebase Auth + Firestore means the app is already running on Google Cloud services.

The recommended path is:
1. Keep Firebase Auth + Firestore for stability now.
2. Manage project-level settings from `console.cloud.google.com` where needed.
3. Optionally migrate selected backend logic later to Cloud Run/API Gateway/Cloud Functions.

## Firebase Config File
- `firebase-config.js` contains web app Firebase keys.
- This file is loaded directly by `index.html`.

## Authentication Providers
Enabled and expected:
- Google
- Email/Password

## Firestore Paths Used by App
Primary path:
- `users/{uid}/expenses/{localId}`

Compatibility fallback path:
- `expenses/{uid_localId}` with `userId` field

## Why two paths are used
Different Firestore rules setups were used during testing. App writes to both so data is visible even if one rules style blocks writes.

## Google Cloud Console Usage
Use `console.cloud.google.com` for:
- Project IAM/roles
- Billing and quotas
- Firestore database visibility under Google Cloud resources
- Logging and monitoring (Cloud Logging)

Use Firebase Console for:
- Authentication provider toggles (Google, Email/Password)
- Firestore rules quick management
- Web app SDK config keys

## Recommended Firestore Rules
Use this safe version during development:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/expenses/{expenseId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /expenses/{expenseId} {
      allow read, write: if request.auth != null &&
        request.resource.data.userId == request.auth.uid;
    }
  }
}
```

## Deployment Clarification
The screenshot error `Unable to forward your request to a backend` on Cloud Shell port 8080 is expected when no HTTP server is running there.

This project is static frontend and does not require Cloud Shell port forwarding.
Use Vercel deployment (or Firebase Hosting) instead.

## Optional Future Migration (If You Want Less Firebase SDK)
1. Keep frontend static on Vercel.
2. Add Cloud Run API for expense writes/reads.
3. Verify Google identity token in backend.
4. Move Firestore access from browser to backend service account.
5. Keep only login on frontend and call backend APIs.

## Vercel Notes
- Repo: `aaravgupta026/campus-pay`
- Branch: `main`
- Each push to `main` should trigger deploy.
