# Campus Pay Backend (Firebase) README

## Backend Model
Backend is serverless using Firebase services:
- Firebase Authentication
- Cloud Firestore

No custom backend server is present in this repo.

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

## Vercel Notes
- Repo: `aaravgupta026/campus-pay`
- Branch: `main`
- Each push to `main` should trigger deploy.
