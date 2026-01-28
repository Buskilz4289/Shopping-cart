# מבנה Firestore מומלץ

## הפעלת Firestore
ב-Firebase Console: Build → Firestore Database → Create database (אם עדיין לא נוצר). רשימות הקניות נשארות ב-Realtime Database; רק מוצרי הקבע משתמשים ב-Firestore.

## עקרון
- **מוצרי קבע (Fixed Products)** – collection גלובלית `products`, לא נמחקת ולא תלויה ברשימות.
- **רשימות קניות** – כל רשימה `lists/{listId}` מכילה רק פריטים (עם הפניה `productId` אופציונלית), לא מזיזה ולא מוחקת מוצרי קבע.

---

## Collections

### 1. `products` (מוצרי קבע גלובליים)

מוצרים קבועים גלויים לכל המשתמשים, לא נמחקים עם רשימה.

| שדה       | סוג     | תיאור                          |
|-----------|---------|---------------------------------|
| `name`    | string  | שם המוצר                        |
| `category`| string  | קטגוריה (אופציונלי)             |
| `quantity`| string  | כמות ברירת מחדל (למשל "1")     |
| `createdAt`| timestamp | מתי נוצר (אופציונלי)         |

**מפתח:** אוטו-ID של Firestore (`doc.id`).

**דוגמה:**
```json
{
  "name": "חלב",
  "category": "מוצרי חלב",
  "quantity": "1",
  "createdAt": "<timestamp>"
}
```

---

### 2. רשימות קניות – Realtime Database (קיים)

הפרויקט משתמש ב-**Firebase Realtime Database** לרשימות:

```
lists/
  {listId}/
    items: [
      {
        "id": "...",
        "name": "...",
        "quantity": "...",
        "category": "...",
        "purchased": false,
        "productId": "..."   // אופציונלי – הפניה ל-products/{productId}
      }
    ],
    updatedAt: <timestamp>,
    createdAt: <timestamp>
```

- פריט ברשימה יכול לכלול `productId` שמצביע על מוצר קבע ב-Firestore.
- מחיקת/עדכון רשימה **לא** נוגע ב-collection `products`.

---

## סיכום

| נתון              | מיקום           | הערות                    |
|-------------------|------------------|---------------------------|
| מוצרי קבע         | Firestore `products` | גלובלי, לא נמחק         |
| רשימת קניות       | Realtime DB `lists/{listId}` | items עם productId אופציונלי |
