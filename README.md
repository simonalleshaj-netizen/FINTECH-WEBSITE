# Familja Ledger — Family Wallet (Projekt Diplome)

Platformë fintech familjare: prindi (Admin) menaxhon fondin kryesor, fëmijët kanë
portofole vetjake me limite shpenzimi, transferta të brendshme, qëllime kursimi
me gamification, dhe një dashboard me grafikë (Chart.js).

## Si ta hapësh demon

1. Hap `index.html` direkt në browser (ose përdor një local server të thjeshtë,
   p.sh. `python3 -m http.server`, dhe shko te `localhost:8000`).
2. Te ekrani i hyrjes, zgjedh një profil (Arta = Prind, Geri/Dea = Fëmijë).
3. PIN demo për të gjithë: **1234**
4. Ose krijo një familje krejt të re nga tab-i "Krijo familje".

Të dhënat ruhen në `localStorage` të shfletuesit — çdo veprim (transfer, limit,
qëllim kursimi) ruhet automatikisht dhe mbetet pas rifreskimit të faqes.

## Struktura e file-ve

```
family-wallet/
├── index.html          → struktura e të gjitha ekraneve (auth + app shell + 7 views)
├── style.css           → design system i plotë (paleta, tipografia, layout, responsive)
├── data.js             → modeli i të dhënave demo + helper-at e localStorage
├── app.js              → gjithë logjika: auth, navigim, wallet, transfer, limite,
│                          grafikë, qëllime, badges, AI advisor (rule-based)
└── sql/
    └── schema.sql      → schema e plotë MySQL për versionin production (PHP/Node.js)
```

## Funksionet e implementuara

- **Sistem hyrjeje** me zgjedhje profili + PIN (simulim i login-it real)
- **Role: Parent vs Child** me akses të kufizuar te seksioni "Kontrolli"
- **Wallet system**: fondi kryesor + sub-wallet për çdo anëtar
- **Transferta të brendshme**: dërgo para, kërko para (me aprovim nga prindi)
- **Spending control**: limite ditore/mujore + bllokim kategorish (fast food, lojëra...)
- **Historiku i transaksioneve** me filtra (person, kategori, lloj, kërkim teksti)
- **Smart notifications**: alarme automatike kur kalohet 80%/100% e limitit, kërkesa
  e aprovuar, transfer i ri etj.
- **Dashboard**: bilanci total, trendi 6-mujor, kush shpenzon më shumë, shpenzimet
  sipas kategorisë, "pema e familjes"
- **Saving Goals + Gamification**: qëllime kursimi me progress bar dhe badges
- **AI Spending Advisor**: analizë e bazuar në rregulla (% e shpenzimit në një
  kategori, krahasim muaj-më-muaj, afërsi me limitin) e paraqitur si këshilla

## Si ta zgjerosh në backend real (PHP/Node.js + MySQL)

1. Importo `sql/schema.sql` në MySQL (`mysql -u root -p < sql/schema.sql`).
2. Zëvendëso funksionet `loadDB()` / `saveDB()` te `data.js` me thirrje `fetch()`
   drejt API-t tënde (REST endpoints për: login, members, transactions, requests,
   goals, badges, notifications).
3. Hash-o PIN/password me `password_hash()` (PHP) ose `bcrypt`/`argon2` (Node.js) —
   schema parashikon `pin_hash`/`password_hash`, jo tekst të thjeshtë.
4. Zëvendëso `checkLimits()` në `app.js` me validim të njëjtë në backend
   (trigger-i `trg_check_daily_limit` në schema jep një shembull se si mund të
   zbatohet edhe në nivel databaze).
5. Lidh `allowance_schedules` me një cron job (p.sh. `node-cron` ose Linux cron +
   skript PHP) për shpërndarjen automatike javore.

## Teknologjitë

- Frontend: HTML5, CSS3 (custom properties, grid, flexbox), JavaScript vanilla
- Charts: Chart.js 4.x (line, bar, doughnut)
- Database: MySQL 8+ (schema e plotë me views dhe trigger)
- Backend i propozuar: PHP ose Node.js/Express (jo i implementuar në demo)
