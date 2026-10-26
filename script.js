"use strict";

const CATEGORIES = [
  { name: "Food and drinks", icon: "☕", color: "#7c9bff" },
  { name: "Transport", icon: "↗", color: "#63d7ba" },
  { name: "School expenses", icon: "▤", color: "#c3a0ff" },
  { name: "Shopping", icon: "◇", color: "#ffb86b" },
  { name: "Entertainment", icon: "♫", color: "#ff8ca0" },
  { name: "Health", icon: "✚", color: "#79d8ed" },
  { name: "Subscriptions", icon: "◉", color: "#d7a4ff" },
  { name: "Other", icon: "✦", color: "#a6b0c3" }
];

const STORAGE_KEY = "ex-spend-v1";

const $ = id => document.getElementById(id);

const money = amount =>
  "RM " + Number(amount || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

function localDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function currentMonth() {
  return localDate().slice(0, 7);
}

function formatDate(date) {
  if (!date) return "—";

  return new Date(date + "T12:00:00").toLocaleDateString("en-MY", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function getCategory(name) {
  return CATEGORIES.find(category => category.name === name)
    || CATEGORIES[CATEGORIES.length - 1];
}

// Load previously saved information.
function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved && Array.isArray(saved.expenses)) {
      return {
        budget: Number(saved.budget) > 0 ? Number(saved.budget) : 300,
        expenses: saved.expenses.filter(expense =>
          expense &&
          typeof expense.id === "string" &&
          typeof expense.title === "string" &&
          Number.isFinite(Number(expense.amount)) &&
          Number(expense.amount) > 0 &&
          /^\d{4}-\d{2}-\d{2}$/.test(expense.date || "")
        )
      };
    }
  } catch (error) {
    console.error("Could not load saved data:", error);
  }

  return { budget: 300, expenses: [] };
}

let state = loadData();
let toastTimer;

// Save information to this browser.
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (error) {
    console.error("Could not save data:", error);
    showToast("Unable to save data in this browser.");
    return false;
  }
}

function showToast(message) {
  const toast = $("toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

function selectedMonthExpenses() {
  const month = $("monthFilter").value || currentMonth();

  return state.expenses.filter(expense =>
    expense.date.slice(0, 7) === month
  );
}

function totalExpenses(expenses) {
  return expenses.reduce(
    (total, expense) => total + Number(expense.amount),
    0
  );
}

function sortNewestFirst(a, b) {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

// Populate category menus.
function setupCategories() {
  $("expenseCategory").innerHTML = CATEGORIES.map(category =>
    `<option value="${escapeHTML(category.name)}">
      ${escapeHTML(category.name)}
    </option>`
  ).join("");

  $("categoryFilter").innerHTML =
    '<option value="all">All categories</option>' +
    CATEGORIES.map(category =>
      `<option value="${escapeHTML(category.name)}">
        ${escapeHTML(category.name)}
      </option>`
    ).join("");
}

// Update dashboard figures.
function renderDashboard() {
  const expenses = selectedMonthExpenses();
  const spent = totalExpenses(expenses);
  const remaining = state.budget - spent;
  const percentage = state.budget > 0
    ? spent / state.budget * 100
    : 0;

  $("totalSpent").textContent = money(spent);
  $("budgetLeft").textContent = money(remaining);
  $("budgetAmount").textContent = money(state.budget);

  $("budgetLeft").style.color =
    remaining < 0 ? "var(--red)" : "var(--text)";

  $("leftCaption").textContent =
    remaining < 0
      ? `${money(Math.abs(remaining))} over budget`
      : "Room to make it count";

  $("budgetPercent").textContent = `${Math.round(percentage)}%`;

  $("budgetMaximum").textContent =
    money(state.budget).replace(/\.00$/, "");

  $("budgetProgress").style.width =
    `${Math.min(100, Math.max(0, percentage))}%`;

  $("budgetProgress").className =
    percentage >= 100
      ? "danger"
      : percentage >= 75
        ? "warning"
        : "";

  const status = $("budgetStatus");

  status.className =
    "pill" +
    (percentage >= 100
      ? " danger"
      : percentage >= 75
        ? " warning"
        : "");

  status.textContent =
    percentage >= 100
      ? "Budget exceeded"
      : percentage >= 75
        ? "Getting close"
        : "On track";

  let message = "✦ You're starting fresh. Make every ringgit count.";

  if (spent > 0 && percentage < 75) {
    message = "✦ You're within your budget. Keep checking your spending.";
  } else if (percentage >= 75 && percentage < 100) {
    message = "✦ You're getting close to your limit. Prioritise essentials.";
  } else if (percentage >= 100) {
    message = "✦ You've reached your budget. Review non-essential spending.";
  }

  $("budgetMessage").textContent = message;

  renderCategoryBreakdown(expenses, spent);

  renderTransactionRows(
    $("recentTransactions"),
    expenses.slice().sort(sortNewestFirst).slice(0, 5)
  );
}

// Calculate and display category totals.
function renderCategoryBreakdown(expenses, total) {
  const totals = CATEGORIES.map(category => ({
    ...category,
    amount: totalExpenses(
      expenses.filter(expense => expense.category === category.name)
    )
  }))
    .filter(category => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const container = $("categoryBreakdown");

  if (!totals.length) {
    container.innerHTML =
      '<p class="empty">Your categories will appear here once you add expenses.</p>';
    return;
  }

  container.innerHTML = totals.map(category => {
    const percentage = total > 0
      ? category.amount / total * 100
      : 0;

    return `
      <div class="category-row">
        <span class="category-name">${escapeHTML(category.name)}</span>
        <div class="category-track">
          <span style="width:${percentage}%;background:${category.color}"></span>
        </div>
        <span class="category-amount">${money(category.amount)}</span>
      </div>
    `;
  }).join("");
}

// Render transaction tables.
function renderTransactionRows(container, expenses) {
  if (!expenses.length) {
    container.innerHTML = `
      <tr>
        <td colspan="5" class="empty">
          No expenses found. Add an expense to see it here.
        </td>
      </tr>
    `;
    return;
  }

  container.innerHTML = expenses.map(expense => {
    const category = getCategory(expense.category);
    const title = escapeHTML(expense.title);
    const note = expense.note
      ? `title="${escapeHTML(expense.note)}"`
      : "";

    return `
      <tr>
        <td>
          <div class="transaction-title">
            <span class="transaction-icon"
              style="color:${category.color}">
              ${category.icon}
            </span>
            <span ${note}>${title}</span>
          </div>
        </td>
        <td>
          <span class="category-tag">
            ${escapeHTML(expense.category)}
          </span>
        </td>
        <td>${formatDate(expense.date)}</td>
        <td class="amount-cell">${money(expense.amount)}</td>
        <td>
          <button
            class="delete-btn"
            data-delete="${escapeHTML(expense.id)}"
            aria-label="Delete ${title}"
            title="Delete expense"
          >×</button>
        </td>
      </tr>
    `;
  }).join("");
}

// Search and filter transaction history.
function renderTransactions() {
  const search = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;

  const expenses = selectedMonthExpenses()
    .slice()
    .sort(sortNewestFirst)
    .filter(expense => {
      const searchableText = [
        expense.title,
        expense.category,
        expense.note || ""
      ].join(" ").toLowerCase();

      return searchableText.includes(search) &&
        (category === "all" || expense.category === category);
    });

  $("transactionCount").textContent =
    `${expenses.length} transaction${expenses.length === 1 ? "" : "s"}`;

  renderTransactionRows($("allTransactions"), expenses);
}

// Generate basic spending insights.
function renderInsights() {
  const expenses = selectedMonthExpenses();
  const spent = totalExpenses(expenses);

  $("insightTotal").textContent = money(spent);

  $("averageExpense").textContent = money(
    expenses.length ? spent / expenses.length : 0
  );

  const categoryTotals = CATEGORIES.map(category => ({
    ...category,
    amount: totalExpenses(
      expenses.filter(expense => expense.category === category.name)
    )
  }))
    .filter(category => category.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  if (!expenses.length) {
    $("insightHeadline").textContent = "Start with one small step.";
    $("insightCopy").textContent =
      "Add some expenses to discover your spending patterns.";

    $("topCategory").textContent = "Not enough data yet";
    $("topCategoryCopy").textContent =
      "Record expenses to see where your money goes.";

    return;
  }

  const percentage = spent / state.budget * 100;

  if (percentage >= 100) {
    $("insightHeadline").textContent = "You've used your full budget.";
    $("insightCopy").textContent =
      "Your recorded spending has reached or exceeded your budget. Review your transactions and priorities.";
  } else if (percentage >= 75) {
    $("insightHeadline").textContent = "You're approaching your limit.";
    $("insightCopy").textContent =
      "You've used a large part of your budget. Consider your priorities before making non-essential purchases.";
  } else {
    $("insightHeadline").textContent = "You're building awareness.";
    $("insightCopy").textContent =
      "Tracking your spending is a useful first step. Keep recording expenses to understand your habits.";
  }

  const top = categoryTotals[0];

  $("topCategory").textContent = top.name;

  $("topCategoryCopy").textContent =
    `${Math.round(top.amount / spent * 100)}% of recorded spending this month (${money(top.amount)}).`;
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderInsights();
}

// Switch between the three app sections.
function setView(view) {
  document.querySelectorAll(".view").forEach(section => {
    section.classList.remove("active");
  });

  const target = $(`${view}View`);

  if (!target) return;

  target.classList.add("active");

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const pageText = {
    dashboard: [
      "Your money, in focus.",
      "A clearer view of what comes in and what goes out."
    ],
    transactions: [
      "Know where it went.",
      "Every expense tells a story. Keep yours organised."
    ],
    insights: [
      "Make your money make sense.",
      "Notice your patterns. Make more intentional choices."
    ]
  };

  $("pageTitle").textContent = pageText[view][0];
  $("pageSubtitle").textContent = pageText[view][1];

  if (view === "transactions") renderTransactions();
  if (view === "insights") renderInsights();
}

// Open and close forms.
function openExpenseDialog() {
  $("expenseForm").reset();
  $("expenseDate").value = localDate();
  $("formError").textContent = "";
  $("expenseDialog").showModal();
  $("expenseTitle").focus();
}

function closeDialog(id) {
  const dialog = $(id);

  if (dialog.open) dialog.close();
}

// Add a new expense.
function handleAddExpense(event) {
  event.preventDefault();

  const title = $("expenseTitle").value.trim();
  const amount = Number($("expenseAmount").value);
  const date = $("expenseDate").value;
  const category = $("expenseCategory").value;
  const note = $("expenseNote").value.trim();

  const error = $("formError");
  error.textContent = "";

  if (!title) {
    error.textContent = "Please enter an expense name.";
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    error.textContent = "Enter an amount greater than RM 0.";
    return;
  }

  if (amount > 1000000) {
    error.textContent = "Please enter an amount below RM 1,000,000.";
    return;
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    error.textContent = "Please choose a valid date.";
    return;
  }

  const expense = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    amount: Math.round(amount * 100) / 100,
    date,
    category,
    note
  };

  state.expenses.push(expense);

  if (!saveData()) {
    state.expenses.pop();
    return;
  }

  // Show the month containing the newly added expense.
  $("monthFilter").value = date.slice(0, 7);

  closeDialog("expenseDialog");
  renderAll();
  showToast("Expense added successfully.");
}

// Delete an expense after confirmation.
function deleteExpense(id) {
  const expense = state.expenses.find(item => item.id === id);

  if (!expense) return;

  const confirmed = window.confirm(
    `Delete "${expense.title}"? This cannot be undone.`
  );

  if (!confirmed) return;

  const previousExpenses = state.expenses;

  state.expenses = state.expenses.filter(item => item.id !== id);

  if (!saveData()) {
    state.expenses = previousExpenses;
    return;
  }

  renderAll();
  showToast("Expense deleted.");
}

// Update the monthly budget.
function handleBudgetSave(event) {
  event.preventDefault();

  const value = Number($("budgetInput").value);

  if (!Number.isFinite(value) || value < 1 || value > 1000000) {
    showToast("Enter a budget between RM 1 and RM 1,000,000.");
    return;
  }

  const previousBudget = state.budget;

  state.budget = Math.round(value * 100) / 100;

  if (!saveData()) {
    state.budget = previousBudget;
    return;
  }

  closeDialog("budgetDialog");
  renderAll();
  showToast("Monthly budget updated.");
}

// Start the app.
function init() {
  $("monthFilter").value = currentMonth();
  $("year").textContent = new Date().getFullYear();

  setupCategories();
  renderAll();

  $("addExpenseBtn").addEventListener("click", openExpenseDialog);

  $("closeExpense").addEventListener("click", () => {
    closeDialog("expenseDialog");
  });

  $("cancelExpense").addEventListener("click", () => {
    closeDialog("expenseDialog");
  });

  $("expenseForm").addEventListener("submit", handleAddExpense);

  $("monthFilter").addEventListener("change", renderAll);

  $("editBudgetBtn").addEventListener("click", () => {
    $("budgetInput").value = state.budget;
    $("budgetDialog").showModal();
  });

  $("closeBudget").addEventListener("click", () => {
    closeDialog("budgetDialog");
  });

  $("cancelBudget").addEventListener("click", () => {
    closeDialog("budgetDialog");
  });

  $("budgetForm").addEventListener("submit", handleBudgetSave);

  $("searchInput").addEventListener("input", renderTransactions);

  $("categoryFilter").addEventListener("change", renderTransactions);

  document.querySelectorAll(".nav-btn").forEach(button => {
    button.addEventListener("click", () => {
      setView(button.dataset.view);
    });
  });

  document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
      setView(button.dataset.goto);
    });
  });

  document.addEventListener("click", event => {
    const deleteButton = event.target.closest("[data-delete]");

    if (deleteButton) {
      deleteExpense(deleteButton.dataset.delete);
    }
  });

  // Close dialogs when the user clicks outside the form.
  ["expenseDialog", "budgetDialog"].forEach(id => {
    $(id).addEventListener("click", event => {
      if (event.target === $(id)) closeDialog(id);
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
