/* Customers: who is growing, who is slipping, what each account manager should do today,
   where the white space is, and the quotes in flight. Every row opens the customer, order,
   quote, product or PO behind it. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, dm } = PD.date;
  const B = UI.B;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const first = (k) => DB.person(k).split(" ")[0];
  const rng = (lo, hi) => eur(lo) + " to " + eur(hi);
  const months = (n) => Array.from({ length: n }, (_, i) => PD.date.MS[new Date(PD.date.TODAY.getFullYear(), PD.date.TODAY.getMonth() - (n - 1) + i, 1).getMonth()]);

  /* ---------------- the book, by account manager ----------------
     MTD revenue sums to €1,084,620 (DB.kpi.revenueMTD); accounts to 437; health to
     131 growing / 271 stable / 18 declining / 17 at risk; weighted margin 23.8%.
     Quote conversion: 51 won of 133 issued in 90 days = 38%. */
  const AMS = [
    { k: "SB", role: "Senior account manager", accounts: 118, mtd: 318460, gm: 24.3, health: [38, 70, 5, 5], issued: 34, won: 15 },
    { k: "MR", role: "Account manager", accounts: 134, mtd: 296240, gm: 25.4, health: [41, 85, 4, 4], issued: 41, won: 17 },
    { k: "DK", role: "Account manager", accounts: 157, mtd: 262780, gm: 24.1, health: [42, 102, 7, 6], issued: 46, won: 14 },
    { k: "MD", role: "National accounts", accounts: 28, mtd: 207140, gm: 20.4, health: [10, 14, 2, 2], issued: 12, won: 5 }
  ];
  const HEALTH = [["Growing", 131], ["Stable", 271], ["Declining", 18], ["At risk", 17]];
  const HTONE = { Growing: "ok", Stable: "neutral", Declining: "warn", "At risk": "bad" };
  const HCOL = { Growing: "var(--ok)", Stable: "var(--faint)", Declining: "var(--warn)", "At risk": "var(--bad)" };
  const healthBadge = (x) => UI.Badge(x, HTONE[x] || "neutral");
  // The 419 smaller accounts are whatever the 18 key accounts do not cover.
  const SMALL = HEALTH.map((x) => x[1] - DB.customers.filter((c) => c.health === x[0]).length);

  /* ---------------- per-account helpers ---------------- */
  const seed = (str) => { let x = 0; for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
  const sparkOf = (c) => { const r = seed("cu-" + c.id), base = c.ytd / 9; return Array.from({ length: 8 }, (_, i) => Math.round(base * (1 + (c.trend / 100) * (i / 7 - .5)) * (.95 + r() * .1))); };
  const trendTone = (t) => t <= -5 ? "bad" : t < 0 ? "warn" : "ok";
  const trendCell = (c) => h("div", { className: "pd-split", style: { gap: 8 } }, UI.Spark(sparkOf(c), trendTone(c.trend), 50, 18),
    h("span", { className: "pd-mono", style: { fontSize: 11.5, color: c.trend < 0 ? PD.TONE[trendTone(c.trend)].fg : "var(--body)" } }, (c.trend > 0 ? "+" : "") + c.trend.toFixed(1) + "%"));
  const lastPlaced = (id) => { const os = DB.orders.filter((o) => o.cust === id); return os.length ? Math.max.apply(null, os.map((o) => o.placed || 0)) : -7; };
  const cadence = (c) => Math.max(1, Math.round(270 / c.orders));
  const workday = (n) => { let k = n; while ([0, 6].indexOf(D(k).getDay()) > -1) k++; return k; };
  const nextDays = (c) => workday(Math.max(1, lastPlaced(c.id) + cadence(c)));
  const NEXT_OVERRIDE = { ryan: ["M10 bolts 23 days overdue", "bad"] };
  const usedTone = (c) => c.out / c.limit > .8 ? "bad" : c.out / c.limit > .6 ? "warn" : "neutral";
  const openAny = (ctx, o) => (o[0] === "go" ? ctx.go(o[1], o[2]) : ctx.open(o[0], o[1]));

  /* ======================================================== OVERVIEW */
  const PLAN = {
    SB: [
      { c: "murphy", x: "Confirm the split on SO-10482, then raise PPE: nothing bought in 74 days", o: ["order", "SO-10482"] },
      { c: "doyle", x: "Get a date for INV-28482 (€11,860, 61 days) before SO-10503 is released", o: ["customer", "doyle"] },
      { c: "dunmore", x: "€8,120 over 60 days and spend down 6.2%. Ring Joe Dunmore with Rachel Hayes", o: ["customer", "dunmore"] },
      { c: "harbour", x: "Tell Fiona Ward the Phase 2 quote QT-2859 is with Michael for approval", o: ["quote", "QT-2859"] }
    ],
    DK: [
      { c: "ryan", x: "No M10 bolts in 47 days. Ask Declan Ryan straight out who he is buying them from", o: ["customer", "ryan"] },
      { c: "obrien", x: "QT-2841 is decided at 11:00. Have the €19,429 counter ready for Ciarán Lacey", o: ["quote", "QT-2841"] },
      { c: "southside", x: "QT-2864 unanswered for 34 days. Call Gerry Mahon or close it", o: ["quote", "QT-2864"] },
      { c: "atlantic", x: "QT-2847 matches a competitor at 19.9%. Find out which lines before conceding", o: ["quote", "QT-2847"] }
    ],
    MR: [
      { c: "horizon", x: "Seán Horan rang at 09:02. 7 of 8 lines go on D14 today, the glands after PO-8821 lands", o: ["order", "SO-10488"] },
      { c: "midland", x: "QT-2855 is 12 days old and expires in 2. Chase Tom Delaney", o: ["quote", "QT-2855"] },
      { c: "core", x: "QT-2850 at 28.9% is with Deirdre Walsh. Raise hand tools while you are on", o: ["quote", "QT-2850"] },
      { c: "glenview", x: "2 pallets of SO-10490 were left at Naas. Confirm this afternoon's slot with Emer Nolan", o: ["order", "SO-10490"] }
    ],
    MD: [
      { t: "4 quotes below target", x: "QT-2841 by 11:00, then QT-2847, QT-2853 and QT-2859: €15,408 of GP at stake", o: ["go", "Customers", "Quotes"] },
      { c: "leinster", x: "QT-2838 (€42,600) is on day 9 of 14. Push Alison Grant for a decision", o: ["quote", "QT-2838"] },
      { c: "leinster", x: "SO-10525 went through at 19.2%. Check the EDI price file before the next drop", o: ["order", "SO-10525"] }
    ]
  };

  function overview(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const holds = DB.creditHolds;
    const qVal = sum(DB.quotes.map((q) => q.value));

    const kpis = UI.Kpis([
      { label: "Active accounts", value: num(DB.company.accounts), sub: "+6 this quarter", onClick: () => go("Customers", "Accounts") },
      { label: "Revenue MTD", value: eurK(DB.kpi.revenueMTD), sub: DB.kpi.revenueDelta, subTone: "ok", onClick: () => go("Finance", "Revenue") },
      { label: "Average order", value: "€6,420", sub: "+3.2% on last month" },
      { label: "Quotes open", value: eurK(qVal), sub: DB.quotes.length + " quotes · 38% conversion", onClick: () => go("Customers", "Quotes") },
      { label: "Accounts declining", value: String(HEALTH[2][1]), sub: "€212k annual spend exposed", tone: "warn", subTone: "warn", onClick: () => go("Customers", "Customer Health") },
      { label: "Credit holds", value: String(holds.length), sub: eur(sum(holds.map((o) => o.value))) + " held", tone: "bad", onClick: () => go("Finance", "Credit Control") }
    ]);

    /* revenue by account manager */
    const maxMtd = Math.max.apply(null, AMS.map((a) => a.mtd));
    const amCard = UI.Card({ flush: true, title: "Revenue by account manager", meta: "MONTH TO DATE · " + eur(DB.kpi.revenueMTD), delay: 60 }, [
      UI.Table({
        rows: AMS, rowKey: (a) => a.k, onRow: (a) => { ctx.set({ cuAm: a.k, cuHealth: "all" }); go("Customers", "Accounts"); },
        cols: [
          { label: "Account manager", w: "minmax(170px,1.4fr)", render: (a) => h("div", { className: "pd-split", style: { gap: 9 } }, UI.Avatar(a.k),
            h("div", { style: { minWidth: 0 } }, h("div", { style: { color: "var(--ink)", fontSize: 12.5 } }, DB.person(a.k)), h("div", { className: "pd-meta", style: { marginTop: 1 } }, a.role.toUpperCase()))) },
          { label: "Accounts", w: "70px", r: true, num: true, render: (a) => a.accounts },
          { label: "Revenue MTD", w: "minmax(150px,1.3fr)", render: (a) => h("div", { className: "pd-split", style: { gap: 8 } }, h("div", { className: "pd-grow" }, UI.Bar(100 * a.mtd / maxMtd, "neutral")), h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)", width: 66, textAlign: "right" } }, eur(a.mtd))) },
          { label: "Margin", w: "66px", r: true, num: true, render: (a) => h("span", { style: { color: a.gm < 23 ? "var(--warn)" : "var(--body)" } }, a.gm.toFixed(1) + "%") },
          { label: "Slipping", w: "74px", r: true, num: true, render: (a) => h("span", { style: { color: "var(--warn)" } }, String(a.health[2] + a.health[3])) },
          { label: "Open quotes", w: "104px", r: true, num: true, render: (a) => { const qs = DB.quotes.filter((q) => q.am === a.k); return qs.length + " · " + eurK(sum(qs.map((q) => q.value))); } }
        ]
      }),
      h("div", { style: { padding: "12px 20px 16px" } }, UI.Note("Michael Doyle's 28 national accounts run at 20.4%: EDI price files and 45-day terms. Leinster Retail alone is 19.8%. Click a manager to see their accounts."))
    ]);

    /* health */
    const movers = [
      ["ryan", "Stable → Declining", "Spend down 28% in 90 days, almost all fixings", "bad"],
      ["southside", "Stable → Declining", "Quote unanswered 34 days, €2,410 overdue", "warn"],
      ["doyle", "Stable → At risk", "€21,200 overdue, an order and a quote blocked", "bad"],
      ["harbour", "Stable → Growing", "+14.6%, Phase 2 fit-out quoted", "ok"]
    ];
    const healthCard = UI.Card({ title: "Customer health", icon: "user", meta: "437 ACTIVE ACCOUNTS", delay: 100, right: UI.Btn("Details", () => go("Customers", "Customer Health"), { sm: true, ghost: true }) }, [
      UI.Split(HEALTH.map((x) => ({ label: x[0], v: x[1], color: HCOL[x[0]], d: String(x[1]) }))),
      UI.Sep(),
      UI.Label("Moved this month"),
      ...movers.map((m) => UI.Row({ key: m[0], onClick: () => ctx.open("customer", m[0]) }, [
        UI.Dot(m[3]),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.custName(m[0])), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, m[2])),
        h("span", { className: "pd-meta" }, m[1].toUpperCase())]))
    ]);

    /* what each AM should do today */
    const planCol = (a, i) => h("div", { key: a.k, style: { padding: "14px 15px 12px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--surface-2)", minWidth: 0, animation: "riseIn .4s var(--ease) " + (160 + i * 60) + "ms both" } },
      h("div", { className: "pd-split", style: { gap: 9 } }, UI.Avatar(a.k, null, 28),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 13.5, fontWeight: 500 } }, DB.person(a.k)), h("div", { className: "pd-meta", style: { marginTop: 2 } }, a.accounts + " ACCOUNTS · " + eurK(a.mtd) + " MTD"))),
      h("div", { style: { marginTop: 8 } }, ...PLAN[a.k].map((p, j) => UI.Row({ key: j, onClick: () => openAny(ctx, p.o), style: { alignItems: "flex-start", gap: 10 } }, [
        h("span", { className: "pd-mono", style: { width: 14, flex: "none", fontSize: 11.5, color: "var(--accent-text)", paddingTop: 1 } }, String(j + 1)),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5, color: "var(--ink)" } }, p.t || DB.custName(p.c)), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2, lineHeight: 1.45 } }, p.x))]))),
      h("div", { style: { marginTop: 8 } }, UI.Btn("What should " + first(a.k) + " say?", () => ctx.ask("What should " + first(a.k) + " call customers about today?"), { sm: true, ghost: true, icon: "spark" })));
    const planCard = UI.Card({ title: "What each account manager should do today", icon: "phone", meta: "CUSTOMER AGENT · RANKED BY VALUE AT STAKE", delay: 140 },
      UI.Grid("repeat(4,minmax(0,1fr))", AMS.map(planCol), { style: { marginBottom: 0 } }));

    /* pre-call view */
    const m = DB.customer("murphy");
    const mOrders = DB.orders.filter((o) => o.cust === "murphy");
    const mInv = DB.invoices.filter((x) => x.cust === "murphy");
    const mQ = DB.quotes.filter((q) => q.cust === "murphy");
    const mRet = DB.returns.filter((r) => r.cust === "murphy");
    const tile = (k, v, s, tone, onClick) => h("div", { key: k, className: PD.cx("pd-fact", onClick && "pd-click"), onClick },
      h("div", { className: "k" }, k), h("div", { className: "v", style: tone ? { color: PD.TONE[tone].fg } : null }, v), s ? h("div", { className: "s" }, s) : null);
    const mNext = nextDays(m);
    const precall = UI.Card({ title: "Before Sarah rings Ger Murphy", icon: "phone", meta: "EVERYTHING ON ONE SCREEN", delay: 200, right: UI.Btn("Open account", () => ctx.open("customer", "murphy"), { sm: true, ghost: true }) }, [
      UI.P(["Account managers used to ring customers from memory and a Sage printout. This is what Pulse puts in front of Sarah before she dials. Every tile opens the record behind it."], { marginBottom: 12, color: "var(--dim)" }),
      h("div", { className: "pd-facts", style: { gridTemplateColumns: "repeat(4,minmax(0,1fr))" } },
        tile("Purchase history", eur(m.ytd) + " YTD", "+" + m.trend + "% · " + m.orders + " orders", null, () => ctx.open("customer", "murphy")),
        tile("Favourite products", "M10 bolts, T&E", "FIX-2201 every 9 days", null, () => ctx.open("product", "FIX-2201")),
        tile("Declining spend", "PPE: 74 days", "Was monthly, now nothing", "warn", () => go("Customers", "Opportunities")),
        tile("Outstanding invoices", eur(sum(mInv.map((x) => x.value))), mInv.length + " invoices · oldest " + Math.max.apply(null, mInv.map((x) => x.days)) + " days · all current", "ok", () => go("Finance", "Debtors")),
        tile("Open quotes", mQ[0].id + " · " + eurK(mQ[0].value), "With customer " + mQ[0].age + " days · " + mQ[0].margin + "%", null, () => ctx.open("quote", mQ[0].id)),
        tile("Open orders", mOrders.length + " · " + eur(sum(mOrders.map((o) => o.value))), "SO-10482: 3 lines short", null, () => ctx.open("order", "SO-10482")),
        tile("Delayed deliveries", "Waiting on PO-8821", "Atlas 5 days late · lands " + relLower(D(1)) + " 10:30", "bad", () => ctx.open("po", "PO-8821")),
        tile("Returns", mRet.length + " this quarter", mRet.length ? mRet[0].id + " · " + mRet[0].reason.toLowerCase() + " · " + mRet[0].credit.toLowerCase() : "None", null, () => go("Delivery", "Delivery Issues")),
        tile("Margin", m.gm + "%", "M10 still €21.20 on an €18.10 cost", "warn", () => go("Pricing & Margin", "Price Lists")),
        tile("Opportunity", "€22k to €34k a year", "PPE: 68% of similar merchants buy it", "info", () => go("Customers", "Opportunities")),
        tile("Recommended", "Glasses, gloves, boots", "SAF-1892: 1,630 spare in Naas", null, () => ctx.open("product", "SAF-1892")),
        tile("Next likely order", rel(D(mNext)), "About " + eurK(m.avg) + ", usually fixings and cable", null, () => ctx.open("customer", "murphy")))
    ]);

    const agent = UI.AI({ who: "Customer Agent", conf: "UPDATED 09:14",
      text: "Revenue is up 8.4%, but key-account growth is narrow: Murphy, Harbour Point and O'Brien carry most of it. 18 accounts are declining, €212k of annual spend. The biggest single break is Ryan Trade Supplies: no M10 bolts in 47 days, €34,080 a year at risk. The biggest single gain is Murphy's PPE gap, worth €22,000 to €34,000 a year.",
      actions: [UI.Btn("Customer health", () => go("Customers", "Customer Health"), { pri: true, sm: true }), UI.Btn("Which customers have reduced spend?", () => ctx.ask("Which customers have reduced spend?"), { sm: true, ghost: true, icon: "spark" })] });

    const top = DB.customers.slice().sort((a, b) => b.ytd - a.ytd).slice(0, 8);
    const topCard = UI.Card({ flush: true, title: "Top accounts", meta: "REVENUE YTD", delay: 240, right: UI.Btn("All accounts", () => go("Customers", "Accounts"), { sm: true, ghost: true }) }, [
      UI.Table({ rows: top, rowKey: (c) => c.id, onRow: (c) => ctx.open("customer", c.id), rowTone: (c) => c.health === "At risk" ? "bad" : c.health === "Declining" ? "warn" : null,
        cols: [
          { label: "Customer", w: "minmax(150px,1.5fr)", ink: true, render: (c) => h("div", { style: { minWidth: 0 } }, h("div", { className: "pd-ell" }, c.name), h("div", { className: "pd-meta", style: { marginTop: 1 } }, DB.person(c.am).toUpperCase())) },
          { label: "YTD", w: "80px", r: true, num: true, ink: true, render: (c) => eurK(c.ytd) },
          { label: "Trend", w: "112px", render: trendCell },
          { label: "Health", w: "84px", render: (c) => healthBadge(c.health) }
        ] })
    ]);

    return UI.Page({
      kicker: "Customers · 437 active accounts", live: "SAGE 200 · B2B PORTAL · OUTLOOK",
      title: "Who is growing, who is slipping, and who to ring today",
      sub: "Revenue, margin, credit, service and buying patterns for every account, so nobody picks up the phone without knowing what the customer is about to say.",
      actions: [UI.Btn("Accounts", () => go("Customers", "Accounts"), { pri: true }), UI.Btn("Opportunities", () => go("Customers", "Opportunities"), { icon: "spark" })],
      children: [
        kpis,
        UI.Grid("minmax(0,1.35fr) minmax(0,1fr)", [amCard, healthCard]),
        planCard,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [precall, h("div", null, agent, h("div", { style: { height: 14 } }), topCard)])
      ]
    });
  }

  /* ======================================================== ACCOUNTS */
  function accounts(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const am = ctx.st.cuAm || "all", hl = ctx.st.cuHealth || "all";
    const all = DB.customers.slice().sort((a, b) => b.ytd - a.ytd);
    const rows = all.filter((c) => (am === "all" || c.am === am) && (hl === "all" || c.health === hl));
    const ytd = sum(rows.map((c) => c.ytd));
    const wgm = ytd ? sum(rows.map((c) => c.ytd * c.gm)) / ytd : 0;
    const amChips = [["all", "All managers", all.length]].concat(AMS.map((a) => [a.k, DB.person(a.k), all.filter((c) => c.am === a.k).length]));
    const hlChips = [["all", "All health", all.length]].concat(HEALTH.map((x) => [x[0], x[0], all.filter((c) => c.health === x[0]).length]));

    const table = UI.Card({ flush: true, title: rows.length + " key accounts · " + eur(ytd) + " YTD", meta: "CLICK A ROW FOR THE FULL ACCOUNT" }, [
      UI.Table({
        rows, rowKey: (c) => c.id, onRow: (c) => ctx.open("customer", c.id), rowTone: (c) => c.health === "At risk" ? "bad" : c.health === "Declining" ? "warn" : null,
        empty: "No key account matches both filters. The 419 smaller accounts are summarised below.",
        foot: "Showing " + rows.length + " of " + all.length + " key accounts. " + num(DB.company.accounts - all.length) + " smaller accounts (trade counter, portal and tier C) are summarised: " + SMALL[0] + " growing, " + SMALL[1] + " stable, " + SMALL[2] + " declining, " + SMALL[3] + " at risk.",
        cols: [
          { label: "Customer", w: "minmax(190px,1.5fr)", ink: true, render: (c) => h("div", { style: { minWidth: 0 } }, h("div", { className: "pd-ell" }, c.name), h("div", { className: "pd-meta", style: { marginTop: 1 } }, "TIER " + c.tier + " · SINCE " + c.since)) },
          { label: "Type", w: "minmax(150px,1fr)", render: (c) => h("span", { title: c.type }, c.type) },
          { label: "Account manager", w: "112px", render: (c) => DB.person(c.am) },
          { label: "Revenue YTD", w: "96px", r: true, num: true, ink: true, render: (c) => eur(c.ytd) },
          { label: "Trend", w: "116px", render: trendCell },
          { label: "Margin", w: "64px", r: true, num: true, render: (c) => h("span", { style: { color: c.gm < 22 ? "var(--warn)" : "var(--body)" } }, c.gm.toFixed(1) + "%") },
          { label: "Outstanding / limit", w: "176px", render: (c) => h("div", { className: "pd-split", style: { gap: 8 } }, UI.Bar(100 * c.out / c.limit, usedTone(c), { w: 44 }), h("span", { className: "pd-mono", style: { fontSize: 11.5, color: usedTone(c) === "neutral" ? "var(--body)" : PD.TONE[usedTone(c)].fg } }, eurK(c.out) + " / " + eurK(c.limit))) },
          { label: "OTIF", w: "62px", r: true, num: true, render: (c) => h("span", { style: { color: c.otif < 94 ? "var(--warn)" : "var(--body)" } }, c.otif.toFixed(1) + "%") },
          { label: "Last order", w: "92px", render: (c) => rel(D(lastPlaced(c.id))) },
          { label: "Next likely order", w: "154px", render: (c) => NEXT_OVERRIDE[c.id] ? h("span", { style: { color: PD.TONE[NEXT_OVERRIDE[c.id][1]].fg } }, NEXT_OVERRIDE[c.id][0])
            : h("span", null, h("span", { style: { color: "var(--ink)" } }, rel(D(nextDays(c)))), h("span", { className: "pd-faint" }, " · ~" + eurK(c.avg))) },
          { label: "Health", w: "86px", render: (c) => healthBadge(c.health) }
        ]
      })
    ]);

    const near = all.slice().sort((a, b) => b.out / b.limit - a.out / a.limit).slice(0, 6);
    const credit = UI.Card({ title: "Closest to their credit limit", icon: "shield", meta: "OUTSTANDING AS % OF LIMIT", delay: 80, right: UI.Btn("Credit control", () => go("Finance", "Credit Control"), { sm: true, ghost: true }) }, [
      UI.HBars(near.map((c) => ({ label: c.name, v: Math.round(100 * c.out / c.limit), d: Math.round(100 * c.out / c.limit) + "%", sub: eurK(c.out) + " of " + eurK(c.limit), tone: usedTone(c), onClick: () => ctx.open("customer", c.id) })), { max: 100, colorValue: true, tpl: "minmax(150px,1.4fr) 1fr 44px" }),
      UI.Note(["Doyle Construction is €7,320 from its limit. Releasing ", L.order("SO-10503"), " in full would take it to €58,920."], { marginTop: 8 })
    ]);

    const soon = all.filter((c) => !NEXT_OVERRIDE[c.id] && nextDays(c) <= 5).sort((a, b) => nextDays(a) - nextDays(b) || b.avg - a.avg);
    const expected = UI.Card({ title: "Orders we expect in the next 5 days", icon: "clock", meta: soon.length + " ACCOUNTS · ~" + eurK(sum(soon.map((c) => c.avg))), delay: 120 }, [
      ...soon.slice(0, 7).map((c) => UI.Row({ key: c.id, onClick: () => ctx.open("customer", c.id) }, [
        h("span", { className: "pd-mono", style: { width: 86, flex: "none", fontSize: 11.5, color: "var(--ink)" } }, rel(D(nextDays(c)))),
        h("div", { className: "pd-grow" }, h("div", { className: "pd-ell", style: { fontSize: 12.5 } }, c.name), h("div", { className: "pd-meta", style: { marginTop: 2 } }, "EVERY " + cadence(c) + (cadence(c) === 1 ? " DAY" : " DAYS") + " · " + first(c.am).toUpperCase())),
        h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, "~" + eurK(c.avg))])),
      UI.Note("From each account's normal order interval. Ryan Trade Supplies is left out: its pattern broke 47 days ago.", { marginTop: 8 })
    ]);

    const minorHolds = DB.creditHolds.filter((o) => !DB.customer(o.cust));
    const smaller = UI.Card({ title: "Smaller accounts", icon: "user", meta: num(DB.company.accounts - all.length) + " SUMMARISED", delay: 160 }, [
      UI.Facts(HEALTH.map((x, i) => [x[0], String(SMALL[i]), i >= 2 ? HTONE[x[0]] : null]), 4),
      UI.Label("On credit hold today", { marginTop: 14 }),
      ...minorHolds.map((o) => UI.Row({ key: o.id, onClick: () => ctx.open("order", o.id) }, [
        h("div", { className: "pd-grow" }, h("div", { className: "pd-ell", style: { fontSize: 12.5 } }, DB.custName(o.cust)), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, o.reasonDetail)),
        h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, o.id)]))
    ]);

    return UI.Page({
      kicker: "Customers · accounts", title: "Key accounts",
      sub: "The 18 accounts that carry the book, with revenue, margin, credit, service and when each is likely to order next. Filter by account manager or health.",
      actions: [UI.Btn("Customer health", () => go("Customers", "Customer Health"), { icon: "alert" })],
      children: [
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" } },
          UI.Chips(amChips, am, (v) => ctx.set({ cuAm: v })),
          h("span", { style: { width: 1, height: 20, background: "var(--border)", margin: "0 4px" } }),
          UI.Chips(hlChips, hl, (v) => ctx.set({ cuHealth: v }))),
        UI.Facts([
          ["Accounts shown", String(rows.length), null, am === "all" ? "All managers" : DB.person(am)],
          ["Revenue YTD", eur(ytd)],
          ["Margin", rows.length ? wgm.toFixed(1) + "%" : "None", wgm && wgm < 23 ? "warn" : null, "Weighted by revenue"],
          ["Outstanding", eur(sum(rows.map((c) => c.out)))],
          ["Over 60% of limit", String(rows.filter((c) => c.out / c.limit > .6).length), rows.some((c) => c.out / c.limit > .8) ? "bad" : null],
          ["Declining or at risk", String(rows.filter((c) => c.health === "Declining" || c.health === "At risk").length), rows.some((c) => c.health === "At risk" || c.health === "Declining") ? "warn" : null]
        ], 6),
        h("div", { style: { height: 14 } }),
        table,
        h("div", { style: { height: 14 } }),
        UI.Grid("repeat(3,minmax(0,1fr))", [credit, expected, smaller])
      ]
    });
  }

  /* ======================================================== OPPORTUNITIES */
  const CAT_SHORT = [["Electrical", "Electrical"], ["Fixings & Fasteners", "Fixings"], ["Safety & PPE", "PPE"], ["Hand & Power Tools", "Tools"], ["Industrial Consumables", "Consumables"], ["Adhesives & Sealants", "Adhesives"], ["Facilities & Hygiene", "Hygiene"], ["Lighting", "Lighting"]];
  // Per account, in CAT_SHORT order. B buys · D falling · L lapsed · G gap (peers buy it) · - not relevant
  const MATRIX = {
    murphy: "BBLBBB-B", leinster: "BBBBGB-B", core: "BBBGBBBB", doyle: "BBBBBG-G", westbrook: "BBBBBB-L", obrien: "BBBGBGBB",
    horizon: "BBGBB--B", harbour: "BBBBBB-G", midland: "BBBBBB-G", liffey: "BBGBBB--", atlantic: "BBB-BBLB", dunmore: "-BBBD---",
    kelleher: "BBBBBB--", brennan: "BBBBB---", tallaght: "BBBBBB-B", ryan: "BDBBBB-B", glenview: "BBBBBBBG", southside: "BBGB-B-B"
  };
  const PEER = [81, 88, 64, 72, 69, 58, 31, 47];
  const OPPS = [
    { id: "murphy", cat: "Safety & PPE", peer: 68, lo: 22000, hi: 34000, why: "Buys Electrical, Fixings and Tools. PPE lapsed 74 days ago." },
    { id: "leinster", cat: "Industrial Consumables", peer: 46, lo: 18000, hi: 26000, why: "14 stores stock our fixings but buy discs and ties elsewhere." },
    { id: "core", cat: "Hand & Power Tools", peer: 54, lo: 14000, hi: 19000, why: "Site teams buy tools on cards at a competitor's counter." },
    { id: "horizon", cat: "Safety & PPE", peer: 71, lo: 8500, hi: 12000, why: "64 orders a year, no PPE on any of them." },
    { id: "doyle", cat: "Lighting", peer: 49, lo: 7000, hi: 10000, why: "Hansfield site lighting. Hold until the credit position is sorted.", hold: true },
    { id: "liffey", cat: "Safety & PPE", peer: 63, lo: 6500, hi: 9000, why: "M&E crews buy gloves and glasses locally." },
    { id: "harbour", cat: "Lighting", peer: 49, lo: 6000, hi: 9000, why: "Phase 2 fit-out on QT-2859 has no lighting lines." },
    { id: "obrien", cat: "Adhesives & Sealants", peer: 52, lo: 5200, hi: 7400, why: "The 5-site agreement in QT-2841 leaves sealants out." },
    { id: "midland", cat: "Lighting", peer: 49, lo: 5000, hi: 7500, why: "No lighting range; peer merchants carry battens and floods." }
  ];
  // [stage values €k a year: identified, contacted, quoted, won this quarter], [counts]
  const PIPE = { SB: [[58, 34, 28, 19], [6, 4, 3, 2]], MR: [[46, 29, 22, 24], [5, 4, 3, 3]], DK: [[51, 18, 31, 12], [7, 3, 4, 2]], MD: [[32, 26, 42, 30], [2, 2, 3, 2]] };
  const PIPE_COL = ["var(--faint)", "var(--dim)", "var(--accent)", "var(--ok)"];
  const PIPE_LBL = ["Identified", "Contacted", "Quoted", "Won this quarter"];
  const oppText = (o) => o.id === "murphy"
    ? "Murphy Building Supplies: PPE range, €4,800 to €6,200 now and €22,000 to €34,000 a year, assigned to Sarah Byrne."
    : DB.custName(o.id) + ": " + o.cat + ", " + rng(o.lo, o.hi) + " a year, assigned to " + DB.person(DB.customer(o.id).am) + ".";

  function opportunities(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const lo = sum(OPPS.map((o) => o.lo)), hi = sum(OPPS.map((o) => o.hi));
    const gaps = sum(Object.keys(MATRIX).map((k) => MATRIX[k].split("").filter((x) => x === "G").length));
    const lapsed = Object.keys(MATRIX).filter((k) => /[LD]/.test(MATRIX[k])).length;
    const openPipe = sum(Object.keys(PIPE).map((k) => sum(PIPE[k][0].slice(0, 3))));
    const openN = sum(Object.keys(PIPE).map((k) => sum(PIPE[k][1].slice(0, 3))));
    const wonV = sum(Object.keys(PIPE).map((k) => PIPE[k][0][3])), wonN = sum(Object.keys(PIPE).map((k) => PIPE[k][1][3]));
    const mDone = ctx.done("opp-murphy");

    /* hero: sales opportunity intelligence */
    const mix = [["Electrical", "46%"], ["Fixings", "24%"], ["Tools", "17%"], ["Adhesives", "8%"], ["Lighting", "5%"]];
    const recs = [
      ["SAF-1892", "1,630 in Naas, 22 weeks of cover"],
      ["IC-3405", "940 in Dublin, 1,000 more landing at Naas today on PO-8833"],
      ["SAF-1905", "128 in Naas, a slow mover"],
      ["SAF-1740", "1,640 in Naas with no demand: clear it into the starter pack"]
    ];
    const hero = UI.Card({ tint: true, title: "Sales opportunity intelligence", icon: "spark", meta: "CUSTOMER AGENT · MURPHY BUILDING SUPPLIES", delay: 40 }, [
      h("div", { style: { fontSize: 17, lineHeight: 1.5, letterSpacing: "-.2px", color: "var(--ink)", maxWidth: 720 } },
        L.cust("murphy"), " buys Electrical, Fixings and Tools from us, but no PPE. Similar customers buy PPE from us 68% of the time."),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 } },
        ...mix.map((x) => h("span", { key: x[0], className: "pd-step" }, x[0] + " " + x[1])),
        h("span", { className: "pd-step gate" }, "Safety & PPE: none in 74 days")),
      h("div", { style: { height: 14 } }),
      UI.Facts([
        ["Similar customer penetration", "68%", null, "41 merchants of similar size"],
        ["Expected opportunity", "€22,000 to €34,000", "info", "Annual revenue"],
        ["Last PPE order", "74 days ago", "warn", "Was monthly"],
        ["Restart order", "€4,800 to €6,200", null, "Glasses, gloves, boots, hi-vis"]
      ], 4),
      UI.Label("Recommended products", { marginTop: 14 }),
      ...recs.map((r) => { const p = DB.product(r[0]); return UI.Row({ key: r[0], onClick: () => ctx.open("product", r[0]) }, [
        h("span", { className: "pd-mono", style: { width: 70, flex: "none", fontSize: 11.5, color: "var(--ink)" } }, r[0]),
        h("div", { className: "pd-grow" }, h("div", { className: "pd-ell", style: { fontSize: 12.5 } }, p.name), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, r[1])),
        h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, eur(p.price, 2)),
        UI.Badge(p.health.toUpperCase(), p.health === "Critical" ? "bad" : ["Excess", "Slow", "Dead"].indexOf(p.health) > -1 ? "warn" : "neutral", true)]); }),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 } },
        UI.Btn("Create Opportunity", () => ctx.act("opp-murphy", "Opportunity created", oppText(OPPS[0])), { pri: true, icon: "plus", done: mDone, doneLabel: "Opportunity created" }),
        UI.Btn("Draft PPE offer", () => ctx.act("mail-murphy", "Draft ready", "PPE restart offer to Karen Dolan in Sarah Byrne's Outlook: glasses, gloves, boots and hi-vis at contract pricing."), { done: ctx.done("mail-murphy"), doneLabel: "Drafted" }),
        UI.Btn("Open Murphy", () => ctx.open("customer", "murphy"), { ghost: true }))
    ]);
    const sizing = UI.Card({ title: "How Pulse sized it", icon: "link", meta: "FROM SAGE 200 SALES HISTORY", delay: 80 }, UI.Chain([
      { k: "Peer group", t: "41 builders' merchants", d: "€300k to €800k a year with us, Leinster and Munster", icon: "user" },
      { k: "Penetration", t: "68% buy PPE from us", d: "Median PPE share: 4.0% to 6.2% of their spend", icon: "box" },
      { k: "Murphy", t: "€548k over the last 12 months", d: "Spend up 12.4%, mostly electrical", icon: "euro", onClick: () => ctx.open("customer", "murphy") },
      { k: "Gap", t: "€22,000 to €34,000 a year", d: "4.0% to 6.2% of €548k", icon: "spark", tone: "info" },
      { k: "Why now", t: "PPE was monthly until 74 days ago", d: "Karen Dolan used to add it to the fixings order", icon: "clock", tone: "warn" },
      { k: "Owner", t: mDone ? "Opportunity with Sarah Byrne" : "Sarah Byrne, when you say so", d: mDone ? "Logged against the account" : "Nothing is created until someone clicks", icon: mDone ? "check" : "user", tone: mDone ? "ok" : null }
    ]));

    /* white space matrix */
    const cellOf = (x) => x === "B" ? h("span", { className: "pd-dot", style: { background: "var(--ok)", opacity: .75 } })
      : x === "G" ? UI.Badge("Gap", "info") : x === "L" ? UI.Badge("Lapsed", "warn") : x === "D" ? UI.Badge("Falling", "bad") : null;
    const mRows = DB.customers.slice().sort((a, b) => b.ytd - a.ytd);
    const matrix = UI.Card({ flush: true, title: "White space by category", meta: gaps + " GAPS · " + lapsed + " LAPSED OR FALLING · 18 KEY ACCOUNTS", delay: 120 }, [
      h("div", { className: "pd-legend", style: { padding: "0 20px 10px" } },
        h("span", null, h("i", { style: { background: "var(--ok)", borderRadius: "50%" } }), "Buys from us"),
        h("span", null, h("i", { style: { background: "var(--accent)" } }), "Gap: peers buy it"),
        h("span", null, h("i", { style: { background: "var(--warn)" } }), "Lapsed"),
        h("span", null, h("i", { style: { background: "var(--bad)" } }), "Falling"),
        h("span", { className: "pd-faint" }, "Blank: not relevant to this trade")),
      UI.Table({
        rows: mRows, rowKey: (c) => c.id, onRow: (c) => ctx.open("customer", c.id),
        cols: [{ label: "Customer", w: "minmax(180px,1.6fr)", ink: true, render: (c) => h("span", { className: "pd-ell" }, c.name) }]
          .concat(CAT_SHORT.map((k, i) => ({ label: k[1], w: "minmax(78px,1fr)", render: (c) => cellOf((MATRIX[c.id] || "")[i]) }))),
        foot: "Peer penetration across all 437 accounts: " + CAT_SHORT.map((k, i) => k[1] + " " + PEER[i] + "%").join(", ") + "."
      })
    ]);

    /* ranked cross-sell */
    const ranked = UI.Card({ flush: true, title: "Largest cross-sell gaps", meta: "SIZED FROM PEER SPEND · " + eurK(lo) + " TO " + eurK(hi) + " A YEAR", delay: 160 }, [
      UI.Table({
        rows: OPPS, rowKey: (o) => o.id + o.cat, onRow: (o) => ctx.open("customer", o.id), sel: (o) => o.id === "murphy",
        cols: [
          { label: "Customer", w: "minmax(170px,1.3fr)", ink: true, render: (o) => DB.custName(o.id) },
          { label: "Category", w: "minmax(140px,1fr)", render: (o) => o.cat },
          { label: "Why Pulse flagged it", w: "minmax(240px,2fr)", render: (o) => h("span", { className: "pd-dim", title: o.why }, o.why) },
          { label: "Peers buy", w: "76px", r: true, num: true, render: (o) => o.peer + "%" },
          { label: "Annual value", w: "132px", r: true, num: true, ink: true, render: (o) => eurK(o.lo) + " to " + eurK(o.hi) },
          { label: "Owner", w: "100px", render: (o) => DB.person(DB.customer(o.id).am) },
          { label: "", w: "124px", render: (o) => o.hold ? UI.Badge("HOLD · CREDIT", "bad", true)
            : UI.Btn(o.id === "murphy" ? "Create Opportunity" : "Create", () => ctx.act("opp-" + o.id, "Opportunity created", oppText(o)), { sm: true, pri: o.id === "murphy" && !mDone, done: ctx.done("opp-" + o.id), doneLabel: "Created" }) }
        ]
      })
    ]);

    /* reactivation */
    const LAPSED = [
      { id: "murphy", cat: "Safety & PPE", last: 74, was: "monthly", v: "€4,800 to €6,200 now", note: "Restart with glasses and gloves on the next fixings order.", key: "opp-murphy", btn: "Create Opportunity", txt: oppText(OPPS[0]) },
      { id: "ryan", cat: "Fixings: M10 bolts", last: 47, was: "every 18 to 24 days", v: "€34,080 a year", note: "Pattern broke 47 days ago. Still ordering other lines.", key: "opp-ryan", btn: "Assign Follow-Up", txt: "Ryan Trade Supplies: call Declan Ryan today about the M10 line. Assigned to David Kelly with the price history attached." },
      { id: "atlantic", cat: "Facilities & Hygiene", last: 68, was: "fortnightly", v: "€9,400 a year", note: "Pitch centrefeed now: 600 of FH-6602 land at Naas today. Hold soap until FH-6710 is reordered.", key: "react-atlantic", btn: "Plan call", txt: "Atlantic FM Services: hygiene reactivation call planned for David Kelly, centrefeed first." },
      { id: "westbrook", cat: "Lighting", last: 96, was: "every 3 weeks", v: "€3,100 a quarter", note: "Stopped after Nordic's summer delays. LT-8120 is back: 154 available in Dublin.", key: "react-westbrook", btn: "Plan call", txt: "Westbrook Hardware: lighting reactivation call planned for David Kelly with LT-8120 availability." }
    ];
    const react = UI.Card({ title: "Reactivate lapsed categories", icon: "return", meta: "CUSTOMERS WHO STOPPED BUYING A CATEGORY", delay: 200 },
      LAPSED.map((x) => h("div", { key: x.id, className: "pd-row click", onClick: () => ctx.open("customer", x.id), style: { alignItems: "flex-start" } },
        h("div", { className: "pd-grow" },
          h("div", { className: "pd-split", style: { gap: 8 } }, h("span", { style: { fontSize: 13, fontWeight: 500 } }, DB.custName(x.id)), UI.Badge(x.cat, "warn")),
          h("div", { className: "pd-meta", style: { marginTop: 4 } }, "LAST BOUGHT " + x.last + " DAYS AGO · WAS " + x.was.toUpperCase()),
          h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 4, lineHeight: 1.45 } }, x.note)),
        h("div", { style: { textAlign: "right", flex: "none" } },
          h("div", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)", marginBottom: 8 } }, x.v),
          UI.Btn(x.btn, () => ctx.act(x.key, x.key === "opp-ryan" ? "Follow-up assigned" : x.key === "opp-murphy" ? "Opportunity created" : "Call planned", x.txt), { sm: true, done: ctx.done(x.key), doneLabel: x.key === "opp-ryan" ? "Assigned" : "Done" })))));

    /* lead with stock we need to move */
    const PUSH = [["SAF-1892", ["murphy", "horizon", "liffey"]], ["TL-5204", ["core", "obrien"]], ["LT-8305", ["harbour", "midland"]], ["AD-7340", ["obrien", "harbour"]], ["SAF-1740", ["murphy", "dunmore"]]];
    const push = UI.Card({ title: "Lead with stock we need to move", icon: "box", meta: "SLOW STOCK × ACCOUNTS WITH A GAP", delay: 240, right: UI.Btn("Slow & dead stock", () => go("Inventory", "Slow & Dead Stock"), { sm: true, ghost: true }) }, [
      ...PUSH.map((x) => { const p = DB.product(x[0]); const avail = p.wh === "NAS" ? p.naas[1] : p.avail; return h("div", { key: x[0], className: "pd-row click", onClick: () => ctx.open("product", x[0]), style: { alignItems: "flex-start" } },
        h("div", { className: "pd-grow" },
          h("div", { className: "pd-split", style: { gap: 8 } }, h("span", { className: "pd-mono", style: { fontSize: 11.5, color: "var(--ink)" } }, p.sku), h("span", { className: "pd-ell", style: { fontSize: 12.5 } }, p.name)),
          h("div", { className: "pd-meta", style: { marginTop: 3 } }, p.health.toUpperCase() + " · " + num(avail) + " AVAILABLE · " + (p.idle ? p.idle + " DAYS IDLE" : p.cover.toUpperCase() + " COVER")),
          h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 4 } }, "Offer to ", ...x[1].map((id, i) => h("span", { key: id }, i ? ", " : "", L.cust(id))))),
        h("span", { className: "pd-mono", style: { fontSize: 11.5, flex: "none" } }, eurK(avail * p.cost))); }),
      UI.Note("Value shown at cost. Clearing these through accounts that already buy the category beats a clearance price list.", { marginTop: 8 })
    ]);

    /* pipeline by AM */
    const pipe = UI.Card({ title: "Opportunity pipeline by account manager", icon: "spark", meta: "ANNUAL VALUE · €K", delay: 280 }, [
      UI.Stacked(AMS.map((a) => ({ l: first(a.k), parts: PIPE[a.k][0] })), PIPE_COL, { h: 150 }),
      h("div", { className: "pd-legend", style: { marginTop: 12 } }, ...PIPE_LBL.map((l, i) => h("span", { key: l }, h("i", { style: { background: PIPE_COL[i] } }), l))),
      h("div", { style: { marginTop: 12 } }, UI.Table({
        rows: AMS, rowKey: (a) => a.k,
        cols: [{ label: "", w: "minmax(90px,1fr)", ink: true, render: (a) => first(a.k) }]
          .concat(PIPE_LBL.map((l, i) => ({ label: i === 3 ? "Won" : l, w: "minmax(70px,1fr)", r: true, num: true, render: (a) => PIPE[a.k][1][i] + " · €" + PIPE[a.k][0][i] + "k" })))
      }))
    ]);

    return UI.Page({
      kicker: "Customers · opportunities", title: "What each customer should be buying from us",
      sub: "Pulse compares every account with similar customers, finds the categories they buy elsewhere or have stopped buying, and sizes the gap. Nothing is logged until an account manager accepts it.",
      actions: [UI.Btn("Ask Pulse", () => ctx.ask("What should Sarah call customers about today?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "White space, key accounts", value: eurK(lo) + " to " + eurK(hi), sub: OPPS.length + " sized gaps, " + gaps + " in total", subTone: "ok" },
          { label: "Lapsed or falling", value: String(lapsed) + " accounts", sub: "€34,080 a year on Ryan alone", tone: "warn", onClick: () => go("Customers", "Customer Health") },
          { label: "Open pipeline", value: "€" + openPipe + "k a year", sub: openN + " opportunities across 4 managers" },
          { label: "Won this quarter", value: "€" + wonV + "k a year", sub: wonN + " new categories opened", subTone: "ok" }
        ]),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [hero, sizing]),
        ranked,
        h("div", { style: { height: 14 } }),
        matrix,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.1fr) minmax(0,1fr) minmax(0,1fr)", [react, push, pipe])
      ]
    });
  }

  /* ======================================================== CUSTOMER HEALTH */
  const SIG = [
    ["freq", "Reduced order frequency", 14, "Order frequency", "warn"],
    ["avg", "Reduced average order", 9, "Order size", "warn"],
    ["cat", "Lost category spend", 11, "Lost category", "warn"],
    ["deliv", "Unresolved delivery problems", 6, "Delivery problems", "warn"],
    ["debt", "Overdue debt", 12, "Overdue debt", "bad"],
    ["margin", "Reduced margin", 8, "Margin down", "warn"],
    ["quote", "Quote inactivity", 5, "Quote inactivity", "warn"]
  ];
  const sigOf = (k) => SIG.find((s) => s[0] === k);
  // M10 hex bolt purchase intervals for Ryan Trade Supplies, oldest first; the last one is still open.
  const RYAN_GAPS = [21, 19, 23, 18, 22, 24, 20, 19];
  const RYAN_OPEN = 47;
  // Ryan's 90-day change by category, annualised. Sums to −€18,600.
  const RYAN_CAT = [["Fixings & Fasteners", -15900], ["Electrical", -2100], ["Industrial Consumables", -1300], ["Hand & Power Tools", 700]];

  function health(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const ryan = DB.customer("ryan");
    const sig = ctx.st.cuSig || "all";

    /* Ryan: declining spend */
    const decline = UI.Card({ title: "Declining spend detected: Ryan Trade Supplies", icon: "spark", meta: "CUSTOMER AGENT · 90 DAYS", delay: 40, right: UI.Btn("Open account", () => ctx.open("customer", "ryan"), { sm: true, ghost: true }) }, [
      UI.Facts([
        ["Spend", "↓" + Math.abs(ryan.trend).toFixed(0) + "%", "bad", "Last 90 days vs the 90 before"],
        ["Primary decline", "Fixings", null, "M10 hex bolts"],
        ["Revenue decline", eur(-sum(RYAN_CAT.map((x) => x[1]))), "bad", "Annualised"],
        ["Suggested action", "AM call", null, DB.person(ryan.am) + ", today"]
      ], 4),
      UI.Label("Change by category, annualised", { marginTop: 14, marginBottom: 4 }),
      UI.HBars(RYAN_CAT.map((x) => ({ label: x[0], v: Math.abs(x[1]), d: x[1] < 0 ? eur(x[1]) : "+" + eur(x[1]), tone: x[1] < -10000 ? "bad" : x[1] < 0 ? "warn" : "ok" })), { colorValue: true, tpl: "minmax(130px,1fr) 1.4fr 72px" }),
      UI.Note(["Still ordering: ", L.order("SO-10516"), " came in by phone this morning, €960, 4 lines, no bolts. The 90-day figure only catches the start of it."], { marginTop: 10 })
    ]);

    /* Ryan: buying pattern changed */
    let at = -RYAN_OPEN - sum(RYAN_GAPS);
    const cols = RYAN_GAPS.map((g) => { at += g; return { l: dm(D(at)), v: g, d: g + " days" }; })
      .concat([{ l: "Now", v: RYAN_OPEN, d: RYAN_OPEN + " days, no order", tone: "bad", hi: true }]);
    const pattern = UI.Card({ alert: "bad", title: "Customer buying pattern changed", icon: "alert", meta: "CUSTOMER AGENT · DETECTED 07:12", delay: 80 }, [
      h("div", { style: { fontSize: 15.5, lineHeight: 1.55, color: "var(--ink)", letterSpacing: "-.1px" } },
        L.cust("ryan"), " normally purchases ", L.sku("FIX-2201", "M10 Hex Bolts"), " every 18 to 24 days. Last purchase ", B("47 days ago"), "."),
      h("div", { style: { height: 12 } }),
      UI.Grid("minmax(0,1fr) minmax(0,1.25fr)", [
        UI.Facts([
          ["Normal interval", "18 to 24 days"],
          ["Last purchase", "47 days ago", "bad", "23 days past the longest gap"],
          ["Historical monthly revenue", "€2,840", null, "About 124 boxes a month"],
          ["Estimated revenue at risk", "€34,080", "bad", "Annualised"]
        ], 2),
        h("div", null, UI.Label("Days between M10 orders", { marginBottom: 8 }), UI.Columns(cols, { h: 132, max: 50, target: 24, targetLabel: "24-DAY LIMIT" }))
      ], { style: { marginBottom: 0 } }),
      UI.P(["Pulse suggests: call Declan Ryan today and ask about the M10 line directly. ", DB.person(ryan.am), "'s note from Monday says a competitor is cheaper on fixings, and EuroFix put M10 up 10.4% this month. Ryan pays €22.90 a box. Matching at €21.60 still earns about €5,200 of gross profit a year; losing the line earns nothing."], { marginTop: 14 }),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 } },
        UI.Btn("Assign Follow-Up", () => ctx.act("opp-ryan", "Follow-up assigned", "Ryan Trade Supplies: call Declan Ryan today about the M10 line. Assigned to David Kelly with the price history attached."), { pri: true, icon: "user", done: ctx.done("opp-ryan"), doneLabel: "Follow-up assigned" }),
        UI.Btn("M10 price and cost", () => ctx.open("product", "FIX-2201"), { icon: "tag" }),
        UI.Btn("Cost changes", () => go("Pricing & Margin", "Cost Changes"), { ghost: true }))
    ]);

    /* signals */
    const sigCard = UI.Card({ title: "Signals Pulse watches", icon: "alert", meta: "ACCOUNTS FLAGGED · ALL 437", delay: 120, right: sig !== "all" ? UI.Btn("Clear", () => ctx.set({ cuSig: "all" }), { sm: true, ghost: true }) : null }, [
      UI.HBars(SIG.map((s) => ({ label: s[1], v: s[2], d: String(s[2]), tone: sig === s[0] ? "info" : "neutral", onClick: () => ctx.set({ cuSig: sig === s[0] ? "all" : s[0] }) })), { flat: true, tpl: "minmax(150px,1.3fr) 1fr 30px" }),
      UI.Note("Checked every night against Sage 200 orders, invoices and payments, the WMS and delivery PODs. Click a signal to filter the watch list.", { marginTop: 10 })
    ]);

    const WATCH = [
      { id: "ryan", sig: ["freq", "cat"], see: ["No M10 bolts in 47 days; normally every 18 to 24. Still ordering: ", L.order("SO-10516"), " today, no bolts."], stake: "€34,080 revenue",
        btn: ["Assign Follow-Up", "opp-ryan", "Follow-up assigned", "Ryan Trade Supplies: call Declan Ryan today about the M10 line. Assigned to David Kelly with the price history attached.", "Assigned"] },
      { id: "doyle", sig: ["debt"], see: ["€21,200 overdue, oldest INV-28482 at 61 days. ", L.order("SO-10503"), " on hold and ", L.quote("QT-2866"), " blocked. €42,680 of €50,000 used."], stake: "€264k account",
        btn: ["Credit decision", "dq-doyle", "Decision recorded", "Doyle Construction: release €7,320 of SO-10503 now against available credit; hold the rest until INV-28482 is paid.", "Decided"] },
      { id: "dunmore", sig: ["debt", "avg"], see: ["€8,120 over 60 days and ", L.order("SO-10520"), " on credit hold. Spend down 6.2%. ", L.order("SO-10511"), " is also short on Atlas cable ties."], stake: "€21,800 revenue",
        btn: ["Book joint call", "hl-dunmore", "Joint call booked", "Dunmore Civil: Sarah Byrne and Rachel Hayes to call Joe Dunmore today at 14:00.", "Booked"] },
      { id: "horizon", sig: ["deliv"], see: [L.order("SO-10488"), " short on ", L.po("PO-8821"), " (Atlas, 5 days late). RMA-1187 was an Atlas mis-pack. Rang for an ETA at 09:02."], stake: "€11,600 revenue",
        btn: ["Send ETA", "contact-SO-10488", "Email drafted", "Update to Horizon Electrical ready in Mark Ryan's Outlook.", "Drafted"] },
      { id: "southside", sig: ["quote", "debt", "avg"], see: [L.quote("QT-2864"), " (€3,210) unanswered for 34 days. €2,410 overdue and ", L.order("SO-10522"), " on credit hold."], stake: "€8,400 revenue",
        btn: ["Chase quote", "hl-southside", "Chase drafted", "Southside DIY: call note for David Kelly and a chase to Gerry Mahon on QT-2864, with the overdue balance attached.", "Drafted"] },
      { id: "glenview", sig: ["deliv"], see: ["2 pallets of ", L.order("SO-10490"), " left at Naas: ", L.route("N06"), " went out over payload. OTIF 92.9%."], stake: "€4,100 revenue",
        btn: ["Confirm slot", "hl-glenview", "Slot confirmed", "Glenview Maintenance: the SO-10490 balance goes on the spare Naas van this afternoon. Mark Ryan to tell Emer Nolan.", "Confirmed"] },
      { id: "atlantic", sig: ["margin", "cat"], see: ["Margin 20.4%, down 2.1 pts. ", L.quote("QT-2847"), " matches a competitor at 19.9%. No hygiene orders in 68 days."], stake: "€2,770 GP",
        btn: ["Review QT-2847", null, null, null, null, ["quote", "QT-2847"]] }
    ];
    const rows = WATCH.filter((w) => sig === "all" || w.sig.indexOf(sig) > -1);
    const flagged = sig === "all" ? null : sigOf(sig);
    const watch = UI.Card({ flush: true, title: flagged ? "Watch list · " + flagged[1].toLowerCase() : "Watch list", meta: flagged ? rows.length + " KEY ACCOUNTS OF " + flagged[2] + " FLAGGED" : "KEY ACCOUNTS WITH AN OPEN SIGNAL", delay: 160 }, [
      UI.Table({
        rows, rowKey: (w) => w.id, onRow: (w) => ctx.open("customer", w.id), rowTone: (w) => DB.customer(w.id).health === "At risk" || w.sig.indexOf("debt") > -1 ? "bad" : "warn",
        empty: "No key account carries this signal. The flagged accounts are in the smaller-account book.",
        foot: flagged ? (flagged[2] - rows.length) + " more accounts with this signal sit in the smaller-account book." : "18 declining and 17 at-risk accounts in total. The rest sit in the smaller-account book; open Accounts to filter.",
        cols: [
          { label: "Customer", w: "minmax(160px,1.1fr)", ink: true, render: (w) => { const c = DB.customer(w.id); return h("div", { style: { minWidth: 0 } }, h("div", { className: "pd-ell" }, c.name), h("div", { className: "pd-meta", style: { marginTop: 1 } }, DB.person(c.am).toUpperCase() + " · " + (c.trend > 0 ? "+" : "") + c.trend + "%")); } },
          { label: "Signals", w: "minmax(190px,1.2fr)", render: (w) => h("div", { style: { display: "flex", gap: 4, flexWrap: "wrap" } }, ...w.sig.map((s) => h("span", { key: s }, UI.Badge(sigOf(s)[3], sigOf(s)[4])))) },
          { label: "What Pulse sees", w: "minmax(280px,2.4fr)", render: (w) => h("span", { style: { whiteSpace: "normal", lineHeight: 1.45, display: "block" } }, ...w.see) },
          { label: "At stake a year", w: "116px", r: true, num: true, ink: true, render: (w) => w.stake },
          { label: "", w: "150px", render: (w) => w.btn[5] ? UI.Btn(w.btn[0], () => ctx.open(w.btn[5][0], w.btn[5][1]), { sm: true })
            : UI.Btn(w.btn[0], () => ctx.act(w.btn[1], w.btn[2], w.btn[3]), { sm: true, pri: w.id === "ryan" && !ctx.done(w.btn[1]), done: ctx.done(w.btn[1]), doneLabel: w.btn[4] }) }
        ]
      })
    ]);

    /* trend and by-AM */
    const trend = UI.Card({ title: "Is it getting worse?", icon: "spark", meta: "DECLINING AND AT-RISK ACCOUNTS · 9 MONTHS", delay: 200 }, [
      UI.Lines(months(9), [
        { name: "Declining", values: [11, 12, 12, 14, 13, 15, 16, 17, 18], color: "var(--warn)" },
        { name: "At risk", values: [12, 13, 13, 14, 15, 14, 16, 16, 17], color: "var(--bad)" }
      ], { h: 150, min: 8, max: 20 }),
      UI.Note("Up from 23 to 35 flagged accounts in nine months. Retention is still 93.4% on a trailing 12 months, so these are accounts shrinking, not leaving yet.", { marginTop: 10 })
    ]);
    const byAm = UI.Card({ flush: true, title: "Whose book is slipping", meta: "DECLINING + AT RISK AS SHARE OF BOOK", delay: 240 }, [
      UI.Table({
        rows: AMS, rowKey: (a) => a.k, onRow: (a) => { ctx.set({ cuAm: a.k, cuHealth: "all" }); go("Customers", "Accounts"); },
        cols: [
          { label: "Account manager", w: "minmax(130px,1.3fr)", ink: true, render: (a) => DB.person(a.k) },
          { label: "Book", w: "56px", r: true, num: true, render: (a) => a.accounts },
          { label: "Growing", w: "66px", r: true, num: true, render: (a) => h("span", { style: { color: "var(--ok)" } }, a.health[0]) },
          { label: "Stable", w: "58px", r: true, num: true, render: (a) => a.health[1] },
          { label: "Declining", w: "72px", r: true, num: true, render: (a) => h("span", { style: { color: "var(--warn)" } }, a.health[2]) },
          { label: "At risk", w: "60px", r: true, num: true, render: (a) => h("span", { style: { color: "var(--bad)" } }, a.health[3]) },
          { label: "Slipping", w: "minmax(110px,1fr)", render: (a) => { const s = 100 * (a.health[2] + a.health[3]) / a.accounts; return h("div", { className: "pd-split", style: { gap: 8 } }, h("div", { className: "pd-grow" }, UI.Bar(s * 5, s > 10 ? "bad" : "warn")), h("span", { className: "pd-mono", style: { fontSize: 11.5, width: 38, textAlign: "right" } }, s.toFixed(1) + "%")); } }
        ]
      }),
      h("div", { style: { padding: "12px 20px 16px" } }, UI.Note("Michael's national book is small but 4 of 28 are slipping, led by margin on Leinster Retail. David has the most declining accounts: 7, including Ryan and Southside."))
    ]);

    return UI.Page({
      kicker: "Customers · health", title: "Customers who are quietly buying less",
      sub: "Pulse watches order frequency, order size, category spend, delivery problems, overdue debt, margin and quote activity on every account, and flags the change before the customer says anything.",
      actions: [UI.Btn("Which customers have reduced spend?", () => ctx.ask("Which customers have reduced spend?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Growing", value: String(HEALTH[0][1]), sub: Math.round(100 * HEALTH[0][1] / DB.company.accounts) + "% of accounts", subTone: "ok" },
          { label: "Stable", value: String(HEALTH[1][1]), sub: Math.round(100 * HEALTH[1][1] / DB.company.accounts) + "% of accounts" },
          { label: "Declining", value: String(HEALTH[2][1]), sub: "€212k annual spend exposed", tone: "warn", toneValue: true },
          { label: "At risk", value: String(HEALTH[3][1]), sub: "Credit, service or a lost category", tone: "bad", toneValue: true },
          { label: "Retention", value: "93.4%", sub: "Trailing 12 months", subTone: "ok" },
          { label: "Key accounts flagged", value: String(WATCH.length), sub: "Of 18, see the watch list" }
        ]),
        UI.Grid("minmax(0,1fr) minmax(0,1.3fr)", [decline, pattern]),
        UI.Grid("minmax(0,.85fr) minmax(0,2.15fr)", [sigCard, watch]),
        UI.Grid("minmax(0,1fr) minmax(0,1.15fr)", [trend, byAm])
      ]
    });
  }

  /* ======================================================== QUOTES */
  const Q_TONE = (s) => /Pending/.test(s) ? "warn" : /Blocked|No response/.test(s) ? "bad" : /With customer/.test(s) ? "info" : "neutral";
  const Q_ORDER = (s) => /Pending/.test(s) ? 0 : /Blocked/.test(s) ? 1 : /No response/.test(s) ? 2 : /With customer/.test(s) ? 3 : 4;
  const gpAtStake = (q) => q.annual ? Math.round(q.annual * (q.target - q.margin) / 100) : 0;

  function quotes(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const Q = DB.quotes;
    const tot = sum(Q.map((q) => q.value));
    const low = DB.lowMarginQuotes;
    const lowGP = sum(low.map(gpAtStake));
    const f = ctx.st.cuQf || "all";
    const by = (re) => Q.filter((q) => re.test(q.status));
    const stuck = Q.filter((q) => /Blocked|No response/.test(q.status));
    const FILT = { all: () => true, approval: (q) => /Pending/.test(q.status), customer: (q) => /With customer/.test(q.status), stuck: (q) => /Blocked|No response/.test(q.status), draft: (q) => /Draft/.test(q.status) };
    const rows = Q.filter(FILT[f] || FILT.all).slice().sort((a, b) => Q_ORDER(a.status) - Q_ORDER(b.status) || b.value - a.value);
    const obDone = ctx.done("dq-obrien"), dyDone = ctx.done("dq-doyle");
    const afterDays = (n) => relLower(D(workday(n)));
    const NEXT = {
      "QT-2841": obDone ? "Counter approved: David to issue" : "Michael decides by 11:00; Pulse counter €19,429",
      "QT-2847": "Counter at the Pulse price; the competitor match is consumables only",
      "QT-2853": "Approve if Liffey commits to the cable volume in writing",
      "QT-2859": "Approve with a price review at month 6 of 14",
      "QT-2838": "Chase Alison Grant; validity ends in 5 days",
      "QT-2844": "Karen Dolan to confirm quantities",
      "QT-2850": "Confirm the delivery schedule with Deirdre Walsh",
      "QT-2855": "Chase Tom Delaney; expires in 2 days",
      "QT-2861": "Follow up with Paul Westbrook " + afterDays(2),
      "QT-2862": "Finish: 2 lines wait on a Hartmann price",
      "QT-2864": "Call Gerry Mahon or close it",
      "QT-2865": "Follow up with Aidan Kelleher " + afterDays(1),
      "QT-2866": "Blocked until INV-28482 is paid",
      "QT-2867": "Follow up with Lisa Brennan " + afterDays(3)
    };

    const stages = [
      { label: "Draft", n: by(/Draft/).length, v: eur(sum(by(/Draft/).map((q) => q.value))), pct: 6, onClick: () => ctx.set({ cuQf: "draft" }) },
      { label: "Pending approval", n: by(/Pending/).length, v: eur(sum(by(/Pending/).map((q) => q.value))), pct: 60, hot: true, note: "All four below target, all with Michael Doyle", onClick: () => ctx.set({ cuQf: "approval" }) },
      { label: "With customer", n: by(/With customer/).length, v: eur(sum(by(/With customer/).map((q) => q.value))), pct: 100, onClick: () => ctx.set({ cuQf: "customer" }) },
      { label: "Stuck", n: stuck.length, v: eur(sum(stuck.map((q) => q.value))), pct: 20, note: "One blocked by credit, one silent for 34 days", onClick: () => ctx.set({ cuQf: "stuck" }) }
    ];

    const table = UI.Card({ flush: true, title: rows.length + " quotes · " + eur(sum(rows.map((q) => q.value))), meta: "CLICK A ROW TO OPEN THE QUOTE" }, [
      h("div", { style: { padding: "0 20px 12px" } }, UI.Chips([
        ["all", "All", Q.length], ["approval", "Pending approval", by(/Pending/).length], ["customer", "With customer", by(/With customer/).length], ["stuck", "Stuck", stuck.length], ["draft", "Draft", by(/Draft/).length]
      ], f, (v) => ctx.set({ cuQf: v }))),
      UI.Table({
        rows, rowKey: (q) => q.id, onRow: (q) => ctx.open("quote", q.id),
        rowTone: (q) => /Blocked|No response/.test(q.status) ? "bad" : q.margin < q.target ? "warn" : null,
        cols: [
          { label: "Quote", w: "80px", render: (q) => h("span", { className: "pd-mono", style: { color: "var(--ink)", fontSize: 12 } }, q.id) },
          { label: "Customer", w: "minmax(170px,1.4fr)", ink: true, render: (q) => L.cust(q.cust) },
          { label: "Value", w: "84px", r: true, num: true, ink: true, render: (q) => eur(q.value) },
          { label: "Margin vs target", w: "128px", r: true, num: true, render: (q) => h("span", null, h("span", { style: { color: q.margin < q.target ? "var(--bad)" : "var(--ok)" } }, q.margin.toFixed(1) + "%"), h("span", { className: "pd-faint" }, " / " + q.target.toFixed(1) + "%")) },
          { label: "Gap", w: "66px", r: true, num: true, render: (q) => h("span", { style: { color: q.margin < q.target ? "var(--bad)" : "var(--dim)" } }, (q.margin - q.target > 0 ? "+" : "") + (q.margin - q.target).toFixed(1)) },
          { label: "Status", w: "170px", render: (q) => q.id === "QT-2841" && obDone ? UI.Badge("Counter approved", "ok") : UI.Badge(q.status, Q_TONE(q.status)) },
          { label: "Age", w: "60px", r: true, num: true, render: (q) => h("span", { style: { color: q.age > 30 ? "var(--bad)" : q.age > 10 ? "var(--warn)" : "var(--body)" } }, q.age + "d") },
          { label: "Rep", w: "104px", render: (q) => DB.person(q.am) },
          { label: "Next action", w: "minmax(240px,2fr)", render: (q) => h("span", { title: NEXT[q.id], style: { color: q.id === "QT-2841" || q.id === "QT-2866" ? "var(--ink)" : "var(--body)" } }, NEXT[q.id] || "Follow up") }
        ]
      })
    ]);

    const lowCard = UI.Card({ title: "Below margin target", icon: "tag", meta: eur(lowGP) + " GP AT STAKE · 12-MONTH TERMS", delay: 80, right: UI.Btn("Discount approvals", () => go("Pricing & Margin", "Discount Approvals"), { sm: true, ghost: true }) }, [
      UI.HBars(low.map((q) => ({ label: q.id + " · " + DB.custName(q.cust), v: gpAtStake(q), d: eur(gpAtStake(q)), sub: q.margin + "% vs " + q.target + "%", tone: q.id === "QT-2841" ? "bad" : "warn", onClick: () => ctx.open("quote", q.id) })), { colorValue: true, tpl: "minmax(170px,1.5fr) 1fr 64px" }),
      UI.Note("Gross profit lost over each agreement if accepted as priced: annual value × points below target. " + low.length + " quotes, " + eur(sum(low.map((q) => q.annual))) + " of annual revenue.", { marginTop: 8 }),
      h("div", { style: { height: 12 } }),
      UI.AI({ who: "Margin Agent", conf: "APPROVAL NEEDED",
        text: "QT-2841 is the one that matters: €6,263 of the €15,408. The €19,429 counter recovers €1,009 on this call-off and still sits under the tender price David is up against. The other three close most of their gap with a counter at the Pulse price, without moving far from what the customer has already seen.",
        actions: [UI.Btn("Approve €19,429 counter", () => ctx.act("dq-obrien", "Decision recorded", "QT-2841: counter at €19,429 (21.5%) approved by Michael Doyle. David Kelly issues it to O'Brien Facilities."), { pri: true, sm: true, done: obDone, doneLabel: "Counter approved" }),
          UI.Btn("Open QT-2841", () => ctx.open("quote", "QT-2841"), { sm: true })] })
    ]);

    const doyle = DB.customer("doyle"), dq = DB.quote("QT-2866"), dOrd = DB.order("SO-10503");
    const dInv = DB.invoices.filter((x) => x.cust === "doyle" && x.status === "Overdue");
    const blocked = UI.Card({ alert: "bad", title: "Blocked by credit: QT-2866 · Doyle Construction", icon: "shield", meta: "CREDIT AGENT", delay: 120 }, [
      UI.HChain([
        { k: "Quote", t: dq.id + " · " + eur(dq.value), d: dq.lines + " lines · " + dq.margin + "% · " + first(dq.am), onClick: () => ctx.open("quote", dq.id) },
        { k: "Credit", t: eur(doyle.out) + " of " + eur(doyle.limit), d: eur(doyle.limit - doyle.out) + " headroom", tone: "bad", onClick: () => ctx.open("customer", "doyle") },
        { k: "Overdue", t: dInv[0].id + " · " + eur(dInv[0].value), d: dInv[0].days + " days · " + dInv[1].id + " " + eur(dInv[1].value) + " at " + dInv[1].days, tone: "bad", onClick: () => go("Finance", "Debtors") },
        { k: "Order on hold", t: dOrd.id + " · " + eur(dOrd.value), d: "Hansfield, due " + relLower(D(dOrd.req)), tone: dyDone ? "ok" : "warn", onClick: () => ctx.open("order", dOrd.id) }
      ]),
      UI.P([dyDone ? "Decision recorded: €7,320 of SO-10503 released, the rest held until INV-28482 is paid. " : "Patrick Byrne's decision, due 10:00. ", "The quote cannot become an order until there is room on the account. Accepting it as well would take exposure to ", B(eur(doyle.out + dOrd.value + dq.value)), ". Collecting ", dInv[0].id, " alone frees enough for ", L.order(dOrd.id), " in full; the quote waits for the second payment."], { marginTop: 14 }),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 } },
        UI.Btn("Approve €7,320 release", () => ctx.act("dq-doyle", "Decision recorded", "Doyle Construction: release €7,320 of SO-10503 now against available credit; hold the rest until INV-28482 is paid."), { pri: true, sm: true, done: dyDone, doneLabel: "Release approved" }),
        UI.Btn("Credit control", () => go("Finance", "Credit Control"), { sm: true }))
    ]);

    const BK = [["0-3 days", 0, 3], ["4-7 days", 4, 7], ["8-14 days", 8, 14], ["15-30 days", 15, 30], ["Over 30", 31, 999]];
    const ageing = UI.Card({ title: "Quote ageing", icon: "clock", meta: "OPEN VALUE BY AGE · 14-DAY VALIDITY", delay: 160 }, [
      UI.Columns(BK.map((b) => { const qs = Q.filter((q) => q.age >= b[1] && q.age <= b[2]); const v = sum(qs.map((q) => q.value)); return { l: b[0], v: Math.max(v, 1), d: qs.length + " · " + eurK(v), tone: b[1] > 30 && qs.length ? "bad" : b[1] >= 8 && qs.length ? "warn" : null}; }), { h: 150, showValues: true }),
      UI.Note(["Two quotes are close to expiry (", L.quote("QT-2838"), ", ", L.quote("QT-2855"), ") and ", L.quote("QT-2864"), " expired 20 days ago without an answer."], { marginTop: 10 })
    ]);

    const conv = UI.Card({ title: "Conversion", icon: "spark", meta: "38% · " + sum(AMS.map((a) => a.won)) + " WON OF " + sum(AMS.map((a) => a.issued)) + " ISSUED, 90 DAYS", delay: 200 }, [
      UI.Lines(months(9), [{ name: "Conversion", values: [41, 40, 42, 39, 37, 40, 39, 38, 38], color: "var(--accent)", area: true }], { h: 96, min: 34, max: 44 }),
      UI.Label("By rep", { marginTop: 14, marginBottom: 2 }),
      UI.HBars(AMS.map((a) => ({ label: DB.person(a.k), v: Math.round(100 * a.won / a.issued), d: Math.round(100 * a.won / a.issued) + "%", sub: a.won + " of " + a.issued, tone: a.won / a.issued < .35 ? "warn" : "neutral" })), { max: 60, colorValue: true, tpl: "minmax(140px,1.2fr) 1fr 40px" }),
      UI.Note("David issues the most quotes and converts the fewest: 3 of his 5 open quotes are below target or silent.", { marginTop: 8 })
    ]);

    return UI.Page({
      kicker: "Customers · quotes", title: "Open quotes: " + eur(tot),
      sub: "Every quote with its margin against target, who owns it, how old it is and what happens next. Below-target quotes wait for Michael Doyle; nothing converts to an order past a credit block.",
      actions: [UI.Btn("Where are we losing margin?", () => ctx.ask("Where are we losing margin?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Open quotes", value: eurK(tot), sub: Q.length + " quotes" },
          { label: "Conversion", value: "38%", sub: "Last 90 days" },
          { label: "Below margin target", value: String(low.length), sub: eur(lowGP) + " GP at stake over 12 months", tone: "warn", subTone: "warn", onClick: () => ctx.set({ cuQf: "approval" }) },
          { label: "Blocked by credit", value: String(by(/Blocked/).length), sub: "QT-2866 · " + eur(dq.value), tone: "bad", onClick: () => ctx.open("quote", "QT-2866") },
          { label: "Average age", value: (sum(Q.map((q) => q.age)) / Q.length).toFixed(1) + " days", sub: "1 quote past 30 days", subTone: "warn" }
        ]),
        UI.Card({ title: "Where the quotes are", icon: "route", meta: "CLICK A STAGE TO FILTER", delay: 40 }, UI.Pipeline(stages)),
        h("div", { style: { height: 14 } }),
        table,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [lowCard, blocked]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [ageing, conv])
      ]
    });
  }

  /* ======================================================== DETAIL */
  function detail(ctx) { return PD.records.customer(ctx, ctx.st.lastCustomer || "murphy"); }

  PD.pages.Customers = { "Overview": overview, "Accounts": accounts, "Opportunities": opportunities, "Customer Health": health, "Quotes": quotes, "Customer Detail": detail };

  /* ---------------- reconciliation: warn loudly if the local book drifts from the database ---------------- */
  const chk = (label, got, want) => { if (Math.abs(got - want) > 0.51) console.warn("[PD customers] " + label + ": " + got + " ≠ " + want); };
  chk("AM revenue MTD", sum(AMS.map((a) => a.mtd)), DB.kpi.revenueMTD);
  chk("AM accounts", sum(AMS.map((a) => a.accounts)), DB.company.accounts);
  chk("AM margin", Math.round(10 * sum(AMS.map((a) => a.mtd * a.gm)) / sum(AMS.map((a) => a.mtd))) / 10, DB.kpi.gm);
  HEALTH.forEach((x, i) => chk("AM health " + x[0], sum(AMS.map((a) => a.health[i])), x[1]));
  chk("health total", sum(HEALTH.map((x) => x[1])), DB.company.accounts);
  chk("quotes open", sum(DB.quotes.map((q) => q.value)), 186000);
  chk("low margin GP", sum(DB.lowMarginQuotes.map(gpAtStake)), 15408);
  chk("conversion", Math.round(100 * sum(AMS.map((a) => a.won)) / sum(AMS.map((a) => a.issued))), 38);
  chk("Ryan decline", -sum(RYAN_CAT.map((x) => x[1])), 18600);
  chk("Ryan at risk", 2840 * 12, 34080);
})();
