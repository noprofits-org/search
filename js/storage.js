// storage.js - Client-side storage utilities for favorites, recent searches, and theme

const RECENT_SEARCHES_KEY = 'np_recent_searches';
const FAVORITES_KEY = 'np_favorites';
const THEME_KEY = 'np_theme';
const MAX_RECENT_SEARCHES = 5;

/**
 * Recent Searches Management
 */

export function getRecentSearches() {
    try {
        const searches = localStorage.getItem(RECENT_SEARCHES_KEY);
        return searches ? JSON.parse(searches) : [];
    } catch (error) {
        console.error('Error reading recent searches:', error);
        return [];
    }
}

export function addRecentSearch(searchTerm) {
    try {
        const searches = getRecentSearches();

        // Remove duplicate if exists
        const filtered = searches.filter(s => s.toLowerCase() !== searchTerm.toLowerCase());

        // Add to beginning and limit to MAX_RECENT_SEARCHES
        const updated = [searchTerm, ...filtered].slice(0, MAX_RECENT_SEARCHES);

        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
    } catch (error) {
        console.error('Error saving recent search:', error);
        return [];
    }
}

export function clearRecentSearches() {
    try {
        localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch (error) {
        console.error('Error clearing recent searches:', error);
    }
}

/**
 * Favorites Management
 */

export function getFavorites() {
    try {
        const favorites = localStorage.getItem(FAVORITES_KEY);
        return favorites ? JSON.parse(favorites) : [];
    } catch (error) {
        console.error('Error reading favorites:', error);
        return [];
    }
}

export function addFavorite(ein, orgName, orgData = {}) {
    try {
        const favorites = getFavorites();

        // Check if already favorited
        if (favorites.some(f => f.ein === ein)) {
            return favorites;
        }

        const favorite = {
            ein,
            name: orgName,
            city: orgData.city || '',
            state: orgData.state || '',
            savedAt: Date.now()
        };

        const updated = [favorite, ...favorites];
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        return updated;
    } catch (error) {
        console.error('Error adding favorite:', error);
        return getFavorites();
    }
}

export function removeFavorite(ein) {
    try {
        const favorites = getFavorites();
        const updated = favorites.filter(f => f.ein !== ein);
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
        return updated;
    } catch (error) {
        console.error('Error removing favorite:', error);
        return getFavorites();
    }
}

export function isFavorite(ein) {
    const favorites = getFavorites();
    return favorites.some(f => f.ein === ein);
}

export function toggleFavorite(ein, orgName, orgData = {}) {
    if (isFavorite(ein)) {
        return { action: 'removed', favorites: removeFavorite(ein) };
    } else {
        return { action: 'added', favorites: addFavorite(ein, orgName, orgData) };
    }
}

export function clearFavorites() {
    try {
        localStorage.removeItem(FAVORITES_KEY);
    } catch (error) {
        console.error('Error clearing favorites:', error);
    }
}

/**
 * Theme Management
 */

export function getTheme() {
    try {
        const savedTheme = localStorage.getItem(THEME_KEY);
        // Default to dark mode if no preference is saved
        return savedTheme || 'dark';
    } catch (error) {
        console.error('Error reading theme:', error);
        return 'dark';
    }
}

export function setTheme(theme) {
    try {
        localStorage.setItem(THEME_KEY, theme);
        applyTheme(theme);
    } catch (error) {
        console.error('Error saving theme:', error);
    }
}

export function applyTheme(theme) {
    const root = document.documentElement;

    if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
    } else {
        root.removeAttribute('data-theme');
    }
}

export function toggleTheme() {
    const currentTheme = getTheme();
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    return newTheme;
}

export function getThemeIcon(theme) {
    return theme === 'dark' ? '☀️' : '🌙';
}
