/* Record pages: order, customer, product, purchase order, supplier, route, quote.
   The story records (SO-10482, Murphy, EL-4408, PO-8821, Atlas, D14, QT-2841) carry
   hand-written detail; every other record is assembled from the same database. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, F = PD.F, UI = PD.UI, DB = PD.DB;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, dm, dml } = PD.date;
  const B = UI.B;
  const R = window.React;

  /* deterministic pseudo-random, so generated detail is identical on every visit */
  const seed = (str) => { let x = 0; for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) >>> 0; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; };
  const back = (ctx) => (ctx.canBack ? ctx.back : null);

  /* ================================================================ ORDER */
  PD.records.order = function (ctx, id) {
    const o = DB.order(id) || DB.orders[0];
    const L = PD.lk(ctx), c = DB.customer(o.cust), isM = o.id === "SO-10482";
    const partial = ctx.done("so-partial");
    const gp = isM ? DB.murphyProfit.gp : Math.round(o.value * o.margin / 100);
    const statusBadge = isM && partial ? UI.Badge("PARTIAL APPROVED", "ok", true) : o.risk === "ON TRACK" ? UI.Badge("ON TRACK", "ok", true) : UI.Badge("AT RISK", PD.riskTone(o.risk), true);
    const po = o.po ? DB.po(o.po) : null, sup = po ? DB.supplier(po.supplier) : null;
    const rt = o.route ? DB.route(o.route === "D07" && o.id === "SO-10491" ? "D07·2" : o.route) : null;

    // the chain
    const chain = [
      { k: "Customer", t: DB.custName(o.cust), d: c ? c.type + " · " + DB.person(c.am) + " · " + eur(c.out) + " outstanding of " + eur(c.limit) : "Account customer", icon: "user", onClick: c ? () => ctx.open("customer", c.id) : null },
      { k: "Order", t: o.id + " · " + eur(o.value), d: (o.channel ? "Via " + o.channel + " · " : "") + "required " + relLower(D(o.req)) + (o.custPO ? " · customer PO " + o.custPO : ""), icon: "doc" },
      { k: "Product lines", t: o.lines + " lines", d: o.short ? (o.lines - o.short) + " allocated · " + o.short + " awaiting inventory" : o.stock === "Count mismatch" ? "Allocation failed on 1 line after a bin count" : "All lines allocated from " + DB.warehouses[o.wh].short, icon: "box", tone: o.short ? "warn" : o.stock === "Count mismatch" ? "bad" : "ok" }
    ];
    if (o.short || o.stock === "Count mismatch") chain.push({ k: "Stock problem", t: isM ? "3 lines affected" : o.reasonDetail, d: isM ? "EL-4408 cable, EL-4631 glands, IC-3310 cable ties" : "Pulse found it before the picker did", icon: "alert", tone: "bad", onClick: () => ctx.open("product", isM ? "EL-4408" : o.stock === "Count mismatch" || o.transfer ? "EL-4408" : "EL-4631") });
    if (po) {
      chain.push({ k: "Purchase order", t: po.id + " · " + sup.name, d: eur(po.value) + " · " + po.items + " SKUs · ordered " + dm(D(po.ordered)), icon: "cart", onClick: () => ctx.open("po", po.id) });
      chain.push({ k: "Supplier", t: po.lateDays + " days late", d: sup.name + " OTIF " + sup.otif + "% · " + sup.affected + " orders affected this year", icon: "factory", tone: "bad", onClick: () => ctx.open("supplier", sup.id) });
      chain.push({ k: "Expected arrival", t: rel(D(po.expected)) + " " + po.eta, d: "Promised " + dm(D(po.promised)) + ". Atlas changed the date at 09:04 today.", icon: "clock", tone: "warn" });
    }
    if (o.transfer) chain.push({ k: "Supply", t: "Naas transfer, 14:00 shuttle", d: "64 available in Naas; 40 proposed for Dublin", icon: "swap", tone: ctx.done("dq-transfer") ? "ok" : "warn", onClick: () => ctx.go("Inventory", "Transfers") });
    if (o.hold) chain.push({ k: "Credit", t: "On hold", d: o.reasonDetail, icon: "shield", tone: "bad", onClick: () => ctx.go("Finance", "Credit Control") });
    chain.push({ k: "Warehouse", t: DB.warehouses[o.wh].name, d: isM ? "15 lines picked to bay 4 · cut-off 13:30" : o.status, icon: "shelf", tone: PD.ord.STATUS_TONE[o.status] === "bad" ? "bad" : null, onClick: () => ctx.go("Warehouse", "Control Board") });
    chain.push({ k: "Delivery", t: rt ? "Route " + rt.id.replace("·", " run ") : "Not routed", d: rt ? DB.person(rt.driver) + " · " + rt.reg + " · departs " + rt.depart : o.hold ? "Released to routing once credit clears" : "Planned at 16:00 for the next available run", icon: "truck", onClick: rt ? () => ctx.open("route", rt.id) : null });
    chain.push(isM
      ? { k: "Customer impact", t: partial ? "15 lines on D14 today, 3 follow " + relLower(D(1)) + " afternoon" : "Partial shipment available", d: partial ? "Ger Murphy notified from Sarah Byrne's mailbox at " + PD.date.nowHM() : "15 of 18 lines (€25,772.60) can go today; €1,867.40 waits on Atlas", icon: "user", tone: partial ? "ok" : "warn" }
      : { k: "Invoice", t: "Raised on proof of delivery", d: (c ? c.terms : "30 days") + " terms · posts to Sage 200 automatically", icon: "euro" });

    // AI recommendation per reason
    const REC = {
      "Stock shortage": o.transfer ? "Approve the 40-unit Naas transfer for the 14:00 shuttle. It covers this order and two others (€12,460) without waiting for Atlas." : "Ship what is allocated and follow with the balance.",
      "Late supplier": "Ship the allocated lines today and send the balance when PO-8821 lands " + relLower(D(1)) + " at 10:30. Draft update to the customer is ready.",
      "Credit hold": "Release €7,320 against available credit today, and ask for payment of INV-28482 (€11,860, 61 days) before releasing the balance.",
      "Picking delay": "Move the blocked pallet at A-22-04 to goods in first; the last 3 lines can then be picked in 12 minutes and still make D14.",
      "Stock discrepancy": "Send the 4 reels that are physically there on D04 run 2, and cover the other 2 from the Naas transfer. Recount bin D-14-03 tonight.",
      "Vehicle capacity": "Put the 2 pallets on the 14:00 Naas shuttle van, which has room, and drop Glenview on the way back.",
      "Warehouse delay": "Offer the customer tomorrow's 07:05 run, or add the drop to D07 run 2 which passes Rathfarnham at 12:50."
    };
    const rec = isM
      ? UI.AI({ who: "Pulse recommends", conf: "OPS WATCHDOG · 92% CONFIDENCE",
        text: "Dispatch the 15 available lines today and automatically notify Murphy Building Supplies that the remaining 3 lines will arrive " + relLower(D(1)) + " afternoon.",
        note: "Ger Murphy asked by email at 08:39 whether they can have what is in stock today. The balance ships on D14's first run " + relLower(D(1)) + " once PO-8821 is received.",
        actions: [
          UI.Btn("Approve partial shipment", () => ctx.act("so-partial", "Partial shipment approved", "15 lines released to D14. Murphy notified; balance booked for " + relLower(D(1)) + " afternoon."), { pri: true, done: partial, doneLabel: "Partial approved" }),
          UI.Btn("Contact customer", () => ctx.act("so-contact", "Email drafted", "Draft to Ger Murphy in Sarah Byrne's Outlook, with today's lines and tomorrow's ETA."), { done: ctx.done("so-contact"), doneLabel: "Drafted" }),
          UI.Btn("Expedite supplier", () => ctx.act("dq-expedite", "Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight. Emma Walsh copied."), { done: ctx.done("dq-expedite"), doneLabel: "Expedite requested" }),
          UI.Btn("Reallocate stock", () => ctx.go("Orders", "Allocation"), {})
        ] })
      : o.reason ? UI.AI({ who: "Pulse recommends", text: REC[o.reason] || "Keep an eye on this one.",
        actions: [UI.Btn(o.hold ? "Open credit control" : "Apply recommendation", () => o.hold ? ctx.go("Finance", "Credit Control") : ctx.act("fix-" + o.id, "Recommendation applied", o.id + ": " + (REC[o.reason] || "")), { pri: true, sm: true, done: ctx.done("fix-" + o.id), doneLabel: "Applied" }),
          UI.Btn("Contact customer", () => ctx.act("contact-" + o.id, "Email drafted", "Update to " + DB.custName(o.cust) + " ready in " + DB.person(o.am) + "'s Outlook."), { sm: true, done: ctx.done("contact-" + o.id), doneLabel: "Drafted" })] })
      : UI.AI({ who: "Pulse", text: "Nothing needs doing. This order is fully allocated and on " + (rt ? "route " + rt.id : "the next run") + ".", actions: null });

    // profitability
    const prof = isM ? DB.murphyProfit : (() => { const del = Math.round(18 + o.lines * 6), gpx = Math.round(o.value * o.margin / 100); return { revenue: o.value, delivery: del, cost: o.value - gpx - del, discount: Math.round(o.value * .045), gp: gpx }; })();
    const profit = UI.Card({ title: "Order profitability", icon: "euro", meta: "REVENUE IS NOT PROFIT", delay: 120 }, [
      ...[["Revenue", eur(prof.revenue), null], ["Product cost", "−" + eur(prof.cost), null], ["Delivery cost", "−" + eur(prof.delivery), null], ["Discount given (vs list)", eur(prof.discount), "info"]].map((r, i) => UI.Row({ key: i }, [h("span", { className: "pd-grow", style: { fontSize: 12.5, color: "var(--dim)" } }, r[0]), h("span", { className: "pd-mono", style: { fontSize: 12.5, color: r[2] ? "var(--dim)" : "var(--ink)" } }, r[1])])),
      UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 13, fontWeight: 500 } }, "Estimated gross profit"), h("span", { className: "pd-mono", style: { fontSize: 13, color: "var(--ink)" } }, eur(prof.gp))]),
      UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 13, fontWeight: 500 } }, "Margin"), h("span", { className: "pd-mono", style: { fontSize: 13, color: o.margin < 20 ? "var(--bad)" : o.margin < 23 ? "var(--warn)" : "var(--ok)" } }, o.margin.toFixed(1) + "%")])
    ]);

    // lines
    let lines;
    if (isM) {
      lines = DB.murphyLines.map((l) => ({ sku: l[0], name: l[1], qty: l[2], unit: l[3], val: l[2] * l[3], st: l[4] }));
    } else {
      const rnd = seed(o.id), pool = DB.products.filter((p) => ["Dead", "Slow"].indexOf(p.health) < 0), n = Math.min(o.lines, 6);
      let left = o.value; lines = [];
      for (let i = 0; i < n; i++) {
        const p = pool[Math.floor(rnd() * pool.length)];
        const share = i === n - 1 && n === o.lines ? left : Math.round(o.value / o.lines * (0.6 + rnd() * .8));
        const qty = Math.max(1, Math.round(share / p.price));
        const val = i === n - 1 && n === o.lines ? left : qty * p.price;
        left -= val;
        lines.push({ sku: p.sku, name: p.name, qty, unit: val / qty, val, st: o.short && i === 0 ? "short" : "allocated" });
      }
      if (o.lines > n) lines.push({ sku: "", name: (o.lines - n) + " more lines", qty: "", unit: null, val: left, st: "allocated", more: true });
    }
    const linesCard = UI.Card({ flush: true, title: "Order lines", meta: o.lines + " LINES · " + eur(o.value), delay: 160 }, UI.Table({
      rows: lines, rowKey: (l) => l.sku + l.name, onRow: (l) => l.sku && DB.product(l.sku) ? ctx.open("product", l.sku) : null,
      rowTone: (l) => l.st === "short" ? "bad" : null,
      cols: [
        { label: "SKU", w: "92px", render: (l) => h("span", { className: "pd-mono", style: { fontSize: 11.5, color: "var(--ink)" } }, l.sku) },
        { label: "Product", w: "minmax(200px,2fr)", ink: true, render: (l) => l.more ? h("span", { className: "pd-faint" }, l.name) : l.name },
        { label: "Qty", w: "64px", r: true, num: true, render: (l) => l.qty },
        { label: "Unit", w: "80px", r: true, num: true, render: (l) => l.unit ? eur(l.unit, 2) : "" },
        { label: "Line value", w: "96px", r: true, num: true, ink: true, render: (l) => eur(l.val, 2) },
        { label: "Status", w: "minmax(170px,1.2fr)", render: (l) => l.st === "short" ? h("span", null, UI.Badge("Short", "bad"), h("span", { className: "pd-faint", style: { marginLeft: 6, fontSize: 11.5 } }, o.po ? "on " + o.po + " · " + relLower(D(1)) : "transfer 14:00")) : l.more ? "" : UI.Badge(isM && partial ? "On D14 today" : "Allocated · " + DB.warehouses[o.wh].short, isM && partial ? "ok" : "neutral") }
      ]
    }));

    const timeline = isM ? [
      [dm(D(-3)) + " 16:12", "Order placed on the B2B portal by Karen Dolan", "neutral"],
      [dm(D(-3)) + " 16:13", "15 of 18 lines allocated in Dublin; 3 lines waiting on PO-8821", "warn"],
      [dm(D(-5)), "PO-8821 missed its promised date", "bad"],
      ["08:39", "Ger Murphy emailed: \"Can we get what you have today?\" · linked from Outlook", "info"],
      ["08:44", "Purchasing Agent traced 6 orders, this one included, to PO-8821", "warn"],
      ["09:04", "Atlas moved PO-8821 to " + relLower(D(1)) + " 10:30", "warn"],
      ["09:11", "Sarah Byrne: customer accepts a split delivery", "info"]
    ] : [
      [o.placed === 0 ? "Today 07:52" : rel(D(o.placed)) + " 15:40", "Order received via " + (o.channel || "portal"), "neutral"],
      [o.placed === 0 ? "Today 07:53" : rel(D(o.placed)) + " 15:41", o.hold ? "Held by the Credit Agent before allocation" : o.short ? "Allocated with " + o.short + " line short" : "Fully allocated in " + DB.warehouses[o.wh].short, o.hold ? "bad" : o.short ? "warn" : "ok"],
      ["Today", o.status + (rt ? " · route " + rt.id : ""), PD.ord.STATUS_TONE[o.status] || "neutral"]
    ];

    return UI.Page({
      back: back(ctx), backLabel: "Back",
      kicker: "Order · " + o.id,
      title: o.id + " · " + DB.custName(o.cust),
      sub: [DB.person(o.am), o.site || (c ? c.area : null), o.custPO ? "Customer PO " + o.custPO : null].filter(Boolean).join(" · "),
      actions: [statusBadge, UI.Btn("Ask about this order", () => ctx.ask("Why is " + o.id + " at risk?"), { icon: "spark", sm: true })],
      children: [
        UI.Facts([
          ["Order value", eur(o.value)], ["Gross profit", eur(gp)], ["Margin", o.margin.toFixed(1) + "%", o.margin < 20 ? "bad" : null],
          ["Required", dml(D(o.req)), null, rel(D(o.req))], ["Status", isM && partial ? "PARTIAL APPROVED" : o.risk === "ON TRACK" ? "ON TRACK" : "AT RISK", isM && partial ? "ok" : o.risk === "ON TRACK" ? "ok" : "bad"],
          ["Lines", o.lines + "", null, o.short ? (o.lines - o.short) + " allocated · " + o.short + " short" : "All allocated"]
        ], 6),
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [
          UI.Card({ title: "The full chain", icon: "link", meta: "CUSTOMER TO CASH", delay: 60 }, UI.Chain(chain)),
          h("div", null, rec, h("div", { style: { height: 14 } }), profit,
            h("div", { style: { height: 14 } }),
            UI.Card({ title: "What happened", icon: "clock", delay: 180 }, UI.Feed(timeline.map((t) => ({ t: t[0].length > 6 ? "" : t[0], tone: t[2], text: t[0].length > 6 ? [h("span", { className: "pd-meta", style: { marginRight: 6 } }, t[0]), t[1]] : t[1] })))))
        ]),
        linesCard,
        isM ? h("div", { style: { marginTop: 14 } }, UI.Grid("minmax(0,1fr) minmax(0,1fr)", [
          UI.Card({ title: "Or: offer the substitute today", icon: "swap", meta: "EL-4412 · APPROVED SUBSTITUTE", delay: 200 }, [
            UI.P(["Industrial Cable Pro 100m has ", B("84 available"), " in Dublin. It is an approved substitute for EL-4408, costs the customer ", B("€8.40 more per reel"), " and carries a ", B("26.1% margin"), "."]),
            h("div", { style: { marginTop: 12, display: "flex", gap: 8 } }, UI.Btn("Offer substitute", () => ctx.act("sub-el4412", "Substitute offered", "Ger Murphy offered 28 × EL-4412 at +€8.40 a reel. If accepted, the cable line ships on D14 today; glands and ties follow tomorrow."), { sm: true, pri: true, done: ctx.done("sub-el4412"), doneLabel: "Offered" }), UI.Btn("Open EL-4408", () => ctx.open("product", "EL-4408"), { sm: true }))
          ]),
          UI.Card({ title: "Murphy Building Supplies right now", icon: "user", delay: 240, onClick: () => ctx.open("customer", "murphy") }, [
            UI.Facts([["Outstanding", "€18,240"], ["Credit limit", "€75,000"], ["OTIF", "93.6%", "warn"], ["YTD", "€418,420"]], 4),
            UI.Note("Second order this week: SO-10512 (€2,150) is fully in stock. Two late deliveries this quarter, both Atlas-related.", { marginTop: 10 })
          ])
        ])) : null
      ]
    });
  };

  /* ================================================================ CUSTOMER */
  const CATS = ["Electrical", "Fixings & Fasteners", "Hand & Power Tools", "Safety & PPE", "Industrial Consumables", "Adhesives & Sealants", "Facilities & Hygiene", "Lighting"];
  PD.records.customer = function (ctx, id) {
    const c = DB.customer(id) || DB.customers[0], L = PD.lk(ctx), isM = c.id === "murphy";
    const rnd = seed(c.id);
    const orders = DB.orders.filter((o) => o.cust === c.id);
    const quotes = DB.quotes.filter((q) => q.cust === c.id);
    const invoices = DB.invoices.filter((i) => i.cust === c.id);
    const rets = DB.returns.filter((r) => r.cust === c.id);
    const monthly = Array.from({ length: 12 }, (_, i) => Math.round(c.ytd / 9 * (1 + (c.trend / 100) * (i - 6) / 12) * (0.82 + rnd() * .36)));
    const mix = isM ? [["Electrical", 46], ["Fixings & Fasteners", 24], ["Hand & Power Tools", 17], ["Adhesives & Sealants", 8], ["Lighting", 5], ["Safety & PPE", 0]]
      : CATS.map((k) => [k, Math.round(rnd() * 30)]).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const freq = isM ? [["FIX-2201", "M10 Hex Bolt Box 100", "every 9 days", 480], ["EL-4712", "Twin & Earth 2.5mm 100m", "every 12 days", 164], ["AD-7102", "LM Silicone Clear 310ml", "every 14 days", 2880], ["LT-8120", "LED Batten 5ft 40W", "monthly", 520], ["EL-4408", "Industrial Cable 100m", "every 16 days", 212]]
      : DB.products.filter((p) => ["Dead", "Slow"].indexOf(p.health) < 0).sort(() => rnd() - .5).slice(0, 5).map((p) => [p.sku, p.name, ["weekly", "every 2 weeks", "monthly", "every 10 days"][Math.floor(rnd() * 4)], Math.round(20 + rnd() * 400)]);
    const summary = isM
      ? "Murphy Building Supplies' spend is up 12.4% YTD. Electrical products account for most of the growth. They have not purchased Safety & PPE products in 74 days despite previously ordering monthly. Estimated opportunity €4,800 to €6,200."
      : c.id === "ryan" ? "Ryan Trade Supplies normally buys M10 hex bolts every 18 to 24 days; the last order was 47 days ago. Spend is down 28% over 90 days, almost all of it in fixings. That line was worth €2,840 a month: €34,080 a year at risk if it has gone to a competitor."
      : c.id === "doyle" ? "Doyle Construction is €7,320 from its limit with €21,200 overdue, the oldest being INV-28482 at 61 days. Order volume is steady; payment timing is not. The Hansfield project is live, so a hard stop would hurt a growing account."
      : c.id === "obrien" ? "O'Brien Facilities is up 9.2% this year and is tendering a 5-site supply agreement. Their margin is already below the book at 21.7%, and QT-2841 would take the agreement to 17.2%."
      : DB.custName(c.id) + " is " + c.health.toLowerCase() + " (" + (c.trend > 0 ? "+" : "") + c.trend + "% on last year). " + (c.otif < 94 ? "OTIF is below target at " + c.otif + "%, mostly on supplier-dependent lines. " : "Service is in good shape at " + c.otif + "% OTIF. ") + (c.out / c.limit > .7 ? "Balance is " + Math.round(100 * c.out / c.limit) + "% of limit." : "Credit headroom is comfortable.");
    const oppLabel = isM ? "Create opportunity" : c.id === "ryan" ? "Assign follow-up" : "Create opportunity";
    return UI.Page({
      back: back(ctx), kicker: "Customer · " + c.tier + " account · since " + c.since,
      title: c.name, sub: c.type + " · " + c.area + " · " + c.priceList,
      actions: [UI.Badge(c.health.toUpperCase(), c.health === "Growing" ? "ok" : c.health === "Stable" ? "neutral" : "bad", true), UI.Btn("What should " + DB.person(c.am).split(" ")[0] + " say?", () => ctx.ask("What should " + DB.person(c.am).split(" ")[0] + " call customers about today?"), { sm: true, icon: "spark" })],
      children: [
        UI.Facts([["Account manager", DB.person(c.am)], ["Revenue YTD", eur(c.ytd), null, (c.trend > 0 ? "+" : "") + c.trend + "% on last year"], ["Gross margin", c.gm + "%", c.gm < 22 ? "warn" : null], ["Outstanding", eur(c.out), c.out / c.limit > .8 ? "bad" : null], ["Credit limit", eur(c.limit), null, Math.round(100 * c.out / c.limit) + "% used"], ["Orders YTD", String(c.orders)], ["Average order", eur(c.avg)], ["OTIF", c.otif + "%", c.otif < 94 ? "warn" : "ok"]], 8),
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.3fr) minmax(0,1fr)", [
          UI.AI({ who: "Customer Agent · account summary", text: summary,
            actions: [UI.Btn(oppLabel, () => ctx.act("opp-" + c.id, oppLabel === "Assign follow-up" ? "Follow-up assigned" : "Opportunity created", c.name + (isM ? ": PPE range, €4,800 to €6,200 now and €22,000 to €34,000 a year, assigned to Sarah Byrne." : ": assigned to " + DB.person(c.am) + ", due Friday.")), { pri: true, sm: true, done: ctx.done("opp-" + c.id), doneLabel: "Created" }), UI.Btn("Draft email", () => ctx.act("mail-" + c.id, "Draft ready", "In " + DB.person(c.am) + "'s Outlook."), { sm: true, done: ctx.done("mail-" + c.id), doneLabel: "Drafted" })] }),
          UI.Card({ title: "Purchase history", icon: "spark", meta: "12 MONTHS", delay: 60 }, UI.Columns(monthly.map((v, i) => ({ l: PD.date.MS[new Date(PD.date.TODAY.getFullYear(), PD.date.TODAY.getMonth() - 11 + i, 1).getMonth()].slice(0, 1), v, d: eur(v), hi: i === 11 })), { h: 118 }))
        ]),
        UI.Grid("minmax(0,1.4fr) minmax(0,1fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Current orders", meta: orders.length + " OPEN · " + eur(orders.reduce((a, o) => a + o.value, 0)), delay: 80 }, orders.length ? UI.Table({ rows: orders, rowKey: (o) => o.id, onRow: (o) => ctx.open("order", o.id), cols: [
            { label: "Order", w: "92px", render: (o) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, o.id) },
            { label: "Value", w: "84px", r: true, num: true, render: (o) => eur(o.value) },
            { label: "Status", w: "minmax(110px,1fr)", render: (o) => UI.Badge(o.status, PD.ord.STATUS_TONE[o.status] || "neutral") },
            { label: "Risk", w: "84px", render: (o) => UI.Risk(o.risk) }] }) : UI.Empty("No open orders.")),
          UI.Card({ title: "Spend by category", icon: "box", meta: "YTD", delay: 100 }, [
            UI.HBars(mix.map((m) => ({ label: m[0], v: m[1], d: m[1] ? m[1] + "%" : "none", tone: m[1] === 0 ? "bad" : null })), { tpl: "minmax(110px,1fr) 1fr 44px", max: 50 }),
            isM ? UI.Note("No PPE in 74 days. 68% of similar builders' merchants buy PPE from us.", { marginTop: 8, color: "var(--warn)" }) : null]),
          UI.Card({ title: "Frequently purchased", icon: "cart", delay: 120 }, freq.map((f) => UI.Row({ key: f[0], onClick: DB.product(f[0]) ? () => ctx.open("product", f[0]) : null }, [h("div", { className: "pd-grow" }, h("div", { className: "pd-ell", style: { fontSize: 12.5 } }, f[1]), h("div", { className: "pd-meta", style: { marginTop: 2 } }, f[0] + " · " + f[2].toUpperCase())), h("span", { className: "pd-mono", style: { fontSize: 11 } }, num(f[3]) + "/yr")])))
        ]),
        UI.Grid("repeat(3,minmax(0,1fr))", [
          UI.Card({ title: "Open quotes", icon: "doc", meta: quotes.length + " · " + eur(quotes.reduce((a, q) => a + q.value, 0)), delay: 140 }, quotes.length ? quotes.map((q) => UI.Row({ key: q.id, onClick: () => ctx.open("quote", q.id) }, [h("span", { className: "pd-mono", style: { fontSize: 12 } }, q.id), h("span", { className: "pd-grow", style: { fontSize: 12, color: "var(--dim)" } }, q.status), h("span", { className: "pd-mono", style: { fontSize: 12 } }, eur(q.value))])) : UI.Empty("No open quotes.")),
          UI.Card({ title: "Outstanding invoices", icon: "euro", meta: eur(c.out), delay: 160 }, invoices.length ? invoices.map((i) => UI.Row({ key: i.id }, [h("span", { className: "pd-mono", style: { fontSize: 12 } }, i.id), h("span", { className: "pd-grow", style: { fontSize: 12, color: i.status === "Overdue" ? "var(--bad)" : "var(--dim)" } }, i.days + " days · " + i.status), h("span", { className: "pd-mono", style: { fontSize: 12 } }, eur(i.value))]))
            : [UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 12, color: "var(--dim)" } }, "Current, within " + c.terms), h("span", { className: "pd-mono", style: { fontSize: 12 } }, eur(c.out))]), UI.Note("Detail syncs from Sage 200 nightly.", { marginTop: 6 })]),
          UI.Card({ title: "Deliveries", icon: "truck", meta: "LAST 90 DAYS", delay: 180 }, [
            UI.Facts([["Deliveries", String(Math.round(c.orders / 3))], ["OTIF", c.otif + "%", c.otif < 94 ? "warn" : "ok"], ["Late", String(Math.round(c.orders / 3 * (1 - c.otif / 100)))]], 3),
            UI.Note(isM ? "Both late deliveries this quarter were Atlas lines. D14 is their usual route." : "Usual route: " + (orders.find((o) => o.route) || { route: "D11" }).route + ".", { marginTop: 10 })])
        ]),
        UI.Grid("repeat(3,minmax(0,1fr))", [
          UI.Card({ title: "Returns", icon: "return", meta: rets.length + " THIS QUARTER", delay: 200 }, rets.length ? rets.map((r) => UI.Row({ key: r.id }, [h("span", { className: "pd-mono", style: { fontSize: 12 } }, r.id), h("span", { className: "pd-grow", style: { fontSize: 12, color: "var(--dim)" } }, r.reason + " · " + r.sku), h("span", { className: "pd-mono", style: { fontSize: 12 } }, eur(r.value, 2))])) : UI.Empty("No returns this quarter.")),
          UI.Card({ title: "Contacts", icon: "user", delay: 220 }, c.contacts.map((p) => UI.Row({ key: p[0] }, [UI.Avatar(p[0].split(" ").map((w) => w[0]).join("")), h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, p[0]), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, p[1])), h("span", { className: "pd-mono", style: { fontSize: 11 } }, p[2])]))),
          UI.Card({ title: isM ? "Opportunities" : "Activity", icon: isM ? "spark" : "clock", delay: 240 }, isM ? [
            UI.Row({}, [h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "Lapsed PPE spend"), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, "Ordered monthly until 74 days ago")), h("span", { className: "pd-mono", style: { fontSize: 12 } }, "€4.8k to €6.2k")]),
            UI.Row({}, [h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "Full PPE range at peer level"), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, "Similar customers: 68% penetration")), h("span", { className: "pd-mono", style: { fontSize: 12 } }, "€22k to €34k/yr")]),
            UI.Row({}, [h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "Contract repricing, EuroFix M10"), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, "Still on €21.20 against a €18.10 cost")), h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--warn)" } }, "Margin")])
          ] : UI.Feed(DB.activity.filter((a) => a[4] && (a[4][1] === c.id || orders.some((o) => o.id === a[4][1]))).slice(0, 4).map((a) => ({ t: a[0], tone: a[5], text: [B(a[2]), " ", a[3]] })).concat([{ t: "Mon", tone: "neutral", text: [B(DB.person(c.am)), " logged a call: " + (c.trend < 0 ? "customer says a competitor is cheaper on fixings." : "no issues, next order expected this week.")] }])))
        ])
      ]
    });
  };

  /* ================================================================ PRODUCT */
  PD.records.product = function (ctx, sku) {
    const p = DB.product(sku) || DB.products[0], L = PD.lk(ctx), s = DB.supplier(p.supplier), isC = p.sku === "EL-4408";
    const margin = (p.price - p.cost) / p.price * 100;
    const healthTone = { Critical: "bad", Low: "warn", Healthy: "ok", Excess: "warn", Slow: "warn", Dead: "bad" }[p.health];
    const dub = p.wh === "DUB" ? [p.onHand, p.avail, p.alloc] : (p.dub || [0, 0, 0]);
    const nas = p.naas || [0, 0, 0];
    const depOrders = isC ? [["SO-10482", "murphy", 28, rel(D(1)), "Short · PO-8821 or substitute", "bad"], ["SO-10493", "tallaght", 6, "Today", "Short · 4 in bin, 2 on transfer", "bad"], ["SO-10509", "harbour", 12, rel(D(3)), "Short · Naas transfer", "warn"], ["SO-10515", "leinster", 8, rel(D(3)), "Short · Naas transfer", "warn"], ["SO-10491", "westbrook", 2, "Today", "Allocated", "ok"], ["SO-10528", "horizon", 2, rel(D(3)), "Allocated, exposed if the recount fails", "warn"]] : [];
    const weeks = ["Now", "Wk 1", "Wk 2", "Wk 3", "Wk 4", "Wk 5", "Wk 6"];
    const proj = isC ? { base: [12, -20, 68, 36, 4, -28, -60], act: [12, 32, 100, 68, 36, 164, 132] } : null;
    const recText = {
      Critical: "Reorder today. Available stock covers " + p.cover + " against a " + p.lead + "-day lead time.",
      Low: "Reorder in the next buying run; cover is below the reorder point.",
      Healthy: "No action. Cover is inside the target band.",
      Excess: "Stop automatic replenishment and reduce the next order quantity.",
      Slow: "Target the customers who bought it last year, or move it to the site that sells it.",
      Dead: "No movement in " + (p.idle || 180) + " days. Return to supplier if the terms allow, otherwise bundle or promote."
    }[p.health];
    return UI.Page({
      back: back(ctx), kicker: "SKU · " + p.sku + " · " + p.cat,
      title: p.name, sub: "Supplier " + s.name + " · lead time " + p.lead + " days · MOQ " + p.moq + (p.bin ? " · bin " + p.bin : ""),
      actions: [UI.Badge(p.health.toUpperCase(), healthTone, true), UI.Btn("Ask about this SKU", () => ctx.ask("What should we buy today?"), { sm: true, icon: "spark" })],
      children: [
        UI.Facts([["On hand", num(p.onHand)], ["Available", num(p.avail), p.avail < p.safety ? "bad" : null], ["Allocated", num(p.alloc)], ["Incoming", num(p.incoming), null, p.po || "No open PO"], ["Avg weekly demand", p.weekly + "/wk"], ["Days cover", p.cover, healthTone === "bad" ? "bad" : null], ["Reorder point", num(p.rop)], ["Margin", margin.toFixed(1) + "%", null, eur(p.cost, 2) + " → " + eur(p.price, 2)]], 8),
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.3fr) minmax(0,1fr)", [
          UI.Card({ title: isC ? "Projected stock, Dublin" : "Stock by warehouse", icon: "box", meta: isC ? "NEXT 6 WEEKS · WITH AND WITHOUT ACTION" : "", delay: 40 }, isC ? [
            UI.Lines(weeks, [{ name: "If nothing changes", values: proj.base, color: "var(--bad)", dash: true }, { name: "With transfer + recommended PO", values: proj.act, color: "var(--accent)", area: true }], { h: 170, hline: 48, min: -60, max: 170, marks: [{ i: 1, label: "STOCKOUT IN 3 DAYS", tone: "bad" }] }),
            UI.Note("Dashed amber line is safety stock (48). PO-8821 lands 120 in week 2; without a new order the next Atlas delivery is 28 days out.", { marginTop: 10 })
          ] : UI.Table({ rows: [["Dublin", dub], ["Naas", nas]], rowKey: (r) => r[0], cols: [
            { label: "Warehouse", w: "1fr", ink: true, render: (r) => r[0] }, { label: "On hand", w: "90px", r: true, num: true, render: (r) => num(r[1][0]) },
            { label: "Available", w: "90px", r: true, num: true, render: (r) => num(r[1][1]) }, { label: "Allocated", w: "90px", r: true, num: true, render: (r) => num(r[1][2]) }] })),
          h("div", null,
            UI.AI({ who: isC ? "Inventory Agent" : "Pulse recommends", conf: isC ? "STOCKOUT IN 3 DAYS" : null, text: isC ? "Existing incoming PO does not provide sufficient cover against expected demand. Order 160 units today, and move 40 from Naas on the 14:00 shuttle to protect this week's orders." : recText,
              actions: isC ? [UI.Btn("Approve transfer", () => ctx.act("dq-transfer", "Transfer approved", "40 × EL-4408 on the 14:00 Naas shuttle. 3 orders (€12,460) protected."), { pri: true, sm: true, done: ctx.done("dq-transfer"), doneLabel: "Transfer approved" }), UI.Btn("Create purchase order", () => ctx.act("po-el4408", "PO drafted", "PO-8846 · 160 × EL-4408 from EuroCable (9-day lead). Waiting for Emma Walsh."), { sm: true, done: ctx.done("po-el4408"), doneLabel: "PO drafted" })]
                : p.health === "Critical" || p.health === "Low" ? [UI.Btn("Create purchase order", () => ctx.act(p.sku === "FH-6710" ? "po-fh6710" : "po-" + p.sku, "PO drafted", p.sku + " · " + Math.max(p.moq, p.weekly * 4) + " units from " + s.name + ". Waiting for approval."), { pri: true, sm: true, done: ctx.done(p.sku === "FH-6710" ? "po-fh6710" : "po-" + p.sku), doneLabel: "PO drafted" })]
                : ["Excess", "Slow", "Dead"].indexOf(p.health) > -1 ? [UI.Btn("Stop replenishment", () => ctx.act("stop-" + p.sku, "Replenishment stopped", p.sku + " removed from automatic reordering."), { pri: true, sm: true, done: ctx.done("stop-" + p.sku), doneLabel: "Stopped" }), UI.Btn("Slow & dead stock", () => ctx.go("Inventory", "Slow & Dead Stock"), { sm: true })] : null }),
            isC ? h("div", { style: { marginTop: 14 } }, UI.Card({ title: "Transfer between warehouses", icon: "swap", delay: 80 }, [
              UI.Facts([["Dublin available", "12", "bad"], ["Naas available", "64"], ["Dublin demand, 7 days", "58"], ["Naas demand, 7 days", "11"]], 4),
              UI.P(["Pulse recommendation: ", B("transfer 40 units from Naas → Dublin"), ". Avoids 1 stockout, protects 3 orders worth ", B("€12,460"), "."], { marginTop: 12 })
            ])) : null)
        ]),
        isC ? UI.Grid("minmax(0,1fr) minmax(0,1fr)", [
          UI.Card({ title: "Substitute product", icon: "swap", meta: "WHEN THE ORIGINAL IS UNAVAILABLE", delay: 120 }, [
            UI.Table({ rows: [0], rowKey: () => "s", onRow: () => ctx.open("product", "EL-4412"), cols: [
              { label: "Original", w: "1fr", render: () => h("span", null, "EL-4408 · ", h("span", { style: { color: "var(--bad)" } }, "28 unavailable")) },
              { label: "Substitute", w: "1.2fr", ink: true, render: () => "EL-4412 Industrial Cable Pro 100m" },
              { label: "Available", w: "76px", r: true, num: true, render: () => "84" },
              { label: "Price diff", w: "84px", r: true, num: true, render: () => "+€8.40" },
              { label: "Margin", w: "66px", r: true, num: true, render: () => "26.1%" }] }),
            h("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 12 } }, UI.Badge("APPROVED SUBSTITUTE", "ok", true), h("span", { className: "pd-grow" }), UI.Btn("Offer substitute", () => ctx.act("sub-el4412", "Substitute offered", "Murphy Building Supplies offered 28 × EL-4412 at +€8.40 a reel."), { sm: true, pri: true, done: ctx.done("sub-el4412"), doneLabel: "Offered" }))
          ]),
          UI.Card({ flush: true, title: "Customer orders affected", meta: "6 ORDERS · 58 UNITS IN 7 DAYS · 4 SHORT", delay: 140 }, UI.Table({ rows: depOrders, rowKey: (r) => r[0], onRow: (r) => ctx.open("order", r[0]), rowTone: (r) => r[5] === "bad" ? "bad" : null, cols: [
            { label: "Order", w: "92px", render: (r) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, r[0]) },
            { label: "Customer", w: "minmax(150px,1.3fr)", ink: true, render: (r) => DB.custName(r[1]) },
            { label: "Qty", w: "48px", r: true, num: true, render: (r) => r[2] },
            { label: "Due", w: "80px", render: (r) => r[3] },
            { label: "Status", w: "minmax(150px,1.3fr)", render: (r) => h("span", { style: { color: PD.TONE[r[5]].fg } }, r[4]) }] }))
        ]) : null,
        UI.Card({ flush: true, title: isC ? "Procurement decision: who should supply it" : "Supplier", meta: isC ? "CHEAPEST IS NOT ALWAYS BEST WHEN STOCK RISK IS HIGH" : s.name.toUpperCase(), delay: 160 }, isC ? [
          UI.Table({ rows: [
            ["atlas", "€21.40", "28 days", "100", "86.2%", "500", "EUR", "€22.10", false],
            ["eurocable", "€22.20", "9 days", "50", "97.8%", "800", "EUR", "€22.55", true]
          ], rowKey: (r) => r[0], sel: (r) => r[8], onRow: (r) => ctx.open("supplier", r[0]), cols: [
            { label: "Supplier", w: "minmax(180px,1.4fr)", ink: true, render: (r) => DB.supplier(r[0]).name },
            { label: "Unit cost", w: "84px", r: true, num: true, render: (r) => r[1] }, { label: "Lead time", w: "84px", r: true, num: true, render: (r) => r[2] },
            { label: "MOQ", w: "60px", r: true, num: true, render: (r) => r[3] }, { label: "OTIF", w: "66px", r: true, num: true, render: (r) => h("span", { style: { color: r[8] ? "var(--ok)" : "var(--bad)" } }, r[4]) },
            { label: "Available", w: "80px", r: true, num: true, render: (r) => r[5] }, { label: "Currency", w: "74px", render: (r) => r[6] },
            { label: "Landed cost", w: "96px", r: true, num: true, ink: true, render: (r) => r[7] },
            { label: "", w: "210px", render: (r) => r[8] ? UI.Badge("RECOMMENDED WHEN STOCK RISK IS HIGH", "info", true) : UI.Badge("CHEAPER, 19 DAYS SLOWER", "neutral", true) }] }),
          h("div", { style: { padding: "12px 20px 16px" } }, UI.Note("EuroCable costs €0.45 more landed per reel: €72 on 160 units. Waiting for Atlas leaves Dublin short for 19 days, with €12,460 of orders exposed this week alone."))
        ] : [h("div", { style: { padding: "0 20px 16px" } }, UI.Facts([["Supplier", s.name], ["OTIF", s.otif + "%", s.otif < 90 ? "bad" : s.otif < 94 ? "warn" : "ok"], ["Lead time", p.lead + " days"], ["Unit cost", eur(p.cost, 2)], ["Status", s.status, s.tone]], 5), h("div", { style: { marginTop: 10 } }, UI.Btn("Open supplier", () => ctx.open("supplier", s.id), { sm: true })))])
      ]
    });
  };

  /* ================================================================ PURCHASE ORDER */
  function ReceiptSim(props) {
    const [step, setStep] = R.useState(props.done ? 5 : -1);
    R.useEffect(() => {
      if (step < 0 || step >= 5) return undefined;
      const t = setTimeout(() => setStep(step + 1), 650);
      return () => clearTimeout(t);
    }, [step]);
    const nodes = [
      { k: "Goods received", t: "Goods in, bay 1", d: "740 units, 14 SKUs checked" },
      { k: "Inventory updated", t: "EL-4408 +120 · EL-4631 +400 · IC-3310 +200", d: "Sage 200 and the WMS" },
      { k: "Backorders released", t: "6 orders, €41,880", d: "Short lines re-allocated" },
      { k: "Pick tasks created", t: "11 pick tasks", d: "Ahead of the 13:30 cut-off" },
      { k: "Customers updated", t: "6 emails sent", d: "From each account manager" }
    ].map((n, i) => Object.assign(n, { tone: step > i ? "ok" : step === i ? "info" : null }));
    return h("div", null,
      UI.HChain(nodes, { stagger: 0 }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12 } },
        UI.Btn(step >= 5 ? "Receipt simulated" : step >= 0 ? "Receiving…" : "Simulate receipt", () => { if (step < 0) { setStep(0); props.onStart && props.onStart(); } }, { pri: step < 0, sm: true, done: step >= 5, doneLabel: "Receipt simulated" }),
        h("span", { className: "pd-note" }, "What happens the moment PO-8821 is booked in. Nobody has to tell anyone.")));
  }

  PD.records.po = function (ctx, id) {
    const p = DB.po(id) || DB.pos[0], s = DB.supplier(p.supplier), L = PD.lk(ctx), isK = p.id === "PO-8821";
    const deps = (p.depOrders || []).map((oid) => DB.order(oid));
    const statusTone = /Late|risk/i.test(p.status) ? "bad" : /today|Received/i.test(p.status) ? "ok" : "neutral";
    const lines = isK ? p.lines.concat([["EL-4815", "Galvanised Trunking 50x50 3m", 300, 10.20], ["EL-4820", "Cable Tray 150mm 3m", 120, 19.60], ["IC-3650", "Pallet Wrap 500mm Cast (6)", 0, 14.20], ["EL-4301", "Metal Clad Double Socket", 600, 4.60], ["EL-4330", "Weatherproof Switch IP66", 240, 7.80], ["IC-3144", "Flap Disc 115mm 80 grit (10)", 160, 12.10], ["EL-4905", "Cable Drum Stand", 20, 64.00], ["IC-3502", "Spray Marker Fluoro Red 500ml", 240, 3.20], ["EL-4640", "SWA Cable Gland 25mm (10)", 200, 8.90], ["IC-3318", "Cable Ties 200mm (1000)", 300, 9.40], ["EL-4822", "Cable Tray 300mm 3m", 180, 21.19]]).filter((l) => l[2] > 0) : [];
    return UI.Page({
      back: back(ctx), kicker: "Purchase order · " + p.id,
      title: p.id + " · " + s.name,
      sub: "Raised by " + DB.person(p.buyer) + " · for " + DB.warehouses[p.wh].name + (p.note ? " · " + p.note : ""),
      actions: [UI.Badge(p.status.toUpperCase(), statusTone, true), UI.Risk(p.risk)],
      children: [
        UI.Facts([["Value", eur(p.value)], ["Items", p.items + " SKUs"], ["Order date", dm(D(p.ordered))], ["Promised", dm(D(p.promised))], ["Expected", rel(D(p.expected)) + (p.eta ? " " + p.eta : ""), p.lateDays ? "bad" : null], ["Warehouse", DB.warehouses[p.wh].short], ["Customer orders dependent", String(p.deps), p.deps ? "warn" : null], ["Risk", p.risk, PD.riskTone(p.risk)]], 8),
        h("div", { style: { height: 14 } }),
        isK ? UI.Card({ title: "Supplier delay, traced through the business", icon: "link", meta: "EVERY RECORD THIS PO TOUCHES", delay: 40 }, UI.HChain([
          { k: "Purchase order", t: "PO-8821 · 5 days late", d: "€38,640 · 14 SKUs", tone: "bad" },
          { k: "Inventory", t: "3 SKUs at zero cover", d: "EL-4408 · EL-4631 · IC-3310", tone: "bad", onClick: () => ctx.open("product", "EL-4408") },
          { k: "Backorders", t: "10 short lines", d: "Released on receipt", tone: "warn", onClick: () => ctx.go("Orders", "Backorders") },
          { k: "Customers", t: "6 accounts", d: "Murphy, Horizon, Liffey +3", tone: "warn", onClick: () => ctx.open("customer", "murphy") },
          { k: "Warehouse", t: "D14 held for SO-10482", d: "Cut-off 13:30", onClick: () => ctx.go("Warehouse", "Dispatch") },
          { k: "Delivery", t: "3 drops at risk today", d: "Route D14", tone: "warn", onClick: () => ctx.open("route", "D14") },
          { k: "Revenue at risk", t: "€41,880", d: "OTIF on Atlas lines 81.4%", tone: "bad", onClick: () => ctx.go("Delivery", "OTIF") }
        ])) : null,
        isK ? h("div", { style: { height: 14 } }) : null,
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Customer orders depending on this PO", meta: p.deps ? p.deps + " ORDERS · " + eur(p.depValue || 0) : "NONE", delay: 60 }, deps.length ? UI.Table({ rows: deps, rowKey: (o) => o.id, onRow: (o) => ctx.open("order", o.id), rowTone: (o) => o.risk === "HIGH" ? "bad" : null, cols: [
            { label: "Order", w: "92px", render: (o) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, o.id) },
            { label: "Customer", w: "minmax(170px,1.4fr)", ink: true, render: (o) => L.cust(o.cust) },
            { label: "Value", w: "84px", r: true, num: true, render: (o) => eur(o.value) },
            { label: "Waiting on", w: "minmax(150px,1.3fr)", render: (o) => o.reasonDetail },
            { label: "Due", w: "80px", render: (o) => rel(D(o.req)) },
            { label: "Risk", w: "84px", render: (o) => UI.Risk(o.risk) }] }) : UI.Empty(p.deps ? p.deps + " orders are waiting on this delivery; they release automatically on receipt." : "No customer orders depend on this PO. It is replenishment stock.")),
          h("div", null,
            isK ? UI.AI({ who: "Purchasing Agent", conf: "€420 TO SAVE 3 HOURS", text: "Atlas can put the three short SKUs on a dedicated van for 07:30 instead of 10:30 for €420. That gets Murphy's balance onto D14's first run, and the other five orders out the same morning.",
              actions: [UI.Btn("Expedite supplier", () => ctx.act("dq-expedite", "Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight."), { pri: true, sm: true, done: ctx.done("dq-expedite"), doneLabel: "Expedite requested" }), UI.Btn("Draft 6 customer updates", () => ctx.act("po-notify", "6 updates drafted", "One per account manager, with today's lines and tomorrow's ETA."), { sm: true, done: ctx.done("po-notify"), doneLabel: "Drafted" }), UI.Btn("Open Atlas", () => ctx.open("supplier", "atlas"), { sm: true, ghost: true })] })
              : UI.AI({ who: "Pulse", text: p.lateDays ? s.name + " is " + p.lateDays + " days late on this PO. " + (p.deps ? p.deps + " customer orders wait on it." : "No customer order is waiting on it yet.") : /today/i.test(p.status) ? "Due into goods in today at " + p.eta + ". " + (p.deps ? p.deps + " orders release on receipt." : "") : "On time. Nothing to do.", actions: p.lateDays ? [UI.Btn("Chase supplier", () => ctx.act("chase-" + p.id, "Chase sent", s.contact + " emailed for a firm date."), { sm: true, pri: true, done: ctx.done("chase-" + p.id), doneLabel: "Chased" })] : null }),
            h("div", { style: { height: 14 } }),
            UI.Card({ title: "Supplier timeline", icon: "clock", delay: 120 }, UI.Feed((isK ? [
              [dm(D(-10)), "PO sent by EDI; Atlas confirmed all 14 lines", "ok"],
              [dm(D(-8)), "Atlas confirmed delivery for " + dm(D(-5)), "neutral"],
              [dm(D(-5)), "Promised date missed; no advance notice", "bad"],
              [dm(D(-3)), "Atlas: \"stock in transit from UK hub\", new date " + dm(D(-1)), "warn"],
              ["09:04", "Atlas portal: expected " + relLower(D(1)) + " 10:30 (second change)", "warn"]
            ] : [[dm(D(p.ordered)), "PO sent to " + s.name, "ok"], [dm(D(p.ordered + 1)), "Confirmed for " + dm(D(p.promised)), "neutral"]].concat(p.lateDays ? [[dm(D(p.promised)), "Promised date missed", "bad"]] : [])).map((t) => ({ t: "", tone: t[2], text: [h("span", { className: "pd-meta", style: { marginRight: 6 } }, t[0]), t[1]] })))))
        ]),
        isK ? UI.Card({ title: "When the stock lands", icon: "bolt", meta: "GOODS RECEIVED → CUSTOMERS UPDATED", delay: 140 }, h(ReceiptSim, { done: ctx.done("po-recv"), onStart: () => setTimeout(() => ctx.act("po-recv", "PO-8821 received (simulated)", "Inventory, 6 backorders, 11 pick tasks and 6 customer emails updated."), 3300) })) : null,
        isK ? h("div", { style: { height: 14 } }) : null,
        isK ? UI.Card({ flush: true, title: "PO lines", meta: lines.length + " SKUS · " + eur(p.value), delay: 180 }, UI.Table({ rows: lines, rowKey: (l) => l[0], onRow: (l) => DB.product(l[0]) ? ctx.open("product", l[0]) : null, rowTone: (l) => ["EL-4408", "EL-4631", "IC-3310"].indexOf(l[0]) > -1 ? "bad" : null, cols: [
          { label: "SKU", w: "92px", render: (l) => h("span", { className: "pd-mono", style: { fontSize: 11.5, color: "var(--ink)" } }, l[0]) },
          { label: "Product", w: "minmax(200px,2fr)", ink: true, render: (l) => l[1] },
          { label: "Qty", w: "70px", r: true, num: true, render: (l) => num(l[2]) },
          { label: "Unit cost", w: "84px", r: true, num: true, render: (l) => eur(l[3], 2) },
          { label: "Line", w: "96px", r: true, num: true, render: (l) => eur(l[2] * l[3], 2) },
          { label: "", w: "150px", render: (l) => ["EL-4408", "EL-4631", "IC-3310"].indexOf(l[0]) > -1 ? UI.Badge("CUSTOMERS WAITING", "bad", true) : null }] })) : null
      ]
    });
  };

  /* ================================================================ SUPPLIER */
  PD.records.supplier = function (ctx, id) {
    const s = DB.supplier(id) || DB.suppliers[0], L = PD.lk(ctx), isA = s.id === "atlas";
    const pos = DB.pos.filter((p) => p.supplier === s.id);
    const rnd = seed(s.id);
    const trend = Array.from({ length: 12 }, (_, i) => +(s.otif + (isA ? (11 - i) * .55 : (rnd() - .5) * 3) - (isA ? 3 : 0)).toFixed(1));
    trend[11] = s.otif;
    return UI.Page({
      back: back(ctx), kicker: "Supplier · " + s.country + " · " + s.ccy,
      title: s.name, sub: s.cat + " · " + s.terms + " terms · " + s.contact + " · buyer " + DB.person(s.buyer),
      actions: [UI.Badge(s.status.toUpperCase(), s.tone, true), UI.Btn("Which supplier is causing the most disruption?", () => ctx.ask("Which supplier is causing the most disruption?"), { sm: true, icon: "spark" })],
      children: [
        UI.Facts([["Annual spend", eurK(s.spend)], ["OTIF", s.otif + "%", s.otif < 90 ? "bad" : s.otif < 94 ? "warn" : "ok"], ["Fill rate", s.fill + "%"], ["Average delay", s.delay + " days", s.delay > 2 ? "bad" : null], ["Quality issues", String(s.quality), s.quality > 4 ? "warn" : null], ["Returns", String(s.returns)], ["Price changes", String(s.priceChanges), null, "Last 12 months"], ["Lead time accuracy", s.leadAcc + "%", s.leadAcc < 85 ? "warn" : null], ["Open claims", String(s.claims)], ["Orders affected YTD", String(s.affected), s.affected > 50 ? "bad" : null]], 5),
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.3fr) minmax(0,1fr)", [
          UI.Card({ title: "OTIF, last 12 months", icon: "spark", meta: "TARGET 95%", delay: 40 }, UI.Lines(Array.from({ length: 12 }, (_, i) => PD.date.MS[new Date(PD.date.TODAY.getFullYear(), PD.date.TODAY.getMonth() - 11 + i, 1).getMonth()]), [{ name: "OTIF", values: trend, color: s.otif < 90 ? "var(--bad)" : "var(--accent)", area: true }], { h: 160, hline: 95, min: Math.min(80, Math.min.apply(null, trend) - 2), max: 100 })),
          UI.AI({ who: "Purchasing Agent", conf: isA ? "RECOMMEND REVIEW" : null, text: isA
            ? "Atlas has slipped from 92% to 86.2% OTIF in a year and affected 126 customer orders. Two POs are late now and a third moved this morning. Dual-source the cable lines to EuroCable (97.8% OTIF, 9-day lead, €0.45 more landed) and keep Atlas for consumables. Raise the EL-4631 mis-packs and the brittle IC-3310 batch at the quarterly review."
            : s.name + " is running at " + s.otif + "% OTIF with " + s.affected + " customer orders affected this year. " + (s.status === "Watch pricing" ? "Pricing is the issue, not service: " + s.priceChanges + " changes in 12 months." : s.otif >= 95 ? "No action needed." : "Worth raising at the next review."),
            actions: [UI.Btn(isA ? "Schedule supplier review" : "Log a review note", () => ctx.act("rev-" + s.id, "Review scheduled", s.name + ": review booked with " + DB.person(s.buyer) + " and Patrick Byrne for Tuesday."), { pri: true, sm: true, done: ctx.done("rev-" + s.id), doneLabel: "Scheduled" })] })
        ]),
        UI.Card({ flush: true, title: "Open purchase orders", meta: pos.length + " SHOWN · " + s.openPOs + " OPEN · " + eur(s.openValue), delay: 80 }, UI.Table({ rows: pos, rowKey: (p) => p.id, onRow: (p) => ctx.open("po", p.id), rowTone: (p) => p.lateDays ? "bad" : null, cols: [
          { label: "PO", w: "92px", render: (p) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, p.id) },
          { label: "Value", w: "90px", r: true, num: true, render: (p) => eur(p.value) },
          { label: "Items", w: "60px", r: true, num: true, render: (p) => p.items },
          { label: "Promised", w: "90px", render: (p) => dm(D(p.promised)) },
          { label: "Expected", w: "110px", render: (p) => rel(D(p.expected)) },
          { label: "Status", w: "minmax(120px,1fr)", render: (p) => UI.Badge(p.status, /Late|risk/i.test(p.status) ? "bad" : /today|Received/i.test(p.status) ? "ok" : "neutral") },
          { label: "Orders dependent", w: "120px", r: true, num: true, render: (p) => p.deps || "None" }] })),
        isA ? h("div", { style: { height: 14 } }) : null,
        isA ? UI.Grid("repeat(2,minmax(0,1fr))", [
          UI.Card({ title: "Recurring problems", icon: "alert", delay: 120 }, [
            UI.Row({ onClick: () => ctx.go("Delivery", "Delivery Issues") }, [UI.Dot("bad"), h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "EL-4631 glands mis-packed as 25mm"), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, "3 returns in 5 weeks: Horizon, Liffey and a counter sale"))]),
            UI.Row({ onClick: () => ctx.go("Delivery", "Delivery Issues") }, [UI.Dot("bad"), h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "IC-3310 cable ties from batch 24-311 brittle"), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, "Claim open for €412; Atlas has not responded in 9 days"))]),
            UI.Row({}, [UI.Dot("warn"), h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "Dates change without notice"), h("div", { style: { fontSize: 11.5, color: "var(--dim)" } }, "Lead time accuracy 74%; 11 date changes this quarter"))])
          ]),
          UI.Card({ title: "What depends on Atlas", icon: "link", delay: 140 }, [
            UI.Facts([["SKUs sourced", "412"], ["Sole-sourced", "96", "warn"], ["Revenue on those SKUs", "€2.9m a year"]], 3),
            UI.Note("Orders containing an Atlas line run at 81.4% OTIF against 94.2% overall.", { marginTop: 10 })
          ])
        ]) : null
      ]
    });
  };

  /* ================================================================ ROUTE */
  PD.records.route = function (ctx, id) {
    const r = DB.route(id) || DB.route("D14"), L = PD.lk(ctx);
    const isD14 = r.id === "D14", isD02 = r.id === "D02";
    const stops = isD14 ? DB.d14Stops : isD02 ? DB.d02Stops : (() => {
      const rnd = seed(r.id), pool = Object.keys(DB.minor).concat(DB.customers.map((c) => c.id));
      let t = 0; return Array.from({ length: r.stops }, (_, i) => { const st = i < r.delivered ? "Delivered" : i === r.delivered && /On route/.test(r.status) ? "Next" : "Scheduled"; return [pool[Math.floor(rnd() * pool.length)], "SO-10" + (440 + Math.floor(rnd() * 60)), Math.round(r.value / r.stops), st, "", ""]; });
    })();
    const partial = ctx.done("so-partial");
    const stTone = { Delivered: "ok", Next: "info", Scheduled: "neutral", "At risk": "warn" };
    return UI.Page({
      back: back(ctx), kicker: "Route · " + DB.warehouses[r.wh].name,
      title: "Route " + r.id.replace("·", " run ") + " · " + r.area,
      sub: "Driver " + DB.person(r.driver) + " · vehicle " + r.reg + " · departs " + r.depart + ", expected back " + r.finish,
      actions: [UI.Badge(isD14 && partial ? "LOADING 13:45" : r.status.toUpperCase(), /risk|Waiting|left/i.test(r.status) && !(isD14 && partial) ? "warn" : /On route/.test(r.status) ? "info" : "neutral", true)],
      children: [
        UI.Facts([["Driver", DB.person(r.driver)], ["Vehicle", r.reg], ["Stops", String(r.stops)], ["Order value", eur(r.value)], ["Departure", r.depart], ["Expected completion", r.finish], ["Delivered", r.delivered + " of " + r.stops], ["Route OTIF", r.otif + "%", r.otif < 94 ? "warn" : null]], 8),
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [
          UI.Card({ title: "Stops", icon: "route", meta: stops.length + " DROPS", delay: 40 }, UI.Chain(stops.map((s, i) => {
            const state = isD14 && partial && s[1] === "SO-10482" ? "Scheduled" : s[3];
            return { k: "Stop " + (i + 1) + (s[4] ? " · " + s[4] : ""), t: DB.custName(s[0]) + (s[5] ? " · " + s[5] : ""), d: s[1] + " · " + eur(s[2]) + (state === "At risk" ? " · " + (DB.order(s[1]) ? DB.order(s[1]).reasonDetail : "") : isD14 && partial && s[1] === "SO-10482" ? " · 15 of 18 lines, balance tomorrow" : ""), tone: stTone[state], icon: state === "Delivered" ? "check" : state === "At risk" ? "alert" : "pin", badge: UI.Badge(state, stTone[state]), onClick: DB.order(s[1]) ? () => ctx.open("order", s[1]) : undefined };
          }))),
          h("div", null,
            isD14 ? UI.AI({ who: "Dispatch Agent", text: partial ? "Murphy's 15 lines are on the manifest. D14 leaves on time at 13:45; the three short lines join tomorrow's first run." : "Leave at 13:45 with Murphy's 15 available lines rather than holding the van for Atlas. Holding it past 14:15 makes the last three drops late, and Brennan's order is still being picked.",
              actions: [UI.Btn("Approve partial shipment", () => ctx.act("so-partial", "Partial shipment approved", "15 lines released to D14. Murphy notified."), { pri: true, sm: true, done: partial, doneLabel: "Approved" }), UI.Btn("Open SO-10482", () => ctx.open("order", "SO-10482"), { sm: true })] })
              : UI.AI({ who: "Dispatch Agent", text: /left/.test(r.status) ? "N06 left two pallets for Glenview Maintenance behind at 07:40. The 14:00 Naas to Dublin shuttle has room and passes Kildare town." : r.delivered === r.stops ? "Route complete." : "Running to plan. " + (r.stops - r.delivered) + " drops left." }),
            h("div", { style: { height: 14 } }),
            UI.Card({ title: "Load", icon: "truck", delay: 100 }, [
              UI.Split([{ label: "Loaded", v: isD14 ? 8.6 : 7, color: "var(--accent)", d: isD14 ? "8.6 pallets" : "7 pallets" }, { label: "Space", v: isD14 ? 1.4 : 3, color: "var(--track)", d: isD14 ? "1.4" : "3" }]),
              UI.Note(isD14 ? "Payload 91%. The 3 short Murphy lines would add 0.4 of a pallet tomorrow." : "Within payload.", { marginTop: 10 })
            ]))
        ])
      ]
    });
  };

  /* ================================================================ QUOTE */
  PD.records.quote = function (ctx, id) {
    const q = DB.quote(id) || DB.quotes[0], c = DB.customer(q.cust), isO = q.id === "QT-2841";
    const cost = q.value * (1 - q.margin / 100), gp = q.value - cost;
    const priceAt = (m) => cost / (1 - m / 100);
    const countered = isO ? ctx.done("dq-obrien") : ctx.done("counter-" + q.id), approved = ctx.done("appr-" + q.id);
    const below = q.margin < q.target;
    return UI.Page({
      back: back(ctx), kicker: "Quote · " + q.id,
      title: q.id + " · " + c.name, sub: "Sales rep " + DB.person(q.am) + " · " + q.lines + " lines · " + q.age + (q.age === 1 ? " day" : " days") + " old" + (q.reason ? " · " + q.reason : ""),
      actions: [UI.Badge(approved ? "APPROVED AS QUOTED" : countered ? "COUNTER APPROVED" : q.status.toUpperCase(), approved || countered ? "ok" : below ? "warn" : "neutral", true)],
      children: [
        UI.Facts([["Customer", c.name], ["Revenue", eur(q.value)], ["Standard margin", q.target.toFixed(1) + "%"], ["Proposed margin", q.margin.toFixed(1) + "%", below ? "bad" : "ok"], ["Difference", (q.margin - q.target > 0 ? "+" : "") + (q.margin - q.target).toFixed(1) + " pts", below ? "bad" : "ok"], ["Sales rep", DB.person(q.am)], ["Approval", below ? (approved ? "Approved" : countered ? "Countered" : "Pending · " + DB.person(q.approver || "MD")) : "Not needed", below && !approved && !countered ? "warn" : null]], 7),
        h("div", { style: { height: 14 } }),
        isO ? UI.Card({ title: "Margin alert, followed to the source", icon: "link", meta: "WHY THIS QUOTE IS THIN", delay: 40 }, UI.HChain([
          { k: "Margin alert", t: "17.2% vs 24% target", d: "Flagged by the Margin Agent", tone: "bad" },
          { k: "Customer", t: "O'Brien Facilities", d: "21.7% margin YTD · growing 9.2%", onClick: () => ctx.open("customer", "obrien") },
          { k: "Quote", t: "QT-2841 · €18,420", d: "5-site FM agreement, first call-off" },
          { k: "Product pricing", t: "M10 bolts, cutting discs, T&E", d: "40% of the quote value", onClick: () => ctx.go("Pricing & Margin", "Price Lists") },
          { k: "Cost change", t: "3 supplier increases", d: "EuroFix +10.4% · Midland +8.9% · EuroCable +16%", tone: "warn", onClick: () => ctx.go("Pricing & Margin", "Cost Changes") },
          { k: "Approval", t: approved ? "Approved as quoted" : countered ? "Counter approved" : "Michael Doyle", d: approved || countered ? "Recorded" : "Due today 11:00", tone: approved || countered ? "ok" : "warn", onClick: () => ctx.go("Pricing & Margin", "Discount Approvals") }
        ])) : null,
        isO ? h("div", { style: { height: 14 } }) : null,
        UI.Grid("minmax(0,1.2fr) minmax(0,1fr)", [
          UI.Card({ title: "The price that hits target", icon: "tag", delay: 60 }, [
            ...[["As quoted", q.margin, q.value, below ? "bad" : "ok"], ["Pulse counter", Math.min(q.target, +(q.margin + (q.target - q.margin) * .63).toFixed(1)), priceAt(Math.min(q.target, +(q.margin + (q.target - q.margin) * .63).toFixed(1))), "info"], ["Standard margin", q.target, priceAt(q.target), "neutral"]].map((r, i) => UI.Row({ key: i }, [
              h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 13 } }, r[0]), h("div", { className: "pd-meta", style: { marginTop: 2 } }, r[1].toFixed(1) + "% MARGIN · GP " + eur(r[2] - cost))),
              h("span", { className: "pd-mono", style: { fontSize: 13, color: PD.TONE[r[3]].fg } }, eur(Math.round(r[2])))])),
            UI.Note("Cost basis " + eur(Math.round(cost)) + ", including this month's supplier increases." + (q.annual ? " Over the 12-month agreement (" + eur(q.annual) + ") the gap to target is " + eur(Math.round(q.annual * (q.target - q.margin) / 100)) + " of gross profit." : ""), { marginTop: 10 })
          ]),
          UI.AI({ who: "Margin Agent", conf: below ? "APPROVAL NEEDED" : null, text: below
            ? (isO ? "Counter at €19,429 (21.5%). It stays €639 under the target price, which David says is where the tender is, and recovers €1,009 of gross profit on this call-off. The discount is concentrated in fixings and cable, where our own costs rose this month." : "Counter at the Pulse price. It closes most of the gap without moving far from what the customer has already seen.")
            : "This quote is inside the margin band. No approval needed.",
            actions: below ? [
              UI.Btn("Counter at " + (isO ? "€19,429" : "Pulse price"), () => ctx.act(isO ? "dq-obrien" : "counter-" + q.id, "Counter approved", q.id + (isO ? " revised to €19,429 (21.5%)" : " revised") + " and sent to " + DB.person(q.am) + " to issue."), { pri: true, sm: true, done: countered, doneLabel: "Counter approved" }),
              UI.Btn("Approve as quoted", () => ctx.act("appr-" + q.id, "Approved as quoted", q.id + " approved by Michael Doyle at " + q.margin + "%. Logged against the price agreement."), { sm: true, done: approved, doneLabel: "Approved" }),
              UI.Btn("Reject", () => ctx.act("rej-" + q.id, "Quote rejected", q.id + " sent back to " + DB.person(q.am) + "."), { sm: true, ghost: true, done: ctx.done("rej-" + q.id), doneLabel: "Rejected" })] : null })
        ]),
        UI.Card({ title: "Account history", icon: "user", delay: 100, onClick: () => ctx.open("customer", c.id) },
          UI.Facts([["Revenue YTD", eur(c.ytd)], ["Margin YTD", c.gm + "%", c.gm < 22 ? "warn" : null], ["Trend", (c.trend > 0 ? "+" : "") + c.trend + "%"], ["Outstanding", eur(c.out)], ["OTIF", c.otif + "%"], ["Quotes won this year", isO ? "7 of 11" : "—"]], 6))
      ]
    });
  };
})();
