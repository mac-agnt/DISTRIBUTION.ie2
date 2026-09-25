/* Inventory: what we hold in Dublin and Naas, what it is worth, what is free to promise,
   what to buy, what to move and what to clear. Reads PD.DB; the local tables below add the
   detail the database does not carry and reconcile to its canonical figures
   (€2.46m stock, €1.94m available, €286,420 slow, 147 reorder lines worth €184k, €168,000 release). */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB, TONE = PD.TONE;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, dm } = PD.date;
  const B = UI.B;

  /* ---------------- small helpers ---------------- */
  const WH = { DUB: "Dublin", NAS: "Naas" };
  const OTHER = { DUB: "NAS", NAS: "DUB" };
  const HT = { Critical: "bad", Low: "warn", Healthy: "ok", Excess: "warn", Slow: "warn", Dead: "bad" };
  const HRANK = { Critical: 0, Low: 1, Dead: 2, Slow: 3, Excess: 4, Healthy: 5 };
  const mono = (t, style) => h("span", { className: "pd-mono", style: Object.assign({ fontSize: 12, color: "var(--ink)" }, style) }, t);
  const faint = (t) => h("span", { className: "pd-faint" }, t);
  const gap = (n) => h("div", { style: { height: n || 14 } });
  const inputStyle = { height: 32, padding: "0 14px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--ink)", fontFamily: "inherit", fontSize: 12.5, outline: "none" };
  const prod = (sku) => DB.product(sku);
  const supName = (id) => (DB.supplier(id) || {}).name || id;
  const poWhen = (id) => { const po = DB.po(id); if (!po) return ""; return rel(D(po.expected)) + (/^\d/.test(po.eta) ? " " + po.eta : ""); };
  const hBadge = (health) => UI.Badge(String(health).toUpperCase(), HT[health] || "neutral", true);
  const tone = (t) => (TONE[t] || TONE.neutral).fg;
  const colored = (t, text) => h("span", { style: { color: tone(t) } }, text);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const lc = (s) => (/^(Today|Tomorrow|Yesterday)/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);
  const seed = (s) => { let x = 7; for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0; return x; };
  const siteStock = (p, wh) => (p.wh === wh ? [p.onHand, p.avail, p.alloc] : ((wh === "NAS" ? p.naas : p.dub) || [0, 0, 0]));

  /* Decision keys shared with Orders, Home and the product record. */
  const poKey = (sku) => (sku === "EL-4408" ? "po-el4408" : sku === "FH-6710" ? "po-fh6710" : "po-" + sku);
  const PO_TEXT = {
    "EL-4408": "PO-8846 · 160 × EL-4408 from EuroCable (9-day lead). Waiting for Emma Walsh.",
    "FH-6710": "PO-8847 · 400 × FH-6710 from Kerry Hygiene (5-day lead). Waiting for Emma Walsh."
  };
  const createPO = (ctx, sku, qty, supId, opt) => {
    opt = opt || {};
    const s = DB.supplier(supId);
    return UI.Btn(opt.label || "Create Purchase Order", () => ctx.act(poKey(sku), "PO drafted", PO_TEXT[sku] || (sku + " · " + num(qty) + " units from " + s.name + ". Waiting for " + DB.person(s.buyer) + " to approve.")),
      { pri: !opt.plain, sm: true, done: ctx.done(poKey(sku)), doneLabel: "PO drafted" });
  };
  const approveTransfer = (ctx, opt) => UI.Btn((opt && opt.label) || "Approve Transfer", () => ctx.act("dq-transfer", "Transfer approved", "40 × EL-4408 booked on the 14:00 Naas shuttle. Harbour Point, Leinster Retail and Tallaght Trade protected."),
    { pri: !(opt && opt.plain), sm: !(opt && opt.big), icon: "swap", done: ctx.done("dq-transfer"), doneLabel: "Transfer approved" });

  /* ---------------- local tables (reconciled below) ---------------- */
  // Category split by site, weeks of cover, slow stock (>90 days) and stockouts.
  const CATX = {
    "Electrical": { dub: 486000, nas: 126000, cover: 5.8, slow: 38960, outs: 9 },
    "Fixings & Fasteners": { dub: 318000, nas: 110000, cover: 8.1, slow: 42180, outs: 2 },
    "Safety & PPE": { dub: 118000, nas: 168000, cover: 13.4, slow: 61240, outs: 4 },
    "Hand & Power Tools": { dub: 282000, nas: 82000, cover: 11.2, slow: 54820, outs: 2 },
    "Industrial Consumables": { dub: 214000, nas: 104000, cover: 7.6, slow: 29460, outs: 6 },
    "Adhesives & Sealants": { dub: 96000, nas: 46000, cover: 7.9, slow: 12380, outs: 1 },
    "Facilities & Hygiene": { dub: 104000, nas: 84000, cover: 5.2, slow: 8920, outs: 3 },
    "Lighting": { dub: 102000, nas: 20000, cover: 12.6, slow: 38460, outs: 1 }
  };
  const AGEING = [["0-30", 1284300], ["31-60", 592460], ["61-90", 296820], ["91-180", 212220], ["180+", 74200]];
  const SLOW_BUCKETS = [["90-120 days", 96840, 186], ["120-180 days", 115380, 158], ["180+ days", 74200, 492]];
  const HEALTH = [
    { id: "Healthy", label: "Healthy", skus: 6318, v: 1804800, tone: "ok" },
    { id: "Low", label: "Low", skus: 412, v: 126800, tone: "warn" },
    { id: "Critical", label: "Critical", skus: 96, v: 41600, tone: "bad", note: "28 with nothing free" },
    { id: "Excess", label: "Excess & slow", skus: 1108, v: 412600, tone: "warn" },
    { id: "Dead", label: "Dead", skus: 492, v: 74200, tone: "bad" }
  ];
  const SITES = {
    DUB: { avail: 1352000, alloc: 181000, reserved: 138000, quarantine: 49000, slow: 174860, outs: 21, turn: "5.1×" },
    NAS: { avail: 588000, alloc: 53000, reserved: 60000, quarantine: 39000, slow: 111560, outs: 7, turn: "4.1×" }
  };
  // Replenishment: 147 reorder lines worth €184k, by urgency and by supplier.
  const URGENCY = [["Order today", 38, 62340], ["This week", 71, 84200], ["Next 2 weeks", 38, 37460]];
  const BY_SUP = [["eurofix", 38420], ["atlas", 31860], ["safepro", 24180], ["kerry", 19640], ["eurocable", 18920], ["northgate", 17340], ["hartmann", 12280], ["celtic", 8460], [null, 12900]];
  // Slow stock: working capital release by action, €168,000.
  const RELEASE = [
    ["Target specific customers", 36800], ["Supplier return candidate", 29700], ["Promotion candidate", 22900], ["Stop replenishment", 41200],
    ["Transfer warehouse", 18600], ["Bundle with fast seller", 12400], ["Reduce purchase quantity", 6400]
  ];
  const RELEASE_SORTED = RELEASE.slice().sort((a, b) => b[1] - a[1]);

  /* sanity checks: a console warning beats a wrong number on a slide */
  (function () {
    const chk = (label, got, want) => { if (Math.abs(got - want) > 0.51) console.warn("[PD data] inventory " + label + ": " + got + " ≠ " + want); };
    const cats = DB.categories;
    chk("category Dublin", sum(cats.map((c) => CATX[c.id].dub)), DB.warehouses.DUB.inventory);
    chk("category Naas", sum(cats.map((c) => CATX[c.id].nas)), DB.warehouses.NAS.inventory);
    cats.forEach((c) => chk("category split " + c.id, CATX[c.id].dub + CATX[c.id].nas, c.inv));
    chk("category slow", sum(cats.map((c) => CATX[c.id].slow)), DB.kpi.slow);
    chk("category stockouts", sum(cats.map((c) => CATX[c.id].outs)), 28);
    chk("ageing", sum(AGEING.map((a) => a[1])), DB.company.inventory);
    chk("slow buckets", sum(SLOW_BUCKETS.map((a) => a[1])), DB.kpi.slow);
    chk("dead bucket", SLOW_BUCKETS[2][1], DB.kpi.dead);
    chk("over 120 days", SLOW_BUCKETS[1][1] + SLOW_BUCKETS[2][1], DB.finance.inventoryOver120);
    chk("health SKUs", sum(HEALTH.map((x) => x.skus)), DB.company.skus);
    chk("health value", sum(HEALTH.map((x) => x.v)), DB.company.inventory);
    ["DUB", "NAS"].forEach((w) => chk("site " + w, SITES[w].avail + SITES[w].alloc + SITES[w].reserved + SITES[w].quarantine, DB.warehouses[w].inventory));
    chk("available", SITES.DUB.avail + SITES.NAS.avail, 1940000);
    chk("allocated", SITES.DUB.alloc + SITES.NAS.alloc, 234000);
    chk("site slow", SITES.DUB.slow + SITES.NAS.slow, DB.kpi.slow);
    chk("site stockouts", SITES.DUB.outs + SITES.NAS.outs, 28);
    chk("reorder lines", sum(URGENCY.map((u) => u[1])), 147);
    chk("reorder value", sum(URGENCY.map((u) => u[2])), 184000);
    chk("reorder by supplier", sum(BY_SUP.map((u) => u[1])), 184000);
    chk("release", sum(RELEASE.map((r) => r[1])), DB.finance.wcRelease[0][1]);
  })();

  /* ================================================================ OVERVIEW */
  function overview(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const toStock = (patch) => () => { ctx.set(Object.assign({ invHealth: "all", invWh: "all", invCat: "all", invQ: "" }, patch)); go("Inventory", "Stock"); };

    const kpis = UI.Kpis([
      { label: "Inventory value", value: "€2.46m", sub: "Dublin €1.72m · Naas €740k" },
      { label: "SKUs", value: num(DB.company.skus), sub: "7,310 in Dublin · 4,180 in Naas", onClick: toStock({}) },
      { label: "Available", value: "€1.94m", sub: "79% of stock value free to sell", subTone: "ok", onClick: () => go("Inventory", "Availability") },
      { label: "Allocated", value: "€234k", sub: "To open orders, at cost" },
      { label: "Slow moving", value: "€286k", sub: "No sale in 90 days · €286,420", tone: "warn", onClick: () => go("Inventory", "Slow & Dead Stock") },
      { label: "Dead stock", value: "€74.2k", sub: "No sale in 180 days", tone: "bad", onClick: () => go("Inventory", "Slow & Dead Stock") },
      { label: "Stockouts", value: "28", sub: "SKUs with nothing free · 3 on today's orders", tone: "bad", toneValue: true, onClick: toStock({ invHealth: "Critical" }) },
      { label: "Reorder recommendations", value: "147", sub: "€184k to buy · 38 due today", onClick: () => go("Inventory", "Replenishment") }
    ], "repeat(4,minmax(0,1fr))");

    const siteRowsT = [
      ["Stock value", eur(DB.warehouses.DUB.inventory), eur(DB.warehouses.NAS.inventory)],
      ["Available to sell", eurK(SITES.DUB.avail), eurK(SITES.NAS.avail)],
      ["Allocated to orders", eurK(SITES.DUB.alloc), eurK(SITES.NAS.alloc)],
      ["Reserved for contracts", eurK(SITES.DUB.reserved), eurK(SITES.NAS.reserved)],
      ["Quarantine & returns", eurK(SITES.DUB.quarantine), eurK(SITES.NAS.quarantine)],
      ["Slow over 90 days", eur(SITES.DUB.slow), eur(SITES.NAS.slow)],
      ["SKUs stocked", num(DB.warehouses.DUB.skus), num(DB.warehouses.NAS.skus)],
      ["Stockouts", String(SITES.DUB.outs), String(SITES.NAS.outs)],
      ["Inventory turn", SITES.DUB.turn, SITES.NAS.turn]
    ];
    const sites = UI.Card({ title: "Where the stock sits", icon: "pin", meta: "€2.46M AT COST", delay: 60 }, [
      UI.Split([
        { label: "Dublin", v: DB.warehouses.DUB.inventory, color: "var(--accent)", d: "€1.72m" },
        { label: "Naas", v: DB.warehouses.NAS.inventory, color: "var(--dim)", d: "€740k" }
      ]),
      h("div", { style: { margin: "12px -20px 0" } }, UI.Table({
        rows: siteRowsT, rowKey: (r) => r[0],
        cols: [
          { label: "", w: "minmax(140px,1.4fr)", render: (r) => r[0] },
          { label: "Dublin", w: "minmax(80px,1fr)", r: true, num: true, ink: true, render: (r) => r[1] },
          { label: "Naas", w: "minmax(80px,1fr)", r: true, num: true, ink: true, render: (r) => r[2] }
        ]
      })),
      UI.Note("Naas turns slower: it holds 39% of the slow stock on 30% of the value. Managers " + DB.person("LM") + " (Dublin) and " + DB.person("AB") + " (Naas).", { marginTop: 4 })
    ]);

    const status = UI.Card({ title: "Stock health", icon: "shield", meta: "SKUS · VALUE AT COST", delay: 100 }, [
      UI.Split([
        { label: "Available", v: 1940000, color: "var(--accent)", d: "€1.94m" },
        { label: "Allocated", v: 234000, color: "var(--dim)", d: "€234k" },
        { label: "Contracts", v: 198000, color: "var(--faint)", d: "€198k" },
        { label: "Quarantine", v: 88000, color: "var(--warn)", d: "€88k" }
      ], { h: 10 }),
      UI.Sep(),
      UI.HBars(HEALTH.map((x) => ({ label: x.label, sub: num(x.skus) + " SKUs", v: x.v, d: eurK(x.v), tone: x.tone, onClick: toStock({ invHealth: x.id }) })), { tpl: "minmax(150px,1.3fr) 1.4fr 70px", colorValue: false }),
      UI.Note("Critical: nothing free or under a week of cover (28 SKUs have nothing free). Low: below the reorder point before a new order could land. Excess: more than 12 weeks of cover. Dead: no sale in 180 days.", { marginTop: 10 })
    ]);

    const ageing = UI.Card({ title: "Inventory ageing", icon: "clock", meta: "DAYS SINCE LAST SALE · €", delay: 140, right: UI.Btn("Slow & dead stock", () => go("Inventory", "Slow & Dead Stock"), { sm: true, ghost: true }) }, [
      UI.Columns(AGEING.map((a, i) => ({ l: a[0] + " days", v: a[1], d: eurK(a[1]), tone: i === 3 ? "warn" : i === 4 ? "bad" : null })), { h: 150, showValues: true }),
      UI.Facts([["Over 90 days", "€286,420", "warn", "12% of stock"], ["Over 120 days", "€189,580", "warn"], ["Over 180 days", "€74,200", "bad", "Dead"]], 3),
      UI.Note("Slow stock is up €48k in six months, mostly Safety & PPE in Naas and Lighting in Dublin. €168,000 of it can come out in 90 days.", { marginTop: 10 })
    ]);

    const catRows = DB.categories.map((c) => Object.assign({ id: c.id, inv: c.inv }, CATX[c.id]));
    const categories = UI.Card({ flush: true, title: "Inventory by category", meta: "CLICK A ROW TO SEE ITS SKUS", delay: 180 }, [
      UI.Table({
        rows: catRows, rowKey: (c) => c.id, onRow: (c) => toStock({ invCat: c.id })(),
        rowTone: (c) => (c.outs >= 6 ? "bad" : null),
        cols: [
          { label: "Category", w: "minmax(170px,1.5fr)", ink: true, render: (c) => c.id },
          { label: "Value", w: "84px", r: true, num: true, ink: true, render: (c) => eurK(c.inv) },
          { label: "Share", w: "minmax(90px,1fr)", render: (c) => UI.Bar(100 * c.inv / 612000, c.id === "Electrical" ? null : "neutral", { h: 5 }) },
          { label: "Dublin", w: "78px", r: true, num: true, render: (c) => eurK(c.dub) },
          { label: "Naas", w: "72px", r: true, num: true, render: (c) => eurK(c.nas) },
          { label: "Cover", w: "76px", r: true, num: true, render: (c) => c.cover.toFixed(1) + " wks" },
          { label: "Slow > 90d", w: "88px", r: true, num: true, render: (c) => colored(c.slow > 40000 ? "warn" : "neutral", eurK(c.slow)) },
          { label: "Stockouts", w: "78px", r: true, num: true, render: (c) => colored(c.outs >= 6 ? "bad" : c.outs >= 3 ? "warn" : "neutral", String(c.outs)) }
        ],
        foot: "Electrical is a quarter of the stock and a third of the stockouts: cable and glands depend on Atlas. Safety & PPE carries the most slow stock (€61k), mostly hi-vis and boots in Naas."
      })
    ]);

    const landing = DB.goodsInToday.slice().sort((a, b) => a.eta.localeCompare(b.eta));
    const goodsIn = UI.Card({ title: "Landing today", icon: "truck", meta: DB.goodsInToday.length + " DELIVERIES · " + eurK(sum(landing.map((p) => p.value))) + " · " + sum(landing.map((p) => p.pallets)) + " PALLETS", delay: 240, right: UI.Btn("Goods in", () => go("Warehouse", "Goods In"), { sm: true, ghost: true }) },
      landing.map((p) => UI.Row({ onClick: () => ctx.open("po", p.id) }, [
        mono(p.eta, { width: 40, fontSize: 11.5 }),
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 12.5 } }, supName(p.supplier), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, p.id)),
          h("div", { className: "pd-meta", style: { marginTop: 2 } }, WH[p.wh].toUpperCase() + " · " + p.pallets + " PALLETS" + (p.deps ? " · RELEASES " + p.deps + (p.deps === 1 ? " ORDER" : " ORDERS") : ""))),
        p.received ? UI.Badge("24 SHORT", "warn", true) : null,
        mono(eurK(p.value), { fontSize: 11.5 })])));

    const ai = UI.AI({ who: "Inventory Agent", conf: "09:14",
      text: [
        "Three things move the stock position this week. ", B("EL-4408"), " runs out in Dublin in 3 days unless 40 reels come from Naas on the 14:00 shuttle. ",
        B("FH-6710 hand soap"), " has no PO and Kerry needs 5 days. And ", B("€168,000"), " of slow stock can come out over 90 days, most of it without a discount."
      ],
      actions: [approveTransfer(ctx), createPO(ctx, "FH-6710", 400, "kerry", { label: "Raise FH-6710 PO", plain: true }), UI.Btn("Ask Pulse", () => ctx.ask("What inventory can we reduce?"), { sm: true, ghost: true, icon: "spark" })] });

    const moves = UI.Card({ title: "Stock movements this morning", icon: "spark", meta: "WMS · SAGE 200 · AGENTS", delay: 280 }, UI.Feed([
      { t: "09:14", tone: "bad", text: [B("Inventory Agent"), " projected a Dublin stockout on ", L.sku("EL-4408"), " within 3 days."] },
      { t: "09:06", tone: "warn", text: [B("Bin D-14-03"), " count mismatch on EL-4408: 4 reels found, 12 on the system. Recount booked for 10:00."], onClick: () => go("Warehouse", "Exceptions") },
      { t: "09:04", tone: "warn", text: [B("Atlas"), " moved ", L.po("PO-8821"), " to " + relLower(D(1)) + " 10:30. 3 SKUs stay short until then."] },
      { t: "08:31", tone: "warn", text: [B("EuroFix price file"), " imported: FIX-2201 cost up 10.4%. Stock on hand revalued."], onClick: () => go("Pricing & Margin", "Cost Changes") },
      { t: "07:58", tone: "ok", text: [B("Goods in"), " received 244 units against PO-8819 (Kerry Hygiene) into Naas."] },
      { t: "07:40", tone: "neutral", text: [B("Naas"), " put away 38 returns into quarantine: 3 RMAs waiting on a credit decision."], onClick: () => go("Delivery", "Delivery Issues") }
    ]));

    return UI.Page({
      kicker: "Inventory · both warehouses", live: "WMS AND SAGE 200 · 09:20",
      title: "€2.46m of stock. €1.94m is free to sell.",
      sub: "What we hold in Dublin and Naas, what it is worth, how old it is and where it is healthy. All values at cost.",
      actions: [UI.Btn("Replenishment", () => go("Inventory", "Replenishment"), { pri: true, icon: "cart" }), UI.Btn("Do we have it?", () => go("Inventory", "Availability"), { icon: "box" })],
      children: [
        kpis,
        UI.Grid("minmax(0,1fr) minmax(0,1.05fr) minmax(0,1.05fr)", [sites, status, ageing]),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [
          h("div", null, categories, gap(), moves),
          h("div", null, ai, gap(), goodsIn)
        ])
      ]
    });
  }

  /* ================================================================ STOCK */
  // Weekly demand at the secondary site, so each warehouse shows its own cover.
  const SITE2_WEEKLY = { "EL-4408": 11, "EL-4412": 3, "IC-3310": 4, "FIX-2201": 46, "FIX-2214": 12, "FIX-2330": 38, "TL-5120": 3, "TL-5204": 1, "IC-3405": 84, "AD-7102": 42, "LT-8120": 5, "IC-3120": 22, "EL-4520": 2, "EL-4712": 6, "SAF-1892": 24, "AD-7340": 3 };
  const coverText = (avail, weekly) => {
    if (!weekly) return "No demand";
    const d = avail / (weekly / 7);
    if (d <= 0) return "0 days";
    return d < 14 ? d.toFixed(1).replace(/\.0$/, "") + " days" : (d / 7).toFixed(1).replace(/\.0$/, "") + " weeks";
  };
  const incomingAt = (p, wh) => { if (!p.incoming || !p.po) return 0; const po = DB.po(p.po); return po && po.wh === wh ? p.incoming : 0; };
  function stockRows() {
    const rows = [];
    DB.products.forEach((p) => {
      rows.push({ id: p.sku + "@" + p.wh, p, wh: p.wh, onHand: p.onHand, avail: p.avail, alloc: p.alloc, inc: incomingAt(p, p.wh), weekly: p.weekly, cover: p.cover, rop: p.rop, health: p.health });
      const o = OTHER[p.wh], arr = p.wh === "DUB" ? p.naas : p.dub;
      if (arr && arr[0] > 0) {
        const w = SITE2_WEEKLY[p.sku] !== undefined ? SITE2_WEEKLY[p.sku] : Math.max(1, Math.round(p.weekly * 0.2));
        const days = w ? arr[1] / (w / 7) : 999;
        const health = arr[1] <= 0 ? "Critical" : days < 7 ? "Critical" : days < 14 ? "Low" : days > 84 ? "Excess" : "Healthy";
        rows.push({ id: p.sku + "@" + o, p, wh: o, onHand: arr[0], avail: arr[1], alloc: arr[2], inc: incomingAt(p, o), weekly: w, cover: coverText(arr[1], w), rop: Math.max(2, Math.round(w * (p.lead / 7 + 1))), health, second: true });
      }
    });
    return rows.sort((a, b) => HRANK[a.health] - HRANK[b.health] || b.onHand * b.p.cost - a.onHand * a.p.cost);
  }

  function stock(ctx) {
    const L = PD.lk(ctx);
    const fH = ctx.st.invHealth || "all", fW = ctx.st.invWh || "all", fC = ctx.st.invCat || "all", q = (ctx.st.invQ || "").toLowerCase().trim();
    const all = stockRows();
    const base = all.filter((r) => (fW === "all" || r.wh === fW) && (fC === "all" || r.p.cat === fC) && (!q || (r.p.sku + " " + r.p.name + " " + supName(r.p.supplier)).toLowerCase().indexOf(q) > -1));
    const rows = base.filter((r) => fH === "all" || r.health === fH);
    const cnt = (hh) => base.filter((r) => r.health === hh).length;
    const healthChips = [["all", "All", base.length]].concat(["Critical", "Low", "Healthy", "Excess", "Slow", "Dead"].map((x) => [x, x, cnt(x)]));
    const catChips = [["all", "All categories"]].concat(DB.categories.map((c) => [c.id, c.id]));
    const valOn = sum(rows.map((r) => r.onHand * r.p.cost)), valAv = sum(rows.map((r) => Math.max(0, r.avail) * r.p.cost));

    const ACC = [
      ["D-14-03", "EL-4408", 12, 4, "Recount 10:00", "TN", "bad"],
      ["N-07-12", "FH-6602", 48, 52, "Adjusted +4", "AB", "ok"],
      ["N-02-05", "SAF-1892", 240, 228, "Linked to TR-3321", "AB", "warn"],
      ["D-21-02", "IC-3310", 10, 10, "Matched", "EF", "neutral"],
      ["D-11-08", "EL-4631", 22, 22, "Matched", "EF", "neutral"]
    ];

    return UI.Page({
      kicker: "Inventory · stock", live: "WMS · 09:20",
      title: "Stock by SKU and warehouse",
      sub: "One line per SKU per site: on hand, free, allocated, coming in, how fast it sells and how long it lasts. Critical lines first. Click a line for the full product record.",
      actions: [UI.Btn("Replenishment", () => ctx.go("Inventory", "Replenishment"), { icon: "cart" }), UI.Btn("Availability", () => ctx.go("Inventory", "Availability"), { icon: "box" })],
      children: [
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" } },
          UI.Chips(healthChips, fH, (v) => ctx.set({ invHealth: v })),
          h("div", { style: { flex: 1 } }),
          UI.Tabs([["all", "Both sites"], ["DUB", "Dublin"], ["NAS", "Naas"]], fW, (v) => ctx.set({ invWh: v })),
          h("input", { value: ctx.st.invQ || "", onChange: (e) => ctx.set({ invQ: e.target.value }), placeholder: "SKU, product or supplier", style: Object.assign({ width: 220 }, inputStyle) })),
        h("div", { style: { marginBottom: 14 } }, UI.Chips(catChips, fC, (v) => ctx.set({ invCat: v }))),
        UI.Facts([
          ["Lines shown", String(rows.length), null, "Of " + all.length + " watched SKU lines"],
          ["On hand, at cost", eur(Math.round(valOn))],
          ["Free to sell, at cost", eur(Math.round(valAv))],
          ["Critical lines", String(rows.filter((r) => r.health === "Critical").length), rows.some((r) => r.health === "Critical") ? "bad" : null],
          ["Below reorder point", String(rows.filter((r) => r.avail < r.rop).length), null, "Available under ROP"]
        ], 5),
        gap(),
        UI.Card({ flush: true, title: rows.length + " SKU lines", meta: "SORTED BY HEALTH, THEN VALUE · CLICK FOR THE PRODUCT RECORD" }, [
          UI.Table({
            rows, rowKey: (r) => r.id, onRow: (r) => ctx.open("product", r.p.sku),
            rowTone: (r) => (r.health === "Critical" ? "bad" : r.health === "Low" ? "warn" : null),
            empty: "No SKU lines match these filters.",
            cols: [
              { label: "SKU", w: "82px", render: (r) => mono(r.p.sku) },
              { label: "Product", w: "minmax(210px,1.8fr)", ink: true, render: (r) => h("span", { title: r.p.name }, r.p.name) },
              { label: "Category", w: "minmax(140px,1fr)", render: (r) => r.p.cat },
              { label: "Warehouse", w: "86px", render: (r) => h("span", { style: { color: r.second ? "var(--dim)" : "var(--body)" } }, WH[r.wh]) },
              { label: "On hand", w: "72px", r: true, num: true, render: (r) => num(r.onHand) },
              { label: "Available", w: "80px", r: true, num: true, ink: true, render: (r) => r.avail <= 0 ? colored("bad", "0") : r.avail < r.rop ? colored("warn", num(r.avail)) : num(r.avail) },
              { label: "Allocated", w: "78px", r: true, num: true, render: (r) => num(r.alloc) },
              { label: "Incoming", w: "78px", r: true, num: true, render: (r) => (r.inc ? num(r.inc) : faint("0")) },
              { label: "Avg weekly demand", w: "124px", r: true, num: true, render: (r) => (r.weekly ? r.weekly + "/wk" : faint("0/wk")) },
              { label: "Days cover", w: "100px", r: true, render: (r) => colored(r.health === "Healthy" ? "neutral" : HT[r.health], r.cover) },
              { label: "Reorder point", w: "96px", r: true, num: true, render: (r) => num(r.rop) },
              { label: "Supplier", w: "minmax(160px,1.2fr)", render: (r) => L.sup(r.p.supplier) },
              { label: "Lead time", w: "76px", r: true, num: true, render: (r) => r.p.lead + " days" },
              { label: "Stock health", w: "100px", render: (r) => hBadge(r.health) }
            ],
            foot: "Watched lines: SKUs on today's orders, open POs, transfers or exceptions. All 8,426 SKUs are in Sage 200; health and cover update from the WMS every 5 minutes."
          })
        ]),
        UI.Grid("minmax(0,1.4fr) minmax(0,1fr)", [
          UI.Card({ title: "Stock accuracy today", icon: "shelf", meta: "64 BINS COUNTED · 61 MATCHED · NET −€148.60", delay: 80, right: UI.Btn("Exceptions", () => ctx.go("Warehouse", "Exceptions"), { sm: true, ghost: true }) },
            ACC.map((a) => UI.Row({ onClick: () => ctx.open("product", a[1]) }, [
              mono(a[0], { width: 64, fontSize: 11.5 }),
              h("div", { className: "pd-grow" },
                h("div", { style: { fontSize: 12.5 } }, prod(a[1]).name, h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, a[1])),
                h("div", { className: "pd-meta", style: { marginTop: 2 } }, "SYSTEM " + a[2] + " · COUNTED " + a[3] + " · " + DB.person(a[5]).toUpperCase())),
              a[3] === a[2] ? faint("0") : mono((a[3] > a[2] ? "+" : "−") + Math.abs(a[3] - a[2]), { color: tone(a[3] > a[2] ? "ok" : "bad") }),
              UI.Badge(a[4], a[6])]))),
          UI.Card({ title: "How health is set", icon: "shield", delay: 120 }, [
            ...[["Critical", "Nothing free, or under a week of cover at this site."], ["Low", "Below the reorder point, or will be before a new order could land."], ["Healthy", "Inside the target band for its demand and lead time."], ["Excess", "More than 12 weeks of cover at this site."], ["Slow", "No sale in 90 days."], ["Dead", "No sale in 180 days."]]
              .map((x) => UI.Row({}, [h("span", { style: { width: 86 } }, hBadge(x[0])), h("span", { style: { fontSize: 12.5, color: "var(--body)" } }, x[1])])),
            UI.Note("Reorder points and safety stock are set per site by " + DB.person("EW") + ". Pulse suggests changes on the Replenishment page; nobody's numbers change without a click.", { marginTop: 8 })
          ])
        ])
      ]
    });
  }

  /* ================================================================ AVAILABILITY */
  // Orders taken but not yet allocated (short or future-dated), by site.
  const BACKLOG = { "EL-4408": { DUB: 54 }, "EL-4631": { DUB: 150 }, "IC-3310": { DUB: 62, NAS: 12 }, "FH-6710": { NAS: 164 }, "EL-4712": { DUB: 38 } };
  const WAITING = {
    "EL-4408": { DUB: [["SO-10493", 6], ["SO-10482", 28], ["SO-10509", 12], ["SO-10515", 8]] },
    "EL-4631": { DUB: [["SO-10482", 60], ["SO-10488", 40], ["SO-10499", 50]] },
    "IC-3310": { DUB: [["SO-10482", 24], ["SO-10495", 20], ["SO-10511", 18]], NAS: [["SO-10507", 12]] },
    "FH-6710": { NAS: [["SO-10523", 48], ["SO-10514", 36], ["SO-10517", 24], ["SO-10499", 16], ["SO-10524", 16], ["SO-10507", 12], ["SO-10527", 12]] },
    "EL-4712": { DUB: [["SO-10528", 16], ["SO-10512", 12], ["SO-10506", 10]] }
  };
  const ALLOC = {
    "EL-4408": { DUB: [["SO-10525", 10], ["SO-10480", 6], ["SO-10496", 6], ["SO-10506", 4]], NAS: [["SO-10514", 4], ["SO-10523", 3]] },
    "FH-6710": { NAS: [["SO-10478", 24], ["SO-10518", 20], ["SO-10490", 12]] },
    "AD-7340": { DUB: [["SO-10514", 8]], NAS: [["SO-10523", 5], ["SO-10517", 3]] }
  };
  function allocFor(p, wh) {
    const fixed = (ALLOC[p.sku] || {})[wh];
    if (fixed) return fixed;
    const qty = siteStock(p, wh)[2];
    if (!qty) return [];
    const out = [];
    let left = qty;
    const ml = DB.murphyLines.find((l) => l[0] === p.sku && l[4] === "allocated");
    if (wh === "DUB" && ml && ml[2] <= left) { out.push(["SO-10482", ml[2]]); left -= ml[2]; }
    const pool = DB.orders.filter((o) => o.wh === wh && !o.hold && o.stock === "Available");
    const start = seed(p.sku) % pool.length;
    for (let k = 0; k < pool.length && left > 0; k++) {
      const o = pool[(start + k) % pool.length];
      const lastOne = out.length >= 3 || k === pool.length - 1;
      const take = lastOne ? left : Math.min(left, Math.max(1, Math.round(left * (0.3 + (seed(p.sku + o.id) % 30) / 100))));
      out.push([o.id, take]);
      left -= take;
    }
    return out;
  }
  function incomingList(ctx, p, wh) {
    const out = [];
    if (p.incoming && p.po) {
      const po = DB.po(p.po);
      if (po && po.wh === wh) out.push({ day: Math.max(0, po.expected), qty: p.incoming, ref: po.id, kind: "po", late: po.lateDays || 0, eta: poWhen(po.id), sup: po.supplier, deps: po.deps });
    }
    if (p.sku === "EL-4408" && ctx.done("dq-transfer")) out.push({ day: 0, qty: wh === "DUB" ? 40 : -40, ref: "Naas shuttle", kind: "transfer", eta: "Today 14:50" });
    if (p.sku === "IC-3310" && ctx.done("tr-ic3310")) out.push({ day: 2, qty: wh === "NAS" ? 12 : -12, ref: "Dublin shuttle", kind: "transfer", eta: rel(D(2)) + " 17:20" });
    if (p.sku === "EL-4408" && wh === "DUB" && ctx.done("po-el4408")) out.push({ day: 9, qty: 160, ref: "PO-8846", kind: "draft", eta: rel(D(9)), sup: "eurocable" });
    if (p.sku === "FH-6710" && wh === "NAS" && ctx.done("po-fh6710")) out.push({ day: 5, qty: 400, ref: "PO-8847", kind: "draft", eta: rel(D(5)), sup: "kerry" });
    return out.sort((a, b) => a.day - b.day);
  }
  // Available to promise: free now − taken but not allocated + confirmed supply by that day. Drafts do not count.
  function atp(ctx, p, wh, day) {
    let v = siteStock(p, wh)[1] - ((BACKLOG[p.sku] || {})[wh] || 0);
    incomingList(ctx, p, wh).forEach((i) => { if (i.kind !== "draft" && i.day <= day) v += i.qty; });
    return v;
  }
  const stocked = (p, wh) => siteStock(p, wh)[0] > 0 || (BACKLOG[p.sku] || {})[wh] || incomingList({ done: () => false }, p, wh).length > 0;
  const atpCell = (v, isStocked) => {
    if (!isStocked) return faint("Not stocked");
    if (v > 0) return h("span", { style: { color: "var(--ink)" } }, num(v));
    if (v === 0) return colored("warn", "0");
    return colored("bad", "0 · " + num(-v) + " short");
  };
  function answer(ctx, p) {
    const d0 = atp(ctx, p, "DUB", 0), n0 = atp(ctx, p, "NAS", 0), sD = stocked(p, "DUB"), sN = stocked(p, "NAS");
    let head, t;
    const shortTxt = (site, v) => site + " is " + num(-v) + " short on orders already taken.";
    if (d0 > 0 && n0 > 0) { head = "Yes. " + num(d0) + " free in Dublin and " + num(n0) + " in Naas."; t = "ok"; }
    else if (d0 > 0) { head = "Yes, from Dublin: " + num(d0) + " free. " + (!sN ? "Not stocked in Naas." : n0 < 0 ? shortTxt("Naas", n0) : "Naas has none free."); t = "ok"; }
    else if (n0 > 0) { head = (sD ? "In Naas only: " : "Yes, from Naas: ") + num(n0) + " free. " + (!sD ? "Not stocked in Dublin." : d0 < 0 ? shortTxt("Dublin", d0) : "Dublin has none free."); t = sD ? "warn" : "ok"; }
    else { head = "No. Nothing free in either warehouse" + (d0 < 0 || n0 < 0 ? ": " + num(Math.max(0, -d0) + Math.max(0, -n0)) + " already short on orders taken." : "."); t = "bad"; }
    return { head, t };
  }

  function availability(ctx) {
    const L = PD.lk(ctx);
    const q = (ctx.st.invAvQ || "").toLowerCase().trim();
    const matches = DB.products.filter((p) => !q || (p.sku + " " + p.name).toLowerCase().indexOf(q) > -1);
    const selSku = matches.find((p) => p.sku === ctx.st.invAvSku) ? ctx.st.invAvSku : matches.length ? (matches.find((p) => p.sku === "EL-4408") || matches[0]).sku : null;
    const p = selSku ? prod(selSku) : null;
    const quick = ["EL-4408", "FH-6710", "EL-4631", "SAF-1930", "AD-7340", "IC-3405"];

    const search = h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" } },
      h("input", { value: ctx.st.invAvQ || "", onChange: (e) => ctx.set({ invAvQ: e.target.value }), placeholder: "Type a SKU or product: 4408, soap, helmet, gland", style: Object.assign({ width: 340, height: 38, fontSize: 13.5 }, inputStyle, { height: 38, fontSize: 13.5 }) }),
      h("span", { className: "pd-meta" }, "OR"),
      UI.Chips(quick.map((s) => [s, s]), selSku, (v) => ctx.set({ invAvSku: v, invAvQ: "" })));

    if (!p) {
      return UI.Page({
        kicker: "Inventory · availability", title: "Do we have that in stock?",
        sub: "Available to promise by SKU and warehouse for today, tomorrow and the next 7 days.",
        children: [search, UI.Card({ title: "No match" }, [UI.Empty("Nothing matches \"" + (ctx.st.invAvQ || "") + "\". Try a SKU like EL-4408 or a word like cable, soap or glove."), h("div", { style: { textAlign: "center" } }, UI.Btn("Clear search", () => ctx.set({ invAvQ: "" }), { sm: true }))])]
      });
    }

    const s = DB.supplier(p.supplier), ans = answer(ctx, p), isC = p.sku === "EL-4408";
    const cells = [];
    ["DUB", "NAS"].forEach((w) => [0, 1, 7].forEach((d) => {
      const v = atp(ctx, p, w, d), st = stocked(p, w);
      cells.push([WH[w] + " · " + (d === 0 ? "today" : d === 1 ? "tomorrow" : "7 days"), !st ? "Not stocked" : v > 0 ? num(v) : v === 0 ? "0" : num(-v) + " short", !st ? null : v > 0 ? null : v === 0 ? "warn" : "bad",
        !st ? "" : d === 0 ? num(siteStock(p, w)[1]) + " free, " + num((BACKLOG[p.sku] || {})[w] || 0) + " waiting" : (incomingList(ctx, p, w).filter((i) => i.kind !== "draft" && i.day <= d && i.day > 0).map((i) => (i.qty > 0 ? "+" : "") + num(i.qty) + " " + i.ref).join(", ") || "No supply due")]);
    }));
    const inc = ["DUB", "NAS"].flatMap((w) => incomingList(ctx, p, w).map((i) => Object.assign({ wh: w }, i))).filter((i) => i.qty > 0);
    const poInc = inc.find((i) => i.kind === "po");
    const draft = inc.find((i) => i.kind === "draft");
    const d0 = atp(ctx, p, "DUB", 0), n0 = atp(ctx, p, "NAS", 0);

    const caveats = [];
    if (isC) caveats.push(["bad", "Bin D-14-03 was counted at 09:06: 4 reels, not 12. Until the 10:00 recount, promise from Dublin as if 4 are free."]);
    if (poInc && poInc.late) caveats.push(["warn", poInc.ref + " is " + poInc.late + " days late and " + supName(poInc.sup) + " has moved the date before. Promise tomorrow's stock with care."]);
    if (p.health === "Dead" || p.health === "Slow") caveats.push(["neutral", "Slow line: " + (p.idle || 90) + " days since the last sale. Any order for it is worth taking today."]);

    const answerCard = UI.Card({ tint: true, title: p.sku + " · " + p.name, icon: "box", meta: p.cat.toUpperCase() + " · " + s.name.toUpperCase(), right: UI.Btn("Product record", () => ctx.open("product", p.sku), { sm: true, ghost: true }) }, [
      h("div", { style: { fontSize: 20, fontWeight: 500, letterSpacing: "-.4px", lineHeight: 1.3, color: tone(ans.t) } }, ans.head),
      h("div", { style: { fontSize: 13, color: "var(--body)", marginTop: 6, marginBottom: 14 } },
        poInc ? ["Next in: ", B(num(poInc.qty)), " on ", L.po(poInc.ref), " into " + WH[poInc.wh] + ", " + lc(poInc.eta) + (poInc.late ? " (" + poInc.late + " days late)." : ".")]
          : draft ? ["Draft ", B(draft.ref), ": " + num(draft.qty) + " into " + WH[draft.wh] + ", " + lc(draft.eta) + ", once " + supName(draft.sup) + " confirms."]
            : ["No purchase order open. ", s.name, " quotes ", B(p.lead + " days"), " lead time; MOQ " + num(p.moq) + "."]),
      UI.Facts(cells, 3),
      ...caveats.map((c) => h("div", { key: c[1], className: "pd-split", style: { marginTop: 10, alignItems: "flex-start", fontSize: 12.5, color: "var(--body)", lineHeight: 1.5 } }, h("span", { style: { marginTop: 5 } }, UI.Dot(c[0])), h("span", null, c[1]))),
      UI.Note("Available to promise = free stock, minus orders already taken but not yet allocated, plus confirmed supply landing by that day. Draft POs and unapproved transfers do not count.", { marginTop: 12 })
    ]);

    const allocRows = ["DUB", "NAS"].flatMap((w) => allocFor(p, w).map((a) => ({ id: a[0], qty: a[1], wh: w, st: "Allocated" })))
      .concat(["DUB", "NAS"].flatMap((w) => ((WAITING[p.sku] || {})[w] || []).map((a) => ({ id: a[0], qty: a[1], wh: w, st: "Waiting" }))));
    const who = UI.Card({ flush: true, title: "Who has it", meta: num(sum(allocRows.filter((r) => r.st === "Allocated").map((r) => r.qty))) + " ALLOCATED · " + num(sum(allocRows.filter((r) => r.st === "Waiting").map((r) => r.qty))) + " WAITING", delay: 60 }, [
      UI.Table({
        rows: allocRows, rowKey: (r) => r.st + r.id + r.wh, onRow: (r) => ctx.open("order", r.id), rowTone: (r) => (r.st === "Waiting" ? "warn" : null),
        empty: "Nothing allocated or waiting on this SKU.",
        cols: [
          { label: "Order", w: "92px", render: (r) => mono(r.id) },
          { label: "Customer", w: "minmax(160px,1.5fr)", ink: true, render: (r) => { const o = DB.order(r.id); return o ? L.cust(o.cust) : r.id; } },
          { label: "Site", w: "70px", render: (r) => WH[r.wh] },
          { label: "Qty", w: "56px", r: true, num: true, ink: true, render: (r) => num(r.qty) },
          { label: "Due", w: "92px", render: (r) => { const o = DB.order(r.id); return o ? rel(D(o.req)) : ""; } },
          { label: "Status", w: "100px", render: (r) => (r.st === "Waiting" ? UI.Badge("WAITING", "warn", true) : UI.Badge("ALLOCATED", "neutral", true)) },
          { label: "Route", w: "70px", render: (r) => { const o = DB.order(r.id); return o && o.route ? L.route(o.route) : faint("None yet"); } }
        ]
      })
    ]);

    const chainNodes = inc.map((i) => ({
      k: (i.kind === "po" ? "PURCHASE ORDER · " + supName(i.sup) : i.kind === "draft" ? "DRAFT PO · " + supName(i.sup) + " · NOT CONFIRMED" : "TRANSFER · APPROVED").toUpperCase(),
      t: num(i.qty) + " into " + WH[i.wh] + ", " + lc(i.eta),
      d: i.kind === "po" ? (i.late ? i.late + " days late. " : "") + (i.deps ? i.deps + " customer orders release on receipt." : "Goes to free stock on receipt.") : i.kind === "draft" ? "Counts once the supplier confirms." : "On the shuttle. Goods in at the other end within 40 minutes.",
      tone: i.kind === "po" ? (i.late ? "bad" : "ok") : i.kind === "draft" ? "warn" : "ok", icon: i.kind === "transfer" ? "swap" : "truck",
      onClick: i.kind === "po" ? () => ctx.open("po", i.ref) : i.kind === "transfer" ? () => ctx.go("Inventory", "Transfers") : () => ctx.go("Inventory", "Replenishment")
    }));
    if (isC && !ctx.done("dq-transfer")) chainNodes.push({ k: "TRANSFER · PROPOSED", t: "40 from Naas, today 14:00 shuttle", d: "Naas keeps 24 against 11 needed this week. Protects 3 orders worth €12,460.", tone: "warn", icon: "swap", onClick: () => ctx.go("Inventory", "Transfers") });
    if (!chainNodes.length) chainNodes.push({ k: "NOTHING ON ORDER", t: "No PO, no transfer", d: s.name + " lead time " + p.lead + " days. " + (["Excess", "Slow", "Dead"].indexOf(p.health) > -1 ? "No order needed: cover is " + p.cover + "." : "See Replenishment for the recommendation."), tone: ["Excess", "Slow", "Dead"].indexOf(p.health) > -1 ? null : "warn", icon: "cart", onClick: () => ctx.go("Inventory", ["Excess", "Slow", "Dead"].indexOf(p.health) > -1 ? "Slow & Dead Stock" : "Replenishment") });
    const coming = UI.Card({ title: "What's coming", icon: "truck", meta: "SUPPLY BY DATE", delay: 100 }, UI.Chain(chainNodes));

    const tell = isC
      ? "For Murphy's 28: tomorrow afternoon from PO-8821, or 28 × EL-4412 today at +€8.40 a reel. For anyone else ringing today, do not promise from Dublin. Naas can promise 24 once the transfer is approved, for delivery tomorrow."
      : ans.t === "ok" ? "Promise it. " + (d0 > 0 && n0 > 0 ? "Dublin has " + num(d0) + " free and Naas " + num(n0) : d0 > 0 ? "Dublin has " + num(d0) + " free" : "Naas has " + num(n0) + " free") + ". Orders in before the 13:30 cut-off go out on tomorrow's first runs."
        : ans.t === "warn" ? "Promise from Naas, not Dublin. It rides the 14:00 shuttle or ships direct on a Naas route; tell the customer tomorrow, not today."
          : "Do not promise a date off the shelf. " + (poInc ? "Offer " + lc(poInc.eta) + " from " + poInc.ref + (poInc.late ? ", with a caveat: the supplier is running late." : ".")
            : draft ? draft.ref + " is drafted for " + lc(draft.eta) + ". Once " + supName(draft.sup) + " confirms, quote that date plus a day."
              : "Nothing is on order yet: raise it on Replenishment first, then quote the supplier's " + p.lead + "-day lead time plus a day.");
    const tellCard = UI.AI({ who: "Customer Agent", conf: "WHAT TO TELL THE CUSTOMER", text: tell,
      actions: isC ? [UI.Btn("Offer substitute to Murphy", () => ctx.act("sub-el4412", "Substitute offered", "Murphy Building Supplies offered 28 × EL-4412 at +€8.40 a reel."), { pri: true, sm: true, done: ctx.done("sub-el4412"), doneLabel: "Offered" }), approveTransfer(ctx, { plain: true })]
        : p.sku === "FH-6710" ? [createPO(ctx, "FH-6710", 400, "kerry")]
          : [UI.Btn("Open product", () => ctx.open("product", p.sku), { sm: true })] });

    const CROSS = [
      { sku: "EL-4408", short: "Dublin 42 short on 4 orders", free: "Naas 64 free", orders: ["SO-10509", "SO-10515", "SO-10493"], fix: "Transfer 40 on the 14:00 shuttle", key: "dq-transfer", tone: "bad" },
      { sku: "AD-7340", short: "SO-10514 (Naas order) holds 8 in Dublin", free: "Naas 372 free", orders: ["SO-10514"], fix: "Re-allocate the 8 to Naas stock", key: "alloc-ad7340", tone: "warn" },
      { sku: "IC-3310", short: "Naas 12 short for Kelleher", free: "Dublin 0 free until PO-8821", orders: ["SO-10507"], fix: "Send 12 on the shuttle the day PO-8821 lands", key: "tr-ic3310", tone: "warn" },
      { sku: "EL-4712", short: "Dublin 10 short on 3 orders", free: "Naas 16 free", orders: ["SO-10528", "SO-10512"], fix: "Leave it: PO-8836 lands tomorrow 08:30, before the shuttle would", key: null, tone: "neutral" },
      { sku: "FH-6710", short: "Naas 124 short on 7 orders", free: "Not stocked in Dublin", orders: ["SO-10523", "SO-10514"], fix: "Nothing to move. Raise the PO", key: "po-fh6710", tone: "bad" }
    ];
    const cross = UI.Card({ flush: true, title: "Stock in one warehouse, order in the other", meta: "11 ORDERS TODAY · CROSS-SITE CHECK", delay: 140, right: UI.Btn("Transfers", () => ctx.go("Inventory", "Transfers"), { sm: true, ghost: true }) }, [
      UI.Table({
        rows: CROSS, rowKey: (r) => r.sku, onRow: (r) => ctx.set({ invAvSku: r.sku, invAvQ: "" }), sel: (r) => r.sku === selSku, rowTone: (r) => (r.tone === "bad" ? "bad" : null),
        cols: [
          { label: "SKU", w: "82px", render: (r) => mono(r.sku) },
          { label: "Short", w: "minmax(190px,1.4fr)", render: (r) => colored(r.tone === "neutral" ? "neutral" : r.tone, r.short) },
          { label: "Free elsewhere", w: "minmax(150px,1fr)", ink: true, render: (r) => r.free },
          { label: "Orders", w: "minmax(150px,1fr)", render: (r) => h("span", null, ...r.orders.map((o, i) => h("span", { key: o }, i ? ", " : "", L.order(o)))) },
          { label: "Pulse says", w: "minmax(230px,1.7fr)", ink: true, render: (r) => h("span", { title: r.fix }, r.fix) },
          { label: "", w: "128px", render: (r) => (!r.key ? faint("No action") : r.key === "dq-transfer" ? approveTransfer(ctx, { label: "Approve", plain: true }) : r.key === "po-fh6710" ? createPO(ctx, "FH-6710", 400, "kerry", { label: "Create PO", plain: true })
            : UI.Btn(r.key === "tr-ic3310" ? "Queue transfer" : "Re-allocate", () => ctx.act(r.key, r.key === "tr-ic3310" ? "Transfer queued" : "Re-allocated", r.key === "tr-ic3310" ? "12 × IC-3310 go to Naas on the first shuttle after PO-8821 is received. Kelleher's SO-10507 updated." : "SO-10514: 8 × AD-7340 now allocated from Naas. Dublin's 8 released back to free stock."), { sm: true, done: ctx.done(r.key), doneLabel: "Done" })) }
        ]
      })
    ]);

    const list = UI.Card({ flush: true, title: q ? matches.length + " SKUs match \"" + (ctx.st.invAvQ || "") + "\"" : "Available to promise, every watched SKU", meta: "CLICK A ROW TO ANSWER FOR THAT SKU", delay: 180 }, [
      UI.Table({
        rows: matches, rowKey: (x) => x.sku, onRow: (x) => ctx.set({ invAvSku: x.sku }), sel: (x) => x.sku === selSku,
        rowTone: (x) => (atp(ctx, x, "DUB", 0) < 0 || atp(ctx, x, "NAS", 0) < 0 ? "bad" : null),
        cols: [
          { label: "SKU", w: "82px", render: (x) => L.sku(x.sku) },
          { label: "Product", w: "minmax(200px,1.6fr)", ink: true, render: (x) => x.name },
          { label: "Dublin today", w: "108px", r: true, num: true, render: (x) => atpCell(atp(ctx, x, "DUB", 0), stocked(x, "DUB")) },
          { label: "Tomorrow", w: "96px", r: true, num: true, render: (x) => atpCell(atp(ctx, x, "DUB", 1), stocked(x, "DUB")) },
          { label: "7 days", w: "96px", r: true, num: true, render: (x) => atpCell(atp(ctx, x, "DUB", 7), stocked(x, "DUB")) },
          { label: "Naas today", w: "104px", r: true, num: true, render: (x) => atpCell(atp(ctx, x, "NAS", 0), stocked(x, "NAS")) },
          { label: "Tomorrow", w: "96px", r: true, num: true, render: (x) => atpCell(atp(ctx, x, "NAS", 1), stocked(x, "NAS")) },
          { label: "7 days", w: "96px", r: true, num: true, render: (x) => atpCell(atp(ctx, x, "NAS", 7), stocked(x, "NAS")) },
          { label: "Next in", w: "minmax(150px,1fr)", render: (x) => { const po = x.po && x.incoming ? DB.po(x.po) : null; return po ? h("span", null, L.po(po.id), faint(" " + num(x.incoming) + " · " + poWhen(po.id))) : faint("Nothing on order"); } }
        ]
      })
    ]);

    return UI.Page({
      kicker: "Inventory · availability", live: "ANSWERS IN UNDER A SECOND",
      title: "Do we have that in stock?",
      sub: "Available to promise by SKU and warehouse for today, tomorrow and the next 7 days: what is free, who has it, what is coming and whether the other site can cover. Gráinne Foley's desk has run 38 of these checks since 07:30.",
      children: [
        search,
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [answerCard, h("div", null, tellCard, gap(), coming)]),
        UI.Grid("minmax(0,1fr) minmax(0,1.25fr)", [who, cross]),
        list
      ]
    });
  }

  /* ================================================================ REPLENISHMENT */
  const REC = [
    { sku: "EL-4408", fc: 141, lead: "28d Atlas · 9d EuroCable", po: "PO-8821", poQty: 120, poNote: "5 days late", qty: 160, sup: "eurocable", unit: 22.20, when: 0, out: 3, conf: 92,
      reason: "Existing incoming PO does not provide sufficient cover against expected demand." },
    { sku: "FH-6710", fc: 206, lead: "5d Kerry", po: null, qty: 400, sup: "kerry", unit: 6.40, when: 0, out: 6, conf: 95,
      reason: "No PO raised. 7 orders need 164 over the next 10 days against 40 free; Kerry's 5 days land today's order in time." },
    { sku: "EL-4712", fc: 96, lead: "9d EuroCable", po: "PO-8836", poQty: 80, qty: 80, sup: "eurocable", unit: 72.40, when: 0, out: 35, conf: 74,
      reason: "Buy ahead of EuroCable's copper surcharge review on the 1st. The last one took cost from €62.40 to €72.40." },
    { sku: "EL-4631", fc: 186, lead: "21d Atlas (25 actual)", po: "PO-8821", poQty: 400, poNote: "5 days late", qty: 200, sup: "atlas", unit: 6.80, when: 2, out: 0, conf: 88,
      reason: "PO-8821 clears the 150 waiting and leaves 250, about 5 weeks. On Atlas's real lead time the next 200 must go by " + rel(D(2)) + "." },
    { sku: "IC-3310", fc: 112, lead: "21d Atlas (25 actual)", po: "PO-8821", poQty: 200, poNote: "5 days late", qty: 100, sup: "atlas", unit: 14.20, when: 3, out: 0, conf: 84,
      reason: "PO-8821's 200 clears 74 short and leaves 126, under 5 weeks. Add 100 to the next Atlas order and save a delivery charge." },
    { sku: "FH-6602", fc: 590, lead: "5d Kerry", po: "PO-8834", poQty: 600, qty: 300, sup: "kerry", unit: 11.20, when: 4, out: 42, conf: 90,
      reason: "PO-8834 lands in Naas today. Core Facilities' 3 new Citywest sites add about 20 cases a week from next month." },
    { sku: "IC-3405", fc: 1120, lead: "10d SafePro", po: "PO-8833", poQty: 1000, poNote: "for Naas", qty: 1000, sup: "safepro", unit: 4.10, when: 6, out: 24, conf: 86,
      reason: "Glove demand runs 18% higher from October. Dublin has 3.6 weeks and PO-8833 is going to Naas, not Dublin." },
    { sku: "EL-4520", fc: 26, lead: "21d Hartmann", po: "PO-8830", poQty: 12, qty: 12, sup: "hartmann", unit: 168.00, when: 8, out: 38, conf: 83,
      reason: "Hartmann averages 2.1 days late and PO-8809 is 3 days late now. Order a week earlier than the reorder point says." },
    { sku: "TL-5120", fc: 44, lead: "12d Northgate", po: "PO-8832", poQty: 24, qty: 24, sup: "northgate", unit: 142.00, when: 10, out: 32, conf: 79,
      reason: "Tool kits sold 2.1× the September rate last November. Westbrook and Southside DIY stock up for Christmas from mid-October." },
    { sku: "SAF-1930", fc: 128, lead: "21d Polska", po: "PO-8839", poQty: 400, poNote: "today 13:00", qty: 0, sup: "polska", unit: 3.90, when: null, out: null, conf: 88, param: true,
      reason: "Went to zero waiting on Polska. PO-8839 brings 13 weeks' cover. Raise safety stock from 45 to 75 so the next slip does not empty the shelf." }
  ];
  const REDUCE = [
    { sku: "FIX-2402", act: "Stop replenishment", detail: "58 weeks of cover; next auto order 200 on " + dm(D(9)), save: 3780, key: "stop-FIX-2402" },
    { sku: "SAF-1892", act: "Cancel next order", detail: "22 weeks in Naas, 16 in Dublin; 500 due on " + dm(D(12)), save: 925, key: "stop-SAF-1892" },
    { sku: "TL-5204", act: "Stop replenishment", detail: "49 weeks of cover; 50 on the next Northgate run", save: 920, key: "stop-TL-5204" },
    { sku: "IC-3650", act: "Reduce next order 120 → 60", detail: "49 weeks of cover; Atlas takes 60 with a €14 small-order charge", save: 852, key: "red-IC-3650" },
    { sku: "AD-7340", act: "Stop · transfer 40 to Dublin", detail: "95 weeks in Naas; Dublin sells 3 a week", save: 672, key: "stop-AD-7340" },
    { sku: "SAF-1740", act: "Stop replenishment", detail: "No sale in 190 days, still on auto-reorder at 100", save: 1050, key: "stop-SAF-1740" }
  ];

  function replenishment(ctx) {
    const L = PD.lk(ctx);
    const f = ctx.st.invRepF || "all";
    const rows = REC.filter((r) => f === "all" || (f === "today" ? r.when === 0 : f === "week" ? r.when !== null && r.when > 0 && r.when <= 7 : r.when === null || r.when > 7));
    const shownVal = sum(REC.map((r) => r.qty * r.unit));
    const ssKey = "ss-SAF-1930";

    const table = UI.Card({ flush: true, title: "AI replenishment recommendations", meta: "TOP 10 OF 147 BY URGENCY · " + eur(Math.round(shownVal)) + " OF €184,000", right: UI.Tabs([["all", "All"], ["today", "Order today"], ["week", "This week"], ["later", "Later"]], f, (v) => ctx.set({ invRepF: v })) }, [
      UI.Table({
        rows, rowKey: (r) => r.sku, onRow: (r) => ctx.open("product", r.sku), rowTone: (r) => (r.when === 0 ? "bad" : r.when !== null && r.when <= 3 ? "warn" : null),
        empty: "Nothing in this window.",
        cols: [
          { label: "Product", w: "minmax(230px,1.7fr)", ink: true, render: (r) => h("span", { title: prod(r.sku).name }, mono(r.sku, { marginRight: 8, fontSize: 11.5 }), prod(r.sku).name) },
          { label: "Current stock", w: "96px", r: true, num: true, render: (r) => num(prod(r.sku).onHand) },
          { label: "Available", w: "76px", r: true, num: true, ink: true, render: (r) => { const a = prod(r.sku).avail; return a <= 0 ? colored("bad", "0") : a < prod(r.sku).rop ? colored("warn", num(a)) : num(a); } },
          { label: "Demand forecast", w: "114px", r: true, num: true, render: (r) => h("span", null, num(r.fc), faint(" · 4 wks")) },
          { label: "Supplier lead time", w: "150px", render: (r) => r.lead },
          { label: "Existing PO", w: "150px", render: (r) => (r.po ? h("span", null, L.po(r.po), faint(" " + num(r.poQty) + (r.poNote ? " · " + r.poNote : ""))) : colored("bad", "None")) },
          { label: "Suggested order", w: "124px", r: true, num: true, render: (r) => (r.qty ? h("span", { style: { color: "var(--ink)" } }, num(r.qty), faint(" · " + (DB.supplier(r.sup).name.split(" ")[0]))) : faint("0 now")) },
          { label: "Order date", w: "96px", render: (r) => (r.when === null ? faint("Hold") : r.when === 0 ? h("span", { style: { color: "var(--accent-text)", fontWeight: 500 } }, "TODAY") : rel(D(r.when))) },
          { label: "Expected stockout", w: "124px", render: (r) => { const o = FC_OUT[r.sku] !== undefined ? FC_OUT[r.sku] : r.out; return o === null ? colored("ok", "Avoided") : o === 0 ? colored("bad", "Now · backorder") : colored(o <= 7 ? "bad" : o <= 21 ? "warn" : "neutral", rel(D(o))); } },
          { label: "Confidence", w: "104px", render: (r) => h("div", { className: "pd-split", style: { gap: 6 } }, UI.Bar(r.conf, r.conf >= 85 ? "ok" : "warn", { w: 36 }), mono(r.conf + "%", { fontSize: 11 })) },
          { label: "Reason", w: "minmax(300px,2.6fr)", render: (r) => h("span", { title: r.reason }, r.reason) },
          { label: "", w: "178px", render: (r) => (r.param ? UI.Btn("Raise safety stock", () => ctx.act(ssKey, "Safety stock raised", "SAF-1930 safety stock 45 → 75 in Sage 200, both sites. Logged for Emma Walsh."), { sm: true, done: ctx.done(ssKey), doneLabel: "Raised to 75" })
            : createPO(ctx, r.sku, r.qty, r.sup, { plain: r.when !== 0 })) }
        ],
        foot: "Showing 10 of 147 recommendations. 137 more worth €156,432 are in Purchasing · Recommendations, grouped by supplier for Emma Walsh and Ciarán Kavanagh."
      })
    ]);

    const el = prod("EL-4408");
    const why = UI.Card({ title: "Why 160 reels of EL-4408, and why EuroCable", icon: "spark", meta: "THE WORKING, NOT A BLACK BOX", delay: 80 }, [
      UI.Label("What Dublin needs", { marginBottom: 8 }),
      UI.Facts([["Demand, 6 weeks", "192", null, "141 over 4 weeks"], ["Safety stock", String(el.safety)], ["Orders waiting", "54", "warn", "4 orders"], ["Total need", "294"]], 4),
      UI.Label("What Dublin has", { margin: "14px 0 8px" }),
      UI.Facts([["Available", String(el.avail), "bad", "4 counted in the bin"], ["On PO-8821", "120", "warn", "Atlas, 5 days late"], ["Gap", "162"], ["Order", "160", null, "4 pallets of 40"]], 4),
      UI.P(["EuroCable costs ", B("€0.45 more landed"), " a reel (€72 on 160) but lands in ", B("9 days, not 28"), ". Waiting for Atlas leaves Dublin short for 19 days with €12,460 of orders exposed this week. Emma Walsh approves; nothing is sent until she does."], { marginTop: 14 }),
      h("div", { style: { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" } }, createPO(ctx, "EL-4408", 160, "eurocable"), approveTransfer(ctx, { plain: true, label: "Approve Naas transfer" }), UI.Btn("Compare suppliers", () => ctx.open("product", "EL-4408"), { sm: true, ghost: true }))
    ]);

    const agent = UI.AI({ who: "Purchasing Agent", conf: "38 LINES DUE TODAY · €62,340",
      text: "38 lines need ordering today across 9 suppliers. Two need a person, not a formula: EL-4408 should go to EuroCable, not Atlas, and EL-4712 is a call on copper prices. The other 36 are drafted as 9 POs in Sage 200, one per supplier, waiting for approval.",
      actions: [UI.Btn("Send 9 drafts to Emma", () => ctx.act("rep-today", "9 POs sent for approval", "€62,340 across 9 suppliers, drafted in Sage 200. Emma Walsh approves; nothing goes to a supplier before she does."), { pri: true, sm: true, done: ctx.done("rep-today"), doneLabel: "With Emma" }),
        UI.Btn("Purchasing", () => ctx.go("Purchasing", "Recommendations"), { sm: true }), UI.Btn("Ask", () => ctx.ask("What should we buy today?"), { sm: true, ghost: true, icon: "spark" })] });

    const bySup = UI.Card({ title: "€184k of buying, by supplier", icon: "cart", meta: "147 LINES", delay: 120 },
      UI.HBars(BY_SUP.map((x) => ({ label: x[0] ? supName(x[0]) : "4 other suppliers", v: x[1], d: eurK(x[1]), tone: x[0] === "atlas" ? "warn" : undefined, onClick: x[0] ? () => ctx.open("supplier", x[0]) : undefined })), { tpl: "minmax(150px,1.4fr) 1.5fr 60px" }));

    const params = UI.Card({ title: "Settings Pulse would change", icon: "shield", meta: "REORDER POINTS · SAFETY STOCK · SUPPLIER", delay: 160 }, [
      ...[
        ["SAF-1930", "Safety stock 45 → 75", "Polska runs 3.1 days late on average; 45 did not cover the last slip.", ssKey, "Safety stock raised", "SAF-1930 safety stock 45 → 75 in Sage 200, both sites. Logged for Emma Walsh."],
        ["FH-6710", "Reorder point 120 → 180", "Core Facilities' new sites lift weekly demand from 48 to about 62.", "param-FH-6710", "Reorder point changed", "FH-6710 reorder point 120 → 180 in Naas."],
        ["EL-4408", "Preferred supplier when cover < 2 weeks: EuroCable", "Atlas stays first choice on price when there is time.", "param-EL-4408", "Supplier rule saved", "EL-4408: EuroCable preferred when Dublin cover drops under 2 weeks."],
        ["IC-3405", "Winter uplift +18% from October", "Two winters of glove sales say so.", "param-IC-3405", "Seasonal profile applied", "IC-3405 forecast carries +18% from October to February."]
      ].map((x) => UI.Row({ style: { alignItems: "flex-start" } }, [
        h("span", { style: { width: 76, paddingTop: 2 } }, L.sku(x[0])),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5, color: "var(--ink)" } }, x[1]), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, x[2])),
        UI.Btn("Apply", () => ctx.act(x[3], x[4], x[5]), { sm: true, done: ctx.done(x[3]), doneLabel: "Applied" })]))
    ]);

    const reduce = UI.Card({ flush: true, title: "Reduce or stop", meta: "23 SKUS · €47,600 NOT BOUGHT OVER 12 WEEKS", delay: 200, right: UI.Btn("Slow & dead stock", () => ctx.go("Inventory", "Slow & Dead Stock"), { sm: true, ghost: true }) }, [
      UI.Table({
        rows: REDUCE, rowKey: (r) => r.sku, onRow: (r) => ctx.open("product", r.sku),
        cols: [
          { label: "SKU", w: "82px", render: (r) => mono(r.sku) },
          { label: "Product", w: "minmax(170px,1.3fr)", ink: true, render: (r) => prod(r.sku).name },
          { label: "Pulse says", w: "minmax(170px,1.2fr)", ink: true, render: (r) => r.act },
          { label: "Why", w: "minmax(220px,1.6fr)", render: (r) => h("span", { title: r.detail }, r.detail) },
          { label: "Not bought", w: "90px", r: true, num: true, render: (r) => colored("ok", eur(r.save)) },
          { label: "", w: "110px", render: (r) => UI.Btn("Apply", () => ctx.act(r.key, r.act.indexOf("Reduce") === 0 ? "Order quantity reduced" : "Replenishment stopped", r.sku + ": " + r.act.toLowerCase() + ". Emma Walsh notified."), { sm: true, done: ctx.done(r.key), doneLabel: "Applied" }) }
        ],
        foot: "Stop replenishment €41,200 + reduce order quantities €6,400. The same lines feed the €168,000 working capital release on Slow & Dead Stock."
      })
    ]);

    return UI.Page({
      kicker: "Inventory · replenishment", live: "RECALCULATED 09:14",
      title: "What to buy, how much, from whom and when",
      sub: "147 recommendations worth €184,000, worked out from demand, open orders, what is already on order, real supplier lead times and MOQs. Pulse drafts; Emma Walsh approves.",
      actions: [UI.Btn("Ask what to buy", () => ctx.ask("What should we buy today?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Reorder recommendations", value: "147", sub: "€184,000 at cost" },
          { label: "Order today", value: "38 lines", sub: "€62,340 · 9 suppliers", tone: "bad", onClick: () => ctx.set({ invRepF: "today" }) },
          { label: "This week", value: "71 lines", sub: "€84,200" },
          { label: "Next 2 weeks", value: "38 lines", sub: "€37,460" },
          { label: "Stockouts prevented", value: "79 of 86", sub: "Projected in the next 30 days", subTone: "ok", onClick: () => ctx.go("Inventory", "Forecast") },
          { label: "Reduce or stop", value: "23 SKUs", sub: "€47,600 not bought", tone: "warn" }
        ], "repeat(6,minmax(0,1fr))"),
        table,
        gap(),
        UI.Grid("minmax(0,1.35fr) minmax(0,1fr)", [why, h("div", null, agent, gap(), bySup)]),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [reduce, params])
      ]
    });
  }

  /* ================================================================ SLOW & DEAD STOCK */
  const SLOW = [
    { sku: "LT-8305", act: "Supplier return candidate", bought: 318, release: 5233, note: "Nordic takes back current lines within 12 months of delivery at 15% restocking: 47 days left. Return 180 of 260; offer the rest to Harbour Point and Midland Merchants.", btn: "Request return" },
    { sku: "IC-3650", act: "Reduce purchase quantity", bought: 118, release: 852, note: "49 weeks of cover. Next order 60 not 120: Atlas takes half quantities for a €14 small-order charge.", btn: "Reduce next order" },
    { sku: "FIX-2402", act: "Target specific customers", bought: 212, release: 3780, note: "M&E contractors bought 336 last year. Murphy's SO-10482 has 50 allocated: the first real movement in six months.", btn: "Draft 3 offers" },
    { sku: "TL-5204", act: "Promotion candidate", bought: 132, release: 2760, note: "Christmas trade promotion alongside the 18V combi kit. 20% off still leaves 22% margin.", btn: "Add to promotion" },
    { sku: "TL-5610", act: "Hold, seasonal", bought: 250, release: 0, note: "Do not discount. Winter demand starts in October; last year 38 sold between October and January at full margin.", btn: "Hold for winter" },
    { sku: "LT-8410", act: "Stop replenishment", bought: 380, release: 4005, note: "Discontinued by Nordic. Block it in Sage 200 so nobody reorders by hand, then return the 124 at 15% restocking.", btn: "Stop replenishment" },
    { sku: "TL-5388", act: "Target specific customers", bought: 320, release: 2560, note: "Westbrook Hardware, Southside DIY and Tallaght Trade bought 29 last year. Offer 40 at trade price before spring.", btn: "Draft 3 offers" },
    { sku: "SAF-1740", act: "Bundle with fast seller", bought: 260, release: 2100, note: "Build site starter packs with SAF-1892 glasses and IC-3405 gloves. XXL vests go free in the pack.", btn: "Create bundle" },
    { sku: "SAF-1905", act: "Supplier return candidate", bought: 148, release: 2450, note: "Polska takes back unopened sizes within 180 days of delivery. 32 days left: return 100 of 142.", btn: "Request return" },
    { sku: "AD-7340", act: "Transfer warehouse", bought: 150, release: 672, note: "Sells 3 a week in Dublin, 4 in Naas against 95 weeks of stock. Move 40 on the shuttle; Dublin does not reorder 120.", btn: "Approve transfer" }
  ].map((r) => { const p = DB.product(r.sku); return Object.assign({ p, qty: p.onHand, value: Math.round(p.onHand * p.cost), idle: p.idle }, r); })
    .sort((a, b) => b.value - a.value);
  const ACT_TONE = { "Stop replenishment": "warn", "Transfer warehouse": "info", "Bundle with fast seller": "info", "Target specific customers": "info", "Reduce purchase quantity": "warn", "Promotion candidate": "warn", "Supplier return candidate": "bad", "Hold, seasonal": "neutral" };
  const slowKey = (r) => (r.act === "Stop replenishment" ? "stop-" + r.sku : r.act === "Transfer warehouse" ? "tr-ad7340" : "slow-" + r.sku);
  const bucketOf = (d) => (d >= 180 ? ["180+ days", "bad"] : d >= 120 ? ["120-180", "warn"] : ["90-120", "neutral"]);

  function slowDead(ctx) {
    const L = PD.lk(ctx);
    const fa = ctx.st.invSlowAct || "all";
    const acts = ["all"].concat(Object.keys(ACT_TONE).filter((a) => SLOW.some((r) => r.act === a)));
    const rows = SLOW.filter((r) => fa === "all" || r.act === fa);
    const tv = sum(SLOW.map((r) => r.value));

    const release = UI.Card({ title: "Potential working capital release: €168,000", icon: "euro", meta: "WITHIN 90 DAYS · CLICK AN ACTION TO FILTER", delay: 60, right: UI.Btn("Working capital", () => ctx.go("Finance", "Working Capital"), { sm: true, ghost: true }) }, [
      UI.HBars(RELEASE_SORTED.map((x) => ({ label: x[0], v: x[1], d: eur(x[1]), tone: fa === x[0] || (x[0] === "Supplier return candidate" && fa === "all") ? "info" : "neutral", onClick: () => ctx.set({ invSlowAct: fa === x[0] ? "all" : x[0] }) })), { tpl: "minmax(170px,1.3fr) 1.6fr 78px", flat: true }),
      UI.Sep(),
      h("div", { className: "pd-split" }, h("span", { style: { fontSize: 13, color: "var(--body)" } }, "Total"), h("span", { className: "pd-grow" }), mono("€168,000", { fontSize: 14 })),
      UI.Note("The largest single line in the business's €226,000 working capital plan. Stop replenishment is the easiest money: it releases cash by not spending it.", { marginTop: 8 })
    ]);

    const where = UI.Card({ title: "How old it is and where", icon: "clock", meta: "€286,420", delay: 100 }, [
      UI.Label("By days since last sale", { marginBottom: 8 }),
      UI.Split(SLOW_BUCKETS.map((b, i) => ({ label: b[0], v: b[1], color: ["var(--dim)", "var(--warn)", "var(--bad)"][i], d: eur(b[1]) }))),
      UI.Label("By warehouse", { margin: "16px 0 8px" }),
      UI.Split([{ label: "Dublin", v: SITES.DUB.slow, color: "var(--accent)", d: eur(SITES.DUB.slow) }, { label: "Naas", v: SITES.NAS.slow, color: "var(--dim)", d: eur(SITES.NAS.slow) }]),
      UI.Note("Naas holds 30% of stock but 39% of the slow stock: hi-vis, boots, tile cutters and pallet wrap bought for accounts that stopped ordering.", { marginTop: 12 })
    ]);

    const agent = UI.AI({ who: "Inventory Agent", conf: "90-DAY PLAN",
      text: ["Start with the returns: ", B("Polska's window on the S3 boots closes in 32 days"), " and Nordic will take back the floodlights and exit signs now. Then stop auto-reordering the 23 lines that no longer sell. ",
        B("Do not discount the 3kW fan heaters"), ": they are seasonal, winter demand starts in October and last year's 38 sold at full margin."],
      actions: [UI.Btn("Approve the 90-day plan", () => ctx.act("slow-plan", "Slow stock plan approved", "7 action lists assigned: returns to Emma Walsh, customer offers to the account managers, promotions to Michael Doyle. Progress tracked against €168,000."), { pri: true, sm: true, done: ctx.done("slow-plan"), doneLabel: "Plan approved" }),
        UI.Btn("Ask", () => ctx.ask("Where is our working capital trapped?"), { sm: true, ghost: true, icon: "spark" })] });

    const table = UI.Card({ flush: true, title: "Top 10 lines by value tied up", meta: eur(tv) + " OF €286,420 · 836 SKUS IN TOTAL" }, [
      h("div", { style: { padding: "12px 20px 10px" } }, UI.Chips(acts.map((a) => [a, a === "all" ? "All actions" : a, a === "all" ? SLOW.length : SLOW.filter((r) => r.act === a).length]), fa, (v) => ctx.set({ invSlowAct: v }))),
      UI.Table({
        rows, rowKey: (r) => r.sku, onRow: (r) => ctx.open("product", r.sku), rowTone: (r) => (r.idle >= 180 ? "bad" : null),
        empty: "No line in the top 10 has that action. It applies further down the list.",
        cols: [
          { label: "SKU", w: "82px", render: (r) => mono(r.sku) },
          { label: "Product", w: "minmax(190px,1.5fr)", ink: true, render: (r) => r.p.name },
          { label: "Site", w: "64px", render: (r) => WH[r.p.wh] },
          { label: "Qty", w: "64px", r: true, num: true, render: (r) => num(r.qty) },
          { label: "Value", w: "80px", r: true, num: true, ink: true, render: (r) => eur(r.value) },
          { label: "Last sale", w: "84px", r: true, num: true, render: (r) => colored(bucketOf(r.idle)[1], r.idle + " days") },
          { label: "Last bought", w: "90px", r: true, num: true, render: (r) => r.bought + " days" },
          { label: "Pulse action", w: "190px", render: (r) => UI.Badge(r.act, ACT_TONE[r.act]) },
          { label: "Why", w: "minmax(260px,2.2fr)", render: (r) => h("span", { title: r.note }, r.note) },
          { label: "Release", w: "82px", r: true, num: true, render: (r) => (r.release ? colored("ok", eur(r.release)) : faint("€0 now")) },
          { label: "", w: "160px", render: (r) => r.act === "Transfer warehouse"
            ? UI.Btn(r.btn, () => ctx.act("tr-ad7340", "Transfer approved", "40 × AD-7340 PU foam on the 14:00 Naas shuttle to Dublin. Dublin's automatic reorder of 120 cancelled."), { sm: true, done: ctx.done("tr-ad7340"), doneLabel: "Approved" })
            : UI.Btn(r.btn, () => ctx.act(slowKey(r), r.act === "Hold, seasonal" ? "Held for winter" : r.act, r.sku + ": " + (r.act === "Hold, seasonal" ? "no discount, no return. Pulse will flag it if October sales do not start." : r.act === "Stop replenishment" ? "removed from automatic reordering and blocked for manual POs. Return request drafted to Nordic." : r.btn.toLowerCase() + " prepared for approval.")), { sm: true, pri: r.act === "Supplier return candidate", done: ctx.done(slowKey(r)), doneLabel: r.act === "Hold, seasonal" ? "Held" : "Done" }) }
        ],
        foot: "Value at cost. Release is the cash back or buying avoided within 90 days. The other 826 slow lines are ranked the same way in the full list."
      })
    ]);

    const TARGETS = [["FIX-2402", [["liffey", 180], ["horizon", 96], ["kelleher", 60]]], ["TL-5388", [["westbrook", 14], ["southside", 9], ["tallaght", 6]]]];
    const targets = UI.Card({ title: "Who bought it last year", icon: "user", meta: "TARGET SPECIFIC CUSTOMERS", delay: 140 }, [
      ...TARGETS.map((t) => h("div", { key: t[0], style: { marginBottom: 6 } },
        h("div", { className: "pd-split", style: { marginBottom: 2 } }, L.sku(t[0]), h("span", { className: "pd-ell", style: { fontSize: 12, color: "var(--dim)" } }, prod(t[0]).name)),
        ...t[1].map((c) => UI.Row({ onClick: () => ctx.open("customer", c[0]) }, [h("span", { className: "pd-grow", style: { fontSize: 12.5 } }, DB.custName(c[0]), faint(" · " + DB.person(DB.customer(c[0]).am))), mono(num(c[1]) + " units", { fontSize: 11.5 })])))),
      UI.Note("Offers go from each account manager's Outlook, at trade price. No clearance list, so nobody's normal pricing gets undercut.")
    ]);

    const returns = UI.Card({ title: "Supplier return windows", icon: "return", meta: "CASH BACK, NOT DISCOUNT", delay: 180 }, [
      ...[
        ["SAF-1905", "polska", "32 days left", "bad", "Unopened sizes within 180 days of delivery", "€2,450"],
        ["LT-8305", "nordic", "47 days left", "warn", "Current lines within 12 months, 15% restocking", "€5,233"],
        ["LT-8410", "nordic", "Open · discontinued", "warn", "Discontinued lines, 15% restocking", "€4,005"],
        ["SAF-1740", "polska", "Closed at 180 days", "neutral", "Too late: bundle instead", "€0"]
      ].map((x) => UI.Row({ onClick: () => ctx.open("supplier", x[1]) }, [
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 12.5 } }, prod(x[0]).name, h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, x[0])),
          h("div", { className: "pd-meta", style: { marginTop: 2 } }, supName(x[1]).toUpperCase() + " · " + x[4].toUpperCase())),
        UI.Badge(x[2], x[3]), mono(x[5], { fontSize: 11.5, width: 56, textAlign: "right" })]))
    ]);

    const cats = UI.Card({ title: "Slow stock by category", icon: "box", meta: "OVER 90 DAYS", delay: 220 },
      UI.HBars(DB.categories.map((c) => ({ label: c.id, v: CATX[c.id].slow, d: eurK(CATX[c.id].slow) })).sort((a, b) => b.v - a.v), { tpl: "minmax(150px,1.3fr) 1.5fr 60px" }));

    return UI.Page({
      kicker: "Inventory · slow & dead stock",
      title: "€286,420 tied up in slow-moving inventory",
      sub: "Stock without a sale in 90 days or more. €74,200 of it has not moved in six months. Every line has an action and the cash it would release, and nothing is discounted that does not need to be.",
      actions: [UI.Btn("What can we reduce?", () => ctx.ask("What inventory can we reduce?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Slow-moving stock", value: "€286,420", sub: "836 SKUs, no sale in 90 days", tone: "warn", toneValue: true },
          { label: "90-120 days", value: "€96,840", sub: "186 SKUs" },
          { label: "120-180 days", value: "€115,380", sub: "158 SKUs", tone: "warn" },
          { label: "180+ days", value: "€74,200", sub: "492 SKUs · dead stock", tone: "bad", toneValue: true },
          { label: "Potential release", value: "€168,000", sub: "Within 90 days", hero: true },
          { label: "Cost of holding it", value: "€57,284", sub: "A year, at 20% carrying cost" }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.15fr) minmax(0,1fr) minmax(0,1fr)", [release, where, agent]),
        table,
        gap(),
        UI.Grid("repeat(3,minmax(0,1fr))", [targets, returns, cats])
      ]
    });
  }

  /* ================================================================ FORECAST */
  // Model profiles: available now at the stocking site, weekly run-rate, seasonal multipliers for
  // days 1-30 / 31-60 / 61-90, confirmed supply (no action) and Pulse's plan on top.
  // PO-8821 is planned 4 days out: Atlas says tomorrow, its record says later.
  const FCP = [
    { sku: "EL-4408", wh: "DUB", avail: 12, weekly: 32, safety: 48, season: [1, 1.06, 1.1], rec: [[4, 120]], plan: [[0, 40], [9, 160]], earliest: 10, q: 160, band: 14,
      fix: "Transfer 40 from Naas today and order 160 from EuroCable",
      inp: { open: "54 on 4 orders due within 3 days: Murphy 28, Harbour Point 12, Leinster Retail 8, Tallaght Trade 6", pattern: "Murphy Building Supplies buys cable every 3 weeks; next expected around " + dm(D(18)), quote: "QT-2853 Liffey Mechanical, cable and containment: 20 reels at 55% likelihood", quoteId: "QT-2853" } },
    { sku: "EL-4631", wh: "DUB", avail: 0, weekly: 45, safety: 60, season: [1, 1, 0.95], rec: [[4, 400]], plan: [[27, 200]], earliest: 27, q: 200, band: 12,
      fix: "Out until PO-8821 lands; order the next 200 by " + rel(D(2)),
      inp: { open: "150 on 3 orders waiting for PO-8821: Murphy 60, Horizon 40, Atlantic FM 50", pattern: "Horizon Electrical and Liffey Mechanical buy glands with SWA cable, about every 2 weeks" } },
    { sku: "IC-3310", wh: "DUB", avail: 0, weekly: 26, safety: 30, season: [1, 1, 1], rec: [[4, 200]], plan: [[28, 100]], earliest: 28, q: 100, band: 11,
      fix: "Out until PO-8821 lands; add 100 to the next Atlas order",
      inp: { open: "62 on 3 Dublin orders and 12 on Kelleher's Naas order, all waiting for PO-8821" } },
    { sku: "FH-6710", wh: "NAS", avail: 40, weekly: 48, safety: 60, season: [1, 1.12, 1.2], rec: [], plan: [[5, 400]], earliest: 6, q: 400, band: 10,
      fix: "Raise PO-8847 today: Kerry delivers in 5 days",
      inp: { open: "164 on 7 orders over the next 10 days", pattern: "Core Facilities and Atlantic FM reorder washroom stock at the start of each month", quote: "QT-2850 Core Facilities: 40 lines including washroom consumables, 60% likelihood", quoteId: "QT-2850" } },
    { sku: "IC-3405", wh: "DUB", avail: 940, weekly: 260, safety: 300, season: [1.08, 1.18, 1.2], rec: [], plan: [[16, 1000]], earliest: 17, q: 1000, band: 15,
      fix: "Order 1,000 by " + rel(D(6)) + ". PO-8833 is going to Naas",
      inp: { open: "180 allocated on 11 open orders", pattern: "Glove demand has run 18% higher from October for the last two winters", quote: "QT-2838 Leinster Retail national range: 400 boxes a month if won, 35% likelihood", quoteId: "QT-2838" } },
    { sku: "TL-5120", wh: "DUB", avail: 31, weekly: 9, safety: 8, season: [1.3, 2.1, 1.6], rec: [[0, 24]], plan: [[22, 24]], earliest: 23, q: 24, band: 22,
      fix: "Order 24 by " + rel(D(10)) + " for the Christmas trade",
      inp: { pattern: "Westbrook Hardware and Southside DIY stock up for Christmas from mid-October; last November sold 2.1× September" } },
    { sku: "EL-4712", wh: "DUB", avail: 28, weekly: 22, safety: 30, season: [1, 1.05, 1.1], rec: [[1, 80]], plan: [[10, 80]], earliest: 11, q: 80, band: 13,
      fix: "Buy 80 today, ahead of the copper surcharge review",
      inp: { open: "38 on 3 orders not yet allocated: Horizon 16, Murphy 12, Meath Maintenance 10", pattern: "Contractors bought ahead of the last copper surcharge; expect the same this time" } },
    { sku: "EL-4520", wh: "DUB", avail: 20, weekly: 6, safety: 6, season: [1, 1, 1.1], rec: [[0, 12]], plan: [[32, 12]], earliest: 33, q: 12, band: 18,
      fix: "Order 12 by " + rel(D(8)) + "; Hartmann runs late",
      inp: { pattern: "Horizon Electrical and Harbour Point fit-outs take 4 to 6 units per call-off" } },
    { sku: "FH-6602", wh: "NAS", avail: 300, weekly: 140, safety: 150, season: [1.05, 1.08, 1.14], rec: [[0, 600]], plan: [[9, 300]], earliest: 10, q: 300, band: 9,
      fix: "Order 300 by " + rel(D(4)),
      inp: { pattern: "Core Facilities adds 3 Citywest sites next month, about 20 cases a week" } },
    { sku: "FIX-2201", wh: "DUB", avail: 520, weekly: 148, safety: 150, season: [1, 1, 0.9], rec: [[0, 500]], plan: [], earliest: 14, q: 500, band: 8,
      fix: "Normal cycle: next EuroFix order at the reorder point" },
    { sku: "IC-3120", wh: "DUB", avail: 402, weekly: 64, safety: 80, season: [1, 1, 1], rec: [], plan: [], earliest: 12, q: 200, band: 9,
      fix: "Normal cycle: Midland order at the reorder point" },
    { sku: "FIX-2330", wh: "DUB", avail: 702, weekly: 112, safety: 120, season: [1.04, 1, 0.95], rec: [], plan: [], earliest: 14, q: 500, band: 8,
      fix: "Normal cycle: EuroFix order at the reorder point" },
    { sku: "AD-7102", wh: "DUB", avail: 1310, weekly: 120, safety: 180, season: [1, 0.9, 0.85], rec: [], plan: [], earliest: 7, q: 480, band: 10,
      fix: "Normal cycle: sealant slows over the winter" }
  ];
  const FC_CO = {
    7: { skus: 39, now: 28, exposed: 61240, covered: 35, demand: 226400 },
    30: { skus: 86, now: 28, exposed: 148600, covered: 79, demand: 978200 },
    60: { skus: 131, now: 28, exposed: 236900, covered: 124, demand: 1990000 },
    90: { skus: 164, now: 28, exposed: 311400, covered: 152, demand: 3020000 }
  };
  const WEEKLY_OUTS = [39, 13, 12, 14, 8, 9, 11, 10, 15, 12, 9, 8, 4];
  const rate = (f, t) => f.weekly / 7 * f.season[Math.min(2, Math.floor(Math.max(0, t - 1) / 30))];
  function sim(f, H, withPlan) {
    const rec = f.rec.concat(withPlan ? f.plan : []);
    const vals = [], auto = [];
    let s = f.avail;
    for (let t = 0; t <= H; t++) {
      if (t > 0) s -= rate(f, t);
      rec.forEach((r) => { if (r[0] === t) s += r[1]; });
      if (withPlan && t >= f.earliest && s < f.safety && !auto.some((a) => t - a < 3)) { s += f.q; auto.push(t); }
      vals.push(Math.round(s * 10) / 10);
    }
    return { vals, auto };
  }
  const firstOut = (vals) => { for (let i = 0; i < vals.length; i++) if (vals[i] < 0 || (i === 0 && vals[i] <= 0)) return i; return null; };
  const FC_OUT = {};
  FCP.forEach((f) => { FC_OUT[f.sku] = firstOut(sim(f, 90, false).vals); });

  function forecast(ctx) {
    const L = PD.lk(ctx);
    const H = Number(ctx.st.invFcH || 30);
    const co = FC_CO[H];
    const inH = FCP.filter((f) => FC_OUT[f.sku] !== null && FC_OUT[f.sku] <= H).sort((a, b) => FC_OUT[a.sku] - FC_OUT[b.sku]);
    const f = inH.find((x) => x.sku === ctx.st.invFcSku) || inH.find((x) => x.sku === "EL-4408") || inH[0] || FCP[0];
    const p = prod(f.sku), s = DB.supplier(p.supplier);
    const noAct = sim(f, H, false).vals, plan = sim(f, H, true).vals;
    const out = firstOut(noAct), planOut = firstOut(plan);
    const labels = noAct.map((_, i) => (i === 0 ? "Today" : H === 7 ? rel(D(i)) : dm(D(i))));
    const clamp = (v) => Math.max(0, v);
    const top = Math.max.apply(null, noAct.concat(plan).concat([f.safety])) * 1.08;
    const marks = [];
    noAct.forEach((v, i) => { if (marks.length < 2 && (v < 0 || (i === 0 && v <= 0)) && (i === 0 || noAct[i - 1] >= 0)) marks.push({ i, label: i === 0 ? "OUT NOW" : "STOCKOUT " + (H === 7 ? rel(D(i)) : dm(D(i))).toUpperCase(), tone: "bad" }); });
    const demandH = Math.round(sum(noAct.map((_, t) => (t ? rate(f, t) : 0))));
    const supplyH = sum(f.rec.filter((r) => r[0] <= H).map((r) => r[1]));
    const shortNo = Math.max(0, -Math.min.apply(null, noAct));
    const daysOut = noAct.filter((v, i) => v < 0 || (i === 0 && v <= 0)).length;
    const fmtDay = (d) => (d === null ? "Not within " + H + " days" : d === 0 ? "Now" : rel(D(d)));

    const chart = UI.Card({ title: "Projected stock vs forecast demand · " + f.sku + " " + p.name, icon: "spark", meta: WH[f.wh].toUpperCase() + " · NEXT " + H + " DAYS", delay: 40 }, [
      h("div", { style: { marginBottom: 16 } }, UI.Chips(inH.map((x) => [x.sku, x.sku, FC_OUT[x.sku] === 0 ? "now" : "d" + FC_OUT[x.sku]]), f.sku, (v) => ctx.set({ invFcSku: v }))),
      UI.Lines(labels, [
        { name: "If nothing changes", values: noAct.map(clamp), color: "var(--bad)", dash: true },
        { name: "With Pulse plan", values: plan.map(clamp), color: "var(--accent)", area: true }
      ], { h: 200, min: -top * 0.06, max: top, hline: f.safety, band: { from: -top * 0.06, to: 0 }, marks, every: H === 7 ? 1 : H === 30 ? 5 : H === 60 ? 10 : 15 }),
      UI.Note("Dashed amber line is safety stock (" + f.safety + "). Red shading is an empty shelf. " + (f.sku === "EL-4408" || f.sku === "EL-4631" || f.sku === "IC-3310" ? "PO-8821 is planned for " + rel(D(4)) + ": Atlas says " + relLower(D(1)) + " 10:30, but averages 3.8 days late and moved this date again at 09:04." : "Supply shown on confirmed supplier dates."), { marginTop: 10 }),
      gap(12),
      UI.Facts([
        ["Available now", num(f.avail), f.avail <= 0 ? "bad" : null, WH[f.wh]],
        ["Forecast demand", num(demandH), null, "Next " + H + " days"],
        ["Already on order", num(supplyH), null, supplyH ? "Confirmed POs" : "Nothing"],
        ["Runs out, no action", fmtDay(out), out !== null ? "bad" : "ok"],
        ["Unmet, no action", shortNo ? num(Math.max(1, Math.round(shortNo))) + " units" : "None", shortNo ? "bad" : "ok", daysOut ? daysOut + (daysOut === 1 ? " day" : " days") + " with an empty shelf" : "Shelf never empty"],
        ["With Pulse plan", planOut === null ? "Covered" : planOut === 0 ? "Out until supply lands" : "Short " + rel(D(planOut)), planOut === null ? "ok" : "warn"]
      ], 6)
    ]);

    const inputs = [
      ["Sales history", "Sage 200, 104 weeks: " + f.weekly + " a week on average at this site, " + Math.round(f.weekly * 1.04) + " over the last 13 weeks"],
      ["Open orders", (f.inp && f.inp.open) || num(siteStock(p, f.wh)[2]) + " allocated on open orders"],
      ["Seasonality", f.season.map((m, i) => ["Next 30 days", "Days 31 to 60", "Days 61 to 90"][i] + " " + (m === 1 ? "flat" : m > 1 ? "up " + Math.round((m - 1) * 100) + "%" : "down " + Math.round((1 - m) * 100) + "%")).join(" · ")],
      ["Customer buying patterns", (f.inp && f.inp.pattern) || "No single customer is more than 20% of demand"],
      ["Open quotes", (f.inp && f.inp.quote) || "No open quote includes it", f.inp && f.inp.quoteId],
      ["Supplier lead time", s.name + ": " + p.lead + " days quoted, " + (p.lead + s.delay).toFixed(1) + " actual over 12 months"]
    ];
    const inputsCard = UI.Card({ title: "What the forecast is built from", icon: "doc", meta: "MODEL ESTIMATE · ±" + f.band + "%", delay: 80 }, [
      ...inputs.map((x) => UI.Row({ style: { alignItems: "flex-start" } }, [
        h("span", { className: "pd-label", style: { width: 112, paddingTop: 3, flex: "none" } }, x[0]),
        h("span", { className: "pd-grow", style: { fontSize: 12.5, color: "var(--body)", lineHeight: 1.5 } }, x[1], x[2] ? h("span", null, " · ", L.quote(x[2], "open")) : null)])),
      UI.Note("A statistical estimate from Sage 200 history and today's open orders, quotes and supplier dates. It is a planning aid, not a promise: the range shows how far it has been out over the last 13 weeks.", { marginTop: 8 })
    ]);

    const acts = f.sku === "EL-4408" ? [approveTransfer(ctx), createPO(ctx, "EL-4408", 160, "eurocable", { plain: true })]
      : f.sku === "FH-6710" ? [createPO(ctx, "FH-6710", 400, "kerry")]
        : [UI.Btn("Replenishment", () => ctx.go("Inventory", "Replenishment"), { sm: true, pri: true }), UI.Btn("Open SKU", () => ctx.open("product", f.sku), { sm: true })];
    const agent = UI.AI({ who: "Inventory Agent", conf: out === null ? "NO STOCKOUT IN " + H + " DAYS" : out === 0 ? "OUT NOW" : "STOCKOUT " + fmtDay(out).toUpperCase(),
      text: f.sku === "EL-4408" ? "Dublin has 12 free on the system, 4 in the bin, against 54 already on orders due within 3 days. Even at the normal run-rate the shelf is empty " + lc(fmtDay(out)) + ", before PO-8821 is likely to land, and again " + dm(D(29)) + " without a new order. If Atlas slips once more, Dublin is short for weeks. " + f.fix + "."
        : p.name + " in " + WH[f.wh] + ": " + (out === null ? "no stockout inside " + H + " days if nothing changes." : out === 0 ? "nothing free today, and nothing lands before " + lc(fmtDay(f.rec.length ? f.rec[0][0] : 1)) + "." : "if nothing changes, available stock runs out " + lc(fmtDay(out)) + ", with " + num(Math.round(shortNo)) + " units of demand unmet over " + H + " days.") + " " + f.fix + ".",
      actions: acts });

    const listCard = UI.Card({ flush: true, title: inH.length + " modelled SKUs run out within " + H + " days", meta: co.skus + " ACROSS ALL SKUS · " + co.now + " ALREADY OUT", delay: 120 }, [
      UI.Table({
        rows: inH, rowKey: (x) => x.sku, onRow: (x) => ctx.set({ invFcSku: x.sku }), sel: (x) => x.sku === f.sku, rowTone: (x) => (FC_OUT[x.sku] <= 7 ? "bad" : FC_OUT[x.sku] <= 21 ? "warn" : null),
        empty: "No modelled SKU runs out in this window.",
        cols: [
          { label: "SKU", w: "82px", render: (x) => L.sku(x.sku) },
          { label: "Product", w: "minmax(190px,1.5fr)", ink: true, render: (x) => prod(x.sku).name },
          { label: "Site", w: "64px", render: (x) => WH[x.wh] },
          { label: "Runs out", w: "104px", render: (x) => colored(FC_OUT[x.sku] <= 7 ? "bad" : FC_OUT[x.sku] <= 21 ? "warn" : "neutral", FC_OUT[x.sku] === 0 ? "Now" : rel(D(FC_OUT[x.sku]))) },
          { label: "Available", w: "76px", r: true, num: true, render: (x) => num(x.avail) },
          { label: "Demand " + H + "d", w: "90px", r: true, num: true, render: (x) => num(Math.round(sum(Array.from({ length: H }, (_, i) => rate(x, i + 1))))) },
          { label: "Pulse fix", w: "minmax(240px,2fr)", render: (x) => h("span", { title: x.fix }, x.fix) }
        ],
        foot: "Click a row to chart it. The full list of " + co.skus + " SKUs sits behind Replenishment, which already covers " + co.covered + " of them."
      })
    ]);

    const weeks = Math.ceil(H / 7);
    const weekly = UI.Card({ title: "SKUs running out per week, if nothing is ordered", icon: "alert", meta: "ALL 8,426 SKUS · NEXT 13 WEEKS", delay: 160 }, [
      UI.Columns(WEEKLY_OUTS.map((v, i) => ({ l: i === 0 ? "Wk 1" : "W" + (i + 1), v, d: String(v), hi: i < weeks })), { h: 140, showValues: true }),
      UI.Note("Week 1 includes the 28 SKUs already out. Highlighted weeks fall inside the " + H + "-day view.", { marginTop: 10 })
    ]);

    return UI.Page({
      kicker: "Inventory · forecast", live: "MODEL RUN 06:00 · REFRESHED 09:14",
      title: "See the stockout before it happens",
      sub: "Projected stock against forecast demand for each SKU. The forecast is a model estimate built from sales history, open orders, seasonality, customer buying patterns, open quotes and suppliers' real lead times.",
      actions: [UI.Tabs([["7", "7 days"], ["30", "30 days"], ["60", "60 days"], ["90", "90 days"]], String(H), (v) => ctx.set({ invFcH: v }))],
      children: [
        UI.Kpis([
          { label: "SKUs projected to run out", value: String(co.skus), sub: "In " + H + " days, if nothing is ordered · " + co.now + " out now", tone: "bad", toneValue: true },
          { label: "Revenue exposed", value: eur(co.exposed), sub: "Orders and forecast sales on those SKUs", tone: "warn" },
          { label: "Covered by Pulse plan", value: co.covered + " of " + co.skus, sub: "POs, transfers and existing supply", subTone: "ok", onClick: () => ctx.go("Inventory", "Replenishment") },
          { label: "Forecast demand, at cost", value: eurK(co.demand), sub: "All SKUs, next " + H + " days" },
          { label: "Forecast accuracy", value: "87.4%", sub: "Last 13 weeks, by SKU and week" }
        ], "repeat(5,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.65fr) minmax(0,1fr)", [chart, h("div", null, agent, gap(), inputsCard)]),
        UI.Grid("minmax(0,1.65fr) minmax(0,1fr)", [listCard, weekly])
      ]
    });
  }

  /* ================================================================ TRANSFERS */
  const SUGGEST = [
    { sku: "EL-4408", qty: 40, from: "NAS", to: "DUB", why: "Dublin 12 free vs 58 needed in 7 days. Naas keeps 24 against 11.", protects: "3 orders", value: 12460, when: "Today 14:00", key: "dq-transfer", status: "Recommended", pallets: 2 },
    { sku: "AD-7340", qty: 40, from: "NAS", to: "DUB", why: "Dublin sells 3 a week and has 4 free. Naas holds 95 weeks.", protects: "Dublin reorder of 120 avoided", value: 672, when: "Today 14:00", key: "tr-ad7340", status: "Recommended", pallets: 1 },
    { sku: "TL-5610", qty: 12, from: "DUB", to: "NAS", why: "Seasonal. Naas customers took 14 of last winter's 38 heaters, each sent next day from Dublin.", protects: "Winter demand from October", value: 1416, when: "Today 16:30", key: "tr-tl5610", status: "Recommended", pallets: 1 },
    { sku: "FIX-2402", qty: 60, from: "DUB", to: "NAS", why: "58 weeks of cover in Dublin. Kildare Mechanical and Kelleher run Naas-side jobs.", protects: "Slow stock put where it can sell", value: 1134, when: "Today 16:30", key: "tr-fix2402", status: "Recommended", pallets: 1 },
    { sku: "IC-3310", qty: 12, from: "DUB", to: "NAS", why: "Kelleher's SO-10507 needs 12 in Naas. Send from PO-8821 the day it lands.", protects: "1 order", value: 2140, when: rel(D(1)) + " 16:30", key: "tr-ic3310", status: "After PO-8821", pallets: 0 },
    { sku: "EL-4712", qty: 10, from: "NAS", to: "DUB", why: "Not needed: PO-8836 lands in Dublin tomorrow 08:30 with 80, before the shuttle would.", protects: "", value: 0, when: "", key: null, status: "Not recommended", pallets: 0 }
  ];
  const WEEK = [
    ["TR-3326", "FH-6602", 48, "NAS", "DUB", "Booked", "Today 14:00", 0, "Dublin customers on D02 and D11 tomorrow"],
    ["TR-3325", "EL-4412", 12, "DUB", "NAS", "Awaiting put-away", "Yesterday 16:30", 0, "Naas stock of the approved EL-4408 substitute"],
    ["TR-3324", "IC-3405", 200, "DUB", "NAS", "Received", "Yesterday 16:30", 0, "Covered Naas until PO-8833"],
    ["TR-3322", "FIX-2330", 120, "DUB", "NAS", "Received", rel(D(-2)) + " 16:30", 0, "Kildare Mechanical call-off"],
    ["TR-3321", "SAF-1892", 240, "NAS", "DUB", "Variance", rel(D(-2)) + " 14:00", -12, "Dublin counted 228. Aoife Brennan checking the Naas pick"],
    ["TR-3320", "AD-7102", 240, "DUB", "NAS", "Received", rel(D(-3)) + " 16:30", 0, "Naas sealant top-up"],
    ["TR-3319", "TL-5120", 6, "NAS", "DUB", "Received", rel(D(-3)) + " 14:00", 0, "Westbrook's SO-10491"],
    ["TR-3318", "LT-8120", 30, "DUB", "NAS", "Received", rel(D(-4)) + " 16:30", 0, "Naas batten stock"]
  ];
  const WEEK_TONE = { "Booked": "info", "Awaiting put-away": "warn", "Received": "ok", "Variance": "bad" };

  function transfers(ctx) {
    const L = PD.lk(ctx);
    const done = (k) => !!k && ctx.done(k);
    const outBase = [["FH-6602 · 48 cases for Dublin accounts", 2, "TR-3326"], ["Customer returns for Dublin quarantine · 3 RMAs", 1, null], ["Empty cages and pallets", 2, null]];
    const backBase = [["Naas top-ups from Dublin goods in", 2, null], ["Returns to Naas", 1, null]];
    const outLoad = outBase.concat(SUGGEST.filter((x) => x.from === "NAS" && x.pallets && done(x.key)).map((x) => [x.sku + " · " + x.qty + " × " + prod(x.sku).name, x.pallets, "NEW"]));
    const backLoad = backBase.concat(SUGGEST.filter((x) => x.from === "DUB" && x.pallets && done(x.key)).map((x) => [x.sku + " · " + x.qty + " × " + prod(x.sku).name, x.pallets, "NEW"]));
    const usedOut = sum(outLoad.map((x) => x[1])), usedBack = sum(backLoad.map((x) => x[1]));
    const tApproved = ctx.done("dq-transfer");

    const hero = UI.Card({ tint: true, title: "EL-4408 Industrial Cable 100m: Naas → Dublin", icon: "swap", meta: "PULSE RECOMMENDATION · INVENTORY AGENT 09:14", right: UI.Btn("Product record", () => ctx.open("product", "EL-4408"), { sm: true, ghost: true }) }, [
      UI.Facts([["Dublin available", "12", "bad", "4 counted in bin D-14-03"], ["Naas available", "64", null, "7 allocated"], ["Dublin demand, 7 days", "58", "warn", "54 already on orders"], ["Naas demand, 7 days", "11", null, "Naas keeps 24 after"]], 4),
      h("div", { style: { fontSize: 19, fontWeight: 500, letterSpacing: "-.4px", margin: "16px 0 4px" } }, "Transfer 40 units Naas → Dublin on today's 14:00 shuttle"),
      h("div", { style: { fontSize: 12.5, color: "var(--dim)", marginBottom: 12 } }, "Lands at Dublin goods in by 14:50, put away before the 16:00 allocation run. Costs nothing extra: the shuttle runs anyway."),
      UI.Facts([["Estimated avoidance", "1 stockout", "ok", "Dublin, " + lc(rel(D(3)))], ["Orders protected", "3", "ok"], ["Value protected", "€12,460", "ok"], ["Shuttle space", "2 pallets", null, tApproved ? "Booked on the 14:00" : "of " + (10 - usedOut) + " free"]], 4),
      h("div", { style: { marginTop: 12, margin: "12px -20px 0" } }, UI.Table({
        rows: [["SO-10509", 12, "Harbour Point, D12 " + rel(D(3))], ["SO-10515", 8, "Leinster Retail, D02 " + rel(D(3))], ["SO-10493", 2, "Tallaght Trade, balance after the 4 in the bin"]], rowKey: (r) => r[0], onRow: (r) => ctx.open("order", r[0]),
        cols: [
          { label: "Protected order", w: "110px", render: (r) => mono(r[0]) },
          { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (r) => L.cust(DB.order(r[0]).cust) },
          { label: "Reels", w: "56px", r: true, num: true, render: (r) => r[1] },
          { label: "Value", w: "80px", r: true, num: true, ink: true, render: (r) => eur(DB.order(r[0]).value) },
          { label: "Delivery", w: "minmax(180px,1.6fr)", render: (r) => r[2] }
        ]
      })),
      h("div", { style: { display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" } },
        approveTransfer(ctx, { big: true }),
        UI.Btn("See availability", () => { ctx.set({ invAvSku: "EL-4408", invAvQ: "" }); ctx.go("Inventory", "Availability"); }, { sm: true }),
        h("span", { className: "pd-note" }, tApproved ? "Booked as TR-3327. Pick list sent to Aoife Brennan in Naas; Dublin goods in expecting 40 reels at 14:50." : "Owner: Emma Walsh · decision due 13:00. Murphy's 28 still come from PO-8821."))
    ]);

    const shuttle = UI.Card({ title: "Daily shuttle, Naas and Dublin", icon: "truck", meta: "221-KE-9936 · 7.5T BOX · 10 PALLETS", delay: 60 }, [
      UI.Facts([["Out", "14:00", null, "Naas → Dublin 14:50"], ["Back", "16:30", null, "Dublin → Naas 17:20"], ["Planned by", DB.person("CW"), null, "Transport planner"]], 3),
      h("div", { style: { marginTop: 14 } },
        h("div", { className: "pd-split", style: { marginBottom: 6 } }, UI.Label("14:00 Naas → Dublin"), h("span", { className: "pd-grow" }), mono(usedOut + " / 10 pallets", { fontSize: 11 })),
        UI.Bar(usedOut * 10, usedOut >= 9 ? "warn" : null, { h: 8 }),
        ...outLoad.map((x) => UI.Row({ style: { padding: "7px 0" } }, [h("span", { className: "pd-grow", style: { fontSize: 12 } }, x[0]), x[2] === "NEW" ? UI.Badge("ADDED", "info", true) : x[2] ? faint(x[2]) : null, mono(x[1] + " pl", { fontSize: 11 })]))),
      h("div", { style: { marginTop: 14 } },
        h("div", { className: "pd-split", style: { marginBottom: 6 } }, UI.Label("16:30 Dublin → Naas"), h("span", { className: "pd-grow" }), mono(usedBack + " / 10 pallets", { fontSize: 11 })),
        UI.Bar(usedBack * 10, null, { h: 8 }),
        ...backLoad.map((x) => UI.Row({ style: { padding: "7px 0" } }, [h("span", { className: "pd-grow", style: { fontSize: 12 } }, x[0]), x[2] === "NEW" ? UI.Badge("ADDED", "info", true) : null, mono(x[1] + " pl", { fontSize: 11 })]))),
      UI.Note("A transfer on the scheduled shuttle costs nothing extra. A dedicated van is €180 and a courier pallet €65. Cut-off for adding stock: 13:15 in Naas, 15:45 in Dublin.", { marginTop: 10 })
    ]);

    const table = UI.Card({ flush: true, title: "Suggested transfers, both directions", meta: "PULSE PROPOSES WHEN THE SENDING SITE KEEPS 2+ WEEKS OF COVER", delay: 100 }, [
      UI.Table({
        rows: SUGGEST, rowKey: (x) => x.sku, onRow: (x) => ctx.open("product", x.sku), sel: (x) => x.sku === "EL-4408",
        rowTone: (x) => (x.status === "Not recommended" ? null : x.sku === "EL-4408" && !tApproved ? "bad" : null),
        cols: [
          { label: "SKU", w: "82px", render: (x) => mono(x.sku) },
          { label: "Product", w: "minmax(180px,1.3fr)", ink: true, render: (x) => prod(x.sku).name },
          { label: "Qty", w: "52px", r: true, num: true, ink: true, render: (x) => x.qty },
          { label: "Direction", w: "124px", render: (x) => h("span", null, WH[x.from], faint(" → "), WH[x.to]) },
          { label: "Why", w: "minmax(260px,2.2fr)", render: (x) => h("span", { title: x.why }, x.why) },
          { label: "Protects", w: "minmax(150px,1.1fr)", render: (x) => x.protects || faint("None") },
          { label: "Value", w: "84px", r: true, num: true, render: (x) => (x.value ? eur(x.value) : faint("€0")) },
          { label: "Shuttle", w: "118px", render: (x) => x.when || faint("None") },
          { label: "", w: "160px", render: (x) => (!x.key ? UI.Badge("NOT RECOMMENDED", "neutral", true) : x.key === "dq-transfer" ? approveTransfer(ctx, { plain: false })
            : UI.Btn(x.status === "After PO-8821" ? "Queue transfer" : "Approve Transfer", () => ctx.act(x.key, x.status === "After PO-8821" ? "Transfer queued" : "Transfer approved", x.qty + " × " + x.sku + " " + WH[x.from] + " → " + WH[x.to] + (x.status === "After PO-8821" ? " on the first shuttle after PO-8821 is received. Kelleher's SO-10507 updated." : ", " + x.when + " shuttle. Pick list sent to " + (x.from === "NAS" ? DB.person("AB") : DB.person("LM")) + ".")), { sm: true, done: ctx.done(x.key), doneLabel: x.status === "After PO-8821" ? "Queued" : "Approved" })) }
        ]
      })
    ]);

    const weekT = UI.Card({ flush: true, title: "Transfers this week", meta: "14 TRANSFERS · €18,420 MOVED · 1 VARIANCE", delay: 140 }, [
      UI.Table({
        rows: WEEK, rowKey: (r) => r[0], onRow: (r) => ctx.open("product", r[1]), rowTone: (r) => (r[5] === "Variance" ? "bad" : null),
        cols: [
          { label: "Transfer", w: "84px", render: (r) => mono(r[0]) },
          { label: "SKU", w: "82px", render: (r) => L.sku(r[1]) },
          { label: "Qty", w: "56px", r: true, num: true, render: (r) => num(r[2]) },
          { label: "Direction", w: "124px", render: (r) => h("span", null, WH[r[3]], faint(" → "), WH[r[4]]) },
          { label: "Shipped", w: "132px", render: (r) => r[6] },
          { label: "Status", w: "140px", render: (r) => UI.Badge(r[5], WEEK_TONE[r[5]]) },
          { label: "Variance", w: "72px", r: true, num: true, render: (r) => (r[7] ? colored("bad", String(r[7])) : faint("0")) },
          { label: "Note", w: "minmax(220px,2fr)", render: (r) => h("span", { title: r[8] }, r[8]) }
        ],
        foot: "Showing the last 8 of 14. Every transfer is a stock movement in Sage 200 and the WMS, so both sites' figures stay true while stock is on the road."
      })
    ]);

    const agent = UI.AI({ who: "Inventory Agent", conf: "LAST 90 DAYS",
      text: ["Transfers avoided ", B("€18,600 of buying"), " and ", B("9 stockouts"), " in the last 90 days. The rule: move stock when the sending site keeps at least 2 weeks of cover, the shuttle has space, and no PO lands sooner. That last test is why EL-4712 stays where it is."],
      actions: [UI.Btn("Slow & dead stock", () => ctx.go("Inventory", "Slow & Dead Stock"), { sm: true }), UI.Btn("Allocation", () => ctx.go("Orders", "Allocation"), { sm: true, ghost: true })] });

    const recN = SUGGEST.filter((x) => x.status === "Recommended").length;
    return UI.Page({
      kicker: "Inventory · transfers",
      title: "Move stock before buying more",
      sub: "Stock in Naas, orders in Dublin, or the other way round. Pulse matches surplus in one warehouse to shortage in the other and books it on the daily shuttle.",
      actions: [UI.Btn("Availability", () => ctx.go("Inventory", "Availability"), { icon: "box" })],
      children: [
        UI.Kpis([
          { label: "Suggested today", value: recN + " transfers", sub: eur(sum(SUGGEST.filter((x) => x.status === "Recommended").map((x) => x.value))) + " of orders and stock", tone: tApproved ? null : "warn" },
          { label: "Orders in the wrong site", value: "11", sub: "Stock in one warehouse, order in the other", onClick: () => ctx.go("Orders", "Allocation") },
          { label: "Shuttle space today", value: (10 - usedOut) + " pallets", sub: "Free on the 14:00 · " + (10 - usedBack) + " on the 16:30" },
          { label: "Transfers this week", value: "14", sub: "€18,420 moved · 1 variance" },
          { label: "Buying avoided", value: "€18,600", sub: "Last 90 days", subTone: "ok", onClick: () => ctx.go("Inventory", "Slow & Dead Stock") }
        ], "repeat(5,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [hero, shuttle]),
        table,
        gap(),
        UI.Grid("minmax(0,1.65fr) minmax(0,1fr)", [weekT, agent])
      ]
    });
  }

  PD.pages.Inventory = {
    "Overview": overview,
    "Stock": stock,
    "Availability": availability,
    "Replenishment": replenishment,
    "Slow & Dead Stock": slowDead,
    "Forecast": forecast,
    "Transfers": transfers
  };
})();
