/**
 * budget.js
 * Pure monthly budget calculations, threshold alerts (80% warning, 100% exceeded),
 * and Budget Management view rendering.
 */

import {
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
  formatShortMonthLabel,
} from './transactions.js';

let budgetTrendChart = null;

/**
 * Calculates monthly budget utilization and status for a given monthKey (YYYY-MM).
 * @param {Array<object>} transactions
 * @param {number} monthlyLimit
 * @param {string} monthKey
 */
export function calculateBudgetStatus(transactions, monthlyLimit, monthKey) {
  const limit = Number.isFinite(Number(monthlyLimit)) ? Math.max(0, Number(monthlyLimit)) : 0;

  let monthlyExpenses = 0;
  let monthlyIncome = 0;
  let expenseCount = 0;

  for (const tx of transactions) {
    if (!tx.date || !tx.date.startsWith(monthKey)) continue;
    if (tx.type === 'expense') {
      monthlyExpenses += tx.amount;
      expenseCount += 1;
    } else if (tx.type === 'income') {
      monthlyIncome += tx.amount;
    }
  }

  const remaining = limit - monthlyExpenses;
  const utilizationPct = limit > 0 ? (monthlyExpenses / limit) * 100 : 0;

  let status = 'unset';
  if (limit > 0) {
    if (utilizationPct >= 100) {
      status = 'exceeded';
    } else if (utilizationPct >= 80) {
      status = 'warning';
    } else {
      status = 'normal';
    }
  }

  return {
    monthKey,
    limit,
    monthlyExpenses,
    monthlyIncome,
    expenseCount,
    remaining,
    utilizationPct,
    status,
  };
}

/**
 * Aggregates expense breakdown by category for a specific month.
 * @param {Array<object>} transactions
 * @param {string} monthKey
 */
export function getMonthlyCategoryBreakdown(transactions, monthKey) {
  const totals = new Map();
  let totalSpent = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date || !tx.date.startsWith(monthKey)) continue;
    totalSpent += tx.amount;
    const prev = totals.get(tx.category) || { category: tx.category, amount: 0, count: 0 };
    prev.amount += tx.amount;
    prev.count += 1;
    totals.set(tx.category, prev);
  }

  return Array.from(totals.values())
    .sort((a, b) => b.amount - a.amount)
    .map((row) => ({
      ...row,
      sharePct: totalSpent > 0 ? (row.amount / totalSpent) * 100 : 0,
    }));
}

/**
 * Builds an alert banner HTML snippet if budget status warrants warning/exceeded/normal feedback.
 * @param {ReturnType<typeof calculateBudgetStatus>} statusObj
 * @param {{ showNormal?: boolean, actionButtonHtml?: string }} options
 */
export function buildBudgetAlertMarkup(statusObj, options = {}) {
  const { showNormal = true, actionButtonHtml = '' } = options;

  if (statusObj.status === 'exceeded') {
    const overAmount = Math.abs(statusObj.remaining);
    return `
      <div class="alert-banner status-exceeded" role="alert">
        <div class="alert-banner-content">
          <i data-lucide="alert-octagon"></i>
          <div>
            <span class="alert-banner-title">Monthly Budget Exceeded:</span>
            <span>Spending for ${escapeHtml(
              formatMonthLabel(statusObj.monthKey)
            )} is <strong class="mono-cell">${formatCurrency(overAmount)}</strong> over your ${formatCurrency(
              statusObj.limit
            )} limit (${statusObj.utilizationPct.toFixed(1)}% utilized).</span>
          </div>
        </div>
        ${actionButtonHtml}
      </div>
    `;
  }

  if (statusObj.status === 'warning') {
    return `
      <div class="alert-banner status-warning" role="status">
        <div class="alert-banner-content">
          <i data-lucide="alert-triangle"></i>
          <div>
            <span class="alert-banner-title">Approaching Budget Limit:</span>
            <span>You have used <strong class="mono-cell">${statusObj.utilizationPct.toFixed(
              1
            )}%</strong> of your ${formatCurrency(statusObj.limit)} monthly budget (${formatCurrency(
              statusObj.remaining
            )} remaining).</span>
          </div>
        </div>
        ${actionButtonHtml}
      </div>
    `;
  }

  if (statusObj.status === 'normal' && showNormal) {
    return `
      <div class="alert-banner status-normal" role="status">
        <div class="alert-banner-content">
          <i data-lucide="check-circle-2"></i>
          <div>
            <span class="alert-banner-title">On Track:</span>
            <span>Spending is within your monthly limit at <strong class="mono-cell">${statusObj.utilizationPct.toFixed(
              1
            )}%</strong> utilization (${formatCurrency(statusObj.remaining)} remaining).</span>
          </div>
        </div>
        ${actionButtonHtml}
      </div>
    `;
  }

  return '';
}

/**
 * Destroys any active Budget Chart.js instance.
 */
export function destroyBudgetCharts() {
  if (budgetTrendChart) {
    budgetTrendChart.destroy();
    budgetTrendChart = null;
  }
}

/**
 * Renders the Budget Management view.
 * @param {HTMLElement} container
 * @param {object} state
 * @param {object} callbacks
 */
export function renderBudgetView(container, state, callbacks) {
  destroyBudgetCharts();

  const { transactions, budgetInfo, selectedMonth, recentMonths } = state;
  const statusObj = calculateBudgetStatus(transactions, budgetInfo.monthlyLimit, selectedMonth);
  const categoryBreakdown = getMonthlyCategoryBreakdown(transactions, selectedMonth);
  const periodLabel = formatMonthLabel(selectedMonth);

  const progressWidth = Math.min(100, Math.max(0, statusObj.utilizationPct));
  const progressStatusClass =
    statusObj.status === 'exceeded'
      ? 'status-exceeded'
      : statusObj.status === 'warning'
      ? 'status-warning'
      : 'status-normal';

  const remainingLabel = statusObj.remaining >= 0 ? 'Remaining Budget' : 'Over Budget By';
  const remainingValueClass =
    statusObj.status === 'unset'
      ? ''
      : statusObj.remaining < 0
      ? 'negative'
      : statusObj.status === 'warning'
      ? 'warning'
      : 'positive';

  const alertHtml = buildBudgetAlertMarkup(statusObj, { showNormal: true });

  container.innerHTML = `
    ${alertHtml}

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label"><span>Monthly Budget</span></div>
        <div class="kpi-value">${
          statusObj.limit > 0 ? formatCurrency(statusObj.limit) : 'Not Set'
        }</div>
        <div class="kpi-meta">Target limit for ${escapeHtml(periodLabel)}</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label"><span>Monthly Expenses</span></div>
        <div class="kpi-value">${formatCurrency(statusObj.monthlyExpenses)}</div>
        <div class="kpi-meta">${statusObj.expenseCount} expense ${
          statusObj.expenseCount === 1 ? 'entry' : 'entries'
        }</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label"><span>${remainingLabel}</span></div>
        <div class="kpi-value ${remainingValueClass}">${
          statusObj.limit > 0 ? formatCurrency(Math.abs(statusObj.remaining)) : '—'
        }</div>
        <div class="kpi-meta">${
          statusObj.limit > 0
            ? statusObj.remaining >= 0
              ? 'Available before limit'
              : 'Exceeded monthly cap'
            : 'Set a monthly budget below'
        }</div>
      </div>

      <div class="kpi-card">
        <div class="kpi-label"><span>Budget Utilization</span></div>
        <div class="kpi-value ${
          statusObj.status === 'exceeded'
            ? 'negative'
            : statusObj.status === 'warning'
            ? 'warning'
            : ''
        }">${statusObj.limit > 0 ? `${statusObj.utilizationPct.toFixed(1)}%` : '0.0%'}</div>
        <div class="kpi-meta">Warning threshold at 80.0%</div>
      </div>
    </div>

    <div class="budget-grid">
      <div class="surface-card">
        <div class="card-header">
          <div>
            <h2 class="card-title">Monthly Budget Progress</h2>
            <p class="card-subtitle">Real-time tracking against your ${escapeHtml(
              periodLabel
            )} spending limit.</p>
          </div>
        </div>

        ${
          statusObj.limit > 0
            ? `
          <div class="budget-stats-row">
            <span>Spent: <strong class="mono-cell">${formatCurrency(
              statusObj.monthlyExpenses
            )}</strong></span>
            <span>Limit: <strong class="mono-cell">${formatCurrency(statusObj.limit)}</strong></span>
          </div>
          <div
            class="budget-progress-track"
            role="progressbar"
            aria-valuenow="${Math.round(statusObj.utilizationPct)}"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="Monthly budget utilization"
          >
            <div class="budget-progress-fill ${progressStatusClass}" style="width: ${progressWidth.toFixed(
                1
              )}%"></div>
          </div>
          <div class="budget-stats-row">
            <span>0%</span>
            <span>80% Warning</span>
            <span>100% Limit</span>
          </div>
        `
            : `
          <div class="empty-state" style="padding: 24px 12px;">
            <div class="empty-state-icon"><i data-lucide="wallet"></i></div>
            <h3 class="empty-state-title">No monthly budget configured</h3>
            <p class="empty-state-text">Enter a monthly spending target on the right to activate 80% warnings and overage alerts.</p>
          </div>
        `
        }

        <div style="margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--border-subtle);">
          <h3 class="card-title" style="margin-bottom: 12px;">Budget vs. Actual Spending</h3>
          <div class="chart-canvas-wrap-sm">
            <canvas id="budget-comparison-chart"></canvas>
          </div>
        </div>
      </div>

      <div class="surface-card" style="display: flex; flex-direction: column; gap: 22px;">
        <div>
          <div class="card-header" style="margin-bottom: 12px;">
            <div>
              <h2 class="card-title">Set Monthly Budget</h2>
              <p class="card-subtitle">Applies to monthly tracking and dashboard alerts.</p>
            </div>
          </div>

          <form id="budget-limit-form" class="budget-form-inline" novalidate>
            <div class="form-group">
              <label for="budget-limit-input" class="form-label">Monthly Limit ($)</label>
              <input
                type="number"
                id="budget-limit-input"
                class="input-control mono-input"
                min="0"
                step="10"
                placeholder="e.g. 3200"
                value="${statusObj.limit > 0 ? statusObj.limit : ''}"
                required
              />
              <p id="error-budget-limit" class="field-error" hidden></p>
            </div>
            <button type="submit" class="btn-primary">Save Budget</button>
          </form>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 18px;">
          <div class="card-header" style="margin-bottom: 12px;">
            <div>
              <h3 class="card-title">${escapeHtml(periodLabel)} Category Share</h3>
              <p class="card-subtitle">Top drivers of this month's expenses.</p>
            </div>
          </div>

          ${
            categoryBreakdown.length === 0
              ? `<p class="card-subtitle">No expenses recorded in ${escapeHtml(periodLabel)} yet.</p>`
              : `
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th class="align-right">Spent</th>
                    <th class="align-right">Share</th>
                  </tr>
                </thead>
                <tbody>
                  ${categoryBreakdown
                    .map(
                      (row) => `
                    <tr>
                      <td>${escapeHtml(row.category)}</td>
                      <td class="align-right mono-cell">${formatCurrency(row.amount)}</td>
                      <td class="align-right mono-cell">${row.sharePct.toFixed(1)}%</td>
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
    </div>
  `;

  // Bind Budget form validation & save
  const form = container.querySelector('#budget-limit-form');
  const input = container.querySelector('#budget-limit-input');
  const errorEl = container.querySelector('#error-budget-limit');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    const num = Number(raw);

    if (raw === '' || !Number.isFinite(num) || num <= 0) {
      input.classList.add('input-invalid');
      errorEl.textContent = 'Please enter a positive budget amount greater than $0.';
      errorEl.hidden = false;
      return;
    }

    if (num > 100000000) {
      input.classList.add('input-invalid');
      errorEl.textContent = 'Budget amount is too large.';
      errorEl.hidden = false;
      return;
    }

    input.classList.remove('input-invalid');
    errorEl.hidden = true;
    callbacks.onSaveBudget(Number(num.toFixed(2)));
  });

  // Render Budget vs Actual Chart across recent months
  renderBudgetComparisonChart(container, transactions, statusObj.limit, recentMonths);
}

/**
 * Renders the Chart.js bar comparison of actual expenses vs monthly budget limit.
 */
function renderBudgetComparisonChart(container, transactions, budgetLimit, monthKeys) {
  if (typeof window.Chart === 'undefined') return;
  const canvas = container.querySelector('#budget-comparison-chart');
  if (!canvas) return;

  const labels = monthKeys.map((m) => formatShortMonthLabel(m));
  const actualData = monthKeys.map((m) =>
    transactions
      .filter((tx) => tx.type === 'expense' && tx.date && tx.date.startsWith(m))
      .reduce((sum, tx) => sum + tx.amount, 0)
  );
  const limitData = monthKeys.map(() => budgetLimit);

  const barColors = actualData.map((val) => {
    if (budgetLimit <= 0) return '#334155';
    const pct = (val / budgetLimit) * 100;
    if (pct >= 100) return '#dc2626';
    if (pct >= 80) return '#d97706';
    return '#2563eb';
  });

  budgetTrendChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Actual Spending',
          data: actualData,
          backgroundColor: barColors,
          borderRadius: 5,
          barPercentage: 0.55,
        },
        ...(budgetLimit > 0
          ? [
              {
                label: 'Monthly Budget',
                data: limitData,
                type: 'line',
                borderColor: '#0f172a',
                borderDash: [5, 5],
                borderWidth: 1.5,
                pointRadius: 0,
                fill: false,
              },
            ]
          : []),
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
