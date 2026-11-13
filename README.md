# ClearLedger — Expense Tracker

A minimalist, responsive personal expense tracker, budget manager, and financial analytics dashboard built exclusively with **HTML5**, **CSS3**, and **Vanilla JavaScript** (using Chart.js and Lucide Icons via CDN, and LocalStorage for persistence).

## Folder Structure

```text
expense-tracker/
├── index.html          # Semantic HTML5 application shell, modals, and CDN bindings
├── css/
│   └── style.css       # Clean minimalist design system, responsive grids, and tables
├── js/
│   ├── app.js          # Application controller, state orchestration, routing, and modals
│   ├── storage.js      # Centralized LocalStorage persistence layer (API-ready boundary)
│   ├── transactions.js # Validation, search/filter/sort logic, CSV export, and ledger table
│   ├── dashboard.js    # Dynamic KPI calculations, overview charts, and recent activity
│   ├── analytics.js    # Category breakdown, income vs. expenses, savings, and distributions
│   └── budget.js       # Monthly budget limit tracking, 80% warnings, and overage alerts
└── assets/
    └── logo.svg        # Minimalist geometric brand mark
```

## Module Overview

- **`js/storage.js`**: Centralizes all `localStorage` read/write operations (`getTransactions`, `addTransaction`, `updateTransaction`, `deleteTransaction`, `getBudgetInfo`, `saveBudgetInfo`). No other module accesses `localStorage`, making future migration to a Node.js/Express/SQL REST API isolated to this single file.
- **`js/transactions.js`**: Contains pure validation (`validateTransactionInput`), filtering/sorting (`filterAndSortTransactions`), CSV generation (`buildCsvContent`), and rendering for the **Transaction History** view.
- **`js/dashboard.js`**: Computes dynamic totals (`Total Balance = Total Income - Total Expenses`), monthly spending, category breakdowns, and renders the **Dashboard** KPIs, Chart.js overview charts, and recent transactions table.
- **`js/analytics.js`**: Computes total savings, savings rate, highest spending category, and category/monthly series to render dynamic **Expense Analytics** charts and tables.
- **`js/budget.js`**: Computes monthly budget utilization percentage, remaining budget, and threshold status (normal `< 80%`, warning `>= 80%`, exceeded `>= 100%`) and renders the **Budget Management** view.
- **`js/app.js`**: Coordinates initialization, view navigation, active month selection, Add/Edit transaction modal, confirmation modal, and toast notifications.

## Running Locally

Because the application uses native ES Modules (`<script type="module">`), serve the directory over HTTP rather than opening `index.html` via `file://`:

### Option 1: Using Python
```bash
python3 -m http.server 3000
```
Open `http://localhost:3000` in your browser.

### Option 2: Using Node.js Static Server
```bash
npx serve . -l 3000
```
Open `http://localhost:3000` in your browser.

### Option 3: Using Vite (Preview Environment)
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.
