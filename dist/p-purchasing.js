/* Purchasing: the buying desk as its own operating system. What to buy and from whom, what is late
   and which customers feel it, what lands today, and which supplier is costing us service.
   Reads PD.DB. Local data are the draft POs, alternative supplier quotes and five late POs with
   smaller suppliers, all reconciled to the canonical totals: 82 open POs worth €742k, 11 late,
   34 due in the next 7 days, €184k recommended across 147 SKUs. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, dm } = PD.date;
  const B = UI.B;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const relIn = (n) => n === 0 ? "today" : n === 1 ? "tomorrow" : rel(D(n));
  const gap = () => h("div", { style: { height: 14 } });
  const mono = (t, ink) => h("span", { className: "pd-mono", style: { fontSize: 12, color: ink ? "var(--ink)" : "var(--body)" } }, t);
  const none = () => h("span", { className: "pd-faint" }, "None");

  /* ---------------- canonical purchasing figures ---------------- */
  const OPEN_POS = 82, OPEN_VALUE = 742000, DUE_WEEK = 34, FILL = 94.8, SUP_OTIF = 91.6, LEAD = 16.4, LEAD_PROMISED = 14.1;
  const REC_VALUE = 184000, REC_SKUS = 147, SPEND_TOTAL = 11720000;
  const GBP_RATE = 0.846; // Sage 200 daily rate, € to £
  const gbp = (v) => "£" + num(Math.round(v * GBP_RATE / 10) * 10);
  const SHORT = { atlas: "Atlas", eurofix: "EuroFix", northgate: "Northgate", hartmann: "Hartmann", kerry: "Kerry", safepro: "SafePro", celtic: "Celtic", eurocable: "EuroCable", midland: "Midland", nordic: "Nordic", polska: "Polska" };
  const supName = (id) => (DB.supplier(id) || {}).name || id;

  /* ---------------- local data ---------------- */
  // Five late POs with smaller suppliers (part of the 53 outside the key eleven). With the six late
  // POs in DB.pos they are the 11 late POs quoted everywhere. None has a customer order waiting.
  const SMALL_LATE = [
    { id: "PO-8795", supName: "Shannon Packaging Ltd", ccy: "EUR", value: 4860, items: 3, ordered: -21, promised: -3, expected: 2, eta: "09:30", wh: "DUB", status: "Late", deps: 0, risk: "LOW", lateDays: 3, buyer: "CK", pallets: 6, local: true },
    { id: "PO-8801", supName: "Boyne Signs & Safety", ccy: "EUR", value: 3240, items: 6, ordered: -18, promised: -2, expected: 1, eta: "11:00", wh: "NAS", status: "Late", deps: 0, risk: "LOW", lateDays: 2, buyer: "CK", pallets: 4, local: true },
    { id: "PO-8803", supName: "Lakeland Ladders Ltd", ccy: "GBP", value: 6920, items: 4, ordered: -17, promised: -4, expected: 3, eta: "13:30", wh: "DUB", status: "Late", deps: 0, risk: "LOW", lateDays: 4, buyer: "CK", pallets: 5, local: true },
    { id: "PO-8806", supName: "Castle Brush Company", ccy: "EUR", value: 2410, items: 5, ordered: -16, promised: -1, expected: 2, eta: "14:00", wh: "NAS", status: "Late", deps: 0, risk: "LOW", lateDays: 1, buyer: "CK", pallets: 3, local: true },
    { id: "PO-8811", supName: "Vistula Gloves Sp. z o.o.", ccy: "EUR", value: 4430, items: 3, ordered: -22, promised: -5, expected: 4, eta: "10:00", wh: "NAS", status: "Late", deps: 0, risk: "LOW", lateDays: 5, buyer: "EW", pallets: 4, local: true }
  ];
  const ALL_POS = DB.pos.concat(SMALL_LATE);
  const PALLETS = { "PO-8821": 16, "PO-8836": 9, "PO-8818": 11, "PO-8812": 7, "PO-8807": 8, "PO-8816": 14, "PO-8809": 12, "PO-8838": 9, "PO-8841": 18, "PO-8844": 6, "PO-8845": 7 };
  const pallets = (p) => p.pallets || PALLETS[p.id] || 0;
  const isLate = (p) => p.status === "Late";
  const LATE = ALL_POS.filter(isLate);
  const LATE_VALUE = sum(LATE.map((p) => p.value));
  // POs due in the next 7 days that are not in the table: on-time replenishment, no customer waiting. [count, value] by day offset.
  // Spread over the working days in that window so hauliers are not booked on a weekend.
  const UNLISTED_RAW = [[4, 24780], [3, 19430], [3, 20160], [3, 17040], [1, 6900]];
  const UNLISTED = {};
  (function () {
    const wd = [2, 3, 4, 5, 6].filter((n) => [0, 6].indexOf(D(n).getDay()) < 0);
    UNLISTED_RAW.forEach((u, i) => { const n = wd[i % wd.length], cur = UNLISTED[n] || [0, 0]; UNLISTED[n] = [cur[0] + u[0], cur[1] + u[1]]; });
  })();
  const WEEK = [0, 1, 2, 3, 4, 5, 6].map((n) => {
    const shown = ALL_POS.filter((p) => p.expected === n), u = UNLISTED[n] || [0, 0];
    return { n, count: shown.length + u[0], value: sum(shown.map((p) => p.value)) + u[1] };
  });
  const WEEK_VALUE = sum(WEEK.map((w) => w.value));

  // Today's goods-in bookings. Times in decimal hours.
  const SLOTS = {
    "PO-8826": { bay: "Bay 1", from: 8 + 20 / 60, mins: 35, state: "Received 08:55 · 24 short", tone: "warn", note: "Booked 09:40, arrived early at 08:20" },
    "PO-8834": { bay: "N1", from: 10.25, mins: 90 },
    "PO-8829": { bay: "Bay 1", from: 11, mins: 60 },
    "PO-8830": { bay: "Bay 2", from: 12.5, mins: 45 },
    "PO-8839": { bay: "N1", from: 13, mins: 120, state: "Needs both receivers", tone: "warn" },
    "PO-8833": { bay: "N2", from: 14, mins: 30, state: "Clashes with Polska", tone: "warn" },
    "PO-8832": { bay: "Bay 1", from: 15.5, mins: 40 }
  };
  const hhmm = (t) => { const hr = Math.floor(t), mn = Math.round((t - hr) * 60); return (hr < 10 ? "0" : "") + hr + ":" + (mn < 10 ? "0" : "") + mn; };
  // What each delivery releases: customer accounts with orders allocated against it (count = DB deps).
  const RELEASE = {
    "PO-8826": { skus: ["AD-7110"], custs: [] },
    "PO-8834": { skus: ["FH-6602"], custs: ["core", "kelleher"] },
    "PO-8829": { skus: ["FIX-2240", "FIX-2261"], custs: ["liffey", "harbour", "dunmore"] },
    "PO-8830": { skus: ["EL-4520"], custs: ["westbrook"] },
    "PO-8839": { skus: ["SAF-1930"], custs: ["kelleher", "glenview"] },
    "PO-8833": { skus: ["IC-3405"], custs: ["core", "obrien", "midland"] },
    "PO-8832": { skus: ["TL-5120"], custs: ["brennan", "tallaght"] },
    "PO-8836": { skus: ["EL-4712"], custs: ["horizon", "harbour", "leinster", "liffey"] },
    "PO-8818": { skus: ["TL-5145"], custs: ["brennan", "westbrook"] },
    "PO-8838": { skus: ["IC-3322"], custs: ["core", "leinster"] },
    "PO-8844": { skus: ["LT-8120"], custs: ["leinster", "murphy"] },
    "PO-8829x": null
  };

  /* Draft POs from the overnight buying run: one per supplier, 147 SKUs, €184,000.
     Lines: [sku, name, available, weekly, incoming, moq, qty, unit, why]. For SKUs in the
     database, stock figures come from PD.DB; the unit cost is this supplier's price. */
  const L_ = (sku, name, avail, weekly, incoming, moq, qty, unit, why) => ({ sku, name, avail, weekly, incoming, moq, qty, unit, why });
  const DRAFTS = [
    { id: "PO-8846", sup: "eurocable", value: 9344, skus: 2, urgent: 1, kind: "change", flag: "Supplier change", flagTone: "info", key: "po-el4408", headline: "160 × EL-4408 and 80 × EL-4712",
      why: "EL-4408 moved from Atlas this cycle: 2.6 days of cover against a 28-day Atlas lead time.",
      lines: [L_("EL-4408", null, null, null, null, 50, 160, 22.20, "Stockout in 3 days. Five weeks of Dublin demand; EuroCable lands in 9 days"),
        L_("EL-4712", null, null, null, null, 40, 80, 72.40, "Bought ahead of EuroCable's next copper surcharge review; the last took cost from €62.40 to €72.40")],
      ai: "EuroCable costs €0.45 more landed per reel of EL-4408, €72 on the 160. Waiting for Atlas leaves Dublin short for 19 days with €12,460 of orders exposed this week. Atlas stays the price-file supplier; this is a one-cycle switch. EL-4712 rides on the same PO, bought ahead of the copper surcharge review." },
    { id: "PO-8847", sup: "kerry", value: 12740, skus: 7, urgent: 1, kind: "emergency", flag: "Emergency", flagTone: "bad", key: "po-fh6710", headline: "400 × FH-6710 plus 6 hygiene lines",
      why: "FH-6710 hand soap: 7 orders short 164 units and nobody has raised a PO.",
      lines: [
        L_("FH-6710", null, null, null, null, 240, 400, 6.40, "7 orders short 164 units. No PO raised"),
        L_("FH-6602", null, null, null, null, 300, 300, 11.20, "Due in 4 days anyway: Core Facilities' new Citywest sites add about 20 cases a week"),
        L_("FH-6630", "Toilet Roll 2-ply (36)", 140, 90, 0, 120, 240, 12.80, "Below reorder point since " + rel(D(-2))),
        L_("FH-6804", "Refuse Sack Heavy Duty (200)", 60, 40, 0, 60, 120, 16.10, "Lead time 5 days plus safety stock"),
        L_("FH-6552", "Blue Roll 2-ply (6)", 50, 38, 0, 48, 96, 9.40, "Topped up to MOQ on the same delivery"),
        L_("FH-6715", "Foam Soap Dispenser 800ml", 12, 9, 0, 24, 48, 14.20, "Goes with FH-6710 on Core Facilities' new sites"),
        L_("FH-6722", "Hand Sanitiser Gel 5L", 18, 8, 0, 20, 20, 11.60, "At MOQ; 2.3 weeks of cover")],
      ai: "Hand soap has 5.8 days of cover in Naas and 7 orders already short. Kerry delivers in 5 days, so raising it today lands it before Naas runs dry. The other six lines, including 300 centrefeed rolls Pulse would otherwise order in 4 days, ride on the same delivery. Today's Kerry delivery (PO-8834) does not include FH-6710." },
    { id: "PO-8848", sup: "eurofix", value: 38620, skus: 36, urgent: 2, kind: "large", flag: "Over €25k", flagTone: "warn", key: "pur-d-eurofix", headline: "36 fixings lines",
      why: "Priced on this morning's price file. Push back on the increase before it is sent.",
      lines: [
        L_("FIX-2240", "M8 Hex Bolt Box 100", 140, 96, 250, 250, 500, 12.40, "PO-8829 clears today's backorders; this covers weeks 3 to 8"),
        L_("FIX-2261", "M10 Shield Anchor (50)", 88, 44, 0, 100, 300, 21.80, "Under reorder point for 3 days"),
        L_("FIX-2318", "Self-drill Tek Screw 5.5x32 (500)", 210, 70, 0, 200, 400, 13.60, "14-day lead time plus safety stock"),
        L_("FIX-2410", "Threaded Rod M10 1m (10)", 64, 38, 0, 100, 200, 16.30, "Harbour Point phase 2 (QT-2859) adds 60 a week if won"),
        L_("FIX-2355", "Frame Fixing 10x100 (50)", 120, 52, 0, 100, 250, 11.90, "Normal replenishment")],
      ai: "Priced on the file EuroFix sent at 08:31: 428 changes, M10 bolts up 10.4%. These 36 lines cost €2,490 more than they did last month. Atlas has quoted €17.60 on M10; use it to ask Katrin Vogel to phase the increase before this goes." },
    { id: "PO-8850", sup: "atlas", value: 32180, skus: 31, urgent: 3, kind: "large", flag: "Over €25k", flagTone: "warn", key: "pur-d-atlas", headline: "31 consumables lines",
      why: "Consumables only. Planned on the 31.8 days Atlas actually takes, not the 28 on the price file.",
      lines: [
        L_("IC-3310", null, null, null, null, 100, 100, 14.20, "PO-8821's 200 clears the 74 short and leaves 126, under 5 weeks"),
        L_("EL-4631", null, null, null, null, 200, 200, 6.80, "PO-8821 clears the 150 waiting and leaves 250, about 5 weeks"),
        L_("IC-3322", "Cable Ties 200mm Black (1000)", 90, 42, 0, 100, 300, 9.40, "2.1 weeks of cover against 4.5 weeks' real lead time"),
        L_("IC-3380", "Duct Tape 50mm Silver (24)", 36, 22, 0, 60, 120, 28.60, "Would stock out before the next Atlas delivery"),
        L_("IC-3340", "Insulation Tape 19mm Mixed (100)", 22, 18, 0, 20, 60, 22.60, "Would stock out before the next Atlas delivery"),
        L_("IC-3502", "Spray Marker Fluoro Red 500ml", 300, 64, 0, 240, 480, 3.20, "Normal replenishment")],
      ai: "The cable lines where stock risk is high have moved to EuroCable; this draft is consumables. Pulse plans Atlas on the 31.8 days it has actually taken over 12 months, so 9 of these lines are on this run instead of next week's. EL-4631 glands and IC-3310 ties are topped up here, not on a separate order: PO-8821 clears their backorders but leaves under 5 weeks on Atlas' real lead time." },
    { id: "PO-8849", sup: "northgate", value: 25940, skus: 20, urgent: 2, kind: "large", flag: "Over €25k · GBP", flagTone: "warn", key: "pur-d-northgate", headline: "20 tools lines",
      why: "Raised in sterling. TL-5120 drill kits are not on it: PO-8832 lands 24 at 15:30.",
      lines: [
        L_("TL-5130", "18V Impact Driver Kit", 8, 7, 0, 12, 24, 128.00, "1.1 weeks of cover, 12-day lead time"),
        L_("TL-5145", "18V 5.0Ah Battery", 22, 18, 0, 20, 60, 58.40, "2 orders also wait on PO-8818"),
        L_("TL-5301", "Angle Grinder 115mm 850W", 24, 9, 0, 12, 36, 46.20, "Below reorder point"),
        L_("TL-5244", "Tape Measure 8m (12)", 22, 10, 0, 20, 40, 38.40, "Below reorder point"),
        L_("TL-5220", "Spirit Level 1200mm", 16, 8, 0, 24, 48, 24.60, "At MOQ")],
      ai: "Raised in sterling: " + gbp(25940) + " at today's 0.846. Northgate is 2 days late on PO-8818 but runs at 92.6% OTIF overall, so no change of supplier. Nothing on this draft duplicates PO-8818 or today's PO-8832." },
    { id: "PO-8852", sup: "hartmann", value: 20608, skus: 9, urgent: 1, kind: "normal", flag: "", flagTone: "neutral", key: "pur-d-hartmann", headline: "9 protection lines",
      why: "Distribution boards and protection. Nothing on it overlaps with late PO-8809.",
      lines: [
        L_("EL-4524", "Consumer Unit 16-way RCBO", 6, 4, 0, 6, 24, 214.00, "1.5 weeks of cover, 21-day lead time"),
        L_("EL-4530", "RCBO 32A Type A", 170, 48, 0, 60, 240, 19.80, "Below reorder point"),
        L_("EL-4555", "Surge Protection Device T2", 20, 6, 0, 12, 60, 48.50, "Hartmann ships SPDs quarterly"),
        L_("EL-4541", "MCB 16A B-curve", 400, 110, 0, 200, 600, 3.10, "Normal replenishment")],
      ai: "Hartmann is 3 days late on PO-8809, which Horizon's SO-10528 waits on. Pulse has not doubled up: nothing on this draft is on PO-8809, and EL-4520 lands on PO-8830 at 12:30 today." },
    { id: "PO-8854", sup: "midland", value: 17888, skus: 15, urgent: 1, kind: "normal", flag: "GBP", flagTone: "neutral", key: "pur-d-midland", headline: "15 abrasives lines",
      why: "Sterling, and priced after last month's 8.9% increase on discs.",
      lines: [
        L_("IC-3144", "Flap Disc 115mm 80 grit (10)", 64, 58, 0, 100, 400, 12.10, "1.1 weeks of cover; now €12.10, up 9.0%"),
        L_("IC-3125", "Cutting Disc 230mm (25)", 45, 22, 0, 40, 160, 24.80, "Below reorder point"),
        L_("IC-3172", "Sanding Roll 115mm 120 grit 50m", 24, 11, 0, 20, 60, 18.30, "Below reorder point"),
        L_("IC-3160", "Wire Cup Brush 75mm", 60, 24, 0, 60, 120, 7.90, "At MOQ")],
      ai: "Midland put cutting and flap discs up 8.9% last month and is on 30-day terms. Ask for 40 days in return: that alone releases about €11,500 of cash, most of Finance's €12,000 supplier-terms target." },
    { id: "PO-8851", sup: "safepro", value: 18260, skus: 15, urgent: 1, kind: "normal", flag: "GBP", flagTone: "neutral", key: "pur-d-safepro", headline: "15 PPE lines",
      why: "PPE top-up. SAF-1892 safety glasses are left off: transfer from Naas instead.",
      lines: [
        L_("IC-3405", null, null, null, null, 500, 1000, 4.10, "Glove demand runs 18% higher from October; PO-8833 goes to Naas, not Dublin"),
        L_("SAF-1850", "FFP3 Mask Valved (10)", 45, 40, 0, 100, 200, 17.40, "1.1 weeks of cover"),
        L_("SAF-1872", "Cut Resistant Glove L (12)", 50, 30, 0, 50, 150, 22.80, "Below reorder point"),
        L_("SAF-1826", "Anti-mist Goggles", 80, 48, 0, 120, 240, 4.60, "Below reorder point"),
        L_("SAF-1811", "Ear Defenders SNR 30", 32, 20, 0, 60, 120, 8.90, "At MOQ")],
      ai: "The Sage reorder rule wanted 500 × SAF-1892 safety glasses for Dublin. Naas has 1,630 available, so Pulse left them off this draft and proposed a 300-unit transfer on the shuttle instead." },
    { id: "PO-8853", sup: "celtic", value: 8420, skus: 12, urgent: 0, kind: "normal", flag: "", flagTone: "neutral", key: "pur-d-celtic", headline: "12 sealants lines",
      why: "Includes the 24 × AD-7110 Celtic short-shipped this morning.",
      lines: [
        L_("AD-7110", "Sanitary Silicone White 310ml", 180, 150, 0, 480, 960, 2.55, "Celtic short-shipped 24 on PO-8826 this morning"),
        L_("AD-7215", "Grab Adhesive 290ml", 210, 130, 0, 240, 720, 3.10, "Below reorder point"),
        L_("AD-7322", "PU Foam Hand Held 750ml", 70, 45, 0, 120, 240, 4.40, "Below reorder point")],
      ai: "Celtic short-shipped 24 × AD-7110 on PO-8826 at 08:55. The balance is folded into this draft rather than chased as a separate order; Celtic has confirmed stock. AD-7340 gun-grade foam is not on it: Naas has 95 weeks of cover." }
  ];
  const draftOf = (id) => DRAFTS.find((d) => d.id === id) || DRAFTS[0];
  const approverOf = (d) => (d.kind === "emergency" || d.kind === "change") ? "EW" : d.value > 25000 ? "PB" : d.value > 10000 ? "EW" : DB.supplier(d.sup).buyer;
  const achieved = (s) => Math.round((s.lead + s.delay) * 10) / 10;
  const lineRow = (l) => {
    const p = DB.product(l.sku);
    return p ? Object.assign({}, l, { name: p.name, avail: p.avail, weekly: p.weekly, incoming: p.incoming }) : l;
  };
  // Would it stock out before its normal supplier could replenish it? (For EL-4408 that is Atlas, which is why it moves.)
  const shortOf = (l, s) => { if (l.more) return false; const p = DB.product(l.sku), base = p ? DB.supplier(p.supplier) : s; return (l.avail + (l.incoming || 0)) / (l.weekly || 1) * 7 < achieved(base); };
  const coverOf = (avail, weekly) => {
    if (!weekly) return "No demand";
    const w = avail / weekly;
    return w < 1 ? (Math.round(w * 70) / 10) + " days" : w.toFixed(1) + " wks";
  };
  const raise = (ctx, d) => {
    const s = DB.supplier(d.sup), who = approverOf(d);
    const val = s.ccy === "GBP" ? gbp(d.value) + " (" + eur(d.value) + ")" : eur(d.value);
    const shared = d.key === "po-el4408" || d.key === "po-fh6710";
    ctx.act(d.key, shared ? "PO raised" : "PO approved",
      d.id + " to " + s.name + ": " + d.headline + ", " + val + ". " + (who === "PB" ? "Approved by Patrick Byrne and sent by EDI." : "Sent by EDI, " + DB.person(who) + " copied.") + " Expected " + relIn(Math.round(s.lead + s.delay)) + ".");
  };
  const raiseBtn = (ctx, d, opt) => {
    const shared = d.key === "po-el4408" || d.key === "po-fh6710";
    return UI.Btn(opt && opt.label ? opt.label : shared ? "Raise " + d.id : "Approve", () => raise(ctx, d), Object.assign({ sm: true, done: ctx.done(d.key), doneLabel: shared ? "PO raised" : "Approved" }, opt || {}));
  };

  /* Procurement decision view: cheapest supplier does not automatically win. */
  const DECIDE = [
    { sku: "EL-4408", risk: "HIGH", riskText: "2.6 days of cover in Dublin against a 28-day Atlas lead time. 4 orders already short.", draft: "PO-8846",
      rows: [
        { sup: "atlas", unit: 21.40, lead: 28, moq: 100, otif: 86.2, avail: 500, ccy: "EUR", landed: 22.10, tag: "CHEAPER, 19 DAYS SLOWER" },
        { sup: "eurocable", unit: 22.20, lead: 9, moq: 50, otif: 97.8, avail: 800, ccy: "EUR", landed: 22.55, rec: true, tag: "RECOMMENDED WHEN STOCK RISK IS HIGH" }],
      verdict: "EuroCable. It is €0.45 more landed per reel, €72 on 160 reels. Waiting for Atlas leaves Dublin short for 19 days with €12,460 of orders exposed this week alone. Cheapest-supplier logic would have picked the wrong one." },
    { sku: "FH-6710", risk: "HIGH", riskText: "5.8 days of cover in Naas, 7 orders short 164 units and no PO raised.", draft: "PO-8847",
      rows: [
        { sup: "kerry", unit: 6.40, lead: 5, moq: 240, otif: 94.8, avail: 1200, ccy: "EUR", landed: 6.52, rec: true, tag: "RECOMMENDED · CHEAPEST LANDED" },
        { name: "Hygiene Direct UK", unit: 6.03, unitNote: "£5.10", lead: 12, moq: 480, otif: 90.1, avail: 3000, ccy: "GBP", landed: 6.71, tag: "CHEAPEST INVOICE, DEAREST LANDED" }],
      verdict: "Kerry. Hygiene Direct is €0.37 cheaper on the invoice but €0.19 dearer landed once UK customs clearance, freight and the 480 MOQ are counted, and it lands a week later." },
    { sku: "SAF-1930", risk: "LOW", riskText: "Zero available this morning, but PO-8839 lands 400 at Naas at 13:00: about 12 weeks of cover.",
      rows: [
        { sup: "polska", unit: 3.90, lead: 21, moq: 200, otif: 89.4, avail: 5000, ccy: "EUR", landed: 4.18, rec: true, tag: "RECOMMENDED WHILE STOCK RISK IS LOW" },
        { sup: "safepro", unit: 4.26, unitNote: "£3.60", lead: 10, moq: 100, otif: 97.1, avail: 1500, ccy: "GBP", landed: 4.49, tag: "11 DAYS FASTER, €0.31 DEARER" }],
      verdict: "Polska, this time. With 12 weeks of cover landing today, the slower and cheaper supplier is the right call. If cover drops under 4 weeks, Pulse switches the recommendation to SafePro." },
    { sku: "FIX-2201", risk: "LOW", riskText: "4.6 weeks of cover and 500 landing today on PO-8829. EuroFix raised it 10.4% in this morning's price file.",
      rows: [
        { sup: "eurofix", unit: 18.10, lead: 14, moq: 250, otif: 95.4, avail: 12000, ccy: "EUR", landed: 18.62, rec: true, tag: "RECOMMENDED · NEGOTIATE" },
        { sup: "atlas", unit: 17.60, lead: 28, moq: 500, otif: 86.2, avail: 4000, ccy: "EUR", landed: 18.35, tag: "€0.27 CHEAPER, 14 DAYS SLOWER" }],
      verdict: "Stay with EuroFix and use Atlas' price to negotiate. Moving 7,700 boxes a year to a supplier at 86% OTIF to save €0.27 a box is €2,080 a year, against 37 customer contracts that rely on M10 bolts arriving." }
  ];

  /* Don't buy: lines the Sage 200 reorder rules would buy that we do not need. 7 shown + 16 more = 23 SKUs, €41,600. */
  const DONT = [
    { sku: "FIX-2402", rule: "Min 450, set for the 2024 Dublin Port job", buy: 100, why: "Job finished. Demand is 6 a week; reset the min to 40." },
    { sku: "IC-3650", rule: "Min 650, Atlas MOQ 120", buy: 120, why: "610 on hand at Naas. Another 120 adds 10 weeks nobody needs." },
    { sku: "TL-5610", rule: "Winter rule: min 60 from October", buy: 12, why: "Sold 31 last winter. 42 on hand already covers it." },
    { sku: "SAF-1892", rule: "Dublin min 400", buy: 500, why: "Dublin is under its min, but Naas has 1,630. Transfer 300 on the shuttle." },
    { sku: "TL-5204", rule: "Min 350 from an old contract", buy: 50, why: "Contract ended. Demand is 6 a week." },
    { sku: "AD-7340", rule: "Dublin min 24", buy: 120, why: "Naas has 372 idle for 128 days. Move 24 to Dublin." },
    { sku: "SAF-1905", rule: "Min 150", buy: 24, why: "Boots sell 3 a week. Drop the min to 20." }
  ];
  const DONT_TOTAL = 41600, DONT_SKUS = 23;
  const dontVal = (x) => Math.round(x.buy * DB.product(x.sku).cost);

  /* Supplier scoring. Each metric is scaled 0 to 100, then weighted. */
  const clamp = (v) => Math.max(0, Math.min(100, v));
  const METRICS = [
    { k: "otif", label: "OTIF", f: (s) => clamp((s.otif - 80) / 18 * 100), how: "80% scores 0, 98% scores 100" },
    { k: "fill", label: "Fill rate", f: (s) => clamp((s.fill - 88) / 12 * 100), how: "88% scores 0, 100% scores 100" },
    { k: "lead", label: "Lead time accuracy", f: (s) => clamp((s.leadAcc - 70) / 30 * 100), how: "Deliveries within a day of the quoted lead time" },
    { k: "delay", label: "Average delay", f: (s) => clamp((5 - s.delay) / 5 * 100), how: "On time scores 100, 5 days late scores 0" },
    { k: "quality", label: "Quality and returns", f: (s) => clamp(100 - s.quality * 4 - s.returns * 2), how: "Each quality issue costs 4 points, each return 2" },
    { k: "price", label: "Price stability", f: (s) => clamp(100 - s.priceChanges * 8), how: "Each price change in 12 months costs 8 points" },
    { k: "impact", label: "Customer impact", f: (s) => clamp(100 - s.affected / (s.spend / 1e6) * 1.5), how: "Customer orders affected per €1m of spend" }
  ];
  const PRESETS = {
    balanced: { label: "Balanced", w: { otif: 30, fill: 15, lead: 15, delay: 10, quality: 15, price: 5, impact: 10 } },
    customer: { label: "Customer impact first", w: { otif: 25, fill: 10, lead: 10, delay: 10, quality: 10, price: 5, impact: 30 } },
    price: { label: "Price stability first", w: { otif: 20, fill: 10, lead: 10, delay: 10, quality: 10, price: 30, impact: 10 } }
  };
  const scoreOf = (s, w) => sum(METRICS.map((m) => m.f(s) * w[m.k])) / 100;
  const OTIF_BY_SUP = { atlas: 81.4, polska: 88.9, hartmann: 91.7, nordic: 92.6, northgate: 94.8, eurofix: 96.8, safepro: 97.9, eurocable: 98.3 };
  const SOLE = { atlas: 96, eurofix: 58, northgate: 41, hartmann: 36, nordic: 22, polska: 17, kerry: 14, midland: 12, celtic: 9, safepro: 6, eurocable: 4 };
  const OTHERS = [["Specialist electrical", 11, 780000], ["Packaging & consumables", 14, 640000], ["Tools & ladders", 9, 520000], ["Signs, brushes & sundries", 11, 480000], ["Workwear & gloves", 8, 410000]];
  const months = (n) => Array.from({ length: n }, (_, i) => PD.date.MS[new Date(PD.date.TODAY.getFullYear(), PD.date.TODAY.getMonth() - (n - 1) + i, 1).getMonth()]);

  /* reconciliation: a console warning beats a wrong number on a slide */
  (function () {
    const chk = (label, got, want) => { if (Math.abs(got - want) > 0.51) console.warn("[PD purchasing] " + label + ": " + got + " ≠ " + want); };
    chk("late POs", LATE.length, 11);
    chk("due in 7 days", sum(WEEK.map((w) => w.count)), DUE_WEEK);
    chk("draft value", sum(DRAFTS.map((d) => d.value)), REC_VALUE);
    chk("draft SKUs", sum(DRAFTS.map((d) => d.skus)), REC_SKUS);
    chk("urgent SKUs", sum(DRAFTS.map((d) => d.urgent)), 12);
    DRAFTS.filter((d) => d.lines.length === d.skus).forEach((d) => chk(d.id + " lines", Math.round(100 * sum(d.lines.map((l) => l.qty * l.unit))) / 100, d.value));
    chk("key supplier open POs", sum(DB.suppliers.map((s) => s.openPOs)), 58);
    chk("supplier spend", sum(DB.suppliers.map((s) => s.spend)) + sum(OTHERS.map((o) => o[2])), SPEND_TOTAL);
    chk("other suppliers", sum(OTHERS.map((o) => o[1])), 53);
    DRAFTS.forEach((d) => { if (sum(d.lines.map((l) => l.qty * l.unit)) > d.value + 0.5) console.warn("[PD purchasing] draft lines exceed value: " + d.id); });
    chk("urgent lines shown", sum(DRAFTS.map((d) => d.lines.map(lineRow).filter((l) => shortOf(l, DB.supplier(d.sup))).length)), 12);
  })();

  /* shared cells */
  const poId = (p) => h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, p.id);
  const supCell = (L, p) => p.local ? h("span", null, p.supName, h("span", { className: "pd-faint", style: { fontSize: 11 } }, " · small supplier")) : L.sup(p.supplier);
  const statusTone = (p) => isLate(p) ? "bad" : /risk/i.test(p.status) ? "warn" : /short/i.test(p.status) ? "warn" : /today|Received/i.test(p.status) ? "ok" : "neutral";
  const etaOf = (p) => (p.eta && p.eta !== "—" ? " " + p.eta : "");
  const expectedCell = (p) => h("span", null,
    h("span", { style: { color: p.lateDays ? "var(--bad)" : p.expected === 0 ? "var(--ink)" : "var(--body)" } }, rel(D(p.expected)) + etaOf(p)),
    p.lateDays ? h("span", { className: "pd-mono", style: { fontSize: 10.5, color: "var(--bad)", marginLeft: 6 } }, "+" + p.lateDays + "d") : null);
  const depsCell = (p) => p.deps ? h("span", { style: { color: isLate(p) || /risk/i.test(p.status) ? "var(--bad)" : "var(--ink)" } }, p.deps + (p.depValue ? " · " + eur(p.depValue) : "")) : none();
  const openPo = (ctx) => (p) => { if (!p.local) ctx.open("po", p.id); };

  /* ================================================================ OVERVIEW */
  function overview(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const GI = DB.goodsInToday, giVal = sum(GI.map((p) => p.value)), giPal = sum(GI.map((p) => p.pallets || 0));
    const goPO = (f) => { ctx.set({ purPoF: f }); go("Purchasing", "Purchase Orders"); };
    const goDraft = (id) => { ctx.set({ purDraft: id }); go("Purchasing", "Recommendations"); };
    const p8821 = DB.po("PO-8821");

    const stages = [
      { label: "Awaiting confirmation", n: 9, v: 48260, note: "3 not acknowledged after 48 hours" },
      { label: "Confirmed", n: 0, v: 0, note: "Includes PO-8838: Atlas moved it 4 days this morning" },
      { label: "In transit", n: 17, v: 143220, note: "11 of them on ferry crossings" },
      { label: "Arriving today", n: GI.length, v: giVal, note: giPal + " pallets · 1 received, 24 short", onClick: () => go("Purchasing", "Incoming") },
      { label: "Late", n: LATE.length, v: LATE_VALUE, note: p8821.deps + " customer orders wait on PO-8821", onClick: () => goPO("late") }
    ];
    stages[1].n = OPEN_POS - sum(stages.map((s) => s.n));
    stages[1].v = OPEN_VALUE - sum(stages.map((s) => s.v));
    const maxN = Math.max.apply(null, stages.map((s) => s.n));

    const lateRows = ALL_POS.filter((p) => isLate(p) || /risk/i.test(p.status))
      .sort((a, b) => (b.depValue || 0) - (a.depValue || 0) || (b.deps || 0) - (a.deps || 0) || (b.lateDays || 0) - (a.lateDays || 0)).slice(0, 6);

    const APPROVALS = [
      { type: "Emergency purchase", tone: "bad", d: draftOf("PO-8847"), title: "PO-8847 · Kerry Hygiene · " + eur(draftOf("PO-8847").value), detail: "FH-6710 hand soap: 7 orders short, 5.8 days of cover, no PO raised" },
      { type: "Supplier change", tone: "info", d: draftOf("PO-8846"), title: "PO-8846 · EL-4408 from EuroCable, not Atlas", detail: "160 × EL-4408 plus 80 × EL-4712 · €72 more landed than Atlas · lands 19 days sooner" },
      { type: "Expedite freight", tone: "warn", key: "dq-expedite", title: "PO-8821 · Atlas dedicated van, €420", detail: "07:30 instead of 10:30 · " + eur(p8821.depValue) + " of orders waiting", who: "EW", open: () => ctx.open("po", "PO-8821") },
      { type: "Large PO", tone: "warn", d: draftOf("PO-8848"), title: "PO-8848 · EuroFix · " + eur(draftOf("PO-8848").value), detail: "Over €25k · priced on this morning's file" },
      { type: "Large PO", tone: "warn", d: draftOf("PO-8850"), title: "PO-8850 · Atlas · " + eur(draftOf("PO-8850").value), detail: "Over €25k · supplier under review" },
      { type: "Large PO", tone: "warn", d: draftOf("PO-8849"), title: "PO-8849 · Northgate · " + gbp(draftOf("PO-8849").value), detail: "Over €25k in euro terms · raised in sterling" }
    ];

    const RISKS = [
      { sup: "atlas", tone: "bad", head: "OTIF 86.2% and falling", d: "2 POs late, a third moved this morning · 96 sole-sourced SKUs" },
      { sup: "eurofix", tone: "warn", head: "Price file: 428 changes", d: "M10 bolts +10.4% · 37 customer agreements still on the old cost" },
      { sup: "hartmann", tone: "warn", head: "PO-8809 is 3 days late", d: "Horizon Electrical's SO-10528 waits on it" },
      { sup: "polska", tone: "warn", head: "5 quality issues on €310k of spend", d: "Highest defect rate per euro · 11 returns this year" },
      { sup: "nordic", tone: "warn", head: "PO-8812 is 6 days late", d: "Invoices in euro but reprices monthly on its SEK list" }
    ];
    const costLeak = (DB.leakage.find((l) => l.id === "cost") || { v: 0 }).v;
    const costImpact = sum(DB.costChanges.map((c) => c.impact));

    return UI.Page({
      kicker: "Purchasing · buying desk", live: "SAGE 200 · SUPPLIER PORTALS · EDI",
      title: OPEN_POS + " open POs worth €742k. " + LATE.length + " are late.",
      sub: "What to buy and from whom, what is late and which customers feel it, what lands today, and which supplier is costing us service. The buyer decides; Pulse does the checking.",
      actions: [UI.Btn("Recommendations", () => go("Purchasing", "Recommendations"), { pri: true }), UI.Btn("What should we buy today?", () => ctx.ask("What should we buy today?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Open POs", value: String(OPEN_POS), sub: "58 with the 11 key suppliers", onClick: () => goPO("all") },
          { label: "Open PO value", value: "€742k", sub: eur(giVal) + " lands today" },
          { label: "Due this week", value: String(DUE_WEEK), sub: GI.length + " today · " + giPal + " pallets", onClick: () => go("Purchasing", "Incoming") },
          { label: "Late POs", value: String(LATE.length), sub: eur(p8821.depValue) + " of orders wait on PO-8821", tone: "bad", subTone: "bad", onClick: () => goPO("late") },
          { label: "Supplier fill rate", value: FILL + "%", sub: "OTIF " + SUP_OTIF + "% · target 95%", subTone: "warn", onClick: () => go("Purchasing", "Supplier Performance") },
          { label: "Recommended purchases", value: eurK(REC_VALUE), sub: REC_SKUS + " SKUs · " + DRAFTS.length + " draft POs", hero: true, onClick: () => go("Purchasing", "Recommendations") }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Card({ title: "Where the 82 open POs are", icon: "route", meta: "€742K COMMITTED WITH SUPPLIERS", delay: 60 }, [
          UI.Pipeline(stages.map((s) => ({ label: s.label, n: String(s.n), v: eur(s.v), note: s.note, hot: s.hot, onClick: s.onClick, pct: Math.max(8, Math.round(100 * s.n / maxN)) }))),
          UI.Note(eur(LATE_VALUE) + " of the book is late. Only three late POs hold up customer orders, and one of them, PO-8821 (" + eur(p8821.value) + "), holds " + eur(p8821.depValue) + " on its own. The other " + (LATE.length - 3) + " are replenishment: chase them, don't panic.", { marginTop: 12 })
        ]),
        gap(),
        UI.Grid("minmax(0,1.45fr) minmax(0,1fr)", [
          UI.Card({ title: "Purchasing recommendations", icon: "cart", meta: REC_SKUS + " SKUS · " + eurK(REC_VALUE).toUpperCase(), delay: 100, right: UI.Btn("All " + DRAFTS.length + " drafts", () => go("Purchasing", "Recommendations"), { sm: true, ghost: true }) }, [
            ...DRAFTS.slice(0, 6).map((d) => UI.Row({ key: d.id, onClick: () => goDraft(d.id) }, [
              h("div", { className: "pd-grow" },
                h("div", { className: "pd-split", style: { gap: 8 } }, h("span", { style: { fontSize: 13, fontWeight: 500 } }, supName(d.sup)), d.flag ? UI.Badge(d.flag, d.flagTone) : null),
                h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3 } }, d.id + " · " + d.skus + (d.skus === 1 ? " SKU · " : " SKUs · ") + d.why)),
              h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)", minWidth: 70, textAlign: "right" } }, eur(d.value)),
              raiseBtn(ctx, d)])),
            UI.Note("3 more drafts (Midland, SafePro, Celtic) worth " + eur(sum(DRAFTS.slice(6).map((d) => d.value))) + " can wait for the next buying run.", { marginTop: 8 })
          ]),
          h("div", null,
            UI.AI({ who: "Purchasing Agent", conf: "OVERNIGHT BUYING RUN · 06:40",
              text: "Raise two orders before lunch. EL-4408 from EuroCable, not Atlas: €72 more on 160 reels and it lands 19 days sooner. And Kerry for the hand soap: 7 customer orders are short and nobody has raised a PO. The EuroFix draft is priced on this morning's file, so push back before it goes. " + DONT_SKUS + " SKUs on the Sage reorder list should not be bought at all.",
              actions: [raiseBtn(ctx, draftOf("PO-8846"), { pri: !ctx.done("po-el4408") }), raiseBtn(ctx, draftOf("PO-8847")), UI.Btn("Ask why", () => ctx.ask("What should we buy today?"), { sm: true, ghost: true, icon: "spark" })] }),
            gap(),
            UI.Card({ title: "Approval queue", icon: "shield", meta: APPROVALS.filter((a) => !ctx.done(a.key || a.d.key)).length + " WAITING", delay: 140 },
              APPROVALS.map((a, i) => {
                const k = a.key || a.d.key, who = a.who || approverOf(a.d);
                return UI.Row({ key: i, onClick: a.open || (() => goDraft(a.d.id)), style: { alignItems: "flex-start" } }, [
                  h("div", { className: "pd-grow" },
                    h("div", { className: "pd-split", style: { gap: 8 } }, UI.Badge(a.type.toUpperCase(), a.tone, true), h("span", { className: "pd-meta" }, DB.person(who).toUpperCase())),
                    h("div", { style: { fontSize: 12.5, color: "var(--ink)", marginTop: 6 } }, a.title),
                    h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, a.detail)),
                  a.d ? raiseBtn(ctx, a.d, { label: "Approve" })
                    : UI.Btn("Approve", () => ctx.act("dq-expedite", "Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight. Emma Walsh copied."), { sm: true, done: ctx.done("dq-expedite"), doneLabel: "Expedite requested" })]);
              }).concat([UI.Note("Limits: buyer to €10k, Emma Walsh to €25k, Patrick Byrne above. A supplier change or emergency buy always goes to Emma.", { marginTop: 8 })])))
        ]),
        UI.Grid("minmax(0,1.35fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Late supplier orders", meta: LATE.length + " LATE · 1 AT RISK · RANKED BY CUSTOMER IMPACT", delay: 180, right: UI.Btn("All late POs", () => goPO("late"), { sm: true, ghost: true }) },
            UI.Table({
              rows: lateRows, rowKey: (p) => p.id, onRow: openPo(ctx), rowTone: (p) => p.deps ? "bad" : "warn",
              cols: [
                { label: "PO", w: "84px", render: poId },
                { label: "Supplier", w: "minmax(150px,1.3fr)", ink: true, render: (p) => supCell(L, p) },
                { label: "Late", w: "92px", render: (p) => p.lateDays ? h("span", { style: { color: "var(--bad)" } }, p.lateDays + (p.lateDays === 1 ? " day" : " days")) : h("span", { style: { color: "var(--warn)" } }, "Moved +" + (p.expected - p.promised) + " days") },
                { label: "Now expected", w: "112px", render: (p) => rel(D(p.expected)) + etaOf(p) },
                { label: "Orders waiting", w: "124px", r: true, render: depsCell },
                { label: "Risk", w: "86px", render: (p) => UI.Risk(p.risk) }
              ],
              foot: "Every order behind these POs is listed on Purchase Orders. PO-8821's six are in the order record chain too."
            })),
          UI.Card({ title: "Incoming stock today", icon: "truck", meta: GI.length + " DELIVERIES · " + giPal + " PALLETS · " + eurK(giVal).toUpperCase(), delay: 220, right: UI.Btn("Goods in", () => go("Warehouse", "Goods In"), { sm: true, ghost: true }) }, [
            ...GI.slice().sort((a, b) => SLOTS[a.id].from - SLOTS[b.id].from).map((p) => UI.Row({ key: p.id, onClick: () => ctx.open("po", p.id) }, [
              h("span", { className: "pd-mono", style: { width: 42, fontSize: 12, color: "var(--ink)" } }, hhmm(SLOTS[p.id].from)),
              h("div", { className: "pd-grow" },
                h("div", { style: { fontSize: 12.5 } }, SHORT[p.supplier], h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, p.id)),
                h("div", { style: { fontSize: 11.5, color: SLOTS[p.id].tone ? PD.TONE[SLOTS[p.id].tone].fg : "var(--dim)", marginTop: 2 } }, DB.warehouses[p.wh].short + " " + SLOTS[p.id].bay + " · " + p.pallets + " pallets" + (SLOTS[p.id].state ? " · " + SLOTS[p.id].state : "") + (p.deps ? " · releases " + p.deps + (p.deps === 1 ? " order" : " orders") : ""))),
              h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, eur(p.value))])),
            UI.Note("Tomorrow: PO-8821 from Atlas at " + (ctx.done("dq-expedite") ? "07:30 on a dedicated van" : "10:30") + " releases " + p8821.deps + " orders (" + eur(p8821.depValue) + ").", { marginTop: 8 })
          ])
        ]),
        UI.Grid("minmax(0,1fr) minmax(0,1.35fr)", [
          UI.Card({ title: "Supplier risks", icon: "factory", meta: "WHAT COULD HURT CUSTOMERS NEXT", delay: 260, right: UI.Btn("Performance", () => go("Purchasing", "Supplier Performance"), { sm: true, ghost: true }) },
            RISKS.map((r) => UI.Row({ key: r.sup, onClick: () => ctx.open("supplier", r.sup), style: { alignItems: "flex-start" } }, [
              h("div", { style: { width: 3, alignSelf: "stretch", borderRadius: 3, background: PD.TONE[r.tone].fg, flex: "none" } }),
              h("div", { className: "pd-grow" },
                h("div", { style: { fontSize: 12.5, fontWeight: 500 } }, supName(r.sup)),
                h("div", { style: { fontSize: 12, color: "var(--ink)", marginTop: 3 } }, r.head),
                h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, r.d)),
              UI.Badge(DB.supplier(r.sup).status, DB.supplier(r.sup).tone)]))),
          UI.Card({ flush: true, title: "Cost increases", meta: "NOT YET PASSED TO CUSTOMERS", delay: 300, right: UI.Btn("Cost changes", () => go("Pricing & Margin", "Cost Changes"), { sm: true, ghost: true }) }, [
            h("div", { style: { padding: "0 20px 12px" } },
              UI.Row({ onClick: () => ctx.open("supplier", "eurofix") }, [UI.Dot("warn"), h("div", { className: "pd-grow" },
                h("div", { style: { fontSize: 12.5, color: "var(--ink)" } }, "Supplier price file imported: 428 changes identified"),
                h("div", { className: "pd-meta", style: { marginTop: 3 } }, "EUROFIX GMBH · SUPPLIER FEEDS · 08:31")), UI.Btn("Review file", () => go("Pricing & Margin", "Cost Changes"), { sm: true })])),
            UI.Table({
              rows: DB.costChanges, rowKey: (c) => c.sku, onRow: (c) => DB.product(c.sku) ? ctx.open("product", c.sku) : ctx.open("supplier", c.supplier),
              cols: [
                { label: "SKU", w: "82px", render: (c) => L.sku(c.sku) },
                { label: "Product", w: "minmax(150px,1.5fr)", ink: true, render: (c) => c.name },
                { label: "Supplier", w: "84px", render: (c) => SHORT[c.supplier] },
                { label: "Cost", w: "118px", r: true, num: true, render: (c) => eur(c.old, 2) + " → " + eur(c.now, 2) },
                { label: "Change", w: "62px", r: true, num: true, render: (c) => h("span", { style: { color: c.pct >= 8 ? "var(--bad)" : "var(--warn)" } }, "+" + c.pct.toFixed(1) + "%") },
                { label: "Old prices", w: "80px", r: true, num: true, render: (c) => c.customers },
                { label: "GP a month", w: "86px", r: true, num: true, ink: true, render: (c) => "−" + eur(c.impact) }
              ],
              foot: "These 7 lines cost " + eur(costImpact) + " of gross profit a month; all unpassed increases together cost " + eur(costLeak) + ". \"Old prices\" is customer agreements still selling at the previous cost."
            })
          ])
        ])
      ]
    });
  }

  /* ================================================================ RECOMMENDATIONS */
  function recommendations(ctx) {
    const L = PD.lk(ctx);
    const d = draftOf(ctx.st.purDraft || "PO-8846"), s = DB.supplier(d.sup), who = approverOf(d);
    const large = DRAFTS.filter((x) => approverOf(x) === "PB");
    const gbpDrafts = DRAFTS.filter((x) => DB.supplier(x.sup).ccy === "GBP");
    const gbpVal = sum(gbpDrafts.map((x) => x.value));
    const dec = DECIDE.find((x) => x.sku === (ctx.st.purDec || "EL-4408")) || DECIDE[0];
    const lines = d.lines.map(lineRow);
    const shownVal = sum(lines.map((l) => l.qty * l.unit)), moreN = d.skus - lines.length;
    const dontShown = sum(DONT.map(dontVal));

    // currency exposure: open POs plus drafts
    const openGBP = sum(DB.suppliers.filter((x) => x.ccy === "GBP").map((x) => x.openValue)) + 38400; // 38,400 with smaller UK suppliers
    const sekPriced = DB.supplier("nordic").openValue;
    const committed = OPEN_VALUE + REC_VALUE, gbpAll = openGBP + gbpVal, eurAll = committed - gbpAll - sekPriced;
    const fxMove = Math.round(gbpVal * GBP_RATE / 0.826 - gbpVal);

    const detail = UI.Card({ flush: true, title: d.id + " · " + s.name, meta: ctx.done(d.key) ? "SENT" : "DRAFT · " + d.skus + (d.skus === 1 ? " SKU" : " SKUS"), delay: 60,
      right: [d.flag ? UI.Badge(d.flag, d.flagTone) : null, UI.Btn("Supplier", () => ctx.open("supplier", s.id), { sm: true, ghost: true })] }, [
      h("div", { style: { padding: "0 20px 14px" } }, UI.Facts([
        ["Value", s.ccy === "GBP" ? gbp(d.value) : eur(d.value), null, s.ccy === "GBP" ? eur(d.value) + " at " + GBP_RATE : s.ccy],
        ["Lead time", achieved(s) + " days", s.delay > 2 ? "warn" : null, s.lead + " quoted · " + s.delay + " avg delay"],
        ["Lands", rel(D(Math.round(s.lead + s.delay))), null, "If sent today"],
        ["Supplier OTIF", s.otif + "%", s.otif < 90 ? "bad" : s.otif < 94 ? "warn" : "ok", s.status],
        ["Terms", s.terms, null, s.country],
        ["Approver", DB.person(who), null, who === "PB" ? "Over €25k" : d.kind === "emergency" ? "Emergency buy" : d.kind === "change" ? "Supplier change" : who === "EW" ? "€10k to €25k" : "Within buyer limit"]
      ], 6)),
      UI.Table({
        rows: lines.concat(moreN > 0 ? [{ sku: "", more: true, name: moreN + " more lines at or above MOQ", val: d.value - shownVal }] : []),
        rowKey: (l) => l.sku || "more", onRow: (l) => l.sku && DB.product(l.sku) ? ctx.open("product", l.sku) : null,
        rowTone: (l) => shortOf(l, s) ? "bad" : null,
        cols: [
          { label: "SKU", w: "84px", render: (l) => l.more ? "" : L.sku(l.sku) },
          { label: "Product", w: "minmax(170px,1.6fr)", ink: true, render: (l) => l.more ? h("span", { className: "pd-faint" }, l.name) : l.name },
          { label: "Avail.", w: "60px", r: true, num: true, render: (l) => l.more ? "" : num(l.avail) },
          { label: "Per wk", w: "60px", r: true, num: true, render: (l) => l.more ? "" : num(l.weekly) },
          { label: "Cover", w: "76px", r: true, num: true, render: (l) => l.more ? "" : h("span", { style: { color: shortOf(l, s) ? "var(--bad)" : "var(--body)" } }, coverOf(l.avail, l.weekly)) },
          { label: "Incoming", w: "70px", r: true, num: true, render: (l) => l.more ? "" : l.incoming ? num(l.incoming) : none() },
          { label: "MOQ", w: "54px", r: true, num: true, render: (l) => l.more ? "" : num(l.moq) },
          { label: "Order", w: "60px", r: true, num: true, ink: true, render: (l) => l.more ? "" : num(l.qty) },
          { label: "Unit", w: "74px", r: true, num: true, render: (l) => l.more ? "" : eur(l.unit, 2) },
          { label: "Line", w: "90px", r: true, num: true, ink: true, render: (l) => eur(l.more ? l.val : l.qty * l.unit, 2) },
          { label: "Why", w: "minmax(170px,2fr)", render: (l) => l.more ? "" : h("span", { className: "pd-dim", title: l.why }, l.why) }
        ]
      }),
      h("div", { style: { padding: "14px 20px 18px" } }, UI.AI({ who: "Purchasing Agent", text: d.ai,
        actions: [raiseBtn(ctx, d, { pri: !ctx.done(d.key), label: who === "PB" ? "Approve and send" : null }),
          UI.Btn("Edit quantities", () => ctx.act("edit-" + d.id, "Draft opened for editing", d.id + " opened in Sage 200 for " + DB.person(s.buyer) + ". Pulse keeps the reasons against each line."), { sm: true, done: ctx.done("edit-" + d.id), doneLabel: "In Sage 200" }),
          UI.Btn("Hold to next run", () => ctx.act("hold-" + d.id, "Draft held", d.id + " moved to the next buying run."), { sm: true, ghost: true, done: ctx.done("hold-" + d.id), doneLabel: "Held" })] }))
    ]);

    return UI.Page({
      kicker: "Purchasing · recommendations", live: "BUYING RUN 06:40 · STOCK, SALES, OPEN POS, LEAD TIMES",
      title: eurK(REC_VALUE) + " to buy across " + REC_SKUS + " SKUs, in " + DRAFTS.length + " draft POs",
      sub: "Pulse reads stock, allocations, open POs, 26 weeks of sales, the lead time each supplier actually achieves and MOQs, then drafts one PO per supplier. A buyer checks it and approves it. Nothing is sent until a person says so.",
      actions: [UI.Btn("What should we buy today?", () => ctx.ask("What should we buy today?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Recommended purchases", value: eurK(REC_VALUE), sub: REC_SKUS + " SKUs · " + DRAFTS.length + " draft POs", hero: true },
          { label: "Would stock out first", value: sum(DRAFTS.map((x) => x.urgent)) + " SKUs", sub: "Before their next PO lands", tone: "bad", subTone: "bad" },
          { label: "Above €25k", value: large.length + " drafts", sub: eur(sum(large.map((x) => x.value))) + " · Patrick Byrne signs", tone: "warn" },
          { label: "Don't buy", value: DONT_SKUS + " SKUs", sub: eur(DONT_TOTAL) + " the reorder rules would waste", subTone: "ok" },
          { label: "Sterling on drafts", value: gbp(gbpVal), sub: gbpDrafts.length + " drafts · rate " + GBP_RATE }
        ]),
        UI.Grid("minmax(0,.95fr) minmax(0,1.9fr)", [
          UI.Card({ flush: true, title: "Draft POs by supplier", meta: "CLICK TO REVIEW", delay: 20 }, UI.Table({
            rows: DRAFTS, rowKey: (x) => x.id, sel: (x) => x.id === d.id, onRow: (x) => ctx.set({ purDraft: x.id }),
            rowTone: (x) => x.kind === "emergency" && !ctx.done(x.key) ? "bad" : null,
            cols: [
              { label: "Draft", w: "76px", render: poId },
              { label: "Supplier", w: "minmax(96px,1fr)", ink: true, render: (x) => SHORT[x.sup] },
              { label: "SKUs", w: "46px", r: true, num: true, render: (x) => x.skus },
              { label: "Value", w: "80px", r: true, num: true, ink: true, render: (x) => eur(x.value) },
              { label: "", w: "112px", render: (x) => ctx.done(x.key) ? UI.Badge(x.key === "po-el4408" || x.key === "po-fh6710" ? "Raised" : "Approved", "ok") : x.flag ? UI.Badge(x.flag, x.flagTone) : h("span", { className: "pd-faint", style: { fontSize: 11.5 } }, DB.person(approverOf(x))) }
            ],
            foot: "Total " + eur(sum(DRAFTS.map((x) => x.value))) + " · " + sum(DRAFTS.map((x) => x.skus)) + " SKUs. Urgent drafts first."
          })),
          detail
        ]),
        UI.Card({ flush: true, title: "Procurement decision: who should supply it", meta: "CHEAPEST IS NOT ALWAYS BEST · LANDED COST, LEAD TIME AND RELIABILITY TOGETHER", delay: 100,
          right: UI.Tabs(DECIDE.map((x) => [x.sku, x.sku]), dec.sku, (v) => ctx.set({ purDec: v })) }, [
          h("div", { style: { padding: "0 20px 12px" } }, UI.Split2(
            h("div", null, h("div", { style: { fontSize: 13.5, fontWeight: 500 } }, L.sku(dec.sku, dec.sku + " · " + DB.product(dec.sku).name)), h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 3 } }, dec.riskText)),
            h("span", { className: "pd-split", style: { gap: 8 } }, h("span", { className: "pd-label" }, "Stock risk"), UI.Risk(dec.risk)))),
          UI.Table({
            rows: dec.rows, rowKey: (r) => r.sup || r.name, sel: (r) => r.rec, onRow: (r) => r.sup ? ctx.open("supplier", r.sup) : null,
            cols: [
              { label: "Supplier", w: "minmax(190px,1.5fr)", ink: true, render: (r) => r.sup ? L.sup(r.sup) : h("span", null, r.name, h("span", { className: "pd-faint", style: { fontSize: 11 } }, " · quote on file")) },
              { label: "Unit cost", w: "96px", r: true, num: true, render: (r) => eur(r.unit, 2) + (r.unitNote ? " (" + r.unitNote + ")" : "") },
              { label: "Lead time", w: "80px", r: true, num: true, render: (r) => r.lead + " days" },
              { label: "MOQ", w: "60px", r: true, num: true, render: (r) => num(r.moq) },
              { label: "OTIF", w: "66px", r: true, num: true, render: (r) => h("span", { style: { color: r.otif < 90 ? "var(--bad)" : r.otif < 94 ? "var(--warn)" : "var(--ok)" } }, r.otif.toFixed(1) + "%") },
              { label: "Available qty", w: "96px", r: true, num: true, render: (r) => num(r.avail) },
              { label: "Currency", w: "72px", render: (r) => r.ccy },
              { label: "Landed cost", w: "94px", r: true, num: true, ink: true, render: (r) => eur(r.landed, 2) },
              { label: "Recommended", w: "minmax(240px,1.6fr)", render: (r) => UI.Badge(r.tag, r.rec ? "info" : "neutral", true) }
            ]
          }),
          h("div", { style: { padding: "14px 20px 18px" } }, UI.AI({ who: "Purchasing Agent", conf: "STOCK RISK " + dec.risk, text: dec.verdict,
            note: "Landed cost = unit cost + freight + duty and customs clearance + a currency buffer on sterling, per unit, at the quantity Pulse would order.",
            actions: dec.draft ? [raiseBtn(ctx, draftOf(dec.draft), { pri: !ctx.done(draftOf(dec.draft).key) }), UI.Btn("Open " + dec.sku, () => ctx.open("product", dec.sku), { sm: true })]
              : [UI.Btn("Open " + dec.sku, () => ctx.open("product", dec.sku), { sm: true })] }))
        ]),
        gap(),
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Don't buy: stock the reorder rules would order", meta: DONT_SKUS + " SKUS · " + eur(DONT_TOTAL) + " HELD BACK", delay: 140,
            right: UI.Btn("Suppress all " + DONT_SKUS, () => ctx.act("pur-suppress", "Auto-reorder suppressed", DONT_SKUS + " SKUs taken off automatic reordering in Sage 200. Emma Walsh gets a list of the min/max values to reset."), { sm: true, done: ctx.done("pur-suppress"), doneLabel: "Suppressed" }) },
            UI.Table({
              rows: DONT, rowKey: (x) => x.sku, onRow: (x) => ctx.open("product", x.sku),
              cols: [
                { label: "SKU", w: "82px", render: (x) => L.sku(x.sku) },
                { label: "Product", w: "minmax(150px,1.2fr)", ink: true, render: (x) => DB.product(x.sku).name },
                { label: "Rule in Sage", w: "minmax(170px,1.3fr)", render: (x) => h("span", { className: "pd-dim" }, x.rule) },
                { label: "Would buy", w: "74px", r: true, num: true, render: (x) => num(x.buy) },
                { label: "Cover now", w: "90px", r: true, num: true, render: (x) => DB.product(x.sku).cover },
                { label: "Pulse says", w: "minmax(220px,1.8fr)", render: (x) => h("span", { title: x.why }, x.why) },
                { label: "Avoided", w: "72px", r: true, num: true, ink: true, render: (x) => eur(dontVal(x)) },
                { label: "", w: "112px", render: (x) => UI.Btn("Suppress", () => ctx.act("stop-" + x.sku, "Replenishment stopped", x.sku + " removed from automatic reordering."), { sm: true, done: ctx.done("stop-" + x.sku) || ctx.done("pur-suppress"), doneLabel: "Stopped" }) }
              ],
              foot: "7 shown (" + eur(dontShown) + "). " + (DONT_SKUS - DONT.length) + " more SKUs worth " + eur(DONT_TOTAL - dontShown) + ", mostly min/max values set for jobs or customers that have finished."
            })),
          h("div", null,
            UI.Card({ title: "Currency exposure", icon: "euro", meta: "OPEN POS + DRAFTS · " + eurK(committed).toUpperCase(), delay: 160 }, [
              UI.Split([
                { label: "Euro", v: eurAll, color: "var(--accent)", d: eurK(eurAll) },
                { label: "Sterling", v: gbpAll, color: "var(--warn)", d: eurK(gbpAll) },
                { label: "SEK-priced", v: sekPriced, color: "var(--faint)", d: eurK(sekPriced) }
              ]),
              UI.Note("A 2-cent move in sterling changes landed cost on the " + gbpDrafts.length + " sterling drafts by about " + eur(Math.round(fxMove / 10) * 10) + ". Nordic Lighting invoices in euro but reprices monthly on its SEK list; the last file added 1.8%.", { marginTop: 12 })
            ]),
            gap(),
            UI.Card({ title: "How Pulse works out the quantity", icon: "spark", delay: 180 }, [
              UI.Steps([{ l: "26 weeks of sales per site" }, { l: "Open and allocated orders" }, { l: "Lead time actually achieved", kind: "go" }, { l: "Safety stock at 97%" }, { l: "Less available, incoming, transfers" }, { l: "Round to MOQ" }, { l: "Cheapest landed that lands in time", kind: "go" }, { l: "Buyer approves", kind: "gate" }]),
              UI.Note("Atlas is planned on 31.8 days, what it has achieved over 12 months, not the 28 on its price file. EL-4408: 32 a week in Dublin, 12 available, 120 on PO-8821, safety stock 48; 160 buys five weeks.", { marginTop: 12 })
            ]))
        ])
      ]
    });
  }

  /* ================================================================ PURCHASE ORDERS */
  function purchaseOrders(ctx) {
    const L = PD.lk(ctx), f = ctx.st.purPoF || "all", buyer = ctx.st.purBuyer || "all";
    const RISK_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const PICK = {
      all: () => true, late: isLate, today: (p) => p.expected === 0, risk: (p) => RISK_RANK[p.risk] <= 1 || /risk/i.test(p.status),
      deps: (p) => p.deps > 0, DUB: (p) => p.wh === "DUB", NAS: (p) => p.wh === "NAS"
    };
    const FILTERS = [["all", "All shown"], ["late", "Late"], ["today", "Arriving today"], ["risk", "At risk"], ["deps", "Customers waiting"], ["DUB", "Dublin"], ["NAS", "Naas"]]
      .map((x) => [x[0], x[1], ALL_POS.filter(PICK[x[0]]).length]);
    const rows = ALL_POS.filter(PICK[f] || PICK.all).filter((p) => buyer === "all" || p.buyer === buyer)
      .sort((a, b) => RISK_RANK[a.risk] - RISK_RANK[b.risk] || (b.depValue || 0) - (a.depValue || 0) || (b.deps || 0) - (a.deps || 0) || (b.lateDays || 0) - (a.lateDays || 0) || a.expected - b.expected || b.value - a.value);
    const tot = sum(rows.map((p) => p.value));
    const shownVal = sum(ALL_POS.map((p) => p.value)), restN = OPEN_POS - ALL_POS.length, restVal = OPEN_VALUE - shownVal;
    const lateWithDeps = LATE.filter((p) => p.deps > 0);
    const waitVal = sum(lateWithDeps.map((p) => p.depValue || 0)), waitN = sum(lateWithDeps.map((p) => p.deps));
    const GI = DB.goodsInToday;

    // every order waiting on a late or at-risk PO
    const waits = [];
    ALL_POS.filter((p) => (isLate(p) || /risk/i.test(p.status)) && p.depOrders).forEach((p) => p.depOrders.forEach((id) => { const o = DB.order(id); if (o) waits.push({ o, p }); }));
    const waitTxt = (w) => w.o.id === "SO-10482" ? "EL-4408, EL-4631, IC-3310" : w.o.reasonDetail ? w.o.reasonDetail.replace(/ on PO-\d+/, "") : SHORT[w.p.supplier] + " lines";
    const TOLD = { "SO-10482": ["Notified 09:11 · accepts split", "ok"], "SO-10488": ["Rang for an ETA at 09:02", "warn"] };
    const slack = (w) => {
      const dd = w.o.req - w.p.expected;
      return dd < 0 ? ["Lands " + (-dd) + (dd === -1 ? " day" : " days") + " after due", "bad"] : dd === 0 ? ["Lands the day it is due", "warn"] : [dd + (dd === 1 ? " day" : " days") + " spare", "ok"];
    };

    return UI.Page({
      kicker: "Purchasing · purchase orders", live: "SAGE 200 · SUPPLIER PORTALS · EDI",
      title: OPEN_POS + " open purchase orders · €742k",
      sub: "Every PO with the customer orders that depend on it. A late PO is only as urgent as the orders behind it, so that is how this list is ranked.",
      actions: [UI.Btn("What orders depend on Atlas?", () => ctx.ask("What orders depend on Atlas?"), { icon: "spark" })],
      children: [
        UI.Facts([
          ["Open POs", String(OPEN_POS), null, "€742k committed"],
          ["Late", String(LATE.length), "bad", eur(LATE_VALUE)],
          ["Orders waiting on late POs", String(waitN), "bad", eur(waitVal) + " of revenue"],
          ["Arriving today", String(GI.length), null, eur(sum(GI.map((p) => p.value))) + " · " + sum(GI.map((p) => p.pallets || 0)) + " pallets"],
          ["Awaiting confirmation", "9", "warn", "3 over 48 hours"],
          ["Dates changed this week", "14", "warn", "6 of them by Atlas"]
        ], 6),
        gap(),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } },
          UI.Chips(FILTERS, f, (v) => ctx.set({ purPoF: v })),
          h("div", { style: { flex: 1 } }),
          UI.Tabs([["all", "All buyers"], ["EW", "Emma Walsh"], ["CK", "Ciarán Kavanagh"]], buyer, (v) => ctx.set({ purBuyer: v }))),
        UI.Card({ flush: true, title: rows.length + " POs · " + eur(tot), meta: "SHOWING " + ALL_POS.length + " OF " + OPEN_POS + " OPEN · CLICK A ROW FOR THE PO" }, [
          UI.Table({
            rows, rowKey: (p) => p.id, onRow: openPo(ctx),
            rowTone: (p) => isLate(p) && p.deps ? "bad" : isLate(p) || /risk/i.test(p.status) ? "warn" : null,
            empty: "No POs match that filter.",
            cols: [
              { label: "PO", w: "84px", render: poId },
              { label: "Supplier", w: "minmax(180px,1.5fr)", ink: true, render: (p) => supCell(L, p) },
              { label: "Value", w: "84px", r: true, num: true, ink: true, render: (p) => eur(p.value) },
              { label: "Items", w: "54px", r: true, num: true, render: (p) => p.items },
              { label: "Order date", w: "82px", render: (p) => dm(D(p.ordered)) },
              { label: "Promised", w: "78px", render: (p) => dm(D(p.promised)) },
              { label: "Expected", w: "132px", render: expectedCell },
              { label: "Warehouse", w: "80px", render: (p) => DB.warehouses[p.wh].short },
              { label: "Status", w: "148px", render: (p) => UI.Badge(p.status, statusTone(p)) },
              { label: "Customer orders", w: "132px", r: true, render: depsCell },
              { label: "Risk", w: "86px", render: (p) => UI.Risk(p.risk) },
              { label: "Buyer", w: "112px", render: (p) => h("span", { className: "pd-dim" }, DB.person(p.buyer)) }
            ],
            foot: "Showing every late or at-risk PO, today's and tomorrow's deliveries, and every PO a customer order is waiting on. The other " + restN + " (" + eur(restVal) + ") are on-time replenishment with no customer waiting."
          })
        ]),
        gap(),
        UI.Grid("minmax(0,1.9fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Every customer order waiting on a late or at-risk PO", meta: waits.length + " ORDERS · " + eur(sum(waits.map((w) => w.o.value))), delay: 60,
            right: UI.Btn("Draft 6 customer updates", () => ctx.act("po-notify", "6 updates drafted", "One per account manager, with today's lines and tomorrow's ETA."), { sm: true, done: ctx.done("po-notify"), doneLabel: "Drafted" }) },
            UI.Table({
              rows: waits, rowKey: (w) => w.o.id, onRow: (w) => ctx.open("order", w.o.id), rowTone: (w) => slack(w)[1] === "ok" ? null : slack(w)[1],
              cols: [
                { label: "Order", w: "86px", render: (w) => mono(w.o.id, true) },
                { label: "Customer", w: "minmax(160px,1.4fr)", ink: true, render: (w) => L.cust(w.o.cust) },
                { label: "Value", w: "78px", r: true, num: true, render: (w) => eur(w.o.value) },
                { label: "Waiting on", w: "minmax(170px,1.5fr)", render: (w) => h("span", null, L.po(w.p.id), h("span", { className: "pd-faint" }, " · " + waitTxt(w))) },
                { label: "Order due", w: "84px", render: (w) => rel(D(w.o.req)) },
                { label: "Stock lands", w: "110px", render: (w) => rel(D(w.p.expected)) + etaOf(w.p) },
                { label: "Gap", w: "150px", render: (w) => UI.Badge(slack(w)[0], slack(w)[1]) },
                { label: "Customer told", w: "minmax(150px,1.1fr)", render: (w) => { const t = TOLD[w.o.id] || ["Not told yet", "bad"]; return h("span", { style: { color: PD.TONE[t[1]].fg } }, t[0]); } }
              ],
              foot: "Plus 2 orders on PO-8818 (€5,210) and 2 on PO-8838: both still land inside their customers' dates."
            })),
          h("div", null,
            UI.Card({ title: "What late POs hold up", icon: "alert", meta: "CUSTOMER REVENUE BEHIND EACH", delay: 100 }, [
              UI.HBars(lateWithDeps.slice().sort((a, b) => (b.depValue || 0) - (a.depValue || 0)).map((p) => ({ label: p.id + " · " + SHORT[p.supplier], v: p.depValue || 0, d: eur(p.depValue || 0), tone: p.depValue > 10000 ? "bad" : "warn", onClick: () => ctx.open("po", p.id) })), { tpl: "minmax(130px,1fr) 1.2fr 76px", colorValue: true }),
              UI.Note("The other " + (LATE.length - lateWithDeps.length) + " late POs have no customer order waiting. Chase them, don't expedite them.", { marginTop: 10 })
            ]),
            gap(),
            UI.AI({ who: "Purchasing Agent", conf: "5 CHASERS DRAFTED",
              text: "Chasers are ready for Atlas (PO-8807), Northgate (PO-8818), Hartmann (PO-8809), Nordic (PO-8812) and Polska (PO-8816), each asking for a firm date and a tracking reference. PO-8821 is past chasing: the decision there is the €420 van.",
              actions: [UI.Btn("Send 5 chasers", () => ctx.act("pur-chase", "5 chasers sent", "From Emma Walsh and Ciarán Kavanagh's Outlook. Replies update the expected dates automatically."), { pri: !ctx.done("pur-chase"), sm: true, done: ctx.done("pur-chase"), doneLabel: "Sent" }),
                UI.Btn("Expedite PO-8821", () => ctx.act("dq-expedite", "Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight. Emma Walsh copied."), { sm: true, done: ctx.done("dq-expedite"), doneLabel: "Expedite requested" })] }))
        ])
      ]
    });
  }

  /* ================================================================ INCOMING */
  function board(lanes, nowAt) {
    const H0 = 7, H1 = 17, span = H1 - H0;
    const pos = (t) => (100 * (t - H0) / span) + "%";
    return h("div", null,
      h("div", { style: { position: "relative", height: 16, marginLeft: 78 } }, ...[7, 9, 11, 13, 15, 17].map((t) => h("span", { key: t, className: "pd-meta", style: { position: "absolute", left: pos(t), transform: t === H0 ? "none" : t === H1 ? "translateX(-100%)" : "translateX(-50%)", fontSize: 9.5 } }, (t < 10 ? "0" : "") + t + ":00"))),
      ...lanes.map((ln, i) => h("div", { key: i, style: { display: "flex", alignItems: "center", marginTop: 7 } },
        h("div", { style: { width: 78, flex: "none" } }, h("div", { className: "pd-label" }, ln.site), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, ln.bay)),
        h("div", { style: { position: "relative", flex: 1, height: 44, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)", overflow: "hidden" } },
          nowAt ? h("div", { style: { position: "absolute", top: 0, bottom: 0, left: pos(nowAt), width: 0, borderLeft: "1.5px dashed var(--accent)", opacity: .8 } }) : null,
          ...ln.blocks.map((b, j) => {
            const t = PD.TONE[b.tone || "info"];
            return h("div", { key: j, title: b.title, onClick: b.onClick, className: b.onClick ? "pd-click" : null, style: { position: "absolute", top: 4, bottom: 4, left: pos(b.from), width: "calc(" + (100 * b.mins / 60 / span) + "% - 2px)", minWidth: 50, borderRadius: 7, padding: "4px 7px", background: t.bg, border: "1px solid color-mix(in srgb," + t.fg + " 40%,transparent)", overflow: "hidden", whiteSpace: "nowrap" } },
              h("div", { style: { fontSize: 10.5, fontWeight: 500, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis" } }, b.t),
              h("div", { className: "pd-mono", style: { fontSize: 9.5, color: t.fg, overflow: "hidden", textOverflow: "ellipsis" } }, b.d));
          })))),
      nowAt ? h("div", { className: "pd-note", style: { marginTop: 8, marginLeft: 78 } }, "Dashed line is now, " + hhmm(nowAt) + ".") : null);
  }

  function incoming(ctx) {
    const L = PD.lk(ctx), day = ctx.st.purInDay || "today", exp = ctx.done("dq-expedite");
    const GI = DB.goodsInToday.slice().sort((a, b) => SLOTS[a.id].from - SLOTS[b.id].from);
    const giVal = sum(GI.map((p) => p.value)), giPal = sum(GI.map((p) => p.pallets || 0)), depsToday = sum(GI.map((p) => p.deps));
    const TOM_T = { "PO-8836": 8.5, "PO-8821": exp ? 7.5 : 10.5, "PO-8801": 11 };
    const tomorrow = ALL_POS.filter((p) => p.expected === 1).sort((a, b) => TOM_T[a.id] - TOM_T[b.id]);
    const week = ALL_POS.filter((p) => p.expected >= 2 && p.expected <= 6).sort((a, b) => a.expected - b.expected || (b.deps || 0) - (a.deps || 0));
    const rows = day === "today" ? GI : day === "tomorrow" ? tomorrow : week;
    const p8821 = DB.po("PO-8821");
    const whenOf = (p) => day === "today" ? hhmm(SLOTS[p.id].from) : day === "tomorrow" ? hhmm(TOM_T[p.id]) : rel(D(p.expected));
    const bayOf = (p) => day === "today" ? SLOTS[p.id].bay : day === "tomorrow" ? (p.wh === "DUB" ? "Bay 1" : "N1") : null;
    const statusOf = (p) => {
      if (day === "today") return [SLOTS[p.id].state || "Booked · on time", SLOTS[p.id].tone || "ok"];
      if (p.id === "PO-8821") return exp ? ["Expedited · dedicated van", "ok"] : ["Late · " + p.lateDays + " days", "bad"];
      return isLate(p) ? ["Late · " + p.lateDays + (p.lateDays === 1 ? " day" : " days"), "bad"] : /risk/i.test(p.status) ? ["Date moved by supplier", "warn"] : ["Confirmed", "neutral"];
    };
    const releases = (p) => {
      if (p.depOrders) return h("span", null, ...p.depOrders.slice(0, 3).map((id, i) => h("span", { key: id }, i ? ", " : "", L.order(id))), p.depOrders.length > 3 ? h("span", { className: "pd-faint" }, " +" + (p.depOrders.length - 3) + " more") : null);
      const r = RELEASE[p.id];
      if (!r || !r.custs.length) return h("span", { className: "pd-faint" }, p.id === "PO-8826" ? "Stock only · balance of AD-7110 due " + rel(D(3)) : "Stock only, no order waiting");
      return h("span", null, ...r.custs.slice(0, 2).map((c, i) => h("span", { key: c }, i ? ", " : "", L.cust(c))), r.custs.length > 2 ? h("span", { className: "pd-faint" }, " +" + (r.custs.length - 2)) : null,
        h("span", { className: "pd-faint" }, " · " + r.skus.join(", ")));
    };
    const weekCols = WEEK.map((w) => ({ l: w.n === 0 ? "Today" : w.n === 1 ? "Tmrw" : PD.date.WD[D(w.n).getDay()], v: w.value, d: w.count + " POs · " + eurK(w.value), hi: w.n === (day === "tomorrow" ? 1 : 0) }));

    const todayLanes = [
      { site: "Dublin", bay: "Bay 1", blocks: GI.filter((p) => SLOTS[p.id].bay === "Bay 1") },
      { site: "Dublin", bay: "Bay 2", blocks: GI.filter((p) => SLOTS[p.id].bay === "Bay 2") },
      { site: "Naas", bay: "N1", blocks: GI.filter((p) => SLOTS[p.id].bay === "N1") },
      { site: "Naas", bay: "N2", blocks: GI.filter((p) => SLOTS[p.id].bay === "N2") }
    ].map((ln) => Object.assign({}, ln, { blocks: ln.blocks.map((p) => ({ from: SLOTS[p.id].from, mins: SLOTS[p.id].mins, t: SHORT[p.supplier] + " · " + p.pallets + " plt", d: p.id, tone: SLOTS[p.id].tone || (p.id === "PO-8826" ? "ok" : "info"), title: p.id + " · " + supName(p.supplier) + (SLOTS[p.id].note ? " · " + SLOTS[p.id].note : ""), onClick: () => ctx.open("po", p.id) })) }));
    const tomLanes = [
      { site: "Dublin", bay: "Bay 1", blocks: tomorrow.filter((p) => p.wh === "DUB") },
      { site: "Naas", bay: "N1", blocks: tomorrow.filter((p) => p.wh === "NAS") }
    ].map((ln) => Object.assign({}, ln, { blocks: ln.blocks.map((p) => ({ from: TOM_T[p.id], mins: Math.max(20, pallets(p) * 3), t: (p.local ? p.supName.split(" ")[0] : SHORT[p.supplier]) + " · " + pallets(p) + " plt", d: p.id, tone: p.id === "PO-8821" ? (exp ? "ok" : "bad") : isLate(p) ? "warn" : "info", title: p.id, onClick: p.local ? null : () => ctx.open("po", p.id) })) }));

    return UI.Page({
      kicker: "Purchasing · incoming", live: "SUPPLIER PORTALS · WMS GOODS IN",
      title: GI.length + " deliveries today: " + giPal + " pallets, " + eur(giVal),
      sub: "What is arriving, when, at which bay, and which customer orders each delivery releases. Goods in knows what is coming before the lorry does.",
      actions: [UI.Btn("Goods in board", () => ctx.go("Warehouse", "Goods In"), { pri: true, icon: "truck" }), UI.Btn("Purchase orders", () => ctx.go("Purchasing", "Purchase Orders"))],
      children: [
        UI.Kpis([
          { label: "Deliveries today", value: String(GI.length), sub: giPal + " pallets · " + eur(giVal), onClick: () => ctx.set({ purInDay: "today" }) },
          { label: "Received so far", value: "1 of " + GI.length, sub: "PO-8826 Celtic, 24 short", subTone: "warn", onClick: () => ctx.open("po", "PO-8826") },
          { label: "Orders released today", value: String(depsToday), sub: "Allocated as each PO is booked in", subTone: "ok" },
          { label: "Tomorrow", value: tomorrow.length + " deliveries", sub: "PO-8821 " + (exp ? "07:30" : "10:30") + " · " + p8821.deps + " orders wait on it", tone: exp ? null : "warn", onClick: () => ctx.set({ purInDay: "tomorrow" }) },
          { label: "Next 7 days", value: DUE_WEEK + " POs", sub: eur(WEEK_VALUE), onClick: () => ctx.set({ purInDay: "week" }) }
        ]),
        UI.Card({ flush: true, title: day === "today" ? "Arriving today" : day === "tomorrow" ? "Arriving " + relLower(D(1)) : "Arriving in the next 7 days", meta: rows.length + " DELIVERIES · " + eur(sum(rows.map((p) => p.value))),
          right: UI.Tabs([["today", "Today"], ["tomorrow", "Tomorrow"], ["week", "Rest of the week"]], day, (v) => ctx.set({ purInDay: v })) },
          UI.Table({
            rows, rowKey: (p) => p.id, onRow: openPo(ctx), rowTone: (p) => statusOf(p)[1] === "bad" ? "bad" : statusOf(p)[1] === "warn" ? "warn" : null,
            cols: [
              { label: day === "week" ? "Day" : "Time", w: "88px", render: (p) => mono(whenOf(p) + (day === "week" && p.eta && p.eta !== "—" ? " " + p.eta : ""), true) },
              { label: "PO", w: "84px", render: poId },
              { label: "Supplier", w: "minmax(170px,1.3fr)", ink: true, render: (p) => supCell(L, p) },
              { label: "Site", w: "110px", render: (p) => DB.warehouses[p.wh].short + (bayOf(p) ? " · " + bayOf(p) : "") },
              { label: "Pallets", w: "64px", r: true, num: true, render: (p) => pallets(p) || none() },
              { label: "Value", w: "86px", r: true, num: true, render: (p) => eur(p.value) },
              { label: "Status", w: "180px", render: (p) => UI.Badge(statusOf(p)[0], statusOf(p)[1]) },
              { label: "Orders", w: "60px", r: true, num: true, ink: true, render: (p) => p.deps || none() },
              { label: "Releases", w: "minmax(240px,2fr)", render: releases }
            ],
            foot: day === "week" ? "Plus " + sum(Object.keys(UNLISTED).map((k) => UNLISTED[k][0])) + " on-time replenishment POs (" + eur(sum(Object.keys(UNLISTED).map((k) => UNLISTED[k][1]))) + ") with no customer order waiting." : day === "today" ? "PO-8834 from Kerry does not include FH-6710 hand soap: those 7 orders stay short until PO-8847 is raised." : null
          })),
        gap(),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [
          UI.Card({ title: day === "tomorrow" ? "Goods-in bookings " + relLower(D(1)) : "Goods-in bookings today", icon: "clock", meta: day === "tomorrow" ? "DUBLIN BAY 1 · NAAS N1" : "DUBLIN BAYS 1 TO 2 · NAAS N1 TO N2", delay: 60 }, [
            board(day === "tomorrow" ? tomLanes : todayLanes, day === "tomorrow" ? null : 9 + 20 / 60),
            UI.Note(day === "tomorrow"
              ? (exp ? "PO-8821 moved to 07:30 on Atlas' dedicated van: Murphy's balance makes D14's first run." : "PO-8821 is booked for 10:30. Expediting to 07:30 costs €420 and gets Murphy's balance onto the first run.")
              : "Celtic arrived early at 08:20 and was received with 24 short. Naas is tight from 13:00: Polska's 78 pallets need both receivers while SafePro and the 14:00 shuttle want the same people.", { marginTop: 10 })
          ]),
          h("div", null,
            day === "tomorrow"
              ? UI.AI({ who: "Purchasing Agent", conf: "€420 TO SAVE 3 HOURS", text: "Six orders worth " + eur(p8821.depValue) + " wait on PO-8821. At 10:30 the balance misses D14's first run; at 07:30 it makes it. EuroCable's PO-8836 at 08:30 clears the four EL-4712 backorders in the same morning, so bay 1 is busy from 07:30 to about 09:00.",
                actions: [UI.Btn("Expedite PO-8821", () => ctx.act("dq-expedite", "Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight. Emma Walsh copied."), { pri: !exp, sm: true, done: exp, doneLabel: "Expedite requested" }), UI.Btn("Open PO-8821", () => ctx.open("po", "PO-8821"), { sm: true })] })
              : UI.AI({ who: "Ops Watchdog", conf: "NAAS 13:00 TO 15:00", text: "Aoife Brennan has two receivers at Naas. Polska's 78 pallets (PO-8839) need both from 13:00, SafePro's 12 (PO-8833) arrive at 14:00, and the shuttle loads at 14:00. Ask SafePro's haulier for 15:00. It costs nothing: the gloves release 3 orders that are not due out until tomorrow.",
                actions: [UI.Btn("Move SafePro to 15:00", () => ctx.act("pur-slot-safepro", "Slot moved", "SafePro's haulier asked to deliver PO-8833 at 15:00, bay N2. Aoife Brennan copied."), { pri: !ctx.done("pur-slot-safepro"), sm: true, done: ctx.done("pur-slot-safepro"), doneLabel: "Slot moved" }), UI.Btn("Goods in board", () => ctx.go("Warehouse", "Goods In"), { sm: true })] }),
            gap(),
            UI.Card({ title: "Next 7 days", icon: "spark", meta: DUE_WEEK + " POS · " + eurK(WEEK_VALUE).toUpperCase(), delay: 100 }, [
              UI.Columns(weekCols, { h: 128 }),
              UI.Note("Today is the heaviest day of the week at goods in: " + giPal + " pallets across both sites.", { marginTop: 8 })
            ]))
        ])
      ]
    });
  }

  /* ================================================================ SUPPLIERS */
  function suppliers(ctx) {
    const f = ctx.st.purSupF || "all";
    const PICK = { all: () => true, attn: (s) => s.tone !== "ok", good: (s) => s.tone === "ok", GBP: (s) => s.ccy === "GBP", IE: (s) => s.country === "Ireland" };
    const F = [["all", "All key"], ["attn", "Needs attention"], ["good", "Good or preferred"], ["GBP", "Sterling"], ["IE", "Irish"]].map((x) => [x[0], x[1], DB.suppliers.filter(PICK[x[0]]).length]);
    const rows = DB.suppliers.filter(PICK[f] || PICK.all).slice().sort((a, b) => b.spend - a.spend);
    const keySpend = sum(DB.suppliers.map((s) => s.spend)), otherSpend = sum(OTHERS.map((o) => o[2]));
    const gbpKey = sum(DB.suppliers.filter((s) => s.ccy === "GBP").map((s) => s.spend)), gbpOther = 610000, sek = DB.supplier("nordic").spend;
    const byDelay = DB.suppliers.slice().sort((a, b) => b.delay - a.delay);
    return UI.Page({
      kicker: "Purchasing · suppliers", live: "SAGE 200 PURCHASE LEDGER",
      title: DB.company.suppliers + " suppliers · " + eurK(SPEND_TOTAL) + " a year",
      sub: "The 11 suppliers that carry " + Math.round(100 * keySpend / SPEND_TOTAL) + "% of spend, with terms, lead times, service and who buys from them. The other " + (DB.company.suppliers - DB.suppliers.length) + " are summarised below.",
      actions: [UI.Btn("Supplier performance", () => ctx.go("Purchasing", "Supplier Performance"), { pri: true })],
      children: [
        UI.Facts([
          ["Suppliers", String(DB.company.suppliers), null, DB.suppliers.length + " key · " + (DB.company.suppliers - DB.suppliers.length) + " smaller"],
          ["Annual spend", eurK(SPEND_TOTAL), null, "Key suppliers " + eurK(keySpend)],
          ["Supplier OTIF", SUP_OTIF + "%", "warn", "Target 95%"],
          ["Average lead time", LEAD + " days", null, "Promised " + LEAD_PROMISED + " days"],
          ["Paid in sterling", eurK(gbpKey + gbpOther), null, Math.round(100 * (gbpKey + gbpOther) / SPEND_TOTAL) + "% of spend"],
          ["Needs review", "1", "bad", "Atlas Industrial Supplies"]
        ], 6),
        gap(),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } }, UI.Chips(F, f, (v) => ctx.set({ purSupF: v }))),
        UI.Card({ flush: true, title: "Key suppliers", meta: rows.length + " SHOWN · " + eurK(sum(rows.map((s) => s.spend))).toUpperCase() + " A YEAR · CLICK FOR THE SUPPLIER RECORD" }, UI.Table({
          rows, rowKey: (s) => s.id, onRow: (s) => ctx.open("supplier", s.id), rowTone: (s) => s.tone === "bad" ? "bad" : null,
          cols: [
            { label: "Supplier", w: "minmax(200px,1.6fr)", ink: true, render: (s) => h("div", { style: { minWidth: 0 } }, h("div", { className: "pd-ell" }, s.name), h("div", { className: "pd-ell pd-faint", style: { fontSize: 11, marginTop: 2 } }, s.contact)) },
            { label: "Country", w: "108px", render: (s) => s.country },
            { label: "Currency", w: "70px", render: (s) => s.ccy + (s.id === "nordic" ? " · SEK list" : "") },
            { label: "Category", w: "minmax(160px,1.2fr)", render: (s) => s.cat },
            { label: "Spend", w: "80px", r: true, num: true, ink: true, render: (s) => eurK(s.spend) },
            { label: "Terms", w: "76px", render: (s) => s.terms },
            { label: "Lead time", w: "92px", r: true, num: true, render: (s) => h("span", null, s.lead + "d", h("span", { style: { color: s.delay > 2 ? "var(--bad)" : "var(--faint)", marginLeft: 5 } }, "+" + s.delay)) },
            { label: "OTIF", w: "64px", r: true, num: true, render: (s) => h("span", { style: { color: s.otif < 90 ? "var(--bad)" : s.otif < 94 ? "var(--warn)" : "var(--ok)" } }, s.otif + "%") },
            { label: "Status", w: "118px", render: (s) => UI.Badge(s.status, s.tone) },
            { label: "Buyer", w: "118px", render: (s) => DB.person(s.buyer) },
            { label: "Open POs", w: "120px", r: true, num: true, render: (s) => h("span", null, s.openPOs + " · " + eurK(s.openValue), s.lateNow ? h("span", { style: { color: "var(--bad)", marginLeft: 6 } }, s.lateNow + " late") : null) }
          ],
          foot: "Lead time shows quoted days, then the average delay on top of it. Open POs total 58 (" + eur(sum(DB.suppliers.map((s) => s.openValue))) + ") with these 11; the other 24 are with smaller suppliers."
        })),
        gap(),
        UI.Grid("repeat(3,minmax(0,1fr))", [
          UI.Card({ title: "The other " + (DB.company.suppliers - DB.suppliers.length) + " suppliers", icon: "factory", meta: eurK(otherSpend).toUpperCase() + " A YEAR", delay: 60 }, [
            UI.HBars(OTHERS.map((o) => ({ label: o[0], v: o[2], d: o[1] + " · " + eurK(o[2]) })), { tpl: "minmax(120px,1.2fr) 1fr 84px", flat: true }),
            UI.Note("Shannon Packaging, Boyne Signs, Lakeland Ladders, Castle Brush and Vistula Gloves have 5 late POs between them (" + eur(sum(SMALL_LATE.map((p) => p.value))) + "). None has a customer order waiting.", { marginTop: 10 })
          ]),
          UI.Card({ title: "Lead time: quoted vs achieved", icon: "clock", meta: "DAYS · LAST 12 MONTHS", delay: 100 },
            byDelay.map((s) => h("div", { key: s.id, className: "pd-hbar pd-click", onClick: () => ctx.open("supplier", s.id), style: { gridTemplateColumns: "76px 1fr 96px", borderRadius: 8 } },
              h("div", { className: "lb" }, SHORT[s.id]),
              UI.Bar(100 * achieved(s) / 32, s.delay > 2 ? "bad" : s.delay > 1 ? "warn" : "ok", { h: 7 }),
              h("div", { className: "vl" }, s.lead + " → " + achieved(s))))),
          h("div", null,
            UI.Card({ title: "Spend by currency", icon: "euro", meta: "ANNUAL", delay: 140 }, [
              UI.Split([
                { label: "Euro", v: SPEND_TOTAL - gbpKey - gbpOther - sek, color: "var(--accent)", d: eurK(SPEND_TOTAL - gbpKey - gbpOther - sek) },
                { label: "Sterling", v: gbpKey + gbpOther, color: "var(--warn)", d: eurK(gbpKey + gbpOther) },
                { label: "SEK-priced", v: sek, color: "var(--faint)", d: eurK(sek) }
              ]),
              UI.Note("Northgate, SafePro and Midland invoice in sterling. Nordic invoices in euro off a krona price list.", { marginTop: 10 })
            ]),
            gap(),
            UI.Card({ title: "Sole-sourced SKUs", icon: "link", meta: "NO SECOND SUPPLIER ON FILE", delay: 180 },
              UI.HBars(DB.suppliers.slice().sort((a, b) => SOLE[b.id] - SOLE[a.id]).slice(0, 5).map((s) => ({ label: SHORT[s.id], v: SOLE[s.id], d: String(SOLE[s.id]), tone: s.id === "atlas" ? "bad" : null, onClick: () => ctx.open("supplier", s.id) })), { tpl: "80px 1fr 40px", colorValue: true })))
        ]),
        UI.AI({ who: "Purchasing Agent", conf: "3 THINGS NEED A PERSON",
          text: "Atlas needs a review: 86.2% OTIF, 3.8 days average delay and 96 SKUs with no second supplier. EuroFix sent a 428-line price file this morning, so check it before the next PO goes. And terms are a cash lever: Midland put discs up 8.9% last month on 30-day terms. Asking for 40 days in return releases about €11,500, most of Finance's €12,000 supplier-terms target.",
          actions: [UI.Btn("Schedule Atlas review", () => ctx.act("rev-atlas", "Review scheduled", "Atlas Industrial Supplies: review booked with Emma Walsh and Patrick Byrne for Tuesday."), { pri: !ctx.done("rev-atlas"), sm: true, done: ctx.done("rev-atlas"), doneLabel: "Scheduled" }),
            UI.Btn("EuroFix price file", () => ctx.go("Pricing & Margin", "Cost Changes"), { sm: true }),
            UI.Btn("Working capital", () => ctx.go("Finance", "Working Capital"), { sm: true, ghost: true })] })
      ]
    });
  }

  /* ================================================================ SUPPLIER PERFORMANCE */
  function quadrant(ctx, scored) {
    const X_MAX = 2000000, Y_MIN = 10, Y_MAX = 105, X_MID = 800000, Y_MID = 65;
    const xp = (v) => 100 * v / X_MAX, yp = (v) => 100 * (v - Y_MIN) / (Y_MAX - Y_MIN);
    const LEFT_LABEL = { atlas: 1, eurocable: 1, celtic: 1, midland: 1 };
    const corner = (txt, st) => h("span", { className: "pd-label", style: Object.assign({ position: "absolute", padding: 8 }, st) }, txt);
    return h("div", null,
      h("div", { style: { position: "relative", height: 270, borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-2)", overflow: "hidden" } },
        h("div", { style: { position: "absolute", top: 0, bottom: 0, left: xp(X_MID) + "%", borderLeft: "1px dashed var(--border-strong)" } }),
        h("div", { style: { position: "absolute", left: 0, right: 0, bottom: yp(Y_MID) + "%", borderTop: "1px dashed var(--border-strong)" } }),
        corner("Grow: small and reliable", { left: 0, top: 0 }),
        corner("Protect: big and reliable", { right: 0, top: 0, textAlign: "right" }),
        corner("Replace or develop", { left: 0, bottom: 0 }),
        corner("Fix or dual-source", { right: 0, bottom: 0, textAlign: "right", color: "var(--bad)" }),
        ...scored.map((r) => {
          const tone = r.score < Y_MID ? (r.s.spend >= X_MID ? "bad" : "warn") : "ok", left = !!LEFT_LABEL[r.s.id];
          return h("div", { key: r.s.id, className: "pd-click", onClick: () => ctx.open("supplier", r.s.id), title: r.s.name + " · score " + Math.round(r.score) + " · " + eurK(r.s.spend),
            style: { position: "absolute", left: xp(r.s.spend) + "%", bottom: yp(r.score) + "%", transform: "translate(-50%,50%)", display: "flex", alignItems: "center", flexDirection: left ? "row-reverse" : "row", gap: 6 } },
            h("span", { style: { width: 11, height: 11, borderRadius: "50%", background: PD.TONE[tone].fg, boxShadow: "0 0 0 3px " + PD.TONE[tone].bg, flex: "none" } }),
            h("span", { style: { fontSize: 11, color: tone === "bad" ? "var(--bad)" : "var(--body)", whiteSpace: "nowrap", position: "absolute", [left ? "right" : "left"]: 17 } }, SHORT[r.s.id] + " " + Math.round(r.score)));
        })),
      h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6 } },
        h("span", { className: "pd-meta" }, "€0"), h("span", { className: "pd-meta" }, "Annual spend →  €1m"), h("span", { className: "pd-meta" }, "€2m")),
      UI.Note("Vertical axis is the composite score. Dashed lines at €0.8m of spend and a score of 65.", { marginTop: 4 }));
  }

  function performance(ctx) {
    const preset = PRESETS[ctx.st.purW] ? ctx.st.purW : "balanced", W = PRESETS[preset].w;
    const bySpend = DB.suppliers.slice().sort((a, b) => b.spend - a.spend).map((s) => s.id);
    const scored = DB.suppliers.map((s) => ({ s, score: scoreOf(s, W), spendRank: bySpend.indexOf(s.id) + 1 })).sort((a, b) => b.score - a.score);
    const totalAffected = sum(DB.suppliers.map((s) => s.affected));
    const atlas = DB.supplier("atlas");
    const atlasShare = Math.round(100 * atlas.affected / totalAffected), atlasSpend = Math.round(100 * atlas.spend / SPEND_TOTAL);
    const claims = sum(DB.suppliers.map((s) => s.claims));
    const pain = DB.suppliers.slice().sort((a, b) => b.affected - a.affected);
    const L = PD.lk(ctx);
    const colour = (v, bad, warn, hiGood) => ({ color: hiGood ? (v < bad ? "var(--bad)" : v < warn ? "var(--warn)" : "var(--body)") : (v > bad ? "var(--bad)" : v > warn ? "var(--warn)" : "var(--body)") });
    return UI.Page({
      kicker: "Purchasing · supplier performance", live: "LAST 12 MONTHS · GOODS IN, RETURNS, CLAIMS, OTIF",
      title: "Atlas is " + atlasSpend + "% of spend and " + atlasShare + "% of supplier-caused disruption",
      sub: "Suppliers ranked on what they do to our service, not on how much we spend with them. The score is transparent: every weight and scale is on this page.",
      actions: [UI.Btn("Which supplier is causing the most disruption?", () => ctx.ask("Which supplier is causing the most disruption?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Supplier OTIF", value: SUP_OTIF + "%", sub: "Target 95% · Atlas 86.2%", tone: "warn", subTone: "warn" },
          { label: "Fill rate", value: FILL + "%", sub: "Last 90 days" },
          { label: "Average lead time", value: LEAD + " days", sub: "Promised " + LEAD_PROMISED + " days", subTone: "warn" },
          { label: "Customer orders affected", value: String(totalAffected), sub: "Year to date, key suppliers", tone: "bad" },
          { label: "Open claims", value: String(claims), sub: "3 with Atlas, oldest 9 days unanswered" }
        ]),
        UI.Card({ flush: true, title: "Ranking: " + PRESETS[preset].label.toLowerCase(), meta: "CLICK A ROW FOR THE SUPPLIER", delay: 40,
          right: UI.Chips(Object.keys(PRESETS).map((k) => [k, PRESETS[k].label]), preset, (v) => ctx.set({ purW: v })) },
          UI.Table({
            rows: scored, rowKey: (r) => r.s.id, onRow: (r) => ctx.open("supplier", r.s.id), rowTone: (r) => r.score < 40 ? "bad" : r.score < 65 ? "warn" : null,
            cols: [
              { label: "#", w: "40px", render: (r) => h("span", { className: "pd-mono", style: { color: "var(--faint)" } }, String(scored.indexOf(r) + 1)) },
              { label: "Supplier", w: "minmax(190px,1.4fr)", ink: true, render: (r) => L.sup(r.s.id) },
              { label: "Score", w: "118px", render: (r) => h("div", { className: "pd-split", style: { gap: 7 } }, UI.Bar(r.score, r.score < 40 ? "bad" : r.score < 65 ? "warn" : "ok", { w: 56 }), h("span", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, Math.round(r.score))) },
              { label: "Total spend", w: "86px", r: true, num: true, render: (r) => eurK(r.s.spend) },
              { label: "Spend rank", w: "80px", r: true, num: true, render: (r) => h("span", { className: "pd-faint" }, "#" + r.spendRank) },
              { label: "OTIF", w: "64px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.otif, 90, 94, true) }, r.s.otif + "%") },
              { label: "Fill rate", w: "70px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.fill, 93, 96, true) }, r.s.fill + "%") },
              { label: "Avg delay", w: "78px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.delay, 2.5, 1.5) }, r.s.delay + "d") },
              { label: "Quality", w: "64px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.quality, 4, 2) }, r.s.quality) },
              { label: "Returns", w: "66px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.returns, 9, 5) }, r.s.returns) },
              { label: "Price chg", w: "72px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.priceChanges, 6, 3) }, r.s.priceChanges) },
              { label: "Lead acc.", w: "72px", r: true, num: true, render: (r) => h("span", { style: colour(r.s.leadAcc, 82, 88, true) }, r.s.leadAcc + "%") },
              { label: "Claims", w: "60px", r: true, num: true, render: (r) => r.s.claims || none() },
              { label: "Orders hit", w: "76px", r: true, num: true, ink: true, render: (r) => h("span", { style: colour(r.s.affected, 50, 20) }, r.s.affected) },
              { label: "Status", w: "118px", render: (r) => UI.Badge(r.s.status, r.s.tone) }
            ],
            foot: "Biggest by spend is not best by performance: Atlas is #1 on spend and last on score under every weighting. EuroCable is #8 on spend and first."
          })),
        gap(),
        UI.Grid("minmax(0,1.25fr) minmax(0,1fr)", [
          UI.Card({ title: "Spend vs performance", icon: "spark", meta: "WHERE EACH SUPPLIER SITS", delay: 80 }, quadrant(ctx, scored)),
          h("div", null,
            UI.Card({ title: "Who caused the most customer pain", icon: "alert", meta: totalAffected + " ORDERS AFFECTED THIS YEAR", delay: 120 }, [
              UI.HBars(pain.slice(0, 7).map((s) => ({ label: SHORT[s.id], sub: OTIF_BY_SUP[s.id] ? "OTIF " + OTIF_BY_SUP[s.id] + "%" : null, v: s.affected, d: s.affected + " · " + Math.round(100 * s.affected / totalAffected) + "%", tone: s.id === "atlas" ? "bad" : null, onClick: () => ctx.open("supplier", s.id) })), { tpl: "minmax(120px,1.1fr) 1.4fr 72px", colorValue: true }),
              UI.Note("OTIF shown is for customer orders containing that supplier's lines. Orders with an Atlas line run at 81.4% against 94.2% overall.", { marginTop: 8 })
            ]),
            gap(),
            UI.AI({ who: "Purchasing Agent", conf: "WHICH SUPPLIER IS CAUSING THE MOST DISRUPTION?",
              text: "Atlas, by a distance. " + atlasSpend + "% of what we spend and " + atlasShare + "% of the customer orders suppliers disrupted this year: " + atlas.affected + " orders, 7 quality claims, and " + DB.po("PO-8821").deps + " orders waiting on PO-8821 today. Polska is the next weakest on the score but touches far fewer orders. Dual-source the cable lines to EuroCable and take these numbers to a review.",
              actions: [UI.Btn("Schedule Atlas review", () => ctx.act("rev-atlas", "Review scheduled", "Atlas Industrial Supplies: review booked with Emma Walsh and Patrick Byrne for Tuesday."), { pri: !ctx.done("rev-atlas"), sm: true, done: ctx.done("rev-atlas"), doneLabel: "Scheduled" }),
                UI.Btn("What orders depend on Atlas?", () => ctx.ask("What orders depend on Atlas?"), { sm: true, icon: "spark" }),
                UI.Btn("Open Atlas", () => ctx.open("supplier", "atlas"), { sm: true, ghost: true })] }))
        ]),
        UI.Grid("minmax(0,1.25fr) minmax(0,1fr)", [
          UI.Card({ title: "OTIF, last 12 months", icon: "spark", meta: "TARGET 95%", delay: 160 }, UI.Lines(months(12), [
            { name: "Atlas", values: [92.0, 91.6, 91.1, 90.8, 90.2, 89.6, 89.1, 88.4, 87.9, 87.2, 86.8, atlas.otif], color: "var(--bad)", w: 2.2 },
            { name: "All suppliers", values: [93.9, 93.7, 93.6, 93.4, 93.1, 92.8, 92.9, 92.4, 92.0, 91.8, 91.9, SUP_OTIF], color: "var(--accent)", area: true },
            { name: "EuroCable", values: [97.2, 97.6, 97.4, 98.0, 97.9, 97.5, 98.1, 97.8, 97.6, 98.2, 97.9, DB.supplier("eurocable").otif], color: "var(--ok)", dash: true }
          ], { h: 170, min: 84, max: 100, hline: 95 })),
          UI.Card({ title: "How the score works", icon: "shield", meta: PRESETS[preset].label.toUpperCase(), delay: 200 }, [
            ...METRICS.map((m) => h("div", { key: m.k, className: "pd-hbar", style: { gridTemplateColumns: "minmax(120px,1fr) 1fr 40px" } },
              h("div", { className: "lb", title: m.how }, m.label, h("div", { className: "pd-faint", style: { fontSize: 10.5, marginTop: 2, whiteSpace: "normal" } }, m.how)),
              UI.Bar(100 * W[m.k] / 30, W[m.k] >= 25 ? "info" : null, { h: 6 }),
              h("div", { className: "vl" }, W[m.k] + "%"))),
            UI.Note("Weights set by Emma Walsh and reviewed quarterly. Spend is deliberately not in the score; it is the horizontal axis on the chart instead.", { marginTop: 8 })
          ])
        ])
      ]
    });
  }

  PD.pages.Purchasing = {
    "Overview": overview,
    "Recommendations": recommendations,
    "Purchase Orders": purchaseOrders,
    "Incoming": incoming,
    "Suppliers": suppliers,
    "Supplier Performance": performance
  };
})();
