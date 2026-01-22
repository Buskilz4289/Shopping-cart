// ============================================
// Firebase Configuration - Example
// ============================================
// הוראות: 
// 1. העתק קובץ זה ל-firebase-config.js
// 2. עקוב אחר ההוראות ב-FIREBASE_SETUP.md
// 3. מלא את פרטי הקונפיגורציה מ-Firebase Console

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// אתחול Firebase
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    window.firebaseInitialized = true;
} else {
    console.warn('⚠️ Firebase לא מוגדר. אנא הגדר את firebase-config.js');
    window.firebaseInitialized = false;
}
