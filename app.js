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
document.addEventListener('DOMContentLoaded', () => {
    // בדיקה אם יש list ID ב-URL
    checkUrlForListId();
    
    loadFromLocalStorage();
    detectRecurringItems();
    renderList();
    renderFavorites();
    renderHistory();
    updateSmartSummary();
    setupEventListeners();
    loadTheme();
    checkAndSaveHistory();
    setupSharing();
    setupAutocomplete();
    setupMobileGestures();
    startSharingSync();
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
}

// החלפת טאב
function switchTab(tabName) {
    if (isShoppingMode && tabName !== 'shoppingMode') {
        exitShoppingMode();
    }
    
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    
    const selectedBtn = document.querySelector(`[data-tab="${tabName}"]`);
    const selectedContent = document.getElementById(`${tabName}Tab`);
    
    if (selectedBtn && selectedContent) {
        selectedBtn.classList.add('active');
        selectedContent.classList.add('active');
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
    const shoppingModeTab = document.getElementById('shoppingModeTab');
    if (shoppingModeTab) {
        shoppingModeTab.classList.add('active');
        shoppingModeTab.style.display = 'block';
    }
    renderShoppingMode();
    switchTab('shoppingMode');
}

function exitShoppingMode() {
    isShoppingMode = false;
    shoppingModeToggle.classList.remove('active');
    const shoppingModeTab = document.getElementById('shoppingModeTab');
    if (shoppingModeTab) {
        shoppingModeTab.classList.remove('active');
        shoppingModeTab.style.display = 'none';
    }
    switchTab('current');
}

function renderShoppingMode() {
    const unpurchased = shoppingList.filter(item => !item.purchased);
    shoppingModeList.innerHTML = '';
    
    document.getElementById('shoppingModeRemaining').textContent = unpurchased.length;
    
    unpurchased.forEach(item => {
        const li = document.createElement('li');
        li.className = 'shopping-mode-item';
        li.dataset.itemId = item.id;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'shopping-mode-checkbox';
        checkbox.checked = false;
        checkbox.addEventListener('change', () => {
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
        
        const details = document.createElement('div');
        details.className = 'shopping-mode-details';
        
        if (item.quantity) {
            const quantitySpan = document.createElement('span');
            quantitySpan.textContent = `כמות: ${item.quantity}`;
            details.appendChild(quantitySpan);
        }
        
        if (item.category) {
            const categorySpan = document.createElement('span');
            categorySpan.textContent = `קטגוריה: ${item.category}`;
            details.appendChild(categorySpan);
        }
        
        content.appendChild(name);
        if (details.children.length > 0) {
            content.appendChild(details);
        }
        
        li.appendChild(checkbox);
        li.appendChild(content);
        shoppingModeList.appendChild(li);
    });
}

// הוספת פריט חדש
function handleAddItem(e) {
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
    syncSharedList();
    updateUrlWithListId();
    updateUrlWithListId();
    
    e.target.reset();
    itemNameInput.focus();
    autocompleteDropdown.classList.remove('show');
    hapticFeedback();
}

// סימון כנקנה/לא נקנה
function togglePurchased(itemId) {
    const item = shoppingList.find(i => i.id === itemId);
    if (item) {
        item.purchased = !item.purchased;
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        checkAndSaveHistory();
        syncSharedList();
    updateUrlWithListId();
        hapticFeedback();
    }
}

// סימון כמועדף
function toggleFavorite(itemId) {
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
        syncSharedList();
    updateUrlWithListId();
        updateUrlWithListId();
        hapticFeedback();
    }
}

// מחיקת פריט
function deleteItem(itemId) {
    if (confirm('האם אתה בטוח שברצונך למחוק פריט זה?')) {
        shoppingList = shoppingList.filter(item => item.id !== itemId);
        saveToLocalStorage();
        renderList();
        updateSmartSummary();
        checkAndSaveHistory();
        syncSharedList();
    updateUrlWithListId();
        hapticFeedback();
    }
}

// ניקוי פריטים שנקנו
function handleClearPurchased() {
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
        syncSharedList();
    updateUrlWithListId();
        updateUrlWithListId();
    }
}

// ניקוי כפילויות חכם
function handleSmartCleanup() {
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
        syncSharedList();
    updateUrlWithListId();
        updateUrlWithListId();
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

function addRecurringItem(item) {
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
    syncSharedList();
    updateUrlWithListId();
    updateUrlWithListId();
    hapticFeedback();
}

// שחזור רשימה מהיסטוריה
function restoreFromHistory(historyId) {
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
        syncSharedList();
    updateUrlWithListId();
        updateUrlWithListId();
    }
}

// הוספת מועדף לרשימה
function addFavoriteToList(favoriteId) {
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
    syncSharedList();
    updateUrlWithListId();
    updateUrlWithListId();
    hapticFeedback();
}

// מחיקת מועדף
function deleteFavorite(favoriteId) {
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
        syncSharedList();
    updateUrlWithListId();
        updateUrlWithListId();
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
                ${suggestion.quantity || suggestion.category ? 
                    `<div class="autocomplete-item-details">${[suggestion.quantity, suggestion.category].filter(Boolean).join(' • ')}</div>` 
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
    if (suggestion.category) {
        document.getElementById('itemCategory').value = suggestion.category;
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
    const urlParams = new URLSearchParams(window.location.search);
    const listId = urlParams.get('list');
    
    if (listId) {
        sharedListId = listId;
        localStorage.setItem('sharedListId', sharedListId);
        loadSharedList();
        
        // עדכון ה-URL ללא ה-parameter (אבל שמירה על ה-history)
        if (window.history && window.history.replaceState) {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, '', newUrl);
        }
    } else {
        // אם אין list ID ב-URL, נבדוק אם יש אחד ב-localStorage
        sharedListId = localStorage.getItem('sharedListId');
    }
}

function setupSharing() {
    if (sharedListId) {
        updateShareLink();
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

function generateNewShareLink() {
    // יצירת מזהה ייחודי חדש
    sharedListId = 'list-' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('sharedListId', sharedListId);
    
    // שמירת הרשימה הנוכחית עם המזהה החדש
    saveSharedList();
    
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
    return `${baseUrl}?list=${sharedListId}`;
}

function updateUrlWithListId() {
    if (!sharedListId) return;
    
    // עדכון ה-URL רק אם המשתמש כבר בשיתוף פעיל
    // לא נעדכן את ה-URL אם זה קרה בעת טעינה ראשונית מקישור
    const currentUrl = window.location.href;
    const hasListParam = currentUrl.includes('?list=');
    
    // עדכון רק אם אין כבר list parameter (כי אם יש, זה אומר שמישהו פתח קישור)
    if (!hasListParam) {
        const newUrl = getShareableUrl();
        if (window.history && window.history.replaceState) {
            // עדכון שקט של ה-URL ללא reload
            window.history.replaceState({}, '', newUrl);
        }
    }
}

function copyShareLink() {
    const input = document.getElementById('shareLinkInput');
    if (!input || !input.value) {
        alert('אין קישור לשיתוף. אנא צור קישור חדש.');
        return;
    }
    
    input.select();
    input.setSelectionRange(0, 99999); // למובייל
    
    try {
        document.execCommand('copy');
        
        // שימוש ב-Clipboard API אם זמין
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(() => {
                showCopySuccess();
            });
        } else {
            showCopySuccess();
        }
    } catch (err) {
        // נסה דרך Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(input.value).then(() => {
                showCopySuccess();
            }).catch(() => {
                alert('לא ניתן להעתיק. אנא העתק ידנית: ' + input.value);
            });
        } else {
            alert('לא ניתן להעתיק. אנא העתק ידנית: ' + input.value);
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

function stopSharing() {
    if (confirm('האם אתה בטוח שברצונך להפסיק את השיתוף? הקישור לא יעבוד יותר.')) {
        sharedListId = null;
        localStorage.removeItem('sharedListId');
        
        // עדכון ה-URL להסרת ה-list parameter
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

function saveSharedList() {
    if (!sharedListId) return;
    
    const data = {
        list: shoppingList,
        favorites: favorites,
        timestamp: Date.now(),
        version: Date.now() // גרסה לזיהוי עדכונים
    };
    
    try {
        localStorage.setItem(`shared_${sharedListId}`, JSON.stringify(data));
    } catch (error) {
        console.error('שגיאה בשמירת רשימה משותפת:', error);
    }
}

function loadSharedList() {
    if (!sharedListId) return;
    
    try {
        const saved = localStorage.getItem(`shared_${sharedListId}`);
        if (saved) {
            const data = JSON.parse(saved);
            if (data.list && Array.isArray(data.list)) {
                // שמירת הגרסה המקומית לבדיקת עדכונים
                const localVersion = localStorage.getItem(`shared_version_${sharedListId}`);
                
                // טעינת הרשימה רק אם יש עדכון או שזו הפעם הראשונה
                if (!localVersion || (data.version && data.version > parseInt(localVersion))) {
                    shoppingList = data.list;
                    if (data.favorites) {
                        favorites = data.favorites;
                    }
                    
                    // שמירת הגרסה המקומית
                    if (data.version) {
                        localStorage.setItem(`shared_version_${sharedListId}`, data.version.toString());
                    }
                    
                    saveToLocalStorage();
                    renderList();
                    renderFavorites();
                    updateSmartSummary();
                    
                    // הצגת הודעה אם זו רשימה משותפת
                    if (window.location.search.includes('list=')) {
                        showSharedListNotification();
                    }
                }
            }
        }
    } catch (error) {
        console.error('שגיאה בטעינת רשימה משותפת:', error);
    }
}

function syncSharedList() {
    if (!sharedListId) return;
    saveSharedList();
}

function startSharingSync() {
    if (!sharedListId) return;
    
    // סנכרון כל 2 שניות
    setInterval(() => {
        if (sharedListId) {
            loadSharedList();
        }
    }, 2000);
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
