/* Finance: revenue, debtors, credit control, cash and working capital.
   The point of this module is that credit and cash are wired into operations:
   a credit hold reaches sales, the warehouse and dispatch the moment it lands,
   and every euro that is trapped says which operational step is holding it. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB, K = DB.kpi, FN = DB.finance;
  const { eur, eurK, num } = PD.fmt;
  const { D, rel, relLower, dm, daysFrom, TODAY, MS } = PD.date;
  const B = UI.B;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const gap = () => h("div", { style: { height: 14 } });
  const mono = (t, style) => h("span", { className: "pd-mono", style: Object.assign({ fontSize: 12, color: "var(--ink)" }, style) }, t);
  const none = () => h("span", { className: "pd-faint" }, "None");
  const months = (n) => Array.from({ length: n }, (_, i) => MS[new Date(TODAY.getFullYear(), TODAY.getMonth() - (n - 1) + i, 1).getMonth()]);
  const pctOf = (a, b) => Math.round(100 * a / b);
  const termsDays = (cust) => { const c = DB.customer(cust); return c ? parseInt(c.terms, 10) || 30 : 30; };

  /* ---------------- dates the finance calendar runs on ---------------- */
  const DOW = TODAY.getDay();
  const nextDow = (d) => (d - DOW + 7) % 7; // 0 when today is that weekday
  const isWkend = (x) => x.getDay() === 0 || x.getDay() === 6;
  const backToFri = (x) => { const y = new Date(x); while (isWkend(y)) y.setDate(y.getDate() - 1); return y; };
  const lastWorking = (y, m) => backToFri(new Date(y, m + 1, 0));
  // next occurrences (day offsets >= 0) of a monthly date; day can be "last" for the last working day
  const monthly = (day, keep) => {
    const out = [];
    for (let k = -1; k <= 3; k++) {
      const y = TODAY.getFullYear(), m = TODAY.getMonth() + k;
      if (keep && !keep(new Date(y, m, 1).getMonth())) continue;
      const n = daysFrom(day === "last" ? lastWorking(y, m) : backToFri(new Date(y, m, day)));
      if (n >= 0) out.push(n);
    }
    return out;
  };
  const whenLabel = (n) => (n === 0 ? "Today" : rel(D(n)));
  // k working days ago, and a calendar offset pulled back off a weekend
  const wdAgo = (k) => { let n = 0, c = 0; while (c < k) { n--; if (!isWkend(D(n))) c++; } return n; };
  const biz = (n) => { let x = n; while (isWkend(D(x))) x--; return x; };
  const OVER120 = "€189k";
  const next28 = (() => { let d = new Date(TODAY.getFullYear(), TODAY.getMonth(), 28); if (daysFrom(d) < 0) d = new Date(TODAY.getFullYear(), TODAY.getMonth() + 1, 28); return daysFrom(d); })();

  /* ================================================================ LOCAL DATA
     Everything here reconciles to DB.finance and DB.kpi. Checks at the bottom. */

  /* revenue: 11 closed months (€k, same series as the executive dashboard) + this month's forecast */
  const REV11 = [1236, 1301, 1048, 1152, 1224, 1338, 1352, 1396, 1371, 1322, 1246];
  const GM12 = [24.6, 24.9, 25.2, 24.8, 24.7, 24.9, 25.1, 24.6, 24.4, 24.1, 24.0, 23.8];
  const GP_MTD = 258110; // = Σ category revenue × margin; 23.8%
  const LAST_SAME = 1000570; // same period last month; MTD is +8.4%
  const FC = { invoiced: K.revenueMTD, routes: K.ordersTodayValue, pod: 26480, open: 31080 }; // forecast €1,318,600
  const FC_TOTAL = FC.invoiced + FC.routes + FC.pod + FC.open;
  const CAT_GROWTH = { "Electrical": 15.8, "Fixings & Fasteners": 4.1, "Safety & PPE": 3.2, "Hand & Power Tools": 6.8, "Industrial Consumables": 14.9, "Adhesives & Sealants": 2.4, "Facilities & Hygiene": 7.7, "Lighting": -3.8 };
  const WH_REV = [["Dublin", "DUB", 782300, 181490], ["Naas", "NAS", 302320, 76620]];
  const SEGMENTS = [
    ["Builders merchants", 312480, 76870, "Murphy, Midland Merchants, Swords, Carlow"],
    ["Contractors", 338960, 78836, "Doyle, Harbour Point, Horizon, Liffey, Dunmore"],
    ["Facilities management", 214340, 51656, "Core, O'Brien, Atlantic FM, Glenview"],
    ["Retail & national accounts", 148620, 31508, "Leinster Retail, Westbrook, Southside"],
    ["Trade counters & hire", 70220, 19240, "Tallaght Trade Centre, Brennan Hire"]
  ];
  const AMS = [["SB", 318640, 77111, 7.9, 94], ["MR", 292180, 72091, 10.9, 118], ["DK", 246380, 59131, 6.4, 131], ["MD", 98260, 19554, 12.8, 9], ["GF", 129160, 30223, 5.1, 85]];

  /* debtors ledger: DB.debtors is the top 12; the tail is whatever reconciles to the €318,000 ageing */
  const TOP = DB.debtors.map((r) => ({ cust: r[0], cur: r[1], d30: r[2], d60: r[3], d90: r[4], total: r[1] + r[2] + r[3] + r[4] }));
  const TOPSUM = ["cur", "d30", "d60", "d90", "total"].reduce((o, k) => (o[k] = sum(TOP.map((r) => r[k])), o), {});
  const TAIL = { tail: true, cust: null, cur: FN.ageing[0][1] - TOPSUM.cur, d30: FN.ageing[1][1] - TOPSUM.d30, d60: FN.ageing[2][1] - TOPSUM.d60, d90: FN.ageing[3][1] - TOPSUM.d90 };
  TAIL.total = TAIL.cur + TAIL.d30 + TAIL.d60 + TAIL.d90;
  const OTHER_ACCOUNTS = DB.company.accounts - TOP.length; // 425
  // days to pay (last 6 months), last payment [days ago, amount], promise
  const DX = {
    leinster: { dtp: [44, 45, 47, 46, 49, 52], last: [-6, 18400], promise: "Wednesday run: 3 invoices, €16,240", tone: "warn" },
    doyle: { dtp: [41, 44, 47, 52, 55, 58], last: [-19, 6200], promise: "INV-28482 by EFT Friday", tone: "warn" },
    core: { dtp: [31, 30, 32, 29, 31, 30], last: [-3, 24160] },
    harbour: { dtp: [36, 38, 37, 40, 41, 43], last: [-12, 8800], promise: "On the QS valuation, the 28th" },
    dunmore: { dtp: [42, 47, 51, 56, 60, 64], last: [-38, 2500], promise: "Withholding INV-28188: short delivery", tone: "bad" },
    murphy: { dtp: [29, 28, 30, 29, 28, 29], last: [-2, 14860] },
    midland: { dtp: [35, 34, 36, 37, 35, 36], last: [-1, 4200], promise: "INV-28626 on their Wednesday run" },
    obrien: { dtp: [33, 34, 33, 35, 36, 38], last: [-9, 11300], promise: "Query: PO number missing", tone: "warn" },
    liffey: { dtp: [34, 36, 35, 37, 38, 39], last: [-14, 7400], promise: "EFT Thursday" },
    westbrook: { dtp: [27, 28, 27, 29, 28, 27], last: [-4, 10200] },
    atlantic: { dtp: [32, 33, 35, 34, 36, 37], last: [-11, 5900], promise: "Wants the POD for INV-28712", tone: "warn" },
    southside: { dtp: [38, 44, 49, 53, 58, 63], last: [-41, 1100], promise: "Cheque promise broken", tone: "bad" }
  };

  /* overdue invoices on the top 12 accounts: reconcile to their 30 / 60 / 90+ columns (€86,320) */
  const OVD = [
    { id: "INV-28188", cust: "dunmore", v: 4180, days: 97, stage: "Query", so: "SO-10136", pod: "Delivered in full and signed for. The dispute is about a later order, SO-10452", note: "Joe Dunmore is withholding it over the short delivery on SO-10452. The RMA-1195 replacement was delivered and signed for.", next: "Send the signed replacement POD", done: "Signed RMA-1195 replacement POD sent to Joe Dunmore with a request to clear INV-28188." },
    { id: "INV-28231", cust: "southside", v: 1200, days: 92, stage: "Query", so: "SO-10151", note: "Gerry Mahon says 2 items were missing. The POD shows a full delivery, signed by him.", next: "Send the signed POD", done: "Signed POD sent to Gerry Mahon from Rachel Hayes' Outlook." },
    { id: "INV-28380", cust: "southside", v: 1210, days: 74, stage: "Promise broken", so: "SO-10210", note: "Cheque promised for Monday. Not received.", next: "Call with David Kelly", done: "Joint call booked: Rachel Hayes and David Kelly with Gerry Mahon at 11:30." },
    { id: "INV-28397", cust: "dunmore", v: 3940, days: 72, stage: "Final reminder", so: "SO-10218", note: "Final reminder sent 6 days ago. No reply.", next: "Call Joe Dunmore", done: "Call to Joe Dunmore added to Rachel Hayes' list for this morning." },
    { id: "INV-28426", cust: "leinster", v: 6150, days: 68, stage: "Query", so: "SO-10236", note: "Rejected by Leinster's AP portal: store code missing from the invoice.", next: "Re-issue with the store code", done: "INV-28426 re-issued with store code 07 and uploaded to Leinster's AP portal." },
    { id: "INV-28482", cust: "doyle", v: 11860, days: 61, stage: "Promised", so: "SO-10297", note: "Sinéad Carey promised EFT by Friday. It releases the rest of SO-10503.", next: "Request payment", key: "cc-doyle-pay", done: "Statement and INV-28482 copy sent to Sinéad Carey from Rachel Hayes' Outlook: €8,920 of SO-10503 releases on payment." },
    { id: "INV-28511", cust: "leinster", v: 7120, days: 58, stage: "Promised", so: "SO-10301", note: "On Leinster's Wednesday payment run." },
    { id: "INV-28534", cust: "leinster", v: 5480, days: 55, stage: "Promised", so: "SO-10318", note: "On Leinster's Wednesday payment run." },
    { id: "INV-28579", cust: "leinster", v: 3640, days: 49, stage: "Promised", so: "SO-10342", note: "On Leinster's Wednesday payment run." },
    { id: "INV-28617", cust: "doyle", v: 9340, days: 47, stage: "Reminder 2", so: "SO-10361", note: "Second reminder sent. Doyle pay oldest first, so this follows INV-28482." },
    { id: "INV-28620", cust: "dunmore", v: 5200, days: 46, stage: "Reminder 2", so: "SO-10364", note: "Second reminder sent. Account on watch." },
    { id: "INV-28626", cust: "midland", v: 6000, days: 44, stage: "Promised", so: "SO-10370", note: "Tom Delaney: on their Wednesday run." },
    { id: "INV-28633", cust: "harbour", v: 7100, days: 41, stage: "Promised", so: "SO-10377", note: "Paid when the site QS signs the monthly valuation." },
    { id: "INV-28655", cust: "obrien", v: 4400, days: 40, stage: "Query", so: "SO-10391", note: "O'Brien's AP won't pay without their PO number on the invoice. The order came in by phone.", next: "Re-issue with the PO number", done: "INV-28655 re-issued with O'Brien PO OBF-2217 and emailed to Ciarán Lacey." },
    { id: "INV-28662", cust: "liffey", v: 5500, days: 39, stage: "Promised", so: "SO-10398", note: "Mick Byrne: EFT Thursday." },
    { id: "INV-28712", cust: "atlantic", v: 4000, days: 33, stage: "Query", so: "SO-10428", note: "Atlantic want the signed POD before paying. It was signed but never attached to the invoice.", next: "Attach and send the POD", done: "POD attached to INV-28712 and sent to Lorraine Kinsella." }
  ];
  const INV = {};
  DB.invoices.forEach((i) => { INV[i.id] = { id: i.id, cust: i.cust, v: i.value, days: i.days, stage: i.status === "Overdue" ? "Overdue" : "Not yet due" }; });
  OVD.forEach((i) => { INV[i.id] = Object.assign({}, INV[i.id] || {}, i); });
  const STAGE_TONE = { "Promised": "info", "Query": "warn", "Reminder 2": "warn", "Final reminder": "bad", "Promise broken": "bad", "Not yet due": "neutral", "Overdue": "bad" };
  const byStage = (s) => sum(OVD.filter((i) => i.stage === s).map((i) => i.v));
  const QUERY_TOTAL = byStage("Query"); // €19,930

  /* delivered, not invoiced: the POD has not come back usable */
  const POD_WAIT = [
    { so: "SO-10474", cust: "leinster", route: "D02", day: 0, v: 5860, why: "Signed without the store code Leinster's AP portal needs" },
    { so: "SO-10462", cust: "core", route: "D11", day: -1, v: 3940, why: "Driver app offline; paper POD still in the cab" },
    { so: "SO-10457", cust: "horizon", route: "D14", day: -1, v: 2860, why: "Left on site unsigned, on the customer's instruction" },
    { so: "SO-10455", cust: "obrien", route: "N04", day: -2, v: 4120, why: "POD photo unreadable; re-sign requested" },
    { so: "SO-10451", cust: "harbour", route: "D12", day: -2, v: 3420, why: "Site QS only signs dockets on Fridays" }
  ];
  const POD_OTHER = { n: 6, v: 6280 };
  const POD_N = POD_WAIT.length + POD_OTHER.n, POD_V = sum(POD_WAIT.map((p) => p.v)) + POD_OTHER.v; // 11 · €26,480

  /* credit control */
  const DOYLE = { limit: 50000, bal: 42680, order: 16240, release: 7320 };
  DOYLE.exposure = DOYLE.bal + DOYLE.order; DOYLE.over = DOYLE.exposure - DOYLE.limit; DOYLE.avail = DOYLE.limit - DOYLE.bal;
  const DOYLE_OVERDUE = sum(DB.invoices.filter((i) => i.cust === "doyle" && i.status === "Overdue").map((i) => i.value)); // €21,200
  // SO-10503 split: first fix goes now, second fix waits for INV-28482
  const DOYLE_LINES = [
    ["EL-4712", "Twin & Earth 2.5mm 100m", 40, 79.80, "First fix", true],
    ["FIX-2214", "M12 Chemical Anchor Stud (10)", 120, 15.60, "First fix", true],
    ["FIX-2330", "Plasterboard Screw 3.5x32 (1000)", 120, 9.80, "First fix", true],
    ["AD-7102", "Low Modulus Silicone Clear 310ml", 240, 4.00, "First fix", true],
    ["SAF-1892", "Safety Glasses Clear", 40, 3.00, "Site PPE", true],
    ["EL-4520", "Consumer Unit 10-way RCBO", 24, 212.00, "Second fix", false],
    ["EL-4815", "Galvanised Trunking 50x50 3m", 120, 14.40, "Second fix", false],
    ["LT-8120", "LED Batten 5ft 40W", 60, 25.40, "Second fix", false],
    ["FIX-2402", "Unistrut Channel 41x41 3m", 25, 23.20, "Second fix", false]
  ];
  const HOLD_REC = {
    "SO-10503": ["Release €7,320 of first fix now; hold €8,920 until INV-28482 is paid", "Approve", "dq-doyle", "Partial release approved", "€7,320 of SO-10503 released to the Dublin pick queue for tomorrow's D14. €8,920 held until INV-28482 is paid."],
    "SO-10520": ["Hold. Releases when the €8,120 over 60 days is paid; the dispute is closed", "Request payment", "ch-SO-10520", "Payment requested", "Joe Dunmore sent the signed RMA-1195 POD and a statement. SO-10520 releases on payment."],
    "SO-10522": ["Release on payment of the €2,410 overdue", "Request payment", "ch-SO-10522", "Payment requested", "Statement to Gerry Mahon. David Kelly copied: the account is down 11.8%."],
    "SO-10524": ["Proforma: pay before dispatch until the cheque clears", "Send proforma", "ch-SO-10524", "Proforma sent", "Proforma for €3,060 sent to Carlow Build Centre. Naas holds the pick until funds clear."],
    "SO-10526": ["Release when the €1,100 over 60 days is paid", "Request payment", "ch-SO-10526", "Payment requested", "Rathmines Hardware asked for €1,100. SO-10526 releases on payment."],
    "SO-10527": ["Ask for €1,340 on account, then release in full", "Request payment", "ch-SO-10527", "Payment requested", "Kildare Mechanical asked for €1,340 on account to stay inside the €5,000 limit."],
    "SO-10529": ["New account, references not back: take a card payment", "Offer card payment", "ch-SO-10529", "Card payment offered", "Bray Maintenance Co offered card payment by phone. Order ships on payment."],
    "SO-10531": ["Hold. Rachel calls today about the broken promise", "Log call", "ch-SO-10531", "Call logged", "Portmarnock Property Services added to Rachel Hayes' calls this morning."],
    "SO-10533": ["Release. €640 over on a 27-day payer; raise the limit by €2,500", "Release", "ch-SO-10533", "Released", "SO-10533 released by Rachel Hayes (inside her €5,000 authority). Limit review sent to Niamh Clarke."]
  };
  const HELD_TOTAL = sum(DB.creditHolds.map((o) => o.value));
  // today's collection calls: the €38,000 "improved collections" in working capital
  const CALLS = [
    { cust: "doyle", amt: 11860, what: "INV-28482 · 61 days", why: "Promise is for Friday. Payment releases €8,920 of SO-10503 for Hansfield.", who: "Sinéad Carey · 01 822 7301", order: "SO-10503", unlock: 8920, key: "cc-doyle-pay", btn: "Request payment", done: "Statement and INV-28482 copy sent to Sinéad Carey from Rachel Hayes' Outlook." },
    { cust: "dunmore", amt: 8120, what: "INV-28397 + INV-28188", why: "The dispute is closed: the RMA-1195 replacement was signed for. Releases SO-10520.", who: "Joe Dunmore · 046 902 4418", order: "SO-10520", unlock: 5410, key: "call-dunmore", btn: "Log call", done: "Call with Joe Dunmore logged; signed POD sent." },
    { cust: "leinster", amt: 6150, what: "INV-28426 · 68 days", why: "Not a cash problem. Re-issue with the store code and it pays on Wednesday's run.", who: "Alison Grant · 01 293 8810", key: "inv-INV-28426", btn: "Re-issue invoice", done: "INV-28426 re-issued with store code 07." },
    { cust: "liffey", amt: 5500, what: "INV-28662 · 39 days", why: "Promise due Thursday. A short confirmation keeps it on their run.", who: "Mick Byrne · 087 330 7765", key: "call-liffey", btn: "Log call", done: "Call with Mick Byrne logged; EFT confirmed." },
    { cust: "southside", amt: 2410, what: "INV-28380 + INV-28231", why: "Broken promise on an account down 11.8%. David Kelly joins: it is a relationship call too.", who: "Gerry Mahon · 01 490 7718", order: "SO-10522", unlock: 2180, key: "inv-INV-28380", btn: "Book joint call", done: "Joint call booked with David Kelly for 11:30." },
    { cust: "portmarnock", amt: 2860, what: "2 invoices over 60 days", why: "Promised last Friday, not received. Releases SO-10531.", who: "Accounts office", order: "SO-10531", unlock: 1420, key: "ch-SO-10531", btn: "Log call", done: "Call logged against Portmarnock Property Services." },
    { cust: "rathmines", amt: 1100, what: "Over 60 days", why: "Small, but it releases SO-10526 (€1,240).", who: "Owner", order: "SO-10526", unlock: 1240, key: "ch-SO-10526", btn: "Request payment", done: "Rathmines Hardware asked for €1,100." }
  ];
  const CALLS_TOTAL = sum(CALLS.map((c) => c.amt)), CALLS_UNLOCK = sum(CALLS.map((c) => c.unlock || 0));
  // Rachel Hayes' call log
  const PROMISES = [
    { when: -1, t: "15:20", cust: "doyle", who: "Sinéad Carey", inv: "INV-28482", v: 11860, due: nextDow(5), what: "EFT by Friday", st: "Open" },
    { when: -1, t: "14:05", cust: "liffey", who: "Mick Byrne", inv: "INV-28662", v: 5500, due: nextDow(4), what: "EFT Thursday", st: "Open" },
    { when: -2, t: "11:40", cust: "midland", who: "Tom Delaney", inv: "INV-28626", v: 6000, due: nextDow(3), what: "On their Wednesday run", st: "Open" },
    { when: -3, t: "16:30", cust: "harbour", who: "Fiona Ward", inv: "INV-28633", v: 7100, due: next28, what: "When the QS signs the valuation", st: "Open" },
    { when: -4, t: "10:15", cust: "leinster", who: "Alison Grant", inv: "3 invoices", v: 16240, due: nextDow(3), what: "Wednesday payment run", st: "Open" },
    { when: -5, t: "10:05", cust: "murphy", who: "Karen Dolan", inv: "2 invoices", v: 14860, due: wdAgo(2), what: "BACS on their run", st: "Kept" },
    { when: -6, t: "09:30", cust: "core", who: "Deirdre Walsh", inv: "4 invoices", v: 24160, due: wdAgo(3), what: "Paid on terms", st: "Kept" },
    { when: -7, t: "09:50", cust: "portmarnock", who: "Accounts office", inv: "2 invoices", v: 2860, due: nextDow(5) - 7, what: "Payment on Friday", st: "Broken" },
    { when: -8, t: "12:10", cust: "southside", who: "Gerry Mahon", inv: "INV-28380", v: 1210, due: nextDow(1) - 7, what: "Cheque in the post Monday", st: "Broken" },
    { when: -9, t: "15:00", cust: "carlow", who: "Accounts", inv: "Cheque 004112", v: 2940, due: wdAgo(4), what: "Cheque re-presented", st: "Broken" }
  ];
  const PROM_OPEN = PROMISES.filter((p) => p.st === "Open"), PROM_BROKEN = PROMISES.filter((p) => p.st === "Broken");
  const RISK = [
    { cust: "doyle", score: 82, bal: 42680, limit: 50000, signals: "Days to pay 41 → 58 in six months · €21,200 overdue · new order takes exposure to €58,920", act: "Release €7,320, payment first", key: "dq-doyle", done: "€7,320 of SO-10503 released to the Dublin pick queue for tomorrow's D14. €8,920 held until INV-28482 is paid." },
    { cust: "dunmore", score: 78, bal: 19440, limit: 40000, signals: "Days to pay 42 → 64 · €4,180 over 90 days · credit insurer cut cover to €20,000 · spend down 6.2%", act: "Cut limit to €20,000", key: "cc-dunmore-limit", done: "Limit change to €20,000 sent to Niamh Clarke for sign-off. Sarah Byrne told." },
    { cust: "southside", score: 71, bal: 9720, limit: 15000, signals: "Spend down 11.8% · cheque promise broken · €2,410 over 60 days", act: "Joint call with David Kelly", key: "inv-INV-28380", done: "Joint call booked with David Kelly for 11:30." },
    { cust: "carlow", score: 69, bal: 2940, limit: 10000, signals: "Cheque returned unpaid last week · first bounce in 6 years", act: "Proforma until cleared", key: "ch-SO-10524", done: "Proforma for €3,060 sent to Carlow Build Centre." },
    { cust: "portmarnock", score: 58, bal: 2860, limit: 8000, signals: "Promise broken last Friday · third late payment this quarter", act: "Hold new orders", key: "ch-SO-10531", done: "Call logged against Portmarnock Property Services." },
    { cust: "leinster", score: 44, bal: 64210, limit: 120000, signals: "20% of the whole ledger in one account · €6,150 stuck on an AP portal rejection", act: "Fix the store-code rejections", key: "inv-INV-28426", done: "INV-28426 re-issued with store code 07." }
  ];

  /* cash: bank, facility, 6 weeks of receipts and payments placed on real calendar rules */
  const FAC_HEAD = FN.facility - FN.facilityUsed; // €480,000
  const GBP = 0.854; // booked rate, £ per €
  const PAYABLES = [
    ["atlas", 92800, "60 days"], ["eurofix", 71400, "45 days"], ["northgate", 46200, "30 days"], ["hartmann", 44600, "45 days"],
    ["safepro", 27800, "30 days"], ["kerry", 24300, "30 days"], ["eurocable", 19600, "45 days"], ["celtic", 18200, "30 days"],
    ["nordic", 16900, "60 days"], ["midland", 14700, "30 days"], ["polska", 12400, "45 days"]
  ];
  const PAY_OTHER = FN.payables - sum(PAYABLES.map((p) => p[1])); // 53 other suppliers
  const GBP_SUPS = PAYABLES.filter((p) => (DB.supplier(p[0]) || {}).ccy === "GBP");
  const GBP_INV = sum(GBP_SUPS.map((p) => p[1]));
  const GBP_POS = DB.pos.filter((p) => (DB.supplier(p.supplier) || {}).ccy === "GBP" && !p.received);
  const GBP_PO_V = sum(GBP_POS.map((p) => p.value));
  const ATLAS_CLAIMS = 2146; // RMA-1199 €298.50 + RMA-1198 €92 + RMA-1187 €199 + PO-8807 short-ship €1,556.50
  const EARLY_PAY = 12000; // on the Friday run but not due until the following week
  const CASH = (() => {
    const W = 6, days = W * 7, ev = [];
    const push = (n, kind, label, v, extra) => { if (n >= 0 && n < days) ev.push(Object.assign({ n, kind, label, v }, extra || {})); };
    for (let n = 0; n < days; n++) {
      const d = D(n); if (isWkend(d)) continue;
      const lw = lastWorking(d.getFullYear(), d.getMonth());
      let left = 0; for (let x = new Date(d); x <= lw; x.setDate(x.getDate() + 1)) if (!isWkend(x)) left++;
      let into = 0; for (let x = new Date(d.getFullYear(), d.getMonth(), 1); x <= d; x.setDate(x.getDate() + 1)) if (!isWkend(x)) into++;
      push(n, "rec", "Customer receipts", 52400 + (left <= 3 || into <= 2 ? 36000 : 0));
    }
    const FRI = [142600, 152400, 143900, 158200, 147600, 155300, 146800];
    let k = 0; for (let n = nextDow(5); n < days; n += 7) push(n, "sup", "Weekly SEPA supplier run", FRI[k++], { run: "weekly", short: "the weekly supplier run" });
    for (let n = nextDow(4); n < days; n += 7) push(n, "pay", "Weekly wages, warehouse and drivers", 24600);
    for (let n = nextDow(1); n < days; n += 7) push(n, "ovh", "Fuel cards, vehicle leases, rent, utilities", 19800);
    monthly(25).forEach((n) => push(n, "pay", "Monthly salaries", 71800, { short: "salaries" }));
    monthly(23).forEach((n) => push(n, "tax", "Revenue: PAYE, PRSI and USC", 38400, { short: "PAYE" }));
    monthly(23, (m) => m % 2 === 0).forEach((n) => push(n, "tax", "Revenue: VAT3, bi-monthly", 126800, { short: "the VAT3 payment" }));
    const EF = [71400, 108900, 104600], AT = [92800, 151200, 146900], GB = [GBP_INV, 94300, 91800];
    monthly(15).forEach((n, i) => push(n, "sup", "EuroFix GmbH run", EF[i], { run: "eurofix", short: "the EuroFix run" }));
    monthly("last").forEach((n, i) => { push(n, "sup", "Atlas Industrial Supplies run", AT[i], { run: "atlas", short: "the Atlas month end" }); push(n, "sup", "Sterling run: Northgate, SafePro, Midland", GB[i], { run: "gbp", short: "the sterling run" }); });
    const weeks = Array.from({ length: W }, (_, i) => ({ i, from: 7 * i, label: dm(D(7 * i)), rec: 0, sup: 0, pay: 0, tax: 0, ovh: 0 }));
    ev.forEach((e) => { weeks[Math.floor(e.n / 7)][e.kind] += e.v; });
    let bal = FN.bank;
    weeks.forEach((w) => { w.out = w.sup + w.pay + w.tax + w.ovh; w.net = w.rec - w.out; bal += w.net; w.close = bal; });
    // lowest end-of-day balance; today's opening balance is the floor
    let run = FN.bank, low = { bal: FN.bank, n: -1 };
    for (let n = 0; n < days; n++) { run += sum(ev.filter((e) => e.n === n).map((e) => (e.kind === "rec" ? e.v : -e.v))); if (run < low.bal) low = { bal: run, n }; }
    low.i = Math.max(0, Math.floor(low.n / 7));
    const big = ev.filter((e) => e.n === low.n && e.kind !== "rec" && e.v >= 30000).sort((a, b) => b.v - a.v).map((e) => e.short || e.label);
    const first = (run) => ev.filter((e) => e.run === run)[0] || null;
    return { weeks, ev, low, big, rec: sum(weeks.map((w) => w.rec)), out: sum(weeks.map((w) => w.out)), first };
  })();
  const nextOf = (a) => (a.length ? a[0] : null);
  const STAT = [
    ["Weekly wages", nextDow(4), 24600, "Warehouse and drivers · every Thursday"],
    ["Monthly salaries", nextOf(monthly(25)), 71800, "Staff on salary · the 25th, or the Friday before"],
    ["PAYE, PRSI and USC", nextOf(monthly(23)), 38400, "Revenue via ROS · the 23rd"],
    ["VAT3 return and payment", nextOf(monthly(23, (m) => m % 2 === 0)), 126800, "Bi-monthly via ROS · the 23rd"]
  ].sort((a, b) => a[1] - b[1]);

  /* working capital */
  const AGE = [["0-30 days", 1284300], ["31-60 days", 592460], ["61-90 days", 296820], ["90-120 days", 96840], ["120-180 days", 115380], ["180+ days", 74200]];
  const COGS = Math.round(DB.company.annualised * (1 - K.gm / 100)); // €11.73m
  const TURN = COGS / DB.company.inventory; // 4.8×
  const TURN_TARGET = 5.5;
  const STOCK_AT_TARGET = Math.round(COGS / TURN_TARGET);
  const WC_ROUTE = {
    "Slow stock reduction": { go: ["Inventory", "Slow & Dead Stock"], btn: "Slow & dead stock", owner: "EW", how: "Clear the €74,200 over 180 days through supplier returns and trade clearance; sell down the €212,220 at 90-180 days through the account managers." },
    "Improved collections": { go: ["Finance", "Debtors"], btn: "Debtors", owner: "RH", how: "Seven accounts over 60 days or with a broken promise, and five invoices stuck on queries operations can clear." },
    "Supplier terms": { go: ["Purchasing", "Suppliers"], btn: "Suppliers", owner: "NC", how: "Pay the weekly run to due date: €12,000 of it is not due until the following week. Asking EuroFix for 60 days alongside their 10.4% increase is not counted." },
    "Stock optimisation": { go: ["Inventory", "Replenishment"], btn: "Replenishment", owner: "EW", how: "Six reorder recommendations the other warehouse can cover by transfer, EL-4408 and SAF-1892 among them. Transfer instead of buying." }
  };

  /* ---------------- sanity checks: silent when the numbers reconcile ---------------- */
  const chk = (label, got, want) => { if (Math.abs(got - want) > 0.51) console.warn("[PD data] finance " + label + ": " + got + " ≠ " + want); };
  chk("ledger total", TOPSUM.total + TAIL.total, FN.receivables);
  chk("overdue", FN.ageing[1][1] + FN.ageing[2][1] + FN.ageing[3][1], FN.overdue);
  chk("top-12 overdue invoices", sum(OVD.map((i) => i.v)), TOPSUM.d30 + TOPSUM.d60 + TOPSUM.d90);
  TOP.forEach((r) => {
    chk("ledger vs customer balance " + r.cust, r.total, (DB.customer(r.cust) || { out: r.total }).out);
    chk("overdue invoices " + r.cust, sum(OVD.filter((i) => i.cust === r.cust).map((i) => i.v)), r.d30 + r.d60 + r.d90);
  });
  chk("category GP", Math.round(sum(DB.categories.map((c) => c.rev * c.gm / 100))), GP_MTD);
  chk("segment revenue", sum(SEGMENTS.map((s) => s[1])), K.revenueMTD);
  chk("segment GP", sum(SEGMENTS.map((s) => s[2])), GP_MTD);
  chk("AM revenue", sum(AMS.map((a) => a[1])), K.revenueMTD);
  chk("AM GP", sum(AMS.map((a) => a[2])), GP_MTD);
  chk("warehouse revenue", sum(WH_REV.map((w) => w[2])), K.revenueMTD);
  chk("warehouse GP", sum(WH_REV.map((w) => w[3])), GP_MTD);
  chk("Doyle lines", Math.round(100 * sum(DOYLE_LINES.map((l) => l[2] * l[3]))) / 100, DOYLE.order);
  chk("Doyle release", Math.round(100 * sum(DOYLE_LINES.filter((l) => l[5]).map((l) => l[2] * l[3]))) / 100, DOYLE.release);
  chk("Doyle available", DOYLE.avail, DOYLE.release);
  chk("credit holds", HELD_TOTAL, 35440);
  chk("collections", CALLS_TOTAL, FN.wcRelease[1][1]);
  chk("stock ageing", sum(AGE.map((a) => a[1])), DB.company.inventory);
  chk("stock >120", AGE[4][1] + AGE[5][1], FN.inventoryOver120);
  chk("slow stock", AGE[3][1] + AGE[4][1] + AGE[5][1], K.slow);
  chk("cash tied", DB.company.inventory + FN.receivables, FN.cashTied);
  chk("payables", sum(PAYABLES.map((p) => p[1])) + PAY_OTHER, FN.payables);
  chk("queries", QUERY_TOTAL, 19930);
  chk("POD not invoiced", POD_V, 26480);

  /* ---------------- shared bits ---------------- */
  const invLink = (ctx, id) => UI.Link(id, () => { ctx.set({ finInv: id }); ctx.go("Finance", "Debtors"); });
  const custOr = (ctx, id) => PD.lk(ctx).cust(id);
  const bucketCell = (v, tone) => v ? h("span", { style: { color: tone ? PD.TONE[tone].fg : "var(--body)" } }, eur(v)) : h("span", { className: "pd-faint" }, "0");

  // receipts (accent) against payments (dim), paired per week
  const Paired = (data, H) => {
    H = H || 160;
    const max = Math.max.apply(null, data.flatMap((d) => [d.a, d.b])) || 1;
    const bar = (v, bg, op, delay) => h("div", { style: { width: "40%", maxWidth: 24, height: Math.max(3, (H - 26) * v / max), background: bg, opacity: op, borderRadius: "6px 6px 2px 2px", transformOrigin: "bottom", animation: "growBar .6s var(--ease) " + delay + "ms both" } });
    return h("div", { className: "pd-cols", style: { height: H, gap: 12 } }, ...data.map((d, i) => h("div", { key: i, className: "pd-col", title: d.l + " · in " + eur(d.a) + " · out " + eur(d.b) },
      h("div", { style: { display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 3, width: "100%", height: H - 26 } },
        bar(d.a, "var(--accent)", 1, i * 40), bar(d.b, d.hot ? "var(--warn)" : "var(--dim)", d.hot ? .9 : .42, i * 40 + 20)),
      h("span", { style: { color: d.hot ? "var(--warn)" : undefined } }, d.l))));
  };
  const legend = (items) => h("div", { className: "pd-legend", style: { marginTop: 10 } }, ...items.map((it, i) => h("span", { key: i }, h("i", { style: { background: it[1], opacity: it[2] || 1 } }), it[0])));

  // a stacked exposure bar with a limit marker
  const ExposureBar = (parts, limit) => {
    const total = sum(parts.map((p) => p.v));
    const at = 100 * limit / total;
    return h("div", null,
      h("div", { style: { position: "relative", paddingTop: 20 } },
        h("div", { style: { display: "flex", height: 16, borderRadius: 999, overflow: "hidden", gap: 2, background: "var(--track)" } },
          ...parts.map((p, i) => h("div", { key: i, title: p.label + " · " + eur(p.v), style: { flex: p.v + " 0 0", background: p.color, opacity: p.op || 1, transformOrigin: "left", animation: "sweep .7s var(--ease) " + i * 60 + "ms both" } }))),
        h("div", { style: { position: "absolute", top: 2, bottom: -5, left: at + "%", borderLeft: "1.5px dashed var(--ink)" } },
          h("span", { className: "pd-meta", style: { position: "absolute", top: -1, right: 6, color: "var(--ink)" } }, "LIMIT " + eur(limit)))),
      h("div", { className: "pd-legend", style: { marginTop: 12 } }, ...parts.map((p, i) => h("span", { key: i }, h("i", { style: { background: p.color, opacity: p.op || 1 } }), p.label, h("b", { style: { color: "var(--ink)", fontWeight: 500 } }, eur(p.v))))));
  };

  /* ================================================================ OVERVIEW */
  function overview(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const doyleDone = ctx.done("dq-doyle"), partial = ctx.done("so-partial");
    const fri = CASH.first("weekly"), atlasRun = CASH.first("atlas");

    const kpis = UI.Kpis([
      { label: "Revenue MTD", value: eurK(K.revenueMTD), sub: K.revenueDelta, subTone: "ok", onClick: () => go("Finance", "Revenue") },
      { label: "Gross profit", value: eurK(GP_MTD), sub: K.gm + "% · target " + K.gmTarget.toFixed(1) + "%", subTone: "warn", onClick: () => go("Pricing & Margin", "Margin Control") },
      { label: "Receivables", value: eurK(FN.receivables), sub: eurK(FN.ageing[0][1]) + " not yet due", onClick: () => go("Finance", "Debtors") },
      { label: "Overdue", value: eurK(FN.overdue), sub: pctOf(FN.overdue, FN.receivables) + "% of the ledger", tone: "warn", subTone: "warn", onClick: () => go("Finance", "Debtors") },
      { label: "Inventory", value: eurK(DB.company.inventory), sub: "Dublin €1.72m · Naas €740k", onClick: () => go("Inventory", "Overview") },
      { label: "Inventory >120 days", value: "€189k", sub: eur(AGE[5][1]) + " over 180 days", tone: "warn", onClick: () => go("Inventory", "Slow & Dead Stock") },
      { label: "Cash tied up", value: eurK(FN.cashTied), sub: "Stock + receivables · €226k releasable", tone: "bad", onClick: () => go("Finance", "Working Capital") }
    ], "repeat(7,minmax(0,1fr))");

    const TODO = [
      { area: "CREDIT", tone: "bad", due: "10:00", owner: "PB", title: "Doyle Construction: €16,240 order over limit", sub: "Exposure " + eur(DOYLE.exposure) + " against " + eur(DOYLE.limit) + " · INV-28482 at 61 days",
        btns: [UI.Btn("Release €7,320", () => ctx.act("dq-doyle", HOLD_REC["SO-10503"][3], HOLD_REC["SO-10503"][4]), { pri: !doyleDone, sm: true, done: doyleDone, doneLabel: "€7,320 released" }), UI.Btn("Open", () => go("Finance", "Credit Control"), { sm: true, ghost: true })] },
      { area: "COLLECTIONS", tone: "warn", due: "Today", owner: "RH", title: CALLS.length + " calls worth " + eur(CALLS_TOTAL), sub: "Releases " + eur(CALLS_UNLOCK) + " of held orders when paid · Credit Agent's list",
        btns: [UI.Btn("Call list", () => go("Finance", "Credit Control"), { sm: true })] },
      { area: "PAYMENTS", tone: "info", due: fri ? whenLabel(fri.n) : "Friday", owner: "NC", title: "Weekly supplier run: " + eur(fri ? fri.v : 142600), sub: "31 suppliers · " + eur(EARLY_PAY) + " of it not due until the week after",
        btns: [UI.Btn("Pay to due date", () => ctx.act("fin-payterms", "Run trimmed to due date", eur(EARLY_PAY) + " moved to next week's run. Niamh Clarke approves the rest."), { sm: true, done: ctx.done("fin-payterms"), doneLabel: "Trimmed" }), UI.Btn("Cash", () => go("Finance", "Cash"), { sm: true, ghost: true })] },
      { area: "PAYMENTS", tone: "warn", due: atlasRun ? whenLabel(atlasRun.n) : "Month end", owner: "EW", title: "Atlas month end: hold " + eur(ATLAS_CLAIMS) + " of open claims", sub: "Pay " + eur(92800 - ATLAS_CLAIMS) + " of " + eur(92800) + " · 3 RMAs and a short-ship on PO-8807",
        btns: [UI.Btn("Hold claims", () => ctx.act("fin-atlas-claims", "Claims held back", eur(ATLAS_CLAIMS) + " deducted from the Atlas run with a debit note. Declan Moore told by Emma Walsh."), { sm: true, done: ctx.done("fin-atlas-claims"), doneLabel: "Held" }), UI.Btn("Atlas", () => ctx.open("supplier", "atlas"), { sm: true, ghost: true })] },
      { area: "INVOICING", tone: "warn", due: "Today", owner: "CW", title: POD_N + " deliveries not invoiced: " + eur(POD_V), sub: "POD missing, unsigned or unreadable",
        btns: [UI.Btn("Chase PODs", () => ctx.act("fin-pods", "POD chase sent", "Conor Whelan asked drivers for the " + POD_N + " PODs. Invoices raise automatically as each lands in Sage 200."), { sm: true, done: ctx.done("fin-pods"), doneLabel: "Chased" }), UI.Btn("PODs", () => go("Delivery", "Proof of Delivery"), { sm: true, ghost: true })] },
      { area: "QUERIES", tone: "warn", due: "This week", owner: "RH", title: "5 invoices stuck on a query: " + eur(QUERY_TOTAL), sub: "Missing PO number, store code, POD copy, a resolved short delivery",
        btns: [UI.Btn("Debtors", () => go("Finance", "Debtors"), { sm: true })] }
    ];
    const todo = UI.Card({ title: "What finance needs to act on today", icon: "shield", meta: "NIAMH CLARKE · RACHEL HAYES", delay: 60 },
      TODO.map((t, i) => h("div", { key: i, className: "pd-row", style: { alignItems: "flex-start", gap: 12 } },
        h("div", { style: { width: 3, alignSelf: "stretch", borderRadius: 3, background: PD.TONE[t.tone].fg, flex: "none" } }),
        h("div", { className: "pd-grow" },
          h("div", { className: "pd-split", style: { gap: 8 } }, UI.Badge(t.area, t.tone, true), h("span", { className: "pd-meta" }, "DUE " + t.due.toUpperCase() + " · " + DB.person(t.owner).toUpperCase())),
          h("div", { style: { fontSize: 13.5, fontWeight: 500, marginTop: 6 } }, t.title),
          h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 3 } }, t.sub)),
        h("div", { style: { display: "flex", gap: 6, flex: "none", paddingTop: 2 } }, ...t.btns))));

    const brief = UI.AI({ who: "Briefing Agent · for Niamh Clarke", conf: "08:05",
      text: [ "Revenue is ahead, cash is not following. Sales are up 8.4% but overdue has climbed from €96k to ", B("€124k"), " in nine months, and ", B("€189,580"), " of stock has not moved in 120 days. Today: decide Doyle by 10:00, get Rachel's ", B(CALLS.length + " calls"), " made (", B(eur(CALLS_TOTAL)), "), and hold ", B(eur(ATLAS_CLAIMS)), " back from Atlas at month end." ],
      actions: [UI.Btn("Where is our working capital trapped?", () => ctx.ask("Where is our working capital trapped?"), { icon: "spark", sm: true }), UI.Btn("Credit control", () => go("Finance", "Credit Control"), { sm: true })] });

    const blockers = [
      { label: "Orders waiting on late POs", v: 41880, d: eur(41880), sub: "6 on PO-8821", tone: "warn", onClick: () => ctx.open("po", "PO-8821") },
      { label: "Orders on credit hold", v: HELD_TOTAL, d: eur(HELD_TOTAL), sub: "9 orders", tone: "bad", onClick: () => go("Finance", "Credit Control") },
      { label: "Delivered, POD not back", v: POD_V, d: eur(POD_V), sub: POD_N + " deliveries", tone: "warn", onClick: () => go("Delivery", "Proof of Delivery") },
      { label: "Invoices stuck on a query", v: QUERY_TOTAL, d: eur(QUERY_TOTAL), sub: "5 invoices", tone: "warn", onClick: () => go("Finance", "Debtors") },
      { label: "Quarantine & returns stock", v: 88000, d: "€88,000", sub: "Claims to raise", onClick: () => go("Warehouse", "Exceptions") }
    ];
    const opsCash = UI.Card({ title: "How operations is holding cash", icon: "link", meta: "NOT INVOICED OR NOT COLLECTABLE YET", delay: 120 }, [
      UI.HBars(blockers, { tpl: "minmax(150px,1.3fr) 1.4fr 78px", colorValue: true }),
      UI.Sep(),
      UI.Label("One late PO, followed to the bank", { marginBottom: 10 }),
      UI.HChain([
        { k: "Supplier", t: "PO-8821 · 5 days late", d: "Atlas, now " + relLower(D(1)) + " 10:30", tone: "bad", onClick: () => ctx.open("po", "PO-8821") },
        { k: "Order", t: "SO-10482 · 3 lines short", d: "Murphy, " + eur(27640), tone: "warn", onClick: () => ctx.open("order", "SO-10482") },
        { k: "Decision", t: partial ? "Split approved" : "Split not approved", d: partial ? "15 lines on D14 today" : "Full order waits for Atlas", tone: partial ? "ok" : "warn", onClick: () => ctx.open("order", "SO-10482") },
        { k: "Invoice", t: partial ? "€25,772.60 on POD today" : "€0 today", d: partial ? "€1,867.40 follows " + relLower(D(1)) : "€27,640 slips a day", tone: partial ? "ok" : "warn" },
        { k: "Cash", t: "Due " + dm(D(partial ? 30 : 31)), d: "Murphy pay in 29 days on average", onClick: () => ctx.open("customer", "murphy") }
      ])
    ]);

    const cashCard = UI.Card({ title: "Cash position", icon: "euro", meta: "SAGE 200 · BANK FEED 07:30", delay: 160, onClick: () => go("Finance", "Cash") }, [
      UI.Facts([["Bank", eur(FN.bank)], ["Facility headroom", eurK(FAC_HEAD), null, eurK(FN.facilityUsed) + " of " + eurK(FN.facility) + " drawn"], ["Lowest balance", eurK(CASH.low.bal), CASH.low.bal < 200000 ? "warn" : null, CASH.low.n < 0 ? "Today · rises from here" : "On " + dm(D(CASH.low.n)) + ", next 6 weeks"]], 3),
      h("div", { style: { marginTop: 14 } }, UI.Lines(CASH.weeks.map((w) => w.label), [{ name: "Closing bank", values: CASH.weeks.map((w) => Math.round(w.close / 1000)), color: "var(--accent)", area: true }], { h: 70, min: 0, hline: 150, legend: false })),
      UI.Note("Dashed line: Niamh's €150,000 minimum balance. Payables due " + eurK(FN.payables) + ".", { marginTop: 8 })
    ]);

    const ageing = UI.Card({ title: "Receivables ageing", icon: "clock", meta: eur(FN.receivables), delay: 200, onClick: () => go("Finance", "Debtors") }, [
      UI.Split(FN.ageing.map((a, i) => ({ label: a[0], v: a[1], d: eurK(a[1]), color: ["var(--ok)", "var(--warn)", "var(--bad)", "var(--bad)"][i] }))),
      UI.Note("€16,620 of the €22,000 over 90 days sits in small accounts outside the top 12.", { marginTop: 10 })
    ]);

    const wc = UI.Card({ title: "Working capital release", icon: "bolt", meta: eur(sum(FN.wcRelease.map((r) => r[1]))), delay: 240 }, [
      UI.HBars(FN.wcRelease.map((r) => ({ label: r[0], v: r[1], d: eur(r[1]), onClick: () => go(WC_ROUTE[r[0]].go[0], WC_ROUTE[r[0]].go[1]) })), { tpl: "minmax(130px,1.2fr) 1.4fr 78px" }),
      h("div", { style: { marginTop: 10 } }, UI.Btn("Working capital", () => go("Finance", "Working Capital"), { sm: true }))
    ]);

    return UI.Page({
      kicker: "Finance · month to date", live: "SAGE 200 SYNCED 09:14",
      title: "Revenue is up. Cash is tied up in stock and slow payers.",
      sub: "The finance view of the same database operations runs on: what came in, what is owed, what is stuck, and which operational step is holding it.",
      actions: [UI.Btn("Credit control", () => go("Finance", "Credit Control"), { pri: true, icon: "shield" }), UI.Btn("Cash", () => go("Finance", "Cash"), { icon: "euro" })],
      children: [
        kpis,
        UI.Grid("minmax(0,1.45fr) minmax(0,1fr)", [todo, h("div", null, brief, gap(), cashCard)]),
        UI.Grid("minmax(0,1.45fr) minmax(0,1fr)", [opsCash, h("div", null, ageing, gap(), wc)])
      ]
    });
  }

  /* ================================================================ REVENUE */
  function revenue(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const mo = months(12);
    const cats = DB.categories.map((c) => Object.assign({}, c, { gp: Math.round(c.rev * c.gm / 100), g: CAT_GROWTH[c.id] || 0 })).sort((a, b) => b.rev - a.rev);
    const avg = (sum(REV11) * 1000 + FC_TOTAL) / 12;
    const risky = DB.atRiskToday.slice().sort((a, b) => b.value - a.value);
    const partial = ctx.done("so-partial");

    const trend = UI.Card({ title: "Monthly revenue and margin", icon: "spark", meta: "12 MONTHS · THIS MONTH IS FORECAST", delay: 60 }, [
      UI.Columns(REV11.map((v, i) => ({ l: mo[i], v, d: "€" + num(v) + "k" })).concat([{ l: mo[11], v: Math.round(FC_TOTAL / 1000), d: "Forecast €" + num(Math.round(FC_TOTAL / 1000)) + "k", hi: true }]), { h: 150, target: avg / 1000, targetLabel: "12-month average €" + (avg / 1e6).toFixed(2) + "m" }),
      h("div", { style: { marginTop: 16 } }, UI.Label("Gross margin %", { marginBottom: 6 })),
      UI.Lines(mo, [{ name: "Gross margin", values: GM12, color: "var(--accent)" }], { h: 70, min: 23.4, max: 25.6, hline: K.gmTarget, legend: false }),
      UI.Note("Revenue has held at €1.28m a month (€15.4m annualised) while margin has slid from 25.2% to 23.8% since " + mo[2] + ". Dashed line: 25.0% target.", { marginTop: 8 })
    ]);

    const forecast = UI.Card({ title: "Forecast to month end", icon: "clock", meta: "PULSE FORECAST · 09:20", delay: 100 }, [
      h("div", { style: { fontSize: 30, fontWeight: 500, letterSpacing: "-1px" } }, eur(FC_TOTAL)),
      h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 4 } }, eur(FC_TOTAL - 46280) + " if today's 7 at-risk orders slip"),
      h("div", { style: { marginTop: 12 } }, ...[
        ["Invoiced to date", FC.invoiced, null],
        ["On today's routes, invoiced on POD", FC.routes, () => go("Delivery", "Today")],
        ["Delivered, waiting on POD", FC.pod, () => go("Delivery", "Proof of Delivery")],
        ["Open orders due this month", FC.open, () => go("Orders", "Live Orders")]
      ].map((r, i) => UI.Row({ key: i, onClick: r[2] || undefined }, [h("span", { className: "pd-grow", style: { fontSize: 12.5, color: "var(--dim)" } }, r[0]), mono(eur(r[1]))]))),
      UI.Sep(),
      UI.Label("What moves it", { marginBottom: 4 }),
      ...risky.slice(0, 4).map((o) => UI.Row({ key: o.id, onClick: () => ctx.open("order", o.id) }, [
        UI.Risk(o.risk),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.custName(o.cust), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 6, fontSize: 11 } }, o.id)), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, o.id === "SO-10482" ? (partial ? "Split approved: €25,772.60 invoices today" : "Approve the split and €25,772.60 invoices today") : o.reason)),
        mono(eur(o.value))])),
      UI.Row({ onClick: () => go("Finance", "Credit Control") }, [UI.Badge("CREDIT", "bad", true), h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "9 orders on credit hold"), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, "Not in the forecast until released")), mono(eur(HELD_TOTAL))])
    ]);

    const catTable = UI.Card({ flush: true, title: "By category", meta: "MTD · MARGIN AGAINST CATEGORY TARGET · CLICK FOR PRODUCT PROFITABILITY", delay: 140 }, UI.Table({
      rows: cats, rowKey: (c) => c.id, onRow: () => go("Pricing & Margin", "Product Profitability"), rowTone: (c) => (c.gm < c.target - 2 ? "bad" : c.gm < c.target ? "warn" : null),
      cols: [
        { label: "Category", w: "minmax(170px,1.4fr)", ink: true, render: (c) => c.id },
        { label: "Revenue MTD", w: "110px", r: true, num: true, ink: true, render: (c) => eur(c.rev) },
        { label: "Share", w: "minmax(110px,1fr)", render: (c) => h("div", { className: "pd-split", style: { gap: 8 } }, UI.Bar(100 * c.rev / cats[0].rev, null, { w: 70 }), h("span", { className: "pd-mono", style: { fontSize: 11 } }, (100 * c.rev / K.revenueMTD).toFixed(1) + "%")) },
        { label: "vs last month", w: "96px", r: true, num: true, render: (c) => h("span", { style: { color: c.g < 0 ? "var(--bad)" : "var(--ok)" } }, (c.g > 0 ? "+" : "−") + Math.abs(c.g).toFixed(1) + "%") },
        { label: "Margin", w: "72px", r: true, num: true, render: (c) => h("span", { style: { color: c.gm < c.target - 2 ? "var(--bad)" : c.gm < c.target ? "var(--warn)" : "var(--body)" } }, c.gm.toFixed(1) + "%") },
        { label: "Target", w: "66px", r: true, num: true, render: (c) => c.target.toFixed(1) + "%" },
        { label: "Gross profit", w: "100px", r: true, num: true, render: (c) => eur(c.gp) },
        { label: "GP vs target", w: "100px", r: true, num: true, render: (c) => { const d = Math.round(c.rev * (c.gm - c.target) / 100); return h("span", { style: { color: d < 0 ? "var(--bad)" : "var(--ok)" } }, (d > 0 ? "+" : "") + eur(d)); } }
      ],
      foot: "Total " + eur(K.revenueMTD) + " · gross profit " + eur(GP_MTD) + " · " + K.gm + "%. Electrical and Industrial Consumables grew fastest and sit furthest below target."
    }));

    const wh = UI.Card({ title: "By warehouse", icon: "pin", meta: "MTD", delay: 180 }, [
      UI.Split(WH_REV.map((w, i) => ({ label: w[0], v: w[2], d: eurK(w[2]), color: i ? "var(--accent-hover)" : "var(--accent)" }))),
      h("div", { style: { marginTop: 12 } }, ...WH_REV.map((w) => UI.Row({ key: w[1], onClick: () => go("Warehouse", "Control Board") }, [
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.warehouses[w[1]].name), h("div", { className: "pd-meta", style: { marginTop: 2 } }, "GP " + eur(w[3]))),
        h("span", { className: "pd-mono", style: { fontSize: 12, color: w[3] / w[2] * 100 < K.gm ? "var(--warn)" : "var(--ok)" } }, (100 * w[3] / w[2]).toFixed(1) + "%")]))),
      UI.Note("Naas earns 2.1 points more: more hygiene, PPE and FM, less contract cable.", { marginTop: 8 })
    ]);

    const seg = UI.Card({ title: "By customer segment", icon: "user", meta: "REVENUE · MARGIN", delay: 220 },
      UI.HBars(SEGMENTS.map((s) => ({ label: s[0], v: s[1], d: eurK(s[1]) + " · " + (100 * s[2] / s[1]).toFixed(1) + "%", tone: 100 * s[2] / s[1] < 22 ? "warn" : null, onClick: () => go("Customers", "Accounts") })), { tpl: "minmax(150px,1.2fr) 1.3fr 110px" }));

    const heldBy = (am) => sum(DB.creditHolds.filter((o) => o.am === am).map((o) => o.value));
    const amTable = UI.Card({ flush: true, title: "By account manager", meta: "MTD · HELD ORDERS ARE REVENUE THEY CANNOT SHIP YET", delay: 260 }, UI.Table({
      rows: AMS, rowKey: (a) => a[0], onRow: () => go("Customers", "Accounts"),
      cols: [
        { label: "Account manager", w: "minmax(170px,1.3fr)", ink: true, render: (a) => a[0] === "GF" ? "House accounts · Gráinne Foley's desk" : DB.person(a[0]) },
        { label: "Accounts", w: "76px", r: true, num: true, render: (a) => a[4] },
        { label: "Revenue MTD", w: "110px", r: true, num: true, ink: true, render: (a) => eur(a[1]) },
        { label: "vs last month", w: "96px", r: true, num: true, render: (a) => h("span", { style: { color: "var(--ok)" } }, "+" + a[3].toFixed(1) + "%") },
        { label: "Gross profit", w: "100px", r: true, num: true, render: (a) => eur(a[2]) },
        { label: "Margin", w: "70px", r: true, num: true, render: (a) => h("span", { style: { color: 100 * a[2] / a[1] < 22 ? "var(--bad)" : 100 * a[2] / a[1] < K.gm ? "var(--warn)" : "var(--body)" } }, (100 * a[2] / a[1]).toFixed(1) + "%") },
        { label: "On credit hold", w: "110px", r: true, num: true, render: (a) => heldBy(a[0]) ? h("span", { style: { color: "var(--bad)" } }, eur(heldBy(a[0]))) : none() }
      ]
    }));

    return UI.Page({
      kicker: "Finance · revenue", title: "Revenue MTD " + K.revenueMTDLabel,
      sub: "Up 8.4% on the same period last month (" + eur(LAST_SAME) + "). Every split carries its margin, because revenue on its own is not the question.",
      actions: [UI.Btn("Where are we losing margin?", () => ctx.ask("Where are we losing margin?"), { icon: "spark" }), UI.Btn("Margin control", () => go("Pricing & Margin", "Margin Control"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Revenue MTD", value: K.revenueMTDLabel, sub: K.revenueDelta, subTone: "ok" },
          { label: "Gross profit MTD", value: eur(GP_MTD), sub: K.gm + "% margin · target " + K.gmTarget.toFixed(1) + "%", subTone: "warn" },
          { label: "Forecast month end", value: eur(FC_TOTAL), sub: "Invoiced plus today's routes and PODs", onClick: () => go("Delivery", "Today") },
          { label: "Monthly average", value: "€1.28m", sub: "€15.4m annualised" },
          { label: "Margin gap", value: eur(K.gapMonthly), sub: eur(K.gapAnnual) + " a year at 25.0%", tone: "warn", toneValue: true, onClick: () => go("Pricing & Margin", "Margin Control") }
        ]),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [trend, forecast]),
        catTable,
        gap(),
        UI.Grid("minmax(0,1fr) minmax(0,1.25fr)", [wh, seg]),
        UI.Grid("minmax(0,1.7fr) minmax(0,1fr)", [amTable,
          UI.AI({ who: "Margin Agent", conf: "MTD", text: "Growth is coming from the wrong places for margin. Electrical is up 15.8% at 21.9% and Industrial Consumables up 14.9% at 17.6%, both below target. National accounts grew 12.8% at 19.9%. The EuroFix and EuroCable cost increases are still sitting on old contract prices.",
            actions: [UI.Btn("Cost changes", () => go("Pricing & Margin", "Cost Changes"), { sm: true, pri: true }), UI.Btn("Price lists", () => go("Pricing & Margin", "Price Lists"), { sm: true })] })])
      ]
    });
  }

  /* ================================================================ DEBTORS */
  function debtors(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const rows = TOP.concat([TAIL]);
    const stage = ctx.st.finStage || "all";
    const STAGES = [["all", "All", OVD.length], ["Promised", "Promised", OVD.filter((i) => i.stage === "Promised").length], ["Query", "Query", OVD.filter((i) => i.stage === "Query").length], ["chase", "Chasing", OVD.filter((i) => /Reminder|broken/i.test(i.stage)).length]];
    const ovd = OVD.filter((i) => stage === "all" || (stage === "chase" ? /Reminder|broken/i.test(i.stage) : i.stage === stage)).slice().sort((a, b) => b.days - a.days);
    const selId = ctx.st.finInv && INV[ctx.st.finInv] ? ctx.st.finInv : "INV-28482";
    const inv = INV[selId];
    const c = DB.customer(inv.cust);
    const terms = termsDays(inv.cust);
    const over = inv.days - terms;
    const key = inv.key || "inv-" + inv.id;

    const ledger = UI.Card({ flush: true, title: "Customer ledger", meta: "TOP 12 ACCOUNTS + " + OTHER_ACCOUNTS + " OTHERS · CLICK A ROW FOR THE CUSTOMER", delay: 120 }, UI.Table({
      rows, rowKey: (r) => r.tail ? "tail" : r.cust, onRow: (r) => { if (!r.tail) ctx.open("customer", r.cust); },
      rowTone: (r) => (r.d90 > 0 ? "bad" : r.d60 > 0 ? "warn" : null),
      cols: [
        { label: "Customer", w: "minmax(180px,1.5fr)", ink: true, render: (r) => r.tail ? h("span", null, OTHER_ACCOUNTS + " other accounts", h("span", { className: "pd-faint", style: { marginLeft: 6 } }, "118 with a balance")) : L.cust(r.cust) },
        { label: "AM", w: "104px", render: (r) => r.tail ? h("span", { className: "pd-faint" }, "Mixed") : DB.person(DB.customer(r.cust).am) },
        { label: "Current", w: "84px", r: true, num: true, render: (r) => bucketCell(r.cur) },
        { label: "30 days", w: "80px", r: true, num: true, render: (r) => bucketCell(r.d30, "warn") },
        { label: "60 days", w: "80px", r: true, num: true, render: (r) => bucketCell(r.d60, "bad") },
        { label: "90+", w: "76px", r: true, num: true, render: (r) => bucketCell(r.d90, "bad") },
        { label: "Total", w: "86px", r: true, num: true, ink: true, render: (r) => eur(r.total) },
        { label: "Limit used", w: "124px", render: (r) => { if (r.tail) return null; const cu = DB.customer(r.cust), p = pctOf(r.total, cu.limit); return h("div", { className: "pd-split", style: { gap: 6 } }, UI.Bar(p, p > 80 ? "bad" : p > 60 ? "warn" : "ok", { w: 44 }), h("span", { className: "pd-mono", style: { fontSize: 11 } }, p + "% of " + eurK(cu.limit))); } },
        { label: "Days to pay", w: "112px", render: (r) => { if (r.tail) return null; const x = DX[r.cust], lst = x.dtp[x.dtp.length - 1], rising = lst - x.dtp[0] > 6; return h("div", { className: "pd-split", style: { gap: 6 } }, UI.Spark(x.dtp, rising ? "bad" : "info", 50, 18), h("span", { className: "pd-mono", style: { fontSize: 11, color: rising ? "var(--bad)" : "var(--body)" } }, lst + "d")); } },
        { label: "Last payment", w: "120px", render: (r) => r.tail ? null : h("span", null, rel(D(wdAgo(-DX[r.cust].last[0]))), h("span", { className: "pd-faint" }, " · " + eurK(DX[r.cust].last[1]))) },
        { label: "Payment promise", w: "minmax(190px,1.4fr)", render: (r) => { if (r.tail) return h("span", { className: "pd-dim" }, eur(TAIL.d90) + " of the 90+ sits here"); const x = DX[r.cust]; return x.promise ? h("span", { style: { color: x.tone ? PD.TONE[x.tone].fg : "var(--body)" }, title: x.promise }, x.promise) : none(); } }
      ],
      foot: "Ledger total " + eur(FN.receivables) + " · current " + eur(FN.ageing[0][1]) + " · 30 days " + eur(FN.ageing[1][1]) + " · 60 days " + eur(FN.ageing[2][1]) + " · 90+ " + eur(FN.ageing[3][1]) + ". The top 12 carry " + eur(TOPSUM.total) + " (" + pctOf(TOPSUM.total, FN.receivables) + "%). Days to pay is a 6-month trend."
    }));

    const ovdCard = UI.Card({ flush: true, title: "Overdue invoices, top 12 accounts", meta: eur(sum(OVD.map((i) => i.v))) + " · CLICK FOR THE TRAIL", delay: 160, right: UI.Tabs(STAGES.map((s) => [s[0], s[1] + " " + s[2]]), stage, (v) => ctx.set({ finStage: v })) }, UI.Table({
      rows: ovd, rowKey: (i) => i.id, onRow: (i) => ctx.set({ finInv: i.id }), sel: (i) => i.id === selId, rowTone: (i) => (i.days > 90 ? "bad" : null),
      cols: [
        { label: "Invoice", w: "92px", render: (i) => mono(i.id) },
        { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (i) => L.cust(i.cust) },
        { label: "Value", w: "82px", r: true, num: true, ink: true, render: (i) => eur(i.v) },
        { label: "Age", w: "66px", r: true, num: true, render: (i) => h("span", { style: { color: i.days > 60 ? "var(--bad)" : "var(--warn)" } }, i.days + "d") },
        { label: "Stage", w: "120px", render: (i) => UI.Badge(i.stage, STAGE_TONE[i.stage] || "neutral") },
        { label: "Where it stands", w: "minmax(220px,2fr)", render: (i) => h("span", { className: "pd-dim", title: i.note }, i.note) }
      ],
      empty: "No overdue invoices at this stage."
    }));

    const chain = [
      { k: "Order", t: (inv.so || "Sales order") + " · " + DB.custName(inv.cust), d: inv.id === "INV-28482" ? "Hansfield first fix, placed by Noel Doyle through Sarah Byrne" : c ? c.priceList : "Account order", icon: "doc", onClick: () => ctx.open("customer", inv.cust) },
      { k: "Delivery", t: "Delivered " + dm(D(biz(-inv.days - 1))), d: inv.pod || (inv.id === "INV-28712" ? "POD signed on the driver app but never attached to the invoice" : inv.id === "INV-28231" ? "Full delivery, POD signed by Gerry Mahon" : "POD signed and filed in Sage 200"), icon: "truck", tone: inv.id === "INV-28712" ? "warn" : null },
      { k: "Invoice", t: inv.id + " · " + eur(inv.v), d: "Raised " + dm(D(biz(-inv.days))) + " · " + terms + " days terms", icon: "euro" },
      { k: "Due", t: over > 0 ? "Overdue by " + over + " days" : "Due " + dm(D(terms - inv.days)), d: "Due date " + dm(D(terms - inv.days)), icon: "clock", tone: over > 30 ? "bad" : over > 0 ? "warn" : "ok" },
      { k: "Chasing", t: inv.stage, d: inv.note || "Statement goes out with the month-end run", icon: "phone", tone: STAGE_TONE[inv.stage] === "bad" ? "bad" : STAGE_TONE[inv.stage] === "warn" ? "warn" : null }
    ];
    const trail = UI.Card({ title: "Invoice trail · " + inv.id, icon: "link", meta: DB.custName(inv.cust).toUpperCase(), delay: 200 }, [
      UI.Chain(chain),
      inv.next ? UI.AI({ who: "Credit Agent", text: "Next step: " + inv.next.charAt(0).toLowerCase() + inv.next.slice(1) + ". " + (inv.stage === "Query" ? "This is an admin fix, not a collections problem: once it is cleared the invoice pays on the customer's next run." : "Rachel Hayes owns it."),
        actions: [UI.Btn(inv.next, () => ctx.act(key, inv.next, inv.done || inv.id + ": done."), { pri: true, sm: true, done: ctx.done(key), doneLabel: "Done" }), UI.Btn("Open customer", () => ctx.open("customer", inv.cust), { sm: true })] })
        : h("div", { style: { display: "flex", gap: 8 } }, UI.Btn("Open customer", () => ctx.open("customer", inv.cust), { sm: true }), UI.Btn("Credit control", () => go("Finance", "Credit Control"), { sm: true, ghost: true }))
    ]);

    const queries = OVD.filter((i) => i.stage === "Query");
    const stuck = UI.Card({ title: "Where the overdue is stuck", icon: "alert", meta: "TOP 12 · " + eur(sum(OVD.map((i) => i.v))), delay: 240 }, [
      UI.Split([
        { label: "Promised", v: byStage("Promised"), d: eurK(byStage("Promised")), color: "var(--accent)" },
        { label: "Query", v: QUERY_TOTAL, d: eurK(QUERY_TOTAL), color: "var(--warn)" },
        { label: "Reminders", v: byStage("Reminder 2") + byStage("Final reminder"), d: eurK(byStage("Reminder 2") + byStage("Final reminder")), color: "var(--dim)" },
        { label: "Promise broken", v: byStage("Promise broken"), d: eurK(byStage("Promise broken")), color: "var(--bad)" }
      ]),
      UI.Sep(),
      UI.Label("Queries operations can clear", { marginBottom: 2 }),
      ...queries.map((i) => UI.Row({ key: i.id, onClick: () => ctx.set({ finInv: i.id }) }, [
        mono(i.id, { fontSize: 11.5 }),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, DB.custName(i.cust)), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, i.next)),
        mono(eur(i.v)),
        UI.Btn("Fix", () => ctx.act("inv-" + i.id, i.next, i.done), { sm: true, done: ctx.done("inv-" + i.id), doneLabel: "Sent" })]))
    ]);

    return UI.Page({
      kicker: "Finance · debtors", title: "€318,000 owed, €124,000 of it overdue",
      sub: "Every account with its ageing, limit, payment habit and the last thing they promised. " + eur(QUERY_TOTAL) + " of the overdue is waiting on paperwork, not on cash.",
      actions: [UI.Btn("Credit control", () => go("Finance", "Credit Control"), { pri: true, icon: "shield" }), UI.Btn("Which accounts are over their credit limit?", () => ctx.ask("Which accounts are over their credit limit?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Receivables", value: eur(FN.receivables), sub: DB.company.accounts + " accounts" },
          { label: "Not yet due", value: eur(FN.ageing[0][1]), sub: pctOf(FN.ageing[0][1], FN.receivables) + "% of the ledger", subTone: "ok" },
          { label: "Overdue", value: eur(FN.overdue), sub: pctOf(FN.overdue, FN.receivables) + "% · up from €96k in 9 months", tone: "warn", subTone: "warn" },
          { label: "Over 60 days", value: eur(FN.ageing[2][1] + FN.ageing[3][1]), sub: eur(FN.ageing[3][1]) + " over 90", tone: "bad" },
          { label: "Stuck on a query", value: eur(QUERY_TOTAL), sub: "5 invoices · admin, not cash", tone: "warn" },
          { label: "Collectable in 14 days", value: eur(CALLS_TOTAL), sub: "Today's call list", subTone: "ok", onClick: () => go("Finance", "Credit Control") }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1fr) minmax(0,1fr) minmax(0,1.15fr)", [
          UI.Card({ title: "Ageing", icon: "clock", meta: eur(FN.receivables), delay: 40 }, UI.Columns(FN.ageing.map((a, i) => ({ l: a[0], v: a[1], d: eurK(a[1]), tone: i === 0 ? null : i === 1 ? "warn" : "bad" })), { h: 150, showValues: true })),
          UI.Card({ title: "Overdue, last 9 months", icon: "spark", meta: "€K", delay: 70 }, [
            UI.Lines(months(9), [{ name: "Overdue", values: [96, 101, 104, 109, 112, 118, 121, 122, 124], color: "var(--bad)", area: true }], { h: 120, min: 90, max: 128, legend: false }),
            UI.Note("Up €28,000 while revenue grew 8.4%. Customers are taking longer, not buying less.", { marginTop: 8 })]),
          UI.AI({ who: "Credit Agent", conf: "LEDGER READ 09:14", text: [
            "The top 12 accounts carry ", B(pctOf(TOPSUM.total, FN.receivables) + "% of the ledger"), " but only ", B(eur(TOPSUM.d90)), " of the 90+. ", B(eur(TAIL.d90)), " sits in small accounts that have gone quiet. On the big accounts, the pattern is days to pay drifting: ", L.cust("doyle"), " 41 → 58, ", L.cust("dunmore"), " 42 → 64, ", L.cust("southside"), " 38 → 63. And ", B(eur(QUERY_TOTAL)), " is waiting on a missing PO number, a store code, a POD copy and a dispute that is already resolved."],
            actions: [UI.Btn("Today's call list", () => go("Finance", "Credit Control"), { pri: true, sm: true }), UI.Btn("PODs", () => go("Delivery", "Proof of Delivery"), { sm: true })] })
        ]),
        ledger,
        gap(),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [ovdCard, trail]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [stuck,
          UI.Card({ title: "Delivered, not invoiced yet", icon: "truck", meta: POD_N + " DELIVERIES · " + eur(POD_V), delay: 280, right: UI.Btn("PODs", () => go("Delivery", "Proof of Delivery"), { sm: true, ghost: true }) }, [
            ...POD_WAIT.map((p) => UI.Row({ key: p.so }, [
              h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, custOr(ctx, p.cust), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 6, fontSize: 11 } }, p.so)), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, p.why)),
              h("span", { className: "pd-meta" }, PD.lk(ctx).route(p.route), " · " + rel(D(wdAgo(-p.day)))),
              mono(eur(p.v))])),
            UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 12, color: "var(--dim)" } }, POD_OTHER.n + " more deliveries across 4 routes"), mono(eur(POD_OTHER.v))]),
            UI.Note("No POD, no invoice. These are delivered, costed and on the customer's site; they cannot be billed until the POD is back.", { marginTop: 8 })])
        ])
      ]
    });
  }

  /* ================================================================ CREDIT CONTROL */
  function creditControl(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const released = ctx.done("dq-doyle");
    const doyleInv = DB.invoices.filter((i) => i.cust === "doyle").slice().sort((a, b) => b.days - a.days);

    const doyle = UI.Card({ alert: "bad", title: "Doyle Construction · SO-10503", icon: "shield", meta: "SARAH BYRNE · HANSFIELD, DUBLIN 15", delay: 40, right: released ? UI.Badge("PART RELEASED", "ok", true) : UI.Badge("CREDIT LIMIT EXCEEDED", "bad", true) }, [
      UI.Facts([["Credit limit", eur(DOYLE.limit)], ["Current balance", eur(DOYLE.bal), null, eur(DOYLE_OVERDUE) + " overdue"], ["New order", eur(DOYLE.order), null, "SO-10503 · due " + relLower(D(1))], ["Projected exposure", eur(DOYLE.exposure), "bad", eur(DOYLE.over) + " over limit"], ["Available credit", eur(DOYLE.avail), "ok", "Release this much now"]], 5),
      h("div", { style: { marginTop: 16 } }, ExposureBar([
        { label: "Not yet due", v: DOYLE.bal - DOYLE_OVERDUE, color: "var(--dim)", op: .45 },
        { label: "Overdue", v: DOYLE_OVERDUE, color: "var(--bad)" },
        { label: "Release now", v: DOYLE.release, color: "var(--accent)" },
        { label: "Held until paid", v: DOYLE.over, color: "var(--warn)" }
      ], DOYLE.limit)),
      UI.Sep(),
      h("div", { className: "pd-grid", style: { gridTemplateColumns: "minmax(0,1fr) minmax(0,1.5fr)", marginBottom: 0 } },
        h("div", null, UI.Label("Invoices", { marginBottom: 4 }), ...doyleInv.map((i) => UI.Row({ key: i.id, onClick: () => { ctx.set({ finInv: i.id }); go("Finance", "Debtors"); } }, [
          mono(i.id, { fontSize: 11.5 }),
          h("span", { className: "pd-grow", style: { fontSize: 12, color: i.status === "Overdue" ? "var(--bad)" : "var(--dim)" } }, i.days + " days"),
          mono(eur(i.value))]))),
        h("div", null, UI.Label("SO-10503 split: first fix now, second fix on payment", { marginBottom: 4 }), UI.Table({
          rows: DOYLE_LINES, rowKey: (l) => l[0], onRow: (l) => DB.product(l[0]) ? ctx.open("product", l[0]) : null, rowTone: (l) => (l[5] ? null : "warn"),
          cols: [
            { label: "SKU", w: "76px", render: (l) => L.sku(l[0]) },
            { label: "Product", w: "minmax(140px,1.6fr)", render: (l) => l[1] },
            { label: "Qty", w: "44px", r: true, num: true, render: (l) => l[2] },
            { label: "Value", w: "82px", r: true, num: true, ink: true, render: (l) => eur(l[2] * l[3], 2) },
            { label: "", w: "92px", render: (l) => l[5] ? UI.Badge(released ? "Released" : "Release now", released ? "ok" : "info") : UI.Badge("Held", "warn") }
          ]
        })))
    ]);

    const rec = UI.AI({ who: "Credit Agent · recommendation", conf: "DECISION: PATRICK BYRNE · DUE 10:00",
      text: "Release €7,320 of the order against available credit and request payment against overdue invoice INV-28482 before releasing the balance.",
      note: "The €7,320 is the first-fix material Hansfield needs tomorrow. Consumer units, trunking and battens are second fix and not needed on site until next week. Paying INV-28482 (" + eur(11860) + ") brings the balance to " + eur(DOYLE.bal - 11860) + ", so the held " + eur(DOYLE.over) + " then fits inside the limit with no override.",
      actions: [
        UI.Btn("Approve recommendation", () => ctx.act("dq-doyle", HOLD_REC["SO-10503"][3], HOLD_REC["SO-10503"][4]), { pri: true, sm: true, done: released, doneLabel: "Approved · €7,320 released" }),
        UI.Btn("Hold order", () => ctx.act("cc-doyle-hold", "Order held", "SO-10503 stays on hold in full. Sarah Byrne and the Hansfield site told it ships when INV-28482 is paid."), { sm: true, icon: "shield", done: ctx.done("cc-doyle-hold"), doneLabel: "Held" }),
        UI.Btn("Override", () => ctx.act("cc-doyle-override", "Override requested", "Full €16,240 release needs Patrick Byrne's sign-off: €8,920 over limit on an At risk account. Request sent with the Credit Agent's notes."), { sm: true, done: ctx.done("cc-doyle-override"), doneLabel: "Override requested" }),
        UI.Btn("Request payment", () => ctx.act("cc-doyle-pay", "Payment request sent", "Statement and INV-28482 copy sent to Sinéad Carey from Rachel Hayes' Outlook: €8,920 of SO-10503 releases on payment."), { sm: true, icon: "mail", done: ctx.done("cc-doyle-pay"), doneLabel: "Payment requested" }),
        UI.Btn("Contact account manager", () => ctx.act("cc-doyle-am", "Sarah Byrne briefed", "Sarah Byrne has the position, the split and the call script for Noel Doyle in Outlook."), { sm: true, icon: "user", done: ctx.done("cc-doyle-am"), doneLabel: "Sarah briefed" })
      ] });

    const told = [
      ["SB", "Account manager", "Pulse alert and Outlook at 08:42: order held, what Doyle need to pay, the split on offer", "Told", "ok"],
      ["GF", "Customer service", "Banner on the account: when Doyle ring, calls about SO-10503 go to Rachel Hayes", "Live", "ok"],
      ["LM", "Warehouse, Dublin", released ? "5 first-fix lines in the 13:00 pick wave. The 4 held lines stay out" : "SO-10503 kept out of the pick queue. Nobody picks an order that cannot ship", released ? "Picking" : "Blocked", released ? "info" : "ok"],
      ["CW", "Transport planner", released ? "Hansfield on tomorrow's D14 first run, 07:40" : "Not routed. A slot on tomorrow's D14 is held until the 16:00 plan", released ? "Routed" : "Slot held", released ? "info" : "ok"],
      ["NC", "Financial controller", "In the approvals queue with the Credit Agent's notes", "Queued", "ok"],
      [null, "Noel Doyle, customer", ctx.done("cc-doyle-am") ? "Sarah Byrne calls with the split before 11:00" : "Not told yet. Sarah is the right person to call", ctx.done("cc-doyle-am") ? "Sarah calling" : "Not told", ctx.done("cc-doyle-am") ? "ok" : "warn"]
    ];
    const whoKnows = UI.Card({ title: "Who knew the moment it was held", icon: "bolt", meta: "CREDIT AGENT HELD IT AT 08:42", delay: 80 },
      told.map((t, i) => UI.Row({ key: i }, [
        UI.Avatar(t[0] || "ND", t[0] === "SB" ? "accent" : null),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, t[0] ? DB.person(t[0]) : "", h("span", { className: "pd-faint", style: { marginLeft: t[0] ? 6 : 0, fontSize: 11.5 } }, t[1])), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2, lineHeight: 1.45 } }, t[2])),
        UI.Badge(t[3], t[4])])));

    const flow = UI.Card({ title: "What happens when you release", icon: "route", meta: released ? "RELEASED · FOLLOWING IT THROUGH" : "NOTHING MOVES UNTIL A PERSON APPROVES", delay: 120 }, UI.HChain([
      { k: "Credit decision", t: released ? "Part release approved" : "Waiting on Patrick", d: "Logged against SO-10503 with the reason", tone: released ? "ok" : "warn" },
      { k: "Sage 200", t: "SO-10503 split", d: eur(DOYLE.release) + " released · " + eur(DOYLE.over) + " as SO-10503-B on hold", tone: released ? "ok" : null, onClick: () => ctx.open("order", "SO-10503") },
      { k: "Warehouse", t: "Dublin, 13:00 wave", d: "5 lines, 560 units · Liam Murphy's team", tone: released ? "info" : null, onClick: () => go("Warehouse", "Picking") },
      { k: "Dispatch", t: "D14, tomorrow 07:05", d: "Hansfield drop 07:40 · James Nolan", tone: released ? "info" : null, onClick: () => ctx.open("route", "D14") },
      { k: "POD", t: "Signed on site", d: "Driver app to Sage 200", onClick: () => go("Delivery", "Proof of Delivery") },
      { k: "Invoice", t: eur(DOYLE.release) + " on POD", d: "30 days · balance sits at the €50,000 limit" },
      { k: "The balance", t: eur(DOYLE.over) + " releases", d: "Automatically, when INV-28482 lands in the bank", tone: "warn", onClick: () => { ctx.set({ finInv: "INV-28482" }); go("Finance", "Debtors"); } }
    ]));

    const holds = UI.Card({ flush: true, title: "All " + DB.creditHolds.length + " held orders", meta: eur(HELD_TOTAL) + " HELD · NONE OF IT PICKED · CLICK FOR THE ORDER", delay: 160 }, UI.Table({
      rows: DB.creditHolds.slice().sort((a, b) => b.value - a.value), rowKey: (o) => o.id, onRow: (o) => ctx.open("order", o.id), rowTone: (o) => (o.risk === "HIGH" ? "bad" : null),
      cols: [
        { label: "Order", w: "92px", render: (o) => mono(o.id) },
        { label: "Customer", w: "minmax(170px,1.3fr)", ink: true, render: (o) => L.cust(o.cust) },
        { label: "AM", w: "100px", render: (o) => DB.person(o.am) },
        { label: "Value", w: "84px", r: true, num: true, ink: true, render: (o) => eur(o.value) },
        { label: "Required", w: "90px", render: (o) => rel(D(o.req)) },
        { label: "Why it is held", w: "minmax(200px,1.6fr)", render: (o) => h("span", { className: "pd-dim", title: o.reasonDetail }, o.reasonDetail) },
        { label: "Credit Agent suggests", w: "minmax(220px,1.8fr)", render: (o) => h("span", { style: { color: "var(--ink)" }, title: (HOLD_REC[o.id] || [""])[0] }, (HOLD_REC[o.id] || ["Review"])[0]) },
        { label: "", w: "150px", render: (o) => { const r = HOLD_REC[o.id]; return r ? UI.Btn(r[1], () => ctx.act(r[2], r[3], r[4]), { sm: true, pri: o.id === "SO-10503" && !ctx.done(r[2]), done: ctx.done(r[2]), doneLabel: "Done" }) : null; } }
      ],
      foot: "Release authority: Rachel Hayes up to €5,000 over limit, Niamh Clarke up to €10,000, Patrick Byrne above that or on any account marked At risk."
    }));

    const calls = UI.Card({ title: "Collection priorities for today", icon: "phone", meta: "CREDIT AGENT · " + CALLS.length + " CALLS · " + eur(CALLS_TOTAL), delay: 200 }, [
      ...CALLS.map((c, i) => h("div", { key: c.cust, className: "pd-row", style: { alignItems: "flex-start" } },
        h("span", { className: "pd-mono", style: { width: 16, color: "var(--accent-text)", fontSize: 12, paddingTop: 2 } }, String(i + 1)),
        h("div", { className: "pd-grow" },
          h("div", { className: "pd-split", style: { gap: 8 } }, h("span", { style: { fontSize: 13, fontWeight: 500 } }, custOr(ctx, c.cust)), h("span", { className: "pd-meta" }, c.what)),
          h("div", { style: { fontSize: 12, color: "var(--body)", marginTop: 3, lineHeight: 1.5 } }, c.why),
          h("div", { className: "pd-meta", style: { marginTop: 4 } }, c.who.toUpperCase(), c.order ? h("span", null, " · RELEASES ", PD.lk(ctx).order(c.order)) : null)),
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" } }, mono(eur(c.amt), { fontSize: 12.5 }),
          UI.Btn(c.btn, () => ctx.act(c.key, c.btn, c.done), { sm: true, done: ctx.done(c.key), doneLabel: "Done" })))),
      UI.Note("Paid in full, these calls release " + eur(CALLS_UNLOCK) + " of held orders and are the " + eur(CALLS_TOTAL) + " collections line in working capital.", { marginTop: 8 })
    ]);

    const promises = UI.Card({ flush: true, title: "Payment promises · Rachel Hayes' call log", meta: PROM_OPEN.length + " OPEN · " + eur(sum(PROM_OPEN.map((p) => p.v))) + " · 29 OF 38 KEPT THIS MONTH", delay: 240 }, UI.Table({
      rows: PROMISES, rowKey: (p) => p.cust + p.when, onRow: (p) => (DB.customer(p.cust) ? ctx.open("customer", p.cust) : null), rowTone: (p) => (p.st === "Broken" ? "bad" : null),
      cols: [
        { label: "Logged", w: "110px", render: (p) => h("span", { className: "pd-dim" }, rel(D(wdAgo(-p.when))) + " " + p.t) },
        { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (p) => custOr(ctx, p.cust) },
        { label: "Spoke to", w: "110px", render: (p) => p.who },
        { label: "For", w: "104px", render: (p) => /^INV-/.test(p.inv) ? invLink(ctx, p.inv) : h("span", { className: "pd-dim" }, p.inv) },
        { label: "Amount", w: "82px", r: true, num: true, ink: true, render: (p) => eur(p.v) },
        { label: "Promise", w: "minmax(150px,1.2fr)", render: (p) => p.what },
        { label: "Due", w: "92px", render: (p) => whenLabel(p.due) },
        { label: "Status", w: "78px", render: (p) => UI.Badge(p.st, p.st === "Kept" ? "ok" : p.st === "Broken" ? "bad" : "info") }
      ]
    }));

    const watch = DB.customers.map((c) => {
      const open = sum(DB.orders.filter((o) => o.cust === c.id && !o.hold).map((o) => o.value));
      const held = sum(DB.orders.filter((o) => o.cust === c.id && o.hold).map((o) => o.value));
      return { c, open, held, exp: c.out + open + held };
    }).sort((a, b) => b.exp / b.c.limit - a.exp / a.c.limit).slice(0, 7);

    const risk = UI.Card({ flush: true, title: "High-risk accounts", meta: "CREDIT AGENT SCORE · PAYMENT BEHAVIOUR, ORDERS, INSURER", delay: 280 }, UI.Table({
      rows: RISK, rowKey: (r) => r.cust, onRow: (r) => (DB.customer(r.cust) ? ctx.open("customer", r.cust) : null), rowTone: (r) => (r.score >= 70 ? "bad" : r.score >= 55 ? "warn" : null),
      cols: [
        { label: "Score", w: "70px", render: (r) => h("div", { className: "pd-split", style: { gap: 6 } }, mono(String(r.score), { color: r.score >= 70 ? "var(--bad)" : r.score >= 55 ? "var(--warn)" : "var(--body)" }), UI.Bar(r.score, r.score >= 70 ? "bad" : "warn", { w: 24, h: 4 })) },
        { label: "Account", w: "minmax(160px,1.1fr)", ink: true, render: (r) => custOr(ctx, r.cust) },
        { label: "Balance", w: "112px", r: true, num: true, render: (r) => h("span", null, eurK(r.bal), h("span", { className: "pd-faint" }, " / " + eurK(r.limit))) },
        { label: "Signals", w: "minmax(260px,2.4fr)", render: (r) => h("span", { className: "pd-dim", title: r.signals }, r.signals) },
        { label: "", w: "190px", render: (r) => r.key ? UI.Btn(r.act, () => ctx.act(r.key, r.act, r.done), { sm: true, done: ctx.done(r.key), doneLabel: "Done" }) : UI.Btn(r.act, () => go("Finance", "Credit Control"), { sm: true, ghost: true }) }
      ]
    }));

    const watchCard = UI.Card({ title: "Exposure against limit", icon: "alert", meta: "BALANCE + OPEN ORDERS + HELD", delay: 320 }, [
      UI.HBars(watch.map((w) => ({ label: w.c.name, v: 100 * w.exp / w.c.limit, d: pctOf(w.exp, w.c.limit) + "% · " + eurK(w.exp), tone: w.exp > w.c.limit ? "bad" : w.exp / w.c.limit > .8 ? "warn" : null, onClick: () => ctx.open("customer", w.c.id) })), { max: 120, tpl: "minmax(130px,1.2fr) 1.2fr 104px", colorValue: true }),
      UI.Note("Counts orders not yet invoiced, so an account shows up before it hits the limit, not after the order has been picked.", { marginTop: 8 })
    ]);

    return UI.Page({
      kicker: "Finance · credit control", live: "HOLDS SYNC TO SALES, WMS AND TRANSPORT",
      title: "Credit decisions that reach the warehouse",
      sub: "A hold stops the pick, tells the account manager and keeps a delivery slot open. A release flows straight to the pick queue and the route. Nobody picks an order that cannot ship.",
      actions: [UI.Btn("Which accounts are over their credit limit?", () => ctx.ask("Which accounts are over their credit limit?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Orders on credit hold", value: String(DB.creditHolds.length), sub: eur(HELD_TOTAL) + " held", tone: "bad" },
          { label: "Over limit", value: "3 accounts", sub: "Doyle, Kildare Mechanical, Swords", tone: "bad" },
          { label: "Promises open", value: String(PROM_OPEN.length), sub: eur(sum(PROM_OPEN.map((p) => p.v))) + " promised" },
          { label: "Promises broken", value: String(PROM_BROKEN.length), sub: eur(sum(PROM_BROKEN.map((p) => p.v))) + " · Portmarnock, Southside, Carlow", tone: "warn" },
          { label: "Today's calls", value: eur(CALLS_TOTAL), sub: CALLS.length + " accounts · releases " + eurK(CALLS_UNLOCK), subTone: "ok" },
          { label: "Promise kept rate", value: "76%", sub: "29 of 38 this month" }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [doyle, h("div", null, rec, gap(), whoKnows)]),
        flow,
        gap(),
        holds,
        gap(),
        UI.Grid("minmax(0,1fr) minmax(0,1.25fr)", [calls, promises]),
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [risk, watchCard])
      ]
    });
  }

  /* ================================================================ CASH */
  function cash(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const W = CASH.weeks, low = CASH.low;
    const net = CASH.rec - CASH.out;
    const fri = CASH.first("weekly"), ef = CASH.first("eurofix"), at = CASH.first("atlas"), gb = CASH.first("gbp");

    const chart = UI.Card({ title: "Receipts against payments, next 6 weeks", icon: "euro", meta: "WEEKS FROM TODAY", delay: 60 }, [
      Paired(W.map((w) => ({ l: w.label, a: w.rec, b: w.out, hot: w.net < -60000 })), 170),
      legend([["Receipts", "var(--accent)"], ["Payments", "var(--dim)", .42], ["Payments beat receipts by €60k+", "var(--warn)"]]),
      UI.Sep(),
      UI.Label("Closing bank balance, €k", { marginBottom: 6 }),
      UI.Lines(W.map((w) => w.label), [{ name: "Bank", values: W.map((w) => Math.round(w.close / 1000)), color: "var(--accent)", area: true }], { h: 90, min: 0, hline: 150, legend: false }),
      UI.Note("Receipts bunch at month end: most trade accounts pay on their own month-end run. Dashed line: €150,000 minimum balance.", { marginTop: 8 })
    ]);

    const trapped = UI.Card({ title: "Where cash is trapped", icon: "alert", meta: "CLICK THROUGH TO WHAT HOLDS IT", delay: 100 }, [
      UI.HBars([
        { label: "Stock over 120 days", v: FN.inventoryOver120, d: OVER120, tone: "bad", onClick: () => go("Inventory", "Slow & Dead Stock") },
        { label: "Overdue receivables", v: FN.overdue, d: eurK(FN.overdue), tone: "warn", onClick: () => go("Finance", "Debtors") },
        { label: "Quarantine & returns stock", v: 88000, d: "€88k", onClick: () => go("Warehouse", "Exceptions") },
        { label: "Orders late on PO-8821", v: 41880, d: eurK(41880), tone: "warn", onClick: () => ctx.open("po", "PO-8821") },
        { label: "Orders on credit hold", v: HELD_TOTAL, d: eurK(HELD_TOTAL), tone: "bad", onClick: () => go("Finance", "Credit Control") },
        { label: "Delivered, no POD", v: POD_V, d: eurK(POD_V), tone: "warn", onClick: () => go("Delivery", "Proof of Delivery") },
        { label: "Paid before due date", v: EARLY_PAY, d: eurK(EARLY_PAY), onClick: () => go("Purchasing", "Suppliers") }
      ], { tpl: "minmax(150px,1.3fr) 1.2fr 58px", colorValue: true }),
      h("div", { style: { marginTop: 12 } }, UI.Btn("Working capital", () => go("Finance", "Working Capital"), { sm: true }), " ", UI.Btn("Where is our working capital trapped?", () => ctx.ask("Where is our working capital trapped?"), { sm: true, ghost: true, icon: "spark" }))
    ]);

    const table = UI.Card({ flush: true, title: "Six-week cash forecast", meta: "OPENING BANK " + eur(FN.bank) + " · RECEIPTS FROM THE LEDGER AND PAYMENT HABITS", delay: 140 }, UI.Table({
      rows: W, rowKey: (w) => "w" + w.i, sel: (w) => w.i === low.i, rowTone: (w) => (w.net < -60000 ? "warn" : null),
      cols: [
        { label: "Week from", w: "minmax(110px,1fr)", ink: true, render: (w) => w.i === 0 ? "Today · " + w.label : rel(D(w.from)) },
        { label: "Receipts", w: "100px", r: true, num: true, render: (w) => h("span", { style: { color: "var(--ok)" } }, eur(w.rec)) },
        { label: "Suppliers", w: "100px", r: true, num: true, render: (w) => eur(w.sup) },
        { label: "Wages & salaries", w: "120px", r: true, num: true, render: (w) => eur(w.pay) },
        { label: "Revenue (tax)", w: "110px", r: true, num: true, render: (w) => (w.tax ? eur(w.tax) : none()) },
        { label: "Overheads", w: "96px", r: true, num: true, render: (w) => eur(w.ovh) },
        { label: "Net", w: "100px", r: true, num: true, ink: true, render: (w) => h("span", { style: { color: w.net < 0 ? "var(--bad)" : "var(--ok)" } }, (w.net > 0 ? "+" : "") + eur(w.net)) },
        { label: "Closing bank", w: "110px", r: true, num: true, ink: true, render: (w) => eur(w.close) }
      ],
      foot: "Six weeks: receipts " + eur(CASH.rec) + ", payments " + eur(CASH.out) + ", net " + (net > 0 ? "+" : "") + eur(net) + ". Lowest end-of-day balance " + eur(low.bal) + (low.n < 0 ? ", today" : " on " + dm(D(low.n))) + ". Facility headroom " + eur(FAC_HEAD) + " on top."
    }));

    const runs = [
      fri ? { when: fri.n, name: "Weekly SEPA run", sup: null, who: "31 suppliers: Hartmann, Kerry, EuroCable, Celtic and 27 more", terms: "Due within 7 days", ccy: "EUR", v: fri.v, note: eur(EARLY_PAY) + " of it is not due until next week", btn: "Pay to due date", key: "fin-payterms", done: eur(EARLY_PAY) + " moved to next week's run. Niamh Clarke approves the rest." } : null,
      ef ? { when: ef.n, name: "EuroFix GmbH", sup: "eurofix", terms: "45 days", ccy: "EUR", v: ef.v, note: "They raised FIX-2201 by 10.4% this month. Ask for 60 days alongside it", btn: "Ask for 60 days", key: "fin-eurofix-terms", done: "Emma Walsh to ask Katrin Vogel for 60 days as part of accepting the September increase." } : null,
      at ? { when: at.n, name: "Atlas Industrial Supplies", sup: "atlas", terms: "60 days", ccy: "EUR", v: at.v, note: "Hold " + eur(ATLAS_CLAIMS) + " of open claims: 3 mis-pack and defect RMAs, a short-ship on PO-8807", btn: "Hold claims", key: "fin-atlas-claims", done: eur(ATLAS_CLAIMS) + " deducted from the Atlas run with a debit note. Declan Moore told by Emma Walsh." } : null,
      gb ? { when: gb.n, name: "Sterling run", sup: null, who: "Northgate, SafePro, Midland Abrasives", terms: "30 days", ccy: "GBP", v: gb.v, note: "£" + num(Math.round(gb.v * GBP)) + " at " + GBP.toFixed(4), btn: "Book forward", key: "fin-fx", done: "Niamh Clarke to book £" + num(Math.round(GBP_INV * GBP)) + " forward with the bank for the month-end sterling run." } : null
    ].filter(Boolean).sort((a, b) => a.when - b.when);
    const runsCard = UI.Card({ flush: true, title: "Supplier payment runs", meta: "PAYABLES " + eur(FN.payables) + " · APPROVER NIAMH CLARKE", delay: 180 }, UI.Table({
      rows: runs, rowKey: (r) => r.name, onRow: (r) => (r.sup ? ctx.open("supplier", r.sup) : go("Purchasing", "Suppliers")),
      cols: [
        { label: "Pay date", w: "96px", ink: true, render: (r) => whenLabel(r.when) },
        { label: "Run", w: "minmax(170px,1.3fr)", render: (r) => h("div", null, r.sup ? L.sup(r.sup) : h("span", { style: { color: "var(--ink)" } }, r.name), r.who ? h("div", { className: "pd-faint pd-ell", style: { fontSize: 11 } }, r.who) : null) },
        { label: "Terms", w: "92px", render: (r) => r.terms },
        { label: "Amount", w: "92px", r: true, num: true, ink: true, render: (r) => h("span", null, eur(r.v), r.ccy === "GBP" ? h("span", { className: "pd-faint" }, " GBP") : null) },
        { label: "Pulse notes", w: "minmax(210px,1.8fr)", render: (r) => h("span", { className: "pd-dim", title: r.note }, r.note) },
        { label: "", w: "140px", render: (r) => UI.Btn(r.btn, () => ctx.act(r.key, r.btn, r.done), { sm: true, done: ctx.done(r.key), doneLabel: "Done" }) }
      ],
      foot: "Owed to suppliers: " + PAYABLES.slice(0, 4).map((p) => DB.supplier(p[0]).name.split(" ")[0] + " " + eurK(p[1])).join(" · ") + " · " + (PAYABLES.length - 4) + " more named suppliers " + eurK(sum(PAYABLES.slice(4).map((p) => p[1]))) + " · 53 others " + eurK(PAY_OTHER) + "."
    }));

    const stat = UI.Card({ title: "VAT, payroll and Revenue dates", icon: "clock", meta: "ROS · SAGE PAYROLL", delay: 220 },
      STAT.map((s, i) => UI.Row({ key: i }, [
        h("div", { style: { width: 58, flex: "none" } }, h("div", { className: "pd-mono", style: { fontSize: 12, color: s[1] <= 7 ? "var(--ink)" : "var(--body)" } }, whenLabel(s[1]).replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) /, "")), h("div", { className: "pd-meta", style: { marginTop: 2 } }, s[1] === 0 ? "TODAY" : "IN " + s[1] + " DAYS")),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, s[0]), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, s[3])),
        mono(eur(s[2]), { color: s[1] < 42 ? "var(--ink)" : "var(--faint)" })])).concat([UI.Note("Amounts from the last return and payroll run. Anything beyond 6 weeks is shown faint and not in the forecast.", { marginTop: 8 })]));

    const fx = UI.Card({ title: "Sterling exposure", icon: "swap", meta: "BOOKED RATE " + GBP.toFixed(4) + " £ PER €", delay: 260 }, [
      UI.Facts([["Invoiced, unpaid", eur(GBP_INV), null, "£" + num(Math.round(GBP_INV * GBP))], ["On open POs", eur(GBP_PO_V), null, GBP_POS.length + " POs"], ["Total", eur(GBP_INV + GBP_PO_V), "warn", "1% move = " + eur(Math.round((GBP_INV + GBP_PO_V) / 100))]], 3),
      h("div", { style: { marginTop: 10 } }, ...GBP_POS.map((p) => UI.Row({ key: p.id, onClick: () => ctx.open("po", p.id) }, [mono(p.id, { fontSize: 11.5 }), h("span", { className: "pd-grow", style: { fontSize: 12, color: "var(--dim)" } }, DB.supplier(p.supplier).name + " · " + p.status), mono(eur(p.value))]))),
      UI.AI({ who: "Purchasing Agent", style: { marginTop: 12 }, text: "Book £" + num(Math.round(GBP_INV * GBP)) + " forward for the month-end sterling run, so Northgate, SafePro and Midland cost what the margin was priced on. Pulse does not deal: Niamh books it with the bank.",
        actions: [UI.Btn("Book forward", () => ctx.act("fin-fx", "Forward requested", "Niamh Clarke to book £" + num(Math.round(GBP_INV * GBP)) + " forward with the bank for the month-end sterling run."), { sm: true, pri: true, done: ctx.done("fin-fx"), doneLabel: "Requested" })] })
    ]);

    const bigs = CASH.big.slice(0, 3);
    const joined = bigs.length > 1 ? bigs.slice(0, -1).join(", ") + " and " + bigs[bigs.length - 1] : bigs[0];
    const why = low.n < 0 ? " Cash does not drop below today's balance in the next six weeks." : " The pinch is " + whenLabel(low.n).toLowerCase().replace(/^(mon|tue|wed|thu|fri) /, (m) => m.charAt(0).toUpperCase() + m.slice(1)) + " at " + eur(low.bal) + (bigs.length ? ", when " + joined + (bigs.length > 1 ? " go out." : " goes out.") : ".");
    return UI.Page({
      kicker: "Finance · cash", live: "BANK FEED 07:30 · SAGE 200 09:14",
      title: "Bank " + eur(FN.bank) + ", facility headroom " + eurK(FAC_HEAD),
      sub: "Six weeks of receipts and payments from the ledger, the payment runs and the Revenue calendar, and the operational reasons cash is not arriving faster.",
      actions: [UI.Btn("Where is our working capital trapped?", () => ctx.ask("Where is our working capital trapped?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Bank", value: eur(FN.bank), sub: "Current account · feed 07:30" },
          { label: "Facility drawn", value: eurK(FN.facilityUsed) + " of " + eurK(FN.facility), sub: pctOf(FN.facilityUsed, FN.facility) + "% used · revolving facility" },
          { label: "Headroom", value: eur(FAC_HEAD), sub: "Undrawn facility", subTone: "ok" },
          { label: "Available liquidity", value: eur(FN.bank + FAC_HEAD), sub: "Bank + headroom" },
          { label: "Lowest balance, 6 weeks", value: eur(low.bal), sub: low.n < 0 ? "Today · rises from here" : "End of " + dm(D(low.n)), tone: low.bal < 150000 ? "bad" : low.bal < 250000 ? "warn" : null, subTone: low.bal < 250000 ? "warn" : null },
          { label: "Payables due", value: eur(FN.payables), sub: "64 suppliers", onClick: () => go("Purchasing", "Suppliers") }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [chart, h("div", null, trapped, gap(),
          UI.AI({ who: "Briefing Agent", text: [
            net < 0 ? "Over six weeks payments run " : "Over six weeks receipts cover payments with ", B(eur(Math.abs(net)) + (net < 0 ? " ahead of receipts" : " to spare")), "." + why + (low.bal < 150000 ? " That is " + eur(150000 - low.bal) + " under the €150,000 minimum, so it means drawing on the facility unless something moves first." : "") + (low.n < 0 ? " Three things add to it: Rachel's " : " Three things move it without touching the facility: Rachel's "), B(eur(CALLS_TOTAL)), " of collections, paying the weekly run to due date (", B(eur(EARLY_PAY)), "), and holding ", B(eur(ATLAS_CLAIMS)), " of Atlas claims."],
            actions: [UI.Btn("Collections", () => go("Finance", "Credit Control"), { sm: true, pri: true }), UI.Btn("Atlas", () => ctx.open("supplier", "atlas"), { sm: true })] }))]),
        table,
        gap(),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [runsCard, stat]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [fx,
          UI.Card({ title: "Facility", icon: "shield", meta: "REVOLVING CREDIT · " + eurK(FN.facility), delay: 300 }, [
            h("div", { className: "pd-split", style: { marginBottom: 8 } }, h("span", { style: { fontSize: 13 } }, eurK(FN.facilityUsed) + " drawn"), h("span", { className: "pd-grow" }), h("span", { className: "pd-meta" }, eurK(FAC_HEAD) + " HEADROOM")),
            UI.Bar(100 * FN.facilityUsed / FN.facility, "info", { h: 10 }),
            h("div", { style: { marginTop: 14 } }, UI.Facts([["Drawn", eur(FN.facilityUsed)], ["Limit", eur(FN.facility)], ["Headroom", eur(FAC_HEAD), "ok"]], 3)),
            UI.Note("The bank reviews the facility on stock ageing and debtor days. Both have moved the wrong way this year: " + OVER120 + " of stock over 120 days, overdue up €28k.", { marginTop: 10 })
          ])])
      ]
    });
  }

  /* ================================================================ WORKING CAPITAL */
  function workingCapital(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const release = sum(FN.wcRelease.map((r) => r[1]));
    const stockActions = FN.wcRelease[0][1] + FN.wcRelease[3][1]; // slow stock + optimisation
    const turnAfter = COGS / (DB.company.inventory - stockActions);
    const nwc = DB.company.inventory + FN.receivables - FN.payables;
    const catTurns = DB.categories.map((c) => {
      const annual = c.rev * DB.company.annualised / K.revenueMTD;
      return { id: c.id, inv: c.inv, turn: annual * (1 - c.gm / 100) / c.inv };
    }).sort((a, b) => a.turn - b.turn);

    const where = UI.Card({ title: "Where the €2.78m sits", icon: "box", meta: "STOCK BY AGE · RECEIVABLES BY AGE", delay: 60 }, [
      UI.HBars(AGE.map((a, i) => ({ label: "Stock " + a[0], v: a[1], d: eurK(a[1]), tone: i >= 4 ? "bad" : i === 3 ? "warn" : null, onClick: () => go("Inventory", i >= 3 ? "Slow & Dead Stock" : "Stock") }))
        .concat([
          { label: "Receivables not yet due", v: FN.ageing[0][1], d: eurK(FN.ageing[0][1]), onClick: () => go("Finance", "Debtors") },
          { label: "Receivables overdue", v: FN.overdue, d: eurK(FN.overdue), tone: "warn", onClick: () => go("Finance", "Debtors") }
        ]), { tpl: "minmax(160px,1.2fr) 1.6fr 64px", flat: true, colorValue: true }),
      UI.Note("Stock is 89% of the cash tied up. " + eurK(K.slow) + " of it is over 90 days; " + OVER120 + " over 120.", { marginTop: 8 })
    ]);

    const opps = UI.Card({ title: "Potential release: " + eur(release), icon: "bolt", meta: "EACH LINE OPENS THE PAGE THAT DELIVERS IT", delay: 100, tint: true }, [
      ...FN.wcRelease.map((r) => { const w = WC_ROUTE[r[0]]; return h("div", { key: r[0], className: "pd-row", style: { alignItems: "flex-start" } },
        h("div", { className: "pd-grow" },
          h("div", { className: "pd-split", style: { gap: 8 } }, h("span", { style: { fontSize: 13.5, fontWeight: 500 } }, r[0]), h("span", { className: "pd-meta" }, DB.person(w.owner).toUpperCase())),
          h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 3, lineHeight: 1.5 } }, w.how)),
        h("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" } },
          h("span", { style: { fontSize: 17, fontWeight: 500, letterSpacing: "-.4px" } }, eur(r[1])),
          UI.Btn(w.btn, () => go(w.go[0], w.go[1]), { sm: true, icon: "arrow" }))); }),
      UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 13, fontWeight: 500 } }, "Total"), h("span", { style: { fontSize: 17, fontWeight: 500, color: "var(--accent-text)" } }, eur(release))])
    ]);

    const turn = UI.Card({ title: "Inventory turn", icon: "spark", meta: "TARGET " + TURN_TARGET.toFixed(1) + "×", delay: 140 }, [
      UI.Facts([["Now", TURN.toFixed(1) + "×", "warn", "Cost of sales " + eurK(COGS) + " a year"], ["After stock actions", turnAfter.toFixed(1) + "×", null, eurK(stockActions) + " out of stock"], ["At target", TURN_TARGET.toFixed(1) + "×", "ok", "Stock of " + eurK(STOCK_AT_TARGET)]], 3),
      h("div", { style: { marginTop: 14 } }, UI.Lines(months(9), [{ name: "Turn", values: [5.2, 5.1, 5.1, 5.0, 4.9, 4.9, 4.8, 4.8, 4.8], color: "var(--warn)" }], { h: 90, min: 4.5, max: 5.7, hline: TURN_TARGET, legend: false })),
      UI.Note("The €176,000 of stock actions gets to " + turnAfter.toFixed(1) + "×. Reaching " + TURN_TARGET.toFixed(1) + "× needs " + eurK(DB.company.inventory - STOCK_AT_TARGET) + " out in total, so replenishment rules have to change too, not just a clear-out.", { marginTop: 8 })
    ]);

    const byCat = UI.Card({ title: "Turn by category", icon: "box", meta: "SLOWEST FIRST · CLICK FOR SLOW STOCK", delay: 180 }, [
      UI.HBars(catTurns.map((c) => ({ label: c.id, v: c.turn, d: c.turn.toFixed(1) + "× · " + eurK(c.inv), tone: c.turn < 4.2 ? "bad" : c.turn < TURN_TARGET ? "warn" : "ok", onClick: () => go("Inventory", "Slow & Dead Stock") })), { max: 6.5, tpl: "minmax(140px,1.2fr) 1.3fr 96px", colorValue: true }),
      UI.Note("Safety & PPE and Fixings hold the oldest lines: 1,640 hi-vis vests with no demand, 58 weeks of Unistrut channel.", { marginTop: 8 }),
      h("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 } }, ...["SAF-1740", "FIX-2402", "LT-8410", "LT-8305", "TL-5388"].map((s) => h("span", { key: s, className: "pd-chip", onClick: () => ctx.open("product", s) }, s)))
    ]);

    const bridge = UI.Card({ title: "Net working capital", icon: "euro", meta: "SAGE 200 · 09:14", delay: 220 }, [
      ...[["Inventory", DB.company.inventory, () => go("Inventory", "Overview")], ["Receivables", FN.receivables, () => go("Finance", "Debtors")], ["Payables and obligations", -FN.payables, () => go("Finance", "Cash")]].map((r, i) => UI.Row({ key: i, onClick: r[2] }, [h("span", { className: "pd-grow", style: { fontSize: 13, color: "var(--dim)" } }, r[0]), mono(eur(r[1]), { fontSize: 13 })])),
      UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 13.5, fontWeight: 500 } }, "Net working capital"), mono(eur(nwc), { fontSize: 13.5 })]),
      UI.Row({}, [h("span", { className: "pd-grow", style: { fontSize: 13, color: "var(--dim)" } }, "After the " + eurK(release) + " release"), mono(eur(nwc - release), { fontSize: 13, color: "var(--ok)" })]),
      UI.Note("Every €100k released comes off the " + eurK(FN.facilityUsed) + " drawn on the facility or lands in the bank. Nothing else on this list does that without a sale.", { marginTop: 8 })
    ]);

    const ai = UI.AI({ who: "Where is our working capital trapped?", conf: "BRIEFING AGENT",
      text: [ "Mostly in stock. Of ", B(eurK(FN.cashTied)), " tied up, ", B(eurK(DB.company.inventory)), " is inventory and ", B(OVER120), " of that has not moved in 120 days. Receivables are the smaller problem but the one getting worse: overdue is up €28k in nine months. The ", B(eur(release)), " on this page comes from three people: Emma Walsh on stock, Rachel Hayes on collections, Niamh Clarke on the payment run. None of it needs a new system, only decisions that are already sitting in the queues." ],
      actions: [UI.Btn("Ask the follow-up", () => ctx.ask("Where is our working capital trapped?"), { pri: true, sm: true, icon: "spark" }), UI.Btn("What inventory can we reduce?", () => ctx.ask("What inventory can we reduce?"), { sm: true })] });

    return UI.Page({
      kicker: "Finance · working capital", title: eurK(FN.cashTied) + " tied up. " + eurK(release) + " can come back.",
      sub: "Stock, receivables and what we owe in one place, with each release opportunity handed to the page and the person that delivers it.",
      actions: [UI.Btn("Where is our working capital trapped?", () => ctx.ask("Where is our working capital trapped?"), { pri: true, icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Inventory", value: eurK(DB.company.inventory), sub: OVER120 + " over 120 days", onClick: () => go("Inventory", "Overview") },
          { label: "Receivables", value: eurK(FN.receivables), sub: eurK(FN.overdue) + " overdue", onClick: () => go("Finance", "Debtors") },
          { label: "Payables & obligations", value: eurK(FN.payables), sub: "64 suppliers", onClick: () => go("Finance", "Cash") },
          { label: "Net working capital", value: eurK(nwc), sub: "Stock + receivables − payables" },
          { label: "Potential release", value: eur(release), sub: "Four actions, three owners", hero: true },
          { label: "Inventory turn", value: TURN.toFixed(1) + "×", sub: "Target " + TURN_TARGET.toFixed(1) + "×", tone: "warn", toneValue: true }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.2fr) minmax(0,1fr)", [where, opps]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [turn, byCat]),
        UI.Grid("minmax(0,1fr) minmax(0,1.3fr)", [bridge, ai])
      ]
    });
  }

  PD.pages.Finance = { "Overview": overview, "Revenue": revenue, "Debtors": debtors, "Credit Control": creditControl, "Cash": cash, "Working Capital": workingCapital };
})();
