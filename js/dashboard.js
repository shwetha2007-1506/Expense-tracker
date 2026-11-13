/**
 * dashboard.js
 * Pure dashboard metric calculations and Dashboard view rendering.
 */

import {
  escapeHtml,
  formatCurrency,
  formatDateDisplay,
  formatMonthLabel,
  formatShortMonthLabel,
} from './transactions.js';
import { buildBudgetAlertMarkup, calculateBudgetStatus } from './budget.js';

let monthlyOverviewChart = null;
let categoryBreakdownChart = null;

const CATEGORY_COLORS = [
  '#0f172a',
  '#2563eb',
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#6366f1',
  '#64748b',
  '#475569',
];

/**
 * Computes all dynamic dashboard KPI totals from transactions.
 * Total Balance = Total Income - Total Expenses.
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function calculateDashboardSummary(transactions, monthKey) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let monthlySpending = 0;
  let monthlyIncome = 0;
  let monthlyExpenseCount = 0;

  for (const tx of transactions) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
      incomeCount += 1;
      if (tx.date && tx.date.startsWith(monthKey)) {
        monthlyIncome += tx.amount;
      }
    } else {
      totalExpenses += tx.amount;
      expenseCount += 1;
      if (tx.date && tx.date.startsWith(monthKey)) {
        monthlySpending += tx.amount;
        monthlyExpenseCount += 1;
      }
    }
  }

  const totalBalance = totalIncome - totalExpenses;

  return {
    totalBalance,
    totalIncome,
    totalExpenses,
    monthlySpending,
    monthlyIncome,
    incomeCount,
    expenseCount,
    monthlyExpenseCount,
  };
}

/**
 * Returns the N most recent transactions sorted by date descending.
 * @param {Array<object>} transactions
 * @param {number} limit
 */
export function getRecentTransactions(transactions, limit = 6) {
  return [...transactions]
    .sort((a, b) => {
      const dateCmp = b.date.localeCompare(a.date);
      return dateCmp !== 0 ? dateCmp : b.id.localeCompare(a.id);
    })
    .slice(0, limit);
}

/**
 * Computes monthly income & spending series across the provided monthKeys.
 * @param {Array<object>} transactions
 * @param {string[]} monthKeys
 */
export function getMonthlyOverviewSeries(transactions, monthKeys) {
  return monthKeys.map((monthKey) => {
    let income = 0;
    let expense = 0;
    for (const tx of transactions) {
      if (!tx.date || !tx.date.startsWith(monthKey)) continue;
      if (tx.type === 'income') income += tx.amount;
      else expense += tx.amount;
    }
    return {
      monthKey,
      label: formatShortMonthLabel(monthKey),
      income,
      expense,
    };
  });
}

/**
 * Computes expense totals grouped by category for a given monthKey (or 'all').
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function getCategoryBreakdownData(transactions, monthKey = 'all') {
  const map = new Map();
  let total = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (monthKey !== 'all' && (!tx.date || !tx.date.startsWith(monthKey))) continue;
    total += tx.amount;
    map.set(tx.category, (map.get(tx.category) || 0) + tx.amount);
  }

  return Array.from(map.entries())
    .map(([category, amount]) => ({
      category,
      amount,
      percentage: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Destroys active Dashboard Chart.js instances before re-rendering.
 */
export function destroyDashboardCharts() {
  if (monthlyOverviewChart) {
    monthlyOverviewChart.destroy();
    monthlyOverviewChart = null;
  }
  if (categoryBreakdownChart) {
    categoryBreakdownChart.destroy();
    categoryBreakdownChart = null;
  }
}

/**
 * Renders the Dashboard view.
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} callbacks
 */
export function renderDashboardView(container, state, callbacks) {
  destroyDashboardCharts();

  const { transactions, budgetInfo, selectedMonth, recentMonths, dashboardBreakdownScope } = state;
  const summary = calculateDashboardSummary(transactions, selectedMonth);
  const budgetStatus = calculateBudgetStatus(transactions, budgetInfo.monthlyLimit, selectedMonth);
  const recentTx = getRecentTransactions(transactions, 6);
  const periodLabel = formatMonthLabel(selectedMonth);

  const breakdownScope = dashboardBreakdownScope || 'month';
  const categoryData = getCategoryBreakdownData(
    transactions,
    breakdownScope === 'month' ? selectedMonth : 'all'
  );

  const balanceSign = summary.totalBalance < 0 ? '-' : '';
  const balanceClass = summary.totalBalance < 0 ? 'negative' : '';

  const budgetMetaText =
    budgetStatus.limit > 0
      ? `<span class="${
          budgetStatus.status === 'exceeded'
            ? 'text-negative'
            : budgetStatus.status === 'warning'
            ? 'text-warning'
            : 'text-positive'
        }">${budgetStatus.utilizationPct.toFixed(1)}% of ${formatCurrency(
          budgetStatus.limit
        )} budget</span>`
      : `<span>${summary.monthlyExpenseCount} ${
          summary.monthlyExpenseCount === 1 ? 'expense' : 'expenses'
        } in ${escapeHtml(periodLabel)}</span>`;

  const alertHtml = buildBudgetAlertMarkup(budgetStatus, {
    showNormal: false,
    actionButtonHtml: `
      <button type="button" class="btn-secondary btn-sm" data-dash-nav="budget">
        Manage Budget
      </button>
    `,
  });

  container.innerHTML = `
    ${alertHtml}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Balance</span>
        </div>
        <div class="kpi-value ${balanceClass}">
          ${balanceSign}${formatCurrency(Math.abs(summary.totalBalance))}
        </div>
        <div class="kpi-meta">Total Income minus Total Expenses</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Income</span>
        </div>
        <div class="kpi-value positive">${formatCurrency(summary.totalIncome)}</div>
        <div class="kpi-meta">${summary.incomeCount} recorded ${
          summary.incomeCount === 1 ? 'deposit' : 'deposits'
        }</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Total Expenses</span>
        </div>
        <div class="kpi-value">${formatCurrency(summary.totalExpenses)}</div>
        <div class="kpi-meta">${summary.expenseCount} recorded ${
          summary.expenseCount === 1 ? 'expense' : 'expenses'
        }</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label">
          <span>Monthly Spending</span>
        </div>
        <div class="kpi-value">${formatCurrency(summary.monthlySpending)}</div>
        <div class="kpi-meta">${budgetMetaText}</div>
      </div>
    </div>

    <div class="charts-grid-2">
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Monthly Spending Overview</h2>
            <p class="card-subtitle">Monthly expenses compared with monthly income across recent months.</p>
          </div>
        </div>
        <div class="chart-canvas-wrap">
          ${
            transactions.length === 0
              ? `<div class="chart-empty-note">Add transactions to view monthly spending trends.</div>`
              : `<canvas id="dashboard-monthly-chart"></canvas>`
          }
        </div>
      </div>

      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Expense Category Breakdown</h2>
            <p class="card-subtitle">${
              breakdownScope === 'month' ? escapeHtml(periodLabel) : 'All Recorded Months'
            }</p>
          </div>
          <div class="segmented-control" role="group" aria-label="Category breakdown timeframe">
            <button
              type="button"
              class="segmented-btn ${breakdownScope === 'month' ? 'active' : ''}"
              data-breakdown-scope="month"
              style="min-height: 28px; padding: 3px 10px; font-size: 12px;"
            >
              Month
            </button>
            <button
              type="button"
              class="segmented-btn ${breakdownScope === 'all' ? 'active' : ''}"
              data-breakdown-scope="all"
              style="min-height: 28px; padding: 3px 10px; font-size: 12px;"
            >
              All Time
            </button>
          </div>
        </div>
        <div class="chart-canvas-wrap">
          ${
            categoryData.length === 0
              ? `<div class="chart-empty-note">No expense categories recorded for this period.</div>`
              : `<canvas id="dashboard-category-chart"></canvas>`
          }
        </div>
      </div>
    </div>

    <div class="surface-card">
      <div class="card-header">
        <div>
          <h2 class="card-title">Recent Transactions</h2>
          <p class="card-subtitle">Latest activity across all categories.</p>
        </div>
        <button type="button" class="btn-link" data-dash-nav="transactions">
          <span>View All Transactions</span>
          <i data-lucide="arrow-right" style="width:14px;height:14px;"></i>
        </button>
      </div>

      ${
        recentTx.length === 0
          ? `
        <div class="empty-state">
          <div class="empty-state-icon"><i data-lucide="receipt"></i></div>
          <h3 class="empty-state-title">Your ledger is empty</h3>
          <p class="empty-state-text">Record your first income or expense to start tracking balances, budgets, and spending habits.</p>
          <button type="button" class="btn-primary btn-sm" data-dash-add>
            <i data-lucide="plus"></i>
            <span>Add First Transaction</span>
          </button>
        </div>
      `
          : `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Category</th>
                <th>Date</th>
                <th class="align-right">Amount</th>
                <th class="align-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${recentTx
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
                              ? `<span class="tx-description">${escapeHtml(tx.description)}</span>`
                              : ''
                          }
                        </div>
                      </td>
                      <td>${escapeHtml(tx.category)}</td>
                      <td class="mono-cell">${escapeHtml(formatDateDisplay(tx.date))}</td>
                      <td class="align-right mono-cell ${
                        isIncome ? 'amount-income' : 'amount-expense'
                      }">
                        ${sign}${formatCurrency(tx.amount)}
                      </td>
                      <td class="align-right">
                        <div class="table-actions">
                          <button
                            type="button"
                            class="icon-btn"
                            data-edit-id="${escapeHtml(tx.id)}"
                            aria-label="Edit ${escapeHtml(tx.title)}"
                            title="Edit"
                          >
                            <i data-lucide="pencil"></i>
                          </button>
                          <button
                            type="button"
                            class="icon-btn icon-btn-danger"
                            data-delete-id="${escapeHtml(tx.id)}"
                            aria-label="Delete ${escapeHtml(tx.title)}"
                            title="Delete"
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
      `
      }
    </div>
  `;

  // Bind navigation, scope toggle, and quick action buttons
  container.querySelectorAll('[data-dash-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      callbacks.onNavigate(btn.getAttribute('data-dash-nav'));
    });
  });

  container.querySelectorAll('[data-breakdown-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      callbacks.onScopeChange(btn.getAttribute('data-breakdown-scope'));
    });
  });

  const addBtn = container.querySelector('[data-dash-add]');
  if (addBtn) {
    addBtn.addEventListener('click', () => callbacks.onAddClick());
  }

  container.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onEditClick(btn.getAttribute('data-edit-id')));
  });

  container.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => callbacks.onDeleteClick(btn.getAttribute('data-delete-id')));
  });

  // Render Charts
  if (transactions.length > 0) {
    renderMonthlyOverviewChart(container, transactions, recentMonths);
  }
  if (categoryData.length > 0) {
    renderCategoryBreakdownChart(container, categoryData);
  }
}

function renderMonthlyOverviewChart(container, transactions, monthKeys) {
  if (typeof window.Chart === 'undefined') return;
  const canvas = container.querySelector('#dashboard-monthly-chart');
  if (!canvas) return;

  const series = getMonthlyOverviewSeries(transactions, monthKeys);

  monthlyOverviewChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((s) => s.income),
          backgroundColor: '#16a34a',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expense),
          backgroundColor: '#0f172a',
          borderRadius: 4,
          barPercentage: 0.72,
          categoryPercentage: 0.65,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            usePointStyle: true,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 11.5 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownChart(container, categoryData) {
  if (typeof window.Chart === 'undefined') return;
  const canvas = container.querySelector('#dashboard-category-chart');
  if (!canvas) return;

  categoryBreakdownChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: categoryData.map((d) => d.category),
      datasets: [
        {
          data: categoryData.map((d) => d.amount),
          backgroundColor: categoryData.map(
            (_, idx) => CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
          ),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 11,
            padding: 12,
            usePointStyle: true,
            font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const row = categoryData[ctx.dataIndex];
              return `${row.category}: ${formatCurrency(row.amount)} (${row.percentage.toFixed(
                1
              )}%)`;
            },
          },
        },
      },
    },
  });
}
