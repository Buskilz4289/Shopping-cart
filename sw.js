// Service Worker for רשימת קניות
// מאפשר שימוש באפליקציה במצב offline מלא

const CACHE_VERSION = 'v3';
const CACHE_NAME = `shopping-list-${CACHE_VERSION}`;
const STATIC_CACHE_NAME = `shopping-list-static-${CACHE_VERSION}`;

// משאבים סטטיים - נשמרים פעם אחת
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// אירוע התקנה - שמירת משאבים במטמון
self.addEventListener('install', (event) => {
  console.log('[Service Worker] התקנה...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] שמירת משאבים סטטיים במטמון');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        // הפעלה מיידית של Service Worker החדש
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] שגיאה בהתקנת המטמון:', error);
      })
  );
});

// אירוע הפעלה - ניקוי מטמונים ישנים
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] הפעלה...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // מחיקת מטמונים ישנים
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[Service Worker] מחיקת מטמון ישן:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // הפעלת Service Worker בכל הטאבים
      return self.clients.claim();
    })
  );
});

// אירוע fetch - הגשת מהמטמון או מהרשת
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // התעלמות מפניות שאינן HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }
  
  // אסטרטגיית Cache First למשאבים סטטיים
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
  } 
  // אסטרטגיית Network First לדפים דינמיים
  else {
    event.respondWith(networkFirst(request));
  }
});

// בדיקה אם זה משאב סטטי
function isStaticAsset(url) {
  return STATIC_ASSETS.some(asset => url.includes(asset));
}

// אסטרטגיית Cache First - מטמון קודם, אבל תמיד בודק עדכונים ברקע
async function cacheFirst(request) {
  try {
    // נסה מהרשת קודם כדי לקבל את הגרסה העדכנית ביותר
    const networkResponse = await fetch(request);
    
    // אם יש תגובה מהרשת, עדכן את המטמון
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    // אם הרשת נכשלה, נסה מהמטמון
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[Service Worker] שגיאה ב-cacheFirst:', error);
    
    // אם זה דף HTML, נסה להחזיר את index.html מהמטמון
    if (request.destination === 'document') {
      const fallback = await caches.match('./index.html');
      if (fallback) {
        return fallback;
      }
    }
    
    // החזרת תגובת שגיאה
    return new Response('שגיאה בטעינת המשאב', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// אסטרטגיית Network First - רשת קודם
async function networkFirst(request) {
  // Cache API תומך רק ב-GET requests
  // אל תנסה לשמור בקש cache בקשות POST, PUT, DELETE וכו'
  if (request.method !== 'GET') {
    // עבור בקשות שאינן GET, פשוט נסה מהרשת
    try {
      return await fetch(request);
    } catch (error) {
      console.log('[Service Worker] שגיאה בבקשה:', request.method, request.url);
      throw error;
    }
  }
  
  try {
    // נסה מהרשת קודם
    const networkResponse = await fetch(request);
    
    // שמירה במטמון אם הצליח (רק GET requests)
    if (networkResponse.ok && request.method === 'GET') {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (cacheError) {
        // אם יש שגיאה בשמירה במטמון, המשך בכל זאת
        console.log('[Service Worker] לא ניתן לשמור במטמון:', cacheError);
      }
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[Service Worker] אין חיבור לרשת, מנסה מהמטמון...');
    
    // אם אין חיבור, נסה מהמטמון (רק GET requests)
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // אם זה דף HTML, החזר את index.html
    if (request.destination === 'document') {
      const fallback = await caches.match('./index.html');
      if (fallback) {
        return fallback;
      }
    }
    
    // החזרת תגובת offline
    return new Response('אין חיבור לאינטרנט. האפליקציה עובדת במצב offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }
}

// הודעת עדכון למשתמש (אופציונלי)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  // ניקוי מטמון לפי בקשה
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('[Service Worker] מחיקת מטמון:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }).then(() => {
        console.log('[Service Worker] כל המטמונים נמחקו');
        return self.clients.claim();
      })
    );
  }
});
