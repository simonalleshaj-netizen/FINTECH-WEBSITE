/* ============================================================
   app.js — Logjika kryesore e Familja Ledger
   ============================================================ */

let DB = loadDB();
let session = { memberId: null };
let charts = { trend: null, spender: null, category: null };
let selectedLoginProfile = null;

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function fmtMoney(n) {
  const v = Number(n) || 0;
  return `€${v.toFixed(2)}`;
}
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("sq-AL", { day: "2-digit", month: "short" }) + " · " +
         d.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
}
function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "tani";
  if (diff < 3600) return `${Math.floor(diff / 60)} min më parë`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} orë më parë`;
  return `${Math.floor(diff / 86400)} ditë më parë`;
}
function initials(name) {
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}
function currentMember() {
  return DB.members.find(m => m.id === session.memberId);
}
function isParent() {
  const m = currentMember();
  return m && m.role === "parent";
}
function membersById() {
  const map = {};
  DB.members.forEach(m => map[m.id] = m);
  return map;
}

/* ============================================================
   TOASTS
   ============================================================ */
function showToast(msg, kind = "info") {
  const c = $("#toastContainer");
  const t = document.createElement("div");
  t.className = `toast ${kind === "warn" ? "warn" : kind === "alert" ? "alert" : ""}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, 4200);
}

function pushNotification(memberId, type, text) {
  DB.notifications.unshift({
    id: uid("nf"), familyId: DB.family.id, memberId, type, text,
    createdAt: new Date().toISOString(), read: false
  });
  saveDB(DB);
}

/* ============================================================
   AUTH
   ============================================================ */
function renderLoginProfiles() {
  const grid = $("#loginProfiles");
  grid.innerHTML = "";
  DB.members.forEach(m => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "profile-pick";
    el.dataset.id = m.id;
    el.innerHTML = `<div class="avatar" style="background:${m.avatarColor}">${initials(m.name)}</div><span>${m.name}</span>`;
    el.addEventListener("click", () => {
      $$(".profile-pick", grid).forEach(p => p.classList.remove("active"));
      el.classList.add("active");
      selectedLoginProfile = m.id;
    });
    grid.appendChild(el);
  });
  if (DB.members.length) {
    grid.firstChild.classList.add("active");
    selectedLoginProfile = DB.members[0].id;
  }
}

function setupAuthTabs() {
  $$(".auth-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      $$(".auth-tab").forEach(t => t.classList.remove("active"));
      $$(".auth-form").forEach(f => f.classList.remove("active"));
      tab.classList.add("active");
      $(`#${tab.dataset.tab}Form`).classList.add("active");
    });
  });
}

$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();
  const pin = $("#loginPin").value.trim();
  if (!selectedLoginProfile) { showToast("Zgjedh një profil.", "warn"); return; }
  const member = DB.members.find(m => m.id === selectedLoginProfile);
  if (!member) return;
  if (pin !== member.pin) {
    showToast("PIN i pasaktë. Provo: 1234", "alert");
    return;
  }
  session.memberId = member.id;
  enterApp();
});

$("#registerForm").addEventListener("submit", e => {
  e.preventDefault();
  const famName = $("#famName").value.trim();
  const parentName = $("#parentName").value.trim();
  const pin = $("#famPin").value.trim();
  const start = parseFloat($("#famStart").value);

  if (!/^\d{4}$/.test(pin)) { showToast("PIN duhet të ketë 4 shifra.", "warn"); return; }

  const family = { id: uid("fam"), name: famName, createdAt: new Date().toISOString(), mainBalance: start || 0 };
  const parent = {
    id: uid("mem"), familyId: family.id, name: parentName, role: "parent", pin,
    avatarColor: colorForIndex(0), balance: 0, dailyLimit: null, monthlyLimit: null,
    blockedCategories: [], spentToday: 0, spentMonth: 0
  };
  DB = { family, members: [parent], transactions: [], requests: [], goals: [], badges: [], notifications: [
    { id: uid("nf"), familyId: family.id, memberId: null, type: "info", text: `Familja "${famName}" u krijua me sukses. Mirëseerdhe!`, createdAt: new Date().toISOString(), read: false }
  ]};
  saveDB(DB);
  session.memberId = parent.id;
  showToast("Familja u krijua! Tani shto anëtarët e tjerë te 'Portofolet'.", "info");
  enterApp();
});

function logout() {
  session.memberId = null;
  $("#appShell").classList.remove("active");
  $("#authScreen").style.display = "flex";
  $("#loginPin").value = "";
  renderLoginProfiles();
}
$("#logoutBtn").addEventListener("click", logout);

/* ============================================================
   APP ENTRY / NAV
   ============================================================ */
function enterApp() {
  $("#authScreen").style.display = "none";
  $("#appShell").classList.add("active");
  const m = currentMember();
  $("#sbFamName").textContent = DB.family.name;
  $("#mobFamName").textContent = DB.family.name;
  $("#sbRole").textContent = m.role === "parent" ? "Prind / Admin" : "Fëmijë";
  $("#userAvatar").textContent = initials(m.name);
  $("#userAvatar").style.background = m.avatarColor;
  $("#userChipName").textContent = m.name;

  document.body.classList.toggle("is-child", m.role !== "parent");
  $$(".parent-only").forEach(el => el.style.display = m.role === "parent" ? "" : "none");
  $$(".child-only").forEach(el => el.style.display = m.role === "parent" ? "none" : "");

  goToView("dashboard");
  renderAll();
}

function goToView(view) {
  $$(".view").forEach(v => v.classList.remove("active"));
  $(`#view-${view}`)?.classList.add("active");
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === view));
  $("#appShell").classList.remove("mobile-nav-open");

  const titles = {
    dashboard: ["Paneli i familjes", "Ja si duket gjendja e familjes sot."],
    wallets: ["Portofolet", "Menaxho llogaritë e çdo anëtari."],
    transfer: ["Transferta", "Dërgo ose kërko para brenda familjes."],
    history: ["Historiku", "Të gjitha transaksionet, të filtrueshme."],
    goals: ["Qëllimet e kursimit", "Kursimi bëhet lojë me badges."],
    controls: ["Kontrolli i shpenzimeve", "Limite dhe blloqe për fëmijët."],
    advisor: ["Këshilltari AI", "Analizë e zakoneve financiare të familjes."]
  };
  const m = currentMember();
  const greetHour = new Date().getHours();
  const greet = greetHour < 12 ? "Mirëmëngjes" : greetHour < 18 ? "Mirëdita" : "Mirëmbrëma";
  if (view === "dashboard") {
    $("#viewTitle").innerHTML = `${greet}, <span id="topUserName">${m.name}</span>`;
  } else {
    $("#viewTitle").textContent = titles[view][0];
  }
  $("#viewSubtitle").textContent = titles[view][1];

  if (view === "dashboard") renderDashboard();
  if (view === "wallets") renderWallets();
  if (view === "transfer") renderTransferView();
  if (view === "history") renderHistory();
  if (view === "goals") renderGoals();
  if (view === "controls") renderControls();
  if (view === "advisor") renderAdvisor();
}

$$(".nav-item").forEach(btn => btn.addEventListener("click", () => goToView(btn.dataset.view)));
$("#mobMenuBtn").addEventListener("click", () => $("#appShell").classList.toggle("mobile-nav-open"));
document.addEventListener("click", e => {
  const goto = e.target.closest("[data-goto]");
  if (goto) goToView(goto.dataset.goto);
});

/* ============================================================
   NOTIFICATIONS PANEL
   ============================================================ */
function renderNotifPanel() {
  const m = currentMember();
  const list = DB.notifications.filter(n => !n.memberId || n.memberId === m.id || m.role === "parent");
  const dot = $("#notifDot");
  const unread = list.some(n => !n.read);
  dot.classList.toggle("hidden", !unread);

  const box = $("#notifList");
  if (!list.length) {
    box.innerHTML = `<div class="notif-empty">Asnjë njoftim ende.</div>`;
    return;
  }
  box.innerHTML = list.slice(0, 25).map(n => `
    <div class="notif-item">
      <span class="dot ${n.type}"></span>
      <div>
        <div>${n.text}</div>
        <div class="nx-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>
  `).join("");
}
$("#notifBtn").addEventListener("click", () => {
  renderNotifPanel();
  $("#notifPanel").classList.toggle("hidden");
  DB.notifications.forEach(n => n.read = true);
  saveDB(DB);
  setTimeout(() => $("#notifDot").classList.add("hidden"), 50);
});
$("#clearNotifBtn").addEventListener("click", () => {
  DB.notifications = [];
  saveDB(DB);
  renderNotifPanel();
});
document.addEventListener("click", e => {
  if (!e.target.closest("#notifPanel") && !e.target.closest("#notifBtn")) {
    $("#notifPanel").classList.add("hidden");
  }
});

/* ============================================================
   MASTER RENDER
   ============================================================ */
function renderAll() {
  renderDashboard();
  renderNotifPanel();
}

/* ---------- DASHBOARD ---------- */
function renderDashboard() {
  const totalMembers = DB.members.reduce((s, m) => s + (m.balance || 0), 0) + DB.family.mainBalance;
  $("#totalBalance").textContent = fmtMoney(totalMembers);
  $("#memberCount").textContent = DB.members.length;

  const now = new Date();
  const thisMonthSpend = DB.transactions
    .filter(t => t.type === "out" && sameMonth(t.createdAt, now))
    .reduce((s, t) => s + t.amount, 0);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonthSpend = DB.transactions
    .filter(t => t.type === "out" && sameMonth(t.createdAt, lastMonthDate))
    .reduce((s, t) => s + t.amount, 0);
  $("#monthSpend").textContent = fmtMoney(thisMonthSpend);
  if (lastMonthSpend > 0) {
    const delta = ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100;
    $("#monthSpendDelta").textContent = `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}% vs muajin e kaluar`;
  } else {
    $("#monthSpendDelta").textContent = "Pa të dhëna nga muaji i kaluar";
  }

  const goalsSaved = DB.goals.reduce((s, g) => s + g.saved, 0);
  $("#goalsSaved").textContent = fmtMoney(goalsSaved);

  renderTrendChart();
  renderSpenderChart();
  renderCategoryChart();
  renderFamilyTree();
  renderRecentActivity();
}

function sameMonth(iso, ref) {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
}

function renderTrendChart() {
  const ctx = $("#trendChart");
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d);
  }
  const labels = months.map(d => d.toLocaleDateString("sq-AL", { month: "short" }));
  const data = months.map(d => DB.transactions
    .filter(t => t.type === "out" && sameMonth(t.createdAt, d))
    .reduce((s, t) => s + t.amount, 0));

  if (charts.trend) charts.trend.destroy();
  charts.trend = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Shpenzime (€)",
        data,
        borderColor: "#2F7765",
        backgroundColor: "rgba(47,119,101,0.12)",
        fill: true,
        tension: 0.35,
        pointBackgroundColor: "#C9A24B",
        pointRadius: 4,
        borderWidth: 2.5
      }]
    },
    options: baseChartOptions(true)
  });
}

function renderSpenderChart() {
  const ctx = $("#spenderChart");
  const children = DB.members.filter(m => m.role === "child");
  const totals = children.map(c => DB.transactions
    .filter(t => t.memberId === c.id && t.type === "out")
    .reduce((s, t) => s + t.amount, 0));

  if (charts.spender) charts.spender.destroy();
  charts.spender = new Chart(ctx, {
    type: "bar",
    data: {
      labels: children.map(c => c.name),
      datasets: [{
        label: "Total shpenzuar (€)",
        data: totals,
        backgroundColor: children.map(c => c.avatarColor),
        borderRadius: 8,
        maxBarThickness: 56
      }]
    },
    options: baseChartOptions(false)
  });
}

function renderCategoryChart() {
  const ctx = $("#categoryChart");
  const totalsByCat = {};
  DB.transactions.filter(t => t.type === "out").forEach(t => {
    totalsByCat[t.category] = (totalsByCat[t.category] || 0) + t.amount;
  });
  const labels = Object.keys(totalsByCat).map(k => CATEGORY_LABELS[k] || k);
  const data = Object.values(totalsByCat);
  const palette = ["#2F7765", "#C9A24B", "#D9694F", "#5B6CA8", "#8A5FB0", "#3E8C7E", "#16243B"];

  if (charts.category) charts.category.destroy();
  charts.category = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{ data, backgroundColor: palette, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { position: "bottom", labels: { font: { family: "Source Sans 3", size: 11 }, color: "#5B6478", boxWidth: 10 } }
      }
    }
  });
}

function baseChartOptions(showGrid) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { family: "Source Sans 3", size: 11 }, color: "#5B6478" } },
      y: { grid: { display: showGrid, color: "rgba(22,36,59,0.06)" }, ticks: { font: { family: "JetBrains Mono", size: 10 }, color: "#5B6478" } }
    }
  };
}

function renderFamilyTree() {
  const wrap = $("#familyTree");
  const children = DB.members.filter(m => m.role === "child");
  wrap.innerHTML = `
    <div class="tree-root">FONDI KRYESOR · ${fmtMoney(DB.family.mainBalance)}</div>
    <div class="tree-line"></div>
    <div class="tree-branches">
      ${children.map(c => `
        <div class="tree-node">
          <div class="avatar" style="background:${c.avatarColor}">${initials(c.name)}</div>
          <span class="tname">${c.name}</span>
          <span class="tbal">${fmtMoney(c.balance)}</span>
        </div>
      `).join("") || `<p class="muted" style="padding:10px 0;">Asnjë fëmijë i shtuar ende.</p>`}
    </div>
  `;
}

function renderRecentActivity() {
  const box = $("#recentActivity");
  const mById = membersById();
  const recent = DB.transactions.slice(0, 6);
  if (!recent.length) {
    box.innerHTML = `<p class="empty-state">Asnjë transaksion ende.</p>`;
    return;
  }
  box.innerHTML = recent.map(t => {
    const owner = mById[t.memberId];
    return `
      <div class="activity-row">
        <div class="activity-icon" style="background:${owner?.avatarColor || '#999'}">${owner ? initials(owner.name) : "?"}</div>
        <div class="activity-info">
          <div class="activity-title">${t.note || CATEGORY_LABELS[t.category]}</div>
          <div class="activity-meta">${owner?.name || "—"} · ${CATEGORY_LABELS[t.category]} · ${timeAgo(t.createdAt)}</div>
        </div>
        <div class="activity-amt ${t.type}">${t.type === "in" ? "+" : "-"}${fmtMoney(t.amount)}</div>
      </div>
    `;
  }).join("");
}

/* ---------- WALLETS ---------- */
function renderWallets() {
  const grid = $("#walletGrid");
  grid.innerHTML = "";

  // Main family wallet card (visible to all, editable by parent only)
  const mainCard = document.createElement("div");
  mainCard.className = "wallet-card";
  mainCard.style.setProperty("--card-accent", "#16243B");
  mainCard.innerHTML = `
    <div class="wallet-card-head">
      <div class="avatar" style="background:#16243B">FK</div>
      <div>
        <div class="wallet-card-name">Fondi Kryesor</div>
        <div class="wallet-card-role">Llogaria e familjes</div>
      </div>
    </div>
    <div class="wallet-card-balance">${fmtMoney(DB.family.mainBalance)}</div>
    <p class="wallet-card-limit-txt">Përdoret për allowance, transferta dhe shpenzime të përbashkëta.</p>
  `;
  grid.appendChild(mainCard);

  DB.members.forEach((m, idx) => {
    const card = document.createElement("div");
    card.className = "wallet-card";
    card.style.setProperty("--card-accent", m.avatarColor);
    let limitHtml = "";
    if (m.role === "child") {
      const pct = m.dailyLimit ? Math.min(100, (m.spentToday / m.dailyLimit) * 100) : 0;
      const barClass = pct >= 90 ? "danger" : pct >= 70 ? "warn" : "";
      limitHtml = `
        <div class="wallet-card-bar-track"><div class="wallet-card-bar-fill ${barClass}" style="width:${pct}%"></div></div>
        <p class="wallet-card-limit-txt">€${m.spentToday.toFixed(2)} / €${(m.dailyLimit ?? 0).toFixed(2)} limit ditor</p>
      `;
    }
    card.innerHTML = `
      <div class="wallet-card-head">
        <div class="avatar" style="background:${m.avatarColor}">${initials(m.name)}</div>
        <div>
          <div class="wallet-card-name">${m.name}</div>
          <div class="wallet-card-role">${m.role === "parent" ? "Prind / Admin" : "Fëmijë"}</div>
        </div>
      </div>
      <div class="wallet-card-balance">${m.role === "parent" ? "—" : fmtMoney(m.balance)}</div>
      ${limitHtml}
      <div class="wallet-card-actions">
        ${m.role === "child" && isParent() ? `<button class="btn btn-secondary btn-sm" data-quicksend="${m.id}">Dërgo para</button>` : ""}
        ${isParent() && m.id !== currentMember().id ? `<button class="btn btn-danger btn-sm" data-remove="${m.id}">Hiq</button>` : ""}
      </div>
    `;
    grid.appendChild(card);
  });

  $$("[data-quicksend]").forEach(b => b.addEventListener("click", () => {
    goToView("transfer");
    $("#sendTo").value = b.dataset.quicksend;
  }));
  $$("[data-remove]").forEach(b => b.addEventListener("click", () => {
    if (confirm("Të hiqet ky anëtar nga familja? Historiku i tij do të ruhet.")) {
      DB.members = DB.members.filter(m => m.id !== b.dataset.remove);
      saveDB(DB);
      renderWallets();
      showToast("Anëtari u hoq.");
    }
  }));
}

$("#addMemberBtn").addEventListener("click", () => {
  openModal(`
    <button class="modal-close-x" data-close>&times;</button>
    <h3>Shto anëtar të ri</h3>
    <form id="newMemberForm" class="stack-form">
      <div class="field"><label>Emri</label><input type="text" id="nmName" required></div>
      <div class="field"><label>Roli</label>
        <select id="nmRole"><option value="child">Fëmijë</option><option value="parent">Prind</option></select>
      </div>
      <div class="field"><label>Bilanci fillestar (€)</label><input type="number" id="nmBalance" value="0" min="0" step="0.01"></div>
      <div class="field child-fields"><label>Limit ditor (€)</label><input type="number" id="nmDaily" value="10" min="0" step="0.5"></div>
      <div class="field child-fields"><label>Limit mujor (€)</label><input type="number" id="nmMonthly" value="100" min="0" step="1"></div>
      <div class="field"><label>PIN (4 shifra)</label><input type="password" id="nmPin" maxlength="4" value="1234" required></div>
      <button class="btn btn-primary btn-block" type="submit">Shto anëtarin</button>
    </form>
  `);
  $("#nmRole").addEventListener("change", e => {
    $$(".child-fields").forEach(f => f.style.display = e.target.value === "child" ? "" : "none");
  });
  $("#newMemberForm").addEventListener("submit", e => {
    e.preventDefault();
    const role = $("#nmRole").value;
    const newMember = {
      id: uid("mem"), familyId: DB.family.id,
      name: $("#nmName").value.trim(), role, pin: $("#nmPin").value.trim(),
      avatarColor: colorForIndex(DB.members.length),
      balance: parseFloat($("#nmBalance").value) || 0,
      dailyLimit: role === "child" ? parseFloat($("#nmDaily").value) || 0 : null,
      monthlyLimit: role === "child" ? parseFloat($("#nmMonthly").value) || 0 : null,
      blockedCategories: [], spentToday: 0, spentMonth: 0
    };
    DB.members.push(newMember);
    saveDB(DB);
    closeModal();
    renderWallets();
    showToast(`${newMember.name} u shtua në familje.`);
  });
});

/* ============================================================
   TRANSFER VIEW
   ============================================================ */
function renderTransferView() {
  const fromSel = $("#sendFrom"), toSel = $("#sendTo");
  const m = currentMember();

  // From options: parent can send from main fund or own; child can send from own wallet
  fromSel.innerHTML = "";
  if (m.role === "parent") {
    fromSel.innerHTML += `<option value="MAIN">Fondi Kryesor (€${DB.family.mainBalance.toFixed(2)})</option>`;
  }
  DB.members.forEach(mem => {
    if (mem.role === "child" && (m.role === "parent" || mem.id === m.id)) {
      fromSel.innerHTML += `<option value="${mem.id}">${mem.name} (€${mem.balance.toFixed(2)})</option>`;
    }
  });

  toSel.innerHTML = "";
  if (m.role !== "parent") {
    toSel.innerHTML += `<option value="MAIN">Fondi Kryesor</option>`;
  }
  DB.members.forEach(mem => {
    if (mem.role === "child" && mem.id !== m.id) {
      toSel.innerHTML += `<option value="${mem.id}">${mem.name}</option>`;
    } else if (mem.role === "parent" && m.role !== "parent") {
      toSel.innerHTML += `<option value="${mem.id}">${mem.name} (Prind)</option>`;
    }
  });

  renderPendingRequests();
}

$("#sendForm").addEventListener("submit", e => {
  e.preventDefault();
  const from = $("#sendFrom").value;
  const to = $("#sendTo").value;
  const amount = parseFloat($("#sendAmount").value);
  const note = $("#sendNote").value.trim();

  if (from === to) { showToast("Nuk mund të dërgosh tek i njëjti portofol.", "warn"); return; }
  if (!amount || amount <= 0) return;

  // Validate balance & limits
  if (from === "MAIN") {
    if (amount > DB.family.mainBalance) { showToast("Fondi kryesor nuk ka fonde të mjaftueshme.", "alert"); return; }
  } else {
    const fromMember = DB.members.find(x => x.id === from);
    if (amount > fromMember.balance) { showToast("Bilanci i pamjaftueshëm.", "alert"); return; }
    if (fromMember.role === "child") {
      const check = checkLimits(fromMember, amount, "other");
      if (!check.ok) { showToast(check.reason, "alert"); return; }
    }
  }

  // Apply
  if (from === "MAIN") DB.family.mainBalance -= amount;
  else applyDebit(DB.members.find(x => x.id === from), amount, "transfer");

  if (to === "MAIN") DB.family.mainBalance += amount;
  else {
    const toMember = DB.members.find(x => x.id === to);
    toMember.balance += amount;
    addTransaction(toMember.id, "in", "transfer", amount, note || "Transfer i brendshëm");
  }

  if (from !== "MAIN") addTransaction(from, "out", "transfer", amount, note || "Transfer i brendshëm");

  const toName = to === "MAIN" ? "Fondin Kryesor" : DB.members.find(x => x.id === to).name;
  pushNotification(to === "MAIN" ? null : to, "info", `${currentMember().name} dërgoi ${fmtMoney(amount)} tek ${toName}.`);
  saveDB(DB);
  showToast(`U dërguan ${fmtMoney(amount)} me sukses.`);
  $("#sendForm").reset();
  renderTransferView();
  renderDashboard();
});

$("#requestForm").addEventListener("submit", e => {
  e.preventDefault();
  const amount = parseFloat($("#reqAmount").value);
  const reason = $("#reqReason").value.trim();
  DB.requests.push({ id: uid("req"), familyId: DB.family.id, memberId: currentMember().id, amount, reason, status: "pending", createdAt: new Date().toISOString() });
  pushNotification(null, "info", `${currentMember().name} kërkoi ${fmtMoney(amount)} (${reason}).`);
  saveDB(DB);
  showToast("Kërkesa u dërgua te prindi.");
  $("#requestForm").reset();
  renderPendingRequests();
});

function renderPendingRequests() {
  const box = $("#pendingRequests");
  if (!box) return;
  const mById = membersById();
  const pending = DB.requests.filter(r => r.status === "pending");
  if (!pending.length) {
    box.innerHTML = `<p class="empty-state">Nuk ka kërkesa në pritje.</p>`;
    return;
  }
  box.innerHTML = pending.map(r => `
    <div class="pending-row">
      <div class="pending-row-info">
        <strong>${mById[r.memberId]?.name || "—"} · ${fmtMoney(r.amount)}</strong>
        <span>${r.reason} · ${timeAgo(r.createdAt)}</span>
      </div>
      <div class="pending-row-actions">
        <button class="btn btn-secondary btn-sm" data-approve="${r.id}">Aprovo</button>
        <button class="btn btn-danger btn-sm" data-reject="${r.id}">Refuzo</button>
      </div>
    </div>
  `).join("");

  $$("[data-approve]").forEach(b => b.addEventListener("click", () => {
    const req = DB.requests.find(r => r.id === b.dataset.approve);
    if (req.amount > DB.family.mainBalance) { showToast("Fondi kryesor nuk ka fonde të mjaftueshme.", "alert"); return; }
    DB.family.mainBalance -= req.amount;
    const member = DB.members.find(m => m.id === req.memberId);
    member.balance += req.amount;
    addTransaction(member.id, "in", "other", req.amount, `Kërkesë e aprovuar: ${req.reason}`);
    req.status = "approved";
    pushNotification(member.id, "info", `Prindi aprovoi transferimin prej ${fmtMoney(req.amount)}.`);
    saveDB(DB);
    renderPendingRequests();
    renderDashboard();
    showToast("Kërkesa u aprovua.");
  }));
  $$("[data-reject]").forEach(b => b.addEventListener("click", () => {
    const req = DB.requests.find(r => r.id === b.dataset.reject);
    req.status = "rejected";
    pushNotification(req.memberId, "warn", `Kërkesa jote prej ${fmtMoney(req.amount)} u refuzua.`);
    saveDB(DB);
    renderPendingRequests();
    showToast("Kërkesa u refuzua.");
  }));
}

/* ============================================================
   SPENDING LOGIC — limits, categories, transactions
   ============================================================ */
function checkLimits(member, amount, category) {
  if (member.blockedCategories.includes(category)) {
    return { ok: false, reason: `Kategoria "${CATEGORY_LABELS[category]}" është e bllokuar nga prindi.` };
  }
  if (member.dailyLimit != null && member.spentToday + amount > member.dailyLimit) {
    return { ok: false, reason: `Kjo shpenzim kalon limitin ditor (€${member.dailyLimit}).` };
  }
  if (member.monthlyLimit != null && member.spentMonth + amount > member.monthlyLimit) {
    return { ok: false, reason: `Kjo shpenzim kalon limitin mujor (€${member.monthlyLimit}).` };
  }
  return { ok: true };
}

function applyDebit(member, amount, category) {
  member.balance -= amount;
  member.spentToday += amount;
  member.spentMonth += amount;
  maybeWarnLimit(member);
}

function maybeWarnLimit(member) {
  if (member.dailyLimit) {
    const pct = (member.spentToday / member.dailyLimit) * 100;
    if (pct >= 80 && pct < 100) {
      pushNotification(member.id, "warn", `${member.name} ka shpenzuar ${pct.toFixed(0)}% të limitit ditor.`);
    } else if (pct >= 100) {
      pushNotification(member.id, "alert", `${member.name} arriti limitin ditor të shpenzimeve.`);
    }
  }
}

function addTransaction(memberId, type, category, amount, note) {
  DB.transactions.unshift({
    id: uid("tx"), familyId: DB.family.id, memberId, type, category,
    amount: Math.round(amount * 100) / 100, note, createdAt: new Date().toISOString()
  });
}

/* ============================================================
   HISTORY VIEW
   ============================================================ */
function renderHistory() {
  const personSel = $("#filterPerson");
  personSel.innerHTML = `<option value="all">Të gjithë anëtarët</option>` +
    DB.members.map(m => `<option value="${m.id}">${m.name}</option>`).join("");
  applyHistoryFilters();
}

function applyHistoryFilters() {
  const person = $("#filterPerson").value;
  const category = $("#filterCategory").value;
  const type = $("#filterType").value;
  const search = $("#filterSearch").value.toLowerCase().trim();
  const mById = membersById();

  let rows = DB.transactions.filter(t => {
    if (person !== "all" && t.memberId !== person) return false;
    if (category !== "all" && t.category !== category) return false;
    if (type !== "all" && t.type !== type) return false;
    if (search && !(t.note || "").toLowerCase().includes(search)) return false;
    return true;
  });

  const tbody = $("#txTableBody");
  $("#txEmpty").classList.toggle("hidden", rows.length > 0);
  tbody.innerHTML = rows.map(t => `
    <tr>
      <td>${fmtDateTime(t.createdAt)}</td>
      <td>${mById[t.memberId]?.name || "—"}</td>
      <td>${t.note || "—"}</td>
      <td><span class="tag">${CATEGORY_LABELS[t.category] || t.category}</span></td>
      <td class="amt-cell ${t.type}">${t.type === "in" ? "+" : "-"}${fmtMoney(t.amount)}</td>
    </tr>
  `).join("");
}
["filterPerson", "filterCategory", "filterType"].forEach(id =>
  $("#" + id)?.addEventListener("change", applyHistoryFilters));
$("#filterSearch")?.addEventListener("input", applyHistoryFilters);

/* ============================================================
   GOALS / GAMIFICATION
   ============================================================ */
function renderGoals() {
  const grid = $("#goalsGrid");
  const mById = membersById();
  if (!DB.goals.length) {
    grid.innerHTML = `<p class="empty-state">Asnjë qëllim ende. Shto një qëllim të ri kursimi!</p>`;
  } else {
    grid.innerHTML = DB.goals.map(g => {
      const pct = Math.min(100, (g.saved / g.target) * 100);
      const owner = mById[g.memberId];
      return `
        <div class="goal-card">
          <div class="goal-card-head">
            <div>
              <div class="goal-title">${g.emoji} ${g.title}</div>
              <div class="goal-owner">${owner?.name || "—"}</div>
            </div>
          </div>
          <div class="goal-bar-track"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
          <div class="goal-amounts"><strong>${fmtMoney(g.saved)}</strong><span>nga ${fmtMoney(g.target)}</span></div>
          ${(currentMember().id === g.memberId || isParent()) ? `<button class="btn btn-secondary btn-sm btn-block" data-addgoal="${g.id}">+ Shto kursim</button>` : ""}
        </div>
      `;
    }).join("");
  }

  $$("[data-addgoal]").forEach(b => b.addEventListener("click", () => {
    const amt = parseFloat(prompt("Sa € do të shtosh në këtë qëllim?", "5"));
    if (!amt || amt <= 0) return;
    const goal = DB.goals.find(g => g.id === b.dataset.addgoal);
    const owner = mById[goal.memberId];
    if (amt > owner.balance) { showToast("Bilanci i pamjaftueshëm për këtë kursim.", "alert"); return; }
    owner.balance -= amt;
    goal.saved += amt;
    addTransaction(owner.id, "out", "saving", amt, `Kursim: ${goal.title}`);

    if (goal.saved >= goal.target) {
      showToast(`🎉 ${owner.name} arriti qëllimin "${goal.title}"!`);
      const already = DB.badges.some(bd => bd.memberId === owner.id && bd.label === `Qëllimi: ${goal.title}`);
      if (!already) {
        DB.badges.push({ id: uid("badge"), familyId: DB.family.id, memberId: owner.id, label: `Qëllimi: ${goal.title}`, emoji: "🏆", earnedAt: new Date().toISOString() });
        pushNotification(owner.id, "info", `${owner.name} fitoi një badge të re: Qëllimi i arritur!`);
      }
    } else if (goal.saved / goal.target >= 0.5 && (goal.saved - amt) / goal.target < 0.5) {
      const already = DB.badges.some(bd => bd.memberId === owner.id && bd.label === "Gjysmë rrugë");
      if (!already) {
        DB.badges.push({ id: uid("badge"), familyId: DB.family.id, memberId: owner.id, label: "Gjysmë rrugë", emoji: "🥈", earnedAt: new Date().toISOString() });
      }
    }
    saveDB(DB);
    renderGoals();
    renderDashboard();
  }));

  renderBadges();
}

function renderBadges() {
  const box = $("#badgesList");
  const mById = membersById();
  if (!DB.badges.length) {
    box.innerHTML = `<p class="badges-empty">Asnjë badge ende — fillo të kursesh!</p>`;
    return;
  }
  box.innerHTML = DB.badges.map(b => `
    <div class="badge-pill"><span>${b.emoji}</span> ${mById[b.memberId]?.name || "—"} — ${b.label}</div>
  `).join("");
}

$("#addGoalBtn").addEventListener("click", () => {
  const children = DB.members.filter(m => m.role === "child" || m.id === currentMember().id);
  openModal(`
    <button class="modal-close-x" data-close>&times;</button>
    <h3>Qëllim i ri kursimi</h3>
    <form id="newGoalForm" class="stack-form">
      <div class="field"><label>Për kë</label>
        <select id="ngOwner">${children.map(c => `<option value="${c.id}">${c.name}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Titulli i qëllimit</label><input type="text" id="ngTitle" placeholder="p.sh. Biçikletë" required></div>
      <div class="field"><label>Emoji</label><input type="text" id="ngEmoji" placeholder="🚲" maxlength="2" value="🎯"></div>
      <div class="field"><label>Shuma e synuar (€)</label><input type="number" id="ngTarget" min="1" required></div>
      <button class="btn btn-primary btn-block" type="submit">Krijo qëllimin</button>
    </form>
  `);
  $("#newGoalForm").addEventListener("submit", e => {
    e.preventDefault();
    DB.goals.push({
      id: uid("goal"), familyId: DB.family.id, memberId: $("#ngOwner").value,
      title: $("#ngTitle").value.trim(), emoji: $("#ngEmoji").value.trim() || "🎯",
      target: parseFloat($("#ngTarget").value), saved: 0, createdAt: new Date().toISOString()
    });
    saveDB(DB);
    closeModal();
    renderGoals();
    showToast("Qëllimi u krijua!");
  });
});

/* ============================================================
   CONTROLS (parent)
   ============================================================ */
const ALL_CATEGORIES = ["fastfood", "games", "food", "school", "other"];

function renderControls() {
  const grid = $("#controlsGrid");
  const children = DB.members.filter(m => m.role === "child");
  if (!children.length) {
    grid.innerHTML = `<p class="empty-state">Asnjë fëmijë i shtuar ende.</p>`;
    return;
  }
  grid.innerHTML = children.map(c => `
    <div class="control-card">
      <div class="control-card-head">
        <div class="avatar" style="background:${c.avatarColor}">${initials(c.name)}</div>
        <strong>${c.name}</strong>
      </div>
      <div class="control-row">
        <label>Limit ditor (€)</label>
        <input type="number" min="0" step="0.5" value="${c.dailyLimit ?? 0}" data-daily="${c.id}">
      </div>
      <div class="control-row">
        <label>Limit mujor (€)</label>
        <input type="number" min="0" step="1" value="${c.monthlyLimit ?? 0}" data-monthly="${c.id}">
      </div>
      <div class="control-row">
        <label>Kategori të bllokuara</label>
        <div class="category-toggles">
          ${ALL_CATEGORIES.map(cat => `
            <button type="button" class="cat-toggle ${c.blockedCategories.includes(cat) ? "blocked" : "allowed"}" data-cat="${cat}" data-owner="${c.id}">
              ${c.blockedCategories.includes(cat) ? "🚫" : "✅"} ${CATEGORY_LABELS[cat]}
            </button>
          `).join("")}
        </div>
      </div>
    </div>
  `).join("");

  $$("[data-daily]").forEach(inp => inp.addEventListener("change", () => {
    const m = DB.members.find(x => x.id === inp.dataset.daily);
    m.dailyLimit = parseFloat(inp.value) || 0;
    saveDB(DB);
    showToast(`Limiti ditor i ${m.name} u përditësua.`);
  }));
  $$("[data-monthly]").forEach(inp => inp.addEventListener("change", () => {
    const m = DB.members.find(x => x.id === inp.dataset.monthly);
    m.monthlyLimit = parseFloat(inp.value) || 0;
    saveDB(DB);
    showToast(`Limiti mujor i ${m.name} u përditësua.`);
  }));
  $$("[data-cat]").forEach(btn => btn.addEventListener("click", () => {
    const m = DB.members.find(x => x.id === btn.dataset.owner);
    const cat = btn.dataset.cat;
    if (m.blockedCategories.includes(cat)) {
      m.blockedCategories = m.blockedCategories.filter(c => c !== cat);
    } else {
      m.blockedCategories.push(cat);
    }
    saveDB(DB);
    renderControls();
    showToast(`Kategoria "${CATEGORY_LABELS[cat]}" u përditësua për ${m.name}.`);
  }));
}

/* ============================================================
   AI ADVISOR (rule-based heuristics presented as smart insights)
   ============================================================ */
function renderAdvisor() {
  const box = $("#advisorCards");
  const insights = [];
  const children = DB.members.filter(m => m.role === "child");

  children.forEach(c => {
    const txs = DB.transactions.filter(t => t.memberId === c.id && t.type === "out");
    const fastfoodTotal = txs.filter(t => t.category === "fastfood").reduce((s, t) => s + t.amount, 0);
    const gamesTotal = txs.filter(t => t.category === "games").reduce((s, t) => s + t.amount, 0);
    const totalSpend = txs.reduce((s, t) => s + t.amount, 0);

    if (totalSpend > 0 && fastfoodTotal / totalSpend > 0.3) {
      insights.push({ kind: "warn", icon: "🍔", title: `${c.name} po shpenzon shumë për fast food`, text: `${((fastfoodTotal / totalSpend) * 100).toFixed(0)}% e shpenzimeve të tij/saj shkojnë në fast food (${fmtMoney(fastfoodTotal)} gjithsej). Mund të vlejë një bisedë rreth zakoneve të ushqyerjes.` });
    }
    if (totalSpend > 0 && gamesTotal / totalSpend > 0.3) {
      insights.push({ kind: "warn", icon: "🎮", title: `${c.name} shpenzon shumë në lojëra`, text: `Lojërat zënë ${((gamesTotal / totalSpend) * 100).toFixed(0)}% të shpenzimeve totale (${fmtMoney(gamesTotal)}). Konsidero një limit më të ulët për këtë kategori.` });
    }
    if (c.dailyLimit && c.spentToday / c.dailyLimit >= 0.8) {
      insights.push({ kind: "alert", icon: "⏰", title: `${c.name} afër limitit ditor`, text: `Ka shpenzuar ${fmtMoney(c.spentToday)} nga €${c.dailyLimit} i lejuar sot.` });
    }
    const savingTotal = txs.filter(t => t.category === "saving").reduce((s, t) => s + t.amount, 0);
    if (savingTotal > 0 && totalSpend > 0 && savingTotal / totalSpend >= 0.25) {
      insights.push({ kind: "info", icon: "💪", title: `${c.name} ka zakone të mira kursimi`, text: `${((savingTotal / totalSpend) * 100).toFixed(0)}% e fondeve të shpenzuara janë drejtuar nga kursimi. Vazhdo kështu!` });
    }
  });

  const now = new Date();
  const thisMonthSpend = DB.transactions.filter(t => t.type === "out" && sameMonth(t.createdAt, now)).reduce((s, t) => s + t.amount, 0);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  const lastMonthSpend = DB.transactions.filter(t => t.type === "out" && sameMonth(t.createdAt, lastMonthDate)).reduce((s, t) => s + t.amount, 0);
  if (lastMonthSpend > 0 && thisMonthSpend > lastMonthSpend * 1.2) {
    insights.push({ kind: "alert", icon: "📈", title: "Shpenzimet familjare po rriten", text: `Shpenzimet e këtij muaji janë ${(((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100).toFixed(0)}% më të larta se muaji i kaluar.` });
  } else if (lastMonthSpend > 0 && thisMonthSpend < lastMonthSpend * 0.8) {
    insights.push({ kind: "info", icon: "📉", title: "Shpenzimet familjare po ulen", text: "Familja ka shpenzuar më pak këtë muaj krahasuar me muajin e kaluar. Punë e mirë!" });
  }

  if (!insights.length) {
    insights.push({ kind: "info", icon: "✅", title: "Gjithçka duket normale", text: "Nuk u gjetën sinjale shqetësuese në zakonet e shpenzimeve të familjes këtë periudhë." });
  }

  box.innerHTML = insights.map(i => `
    <div class="advisor-card ${i.kind}">
      <div class="advisor-icon">${i.icon}</div>
      <div class="advisor-text"><strong>${i.title}</strong><span>${i.text}</span></div>
    </div>
  `).join("");
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(html) {
  $("#modalBox").innerHTML = html;
  $("#modalOverlay").classList.remove("hidden");
}
function closeModal() {
  $("#modalOverlay").classList.add("hidden");
  $("#modalBox").innerHTML = "";
}
$("#modalOverlay").addEventListener("click", e => {
  if (e.target === $("#modalOverlay") || e.target.closest("[data-close]")) closeModal();
});

/* ============================================================
   WEEKLY ALLOWANCE AUTOMATION (simple demo simulation)
   ============================================================ */
function maybeRunWeeklyAllowance() {
  const lastRun = localStorage.getItem("flAllowanceLastRun");
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  if (lastRun === todayKey) return;
  // Demo trigger: run once per real calendar day if it's been >= 7 days conceptually skipped for simplicity;
  // kept as a manual-style hook so it doesn't silently alter demo numbers on every reload.
  localStorage.setItem("flAllowanceLastRun", todayKey);
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  setupAuthTabs();
  renderLoginProfiles();
  maybeRunWeeklyAllowance();
}
init();
