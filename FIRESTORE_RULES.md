# כללי אבטחה ל-Firestore

## הבעיה:
```
FirebaseError: Missing or insufficient permissions.
```

זה אומר שכללי האבטחה ב-Firestore לא מאפשרים גישה לנתונים.

## פתרון:

### שלב 1: לך ל-Firebase Console
1. פתח: https://console.firebase.google.com/
2. בחר את הפרויקט שלך
3. בתפריט השמאלי, לחץ על **"Firestore Database"**
4. לחץ על הכרטיסייה **"Rules"** (כללים)

### שלב 2: עדכן את כללי האבטחה
**החלף** את כל הקוד ב-Rules בקוד הבא:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // מוצרים שהוספתי - גלובליים לכל המשתמשים
    match /addedProducts/{productId} {
      allow read: if true;  // כל אחד יכול לקרוא
      allow create: if true;  // כל אחד יכול ליצור
      allow update: if true;  // כל אחד יכול לעדכן
      allow delete: if true;  // כל אחד יכול למחוק
    }
    
    // רשימות קיימות - גלובליות לכל המשתמשים
    match /savedLists/{listId} {
      allow read: if true;  // כל אחד יכול לקרוא
      allow create: if true;  // כל אחד יכול ליצור
      allow update: if true;  // כל אחד יכול לעדכן
      allow delete: if true;  // כל אחד יכול למחוק
    }
    
    // היסטוריית קניות - משותפת לכל המשתמשים
    match /shoppingHistory/{historyId} {
      allow read: if true;  // כל אחד יכול לקרוא
      allow create: if true;  // כל אחד יכול ליצור
      allow update: if true;  // כל אחד יכול לעדכן
      allow delete: if true;  // כל אחד יכול למחוק
    }
  }
}
```

### שלב 3: שמור
1. לחץ על **"Publish"** (פרסם)
2. המתן כמה שניות לעדכון

### שלב 4: בדוק
1. רענן את האפליקציה
2. נסה להוסיף מוצר לרשימה
3. השגיאה אמורה להיעלם

## הסבר על הכללים:

- `addedProducts` - collection של מוצרים שהוספו (גלובלי)
- `savedLists` - collection של רשימות קיימות (גלובלי)
- `shoppingHistory` - collection של היסטוריית קניות (גלובלי)
- `allow read: if true` - כל אחד יכול לקרוא
- `allow create: if true` - כל אחד יכול ליצור
- `allow update: if true` - כל אחד יכול לעדכן
- `allow delete: if true` - כל אחד יכול למחוק

**⚠️ הערה:** כללי אבטחה אלה מתאימים לאפליקציה ללא אימות. אם אתה רוצה אבטחה נוספת, תצטרך להוסיף אימות משתמשים.

## אם עדיין יש בעיה:

1. ודא שהכללים נשמרו (לחץ על "Publish")
2. בדוק שאין שגיאות תחביר
3. המתן 10-20 שניות לעדכון
4. רענן את האפליקציה
5. בדוק את Console של הדפדפן לשגיאות נוספות

## בדיקה ב-Firebase Console:

לך ל-Firestore Database → Data ובדוק:
- אם יש collection `addedProducts` - הכללים עובדים
- אם יש collection `savedLists` - הכללים עובדים
- אם יש collection `shoppingHistory` - הכללים עובדים
- אם אין כלום - צריך לבדוק את הכללים שוב
