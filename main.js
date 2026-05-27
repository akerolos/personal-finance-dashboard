/**
 * FinVault — Personal Finance Dashboard
 * main.js  |  Vanilla JS · IIFE Pattern · Modular Architecture
 *
 * Modules:
 *  - StateManager   — single source of truth, localStorage persistence
 *  - UIRenderer     — all DOM updates driven by state
 *  - ChartRenderer  — bar chart & category breakdown
 *  - ModalManager   — add-transaction & confirm-delete modals
 *  - FilterManager  — search, type, category filters + sort
 *  - ToastManager   — lightweight notification system
 *  - App            — bootstrap, event wiring, orchestration
 */

'use strict';

(function FinVaultApp() {

  /* ══════════════════════════════════════════════════════════
     CONSTANTS
  ══════════════════════════════════════════════════════════ */
  const STORAGE_KEY = 'finvault_transactions_v1';

  const CATEGORY_ICONS = {
    'Salary':         '💼', 'Freelance':        '💻', 'Investment':  '📈',
    'Business':       '🏢', 'Gift':             '🎁', 'Other Income':'💰',
    'Housing':        '🏠', 'Food & Dining':    '🍔', 'Transportation':'🚗',
    'Healthcare':     '💊', 'Entertainment':    '🎮', 'Shopping':    '🛍️',
    'Education':      '📚', 'Utilities':        '⚡', 'Subscriptions':'📱',
    'Other Expense':  '📦',
  };

  const CATEGORY_COLORS = [
    '#10B981','#F43F5E','#818CF8','#38BDF8','#F59E0B',
    '#A78BFA','#34D399','#FB7185','#60A5FA','#FBBF24',
    '#C084FC','#4ADE80','#F87171','#7DD3FC','#FCD34D',
    '#E879F9',
  ];

  /* ══════════════════════════════════════════════════════════
     UTILITY HELPERS
  ══════════════════════════════════════════════════════════ */
  const Utils = (() => {
    function formatCurrency(amount) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 2,
      }).format(amount);
    }

    function formatDate(dateStr) {
      if (!dateStr) return '—';
      const d = new Date(dateStr + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function todayISO() {
      return new Date().toISOString().split('T')[0];
    }

    function generateId() {
      return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    function escapeHtml(str) {
      const div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    }

    function animateValue(el, from, to, duration = 350) {
      if (!el) return;
      const start = performance.now();
      const update = (time) => {
        const elapsed = time - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out-cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const current = from + (to - from) * eased;
        el.textContent = formatCurrency(current);
        if (progress < 1) requestAnimationFrame(update);
        else el.textContent = formatCurrency(to);
      };
      requestAnimationFrame(update);
    }

    function clamp(val, min, max) {
      return Math.min(Math.max(val, min), max);
    }

    return { formatCurrency, formatDate, todayISO, generateId, escapeHtml, animateValue, clamp };
  })();

  /* ══════════════════════════════════════════════════════════
     STATE MANAGER
  ══════════════════════════════════════════════════════════ */
  const StateManager = (() => {
    let state = {
      transactions: [],
    };

    function _persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
      } catch (e) {
        console.warn('FinVault: Could not persist to localStorage.', e);
      }
    }

    function _load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) state.transactions = parsed;
        }
      } catch (e) {
        console.warn('FinVault: Could not load from localStorage.', e);
      }
    }

    function getTransactions() { return [...state.transactions]; }

    function addTransaction(txData) {
      const tx = {
        id:       Utils.generateId(),
        title:    txData.title.trim(),
        amount:   parseFloat(txData.amount),
        type:     txData.type,     // 'income' | 'expense'
        category: txData.category,
        date:     txData.date,
        note:     txData.note ? txData.note.trim() : '',
        createdAt: Date.now(),
      };
      state.transactions.unshift(tx);
      _persist();
      return tx;
    }

    function deleteTransaction(id) {
      const idx = state.transactions.findIndex(t => t.id === id);
      if (idx === -1) return null;
      const removed = state.transactions.splice(idx, 1)[0];
      _persist();
      return removed;
    }

    function clearAll() {
      state.transactions = [];
      _persist();
    }

    function computeSummary() {
      const txs = state.transactions;
      const income  = txs.filter(t => t.type === 'income' ).reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const balance = income - expense;
      const savingsRate = income > 0 ? clamp(((income - expense) / income) * 100, 0, 100) : 0;
      return { income, expense, balance, savingsRate };
    }

    function getCategoryTotals() {
      const map = {};
      state.transactions.forEach(tx => {
        if (!map[tx.category]) map[tx.category] = { income: 0, expense: 0, type: tx.type };
        map[tx.category][tx.type] += tx.amount;
      });
      return map;
    }

    function getUniqueCategories() {
      return [...new Set(state.transactions.map(t => t.category))];
    }

    function clamp(val, min, max) { return Math.min(Math.max(val, min), max); }

    // Init — load persisted data
    _load();

    return {
      getTransactions,
      addTransaction,
      deleteTransaction,
      clearAll,
      computeSummary,
      getCategoryTotals,
      getUniqueCategories,
    };
  })();

  /* ══════════════════════════════════════════════════════════
     TOAST MANAGER
  ══════════════════════════════════════════════════════════ */
  const ToastManager = (() => {
    const container = document.getElementById('toastContainer');

    function show(message, type = 'success', duration = 3200) {
      const toast = document.createElement('div');
      toast.className = `toast toast--${type}`;
      toast.setAttribute('role', 'status');
      toast.innerHTML = `<span class="toast-dot" aria-hidden="true"></span>${Utils.escapeHtml(message)}`;
      container.appendChild(toast);

      setTimeout(() => {
        toast.classList.add('toast--exit');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
      }, duration);
    }

    return { show };
  })();

  /* ══════════════════════════════════════════════════════════
     CHART RENDERER
  ══════════════════════════════════════════════════════════ */
  const ChartRenderer = (() => {
    const barChartEl    = document.getElementById('barChartInner');
    const emptyState    = document.getElementById('chartEmptyState');
    const categoryEl    = document.getElementById('categoryBreakdown');
    const catEmptyEl    = document.getElementById('categoryEmptyState');

    function renderBarChart(transactions) {
      barChartEl.innerHTML = '';

      if (!transactions.length) {
        emptyState.style.display = 'flex';
        barChartEl.style.display = 'none';
        return;
      }

      emptyState.style.display = 'none';
      barChartEl.style.display = 'flex';

      // Group by category, take top 6
      const categoryMap = {};
      transactions.forEach(tx => {
        if (!categoryMap[tx.category]) categoryMap[tx.category] = { income: 0, expense: 0 };
        categoryMap[tx.category][tx.type] += tx.amount;
      });

      const entries = Object.entries(categoryMap)
        .sort((a, b) => (b[1].income + b[1].expense) - (a[1].income + a[1].expense))
        .slice(0, 7);

      if (!entries.length) return;

      const maxVal = Math.max(
        ...entries.map(([, v]) => Math.max(v.income, v.expense)),
        1
      );
      const MAX_BAR_H = 140; // px

      entries.forEach(([cat, vals]) => {
        const incomeH  = Math.max(Math.round((vals.income  / maxVal) * MAX_BAR_H), vals.income  > 0 ? 3 : 0);
        const expenseH = Math.max(Math.round((vals.expense / maxVal) * MAX_BAR_H), vals.expense > 0 ? 3 : 0);
        const shortLabel = cat.length > 8 ? cat.slice(0, 7) + '…' : cat;

        const group = document.createElement('div');
        group.className = 'bar-group';
        group.innerHTML = `
          <div class="bar-pair">
            ${vals.income > 0 ? `
              <div class="bar bar--income" style="height:${incomeH}px" role="img" aria-label="${cat} income ${Utils.formatCurrency(vals.income)}">
                <div class="bar-tooltip">${Utils.formatCurrency(vals.income)}</div>
              </div>` : '<div style="flex:1"></div>'}
            ${vals.expense > 0 ? `
              <div class="bar bar--expense" style="height:${expenseH}px" role="img" aria-label="${cat} expense ${Utils.formatCurrency(vals.expense)}">
                <div class="bar-tooltip">${Utils.formatCurrency(vals.expense)}</div>
              </div>` : '<div style="flex:1"></div>'}
          </div>
          <span class="bar-label" title="${cat}">${shortLabel}</span>
        `;
        barChartEl.appendChild(group);
      });
    }

    function renderCategoryBreakdown(transactions) {
      if (!transactions.length) {
        categoryEl.innerHTML = '';
        categoryEl.appendChild(catEmptyEl);
        catEmptyEl.style.display = '';
        return;
      }

      catEmptyEl.style.display = 'none';

      const map = {};
      transactions.forEach(tx => {
        if (!map[tx.category]) map[tx.category] = { total: 0, type: tx.type };
        map[tx.category].total += tx.amount;
      });

      const entries = Object.entries(map)
        .sort((a, b) => b[1].total - a[1].total);

      const maxTotal = entries[0]?.[1].total || 1;

      categoryEl.innerHTML = '';
      entries.forEach(([cat, { total, type }], i) => {
        const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
        const pct   = Utils.clamp((total / maxTotal) * 100, 2, 100);
        const item  = document.createElement('div');
        item.className = 'category-item';
        item.style.animationDelay = `${i * 40}ms`;
        item.innerHTML = `
          <div class="category-dot" style="background:${color}"></div>
          <div class="category-info">
            <div class="category-name">${Utils.escapeHtml(cat)}</div>
            <div class="category-bar">
              <div class="category-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
          </div>
          <span class="category-amount" style="color:${type === 'income' ? 'var(--income)' : 'var(--expense)'}">
            ${type === 'income' ? '+' : '-'}${Utils.formatCurrency(total)}
          </span>
        `;
        categoryEl.appendChild(item);
      });
    }

    return { renderBarChart, renderCategoryBreakdown };
  })();

  /* ══════════════════════════════════════════════════════════
     UI RENDERER
  ══════════════════════════════════════════════════════════ */
  const UIRenderer = (() => {
    // Metric card elements
    const elBalance    = document.getElementById('totalBalance');
    const elIncome     = document.getElementById('totalIncome');
    const elExpenses   = document.getElementById('totalExpenses');
    const elSavings    = document.getElementById('savingsRate');
    const elSavingsPrg = document.getElementById('savingsProgress');
    const elBalTrend   = document.getElementById('balanceTrend');
    const elIncomeCount= document.getElementById('incomeCount');
    const elExpCount   = document.getElementById('expenseCount');

    // Table elements
    const tbody        = document.getElementById('transactionsTbody');
    const tableEmpty   = document.getElementById('tableEmpty');
    const tableFooter  = document.getElementById('tableFooter');
    const tableCount   = document.getElementById('tableCount');
    const filterCatSel = document.getElementById('filterCategory');
    const currentDateEl= document.getElementById('currentDate');

    // Previous values for animation reference
    let prevBalance = 0;
    let prevIncome  = 0;
    let prevExpense = 0;

    function updateCurrentDate() {
      const now = new Date();
      currentDateEl.textContent = now.toLocaleDateString('en-US', {
        weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      });
    }

    function updateMetrics(animate = false) {
      const { income, expense, balance, savingsRate } = StateManager.computeSummary();
      const txs = StateManager.getTransactions();
      const incomeCount  = txs.filter(t => t.type === 'income').length;
      const expenseCount = txs.filter(t => t.type === 'expense').length;

      if (animate) {
        Utils.animateValue(elBalance, prevBalance, balance);
        Utils.animateValue(elIncome,  prevIncome,  income);
        Utils.animateValue(elExpenses,prevExpense, expense);

        [elBalance, elIncome, elExpenses].forEach(el => {
          el.classList.remove('animate-pulse');
          void el.offsetWidth; // reflow
          el.classList.add('animate-pulse');
        });
      } else {
        elBalance.textContent  = Utils.formatCurrency(balance);
        elIncome.textContent   = Utils.formatCurrency(income);
        elExpenses.textContent = Utils.formatCurrency(expense);
      }

      prevBalance = balance;
      prevIncome  = income;
      prevExpense = expense;

      // Savings rate
      elSavings.textContent = `${savingsRate.toFixed(1)}%`;
      elSavingsPrg.style.width = `${savingsRate}%`;
      elSavingsPrg.parentElement.setAttribute('aria-valuenow', savingsRate.toFixed(1));

      // Balance trend
      if (!txs.length) {
        elBalTrend.innerHTML = '<span class="trend-indicator trend-indicator--neutral">— No transactions yet</span>';
      } else if (balance > 0) {
        elBalTrend.innerHTML = `<span class="trend-indicator trend-indicator--up">↑ Positive balance</span>`;
      } else if (balance < 0) {
        elBalTrend.innerHTML = `<span class="trend-indicator trend-indicator--down">↓ Negative balance</span>`;
      } else {
        elBalTrend.innerHTML = `<span class="trend-indicator trend-indicator--neutral">● Break-even</span>`;
      }

      // Counts
      elIncomeCount.textContent  = `${incomeCount} transaction${incomeCount !== 1 ? 's' : ''}`;
      elExpCount.textContent     = `${expenseCount} transaction${expenseCount !== 1 ? 's' : ''}`;

      // Update filter category options
      _updateCategoryFilter();
    }

    function _updateCategoryFilter() {
      const current = filterCatSel.value;
      const cats = StateManager.getUniqueCategories();
      filterCatSel.innerHTML = '<option value="all">All Categories</option>' +
        cats.map(c => `<option value="${Utils.escapeHtml(c)}"${c === current ? ' selected' : ''}>${Utils.escapeHtml(c)}</option>`).join('');
    }

    function renderTransactions(filtered, totalCount) {
      tbody.innerHTML = '';

      if (!totalCount) {
        tableEmpty.style.display   = '';
        tableFooter.hidden         = true;
        return;
      }

      tableEmpty.style.display = 'none';
      tableFooter.hidden       = false;

      if (!filtered.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);font-size:0.85rem;">
              No transactions match your filters.
            </td>
          </tr>`;
        tableCount.textContent = `0 of ${totalCount} transactions`;
        return;
      }

      tableCount.textContent = `Showing ${filtered.length} of ${totalCount} transaction${totalCount !== 1 ? 's' : ''}`;

      filtered.forEach((tx, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'tr-enter';
        tr.dataset.id = tx.id;
        tr.style.animationDelay = `${idx * 25}ms`;

        const icon = CATEGORY_ICONS[tx.category] || (tx.type === 'income' ? '💰' : '💸');
        const amountStr = (tx.type === 'income' ? '+' : '-') + Utils.formatCurrency(tx.amount);

        tr.innerHTML = `
          <td>
            <div class="tx-title-cell">
              <div class="tx-icon tx-icon--${tx.type}">${icon}</div>
              <div>
                <span class="tx-title-text">${Utils.escapeHtml(tx.title)}</span>
                ${tx.note ? `<span class="tx-note">${Utils.escapeHtml(tx.note)}</span>` : ''}
              </div>
            </div>
          </td>
          <td><span class="category-pill">${Utils.escapeHtml(tx.category)}</span></td>
          <td><span class="tx-date">${Utils.formatDate(tx.date)}</span></td>
          <td><span class="tx-amount tx-amount--${tx.type}">${amountStr}</span></td>
          <td>
            <div class="tx-actions">
              <button class="tx-action-btn tx-action-btn--delete" data-action="delete" data-id="${tx.id}" aria-label="Delete transaction ${Utils.escapeHtml(tx.title)}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </button>
            </div>
          </td>
        `;

        tbody.appendChild(tr);
      });
    }

    return { updateMetrics, renderTransactions, updateCurrentDate };
  })();

  /* ══════════════════════════════════════════════════════════
     FILTER MANAGER
  ══════════════════════════════════════════════════════════ */
  const FilterManager = (() => {
    let currentSort  = { col: 'date', dir: 'desc' };
    let searchTerm   = '';
    let typeFilter   = 'all';
    let catFilter    = 'all';

    function _applyFilters(transactions) {
      let result = [...transactions];

      // Search
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        result = result.filter(tx =>
          tx.title.toLowerCase().includes(q) ||
          tx.category.toLowerCase().includes(q) ||
          (tx.note || '').toLowerCase().includes(q)
        );
      }

      // Type
      if (typeFilter !== 'all') result = result.filter(tx => tx.type === typeFilter);

      // Category
      if (catFilter !== 'all') result = result.filter(tx => tx.category === catFilter);

      return result;
    }

    function _applySort(transactions) {
      const { col, dir } = currentSort;
      return [...transactions].sort((a, b) => {
        let av, bv;
        if (col === 'amount') { av = a.amount;   bv = b.amount; }
        else if (col === 'date')  { av = a.date;    bv = b.date;   }
        else if (col === 'title') { av = a.title.toLowerCase(); bv = b.title.toLowerCase(); }
        else if (col === 'category') { av = a.category.toLowerCase(); bv = b.category.toLowerCase(); }
        else return 0;

        if (av < bv) return dir === 'asc' ? -1 :  1;
        if (av > bv) return dir === 'asc' ?  1 : -1;
        return 0;
      });
    }

    function setSearch(val)  { searchTerm = val; _refresh(); }
    function setType(val)    { typeFilter = val; _refresh(); }
    function setCategory(val){ catFilter  = val; _refresh(); }

    function toggleSort(col) {
      if (currentSort.col === col) {
        currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.col = col;
        currentSort.dir = 'desc';
      }
      _updateSortIcons();
      _refresh();
    }

    function _updateSortIcons() {
      document.querySelectorAll('.th-sortable').forEach(th => {
        const col = th.dataset.col;
        const icon = th.querySelector('.sort-icon');
        if (col === currentSort.col) {
          th.setAttribute('aria-sort', currentSort.dir === 'asc' ? 'ascending' : 'descending');
          icon.textContent = currentSort.dir === 'asc' ? '↑' : '↓';
        } else {
          th.setAttribute('aria-sort', 'none');
          icon.textContent = '';
        }
      });
    }

    function _refresh() {
      const all      = StateManager.getTransactions();
      const filtered = _applyFilters(all);
      const sorted   = _applySort(filtered);
      UIRenderer.renderTransactions(sorted, all.length);
    }

    function refresh() { _refresh(); }

    return { setSearch, setType, setCategory, toggleSort, refresh };
  })();

  /* ══════════════════════════════════════════════════════════
     MODAL MANAGER
  ══════════════════════════════════════════════════════════ */
  const ModalManager = (() => {
    // Elements
    const backdrop     = document.getElementById('modalBackdrop');
    const closeBtn     = document.getElementById('closeModalBtn');
    const cancelBtn    = document.getElementById('cancelModalBtn');
    const form         = document.getElementById('transactionForm');
    const typeBtns     = document.querySelectorAll('.type-btn');

    // Confirm modal
    const confirmBd    = document.getElementById('confirmBackdrop');
    const cancelDelBtn = document.getElementById('cancelDeleteBtn');
    const confirmDelBtn= document.getElementById('confirmDeleteBtn');
    const confirmMsg   = document.getElementById('confirmMessage');

    // Form fields
    const txTitle    = document.getElementById('txTitle');
    const txAmount   = document.getElementById('txAmount');
    const txCategory = document.getElementById('txCategory');
    const txDate     = document.getElementById('txDate');
    const txNote     = document.getElementById('txNote');

    // Error spans
    const errTitle    = document.getElementById('txTitleError');
    const errAmount   = document.getElementById('txAmountError');
    const errCategory = document.getElementById('txCategoryError');
    const errDate     = document.getElementById('txDateError');

    let selectedType    = 'income';
    let pendingDeleteId = null;

    function openAddModal() {
      _resetForm();
      backdrop.hidden = false;
      // Set today's date as default
      txDate.value = Utils.todayISO();
      requestAnimationFrame(() => txTitle.focus());
      document.body.style.overflow = 'hidden';
    }

    function closeAddModal() {
      backdrop.hidden = true;
      document.body.style.overflow = '';
      _clearErrors();
    }

    function _resetForm() {
      form.reset();
      selectedType = 'income';
      _setActiveType('income');
      txDate.value = Utils.todayISO();
      _clearErrors();
    }

    function _setActiveType(type) {
      selectedType = type;
      typeBtns.forEach(btn => {
        const isActive = btn.dataset.type === type;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    }

    function _clearErrors() {
      [errTitle, errAmount, errCategory, errDate].forEach(el => el.textContent = '');
      [txTitle, txAmount, txCategory, txDate].forEach(el => {
        el.classList.remove('is-invalid');
        el.closest('.input-with-prefix')?.classList.remove('is-invalid');
      });
    }

    function _validate() {
      let valid = true;
      _clearErrors();

      if (!txTitle.value.trim()) {
        errTitle.textContent = 'Title is required.';
        txTitle.classList.add('is-invalid');
        valid = false;
      } else if (txTitle.value.trim().length < 2) {
        errTitle.textContent = 'Title must be at least 2 characters.';
        txTitle.classList.add('is-invalid');
        valid = false;
      }

      const amt = parseFloat(txAmount.value);
      if (!txAmount.value) {
        errAmount.textContent = 'Amount is required.';
        txAmount.closest('.input-with-prefix').classList.add('is-invalid');
        valid = false;
      } else if (isNaN(amt) || amt <= 0) {
        errAmount.textContent = 'Enter a valid amount greater than 0.';
        txAmount.closest('.input-with-prefix').classList.add('is-invalid');
        valid = false;
      } else if (amt > 999999999) {
        errAmount.textContent = 'Amount is too large.';
        txAmount.closest('.input-with-prefix').classList.add('is-invalid');
        valid = false;
      }

      if (!txCategory.value) {
        errCategory.textContent = 'Please select a category.';
        txCategory.classList.add('is-invalid');
        valid = false;
      }

      if (!txDate.value) {
        errDate.textContent = 'Date is required.';
        txDate.classList.add('is-invalid');
        valid = false;
      }

      if (!valid) {
        // Focus first invalid field
        const firstInvalid = form.querySelector('.is-invalid');
        firstInvalid?.focus();
      }

      return valid;
    }

    function _handleSubmit(e) {
      e.preventDefault();
      if (!_validate()) return;

      const txData = {
        title:    txTitle.value,
        amount:   txAmount.value,
        type:     selectedType,
        category: txCategory.value,
        date:     txDate.value,
        note:     txNote.value,
      };

      StateManager.addTransaction(txData);
      closeAddModal();
      App.refreshAll(true);
      ToastManager.show(
        `${selectedType === 'income' ? 'Income' : 'Expense'} "${txData.title}" added successfully!`,
        'success'
      );
    }

    function openConfirmDelete(id, title) {
      pendingDeleteId = id;
      confirmMsg.textContent = `"${title}" will be permanently deleted.`;
      confirmBd.hidden = false;
      document.body.style.overflow = 'hidden';
      confirmDelBtn.focus();
    }

    function closeConfirmDelete() {
      confirmBd.hidden = true;
      pendingDeleteId  = null;
      document.body.style.overflow = '';
    }

    function _handleConfirmDelete() {
      if (!pendingDeleteId) return;
      const removed = StateManager.deleteTransaction(pendingDeleteId);
      closeConfirmDelete();
      App.refreshAll(false);
      if (removed) ToastManager.show(`"${removed.title}" deleted.`, 'info');
    }

    // Type toggle
    typeBtns.forEach(btn => {
      btn.addEventListener('click', () => _setActiveType(btn.dataset.type));
    });

    // Form submit
    form.addEventListener('submit', _handleSubmit);

    // Close buttons
    closeBtn.addEventListener('click', closeAddModal);
    cancelBtn.addEventListener('click', closeAddModal);

    // Backdrop click to close
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAddModal();
    });

    // Confirm modal
    confirmDelBtn.addEventListener('click', _handleConfirmDelete);
    cancelDelBtn.addEventListener('click', closeConfirmDelete);
    confirmBd.addEventListener('click', (e) => {
      if (e.target === confirmBd) closeConfirmDelete();
    });

    // Keyboard: Escape closes
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (!backdrop.hidden) closeAddModal();
      if (!confirmBd.hidden) closeConfirmDelete();
    });

    // Real-time validation clear on input
    txTitle.addEventListener('input', () => {
      if (txTitle.value.trim()) { txTitle.classList.remove('is-invalid'); errTitle.textContent = ''; }
    });
    txAmount.addEventListener('input', () => {
      const val = parseFloat(txAmount.value);
      if (!isNaN(val) && val > 0) {
        txAmount.closest('.input-with-prefix').classList.remove('is-invalid');
        errAmount.textContent = '';
      }
    });
    txCategory.addEventListener('change', () => {
      if (txCategory.value) { txCategory.classList.remove('is-invalid'); errCategory.textContent = ''; }
    });
    txDate.addEventListener('input', () => {
      if (txDate.value) { txDate.classList.remove('is-invalid'); errDate.textContent = ''; }
    });

    return { openAddModal, closeAddModal, openConfirmDelete };
  })();

  /* ══════════════════════════════════════════════════════════
     SIDEBAR / MOBILE MANAGER
  ══════════════════════════════════════════════════════════ */
  const SidebarManager = (() => {
    const sidebar  = document.getElementById('sidebar');
    const hamburger= document.getElementById('hamburgerBtn');
    const overlay  = document.getElementById('sidebarOverlay');
    let isOpen     = false;

    function open() {
      isOpen = true;
      sidebar.classList.add('is-open');
      overlay.classList.add('is-visible');
      hamburger.classList.add('is-open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }

    function close() {
      isOpen = false;
      sidebar.classList.remove('is-open');
      overlay.classList.remove('is-visible');
      hamburger.classList.remove('is-open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    }

    function toggle() { isOpen ? close() : open(); }

    hamburger.addEventListener('click', toggle);
    overlay.addEventListener('click', close);

    // Close on nav link click (mobile)
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-link').forEach(l => {
          l.classList.remove('active');
          l.setAttribute('aria-current', 'false');
        });
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
        if (window.innerWidth <= 768) close();
        // Show coming-soon toast for non-dashboard links
        if (link.dataset.view !== 'dashboard') {
          ToastManager.show(`"${link.querySelector('span').textContent}" section coming soon!`, 'info');
        }
      });
    });

    return { open, close, toggle };
  })();

  /* ══════════════════════════════════════════════════════════
     APP — Bootstrap & Event Wiring
  ══════════════════════════════════════════════════════════ */
  const App = (() => {
    function refreshAll(animate = false) {
      const all = StateManager.getTransactions();

      // Metrics
      UIRenderer.updateMetrics(animate);

      // Charts
      ChartRenderer.renderBarChart(all);
      ChartRenderer.renderCategoryBreakdown(all);

      // Table (re-apply current filters)
      FilterManager.refresh();
    }

    function init() {
      // Date
      UIRenderer.updateCurrentDate();

      // Initial render from persisted data
      refreshAll(false);

      // ── Open modal buttons ──
      const openModal = () => ModalManager.openAddModal();
      document.getElementById('addTransactionBtn')?.addEventListener('click', openModal);
      document.getElementById('mobileAddBtn')?.addEventListener('click', openModal);
      document.getElementById('emptyStateAddBtn')?.addEventListener('click', openModal);

      // ── Table: delegated delete ──
      document.getElementById('transactionsTbody').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="delete"]');
        if (!btn) return;
        const id   = btn.dataset.id;
        const title= btn.closest('tr')?.querySelector('.tx-title-text')?.textContent || 'this transaction';
        ModalManager.openConfirmDelete(id, title);
      });

      // ── Filters ──
      document.getElementById('searchInput').addEventListener('input', (e) => {
        FilterManager.setSearch(e.target.value);
      });
      document.getElementById('filterType').addEventListener('change', (e) => {
        FilterManager.setType(e.target.value);
      });
      document.getElementById('filterCategory').addEventListener('change', (e) => {
        FilterManager.setCategory(e.target.value);
      });

      // ── Sort headers ──
      document.querySelectorAll('.th-sortable').forEach(th => {
        th.addEventListener('click', () => FilterManager.toggleSort(th.dataset.col));
        th.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            FilterManager.toggleSort(th.dataset.col);
          }
        });
        th.setAttribute('tabindex', '0');
      });

      // ── Clear All ──
      document.getElementById('clearAllBtn').addEventListener('click', () => {
        ModalManager.openConfirmDelete('__all__', 'ALL transactions');
        // Override confirm handler for clearing all
        const confirmBtn = document.getElementById('confirmDeleteBtn');
        const originalOnClick = confirmBtn.onclick;
        confirmBtn.onclick = () => {
          StateManager.clearAll();
          document.getElementById('confirmBackdrop').hidden = true;
          document.body.style.overflow = '';
          refreshAll(false);
          ToastManager.show('All transactions cleared.', 'info');
          confirmBtn.onclick = originalOnClick;
        };
      });

      // ── Keyboard shortcut: Ctrl+N / Cmd+N to add ──
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
          e.preventDefault();
          ModalManager.openAddModal();
        }
      });

      console.log('%c FinVault Loaded ✓', 'color:#10B981;font-weight:bold;font-size:14px;');
    }

    return { init, refreshAll };
  })();

  /* ── Bootstrap ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.init);
  } else {
    App.init();
  }

})();
