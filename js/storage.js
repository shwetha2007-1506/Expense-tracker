/**
 * storage.js
 * Centralized persistence layer using LocalStorage.
 *
 * Designed as a clean data-access boundary so that LocalStorage calls can be
 * replaced with REST API requests (Node.js / Express / SQL) without modifying
 * UI components or calculation logic.
 */

const STORAGE_KEYS = {
  TRANSACTIONS: 'clearledger_transactions',
  BUDGET: 'clearledger_budget',
  INITIALIZED: 'clearledger_initialized',
};

const DEFAULT_BUDGET = {
  monthlyLimit: 3200,
  updatedAt: '2026-11-01',
};

const SAMPLE_TRANSACTIONS = [
  {
    id: 'tx_202611_01',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-11-01',
    description: 'Primary engineering payroll deposit',
  },
  {
    id: 'tx_202611_02',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-11-02',
    description: 'November lease payment',
  },
  {
    id: 'tx_202611_03',
    title: 'Grocery Shopping',
    amount: 340,
    category: 'Food',
    type: 'expense',
    date: '2026-11-04',
    description: 'Weekly groceries and household staples',
  },
  {
    id: 'tx_202611_04',
    title: 'Electric & Fiber Internet',
    amount: 195,
    category: 'Utilities',
    type: 'expense',
    date: '2026-11-06',
    description: 'Monthly utility and broadband bill',
  },
  {
    id: 'tx_202611_05',
    title: 'UI Consulting Retainer',
    amount: 850,
    category: 'Freelance',
    type: 'income',
    date: '2026-11-08',
    description: 'Design system audit invoice #104',
  },
  {
    id: 'tx_202611_06',
    title: 'Metro Pass & Fuel',
    amount: 145,
    category: 'Transport',
    type: 'expense',
    date: '2026-11-09',
    description: 'Monthly transit pass and rideshare',
  },
  {
    id: 'tx_202611_07',
    title: 'Dental Checkup',
    amount: 180,
    category: 'Healthcare',
    type: 'expense',
    date: '2026-11-11',
    description: 'Routine preventive cleaning copay',
  },
  {
    id: 'tx_202611_08',
    title: 'Weekend Farmers Market',
    amount: 170,
    category: 'Food',
    type: 'expense',
    date: '2026-11-13',
    description: 'Fresh produce and pantry items',
  },
  {
    id: 'tx_202610_01',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-10-01',
    description: 'October payroll deposit',
  },
  {
    id: 'tx_202610_02',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-10-02',
    description: 'October lease payment',
  },
  {
    id: 'tx_202610_03',
    title: 'Supermarket & Dining',
    amount: 520,
    category: 'Food',
    type: 'expense',
    date: '2026-10-12',
    description: 'Monthly groceries and team lunch',
  },
  {
    id: 'tx_202610_04',
    title: 'Utilities & Water',
    amount: 210,
    category: 'Utilities',
    type: 'expense',
    date: '2026-10-15',
    description: 'Power, water, and internet service',
  },
  {
    id: 'tx_202610_05',
    title: 'Winter Coat',
    amount: 290,
    category: 'Shopping',
    type: 'expense',
    date: '2026-10-20',
    description: 'Seasonal outerwear replacement',
  },
  {
    id: 'tx_202610_06',
    title: 'Concert & Cinema',
    amount: 135,
    category: 'Entertainment',
    type: 'expense',
    date: '2026-10-25',
    description: 'Weekend tickets',
  },
  {
    id: 'tx_202609_01',
    title: 'Monthly Salary',
    amount: 5400,
    category: 'Salary',
    type: 'income',
    date: '2026-09-01',
    description: 'September payroll deposit',
  },
  {
    id: 'tx_202609_02',
    title: 'Dividend Distribution',
    amount: 320,
    category: 'Investments',
    type: 'income',
    date: '2026-09-14',
    description: 'Quarterly index fund payout',
  },
  {
    id: 'tx_202609_03',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-09-02',
    description: 'September lease payment',
  },
  {
    id: 'tx_202609_04',
    title: 'Groceries & Coffee',
    amount: 465,
    category: 'Food',
    type: 'expense',
    date: '2026-09-16',
    description: 'Monthly food expenses',
  },
  {
    id: 'tx_202609_05',
    title: 'Train Tickets',
    amount: 190,
    category: 'Transport',
    type: 'expense',
    date: '2026-09-22',
    description: 'Regional rail round trip',
  },
  {
    id: 'tx_202608_01',
    title: 'Monthly Salary',
    amount: 5200,
    category: 'Salary',
    type: 'income',
    date: '2026-08-01',
    description: 'August payroll deposit',
  },
  {
    id: 'tx_202608_02',
    title: 'Apartment Rent',
    amount: 1650,
    category: 'Housing',
    type: 'expense',
    date: '2026-08-02',
    description: 'August lease payment',
  },
  {
    id: 'tx_202608_03',
    title: 'Groceries & Household',
    amount: 480,
    category: 'Food',
    type: 'expense',
    date: '2026-08-14',
    description: 'August food and supplies',
  },
  {
    id: 'tx_202608_04',
    title: 'Online Course Subscription',
    amount: 120,
    category: 'Education',
    type: 'expense',
    date: '2026-08-19',
    description: 'Database architecture workshop',
  },
];

/**
 * Generates a unique transaction identifier.
 */
export function generateTransactionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `tx_${crypto.randomUUID().slice(0, 8)}`;
  }
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Normalizes a transaction object to the canonical schema.
 * @param {object} raw
 */
function normalizeTransaction(raw) {
  return {
    id: String(raw.id || generateTransactionId()),
    title: String(raw.title || '').trim(),
    amount: Number(Number(raw.amount || 0).toFixed(2)),
    category: String(raw.category || 'Other').trim(),
    type: raw.type === 'income' ? 'income' : 'expense',
    date: String(raw.date || ''),
    description: String(raw.description || '').trim(),
  };
}

/**
 * Seeds sample data only once on first application load.
 */
export function initializeStorage() {
  try {
    const initialized = localStorage.getItem(STORAGE_KEYS.INITIALIZED);
    if (!initialized) {
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(SAMPLE_TRANSACTIONS));
      localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(DEFAULT_BUDGET));
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    }
  } catch (error) {
    console.error('Failed to initialize storage:', error);
  }
}

/**
 * Retrieves all transactions from LocalStorage.
 * @returns {Array<object>}
 */
export function getTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeTransaction);
  } catch (error) {
    console.error('Failed to read transactions from LocalStorage:', error);
    return [];
  }
}

/**
 * Replaces the full transactions list in LocalStorage.
 * @param {Array<object>} transactions
 */
export function saveTransactions(transactions) {
  try {
    const normalized = Array.isArray(transactions)
      ? transactions.map(normalizeTransaction)
      : [];
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(normalized));
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    return normalized;
  } catch (error) {
    console.error('Failed to save transactions to LocalStorage:', error);
    throw error;
  }
}

/**
 * Adds a new transaction and persists it.
 * @param {object} transactionInput
 */
export function addTransaction(transactionInput) {
  const existing = getTransactions();
  const newTransaction = normalizeTransaction({
    ...transactionInput,
    id: generateTransactionId(),
  });
  const next = [newTransaction, ...existing];
  saveTransactions(next);
  return newTransaction;
}

/**
 * Updates an existing transaction by ID.
 * @param {string} id
 * @param {object} updates
 */
export function updateTransaction(id, updates) {
  const existing = getTransactions();
  let updatedRecord = null;
  const next = existing.map((item) => {
    if (item.id === id) {
      updatedRecord = normalizeTransaction({ ...item, ...updates, id });
      return updatedRecord;
    }
    return item;
  });
  if (!updatedRecord) {
    throw new Error(`Transaction with ID "${id}" not found.`);
  }
  saveTransactions(next);
  return updatedRecord;
}

/**
 * Deletes a transaction by ID.
 * @param {string} id
 */
export function deleteTransaction(id) {
  const existing = getTransactions();
  const next = existing.filter((item) => item.id !== id);
  saveTransactions(next);
  return next;
}

/**
 * Retrieves budget configuration from LocalStorage.
 * @returns {{ monthlyLimit: number, updatedAt: string }}
 */
export function getBudgetInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BUDGET);
    if (!raw) {
      return { monthlyLimit: 0, updatedAt: '' };
    }
    const parsed = JSON.parse(raw);
    return {
      monthlyLimit: Number.isFinite(Number(parsed.monthlyLimit))
        ? Math.max(0, Number(parsed.monthlyLimit))
        : 0,
      updatedAt: String(parsed.updatedAt || ''),
    };
  } catch (error) {
    console.error('Failed to read budget info from LocalStorage:', error);
    return { monthlyLimit: 0, updatedAt: '' };
  }
}

/**
 * Saves budget configuration to LocalStorage.
 * @param {{ monthlyLimit: number }} budgetInput
 */
export function saveBudgetInfo(budgetInput) {
  try {
    const limit = Math.max(0, Number(Number(budgetInput.monthlyLimit || 0).toFixed(2)));
    const record = {
      monthlyLimit: limit,
      updatedAt: new Date().toISOString().slice(0, 10),
    };
    localStorage.setItem(STORAGE_KEYS.BUDGET, JSON.stringify(record));
    return record;
  } catch (error) {
    console.error('Failed to save budget info to LocalStorage:', error);
    throw error;
  }
}

/**
 * Clears all transactions and resets budget to 0.
 */
export function clearAllData() {
  saveTransactions([]);
  saveBudgetInfo({ monthlyLimit: 0 });
}

/**
 * Restores the built-in sample dataset and default budget.
 */
export function restoreSampleData() {
  saveTransactions(SAMPLE_TRANSACTIONS);
  saveBudgetInfo(DEFAULT_BUDGET);
}
