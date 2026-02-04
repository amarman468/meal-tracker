// ========================================
// Configuration
// ========================================
const CONFIG = {
    // Meal spreadsheet (using sheet names instead of GIDs)
    mealSpreadsheetId: '1jExZaOhBUOKdWfsKlCCPqVeF0ArmTw528-LceOzv1uw',
    sheets: [
        { name: 'July' },
        { name: 'August' },
        { name: 'September' },
        { name: 'October' },
        { name: 'November' },
        { name: 'December' },
        { name: 'January 25' },
        { name: 'February 25' },
        { name: 'March 25' },
        { name: 'April 25' },
        { name: 'May 25' },
        { name: 'June 25' },
        { name: 'July 25' },
        { name: 'August 25' },
        { name: 'September 25' },
        { name: 'October 25' },
        { name: 'November 25' },
        { name: 'December 25' },
        { name: 'January 26' },
        { name: 'February 26' },
        { name: 'March 26' },
        { name: 'April 26' },
        { name: 'May 26' }
    ],
    // Rent spreadsheet configuration
    rentSpreadsheetId: '1i15D1p3b-WgGrvkS9fLb9LeaE3hUvWGPewHYN6VoD8A',
    // Month order for calculating "next month" rent sheet
    monthOrder: ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'],
    // Mapping: member index -> row number in rent sheet (1-indexed, D column)
    memberSecondaryRows: {
        0: 4,  // ফিরোজ কাকা -> D4
        1: 3,  // আতিক ভাই -> D3
        2: 2,  // আকিব ভাই -> D2
        3: 8,  // আরমান -> D8
        4: 7,  // ফারহান ভাই -> D7
        5: 6   // মুন্না ভাই -> D6
    },
    refreshInterval: 30000 // 30 seconds auto-refresh
};

// ========================================
// State Management
// ========================================
let state = {
    currentSheet: null,
    data: [],
    headers: [],
    secondaryData: [], // Data from 2nd sheet
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
    checkAuthState();

    // Find current month or use latest sheet
    const currentMonthSheet = findCurrentMonthSheet();
    selectSheet(currentMonthSheet);

    // Start auto-refresh
    setInterval(fetchData, CONFIG.refreshInterval);
}

// ========================================
// Authentication State Management
// ========================================
function checkAuthState() {
    const savedMember = localStorage.getItem('currentMember');
    const userProfile = document.getElementById('userProfile');
    const signinLink = document.getElementById('signinLink');
    const userAvatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (savedMember) {
        try {
            const member = JSON.parse(savedMember);
            userProfile.style.display = 'flex';
            signinLink.style.display = 'none';
            userAvatar.textContent = member.name.charAt(0).toUpperCase();
            userName.textContent = member.name;
        } catch (e) {
            localStorage.removeItem('currentMember');
        }
    } else {
        userProfile.style.display = 'none';
        signinLink.style.display = 'flex';
    }
}

function signOut() {
    localStorage.removeItem('currentMember');
    window.location.href = 'signup.html';
}

function getCurrentMember() {
    const savedMember = localStorage.getItem('currentMember');
    if (savedMember) {
        try {
            return JSON.parse(savedMember);
        } catch (e) {
            return null;
        }
    }
    return null;
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
        // Use export format which handles CORS better
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.mealSpreadsheetId}/export?format=csv&sheet=${encodeURIComponent(state.currentSheet.name)}`;

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

        // Fetch secondary sheet data
        await fetchSecondarySheetData();

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
// Fetch Secondary Sheet Data
// ========================================
async function fetchSecondarySheetData() {
    try {
        // Get current sheet name and calculate next month's rent sheet
        const currentSheetName = state.currentSheet ? state.currentSheet.name : null;
        if (!currentSheetName) {
            state.secondaryData = [];
            return;
        }

        // Calculate next month's sheet name
        const nextMonthSheetName = getNextMonthSheetName(currentSheetName);
        if (!nextMonthSheetName) {
            console.warn('Could not calculate next month for:', currentSheetName);
            state.secondaryData = [];
            return;
        }

        // Use the rent spreadsheet with sheet name parameter
        const url = `https://docs.google.com/spreadsheets/d/${CONFIG.rentSpreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nextMonthSheetName)}`;

        const response = await fetch(`${url}&_=${Date.now()}`);

        if (!response.ok) {
            console.warn('Failed to fetch rent data for:', nextMonthSheetName);
            state.secondaryData = [];
            return;
        }

        const csvText = await response.text();
        const { data } = parseCSV(csvText);
        state.secondaryData = data;

    } catch (error) {
        console.warn('Error fetching secondary sheet data:', error);
        state.secondaryData = [];
    }
}

// ========================================
// Get Next Month Sheet Name
// ========================================
function getNextMonthSheetName(currentSheetName) {
    // Extract month and year from sheet name (e.g., "February 26" -> February, 26)
    const parts = currentSheetName.split(' ');
    const monthName = parts[0];
    const year = parts[1] || '';

    // Find current month index
    const currentIndex = CONFIG.monthOrder.indexOf(monthName);
    if (currentIndex === -1) return null;

    // Calculate next month
    const nextIndex = (currentIndex + 1) % 12;
    const nextMonth = CONFIG.monthOrder[nextIndex];

    // Handle year rollover (December -> January means year +1)
    let nextYear = year;
    if (currentIndex === 11 && year) { // December
        nextYear = (parseInt(year) + 1).toString();
    }

    return nextYear ? `${nextMonth} ${nextYear}` : nextMonth;
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

    // Calculate Meal Rate manually for precision: Total Bazar / Total Meals
    let mealRate = 0;
    if (totalMeals > 0) {
        mealRate = totalBazar / totalMeals;
    } else if (dataRows.length >= 9 && dataRows[8]) {
        // Fallback to reading from cell AG10 if totalMeals is 0
        const rateCell = dataRows[8][32];
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
    let memberRows = dataRows.slice(0, 6);

    // Check if current user is admin (আরমান = index 3)
    const currentMember = getCurrentMember();
    const isAdmin = currentMember && currentMember.index === 3; // আরমান is admin

    // If not admin  and logged in, only show their own card
    if (currentMember && !isAdmin) {
        memberRows = memberRows.filter((row, index) => index === currentMember.index);
    }

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

    // Store original indices for non-admin view
    const memberIndices = currentMember && !isAdmin
        ? [currentMember.index]
        : [0, 1, 2, 3, 4, 5];

    const memberCards = memberRows.map((row, mapIndex) => {
        const index = memberIndices[mapIndex]; // Use original index for data lookup
        const name = row[0] || `Member ${index + 1}`;
        const initial = name.charAt(0).toUpperCase();

        // Get Total Meal from column AG (index 32) for this member
        const totalMeal = parseFloat(row[32]) || 0;

        // Get Maid Bill from column AH (index 33)
        const maidBill = parseFloat(row[33]) || 0;

        // Get Extra Expenses from column AI (index 34)
        const extraExpenses = parseFloat(row[34]) || 0;

        // Get base Deposit from column AG rows 20-25 (Row 18-23 in data)
        const depositRowIndex = 18 + index;
        const baseDeposit = (dataRows.length > depositRowIndex && dataRows[depositRowIndex])
            ? parseFloat(dataRows[depositRowIndex][32]) || 0
            : 0;

        // Get Maid Bill Paid from column AH rows 12-17 (Row 10-15 in data, Col Index 33)
        const paymentRowIndex = 10 + index;
        const maidPaid = (dataRows.length > paymentRowIndex && dataRows[paymentRowIndex])
            ? parseFloat(dataRows[paymentRowIndex][33]) || 0
            : 0;

        // Get Extra Expenses Paid from column AI rows 12-17 (Row 10-15 in data, Col Index 34)
        const extraPaid = (dataRows.length > paymentRowIndex && dataRows[paymentRowIndex])
            ? parseFloat(dataRows[paymentRowIndex][34]) || 0
            : 0;

        // Calculate Total Deposit = Base Deposit + Maid Paid + Extra Paid
        const deposit = baseDeposit + maidPaid + extraPaid;

        // Get Due from column AI rows 20-25 (index 34, rows 18-23 in data array)
        const due = (dataRows.length > depositRowIndex && dataRows[depositRowIndex])
            ? parseFloat(dataRows[depositRowIndex][34]) || 0
            : 0;

        // Get Bazar Cost from column AG rows 12-17 (index 32, rows 10-15 in data array)
        // Row 12 in sheet = index 10 in data array (since header is index 0 is not in data array effectively or if it is?)
        // Actually dataRows excludes header usually? Let's assume standard behavior. 
        // Header is row 1. Data starts row 2 (index 0). 
        // Row 12 is index 10.
        const bazarRowIndex = 10 + index;
        const memberBazar = (dataRows.length > bazarRowIndex && dataRows[bazarRowIndex])
            ? parseFloat(dataRows[bazarRowIndex][32]) || 0
            : 0;

        // Calculate Total Cost = Bazar Cost + Maid Bill + Extra Expenses
        const totalCost = memberBazar + maidBill + extraExpenses;

        // Check if this is the current logged-in user
        const currentMember = getCurrentMember();
        const isCurrentUser = currentMember && currentMember.index === index;

        return `
            <div class="member-card${isCurrentUser ? ' current-user' : ''}" style="--card-gradient: ${gradients[index % gradients.length]}">
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
                        <span class="member-stat-label">Meal Cost</span>
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
                    <div class="member-stat">
                        <span class="member-stat-label">Due</span>
                        <span class="member-stat-value">৳${due}</span>
                    </div>
                    <div class="member-stat secondary-data">
                        <span class="member-stat-label">House Rent Due</span>
                        <span class="member-stat-value">৳${getSecondarySheetValue(index)}</span>
                    </div>
                    <div class="member-stat highlight">
                        <span class="member-stat-label">Total Due</span>
                        <span class="member-stat-value">৳${due + getSecondarySheetValue(index)}</span>
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
// Get Secondary Sheet Value for Member
// ========================================
function getSecondarySheetValue(memberIndex) {
    // Get the row number from the mapping (1-indexed)
    const rowNum = CONFIG.memberSecondaryRows[memberIndex];
    if (!rowNum) return 0;

    // Convert to array index (row 2 = index 0 in data array since row 1 is header)
    const dataIndex = rowNum - 2;

    // Column F = index 5 (0-indexed: A=0, B=1, C=2, D=3, E=4, F=5)
    if (state.secondaryData && state.secondaryData.length > dataIndex && state.secondaryData[dataIndex]) {
        const value = parseFloat(state.secondaryData[dataIndex][5]) || 0;
        return Math.round(value);
    }

    return 0;
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
