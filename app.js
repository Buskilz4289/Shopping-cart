// ============================================
// רשימת קניות - JavaScript עם תכונות מתקדמות
// ============================================

// ניהול מצב – נתונים (Firestore / localStorage)
let shoppingList = [];
let addedProducts = [];       // מוצרים שהוספתי - כל מוצר שנוסף לרשימה מתווסף כאן
let shoppingHistory = [];
let recurringItems = [];
let sharedListId = null;

// UI state – ניווט ומצב תצוגה (לא נשמר ב-Firestore)
let isShoppingMode = false;
let currentView = 'current';  // 'current' | 'added' | 'history'
let hidePurchasedInView = false;  // אחרי "סיום קנייה" – להסתיר נקנו רק בתצוגה

let autocompleteSuggestions = [];
let selectedAutocompleteIndex = -1;
let touchStartX = 0;
let touchStartY = 0;
let longPressTimer = null;

// רשימת מוצרי קבע גלובליים – נוצרים ב-Firestore products אם לא קיימים (ללא כפילויות)
const FIXED_PRODUCT_NAMES_RAW = [
    'נס קפה', 'קפה שלור', 'סוכר', 'תירוש', 'לחם פרוס', 'אננס שימורים', 'עוגיוצ לילדים',
    'לפוציפס קידס', 'עוגות גיא', 'חטיפי אנאגיה גיא', 'חטיפי אנרגיה תמי', 'תירס שימורים',
    'פתיבר', 'מלפפון', 'תפוא', '4 גמבה', 'סלרי', 'כוסברה', 'פטרוזיליה', 'פטריות', 'בננות',
    'אגסים', 'חלב', 'ביצים', 'מעדנים סקוויז', 'אטריות נודלס', 'שמנת מתוקה', 'קקאו', 'רסק',
    'חטיפי אנרגיה גיא', 'איטריות', 'עדשים', 'קורנםלקס צהוב', 'קרונפלקס בטעם', 'לטיפי אנרגיה תמי',
    'מיונז', 'פיירי', 'שום כתוש', 'מוצרלה', 'חסות', 'תפוחים', 'בצל סגול', 'שום קלוף', 'פומלה',
    'פקאן מסוכר', 'שקדי מרק', 'קטשופ', 'חטיפי אנרכיה גיא', 'קרונפלקס אישי לגיא', 'קרונפלקס חלב גיא',
    'בייגלה חלבון', 'קינדר כארדס', 'שעועית חמין', 'סלמון', 'שוקו חלבון', 'עגבניוצ שרי', 'צנוניות',
    'מגבונים', 'סטרילי'
];
// הסרת כפילויות לפי שם (trim)
const FIXED_PRODUCT_NAMES = [...new Set(FIXED_PRODUCT_NAMES_RAW.map(n => (n && typeof n === 'string' ? n.trim() : '')).filter(Boolean))];

// רשימת קטגוריות
const CATEGORIES = [
    'מוצרי חלב',
    'מוצרי יסוד',
    'פירות וירקות',
    'בשר | עופות | דגים',
    'חטיפים וממתקים',
    'משקאות',
    'קפואים',
    'תבלינים',
    'אפייה',
    'פיצוחים ופירות יבשים',
    'מוצרי ניקיון וחד פעמי',
    'שונות'
];


// אלמנטי DOM
const addItemForm = document.getElementById('addItemForm');
const itemNameInput = document.getElementById('itemName');
const shoppingListContainer = document.getElementById('shoppingList');
const addedListContainer = document.getElementById('addedList');
const historyListContainer = document.getElementById('historyList');
const shoppingModeList = document.getElementById('shoppingModeList');
const emptyState = document.getElementById('emptyState');
const addedEmptyState = document.getElementById('addedEmptyState');
const historyEmptyState = document.getElementById('historyEmptyState');
const clearPurchasedBtn = document.getElementById('clearPurchasedBtn');
const smartCleanupBtn = document.getElementById('smartCleanupBtn');
const shareListBtn = document.getElementById('shareListBtn');
const darkModeToggle = document.getElementById('darkModeToggle');
const shoppingModeToggle = document.getElementById('shoppingModeToggle');
const exitShoppingModeBtn = document.getElementById('exitShoppingMode');
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const autocompleteDropdown = document.getElementById('autocompleteDropdown');
const recurringSuggestions = document.getElementById('recurringSuggestions');
const sharingSection = document.getElementById('sharingSection');

// אתחול האפליקציה
document.addEventListener('DOMContentLoaded', async () => {
    // אתחול Firebase קודם כל
    if (FirebaseManager && FirebaseManager.init()) {
        console.log('Firebase אותחל בהצלחה');
    } else {
        console.warn('Firebase לא אותחל - שיתוף לא יעבוד');
    }
    
    // בדיקה אם יש list ID ב-URL (או יצירת אחד אוטומטית)
    await checkUrlForListId();
    
    // טעינת נתונים - תמיד נטען מ-Firebase אם יש sharedListId, אחרת מ-localStorage
    if (sharedListId) {
        await loadSharedListFromFirebase();
    } else {
        loadFromLocalStorage();
        detectRecurringItems();
        renderList();
        renderHistory();
        updateSmartSummary();
    }
    
    // טען מוצרים שהוספתי מ-Firestore (גלובליים)
    await loadAddedProductsFromFirestore();
    renderAddedProducts();
    
    // התחל האזנה לעדכוני מוצרים שהוספתי מ-Firestore
    setupAddedProductsListener();

    setupEventListeners();
    loadTheme();
    checkAndSaveHistory();
    setupSharing();
    setupAutocomplete();
    setupMobileGestures();
    
    // סנכרון תור offline אם יש חיבור
    if (FirebaseManager && FirebaseManager.database) {
        FirebaseManager.syncOfflineQueue();
    }
});

/** יוצרת את כל המוצרים הקבועים ב-Firestore אם אינם קיימים (ללא כפילויות). */
async function createFixedProducts() {
    if (!FirebaseManager || !FirebaseManager.firestore) return;
    try {
        const added = await FirebaseManager.createFixedProductsIfMissing(FIXED_PRODUCT_NAMES);
        if (added > 0) console.log('נוספו מוצרי קבע:', added);
    } catch (e) {
        console.error('שגיאה ביצירת מוצרי קבע:', e);
    }
}

/** טוענת מוצרי קבע מ-Firestore ל-UI (משמשת את favorites לתצוגה). */
async function loadFixedProducts() {
    if (FirebaseManager && FirebaseManager.firestore) {
        const products = await FirebaseManager.loadFixedProducts();
        favorites = (products || []).map(p => ({
            id: p.id,
            name: p.name,
            favorite: p.favorite === true,
            category: p.category,
            quantity: '1',
            addedAt: new Date().toISOString()
        }));
        return;
    }
    const savedFavorites = localStorage.getItem('favorites');
    if (savedFavorites) {
        try {
            const parsed = JSON.parse(savedFavorites);
            favorites = parsed.filter(f => f && f.name);
        } catch (e) {
            favorites = [];
        }
    } else {
        favorites = [];
    }
}

// כל הקוד הקשור למועדפים הוסר - משתמשים ב-addedProducts במקום

// עדכון גרסת האפליקציה - עדכון Service Worker, ניקוי מטמון וטעינה מחדש
async function updateApplicationVersion() {
    const updateButton = document.getElementById('updateVersionButton');
    const originalText = updateButton ? updateButton.textContent : '';
    
    // הצג הודעה למשתמש
    if (updateButton) {
        updateButton.textContent = '⏳ מעדכן...';
        updateButton.disabled = true;
    }
    
    try {
        // 1. עדכון Service Worker
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    console.log('מעדכן Service Worker...');
                    await registration.update();
                    
                    // בדוק אם יש Service Worker חדש שממתין
                    if (registration.waiting) {
                        console.log('Service Worker חדש ממתין - מעדכן...');
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    }
                    
                    // נסה לשלוח הודעה ל-Service Worker לעדכן את המטמון
                    if (registration.active) {
                        registration.active.postMessage({ type: 'CLEAR_CACHE' });
                    }
                    
                    console.log('Service Worker עודכן בהצלחה');
                } else {
                    console.log('אין Service Worker רשום');
                }
            } catch (error) {
                console.error('שגיאה בעדכון Service Worker:', error);
            }
        }
        
        // 2. ניקוי מטמון
        if ('caches' in window) {
            try {
                console.log('מנקה מטמון...');
                const cacheNames = await caches.keys();
                await Promise.all(
                    cacheNames.map(cacheName => {
                        console.log('מוחק מטמון:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
                console.log('מטמון נוקה בהצלחה');
            } catch (error) {
                console.error('שגיאה בניקוי מטמון:', error);
            }
        }
        
        // 3. הודעה למשתמש
        if (updateButton) {
            updateButton.textContent = '✓ עודכן!';
            updateButton.style.backgroundColor = 'var(--success-color, #4caf50)';
        }
        
        // 4. טעינה מחדש אחרי שנייה
        setTimeout(() => {
            console.log('טוען מחדש את הדף...');
            window.location.reload(true);
        }, 1000);
        
    } catch (error) {
        console.error('שגיאה בעדכון גרסה:', error);
        
        if (updateButton) {
            updateButton.textContent = '❌ שגיאה';
            updateButton.style.backgroundColor = 'var(--error-color, #f44336)';
            
            setTimeout(() => {
                updateButton.textContent = originalText;
                updateButton.style.backgroundColor = '';
                updateButton.disabled = false;
            }, 2000);
        }
        
        alert('אירעה שגיאה בעדכון הגרסה. אנא נסה שוב.');
    }
}

// הגדרת מאזיני אירועים
function setupEventListeners() {
    addItemForm.addEventListener('submit', handleAddItem);
    clearPurchasedBtn.addEventListener('click', handleClearPurchased);
    smartCleanupBtn.addEventListener('click', handleSmartCleanup);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    shoppingModeToggle.addEventListener('click', toggleShoppingMode);
    exitShoppingModeBtn.addEventListener('click', exitShoppingMode);
    shareListBtn.addEventListener('click', showSharingSection);
    
    // כפתור עדכון גרסה
    const updateVersionButton = document.getElementById('updateVersionButton');
    if (updateVersionButton) {
        updateVersionButton.addEventListener('click', async () => {
            await updateApplicationVersion();
        });
    }
    
    // כפתור רענון
    const refreshButton = document.getElementById('refreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', async () => {
            // נסה לעדכן את Service Worker קודם
            if ('serviceWorker' in navigator) {
                try {
                    const registration = await navigator.serviceWorker.getRegistration();
                    if (registration) {
                        await registration.update();
                        // נסה לשלוח הודעה ל-Service Worker לעדכן את המטמון
                        if (registration.active) {
                            registration.active.postMessage({ type: 'CLEAR_CACHE' });
                        }
                    }
                } catch (error) {
                    console.error('שגיאה בעדכון Service Worker:', error);
                }
            }
            
            // נקה את המטמון של הדפדפן
            if ('caches' in window) {
                try {
                    const cacheNames = await caches.keys();
                    await Promise.all(
                        cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                    console.log('מטמון נוקה בהצלחה');
                } catch (error) {
                    console.error('שגיאה בניקוי מטמון:', error);
                }
            }
            
            // רענון הדף
            window.location.reload(true);
        });
    }
    
    // כפתור שמירה
    const saveListBtn = document.getElementById('saveListBtn');
    if (saveListBtn) {
        saveListBtn.addEventListener('click', handleSaveList);
    }
    
    // כפתור רשימה חדשה
    const newListBtn = document.getElementById('newListBtn');
    if (newListBtn) {
        newListBtn.addEventListener('click', handleNewList);
    }
    
    // כפתור ייצוא רשימה
    const exportListBtn = document.getElementById('exportListBtn');
    if (exportListBtn) {
        exportListBtn.addEventListener('click', handleExportList);
    }
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // שיתוף
    document.getElementById('copyShareLink').addEventListener('click', copyShareLink);
    document.getElementById('generateNewLink').addEventListener('click', generateNewShareLink);
    document.getElementById('stopSharing').addEventListener('click', stopSharing);
    document.getElementById('closeSharing').addEventListener('click', hideSharingSection);
    document.getElementById('dismissSuggestions').addEventListener('click', dismissRecurringSuggestions);
    document.getElementById('toggleCategoryBreakdown').addEventListener('click', toggleCategoryBreakdown);
    
    // מצב קנייה
    const finishShoppingBtn = document.getElementById('finishShoppingBtn');
    if (finishShoppingBtn) {
        finishShoppingBtn.addEventListener('click', showShoppingSummary);
    }
    
    const closeSummaryModal = document.getElementById('closeSummaryModal');
    const closeSummaryBtn = document.getElementById('closeSummaryBtn');
    if (closeSummaryModal) {
        closeSummaryModal.addEventListener('click', hideShoppingSummary);
    }
    if (closeSummaryBtn) {
        closeSummaryBtn.addEventListener('click', hideShoppingSummary);
    }
}

// החלפת טאב – ניווט ידני בלבד (UI state)
function switchTab(tabName) {
    if (isShoppingMode) {
        return;
    }

    currentView = tabName;

    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });

    const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}Tab`);

    if (selectedBtn && selectedContent) {
        selectedBtn.classList.add('active');
        selectedContent.classList.add('active');
        selectedContent.style.display = 'block';
        
        // עדכן את התצוגה לפי הטאב שנבחר
        if (tabName === 'added') {
            renderAddedProducts();
        } else if (tabName === 'history') {
            renderHistory();
        } else if (tabName === 'current') {
            renderList();
        }
    }
}

// מצב קניות
function toggleShoppingMode() {
    isShoppingMode = !isShoppingMode;
    
    if (isShoppingMode) {
        enterShoppingMode();
    } else {
        exitShoppingMode();
    }
}

function enterShoppingMode() {
    isShoppingMode = true;
    shoppingModeToggle.classList.add('active');
    
    // הסתר אלמנטים לא רלוונטיים
    const smartSummary = document.getElementById('smartSummary');
    const recurringSuggestions = document.getElementById('recurringSuggestions');
    const addItemSection = document.getElementById('addItemForm')?.closest('.add-item-section');
    const tabsNav = document.querySelector('.tabs-nav');
    const currentTab = document.getElementById('currentTab');
    const favoritesTab = document.getElementById('favoritesTab');
    const historyTab = document.getElementById('historyTab');
    const sharingSection = document.getElementById('sharingSection');
    
    if (smartSummary) smartSummary.style.display = 'none';
    if (recurringSuggestions) recurringSuggestions.style.display = 'none';
    if (addItemSection) addItemSection.style.display = 'none';
    if (tabsNav) tabsNav.style.display = 'none';
    if (currentTab) {
        currentTab.classList.remove('active');
        currentTab.style.display = 'none';
    }
    if (favoritesTab) {
        favoritesTab.classList.remove('active');
        favoritesTab.style.display = 'none';
    }
    if (historyTab) {
        historyTab.classList.remove('active');
        historyTab.style.display = 'none';
    }
    if (sharingSection) sharingSection.style.display = 'none';
    
    // הצג את מצב הקנייה
    const shoppingModeTab = document.getElementById('shoppingModeTab');
    if (shoppingModeTab) {
        shoppingModeTab.classList.add('active');
        shoppingModeTab.style.display = 'block';
        shoppingModeTab.style.visibility = 'visible';
        shoppingModeTab.style.opacity = '1';
        shoppingModeTab.style.position = 'relative';
        shoppingModeTab.style.zIndex = '1';
    }
    
    // המתן קצת לפני רינדור כדי לוודא שהאלמנטים מוסתרים
    setTimeout(() => {
        renderShoppingMode();
        // גלול למעלה כדי לראות את הרשימה
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 50);
}

function exitShoppingMode() {
    isShoppingMode = false;
    shoppingModeToggle.classList.remove('active');
    
    // הצג מחדש את כל האלמנטים
    document.getElementById('smartSummary').style.display = 'block';
    document.getElementById('recurringSuggestions').style.display = '';
    document.getElementById('addItemForm').closest('.add-item-section').style.display = 'block';
    document.querySelector('.tabs-nav').style.display = 'flex';
    document.getElementById('currentTab').style.display = 'block';
    document.getElementById('favoritesTab').style.display = '';
    document.getElementById('historyTab').style.display = '';
    
    const shoppingModeTab = document.getElementById('shoppingModeTab');
    if (shoppingModeTab) {
        shoppingModeTab.classList.remove('active');
        shoppingModeTab.style.display = 'none';
    }
    
    // בדוק אם יש פריטים שנקנו - אם כן, הצג סיכום
    const purchasedCount = shoppingList.filter(item => item.purchased).length;
    if (purchasedCount > 0) {
        // אפשר למשתמש לראות את הסיכום
        setTimeout(() => {
            if (confirm('יש פריטים שנקנו. האם להציג סיכום קנייה?')) {
                showShoppingSummary();
            }
        }, 300);
    }
    
    switchTab('current');
    renderList();
    updateSmartSummary();
}

function renderShoppingMode() {
    // הפרד בין פריטים שלא נקנו לפריטים שנקנו; כשמוסתרים נקנו – הצג רק לא נקנו
    const unpurchasedItems = shoppingList.filter(item => !item.purchased);
    const purchasedItems = hidePurchasedInView ? [] : shoppingList.filter(item => item.purchased);

    shoppingModeList.innerHTML = '';

    const remaining = unpurchasedItems.length;
    document.getElementById('shoppingModeRemaining').textContent = remaining;

    // אם אין פריטים בכלל, הצג הודעה
    if (shoppingList.length === 0) {
        const emptyMsg = document.createElement('li');
        emptyMsg.className = 'shopping-mode-empty';
        emptyMsg.textContent = '📦 הרשימה ריקה';
        shoppingModeList.appendChild(emptyMsg);
        return;
    }
    
    // מיון לפי קטגוריות
    const unpurchasedByCategory = {};
    const unpurchasedWithoutCategory = [];
    
    unpurchasedItems.forEach(item => {
        if (item.category && item.category.trim()) {
            if (!unpurchasedByCategory[item.category]) {
                unpurchasedByCategory[item.category] = [];
            }
            unpurchasedByCategory[item.category].push(item);
        } else {
            unpurchasedWithoutCategory.push(item);
        }
    });
    
    // מיון פריטים בכל קטגוריה לפי א-ב (אלפבית עברי)
    Object.keys(unpurchasedByCategory).forEach(category => {
        unpurchasedByCategory[category].sort((a, b) => 
            a.name.localeCompare(b.name, 'he')
        );
    });
    
    unpurchasedWithoutCategory.sort((a, b) => 
        a.name.localeCompare(b.name, 'he')
    );
    
    // מיון גם פריטים שנקנו לפי א-ב
    purchasedItems.sort((a, b) => 
        a.name.localeCompare(b.name, 'he')
    );
    
    // הצג תחילה את הפריטים שלא נקנו לפי קטגוריות
    CATEGORIES.forEach(category => {
        if (unpurchasedByCategory[category] && unpurchasedByCategory[category].length > 0) {
            const categoryHeader = document.createElement('li');
            categoryHeader.className = 'category-header shopping-mode-category-header';
            categoryHeader.innerHTML = `<h4>${category}</h4>`;
            shoppingModeList.appendChild(categoryHeader);
            
            unpurchasedByCategory[category].forEach(item => {
                createShoppingModeItem(item, false);
            });
        }
    });
    
    // קטגוריות אחרות
    Object.keys(unpurchasedByCategory).forEach(category => {
        if (!CATEGORIES.includes(category)) {
            const categoryHeader = document.createElement('li');
            categoryHeader.className = 'category-header shopping-mode-category-header';
            categoryHeader.innerHTML = `<h4>${category}</h4>`;
            shoppingModeList.appendChild(categoryHeader);
            
            unpurchasedByCategory[category].forEach(item => {
                createShoppingModeItem(item, false);
            });
        }
    });
    
    // פריטים ללא קטגוריה
    if (unpurchasedWithoutCategory.length > 0) {
        unpurchasedWithoutCategory.forEach(item => {
            createShoppingModeItem(item, false);
        });
    }
    
    // הצג אחר כך את הפריטים שנקנו (עם קו חוצה) בתחתית
    purchasedItems.forEach(item => {
        createShoppingModeItem(item, true);
    });
    
    // עדכן את כפתור סיום קנייה - הצג אם יש פריטים שנקנו
    const purchasedCount = purchasedItems.length;
    const footer = document.querySelector('.shopping-mode-footer');
    if (footer) {
        footer.style.display = purchasedCount > 0 ? 'block' : 'none';
    }
}

// יצירת פריט במצב קניות
function createShoppingModeItem(item, isPurchased) {
    const li = document.createElement('li');
    li.className = `shopping-mode-item ${isPurchased ? 'purchased' : ''}`;
    li.dataset.itemId = item.id;
    
    // כפתור V - לחץ לסמן כנקנה/לא נקנה
    const statusBtn = document.createElement('button');
    statusBtn.className = `shopping-mode-status ${isPurchased ? 'purchased' : 'not-purchased'}`;
    statusBtn.textContent = '✓';
    statusBtn.setAttribute('aria-label', isPurchased ? 'נקנה - לחץ לבטל סימון' : 'לחץ לסמן כנקנה');
    statusBtn.addEventListener('click', () => {
        togglePurchased(item.id);
        renderShoppingMode();
        updateSmartSummary();
        hapticFeedback();
    });
    
    const content = document.createElement('div');
    content.className = 'shopping-mode-content';
    
    // שורה ראשונה: שם + כמות + כפתור מחק
    const nameRow = document.createElement('div');
    nameRow.className = 'shopping-mode-name-row';
    
    const name = document.createElement('span');
    name.className = `shopping-mode-name ${isPurchased ? 'purchased-name' : ''}`;
    name.textContent = item.name;
    
    // כמות - עריכה קטנה ליד השם
    const quantityInput = document.createElement('input');
    quantityInput.type = 'text';
    quantityInput.className = 'shopping-mode-quantity-inline';
    quantityInput.value = item.quantity || '1';
    quantityInput.placeholder = '1';
    quantityInput.addEventListener('blur', () => {
        updateItemQuantity(item.id, quantityInput.value.trim());
    });
    quantityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            quantityInput.blur();
        }
    });
    
    // כפתור מחק - איקס אדום
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete shopping-mode-delete';
    deleteBtn.innerHTML = '✕';
    deleteBtn.addEventListener('click', () => deleteItem(item.id));
    deleteBtn.setAttribute('aria-label', `מחק ${item.name}`);
    
    nameRow.appendChild(name);
    nameRow.appendChild(quantityInput);
    nameRow.appendChild(deleteBtn);
    
    // קטגוריה (אם יש) - בשורה נפרדת קטנה
    if (item.category) {
        const categorySpan = document.createElement('span');
        categorySpan.className = 'shopping-mode-category';
        categorySpan.textContent = item.category;
        content.appendChild(categorySpan);
    }
    
    content.appendChild(nameRow);
    
    li.appendChild(statusBtn);
    li.appendChild(content);
    shoppingModeList.appendChild(li);
}

// הוספת פריט חדש
async function handleAddItem(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const itemName = formData.get('itemName').trim();
    const itemQuantity = formData.get('itemQuantity').trim();
    const itemCategory = formData.get('itemCategory').trim();
    
    if (!itemName) {
        return;
    }
    
    // בדיקת כפילויות
    const duplicate = shoppingList.find(item => 
        !item.purchased && 
        normalizeText(item.name) === normalizeText(itemName)
    );
    
    if (duplicate) {
        if (!confirm(`הפריט "${itemName}" כבר קיים ברשימה. האם להוסיף בכל זאת?`)) {
            return;
        }
    }
    
    const newItem = {
        id: Date.now().toString(),
        name: itemName,
        quantity: itemQuantity || '1',
        category: itemCategory || null,
        purchased: false,
        createdAt: new Date().toISOString()
    };
    
    shoppingList.push(newItem);
    
    // הוסף את המוצר לרשימת "מוצרים שהוספתי" ב-Firestore (גלובלי) אם לא קיים
    const existingAdded = addedProducts.find(p => normalizeText(p.name) === normalizeText(itemName));
    console.log('handleAddItem - בדיקת מוצר קיים:', itemName, 'קיים:', !!existingAdded);
    
    if (!existingAdded) {
        console.log('מוצר לא קיים - מוסיף ל-Firestore:', itemName);
        if (FirebaseManager && FirebaseManager.firestore) {
            try {
                // שמור ב-Firestore
                const productId = await FirebaseManager.addGlobalProduct({
                    name: itemName,
                    quantity: itemQuantity || '1',
                    category: itemCategory || null
                });
                console.log('addGlobalProduct החזיר:', productId);
                
                if (productId) {
                    // בדוק שוב אם המוצר כבר קיים ב-array (אם ההאזנה עדכנה בינתיים)
                    const alreadyInArray = addedProducts.find(p => 
                        p.id === productId || normalizeText(p.name) === normalizeText(itemName)
                    );
                    
                    if (!alreadyInArray) {
                        // עדכן את ה-array המקומי מיד
                        addedProducts.push({
                            id: productId,
                            name: itemName,
                            quantity: itemQuantity || '1',
                            category: itemCategory || null,
                            addedAt: new Date().toISOString()
                        });
                        console.log('✅ מוצר נוסף ל-addedProducts מקומי:', itemName, 'ID:', productId);
                        console.log('סה"כ מוצרים ב-addedProducts:', addedProducts.length);
                    } else {
                        console.log('⚠️ מוצר כבר קיים ב-addedProducts (ההאזנה עדכנה):', itemName);
                    }
                } else {
                    console.error('❌ שגיאה: addGlobalProduct החזיר null עבור:', itemName);
                    // Fallback - הוסף ל-localStorage גם אם Firestore נכשל
                    const fallbackId = Date.now().toString() + '-added';
                    const alreadyInFallback = addedProducts.find(p => 
                        p.id === fallbackId || normalizeText(p.name) === normalizeText(itemName)
                    );
                    if (!alreadyInFallback) {
                        addedProducts.push({
                            id: fallbackId,
                            name: itemName,
                            quantity: itemQuantity || '1',
                            category: itemCategory || null,
                            addedAt: new Date().toISOString()
                        });
                        console.log('✅ מוצר נוסף ל-addedProducts (fallback אחרי שגיאת Firestore):', itemName);
                        console.log('סה"כ מוצרים ב-addedProducts:', addedProducts.length);
                        // עדכן תצוגה מיד
                        renderAddedProducts();
                        // שמור ב-localStorage
                        try {
                            localStorage.setItem('addedProducts', JSON.stringify(addedProducts));
                            console.log('✅ נשמר ב-localStorage');
                        } catch (e) {
                            console.error('שגיאה בשמירה ל-localStorage:', e);
                        }
                    } else {
                        console.log('⚠️ מוצר כבר קיים ב-addedProducts (fallback):', itemName);
                    }
                }
            } catch (error) {
                console.error('❌ שגיאה בהוספת מוצר ל-Firestore:', error);
                // Fallback - הוסף ל-localStorage
                addedProducts.push({
                    id: Date.now().toString() + '-added',
                    name: itemName,
                    quantity: itemQuantity || '1',
                    category: itemCategory || null,
                    addedAt: new Date().toISOString()
                });
                console.log('מוצר נוסף ל-addedProducts (fallback localStorage):', itemName);
            }
        } else {
            // Fallback ל-localStorage אם אין Firestore
            console.log('אין Firestore - משתמש ב-localStorage');
            addedProducts.push({
                id: Date.now().toString() + '-added',
                name: itemName,
                quantity: itemQuantity || '1',
                category: itemCategory || null,
                addedAt: new Date().toISOString()
            });
            console.log('✅ מוצר נוסף ל-addedProducts (localStorage):', itemName);
        }
    } else {
        console.log('ℹ️ מוצר כבר קיים ב-addedProducts:', itemName);
    }
    
    saveToLocalStorage();
    renderList();
    // עדכן את תצוגת מוצרים שהוספתי (אם לא עודכן על ידי ההאזנה)
    setTimeout(() => {
        renderAddedProducts();
    }, 100);
    updateSmartSummary();
    await syncSharedList();
    updateUrlWithListId();
    
    e.target.reset();
    itemNameInput.focus();
    autocompleteDropdown.classList.remove('show');
    hapticFeedback();
}

// סימון כנקנה/לא נקנה
async function togglePurchased(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        item.purchased = !item.purchased;
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        checkAndSaveHistory();
        await syncSharedList();
        hapticFeedback();
    }
}

// עדכון כמות פריט
async function updateItemQuantity(itemId, newQuantity) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        item.quantity = newQuantity || '1';
        saveToLocalStorage();
        if (isShoppingMode) {
            renderShoppingMode();
        } else {
            renderList();
        }
        await syncSharedList();
        hapticFeedback();
    }
}

// הפונקציה toggleFavorite הוסרה - אין עוד מועדפים
// כל מוצר שנוסף לרשימה מתווסף אוטומטית ל-addedProducts

// מחיקת פריט
async function deleteItem(itemId) {
    if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
        shoppingList = shoppingList.filter(item => item.id !== itemId);
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        checkAndSaveHistory();
        await syncSharedList();
        hapticFeedback();
    }
}

// ניקוי פריטים שנקנו
async function handleClearPurchased() {
    const purchasedCount = shoppingList.filter(item => item.purchased).length;
    
    if (purchasedCount === 0) {
        return;
    }
    
    if (confirm(`האם אתה בטוח שברצונך למחוק ${purchasedCount} פריטים שנקנו?`)) {
        saveCurrentListToHistory();
        shoppingList = shoppingList.filter(item => !item.purchased);
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        await syncSharedList();
    }
}

// ניקוי כפילויות חכם
async function handleSmartCleanup() {
    const duplicates = findDuplicates();
    
    if (duplicates.length === 0) {
        alert('לא נמצאו כפילויות');
        return;
    }
    
    let mergeCount = 0;
    duplicates.forEach(group => {
        if (group.length > 1) {
            const merged = mergeItems(group);
            shoppingList = shoppingList.filter(item => !group.includes(item.id));
            shoppingList.push(merged);
            mergeCount++;
        }
    });
    
    if (mergeCount > 0) {
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        await syncSharedList();
        alert(`מוזגו ${mergeCount} קבוצות של כפילויות`);
        hapticFeedback();
    }
}

function findDuplicates() {
    const groups = {};
    const unpurchased = shoppingList.filter(item => !item.purchased);
    
    unpurchased.forEach(item => {
        const normalized = normalizeText(item.name);
        if (!groups[normalized]) {
            groups[normalized] = [];
        }
        groups[normalized].push(item.id);
    });
    
    return Object.values(groups).filter(group => group.length > 1);
}

function mergeItems(itemIds) {
    const items = itemIds.map(id => shoppingList.find(item => item.id === id));
    const firstItem = items[0];
    
    return {
        id: firstItem.id,
        name: firstItem.name,
        quantity: items.find(i => i.quantity)?.quantity || firstItem.quantity,
        category: items.find(i => i.category)?.category || firstItem.category,
        purchased: false,
        favorite: items.some(i => i.favorite),
        createdAt: firstItem.createdAt
    };
}

function normalizeText(text) {
    return text.toLowerCase().trim().replace(/\s+/g, ' ');
}

// בדיקה ושמירה אוטומטית להיסטוריה
function checkAndSaveHistory() {
    if (shoppingList.length > 0 && shoppingList.every(item => item.purchased)) {
        saveCurrentListToHistory();
    }
}

// שמירת הרשימה הנוכחית להיסטוריה
function saveCurrentListToHistory() {
    if (shoppingList.length === 0) {
        return;
    }
    
    const historyEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: shoppingList.map(item => ({
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            purchased: item.purchased
        }))
    };
    
    shoppingHistory.unshift(historyEntry);
    
    if (shoppingHistory.length > 50) {
        shoppingHistory = shoppingHistory.slice(0, 50);
    }
    
    saveToLocalStorage();
    renderHistory();
    detectRecurringItems();
}

// זיהוי מוצרים חוזרים
function detectRecurringItems() {
    const itemCounts = {};
    
    shoppingHistory.forEach(entry => {
        entry.items.forEach(item => {
            const normalized = normalizeText(item.name);
            if (!itemCounts[normalized]) {
                itemCounts[normalized] = { count: 0, item: item };
            }
            itemCounts[normalized].count++;
        });
    });
    
    recurringItems = Object.values(itemCounts)
        .filter(entry => entry.count >= 3)
        .map(entry => ({
            name: entry.item.name,
            quantity: entry.item.quantity,
            category: entry.item.category,
            frequency: entry.count
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 10);
    
    showRecurringSuggestions();
}

function showRecurringSuggestions() {
    if (recurringItems.length === 0) {
        recurringSuggestions.style.display = 'none';
        return;
    }
    
    const inList = recurringItems.filter(recurring => 
        shoppingList.some(item => normalizeText(item.name) === normalizeText(recurring.name) && !item.purchased)
    );
    
    if (inList.length === recurringItems.length) {
        recurringSuggestions.style.display = 'none';
        return;
    }
    
    recurringSuggestions.style.display = 'block';
    const list = document.getElementById('recurringItemsList');
    list.innerHTML = '';
    
    recurringItems.forEach(item => {
        const inCurrentList = shoppingList.some(i => 
            normalizeText(i.name) === normalizeText(item.name) && !i.purchased
        );
        
        if (!inCurrentList) {
            const btn = document.createElement('button');
            btn.className = 'suggestion-item';
            btn.textContent = item.name;
            btn.addEventListener('click', () => addRecurringItem(item));
            list.appendChild(btn);
        }
    });
}

function dismissRecurringSuggestions() {
    recurringSuggestions.style.display = 'none';
}

async function addRecurringItem(item) {
    const newItem = {
        id: Date.now().toString(),
        name: item.name,
        quantity: item.quantity || null,
        category: item.category || null,
        purchased: false,
        favorite: false,
        createdAt: new Date().toISOString()
    };
    
    shoppingList.push(newItem);
    saveToLocalStorage();
    renderList();
    updateSmartSummary();
    showRecurringSuggestions();
    await syncSharedList();
    hapticFeedback();
}

// שחזור רשימה מהיסטוריה
async function restoreFromHistory(historyId) {
    const historyEntry = shoppingHistory.find(h => h.id === historyId);
    if (!historyEntry) {
        return;
    }
    
    if (confirm('האם אתה בטוח שברצונך לשחזר רשימה זו? הרשימה הנוכחית תוחלף.')) {
        shoppingList = historyEntry.items.map(item => ({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: item.name,
            quantity: item.quantity,
            category: item.category,
            purchased: false,
            favorite: favorites.some(f => normalizeText(f.name) === normalizeText(item.name)),
            createdAt: new Date().toISOString()
        }));
        
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        switchTab('current');
        await syncSharedList();
    }
}

// הפונקציה addFavoriteToList הוסרה - משתמשים ב-addAddedProductToList במקום

/**
 * מוסיפה מוצר קבוע לרשימת קניות (lists/{listId}) בלי לשנות מסך/ניווט.
 * @param {string|null} listRef - מזהה הרשימה (listId) ל-Firebase; null = רשימה מקומית בלבד
 * @param {string} productName - שם המוצר הקבוע
 */
async function addFixedProductToList(listRef, productName) {
    const name = (productName && typeof productName === 'string') ? productName.trim() : '';
    if (!name) return;

    const p = favorites.find(f => normalizeText(f.name) === normalizeText(name));
    if (!p) return;

    const exists = shoppingList.some(item =>
        normalizeText(item.name) === normalizeText(p.name) && !item.purchased
    );
    if (exists) {
        alert('הפריט כבר קיים ברשימה');
        return;
    }

    const newItem = {
        id: Date.now().toString(),
        name: p.name,
        quantity: p.quantity || '1',
        category: p.category != null ? p.category : null,
        purchased: false,
        favorite: true,
        productId: p.id || null,
        createdAt: new Date().toISOString()
    };

    shoppingList.push(newItem);
    saveToLocalStorage();
    renderShoppingList();
    updateSmartSummary();

    if (listRef && FirebaseManager && FirebaseManager.database) {
        await FirebaseManager.updateList(listRef, shoppingList);
    } else if (sharedListId && FirebaseManager && FirebaseManager.database) {
        await FirebaseManager.updateList(sharedListId, shoppingList);
    }
    hapticFeedback();
}

/**
 * מעדכן מוצר קבוע – שם ו/או קטגוריה.
 * @param {string} productId - מזהה המוצר ב-Firestore
 * @param {string} newName - שם חדש
 * @param {string|null} newCategory - קטגוריה (אופציונלי, ברירת מחדל null)
 */
async function editFixedProduct(productId, newName, newCategory = null) {
    if (!FirebaseManager || !FirebaseManager.firestore) return;
    const ok = await FirebaseManager.editFixedProduct(productId, newName, newCategory);
    if (ok) {
        await loadFixedProducts();
        renderProductsView();
        hapticFeedback();
    }
}

/**
 * מוחקת מוצר קבוע מ-Firestore ומהתצוגה (לא מוחקת מרשימות קניות).
 * @param {string} productId - מזהה המוצר ב-Firestore
 */
async function deleteFixedProduct(productId) {
    const product = favorites.find(f => f.id === productId);
    if (!product) return;
    if (!confirm('האם למחוק את המוצר "' + product.name + '" ממוצרי הקבע?')) return;

    if (FirebaseManager && FirebaseManager.firestore) {
        const ok = await FirebaseManager.deleteFixedProduct(productId);
        if (!ok) return;
    }
    // קוד זה הוסר - אין עוד מועדפים
}

// מחיקת מועדף / מוצר קבע – מפנה ל-deleteFixedProduct
async function deleteFavorite(favoriteId) {
    await deleteFixedProduct(favoriteId);
}

// סיכום חכם
function updateSmartSummary() {
    const total = shoppingList.length;
    const purchased = shoppingList.filter(item => item.purchased).length;
    const remaining = total - purchased;
    
    document.getElementById('totalItems').textContent = total;
    document.getElementById('purchasedItems').textContent = purchased;
    document.getElementById('remainingItems').textContent = remaining;
    
    const hasPurchased = purchased > 0;
    clearPurchasedBtn.style.display = hasPurchased ? 'block' : 'none';
    
    const hasDuplicates = findDuplicates().length > 0;
    smartCleanupBtn.style.display = hasDuplicates ? 'block' : 'none';
}

function toggleCategoryBreakdown() {
    const breakdown = document.getElementById('categoryBreakdown');
    const btn = document.getElementById('toggleCategoryBreakdown');
    
    if (breakdown.style.display === 'none') {
        breakdown.style.display = 'block';
        btn.textContent = 'הסתר לפי קטגוריה';
        renderCategoryBreakdown();
    } else {
        breakdown.style.display = 'none';
        btn.textContent = 'הצג לפי קטגוריה';
    }
}

function renderCategoryBreakdown() {
    const breakdown = document.getElementById('categoryBreakdown');
    const categories = {};
    
    shoppingList.forEach(item => {
        const category = item.category || 'ללא קטגוריה';
        if (!categories[category]) {
            categories[category] = { total: 0, purchased: 0 };
        }
        categories[category].total++;
        if (item.purchased) {
            categories[category].purchased++;
        }
    });
    
    breakdown.innerHTML = '';
    
    Object.entries(categories).forEach(([category, stats]) => {
        const div = document.createElement('div');
        div.className = 'category-breakdown-item';
        div.innerHTML = `
            <span>${category}</span>
            <span>${stats.purchased}/${stats.total}</span>
        `;
        breakdown.appendChild(div);
    });
}

// השלמה אוטומטית
function setupAutocomplete() {
    itemNameInput.addEventListener('input', handleAutocompleteInput);
    itemNameInput.addEventListener('keydown', handleAutocompleteKeydown);
    itemNameInput.addEventListener('blur', () => {
        setTimeout(() => autocompleteDropdown.classList.remove('show'), 200);
    });
}

function handleAutocompleteInput(e) {
    const query = e.target.value.trim();
    
    if (query.length < 2) {
        autocompleteDropdown.classList.remove('show');
        return;
    }
    
    const suggestions = getAutocompleteSuggestions(query);
    renderAutocomplete(suggestions);
}

function getAutocompleteSuggestions(query) {
    const normalizedQuery = normalizeText(query);
    const suggestions = [];
    const seenNames = new Set();
    
    // מועדפים
    favorites.forEach(fav => {
        if (normalizeText(fav.name).includes(normalizedQuery)) {
            const normalizedName = normalizeText(fav.name);
            if (!seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                suggestions.push({
                    type: 'favorite',
                    name: fav.name,
                    quantity: fav.quantity,
                    category: fav.category,
                    icon: '⭐'
                });
            }
        }
    });
    
    // מוצרים חוזרים
    recurringItems.forEach(item => {
        const normalizedName = normalizeText(item.name);
        if (normalizeText(item.name).includes(normalizedQuery) && !seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            suggestions.push({
                type: 'recurring',
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                icon: '🔄'
            });
        }
    });
    
    // מהיסטוריה - עם זכירת קטגוריות
    const categoryMap = {}; // מפה של שם מוצר -> קטגוריה הנפוצה ביותר
    shoppingHistory.slice(0, 20).forEach(entry => {
        entry.items.forEach(item => {
            if (item.category) {
                const normalizedName = normalizeText(item.name);
                if (!categoryMap[normalizedName]) {
                    categoryMap[normalizedName] = {};
                }
                if (!categoryMap[normalizedName][item.category]) {
                    categoryMap[normalizedName][item.category] = 0;
                }
                categoryMap[normalizedName][item.category]++;
            }
        });
    });
    
    shoppingHistory.slice(0, 10).forEach(entry => {
        entry.items.forEach(item => {
            const normalizedName = normalizeText(item.name);
            if (normalizeText(item.name).includes(normalizedQuery) && !seenNames.has(normalizedName)) {
                seenNames.add(normalizedName);
                // מצא את הקטגוריה הנפוצה ביותר למוצר זה
                let mostCommonCategory = item.category;
                if (categoryMap[normalizedName]) {
                    const categories = categoryMap[normalizedName];
                    mostCommonCategory = Object.keys(categories).reduce((a, b) => 
                        categories[a] > categories[b] ? a : b
                    );
                }
                suggestions.push({
                    type: 'history',
                    name: item.name,
                    quantity: item.quantity,
                    category: mostCommonCategory,
                    icon: '📚'
                });
            }
        });
    });
    
    // מרשימת הקניות הנוכחית (אם יש מוצרים שנמחקו)
    shoppingList.forEach(item => {
        const normalizedName = normalizeText(item.name);
        if (normalizeText(item.name).includes(normalizedQuery) && !seenNames.has(normalizedName)) {
            seenNames.add(normalizedName);
            suggestions.push({
                type: 'current',
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                icon: '📝'
            });
        }
    });
    
    return suggestions.slice(0, 5);
}

function renderAutocomplete(suggestions) {
    autocompleteDropdown.innerHTML = '';
    autocompleteSuggestions = suggestions;
    selectedAutocompleteIndex = -1;
    
    if (suggestions.length === 0) {
        autocompleteDropdown.classList.remove('show');
        return;
    }
    
    autocompleteDropdown.classList.add('show');
    
    suggestions.forEach((suggestion, index) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.dataset.index = index;
        
        div.innerHTML = `
            <span class="autocomplete-item-icon">${suggestion.icon}</span>
            <div class="autocomplete-item-text">
                <div class="autocomplete-item-name">${suggestion.name}</div>
                <div class="autocomplete-item-details">
                    ${suggestion.quantity ? `<span>${suggestion.quantity}</span>` : ''}
                    ${suggestion.category ? `<span class="autocomplete-category">${suggestion.category}</span>` : ''}
                </div>
            </div>
        `;
        
        div.addEventListener('click', () => selectAutocompleteSuggestion(suggestion));
        
        autocompleteDropdown.appendChild(div);
    });
}

function handleAutocompleteKeydown(e) {
    const items = autocompleteDropdown.querySelectorAll('.autocomplete-item');
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
        updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
        updateAutocompleteSelection(items);
    } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
        e.preventDefault();
        const item = items[selectedAutocompleteIndex];
        if (item) {
            const suggestion = autocompleteSuggestions[selectedAutocompleteIndex];
            if (suggestion) {
                selectAutocompleteSuggestion(suggestion);
            }
        }
    } else if (e.key === 'Escape') {
        autocompleteDropdown.classList.remove('show');
        selectedAutocompleteIndex = -1;
    }
}

function updateAutocompleteSelection(items) {
    items.forEach((item, index) => {
        item.classList.toggle('selected', index === selectedAutocompleteIndex);
    });
}

function selectAutocompleteSuggestion(suggestion) {
    itemNameInput.value = suggestion.name;
    if (suggestion.quantity) {
        document.getElementById('itemQuantity').value = suggestion.quantity;
    }
    if (suggestion.category) {
        const categorySelect = document.getElementById('itemCategory');
        if (categorySelect) {
            categorySelect.value = suggestion.category;
        }
    }
    autocompleteDropdown.classList.remove('show');
    itemNameInput.focus();
    hapticFeedback();
}

// רינדור רשימת הקניות – מכבד hidePurchasedInView (סינון בתצוגה בלבד)
function renderList() {
    const itemsToRender = hidePurchasedInView
        ? shoppingList.filter(item => !item.purchased)
        : shoppingList;

    shoppingListContainer.innerHTML = '';

    if (itemsToRender.length === 0) {
        emptyState.style.display = 'block';
        clearPurchasedBtn.style.display = 'none';
        updateShowPurchasedButton();
        return;
    }

    emptyState.style.display = 'none';
    updateShowPurchasedButton();

    // הפרד לפי קטגוריות
    const itemsByCategory = {};
    const itemsWithoutCategory = [];

    itemsToRender.forEach(item => {
        if (item.category && item.category.trim()) {
            if (!itemsByCategory[item.category]) {
                itemsByCategory[item.category] = [];
            }
            itemsByCategory[item.category].push(item);
        } else {
            itemsWithoutCategory.push(item);
        }
    });
    
    // מיון פריטים בכל קטגוריה לפי א-ב (אלפבית עברי)
    Object.keys(itemsByCategory).forEach(category => {
        itemsByCategory[category].sort((a, b) => {
            if (a.purchased !== b.purchased) {
                return a.purchased ? 1 : -1;
            }
            return a.name.localeCompare(b.name, 'he');
        });
    });
    
    // מיון פריטים ללא קטגוריה לפי א-ב
    itemsWithoutCategory.sort((a, b) => {
        if (a.purchased !== b.purchased) {
            return a.purchased ? 1 : -1;
        }
        return a.name.localeCompare(b.name, 'he');
    });
    
    // הצג לפי סדר הקטגוריות המוגדרות
    CATEGORIES.forEach(category => {
        if (itemsByCategory[category] && itemsByCategory[category].length > 0) {
            const categoryHeader = document.createElement('li');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `<h3>${category}</h3>`;
            shoppingListContainer.appendChild(categoryHeader);
            
            itemsByCategory[category].forEach(item => {
                const listItem = createListItem(item);
                shoppingListContainer.appendChild(listItem);
            });
        }
    });
    
    // הצג קטגוריות אחרות שלא מוגדרות
    Object.keys(itemsByCategory).forEach(category => {
        if (!CATEGORIES.includes(category)) {
            const categoryHeader = document.createElement('li');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `<h3>${category}</h3>`;
            shoppingListContainer.appendChild(categoryHeader);
            
            itemsByCategory[category].forEach(item => {
                const listItem = createListItem(item);
                shoppingListContainer.appendChild(listItem);
            });
        }
    });
    
    // הצג פריטים ללא קטגוריה
    if (itemsWithoutCategory.length > 0) {
        itemsWithoutCategory.forEach(item => {
            const listItem = createListItem(item);
            shoppingListContainer.appendChild(listItem);
        });
    }
}

// תצוגת רשימת הקניות (API – מכבדת UI state כולל hidePurchasedInView)
function renderShoppingList() {
    renderList();
}

// כפתור "הצג פריטים שנקנו" – מופיע כשמוסתרים נקנו
function updateShowPurchasedButton() {
    let btn = document.getElementById('showPurchasedBtn');
    if (hidePurchasedInView && shoppingList.some(item => item.purchased)) {
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'showPurchasedBtn';
            btn.className = 'btn btn-secondary btn-small';
            btn.textContent = 'הצג פריטים שנקנו';
            btn.addEventListener('click', () => {
                hidePurchasedInView = false;
                renderShoppingList();
                updateSmartSummary();
            });
            const actions = document.querySelector('.list-actions');
            if (actions) actions.appendChild(btn);
        }
        if (btn) btn.style.display = 'inline-block';
    } else if (btn) {
        btn.style.display = 'none';
    }
}

// יצירת אלמנט פריט ברשימה
function createListItem(item) {
    const li = document.createElement('li');
    li.className = `shopping-list-item ${item.purchased ? 'purchased' : ''}`;
    li.dataset.itemId = item.id;
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'item-checkbox';
    checkbox.checked = item.purchased;
    checkbox.addEventListener('change', () => togglePurchased(item.id));
    checkbox.setAttribute('aria-label', `סמן ${item.name} כנקנה`);
    
    const content = document.createElement('div');
    content.className = 'item-content';
    
    // שורה ראשונה: שם + כמות + כפתורים
    const nameRow = document.createElement('div');
    nameRow.className = 'item-name-row';
    
    const name = document.createElement('span');
    name.className = 'item-name';
    name.textContent = item.name;
    
    // כמות - עריכה קטנה ליד השם
    const quantityInput = document.createElement('input');
    quantityInput.type = 'text';
    quantityInput.className = 'item-quantity-inline';
    quantityInput.value = item.quantity || '1';
    quantityInput.placeholder = '1';
    quantityInput.addEventListener('blur', () => {
        updateItemQuantity(item.id, quantityInput.value.trim());
    });
    quantityInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            quantityInput.blur();
        }
    });
    
    // כפתור מחק - איקס אדום
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete';
    deleteBtn.innerHTML = '✕';
    deleteBtn.addEventListener('click', () => deleteItem(item.id));
    deleteBtn.setAttribute('aria-label', `מחק ${item.name}`);
    
    nameRow.appendChild(name);
    nameRow.appendChild(quantityInput);
    nameRow.appendChild(deleteBtn);
    
    // קטגוריה (אם יש) - בשורה נפרדת קטנה
    if (item.category) {
        const categorySpan = document.createElement('span');
        categorySpan.className = 'item-category-small';
        categorySpan.textContent = item.category;
        content.appendChild(categorySpan);
    }
    
    content.appendChild(nameRow);
    
    li.appendChild(checkbox);
    li.appendChild(content);
    
    return li;
}

// הוספת מוצר שהוספתי לרשימה
async function addAddedProductToList(product) {
    // בדוק אם המוצר כבר קיים ברשימה
    const exists = shoppingList.some(item =>
        !item.purchased && normalizeText(item.name) === normalizeText(product.name)
    );
    
    if (exists) {
        alert(`המוצר "${product.name}" כבר קיים ברשימה`);
        hapticFeedback();
        return;
    }
    
    const newItem = {
        id: Date.now().toString(),
        name: product.name,
        quantity: product.quantity || '1',
        category: product.category || null,
        purchased: false,
        createdAt: new Date().toISOString()
    };
    
    shoppingList.push(newItem);
    saveToLocalStorage();
    renderList();
    updateSmartSummary();
    await syncSharedList();
    hapticFeedback();
}

// מחיקת מוצר שהוספתי
async function deleteAddedProduct(productId) {
    if (confirm('האם אתה בטוח שברצונך למחוק מוצר זה?')) {
        if (FirebaseManager && FirebaseManager.firestore) {
            // מחק מ-Firestore
            const success = await FirebaseManager.deleteGlobalProduct(productId);
            if (success) {
                // עדכן את ה-array המקומי
                addedProducts = addedProducts.filter(p => p.id !== productId);
                renderAddedProducts();
                hapticFeedback();
            } else {
                alert('שגיאה במחיקת המוצר');
            }
        } else {
            // Fallback ל-localStorage אם אין Firestore
            addedProducts = addedProducts.filter(p => p.id !== productId);
            saveToLocalStorage();
            renderAddedProducts();
            hapticFeedback();
        }
    }
}

// טעינת מוצרים שהוספתי מ-Firestore (גלובליים)
async function loadAddedProductsFromFirestore() {
    console.log('🔄 טעינת מוצרים שהוספתי...');
    console.log('FirebaseManager קיים:', !!FirebaseManager);
    console.log('FirebaseManager.firestore קיים:', !!(FirebaseManager && FirebaseManager.firestore));
    
    if (FirebaseManager && FirebaseManager.firestore) {
        try {
            addedProducts = await FirebaseManager.loadAddedProducts();
            console.log('✅ נטענו', addedProducts.length, 'מוצרים שהוספתי מ-Firestore');
            
            // אם אין מוצרים ב-Firestore, נסה לטעון מ-localStorage
            if (addedProducts.length === 0) {
                console.log('⚠️ אין מוצרים ב-Firestore - בודק localStorage');
                const savedAdded = localStorage.getItem('addedProducts');
                if (savedAdded) {
                    try {
                        const localProducts = JSON.parse(savedAdded);
                        addedProducts = localProducts.filter(p => p && p.id && p.name);
                        console.log('✅ נטענו', addedProducts.length, 'מוצרים מ-localStorage');
                    } catch (e) {
                        console.error('שגיאה בטעינת מוצרים מ-localStorage:', e);
                    }
                }
            }
        } catch (error) {
            console.error('❌ שגיאה בטעינת מוצרים שהוספתי מ-Firestore:', error);
            console.error('פרטי שגיאה:', error.message, error.code);
            
            // Fallback ל-localStorage
            const savedAdded = localStorage.getItem('addedProducts');
            if (savedAdded) {
                try {
                    addedProducts = JSON.parse(savedAdded);
                    addedProducts = addedProducts.filter(p => p && p.id && p.name);
                    console.log('✅ נטענו', addedProducts.length, 'מוצרים מ-localStorage (fallback)');
                } catch (e) {
                    console.error('שגיאה בטעינת מוצרים מ-localStorage:', e);
                    addedProducts = [];
                }
            } else {
                addedProducts = [];
            }
        }
    } else {
        // Fallback ל-localStorage אם אין Firestore
        console.log('⚠️ אין Firestore - טוען מ-localStorage');
        const savedAdded = localStorage.getItem('addedProducts');
        if (savedAdded) {
            try {
                addedProducts = JSON.parse(savedAdded);
                addedProducts = addedProducts.filter(p => p && p.id && p.name);
                console.log('✅ נטענו', addedProducts.length, 'מוצרים מ-localStorage');
            } catch (e) {
                console.error('שגיאה בטעינת מוצרים מ-localStorage:', e);
                addedProducts = [];
            }
        } else {
            addedProducts = [];
            console.log('ℹ️ אין מוצרים ב-localStorage');
        }
    }
    
    console.log('סה"כ מוצרים שהוספתי אחרי טעינה:', addedProducts.length);
}

// האזנה לעדכוני מוצרים שהוספתי מ-Firestore בזמן אמת
let addedProductsListener = null;
function setupAddedProductsListener() {
    if (!FirebaseManager || !FirebaseManager.firestore) {
        return; // אין Firestore - אין האזנה
    }
    
    // הסר האזנה קודמת אם קיימת
    if (addedProductsListener) {
        addedProductsListener();
        addedProductsListener = null;
    }
    
    console.log('מתחיל האזנה לעדכוני מוצרים שהוספתי מ-Firestore');
    
    // פונקציה משותפת לעיבוד snapshot
    const handleAddedProductsSnapshot = (snapshot) => {
        console.log('📡 האזנה: עדכון מוצרים שהוספתי מ-Firestore:', snapshot.docs.length, 'מוצרים');
        
        // עדכן את addedProducts array
        const newAddedProducts = snapshot.docs.map(doc => {
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
        newAddedProducts.sort((a, b) => a.name.localeCompare(b.name, 'he'));
        
        // עדכן תמיד - ההאזנה היא המקור האמת
        addedProducts = newAddedProducts;
        console.log('✅ האזנה: עודכן addedProducts array:', addedProducts.length, 'מוצרים');
        // עדכן תצוגה
        renderAddedProducts();
    };
    
    // האזנה לכל השינויים ב-collection addedProducts
    // נסה עם orderBy, אם נכשל - נסה בלי
    let unsubscribe;
    try {
        unsubscribe = FirebaseManager.firestore.collection('addedProducts')
            .orderBy('name')
            .onSnapshot((snapshot) => {
                handleAddedProductsSnapshot(snapshot);
            }, (error) => {
                // אם orderBy נכשל (אין אינדקס), נסה בלי orderBy
                if (error.code === 'failed-precondition') {
                    console.warn('orderBy נכשל - מנסה בלי orderBy');
                    unsubscribe = FirebaseManager.firestore.collection('addedProducts')
                        .onSnapshot((snapshot) => {
                            handleAddedProductsSnapshot(snapshot);
                        }, (error) => {
                            console.error('שגיאה בהאזנה למוצרים שהוספתי:', error);
                        });
                } else {
                    console.error('שגיאה בהאזנה למוצרים שהוספתי:', error);
                }
            });
    } catch (error) {
        // אם יש שגיאה, נסה בלי orderBy
        console.warn('שגיאה בהתחלת האזנה - מנסה בלי orderBy:', error);
        unsubscribe = FirebaseManager.firestore.collection('addedProducts')
            .onSnapshot((snapshot) => {
                handleAddedProductsSnapshot(snapshot);
            }, (error) => {
                console.error('שגיאה בהאזנה למוצרים שהוספתי:', error);
            });
    }
    
    addedProductsListener = unsubscribe;
}

// רינדור מוצרים שהוספתי
function renderAddedProducts() {
    addedListContainer.innerHTML = '';
    
    if (addedProducts.length === 0) {
        addedEmptyState.style.display = 'block';
        return;
    }
    
    addedEmptyState.style.display = 'none';
    
    // הפרד לפי קטגוריות
    const productsByCategory = {};
    
    addedProducts.forEach(product => {
        const category = product.category || 'שונות';
        if (!productsByCategory[category]) {
            productsByCategory[category] = [];
        }
        productsByCategory[category].push(product);
    });
    
    // מיון פריטים בכל קטגוריה לפי א-ב (אלפבית עברי)
    Object.keys(productsByCategory).forEach(category => {
        productsByCategory[category].sort((a, b) => 
            a.name.localeCompare(b.name, 'he')
        );
    });
    
    // הצג לפי סדר הקטגוריות המוגדרות
    CATEGORIES.forEach(category => {
        if (productsByCategory[category] && productsByCategory[category].length > 0) {
            const categoryHeader = document.createElement('li');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `<h3>${category}</h3>`;
            addedListContainer.appendChild(categoryHeader);
            
            productsByCategory[category].forEach(product => {
                const productItem = createAddedProductItem(product);
                addedListContainer.appendChild(productItem);
            });
        }
    });
    
    // הצג קטגוריות אחרות שלא מוגדרות
    Object.keys(productsByCategory).forEach(category => {
        if (!CATEGORIES.includes(category)) {
            const categoryHeader = document.createElement('li');
            categoryHeader.className = 'category-header';
            categoryHeader.innerHTML = `<h3>${category}</h3>`;
            addedListContainer.appendChild(categoryHeader);
            
            productsByCategory[category].forEach(product => {
                const productItem = createAddedProductItem(product);
                addedListContainer.appendChild(productItem);
            });
        }
    });
}

// יצירת אלמנט מוצר שהוספתי (עם הוסף לרשימה ומחק)
function createAddedProductItem(product) {
    const li = document.createElement('li');
    li.className = 'added-product-item';

    // הכל בשורה אחת - שם, פרטים וכפתורים
    const row = document.createElement('div');
    row.className = 'added-product-row';
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.flexWrap = 'wrap';

    // שם המוצר
    const nameEl = document.createElement('span');
    nameEl.className = 'added-product-name';
    nameEl.textContent = product.name;
    nameEl.style.flex = '1';
    nameEl.style.minWidth = '120px';
    nameEl.style.fontWeight = '500';

    // פרטים (קטגוריה וכמות) - בשורה אחת
    const details = document.createElement('span');
    details.className = 'added-product-details';
    details.style.display = 'flex';
    details.style.gap = '10px';
    details.style.fontSize = '0.9em';
    details.style.color = 'var(--text-secondary, #666)';
    
    if (product.category) {
        const categorySpan = document.createElement('span');
        categorySpan.textContent = product.category;
        categorySpan.style.padding = '2px 8px';
        categorySpan.style.backgroundColor = 'var(--bg-secondary, #f0f0f0)';
        categorySpan.style.borderRadius = '4px';
        details.appendChild(categorySpan);
    }
    
    if (product.quantity && product.quantity !== '1') {
        const quantitySpan = document.createElement('span');
        quantitySpan.textContent = `x${product.quantity}`;
        details.appendChild(quantitySpan);
    }

    // כפתורים
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.textContent = 'הוסף';
    addBtn.style.padding = '6px 12px';
    addBtn.style.fontSize = '0.9em';
    addBtn.addEventListener('click', () => addAddedProductToList(product));

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'מחק';
    deleteBtn.style.padding = '6px 12px';
    deleteBtn.style.fontSize = '0.9em';
    deleteBtn.addEventListener('click', () => deleteAddedProduct(product.id));

    actions.appendChild(addBtn);
    actions.appendChild(deleteBtn);

    // הוסף הכל לשורה
    row.appendChild(nameEl);
    if (details.children.length > 0) {
        row.appendChild(details);
    }
    row.appendChild(actions);

    li.appendChild(row);

    return li;
}

// רינדור היסטוריה
function renderHistory() {
    historyListContainer.innerHTML = '';
    
    if (shoppingHistory.length === 0) {
        historyEmptyState.style.display = 'block';
    } else {
        historyEmptyState.style.display = 'none';
        
        shoppingHistory.forEach(entry => {
            const historyEntry = createHistoryEntry(entry);
            historyListContainer.appendChild(historyEntry);
        });
    }
}

// יצירת אלמנט היסטוריה
function createHistoryEntry(entry) {
    const div = document.createElement('div');
    div.className = 'history-entry';
    
    const header = document.createElement('div');
    header.className = 'history-header';
    
    const date = new Date(entry.date);
    const dateStr = date.toLocaleDateString('he-IL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const dateDiv = document.createElement('div');
    dateDiv.className = 'history-date';
    dateDiv.textContent = dateStr;
    
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    
    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'btn btn-restore';
    restoreBtn.textContent = 'שחזר רשימה זו';
    restoreBtn.addEventListener('click', () => restoreFromHistory(entry.id));
    
    actions.appendChild(restoreBtn);
    
    header.appendChild(dateDiv);
    header.appendChild(actions);
    
    const itemsDiv = document.createElement('div');
    itemsDiv.className = 'history-items';
    
    entry.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'history-item';
        
        const nameDiv = document.createElement('div');
        nameDiv.className = 'history-item-name';
        nameDiv.textContent = item.name;
        
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'history-item-details';
        
        if (item.quantity) {
            const quantitySpan = document.createElement('span');
            quantitySpan.textContent = `כמות: ${item.quantity}`;
            detailsDiv.appendChild(quantitySpan);
        }
        
        if (item.category) {
            const categorySpan = document.createElement('span');
            categorySpan.textContent = `קטגוריה: ${item.category}`;
            detailsDiv.appendChild(categorySpan);
        }
        
        itemDiv.appendChild(nameDiv);
        if (detailsDiv.children.length > 0) {
            itemDiv.appendChild(detailsDiv);
        }
        
        itemsDiv.appendChild(itemDiv);
    });
    
    div.appendChild(header);
    div.appendChild(itemsDiv);
    
    return div;
}

// פעולות מגע למובייל
function setupMobileGestures() {
    const listItems = shoppingListContainer;
    
    listItems.addEventListener('touchstart', handleTouchStart, { passive: true });
    listItems.addEventListener('touchmove', handleTouchMove, { passive: true });
    listItems.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
    const item = e.target.closest('.shopping-list-item');
    if (!item) return;
    
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    
    // אין פעולה על לחיצה ארוכה - הוסר כפתור הכוכב
}

function handleTouchMove(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    const item = e.target.closest('.shopping-list-item');
    if (!item) return;
    
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchX - touchStartX;
    const deltaY = Math.abs(touchY - touchStartY);
    
    if (Math.abs(deltaX) > 30 && deltaY < 50) {
        if (deltaX > 0) {
            item.classList.add('swiping-right');
            item.classList.remove('swiping-left');
        } else {
            item.classList.add('swiping-left');
            item.classList.remove('swiping-right');
        }
    }
}

function handleTouchEnd(e) {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
    
    const item = e.target.closest('.shopping-list-item');
    if (!item) return;
    
    const touchX = e.changedTouches[0].clientX;
    const deltaX = touchX - touchStartX;
    
    if (Math.abs(deltaX) > 60) {
        const itemId = item.dataset.itemId;
        
        if (deltaX > 0) {
            // החלקה ימינה - סמן כנקנה
            togglePurchased(itemId);
        } else {
            // החלקה שמאלה - מחק
            deleteItem(itemId);
        }
        
        hapticFeedback();
    }
    
    item.classList.remove('swiping-right', 'swiping-left');
}

// משוב טקטילי
function hapticFeedback(type = 'light') {
    if ('vibrate' in navigator) {
        const patterns = {
            light: 10,
            medium: 20,
            long: 30
        };
        navigator.vibrate(patterns[type] || patterns.light);
    }
}

// שיתוף רשימות
async function checkUrlForListId() {
    // בדיקת hash routing (#/list/{listId})
    const hash = window.location.hash;
    const hashMatch = hash.match(/^#\/list\/([^\/]+)/);
    
    if (hashMatch) {
        const listId = hashMatch[1];
        sharedListId = listId;
        localStorage.setItem('sharedListId', sharedListId);
        return;
    }
    
    // בדיקת query parameter (תמיכה לאחור)
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list');
    
    if (listId) {
        sharedListId = listId;
        localStorage.setItem('sharedListId', sharedListId);
        // עדכון ל-hash routing
        updateUrlWithListId();
        return;
    }
    
    // אם אין list ID ב-URL, נבדוק אם יש אחד ב-localStorage
    sharedListId = localStorage.getItem('sharedListId');
    
    // אם אין sharedListId בכלל → צור אחד אוטומטית
    if (!sharedListId) {
        sharedListId = 'list-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('sharedListId', sharedListId);
        
        // עדכון ה-URL
        updateUrlWithListId();
        
        // יצירת הרשימה ב-Firebase אם Firebase זמין
        if (FirebaseManager && FirebaseManager.database) {
            const currentList = JSON.parse(localStorage.getItem('shoppingList') || '[]');
            await FirebaseManager.createList(sharedListId, {
                items: currentList
            });
            console.log('רשימה משותפת נוצרה אוטומטית:', sharedListId);
        }
    }
}

function setupSharing() {
    // תמיד ננסה להתחיל האזנה אם יש sharedListId
    if (sharedListId) {
        updateShareLink();
        // התחלת האזנה לעדכונים בזמן אמת
        if (FirebaseManager && FirebaseManager.database) {
            console.log('מתחיל האזנה לרשימה:', sharedListId);
            FirebaseManager.subscribeToList(sharedListId, (data) => {
                if (data && data.items) {
                    // עדכון הרשימה רק אם יש שינויים
                    const currentItems = JSON.stringify(shoppingList);
                    const newItems = JSON.stringify(data.items);
                    
                    if (currentItems !== newItems) {
                        console.log('עדכון רשימה מ-Firebase:', data.items.length, 'פריטים');
                        shoppingList = data.items.map(item => ({
                            ...item,
                            id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
                        }));
                        saveToLocalStorage();
                        renderList();
                        updateSmartSummary();
                        detectRecurringItems();
                    }
                }
            });
        } else {
            console.warn('Firebase לא מוכן - לא ניתן להתחיל האזנה');
        }
    } else {
        // אם אין sharedListId, נצור אחד (אמור לקרות ב-checkUrlForListId, אבל למקרה שלא)
        console.warn('אין sharedListId - השיתוף לא פעיל');
    }
}

function showSharingSection() {
    sharingSection.style.display = 'block';
    // כפתור השיתוף משמש רק להעתקת קישור, לא להפעלת השיתוף
    // השיתוף תמיד פעיל אם יש sharedListId
    if (sharedListId) {
        updateShareLink();
    } else {
        // אם אין sharedListId (לא אמור לקרות), נצור אחד
        generateNewShareLink();
    }
}

function hideSharingSection() {
    sharingSection.style.display = 'none';
}

async function generateNewShareLink() {
    // יצירת מזהה ייחודי חדש
    sharedListId = 'list-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sharedListId', sharedListId);
    
    // שמירת הרשימה הנוכחית ב-Firebase
    if (FirebaseManager && FirebaseManager.database) {
        const success = await FirebaseManager.createList(sharedListId, {
            items: shoppingList
        });
        
        if (success) {
            // התחלת האזנה לעדכונים בזמן אמת
            FirebaseManager.subscribeToList(sharedListId, (data) => {
                if (data && data.items) {
                    const currentItems = JSON.stringify(shoppingList);
                    const newItems = JSON.stringify(data.items);
                    
                    if (currentItems !== newItems) {
                        shoppingList = data.items.map(item => ({
                            ...item,
                            id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
                        }));
                        saveToLocalStorage();
                        renderList();
                        updateSmartSummary();
                        detectRecurringItems();
                    }
                }
            });
        }
    }
    
    // עדכון הקישור בממשק
    updateShareLink();
    
    // עדכון ה-URL
    updateUrlWithListId();
    
    hapticFeedback();
}

function updateShareLink() {
    if (!sharedListId) return;
    
    const shareUrl = getShareableUrl();
    const input = document.getElementById('shareLinkInput');
    if (input) {
        input.value = shareUrl;
    }
}

function getShareableUrl() {
    if (!sharedListId) return '';
    
    const baseUrl = window.location.origin + window.location.pathname;
    return `${baseUrl}#/list/${sharedListId}`;
}

function updateUrlWithListId() {
    if (!sharedListId) return;
    
    const newUrl = getShareableUrl();
    if (window.history && window.history.replaceState) {
        // עדכון שקט של ה-URL ללא reload
        window.history.replaceState({}, '', newUrl);
    }
}

async function copyShareLink() {
    const input = document.getElementById('shareLinkInput');
    if (!input || !input.value) {
        alert('אין קישור לשיתוף. אנא צור קישור חדש.');
        return;
    }
    
    const shareUrl = input.value;
    
    // ניסיון שימוש ב-Web Share API אם זמין
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'רשימת קניות משותפת',
                text: 'בואו נשתף רשימת קניות',
                url: shareUrl
            });
            showCopySuccess();
            hapticFeedback();
            return;
        } catch (err) {
            // המשתמש ביטל את השיתוף - נמשיך להעתקה רגילה
            if (err.name !== 'AbortError') {
                console.log('שגיאה בשיתוף:', err);
            }
        }
    }
    
    // העתקה רגילה
    input.select();
    input.setSelectionRange(0, 99999); // למובייל
    
    try {
        document.execCommand('copy');
        
        // שימוש ב-Clipboard API אם זמין
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showCopySuccess();
            });
        } else {
            showCopySuccess();
        }
    } catch (err) {
        // נסה דרך Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
                showCopySuccess();
            }).catch(() => {
                alert('לא ניתן להעתיק. אנא העתק ידנית: ' + shareUrl);
            });
        } else {
            alert('לא ניתן להעתיק. אנא העתק ידנית: ' + shareUrl);
        }
    }
    
    hapticFeedback();
}

function showCopySuccess() {
    const btn = document.getElementById('copyShareLink');
    const originalText = btn.textContent;
    btn.textContent = '✓ הועתק!';
    btn.style.backgroundColor = 'var(--success-color)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
}

async function stopSharing() {
    if (confirm('האם אתה בטוח שברצונך להפסיק את השיתוף? הקישור לא יעבוד יותר.')) {
        // הסרת האזנה לעדכונים
        if (FirebaseManager) {
            FirebaseManager.unsubscribeFromList();
        }
        
        sharedListId = null;
        localStorage.removeItem('sharedListId');
        
        // עדכון ה-URL להסרת ה-hash
        if (window.history && window.history.replaceState) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
        
        const input = document.getElementById('shareLinkInput');
        if (input) {
            input.value = '';
        }
        
        hideSharingSection();
        hapticFeedback();
    }
}

// טעינת רשימה משותפת מ-Firebase
async function loadSharedListFromFirebase() {
    if (!sharedListId) {
        loadFromLocalStorage();
        detectRecurringItems();
        renderList();
        renderAddedProducts();
        renderHistory();
        updateSmartSummary();
        return;
    }
    
    // בדיקה אם Firebase מוכן
    if (!FirebaseManager || !FirebaseManager.database) {
        console.warn('Firebase לא מוכן - נטען מ-localStorage');
        loadFromLocalStorage();
        detectRecurringItems();
        renderList();
        renderAddedProducts();
        renderHistory();
        updateSmartSummary();
        return;
    }
    
    try {
        await FirebaseManager.loadList(sharedListId, (data) => {
            if (data && data.items) {
                shoppingList = data.items.map(item => ({
                    ...item,
                    id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 9)
                }));
                
                saveToLocalStorage();
                detectRecurringItems();
                renderList();
                renderAddedProducts();
                renderHistory();
                updateSmartSummary();
                
                showSharedListNotification();
            } else {
                // אם הרשימה לא קיימת, נטען מ-localStorage
                console.log('רשימה לא נמצאה ב-Firebase - נטען מ-localStorage');
                loadFromLocalStorage();
                detectRecurringItems();
                renderList();
                renderAddedProducts();
                renderHistory();
                updateSmartSummary();
            }
        });
    } catch (error) {
        console.error('שגיאה בטעינת רשימה מ-Firebase:', error);
        // נטען מ-localStorage במקרה של שגיאה
        loadFromLocalStorage();
        detectRecurringItems();
        renderList();
        renderAddedProducts();
        renderHistory();
        updateSmartSummary();
    }
}

// סנכרון רשימה משותפת ל-Firebase
async function syncSharedList() {
    if (!sharedListId) {
        console.log('אין sharedListId - לא מסנכרן');
        return;
    }
    
    if (!FirebaseManager || !FirebaseManager.database) {
        console.warn('Firebase לא מוכן - לא ניתן לסנכרן');
        return;
    }
    
    console.log('מסנכרן רשימה ל-Firebase:', sharedListId, 'עם', shoppingList.length, 'פריטים');
    const success = await FirebaseManager.updateList(sharedListId, shoppingList);
    if (success) {
        console.log('רשימה סונכרנה בהצלחה');
    } else {
        console.warn('שגיאה בסנכרון רשימה');
    }
}

function showSharedListNotification() {
    // יצירת הודעה זמנית שהרשימה נטענה
    const notification = document.createElement('div');
    notification.className = 'shared-list-notification';
    notification.textContent = '✓ רשימה משותפת נטענה';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--success-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: var(--shadow);
        z-index: 10000;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 3000);
}

// פונקציות LocalStorage
function saveToLocalStorage() {
    try {
        localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
        // addedProducts נשמרים ב-Firestore - לא נשמרים ב-localStorage
        localStorage.setItem('shoppingHistory', JSON.stringify(shoppingHistory));
        localStorage.setItem('recurringItems', JSON.stringify(recurringItems));
    } catch (error) {
        alert('שגיאה בשמירת הנתונים. אנא נסה שוב.');
    }
}

function loadFromLocalStorage() {
    try {
        const savedList = localStorage.getItem('shoppingList');
        if (savedList) {
            shoppingList = JSON.parse(savedList);
            shoppingList = shoppingList.filter(item => 
                item && item.id && item.name
            );
        }
        
        // addedProducts נטענים מ-Firestore - לא מ-localStorage
        // הם יטענו אחרי אתחול Firebase
        
        const savedHistory = localStorage.getItem('shoppingHistory');
        if (savedHistory) {
            shoppingHistory = JSON.parse(savedHistory);
            shoppingHistory = shoppingHistory.filter(entry => 
                entry && entry.id && entry.date && entry.items
            );
        }
        
        const savedRecurring = localStorage.getItem('recurringItems');
        if (savedRecurring) {
            recurringItems = JSON.parse(savedRecurring);
        }
    } catch (error) {
        shoppingList = [];
        // addedProducts לא מתאפסים - הם גלובליים ונשמרים ב-Firestore
        shoppingHistory = [];
        recurringItems = [];
    }
}

// שמירת מועדפים ל-localStorage
// הפונקציה saveFavoritesToLocalStorage הוסרה - משתמשים ב-saveToLocalStorage במקום

// פונקציות מצב כהה
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const icon = darkModeToggle.querySelector('.toggle-icon');
    icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
    hapticFeedback();
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const icon = darkModeToggle.querySelector('.toggle-icon');
    icon.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
}

// שמירת רשימה
function handleSaveList() {
    if (shoppingList.length === 0) {
        alert('הרשימה ריקה - אין מה לשמור');
        return;
    }
    
    // שמירה ל-localStorage (כבר נעשה אוטומטית, אבל נוסיף הודעה)
    saveToLocalStorage();
    
    // אם יש רשימה משותפת, נסנכרן גם ל-Firebase
    if (sharedListId) {
        syncSharedList();
    }
    
    // הודעה למשתמש
    const btn = document.getElementById('saveListBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ נשמר!';
    btn.style.backgroundColor = 'var(--success-color)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
    
    hapticFeedback();
}

// יצירת רשימה חדשה
async function handleNewList() {
    // אם יש פריטים ברשימה, שמור אותם להיסטוריה
    if (shoppingList.length > 0) {
        const confirmMessage = `האם אתה בטוח שברצונך ליצור רשימה חדשה?\nהרשימה הנוכחית תישמר בהיסטוריה.`;
        if (!confirm(confirmMessage)) {
            return;
        }
        
        // שמור את הרשימה הנוכחית להיסטוריה
        saveCurrentListToHistory();
    }
    
    // הפסק שיתוף אם יש
    if (sharedListId) {
        if (FirebaseManager) {
            FirebaseManager.unsubscribeFromList();
        }
        sharedListId = null;
        localStorage.removeItem('sharedListId');
        
        // עדכון ה-URL להסרת ה-hash
        if (window.history && window.history.replaceState) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
        
        // הסתר את אזור השיתוף
        hideSharingSection();
    }
    
    // נקה את הרשימה
    shoppingList = [];
    saveToLocalStorage();
    
    // עדכן את התצוגה
    renderList();
    updateSmartSummary();
    switchTab('current');
    
    // הודעה למשתמש
    const btn = document.getElementById('newListBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ נוצרה!';
    btn.style.backgroundColor = 'var(--success-color)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
    
    hapticFeedback();
}

// ייצוא רשימת קניות
function handleExportList() {
    if (shoppingList.length === 0) {
        alert('הרשימה ריקה - אין מה לייצא');
        return;
    }
    
    // יצירת תאריך לקבצים
    const date = new Date();
    const dateStr = date.toLocaleDateString('he-IL', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    }).replace(/\//g, '-');
    
    // יצירת תפריט ייצוא
    const exportType = prompt(
        'בחר סוג ייצוא:\n' +
        '1 - ייצוא כטקסט (קריא)\n' +
        '2 - ייצוא כ-JSON\n' +
        '3 - ייצוא כ-CSV\n' +
        'הקלד 1, 2 או 3:'
    );
    
    if (!exportType) return;
    
    let content = '';
    let filename = '';
    let mimeType = '';
    
    switch(exportType.trim()) {
        case '1':
            // ייצוא כטקסט קריא
            content = 'רשימת קניות - ' + dateStr + '\n';
            content += '='.repeat(30) + '\n\n';
            
            // הפרד לפי קטגוריות
            const itemsByCategory = {};
            const itemsWithoutCategory = [];
            
            shoppingList.forEach(item => {
                if (item.category && item.category.trim()) {
                    if (!itemsByCategory[item.category]) {
                        itemsByCategory[item.category] = [];
                    }
                    itemsByCategory[item.category].push(item);
                } else {
                    itemsWithoutCategory.push(item);
                }
            });
            
            // הצג לפי קטגוריות
            CATEGORIES.forEach(category => {
                if (itemsByCategory[category] && itemsByCategory[category].length > 0) {
                    content += `\n${category}:\n`;
                    itemsByCategory[category].forEach(item => {
                        const status = item.purchased ? '✓' : '☐';
                        const quantity = item.quantity ? ` (${item.quantity})` : '';
                        content += `  ${status} ${item.name}${quantity}\n`;
                    });
                }
            });
            
            // קטגוריות אחרות
            Object.keys(itemsByCategory).forEach(category => {
                if (!CATEGORIES.includes(category)) {
                    content += `\n${category}:\n`;
                    itemsByCategory[category].forEach(item => {
                        const status = item.purchased ? '✓' : '☐';
                        const quantity = item.quantity ? ` (${item.quantity})` : '';
                        content += `  ${status} ${item.name}${quantity}\n`;
                    });
                }
            });
            
            // פריטים ללא קטגוריה
            if (itemsWithoutCategory.length > 0) {
                content += '\nשונות:\n';
                itemsWithoutCategory.forEach(item => {
                    const status = item.purchased ? '✓' : '☐';
                    const quantity = item.quantity ? ` (${item.quantity})` : '';
                    content += `  ${status} ${item.name}${quantity}\n`;
                });
            }
            
            content += '\n' + '='.repeat(30) + '\n';
            const purchased = shoppingList.filter(item => item.purchased).length;
            const total = shoppingList.length;
            content += `סה"כ: ${total} פריטים | נקנו: ${purchased} | נותרו: ${total - purchased}\n`;
            
            filename = `רשימת-קניות-${dateStr}.txt`;
            mimeType = 'text/plain;charset=utf-8';
            break;
            
        case '2':
            // ייצוא כ-JSON
            const exportData = {
                date: date.toISOString(),
                totalItems: shoppingList.length,
                purchasedItems: shoppingList.filter(item => item.purchased).length,
                items: shoppingList.map(item => ({
                    name: item.name,
                    quantity: item.quantity || null,
                    category: item.category || null,
                    purchased: item.purchased,
                    favorite: item.favorite || false,
                    createdAt: item.createdAt || null
                }))
            };
            content = JSON.stringify(exportData, null, 2);
            filename = `רשימת-קניות-${dateStr}.json`;
            mimeType = 'application/json;charset=utf-8';
            break;
            
        case '3':
            // ייצוא כ-CSV
            content = 'שם,כמות,קטגוריה,נקנה,מועדף\n';
            shoppingList.forEach(item => {
                const name = `"${item.name}"`;
                const quantity = item.quantity ? `"${item.quantity}"` : '';
                const category = item.category ? `"${item.category}"` : '';
                const purchased = item.purchased ? 'כן' : 'לא';
                const favorite = item.favorite ? 'כן' : 'לא';
                content += `${name},${quantity},${category},${purchased},${favorite}\n`;
            });
            filename = `רשימת-קניות-${dateStr}.csv`;
            mimeType = 'text/csv;charset=utf-8';
            break;
            
        default:
            alert('אפשרות לא תקינה');
            return;
    }
    
    // הורדת הקובץ
    const blob = new Blob(['\ufeff' + content], { type: mimeType }); // \ufeff = BOM ל-UTF-8
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    // הודעה למשתמש
    const btn = document.getElementById('exportListBtn');
    const originalText = btn.textContent;
    btn.textContent = '✓ יוצא!';
    btn.style.backgroundColor = 'var(--success-color)';
    
    setTimeout(() => {
        btn.textContent = originalText;
        btn.style.backgroundColor = '';
    }, 2000);
    
    hapticFeedback();
}

// הצגת סיכום קנייה – אחרי סיום: הסתרת נקנו בתצוגה בלבד (UI state)
function showShoppingSummary() {
    const purchased = shoppingList.filter(item => item.purchased);
    const notPurchased = shoppingList.filter(item => !item.purchased);

    // סיום קנייה: להסתיר נקנו בתצוגה (לא למחוק מ-Firestore)
    hidePurchasedInView = true;
    renderShoppingList();
    renderShoppingMode();

    // עדכון ספירות
    document.getElementById('summaryPurchasedCount').textContent = purchased.length;
    document.getElementById('summaryNotPurchasedCount').textContent = notPurchased.length;
    
    // רשימת נקנו
    const purchasedList = document.getElementById('summaryPurchasedList');
    purchasedList.innerHTML = '';
    if (purchased.length === 0) {
        const li = document.createElement('li');
        li.className = 'summary-empty';
        li.textContent = 'אין פריטים שנקנו';
        purchasedList.appendChild(li);
    } else {
        purchased.forEach(item => {
            const li = document.createElement('li');
            li.className = 'summary-item purchased';
            li.innerHTML = `
                <span class="summary-item-icon">✓</span>
                <span class="summary-item-name">${item.name}</span>
                ${item.quantity ? `<span class="summary-item-quantity">${item.quantity}</span>` : ''}
            `;
            purchasedList.appendChild(li);
        });
    }
    
    // רשימת לא נקנו
    const notPurchasedList = document.getElementById('summaryNotPurchasedList');
    notPurchasedList.innerHTML = '';
    if (notPurchased.length === 0) {
        const li = document.createElement('li');
        li.className = 'summary-empty';
        li.textContent = 'כל הפריטים נקנו! 🎉';
        notPurchasedList.appendChild(li);
    } else {
        notPurchased.forEach(item => {
            const li = document.createElement('li');
            li.className = 'summary-item not-purchased';
            li.innerHTML = `
                <span class="summary-item-icon">✗</span>
                <span class="summary-item-name">${item.name}</span>
                ${item.quantity ? `<span class="summary-item-quantity">${item.quantity}</span>` : ''}
            `;
            notPurchasedList.appendChild(li);
        });
    }
    
    // הצג את המודל
    const modal = document.getElementById('shoppingSummaryModal');
    if (modal) {
        modal.style.display = 'flex';
    }
    
    hapticFeedback();
}

// הסתרת סיכום קנייה
function hideShoppingSummary() {
    const modal = document.getElementById('shoppingSummaryModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// סיום קנייה – הסרת פריטים שנקנו ושמירתם בהיסטוריה
async function finishShoppingSession() {
    // בדיקה אם יש פריטים שנקנו
    const purchasedItems = shoppingList.filter(item => item.purchased);
    
    if (purchasedItems.length === 0) {
        alert('לא סומנו פריטים כנקנו. אין מה לסיים.');
        return;
    }
    
    // יצירת כניסה חדשה בהיסטוריה עם הפריטים שנקנו בלבד
    const historyEntry = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        items: purchasedItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            category: item.category
        }))
    };
    
    // הוספה להיסטוריה
    shoppingHistory.unshift(historyEntry);
    
    // הגבלת גודל ההיסטוריה ל-50 כניסות
    if (shoppingHistory.length > 50) {
        shoppingHistory = shoppingHistory.slice(0, 50);
    }
    
    // הסרת כל הפריטים שנקנו מהרשימה הפעילה
    shoppingList = shoppingList.filter(item => !item.purchased);
    
    // כיבוי מצב קניות
    isShoppingMode = false;
    
    // איפוס הסתרת פריטים שנקנו
    hidePurchasedInView = false;
    
    // שמירה ל-localStorage
    saveToLocalStorage();
    
    // עדכון תצוגות
    renderList();
    renderHistory();
    updateSmartSummary();
    
    // יציאה ממצב קניות (אם היה פעיל)
    if (shoppingModeToggle) {
        shoppingModeToggle.classList.remove('active');
    }
    
    // הסתרת מצב קניות
    const shoppingModeTab = document.getElementById('shoppingModeTab');
    if (shoppingModeTab) {
        shoppingModeTab.classList.remove('active');
        shoppingModeTab.style.display = 'none';
    }
    
    // הצגת מחדש את כל האלמנטים
    const smartSummary = document.getElementById('smartSummary');
    const recurringSuggestions = document.getElementById('recurringSuggestions');
    const addItemSection = document.getElementById('addItemForm')?.closest('.add-item-section');
    const tabsNav = document.querySelector('.tabs-nav');
    const currentTab = document.getElementById('currentTab');
    
    if (smartSummary) smartSummary.style.display = 'block';
    if (recurringSuggestions) recurringSuggestions.style.display = '';
    if (addItemSection) addItemSection.style.display = 'block';
    if (tabsNav) tabsNav.style.display = 'flex';
    if (currentTab) {
        currentTab.style.display = 'block';
        currentTab.classList.add('active');
    }
    
    // מעבר לטאב הנוכחי
    switchTab('current');
    
    // סנכרון עם Firebase אם יש רשימה משותפת
    await syncSharedList();
    
    // משוב למשתמש
    hapticFeedback();
    
    // הודעה למשתמש
    alert(`סיום קנייה הושלם בהצלחה!\n${purchasedItems.length} פריטים נשמרו בהיסטוריה.`);
}
