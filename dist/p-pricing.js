/* Pricing & Margin: where gross profit quietly leaks away, and who can stop it.
   Canonical figures come from PD.DB (kpi, categories, leakage, costChanges, quotes).
   Local tables below reconcile to them; the checks at the bottom warn if they drift. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB, K = DB.kpi;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, dm } = PD.date;
  const B = UI.B;
  const MOD = "Pricing & Margin";

  /* ---------------- helpers ---------------- */
  const p1 = (v) => Number(v).toFixed(1) + "%";
  const pts = (v) => (v > 0.04 ? "+" : v < -0.04 ? "−" : "") + Math.abs(v).toFixed(1) + " pts";
  const mono = (t, style) => h("span", { className: "pd-mono", style: Object.assign({ fontSize: 12 }, style) }, t);
  const fg = (tone) => (PD.TONE[tone] || PD.TONE.neutral).fg;
  const mTone = (m, t) => (m < t - 2 ? "bad" : m < t ? "warn" : "ok");
  const none = () => h("span", { className: "pd-faint" }, "None");
  const gap = (px) => h("div", { style: { height: px || 14 } });
  const months = (n) => Array.from({ length: n }, (_, i) => PD.date.MS[new Date(PD.date.TODAY.getFullYear(), PD.date.TODAY.getMonth() - (n - 1) + i, 1).getMonth()]);
  const sum = (a) => a.reduce((x, y) => x + y, 0);

  /* margin bar with a target tick */
  const MVT = (m, t, opt) => {
    opt = opt || {};
    const max = opt.max || 35, tone = opt.tone || mTone(m, t);
    return h("div", { style: { position: "relative", height: opt.h || 8, borderRadius: 999, background: "var(--track)", minWidth: 56, width: "100%" } },
      h("div", { style: { position: "absolute", left: 0, top: 0, bottom: 0, width: Math.max(2, Math.min(100, 100 * m / max)) + "%", borderRadius: 999, background: fg(tone), transformOrigin: "left center", animation: "sweep .7s var(--ease) both" } }),
      h("div", { title: "Target " + p1(t), style: { position: "absolute", top: -3, bottom: -3, left: "calc(" + Math.min(100, 100 * t / max) + "% - 1px)", width: 2, borderRadius: 2, background: "var(--ink)", opacity: .75 } }));
  };
  const marginCell = (m, t) => h("span", { style: { color: fg(mTone(m, t)) } }, p1(m));

  /* Pulse counter price, same rule as the quote record */
  const counterOf = (value, margin, target) => {
    const cost = value * (1 - margin / 100);
    const m = Math.min(target, +(margin + (target - margin) * .63).toFixed(1));
    return { m, price: Math.round(cost / (1 - m / 100)), gp: Math.round(cost / (1 - m / 100) - cost), cost };
  };

  /* ======================================================================
     LOCAL DATA (reconciles to PD.DB)
     ====================================================================== */

  /* account managers, revenue MTD sums to €1,084,620, GP to ~€258k (23.8%) */
  const AMS = [
    { k: "SB", rev: 312400, gm: 24.4, above: 610, lines: 24, pend: 1, low: "doyle" },
    { k: "DK", rev: 248600, gm: 22.3, above: 1480, lines: 52, pend: 4, low: "atlantic" },
    { k: "MR", rev: 276800, gm: 24.6, above: 520, lines: 21, pend: 4, low: "liffey" },
    { k: "MD", rev: 142300, gm: 20.6, above: 470, lines: 14, pend: 1, low: "leinster", note: "National accounts" },
    { k: "HOUSE", rev: 104520, gm: 27.8, above: 180, lines: 7, pend: 0, low: null, note: "Portal, counter and order desk" }
  ];

  /* pricing types, revenue MTD sums to €1,084,620, weighted margin 23.8% */
  const TYPES = [
    { t: "Standard", how: "List price, no account terms", cov: "1 list · 8,426 SKUs · 61 accounts", rev: 118400, gm: 31.2, watch: "List not moved on 214 SKUs since the cost increases", tone: "warn" },
    { t: "Tier", how: "Trade tiers A, B and C, a set discount off list", cov: "3 lists · 318 accounts", rev: 392600, gm: 24.9, watch: "186 SKUs still priced off the old cost file", tone: "warn" },
    { t: "Contract", how: "Fixed prices agreed for a term", cov: "58 contracts · 58 accounts", rev: 318900, gm: 21.6, watch: "42 not repriced since supplier increases", tone: "bad" },
    { t: "Customer-specific", how: "Net prices on named lines, on top of a tier", cov: "1,946 lines · 118 accounts", rev: 196300, gm: 22.2, watch: "412 lines under today's cost plus 15%", tone: "bad" },
    { t: "Promotional", how: "Time-limited deals, supplier-funded or clearance", cov: "6 promotions · 4 end this month", rev: 34700, gm: 19.4, watch: "2 not supplier-funded", tone: "warn" },
    { t: "Manual override", how: "Price typed over at order entry", cov: "63 overrides this month", rev: 23720, gm: 17.8, watch: "9 with no reason code", tone: "bad" }
  ];

  /* the €18,600 annualised recovery from the morning briefing (€1,550 a month) */
  const RECOVERY = [
    { k: "cat", label: "Industrial Consumables repricing", sub: "IC-3120 cutting discs, IC-3144 flap discs, IC-3310 cable ties and 14 smaller lines", mo: 620 },
    { k: "leinster", label: "Leinster Retail Group, national contract", sub: "212 lines hit by supplier increases, last repriced 14 months ago", mo: 440 },
    { k: "obrien", label: "O'Brien Facilities, customer prices", sub: "38 of 146 net prices set before the EuroFix and Midland increases", mo: 290 },
    { k: "atlantic", label: "Atlantic FM Services, customer prices", sub: "22 consumables lines still on last year's cost", mo: 200 }
  ];

  /* contract and customer price lists due for repricing (42 in total, €4,820 a month) */
  const REPRICE = [
    { c: "leinster", list: "Leinster Retail national", am: "MD", lines: 1240, hit: 212, last: "14 months ago", clause: "Annual review overdue", mo: 440 },
    { c: "core", list: "Core FM 2025-27", am: "MR", lines: 620, hit: 88, last: "9 months ago", clause: "Cost clause, 30 days' notice", mo: 360 },
    { c: "murphy", list: "Murphy BS 2026", am: "SB", lines: 410, hit: 64, last: "8 months ago", clause: "Review window opens in 5 weeks", mo: 310 },
    { c: "obrien", list: "O'Brien customer prices", am: "DK", lines: 146, hit: 38, last: "13 months ago", clause: "No clause, 30 days' notice", mo: 290 },
    { c: "atlantic", list: "Atlantic FM customer prices", am: "DK", lines: 92, hit: 22, last: "11 months ago", clause: "No clause, 30 days' notice", mo: 200 },
    { c: "harbour", list: "Harbour Point project", am: "SB", lines: 180, hit: 41, last: "4 months ago", clause: "Fixed for phase 1, reprice phase 2", mo: 180 },
    { c: "doyle", list: "Hansfield project", am: "SB", lines: 160, hit: 36, last: "6 months ago", clause: "Fixed to project end", mo: 170 }
  ];
  const REPRICE_REST = { n: 35, mo: 2870 };

  /* accounts buying below their required margin */
  const BELOW = [
    { c: "leinster", list: "Contract · national", req: 22.0, floor: 20.0, last: "14 months ago", rec: 5280, note: "Under its own 20% floor" },
    { c: "atlantic", list: "Tier B + 92 customer prices", req: 24.0, last: "11 months ago", rec: 2400, note: "Consumables priced before the Midland and Atlas increases" },
    { c: "obrien", list: "Tier B + 146 customer prices", req: 24.0, last: "13 months ago", rec: 3480, note: "QT-2841 would take the agreement to 17.2%" },
    { c: "doyle", list: "Project pricing · Hansfield", req: 23.0, last: "6 months ago", rec: null, note: "Fixed to project end; review at phase 2" },
    { c: "dunmore", list: "Tier B trade", req: 24.0, last: "Tier list, 5 months ago", rec: null, note: "Declining account, rep discounting to hold volume" },
    { c: "liffey", list: "Tier B trade", req: 24.0, last: "Tier list, 5 months ago", rec: null, note: "QT-2853 pending at 20.6%" }
  ];
  const BELOW_REST = { n: 17, gp: 7080 };

  /* exceptions raised in the last 30 days: 23 = 10 pending + 8 approved + 3 countered + 2 rejected */
  const E = (id, kind, cust, value, std, prop, am, reason, detail, status, extra) => Object.assign({ id, kind, cust, value, std, prop, am, reason, detail, status }, extra || {});
  const EXC = [
    E("QT-2841", "quote", "obrien", 18420, 24.0, 17.2, "DK", "Strategic deal", "5-site FM supply agreement", "PENDING", { approver: "MD", due: "Today 11:00" }),
    E("QT-2859", "quote", "harbour", 14860, 25.0, 20.1, "SB", "Project pricing", "Phase 2 fit-out, 14 months", "PENDING", { approver: "MD", due: "Today 16:00" }),
    E("QT-2847", "quote", "atlantic", 11260, 24.0, 19.9, "DK", "Competitor match", "Consumables, no competing quote attached", "PENDING", { approver: "MD", due: relLower(D(1)).replace(/^./, (c) => c.toUpperCase()) + " 10:00" }),
    E("QT-2853", "quote", "liffey", 8940, 25.0, 20.6, "MR", "Volume commitment", "Cable and containment, 12 months", "PENDING", { approver: "MD", due: rel(D(1)) + " 12:00" }),
    E("SO-10525", "order", "leinster", 7240, 22.0, 19.2, "MD", "Below national floor", "31 lines on the old contract, 9 hit by supplier increases", "PENDING", { approver: "PB", due: "Today 12:00" }),
    E("SO-10538", "order", "horizon", 3420, 24.0, 20.2, "MR", "Old cost price", "EL-4712 keyed at the pre-surcharge price", "PENDING", { approver: "MD", due: "Today 14:00" }),
    E("SO-10534", "order", "westbrook", 2940, 25.0, 22.1, "DK", "Competitor match", "TL-5204 bit sets matched to a builders' merchant", "PENDING", { approver: "MD", due: "Today 15:00" }),
    E("SO-10532", "order", "tallaght", 1380, 24.0, 18.9, "DK", "No reason code", "Counter override on 6 lines", "PENDING", { approver: "MD", due: "Today 12:00" }),
    E("SO-10536", "order", "kelleher", 1160, 24.0, 21.4, "MR", "Old cost price", "EL-4712 and IC-3120 on last month's cost", "PENDING", { approver: "MD", due: rel(D(1)) + " 09:00" }),
    E("SO-10537", "order", "glenview", 860, 26.0, 20.8, "MR", "No reason code", "Old Tier C list on hygiene lines", "PENDING", { approver: "MD", due: rel(D(1)) + " 09:00" }),
    E("SO-10503", "order", "doyle", 16240, 24.0, 22.1, "SB", "Project pricing", "Hansfield, agreed at tender", "APPROVED", { by: "MD", when: -1 }),
    E("QT-2819", "closed", "core", 22300, 26.0, 23.9, "MR", "Contract renewal", "Three-year FM supply renewal", "APPROVED", { by: "PB", when: -3 }),
    E("SO-10499", "order", "atlantic", 2860, 24.0, 20.4, "DK", "Customer prices", "Consumables on Atlantic's net prices", "APPROVED", { by: "MD", when: -6 }),
    E("SO-10515", "order", "leinster", 3780, 22.0, 20.6, "MD", "National contract", "Above the 20% floor, approved by rule", "APPROVED", { by: "AUTO", when: 0 }),
    E("QT-2826", "closed", "dunmore", 9120, 24.0, 18.6, "SB", "Competitor match", "Fixings; countered at 22.0%, customer accepted", "COUNTERED", { by: "MD", when: -2 }),
    E("QT-2831", "closed", "westbrook", 5480, 25.0, 21.2, "DK", "Branch opening", "Countered at 23.5%, with customer", "COUNTERED", { by: "MD", when: -9 }),
    E("QT-2833", "closed", "southside", 2980, 28.0, 19.0, "DK", "Competitor match", "DIY chain shelf price, not a trade price", "REJECTED", { by: "MD", when: -11 }),
    E("QT-2836", "closed", "kelleher", 4120, 24.0, 18.4, "MR", "Old cost price", "Priced from last year's cost file; reissued at 24.6%", "REJECTED", { by: "MD", when: -5 })
  ];
  const EXC_REST = "4 more approved inside Michael Doyle's band and 1 more countered.";

  /* FIX-2201: the 37 agreements still on the old EuroFix cost (482 boxes a month) */
  const FIX_CUST = [
    ["murphy", "Contract · Murphy BS 2026", "SB", 21.20, 40],
    ["leinster", "Contract · Leinster national", "MD", 20.40, 64],
    ["core", "Contract · Core FM 2025-27", "MR", 21.60, 38],
    ["westbrook", "Tier A trade", "DK", 21.90, 31],
    ["midland", "Tier A trade", "MR", 21.90, 28],
    ["harbour", "Project · Harbour Point", "SB", 20.80, 26],
    ["doyle", "Project · Hansfield", "SB", 20.60, 24],
    ["obrien", "Tier B + customer prices", "DK", 22.40, 18],
    ["horizon", "Tier B trade", "MR", 22.40, 14]
  ];
  const FIX_REST = { n: 28, units: 199 };

  /* supplier price files this quarter; monthly impact sums to €2,940 */
  const SUP_FILES = [
    { s: "eurofix", what: "Price file, imported today 08:31", lines: 428, avg: 6.8, passed: 0, mo: 1029 },
    { s: "eurocable", what: "Copper surcharge on cable", lines: 46, avg: 11.2, passed: 12, mo: 850 },
    { s: "midland", what: "New price list", lines: 88, avg: 8.4, passed: 30, mo: 540 },
    { s: "kerry", what: "Paper and hygiene increase", lines: 22, avg: 4.8, passed: 6, mo: 298 },
    { s: "atlas", what: "Price change, 11th in 12 months", lines: 64, avg: 6.2, passed: 18, mo: 158 },
    { s: "polska", what: "Helmets and hi-vis", lines: 18, avg: 3.5, passed: 0, mo: 65 }
  ];
  const LIST_EXTRA = { "IC-3144": 15.40 };

  /* product profitability, last 12 months: [sku, units, realised price, 12m avg cost, turn, returns %, margin last 5 months] */
  const PP_RAW = [
    ["FIX-2201", 9650, 21.40, 16.54, 9.8, 0.1, [23.5, 23.3, 23.4, 23.2, 23.4]],
    ["EL-4712", 1480, 80.60, 63.65, 11.9, 0.4, [22.7, 22.5, 22.6, 22.4, 14.8]],
    ["FH-6602", 7280, 15.10, 10.73, 16.6, 0.2, [29.4, 29.3, 29.0, 29.2, 28.8]],
    ["IC-3405", 16640, 6.45, 4.10, 11.1, 0.1, [36.8, 36.2, 36.5, 36.4, 36.1]],
    ["TL-5120", 572, 184.00, 142.00, 9.5, 1.6, [23.4, 23.0, 22.9, 23.1, 22.6]],
    ["EL-4520", 364, 214.00, 168.00, 9.1, 0.5, [22.0, 21.8, 21.9, 21.4, 21.6]],
    ["FIX-2330", 7384, 9.70, 6.90, 6.2, 0.1, [29.4, 29.2, 29.1, 29.0, 28.9]],
    ["IC-3120", 5200, 11.90, 9.13, 7.0, 0.6, [24.4, 24.5, 24.3, 24.4, 17.6]],
    ["EL-4408", 2080, 28.90, 21.40, 14.2, 0.3, [26.4, 26.1, 26.0, 25.9, 26.2]],
    ["FIX-2214", 2496, 15.60, 11.60, 9.0, 0.2, [25.9, 25.7, 25.8, 25.6, 25.5]],
    ["LT-8120", 1300, 25.60, 17.80, 6.0, 1.9, [31.0, 30.8, 30.4, 30.6, 30.5]],
    ["EL-4412", 832, 38.00, 28.08, 7.3, 0.2, [26.3, 26.0, 26.2, 26.1, 26.0]],
    ["AD-7102", 7800, 3.95, 2.35, 3.9, 0.3, [40.8, 40.6, 40.4, 40.5, 40.6]],
    ["IC-3310", 1560, 17.60, 13.51, 18.4, 2.8, [24.1, 23.9, 24.0, 24.0, 19.3]],
    ["FH-6710", 2496, 9.40, 6.40, 14.6, 1.2, [32.2, 31.8, 32.0, 31.9, 31.7]],
    ["EL-4631", 2340, 9.60, 6.80, 12.4, 3.1, [29.6, 29.4, 29.0, 29.3, 29.1]],
    ["SAF-1892", 4264, 3.25, 1.85, 1.9, 0.1, [43.8, 43.5, 43.4, 43.2, 43.0]],
    ["IC-3650", 624, 18.90, 14.20, 1.0, 0.4, [25.2, 25.0, 24.8, 24.9, 24.9]],
    ["TL-5204", 312, 28.70, 18.40, 0.9, 0.3, [36.2, 35.9, 36.0, 35.8, 35.9]],
    ["LT-8305", 52, 49.00, 34.20, 0.2, 0.0, [30.4, 30.1, 30.3, 30.2, 30.2]],
    ["TL-5388", 16, 92.00, 64.00, 0.3, 0.0, [30.6, 30.4, 30.4, 30.3, 30.4]]
  ];
  const invUnits = (p) => p.wh === "DUB" ? p.onHand + (p.naas ? p.naas[0] : 0) : p.onHand + (p.dub ? p.dub[0] : 0);
  const PP = PP_RAW.map((r) => {
    const p = DB.product(r[0]);
    const rev = r[1] * r[2], cost = r[1] * r[3], gp = rev - cost;
    const now = (r[2] - p.cost) / r[2] * 100;
    return { sku: r[0], p, units: r[1], price: r[2], rev, cost, gp, gm: gp / rev * 100, now, gpNow: r[1] * (r[2] - p.cost), inv: invUnits(p) * p.cost, turn: r[4], ret: r[5], trend: r[6].concat([+now.toFixed(1)]) };
  });

  /* ======================================================================
     MARGIN CONTROL
     ====================================================================== */
  function marginControl(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const rev = K.revenueMTD, tgtGP = Math.round(rev * K.gmTarget / 100), actGP = tgtGP - K.gapMonthly;
    const LEAK_GO = { pricing: "Price Lists", discount: "Discount Approvals", cost: "Cost Changes", quotes: "Exceptions", override: "Exceptions" };
    const LEAK_CTA = { pricing: "Reprice lists", discount: "Review discounts", cost: "Review costs", quotes: "Review quotes", override: "Review overrides" };
    const maxLeak = Math.max.apply(null, DB.leakage.map((l) => l.v));

    const leakage = UI.Card({ title: "Margin leakage", icon: "alert", meta: "WHERE THE " + eur(K.gapMonthly) + " GOES · THIS MONTH", delay: 60 }, [
      ...DB.leakage.map((l, i) => h("div", { key: l.id, className: "pd-row click", onClick: () => go(MOD, LEAK_GO[l.id]), style: { display: "grid", gridTemplateColumns: "minmax(0,1.7fr) minmax(70px,.9fr) 76px 84px 124px", gap: 14, padding: "12px 6px" } },
        h("div", { style: { minWidth: 0 } },
          h("div", { style: { fontSize: 13, color: "var(--ink)", fontWeight: 500 } }, l.label),
          h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3 }, title: l.detail }, l.detail),
          h("div", { className: "pd-meta", style: { marginTop: 4 } }, "OWNER " + DB.person(l.owner).toUpperCase())),
        UI.Bar(100 * l.v / maxLeak, i < 2 ? "bad" : "warn", { h: 7 }),
        h("div", { style: { textAlign: "right" } }, mono(eur(l.v), { color: "var(--ink)", fontSize: 13 }), h("div", { className: "pd-meta" }, "A MONTH")),
        h("div", { style: { textAlign: "right" } }, mono(eurK(l.v * 12), { color: "var(--dim)" }), h("div", { className: "pd-meta" }, "A YEAR")),
        UI.Btn(LEAK_CTA[l.id], () => go(MOD, LEAK_GO[l.id]), { sm: true }))),
      gap(12),
      UI.Facts([
        ["Estimated monthly opportunity", eur(sum(DB.leakage.map((l) => l.v))), "bad", "Sum of the five leaks above"],
        ["Annualised", eur(K.gapAnnual), null, "If nothing changes"],
        ["Fixable by repricing", eur(DB.leakage.find((l) => l.id === "pricing").v + DB.leakage.find((l) => l.id === "cost").v), "ok", "Old contracts plus cost pass-through"]
      ], 3)
    ]);

    const recoveryAI = UI.AI({
      who: "Margin Agent", conf: "€18,600 A YEAR · HIGH CONFIDENCE",
      text: ["Most of the 1.2-point gap sits in two places: ", B("Industrial Consumables at 17.6%"), " against a 24% target, and ", B("three customer price agreements"), " that were never updated after the supplier increases. Repricing them recovers ", B("€18,600 a year"), " without touching a tier list. Start with Leinster Retail: the national contract is at 19.8%, under its own 20% floor."],
      actions: [
        UI.Btn("Start repricing review", () => ctx.act("mg-recover", "Repricing review started", "Pack for Michael Doyle: Leinster, O'Brien and Atlantic agreements plus 17 Industrial Consumables lines, €1,550 a month. Price notices drafted, nothing sent."), { pri: true, sm: true, done: ctx.done("mg-recover"), doneLabel: "Review started" }),
        UI.Btn("Where are we losing margin?", () => ctx.ask("Where are we losing margin?"), { sm: true, icon: "spark" })
      ]
    });
    const recovery = UI.Card({ title: "€18,600 recovery, line by line", icon: "tag", meta: "€1,550 A MONTH", delay: 120 }, RECOVERY.map((r) => UI.Row({ onClick: r.k === "cat" ? () => { ctx.set({ pmCat: "Industrial Consumables" }); go(MOD, "Product Profitability"); } : () => ctx.open("customer", r.k) }, [
      h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5, color: "var(--ink)" } }, r.label), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, r.sub)),
      h("div", { style: { textAlign: "right" } }, mono(eur(r.mo * 12), { color: "var(--ok)" }), h("div", { className: "pd-meta" }, eur(r.mo) + " / MO"))])));

    const bridge = UI.Card({ title: "From target to actual", icon: "link", meta: "GROSS PROFIT BRIDGE · MONTH TO DATE", delay: 160 }, UI.HChain([
      { k: "Target 25.0%", t: eur(tgtGP) + " GP", d: "On " + eur(rev) + " revenue" },
      { k: "Outdated pricing", t: "−" + eur(4820), d: "42 contracts not repriced", tone: "bad", onClick: () => go(MOD, "Price Lists") },
      { k: "Discounting", t: "−" + eur(3260), d: "118 lines above band", tone: "bad", onClick: () => go(MOD, "Discount Approvals") },
      { k: "Cost increases", t: "−" + eur(2940), d: "Not passed through", tone: "warn", onClick: () => go(MOD, "Cost Changes") },
      { k: "Low margin quotes", t: "−" + eur(1460), d: "Converted below floor", tone: "warn", onClick: () => go(MOD, "Exceptions") },
      { k: "Overrides", t: "−" + eur(528), d: "9 with no reason code", tone: "warn", onClick: () => go(MOD, "Exceptions") },
      { k: "Actual 23.8%", t: eur(actGP) + " GP", d: eur(K.gapMonthly) + " short of target", tone: "info" }
    ]));

    // 12-month trend (same series as the executive dashboard)
    const revK = [1236, 1301, 1048, 1152, 1224, 1338, 1352, 1396, 1371, 1322, 1246, 1085];
    const gm = [24.6, 24.9, 25.2, 24.8, 24.7, 24.9, 25.1, 24.6, 24.4, 24.1, 24.0, 23.8];
    const short = revK.map((r, i) => i === 11 ? K.gapMonthly : Math.round(r * 1000 * (25 - gm[i]) / 100));
    const last3 = short[9] + short[10] + short[11];
    const labels = months(12);
    const trend = UI.Card({ title: "Margin, last 12 months", icon: "spark", meta: "TARGET 25.0%", delay: 200 }, [
      UI.Lines(labels, [{ name: "Gross margin", values: gm, color: "var(--accent)", area: true }], { h: 170, min: 23.2, max: 25.6, hline: 25, marks: [{ i: 8, label: "SUPPLIER INCREASES", tone: "warn" }] }),
      gap(12),
      UI.Facts([
        ["Peak", "25.2%", null, labels[2]],
        ["Now", "23.8%", "warn", "Falling every month since " + labels[6]],
        ["GP lost, last 3 months", eur(last3), "bad", "Against a 25% target"],
        ["Revenue this month", "+8.4%", "ok", "Selling more, keeping less"]
      ], 4)
    ]);

    // category margin vs target
    const cats = DB.categories.map((c) => Object.assign({}, c, { gp: c.rev * c.gm / 100, gapE: c.rev * (c.target - c.gm) / 100 })).sort((a, b) => b.gapE - a.gapE);
    const icCat = cats.find((c) => c.id === "Industrial Consumables");
    const byCat = UI.Card({ title: "Margin by category", icon: "box", meta: "MTD · TICK IS THE CATEGORY TARGET", delay: 240 }, [
      ...cats.map((c) => h("div", { key: c.id, className: "pd-row click", onClick: () => { ctx.set({ pmCat: c.id }); go(MOD, "Product Profitability"); }, style: { display: "grid", gridTemplateColumns: "minmax(120px,1.2fr) minmax(80px,1.4fr) 50px 76px", gap: 12, padding: "9px 6px", background: c.id === "Industrial Consumables" ? "var(--bad-soft)" : undefined, borderRadius: c.id === "Industrial Consumables" ? 10 : undefined } },
        h("div", { style: { minWidth: 0 } }, h("div", { className: "pd-ell", style: { fontSize: 12.5, color: "var(--ink)" } }, c.id), h("div", { className: "pd-meta", style: { marginTop: 2 } }, eurK(c.rev) + " · TARGET " + p1(c.target))),
        MVT(c.gm, c.target, { max: 32 }),
        h("div", { style: { textAlign: "right" } }, mono(p1(c.gm), { color: fg(mTone(c.gm, c.target)) })),
        h("div", { style: { textAlign: "right" } }, mono(c.gapE > 0 ? "−" + eur(Math.round(c.gapE)) : "+" + eur(Math.round(-c.gapE)), { color: c.gapE > 0 ? "var(--bad)" : "var(--ok)", fontSize: 11.5 })))),
      UI.Note("Industrial Consumables is " + Math.round(100 * icCat.rev / K.revenueMTD) + "% of revenue and " + Math.round(100 * icCat.gapE / sum(cats.filter((c) => c.gapE > 0).map((c) => c.gapE))) + "% of the shortfall against category targets: cutting discs and cable ties went up last month and the selling prices did not.", { marginTop: 10 })
    ]);

    // account managers
    const amTable = UI.Card({ flush: true, title: "Margin by account manager", meta: "MONTH TO DATE · CLICK FOR DISCOUNT DETAIL", delay: 280 }, UI.Table({
      rows: AMS, rowKey: (a) => a.k, onRow: () => go(MOD, "Discount Approvals"), rowTone: (a) => a.gm < 22.5 ? "bad" : a.gm < 25 ? "warn" : null,
      cols: [
        { label: "Account manager", w: "minmax(170px,1.4fr)", ink: true, render: (a) => h("div", null, h("div", null, a.k === "HOUSE" ? "House accounts" : DB.person(a.k)), a.note ? h("div", { className: "pd-meta", style: { marginTop: 2 } }, a.note.toUpperCase()) : null) },
        { label: "Revenue", w: "92px", r: true, num: true, ink: true, render: (a) => eur(a.rev) },
        { label: "Gross profit", w: "92px", r: true, num: true, render: (a) => eur(Math.round(a.rev * a.gm / 100)) },
        { label: "Margin", w: "minmax(110px,1fr)", render: (a) => h("div", { className: "pd-split", style: { gap: 8 } }, MVT(a.gm, 25, { max: 32, h: 6 }), mono(p1(a.gm), { color: fg(mTone(a.gm, 25)), fontSize: 11.5 })) },
        { label: "Vs target", w: "78px", r: true, num: true, render: (a) => h("span", { style: { color: a.gm < 25 ? "var(--bad)" : "var(--ok)" } }, pts(a.gm - 25)) },
        { label: "Above band", w: "104px", r: true, num: true, render: (a) => h("span", null, eur(a.above), h("span", { className: "pd-faint" }, " · " + a.lines)) },
        { label: "Waiting", w: "70px", r: true, num: true, render: (a) => a.pend ? h("span", { style: { color: "var(--warn)" } }, String(a.pend)) : none() },
        { label: "Thinnest account", w: "minmax(150px,1.2fr)", render: (a) => a.low ? L.cust(a.low) : none() }
      ],
      foot: "David Kelly gives the most away and wins the fewest quotes. Michael Doyle's national accounts run under 21% by contract."
    }));

    // low margin in the open book
    const lowOrders = DB.orders.filter((o) => o.margin < 22.5).map((o) => ({ kind: "order", id: o.id, cust: o.cust, value: o.value, m: o.margin, t: o.cust === "leinster" ? 22 : 24, what: o.status }));
    const lowQuotes = DB.lowMarginQuotes.map((q) => ({ kind: "quote", id: q.id, cust: q.cust, value: q.value, m: q.margin, t: q.target, what: q.status }));
    const book = lowOrders.concat(lowQuotes).sort((a, b) => a.m - b.m);
    const openBook = UI.Card({ title: "Below target in the open book", icon: "doc", meta: lowOrders.length + " ORDERS · " + lowQuotes.length + " QUOTES", delay: 320 }, book.map((b) => UI.Row({ onClick: () => ctx.open(b.kind, b.id) }, [
      UI.Badge(b.kind === "order" ? "SO" : "QT", b.kind === "order" ? "neutral" : "info", true),
      h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.custName(b.cust), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, b.id)), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, eur(b.value) + " · " + b.what)),
      h("div", { style: { textAlign: "right" } }, mono(p1(b.m), { color: fg(mTone(b.m, b.t)) }), h("div", { className: "pd-meta" }, pts(b.m - b.t)))])));

    return UI.Page({
      kicker: "Pricing & Margin · margin control", live: "SAGE 200 · PRICE FILES · ORDER ENTRY",
      title: "Margin is 23.8% against a 25.0% target",
      sub: "Revenue is up, gross profit is not keeping pace. Pulse traces the " + eur(K.gapMonthly) + " shortfall to the price lists, discounts, cost increases and overrides that caused it, and to the person who can fix each one.",
      actions: [UI.Btn("Where are we losing margin?", () => ctx.ask("Where are we losing margin?"), { icon: "spark" }), UI.Btn("Exceptions", () => go(MOD, "Exceptions"), { pri: true, icon: "alert" })],
      children: [
        UI.Kpis([
          { label: "Revenue MTD", value: eur(K.revenueMTD), sub: K.revenueDelta, subTone: "ok", onClick: () => go("Finance", "Revenue") },
          { label: "Gross profit", value: eurK(K.gp), sub: "Month to date" },
          { label: "Gross margin", value: p1(K.gm), sub: "Down from 25.2% in " + labels[2], tone: "warn", toneValue: true },
          { label: "Target", value: p1(K.gmTarget), sub: eur(tgtGP) + " GP at target" },
          { label: "Gap this month", value: eur(K.gapMonthly), sub: "5 causes, all fixable", tone: "bad", toneValue: true },
          { label: "Annualised", value: eur(K.gapAnnual), sub: "€18,600 recoverable now", subTone: "ok" }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [leakage, h("div", null, recoveryAI, gap(), recovery)]),
        bridge,
        gap(),
        UI.Grid("minmax(0,1.15fr) minmax(0,1fr)", [trend, byCat]),
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [amTable, openBook])
      ]
    });
  }

  /* ======================================================================
     PRICE LISTS
     ====================================================================== */
  function priceLists(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const totRev = sum(TYPES.map((t) => t.rev));
    const neg = TYPES.slice(2), negRev = sum(neg.map((t) => t.rev)), negGp = sum(neg.map((t) => t.rev * t.gm / 100));
    const shr = (v) => Math.round(100 * v / totRev) + "%";
    const belowRows = BELOW.map((b) => { const c = DB.customer(b.c); return Object.assign({}, b, { cust: c, gm: c.gm, gapPts: c.gm - b.req, gpYtd: Math.round(c.ytd * (b.req - c.gm) / 100) }); });
    const belowGp = sum(belowRows.map((b) => b.gpYtd)) + BELOW_REST.gp;

    const types = UI.Card({ flush: true, title: "How customers are priced", meta: "SIX PRICING TYPES · REVENUE MONTH TO DATE", delay: 60 }, UI.Table({
      rows: TYPES, rowKey: (t) => t.t, rowTone: (t) => t.gm < 22 ? "bad" : null,
      cols: [
        { label: "Pricing type", w: "minmax(150px,1.1fr)", ink: true, render: (t) => h("div", null, h("div", null, t.t), h("div", { className: "pd-ell", style: { fontSize: 11, color: "var(--dim)", marginTop: 2 } }, t.how)) },
        { label: "Coverage", w: "minmax(170px,1.2fr)", render: (t) => h("span", { className: "pd-dim" }, t.cov) },
        { label: "Revenue", w: "90px", r: true, num: true, ink: true, render: (t) => eur(t.rev) },
        { label: "Share", w: "58px", r: true, num: true, render: (t) => Math.round(100 * t.rev / totRev) + "%" },
        { label: "Margin", w: "minmax(120px,1fr)", render: (t) => h("div", { className: "pd-split", style: { gap: 8 } }, MVT(t.gm, 25, { max: 34, h: 6 }), mono(p1(t.gm), { color: fg(mTone(t.gm, 25)), fontSize: 11.5 })) },
        { label: "What needs attention", w: "minmax(230px,1.7fr)", render: (t) => h("span", { style: { color: fg(t.tone) } }, t.watch) }
      ],
      foot: "Contract, customer-specific, promotional and override pricing carry " + Math.round(100 * negRev / totRev) + "% of revenue at " + p1(100 * negGp / negRev) + ". Standard and tier pricing carry the rest at " + p1(100 * (sum(TYPES.map((t) => t.rev * t.gm / 100)) - negGp) / (totRev - negRev)) + "."
    }));

    const chain = UI.Card({ title: "Where the last cost increase stopped", icon: "link", meta: "SUPPLIER FILE → SELLING PRICE", delay: 100 }, [
      UI.HChain([
        { k: "Supplier cost files", t: "666 lines this quarter", d: "EuroFix file today 08:31", tone: "ok", onClick: () => go(MOD, "Cost Changes") },
        { k: "Product cost", t: "Updated in Sage 200", d: "Automatic, same minute", tone: "ok" },
        { k: "List price", t: "214 SKUs not moved", d: "Standard price list", tone: "warn" },
        { k: "Tier A, B, C", t: "186 SKUs on old margin", d: "Tier lists follow list", tone: "warn" },
        { k: "58 contracts", t: "42 not repriced", d: "€4,820 a month", tone: "bad" },
        { k: "Customer prices", t: "412 lines under cost + 15%", d: "Across 118 accounts", tone: "bad" },
        { k: "Quotes and orders", t: "Priced off stale lists", d: "QT-2841 among them", tone: "bad", onClick: () => ctx.open("quote", "QT-2841") }
      ]),
      UI.Note("Costs move the day the supplier file lands. Selling prices only move when someone remembers to reprice the list, then every tier, contract and net price underneath it.", { marginTop: 12 })
    ]);

    const below = UI.Card({ flush: true, title: "Customers buying below their required margin", meta: (belowRows.length + BELOW_REST.n) + " ACCOUNTS · " + eur(belowGp) + " GP SHORT YTD", delay: 140 }, UI.Table({
      rows: belowRows, rowKey: (b) => b.c, onRow: (b) => ctx.open("customer", b.c), rowTone: (b) => b.floor && b.gm < b.floor ? "bad" : b.gapPts < -2 ? "bad" : "warn",
      cols: [
        { label: "Customer", w: "minmax(170px,1.3fr)", ink: true, render: (b) => h("div", null, L.cust(b.c), h("div", { className: "pd-meta", style: { marginTop: 2 } }, DB.person(b.cust.am).toUpperCase())) },
        { label: "Price basis", w: "minmax(150px,1.1fr)", render: (b) => b.list },
        { label: "Revenue YTD", w: "96px", r: true, num: true, render: (b) => eur(b.cust.ytd) },
        { label: "Margin", w: "66px", r: true, num: true, render: (b) => marginCell(b.gm, b.req) },
        { label: "Required", w: "72px", r: true, num: true, render: (b) => p1(b.req) },
        { label: "Gap", w: "74px", r: true, num: true, render: (b) => h("span", { style: { color: "var(--bad)" } }, pts(b.gapPts)) },
        { label: "GP short YTD", w: "92px", r: true, num: true, ink: true, render: (b) => eur(b.gpYtd) },
        { label: "Last repriced", w: "minmax(120px,.9fr)", render: (b) => b.last },
        { label: "Why", w: "minmax(220px,1.6fr)", render: (b) => h("span", { title: b.note, style: { color: b.floor && b.gm < b.floor ? "var(--bad)" : "var(--dim)" } }, b.note) },
        { label: "Recovery", w: "92px", r: true, num: true, render: (b) => b.rec ? h("span", { style: { color: "var(--ok)" } }, eur(b.rec) + "/yr") : none() }
      ],
      foot: BELOW_REST.n + " smaller accounts are short a further " + eur(BELOW_REST.gp) + " YTD. Recovery figures are the €18,600 the Margin Agent can reprice now; the rest needs a contract conversation."
    }));

    const reprice = UI.Card({ flush: true, title: "Contract price lists due for repricing", meta: "42 NOT REPRICED SINCE SUPPLIER INCREASES · €4,820 A MONTH", delay: 180 }, UI.Table({
      rows: REPRICE, rowKey: (r) => r.c, onRow: (r) => ctx.open("customer", r.c), rowTone: (r) => r.mo >= 300 ? "bad" : null,
      cols: [
        { label: "Price list", w: "minmax(170px,1.3fr)", ink: true, render: (r) => h("div", null, h("div", null, r.list), h("div", { style: { fontSize: 11.5, marginTop: 2 } }, L.cust(r.c))) },
        { label: "Owner", w: "minmax(110px,.9fr)", render: (r) => DB.person(r.am) },
        { label: "Lines", w: "64px", r: true, num: true, render: (r) => num(r.lines) },
        { label: "Hit by increases", w: "110px", r: true, num: true, render: (r) => h("span", { style: { color: "var(--warn)" } }, num(r.hit)) },
        { label: "Last repriced", w: "104px", render: (r) => r.last },
        { label: "Terms", w: "minmax(180px,1.3fr)", render: (r) => h("span", { className: "pd-dim" }, r.clause) },
        { label: "Leaking", w: "86px", r: true, num: true, ink: true, render: (r) => eur(r.mo) + "/mo" },
        { label: "", w: "130px", render: (r) => UI.Btn("Draft reprice", () => ctx.act("reprice-" + r.c, "Reprice drafted", r.list + ": " + r.hit + " lines moved to today's cost plus the agreed margin. " + DB.person(r.am) + " to review before the notice goes out."), { sm: true, done: ctx.done("reprice-" + r.c), doneLabel: "Drafted" }) }
      ],
      foot: REPRICE_REST.n + " more contracts leak " + eur(REPRICE_REST.mo) + " a month between them. Total €4,820."
    }));

    const ai = UI.AI({
      who: "Margin Agent", conf: "3 AGREEMENTS · €11,160 A YEAR",
      text: ["Leinster Retail, O'Brien Facilities and Atlantic FM were all priced before the EuroFix, Midland and Atlas increases and have not been touched since. Repricing only the lines those suppliers moved recovers ", B("€11,160 a year"), " and keeps every other price the customer knows. With the Industrial Consumables lines, that is the ", B("€18,600"), " in this morning's briefing."],
      actions: [
        UI.Btn("Draft all three", () => ctx.act("mg-recover", "Repricing review started", "Leinster, O'Brien and Atlantic repricing drafted for Michael Doyle, with 30-day notice letters. Nothing sent."), { pri: true, sm: true, done: ctx.done("mg-recover"), doneLabel: "Drafted" }),
        UI.Btn("Open Leinster Retail", () => ctx.open("customer", "leinster"), { sm: true })
      ]
    });

    const PROMOS = [
      { n: "PPE clearance · safety glasses 20% off", sku: "SAF-1892", funded: "Clearance", ends: 12, m: 32.0, note: "Clearing 22 weeks of cover in Naas", tone: "ok" },
      { n: "Nitrile gloves, 3 boxes for 2", sku: "IC-3405", funded: "SafePro funds 50%", ends: 3, m: 24.1, note: "Margin protected by supplier funding", tone: "ok" },
      { n: "Cutting disc 10-pack deal, 10% off", sku: "IC-3120", funded: "Not funded", ends: 9, m: 8.5, note: "Midland raised the cost 8.9% after this was set up", tone: "bad" },
      { n: "Silicone and foam gun bundle", sku: "AD-7340", funded: "Clearance", ends: 20, m: 22.8, note: "Moving 95 weeks of foam gun stock", tone: "ok" }
    ];
    const promos = UI.Card({ title: "Promotions running", icon: "tag", meta: "6 LIVE · 2 NOT FUNDED", delay: 220 }, PROMOS.map((p) => UI.Row({ onClick: () => ctx.open("product", p.sku) }, [
      h("div", { className: "pd-grow" },
        h("div", { style: { fontSize: 12.5, color: "var(--ink)" } }, p.n),
        h("div", { style: { fontSize: 11.5, color: p.tone === "bad" ? "var(--bad)" : "var(--dim)", marginTop: 2 } }, p.sku + " · " + p.funded + " · " + p.note)),
      h("div", { style: { textAlign: "right" } }, mono(p1(p.m), { color: p.m < 15 ? "var(--bad)" : "var(--body)" }), h("div", { className: "pd-meta" }, "ENDS " + rel(D(p.ends)).toUpperCase()))])));

    return UI.Page({
      kicker: "Pricing & Margin · price lists", title: "68 price lists, 42 of them out of date",
      sub: "Standard, tier, contract, customer-specific, promotional and override pricing in one place, with the accounts buying below the margin they should and the agreements nobody has repriced since the suppliers moved.",
      actions: [UI.Btn("Cost changes", () => go(MOD, "Cost Changes"), { icon: "euro" }), UI.Btn("Margin control", () => go(MOD, "Margin Control"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Price lists live", value: "68", sub: "1 standard · 3 tier · 58 contract · 6 promotions" },
          { label: "Customer-specific prices", value: "1,946", sub: "Lines across 118 accounts" },
          { label: "Contracts not repriced", value: "42 of 58", sub: "€4,820 a month leaking", tone: "bad", toneValue: true },
          { label: "Accounts below required margin", value: String(belowRows.length + BELOW_REST.n), sub: eur(belowGp) + " GP short YTD", tone: "warn" },
          { label: "Overrides this month", value: "63", sub: "9 with no reason code", subTone: "bad", onClick: () => go(MOD, "Exceptions") }
        ]),
        UI.Grid("minmax(0,1.9fr) minmax(0,1fr)", [types, h("div", null,
          UI.Card({ title: "Revenue by pricing type", icon: "euro", meta: "MTD · " + eur(totRev), delay: 80 }, [
            UI.Split([
              { label: "Standard", v: TYPES[0].rev, color: "var(--ok)", d: shr(TYPES[0].rev) },
              { label: "Tier", v: TYPES[1].rev, color: "var(--accent)", d: shr(TYPES[1].rev) },
              { label: "Contract", v: TYPES[2].rev, color: "var(--warn)", d: shr(TYPES[2].rev) },
              { label: "Specific, promo, override", v: TYPES[3].rev + TYPES[4].rev + TYPES[5].rev, color: "var(--bad)", d: shr(TYPES[3].rev + TYPES[4].rev + TYPES[5].rev) }
            ]),
            UI.Note("Revenue that moves from tier to contract pricing gives up " + (TYPES[1].gm - TYPES[2].gm).toFixed(1) + " points of margin on the way.", { marginTop: 12 })
          ]),
          gap(),
          ai)]),
        chain,
        gap(),
        below,
        gap(),
        UI.Grid("minmax(0,2fr) minmax(0,1fr)", [reprice, promos])
      ]
    });
  }

  /* ======================================================================
     EXCEPTIONS
     ====================================================================== */
  const liveStatus = (ctx, e) => {
    if (e.status !== "PENDING") return e.status;
    if (ctx.done(e.key || "appr-" + e.id)) return "APPROVED";
    if (ctx.done("counter-" + e.id) || ctx.done("fixprice-" + e.id) || (e.id === "QT-2841" && ctx.done("dq-obrien"))) return "COUNTERED";
    if (ctx.done("rej-" + e.id)) return "REJECTED";
    return "PENDING";
  };
  const ST_TONE = { PENDING: "warn", APPROVED: "ok", COUNTERED: "info", REJECTED: "bad" };
  const openExc = (ctx, e) => {
    if (e.kind === "quote" && DB.quote(e.id)) return ctx.open("quote", e.id);
    if (e.kind === "order" && DB.order(e.id)) return ctx.open("order", e.id);
    return ctx.open("customer", e.cust);
  };
  const excId = (e) => (e.kind === "quote" && DB.quote(e.id)) || (e.kind === "order" && DB.order(e.id))
    ? mono(e.id, { color: "var(--ink)" })
    : h("span", { title: e.kind === "closed" ? "Closed quote, opens the account" : "New order, opens the account" }, mono(e.id, { color: "var(--dim)" }));

  function exceptions(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const rows = EXC.map((e) => Object.assign({}, e, { live: liveStatus(ctx, e), diff: e.prop - e.std }));
    const f = ctx.st.pmExc || "all";
    const cnt = (s) => rows.filter((r) => r.live === s).length;
    const shown = rows.filter((r) => f === "all" || r.live === f);
    const pend = rows.filter((r) => r.live === "PENDING");
    const pendVal = sum(pend.map((r) => r.value));
    const pendGp = Math.round(sum(pend.map((r) => r.value * (r.std - r.prop) / 100)));
    const yearGp = Math.round(sum(DB.lowMarginQuotes.map((q) => q.annual * (q.target - q.margin) / 100)));

    const table = UI.Card({ flush: true, title: shown.length + " exceptions · " + eur(sum(shown.map((r) => r.value))), meta: "LAST 30 DAYS · CLICK A ROW FOR THE QUOTE OR ORDER", delay: 60 }, UI.Table({
      rows: shown, rowKey: (e) => e.id, onRow: (e) => openExc(ctx, e), sel: (e) => e.id === "QT-2841" && e.live === "PENDING",
      rowTone: (e) => e.live === "PENDING" && e.diff <= -4 ? "bad" : e.live === "PENDING" ? "warn" : null,
      cols: [
        { label: "Customer", w: "minmax(170px,1.3fr)", ink: true, render: (e) => L.cust(e.cust) },
        { label: "Order / Quote", w: "100px", render: (e) => excId(e) },
        { label: "Revenue", w: "86px", r: true, num: true, ink: true, render: (e) => eur(e.value) },
        { label: "Standard margin", w: "84px", r: true, num: true, render: (e) => p1(e.std) },
        { label: "Proposed margin", w: "84px", r: true, num: true, render: (e) => marginCell(e.prop, e.std) },
        { label: "Difference", w: "86px", r: true, num: true, render: (e) => h("span", { style: { color: e.diff <= -4 ? "var(--bad)" : "var(--warn)" } }, pts(e.diff)) },
        { label: "Sales rep", w: "minmax(104px,.8fr)", render: (e) => DB.person(e.am) },
        { label: "Reason", w: "minmax(200px,1.7fr)", render: (e) => h("span", { title: e.detail }, h("span", { style: { color: "var(--ink)" } }, e.reason), h("span", { className: "pd-faint" }, " · " + e.detail)) },
        { label: "Approval", w: "150px", render: (e) => h("div", null, UI.Badge(e.live, ST_TONE[e.live], true),
          h("div", { className: "pd-meta", style: { marginTop: 3 } }, e.live === "PENDING" ? (DB.person(e.approver).split(" ")[0] + " · " + e.due).toUpperCase() : e.status === "PENDING" ? "JUST NOW" : (e.by === "AUTO" ? "BY RULE" : DB.person(e.by).split(" ")[0].toUpperCase()) + " · " + (e.when === 0 ? "TODAY" : dm(D(e.when)).toUpperCase()))) }
      ],
      empty: "Nothing in this view.",
      foot: f === "all" ? "Showing " + shown.length + " of 23 raised in the last 30 days. " + EXC_REST : null
    }));

    const reasons = UI.Card({ title: "Why reps asked", icon: "doc", meta: "23 EXCEPTIONS", delay: 100 }, UI.HBars([
      { label: "Competitor match", v: 7, d: "7", tone: "bad" }, { label: "Strategic or contract", v: 5, d: "5" }, { label: "Volume or project", v: 4, d: "4" },
      { label: "Old cost or price file", v: 4, d: "4", tone: "warn" }, { label: "No reason code", v: 3, d: "3", tone: "warn" }], { tpl: "minmax(120px,1.2fr) 1fr 34px", colorValue: true }));
    const byRep = UI.Card({ title: "Who asked", icon: "user", meta: "RAISED · WAITING", delay: 140 }, UI.HBars([
      { label: "David Kelly", v: 9, d: "9 · 4", tone: "bad", onClick: () => go(MOD, "Discount Approvals") }, { label: "Mark Ryan", v: 6, d: "6 · 4" },
      { label: "Sarah Byrne", v: 5, d: "5 · 1" }, { label: "Michael Doyle", v: 3, d: "3 · 1", sub: "national" }], { tpl: "minmax(110px,1fr) 1fr 50px" }));
    const ai = UI.AI({
      who: "Margin Agent", conf: "PATTERN",
      text: ["Seven of the 23 are competitor matches and none has the competing quote attached. Four more are ", B("old cost prices"), ": the rep priced from last month's file after the supplier moved. Requiring the competitor's quote for any match over 3 points, and blocking order entry below today's cost plus 10%, would have stopped 9 of these before they reached Michael."],
      note: "Rejections have a cost too. QT-2798, a price match on M10 bolts for Ryan Trade Supplies, was turned down six weeks ago. Ryan has not bought M10 bolts since: about €2,840 a month.",
      actions: [
        UI.Btn("Require competitor evidence", () => ctx.act("mg-rule-evidence", "Rule proposed", "Competitor matches over 3 points need the competing quote attached. Sent to Michael Doyle to switch on."), { pri: true, sm: true, done: ctx.done("mg-rule-evidence"), doneLabel: "Proposed" }),
        UI.Btn("Open Ryan Trade", () => ctx.open("customer", "ryan"), { sm: true })
      ]
    });

    return UI.Page({
      kicker: "Pricing & Margin · exceptions", title: pend.length + " prices waiting for a yes",
      sub: "Every quote and order priced under its standard margin, who priced it, why, and who has to approve it. Approved, countered and rejected ones stay here so the pattern is visible.",
      actions: [UI.Btn("Approval queue", () => go(MOD, "Discount Approvals"), { pri: true }), UI.Btn("Ask why", () => ctx.ask("Where are we losing margin?"), { icon: "spark", ghost: true })],
      children: [
        UI.Kpis([
          { label: "Waiting for approval", value: String(pend.length), sub: eur(pendVal) + " of revenue", tone: pend.length ? "warn" : "ok", onClick: () => ctx.set({ pmExc: "PENDING" }) },
          { label: "GP given up if approved", value: eur(pendGp), sub: "On these documents alone", tone: "bad", toneValue: true },
          { label: "GP at stake, 12 months", value: eur(yearGp), sub: "4 low-margin quotes as priced", onClick: () => ctx.open("quote", "QT-2841") },
          { label: "Raised in 30 days", value: "23", sub: "8 approved · 3 countered · 2 rejected" },
          { label: "Conceded on approvals", value: "€1,311", sub: "This month, below standard", onClick: () => go(MOD, "Discount Approvals") }
        ]),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } },
          UI.Chips([["all", "All", rows.length], ["PENDING", "Pending", cnt("PENDING")], ["APPROVED", "Approved", cnt("APPROVED")], ["COUNTERED", "Countered", cnt("COUNTERED")], ["REJECTED", "Rejected", cnt("REJECTED")]], f, (v) => ctx.set({ pmExc: v })),
          h("div", { style: { flex: 1 } }),
          h("span", { className: "pd-note" }, "Standard margin is the customer's price-list target; national contracts use 22% with a 20% floor.")),
        table,
        gap(),
        UI.Grid("minmax(0,1fr) minmax(0,1fr) minmax(0,1.3fr)", [reasons, byRep, ai])
      ]
    });
  }

  /* ======================================================================
     COST CHANGES
     ====================================================================== */
  function costChanges(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const fx = DB.costChanges.find((c) => c.sku === "FIX-2201");
    const up = fx.now - fx.old;
    const totMo = sum(SUP_FILES.map((s) => s.mo));
    const lines = sum(SUP_FILES.map((s) => s.lines)), passed = sum(SUP_FILES.map((s) => s.passed));
    const agreements = sum(DB.costChanges.map((c) => c.customers));
    const listOf = (sku) => (DB.product(sku) ? DB.product(sku).price : LIST_EXTRA[sku]);
    const reviewed = ctx.done("cost-FIX-2201");

    const spotlight = UI.Card({ tint: true, title: "Cost change watch · " + fx.sku + " " + fx.name, icon: "alert", meta: "BIGGEST SINGLE LEAK · EUROFIX FILE 08:31", delay: 60 }, [
      UI.Facts([
        ["Supplier", DB.supplier(fx.supplier).name], ["Product", "M10 Hex Bolt Box"], ["Previous cost", eur(fx.old, 2)], ["New cost", eur(fx.now, 2), "warn"],
        ["Increase", "+" + p1(fx.pct), "bad", "+" + eur(up, 2) + " a box"], ["Customers still on old pricing", String(fx.customers), "bad", "Murphy still pays €21.20"], ["Monthly volume", num(fx.volume) + " boxes", null, "At the old prices"], ["Margin impact", eur(fx.impact) + "/month", "bad", eur(fx.impact * 12) + " a year"]
      ], 4),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 14 } },
        UI.Btn("Review affected pricing", () => ctx.act("cost-FIX-2201", "Pricing review opened", "37 agreements on FIX-2201 moved to +€1.70 a box in draft. Sarah Byrne 14, David Kelly 12, Mark Ryan 9, Michael Doyle 2. Notices go out when each owner approves."), { pri: true, done: reviewed, doneLabel: "Review opened" }),
        UI.Btn("Open FIX-2201", () => ctx.open("product", "FIX-2201"), { sm: true }),
        UI.Btn("Open EuroFix", () => ctx.open("supplier", "eurofix"), { sm: true, ghost: true }),
        h("span", { className: "pd-note", style: { marginLeft: 6 } }, "Passing +€1.70 through keeps each customer's cash margin per box where it was. Murphy goes to €22.90, still list price.")),
      h("div", { style: { marginTop: 16 } }, UI.HChain([
        { k: "Supplier price increase", t: "EuroFix +" + p1(fx.pct), d: "Price file 08:31 · 428 changes", tone: "bad", onClick: () => ctx.open("supplier", "eurofix") },
        { k: "Product cost", t: eur(fx.old, 2) + " → " + eur(fx.now, 2), d: "Sage 200 updated; list still €22.90", tone: "warn", onClick: () => ctx.open("product", "FIX-2201") },
        { k: "Inventory", t: "896 boxes on hand", d: "500 more on PO-8829 today, at the new cost", onClick: () => ctx.open("po", "PO-8829") },
        { k: "Customer price lists", t: "37 agreements on old pricing", d: "Murphy €21.20 · Leinster €20.40", tone: reviewed ? "ok" : "bad", onClick: () => ctx.open("customer", "murphy") },
        { k: "Quotes", t: "3 open quotes include it", d: "QT-2841 · QT-2859 · QT-2844", tone: "warn", onClick: () => ctx.open("quote", "QT-2841") },
        { k: "Open orders", t: "11 orders", d: "SO-10482: 40 boxes at 14.6%", onClick: () => ctx.open("order", "SO-10482") },
        { k: "Margin", t: "−" + eur(fx.impact) + " a month", d: num(fx.volume) + " × " + eur(up, 2), tone: "bad", onClick: () => go(MOD, "Margin Control") },
        { k: "Account managers", t: "4 people to act", d: "Sarah 14 · David 12 · Mark 9 · Michael 2", tone: reviewed ? "ok" : null, onClick: () => go(MOD, "Discount Approvals") }
      ]))
    ]);

    const watch = UI.Card({ flush: true, title: "Cost increases not yet in our selling prices", meta: "7 SKUS · " + eur(sum(DB.costChanges.map((c) => c.impact))) + " A MONTH · CLICK A ROW FOR THE SKU", delay: 100 }, UI.Table({
      rows: DB.costChanges, rowKey: (c) => c.sku, onRow: (c) => DB.product(c.sku) ? ctx.open("product", c.sku) : ctx.open("supplier", c.supplier),
      sel: (c) => c.sku === "FIX-2201", rowTone: (c) => c.impact >= 500 ? "bad" : c.impact >= 250 ? "warn" : null,
      cols: [
        { label: "Supplier", w: "minmax(140px,1.1fr)", render: (c) => L.sup(c.supplier) },
        { label: "SKU", w: "82px", render: (c) => mono(c.sku, { color: "var(--ink)", fontSize: 11.5 }) },
        { label: "Product", w: "minmax(180px,1.5fr)", ink: true, render: (c) => c.name },
        { label: "Previous", w: "74px", r: true, num: true, render: (c) => eur(c.old, 2) },
        { label: "New cost", w: "74px", r: true, num: true, ink: true, render: (c) => eur(c.now, 2) },
        { label: "Increase", w: "70px", r: true, num: true, render: (c) => h("span", { style: { color: c.pct >= 8 ? "var(--bad)" : "var(--warn)" } }, "+" + p1(c.pct)) },
        { label: "List margin", w: "108px", r: true, num: true, render: (c) => { const lp = listOf(c.sku); if (!lp) return none(); const was = (lp - c.old) / lp * 100, now = (lp - c.now) / lp * 100; return h("span", null, h("span", { className: "pd-faint" }, p1(was) + " → "), h("span", { style: { color: now < 20 ? "var(--bad)" : "var(--body)" } }, p1(now))); } },
        { label: "Customers", w: "74px", r: true, num: true, render: (c) => c.customers },
        { label: "Vol / month", w: "82px", r: true, num: true, render: (c) => num(c.volume) },
        { label: "Impact", w: "82px", r: true, num: true, ink: true, render: (c) => eur(c.impact) + "/mo" },
        { label: "Since", w: "minmax(100px,.8fr)", render: (c) => h("span", { className: "pd-dim" }, c.since) },
        { label: "", w: "118px", render: (c) => UI.Btn("Review", () => ctx.act("cost-" + c.sku, "Pricing review opened", c.sku + ": " + c.customers + " customers moved to +" + eur(c.now - c.old, 2) + " in draft for their account managers."), { sm: true, done: ctx.done("cost-" + c.sku), doneLabel: "In review" }) }
      ],
      foot: "Another " + num(lines - passed - 7) + " changed lines leak " + eur(totMo - sum(DB.costChanges.map((c) => c.impact))) + " a month between them. Total " + eur(totMo) + " a month, " + eur(totMo * 12) + " a year."
    }));

    const files = UI.Card({ flush: true, title: "Supplier price files", meta: "THIS QUARTER · " + num(lines) + " CHANGES · " + passed + " PASSED THROUGH", delay: 140 }, UI.Table({
      rows: SUP_FILES, rowKey: (s) => s.s, onRow: (s) => ctx.open("supplier", s.s),
      cols: [
        { label: "Supplier", w: "minmax(150px,1.3fr)", ink: true, render: (s) => h("div", null, h("div", null, DB.supplier(s.s).name), h("div", { className: "pd-ell", style: { fontSize: 11, color: "var(--dim)", marginTop: 2 } }, s.what)) },
        { label: "Lines", w: "58px", r: true, num: true, render: (s) => num(s.lines) },
        { label: "Avg", w: "58px", r: true, num: true, render: (s) => "+" + p1(s.avg) },
        { label: "Passed on", w: "92px", render: (s) => h("div", { className: "pd-split", style: { gap: 6 } }, UI.Bar(100 * s.passed / s.lines, s.passed ? "warn" : "bad", { w: 34 }), mono(s.passed + "/" + s.lines, { fontSize: 10.5 })) },
        { label: "Leaking", w: "78px", r: true, num: true, ink: true, render: (s) => eur(s.mo) }
      ]
    }));

    const custRows = FIX_CUST.map((r) => ({ c: r[0], list: r[1], am: r[2], price: r[3], units: r[4], now: (r[3] - fx.now) / r[3] * 100, was: (r[3] - fx.old) / r[3] * 100 }));
    const custTable = UI.Card({ flush: true, title: "Who is still on the old FIX-2201 price", meta: "37 AGREEMENTS · 9 LARGEST SHOWN", delay: 180 }, UI.Table({
      rows: custRows, rowKey: (r) => r.c, onRow: (r) => ctx.open("customer", r.c), sel: (r) => r.c === "murphy",
      cols: [
        { label: "Customer", w: "minmax(170px,1.3fr)", ink: true, render: (r) => L.cust(r.c) },
        { label: "Price basis", w: "minmax(150px,1.1fr)", render: (r) => h("span", { className: "pd-dim" }, r.list) },
        { label: "Owner", w: "minmax(100px,.8fr)", render: (r) => DB.person(r.am) },
        { label: "Price", w: "70px", r: true, num: true, ink: true, render: (r) => eur(r.price, 2) },
        { label: "Margin was", w: "80px", r: true, num: true, render: (r) => h("span", { className: "pd-faint" }, p1(r.was)) },
        { label: "Margin now", w: "80px", r: true, num: true, render: (r) => h("span", { style: { color: r.now < 15 ? "var(--bad)" : "var(--warn)" } }, p1(r.now)) },
        { label: "Boxes / mo", w: "78px", r: true, num: true, render: (r) => r.units },
        { label: "Lost / mo", w: "74px", r: true, num: true, ink: true, render: (r) => eur(Math.round(r.units * up)) },
        { label: "Pass-through", w: "86px", r: true, num: true, render: (r) => h("span", { style: { color: "var(--ok)" } }, eur(r.price + up, 2)) }
      ],
      foot: FIX_REST.n + " more agreements take " + FIX_REST.units + " boxes a month between them. All 37: " + num(fx.volume) + " boxes, " + eur(fx.impact) + " a month."
    }));

    const ai = UI.AI({
      who: "Margin Agent", conf: "MATCHED 08:58",
      text: ["The EuroFix file landed at 08:31: ", B("428 lines"), ", 391 of them increases averaging 6.8%. Sage 200 took the new costs straight away; no selling price moved. I have matched every line to the price lists and agreements it touches. Contract customers get 30 days' notice under their terms, so every day this waits is another day at the old margin."],
      actions: [
        UI.Btn("Draft price notices", () => ctx.act("cost-notices", "Price notices drafted", "One letter per affected account, in each account manager's Outlook drafts. Effective in 30 days. Nothing sent."), { pri: true, sm: true, done: ctx.done("cost-notices"), doneLabel: "Drafted" }),
        UI.Btn("Price lists", () => go(MOD, "Price Lists"), { sm: true })
      ]
    });

    return UI.Page({
      kicker: "Pricing & Margin · cost changes", live: "SUPPLIER CSV AND EDI FEEDS",
      title: "Suppliers put prices up. We didn't.",
      sub: "Every supplier cost increase, matched to the price lists, quotes, open orders and customers still selling at the old cost, with the margin it is costing each month.",
      actions: [UI.Btn("Where are we losing margin?", () => ctx.ask("Where are we losing margin?"), { icon: "spark", ghost: true })],
      children: [
        UI.Kpis([
          { label: "Cost changes this quarter", value: num(lines) + " lines", sub: "6 suppliers · EuroFix today" },
          { label: "Not passed through", value: num(lines - passed) + " lines", sub: Math.round(100 * (lines - passed) / lines) + "% of changes", tone: "warn" },
          { label: "Margin leaking", value: eur(totMo) + "/mo", sub: eur(totMo * 12) + " a year", tone: "bad", toneValue: true, onClick: () => go(MOD, "Margin Control") },
          { label: "Agreements on old cost", value: num(agreements), sub: "Across the 7 SKUs below" },
          { label: "Price file imported", value: "08:31", sub: "EuroFix · 428 changes identified", onClick: () => ctx.open("supplier", "eurofix") }
        ]),
        spotlight,
        gap(),
        watch,
        gap(),
        UI.Grid("minmax(0,1.7fr) minmax(0,1fr)", [custTable, h("div", null, ai, gap(), files)])
      ]
    });
  }

  /* ======================================================================
     DISCOUNT APPROVALS
     ====================================================================== */
  function discountApprovals(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const q = DB.quote("QT-2841");
    const co = counterOf(q.value, q.margin, q.target);
    const gpNow = Math.round(q.value * q.margin / 100);
    const approved = ctx.done("appr-QT-2841"), countered = ctx.done("dq-obrien") || ctx.done("counter-QT-2841"), rejected = ctx.done("rej-QT-2841");
    const settled = approved || countered || rejected;
    const queue = EXC.filter((e) => e.status === "PENDING" && e.id !== "QT-2841").map((e) => Object.assign({}, e, { live: liveStatus(ctx, e), co: counterOf(e.value, e.prop, e.std) }));
    const allPend = EXC.filter((e) => e.status === "PENDING").map((e) => Object.assign({}, e, { live: liveStatus(ctx, e) })).filter((e) => e.live === "PENDING");
    const dueToday = allPend.filter((e) => /^Today/.test(e.due)).length;

    const feature = UI.Card({ tint: !settled, title: "Due today 11:00 · QT-2841 O'Brien Facilities", icon: "shield", meta: "APPROVER MICHAEL DOYLE", delay: 60, right: UI.Badge(approved ? "APPROVED" : countered ? "COUNTER SENT" : rejected ? "REJECTED" : "PENDING", approved || countered ? "ok" : rejected ? "bad" : "warn", true) }, [
      UI.Grid("minmax(0,1.2fr) minmax(0,1fr)", [
        h("div", null,
          UI.Facts([["Revenue", eur(q.value)], ["Standard margin", p1(q.target)], ["Proposed margin", p1(q.margin), "bad"], ["Difference", pts(q.margin - q.target), "bad"],
            ["Sales rep", DB.person(q.am)], ["Reason", "Strategic deal"], ["GP given up", eur(Math.floor(q.value * (q.target - q.margin) / 100)), "bad", "On this call-off"], ["Over 12 months", eur(Math.round(q.annual * (q.target - q.margin) / 100)), "bad", "On " + eur(q.annual) + " a year"]], 4),
          UI.P(["David Kelly is matching a 5-site FM tender. O'Brien is growing 9.2% this year, but its margin is already ", B("21.7%"), " against a 24% book, and 40% of this quote is M10 bolts, cutting discs and twin and earth: the three lines whose cost went up this month."], { marginTop: 14 })),
        UI.AI({ who: "Margin Agent", conf: "COUNTER RECOMMENDED",
          text: ["Counter at ", B(eur(co.price) + " (" + p1(co.m) + ")"), ". It stays " + eur(Math.round(co.cost / (1 - q.target / 100)) - co.price) + " under the standard price, which David says is where the tender sits, and recovers ", B(eur(co.gp - gpNow)), " of gross profit on this call-off. The discount then sits on the lines where our cost did not move."],
          note: "O'Brien has accepted 7 of 11 quotes this year, 3 of them after a counter.",
          actions: [
            UI.Btn("Counter at " + eur(co.price), () => ctx.act("dq-obrien", "Counter approved", "QT-2841 revised to " + eur(co.price) + " at " + p1(co.m) + " and sent to David Kelly to issue."), { pri: !settled, sm: true, done: countered, doneLabel: "Counter sent" }),
            UI.Btn("Approve as quoted", () => ctx.act("appr-QT-2841", "Approved as quoted", "QT-2841 approved by Michael Doyle at 17.2%. Logged against O'Brien's price agreement."), { sm: true, done: approved, doneLabel: "Approved" }),
            UI.Btn("Reject", () => ctx.act("rej-QT-2841", "Quote rejected", "QT-2841 sent back to David Kelly."), { sm: true, ghost: true, done: rejected, doneLabel: "Rejected" }),
            UI.Btn("Open quote", () => ctx.open("quote", "QT-2841"), { sm: true, ghost: true })
          ] })
      ], { style: { marginBottom: 0 } })
    ]);

    const queueTable = UI.Card({ flush: true, title: "Approval queue", meta: allPend.length + " WAITING · " + eur(sum(allPend.map((e) => e.value))) + " · OLDEST FIRST BY DUE TIME", delay: 100 }, UI.Table({
      rows: queue, rowKey: (e) => e.id, onRow: (e) => openExc(ctx, e), rowTone: (e) => e.live !== "PENDING" ? null : /^Today/.test(e.due) ? "warn" : null,
      cols: [
        { label: "Item", w: "96px", render: (e) => excId(e) },
        { label: "Customer", w: "minmax(160px,1.2fr)", ink: true, render: (e) => L.cust(e.cust) },
        { label: "Rep", w: "minmax(96px,.7fr)", render: (e) => DB.person(e.am) },
        { label: "Value", w: "80px", r: true, num: true, ink: true, render: (e) => eur(e.value) },
        { label: "Margin", w: "108px", r: true, num: true, render: (e) => h("span", null, marginCell(e.prop, e.std), h("span", { className: "pd-faint" }, " / " + p1(e.std))) },
        { label: "Why", w: "minmax(170px,1.3fr)", render: (e) => h("span", { title: e.detail }, e.reason, h("span", { className: "pd-faint" }, " · " + e.detail)) },
        { label: "Approver", w: "minmax(104px,.7fr)", render: (e) => DB.person(e.approver) },
        { label: "Due", w: "100px", render: (e) => h("span", { style: { color: /^Today/.test(e.due) ? "var(--warn)" : "var(--body)" } }, e.due) },
        { label: "Pulse suggests", w: "minmax(130px,.9fr)", render: (e) => e.kind === "quote" ? "Counter at " + eur(e.co.price) : e.reason === "Old cost price" || e.reason === "No reason code" ? "Correct to today's price" : "Reprice to " + p1(e.co.m) },
        { label: "", w: "210px", render: (e) => e.live !== "PENDING" ? UI.Badge(e.live, ST_TONE[e.live], true) : h("div", { style: { display: "flex", gap: 6 } },
          UI.Btn(e.kind === "quote" ? "Counter" : "Correct", () => ctx.act((e.kind === "quote" ? "counter-" : "fixprice-") + e.id, e.kind === "quote" ? "Counter sent" : "Price corrected", e.id + " for " + DB.custName(e.cust) + ": " + (e.kind === "quote" ? "revised to " + eur(e.co.price) + " at " + p1(e.co.m) + " and sent to " + DB.person(e.am) + "." : "lines repriced and released to allocation. " + DB.person(e.am) + " notified.")), { sm: true, pri: true }),
          UI.Btn("Approve", () => ctx.act("appr-" + e.id, "Approved as priced", e.id + " approved at " + p1(e.prop) + " and logged."), { sm: true })) }
      ],
      foot: "Orders on price hold do not dispatch until someone decides. SO-10525 is Michael Doyle's own account, so it goes to Patrick Byrne."
    }));

    const REPS = [
      { k: "SB", disc: 6.2, band: 8, lines: 24, above: 610, quotes: 38, won: 15 },
      { k: "DK", disc: 9.6, band: 5, lines: 52, above: 1480, quotes: 41, won: 13 },
      { k: "MR", disc: 4.8, band: 5, lines: 21, above: 520, quotes: 36, won: 14 },
      { k: "MD", disc: 11.4, band: 15, lines: 14, above: 470, quotes: 9, won: 5, note: "National contracts" },
      { k: "GF", disc: 3.8, band: 3, lines: 7, above: 180, quotes: 0, won: 0, note: "Order desk overrides" }
    ];
    const repTable = UI.Card({ flush: true, title: "Discount given against deals won", meta: "THIS MONTH · IS THE DISCOUNT BUYING ANYTHING?", delay: 140 }, UI.Table({
      rows: REPS, rowKey: (r) => r.k, rowTone: (r) => r.k === "DK" ? "bad" : null,
      cols: [
        { label: "Rep", w: "minmax(150px,1.2fr)", ink: true, render: (r) => h("div", null, h("div", null, DB.person(r.k)), r.note ? h("div", { className: "pd-meta", style: { marginTop: 2 } }, r.note.toUpperCase()) : null) },
        { label: "Avg discount off list", w: "minmax(130px,1fr)", render: (r) => h("div", { className: "pd-split", style: { gap: 8 } }, UI.Bar(100 * r.disc / 12, r.disc > r.band ? "bad" : "info", { w: 60 }), mono(p1(r.disc), { fontSize: 11.5, color: r.disc > r.band ? "var(--bad)" : "var(--body)" })) },
        { label: "Own band", w: "70px", r: true, num: true, render: (r) => "≤ " + r.band + "%" },
        { label: "Above band", w: "104px", r: true, num: true, render: (r) => h("span", null, eur(r.above), h("span", { className: "pd-faint" }, " · " + r.lines)) },
        { label: "Quotes", w: "60px", r: true, num: true, render: (r) => r.quotes || none() },
        { label: "Win rate", w: "minmax(120px,1fr)", render: (r) => r.quotes ? h("div", { className: "pd-split", style: { gap: 8 } }, UI.Bar(100 * r.won / r.quotes / .6, r.won / r.quotes < .35 ? "bad" : "ok", { w: 60 }), mono(p1(100 * r.won / r.quotes), { fontSize: 11.5 })) : none() }
      ],
      foot: "118 lines above band this month, €3,260 of margin. Quote win rate across the team: 37.9%."
    }));

    const winBand = UI.Card({ title: "Win rate by discount given", icon: "spark", meta: "124 QUOTES THIS MONTH", delay: 180 }, [
      UI.Columns([{ l: "0-3%", v: 41, d: "41%" }, { l: "3-6%", v: 40, d: "40%" }, { l: "6-9%", v: 37, d: "37%" }, { l: "9-12%", v: 34, d: "34%", hi: true }, { l: "12%+", v: 36, d: "36%" }], { h: 132, showValues: true, max: 50 }),
      UI.Note("Deeper discounts are not winning more. Above 9% off list the win rate drops, and 22 of those 31 quotes were David Kelly's.", { marginTop: 10 }),
      gap(12),
      UI.AI({ who: "Margin Agent", text: "David gives 9.6% on average and wins 31.7% of quotes. Mark gives 4.8% and wins 38.9% in the same customer base. Holding David to his 5% band without approval would have kept about €1,100 of this month's €1,480.",
        actions: [UI.Btn("Hold David to 5%", () => ctx.act("band-DK", "Band change proposed", "David Kelly: discounts above 5% off tier need Michael Doyle's approval from Monday. Sent to Michael to confirm."), { pri: true, sm: true, done: ctx.done("band-DK"), doneLabel: "Proposed" })] })
    ]);

    const BANDS = [
      ["Account manager", "David Kelly, Mark Ryan", "Up to 5% off tier", "Target − 2 pts", "Michael Doyle"],
      ["Senior account manager", "Sarah Byrne", "Up to 8% off tier", "Target − 3 pts", "Michael Doyle"],
      ["Order desk", "Gráinne Foley's team", "Up to 3%, reason code", "Target", "Michael Doyle"],
      ["Commercial Director", "Michael Doyle", "Up to 15%", "15% margin", "Patrick Byrne"],
      ["National contracts", "Michael Doyle", "Contract price", "20% floor", "Patrick Byrne"]
    ];
    const bands = UI.Card({ flush: true, title: "Rep discount bands", meta: "SET BY MICHAEL DOYLE", delay: 220 }, UI.Table({
      rows: BANDS, rowKey: (b) => b[0],
      cols: [
        { label: "Role", w: "minmax(130px,1.1fr)", ink: true, render: (b) => h("div", null, h("div", null, b[0]), h("div", { className: "pd-ell", style: { fontSize: 11, color: "var(--dim)", marginTop: 2 } }, b[1])) },
        { label: "Without approval", w: "minmax(110px,1fr)", render: (b) => b[2] },
        { label: "Floor", w: "minmax(90px,.8fr)", render: (b) => b[3] },
        { label: "Above that", w: "minmax(96px,.8fr)", render: (b) => b[4] }
      ],
      foot: "Below 15% margin always goes to Patrick Byrne."
    }));

    const log = UI.Card({ title: "Who approved what", icon: "clock", meta: "LAST 30 DAYS", delay: 260 }, [
      UI.Facts([["Michael Doyle", "6 · 3 · 2", null, "Approved · countered · rejected"], ["Patrick Byrne", "1", null, "QT-2819 Core FM"], ["By rule", "1", null, "Leinster, above floor"]], 3),
      gap(10),
      UI.Feed([
        { t: "", tone: "ok", text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, dm(D(-1))), B("Michael Doyle"), " approved ", L.order("SO-10503"), " Doyle Construction at 22.1%: Hansfield project pricing."] },
        { t: "", tone: "info", text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, dm(D(-2))), B("Michael Doyle"), " countered QT-2826 for ", L.cust("dunmore"), " from 18.6% to 22.0%. Accepted."] },
        { t: "", tone: "ok", text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, dm(D(-3))), B("Patrick Byrne"), " approved QT-2819 for ", L.cust("core"), " at 23.9%: three-year renewal."] },
        { t: "", tone: "bad", text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, dm(D(-5))), B("Michael Doyle"), " rejected QT-2836 for ", L.cust("kelleher"), ": priced from last year's cost file."] },
        { t: "", tone: "ok", text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, dm(D(-6))), B("Michael Doyle"), " approved ", L.order("SO-10499"), " Atlantic FM at 20.4%."] },
        { t: "", tone: "bad", text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, dm(D(-11))), B("Michael Doyle"), " rejected QT-2833 for ", L.cust("southside"), ": a DIY chain's shelf price is not a trade price."] }
      ]),
      UI.Note("€1,311 of gross profit conceded on the 8 approvals.", { marginTop: 8 })
    ]);

    const DELIV = [
      ["Drops under the €250 minimum, delivered free", 38, 1140, null],
      ["Timed or express deliveries not charged", 9, 740, null],
      ["Re-deliveries after short or failed drops", 6, 512, "SO-10490"],
      ["Dedicated runs for a single customer", 4, 468, "SO-10493"]
    ];
    const EX = [
      ["SO-10493", "D04 run 2, a dedicated run after the bin recount", 118],
      ["SO-10490", "Glenview's 2 pallets re-slotted on the shuttle", 86],
      ["SO-10501", "Missed cut-off, added to D07 run 2", 64]
    ];
    const delivery = UI.Card({ title: "Special delivery costs", icon: "truck", meta: eur(sum(DELIV.map((d) => d[2]))) + " NOT RECHARGED THIS MONTH", delay: 300 }, [
      ...DELIV.map((d) => UI.Row({ onClick: d[3] ? () => ctx.open("order", d[3]) : () => go("Delivery", "Today") }, [
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, d[0]), h("div", { className: "pd-meta", style: { marginTop: 2 } }, d[1] + " THIS MONTH")),
        mono(eur(d[2]), { color: "var(--ink)" })])),
      UI.Label("What it did to the order margin", { marginTop: 12, marginBottom: 2 }),
      ...EX.map((x) => { const o = DB.order(x[0]); const after = (o.value * o.margin / 100 - x[2]) / o.value * 100; return UI.Row({ onClick: () => ctx.open("order", x[0]) }, [
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.custName(o.cust), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, x[0])), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, x[1] + " · " + eur(x[2]))),
        h("div", { style: { textAlign: "right" } }, mono(p1(o.margin) + " → " + p1(after), { fontSize: 11.5, color: "var(--warn)" }))]); })
    ]);

    return UI.Page({
      kicker: "Pricing & Margin · discount approvals", title: allPend.length + " discounts waiting, " + dueToday + " due today",
      sub: "The approval queue for prices under standard margin, the bands each rep works inside, who approved what, and whether the discount is actually winning the business.",
      actions: [UI.Btn("All exceptions", () => go(MOD, "Exceptions"), { ghost: true }), UI.Btn("All approvals", () => go("Work", "Approvals"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Waiting for approval", value: String(allPend.length), sub: eur(sum(allPend.map((e) => e.value))) + " · 4 quotes, " + allPend.filter((e) => e.kind === "order").length + " orders", tone: "warn" },
          { label: "Due today", value: String(dueToday), sub: "First at 11:00, QT-2841", tone: dueToday ? "bad" : "ok" },
          { label: "Discount above band", value: eur(3260), sub: "118 lines this month", tone: "bad", toneValue: true },
          { label: "Quote win rate", value: "37.9%", sub: "47 of 124 this month" },
          { label: "Delivery not recharged", value: eur(sum(DELIV.map((d) => d[2]))), sub: "57 drops and runs", subTone: "warn" }
        ]),
        feature,
        gap(),
        queueTable,
        gap(),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [repTable, winBand]),
        UI.Grid("minmax(0,1fr) minmax(0,1.1fr) minmax(0,1fr)", [bands, log, delivery])
      ]
    });
  }

  /* ======================================================================
     PRODUCT PROFITABILITY
     ====================================================================== */
  function productProfitability(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const cat = ctx.st.pmCat || "all";
    const sortKey = ctx.st.pmSort || "rev";
    const SORT = { rev: (a, b) => b.rev - a.rev, gp: (a, b) => b.gp - a.gp, now: (a, b) => a.now - b.now, gpNow: (a, b) => b.gpNow - a.gpNow, inv: (a, b) => b.inv - a.inv, turn: (a, b) => a.turn - b.turn };
    const rows = PP.filter((r) => cat === "all" || r.p.cat === cat).slice().sort(SORT[sortKey] || SORT.rev);
    const all = PP;
    const totRev = sum(all.map((r) => r.rev)), totGp = sum(all.map((r) => r.gp)), totGpNow = sum(all.map((r) => r.gpNow));
    const thin = all.filter((r) => r.now < 20);
    const slow = all.filter((r) => r.turn < 3);
    const slowInv = sum(slow.map((r) => r.inv));
    const cats = DB.categories.map((c) => c.id).filter((c) => all.some((r) => r.p.cat === c));

    // ranking: revenue vs gross profit at today's cost
    const byRev = all.slice().sort(SORT.rev);
    const byGpNow = all.slice().sort(SORT.gpNow);
    const rankOf = (sku, list) => list.findIndex((r) => r.sku === sku) + 1;
    const rankList = (list, val, other, otherLabel, worseIsBad) => list.slice(0, 8).map((r, i) => {
      const o = rankOf(r.sku, other), mv = o - (i + 1);
      const tone = mv > 1 ? (worseIsBad ? "var(--bad)" : "var(--ok)") : mv < -1 ? (worseIsBad ? "var(--ok)" : "var(--faint)") : "var(--faint)";
      return UI.Row({ onClick: () => ctx.open("product", r.sku), style: { padding: "8px 0" } }, [
        mono(String(i + 1), { width: 16, color: "var(--faint)" }),
        h("div", { className: "pd-grow" }, h("div", { className: "pd-ell", style: { fontSize: 12.5, color: r.now < 20 ? "var(--bad)" : "var(--ink)" } }, r.p.name), h("div", { className: "pd-meta", style: { marginTop: 1 } }, r.sku + " · " + p1(r.now) + " NOW")),
        mono(eurK(val(r)), { fontSize: 11.5 }),
        h("span", { className: "pd-mono", style: { width: 52, textAlign: "right", fontSize: 10, color: tone } }, otherLabel + " #" + o)]);
    });
    const ranking = UI.Card({ title: "Sells the most is not earns the most", icon: "swap", meta: "LAST 12 MONTHS · GP AT TODAY'S COST", delay: 60 }, [
      UI.Grid("minmax(0,1fr) minmax(0,1fr)", [
        h("div", null, UI.Label("By revenue", { marginBottom: 4 }), ...rankList(byRev, (r) => r.rev, byGpNow, "GP", true)),
        h("div", null, UI.Label("By gross profit at today's cost", { marginBottom: 4 }), ...rankList(byGpNow, (r) => r.gpNow, byRev, "REV", false))
      ], { style: { marginBottom: 0 } }),
      UI.Note("Each row shows where the SKU sits in the other list. Twin and earth is our second-biggest seller and #" + rankOf("EL-4712", byGpNow) + " on profit since the copper surcharge; nitrile gloves are #" + rankOf("IC-3405", byRev) + " on revenue and #" + rankOf("IC-3405", byGpNow) + " on profit.", { marginTop: 10 })
    ]);

    const e4712 = PP.find((r) => r.sku === "EL-4712"), f2201 = PP.find((r) => r.sku === "FIX-2201"), s1892 = PP.find((r) => r.sku === "SAF-1892");
    const ai = UI.AI({ who: "Margin Agent", conf: "3 SKUS · ACT THIS WEEK",
      text: [B("EL-4712 Twin & Earth"), " is our second-biggest seller and now makes " + p1(e4712.now) + ": the copper surcharge added €10.00 a drum and neither list (€81.90) nor the 24 agreements on it have moved. ", B("FIX-2201"), " is the biggest seller and fell to " + p1(f2201.now) + " when EuroFix went up. Passing both through protects €1,529 a month. ", B("SAF-1892 safety glasses"), " earn " + p1(s1892.now) + " but sit on 22 weeks of cover and turn " + s1892.turn + " times a year: stop buying and let the PPE clearance run."],
      actions: [
        UI.Btn("Review EL-4712 pricing", () => ctx.act("cost-EL-4712", "Pricing review opened", "EL-4712: list and 24 agreements moved to +€10.00 a drum in draft for the account managers."), { pri: true, sm: true, done: ctx.done("cost-EL-4712"), doneLabel: "In review" }),
        UI.Btn("Review FIX-2201", () => ctx.act("cost-FIX-2201", "Pricing review opened", "37 agreements on FIX-2201 moved to +€1.70 a box in draft."), { sm: true, done: ctx.done("cost-FIX-2201"), doneLabel: "In review" }),
        UI.Btn("Stop SAF-1892 replenishment", () => ctx.act("stop-SAF-1892", "Replenishment stopped", "SAF-1892 removed from automatic reordering."), { sm: true, done: ctx.done("stop-SAF-1892"), doneLabel: "Stopped" })
      ] });

    // quadrant grouping
    const grp = (r) => r.turn < 3 ? "cash" : r.now < 25 ? "thin" : r.rev >= 50000 ? "earn" : "quiet";
    const G = {
      earn: { t: "Earning their place", d: "High revenue, healthy margin, turning well", tone: "ok" },
      thin: { t: "Selling well, earning little", d: "Margin under 25% at today's cost", tone: "bad" },
      quiet: { t: "Quiet earners", d: "Smaller sellers, good margin, stock moving", tone: "info" },
      cash: { t: "Cash tied up", d: "Turning under 3 times a year, whatever the margin", tone: "warn" }
    };
    const quad = (k) => {
      const items = all.filter((r) => grp(r) === k).sort(SORT.rev);
      const g = G[k];
      return h("div", { key: k, style: { padding: "14px 16px", borderRadius: 18, border: "1px solid color-mix(in srgb," + fg(g.tone) + " 34%,transparent)", background: "linear-gradient(170deg," + PD.TONE[g.tone].bg + ",transparent 70%),var(--surface-2)", minWidth: 0 } },
        h("div", { className: "pd-split" }, h("span", { style: { fontSize: 13.5, fontWeight: 500, color: "var(--ink)" } }, g.t), h("span", { style: { marginLeft: "auto" } }, UI.Badge(items.length + " SKUS", g.tone, true))),
        h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3 } }, g.d),
        h("div", { style: { display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" } },
          ...[["Revenue", eurK(sum(items.map((r) => r.rev)))], ["GP now", eurK(sum(items.map((r) => r.gpNow)))], ["Stock", eurK(sum(items.map((r) => r.inv)))]].map((f, i) => h("div", { key: i }, h("div", { className: "pd-label" }, f[0]), h("div", { className: "pd-mono", style: { fontSize: 13, color: "var(--ink)", marginTop: 2 } }, f[1])))),
        h("div", { style: { marginTop: 8 } }, ...items.map((r) => h("div", { key: r.sku, className: "pd-row click", onClick: () => ctx.open("product", r.sku), style: { padding: "6px 4px", gap: 8 } },
          mono(r.sku, { fontSize: 10.5, width: 64, color: "var(--faint)" }),
          h("span", { className: "pd-grow pd-ell", style: { fontSize: 12 } }, r.p.name),
          mono(k === "cash" ? r.turn.toFixed(1) + "×" : p1(r.now), { fontSize: 11, color: k === "thin" ? "var(--bad)" : "var(--body)" })))));
    };
    const quadrant = UI.Card({ title: "Revenue against margin", icon: "box", meta: "WHERE EACH SKU EARNS ITS SHELF SPACE", delay: 120 }, [
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 10 } }, quad("earn"), quad("thin"), quad("quiet"), quad("cash"))
    ]);

    const table = UI.Card({ flush: true, title: (cat === "all" ? "All categories" : cat) + " · " + rows.length + " SKUs", meta: "LAST 12 MONTHS · CLICK A ROW FOR THE SKU", delay: 160 }, UI.Table({
      rows, rowKey: (r) => r.sku, onRow: (r) => ctx.open("product", r.sku),
      rowTone: (r) => r.now < 18 ? "bad" : r.turn < 2 ? "warn" : null,
      cols: [
        { label: "SKU", w: "84px", render: (r) => mono(r.sku, { color: "var(--ink)", fontSize: 11.5 }) },
        { label: "Product", w: "minmax(190px,1.6fr)", ink: true, render: (r) => h("div", null, h("div", { className: "pd-ell" }, r.p.name), h("div", { className: "pd-meta", style: { marginTop: 2 } }, r.p.cat.toUpperCase())) },
        { label: "Revenue", w: "90px", r: true, num: true, ink: true, render: (r) => eur(Math.round(r.rev)) },
        { label: "Units", w: "70px", r: true, num: true, render: (r) => num(r.units) },
        { label: "Cost", w: "90px", r: true, num: true, render: (r) => eur(Math.round(r.cost)) },
        { label: "Gross profit", w: "88px", r: true, num: true, ink: true, render: (r) => eur(Math.round(r.gp)) },
        { label: "Margin", w: "64px", r: true, num: true, render: (r) => p1(r.gm) },
        { label: "Inventory value", w: "96px", r: true, num: true, render: (r) => eur(Math.round(r.inv)) },
        { label: "Inventory turn", w: "88px", r: true, num: true, render: (r) => h("span", { style: { color: r.turn < 2 ? "var(--bad)" : r.turn < 4 ? "var(--warn)" : "var(--body)" } }, r.turn.toFixed(1) + "×") },
        { label: "Returns", w: "66px", r: true, num: true, render: (r) => h("span", { style: { color: r.ret >= 2.5 ? "var(--bad)" : r.ret >= 1.5 ? "var(--warn)" : "var(--body)" } }, p1(r.ret)) },
        { label: "Supplier", w: "minmax(130px,1fr)", render: (r) => L.sup(r.p.supplier) },
        { label: "Trend", w: "140px", render: (r) => { const dn = r.trend[5] - r.trend[0]; const tone = dn < -2 ? "bad" : dn < -.5 ? "warn" : "info"; return h("div", { className: "pd-split", style: { gap: 8 } }, UI.Spark(r.trend, tone, 60, 22), mono(p1(r.now), { fontSize: 11, color: fg(tone === "info" ? "neutral" : tone) })); } }
      ],
      empty: "No SKUs in this category.",
      foot: "Trend is gross margin over the last 6 months, ending at today's cost. " + all.length + " SKUs shown of 8,426: the ones that move margin most, " + eurK(totRev) + " of the €15.4m a year."
    }));

    return UI.Page({
      kicker: "Pricing & Margin · product profitability", title: "The best sellers are not the best earners",
      sub: "Revenue, cost, gross profit, stock and returns per SKU, with margin at today's cost so a supplier increase shows up the day it lands, not at month end.",
      actions: [UI.Btn("Cost changes", () => go(MOD, "Cost Changes"), { icon: "euro" }), UI.Btn("Slow & dead stock", () => go("Inventory", "Slow & Dead Stock"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Revenue, these SKUs", value: eurK(totRev), sub: "Last 12 months · " + all.length + " SKUs" },
          { label: "Gross profit", value: eurK(totGp), sub: p1(100 * totGp / totRev) + " margin, last 12 months" },
          { label: "GP at today's cost", value: eurK(totGpNow), sub: "−" + eurK(totGp - totGpNow) + " a year if prices hold", tone: "warn", subTone: "bad" },
          { label: "Thin at today's cost", value: thin.length + " SKUs", sub: thin.map((r) => r.sku).join(" · "), tone: "bad", onClick: () => ctx.set({ pmSort: "now" }) },
          { label: "Turning under 3×", value: eur(Math.round(slowInv)), sub: slow.length + " SKUs of stock", tone: "warn", onClick: () => ctx.set({ pmSort: "turn" }) }
        ]),
        UI.Grid("minmax(0,1.4fr) minmax(0,1fr)", [ranking, ai]),
        quadrant,
        gap(),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } },
          UI.Chips([["all", "All", all.length]].concat(cats.map((c) => [c, c, all.filter((r) => r.p.cat === c).length])), cat, (v) => ctx.set({ pmCat: v })),
          h("div", { style: { flex: 1 } }),
          UI.Tabs([["rev", "Revenue"], ["gp", "Gross profit"], ["gpNow", "GP now"], ["now", "Thinnest"], ["inv", "Stock"], ["turn", "Slowest"]], sortKey, (v) => ctx.set({ pmSort: v }))),
        table
      ]
    });
  }

  PD.pages[MOD] = {
    "Margin Control": marginControl,
    "Price Lists": priceLists,
    "Exceptions": exceptions,
    "Cost Changes": costChanges,
    "Discount Approvals": discountApprovals,
    "Product Profitability": productProfitability
  };

  /* ---------------- sanity checks for the local tables ---------------- */
  const chk = (label, got, want, tol) => { if (Math.abs(got - want) > (tol === undefined ? 0.51 : tol)) console.warn("[PD pricing] " + label + ": " + got + " ≠ " + want); };
  chk("AM revenue", sum(AMS.map((a) => a.rev)), K.revenueMTD);
  chk("AM margin", 100 * sum(AMS.map((a) => a.rev * a.gm / 100)) / K.revenueMTD, K.gm, 0.05);
  chk("AM above band", sum(AMS.map((a) => a.above)), 3260);
  chk("AM above-band lines", sum(AMS.map((a) => a.lines)), 118);
  chk("pricing types revenue", sum(TYPES.map((t) => t.rev)), K.revenueMTD);
  chk("pricing types margin", 100 * sum(TYPES.map((t) => t.rev * t.gm / 100)) / K.revenueMTD, K.gm, 0.05);
  chk("recovery", sum(RECOVERY.map((r) => r.mo)) * 12, 18600);
  chk("reprice", sum(REPRICE.map((r) => r.mo)) + REPRICE_REST.mo, DB.leakage.find((l) => l.id === "pricing").v);
  chk("supplier files", sum(SUP_FILES.map((s) => s.mo)), DB.leakage.find((l) => l.id === "cost").v);
  chk("exceptions pending", EXC.filter((e) => e.status === "PENDING").length, 10);
  chk("pending orders (Orders: pricing approval)", EXC.filter((e) => e.status === "PENDING" && e.kind === "order").length, 6);
  const fxc = DB.costChanges.find((c) => c.sku === "FIX-2201");
  chk("FIX-2201 boxes", sum(FIX_CUST.map((r) => r[4])) + FIX_REST.units, fxc.volume);
  chk("FIX-2201 agreements", FIX_CUST.length + FIX_REST.n, fxc.customers);
})();
