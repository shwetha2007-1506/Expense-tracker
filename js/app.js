/**
 * app.js
 * Main application controller, state orchestration, modal management, and view routing.
 */

import * as storage from './storage.js';
import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  getCategoriesForType,
  validateTransactionInput,
  buildCsvContent,
  renderTransactionsView,
} from './transactions.js';
import { renderDashboardView } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import { renderBudgetView } from './budget.js';

const VIEW_TITLES = {
  dashboard: 'Dashboard',
  transactions: 'Transactions',
  analytics: 'Analytics',
  budget: 'Budget',
};

/**
 * Returns today's date in YYYY-MM-DD using local browser time.
 */
function getTodayIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Returns the current month in YYYY-MM.
 */
function getCurrentMonthKey() {
  return getTodayIsoDate().slice(0, 7);
}

/**
 * Generates the trailing N months ending at anchorMonth (YYYY-MM) in ascending chronological order.
 * @param {string} anchorMonth
 * @param {number} count
 */
function getTrailingMonths(anchorMonth, count = 6) {
  const [yStr, mStr] = anchorMonth.split('-');
  const anchorYear = Number(yStr);
  const anchorMonthIdx = Number(mStr) - 1;
  const result = [];

  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(anchorYear, anchorMonthIdx - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    result.push(key);
  }
  return result;
}

/**
 * Collects all distinct YYYY-MM months present in transactions plus trailing 6 months, sorted descending.
 */
function computeAvailableMonths(transactions, selectedMonth) {
  const set = new Set(getTrailingMonths(getCurrentMonthKey(), 6));
  set.add(selectedMonth);
  for (const tx of transactions) {
    if (tx.date && /^\d{4}-\d{2}/.test(tx.date)) {
      set.add(tx.date.slice(0, 7));
    }
  }
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

const appState = {
  activeView: 'dashboard',
  selectedMonth: getCurrentMonthKey(),
  transactions: [],
  budgetInfo: { monthlyLimit: 0, updatedAt: '' },
  dashboardBreakdownScope: 'month',
  analyticsScope: 'all',
  txFilters: {
    search: '',
    type: 'all',
    category: 'all',
    month: 'all',
    sort: 'date-desc',
  },
};

// Cached DOM references
const dom = {
  sidebar: document.getElementById('app-sidebar'),
  sidebarBackdrop: document.getElementById('sidebar-backdrop'),
  openSidebarBtn: document.getElementById('open-sidebar-btn'),
  closeSidebarBtn: document.getElementById('close-sidebar-btn'),
  navItems: document.querySelectorAll('.nav-item[data-nav]'),
  brandLink: document.querySelector('.brand-link[data-nav]'),
  monthSelect: document.getElementById('global-month-select'),
  exportCsvBtn: document.getElementById('export-csv-btn'),
  resetDemoBtn: document.getElementById('reset-demo-btn'),
  pageTitle: document.getElementById('page-title'),
  pagePeriodLabel: document.getElementById('page-period-label'),
  openAddModalBtn: document.getElementById('open-add-modal-btn'),
  views: {
    dashboard: document.getElementById('view-dashboard'),
    transactions: document.getElementById('view-transactions'),
    analytics: document.getElementById('view-analytics'),
    budget: document.getElementById('view-budget'),
  },
  // Transaction Modal
  txModal: document.getElementById('transaction-modal'),
  txModalTitle: document.getElementById('transaction-modal-title'),
  txForm: document.getElementById('transaction-form'),
  txIdInput: document.getElementById('tx-id'),
  txTypeInput: document.getElementById('tx-type'),
  txTypeButtons: document.querySelectorAll('[data-tx-type]'),
  txTitleInput: document.getElementById('tx-title'),
  txAmountInput: document.getElementById('tx-amount'),
  txCategorySelect: document.getElementById('tx-category'),
  txDateInput: document.getElementById('tx-date'),
  txDescriptionInput: document.getElementById('tx-description'),
  closeTxModalBtn: document.getElementById('close-transaction-modal-btn'),
  cancelTxBtn: document.getElementById('cancel-transaction-btn'),
  saveTxBtn: document.getElementById('save-transaction-btn'),
  // Confirm Modal
  confirmModal: document.getElementById('confirm-modal'),
  confirmModalTitle: document.getElementById('confirm-modal-title'),
  confirmModalMessage: document.getElementById('confirm-modal-message'),
  confirmModalExtra: document.getElementById('confirm-modal-extra'),
  confirmActionBtn: document.getElementById('confirm-action-btn'),
  confirmSecondaryBtn: document.getElementById('confirm-secondary-btn'),
  closeConfirmModalBtn: document.getElementById('close-confirm-modal-btn'),
  cancelConfirmBtn: document.getElementById('cancel-confirm-btn'),
  // Toast Region
  toastRegion: document.getElementById('toast-region'),
};

let confirmPrimaryHandler = null;
let confirmSecondaryHandler = null;

function refreshIcons() {
  if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, isError = false) {
  const toast = document.createElement('div');
  toast.className = `toast ${isError ? 'toast-error' : ''}`;
  toast.innerHTML = `
    <i data-lucide="${isError ? 'alert-circle' : 'check'}"></i>
    <span>${escapeHtml(message)}</span>
  `;
  dom.toastRegion.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, 3200);
}

function loadStateFromStorage() {
  appState.transactions = storage.getTransactions();
  appState.budgetInfo = storage.getBudgetInfo();
}

function syncMonthSelector() {
  const months = computeAvailableMonths(appState.transactions, appState.selectedMonth);
  dom.monthSelect.innerHTML = months
    .map(
      (m) =>
        `<option value="${escapeHtml(m)}">${escapeHtml(formatMonthLabel(m))}</option>`
    )
    .join('');
  dom.monthSelect.value = appState.selectedMonth;
  dom.pagePeriodLabel.textContent = formatMonthLabel(appState.selectedMonth);
}

function setSidebarOpen(open) {
  dom.sidebar.classList.toggle('open', open);
  dom.sidebarBackdrop.classList.toggle('open', open);
}

function setActiveView(viewName) {
  if (!dom.views[viewName]) return;
  appState.activeView = viewName;

  dom.navItems.forEach((item) => {
    const isMatch = item.getAttribute('data-nav') === viewName;
    item.classList.toggle('active', isMatch);
    if (isMatch) {
      item.setAttribute('aria-current', 'page');
    } else {
      item.removeAttribute('aria-current');
    }
  });

  Object.entries(dom.views).forEach(([key, section]) => {
    const isCurrent = key === viewName;
    section.hidden = !isCurrent;
    section.classList.toggle('active', isCurrent);
  });

  dom.pageTitle.textContent = VIEW_TITLES[viewName] || 'Dashboard';
  setSidebarOpen(false);
  renderActiveView();
}

function renderActiveView() {
  syncMonthSelector();
  const availableMonths = computeAvailableMonths(appState.transactions, appState.selectedMonth);
  const recentMonths = getTrailingMonths(appState.selectedMonth, 6);

  if (appState.activeView === 'dashboard') {
    renderDashboardView(
      dom.views.dashboard,
      {
        transactions: appState.transactions,
        budgetInfo: appState.budgetInfo,
        selectedMonth: appState.selectedMonth,
        recentMonths,
        dashboardBreakdownScope: appState.dashboardBreakdownScope,
      },
      {
        onNavigate: (target) => setActiveView(target),
        onScopeChange: (scope) => {
          appState.dashboardBreakdownScope = scope;
          renderActiveView();
        },
        onAddClick: () => openTransactionModal(),
        onEditClick: (id) => openEditTransactionModal(id),
        onDeleteClick: (id) => requestDeleteTransaction(id),
      }
    );
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(
      dom.views.transactions,
      {
        transactions: appState.transactions,
        filters: appState.txFilters,
        availableMonths,
      },
      {
        onFilterChange: (patch) => {
          appState.txFilters = { ...appState.txFilters, ...patch };
          // If type filter changes and selected category is no longer valid, reset category to all
          if (patch.type) {
            const validPool =
              patch.type === 'all' ? null : getCategoriesForType(patch.type);
            if (validPool && !validPool.includes(appState.txFilters.category)) {
              appState.txFilters.category = 'all';
            }
          }
          renderActiveView();
        },
        onResetFilters: () => {
          appState.txFilters = {
            search: '',
            type: 'all',
            category: 'all',
            month: 'all',
            sort: 'date-desc',
          };
          renderActiveView();
        },
        onAddClick: () => openTransactionModal(),
        onEditClick: (id) => openEditTransactionModal(id),
        onDeleteClick: (id) => requestDeleteTransaction(id),
      }
    );
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(
      dom.views.analytics,
      {
        transactions: appState.transactions,
        selectedMonth: appState.selectedMonth,
        recentMonths,
        analyticsScope: appState.analyticsScope,
      },
      {
        onScopeChange: (scope) => {
          appState.analyticsScope = scope;
          renderActiveView();
        },
        onAddClick: () => openTransactionModal(),
      }
    );
  } else if (appState.activeView === 'budget') {
    renderBudgetView(
      dom.views.budget,
      {
        transactions: appState.transactions,
        budgetInfo: appState.budgetInfo,
        selectedMonth: appState.selectedMonth,
        recentMonths,
      },
      {
        onSaveBudget: (monthlyLimit) => {
          appState.budgetInfo = storage.saveBudgetInfo({ monthlyLimit });
          renderActiveView();
          showToast(`Monthly budget updated to ${formatCurrency(monthlyLimit)}.`);
        },
      }
    );
  }

  refreshIcons();
}

/* ---------------- Transaction Modal Logic ---------------- */

function populateCategoryOptions(type, selectedCategory = '') {
  const categories = getCategoriesForType(type);
  dom.txCategorySelect.innerHTML = [
    '<option value="">Select category...</option>',
    ...categories.map(
      (cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
    ),
  ].join('');

  if (selectedCategory && categories.includes(selectedCategory)) {
    dom.txCategorySelect.value = selectedCategory;
  } else {
    dom.txCategorySelect.value = categories[0] || '';
  }
}

function setModalTransactionType(type, preferredCategory = '') {
  const normalizedType = type === 'income' ? 'income' : 'expense';
  dom.txTypeInput.value = normalizedType;
  dom.txTypeButtons.forEach((btn) => {
    const isMatch = btn.getAttribute('data-tx-type') === normalizedType;
    btn.classList.toggle('active', isMatch);
    btn.setAttribute('aria-pressed', String(isMatch));
  });
  populateCategoryOptions(normalizedType, preferredCategory);
}

function clearFormErrors() {
  const fields = ['title', 'amount', 'category', 'date', 'description'];
  for (const field of fields) {
    const errEl = document.getElementById(`error-tx-${field}`);
    const inputEl = document.getElementById(`tx-${field}`);
    if (errEl) {
      errEl.textContent = '';
      errEl.hidden = true;
    }
    if (inputEl) {
      inputEl.classList.remove('input-invalid');
    }
  }
}

function applyFormErrors(errors) {
  clearFormErrors();
  for (const [field, message] of Object.entries(errors)) {
    const errEl = document.getElementById(`error-tx-${field}`);
    const inputEl = document.getElementById(`tx-${field}`);
    if (errEl) {
      errEl.textContent = message;
      errEl.hidden = false;
    }
    if (inputEl) {
      inputEl.classList.add('input-invalid');
    }
  }
}

function openTransactionModal(existingTx = null) {
  clearFormErrors();
  dom.txForm.reset();

  if (existingTx) {
    dom.txModalTitle.textContent = 'Edit Transaction';
    dom.saveTxBtn.textContent = 'Update Transaction';
    dom.txIdInput.value = existingTx.id;
    setModalTransactionType(existingTx.type, existingTx.category);
    dom.txTitleInput.value = existingTx.title;
    dom.txAmountInput.value = existingTx.amount;
    dom.txDateInput.value = existingTx.date;
    dom.txDescriptionInput.value = existingTx.description || '';
  } else {
    dom.txModalTitle.textContent = 'Add Transaction';
    dom.saveTxBtn.textContent = 'Save Transaction';
    dom.txIdInput.value = '';
    setModalTransactionType('expense');
    dom.txDateInput.value = getTodayIsoDate();
  }

  dom.txModal.hidden = false;
  refreshIcons();
  dom.txTitleInput.focus();
}

function openEditTransactionModal(id) {
  const tx = appState.transactions.find((item) => item.id === id);
  if (!tx) {
    showToast('Transaction could not be found.', true);
    return;
  }
  openTransactionModal(tx);
}

function closeTransactionModal() {
  dom.txModal.hidden = true;
  clearFormErrors();
}

function handleTransactionFormSubmit(e) {
  e.preventDefault();

  const payload = {
    type: dom.txTypeInput.value,
    title: dom.txTitleInput.value.trim(),
    amount: dom.txAmountInput.value,
    category: dom.txCategorySelect.value,
    date: dom.txDateInput.value,
    description: dom.txDescriptionInput.value.trim(),
  };

  const validation = validateTransactionInput(payload);
  if (!validation.valid) {
    applyFormErrors(validation.errors);
    return;
  }

  const editingId = dom.txIdInput.value;

  try {
    if (editingId) {
      storage.updateTransaction(editingId, {
        ...payload,
        amount: Number(payload.amount),
      });
      showToast('Transaction updated.');
    } else {
      storage.addTransaction({
        ...payload,
        amount: Number(payload.amount),
      });
      showToast('Transaction added.');
    }

    loadStateFromStorage();
    closeTransactionModal();
    renderActiveView();
  } catch (err) {
    console.error(err);
    showToast('Could not save transaction. Please try again.', true);
  }
}

/* ---------------- Confirmation Modal Logic ---------------- */

function openConfirmModal({
  title,
  message,
  extraHtml = '',
  primaryLabel = 'Confirm',
  primaryVariant = 'btn-danger',
  secondaryLabel = '',
  onPrimary,
  onSecondary = null,
}) {
  dom.confirmModalTitle.textContent = title;
  dom.confirmModalMessage.textContent = message;

  if (extraHtml) {
    dom.confirmModalExtra.innerHTML = extraHtml;
    dom.confirmModalExtra.hidden = false;
  } else {
    dom.confirmModalExtra.innerHTML = '';
    dom.confirmModalExtra.hidden = true;
  }

  dom.confirmActionBtn.textContent = primaryLabel;
  dom.confirmActionBtn.className = primaryVariant;

  if (secondaryLabel && onSecondary) {
    dom.confirmSecondaryBtn.textContent = secondaryLabel;
    dom.confirmSecondaryBtn.hidden = false;
  } else {
    dom.confirmSecondaryBtn.hidden = true;
  }

  confirmPrimaryHandler = onPrimary;
  confirmSecondaryHandler = onSecondary;
  dom.confirmModal.hidden = false;
  refreshIcons();
}

function closeConfirmModal() {
  dom.confirmModal.hidden = true;
  confirmPrimaryHandler = null;
  confirmSecondaryHandler = null;
}

function requestDeleteTransaction(id) {
  const tx = appState.transactions.find((item) => item.id === id);
  if (!tx) return;

  openConfirmModal({
    title: 'Delete Transaction',
    message: 'Are you sure you want to permanently remove this transaction?',
    extraHtml: `<strong>${escapeHtml(tx.title)}</strong> · ${escapeHtml(
      tx.category
    )} · <span class="mono-cell">${formatCurrency(tx.amount)}</span>`,
    primaryLabel: 'Delete',
    primaryVariant: 'btn-danger',
    onPrimary: () => {
      storage.deleteTransaction(id);
      loadStateFromStorage();
      closeConfirmModal();
      renderActiveView();
      showToast('Transaction deleted.');
    },
  });
}

function requestResetData() {
  openConfirmModal({
    title: 'Manage Local Data',
    message:
      'Choose whether to restore the sample dataset or clear all transactions and budget settings to start from a blank ledger.',
    primaryLabel: 'Restore Sample Data',
    primaryVariant: 'btn-primary',
    secondaryLabel: 'Clear All Data',
    onPrimary: () => {
      storage.restoreSampleData();
      loadStateFromStorage();
      closeConfirmModal();
      renderActiveView();
      showToast('Sample dataset restored.');
    },
    onSecondary: () => {
      storage.clearAllData();
      loadStateFromStorage();
      closeConfirmModal();
      renderActiveView();
      showToast('All local data cleared.');
    },
  });
}

/* ---------------- CSV Export ---------------- */

function handleExportCsv() {
  if (appState.transactions.length === 0) {
    showToast('No transactions available to export.', true);
    return;
  }
  const csv = buildCsvContent(appState.transactions);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `clearledger-transactions-${getTodayIsoDate()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast('Transactions exported as CSV.');
}

/* ---------------- Event Wiring & Initialization ---------------- */

function bindEvents() {
  // Navigation
  dom.navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      setActiveView(btn.getAttribute('data-nav'));
    });
  });

  if (dom.brandLink) {
    dom.brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveView('dashboard');
    });
  }

  // Mobile sidebar drawer
  dom.openSidebarBtn.addEventListener('click', () => setSidebarOpen(true));
  dom.closeSidebarBtn.addEventListener('click', () => setSidebarOpen(false));
  dom.sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));

  // Global active month selector
  dom.monthSelect.addEventListener('change', (e) => {
    appState.selectedMonth = e.target.value;
    renderActiveView();
  });

  // Utility buttons
  dom.exportCsvBtn.addEventListener('click', handleExportCsv);
  dom.resetDemoBtn.addEventListener('click', requestResetData);

  // Add transaction modal trigger
  dom.openAddModalBtn.addEventListener('click', () => openTransactionModal());
  dom.closeTxModalBtn.addEventListener('click', closeTransactionModal);
  dom.cancelTxBtn.addEventListener('click', closeTransactionModal);
  dom.txModal.addEventListener('click', (e) => {
    if (e.target === dom.txModal) closeTransactionModal();
  });

  // Transaction type switch inside modal
  dom.txTypeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      setModalTransactionType(btn.getAttribute('data-tx-type'));
    });
  });

  // Clear field errors interactively on input
  [dom.txTitleInput, dom.txAmountInput, dom.txCategorySelect, dom.txDateInput, dom.txDescriptionInput].forEach(
    (el) => {
      el.addEventListener('input', () => {
        el.classList.remove('input-invalid');
        const fieldName = el.id.replace('tx-', '');
        const errEl = document.getElementById(`error-tx-${fieldName}`);
        if (errEl) {
          errEl.textContent = '';
          errEl.hidden = true;
        }
      });
    }
  );

  dom.txForm.addEventListener('submit', handleTransactionFormSubmit);

  // Confirm modal actions
  dom.closeConfirmModalBtn.addEventListener('click', closeConfirmModal);
  dom.cancelConfirmBtn.addEventListener('click', closeConfirmModal);
  dom.confirmModal.addEventListener('click', (e) => {
    if (e.target === dom.confirmModal) closeConfirmModal();
  });
  dom.confirmActionBtn.addEventListener('click', () => {
    if (typeof confirmPrimaryHandler === 'function') confirmPrimaryHandler();
  });
  dom.confirmSecondaryBtn.addEventListener('click', () => {
    if (typeof confirmSecondaryHandler === 'function') confirmSecondaryHandler();
  });

  // Global Escape key handler
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!dom.txModal.hidden) closeTransactionModal();
      if (!dom.confirmModal.hidden) closeConfirmModal();
      setSidebarOpen(false);
    }
  });
}

function bootstrap() {
  storage.initializeStorage();
  loadStateFromStorage();
  bindEvents();
  setActiveView('dashboard');
}

document.addEventListener('DOMContentLoaded', bootstrap);
