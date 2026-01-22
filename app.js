// ============================================
// רשימת קניות - JavaScript עם תכונות מתקדמות
// ============================================

// ניהול מצב
let shoppingList = [];
let favorites = [];
let shoppingHistory = [];
let recurringItems = [];
let sharedListId = null;
let isShoppingMode = false;
let autocompleteSuggestions = [];
let selectedAutocompleteIndex = -1;
let touchStartX = 0;
let touchStartY = 0;
let longPressTimer = null;

// אלמנטי DOM
const addItemForm = document.getElementById('addItemForm');
const itemNameInput = document.getElementById('itemName');
const shoppingListContainer = document.getElementById('shoppingList');
const favoritesListContainer = document.getElementById('favoritesList');
const historyListContainer = document.getElementById('historyList');
const shoppingModeList = document.getElementById('shoppingModeList');
const emptyState = document.getElementById('emptyState');
const favoritesEmptyState = document.getElementById('favoritesEmptyState');
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
    
    // בדיקה אם יש list ID ב-URL
    checkUrlForListId();
    
    // טעינת נתונים - אם יש listId משותף, נטען מ-Firebase, אחרת מ-localStorage
    if (sharedListId) {
        await loadSharedListFromFirebase();
    } else {
        loadFromLocalStorage();
        detectRecurringItems();
        renderList();
        renderFavorites();
        renderHistory();
        updateSmartSummary();
    }
    
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

// הגדרת מאזיני אירועים
function setupEventListeners() {
    addItemForm.addEventListener('submit', handleAddItem);
    clearPurchasedBtn.addEventListener('click', handleClearPurchased);
    smartCleanupBtn.addEventListener('click', handleSmartCleanup);
    darkModeToggle.addEventListener('click', toggleDarkMode);
    shoppingModeToggle.addEventListener('click', toggleShoppingMode);
    exitShoppingModeBtn.addEventListener('click', exitShoppingMode);
    shareListBtn.addEventListener('click', showSharingSection);
    
    // כפתור שמירה
    const saveListBtn = document.getElementById('saveListBtn');
    if (saveListBtn) {
        saveListBtn.addEventListener('click', handleSaveList);
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

// החלפת טאב
function switchTab(tabName) {
    // אם במצב קנייה, אל תאפשר החלפת טאבים
    if (isShoppingMode) {
        return;
    }
    
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
    // הפרד בין פריטים שלא נקנו לפריטים שנקנו
    const unpurchasedItems = shoppingList.filter(item => !item.purchased);
    const purchasedItems = shoppingList.filter(item => item.purchased);
    
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
    
    // הצג תחילה את הפריטים שלא נקנו
    unpurchasedItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'shopping-mode-item';
        li.dataset.itemId = item.id;
        
        // כפתור V - לחץ לסמן כנקנה
        const statusBtn = document.createElement('button');
        statusBtn.className = 'shopping-mode-status not-purchased';
        statusBtn.textContent = '✓';
        statusBtn.setAttribute('aria-label', 'לחץ לסמן כנקנה');
        statusBtn.addEventListener('click', () => {
            togglePurchased(item.id);
            renderShoppingMode();
            updateSmartSummary();
            hapticFeedback();
        });
        
        const content = document.createElement('div');
        content.className = 'shopping-mode-content';
        
        const name = document.createElement('div');
        name.className = 'shopping-mode-name';
        name.textContent = item.name;
        
        // כמות ליד השם
        if (item.quantity) {
            const quantitySpan = document.createElement('span');
            quantitySpan.className = 'shopping-mode-quantity';
            quantitySpan.textContent = item.quantity;
            name.appendChild(quantitySpan);
        }
        
        content.appendChild(name);
        
        li.appendChild(statusBtn);
        li.appendChild(content);
        shoppingModeList.appendChild(li);
    });
    
    // הצג אחר כך את הפריטים שנקנו (עם קו חוצה) בתחתית
    purchasedItems.forEach(item => {
        const li = document.createElement('li');
        li.className = 'shopping-mode-item purchased';
        li.dataset.itemId = item.id;
        
        // כפתור V - לחץ לבטל סימון
        const statusBtn = document.createElement('button');
        statusBtn.className = 'shopping-mode-status purchased';
        statusBtn.textContent = '✓';
        statusBtn.setAttribute('aria-label', 'נקנה - לחץ לבטל סימון');
        statusBtn.addEventListener('click', () => {
            togglePurchased(item.id);
            renderShoppingMode();
            updateSmartSummary();
            hapticFeedback();
        });
        
        const content = document.createElement('div');
        content.className = 'shopping-mode-content';
        
        const name = document.createElement('div');
        name.className = 'shopping-mode-name purchased-name';
        name.textContent = item.name;
        
        // כמות ליד השם
        if (item.quantity) {
            const quantitySpan = document.createElement('span');
            quantitySpan.className = 'shopping-mode-quantity';
            quantitySpan.textContent = item.quantity;
            name.appendChild(quantitySpan);
        }
        
        content.appendChild(name);
        
        li.appendChild(statusBtn);
        li.appendChild(content);
        shoppingModeList.appendChild(li);
    });
    
    // עדכן את כפתור סיום קנייה - הצג אם יש פריטים שנקנו
    const purchasedCount = purchasedItems.length;
    const footer = document.querySelector('.shopping-mode-footer');
    if (footer) {
        footer.style.display = purchasedCount > 0 ? 'block' : 'none';
    }
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
        quantity: itemQuantity || null,
        category: itemCategory || null,
        purchased: false,
        favorite: false,
        createdAt: new Date().toISOString()
    };
    
    const existingFavorite = favorites.find(f => normalizeText(f.name) === normalizeText(itemName));
    if (existingFavorite) {
        newItem.favorite = true;
        newItem.quantity = newItem.quantity || existingFavorite.quantity;
        newItem.category = newItem.category || existingFavorite.category;
    }
    
    shoppingList.push(newItem);
    saveToLocalStorage();
    renderList();
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

// סימון כמועדף
async function toggleFavorite(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        item.favorite = !item.favorite;
        
        if (item.favorite) {
            const favoriteItem = {
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                addedAt: new Date().toISOString()
            };
            
            if (!favorites.find(f => f.id === item.id)) {
                favorites.push(favoriteItem);
            }
        } else {
            favorites = favorites.filter(f => f.id !== itemId);
        }
        
        saveToLocalStorage();
        renderList();
        renderFavorites();
        await syncSharedList();
        hapticFeedback();
    }
}

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

// הוספת מועדף לרשימה
async function addFavoriteToList(favoriteId) {
    const favorite = favorites.find(f => f.id === favoriteId);
    if (!favorite) {
        return;
    }
    
    const exists = shoppingList.some(item => 
        normalizeText(item.name) === normalizeText(favorite.name) && !item.purchased
    );
    
    if (exists) {
        alert('הפריט כבר קיים ברשימה');
        return;
    }
    
    const newItem = {
        id: Date.now().toString(),
        name: favorite.name,
        quantity: favorite.quantity,
        category: favorite.category,
        purchased: false,
        favorite: true,
        createdAt: new Date().toISOString()
    };
    
    shoppingList.push(newItem);
    saveToLocalStorage();
    renderList();
    updateSmartSummary();
    switchTab('current');
    await syncSharedList();
    hapticFeedback();
}

// מחיקת מועדף
async function deleteFavorite(favoriteId) {
    if (confirm('האם אתה בטוח שברצונך להסיר פריט זה מהמועדפים?')) {
        favorites = favorites.filter(f => f.id !== favoriteId);
        
        shoppingList.forEach(item => {
            if (item.id === favoriteId) {
                item.favorite = false;
            }
        });
        
        saveToLocalStorage();
        renderFavorites();
        renderList();
        await syncSharedList();
    }
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
    
    // מועדפים
    favorites.forEach(fav => {
        if (normalizeText(fav.name).includes(normalizedQuery)) {
            suggestions.push({
                type: 'favorite',
                name: fav.name,
                quantity: fav.quantity,
                category: fav.category,
                icon: '⭐'
            });
        }
    });
    
    // מוצרים חוזרים
    recurringItems.forEach(item => {
        if (normalizeText(item.name).includes(normalizedQuery) &&
            !suggestions.some(s => normalizeText(s.name) === normalizeText(item.name))) {
            suggestions.push({
                type: 'recurring',
                name: item.name,
                quantity: item.quantity,
                category: item.category,
                icon: '🔄'
            });
        }
    });
    
    // מהיסטוריה
    shoppingHistory.slice(0, 10).forEach(entry => {
        entry.items.forEach(item => {
            if (normalizeText(item.name).includes(normalizedQuery) &&
                !suggestions.some(s => normalizeText(s.name) === normalizeText(item.name))) {
                suggestions.push({
                    type: 'history',
                    name: item.name,
                    quantity: item.quantity,
                    category: item.category,
                    icon: '📚'
                });
            }
        });
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
                ${suggestion.quantity ? 
                    `<div class="autocomplete-item-details">${suggestion.quantity}</div>` 
                    : ''}
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
    autocompleteDropdown.classList.remove('show');
    itemNameInput.focus();
    hapticFeedback();
}

// רינדור רשימת הקניות
function renderList() {
    const sortedList = [...shoppingList].sort((a, b) => {
        if (a.purchased !== b.purchased) {
            return a.purchased ? 1 : -1;
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    shoppingListContainer.innerHTML = '';
    
    if (sortedList.length === 0) {
        emptyState.style.display = 'block';
        clearPurchasedBtn.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
    }
    
    sortedList.forEach(item => {
        const listItem = createListItem(item);
        shoppingListContainer.appendChild(listItem);
    });
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
    
    const name = document.createElement('div');
    name.className = 'item-name';
    name.textContent = item.name;
    
    const details = document.createElement('div');
    details.className = 'item-details';
    
    if (item.quantity) {
        const quantitySpan = document.createElement('span');
        quantitySpan.className = 'item-detail';
        quantitySpan.textContent = `כמות: ${item.quantity}`;
        details.appendChild(quantitySpan);
    }
    
    if (item.category) {
        const categorySpan = document.createElement('span');
        categorySpan.className = 'item-detail';
        categorySpan.textContent = `קטגוריה: ${item.category}`;
        details.appendChild(categorySpan);
    }
    
    content.appendChild(name);
    if (details.children.length > 0) {
        content.appendChild(details);
    }
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const starBtn = document.createElement('button');
    starBtn.className = `star-btn ${item.favorite ? 'favorite' : ''}`;
    starBtn.textContent = '⭐';
    starBtn.addEventListener('click', () => toggleFavorite(item.id));
    starBtn.setAttribute('aria-label', item.favorite ? `הסר ${item.name} ממועדפים` : `סמן ${item.name} כמועדף`);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'מחק';
    deleteBtn.addEventListener('click', () => deleteItem(item.id));
    deleteBtn.setAttribute('aria-label', `מחק ${item.name}`);
    
    actions.appendChild(starBtn);
    actions.appendChild(deleteBtn);
    
    li.appendChild(checkbox);
    li.appendChild(content);
    li.appendChild(actions);
    
    return li;
}

// רינדור מועדפים
function renderFavorites() {
    favoritesListContainer.innerHTML = '';
    
    if (favorites.length === 0) {
        favoritesEmptyState.style.display = 'block';
    } else {
        favoritesEmptyState.style.display = 'none';
        
        favorites.forEach(favorite => {
            const favoriteItem = createFavoriteItem(favorite);
            favoritesListContainer.appendChild(favoriteItem);
        });
    }
}

// יצירת אלמנט מועדף
function createFavoriteItem(favorite) {
    const div = document.createElement('div');
    div.className = 'favorite-item';
    
    const content = document.createElement('div');
    content.className = 'favorite-item-content';
    
    const name = document.createElement('div');
    name.className = 'favorite-item-name';
    name.textContent = favorite.name;
    
    const details = document.createElement('div');
    details.className = 'favorite-item-details';
    
    if (favorite.quantity) {
        const quantitySpan = document.createElement('span');
        quantitySpan.textContent = `כמות: ${favorite.quantity}`;
        details.appendChild(quantitySpan);
    }
    
    if (favorite.category) {
        const categorySpan = document.createElement('span');
        categorySpan.textContent = `קטגוריה: ${favorite.category}`;
        details.appendChild(categorySpan);
    }
    
    content.appendChild(name);
    if (details.children.length > 0) {
        content.appendChild(details);
    }
    
    const actions = document.createElement('div');
    actions.className = 'item-actions';
    
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary favorite-add-btn';
    addBtn.textContent = 'הוסף לרשימה';
    addBtn.addEventListener('click', () => addFavoriteToList(favorite.id));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'מחק';
    deleteBtn.addEventListener('click', () => deleteFavorite(favorite.id));
    
    actions.appendChild(addBtn);
    actions.appendChild(deleteBtn);
    
    div.appendChild(content);
    div.appendChild(actions);
    
    return div;
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
    
    longPressTimer = setTimeout(() => {
        const itemId = item.dataset.itemId;
        toggleFavorite(itemId);
        hapticFeedback('long');
    }, 500);
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
function checkUrlForListId() {
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
}

function setupSharing() {
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
    }
}

function showSharingSection() {
    sharingSection.style.display = 'block';
    if (!sharedListId) {
        generateNewShareLink();
    } else {
        updateShareLink();
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
        renderFavorites();
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
        renderFavorites();
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
                renderFavorites();
                renderHistory();
                updateSmartSummary();
                
                showSharedListNotification();
            } else {
                // אם הרשימה לא קיימת, נטען מ-localStorage
                console.log('רשימה לא נמצאה ב-Firebase - נטען מ-localStorage');
                loadFromLocalStorage();
                detectRecurringItems();
                renderList();
                renderFavorites();
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
        renderFavorites();
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
        localStorage.setItem('favorites', JSON.stringify(favorites));
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
        
        const savedFavorites = localStorage.getItem('favorites');
        if (savedFavorites) {
            favorites = JSON.parse(savedFavorites);
            favorites = favorites.filter(item => 
                item && item.id && item.name
            );
        }
        
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
        favorites = [];
        shoppingHistory = [];
        recurringItems = [];
    }
}

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

// הצגת סיכום קנייה
function showShoppingSummary() {
    const purchased = shoppingList.filter(item => item.purchased);
    const notPurchased = shoppingList.filter(item => !item.purchased);
    
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

