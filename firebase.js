// ============================================
// Firebase Integration Module
// ============================================
// מודול לניהול סנכרון רשימות עם Firebase Realtime Database

const FirebaseManager = {
    database: null,
    firestore: null,
    currentListRef: null,
    listListener: null,
    isOnline: navigator.onLine,
    offlineQueue: [],
    isSyncing: false,

    // אתחול יחיד – Realtime Database + Firestore (אם זמין)
    init() {
        if (!window.firebaseInitialized) {
            console.warn('Firebase לא מוגדר - השיתוף לא יעבוד');
            return false;
        }

        this.database = firebase.database();
        if (typeof firebase.firestore === 'function') {
            this.firestore = firebase.firestore();
        }

        // מעקב אחר מצב חיבור
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncOfflineQueue();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });

        return true;
    },

    // ---------- מוצרי קבע (Firestore collection: products) ----------
    // סכמה: name, favorite: false, category: null. אין כפילויות לפי name.

    async loadFixedProducts(callback) {
        if (!this.firestore) {
            if (callback) callback([]);
            return Promise.resolve([]);
        }
        try {
            const snapshot = await this.firestore.collection('products').orderBy('name').get();
            const products = snapshot.docs.map(doc => {
                const d = doc.data();
                return {
                    id: doc.id,
                    name: d.name || '',
                    favorite: d.favorite === true,
                    category: d.category != null ? d.category : null
                };
            }).filter(p => p.name);
            if (callback) callback(products);
            return products;
        } catch (error) {
            console.error('שגיאה בטעינת מוצרי קבע:', error);
            if (callback) callback([]);
            return [];
        }
    },

    /** יוצר מוצרי קבע אם אינם קיימים. מחזיר מספר המוצרים שנוספו. */
    async createFixedProductsIfMissing(productNames) {
        if (!this.firestore || !Array.isArray(productNames)) return 0;
        let added = 0;
        const col = this.firestore.collection('products');
        for (const name of productNames) {
            const trimmed = (name && typeof name === 'string') ? name.trim() : '';
            if (!trimmed) continue;
            const existing = await col.where('name', '==', trimmed).limit(1).get();
            if (existing.empty) {
                await col.add({ name: trimmed, favorite: false, category: null });
                added++;
            }
        }
        return added;
    },

    async addFixedProduct(product) {
        if (!this.firestore) return null;
        try {
            const docRef = await this.firestore.collection('products').add({
                name: product.name || '',
                favorite: product.favorite === true,
                category: product.category != null ? product.category : null
            });
            return docRef.id;
        } catch (error) {
            console.error('שגיאה בהוספת מוצר קבע:', error);
            return null;
        }
    },

    async deleteFixedProduct(productId) {
        if (!this.firestore) return false;
        try {
            await this.firestore.collection('products').doc(productId).delete();
            return true;
        } catch (error) {
            console.error('שגיאה במחיקת מוצר קבע:', error);
            return false;
        }
    },

    /** עדכון מוצר קבע – שם ו/או קטגוריה. */
    async editFixedProduct(productId, newName, newCategory = null) {
        if (!this.firestore || !productId) return false;
        try {
            const ref = this.firestore.collection('products').doc(productId);
            const updates = {};
            if (newName != null && typeof newName === 'string') updates.name = newName.trim();
            if (newCategory !== undefined) updates.category = newCategory;
            if (Object.keys(updates).length === 0) return true;
            await ref.update(updates);
            return true;
        } catch (error) {
            console.error('שגיאה בעריכת מוצר קבע:', error);
            return false;
        }
    },

    /** עדכון סטטוס favorite של מוצר. */
    async updateProductFavorite(productId, isFavorite) {
        if (!this.firestore || !productId) return false;
        try {
            const ref = this.firestore.collection('products').doc(productId);
            await ref.update({ favorite: isFavorite === true });
            return true;
        } catch (error) {
            console.error('שגיאה בעדכון favorite:', error);
            return false;
        }
    },

    /** מציאת מוצר לפי שם (לשימוש ב-toggleFavorite). */
    async findProductByName(productName) {
        if (!this.firestore || !productName) return null;
        try {
            const trimmed = (productName && typeof productName === 'string') ? productName.trim() : '';
            if (!trimmed) return null;
            const snapshot = await this.firestore.collection('products')
                .where('name', '==', trimmed)
                .limit(1)
                .get();
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                return {
                    id: doc.id,
                    ...doc.data()
                };
            }
            return null;
        } catch (error) {
            console.error('שגיאה בחיפוש מוצר:', error);
            return null;
        }
    },

    // ---------- מוצרים שהוספתי (גלובליים) - Firestore collection: addedProducts ----------
    // מוצרים גלובליים שכל המשתמשים רואים - בסיס לכל הרשימות

    /** טעינת כל המוצרים שהוספו (גלובליים) */
    async loadAddedProducts() {
        if (!this.firestore) return [];
        try {
            // נסה עם orderBy, אם נכשל - נסה בלי
            let snapshot;
            try {
                snapshot = await this.firestore.collection('addedProducts').orderBy('name').get();
            } catch (error) {
                if (error.code === 'failed-precondition') {
                    // אין אינדקס - נסה בלי orderBy
                    console.warn('orderBy נכשל - טוען בלי orderBy');
                    snapshot = await this.firestore.collection('addedProducts').get();
                } else {
                    throw error;
                }
            }
            
            const products = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || '',
                    quantity: data.quantity || '1',
                    category: data.category != null ? data.category : null,
                    addedAt: data.addedAt || new Date().toISOString()
                };
            }).filter(p => p.name);
            
            // מיון ידני אם אין orderBy
            products.sort((a, b) => a.name.localeCompare(b.name, 'he'));
            
            return products;
        } catch (error) {
            console.error('שגיאה בטעינת מוצרים שהוספתי:', error);
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                console.error('❌ שגיאת הרשאות ב-Firestore!');
                console.error('📋 פתרון:');
                console.error('1. לך ל-Firebase Console → Firestore Database → Rules');
                console.error('2. העתק את הכללים מ-FIRESTORE_RULES.md');
                console.error('3. לחץ על "Publish"');
                console.error('4. רענן את האפליקציה');
            }
            return [];
        }
    },

    /** הוספת מוצר לרשימה הגלובלית */
    async addGlobalProduct(product) {
        console.log('🔥 addGlobalProduct נקרא עם:', product);
        if (!this.firestore) {
            console.error('❌ אין firestore ב-FirebaseManager');
            return null;
        }
        if (!product || !product.name) {
            console.error('❌ product או product.name חסרים');
            return null;
        }
        
        try {
            const trimmed = (product.name && typeof product.name === 'string') ? product.name.trim() : '';
            if (!trimmed) {
                console.error('❌ שם מוצר ריק אחרי trim');
                return null;
            }
            
            console.log('🔍 בודק אם המוצר כבר קיים:', trimmed);
            // בדוק אם המוצר כבר קיים
            const existing = await this.firestore.collection('addedProducts')
                .where('name', '==', trimmed)
                .limit(1)
                .get();
            
            if (!existing.empty) {
                // המוצר כבר קיים - החזר את ה-ID שלו
                const existingId = existing.docs[0].id;
                console.log('✅ מוצר כבר קיים ב-Firestore, מחזיר ID:', existingId);
                return existingId;
            }
            
            console.log('➕ מוצר לא קיים - יוצר חדש ב-Firestore');
            // הוסף מוצר חדש
            const docRef = await this.firestore.collection('addedProducts').add({
                name: trimmed,
                quantity: product.quantity || '1',
                category: product.category != null ? product.category : null,
                addedAt: new Date().toISOString()
            });
            console.log('✅ מוצר חדש נוצר ב-Firestore, ID:', docRef.id);
            return docRef.id;
        } catch (error) {
            console.error('❌ שגיאה בהוספת מוצר גלובלי:', error);
            console.error('פרטי שגיאה מלאים:', {
                message: error.message,
                code: error.code,
                stack: error.stack,
                name: error.name
            });
            
            // אם זו שגיאת הרשאות, נסה להוסיף ל-localStorage
            if (error.code === 'permission-denied') {
                console.warn('⚠️ אין הרשאות ל-Firestore - המוצר לא יישמר גלובלית');
                console.warn('💡 פתרון: בדוק את כללי האבטחה ב-Firestore Console');
            } else if (error.code === 'unavailable') {
                console.warn('⚠️ Firestore לא זמין - ייתכן שאין חיבור לאינטרנט');
            } else if (error.code === 'failed-precondition') {
                console.warn('⚠️ Firestore לא מוכן - ייתכן שצריך אינדקס');
            }
            
            return null;
        }
    },

    // ---------- רשימות קיימות (Firestore collection: savedLists) ----------
    // רשימות קיימות שכל המשתמשים רואים - כל רשימה עם שם, תאריך ופריטים

    /** טעינת כל הרשימות הקיימות */
    async loadSavedLists() {
        if (!this.firestore) return [];
        try {
            const snapshot = await this.firestore.collection('savedLists')
                .orderBy('createdAt', 'desc')
                .get();
            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    name: data.name || 'רשימה ללא שם',
                    items: data.items || [],
                    createdAt: data.createdAt || new Date().toISOString(),
                    updatedAt: data.updatedAt || new Date().toISOString(),
                    sharedListId: data.sharedListId || null
                };
            });
        } catch (error) {
            console.error('שגיאה בטעינת רשימות קיימות:', error);
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                console.error('❌ שגיאת הרשאות ב-Firestore!');
                console.error('📋 פתרון:');
                console.error('1. לך ל-Firebase Console → Firestore Database → Rules');
                console.error('2. העתק את הכללים מ-FIRESTORE_RULES.md');
                console.error('3. לחץ על "Publish"');
                console.error('4. רענן את האפליקציה');
            }
            return [];
        }
    },

    /** שמירת רשימה קיימת */
    async saveList(listData) {
        if (!this.firestore || !listData) return null;
        try {
            const docRef = await this.firestore.collection('savedLists').add({
                name: listData.name || 'רשימה ללא שם',
                items: listData.items || [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                sharedListId: listData.sharedListId || null
            });
            return docRef.id;
        } catch (error) {
            console.error('שגיאה בשמירת רשימה קיימת:', error);
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                console.error('❌ שגיאת הרשאות ב-Firestore!');
                console.error('📋 פתרון: ראה FIRESTORE_RULES.md');
            }
            return null;
        }
    },

    /** עדכון רשימה קיימת */
    async updateSavedList(listId, listData) {
        if (!this.firestore || !listId || !listData) return false;
        try {
            await this.firestore.collection('savedLists').doc(listId).update({
                name: listData.name || 'רשימה ללא שם',
                items: listData.items || [],
                updatedAt: new Date().toISOString(),
                sharedListId: listData.sharedListId || null
            });
            return true;
        } catch (error) {
            console.error('שגיאה בעדכון רשימה קיימת:', error);
            return false;
        }
    },

    /** מחיקת רשימה קיימת */
    async deleteSavedList(listId) {
        if (!this.firestore || !listId) return false;
        try {
            await this.firestore.collection('savedLists').doc(listId).delete();
            return true;
        } catch (error) {
            console.error('שגיאה במחיקת רשימה קיימת:', error);
            if (error.code === 'permission-denied' || error.message.includes('permission')) {
                console.error('❌ שגיאת הרשאות ב-Firestore!');
                console.error('📋 פתרון: ראה FIRESTORE_RULES.md');
            }
            return false;
        }
    },

    /** מחיקת מוצר מהרשימה הגלובלית */
    async deleteGlobalProduct(productId) {
        if (!this.firestore || !productId) return false;
        try {
            await this.firestore.collection('addedProducts').doc(productId).delete();
            return true;
        } catch (error) {
            console.error('שגיאה במחיקת מוצר גלובלי:', error);
            return false;
        }
    },

    // יצירת רשימה חדשה
    async createList(listId, initialData) {
        if (!this.database) {
            console.error('Firebase database לא זמין - לא ניתן ליצור רשימה');
            return false;
        }

        try {
            const listRef = this.database.ref(`lists/${listId}`);
            const createdAt = initialData.createdAt ? new Date(initialData.createdAt).getTime() : firebase.database.ServerValue.TIMESTAMP;
            const data = {
                items: initialData.items || [],
                name: initialData.name || null,
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                createdAt: createdAt
            };
            
            console.log('יוצר רשימה חדשה ב-Firebase:', listId, 'עם', data.items.length, 'פריטים', 'שם:', data.name);
            await listRef.set(data);
            console.log('רשימה נוצרה בהצלחה');
            return true;
        } catch (error) {
            console.error('שגיאה ביצירת רשימה:', error);
            console.error('פרטי השגיאה:', error.message, error.code);
            return false;
        }
    },

    // טעינת רשימה
    async loadList(listId, callback) {
        if (!this.database) {
            if (callback) callback(null);
            return Promise.resolve(null);
        }

        try {
            const listRef = this.database.ref(`lists/${listId}`);
            const snapshot = await listRef.once('value');
            
            if (snapshot.exists()) {
                const data = snapshot.val();
                const result = {
                    items: data.items || [],
                    updatedAt: data.updatedAt || Date.now(),
                    name: data.name || null,
                    createdAt: data.createdAt || null
                };
                if (callback) callback(result);
                return Promise.resolve(result);
            } else {
                if (callback) callback(null);
                return Promise.resolve(null);
            }
        } catch (error) {
            console.error('שגיאה בטעינת רשימה:', error);
            if (callback) callback(null);
            return Promise.resolve(null);
        }
    },

    // עדכון רשימה
    async updateList(listId, items, listName = null) {
        if (!this.database) {
            console.warn('Firebase database לא זמין - שמירה בתור offline');
            this.addToOfflineQueue(listId, items);
            return false;
        }

        if (!this.isOnline) {
            console.warn('אין חיבור לאינטרנט - שמירה בתור offline');
            this.addToOfflineQueue(listId, items);
            return false;
        }

        try {
            const listRef = this.database.ref(`lists/${listId}`);
            const dataToUpdate = {
                items: items,
                updatedAt: firebase.database.ServerValue.TIMESTAMP
            };
            // עדכן שם אם ניתן
            if (listName) {
                dataToUpdate.name = listName;
            }
            console.log('שולח עדכון ל-Firebase:', listId, dataToUpdate);
            await listRef.update(dataToUpdate);
            console.log('עדכון הצליח');
            return true;
        } catch (error) {
            console.error('שגיאה בעדכון רשימה:', error);
            console.error('פרטי השגיאה:', error.message, error.code);
            this.addToOfflineQueue(listId, items);
            return false;
        }
    },

    // האזנה לעדכונים בזמן אמת
    subscribeToList(listId, callback) {
        if (!this.database) {
            console.error('Firebase database לא זמין - לא ניתן להתחיל האזנה');
            return;
        }

        // הסרת האזנה קודמת אם קיימת
        if (this.currentListRef && this.listListener) {
            console.log('מסיר האזנה קודמת');
            this.currentListRef.off('value', this.listListener);
        }

        this.currentListRef = this.database.ref(`lists/${listId}`);
        console.log('מתחיל האזנה לרשימה:', listId);
        
        this.listListener = (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log('קיבלתי עדכון מ-Firebase:', data.items?.length || 0, 'פריטים');
                callback({
                    items: data.items || [],
                    updatedAt: data.updatedAt || Date.now(),
                    name: data.name || null,
                    createdAt: data.createdAt || null
                });
            } else {
                console.log('רשימה לא קיימת ב-Firebase');
            }
        };

        this.currentListRef.on('value', this.listListener);
        console.log('האזנה הופעלה בהצלחה');
    },

    // הסרת האזנה
    unsubscribeFromList() {
        if (this.currentListRef && this.listListener) {
            this.currentListRef.off('value', this.listListener);
            this.currentListRef = null;
            this.listListener = null;
        }
    },

    // תור שינויים לא מקוונים
    addToOfflineQueue(listId, items) {
        const queueItem = {
            listId: listId,
            items: items,
            timestamp: Date.now(),
            retryCount: 0
        };

        // שמירה ב-localStorage
        try {
            const queue = JSON.parse(localStorage.getItem('firebase_offline_queue') || '[]');
            
            // Remove expired items (older than 7 days)
            const now = Date.now();
            const MAX_QUEUE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
            const validQueue = queue.filter(item => 
                (now - item.timestamp) < MAX_QUEUE_AGE_MS
            );
            
            // Remove duplicates (same listId) - keep only the latest
            const filtered = validQueue.filter(item => item.listId !== listId);
            filtered.push(queueItem);
            
            // Keep only recent items (sorted by timestamp, newest first)
            const MAX_QUEUE_SIZE = 10;
            const recentQueue = filtered
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, MAX_QUEUE_SIZE);
                
            localStorage.setItem('firebase_offline_queue', JSON.stringify(recentQueue));
            this.offlineQueue = recentQueue;
        } catch (error) {
            console.error('שגיאה בשמירת תור offline:', error);
            // Clear corrupted queue
            try {
                localStorage.removeItem('firebase_offline_queue');
                this.offlineQueue = [];
            } catch (e) {
                console.error('שגיאה בניקוי תור offline:', e);
            }
        }
    },

    // סנכרון תור offline
    async syncOfflineQueue() {
        if (this.isSyncing || !this.isOnline || !this.database) return;

        this.isSyncing = true;

        try {
            const queue = JSON.parse(localStorage.getItem('firebase_offline_queue') || '[]');
            
            if (queue.length === 0) {
                this.isSyncing = false;
                return;
            }

            // סנכרון כל הפריטים בתור
            for (const item of queue) {
                try {
                    await this.updateList(item.listId, item.items);
                } catch (error) {
                    console.error('שגיאה בסנכרון פריט מהתור:', error);
                }
            }

            // ניקוי התור לאחר סנכרון מוצלח
            localStorage.removeItem('firebase_offline_queue');
            this.offlineQueue = [];
            
        } catch (error) {
            console.error('שגיאה בסנכרון תור offline:', error);
        } finally {
            this.isSyncing = false;
        }
    },

    // מחיקת רשימה
    async deleteList(listId) {
        if (!this.database) return false;

        try {
            const listRef = this.database.ref(`lists/${listId}`);
            await listRef.remove();
            return true;
        } catch (error) {
            console.error('שגיאה במחיקת רשימה:', error);
            return false;
        }
    },

    // בדיקת קיום רשימה
    async listExists(listId) {
        if (!this.database) return false;

        try {
            const listRef = this.database.ref(`lists/${listId}`);
            const snapshot = await listRef.once('value');
            return snapshot.exists();
        } catch (error) {
            console.error('שגיאה בבדיקת קיום רשימה:', error);
            return false;
        }
    },

    // בדיקת חיבור ל-Firebase
    async checkConnection() {
        console.log('=== בדיקת חיבור ל-Firebase ===');
        
        // בדיקה 1: Firebase אותחל?
        console.log('1. Firebase אותחל:', window.firebaseInitialized ? '✅ כן' : '❌ לא');
        
        // בדיקה 2: FirebaseManager קיים?
        console.log('2. FirebaseManager קיים:', this ? '✅ כן' : '❌ לא');
        
        // בדיקה 3: Database קיים?
        console.log('3. Database קיים:', this.database ? '✅ כן' : '❌ לא');
        
        // בדיקה 4: חיבור לאינטרנט?
        console.log('4. חיבור לאינטרנט:', this.isOnline ? '✅ כן' : '❌ לא');
        
        // בדיקה 5: ניסיון כתיבה/קריאה
        if (this.database) {
            try {
                const testRef = this.database.ref('.info/connected');
                testRef.once('value', (snapshot) => {
                    console.log('5. חיבור ל-Firebase:', snapshot.val() ? '✅ מחובר' : '❌ לא מחובר');
                });
                
                // בדיקה 6: ניסיון כתיבה
                const testWriteRef = this.database.ref('_test_connection');
                await testWriteRef.set({
                    timestamp: Date.now(),
                    test: true
                });
                console.log('6. כתיבה ל-Firebase: ✅ הצליחה');
                
                // מחיקת הנתון הבדיקה
                await testWriteRef.remove();
                
            } catch (error) {
                console.error('6. כתיבה ל-Firebase: ❌ נכשלה', error);
                console.error('   פרטי השגיאה:', error.message, error.code);
            }
        } else {
            console.log('5-6. לא ניתן לבדוק - Database לא קיים');
        }
        
        console.log('=== סיום בדיקה ===');
        return {
            initialized: window.firebaseInitialized,
            managerExists: !!this,
            databaseExists: !!this.database,
            isOnline: this.isOnline
        };
    }
};

// אתחול מתבצע פעם אחת ב-app.js (DOMContentLoaded)
// הפוך את FirebaseManager לזמין גלובלית
window.FirebaseManager = FirebaseManager;
