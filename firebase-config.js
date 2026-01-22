// ============================================
// Firebase Configuration
// ============================================
// הוראות: העתק את פרטי הקונפיגורציה מ-Firebase Console
// 1. לך ל-https://console.firebase.google.com
// 2. בחר פרויקט או צור פרויקט חדש
// 3. הוסף אפליקציית Web (</>)
// 4. העתק את פרטי הקונפיגורציה והדבק כאן

// ⚠️ חשוב: אל תפרסם את הקובץ הזה עם פרטי הקונפיגורציה שלך ב-GitHub!
// השתמש ב-.gitignore כדי למנוע פרסום מידע רגיש

const firebaseConfig = {
    apiKey: "AIzaSyBrOsC356zjzt2xna6yzXt_QVoJLuJemfI",
    authDomain: "shopping-cart-e20ea.firebaseapp.com",
    databaseURL: "https://shopping-cart-e20ea-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "shopping-cart-e20ea",
    storageBucket: "shopping-cart-e20ea.firebasestorage.app",
    messagingSenderId: "785083161639",
    appId: "1:785083161639:web:b8a4e83c8d160ccc8c8202"
};

// אתחול Firebase
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    window.firebaseInitialized = true;
} else {
    console.warn('⚠️ Firebase לא מוגדר. אנא הגדר את firebase-config.js');
    window.firebaseInitialized = false;
}
