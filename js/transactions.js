/**
 * transactions.js
 * Pure transaction validation, filtering, sorting, formatting,
 * and Transaction History UI rendering.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Shopping',
  'Healthcare',
  'Entertainment',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Gift',
  'Refund',
  'Other Income',
];

export const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats a numeric value as USD currency.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return '$0.00';
  return currencyFormatter.format(num);
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats YYYY-MM-DD into a concise readable date (e.g. Nov 13, 2026).
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDateDisplay(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '—';
  const [year, month, day] = isoDate.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Formats YYYY-MM into Month Year (e.g. November 2026).
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const dateObj = new Date(year, month - 1, 1);
  return dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Formats YYYY-MM into short label (e.g. Nov '26).
 * @param {string} monthKey
 * @returns {string}
 */
export function formatShortMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [year, month] = monthKey.split('-').map(Number);
  const dateObj = new Date(year, month - 1, 1);
  const monthText = dateObj.toLocaleDateString('en-US', { month: 'short' });
  return `${monthText} '${String(year).slice(-2)}`;
}

/**
 * Returns the category list corresponding to a transaction type.
 * @param {'income'|'expense'} type
 * @returns {string[]}
 */
export function getCategoriesForType(type) {
  return type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/**
 * Validates transaction form inputs.
 * @param {object} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTransactionInput(input) {
  const errors = {};

  const title = String(input.title || '').trim();
  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length < 2) {
    errors.title = 'Title must be at least 2 characters.';
  } else if (title.length > 80) {
    errors.title = 'Title cannot exceed 80 characters.';
  }

  const amountNum = Number(input.amount);
  if (input.amount === '' || input.amount === null || input.amount === undefined) {
    errors.amount = 'Please enter an amount.';
  } else if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.amount = 'Amount must be greater than $0.00.';
  } else if (amountNum > 100000000) {
    errors.amount = 'Amount exceeds maximum allowed value.';
  }

  const validType = input.type === 'income' || input.type === 'expense';
  const allowedCategories = validType ? getCategoriesForType(input.type) : ALL_CATEGORIES;
  const category = String(input.category || '').trim();
  if (!category) {
    errors.category = 'Please select a category.';
  } else if (!allowedCategories.includes(category)) {
    errors.category = 'Selected category does not match transaction type.';
  }

  const date = String(input.date || '').trim();
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  } else {
    const [y, m, d] = date.split('-').map(Number);
    const checkDate = new Date(y, m - 1, d);
    if (
      checkDate.getFullYear() !== y ||
      checkDate.getMonth() !== m - 1 ||
      checkDate.getDate() !== d
    ) {
      errors.date = 'Invalid calendar date.';
    }
  }

  const description = String(input.description || '').trim();
  if (description.length > 240) {
    errors.description = 'Description cannot exceed 240 characters.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Pure filtering and sorting of transactions.
 * @param {Array<object>} transactions
 * @param {object} filters
 * @returns {Array<object>}
 */
export function filterAndSortTransactions(transactions, filters) {
  const search = String(filters.search || '').trim().toLowerCase();
  const type = filters.type || 'all';
  const category = filters.category || 'all';
  const month = filters.month || 'all';
  const sort = filters.sort || 'date-desc';

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month !== 'all' && (!tx.date || !tx.date.startsWith(month))) return false;
    if (search) {
      const haystack = `${tx.title} ${tx.description} ${tx.category}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (sort === 'date-asc') {
      const dateCmp = a.date.localeCompare(b.date);
      return dateCmp !== 0 ? dateCmp : a.id.localeCompare(b.id);
    }
    if (sort === 'amount-desc') {
      return b.amount - a.amount || b.date.localeCompare(a.date);
    }
    if (sort === 'amount-asc') {
      return a.amount - b.amount || b.date.localeCompare(a.date);
    }
    // Default: date-desc
    const dateCmp = b.date.localeCompare(a.date);
    return dateCmp !== 0 ? dateCmp : b.id.localeCompare(a.id);
  });
}

/**
 * Computes totals for a filtered list of transactions.
 * @param {Array<object>} transactions
 */
export function computeFilteredSummary(transactions) {
  let totalIncome = 0;
  let totalExpenses = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
    }
  }

  return {
    count: transactions.length,
    totalIncome,
    totalExpenses,
    net: totalIncome - totalExpenses,
  };
}

/**
 * Generates CSV content for transactions export.
 * @param {Array<object>} transactions
 * @returns {string}
 */
export function buildCsvContent(transactions) {
  const headers = ['ID', 'Date', 'Type', 'Category', 'Title', 'Amount', 'Description'];
  const escapeCsvCell = (val) => {
    const str = String(val ?? '');
    if (/[",\n\r]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((tx) =>
      [
        tx.id,
        tx.date,
        tx.type,
        tx.category,
        tx.title,
        tx.amount.toFixed(2),
        tx.description,
      ]
        .map(escapeCsvCell)
        .join(',')
    );

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Renders the Transaction History view shell (preserving search input focus on updates).
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} callbacks
 */
export function renderTransactionsView(container, state, callbacks) {
  const { transactions, filters, availableMonths } = state;

  // Render static toolbar shell once if not already mounted
  if (!container.querySelector('#tx-history-card')) {
    container.innerHTML = `
      <div id="tx-history-card" class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">All Transactions</h2>
            <p class="card-subtitle">Search, filter, edit, or remove recorded income and expense entries.</p>
          </div>
          <button type="button" id="tx-view-add-btn" class="btn-secondary btn-sm">
            <i data-lucide="plus"></i>
            <span>New Entry</span>
          </button>
        </div>

        <div class="toolbar-row">
          <div class="filter-controls">
            <div class="search-field">
              <i data-lucide="search"></i>
              <input
                type="search"
                id="tx-filter-search"
                class="input-control search-input"
                placeholder="Search title, category, or notes..."
                aria-label="Search transactions"
              />
            </div>

            <select id="tx-filter-type" class="select-control" aria-label="Filter by type" style="width: auto; min-width: 132px;">
              <option value="all">All Types</option>
              <option value="expense">Expenses</option>
              <option value="income">Income</option>
            </select>

            <select id="tx-filter-category" class="select-control" aria-label="Filter by category" style="width: auto; min-width: 150px;"></select>

            <select id="tx-filter-month" class="select-control" aria-label="Filter by month" style="width: auto; min-width: 155px;"></select>

            <select id="tx-filter-sort" class="select-control" aria-label="Sort transactions" style="width: auto; min-width: 155px;">
              <option value="date-desc">Date: Newest First</option>
              <option value="date-asc">Date: Oldest First</option>
              <option value="amount-desc">Amount: High to Low</option>
              <option value="amount-asc">Amount: Low to High</option>
            </select>
          </div>

          <button type="button" id="tx-reset-filters-btn" class="btn-ghost btn-sm" hidden>
            <i data-lucide="x"></i>
            <span>Clear Filters</span>
          </button>
        </div>

        <div id="tx-filter-summary" class="filter-summary-bar"></div>
        <div id="tx-table-region"></div>
      </div>
    `;

    // Attach event listeners once to toolbar controls
    const searchInput = container.querySelector('#tx-filter-search');
    const typeSelect = container.querySelector('#tx-filter-type');
    const categorySelect = container.querySelector('#tx-filter-category');
    const monthSelect = container.querySelector('#tx-filter-month');
    const sortSelect = container.querySelector('#tx-filter-sort');
    const resetBtn = container.querySelector('#tx-reset-filters-btn');
    const addBtn = container.querySelector('#tx-view-add-btn');

    searchInput.addEventListener('input', (e) => {
      callbacks.onFilterChange({ search: e.target.value });
    });
    typeSelect.addEventListener('change', (e) => {
      callbacks.onFilterChange({ type: e.target.value });
    });
    categorySelect.addEventListener('change', (e) => {
      callbacks.onFilterChange({ category: e.target.value });
    });
    monthSelect.addEventListener('change', (e) => {
      callbacks.onFilterChange({ month: e.target.value });
    });
    sortSelect.addEventListener('change', (e) => {
      callbacks.onFilterChange({ sort: e.target.value });
    });
    resetBtn.addEventListener('click', () => {
      callbacks.onResetFilters();
    });
    addBtn.addEventListener('click', () => {
      callbacks.onAddClick();
    });

    // Delegate Edit / Delete clicks inside table region
    container.querySelector('#tx-table-region').addEventListener('click', (e) => {
      const editBtn = e.target.closest('[data-edit-id]');
      if (editBtn) {
        callbacks.onEditClick(editBtn.getAttribute('data-edit-id'));
        return;
      }
      const deleteBtn = e.target.closest('[data-delete-id]');
      if (deleteBtn) {
        callbacks.onDeleteClick(deleteBtn.getAttribute('data-delete-id'));
        return;
      }
      const sortBtn = e.target.closest('[data-sort-toggle]');
      if (sortBtn) {
        const currentSort = container.querySelector('#tx-filter-sort').value;
        const nextSort = currentSort === 'date-desc' ? 'date-asc' : 'date-desc';
        callbacks.onFilterChange({ sort: nextSort });
        return;
      }
      const emptyAction = e.target.closest('[data-empty-action]');
      if (emptyAction) {
        const action = emptyAction.getAttribute('data-empty-action');
        if (action === 'reset') callbacks.onResetFilters();
        if (action === 'add') callbacks.onAddClick();
      }
    });
  }

  // Sync filter control values without disrupting active search input
  const searchEl = container.querySelector('#tx-filter-search');
  if (searchEl.value !== filters.search) {
    searchEl.value = filters.search;
  }

  container.querySelector('#tx-filter-type').value = filters.type;
  container.querySelector('#tx-filter-sort').value = filters.sort;

  // Populate category options dynamically
  const categorySelect = container.querySelector('#tx-filter-category');
  const categoryPool =
    filters.type === 'income'
      ? INCOME_CATEGORIES
      : filters.type === 'expense'
      ? EXPENSE_CATEGORIES
      : ALL_CATEGORIES;

  categorySelect.innerHTML = [
    '<option value="all">All Categories</option>',
    ...categoryPool.map(
      (cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    ),
  ].join('');
  categorySelect.value = categoryPool.includes(filters.category) ? filters.category : 'all';

  // Populate month filter options
  const monthSelect = container.querySelector('#tx-filter-month');
  monthSelect.innerHTML = [
    '<option value="all">All Months</option>',
    ...availableMonths.map(
      (m) => `<option value="${escapeHtml(m)}">${escapeHtml(formatMonthLabel(m))}</option>`
    ),
  ].join('');
  monthSelect.value =
    filters.month === 'all' || availableMonths.includes(filters.month) ? filters.month : 'all';

  const hasActiveFilters =
    filters.search.trim() !== '' ||
    filters.type !== 'all' ||
    filters.category !== 'all' ||
    filters.month !== 'all' ||
    filters.sort !== 'date-desc';

  container.querySelector('#tx-reset-filters-btn').hidden = !hasActiveFilters;

  // Compute filtered list and summary
  const filtered = filterAndSortTransactions(transactions, filters);
  const summary = computeFilteredSummary(filtered);

  const summaryBar = container.querySelector('#tx-filter-summary');
  summaryBar.innerHTML = `
    <span>Showing <strong>${summary.count}</strong> ${summary.count === 1 ? 'transaction' : 'transactions'}</span>
    <div class="filter-summary-metrics">
      <span>Income: <strong class="mono-cell text-positive">${formatCurrency(summary.totalIncome)}</strong></span>
      <span class="summary-dot-sep" aria-hidden="true">·</span>
      <span>Expenses: <strong class="mono-cell">${formatCurrency(summary.totalExpenses)}</strong></span>
      <span class="summary-dot-sep" aria-hidden="true">·</span>
      <span>Net: <strong class="mono-cell ${summary.net >= 0 ? 'text-positive' : 'text-negative'}">${
        summary.net >= 0 ? '+' : '-'
      }${formatCurrency(Math.abs(summary.net))}</strong></span>
    </div>
  `;

  const tableRegion = container.querySelector('#tx-table-region');

  if (transactions.length === 0) {
    tableRegion.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="receipt"></i></div>
        <h3 class="empty-state-title">No transactions recorded yet</h3>
        <p class="empty-state-text">Add your first income or expense entry to populate your ledger and financial analytics.</p>
        <button type="button" class="btn-primary btn-sm" data-empty-action="add">
          <i data-lucide="plus"></i>
          <span>Add First Transaction</span>
        </button>
      </div>
    `;
    return;
  }

  if (filtered.length === 0) {
    tableRegion.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="filter-x"></i></div>
        <h3 class="empty-state-title">No matching transactions</h3>
        <p class="empty-state-text">Try adjusting your search keywords, category, or month filters.</p>
        <button type="button" class="btn-secondary btn-sm" data-empty-action="reset">
          <span>Reset All Filters</span>
        </button>
      </div>
    `;
    return;
  }

  const dateSortIcon = filters.sort === 'date-asc' ? 'arrow-up' : 'arrow-down';

  tableRegion.innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Transaction</th>
            <th>Category</th>
            <th>Type</th>
            <th>
              <button type="button" class="sort-header-btn" data-sort-toggle="date">
                <span>Date</span>
                <i data-lucide="${dateSortIcon}" style="width:13px;height:13px;"></i>
              </button>
            </th>
            <th class="align-right">Amount</th>
            <th class="align-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${filtered
            .map((tx) => {
              const isIncome = tx.type === 'income';
              const sign = isIncome ? '+' : '-';
              return `
                <tr>
                  <td>
                    <div class="tx-title-cell">
                      <span class="tx-title">${escapeHtml(tx.title)}</span>
                      ${
                        tx.description
                          ? `<span class="tx-description" title="${escapeHtml(tx.description)}">${escapeHtml(
                              tx.description
                            )}</span>`
                          : ''
                      }
                    </div>
                  </td>
                  <td>${escapeHtml(tx.category)}</td>
                  <td class="${isIncome ? 'text-positive' : 'text-secondary'}">${
                    isIncome ? 'Income' : 'Expense'
                  }</td>
                  <td class="mono-cell">${escapeHtml(formatDateDisplay(tx.date))}</td>
                  <td class="align-right mono-cell ${isIncome ? 'amount-income' : 'amount-expense'}">
                    ${sign}${formatCurrency(tx.amount)}
                  </td>
                  <td class="align-right">
                    <div class="table-actions">
                      <button
                        type="button"
                        class="icon-btn"
                        data-edit-id="${escapeHtml(tx.id)}"
                        aria-label="Edit ${escapeHtml(tx.title)}"
                        title="Edit transaction"
                      >
                        <i data-lucide="pencil"></i>
                      </button>
                      <button
                        type="button"
                        class="icon-btn icon-btn-danger"
                        data-delete-id="${escapeHtml(tx.id)}"
                        aria-label="Delete ${escapeHtml(tx.title)}"
                        title="Delete transaction"
                      >
                        <i data-lucide="trash-2"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            })
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}
