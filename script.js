"use strict";

const CATEGORIES = [
  { name: "Food & Drinks", icon: "☕", color: "#d4a373" },
  { name: "Transport", icon: "🚌", color: "#81b29a" },
  { name: "Books & School", icon: "📚", color: "#f4a261" },
  { name: "Shopping", icon: "🛍️", color: "#e76f51" },
  { name: "Entertainment", icon: "🎬", color: "#c084fc" },
  { name: "Health", icon: "💊", color: "#e07a5f" },
  { name: "Subscriptions", icon: "📱", color: "#2a9d8f" },
  { name: "Other", icon: "✨", color: "#ad9a8e" }
];

const STORAGE_KEY = "ex-spend-student-cafe-v1";
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

function currentMonth() { return localDate().slice(0, 7); }

function escapeHTML(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[c]);
}

function loadData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) {
      return {
        budget: Number(saved.budget) || 300,
        expenses: Array.isArray(saved.expenses) ? saved.expenses : [],
        savings: Array.isArray(saved.savings) ? saved.savings : [],
        score: Number(saved.score) || 0,
        unlockedAchieve: Array.isArray(saved.unlockedAchieve) ? saved.unlockedAchieve : []
      };
    }
  } catch (e) { console.error("Load error:", e); }
  return { budget: 300, expenses: [], savings: [], score: 0, unlockedAchieve: [] };
}

let state = loadData();
let toastTimer;

function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function showToast(msg) {
  const toast = $("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2500);
}

// NAVIGATION SYSTEM
document.querySelectorAll("[data-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    
    btn.classList.add("active");
    $(`${btn.dataset.view}View`).classList.add("active");
  });
});

document.querySelectorAll("[data-goto]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelector(`[data-view="${btn.dataset.goto}"]`).click();
  });
});

function setupCategories() {
  $("expenseCategory").innerHTML = CATEGORIES.map(c => 
    `<option value="${escapeHTML(c.name)}">${c.icon} ${escapeHTML(c.name)}</option>`
  ).join("");

  $("categoryFilter").innerHTML = '<option value="all">All categories</option>' + 
    CATEGORIES.map(c => `<option value="${escapeHTML(c.name)}">${c.icon} ${escapeHTML(c.name)}</option>`).join("");
}

function selectedMonthExpenses() {
  const month = $("monthFilter").value || currentMonth();
  return state.expenses.filter(e => e.date.slice(0, 7) === month);
}

function renderDashboard() {
  const expenses = selectedMonthExpenses();
  const spent = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const remaining = state.budget - spent;
  const pct = state.budget > 0 ? (spent / state.budget) * 100 : 0;

  $("totalSpent").textContent = money(spent);
  $("budgetLeft").textContent = money(remaining);
  $("budgetAmount").textContent = money(state.budget);
  
  $("budgetLeft").style.color = remaining < 0 ? "var(--red)" : "var(--text)";
  $("leftCaption").textContent = remaining < 0 ? `${money(Math.abs(remaining))} over budget` : "Room to make it count";

  $("budgetPercent").textContent = `${Math.round(pct)}%`;
  $("budgetMaximum").textContent = money(state.budget);
  
  const progBar = $("budgetProgress");
  progBar.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  progBar.className = pct >= 100 ? "danger" : pct >= 75 ? "warning" : "";

  const status = $("budgetStatus");
  status.className = "pill" + (pct >= 100 ? " danger" : pct >= 75 ? " warning" : "");
  status.textContent = pct >= 100 ? "Budget Exceeded" : pct >= 75 ? "Getting Close" : "On Track";

  renderCategoryBreakdown(expenses, spent);
  renderTransactionTable($("recentTransactions"), expenses.slice(0, 5));
}

function renderCategoryBreakdown(expenses, total) {
  const container = $("categoryBreakdown");
  if (!expenses.length) {
    container.innerHTML = '<p class="muted">No expenses recorded for this month.</p>';
    return;
  }

  const totals = CATEGORIES.map(cat => ({
    ...cat,
    amount: expenses.filter(e => e.category === cat.name).reduce((sum, e) => sum + Number(e.amount), 0)
  })).filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);

  container.innerHTML = totals.map(c => {
    const pct = total > 0 ? (c.amount / total) * 100 : 0;
    return `
      <div class="category-row">
        <span>${c.icon} ${escapeHTML(c.name)}</span>
        <div class="category-track"><span style="width:${pct}%;background:${c.color}"></span></div>
        <strong>${money(c.amount)}</strong>
      </div>
    `;
  }).join("");
}

function renderTransactionTable(container, list) {
  if (!list.length) {
    container.innerHTML = '<tr><td colspan="5" class="muted">No transactions found.</td></tr>';
    return;
  }

  container.innerHTML = list.map(item => {
    const cat = CATEGORIES.find(c => c.name === item.category) || CATEGORIES[CATEGORIES.length - 1];
    return `
      <tr>
        <td>
          <div class="transaction-title">
            <span class="transaction-icon">${cat.icon}</span>
            <div>
              <div>${escapeHTML(item.title)}</div>
              ${item.note ? `<small class="muted">${escapeHTML(item.note)}</small>` : ""}
            </div>
          </div>
        </td>
        <td><span class="pill">${escapeHTML(item.category)}</span></td>
        <td class="muted">${item.date}</td>
        <td class="right"><strong>${money(item.amount)}</strong></td>
        <td class="right">
          <button class="delete-btn" onclick="deleteExpense('${item.id}')" title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
}

window.deleteExpense = function(id) {
  if (confirm("Delete this expense record?")) {
    state.expenses = state.expenses.filter(e => e.id !== id);
    saveData();
    updateAll();
    showToast("Transaction deleted.");
  }
};

function renderAllTransactions() {
  let list = state.expenses.slice().sort((a, b) => b.date.localeCompare(a.date));
  const query = $("searchInput").value.toLowerCase();
  const cat = $("categoryFilter").value;

  if (cat !== "all") list = list.filter(e => e.category === cat);
  if (query) list = list.filter(e => e.title.toLowerCase().includes(query) || (e.note && e.note.toLowerCase().includes(query)));

  $("transactionCount").textContent = `${list.length} transaction(s)`;
  renderTransactionTable($("allTransactions"), list);
}

// SAVINGS GOALS
function renderSavings() {
  const container = $("savingsGrid");
  if (!state.savings.length) {
    container.innerHTML = '<p class="muted">No savings goals set yet. Click "New Savings Goal" to start!</p>';
    return;
  }

  container.innerHTML = state.savings.map(goal => {
    const pct = Math.min(100, Math.round((goal.current / goal.target) * 100));
    return `
      <div class="goal-card">
        <h3>🎯 ${escapeHTML(goal.title)}</h3>
        ${goal.note ? `<p class="muted">${escapeHTML(goal.note)}</p>` : ""}
        <div class="goal-amounts">
          <span>${money(goal.current)} saved</span>
          <span class="coffee-gold">Target: ${money(goal.target)}</span>
        </div>
        <div class="progress-track"><div style="width:${pct}%;background:var(--coffee-gold);height:100%"></div></div>
        <div class="goal-actions">
          <button class="secondary-btn" onclick="addFundsGoal('${goal.id}')">＋ Add Funds</button>
          <button class="delete-btn" onclick="deleteGoal('${goal.id}')">🗑️ Delete</button>
        </div>
      </div>
    `;
  }).join("");
}

window.addFundsGoal = function(id) {
  const goal = state.savings.find(g => g.id === id);
  if (!goal) return;
  const amt = prompt(`Add funds to ${goal.title} (RM):`);
  if (amt && !isNaN(amt) && Number(amt) > 0) {
    goal.current += Number(amt);
    saveData();
    renderSavings();
    showToast("Funds updated!");
  }
};

window.deleteGoal = function(id) {
  if (confirm("Delete this goal?")) {
    state.savings = state.savings.filter(g => g.id !== id);
    saveData();
    renderSavings();
    showToast("Savings goal removed.");
  }
};

// INSIGHTS & AVERAGE MONTHLY SPENDING
function renderInsights() {
  const monthMap = {};
  state.expenses.forEach(e => {
    const m = e.date.slice(0, 7);
    monthMap[m] = (monthMap[m] || 0) + Number(e.amount);
  });

  const months = Object.keys(monthMap);
  const totalAllTime = Object.values(monthMap).reduce((a, b) => a + b, 0);
  const avg = months.length > 0 ? totalAllTime / months.length : 0;

  $("avgMonthlySpend").textContent = money(avg);
  $("avgMonthlyCaption").textContent = `Calculated across ${months.length} active month(s)`;

  const expenses = selectedMonthExpenses();
  const catTotals = {};
  expenses.forEach(e => catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount));
  
  let topCat = "None", maxVal = 0;
  Object.entries(catTotals).forEach(([k, v]) => {
    if (v > maxVal) { maxVal = v; topCat = k; }
  });

  $("topCategory").textContent = maxVal > 0 ? topCat : "No spending recorded";
  $("topCategoryCopy").textContent = maxVal > 0 ? `Highest spending at ${money(maxVal)}` : "Record expenses to see patterns.";

  const avgPerTx = expenses.length > 0 ? expenses.reduce((s, e) => s + Number(e.amount), 0) / expenses.length : 0;
  $("averageExpense").textContent = money(avgPerTx);
}

// MINI-GAME LOGIC
const DRINKS = [
  { title: "Classic Espresso", recipe: ["Espresso"] },
  { title: "Iced Caramel Latte", recipe: ["Espresso", "Steamed Milk", "Caramel Syrup", "Ice Cubes"] },
  { title: "Matcha Latte", recipe: ["Matcha", "Steamed Milk"] },
  { title: "Iced Americano", recipe: ["Espresso", "Ice Cubes"] }
];

const ACHIEVEMENTS = [
  { id: "first_brew", title: "First Shift", desc: "Earn at least 10 PTS in Barista Rush." },
  { id: "barista_master", title: "Master Barista", desc: "Reach 50 total Tip points." }
];

let currentOrder = null;
let currentCup = [];
let gameTimer = 30;
let timerInterval = null;

function renderMinigame() {
  $("gameScore").textContent = state.score;

  $("achievementsList").innerHTML = ACHIEVEMENTS.map(ach => {
    const isUnlocked = state.unlockedAchieve.includes(ach.id);
    return `
      <div class="achieve-card ${isUnlocked ? "unlocked" : ""}">
        <span>${isUnlocked ? "🏆" : "🔒"}</span>
        <div>
          <strong>${escapeHTML(ach.title)}</strong>
          <div>${escapeHTML(ach.desc)}</div>
        </div>
      </div>
    `;
  }).join("");
}

document.querySelectorAll(".ing-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentCup.push(btn.dataset.ing);
    $("cupContents").textContent = currentCup.join(", ");
  });
});

$("clearCupBtn").addEventListener("click", () => {
  currentCup = [];
  $("cupContents").textContent = "Empty";
});

$("startShiftBtn").addEventListener("click", () => {
  clearInterval(timerInterval);
  gameTimer = 30;
  currentCup = [];
  $("cupContents").textContent = "Empty";
  nextOrder();

  timerInterval = setInterval(() => {
    gameTimer--;
    $("gameTimer").textContent = gameTimer;
    if (gameTimer <= 0) {
      clearInterval(timerInterval);
      alert(`Shift finished! Total Cafe Tips: ${state.score}`);
    }
  }, 1000);
});

function nextOrder() {
  currentOrder = DRINKS[Math.floor(Math.random() * DRINKS.length)];
  $("orderTitle").textContent = currentOrder.title;
  $("orderRecipe").textContent = "Recipe: " + currentOrder.recipe.join(" + ");
}

$("serveDrinkBtn").addEventListener("click", () => {
  if (!currentOrder) return alert("Click 'Start 30s Shift' first!");
  
  const isCorrect = currentOrder.recipe.length === currentCup.length && 
    currentOrder.recipe.every((val, index) => val === currentCup[index]);

  if (isCorrect) {
    state.score += 10;
    showToast("Perfect drink served! +10 PTS");
    checkAchievements();
  } else {
    showToast("Wrong recipe! Order wasted.");
  }

  currentCup = [];
  $("cupContents").textContent = "Empty";
  saveData();
  renderMinigame();
  nextOrder();
});

function checkAchievements() {
  if (state.score >= 10 && !state.unlockedAchieve.includes("first_brew")) {
    state.unlockedAchieve.push("first_brew");
    showToast("🏆 Achievement Unlocked: First Shift!");
  }
  if (state.score >= 50 && !state.unlockedAchieve.includes("barista_master")) {
    state.unlockedAchieve.push("barista_master");
    showToast("🏆 Achievement Unlocked: Master Barista!");
  }
}

// MODAL HANDLERS
$("addExpenseBtn").onclick = () => $("expenseDialog").showModal();
$("closeExpense").onclick = () => $("expenseDialog").close();
$("cancelExpense").onclick = () => $("expenseDialog").close();

$("editBudgetBtn").onclick = () => {
  $("budgetInput").value = state.budget;
  $("budgetDialog").showModal();
};
$("closeBudget").onclick = () => $("budgetDialog").close();
$("cancelBudget").onclick = () => $("budgetDialog").close();

$("addGoalBtn").onclick = () => $("goalDialog").showModal();
$("closeGoal").onclick = () => $("goalDialog").close();
$("cancelGoal").onclick = () => $("goalDialog").close();

$("expenseForm").onsubmit = e => {
  e.preventDefault();
  state.expenses.push({
    id: "exp_" + Date.now(),
    title: $("expenseTitle").value.trim(),
    amount: Number($("expenseAmount").value),
    date: $("expenseDate").value,
    category: $("expenseCategory").value,
    note: $("expenseNote").value.trim()
  });
  saveData();
  updateAll();
  $("expenseForm").reset();
  $("expenseDialog").close();
  showToast("Expense added!");
};

$("budgetForm").onsubmit = e => {
  e.preventDefault();
  state.budget = Number($("budgetInput").value);
  saveData();
  updateAll();
  $("budgetDialog").close();
  showToast("Budget updated!");
};

$("goalForm").onsubmit = e => {
  e.preventDefault();
  state.savings.push({
    id: "goal_" + Date.now(),
    title: $("goalTitle").value.trim(),
    target: Number($("goalTarget").value),
    current: Number($("goalCurrent").value) || 0,
    note: $("goalNote").value.trim()
  });
  saveData();
  renderSavings();
  $("goalForm").reset();
  $("goalDialog").close();
  showToast("Savings Goal created!");
};

$("monthFilter").value = currentMonth();
$("monthFilter").onchange = () => updateAll();
$("searchInput").oninput = () => renderAllTransactions();
$("categoryFilter").onchange = () => renderAllTransactions();

function updateAll() {
  renderDashboard();
  renderAllTransactions();
  renderSavings();
  renderInsights();
  renderMinigame();
}

// INITIALIZATION
$("expenseDate").value = localDate();
$("year").textContent = new Date().getFullYear();
setupCategories();
updateAll();
