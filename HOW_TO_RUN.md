# איך להריץ את האפליקציה מקומית

## הבעיה:
אם אתה פותח את `index.html` ישירות מהמחשב (לחיצה כפולה), תקבל שגיאות:
- Service Worker לא יעבוד
- Firebase לא יעבוד
- PWA לא יעבוד

**למה?** כי Service Worker ו-PWA דורשים HTTPS או localhost, לא `file://`

## פתרון: הרצה דרך שרת מקומי

### שיטה 1: Python (הכי פשוט)

אם יש לך Python מותקן:

```bash
# Python 3
python -m http.server 8000

# או Python 2
python -m SimpleHTTPServer 8000
```

אז פתח בדפדפן: `http://localhost:8000`

### שיטה 2: Node.js (http-server)

אם יש לך Node.js:

```bash
# התקן http-server (אם עדיין לא)
npm install -g http-server

# הרץ שרת
http-server -p 8000
```

אז פתח בדפדפן: `http://localhost:8000`

### שיטה 3: VS Code Live Server

אם אתה משתמש ב-VS Code:

1. התקן את התוסף "Live Server"
2. לחץ ימני על `index.html`
3. בחר "Open with Live Server"

### שיטה 4: GitHub Pages (מומלץ לבדיקות)

1. העלה את הקבצים ל-GitHub
2. הפעל GitHub Pages
3. פתח את האתר ב-`https://your-username.github.io/Shopping-cart/`

## איך לדעת שהכל עובד?

אחרי שתפתח דרך שרת מקומי, ב-Console תראה:
- ✅ `Service Worker נרשם בהצלחה`
- ✅ `Firebase אותחל בהצלחה`
- ❌ לא תראה שגיאות CORS

## הערה חשובה:

**אל תפתח את `index.html` ישירות מהמחשב!** תמיד השתמש בשרת מקומי או ב-GitHub Pages.
