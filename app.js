// ========================================
// Configuration
// ========================================
const CONFIG = {
    // Your published Google Sheet CSV URLs for each month
    spreadsheetId: '2PACX-1vReiloobnhgg-6OINcBtuzYsgGIEzmmtw24ThOmHjHTx3Cvo6hiaonmKWANc-NIsDv8ucZDep7xa9ad',
    sheets: [
        { name: 'July', gid: '120024093' },
        { name: 'August', gid: '134100736' },
        { name: 'September', gid: '928188986' },
        { name: 'October', gid: '644857499' },
        { name: 'November', gid: '127691021' },
        { name: 'December', gid: '864812047' },
        { name: 'January 25', gid: '434994324' },
        { name: 'February 25', gid: '962316364' },
        { name: 'March 25', gid: '1488905778' },
        { name: 'April 25', gid: '576193102' },
        { name: 'May 25', gid: '335063292' },
        { name: 'June 25', gid: '397753033' },
        { name: 'July 25', gid: '1005786471' },
        { name: 'August 25', gid: '660618391' },
        { name: 'September 25', gid: '129313601' },
        { name: 'October 25', gid: '1453191209' },
        { name: 'November 25', gid: '1784483707' },
        { name: 'December 25', gid: '1472519060' },
        { name: 'January 26', gid: '745959788' },
        { name: 'February 26', gid: '1888986288' }
    ],
    refreshInterval: 30000 // 30 seconds auto-refresh
};

// ========================================
// State Management
// ========================================
let state = {
    currentSheet: null,
    data: [],
    headers: [],
    isLoading: false,
    lastUpdated: null
};

// ========================================
// DOM Elements
// ========================================
const elements = {
    monthScroll: document.getElementById('monthScroll'),
    tableHeader: document.getElementById('tableHeader'),
    tableBody: document.getElementById('tableBody'),
    loadingOverlay: document.getElementById('loadingOverlay'),
    searchInput: document.getElementById('searchInput'),
    totalMeals: document.getElementById('totalMeals'),
    totalMembers: document.getElementById('totalMembers'),
    totalBazar: document.getElementById('totalBazar'),
    mealRate: document.getElementById('mealRate'),
    membersGrid: document.getElementById('membersGrid'),
    lastUpdated: document.getElementById('lastUpdated'),
    syncIndicator: document.getElementById('syncIndicator'),
    refreshBtn: document.getElementById('refreshBtn')
};

// ========================================
// Initialize App
// ========================================
function init() {
    renderMonthButtons();
    setupEventListeners();

    // Find current month or use latest sheet
    const currentMonthSheet = findCurrentMonthSheet();
    selectSheet(currentMonthSheet);

    // Start auto-refresh
    setInterval(fetchData, CONFIG.refreshInterval);
}

// ========================================
// Find Current Month Sheet
// ========================================
function findCurrentMonthSheet() {
    const now = new Date();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const currentMonth = monthNames[now.getMonth()];
    const year = now.getFullYear().toString().slice(-2); // Get last 2 digits

    // Try to find current month + year
    let sheet = CONFIG.sheets.find(s =>
        s.name.includes(currentMonth) && s.name.includes(year)
    );

    // If not found, try just current month
    if (!sheet) {
        sheet = CONFIG.sheets.find(s => s.name.includes(currentMonth));
    }

    // Default to last sheet (most recent)
    return sheet || CONFIG.sheets[CONFIG.sheets.length - 1];
}

// ========================================
// Render Month Buttons
// ========================================
function renderMonthButtons() {
    elements.monthScroll.innerHTML = CONFIG.sheets.map(sheet => `
        <button class="month-btn" data-gid="${sheet.gid}" data-name="${sheet.name}">
            ${sheet.name}
        </button>
    `).join('');
}

// ========================================
// Setup Event Listeners
// ========================================
function setupEventListeners() {
    // Month button clicks
    elements.monthScroll.addEventListener('click', (e) => {
        if (e.target.classList.contains('month-btn')) {
            const gid = e.target.dataset.gid;
            const name = e.target.dataset.name;
            const sheet = CONFIG.sheets.find(s => s.gid === gid);
            if (sheet) {
                selectSheet(sheet);
            }
        }
    });

    // Search input
    elements.searchInput.addEventListener('input', debounce(filterTable, 300));
}

// ========================================
// Select Sheet
// ========================================
function selectSheet(sheet) {
    state.currentSheet = sheet;

    // Update active button
    document.querySelectorAll('.month-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gid === sheet.gid);
    });

    // Scroll active button into view
    const activeBtn = document.querySelector('.month-btn.active');
    if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }

    // Fetch data
    fetchData();
}

// ========================================
// Fetch Data from Google Sheets
// ========================================
async function fetchData() {
    if (state.isLoading || !state.currentSheet) return;

    state.isLoading = true;
    showLoading(true);
    elements.refreshBtn.classList.add('spinning');

    try {
        const url = `https://docs.google.com/spreadsheets/d/e/${CONFIG.spreadsheetId}/pub?gid=${state.currentSheet.gid}&single=true&output=csv`;

        // Add cache-busting parameter
        const response = await fetch(`${url}&_=${Date.now()}`);

        if (!response.ok) {
            throw new Error('Failed to fetch data');
        }

        const csvText = await response.text();
        const { headers, data } = parseCSV(csvText);

        state.headers = headers;
        state.data = data;
        state.lastUpdated = new Date();

        renderTable();
        updateStats();
        renderMemberDashboards();
        updateLastUpdated();

    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Failed to load data. Please check your internet connection.');
    } finally {
        state.isLoading = false;
        showLoading(false);
        elements.refreshBtn.classList.remove('spinning');
    }
}

// ========================================
// Parse CSV
// ========================================
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');

    if (lines.length === 0) {
        return { headers: [], data: [] };
    }

    // Parse headers
    const headers = parseCSVLine(lines[0]);

    // Parse data rows
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.some(v => v.trim())) { // Skip empty rows
            data.push(values);
        }
    }

    return { headers, data };
}

// ========================================
// Parse CSV Line (handles quoted values)
// ========================================
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// ========================================
// Render Table
// ========================================
function renderTable() {
    // Render headers
    elements.tableHeader.innerHTML = state.headers.map((header, index) => `
        <th>${escapeHtml(header) || `Column ${index + 1}`}</th>
    `).join('');

    // Render body
    renderTableBody(state.data);
}

// ========================================
// Render Table Body
// ========================================
function renderTableBody(data) {
    if (data.length === 0) {
        elements.tableBody.innerHTML = `
            <tr>
                <td colspan="${state.headers.length}" class="no-data">
                    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 17H15M9 13H15M9 9H10M13 3H8.2C7.0799 3 6.51984 3 6.09202 3.21799C5.71569 3.40973 5.40973 3.71569 5.21799 4.09202C5 4.51984 5 5.0799 5 6.2V17.8C5 18.9201 5 19.4802 5.21799 19.908C5.40973 20.2843 5.71569 20.5903 6.09202 20.782C6.51984 21 7.0799 21 8.2 21H15.8C16.9201 21 17.4802 21 17.908 20.782C18.2843 20.5903 18.5903 20.2843 18.782 19.908C19 19.4802 19 18.9201 19 17.8V9M13 3L19 9M13 3V7.4C13 7.96005 13 8.24008 13.109 8.45399C13.2049 8.64215 13.3578 8.79513 13.546 8.89101C13.7599 9 14.0399 9 14.6 9H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <p>No data available for this month</p>
                </td>
            </tr>
        `;
        return;
    }

    elements.tableBody.innerHTML = data.map(row => `
        <tr>
            ${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}
        </tr>
    `).join('');
}

// ========================================
// Filter Table
// ========================================
function filterTable() {
    const searchTerm = elements.searchInput.value.toLowerCase().trim();

    if (!searchTerm) {
        renderTableBody(state.data);
        return;
    }

    const filteredData = state.data.filter(row =>
        row.some(cell => cell.toLowerCase().includes(searchTerm))
    );

    renderTableBody(filteredData);
}

// ========================================
// Update Stats
// ========================================
function updateStats() {
    const dataRows = state.data;

    // Members are in rows 2-7 (index 0-5 in data array since header is row 1)
    const memberRows = dataRows.slice(0, 6).filter(row => row[0] && row[0].trim());
    const members = memberRows.length;

    // Get Total Meal from cell AG8 (row 8 = index 6, column AG = index 32)
    // AG is the 33rd column (0-indexed = 32)
    let totalMeals = 0;
    if (dataRows.length >= 7 && dataRows[6]) {
        const totalCell = dataRows[6][32]; // AG8
        const num = parseFloat(totalCell);
        if (!isNaN(num)) {
            totalMeals = num;
        }
    }

    // Get Total Bazar from cell AG9 (row 9 = index 7, column AG = index 32)
    let totalBazar = 0;
    if (dataRows.length >= 8 && dataRows[7]) {
        const bazarCell = dataRows[7][32]; // AG9
        const num = parseFloat(bazarCell);
        if (!isNaN(num)) {
            totalBazar = num;
        }
    }

    // Get Meal Rate from cell AG10 (row 10 = index 8, column AG = index 32)
    let mealRate = 0;
    if (dataRows.length >= 9 && dataRows[8]) {
        const rateCell = dataRows[8][32]; // AG10
        const num = parseFloat(rateCell);
        if (!isNaN(num)) {
            mealRate = num;
        }
    }

    // Update display with animation
    animateNumber(elements.totalMembers, members);
    animateNumber(elements.totalMeals, totalMeals);
    animateNumber(elements.totalBazar, totalBazar);
    elements.mealRate.textContent = mealRate.toFixed(2);
}

// ========================================
// Render Member Dashboards
// ========================================
function renderMemberDashboards() {
    const dataRows = state.data;
    const headers = state.headers;

    // Members are in rows 2-7 (index 0-5 in data array)
    const memberRows = dataRows.slice(0, 6);

    // Get meal rate for calculation
    let mealRate = 0;
    if (dataRows.length >= 9 && dataRows[8]) {
        const rateCell = dataRows[8][32];
        const num = parseFloat(rateCell);
        if (!isNaN(num)) {
            mealRate = num;
        }
    }

    // Define gradient colors for each member
    const gradients = [
        'linear-gradient(135deg, #6366f1, #8b5cf6)',
        'linear-gradient(135deg, #ec4899, #f43f5e)',
        'linear-gradient(135deg, #06b6d4, #0891b2)',
        'linear-gradient(135deg, #10b981, #059669)',
        'linear-gradient(135deg, #f59e0b, #d97706)',
        'linear-gradient(135deg, #8b5cf6, #7c3aed)'
    ];

    const memberCards = memberRows.map((row, index) => {
        const name = row[0] || `Member ${index + 1}`;
        const initial = name.charAt(0).toUpperCase();

        // Get Total Meal from column AG (index 32) for this member
        const totalMeal = parseFloat(row[32]) || 0;

        // Get Maid Bill from column AH (index 33)
        const maidBill = parseFloat(row[33]) || 0;

        // Get Extra Expenses from column AI (index 34)
        const extraExpenses = parseFloat(row[34]) || 0;

        // Get Deposit from column AG rows 20-25 (index 32, rows 18-23 in data array)
        const depositRowIndex = 18 + index;
        const deposit = (dataRows.length > depositRowIndex && dataRows[depositRowIndex])
            ? parseFloat(dataRows[depositRowIndex][32]) || 0
            : 0;

        // Get Due from column AI rows 20-25 (index 34, rows 18-23 in data array)
        const due = (dataRows.length > depositRowIndex && dataRows[depositRowIndex])
            ? parseFloat(dataRows[depositRowIndex][34]) || 0
            : 0;

        // Calculate member's bazar cost
        const memberBazar = (totalMeal * mealRate);

        // Calculate Total Cost = Bazar Cost + Maid Bill + Extra Expenses
        const totalCost = memberBazar + maidBill + extraExpenses;

        return `
            <div class="member-card" style="--card-gradient: ${gradients[index % gradients.length]}">
                <div class="member-header">
                    <div class="member-avatar" style="background: ${gradients[index % gradients.length]}">${initial}</div>
                    <div class="member-name">${escapeHtml(name)}</div>
                </div>
                <div class="member-stats">
                    <div class="member-stat">
                        <span class="member-stat-label">Total Meal</span>
                        <span class="member-stat-value">${totalMeal}</span>
                    </div>
                    <div class="member-stat">
                        <span class="member-stat-label">Bazar Cost</span>
                        <span class="member-stat-value">৳${Math.round(memberBazar)}</span>
                    </div>
                    <div class="member-stat">
                        <span class="member-stat-label">Maid Bill</span>
                        <span class="member-stat-value">৳${maidBill}</span>
                    </div>
                    <div class="member-stat">
                        <span class="member-stat-label">Extra Expenses</span>
                        <span class="member-stat-value">৳${extraExpenses}</span>
                    </div>
                    <div class="member-stat">
                        <span class="member-stat-label">Total Cost</span>
                        <span class="member-stat-value">৳${Math.round(totalCost)}</span>
                    </div>
                    <div class="member-stat">
                        <span class="member-stat-label">Deposit</span>
                        <span class="member-stat-value">৳${deposit}</span>
                    </div>
                    <div class="member-stat highlight">
                        <span class="member-stat-label">Due</span>
                        <span class="member-stat-value">৳${due}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    elements.membersGrid.innerHTML = memberCards;
}

// ========================================
// Animate Number
// ========================================
function animateNumber(element, targetValue) {
    const duration = 500;
    const startValue = parseInt(element.textContent) || 0;
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const currentValue = Math.round(startValue + (targetValue - startValue) * easeOut);

        element.textContent = currentValue;

        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }

    requestAnimationFrame(update);
}

// ========================================
// Update Last Updated Time
// ========================================
function updateLastUpdated() {
    if (state.lastUpdated) {
        const time = state.lastUpdated.toLocaleTimeString();
        elements.lastUpdated.textContent = `Last updated: ${time}`;
    }
}

// ========================================
// Show Loading
// ========================================
function showLoading(show) {
    elements.loadingOverlay.classList.toggle('hidden', !show);
}

// ========================================
// Show Error
// ========================================
function showError(message) {
    elements.tableBody.innerHTML = `
        <tr>
            <td colspan="${state.headers.length || 5}" class="no-data">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <p>${message}</p>
            </td>
        </tr>
    `;
}

// ========================================
// Utility: Escape HTML
// ========================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ========================================
// Utility: Debounce
// ========================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========================================
// Initialize on DOM Load
// ========================================
document.addEventListener('DOMContentLoaded', init);
