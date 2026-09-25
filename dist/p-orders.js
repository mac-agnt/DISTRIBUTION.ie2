/* Orders: the operational heart. Every row opens the order; every order shows its chain. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB, K = DB.kpi;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower } = PD.date;
  const B = UI.B;

  /* shared order helpers, also used by other modules */
  const STATUS_TONE = { "Part allocated": "warn", "Credit Hold": "bad", "Picking": "info", "Packed": "ok", "Allocated": "neutral", "New": "neutral", "Picking delayed": "bad", "Allocation failed": "bad", "Left at depot": "bad", "Missed cutoff": "warn", "Dispatched": "ok" };
  const stockTone = (s) => s === "Available" ? "ok" : /3 short|mismatch/i.test(s) ? "bad" : "warn";
  const todayRoutes = ["D14"];
  const deliveryLabel = (o) => {
    if (!o.route) return null;
    if (todayRoutes.indexOf(o.route) > -1 || o.req === 0 || o.id === "SO-10491") return "Route " + o.route;
    return o.route + " · " + rel(D(o.req));
  };
  const PROB = { "Stock shortage": .9, "Credit hold": .8, "Late supplier": .7, "Picking delay": .55, "Stock discrepancy": .6, "Vehicle capacity": .5, "Warehouse delay": .85 };
  const probOf = (o) => (o.transfer ? .45 : (PROB[o.reason] || .4)) * (o.req >= 3 ? .75 : 1);
  PD.ord = { STATUS_TONE, stockTone, deliveryLabel, probOf };

  const orderCols = (ctx, opt) => {
    const L = PD.lk(ctx);
    const cols = [
      { label: "Order", w: "96px", render: (o) => h("span", { className: "pd-mono", style: { color: "var(--ink)", fontSize: 12 } }, o.id) },
      { label: "Customer", w: "minmax(180px,1.6fr)", ink: true, render: (o) => L.cust(o.cust) },
      { label: "Account manager", w: "minmax(110px,1fr)", render: (o) => DB.person(o.am) },
      { label: "Value", w: "88px", r: true, num: true, ink: true, render: (o) => eur(o.value) },
      { label: "Margin", w: "68px", r: true, num: true, render: (o) => h("span", { style: { color: o.margin < 20 ? "var(--bad)" : o.margin < 23 ? "var(--warn)" : "var(--body)" } }, o.margin.toFixed(1) + "%") },
      { label: "Lines", w: "56px", r: true, num: true, render: (o) => o.lines },
      { label: "Stock", w: "118px", render: (o) => UI.Badge(o.stock, stockTone(o.stock)) },
      { label: "Warehouse", w: "84px", render: (o) => DB.warehouses[o.wh].short },
      { label: "Required", w: "88px", render: (o) => h("span", { style: { color: o.req <= 1 ? "var(--ink)" : "var(--body)" } }, rel(D(o.req))) },
      { label: "Fulfilment", w: "126px", render: (o) => UI.Badge(o.status, STATUS_TONE[o.status] || "neutral") },
      { label: "Delivery", w: "110px", render: (o) => o.route ? L.route(o.route === "D07" && o.id === "SO-10491" ? "D07·2" : o.route, deliveryLabel(o)) : h("span", { className: "pd-faint" }, "—") },
      { label: "Risk", w: "88px", render: (o) => UI.Risk(o.risk) }
    ];
    return opt && opt.skip ? cols.filter((c) => opt.skip.indexOf(c.label) < 0) : cols;
  };
  PD.ord.cols = orderCols;

  /* ---------------- overview ---------------- */
  function overview(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const stages = [
      { label: "New", n: 26, v: "€48,900", pct: 18, note: "9 on credit hold" },
      { label: "Allocated", n: 136, v: "€337,460", pct: 100, hot: true, note: "Waiting for a picker. Dublin is 2 pickers short today." , onClick: () => go("Warehouse", "Picking") },
      { label: "Picking", n: 58, v: "€141,320", pct: 43, onClick: () => go("Warehouse", "Picking") },
      { label: "Packed", n: 38, v: "€101,860", pct: 28, onClick: () => go("Warehouse", "Packing") },
      { label: "Dispatched", n: 28, v: "€54,660", pct: 21, onClick: () => go("Delivery", "Today") },
      { label: "Delivered today", n: 34, v: "€61,780", pct: 25, onClick: () => go("Delivery", "Proof of Delivery") }
    ];
    const stuck = [
      { label: "Waiting on stock", v: 31, d: "31 orders", tone: "bad", onClick: () => go("Orders", "Backorders") },
      { label: "Waiting for a picker", v: 22, d: "22 orders", tone: "warn", onClick: () => go("Warehouse", "Picking") },
      { label: "Credit hold", v: 9, d: "9 orders", tone: "bad", onClick: () => go("Finance", "Credit Control") },
      { label: "Pricing approval", v: 6, d: "6 orders", tone: "warn", onClick: () => go("Pricing & Margin", "Discount Approvals") },
      { label: "Vehicle capacity", v: 3, d: "3 orders", tone: "warn", onClick: () => go("Delivery", "Today") },
      { label: "Stock discrepancy", v: 2, d: "2 orders", tone: "warn", onClick: () => go("Warehouse", "Exceptions") }
    ];
    const cutoffs = [
      ["D07 run 2", "12:15", "SO-10491 Westbrook, picking", "info", "D07·2"],
      ["D14", "13:30", "SO-10482 Murphy, 15 of 18 lines ready", "warn", "D14"],
      ["D14", "13:30", "SO-10486 Brennan, pick face blocked", "bad", "D14"],
      ["Naas shuttle", "14:00", "40 × EL-4408 if the transfer is approved", "info", null],
      ["Tomorrow 07:00", "16:00", "142 orders due for first runs", "neutral", null]
    ];
    const risky = DB.atRisk.slice().sort((a, b) => b.value * probOf(b) - a.value * probOf(a)).slice(0, 5);
    return UI.Page({
      kicker: "Orders · open book", title: "286 open orders worth €684,200",
      sub: "Where every open order sits between the customer's click and their signature, and where it is stuck.",
      actions: [UI.Btn("Live orders", () => go("Orders", "Live Orders"), { pri: true }), UI.Btn("At risk", () => go("Orders", "At Risk"), { icon: "alert" })],
      children: [
        UI.Kpis([
          { label: "Open orders", value: num(K.openOrders), sub: eur(K.openValue) },
          { label: "Ready", value: String(K.ready), sub: "Fully allocated", onClick: () => go("Orders", "Allocation") },
          { label: "Picking", value: String(K.picking), sub: "Across both sites", onClick: () => go("Warehouse", "Picking") },
          { label: "Awaiting stock", value: String(K.awaitingStock), sub: "33 short lines", tone: "warn", onClick: () => go("Orders", "Backorders") },
          { label: "Credit hold", value: String(K.creditHold), sub: "€35,440 held", tone: "bad", onClick: () => go("Finance", "Credit Control") },
          { label: "Delivery risk", value: String(K.deliveryRisk), sub: "€84,760 at risk", tone: "bad", onClick: () => go("Orders", "At Risk") }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Card({ title: "Order pipeline", icon: "route", meta: "OPEN BOOK · LIVE FROM SAGE 200 AND THE WMS", delay: 60 }, [
          UI.Pipeline(stages),
          UI.Note("136 orders are allocated and waiting for a picker, against 58 being picked. The queue has grown by 19 since 07:00: two Dublin pickers are off and 1,284 lines are due out today.", { marginTop: 12 })
        ]),
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr)", [
          UI.Card({ title: "Where orders are stuck", icon: "alert", meta: "73 ORDERS NOT MOVING", delay: 100 }, UI.HBars(stuck, { colorValue: true })),
          UI.Card({ title: "Highest-risk orders", icon: "alert", meta: "VALUE × LIKELIHOOD OF MISSING", delay: 140, right: UI.Btn("All 14", () => go("Orders", "At Risk"), { sm: true, ghost: true }) },
            risky.map((o) => UI.Row({ key: o.id, onClick: () => ctx.open("order", o.id) }, [
              UI.Risk(o.risk),
              h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 13 } }, DB.custName(o.cust), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, o.id)), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, o.reason + " · " + o.reasonDetail)),
              h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, eur(o.value))]))),
          UI.Card({ title: "Dispatch cut-offs today", icon: "clock", meta: "NEXT 7 HOURS", delay: 180 },
            cutoffs.map((c, i) => UI.Row({ key: i, onClick: c[4] ? () => ctx.open("route", c[4]) : () => go("Warehouse", "Dispatch") }, [
              h("span", { className: "pd-mono", style: { width: 42, fontSize: 12, color: "var(--ink)" } }, c[1]),
              h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, c[0]), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, c[2])),
              UI.Dot(c[3])])))
        ]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", [
          UI.Card({ title: "Orders by channel", icon: "doc", meta: "TODAY", delay: 220 }, UI.HBars([
            { label: "B2B ordering portal", v: 38, d: "38" }, { label: "Email to order desk", v: 24, d: "24" }, { label: "EDI (national accounts)", v: 14, d: "14" },
            { label: "Account manager", v: 11, d: "11" }, { label: "Phone", v: 5, d: "5" }, { label: "Trade counter", v: 2, d: "2" }], { flat: true })),
          UI.Card({ title: "Open value by warehouse", icon: "pin", meta: "€684,200", delay: 260 }, [
            UI.Split([{ label: "Dublin", v: 496600, color: "var(--accent)", d: "€496,600" }, { label: "Naas", v: 187600, color: "var(--accent-hover)", d: "€187,600" }]),
            UI.Note("Naas holds 30% of stock but ships 27% of value. 11 Dublin orders could be filled from Naas today.", { marginTop: 12 }),
            h("div", { style: { marginTop: 10 } }, UI.Btn("See allocation", () => go("Orders", "Allocation"), { sm: true }))]),
          UI.Card({ title: "Order intake", icon: "spark", meta: "LAST 10 WORKING DAYS", delay: 300 }, UI.Columns(
            [81, 88, 92, 79, 86, 90, 84, 97, 89, 94].map((v, i) => ({ l: i === 9 ? "Today" : "", v, d: String(v), hi: i === 9 })), { h: 118 }))
        ])
      ]
    });
  }

  /* ---------------- live orders ---------------- */
  function live(ctx) {
    const f = ctx.st.ordFilter || "all";
    const F = [
      ["all", "All", DB.orders.length], ["risk", "At risk", DB.atRisk.length], ["hold", "Credit hold", DB.creditHolds.length],
      ["stock", "Awaiting stock", DB.orders.filter((o) => o.stock !== "Available").length],
      ["today", "Dispatching today", DB.orders.filter((o) => o.route === "D14" || o.req === 0 || o.id === "SO-10491").length],
      ["DUB", "Dublin", DB.orders.filter((o) => o.wh === "DUB").length], ["NAS", "Naas", DB.orders.filter((o) => o.wh === "NAS").length]
    ];
    const pick = {
      all: () => true, risk: (o) => DB.atRisk.indexOf(o) > -1, hold: (o) => o.hold, stock: (o) => o.stock !== "Available",
      today: (o) => o.route === "D14" || o.req === 0 || o.id === "SO-10491", DUB: (o) => o.wh === "DUB", NAS: (o) => o.wh === "NAS"
    }[f];
    const q = (ctx.st.ordQ || "").toLowerCase();
    const rows = DB.orders.filter(pick).filter((o) => !q || (o.id + " " + DB.custName(o.cust) + " " + DB.person(o.am)).toLowerCase().indexOf(q) > -1)
      .sort((a, b) => (a.risk === "HIGH" ? 0 : a.risk === "MEDIUM" ? 1 : 2) - (b.risk === "HIGH" ? 0 : b.risk === "MEDIUM" ? 1 : 2) || b.value - a.value);
    const tot = rows.reduce((a, o) => a + o.value, 0);
    return UI.Page({
      kicker: "Orders · live", live: "UPDATING FROM SAGE 200 AND THE WMS",
      title: "Live orders",
      sub: "Every open order with its stock, warehouse, fulfilment state and route in one row. Highest risk first.",
      children: [
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } },
          UI.Chips(F, f, (v) => ctx.set({ ordFilter: v })),
          h("div", { style: { flex: 1 } }),
          h("input", { value: ctx.st.ordQ || "", onChange: (e) => ctx.set({ ordQ: e.target.value }), placeholder: "Filter by order, customer or rep", style: { height: 32, width: 260, padding: "0 14px", borderRadius: 999, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12.5, outline: "none" } })),
        UI.Card({ flush: true, title: rows.length + " orders · " + eur(tot), meta: "SHOWING " + rows.length + " OF 286 OPEN · CLICK A ROW FOR THE FULL CHAIN" }, [
          UI.Table({ cols: orderCols(ctx), rows, rowKey: (o) => o.id, onRow: (o) => ctx.open("order", o.id), rowTone: (o) => o.risk === "HIGH" ? "bad" : o.risk === "MEDIUM" ? "warn" : null, empty: "No orders match that filter." })
        ])
      ]
    });
  }

  /* ---------------- at risk ---------------- */
  function atRisk(ctx) {
    const rows = DB.atRisk.slice().sort((a, b) => b.value * probOf(b) - a.value * probOf(a));
    const byReason = {};
    rows.forEach((o) => { byReason[o.reason] = byReason[o.reason] || { n: 0, v: 0 }; byReason[o.reason].n++; byReason[o.reason].v += o.value; });
    const ACTION = { "Stock shortage": "Split or substitute", "Credit hold": "Credit decision", "Late supplier": "Expedite PO", "Picking delay": "Re-sequence pick", "Stock discrepancy": "Recount bin", "Vehicle capacity": "Re-plan route", "Warehouse delay": "Next slot" };
    const L = PD.lk(ctx);
    return UI.Page({
      kicker: "Orders · at risk", title: "Revenue at risk: €84,760",
      sub: "14 orders Pulse expects to miss their promise, ranked by revenue × probability of delay. Reasons come from stock, purchasing, credit, warehouse and transport, not from someone's memory.",
      actions: [UI.Btn("Ask why", () => ctx.ask("What orders are likely to go late?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Orders at risk", value: "14", sub: "7 dispatch today", tone: "bad" },
          { label: "Revenue at risk", value: "€84,760", sub: "€46,280 due out today", tone: "bad", toneValue: true },
          { label: "Linked to PO-8821", value: "6 orders", sub: "€41,880 · Atlas, 5 days late", onClick: () => ctx.open("po", "PO-8821") },
          { label: "Fixable today", value: "9 of 14", sub: "Transfer, split or re-plan", subTone: "ok" }
        ]),
        UI.Grid("minmax(0,2.4fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Ranked by expected revenue impact", meta: "VALUE × PROBABILITY" }, [
            UI.Table({
              rows, rowKey: (o) => o.id, onRow: (o) => ctx.open("order", o.id), rowTone: (o) => o.risk === "HIGH" ? "bad" : "warn",
              cols: [
                { label: "Order", w: "92px", render: (o) => h("span", { className: "pd-mono", style: { color: "var(--ink)", fontSize: 12 } }, o.id) },
                { label: "Customer", w: "minmax(170px,1.4fr)", ink: true, render: (o) => L.cust(o.cust) },
                { label: "Value", w: "84px", r: true, num: true, ink: true, render: (o) => eur(o.value) },
                { label: "Reason", w: "minmax(220px,2fr)", render: (o) => h("span", { title: o.reasonDetail }, h("span", { style: { color: "var(--ink)" } }, o.reason), h("span", { className: "pd-faint" }, " · " + o.reasonDetail)) },
                { label: "Due", w: "86px", render: (o) => rel(D(o.req)) },
                { label: "Likelihood", w: "92px", render: (o) => h("div", { className: "pd-split", style: { gap: 6 } }, UI.Bar(probOf(o) * 100, probOf(o) > .7 ? "bad" : "warn", { w: 36 }), h("span", { className: "pd-mono", style: { fontSize: 11 } }, Math.round(probOf(o) * 100) + "%")) },
                { label: "Impact", w: "78px", r: true, num: true, render: (o) => eur(Math.round(o.value * probOf(o))) },
                { label: "Next step", w: "150px", render: (o) => UI.Btn(ACTION[o.reason] || "Open", () => ctx.open("order", o.id), { sm: true }) }
              ]
            })
          ]),
          h("div", null,
            UI.Card({ title: "Why they are at risk", icon: "alert", delay: 80 }, UI.HBars(Object.keys(byReason).map((k) => ({ label: k, v: byReason[k].v, d: byReason[k].n + " · " + eurK(byReason[k].v) })).sort((a, b) => b.v - a.v), { tpl: "minmax(110px,1fr) 1.2fr 86px" })),
            h("div", { style: { height: 14 } }),
            UI.AI({ who: "Ops Watchdog", conf: "HIGH CONFIDENCE", text: "Fix Murphy first: it is a third of the value and due tomorrow. Approving the Naas transfer protects three more orders (€12,460) for the price of the 14:00 shuttle. Doyle is a credit decision, not an operations one.",
              actions: [UI.Btn("Open SO-10482", () => ctx.open("order", "SO-10482"), { pri: true, sm: true }), UI.Btn("Approve transfer", () => ctx.act("dq-transfer", "Transfer approved", "40 × EL-4408 booked on the 14:00 Naas shuttle. Harbour Point, Leinster Retail and Tallaght Trade protected."), { sm: true, done: ctx.done("dq-transfer"), doneLabel: "Transfer approved" })] }))
        ])
      ]
    });
  }

  /* ---------------- backorders ---------------- */
  const BACK = [
    { sku: "EL-4408", orders: 4, units: 54, source: "PO-8821 · Naas transfer", eta: relLower(D(1)) + " 10:30 · shuttle 14:00 today", tone: "bad", action: "Approve transfer", key: "dq-transfer", who: ["SO-10482", "SO-10493", "SO-10509", "SO-10515"] },
    { sku: "EL-4631", orders: 3, units: 150, source: "PO-8821 · Atlas", eta: relLower(D(1)) + " 10:30", tone: "bad", action: "Expedite PO", key: "dq-expedite", who: ["SO-10482", "SO-10488", "SO-10499"] },
    { sku: "IC-3310", orders: 4, units: 74, source: "PO-8821 · Atlas", eta: relLower(D(1)) + " 10:30", tone: "bad", action: "Expedite PO", key: "dq-expedite", who: ["SO-10482", "SO-10495", "SO-10507", "SO-10511"] },
    { sku: "FH-6710", orders: 7, units: 164, source: "No PO raised", eta: "Kerry lead time 5 days", tone: "bad", action: "Create PO", key: "po-fh6710" },
    { sku: "EL-4712", orders: 4, units: 38, source: "PO-8836 · EuroCable", eta: relLower(D(1)) + " 08:30", tone: "warn" },
    { sku: "IC-3405", orders: 3, units: 90, source: "PO-8833 · SafePro", eta: "Today 14:00 (Naas)", tone: "ok" },
    { sku: "SAF-1930", orders: 2, units: 120, source: "PO-8839 · Polska", eta: "Today 13:00 (Naas)", tone: "ok" },
    { sku: "TL-5120", orders: 2, units: 14, source: "PO-8832 · Northgate", eta: "Today 15:30", tone: "ok" },
    { sku: "EL-4520", orders: 1, units: 4, source: "PO-8830 · Hartmann", eta: "Today 12:30", tone: "ok" },
    { sku: "LT-8120", orders: 2, units: 60, source: "PO-8844 · Nordic", eta: rel(D(16)), tone: "warn", action: "Offer substitute", key: "sub-lt8120" }
  ];
  function backorders(ctx) {
    const L = PD.lk(ctx);
    const custWaiting = [
      ["murphy", 1867.40, 3, "Notified 09:11 · accepts split"], ["horizon", 398, 2, "Called asking for ETA 09:02"], ["core", 1052.80, 1, "Not told yet"],
      ["harbour", 355.20, 3, "Not told yet"], ["leinster", 236.80, 1, "EDI advice sent"], ["liffey", 368, 2, "Not told yet"], ["atlantic", 497.50, 2, "Not told yet"]
    ];
    return UI.Page({
      kicker: "Orders · backorders", title: "31 orders waiting on 33 short lines",
      sub: "€84,760 of revenue is affected. Each short line shows where the stock is coming from and when, so nobody has to ring purchasing to find out.",
      children: [
        UI.Kpis([
          { label: "Backordered orders", value: "31", sub: "€84,760 revenue affected", tone: "bad" },
          { label: "Short lines", value: "33", sub: "Across 10 SKUs" },
          { label: "Covered by stock landing today", value: "11 lines", sub: "5 deliveries into goods in", subTone: "ok", onClick: () => ctx.go("Warehouse", "Goods In") },
          { label: "No supply planned", value: "7 lines", sub: "FH-6710 hand soap: no PO raised", tone: "bad", onClick: () => ctx.go("Purchasing", "Recommendations") }
        ]),
        UI.Grid("minmax(0,2fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Short lines by SKU", meta: "WHERE THE STOCK IS COMING FROM" }, [
            UI.Table({
              rows: BACK, rowKey: (b) => b.sku, onRow: (b) => ctx.open("product", b.sku), rowTone: (b) => b.tone === "bad" ? "bad" : null,
              cols: [
                { label: "SKU", w: "86px", render: (b) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, b.sku) },
                { label: "Product", w: "minmax(180px,1.6fr)", ink: true, render: (b) => DB.product(b.sku).name },
                { label: "Orders", w: "64px", r: true, num: true, render: (b) => b.orders },
                { label: "Units short", w: "84px", r: true, num: true, render: (b) => num(b.units) },
                { label: "Supply", w: "minmax(150px,1.3fr)", render: (b) => /PO-\d+/.test(b.source) ? h("span", null, L.po(b.source.match(/PO-\d+/)[0]), h("span", { className: "pd-faint" }, b.source.replace(/PO-\d+/, ""))) : h("span", { style: { color: "var(--bad)" } }, b.source) },
                { label: "Arrives", w: "minmax(130px,1.1fr)", render: (b) => h("span", { style: { color: PD.TONE[b.tone].fg } }, b.eta) },
                { label: "", w: "136px", render: (b) => b.action ? UI.Btn(b.action, () => ctx.act(b.key, b.action + " · done", b.sku + ": " + (b.key === "po-fh6710" ? "PO-8847 drafted to Kerry Hygiene for 400 units, waiting for Emma Walsh." : b.key === "sub-lt8120" ? "Substitute LT-8126 offered to both customers by email." : "logged and the customers' account managers notified.")), { sm: true, done: ctx.done(b.key), doneLabel: "Done" }) : null }
              ]
            })
          ]),
          h("div", null,
            UI.Card({ title: "Customers waiting", icon: "user", meta: "SHORT-LINE VALUE", delay: 80 },
              custWaiting.map((c) => UI.Row({ key: c[0], onClick: () => ctx.open("customer", c[0]) }, [
                h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.custName(c[0])), h("div", { style: { fontSize: 11.5, color: /Not told/.test(c[3]) ? "var(--warn)" : "var(--dim)", marginTop: 2 } }, c[3])),
                h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, eur(c[1], 2))]))),
            h("div", { style: { height: 14 } }),
            UI.AI({ who: "Customer Agent", text: "Four customers with short lines have not been told. Drafts are ready for each, stating what ships today and when the rest lands. They go out from the account manager's mailbox once you say yes.",
              actions: [UI.Btn("Send 4 updates", () => ctx.act("bo-notify", "4 customer updates queued", "Sent from Mark Ryan, Sarah Byrne and David Kelly's Outlook. Replies thread back to each order."), { pri: true, sm: true, done: ctx.done("bo-notify"), doneLabel: "Queued" })] }))
        ])
      ]
    });
  }

  /* ---------------- allocation ---------------- */
  function allocation(ctx) {
    const L = PD.lk(ctx);
    const plan = [
      ["SO-10493", "tallaght", 6, "Today", "B", 27.6, "4 now from bin D-14-03, 2 from transfer", "ok"],
      ["SO-10509", "harbour", 12, rel(D(3)), "B", 24.2, "12 from Naas transfer", "ok"],
      ["SO-10515", "leinster", 8, rel(D(3)), "A · national", 20.6, "8 from Naas transfer", "ok"],
      ["SO-10482", "murphy", 28, rel(D(1)), "A · contract", 24.7, "28 from PO-8821, or EL-4412 substitute today", "warn"]
    ];
    const cross = [
      ["SO-10509", "harbour", "EL-4408", "Dublin 12 · Naas 64", "Allocate from Naas, shuttle 14:00", "€5,740"],
      ["SO-10523", "core", "FH-6602", "Naas 300 · Dublin 180", "Keep on Naas, no change", "None"],
      ["SO-10517", "midland", "SAF-1892", "Naas 1,630 · Dublin 388", "Fine as is", "None"],
      ["SO-10514", "obrien", "AD-7340", "Naas 372 · Dublin 4", "Allocate the 8 from Naas, not Dublin", "€71"]
    ];
    return UI.Page({
      kicker: "Orders · allocation", title: "Who gets the scarce stock",
      sub: "When there is not enough to go round, Pulse allocates by promise date, then contract, tier and margin, and shows where stock is sitting in the wrong warehouse.",
      children: [
        UI.Kpis([
          { label: "Lines allocated today", value: "1,112", sub: "94% automatically" },
          { label: "Manual allocations", value: "67", sub: "By Gráinne Foley's desk" },
          { label: "Failed allocations", value: "23 lines", sub: "Stock short or count mismatch", tone: "warn" },
          { label: "In the wrong warehouse", value: "11 orders", sub: "Stock in Naas, order on Dublin", tone: "warn" }
        ]),
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Scarce stock: EL-4408 Industrial Cable 100m", meta: "DUBLIN 12 AVAILABLE · 58 NEEDED IN 7 DAYS", right: UI.Btn("Open SKU", () => ctx.open("product", "EL-4408"), { sm: true, ghost: true }) }, [
            UI.Table({
              rows: plan, rowKey: (r) => r[0], onRow: (r) => ctx.open("order", r[0]),
              cols: [
                { label: "Order", w: "92px", render: (r) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, r[0]) },
                { label: "Customer", w: "minmax(160px,1.3fr)", ink: true, render: (r) => L.cust(r[1]) },
                { label: "Qty", w: "52px", r: true, num: true, render: (r) => r[2] },
                { label: "Required", w: "96px", render: (r) => r[3] },
                { label: "Tier", w: "100px", render: (r) => r[4] },
                { label: "Margin", w: "66px", r: true, num: true, render: (r) => r[5].toFixed(1) + "%" },
                { label: "Pulse allocation", w: "minmax(220px,2fr)", render: (r) => h("span", { style: { color: PD.TONE[r[7]].fg } }, r[6]) }
              ]
            }),
            h("div", { style: { padding: "14px 20px 18px" } }, UI.AI({ who: "Inventory Agent", text: "The 12 on the system are really 4: the bin count failed at 09:06. Put the 4 on Tallaght today, and approve 40 from Naas for the 14:00 shuttle to cover Harbour Point, Leinster and the rest of Tallaght. Murphy's 28 are better served from PO-8821 tomorrow or the EL-4412 substitute today.",
              actions: [UI.Btn("Apply allocation", () => ctx.act("alloc-el4408", "Allocation applied", "EL-4408: Tallaght 4 now; Harbour Point 12, Leinster 8, Tallaght 2 on the Naas transfer. Pick tasks updated."), { pri: true, sm: true, done: ctx.done("alloc-el4408"), doneLabel: "Applied" }), UI.Btn("Offer substitute to Murphy", () => ctx.open("product", "EL-4408"), { sm: true })] }))
          ]),
          h("div", null,
            UI.Card({ title: "Allocation rules", icon: "shield", meta: "IN THIS ORDER", delay: 80 }, [
              ...["Promise date: earliest required date first", "Contract and national accounts ahead of tier pricing", "Customer tier A, then B, then C", "Higher margin order wins a tie", "Oldest order wins what is left"].map((r, i) => UI.Row({ key: i }, [h("span", { className: "pd-mono", style: { width: 18, color: "var(--accent-text)", fontSize: 12 } }, String(i + 1)), h("span", { style: { fontSize: 12.5 } }, r)])),
              UI.Note("Rules set by Michael Doyle. A manual override needs a reason code and is logged.", { marginTop: 8 })
            ]))
        ]),
        UI.Card({ flush: true, title: "Stock in the other warehouse", meta: "ORDER ALLOCATED TO ONE SITE, STOCK SITTING IN THE OTHER" }, [
          UI.Table({
            rows: cross, rowKey: (r) => r[0] + r[2], onRow: (r) => ctx.open("order", r[0]),
            cols: [
              { label: "Order", w: "92px", render: (r) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, r[0]) },
              { label: "Customer", w: "minmax(160px,1.2fr)", ink: true, render: (r) => L.cust(r[1]) },
              { label: "SKU", w: "92px", render: (r) => L.sku(r[2]) },
              { label: "Where it is", w: "minmax(150px,1fr)", render: (r) => r[3] },
              { label: "Pulse suggests", w: "minmax(220px,1.6fr)", ink: true, render: (r) => r[4] },
              { label: "Value protected", w: "110px", r: true, num: true, render: (r) => r[5] }
            ]
          })
        ])
      ]
    });
  }

  function orderDetail(ctx) { return PD.records.order(ctx, (ctx.st.lastOrder) || "SO-10482"); }

  PD.pages.Orders = { "Overview": overview, "Live Orders": live, "At Risk": atRisk, "Backorders": backorders, "Allocation": allocation, "Order Detail": orderDetail };
})();
