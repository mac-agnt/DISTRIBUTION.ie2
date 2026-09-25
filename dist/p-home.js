/* Home: the 8 a.m. command centre and the executive dashboard. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, F = PD.F, UI = PD.UI, DB = PD.DB, K = DB.kpi;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, weekday, dm } = PD.date;
  const B = UI.B;

  const greeting = () => { const hr = new Date().getHours(); return hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening"; };

  function commandCentre(ctx) {
    const L = PD.lk(ctx);
    const go = ctx.go, open = ctx.open;
    const decided = (id) => ctx.done(id);

    const kpis = UI.Kpis([
      { label: "Revenue MTD", value: K.revenueMTDLabel, sub: K.revenueDelta, subTone: "ok", onClick: () => go("Finance", "Revenue") },
      { label: "Gross margin", value: "23.8%", sub: "Target 25.0% · €13,008 short this month", subTone: "warn", tone: "warn", onClick: () => go("Pricing & Margin", "Margin Control") },
      { label: "Orders today", value: "94", sub: "€176,420 value · 7 at risk", onClick: () => go("Orders", "Live Orders") },
      { label: "OTIF", value: "94.2%", sub: "Target 97.0% · supplier delay is 31% of misses", subTone: "warn", tone: "warn", onClick: () => go("Delivery", "OTIF") },
      { label: "Inventory", value: "€2.46m", sub: "€286k slow-moving", onClick: () => go("Inventory", "Overview") },
      { label: "Backorders", value: "31", sub: "€84,760 revenue affected", subTone: "bad", tone: "bad", onClick: () => go("Orders", "Backorders") }
    ], "repeat(6,minmax(0,1fr))");

    const briefing = UI.Card({ tint: true, title: "Morning briefing", icon: "spark", meta: "BRIEFING AGENT · 08:03", delay: 60 }, [
      UI.P(["", B("94 orders worth €176,420"), " are scheduled today. There are ", B("7 orders at risk"), ", representing ", B("€46,280"), " revenue."]),
      UI.P(["The largest issue is ", L.cust("murphy"), " order ", L.order("SO-10482"), " (€27,640). Three items are short because ", L.po("PO-8821"), " from ", L.sup("atlas"), " is ", B("five days late"), ". A partial delivery can be made today. The remaining products are expected " + relLower(D(1)) + " at 10:30."]),
      UI.P(["Gross margin is currently ", B("23.8%"), ", 1.2 points below target. Most of the gap comes from the ", UI.Link("Industrial Consumables", () => go("Pricing & Margin", "Product Profitability")), " category and three customer-specific price agreements that have not been updated following supplier cost increases. I've identified ", B("€18,600 annualised margin recovery"), " across these accounts."]),
      UI.P(["Inventory contains approximately ", B("€286,000"), " in slow-moving stock. ", B("€74,200"), " has had no movement in more than 180 days."]),
      UI.P([B("4 decisions"), " need you, 3 of them before midday."]),
      h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 } },
        UI.Btn("Review at-risk orders", () => go("Orders", "At Risk"), { pri: true, icon: "alert" }),
        UI.Btn("Review margin", () => go("Pricing & Margin", "Margin Control"), { icon: "tag" }),
        UI.Btn("View decisions", () => { const el = document.getElementById("pd-decisions"); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, { icon: "down" }),
        UI.Btn("Ask a follow-up", () => ctx.ask("What do I need to fix today?"), { ghost: true, icon: "spark" }))
    ]);

    const ALERTS = [
      { sev: "CRITICAL", tone: "bad", head: "Murphy Building Supplies", sub: "Order SO-10482 · €27,640", facts: ["3 lines short", "Promised " + relLower(D(1)), "Supplier delivery delayed"], cta: "Resolve order", run: () => open("order", "SO-10482") },
      { sev: "HIGH", tone: "bad", head: "Atlas Industrial Supplies", sub: "PO-8821 · 5 days late", facts: ["6 customer orders affected", "€41,880 revenue exposed"], cta: "View impact", run: () => open("po", "PO-8821") },
      { sev: "HIGH", tone: "bad", head: "Margin exception · O'Brien Facilities", sub: "Quote QT-2841 · revenue €18,420", facts: ["Projected margin 17.2%", "Target 24%"], cta: "Review pricing", run: () => open("quote", "QT-2841") },
      { sev: "MEDIUM", tone: "warn", head: "Inventory · SKU EL-4408", sub: "Industrial Cable 100m", facts: ["7 days stock remaining", "28-day supplier lead time"], cta: "Review replenishment", run: () => go("Inventory", "Replenishment") },
      { sev: "MEDIUM", tone: "warn", head: "Credit hold · Doyle Construction", sub: "New order €16,240", facts: ["Outstanding €42,680", "Credit limit €50,000"], cta: "Review account", run: () => go("Finance", "Credit Control") }
    ];
    const attention = UI.Card({ title: "Attention required", icon: "alert", meta: ALERTS.length + " OPEN", delay: 120, style: { paddingBottom: 8 } },
      ALERTS.map((a, i) => h("div", { key: i, className: "pd-row click", onClick: a.run, style: { alignItems: "flex-start", gap: 12, padding: "12px 6px" } },
        h("div", { style: { width: 3, alignSelf: "stretch", borderRadius: 3, background: PD.TONE[a.tone].fg, flex: "none" } }),
        h("div", { className: "pd-grow" },
          h("div", { className: "pd-split", style: { gap: 8 } }, UI.Badge(a.sev, a.tone, true), h("span", { style: { fontSize: 13, fontWeight: 500 } }, a.head)),
          h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 4 } }, a.sub),
          h("div", { style: { display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6 } }, ...a.facts.map((f, j) => h("span", { key: j, className: "pd-meta", style: { color: "var(--body)" } }, f)))),
        UI.Btn(a.cta, a.run, { sm: true }))));

    const decisions = h("div", { id: "pd-decisions", style: { scrollMarginTop: 12 } },
      UI.Card({ title: "Decisions", icon: "shield", meta: DB.decisions.filter((d) => !decided(d.id)).length + " WAITING ON A PERSON", delay: 160, right: UI.Btn("All approvals", () => go("Work", "Approvals"), { sm: true, ghost: true }) },
        h("div", { className: "pd-grid", style: { gridTemplateColumns: "repeat(2,minmax(0,1fr))", marginBottom: 0 } },
          ...DB.decisions.map((d, i) => {
            const done = decided(d.id);
            return h("div", { key: d.id, style: { padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)", background: done ? "var(--surface-faint)" : "var(--surface-2)", opacity: done ? .62 : 1, transition: "opacity .3s var(--ease)", animation: "riseIn .4s var(--ease) " + (200 + i * 60) + "ms both" } },
              h("div", { className: "pd-split" }, UI.Badge(d.area.toUpperCase(), d.tone, true), h("span", { className: "pd-meta", style: { marginLeft: "auto" } }, "DUE " + d.due.toUpperCase())),
              h("div", { style: { fontSize: 15, fontWeight: 500, marginTop: 10, letterSpacing: "-.2px" } }, d.title),
              h("div", { style: { fontSize: 12.5, color: "var(--dim)", marginTop: 3 } }, d.who, " · owner ", DB.person(d.owner)),
              h("div", { style: { display: "grid", gridTemplateColumns: "88px 1fr", gap: "6px 10px", marginTop: 12, fontSize: 12.5, lineHeight: 1.5 } },
                h("span", { className: "pd-label", style: { paddingTop: 2 } }, "Impact"), h("span", { style: { color: "var(--ink)" } }, d.impact),
                h("span", { className: "pd-label", style: { paddingTop: 2 } }, "Why"), h("span", { style: { color: "var(--body)" } }, d.reason),
                h("span", { className: "pd-label", style: { paddingTop: 2, color: "var(--accent-text)" } }, "Pulse says"), h("span", { style: { color: "var(--ink)" } }, d.rec)),
              h("div", { style: { display: "flex", gap: 8, marginTop: 14 } },
                UI.Btn("Approve recommendation", () => ctx.act(d.id, "Decision recorded", d.title + " · approved by Patrick Byrne and logged against the record."), { pri: !done, sm: true, done, doneLabel: "Approved" }),
                UI.Btn("Open", () => open(d.open[0], d.open[1]), { sm: true, ghost: true })));
          }))));

    const ripple = UI.Card({ title: "Today's biggest ripple", icon: "link", meta: "ONE LATE PO, TRACED THROUGH THE BUSINESS", delay: 200 }, [
      UI.HChain([
        { k: "Supplier", t: "Atlas · PO-8821", d: "5 days late, now " + relLower(D(1)) + " 10:30", tone: "bad", onClick: () => open("po", "PO-8821") },
        { k: "Stock", t: "3 SKUs short", d: "EL-4408 · EL-4631 · IC-3310", tone: "warn", onClick: () => open("product", "EL-4408") },
        { k: "Orders", t: "6 orders waiting", d: "€41,880 revenue exposed", tone: "warn", onClick: () => go("Orders", "Backorders") },
        { k: "Warehouse", t: "D14 held at bay 4", d: "SO-10482 pick incomplete, cut-off 13:30", onClick: () => go("Warehouse", "Dispatch") },
        { k: "Delivery", t: "3 drops at risk on D14", d: "Murphy, Horizon, Liffey", tone: "warn", onClick: () => open("route", "D14") },
        { k: "Customers", t: "2 have already called", d: "Horizon asked for an ETA at 09:02", onClick: () => open("customer", "horizon") },
        { k: "Revenue", t: "€41,880 at risk", d: "OTIF on Atlas-dependent orders: 81.4%", tone: "bad", onClick: () => go("Delivery", "OTIF") }
      ])
    ]);

    const handled = [
      ["Credit Agent", "Held SO-10503 before it reached the pick queue", "08:42"],
      ["Purchasing Agent", "Traced 6 orders to PO-8821 and drafted the customer updates", "08:44"],
      ["Margin Agent", "Found 37 price agreements still on the old EuroFix cost", "08:58"],
      ["Dispatch Agent", "Re-planned N06 around 2 pallets that did not fit", "08:09"],
      ["Inventory Agent", "Proposed a 40-unit Naas → Dublin transfer for EL-4408", "09:14"]
    ];
    const aiHandled = UI.Card({ title: "What the agents already handled", icon: "spark", meta: "5 THIS MORNING", delay: 240, right: UI.Btn("Agent activity", () => go("Agents", "Agent Activity"), { sm: true, ghost: true }) },
      handled.map((a, i) => UI.Row({ key: i }, [UI.Dot("info"), h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, a[1]), h("div", { className: "pd-meta", style: { marginTop: 3 } }, a[0].toUpperCase() + " · " + a[2]))])));

    const feed = UI.Card({ title: "Live activity", icon: "clock", meta: "SAGE 200 · WMS · TRANSPORT · AGENTS", delay: 280, right: UI.Btn("Everything", () => go("Activity", "Everything"), { sm: true, ghost: true }) },
      UI.Feed(DB.activity.slice(0, 8).map((a) => ({ t: a[0], tone: a[5], text: [B(a[2]), " ", a[3]], onClick: a[4] ? () => a[4][0] === "sku" ? open("product", a[4][1]) : open(a[4][0], a[4][1]) : undefined }))));

    const network = UI.Card({ title: "Network right now", icon: "pin", meta: "09:20", delay: 320 }, [
      ...Object.values(DB.warehouses).map((w) => h("div", { key: w.id, className: "pd-row click", onClick: () => go("Warehouse", "Control Board") },
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 13, fontWeight: 500 } }, w.name), h("div", { className: "pd-meta", style: { marginTop: 3 } }, w.id === "DUB" ? "71 ORDERS TO PICK · 6 URGENT · 11 OF 13 PICKERS IN" : "23 ORDERS TO PICK · 154 PALLETS INBOUND · 5 PICKERS IN")),
        h("span", { className: "pd-mono", style: { fontSize: 12 } }, eurK(w.inventory)))),
      h("div", { className: "pd-row click", onClick: () => go("Delivery", "Today") },
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 13, fontWeight: 500 } }, "Fleet"), h("div", { className: "pd-meta", style: { marginTop: 3 } }, "10 ON ROUTE · 3 LOADS AT BAYS · 2 IN SERVICE · N06 OVER PAYLOAD")),
        h("span", { className: "pd-mono", style: { fontSize: 12 } }, "34 / 76")),
      h("div", { style: { marginTop: 10 } }, UI.Split([
        { label: "Delivered", v: 34, color: "var(--ok)", d: "34" },
        { label: "In transit", v: 28, color: "var(--accent)", d: "28" },
        { label: "Awaiting dispatch", v: 14, color: "var(--neutral)", d: "14" }
      ], { h: 9 }))
    ]);

    return UI.Page({
      kicker: "Command centre · " + weekday + " " + dm(PD.date.TODAY), live: "LIVE · SAGE 200 SYNCED 09:14",
      title: greeting() + ", Patrick.",
      sub: "Here's what needs your attention across the distribution network today.",
      actions: [UI.Btn("Ask Pulse", () => ctx.ask("What do I need to fix today?"), { icon: "spark" }), UI.Btn("Executive dashboard", () => go("Home", "Executive Dashboard"), { ghost: true })],
      children: [
        kpis,
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [briefing, attention]),
        decisions,
        h("div", { style: { height: 14 } }),
        ripple,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1fr) minmax(0,1.25fr) minmax(0,.95fr)", [aiHandled, feed, network])
      ]
    });
  }

  /* ---------------- executive dashboard ---------------- */
  function metric(label, value, note, tone, spark, onClick) {
    return h("div", { className: PD.cx("pd-row", onClick && "click"), onClick, style: { gap: 10 } },
      h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12, color: "var(--dim)" } }, label), h("div", { style: { fontSize: 18, fontWeight: 500, letterSpacing: "-.5px", marginTop: 3, color: tone && tone !== "neutral" ? PD.TONE[tone].fg : "var(--ink)" } }, value)),
      spark ? UI.Spark(spark, tone === "bad" || tone === "warn" ? tone : "info", 70, 26) : null,
      h("div", { className: "pd-meta", style: { width: 118, textAlign: "right", whiteSpace: "normal", lineHeight: 1.35 } }, note));
  }
  const months = (n) => Array.from({ length: n }, (_, i) => PD.date.MS[new Date(PD.date.TODAY.getFullYear(), PD.date.TODAY.getMonth() - (n - 1) + i, 1).getMonth()]);

  function execDash(ctx) {
    const go = ctx.go;
    const rev = [1236, 1301, 1048, 1152, 1224, 1338, 1352, 1396, 1371, 1322, 1246, 1085];
    const gm = [24.6, 24.9, 25.2, 24.8, 24.7, 24.9, 25.1, 24.6, 24.4, 24.1, 24.0, 23.8];
    const section = (title, icon, rows, delay, chart) => UI.Card({ title, icon, delay }, [chart || null, ...rows]);
    return UI.Page({
      kicker: "Executive dashboard · month to date", title: "The business on one page",
      sub: "Six areas, one set of numbers. Every figure opens the screen it came from.",
      actions: [UI.Btn("Command centre", () => go("Home", "Command Centre"), { ghost: true })],
      children: [
        UI.Grid("repeat(3,minmax(0,1fr))", [
          section("Commercial", "euro", [
            metric("Revenue MTD", "€1,084,620", "+8.4% vs same period last month", "ok", rev.slice(-9), () => go("Finance", "Revenue")),
            metric("Gross margin", "23.8%", "Target 25.0%", "warn", gm.slice(-9), () => go("Pricing & Margin", "Margin Control")),
            metric("Order intake MTD", "€1,162,300", "Book-to-bill 1.07", null, [980, 1010, 1040, 1100, 1060, 1120, 1090, 1140, 1162], () => go("Orders", "Overview")),
            metric("Average order", "€6,420", "+3.2% on last month", null, null, () => go("Customers", "Overview")),
            metric("Quote conversion", "38%", "€186k open", null, [41, 40, 42, 39, 37, 40, 39, 38, 38], () => go("Customers", "Quotes"))
          ], 0, h("div", { style: { marginBottom: 6 } }, UI.Columns(rev.map((v, i) => ({ l: months(12)[i], v, d: "€" + num(v) + "k", hi: i === rev.length - 1 })), { h: 110 }))),
          section("Customer", "user", [
            metric("Active accounts", "437", "+6 this quarter", null, [421, 424, 426, 429, 430, 431, 433, 435, 437], () => go("Customers", "Accounts")),
            metric("Customer retention", "93.4%", "Trailing 12 months", "ok", null, () => go("Customers", "Customer Health")),
            metric("Declining accounts", "18", "€212k annual spend exposed", "warn", [11, 12, 12, 14, 13, 15, 16, 17, 18], () => go("Customers", "Customer Health")),
            metric("Service issues open", "12", "5 linked to Atlas", "warn", null, () => go("Delivery", "Delivery Issues"))
          ], 60),
          section("Inventory", "box", [
            metric("Inventory value", "€2.46m", "Dublin €1.72m · Naas €740k", null, [2.31, 2.34, 2.38, 2.36, 2.41, 2.44, 2.43, 2.45, 2.46], () => go("Inventory", "Overview")),
            metric("Inventory turn", "4.8×", "Target 5.5×", "warn", [5.2, 5.1, 5.1, 5.0, 4.9, 4.9, 4.8, 4.8, 4.8], () => go("Inventory", "Overview")),
            metric("Stockouts", "28 SKUs", "3 on today's orders", "bad", [14, 16, 15, 19, 22, 21, 24, 26, 28], () => go("Inventory", "Stock")),
            metric("Slow stock", "€286,420", "€74,200 over 180 days", "warn", null, () => go("Inventory", "Slow & Dead Stock"))
          ], 120),
          section("Supply", "cart", [
            metric("Supplier OTIF", "91.6%", "Atlas 86.2% drags it down", "warn", [93.4, 93.1, 92.8, 92.9, 92.4, 92.0, 91.8, 91.9, 91.6], () => go("Purchasing", "Supplier Performance")),
            metric("Late POs", "11", "€41,880 of orders depend on one", "bad", null, () => go("Purchasing", "Purchase Orders")),
            metric("Average lead time", "16.4 days", "Promised 14.1 days", null, null, () => go("Purchasing", "Suppliers")),
            metric("Supplier fill rate", "94.8%", "Last 90 days", null, null, () => go("Purchasing", "Supplier Performance"))
          ], 180),
          section("Operations", "truck", [
            metric("Orders open", "286", "€684,200", null, null, () => go("Orders", "Overview")),
            metric("Orders at risk", "14", "€84,760", "bad", [6, 8, 7, 9, 11, 10, 12, 13, 14], () => go("Orders", "At Risk")),
            metric("Warehouse throughput", "1,284 lines", "Today · 62% picked by 09:20", null, null, () => go("Warehouse", "Control Board")),
            metric("OTIF", "94.2%", "Target 97.0%", "warn", DB.delivery.trend.slice(-9), () => go("Delivery", "OTIF"))
          ], 240),
          section("Cash", "euro", [
            metric("Receivables", "€318,000", "€124,000 overdue", null, null, () => go("Finance", "Debtors")),
            metric("Overdue", "€124,000", "39% of the ledger", "warn", [96, 101, 104, 109, 112, 118, 121, 122, 124], () => go("Finance", "Debtors")),
            metric("Credit holds", "9 orders", "€35,440 held", "bad", null, () => go("Finance", "Credit Control")),
            metric("Working capital", "€2.78m tied up", "€226,000 releasable", "warn", null, () => go("Finance", "Working Capital"))
          ], 300)
        ])
      ]
    });
  }

  PD.pages.Home = { "Command Centre": commandCentre, "Executive Dashboard": execDash };
})();
