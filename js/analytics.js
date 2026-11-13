/**
 * analytics.js
 * Pure financial analytics calculations and dynamic Chart.js visualizations.
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
} from './transactions.js';

let incomeVsExpenseChart = null;
let categoryBarChart = null;
let spendingDistributionChart = null;

const PALETTE = [
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
 * Computes comprehensive analytics metrics for either all transactions or a specific monthKey.
 * @param {Array<object>} transactions
 * @param {string} scope 'all' | 'month'
 * @param {string} selectedMonth
 */
export function calculateAnalyticsMetrics(transactions, scope, selectedMonth) {
  const scoped =
    scope === 'month'
      ? transactions.filter((tx) => tx.date && tx.date.startsWith(selectedMonth))
      : transactions;

  let totalIncome = 0;
  let totalExpenses = 0;
  let expenseCount = 0;
  const categoryMap = new Map();

  for (const tx of scoped) {
    if (tx.type === 'income') {
      totalIncome += tx.amount;
    } else {
      totalExpenses += tx.amount;
      expenseCount += 1;
      const entry = categoryMap.get(tx.category) || {
        category: tx.category,
        amount: 0,
        count: 0,
      };
      entry.amount += tx.amount;
      entry.count += 1;
      categoryMap.set(tx.category, entry);
    }
  }

  const totalSavings = totalIncome - totalExpenses;
  const savingsRate = totalIncome > 0 ? (totalSavings / totalIncome) * 100 : 0;
  const averageExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

  const categoryBreakdown = Array.from(categoryMap.values())
    .sort((a, b) => b.amount - a.amount)
    .map((item) => ({
      ...item,
      sharePct: totalExpenses > 0 ? (item.amount / totalExpenses) * 100 : 0,
    }));

  const highestCategory = categoryBreakdown.length > 0 ? categoryBreakdown[0] : null;

  return {
    totalIncome,
    totalExpenses,
    totalSavings,
    savingsRate,
    averageExpense,
    expenseCount,
    highestCategory,
    categoryBreakdown,
  };
}

/**
 * Computes monthly income vs expenses series across a list of month keys.
 * @param {Array<object>} transactions
 * @param {string[]} monthKeys
 */
export function getMonthlyComparisonSeries(transactions, monthKeys) {
  return monthKeys.map((m) => {
    let income = 0;
    let expenses = 0;
    for (const tx of transactions) {
      if (!tx.date || !tx.date.startsWith(m)) continue;
      if (tx.type === 'income') income += tx.amount;
      else expenses += tx.amount;
    }
    return {
      monthKey: m,
      label: formatShortMonthLabel(m),
      income,
      expenses,
      savings: income - expenses,
    };
  });
}

/**
 * Destroys all active Chart.js instances in the Analytics view.
 */
export function destroyAnalyticsCharts() {
  if (incomeVsExpenseChart) {
    incomeVsExpenseChart.destroy();
    incomeVsExpenseChart = null;
  }
  if (categoryBarChart) {
    categoryBarChart.destroy();
    categoryBarChart = null;
  }
  if (spendingDistributionChart) {
    spendingDistributionChart.destroy();
    spendingDistributionChart = null;
  }
}

/**
 * Renders the Expense Analytics view.
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} callbacks
 */
export function renderAnalyticsView(container, state, callbacks) {
  destroyAnalyticsCharts();

  const { transactions, selectedMonth, recentMonths, analyticsScope } = state;
  const scope = analyticsScope || 'all';
  const metrics = calculateAnalyticsMetrics(transactions, scope, selectedMonth);
  const monthlySeries = getMonthlyComparisonSeries(transactions, recentMonths);
  const scopeLabel = scope === 'month' ? formatMonthLabel(selectedMonth) : 'All Recorded Months';

  const savingsClass =
    metrics.totalSavings > 0 ? 'positive' : metrics.totalSavings < 0 ? 'negative' : '';
  const savingsSign = metrics.totalSavings < 0 ? '-' : '';

  container.innerHTML = `
    <div class="toolbar-row" style="margin-bottom: 0;">
      <div>
        <h2 class="card-title" style="font-size: 15.5px;">Financial Breakdown</h2>
        <p class="card-subtitle">Viewing ${escapeHtml(scopeLabel)}</p>
      </div>
      <div class="segmented-control" role="group" aria-label="Analytics timeframe">
        <button
          type="button"
          class="segmented-btn ${scope === 'all' ? 'active' : ''}"
          data-analytics-scope="all"
        >
          All Time
        </button>
        <button
          type="button"
          class="segmented-btn ${scope === 'month' ? 'active' : ''}"
          data-analytics-scope="month"
        >
          ${escapeHtml(formatMonthLabel(selectedMonth))}
        </button>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label"><span>Total Savings</span></div>
        <div class="kpi-value ${savingsClass}">
          ${savingsSign}${formatCurrency(Math.abs(metrics.totalSavings))}
        </div>
        <div class="kpi-meta">
          ${
            metrics.totalIncome > 0
              ? `Savings rate: <strong class="mono-cell">${metrics.savingsRate.toFixed(1)}%</strong>`
              : 'No income recorded in scope'
          }
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label"><span>Highest Spending Category</span></div>
        <div class="kpi-value" style="font-size: 20px;">
          ${metrics.highestCategory ? escapeHtml(metrics.highestCategory.category) : '—'}
        </div>
        <div class="kpi-meta">
          ${
            metrics.highestCategory
              ? `<span class="mono-cell">${formatCurrency(
                  metrics.highestCategory.amount
                )}</span> (${metrics.highestCategory.sharePct.toFixed(1)}% of expenses)`
              : 'No expenses recorded'
          }
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label"><span>Total Period Income</span></div>
        <div class="kpi-value positive">${formatCurrency(metrics.totalIncome)}</div>
        <div class="kpi-meta">${escapeHtml(scopeLabel)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label"><span>Average Expense</span></div>
        <div class="kpi-value">${formatCurrency(metrics.averageExpense)}</div>
        <div class="kpi-meta">${metrics.expenseCount} expense ${
          metrics.expenseCount === 1 ? 'transaction' : 'transactions'
        }</div>
      </div>
    </div>

    <div class="charts-grid-equal">
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Monthly Income vs. Expenses</h3>
            <p class="card-subtitle">6-month cash flow comparison.</p>
          </div>
        </div>
        <div class="chart-canvas-wrap">
          ${
            transactions.length === 0
              ? `<div class="chart-empty-note">Add transactions to compare monthly income and expenses.</div>`
              : `<canvas id="analytics-income-expense-chart"></canvas>`
          }
        </div>
      </div>

      <div class="surface-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Spending Distribution</h3>
            <p class="card-subtitle">Share of expenses across categories (${escapeHtml(
              scopeLabel
            )}).</p>
          </div>
        </div>
        <div class="chart-canvas-wrap">
          ${
            metrics.categoryBreakdown.length === 0
              ? `<div class="chart-empty-note">No expense data available for this period.</div>`
              : `<canvas id="analytics-distribution-chart"></canvas>`
          }
        </div>
      </div>
    </div>

    <div class="charts-grid-2">
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Category-Wise Expense Breakdown</h3>
            <p class="card-subtitle">Ranked spending totals by category.</p>
          </div>
        </div>
        <div class="chart-canvas-wrap">
          ${
            metrics.categoryBreakdown.length === 0
              ? `<div class="chart-empty-note">Record an expense to inspect category comparisons.</div>`
              : `<canvas id="analytics-category-bar-chart"></canvas>`
          }
        </div>
      </div>

      <div class="surface-card">
        <div class="card-header">
          <div>
            <h3 class="card-title">Category Ledger Summary</h3>
            <p class="card-subtitle">Exact expense totals and share percentages.</p>
          </div>
        </div>

        ${
          metrics.categoryBreakdown.length === 0
            ? `
          <div class="empty-state" style="padding: 28px 12px;">
            <div class="empty-state-icon"><i data-lucide="bar-chart-3"></i></div>
            <h4 class="empty-state-title">No expense breakdown yet</h4>
            <p class="empty-state-text">Add expense entries to view category proportions.</p>
            <button type="button" class="btn-primary btn-sm" data-analytics-add>
              <i data-lucide="plus"></i>
              <span>Add Expense</span>
            </button>
          </div>
        `
            : `
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th class="align-right">Entries</th>
                  <th class="align-right">Total</th>
                  <th style="width: 110px;">Share</th>
                </tr>
              </thead>
              <tbody>
                ${metrics.categoryBreakdown
                  .map(
                    (row) => `
                  <tr>
                    <td><strong>${escapeHtml(row.category)}</strong></td>
                    <td class="align-right mono-cell">${row.count}</td>
                    <td class="align-right mono-cell">${formatCurrency(row.amount)}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="proportion-bar-track">
                          <div class="proportion-bar-fill" style="width: ${row.sharePct.toFixed(
                            1
                          )}%;"></div>
                        </div>
                        <span class="mono-cell" style="font-size: 11.5px; min-width: 40px; text-align: right;">${row.sharePct.toFixed(
                          1
                        )}%</span>
                      </div>
                    </td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </div>
        `
        }
      </div>
    </div>
  `;

  container.querySelectorAll('[data-analytics-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      callbacks.onScopeChange(btn.getAttribute('data-analytics-scope'));
    });
  });

  const addBtn = container.querySelector('[data-analytics-add]');
  if (addBtn) {
    addBtn.addEventListener('click', () => callbacks.onAddClick());
  }

  if (transactions.length > 0) {
    renderIncomeVsExpenseChart(container, monthlySeries);
  }
  if (metrics.categoryBreakdown.length > 0) {
    renderDistributionChart(container, metrics.categoryBreakdown);
    renderCategoryBarChart(container, metrics.categoryBreakdown);
  }
}

function renderIncomeVsExpenseChart(container, series) {
  if (typeof window.Chart === 'undefined') return;
  const canvas = container.querySelector('#analytics-income-expense-chart');
  if (!canvas) return;

  incomeVsExpenseChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((s) => s.income),
          backgroundColor: '#16a34a',
          borderRadius: 4,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expenses),
          backgroundColor: '#dc2626',
          borderRadius: 4,
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

function renderDistributionChart(container, categoryBreakdown) {
  if (typeof window.Chart === 'undefined') return;
  const canvas = container.querySelector('#analytics-distribution-chart');
  if (!canvas) return;

  spendingDistributionChart = new window.Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: categoryBreakdown.map((c) => c.category),
      datasets: [
        {
          data: categoryBreakdown.map((c) => c.amount),
          backgroundColor: categoryBreakdown.map((_, idx) => PALETTE[idx % PALETTE.length]),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '58%',
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
              const row = categoryBreakdown[ctx.dataIndex];
              return `${row.category}: ${formatCurrency(row.amount)} (${row.sharePct.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderCategoryBarChart(container, categoryBreakdown) {
  if (typeof window.Chart === 'undefined') return;
  const canvas = container.querySelector('#analytics-category-bar-chart');
  if (!canvas) return;

  categoryBarChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: categoryBreakdown.map((c) => c.category),
      datasets: [
        {
          label: 'Total Spent',
          data: categoryBreakdown.map((c) => c.amount),
          backgroundColor: '#2563eb',
          borderRadius: 4,
          barThickness: 18,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${formatCurrency(ctx.parsed.x)}`,
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { family: "'JetBrains Mono', monospace", size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: "'Plus Jakarta Sans', sans-serif", size: 12 } },
        },
      },
    },
  });
}
