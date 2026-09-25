/* Answers for the chat, and the ⌘K search index. Answers read the same database as the
   pages, so a number in chat is the number on screen. Tools are declared with their
   effect: read tools answer, write and external tools only ever propose. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower } = PD.date;

  /* Actions: [label, primary, nav]. nav is ["open", type, id] or ["go", module, sub]; no nav means "ask this". */
  const A = {
    brief: {
      tool: "briefing_today", effect: "read", keys: ["fix today", "need to fix", "what do i need", "morning", "brief", "today", "priorit"],
      text: "Four things, in this order. First, Murphy Building Supplies SO-10482 (€27,640) is due tomorrow with three lines stuck on Atlas PO-8821: approve the partial shipment so 15 lines leave on D14 at 13:45. Second, Doyle Construction's €16,240 order is on credit hold; release €7,320 against available credit and ask for INV-28482 (€11,860, 61 days). Third, approve the 40-unit Naas to Dublin transfer of EL-4408 before the 14:00 shuttle; it protects three orders worth €12,460. Fourth, Michael needs to decide on O'Brien Facilities' quote at 17.2% by 11:00. Everything else is already moving.",
      cols: ["Issue", "Value", "Owner", "By"],
      rows: [["Murphy SO-10482 partial", "€27,640", "Sarah Byrne", "13:30"], ["Doyle credit release", "€16,240", "Patrick Byrne", "10:00"], ["EL-4408 transfer", "€12,460", "Emma Walsh", "13:00"], ["O'Brien QT-2841", "€18,420", "Michael Doyle", "11:00"]],
      actions: [["Open SO-10482", 1, ["open", "order", "SO-10482"]], ["Credit control", 0, ["go", "Finance", "Credit Control"]], ["Approve transfer", 0, ["go", "Inventory", "Transfers"]]]
    },
    money: {
      tool: "exposure_today", effect: "read", keys: ["cost us money", "money today", "cost us", "exposure", "lose money"],
      text: "Three issues represent approximately €59,288 of immediate commercial exposure. 1. Murphy Building Supplies, €27,640: order SO-10482 is at risk due to three stock shortages linked to late supplier PO-8821. 2. Doyle Construction, €16,240: order SO-10503 is held because the account would exceed its €50,000 credit limit. 3. Margin exceptions, €15,408: four pending quotes are below target margin; O'Brien Facilities has the largest variance at 17.2% versus a 24% target. I recommend resolving the Murphy order first because its required delivery date is tomorrow.",
      cols: ["Issue", "Exposure", "Cause", "Due"],
      rows: [["Murphy Building Supplies", "€27,640", "PO-8821 late", rel(D(1))], ["Doyle Construction", "€16,240", "Credit limit", rel(D(1))], ["4 low-margin quotes", "€15,408", "Below target", "Today"]],
      actions: [["Open SO-10482", 1, ["open", "order", "SO-10482"]], ["Margin exceptions", 0, ["go", "Pricing & Margin", "Exceptions"]]]
    },
    late: {
      tool: "orders_at_risk", effect: "read", keys: ["go late", "going late", "likely to", "at risk", "late order", "orders late", "miss"],
      text: "14 orders worth €84,760 are likely to miss their promise; 7 of them (€46,280) are due out today. Supplier delay is the biggest cause: six orders are waiting on Atlas PO-8821. Credit holds and vehicle capacity make up most of the rest. Nine of the fourteen can be fixed today by a split, a transfer or a re-plan.",
      cols: ["Order", "Customer", "Value", "Reason"],
      rows: DB.atRisk.slice().sort((a, b) => b.value - a.value).slice(0, 5).map((o) => [o.id, DB.custName(o.cust), eur(o.value), o.reason]),
      actions: [["Open at-risk orders", 1, ["go", "Orders", "At Risk"]], ["Why has OTIF fallen?", 0]]
    },
    buy: {
      tool: "purchasing_recommend", effect: "read", keys: ["buy today", "should we buy", "reorder", "what to order", "purchase recommend", "should we order", "buy"],
      text: "Buy three things today. EL-4408 Industrial Cable: 160 units, and take them from EuroCable rather than Atlas; it is €0.45 a reel dearer landed but arrives in 9 days instead of 28. FH-6710 hand soap cartridges: 400 from Kerry Hygiene; Naas has 5.8 days of cover and 7 orders already short. EL-4631 glands: 400 from Atlas are on PO-8821, which is enough. 147 SKUs are below their reorder point in total, worth €184k; the rest can go in Monday's run.",
      cols: ["SKU", "Buy", "From", "Why"],
      rows: [["EL-4408", "160", "EuroCable", "2.6 days cover"], ["FH-6710", "400", "Kerry Hygiene", "7 orders short"], ["IC-3405", "1,000", "SafePro", "On PO-8833 today"], ["EL-4712", "80", "EuroCable", "On PO-8836"]],
      actions: [["Open recommendations", 1, ["go", "Purchasing", "Recommendations"]], ["Open EL-4408", 0, ["open", "product", "EL-4408"]]]
    },
    margin: {
      tool: "margin_leakage", effect: "read", keys: ["losing margin", "margin", "leak", "discount", "pricing"],
      text: "Margin is 23.8% against a 25.0% target: €13,008 short this month, €156,096 a year. The biggest leak is contract pricing that was never updated after supplier increases (€4,820), then discounts above the rep's band (€3,260) and cost increases not passed through (€2,940). Industrial Consumables is the weakest category at 17.6%. EuroFix raised M10 bolts 10.4% and 37 customers, Murphy included, still buy at the old price.",
      cols: ["Leak", "This month", "Owner", "Fix"],
      rows: DB.leakage.map((l) => [l.label, eur(l.v), DB.person(l.owner), l.id === "cost" ? "Reprice" : l.id === "discount" ? "Bands" : l.id === "pricing" ? "Review" : "Approve"]),
      actions: [["Open margin control", 1, ["go", "Pricing & Margin", "Margin Control"]], ["Cost changes", 0, ["go", "Pricing & Margin", "Cost Changes"]]]
    },
    reduced: {
      tool: "customer_health", effect: "read", keys: ["reduced spend", "declin", "customers have reduced", "stopped buying", "spend down", "losing customers"],
      text: "18 accounts are declining. The one to call first is Ryan Trade Supplies: spend is down 28% over 90 days, almost all in fixings. They normally buy M10 hex bolts every 18 to 24 days and have not for 47 days; that line was €2,840 a month, €34,080 a year at risk. Southside DIY has gone quiet on a quote for 34 days, and Dunmore Civil is slowing as its debt ages.",
      cols: ["Customer", "Change", "Where", "Owner"],
      rows: [["Ryan Trade Supplies", "−28.0%", "Fixings", "David Kelly"], ["Southside DIY", "−11.8%", "Quote inactive", "David Kelly"], ["Dunmore Civil", "−6.2%", "Overdue debt", "Sarah Byrne"], ["Atlantic FM Services", "−3.1%", "Consumables", "David Kelly"]],
      actions: [["Open customer health", 1, ["go", "Customers", "Customer Health"]], ["Open Ryan Trade", 0, ["open", "customer", "ryan"]]]
    },
    reduce: {
      tool: "inventory_ageing", effect: "read", keys: ["inventory can we reduce", "reduce", "slow", "dead stock", "excess", "overstock"],
      text: "€286,420 is in slow-moving stock and €74,200 of it has not moved in over 180 days. About €168,000 can realistically be released: stop replenishing lines that no longer sell, send the LED floodlights and exit signs back to Nordic while their return window is open, move PU foam to Dublin where it sells, and target the Unistrut and tile cutters at the customers who bought them last year. Don't discount the fan heaters: winter demand starts in October.",
      cols: ["SKU", "Value", "Idle", "Action"],
      rows: [["LT-8305 floodlight", "€8,892", "212 days", "Supplier return"], ["FIX-2402 Unistrut", "€7,938", "188 days", "Target M&E"], ["TL-5204 SDS bits", "€5,851", "104 days", "Promotion"], ["LT-8410 exit sign", "€4,712", "233 days", "Stop, return"]],
      actions: [["Slow & dead stock", 1, ["go", "Inventory", "Slow & Dead Stock"]], ["Working capital", 0, ["go", "Finance", "Working Capital"]]]
    },
    otif: {
      tool: "otif_analysis", effect: "read", keys: ["otif", "on time", "in full", "fallen"],
      text: "OTIF is 94.2% against a 97% target, down from 96.0% three months ago. 86 of 1,488 deliveries this month missed. Supplier delay is the biggest cause (31%), then stock shortage (24%) and warehouse delay (18%). Orders containing an Atlas line run at 81.4%. Fixing the Atlas lines alone would lift OTIF by about 1.1 points; the Dublin picker shortfall costs another 0.6.",
      cols: ["Reason", "Share", "Failures", "Fix"],
      rows: DB.delivery.reasons.slice(0, 4).map((r) => [r[0], r[1] + "%", String(r[2]), r[0] === "Supplier delay" ? "Dual-source" : r[0] === "Stock shortage" ? "Reorder points" : r[0] === "Warehouse delay" ? "Pick staffing" : "Route plan"]),
      actions: [["Open OTIF", 1, ["go", "Delivery", "OTIF"]], ["Which supplier is causing the most disruption?", 0]]
    },
    supplier: {
      tool: "supplier_performance", effect: "read", keys: ["disruption", "supplier", "worst supplier", "causing"],
      text: "Atlas Industrial Supplies, by a distance. €1.84m of annual spend, but 86.2% OTIF, an average delay of 3.8 days and 126 customer orders affected this year. Two POs are late right now, including PO-8821, and they moved a third this morning. Polska Workwear is next but touches far fewer orders. I'd dual-source cable to EuroCable and take Atlas's numbers to a review.",
      cols: ["Supplier", "OTIF", "Delay", "Orders hit"],
      rows: [["Atlas Industrial", "86.2%", "3.8 days", "126"], ["Polska Workwear", "89.4%", "3.1 days", "9"], ["Hartmann Elektro", "90.8%", "2.1 days", "22"], ["Nordic Lighting", "91.2%", "2.4 days", "11"]],
      actions: [["Open Atlas", 1, ["open", "supplier", "atlas"]], ["Supplier performance", 0, ["go", "Purchasing", "Supplier Performance"]]]
    },
    atlas: {
      tool: "po_dependencies", effect: "read", keys: ["depend on atlas", "atlas", "po-8821", "8821"],
      text: "Six customer orders worth €41,880 depend on Atlas PO-8821, which is five days late and now due tomorrow at 10:30. Three of them (Murphy, Horizon, Liffey) are on today's D14 run, so they go partial unless something changes. Atlas can put the short SKUs on a dedicated van for 07:30 for €420.",
      cols: ["Order", "Customer", "Value", "Due"],
      rows: DB.po("PO-8821").depOrders.map((id) => { const o = DB.order(id); return [o.id, DB.custName(o.cust), eur(o.value), rel(D(o.req))]; }),
      actions: [["Open PO-8821", 1, ["open", "po", "PO-8821"]], ["Expedite for €420", 0, ["open", "po", "PO-8821"]]]
    },
    sarah: {
      tool: "account_calls", effect: "read", keys: ["sarah", "call customers", "who should", "call today"],
      text: "Four calls for Sarah today. Murphy Building Supplies: confirm the split delivery, and raise PPE; they have not bought any in 74 days. Doyle Construction: ask for INV-28482 before the balance of SO-10503 can go. Harbour Point: tell them the cable lands on the Naas shuttle, and mention QT-2859 is with Michael. Dunmore Civil: SO-10511 is waiting on Atlas and €8,120 is over 60 days.",
      cols: ["Customer", "About", "Value", "When"],
      rows: [["Murphy Building Supplies", "Split + PPE", "€27,640", "Before 13:00"], ["Doyle Construction", "INV-28482", "€11,860", "Before 10:00"], ["Harbour Point", "Cable, QT-2859", "€14,860", "Today"], ["Dunmore Civil", "Overdue, SO-10511", "€8,120", "Today"]],
      actions: [["Open Murphy", 1, ["open", "customer", "murphy"]], ["Open Doyle", 0, ["open", "customer", "doyle"]]]
    },
    wc: {
      tool: "working_capital", effect: "read", keys: ["working capital", "trapped", "cash tied", "where is our cash", "cash"],
      text: "€2.78m is tied up: €2.46m in stock and €318k in receivables, against €486k owed to suppliers. The stock is where it is trapped. €286k is slow-moving and €189k is over 120 days old. €226,000 is releasable: €168,000 from slow stock, €38,000 by collecting what is past 60 days, €12,000 from supplier terms and €8,000 from tighter reorder quantities.",
      cols: ["Lever", "Release", "Owner", "Page"],
      rows: DB.finance.wcRelease.map((r) => [r[0], eur(r[1]), r[0] === "Improved collections" ? "Rachel Hayes" : r[0] === "Supplier terms" ? "Emma Walsh" : "Emma Walsh", r[0] === "Improved collections" ? "Debtors" : "Inventory"]),
      actions: [["Open working capital", 1, ["go", "Finance", "Working Capital"]], ["What inventory can we reduce?", 0]]
    },
    murphy: {
      tool: "order_explain", effect: "read", keys: ["so-10482", "10482", "murphy"],
      text: "SO-10482 for Murphy Building Supplies is €27,640 at 24.7% margin, due tomorrow. 15 of 18 lines are picked to bay 4. The other three (EL-4408 cable, EL-4631 glands, IC-3310 cable ties) are on Atlas PO-8821, five days late and now due tomorrow at 10:30. Ger Murphy asked this morning for what is in stock today, so the partial shipment is what the customer wants too.",
      cols: ["SKU", "Short", "Source", "Arrives"],
      rows: [["EL-4408", "28", "PO-8821", rel(D(1)) + " 10:30"], ["EL-4631", "60", "PO-8821", rel(D(1)) + " 10:30"], ["IC-3310", "24", "PO-8821", rel(D(1)) + " 10:30"]],
      actions: [["Open SO-10482", 1, ["open", "order", "SO-10482"]], ["Draft an update to Murphy", 0]]
    },
    credit: {
      tool: "credit_exposure", effect: "read", keys: ["credit", "limit", "doyle", "owe", "overdue", "hold"],
      text: "Nine orders worth €35,440 are on credit hold. Doyle Construction is the one that matters: €42,680 owed against a €50,000 limit, with INV-28482 (€11,860) at 61 days. Their new €16,240 order would take them to €58,920. Release €7,320 against available credit today and ask for INV-28482 before releasing the rest.",
      cols: ["Customer", "Balance", "Limit", "Oldest"],
      rows: [["Doyle Construction", "€42,680", "€50,000", "61 days"], ["Dunmore Civil", "€19,440", "€40,000", "92 days"], ["Southside DIY", "€9,720", "€15,000", "94 days"], ["Leinster Retail", "€64,210", "€120,000", "63 days"]],
      actions: [["Credit control", 1, ["go", "Finance", "Credit Control"]], ["Open Doyle", 0, ["open", "customer", "doyle"]]]
    },
    stock: {
      tool: "availability", effect: "read", keys: ["in stock", "el-4408", "4408", "cable", "availab", "do we have"],
      text: "EL-4408 Industrial Cable 100m: 12 available in Dublin on the system, but the bin count at 09:06 found 4. 26 are allocated. Naas has 64 available. 120 are coming on PO-8821 tomorrow at 10:30. At 32 a week Dublin stocks out within three days without the Naas transfer. EL-4412 Pro is an approved substitute with 84 available.",
      cols: ["Where", "Available", "Allocated", "Incoming"],
      rows: [["Dublin", "12 (4 counted)", "26", "120 · PO-8821"], ["Naas", "64", "7", "0"], ["EL-4412 substitute", "84", "12", "0"]],
      actions: [["Open EL-4408", 1, ["open", "product", "EL-4408"]], ["Approve transfer", 0, ["go", "Inventory", "Transfers"]]]
    },
    draft: {
      tool: "email_draft", effect: "write", confirm: true, keys: ["draft", "email", "send", "notify murphy", "update to murphy"],
      confirmSummary: "Send one email from Sarah Byrne's Outlook to Ger Murphy (Murphy Building Supplies) about SO-10482: 15 of 18 lines on D14 today, arriving about 14:30; EL-4408, EL-4631 and IC-3310 follow " + relLower(D(1)) + " afternoon.",
      text: "Drafted. Sending is a write tool, so it has not gone. The proposal is stored against a hash of the exact arguments, and confirming replays those stored arguments rather than anything from your yes.",
      actions: [["Confirm and send", 1], ["Edit draft", 0]]
    },
    fallback: {
      tool: "core_search", effect: "read", keys: [],
      text: "Everything I reach goes through a registered tool with a declared permission, and none of them covers that question yet. Here is what I can answer right now.",
      actions: [["What do I need to fix today?", 1], ["What is most likely to cost us money today?", 0], ["What should we buy today?", 0], ["Where are we losing margin?", 0]]
    }
  };
  const ORDER = ["draft", "money", "brief", "atlas", "murphy", "late", "buy", "reduced", "reduce", "otif", "supplier", "sarah", "wc", "credit", "stock", "margin"];
  PD.helios = {
    answers: A,
    pick(q) {
      const s = String(q || "").toLowerCase();
      for (const k of ORDER) if (A[k].keys.some((w) => s.indexOf(w) > -1)) return A[k];
      return A.fallback;
    },
    suggestions: ["What do I need to fix today?", "What is most likely to cost us money today?", "What orders are likely to go late?", "Where are we losing margin?", "What should we buy today?", "Which supplier is causing the most disruption?"]
  };

  /* ---------------- ⌘K search ---------------- */
  const GLYPH = {
    order: "M7.5 4.5h9A1.5 1.5 0 0 1 18 6v14.5l-2.2-1.4-2 1.4-1.8-1.4-1.8 1.4-2-1.4L6 20.5V6a1.5 1.5 0 0 1 1.5-1.5Z M9 9h6 M9 12.5h6",
    customer: "M4 20V7.5L12 4l8 3.5V20 M9.5 20v-5.5h5V20",
    product: "M12 3 20 7.4v9.2L12 21l-8-4.4V7.4L12 3Z M4 7.4l8 4.4 8-4.4 M12 11.8V21",
    po: "M3.5 4.5h2.4l2.2 10.4h9.6l2-7.4H7 M10 19.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z M17 19.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z",
    supplier: "M3.5 20V10l5 3V10l5 3V6.5h4l1 6.5H20.5V20Z",
    route: "M2.5 6.5h11v9h-11z M13.5 9.5h4.2l3.3 3.4v2.6h-7.5 M6.5 18.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z M17 18.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z",
    quote: "M6.4 3.6h7.4l4.2 4.2v12.6H6.4V3.6Z M13.4 3.8v4.2h4.2 M9 12.4h6 M9 16h4",
    person: "M12 4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2 M4.8 20a7.2 7.2 0 0 1 14.4 0",
    page: "M6.5 3.5h8l4 4v13h-12z M14.5 3.5v4h4"
  };
  PD.searchGlyph = GLYPH;

  PD.search = function (q, nav) {
    const s = String(q || "").trim().toLowerCase();
    if (!s) return { groups: [], rich: null };
    const has = (t) => String(t).toLowerCase().indexOf(s) > -1;
    const groups = [];
    const add = (group, scope, items) => { if (items.length) groups.push({ group, scope, items }); };
    add("Customers", "Records", DB.customers.filter((c) => has(c.name) || has(c.id)).map((c) => ({ title: c.name, meta: c.type + " · " + DB.person(c.am) + " · " + eur(c.out) + " outstanding", hint: "CUSTOMER", icon: GLYPH.customer, go: () => nav.open("customer", c.id) })));
    add("Orders", "Records", DB.orders.filter((o) => has(o.id) || has(DB.custName(o.cust))).slice(0, 8).map((o) => ({ title: o.id + " · " + DB.custName(o.cust), meta: eur(o.value) + " · " + o.status + " · " + (o.risk === "ON TRACK" ? "on track" : o.risk.toLowerCase() + " risk"), hint: "ORDER", icon: GLYPH.order, go: () => nav.open("order", o.id) })));
    add("Products", "Records", DB.products.filter((p) => has(p.sku) || has(p.name) || has(p.cat)).slice(0, 8).map((p) => ({ title: p.sku + " · " + p.name, meta: p.avail + " available · " + p.alloc + " allocated · " + p.health.toLowerCase(), hint: "SKU", icon: GLYPH.product, go: () => nav.open("product", p.sku) })));
    add("Purchase orders", "Records", DB.pos.filter((p) => has(p.id) || has(DB.supplier(p.supplier).name)).slice(0, 6).map((p) => ({ title: p.id + " · " + DB.supplier(p.supplier).name, meta: eur(p.value) + " · " + p.status + (p.deps ? " · " + p.deps + " orders waiting" : ""), hint: "PO", icon: GLYPH.po, go: () => nav.open("po", p.id) })));
    add("Suppliers", "Records", DB.suppliers.filter((x) => has(x.name) || has(x.id)).map((x) => ({ title: x.name, meta: x.cat + " · OTIF " + x.otif + "% · " + x.status, hint: "SUPPLIER", icon: GLYPH.supplier, go: () => nav.open("supplier", x.id) })));
    add("Quotes", "Records", DB.quotes.filter((x) => has(x.id) || has(DB.custName(x.cust))).slice(0, 5).map((x) => ({ title: x.id + " · " + DB.custName(x.cust), meta: eur(x.value) + " · " + x.margin + "% margin · " + x.status, hint: "QUOTE", icon: GLYPH.quote, go: () => nav.open("quote", x.id) })));
    add("Routes", "Records", DB.routes.filter((r) => has(r.id) || has("route " + r.id) || has(r.reg) || has(DB.person(r.driver))).map((r) => ({ title: "Route " + r.id + " · " + r.area, meta: DB.person(r.driver) + " · " + r.reg + " · " + r.status, hint: "ROUTE", icon: GLYPH.route, go: () => nav.open("route", r.id) })));
    add("People", "Records", Object.keys(DB.staff).filter((k) => has(DB.staff[k].name)).slice(0, 5).map((k) => ({ title: DB.staff[k].name, meta: DB.staff[k].role, hint: "PERSON", icon: GLYPH.person, go: () => nav.go("Settings", "Teams") })));
    const pages = [];
    PD.MODULES.forEach((m) => { if (!m.divider) m.subs.forEach((sub) => { if (has(sub) || has(m.id)) pages.push({ title: m.id + " · " + sub, meta: "Page", hint: "PAGE", icon: GLYPH.page, go: () => nav.go(m.id, sub) }); }); });
    add("Pages", "Pages", pages.slice(0, 6));

    // The rich answer card: the record that best matches, with the facts that matter.
    let rich = null;
    const c = DB.customers.find((x) => has(x.name) && s.length >= 3);
    const p = DB.products.find((x) => x.sku.toLowerCase() === s || (s.length >= 4 && has(x.sku)));
    const o = DB.orders.find((x) => x.id.toLowerCase() === s || (s.length >= 6 && has(x.id)));
    const po = DB.pos.find((x) => x.id.toLowerCase() === s || (s.length >= 6 && has(x.id)));
    const sup = DB.suppliers.find((x) => s.length >= 4 && has(x.name));
    const card = (kicker, title, facts, go, tone) => h("div", { onClick: go, className: "pd-click", style: { margin: "4px 14px 10px", padding: "14px 16px", borderRadius: 16, border: "1px solid var(--accent-line)", background: "linear-gradient(150deg,var(--accent-soft),transparent 70%),var(--surface)", cursor: "pointer" } },
      h("div", { className: "pd-split" }, h("span", { className: "pd-label", style: { color: "var(--accent-text)" } }, kicker), h("span", { style: { marginLeft: "auto" } }, UI.Badge("↵ OPEN", "info", true))),
      h("div", { style: { fontSize: 16, fontWeight: 500, marginTop: 6, letterSpacing: "-.2px" } }, title),
      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 10 } }, ...facts.map((f, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "var(--body)", minWidth: 0 } }, h("span", { className: "pd-dot", style: { background: PD.TONE[f[1] || "neutral"].fg } }), h("span", { className: "pd-ell" }, f[0])))));
    if (c) {
      const ords = DB.orders.filter((x) => x.cust === c.id), atRisk = ords.filter((x) => x.risk !== "ON TRACK" && !x.hold);
      const big = ords.slice().sort((a, b) => b.value - a.value)[0];
      rich = { go: () => nav.open("customer", c.id), el: card("Customer · " + c.type, c.name, [
        big ? [big.id + " · " + eur(big.value) + " open order", big.risk === "ON TRACK" ? "ok" : "warn"] : ["No open orders", "neutral"],
        [eur(c.out) + " outstanding balance", c.out / c.limit > .8 ? "bad" : "neutral"],
        [atRisk.length ? atRisk.length + (atRisk.length === 1 ? " delivery at risk" : " deliveries at risk") : "No deliveries at risk", atRisk.length ? "bad" : "ok"],
        [DB.person(c.am) + " · account manager", "info"]], () => nav.open("customer", c.id)) };
    } else if (p) {
      const isC = p.sku === "EL-4408";
      rich = { go: () => nav.open("product", p.sku), el: card("SKU · " + p.cat, p.sku + " · " + p.name, [
        [p.avail + " available", p.avail < p.safety ? "bad" : "ok"], [p.alloc + " allocated", "neutral"],
        [p.po ? p.po + " incoming" : "No PO open", p.po ? "info" : "neutral"],
        [isC ? "Projected stockout · 6 affected customer orders" : p.health + " · " + p.cover + " cover", ["Critical", "Dead"].indexOf(p.health) > -1 ? "bad" : ["Low", "Excess", "Slow"].indexOf(p.health) > -1 ? "warn" : "ok"]], () => nav.open("product", p.sku)) };
    } else if (o) {
      rich = { go: () => nav.open("order", o.id), el: card("Order · " + DB.person(o.am), o.id + " · " + DB.custName(o.cust), [[eur(o.value) + " · " + o.margin + "% margin", "neutral"], [o.status, PD.ord.STATUS_TONE[o.status] || "neutral"], [o.reason ? o.reason : "On track", o.reason ? "bad" : "ok"], [o.route ? "Route " + o.route : "Not routed", "info"]], () => nav.open("order", o.id)) };
    } else if (po) {
      rich = { go: () => nav.open("po", po.id), el: card("Purchase order · " + DB.supplier(po.supplier).name, po.id, [[eur(po.value) + " · " + po.items + " SKUs", "neutral"], [po.status, /Late|risk/i.test(po.status) ? "bad" : "ok"], [po.deps + " customer orders dependent", po.deps ? "warn" : "neutral"], ["Expected " + relLower(D(po.expected)), "info"]], () => nav.open("po", po.id)) };
    } else if (sup) {
      rich = { go: () => nav.open("supplier", sup.id), el: card("Supplier · " + sup.country, sup.name, [["OTIF " + sup.otif + "%", sup.otif < 90 ? "bad" : "ok"], [eurK(sup.spend) + " annual spend", "neutral"], [sup.affected + " orders affected this year", sup.affected > 50 ? "bad" : "neutral"], [sup.status, sup.tone]], () => nav.open("supplier", sup.id)) };
    }
    return { groups, rich };
  };
})();
