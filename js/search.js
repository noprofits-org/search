// search.js
import { searchNonprofits, getNonprofitDetails } from './api.js';
import {
    formatCurrency,
    formatDate,
    numberWithCommas
} from './utils.js';
import { renderFinancialTrendsChart } from './charts.js';
import {
    getRecentSearches,
    addRecentSearch,
    getFavorites,
    toggleFavorite,
    isFavorite,
    getTheme,
    toggleTheme,
    applyTheme,
    getThemeIcon
} from './storage.js';

let searchInput, searchButton, resultsContainer, modal, themeToggle;

/**
 * Display historical filings data in a table format
 * @param {Array} filings - Array of filing data objects
 * @returns {string} HTML string for the filings table
 */
function displayFilingsHistory(filings) {  // <--- Restored function
    if (!filings || filings.length === 0) return 'No historical data available';

    return `
        <table class="data-table">
            <thead>
                <tr>
                    <th>Year</th>
                    <th>Revenue</th>
                    <th>Expenses</th>
                    <th>Assets</th>
                </tr>
            </thead>
            <tbody>
                ${filings.map(filing => `
                    <tr>
                        <td data-label="Year">${filing.tax_prd_yr || 'N/A'}</td>
                        <td data-label="Revenue">${filing.totrevenue ? '$' + numberWithCommas(filing.totrevenue) : 'N/A'}</td>
                        <td data-label="Expenses">${filing.totfuncexpns ? '$' + numberWithCommas(filing.totfuncexpns) : 'N/A'}</td>
                        <td data-label="Assets">${filing.totassetsend ? '$' + numberWithCommas(filing.totassetsend) : 'N/A'}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function getFinancialTrendsSection(data) {
    return `
        <div class="section">
            <h2 class="section-header">Financial Trends</h2>
            <div id="trendsChart" style="height: 300px; margin-bottom: 2rem;"></div>
            <div id="previousYearsData">
                ${data.filings_with_data ? displayFilingsHistory(data.filings_with_data) : 'No historical data available'}
            </div>
        </div>
    `;
}

/**
 * Display search results in the UI
 */
function displayResults(data) {
    if (!data.organizations?.length) {
        resultsContainer.innerHTML = '<div class="error-message">No organizations found</div>';
        return;
    }

    // Clear any existing results
    resultsContainer.innerHTML = '';

    const resultsHTML = data.organizations.map(org => {
        const favorited = isFavorite(org.ein);
        const favoriteIcon = favorited ? '★' : '☆';
        const favoriteClass = favorited ? 'favorited' : '';

        return `
        <div class="org-card">
            <div class="org-card-header">
                <div class="org-name">${org.name}</div>
                <button class="favorite-btn ${favoriteClass}"
                        data-ein="${org.ein}"
                        data-name="${org.name.replace(/"/g, '&quot;')}"
                        data-city="${org.city || ''}"
                        data-state="${org.state || ''}"
                        title="${favorited ? 'Remove from favorites' : 'Add to favorites'}">
                    ${favoriteIcon}
                </button>
            </div>
            <div class="org-meta">
                EIN: ${org.ein}<br>
                Location: ${org.city}, ${org.state}<br>
                <a href="https://projects.propublica.org/nonprofits/organizations/${org.ein}" target="_blank">
                    View on ProPublica
                </a>
                <br>
                <a href="#" onclick="showAnalysis('${org.ein}', '${org.name.replace(/'/g, "\\'")}'); return false;">
                    NoProfit Quick Analysis
                </a>
            </div>
        </div>
    `;
    });

    // Append the new results to the container
    resultsContainer.innerHTML += resultsHTML.join('');

    // Add event listeners to favorite buttons
    resultsContainer.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', handleFavoriteClick);
    });

    // Now you can add a results count element if needed
    const resultsCount = document.createElement('div');
    resultsCount.classList.add('results-count');
    resultsCount.textContent = `Found ${data.total_results} results`;
    resultsContainer.appendChild(resultsCount);
}

/**
 * Handle favorite button click
 */
function handleFavoriteClick(event) {
    event.preventDefault();
    const btn = event.currentTarget;
    const ein = btn.dataset.ein;
    const name = btn.dataset.name;
    const city = btn.dataset.city;
    const state = btn.dataset.state;

    const result = toggleFavorite(ein, name, { city, state });

    // Update button appearance
    if (result.action === 'added') {
        btn.textContent = '★';
        btn.classList.add('favorited');
        btn.title = 'Remove from favorites';
    } else {
        btn.textContent = '☆';
        btn.classList.remove('favorited');
        btn.title = 'Add to favorites';
    }

    // Update favorites display if on favorites tab
    displayFavorites();
}

/**
 * Display favorites in the favorites tab
 */
function displayFavorites() {
    const favoritesContainer = document.getElementById('favoritesContainer');
    if (!favoritesContainer) return;

    const favorites = getFavorites();

    if (favorites.length === 0) {
        favoritesContainer.innerHTML = `
            <div class="empty-state">
                <p>You haven't saved any favorite organizations yet.</p>
                <p>Click the ★ button on any organization to save it to your favorites.</p>
            </div>
        `;
        return;
    }

    const favoritesHTML = favorites.map(fav => `
        <div class="org-card">
            <div class="org-card-header">
                <div class="org-name">${fav.name}</div>
                <button class="favorite-btn favorited"
                        data-ein="${fav.ein}"
                        data-name="${fav.name.replace(/"/g, '&quot;')}"
                        data-city="${fav.city || ''}"
                        data-state="${fav.state || ''}"
                        title="Remove from favorites">
                    ★
                </button>
            </div>
            <div class="org-meta">
                EIN: ${fav.ein}<br>
                ${fav.city && fav.state ? `Location: ${fav.city}, ${fav.state}<br>` : ''}
                <a href="https://projects.propublica.org/nonprofits/organizations/${fav.ein}" target="_blank">
                    View on ProPublica
                </a>
                <br>
                <a href="#" onclick="showAnalysis('${fav.ein}', '${fav.name.replace(/'/g, "\\'")}'); return false;">
                    NoProfit Quick Analysis
                </a>
            </div>
        </div>
    `).join('');

    favoritesContainer.innerHTML = favoritesHTML;

    // Add event listeners to favorite buttons
    favoritesContainer.querySelectorAll('.favorite-btn').forEach(btn => {
        btn.addEventListener('click', handleFavoriteClick);
    });
}

/**
 * Get latest filing data with all fields
 */
function getLatestFiling(data) {
    return data.filings_with_data && data.filings_with_data.length > 0
        ? data.filings_with_data[0]
        : {};
}

/**
 * Calculate financial health ratios
 */
function calculateRatios(filing) {
    const ratios = {};

    if (filing.totrevenue && filing.totfuncexpns) {
        // Program expense ratio (what % goes to programs vs overhead)
        const programExpenses = filing.totfuncexpns - (filing.compnsatncurrofcr || 0);
        ratios.programRatio = ((programExpenses / filing.totfuncexpns) * 100).toFixed(1);

        // Surplus/Deficit
        ratios.surplus = filing.totrevenue - filing.totfuncexpns;
        ratios.surplusRatio = ((ratios.surplus / filing.totrevenue) * 100).toFixed(1);
    }

    if (filing.totassetsend && filing.totfuncexpns) {
        // Months of operating reserves
        const monthlyExpenses = filing.totfuncexpns / 12;
        ratios.monthsReserve = (filing.totassetsend / monthlyExpenses).toFixed(1);
    }

    if (filing.grsincfndrsng && filing.lessdirfndrsng) {
        // Fundraising efficiency (return per dollar spent)
        ratios.fundraisingROI = (filing.grsincfndrsng / filing.lessdirfndrsng).toFixed(2);
    }

    return ratios;
}

function getOrgDetailsSection(org) {
    return `
        <div class="section">
            <h2 class="section-header">Organization Details</h2>
            <div class="metric-grid">
                <div class="metric-card">
                    <h3>Organization Info</h3>
                    <div class="metric-value">
                        EIN: ${org.ein}<br>
                        Location: ${org.city}, ${org.state}<br>
                        Tax-Exempt Since: ${formatDate(org.tax_exempt_since)}<br>
                        Last Filing: ${formatDate(org.latest_filing_date)}
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Classification</h3>
                    <div class="metric-value">
                        NTEE Code: ${org.ntee_code || 'N/A'}<br>
                        Subsection: ${org.subsection_code || 'N/A'}<br>
                        Foundation Status: ${org.foundation_code || 'N/A'}
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Latest Financial Data</h3>
                    <div class="metric-value">
                        Revenue: ${formatCurrency(org.income_amount)}<br>
                        Assets: ${formatCurrency(org.asset_amount)}<br>
                        ${org.exemption_number ? 'Exemption: ' + org.exemption_number : ''}
                    </div>
                </div>
                <div class="metric-card">
                    <h3>Contact Information</h3>
                    <div class="metric-value">
                        Address: ${org.address ? `${org.address}, ${org.city}, ${org.state}` : 'N/A'}<br>
                        ZIP: ${org.zipcode || 'N/A'}<br>
                        ${org.website ? `Website: <a href="${org.website}" target="_blank" class="text-blue-500">${org.website}</a>` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
}

function getRevenueBreakdownSection(filing) {
    if (!filing || !filing.totrevenue) return '';

    const revenue = {
        contributions: filing.totcntrbgfts || 0,
        program: filing.totprgmrevnue || 0,
        investment: filing.invstmntinc || 0,
        fundraising: filing.netincfndrsng || 0,
        gaming: filing.netincgaming || 0,
        rental: filing.netrntlinc || 0,
        other: filing.grsincother || 0
    };

    // Only show if we have at least one revenue source
    if (Object.values(revenue).every(v => v === 0)) return '';

    return `
        <div class="section">
            <h2 class="section-header">Revenue Sources (${filing.tax_prd_yr})</h2>
            <div class="metric-grid">
                ${revenue.contributions > 0 ? `
                <div class="metric-card">
                    <h3>Contributions & Grants</h3>
                    <div class="metric-value">${formatCurrency(revenue.contributions)}</div>
                    <div class="metric-label">${((revenue.contributions / filing.totrevenue) * 100).toFixed(1)}% of revenue</div>
                </div>
                ` : ''}
                ${revenue.program > 0 ? `
                <div class="metric-card">
                    <h3>Program Service Revenue</h3>
                    <div class="metric-value">${formatCurrency(revenue.program)}</div>
                    <div class="metric-label">${((revenue.program / filing.totrevenue) * 100).toFixed(1)}% of revenue</div>
                </div>
                ` : ''}
                ${revenue.investment > 0 ? `
                <div class="metric-card">
                    <h3>Investment Income</h3>
                    <div class="metric-value">${formatCurrency(revenue.investment)}</div>
                    <div class="metric-label">${((revenue.investment / filing.totrevenue) * 100).toFixed(1)}% of revenue</div>
                </div>
                ` : ''}
                ${revenue.fundraising > 0 ? `
                <div class="metric-card">
                    <h3>Net Fundraising Events</h3>
                    <div class="metric-value">${formatCurrency(revenue.fundraising)}</div>
                    <div class="metric-label">${((revenue.fundraising / filing.totrevenue) * 100).toFixed(1)}% of revenue</div>
                </div>
                ` : ''}
                ${revenue.gaming > 0 ? `
                <div class="metric-card">
                    <h3>Gaming Income</h3>
                    <div class="metric-value">${formatCurrency(revenue.gaming)}</div>
                    <div class="metric-label">${((revenue.gaming / filing.totrevenue) * 100).toFixed(1)}% of revenue</div>
                </div>
                ` : ''}
                ${revenue.rental > 0 ? `
                <div class="metric-card">
                    <h3>Net Rental Income</h3>
                    <div class="metric-value">${formatCurrency(revenue.rental)}</div>
                    <div class="metric-label">${((revenue.rental / filing.totrevenue) * 100).toFixed(1)}% of revenue</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function getCompensationSection(filing) {
    if (!filing || !filing.totfuncexpns) return '';

    const hasData = filing.compnsatncurrofcr || filing.othrsalwages || filing.payrolltx;
    if (!hasData) return '';

    const officerComp = filing.compnsatncurrofcr || 0;
    const otherSalaries = filing.othrsalwages || 0;
    const payrollTax = filing.payrolltx || 0;
    const totalComp = officerComp + otherSalaries + payrollTax;

    return `
        <div class="section">
            <h2 class="section-header">Compensation & Payroll (${filing.tax_prd_yr})</h2>
            <div class="metric-grid">
                ${officerComp > 0 ? `
                <div class="metric-card">
                    <h3>Officer Compensation</h3>
                    <div class="metric-value">${formatCurrency(officerComp)}</div>
                    <div class="metric-label">${((officerComp / filing.totfuncexpns) * 100).toFixed(1)}% of expenses</div>
                </div>
                ` : ''}
                ${otherSalaries > 0 ? `
                <div class="metric-card">
                    <h3>Other Salaries & Wages</h3>
                    <div class="metric-value">${formatCurrency(otherSalaries)}</div>
                    <div class="metric-label">${((otherSalaries / filing.totfuncexpns) * 100).toFixed(1)}% of expenses</div>
                </div>
                ` : ''}
                ${payrollTax > 0 ? `
                <div class="metric-card">
                    <h3>Payroll Taxes</h3>
                    <div class="metric-value">${formatCurrency(payrollTax)}</div>
                </div>
                ` : ''}
                ${totalComp > 0 ? `
                <div class="metric-card">
                    <h3>Total Compensation</h3>
                    <div class="metric-value">${formatCurrency(totalComp)}</div>
                    <div class="metric-label">${((totalComp / filing.totfuncexpns) * 100).toFixed(1)}% of expenses</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function getFundraisingSection(filing) {
    if (!filing) return '';

    const hasData = filing.grsincfndrsng || filing.lessdirfndrsng || filing.profndraising;
    if (!hasData) return '';

    const grossIncome = filing.grsincfndrsng || 0;
    const directExpenses = filing.lessdirfndrsng || 0;
    const proFees = filing.profndraising || 0;
    const netIncome = filing.netincfndrsng || (grossIncome - directExpenses);

    const efficiency = directExpenses > 0 ? (grossIncome / directExpenses).toFixed(2) : 'N/A';
    const netMargin = grossIncome > 0 ? ((netIncome / grossIncome) * 100).toFixed(1) : 'N/A';

    return `
        <div class="section">
            <h2 class="section-header">Fundraising Analysis (${filing.tax_prd_yr})</h2>
            <div class="metric-grid">
                ${grossIncome > 0 ? `
                <div class="metric-card">
                    <h3>Gross Fundraising Income</h3>
                    <div class="metric-value">${formatCurrency(grossIncome)}</div>
                </div>
                ` : ''}
                ${directExpenses > 0 ? `
                <div class="metric-card">
                    <h3>Direct Fundraising Expenses</h3>
                    <div class="metric-value">${formatCurrency(directExpenses)}</div>
                </div>
                ` : ''}
                ${netIncome !== 0 ? `
                <div class="metric-card">
                    <h3>Net Fundraising Income</h3>
                    <div class="metric-value">${formatCurrency(netIncome)}</div>
                    ${netMargin !== 'N/A' ? `<div class="metric-label">${netMargin}% net margin</div>` : ''}
                </div>
                ` : ''}
                ${efficiency !== 'N/A' && directExpenses > 0 ? `
                <div class="metric-card">
                    <h3>Fundraising Efficiency</h3>
                    <div class="metric-value">$${efficiency}</div>
                    <div class="metric-label">raised per $1 spent</div>
                </div>
                ` : ''}
                ${proFees > 0 ? `
                <div class="metric-card">
                    <h3>Professional Fundraising Fees</h3>
                    <div class="metric-value">${formatCurrency(proFees)}</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function getFinancialHealthSection(filing) {
    if (!filing || !filing.totrevenue) return '';

    const ratios = calculateRatios(filing);
    if (Object.keys(ratios).length === 0) return '';

    return `
        <div class="section">
            <h2 class="section-header">Financial Health Indicators (${filing.tax_prd_yr})</h2>
            <div class="metric-grid">
                ${ratios.surplus !== undefined ? `
                <div class="metric-card ${ratios.surplus >= 0 ? 'positive' : 'negative'}">
                    <h3>${ratios.surplus >= 0 ? 'Surplus' : 'Deficit'}</h3>
                    <div class="metric-value">${formatCurrency(Math.abs(ratios.surplus))}</div>
                    <div class="metric-label">${ratios.surplusRatio}% of revenue</div>
                </div>
                ` : ''}
                ${ratios.monthsReserve ? `
                <div class="metric-card">
                    <h3>Operating Reserves</h3>
                    <div class="metric-value">${ratios.monthsReserve} months</div>
                    <div class="metric-label">of operating expenses</div>
                </div>
                ` : ''}
                ${ratios.programRatio ? `
                <div class="metric-card">
                    <h3>Program Expense Ratio</h3>
                    <div class="metric-value">${ratios.programRatio}%</div>
                    <div class="metric-label">goes to programs</div>
                </div>
                ` : ''}
                ${ratios.fundraisingROI ? `
                <div class="metric-card">
                    <h3>Fundraising ROI</h3>
                    <div class="metric-value">$${ratios.fundraisingROI}</div>
                    <div class="metric-label">per dollar spent</div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
}

function getFullReportSection(ein) {
    return `
        <div class="section">
            <h2 class="section-header">Full Report</h2>
            <div class="metric-card">
                <div class="metric-value">
                    <a href="https://projects.propublica.org/nonprofits/organizations/${ein}" 
                       target="_blank" 
                       class="text-blue-500">
                        View on ProPublica →
                    </a>
                </div>
            </div>
        </div>
    `;
}

// Update showAnalysis to use these sections
async function showAnalysis(ein, orgName) {
    try {
        document.getElementById('modalOrgName').textContent = orgName;
        document.getElementById('modalContent').innerHTML = '<div class="loading-spinner"></div>';
        modal.style.display = 'block';

        // *** THIS IS THE KEY CHANGE ***
        let data; // Declare data variable here
        try {
            data = await getNonprofitDetails(ein); // Fetch the data
        } catch (fetchError) {
            console.error("Error fetching nonprofit details:", fetchError);
            document.getElementById('modalContent').innerHTML = `
                <div class="error-message">
                    Unable to retrieve nonprofit details. Please try again later.
                    <br><br>
                    <a href="https://projects.propublica.org/nonprofits/organizations/${ein}" 
                       target="_blank"
                       class="text-blue-500">
                        View on ProPublica →
                    </a>
                </div>
            `;
            return; // Important: Exit the function if fetching fails
        }
        // **********************************

        if (!data || !data.organization) {
            throw new Error('Organization data not found in the response');
        }

        const org = data.organization;
        const latestFiling = getLatestFiling(data);

        // Compose modal content from sections
        document.getElementById('modalContent').innerHTML = `
            ${getFinancialTrendsSection(data)}
            ${getFinancialHealthSection(latestFiling)}
            ${getRevenueBreakdownSection(latestFiling)}
            ${getCompensationSection(latestFiling)}
            ${getFundraisingSection(latestFiling)}
            ${getOrgDetailsSection(org)}
            ${getFullReportSection(ein)}
        `;

        if (data.filings_with_data?.length > 0) {
            renderFinancialTrendsChart('trendsChart', data.filings_with_data);
        }

    } catch (error) { // This catch now handles other errors, not the fetch error
        console.error('Analysis Error:', error);
        document.getElementById('modalContent').innerHTML = `
            <div class="error-message">
                Unable to load analysis: ${error.message}
                <br><br>
                <a href="https://projects.propublica.org/nonprofits/organizations/${ein}" 
                   target="_blank"
                   class="text-blue-500">
                    View on ProPublica →
                </a>
            </div>
        `;
    }
}

/**
 * Display recent searches
 */
function displayRecentSearches() {
    const recentSearches = getRecentSearches();

    if (recentSearches.length === 0) {
        return '';
    }

    return `
        <div class="recent-searches">
            <div class="recent-searches-label">Recent searches:</div>
            <div class="recent-searches-list">
                ${recentSearches.map(search => `
                    <button class="recent-search-item" data-search="${search}">
                        ${search}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * Show recent searches in the UI
 */
function showRecentSearches() {
    const filtersContainer = document.getElementById('filters');
    if (filtersContainer) {
        filtersContainer.innerHTML = displayRecentSearches();

        // Add click handlers to recent search items
        filtersContainer.querySelectorAll('.recent-search-item').forEach(button => {
            button.addEventListener('click', () => {
                const searchTerm = button.dataset.search;
                searchInput.value = searchTerm;
                handleSearch();
            });
        });
    }
}

/**
 * Handle the search process
 */
/**
 * Show skeleton loading state
 */
function showSkeletonLoader() {
    const skeletons = Array(3).fill(0).map(() => `
        <div class="skeleton-card">
            <div class="skeleton-line long"></div>
            <div class="skeleton-line medium"></div>
            <div class="skeleton-line short"></div>
        </div>
    `).join('');

    return `<div class="skeleton-container">${skeletons}</div>`;
}

async function handleSearch() {
    console.log('Search triggered');
    const searchTerm = searchInput.value.trim();
    console.log('Search term:', searchTerm);
    if (!searchTerm) return;

    try {
        searchButton.disabled = true;
        resultsContainer.innerHTML = showSkeletonLoader();

        const timeoutId = setTimeout(() => {
            console.error('Search timed out');
            resultsContainer.innerHTML = '<div class="error-message">Search timed out. Please try again later.</div>';
            searchButton.disabled = false;
        }, 10000); // Set a 10 second timeout

        const data = await searchNonprofits(searchTerm);
        clearTimeout(timeoutId); // Clear the timeout if successful

        console.log('Search results:', data);

        if (!data || !data.organizations) {
            throw new Error('Invalid response from search');
        }

        // Save to recent searches
        addRecentSearch(searchTerm);
        showRecentSearches();

        displayResults(data);
    } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = `
            <div class="error-message">
                Error: ${error.message}<br>
                Please try again later or visit
                <a href="https://projects.propublica.org/nonprofits/" target="_blank">
                    ProPublica Nonprofit Explorer
                </a> directly.
            </div>
        `;
    } finally {
        searchButton.disabled = false;
    }
}

/**
 * Close the analysis modal
 */
function closeModal() {
    modal.style.display = 'none';
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    searchInput = document.getElementById('searchInput');
    searchButton = document.getElementById('searchButton');
    resultsContainer = document.getElementById('resultsContainer');
    modal = document.getElementById('analysisModal');
    themeToggle = document.getElementById('themeToggle');

    // Apply saved theme on page load
    const currentTheme = getTheme();
    applyTheme(currentTheme);
    updateThemeIcon(currentTheme);

    // Show recent searches and favorites on page load
    showRecentSearches();
    displayFavorites();

    // Theme toggle event
    themeToggle.addEventListener('click', () => {
        const newTheme = toggleTheme();
        updateThemeIcon(newTheme);
    });

    searchButton.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch();
    });

    window.onclick = (event) => {
        if (event.target === modal) closeModal();
    };
});

/**
 * Update theme toggle icon
 */
function updateThemeIcon(theme) {
    const icon = themeToggle.querySelector('.theme-icon');
    if (icon) {
        icon.textContent = getThemeIcon(theme);
        themeToggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
    }
}

// Export functions needed globally
window.handleSearch = handleSearch;
window.showAnalysis = showAnalysis;
window.closeModal = closeModal;