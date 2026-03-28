// Replace these placeholder values with your Firebase web app config from:
// Firebase Console -> Project Settings -> Your apps -> Web app -> SDK setup and configuration
// Then redeploy/push so Vercel gets updated values.
window.firebaseConfig = {
    apiKey: "REPLACE_WITH_API_KEY",
    authDomain: "REPLACE_WITH_AUTH_DOMAIN",
    projectId: "REPLACE_WITH_PROJECT_ID",
    storageBucket: "REPLACE_WITH_STORAGE_BUCKET",
    messagingSenderId: "REPLACE_WITH_MESSAGING_SENDER_ID",
    appId: "REPLACE_WITH_APP_ID"
};

// Admin accounts who can access admin.html
window.adminEmails = [
    "aaravgupta2500@gmail.com",
    "aaravgupta0027@gmail.com"
];

// Optional: Google Apps Script Web App endpoint for feedback -> Google Sheet/Drive flow.
// Leave empty to store feedback in Firestore/local fallback.
window.feedbackEndpoint = "";

// // Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// import { getAnalytics } from "firebase/analytics";
// // TODO: Add SDKs for Firebase products that you want to use
// // https://firebase.google.com/docs/web/setup#available-libraries

// // Your web app's Firebase configuration
// // For Firebase JS SDK v7.20.0 and later, measurementId is optional
// const firebaseConfig = {
//   apiKey: "AIzaSyCI2a7e28_cwpo0Ul6LIFKw3xJKBVWtg4o",
//   authDomain: "campus-pay-v1.firebaseapp.com",
//   projectId: "campus-pay-v1",
//   storageBucket: "campus-pay-v1.firebasestorage.app",
//   messagingSenderId: "820978589001",
//   appId: "1:820978589001:web:b117402f9ec2d0a4ae0e98",
//   measurementId: "G-FGY27FYMB1"
// };

// // Initialize Firebase
// const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
