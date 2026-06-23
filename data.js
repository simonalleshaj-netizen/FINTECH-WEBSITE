/* ============================================================
   data.js — Demo seed data + storage helpers për Familja Ledger
   Zëvendëson një backend real (PHP/MySQL) për qëllime demonstrimi.
   Shih sql/schema.sql për strukturën reale të databazës.
   ============================================================ */

const STORAGE_KEY = "familjaLedgerDB_v1";

const CATEGORY_LABELS = {
  allowance: "Allowance",
  food: "Ushqim",
  fastfood: "Fast Food",
  games: "Lojëra",
  school: "Shkollë",
  saving: "Kursim",
  transfer: "Transfer i brendshëm",
  other: "Tjetër"
};

const AVATAR_COLORS = ["#2F7765", "#C9A24B", "#D9694F", "#5B6CA8", "#8A5FB0", "#3E8C7E"];

function colorForIndex(i) {
  return AVATAR_COLORS[i % AVATAR_COLORS.length];
}

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isoDaysAgo(days, hour = 12) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
  return d.toISOString();
}

function buildDemoDatabase() {
  const now = new Date();

  const family = {
    id: uid("fam"),
    name: "Familja Hoxha",
    createdAt: new Date().toISOString(),
    mainBalance: 1000.0 // fondi kryesor i pashpërndarë
  };

  const members = [
    {
      id: uid("mem"),
      familyId: family.id,
      name: "Arta",
      role: "parent",
      pin: "1234",
      avatarColor: colorForIndex(0),
      balance: 0, // prindi sheh fondin kryesor, jo bilanc personal shpenzues
      dailyLimit: null,
      monthlyLimit: null,
      blockedCategories: [],
      spentToday: 0,
      spentMonth: 0
    },
    {
      id: uid("mem"),
      familyId: family.id,
      name: "Geri",
      role: "child",
      pin: "1234",
      avatarColor: colorForIndex(1),
      balance: 42.5,
      dailyLimit: 10,
      monthlyLimit: 120,
      blockedCategories: ["fastfood"],
      spentToday: 3,
      spentMonth: 38
    },
    {
      id: uid("mem"),
      familyId: family.id,
      name: "Dea",
      role: "child",
      pin: "1234",
      avatarColor: colorForIndex(2),
      balance: 67.2,
      dailyLimit: 8,
      monthlyLimit: 100,
      blockedCategories: [],
      spentToday: 6.4,
      spentMonth: 71
    }
  ];

  const [parent, geri, dea] = members;

  const transactions = [];

  function addTx(memberId, type, category, amount, note, daysAgo) {
    transactions.push({
      id: uid("tx"),
      familyId: family.id,
      memberId,
      type, // 'in' | 'out'
      category,
      amount: Math.round(amount * 100) / 100,
      note,
      createdAt: isoDaysAgo(daysAgo)
    });
  }

  // Allowance javore për 6 javë mbrapa, për Geri dhe Dea
  for (let w = 6; w >= 1; w--) {
    addTx(geri.id, "in", "allowance", 15, "Allowance javore", w * 7);
    addTx(dea.id, "in", "allowance", 15, "Allowance javore", w * 7);
  }

  // Disa shpenzime të shtrira në 6 muajt e fundit (për trend chart)
  const spendSeed = [
    [geri.id, "food", 4.5, "Drekë shkolle", 150],
    [geri.id, "games", 8, "Lojë mobile", 130],
    [dea.id, "fastfood", 6.2, "Burger me shoqet", 140],
    [dea.id, "school", 12, "Fletore & stilolapsa", 120],
    [geri.id, "saving", 10, "Drejt qëllimit: Biçikletë", 100],
    [dea.id, "food", 5, "Snack", 95],
    [geri.id, "fastfood", 5.5, "Pica", 80],
    [dea.id, "games", 7, "Skin loje", 75],
    [geri.id, "school", 9, "Projekt shkolle", 60],
    [dea.id, "saving", 15, "Drejt qëllimit: Konsolë", 55],
    [geri.id, "food", 3.8, "Drekë", 40],
    [dea.id, "fastfood", 6.9, "Kebab", 35],
    [geri.id, "games", 6, "Karta loje", 22],
    [dea.id, "food", 4.2, "Drekë shkolle", 18],
    [geri.id, "saving", 12, "Drejt qëllimit: Biçikletë", 14],
    [dea.id, "school", 8, "Libra", 10],
    [geri.id, "food", 3, "Drekë", 6],
    [dea.id, "games", 5, "Lojë online", 4],
    [geri.id, "fastfood", 4.8, "Fast food me shokët", 3],
    [dea.id, "saving", 10, "Drejt qëllimit: Konsolë", 2]
  ];
  spendSeed.forEach(([mid, cat, amt, note, days]) => addTx(mid, "out", cat, amt, note, days));

  // Transfer i brendshëm shembull
  addTx(geri.id, "in", "transfer", 5, "Dhuratë nga Dea (ndarje pice)", 33);
  addTx(dea.id, "out", "transfer", 5, "Dhuratë për Gerin", 33);

  // Sort transactions newest first
  transactions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const requests = [
    {
      id: uid("req"),
      familyId: family.id,
      memberId: dea.id,
      amount: 15,
      reason: "Bileta kinemaje me shoqet",
      status: "pending", // pending | approved | rejected
      createdAt: isoDaysAgo(1)
    }
  ];

  const goals = [
    {
      id: uid("goal"),
      familyId: family.id,
      memberId: geri.id,
      title: "Biçikletë e re",
      emoji: "🚲",
      target: 120,
      saved: 36,
      createdAt: isoDaysAgo(45)
    },
    {
      id: uid("goal"),
      familyId: family.id,
      memberId: dea.id,
      title: "Konsolë lojërash",
      emoji: "🎮",
      target: 200,
      saved: 27,
      createdAt: isoDaysAgo(30)
    }
  ];

  const badges = [
    { id: uid("badge"), familyId: family.id, memberId: geri.id, label: "Kursimtari i parë", emoji: "🥉", earnedAt: isoDaysAgo(40) },
    { id: uid("badge"), familyId: family.id, memberId: dea.id, label: "Kursimtari i parë", emoji: "🥉", earnedAt: isoDaysAgo(28) }
  ];

  const notifications = [
    { id: uid("nf"), familyId: family.id, memberId: geri.id, type: "warn", text: "Geri ka shpenzuar 80% të limitit ditor.", createdAt: isoDaysAgo(0, 9), read: false },
    { id: uid("nf"), familyId: family.id, memberId: dea.id, type: "info", text: "Dea kreu një transfer të brendshëm prej €5.00.", createdAt: isoDaysAgo(1, 14), read: false },
    { id: uid("nf"), familyId: family.id, memberId: null, type: "info", text: "Allowance javore u shpërnda automatikisht për të gjithë fëmijët.", createdAt: isoDaysAgo(2, 8), read: true }
  ];

  return { family, members, transactions, requests, goals, badges, notifications };
}

function loadDB() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const fresh = buildDemoDatabase();
    saveDB(fresh);
    return fresh;
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    const fresh = buildDemoDatabase();
    saveDB(fresh);
    return fresh;
  }
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function resetDB() {
  localStorage.removeItem(STORAGE_KEY);
  return loadDB();
}
