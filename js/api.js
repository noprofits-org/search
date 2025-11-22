// api.js - Handles all ProPublica API interactions

// Primary proxy: NoProfits.org CORS proxy on Vercel
// Fallbacks: Public proxies (less reliable)
const CORS_PROXIES = [
    {
        name: 'NoProfits.org Proxy',
        format: (url) => `https://cors-proxy-xi-ten.vercel.app/api/proxy?url=${encodeURIComponent(url)}`
    },
    {
        name: 'AllOrigins',
        format: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
    },
    {
        name: 'CORS Anywhere',
        format: (url) => `https://cors-anywhere.herokuapp.com/${url}`
    }
];

let currentProxyIndex = 0;

// Cache configuration
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX = 'np_cache_'; // Nonprofit cache prefix

/**
 * Get cached data from localStorage
 */
function getCachedData(key) {
    try {
        const cached = localStorage.getItem(CACHE_PREFIX + key);
        if (!cached) return null;

        const { data, timestamp } = JSON.parse(cached);
        const isExpired = Date.now() - timestamp > CACHE_DURATION;

        if (isExpired) {
            localStorage.removeItem(CACHE_PREFIX + key);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Cache read error:', error);
        return null;
    }
}

/**
 * Store data in localStorage cache
 */
function setCachedData(key, data) {
    try {
        const cacheEntry = {
            data,
            timestamp: Date.now()
        };
        localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(cacheEntry));
    } catch (error) {
        console.error('Cache write error:', error);
        // If storage is full, clear old cache entries
        if (error.name === 'QuotaExceededError') {
            clearOldCache();
        }
    }
}

/**
 * Clear cache entries older than CACHE_DURATION
 */
function clearOldCache() {
    try {
        const keys = Object.keys(localStorage);
        const now = Date.now();

        keys.forEach(key => {
            if (key.startsWith(CACHE_PREFIX)) {
                try {
                    const cached = JSON.parse(localStorage.getItem(key));
                    if (now - cached.timestamp > CACHE_DURATION) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    // Remove corrupted cache entries
                    localStorage.removeItem(key);
                }
            }
        });
    } catch (error) {
        console.error('Cache cleanup error:', error);
    }
}

async function tryFetchWithProxy(url) {
    if (currentProxyIndex >= CORS_PROXIES.length) {
        throw new Error('All CORS proxies failed. Please try again later.');
    }

    const proxy = CORS_PROXIES[currentProxyIndex];

    try {
        const proxyUrl = proxy.format(url);
        console.log('Trying proxy:', proxy.name);

        const response = await fetch(proxyUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const text = await response.text();

        try {
            const data = JSON.parse(text);
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format');
            }

            // Reset proxy index on success
            currentProxyIndex = 0;
            return data;
        } catch (parseError) {
            console.error('Parse error:', parseError);
            throw new Error('Failed to parse API response');
        }
    } catch (error) {
        console.error(`Proxy ${proxy.name} failed:`, error.message);
        currentProxyIndex++;
        return tryFetchWithProxy(url);
    }
}

async function searchNonprofits(searchTerm) {
    try {
        console.log('Searching for:', searchTerm);

        // Check cache first
        const cacheKey = `search_${searchTerm.toLowerCase()}`;
        const cachedData = getCachedData(cacheKey);

        if (cachedData) {
            console.log('Returning cached search results');
            return cachedData;
        }

        // Cache miss - fetch from API
        const apiUrl = `https://projects.propublica.org/nonprofits/api/v2/search.json?q=${encodeURIComponent(searchTerm)}`;
        const data = await tryFetchWithProxy(apiUrl);

        // Validate the response structure
        if (!data.organizations || !Array.isArray(data.organizations)) {
            throw new Error('Invalid response format from API');
        }

        // Store in cache
        setCachedData(cacheKey, data);

        console.log('Search results:', data);
        return data;
    } catch (error) {
        console.error('Search error:', error);
        throw error;
    }
}

async function getNonprofitDetails(ein) {
    try {
        console.log('Fetching details for EIN:', ein);

        // Check cache first
        const cacheKey = `org_${ein}`;
        const cachedData = getCachedData(cacheKey);

        if (cachedData) {
            console.log('Returning cached organization details');
            return cachedData;
        }

        // Cache miss - fetch from API
        const apiUrl = `https://projects.propublica.org/nonprofits/api/v2/organizations/${ein}.json`;
        const data = await tryFetchWithProxy(apiUrl);

        // Store in cache
        setCachedData(cacheKey, data);

        console.log('Organization details:', data);
        return data;
    } catch (error) {
        console.error('Details fetch error:', error);
        throw error;
    }
}

export {
    searchNonprofits,
    getNonprofitDetails,
    tryFetchWithProxy
};