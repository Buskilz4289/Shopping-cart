// ============================================
// Firebase Integration Module
// ============================================
// מודול לניהול סנכרון רשימות עם Firebase Realtime Database

const FirebaseManager = {
    database: null,
    currentListRef: null,
    listListener: null,
    isOnline: navigator.onLine,
    offlineQueue: [],
    isSyncing: false,

    // אתחול
    init() {
        if (!window.firebaseInitialized) {
            console.warn('Firebase לא מוגדר - השיתוף לא יעבוד');
            return false;
        }

        this.database = firebase.database();
        
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

    // יצירת רשימה חדשה
    async createList(listId, initialData) {
        if (!this.database) {
            console.error('Firebase database לא זמין - לא ניתן ליצור רשימה');
            return false;
        }

        try {
            const listRef = this.database.ref(`lists/${listId}`);
            const data = {
                items: initialData.items || [],
                updatedAt: firebase.database.ServerValue.TIMESTAMP,
                createdAt: firebase.database.ServerValue.TIMESTAMP
            };
            
            console.log('יוצר רשימה חדשה ב-Firebase:', listId, 'עם', data.items.length, 'פריטים');
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
                    updatedAt: data.updatedAt || Date.now()
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
    async updateList(listId, items) {
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
                    updatedAt: data.updatedAt || Date.now()
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
            timestamp: Date.now()
        };

        // שמירה ב-localStorage
        try {
            const queue = JSON.parse(localStorage.getItem('firebase_offline_queue') || '[]');
            queue.push(queueItem);
            // שמירת רק 10 השינויים האחרונים
            const recentQueue = queue.slice(-10);
            localStorage.setItem('firebase_offline_queue', JSON.stringify(recentQueue));
            this.offlineQueue = recentQueue;
        } catch (error) {
            console.error('שגיאה בשמירת תור offline:', error);
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

// אתחול אוטומטי
if (window.firebaseInitialized) {
    document.addEventListener('DOMContentLoaded', () => {
        FirebaseManager.init();
    });
}

// הפוך את FirebaseManager לזמין גלובלית לבדיקות
window.FirebaseManager = FirebaseManager;
