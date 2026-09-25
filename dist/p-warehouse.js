/* Warehouse: the floor, live. Control board, picking, packing, goods in, dispatch and exceptions
   for Dublin and Naas. Local pick tasks reconcile to the day's workload: 94 orders, 1,284 lines,
   48 completed, 26 picking, 14 waiting, 6 urgent (Dublin 71 / 968, Naas 23 / 316). */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB;
  const R = window.React;
  const { eur, num } = PD.fmt;
  const { D, rel, relLower, weekday, dm } = PD.date;
  const B = UI.B;

  /* ---------------- time: the board reads 09:20 ---------------- */
  const NOW = 9 * 60 + 20;
  const toMin = (t) => { const p = String(t).split(":"); return +p[0] * 60 + +p[1]; };
  const leftTxt = (t) => {
    const m = toMin(t) - NOW;
    if (m <= 0) return "Passed";
    const hh = Math.floor(m / 60), mm = m % 60;
    return hh ? hh + "h " + (mm < 10 ? "0" : "") + mm + "m" : mm + " min";
  };
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const faint = (t) => h("span", { className: "pd-faint" }, t || "None");
  const mono = (t, ink) => h("span", { className: "pd-mono", style: { fontSize: 12, color: ink ? "var(--ink)" : undefined } }, t);
  const gap = () => h("div", { style: { height: 14 } });
  const toneFg = (t) => (t && PD.TONE[t] ? PD.TONE[t].fg : "var(--dim)");
  const initials = (n) => String(n).split(" ").map((w) => w[0]).join("").slice(0, 2);
  const rLabel = (id) => String(id).replace("·", " run ");
  const openRec = (ctx, rec) => { if (!rec) return; if (rec[0] === "go") ctx.go(rec[1], rec[2]); else ctx.open(rec[0], rec[1]); };

  /* ---------------- sites ---------------- */
  const SITES = [["ALL", "Both sites"], ["DUB", "Dublin"], ["NAS", "Naas"]];
  const siteOf = (ctx) => (ctx.st && ctx.st.whSite) || "ALL";
  const inSite = (s, wh) => s === "ALL" || wh === "ALL" || s === wh;
  const siteKeys = (s) => (s === "ALL" ? ["DUB", "NAS"] : [s]);
  const siteTabs = (ctx) => UI.Tabs(SITES, siteOf(ctx), (v) => ctx.set({ whSite: v }));

  /* ---------------- people on the floor (pickers not in DB.staff live here) ---------------- */
  const LOCAL = {
    JK: "Jason Kinsella", AW: "Aisling Ward", MW: "Marek Wiśniewski", RK: "Rūta Kazlauskienė", LK: "Laura Keane",
    KB: "Kevin Brady", DCu: "Dean Cullen", SBo: "Stephen Bolger", OTr: "Oisín Tracey",
    GV: "Gintaras Vaitkus", SF: "Sinéad Fox", EK: "Ewa Kaczmarek", TM: "Tadhg Mulligan"
  };
  const who = (k) => (!k ? "" : LOCAL[k] || DB.person(k));

  /* ---------------- today's workload by site ---------------- */
  const WL = {
    DUB: { orders: 71, lines: 968, picked: 584, done: 34, pickersIn: 11, rostered: 13, onPick: 9, rate: 20, std: 24 },
    NAS: { orders: 23, lines: 316, picked: 212, done: 14, pickersIn: 5, rostered: 5, onPick: 5, rate: 15, std: 18 }
  };

  /* ---------------- open pick tasks: every order not yet completed today ----------------
     wave: D04·2, D07·2, D14 (vans), SHUTTLE (Naas to Dublin 14:00), COLLECT (trade counter), PALLET (pallet network) */
  const T = (id, cust, wh, lines, picked, loc, whoK, start, target, wave, cut, st, x) =>
    Object.assign({ id, cust, wh, lines, picked, loc, who: whoK, start, target, wave, cut, st }, x || {});
  const PICKS = [
    // Dublin · urgent (5)
    T("SO-10493", "tallaght", "DUB", 10, 9, "D-14-03", "SR", "08:40", "09:10", "D04·2", "11:30", "urgent", { short: 1, tone: "bad", issue: "Count mismatch: system 12 reels, 4 on the shelf", exp: "10:05" }),
    T("SO-10486", "brennan", "DUB", 12, 9, "A-22-04", "DQ", "08:25", "09:05", "D14", "13:30", "urgent", { blocked: 3, tone: "bad", issue: "Pick face blocked by an unreceived pallet", exp: "09:45" }),
    T("SO-10482", "murphy", "DUB", 18, 15, "D-11 · D-14 · D-21", "PK", "08:05", "09:30", "D14", "13:30", "urgent", { short: 3, tone: "warn", issue: "3 lines short on PO-8821, Atlas 5 days late" }),
    T("SO-10488", "horizon", "DUB", 8, 7, "D-11-08", "PK", "08:05", "09:30", "D14", "13:30", "urgent", { short: 1, tone: "warn", issue: "40 × EL-4631 short on PO-8821" }),
    T("SO-10495", "liffey", "DUB", 6, 5, "D-21-02", "AW", "08:30", "09:00", "D14", "13:30", "urgent", { short: 1, tone: "warn", issue: "20 × IC-3310 short on PO-8821" }),
    // Dublin · picking (20)
    T("SO-10491", "westbrook", "DUB", 11, 7, "A-06-01", "JK", "08:50", "09:35", "D07·2", "12:15", "picking", { tone: "warn", issue: "3m trunking lines need two people", exp: "10:05" }),
    T("SO-10496", "clondalkin", "DUB", 4, 2, "B-09-02", "DQ", "09:05", "09:25", "D14", "13:30", "picking", { issue: "Check-weigh: tote 7.2 kg over system weight" }),
    T("SO-10498", "fingal", "DUB", 5, 1, "D-07-04", "SR", "09:12", "09:40", "D14", "13:30", "picking"),
    T("SO-10534", "brennan", "DUB", 6, 4, "A-18-02", "AW", "09:02", "09:40", "COLLECT", "10:00", "picking"),
    T("SO-10535", "horizon", "DUB", 9, 5, "D-09-01", "AW", "09:10", "10:05", "COLLECT", "10:30", "picking"),
    T("SO-10536", "liffey", "DUB", 12, 6, "B-02-04", "JK", "09:08", "10:20", "COLLECT", "11:00", "picking"),
    T("SO-10537", "clondalkin", "DUB", 7, 2, "B-10-03", "RK", "09:14", "10:25", "COLLECT", "11:00", "picking"),
    T("SO-10538", "tallaght", "DUB", 14, 3, "A-11-01", "LK", "09:15", "10:55", "COLLECT", "11:30", "picking"),
    T("SO-10539", "lucan", "DUB", 8, 1, "C-02-02", "TN", "09:18", "11:20", "COLLECT", "12:00", "picking"),
    T("SO-10540", "core", "DUB", 16, 2, "B-05-06", "TN", "09:18", "11:50", "COLLECT", "12:30", "picking"),
    T("SO-10483", "leinster", "DUB", 22, 14, "B-01-09", "MW", "08:10", "09:50", "PALLET", "14:30", "picking", { dest: "Store 9, Wexford" }),
    T("SO-10484", "leinster", "DUB", 18, 9, "B-06-02", "MW", "08:45", "10:15", "PALLET", "14:30", "picking", { dest: "Store 12, Kilkenny" }),
    T("SO-10485", "ryan", "DUB", 14, 6, "B-03-11", "RK", "08:30", "09:55", "PALLET", "14:30", "picking", { dest: "Drogheda" }),
    T("SO-10487", "meath", "DUB", 11, 3, "C-06-04", "RK", "08:55", "10:10", "PALLET", "14:30", "picking", { dest: "Navan" }),
    T("SO-10489", "core", "DUB", 16, 4, "E-02-05", "LK", "08:40", "10:30", "PALLET", "14:30", "picking", { dest: "Athlone site" }),
    T("SO-10492", "leinster", "DUB", 24, 6, "D-08-02", "MW", "09:05", "11:05", "PALLET", "14:30", "picking", { dest: "Store 14, Waterford", issue: "Picking LT-8120 from the face with RMA-1192's battens" }),
    T("SO-10497", "obrien", "DUB", 19, 5, "B-15-02", "PK", "09:10", "11:10", "PALLET", "14:30", "picking", { dest: "Cork site", issue: "24 × AD-7340 PU foam: limited-quantity labels" }),
    T("SO-10505", "harbour", "DUB", 13, 2, "D-12-01", "SR", "09:15", "11:00", "PALLET", "14:30", "picking", { dest: "Arklow site" }),
    T("SO-10510", "atlantic", "DUB", 17, 3, "C-03-06", "JK", "09:12", "11:15", "PALLET", "14:30", "picking", { dest: "Shannon", issue: "Delivery address has no Eircode" }),
    T("SO-10513", "core", "DUB", 12, 1, "B-04-06", "LK", "09:16", "11:05", "PALLET", "14:30", "picking", { dest: "Limerick site" }),
    // Dublin · waiting (12)
    T("SO-10480", "core", "DUB", 5, 0, "B-03-11", null, null, "10:30", "D14", "13:30", "waiting", { wait: "Queued behind the D14 urgents" }),
    T("SO-10494", "westbrook", "DUB", 6, 0, "D-05-02", null, null, "10:40", "D14", "13:30", "waiting", { wait: "Queued behind the D14 urgents" }),
    T("SO-10502", "lucan", "DUB", 4, 0, "B-12-01", null, null, "10:50", "D14", "13:30", "waiting", { wait: "Queued" }),
    T("SO-10504", "blanch", "DUB", 3, 0, "C-04-03", null, null, "11:00", "D14", "13:30", "waiting", { wait: "Queued" }),
    T("SO-10508", "northside", "DUB", 5, 0, "B-08-05", null, null, "11:10", "D14", "13:30", "waiting", { wait: "Queued" }),
    T("SO-10541", "northside", "DUB", 11, 0, "B-14-02", null, null, "13:10", "COLLECT", "14:00", "waiting", { wait: "Queued for the 14:00 collection" }),
    T("SO-10542", "fingal", "DUB", 14, 0, "D-03-07", null, null, "14:10", "COLLECT", "15:00", "waiting", { wait: "Queued for the 15:00 collection" }),
    T("SO-10543", "blanch", "DUB", 22, 0, "C-08-01", null, null, "14:40", "COLLECT", "15:30", "waiting", { wait: "Queued for the 15:30 collection" }),
    T("SO-10519", "leinster", "DUB", 31, 0, "B-03-11", null, null, "12:40", "PALLET", "14:30", "waiting", { dest: "Store 4, Dundalk", wait: "EuroFix lines on PO-8829, 11:00", po: "PO-8829" }),
    T("SO-10521", "horizon", "DUB", 36, 0, "D-02-04", null, null, "13:30", "PALLET", "14:30", "waiting", { dest: "Galway job", wait: "8 × EL-4520 on Hartmann PO-8830, 12:30", po: "PO-8830" }),
    T("SO-10530", "liffey", "DUB", 28, 0, "B-04-06", null, null, "12:50", "PALLET", "14:30", "waiting", { dest: "Mullingar job", wait: "Pick face B-04-06 empty: needs a forklift drop" }),
    T("SO-10532", "obrien", "DUB", 38, 0, "B-11-03", null, null, "13:20", "PALLET", "14:30", "waiting", { dest: "Galway site", wait: "Queued: no picker free before 11:15" }),
    // Naas · urgent (1), picking (6), waiting (2)
    T("SO-10490", "glenview", "NAS", 5, 5, "N-3 staging", "AP", "09:15", "09:45", "SHUTTLE", "13:30", "urgent", { tone: "warn", issue: "Left behind by N06 at 07:40: re-staging 2 pallets", exp: "09:45" }),
    T("SO-10544", "kelleher", "NAS", 9, 6, "NB-02-03", "AP", "09:00", "09:40", "COLLECT", "10:00", "picking"),
    T("SO-10545", "midland", "NAS", 21, 8, "NA-07-01", "GV", "08:50", "10:40", "COLLECT", "11:30", "picking"),
    T("SO-10547", "leinster", "NAS", 19, 7, "NC-12-03", "SF", "08:45", "10:15", "PALLET", "14:30", "picking", { dest: "Store 6, Tullamore" }),
    T("SO-10548", "core", "NAS", 17, 5, "NC-04-02", "SF", "09:05", "10:30", "PALLET", "14:30", "picking", { dest: "Portlaoise site" }),
    T("SO-10549", "obrien", "NAS", 23, 4, "NA-03-05", "EK", "09:00", "10:50", "PALLET", "14:30", "picking", { dest: "Clonmel site" }),
    T("SO-10550", "leinster", "NAS", 15, 2, "NB-09-01", "TM", "09:10", "10:35", "PALLET", "14:30", "picking", { dest: "Store 8, Athy" }),
    T("SO-10546", "midland", "NAS", 14, 0, "NC-01-02", null, null, "14:00", "COLLECT", "15:00", "waiting", { wait: "SAF-1930 helmets on Polska PO-8839, 13:00", po: "PO-8839" }),
    T("SO-10551", "core", "NAS", 18, 0, "NC-06-01", null, null, "14:20", "PALLET", "14:30", "waiting", { dest: "Waterford site", wait: "IC-3405 gloves on SafePro PO-8833, 14:00", po: "PO-8833" })
  ];

  const WAVE = { "D04·2": "D04 run 2", "D07·2": "D07 run 2", D14: "D14", SHUTTLE: "Naas shuttle", COLLECT: "Collection", PALLET: "Pallet network" };
  const deadline = (t) => (t.wave === "COLLECT" ? "Collect " + t.cut : WAVE[t.wave] + " · " + t.cut);
  const prio = (t) => (t.st === "urgent" || toMin(t.cut) - NOW <= 180 ? "HIGH" : toMin(t.cut) - NOW <= 300 ? "MEDIUM" : "LOW");
  const openTask = (ctx, t) => (DB.order(t.id) ? ctx.open("order", t.id) : DB.customer(t.cust) ? ctx.open("customer", t.cust) : null);
  const ST_ORDER = { urgent: 0, picking: 1, waiting: 2 };
  const bySeq = (a, b) => ST_ORDER[a.st] - ST_ORDER[b.st] || toMin(a.cut) - toMin(b.cut) || (b.lines - b.picked) - (a.lines - a.picked);

  /* the same task, after decisions taken anywhere in Pulse */
  const live = (ctx, t0) => {
    const t = Object.assign({}, t0), d = (k) => ctx.done(k);
    if (t.id === "SO-10486" && d("fix-SO-10486")) Object.assign(t, { tone: null, issue: "A-22-04 cleared: 3 lines left, about 12 minutes", exp: "09:35" });
    if (t.id === "SO-10493" && d("fix-SO-10493")) Object.assign(t, { tone: "warn", issue: "Going on D04 run 2 with 4 of 6 reels" });
    if (t.id === "SO-10482" && d("so-partial")) Object.assign(t, { tone: "ok", issue: "Partial approved: 15 lines go on D14 today" });
    if (t.id === "SO-10490" && d("fix-SO-10490")) Object.assign(t, { tone: "ok", issue: "Booked on the 14:00 shuttle" });
    if (t.id === "SO-10491" && d("wh-10491-help")) Object.assign(t, { tone: null, issue: "Rūta Kazlauskienė helping on the trunking", exp: "09:50" });
    if (t.id === "SO-10530" && d("wh-replen")) Object.assign(t, { wait: "Forklift drop on its way to B-04-06" });
    if (t.id === "SO-10496" && d("wh-weigh-10496")) Object.assign(t, { issue: "Re-checked: extra pack removed" });
    if (t.id === "SO-10492" && d("wh-rma1192")) Object.assign(t, { issue: "Face cleared of RMA-1192 battens" });
    if (t.id === "SO-10510" && d("wh-eircode")) Object.assign(t, { issue: "Eircode requested from the customer" });
    return t;
  };
  const tasks = (ctx, s) => PICKS.filter((t) => inSite(s, t.wh)).map((t) => live(ctx, t));

  const routeValue = (k) => sum(DB.routes.filter((r) => r.wh === k).map((r) => r.value));
  const wl = (s) => {
    const o = { orders: 0, lines: 0, picked: 0, done: 0, pickersIn: 0, rostered: 0, onPick: 0, value: 0 };
    siteKeys(s).forEach((k) => { Object.keys(o).forEach((f) => { o[f] += f === "value" ? routeValue(k) : WL[k][f]; }); });
    const open = PICKS.filter((t) => inSite(s, t.wh));
    o.open = open.length;
    o.urgent = open.filter((t) => t.st === "urgent").length;
    o.picking = open.filter((t) => t.st === "picking").length;
    o.waiting = open.filter((t) => t.st === "waiting").length;
    o.left = sum(open.map((t) => t.lines - t.picked));
    o.blocked = sum(open.map((t) => t.short || t.blocked || 0));
    return o;
  };

  /* ---------------- sanity checks ---------------- */
  const chk = (label, got, want) => { if (Math.abs(got - want) > 0.051) console.warn("[PD data] warehouse " + label + ": " + got + " ≠ " + want); };
  ["DUB", "NAS"].forEach((k) => {
    const open = PICKS.filter((t) => t.wh === k);
    chk(k + " orders", WL[k].done + open.length, WL[k].orders);
    chk(k + " lines left", WL[k].lines - WL[k].picked, sum(open.map((t) => t.lines - t.picked)));
  });
  chk("orders to pick", WL.DUB.orders + WL.NAS.orders, DB.kpi.ordersToday);
  chk("lines", WL.DUB.lines + WL.NAS.lines, 1284);
  chk("completed", WL.DUB.done + WL.NAS.done, 48);
  chk("picking", PICKS.filter((t) => t.st === "picking").length, 26);
  chk("waiting", PICKS.filter((t) => t.st === "waiting").length, 14);
  chk("urgent", PICKS.filter((t) => t.st === "urgent").length, 6);
  PICKS.forEach((t) => {
    const o = DB.order(t.id);
    if (o) { chk(t.id + " lines", t.lines, o.lines); if (o.cust !== t.cust || o.wh !== t.wh) console.warn("[PD data] warehouse " + t.id + " does not match DB.orders"); }
  });

  /* ---------------- decisions: one toast per key, shared keys match the rest of Pulse ---------------- */
  const TOAST = {
    "so-partial": ["Partial shipment approved", "15 lines released to D14. Murphy notified; balance booked for " + relLower(D(1)) + " afternoon."],
    "dq-transfer": ["Transfer approved", "40 × EL-4408 booked on the 14:00 Naas shuttle. Harbour Point, Leinster Retail and Tallaght Trade protected."],
    "dq-expedite": ["Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight. Emma Walsh copied."],
    "po-fh6710": ["PO drafted", "FH-6710: PO-8847 drafted to Kerry Hygiene for 400 units, waiting for Emma Walsh."],
    "po-recv": ["PO-8821 received (simulated)", "Inventory, 6 backorders, 11 pick tasks and 6 customer emails updated."],
    "fix-SO-10486": ["Pick face cleared", "Pallet booked in against PO-8818 and moved to bay 1. Darren Quinn back on SO-10486: 3 lines, about 12 minutes."],
    "fix-SO-10493": ["D04 run 2 goes with 4 reels", "SO-10493 docket amended to 4 of 6 reels. The other 2 come off the Naas transfer and go on D04's first run " + relLower(D(1)) + ". Wayne Doran told."],
    "fix-SO-10501": ["Added to D07 run 2", "SO-10501 Southside DIY on D07 run 2, drop at 12:50 in Rathfarnham. Gerry Mahon told."],
    "fix-SO-10490": ["Booked on the shuttle", "Glenview's 2 pallets go on the 14:00 Naas shuttle. Emer Nolan told to expect them this afternoon."],
    "wh-staff": ["Staffing plan approved", "Kevin Brady and Dean Cullen back on pick after the Hartmann tip. 1 hour overtime for Aisling Ward, Marek Wiśniewski and Laura Keane (€142). Tomorrow's first-run pick projected 17:20."],
    "wh-reseq": ["Pick sequence applied", "46 orders re-sequenced by cut-off. Handhelds updated; nobody is sent to D-14-03, D-11-08 or D-21-02 until stock lands."],
    "wh-bin-d1403": ["Recount booked", "Siobhán Reilly checks D-14-04 first. If the 8 reels are not there, Liam Murphy approves the write-down (€171.20) and D-14 is counted tonight."],
    "wh-rma1192": ["Battens quarantined", "6 × LT-8120 moved to quarantine at bay 5. Murphy's 120 and the Leinster Waterford picks re-checked against the RMA-1192 batch label."],
    "wh-8826": ["Invoice hold set", "€56.40 held on the Celtic Chemicals invoice for 24 × AD-7102. Ciarán Kavanagh asked Brian Kiely for a credit note."],
    "wh-kerry-claim": ["Claim raised", "€201.60 claim to Kerry Hygiene for 18 cases of FH-6602, with the goods-in photos. Aoife Brennan copied."],
    "wh-10491-help": ["Second picker sent", "Rūta Kazlauskienė joins Jason Kinsella on SO-10491 for the trunking lines. D07 run 2 cut-off 12:15."],
    "wh-replen": ["Forklift drops released", "3 replenishment drops queued: FIX-2330 to B-04-06 first, then EL-4712 and AD-7102."],
    "wh-weigh-10496": ["Re-check logged", "SO-10496 re-weighed at bench P2: 1 extra pack of FIX-2201 removed and put back."],
    "wh-insp-1196": ["Inspection done", "RMA-1196: 2 × EL-4712 confirmed damaged in transit. €163.66 credit released to Harbour Point."],
    "wh-insp-1187": ["Inspection done", "RMA-1187: 20 × EL-4631 confirmed as the 25mm mis-pack. €199.00 credit released; claim added to the Atlas file."],
    "wh-xdock-8830": ["Cross-dock set", "PO-8830: 8 × EL-4520 go straight from bay 1 to the Galway pallet for SO-10521. The rest is put away as normal."],
    "wh-naas-gi": ["Naas goods in planned", "Sinéad Fox and Tadhg Mulligan on N-1 from 12:45 for the Polska trailer. Kerry at 10:15 stays with the goods-in team."],
    "wh-cycle": ["Cycle count booked", "40 bins in D-14 to D-21 counted tonight by the late shift, before PO-8821 lands at 10:30."],
    "wh-eircode": ["Call logged", "Gráinne Foley calling Lorraine Kinsella at Atlantic FM for the Shannon Eircode. Label reprints when it is in."],
    "wh-10518": ["Kept on N04", "SO-10518 stays on N04 " + relLower(D(1)) + " at 07:15, drop by 08:10. Mark Ryan and Aidan Kelleher told."]
  };
  const act = (ctx, key) => ctx.act(key, TOAST[key][0], TOAST[key][1]);
  const decBtn = (ctx, key, label, doneLabel, opt) => UI.Btn(label, () => act(ctx, key), Object.assign({ sm: true, done: ctx.done(key), doneLabel: doneLabel || "Done" }, opt || {}));

  /* ---------------- pickers ---------------- */
  const PICKERS = [
    { k: "TN", site: "DUB", role: "Pick team lead", st: "Picking", now: "Collections for 12:00 and 12:30, plus floor exceptions", rate: 15, today: 40 },
    { k: "PK", site: "DUB", st: "Picking", now: "Murphy and Horizon staged, SO-10497 Cork next", rate: 22, today: 72 },
    { k: "SR", site: "DUB", st: "Picking", now: "Recounted D-14-03 at 09:06, now on SO-10498", rate: 19, today: 64 },
    { k: "DQ", site: "DUB", st: "Blocked", now: "Stuck at A-22-04, picking SO-10496 meanwhile", rate: 14, today: 51 },
    { k: "AW", site: "DUB", st: "Picking", now: "SO-10534 for the 10:00 collection", rate: 23, today: 74 },
    { k: "JK", site: "DUB", st: "Picking", now: "SO-10491 for D07 run 2, behind on trunking", rate: 21, today: 68 },
    { k: "MW", site: "DUB", st: "Picking", now: "Leinster pallets: Wexford, Kilkenny, Waterford", rate: 24, today: 79 },
    { k: "RK", site: "DUB", st: "Picking", now: "Drogheda and Navan pallets", rate: 20, today: 66 },
    { k: "LK", site: "DUB", st: "Picking", now: "SO-10538 for the 11:30 collection", rate: 22, today: 70 },
    { k: "KB", site: "DUB", st: "Goods in", now: "Bay 1 with Eoin Farrell until the Hartmann tip" },
    { k: "DCu", site: "DUB", st: "Goods in", now: "Bay 1: put-away of the Celtic pallets" },
    { k: "SBo", site: "DUB", st: "Off sick", now: "Rang in 06:10" },
    { k: "OTr", site: "DUB", st: "Annual leave", now: "Back Monday" },
    { k: "AP", site: "NAS", st: "Picking", now: "Re-staging SO-10490 for the shuttle", rate: 14, today: 42 },
    { k: "GV", site: "NAS", st: "Picking", now: "SO-10545 Midland Merchants, collect 11:30", rate: 16, today: 46 },
    { k: "SF", site: "NAS", st: "Picking", now: "Leinster Tullamore and Core Portlaoise pallets", rate: 17, today: 48 },
    { k: "EK", site: "NAS", st: "Picking", now: "SO-10549 O'Brien, Clonmel", rate: 15, today: 40 },
    { k: "TM", site: "NAS", st: "Picking", now: "SO-10550 Leinster, Athy", rate: 13, today: 36 }
  ];
  ["DUB", "NAS"].forEach((k) => {
    const on = PICKERS.filter((p) => p.site === k && p.rate);
    chk(k + " picked by pickers", sum(on.map((p) => p.today)), WL[k].picked);
    chk(k + " pickers on pick", on.length, WL[k].onPick);
    chk(k + " pick rate", sum(on.map((p) => p.rate)) / on.length, WL[k].rate);
  });

  /* ---------------- projected finish against cut-offs ---------------- */
  const PROJ = {
    DUB: [
      { cut: "11:30", label: "D04 run 2", route: "D04·2", t: "Picked, but 2 reels short after the recount", tone: "bad", key: "fix-SO-10493", doneT: "Going with 4 of 6 reels" },
      { cut: "12:15", label: "D07 run 2", route: "D07·2", t: "Done 10:05 · 2h 10m spare", tone: "ok" },
      { cut: "13:30", label: "D14", route: "D14", t: "Done 11:40 · 8 lines blocked or short", tone: "warn", key: "so-partial", doneT: "Done 11:40 · Murphy goes as a partial" },
      { cut: "14:30", label: "Pallet network", t: "Done 13:50 · 40 min spare", tone: "warn", all: true },
      { cut: "17:30", label: "Tomorrow's first runs", t: "Done 18:20 at 11 pickers · 50 min late", tone: "bad", key: "wh-staff", doneT: "Done 17:20 with the staffing plan", all: true }
    ],
    NAS: [
      { cut: "10:00", label: "Kelleher collection", t: "Done 09:40", tone: "ok" },
      { cut: "13:30", label: "Naas shuttle", t: "Glenview re-staged by 09:45", tone: "ok", key: "fix-SO-10490", doneT: "Glenview booked on", all: false },
      { cut: "14:30", label: "Pallet network", t: "Done 10:45 · 2 orders wait on the 13:00 and 14:00 deliveries", tone: "warn", all: true },
      { cut: "17:30", label: "Tomorrow's first runs", t: "Done 16:40 · goods in takes 2 pickers from 12:45", tone: "ok" }
    ]
  };

  /* ---------------- floor feed ---------------- */
  const FEED = [
    ["09:19", "DUB", ["Piotr Kowalski staged ", "15 of 18 lines", " of SO-10482 in lane 4"], "info", "WMS", ["order", "SO-10482"]],
    ["09:17", "DUB", ["Check-weigh flagged SO-10496: tote ", "7.2 kg", " over system weight"], "warn", "SCALE", ["order", "SO-10496"]],
    ["09:15", "NAS", ["Andrius Petrauskas started re-staging SO-10490 for the ", "14:00 shuttle", ""], "info", "WMS", ["order", "SO-10490"]],
    ["09:12", "NAS", ["Mark Ryan asked for SO-10518 Kelleher to go on ", "D14 today", ""], "warn", "OUTLOOK", ["order", "SO-10518"]],
    ["09:08", "DUB", ["Pick face B-04-06 empty after SO-10513: ", "forklift drop", " requested"], "warn", "WMS", ["product", "FIX-2330"]],
    ["09:06", "DUB", ["Siobhán Reilly counted ", "4 reels", " in D-14-03; system says 12"], "bad", "WMS", ["product", "EL-4408"]],
    ["09:05", "DUB", ["SO-10501 packed ", "five minutes", " after the D09 cut-off"], "bad", "WMS", ["order", "SO-10501"]],
    ["08:47", "NAS", ["SO-10478 Core Facilities packed at ", "bay N-2", ", 7 lines"], "ok", "WMS", ["order", "SO-10478"]],
    ["08:45", "DUB", ["6 LT-8120 battens found in D-08-02 that belong in quarantine: ", "RMA-1192", ""], "bad", "WMS", ["product", "LT-8120"]],
    ["08:25", "DUB", ["Darren Quinn: ", "A-22-04 blocked", " by a pallet with no receipt"], "bad", "WMS", ["order", "SO-10486"]],
    ["07:58", "NAS", ["Kerry delivery received at N-1: ", "1 pallet damaged", ", 18 cases wet"], "warn", "WMS", ["supplier", "kerry"]],
    ["07:40", "NAS", ["N06 left with ", "2 pallets", " for Glenview still on the dock"], "warn", "TRANSPORT", ["route", "N06"]]
  ];

  /* ---------------- exceptions ---------------- */
  const EXC = [
    { type: "Stock", site: "DUB", ref: "EL-4408 · D-14-03", rec: ["product", "EL-4408"], what: "Bin count 4, system 12. 8 reels unaccounted for, €171.20 at cost", owner: "LM", age: "14 min", orders: ["SO-10493"], impact: "Tallaght 2 reels short; Dublin available is really 4", fix: "Check D-14-04, adjust", key: "wh-bin-d1403", tone: "bad" },
    { type: "Stock", site: "DUB", ref: "LT-8120 · D-08-02", rec: ["product", "LT-8120"], what: "6 over: RMA-1192's defective battens went back to the pick face, not quarantine", owner: "LM", age: "35 min", orders: ["SO-10482", "SO-10492"], impact: "Murphy's 120 were picked from this face at 08:40", fix: "Quarantine 6, re-check", key: "wh-rma1192", tone: "bad" },
    { type: "Supplier", site: "DUB", ref: "PO-8826 · Celtic", rec: ["po", "PO-8826"], what: "24 × AD-7102 short-shipped on today's delivery", owner: "CK", age: "Today", orders: [], impact: "None: 1,310 available. €56.40 not to be paid", fix: "Hold €56.40 on invoice", key: "wh-8826", tone: "warn" },
    { type: "Supplier", site: "NAS", ref: "Kerry · PO-8819", rec: ["supplier", "kerry"], what: "1 pallet damaged on goods in: 18 cases FH-6602 wet, forklift tine through the wrap", owner: "AB", age: "1h 22m", orders: [], impact: "None: 300 available, 600 more at 10:15. €201.60 claim", fix: "Raise claim with Kerry", key: "wh-kerry-claim", tone: "warn" },
    { type: "Picking", site: "DUB", ref: "SO-10486 · A-22-04", rec: ["order", "SO-10486"], what: "Pick face blocked by an unreceived pallet; label matches Northgate PO-8818", owner: "TN", age: "55 min", orders: ["SO-10486"], impact: "3 lines for D14, cut-off 13:30", fix: "Book in, clear the face", key: "fix-SO-10486", tone: "bad" },
    { type: "Picking", site: "DUB", ref: "SO-10491 · A-06-01", rec: ["order", "SO-10491"], what: "3m trunking lines need two people; 30 min behind target", owner: "TN", age: "30 min", orders: ["SO-10491"], impact: "D07 run 2 cut-off 12:15", fix: "Send a second picker", key: "wh-10491-help", tone: "warn" },
    { type: "Picking", site: "DUB", ref: "FIX-2330 · B-04-06", rec: ["product", "FIX-2330"], what: "Pick face empty after SO-10513; reserve pallet is up at R-18-3", owner: "TN", age: "12 min", orders: ["SO-10530"], impact: "Liffey's Mullingar pallet, 28 lines, can't start", fix: "Release forklift drop", key: "wh-replen", tone: "warn" },
    { type: "Packing", site: "DUB", ref: "SO-10496 · check-weigh", rec: ["order", "SO-10496"], what: "Tote 7.2 kg over the system weight (11%)", owner: "TN", age: "3 min", orders: ["SO-10496"], impact: "Likely a spare pack of M10 bolts", fix: "Re-check at bench", key: "wh-weigh-10496", tone: "warn" },
    { type: "Dispatch", site: "DUB", ref: "SO-10482 · D14", rec: ["order", "SO-10482"], what: "3 Murphy lines short on PO-8821; Horizon and Liffey 1 line each", owner: "SB", age: "3 days", orders: ["SO-10482", "SO-10488", "SO-10495"], impact: "€35,220 on D14 · €1,867.40 of Murphy's lines wait", fix: "Approve partial", key: "so-partial", tone: "bad" },
    { type: "Dispatch", site: "DUB", ref: "SO-10501 · D09", rec: ["order", "SO-10501"], what: "Packed 09:05, five minutes after the D09 cut-off", owner: "CW", age: "15 min", orders: ["SO-10501"], impact: "€1,830 due today", fix: "Add to D07 run 2", key: "fix-SO-10501", tone: "warn" },
    { type: "Dispatch", site: "NAS", ref: "SO-10490 · N06", rec: ["order", "SO-10490"], what: "2 pallets left at Naas: N06 loaded to 104% of payload", owner: "AB", age: "1h 40m", orders: ["SO-10490"], impact: "€2,310 due today", fix: "Put on 14:00 shuttle", key: "fix-SO-10490", tone: "warn" },
    { type: "Return", site: "DUB", ref: "RMA-1196 · Harbour Point", rec: ["customer", "harbour"], what: "2 × EL-4712 transport damage, back from the driver", owner: "CW", age: "2 days", orders: [], impact: "€163.66 credit waits on inspection", fix: "Inspect, release credit", key: "wh-insp-1196", tone: "warn" },
    { type: "Return", site: "DUB", ref: "RMA-1187 · Horizon", rec: ["customer", "horizon"], what: "20 × EL-4631 wrong item: Atlas packed 25mm glands", owner: "LM", age: "4 days", orders: [], impact: "€199.00 credit pending; Atlas claim", fix: "Inspect, claim Atlas", key: "wh-insp-1187", tone: "warn" }
  ];

  /* ---------------- D14 manifest: [lines, staged, pallets, status, tone, missing] ---------------- */
  const D14X = {
    "SO-10480": [5, 0, 0.3, "Not picked", "neutral", ""],
    "SO-10482": [18, 15, 4.2, "Part staged", "warn", "3 lines on PO-8821"],
    "SO-10488": [8, 7, 0.6, "Part staged", "warn", "40 × EL-4631 on PO-8821"],
    "SO-10494": [6, 0, 0.4, "Not picked", "neutral", ""],
    "SO-10486": [12, 9, 0.8, "Blocked", "bad", "3 lines behind the pallet at A-22-04"],
    "SO-10495": [6, 5, 0.5, "Part staged", "warn", "20 × IC-3310 on PO-8821"],
    "SO-10496": [4, 2, 0.3, "Picking", "info", "Check-weigh flag"],
    "SO-10498": [5, 1, 0.4, "Picking", "info", ""],
    "SO-10500": [3, 3, 0.3, "Packed", "ok", ""],
    "SO-10502": [4, 0, 0.3, "Not picked", "neutral", ""],
    "SO-10504": [3, 0, 0.2, "Not picked", "neutral", ""],
    "SO-10508": [5, 0, 0.3, "Not picked", "neutral", ""]
  };
  chk("D14 pallets", sum(Object.keys(D14X).map((k) => D14X[k][2])), 8.6);
  DB.d14Stops.forEach((s) => { const x = D14X[s[1]], o = DB.order(s[1]); if (!x) console.warn("[PD data] warehouse D14 stop missing " + s[1]); else if (o) chk(s[1] + " D14 lines", x[0], o.lines); });
  const d14Staged = sum(Object.keys(D14X).map((k) => D14X[k][1]));
  const d14Lines = sum(Object.keys(D14X).map((k) => D14X[k][0]));

  /* ---------------- loading bays ---------------- */
  const BAYS = [
    { site: "DUB", bay: "Bay 1", use: "Goods in", title: "Celtic received · EuroFix 11:00", sub: "Eoin Farrell, Kevin Brady, Dean Cullen · 3 Celtic pallets to put away", status: "Receiving", tone: "neutral", rec: ["go", "Warehouse", "Goods In"] },
    { site: "DUB", bay: "Bay 2", use: "Outbound", route: "D04·2", sub: "Kevin Daly · 221-D-11873 · van back from run 1 at 11:20", built: 0.6, plan: 0.6, cut: "11:30", dep: "12:00" },
    { site: "DUB", bay: "Bay 3", use: "Outbound", route: "D07·2", sub: "Paddy Moran · 211-D-27764 · van back from run 1 at 11:40", built: 1.0, plan: 1.6, cut: "12:15", dep: "12:30" },
    { site: "DUB", bay: "Bay 4", use: "Outbound", route: "D14", sub: "James Nolan · 232-D-18420 · 12 drops · 91% payload", built: 5.2, plan: 8.6, cut: "13:30", dep: "13:45" },
    { site: "DUB", bay: "Bay 5", use: "Returns & quarantine", title: "2 returns to inspect", sub: "RMA-1196 and RMA-1187 · Naas shuttle unloads here about 14:45", status: "Inspection", tone: "warn", rec: ["go", "Warehouse", "Exceptions"] },
    { site: "DUB", bay: "Bay 6", use: "Pallet network", title: "14 consignments", sub: "Trunker collects 15:00 · Louth, Meath, the south and west", built: 3.5, plan: 11, cut: "14:30", dep: "15:00", status: "Building", tone: "info", rec: ["go", "Warehouse", "Packing"] },
    { site: "NAS", bay: "N-1", use: "Goods in", title: "Kerry 10:15 · Polska 13:00 · SafePro 14:00", sub: "154 pallets today, 78 on the Polska trailer", status: "Next 10:15", tone: "neutral", rec: ["go", "Warehouse", "Goods In"] },
    { site: "NAS", bay: "N-2", use: "Outbound staging", title: "N04 tomorrow · pallet network", sub: "SO-10478 and SO-10518 packed · 5 pallet network orders building", built: 4.0, plan: 7.0, status: "Staging", tone: "info", rec: ["go", "Warehouse", "Packing"] },
    { site: "NAS", bay: "N-3", use: "Naas shuttle", title: "Shuttle to Dublin 14:00", sub: "Gavin Byrne · 221-KE-9936 · Glenview 2 pallets, EL-4408 transfer if approved", built: 2.0, plan: 3.0, cut: "13:30", dep: "14:00", status: "Staging", tone: "info", rec: ["go", "Warehouse", "Dispatch"] }
  ];
  const routeStatus = (ctx, r) => (r.id === "D14" && ctx.done("so-partial") ? "Loading 13:45" : r.status);
  const statusTone = (st) => (/Ready|Packed|Loading 13/.test(st) ? "ok" : /Waiting|left|Blocked/i.test(st) ? "warn" : /Loading|Staging|Building|Picking/.test(st) ? "info" : "neutral");

  /* ---------------- packing by route ---------------- */
  const PACK = [
    { label: "D04 run 2", route: "D04·2", bay: "Bay 2", site: "DUB", orders: 1, built: 0.6, plan: 0.6, kg: 342, kgPlan: 342, labels: "9 of 10 lines", docs: "Docket to amend: 4 of 6 reels", docsTone: "warn", docsKey: "fix-SO-10493", docsDone: "Docket amended: 4 reels", status: "Ready", tone: "ok" },
    { label: "D07 run 2", route: "D07·2", bay: "Bay 3", site: "DUB", orders: 1, built: 1.0, plan: 1.6, kg: 390, kgPlan: 610, labels: "7 of 11 lines", docs: "Docket printed", status: "Picking 7 of 11", tone: "info" },
    { label: "D14", route: "D14", bay: "Bay 4", site: "DUB", orders: 12, built: 5.2, plan: 8.6, kg: 1460, kgPlan: 2412, labels: d14Staged + " of " + d14Lines + " lines", docs: "Murphy docket to reprint as partial", docsTone: "warn", docsKey: "so-partial", docsDone: "Murphy reprinted as 15 of 18", status: "Staging", tone: "warn" },
    { label: "Pallet network", bay: "Bay 6", site: "DUB", orders: 14, built: 3.5, plan: 11.0, kg: 2980, kgPlan: 8640, labels: "5 of 14 consignments", docs: "SO-10510 has no Eircode", docsTone: "bad", docsKey: "wh-eircode", docsDone: "Eircode requested", status: "Wrapping as picked", tone: "info" },
    { label: "Naas shuttle", bay: "N-3", site: "NAS", orders: 1, built: 2.0, plan: 3.0, kg: 640, kgPlan: 1360, labels: "2 of 3 pallets", docs: "Transfer note waits on approval", docsTone: "warn", docsKey: "dq-transfer", docsDone: "Transfer note printed", status: "Staged", tone: "info" },
    { label: "Pallet network", bay: "N-2", site: "NAS", orders: 5, built: 1.0, plan: 4.0, kg: 610, kgPlan: 2980, labels: "1 of 5 consignments", docs: "Consignment notes ready", status: "Wrapping as picked", tone: "info" },
    { label: "N04 tomorrow 07:15", route: "N04", bay: "N-2", site: "NAS", orders: 2, built: 3.0, plan: 3.0, kg: 780, kgPlan: 780, labels: "All labelled", docs: "Dockets printed", status: "Packed", tone: "ok", tomorrow: true }
  ];
  const AWAIT = [
    { id: "SO-10500", site: "DUB", where: "Bay 4, lane 9", packed: "07:50", pal: 0.3, forV: "D14 · 13:45", note: "Staged in drop order", tone: "ok" },
    { id: "SO-10501", site: "DUB", where: "Bay 3 staging", packed: "09:05", pal: 0.3, forV: "D07 run 2 12:30, or " + relLower(D(1)) + " 07:05", note: "Missed the D09 cut-off by 5 minutes", tone: "bad", key: "fix-SO-10501", doneNote: "On D07 run 2, drop 12:50" },
    { id: "SO-10478", site: "NAS", where: "N-2", packed: "08:47", pal: 2.0, forV: "N04 · " + relLower(D(1)) + " 07:15", note: "Packed a day early", tone: "ok" },
    { id: "SO-10518", site: "NAS", where: "N-2", packed: "08:20", pal: 1.0, forV: "N04 · " + relLower(D(1)) + " 07:15", note: "Mark Ryan asked for today on D14", tone: "warn", key: "wh-10518", doneNote: "Stays on N04, customer told" },
    { id: "SO-10490", site: "NAS", where: "N-3", packed: "07:20", pal: 2.0, forV: "Naas shuttle · 14:00", note: "Left behind by N06 at 07:40", tone: "warn", key: "fix-SO-10490", doneNote: "Booked on the 14:00 shuttle" }
  ];
  const CHECKS = [
    { site: "DUB", tone: "warn", t: "SO-10496 Clondalkin Plumbing: tote 7.2 kg over the system weight", d: "11% over. Most likely a spare pack of M10 bolts. Re-check before it goes in lane 4.", btn: "Re-check at bench", key: "wh-weigh-10496", done: "Re-checked", rec: ["order", "SO-10496"] },
    { site: "DUB", tone: "warn", t: "SO-10482 Murphy: delivery docket still shows 18 lines", d: "Reprints as 15 of 18 with a balance docket for tomorrow once the partial is approved.", btn: "Approve partial", key: "so-partial", done: "Reprinted", rec: ["order", "SO-10482"] },
    { site: "DUB", tone: "bad", t: "SO-10510 Atlantic FM, Shannon: carrier portal rejected the label", d: "The delivery address has no Eircode. Gráinne Foley can get it from Lorraine Kinsella.", btn: "Ask Gráinne to call", key: "wh-eircode", done: "Requested", rec: ["customer", "atlantic"] },
    { site: "DUB", tone: "ok", t: "SO-10497 O'Brien, Cork: 24 × AD-7340 PU foam aerosols", d: "Limited-quantity labels printed and on the pallet network consignment.", rec: ["customer", "obrien"] },
    { site: "DUB", tone: "ok", t: "D14: 12 drops loaded to James Nolan's handheld for POD", d: "Signatures and photos post back to Sage 200 against each invoice.", rec: ["route", "D14"] },
    { site: "NAS", tone: "warn", t: "Naas shuttle: transfer note for 40 × EL-4408 not printed", d: "Waiting on the Naas to Dublin transfer approval.", btn: "Approve transfer", key: "dq-transfer", done: "Approved", rec: ["product", "EL-4408"] },
    { site: "NAS", tone: "ok", t: "N04 tomorrow: SO-10478 and SO-10518 dockets printed", d: "Colm Dunne's handheld loads the drops at 06:30.", rec: ["route", "N04"] }
  ];

  /* ---------------- goods in: what each delivery releases ---------------- */
  const GI = {
    "PO-8826": { bay: "Bay 1", sku: [["AD-7102", 456]], shortNote: "24 short", rel: "Replenishment only", tasks: 0, wave: "Put-away: 11 of 14 pallets done", cust: 0 },
    "PO-8834": { bay: "N-1", sku: [["FH-6602", 600]], rel: "FH-6602 short lines on 2 orders", tasks: 2, wave: "Naas pallet network, 14:30", cust: 2 },
    "PO-8829": { bay: "Bay 1", sku: [["FIX-2201", 500]], rel: "EuroFix lines on 3 orders, SO-10519 first", tasks: 3, wave: "Pallet network, 14:30", cust: 3 },
    "PO-8830": { bay: "Bay 1", sku: [["EL-4520", 12]], rel: "8 × EL-4520 for SO-10521, Horizon's Galway job", tasks: 1, wave: "Cross-dock to the 14:30 pallet network", cust: 1 },
    "PO-8839": { bay: "N-1", sku: [["SAF-1930", 400]], rel: "120 helmets on 2 orders, SO-10546 first", tasks: 2, wave: "Midland Merchants collection, 15:00", cust: 2 },
    "PO-8833": { bay: "N-1", sku: [["IC-3405", 1000]], rel: "90 gloves on 3 orders, SO-10551 first", tasks: 3, wave: "1 at Naas today, 2 on tomorrow's shuttle", cust: 3 },
    "PO-8832": { bay: "Bay 1", sku: [["TL-5120", 24]], rel: "14 drill kits on 2 orders", tasks: 2, wave: "Tomorrow's first runs: lands after the 14:30 cut-off", cust: 2 },
    "PO-8821": { bay: "Bay 1", pallets: 11, sku: [["EL-4408", 120], ["EL-4631", 400], ["IC-3310", 200]], rel: "10 short lines · Murphy, Horizon, Liffey +3", tasks: 11, wave: "Ahead of D14's first run", cust: 6 }
  };
  DB.goodsInToday.forEach((p) => { if (!GI[p.id]) console.warn("[PD data] warehouse goods in missing " + p.id); else if (GI[p.id].tasks !== p.deps && p.deps) chk(p.id + " pick tasks", GI[p.id].tasks, p.deps); });
  const GI_CHECKS = [
    { site: "DUB", tone: "bad", t: "Unreceived pallet in aisle A-22", d: "Dropped by the late shift with no receipt. Label matches Northgate PO-8818, 2 days late. It is blocking A-22-04 for SO-10486.", btn: "Book it in", key: "fix-SO-10486", done: "Booked in", rec: ["po", "PO-8818"] },
    { site: "DUB", tone: "warn", t: "PO-8826 Celtic: 24 × AD-7102 short", d: "Nothing waits on it (1,310 available), but the invoice will be for the full quantity.", btn: "Hold €56.40", key: "wh-8826", done: "Held", rec: ["po", "PO-8826"] },
    { site: "DUB", tone: "info", t: "PO-8829 EuroFix lands at the new cost", d: "FIX-2201 at €18.10 against €16.40. 37 price agreements are still on the old cost.", go: ["Cost changes", "Pricing & Margin", "Cost Changes"], rec: ["po", "PO-8829"] },
    { site: "NAS", tone: "bad", t: "PO-8834 Kerry: FH-6710 hand soap is not on it", d: "Kerry's van is here at 10:15 and nobody raised a PO for FH-6710. 7 orders are waiting.", btn: "Create PO", key: "po-fh6710", done: "PO drafted", rec: ["product", "FH-6710"] },
    { site: "NAS", tone: "warn", t: "Kerry delivery at 07:58 (PO-8819): 1 pallet damaged", d: "18 cases of FH-6602 wet, photos taken on the scanner. Driver signed the POD \"unchecked\".", btn: "Raise claim", key: "wh-kerry-claim", done: "Claimed", rec: ["supplier", "kerry"] }
  ];

  /* ---------------- pick faces the queue will empty ---------------- */
  const REPL = [
    ["FIX-2330", "B-04-06", "0 in face", "28 lines waiting, SO-10530", "Reserve R-18-3", "bad"],
    ["EL-4712", "D-12-01", "6 in face", "14 needed today", "Reserve R-09-2", "warn"],
    ["AD-7102", "B-15-02", "60 in face", "120 needed today", "PO-8826 pallets, bay 1", "warn"],
    ["IC-3120", "E-02-05", "48 in face", "36 needed today", "Enough", "ok"]
  ];

  /* ---------------- where each physical return sits ---------------- */
  const RET_WHERE = {
    "RMA-1196": ["Bay 5 · awaiting inspection", "warn", "2 days"],
    "RMA-1187": ["Bay 5 · awaiting inspection", "warn", "4 days"],
    "RMA-1192": ["Found in pick face D-08-02", "bad", "9 days"],
    "RMA-1199": ["Quarantine · for Atlas collection", "neutral", "3 days"],
    "RMA-1198": ["Quarantine · Atlas claim, batch 24-311", "neutral", "6 days"],
    "RMA-1193": ["Quarantine · back to Northgate", "neutral", "11 days"],
    "RMA-1190": ["Quarantine · back to Kerry", "neutral", "14 days"],
    "RMA-1184": ["Inspected · back to stock", "ok", "Closed"]
  };

  /* ---------------- shared bits ---------------- */
  const progress = (t, w) => {
    const pct = 100 * t.picked / t.lines;
    const tone = t.tone === "bad" ? "bad" : t.short ? "warn" : pct >= 100 ? "ok" : null;
    return h("div", { className: "pd-split", style: { gap: 7 } }, UI.Bar(pct, tone, { w: w || 60 }), h("span", { className: "pd-mono", style: { fontSize: 11 } }, t.picked + "/" + t.lines));
  };
  const custCell = (L, t) => h("span", null, L.cust(t.cust), t.dest ? h("span", { className: "pd-faint" }, " · " + t.dest) : null);

  /* ================================================================ CONTROL BOARD */
  const pickNow = (ctx, s) => {
    const all = tasks(ctx, s).filter((t) => t.st !== "waiting");
    const val = (t) => (DB.order(t.id) ? DB.order(t.id).value : 0);
    const sortCut = (a, b) => toMin(a.cut) - toMin(b.cut) || ST_ORDER[a.st] - ST_ORDER[b.st] || val(b) - val(a);
    let rs = all.filter((t) => ["D04·2", "D07·2", "D14", "SHUTTLE"].indexOf(t.wave) > -1).sort(sortCut);
    if (rs.length < 5) rs = rs.concat(all.filter((t) => t.wave === "COLLECT").sort(sortCut));
    return rs.slice(0, 8);
  };

  const staffBlock = (k) => {
    const x = WL[k], left = sum(PICKS.filter((t) => t.wh === k).map((t) => t.lines - t.picked));
    return h("div", { key: k, style: { marginBottom: 14 } },
      h("div", { className: "pd-split", style: { marginBottom: 8 } },
        h("span", { className: "pd-grow", style: { fontSize: 13, fontWeight: 500 } }, DB.warehouses[k].name),
        UI.Badge(x.pickersIn + " OF " + x.rostered + " PICKERS IN", x.pickersIn < x.rostered ? "warn" : "ok", true)),
      UI.Facts([
        ["On pick", String(x.onPick), null, x.onPick < x.pickersIn ? (x.pickersIn - x.onPick) + " on goods in" : "Everyone in"],
        ["Lines / picker / hr", String(x.rate), x.rate < x.std ? "warn" : null, "Standard " + x.std],
        ["Lines left", num(left), null, num(x.picked) + " picked"]
      ], 3),
      k === "DUB" ? UI.Note("Stephen Bolger off sick, Oisín Tracey on annual leave. Kevin Brady and Dean Cullen are helping Eoin Farrell on goods in.", { marginTop: 8 }) : null);
  };

  const projRow = (ctx, k, p, showSite) => {
    const done = p.key && ctx.done(p.key), tone = done ? "ok" : p.tone;
    return UI.Row({ key: k + p.cut + p.label, onClick: p.route ? () => ctx.open("route", p.route) : undefined }, [
      h("span", { className: "pd-mono", style: { width: 42, fontSize: 12, color: "var(--ink)", flex: "none" } }, p.cut),
      h("div", { className: "pd-grow" },
        h("div", { style: { fontSize: 12.5 } }, (showSite ? DB.warehouses[k].short + " · " : "") + p.label),
        h("div", { style: { fontSize: 11.5, marginTop: 2, color: tone === "bad" ? "var(--bad)" : tone === "warn" ? "var(--warn)" : "var(--dim)" } }, done ? p.doneT : p.t)),
      UI.Dot(tone)]);
  };

  function board(ctx) {
    const s = siteOf(ctx), L = PD.lk(ctx), w = wl(s), go = ctx.go;
    const title = s === "ALL" ? "Dublin Distribution Centre and Naas" : DB.warehouses[s].name;
    const nextCut = s === "NAS" ? "NEXT VAN CUT-OFF 13:30 · NAAS SHUTTLE" : "NEXT VAN CUT-OFF 11:30 · D04 RUN 2 · IN " + leftTxt("11:30").toUpperCase();

    const kpis = UI.Kpis([
      { label: "Orders to pick", value: String(w.orders), sub: s === "ALL" ? "Dublin " + WL.DUB.orders + " · Naas " + WL.NAS.orders + " · " + eur(w.value) : eur(w.value) + " on today's plan" },
      { label: "Lines", value: num(w.lines), sub: (s === "ALL" ? "Dublin " + num(WL.DUB.lines) + " · Naas " + WL.NAS.lines + " · " : "") + Math.round(100 * w.picked / w.lines) + "% picked" },
      { label: "Completed", value: String(w.done), sub: "Picked, packed and staged", subTone: "ok", onClick: () => go("Warehouse", "Packing") },
      { label: "Picking", value: String(w.picking), sub: w.onPick + " pickers on pick", onClick: () => go("Warehouse", "Picking") },
      { label: "Waiting", value: String(w.waiting), sub: "Queued or waiting on stock", onClick: () => go("Warehouse", "Picking") },
      { label: "Urgent", value: String(w.urgent), sub: "Short, blocked or left behind", tone: "bad", toneValue: true, onClick: () => go("Warehouse", "Exceptions") }
    ], "repeat(6,minmax(0,1fr))");

    const pn = pickNow(ctx, s);
    const pickNowCard = UI.Card({ flush: true, title: "Pick now", icon: "bolt", meta: "NEAREST VAN CUT-OFF FIRST", delay: 40, right: UI.Btn("Full queue", () => go("Warehouse", "Picking"), { sm: true, ghost: true }) },
      UI.Table({
        rows: pn, rowKey: (t) => t.id, onRow: (t) => openTask(ctx, t),
        rowTone: (t) => (t.tone === "bad" ? "bad" : t.tone === "warn" ? "warn" : null),
        cols: [
          { label: "Priority", w: "80px", render: (t) => UI.Risk(prio(t)) },
          { label: "Order", w: "86px", render: (t) => mono(t.id, true) },
          { label: "Customer", w: "minmax(150px,1.3fr)", ink: true, render: (t) => L.cust(t.cust) },
          { label: "Lines", w: "50px", r: true, num: true, render: (t) => t.lines },
          { label: "Available", w: "70px", r: true, num: true, render: (t) => h("span", { style: { color: t.short ? "var(--warn)" : "var(--body)" } }, t.lines - (t.short || 0)) },
          { label: "Picked", w: "104px", render: (t) => progress(t, 44) },
          { label: "Cut-off", w: "126px", render: (t) => deadline(t) },
          { label: "Left", w: "68px", render: (t) => h("span", { className: "pd-mono", style: { fontSize: 11.5, color: toMin(t.cut) - NOW < 150 ? "var(--warn)" : "var(--body)" } }, leftTxt(t.cut)) },
          { label: "Blocker", w: "minmax(190px,1.6fr)", render: (t) => t.issue ? h("span", { title: t.issue, style: { color: t.tone === "bad" ? "var(--bad)" : t.tone === "ok" ? "var(--ok)" : "var(--dim)" } }, t.issue) : faint("None") }
        ]
      }));

    const keys = siteKeys(s);
    const staffCard = UI.Card({ title: "Staffing against cut-offs", icon: "user", meta: "AT TODAY'S PICK RATE", delay: 80 }, [
      ...keys.map(staffBlock),
      UI.Label("Projected finish", { marginBottom: 2 }),
      ...keys.flatMap((k) => PROJ[k].filter((p) => s !== "ALL" || k === "DUB" || p.all).map((p) => projRow(ctx, k, p, s === "ALL")))
    ]);

    const ai = s === "NAS"
      ? UI.AI({ who: "Ops Watchdog", conf: "NAAS · 09:20", text: "Naas finishes today's picks by about 10:45. The pressure here is goods in: 154 pallets between 10:15 and 14:00, 78 of them on the Polska trailer at 13:00. Put two pickers on N-1 from 12:45, and get Glenview's two pallets onto the 14:00 shuttle so they reach Kildare town today.",
        actions: [decBtn(ctx, "wh-naas-gi", "Plan Naas goods in", "Planned", { pri: true }), decBtn(ctx, "fix-SO-10490", "Glenview on the shuttle", "On the shuttle")] })
      : UI.AI({ who: "Ops Watchdog", conf: "6 ORDERS DECIDE THE AFTERNOON", text: "Five of the six urgent orders are on D14. Book in the pallet at A-22-04 (its label matches Northgate PO-8818) and Brennan makes the van. Approve Murphy's partial so D14 leaves at 13:45: holding it gains nothing, Atlas is tomorrow. Today's waves make their cut-offs at 20 lines an hour; tomorrow's first-run pick does not, by about 50 minutes. Bring Kevin Brady and Dean Cullen back from goods in after the Hartmann tip.",
        actions: [decBtn(ctx, "fix-SO-10486", "Clear A-22-04", "Face cleared", { pri: true }), decBtn(ctx, "so-partial", "Approve Murphy partial", "Partial approved"), decBtn(ctx, "wh-staff", "Approve staffing plan", "Plan approved")] });

    // picking delayed
    const delayed = tasks(ctx, s).filter((t) => t.exp);
    const delayedCard = UI.Card({ title: "Picking delayed", icon: "clock", meta: delayed.length + " BEHIND TARGET", delay: 120 },
      delayed.length ? delayed.map((t) => UI.Row({ key: t.id, onClick: () => openTask(ctx, t), style: { alignItems: "flex-start" } }, [
        UI.Avatar(initials(who(t.who))),
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 12.5 } }, who(t.who), h("span", { className: "pd-faint" }, " · " + t.id + " · "), DB.custName(t.cust)),
          h("div", { style: { fontSize: 11.5, marginTop: 3, color: t.tone === "bad" ? "var(--bad)" : t.tone === "warn" ? "var(--warn)" : "var(--dim)" } }, t.issue),
          h("div", { className: "pd-meta", style: { marginTop: 4 } }, t.loc + " · TARGET " + t.target + " · NOW " + t.exp + " · " + deadline(t).toUpperCase()))])) : UI.Empty("Nobody is behind target."));

    // goods in
    const gi = DB.goodsInToday.filter((p) => inSite(s, p.wh)).slice().sort((a, b) => toMin(a.eta) - toMin(b.eta));
    const giCard = UI.Card({ title: "Goods in", icon: "box", meta: "EXPECTED TODAY", delay: 160, right: UI.Btn("Dock schedule", () => go("Warehouse", "Goods In"), { sm: true, ghost: true }) }, [
      UI.Facts([["Deliveries", String(gi.length), null, gi.filter((p) => p.received).length + " received"], ["Pallets", num(sum(gi.map((p) => p.pallets)))], ["Value", eur(sum(gi.map((p) => p.value)))]], 3),
      h("div", { style: { marginTop: 6 } }, ...gi.map((p) => UI.Row({ key: p.id, onClick: () => ctx.open("po", p.id) }, [
        h("span", { className: "pd-mono", style: { width: 40, fontSize: 12, color: "var(--ink)", flex: "none" } }, p.eta),
        h("div", { className: "pd-grow" }, h("div", { className: "pd-ell", style: { fontSize: 12.5 } }, DB.supplier(p.supplier).name), h("div", { className: "pd-meta", style: { marginTop: 2 } }, p.id + " · " + p.pallets + " PALLETS · " + DB.warehouses[p.wh].short.toUpperCase())),
        p.received ? UI.Badge("24 SHORT", "warn", true) : p.deps ? UI.Badge("RELEASES " + p.deps, "info", true) : null]))),
      inSite(s, "DUB") ? UI.Row({ onClick: () => ctx.open("po", "PO-8821") }, [
        h("span", { className: "pd-mono", style: { width: 40, fontSize: 12, color: "var(--bad)", flex: "none" } }, "10:30"),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, "Atlas · PO-8821 · " + relLower(D(1))), h("div", { className: "pd-meta", style: { marginTop: 2 } }, "14 SKUS · 6 ORDERS WAITING · 5 DAYS LATE")),
        UI.Risk("CRITICAL")]) : null
    ]);

    // dispatch
    const vans = ["D04·2", "D07·2", "D14"].map(DB.route).filter((r) => inSite(s, r.wh));
    const bayOf = { "D04·2": "Bay 2", "D07·2": "Bay 3", D14: "Bay 4" };
    const departed = DB.routes.filter((r) => /On route/.test(r.status) && inSite(s, r.wh));
    const dispCard = UI.Card({ title: "Dispatch", icon: "truck", meta: "VEHICLES AT THE BAYS", delay: 200, right: UI.Btn("Bays", () => go("Warehouse", "Dispatch"), { sm: true, ghost: true }) }, [
      ...vans.map((r) => { const st = routeStatus(ctx, r); return UI.Row({ key: r.id, onClick: () => ctx.open("route", r.id) }, [
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 13, fontWeight: 500 } }, "Route " + rLabel(r.id), h("span", { className: "pd-faint", style: { fontWeight: 400, fontSize: 12 } }, " · " + r.stops + (r.stops === 1 ? " drop" : " drops") + " · " + eur(r.value))),
          h("div", { className: "pd-meta", style: { marginTop: 3 } }, bayOf[r.id].toUpperCase() + " · " + DB.person(r.driver).toUpperCase() + " · DEPARTS " + r.depart)),
        UI.Badge(st, statusTone(st))]); }),
      inSite(s, "NAS") ? UI.Row({ onClick: () => go("Warehouse", "Dispatch") }, [
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 13, fontWeight: 500 } }, "Naas shuttle", h("span", { className: "pd-faint", style: { fontWeight: 400, fontSize: 12 } }, " · Glenview + EL-4408 transfer")), h("div", { className: "pd-meta", style: { marginTop: 3 } }, "N-3 · GAVIN BYRNE · DEPARTS 14:00")),
        UI.Badge(ctx.done("fix-SO-10490") ? "Staged" : "Staging", "info")]) : null,
      UI.Note("Departed this morning: " + departed.length + " routes, " + sum(departed.map((r) => r.stops)) + " drops. " + (inSite(s, "DUB") ? "Still to leave: " + sum(vans.map((r) => r.stops)) + " drops. SO-10501 missed the D09 cut-off by five minutes." : "N06 left 2 pallets for Glenview behind."), { marginTop: 10 })
    ]);

    // lines per hour
    const HR = { DUB: [140, 190, 194, 180], NAS: [44, 70, 74, 72] }, PLAN = { DUB: 264, NAS: 90 };
    const hv = [0, 1, 2, 3].map((i) => sum(keys.map((k) => HR[k][i])));
    const plan = sum(keys.map((k) => PLAN[k]));
    const chart = UI.Card({ title: "Lines picked per hour", icon: "spark", meta: "AGAINST PLAN", delay: 240 }, [
      UI.Columns(hv.map((v, i) => ({ l: ["06:00", "07:00", "08:00", "Now"][i], v, d: String(v), hi: i === 3 })), { h: 140, showValues: true, target: plan, targetLabel: "PLAN " + plan + "/HR", max: Math.round(plan * 1.12) }),
      UI.Note(s === "NAS" ? "Naas is at 80% of plan: pickers are also loading and covering goods in." : "Dublin is at 72% of plan since 07:00: two pickers out, two on goods in, and aisle A-22 blocked since 08:25. \"Now\" is the rate over the last 20 minutes.", { marginTop: 10 })
    ]);

    // exceptions
    const ex = EXC.filter((e) => inSite(s, e.site) && !ctx.done(e.key)).sort((a, b) => (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1)).slice(0, 6);
    const exCard = UI.Card({ title: "Exceptions", icon: "alert", meta: EXC.filter((e) => inSite(s, e.site) && !ctx.done(e.key)).length + " OPEN", delay: 280, right: UI.Btn("All", () => go("Warehouse", "Exceptions"), { sm: true, ghost: true }) },
      ex.length ? ex.map((e) => UI.Row({ key: e.ref, onClick: () => openRec(ctx, e.rec), style: { alignItems: "flex-start" } }, [
        UI.Dot(e.tone),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, e.what), h("div", { className: "pd-meta", style: { marginTop: 3 } }, e.type.toUpperCase() + " · " + e.ref + " · " + DB.person(e.owner).toUpperCase() + " · " + e.age.toUpperCase()))])) : UI.Empty("Nothing open."));

    // floor feed
    const feed = UI.Card({ title: "Floor feed", icon: "clock", meta: "WMS · SCALES · TRANSPORT", delay: 320 },
      UI.Feed(FEED.filter((f) => inSite(s, f[1])).slice(0, 8).map((f) => ({ t: f[0], tone: f[3], src: f[4], text: [f[2][0], B(f[2][1]), f[2][2]], onClick: () => openRec(ctx, f[5]) }))));

    return UI.Page({
      kicker: "Warehouse · control board · " + weekday + " " + dm(PD.date.TODAY), live: "LIVE FROM THE WMS · 09:20 · " + nextCut,
      title,
      sub: "What has to leave today, what is stuck and who is on the floor. Updates as pickers scan.",
      actions: [siteTabs(ctx), UI.Btn("Ask Pulse", () => ctx.ask("What orders are likely to go late?"), { icon: "spark", ghost: true })],
      children: [
        kpis,
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [pickNowCard, h("div", null, staffCard, gap(), ai)]),
        UI.Grid("repeat(3,minmax(0,1fr))", [delayedCard, giCard, dispCard]),
        UI.Grid("minmax(0,1fr) minmax(0,1.1fr) minmax(0,1.1fr)", [chart, exCard, feed])
      ]
    });
  }

  /* ================================================================ PICKING */
  function picking(ctx) {
    const s = siteOf(ctx), L = PD.lk(ctx), w = wl(s), go = ctx.go;
    const all = tasks(ctx, s);
    const cnt = (fn) => all.filter(fn).length;
    const FL = {
      all: () => true, urgent: (t) => t.st === "urgent", picking: (t) => t.st === "picking", waiting: (t) => t.st === "waiting",
      vans: (t) => ["D04·2", "D07·2", "D14", "SHUTTLE"].indexOf(t.wave) > -1, COLLECT: (t) => t.wave === "COLLECT", PALLET: (t) => t.wave === "PALLET"
    };
    const F = [["all", "All", all.length], ["urgent", "Urgent", cnt(FL.urgent)], ["picking", "Picking", cnt(FL.picking)], ["waiting", "Waiting", cnt(FL.waiting)],
      ["vans", "Van runs", cnt(FL.vans)], ["COLLECT", "Collections", cnt(FL.COLLECT)], ["PALLET", "Pallet network", cnt(FL.PALLET)]].filter((f) => f[2] > 0);
    const f = FL[ctx.st.whPickF] ? ctx.st.whPickF : "all";
    const rows = all.filter(FL[f]).sort(bySeq);
    const left = sum(rows.map((t) => t.lines - t.picked));
    const onStock = all.filter((t) => t.po);
    const rate = s === "ALL" ? (WL.DUB.rate * WL.DUB.onPick + WL.NAS.rate * WL.NAS.onPick) / (WL.DUB.onPick + WL.NAS.onPick) : WL[s].rate;

    const table = UI.Card({ flush: true, title: rows.length + " orders · " + num(left) + " lines left", meta: "SEQUENCED BY CUT-OFF · CLICK A ROW TO OPEN IT", delay: 60 }, [
      UI.Table({
        rows, rowKey: (t) => t.id, onRow: (t) => openTask(ctx, t),
        rowTone: (t) => (t.tone === "bad" ? "bad" : t.st === "urgent" && t.tone === "warn" ? "warn" : null),
        cols: [
          { label: "Priority", w: "80px", render: (t) => UI.Risk(prio(t)) },
          { label: "Order", w: "86px", render: (t) => mono(t.id, true) },
          { label: "Customer", w: "minmax(210px,1.6fr)", ink: true, render: (t) => custCell(L, t) },
          { label: "Lines", w: "50px", r: true, num: true, render: (t) => t.lines },
          { label: "Pick location", w: "124px", render: (t) => h("span", { className: "pd-mono", style: { fontSize: 11.5, color: t.tone === "bad" ? "var(--bad)" : "var(--body)" } }, t.loc) },
          { label: "Assigned", w: "140px", render: (t) => (t.who ? who(t.who) : faint("Queued")) },
          { label: "Started", w: "64px", render: (t) => (t.start ? mono(t.start) : faint("None")) },
          { label: "Target", w: "58px", render: (t) => h("span", { className: "pd-mono", style: { fontSize: 12, color: t.exp ? "var(--warn)" : "var(--body)" } }, t.target) },
          { label: "Progress", w: "112px", render: (t) => progress(t, 50) },
          { label: "Dispatch deadline", w: "150px", render: (t) => (DB.route(t.wave) ? L.route(t.wave, deadline(t)) : deadline(t)) },
          { label: "Issue", w: "minmax(230px,2fr)", render: (t) => t.issue ? h("span", { title: t.issue, style: { color: t.tone === "bad" ? "var(--bad)" : t.tone === "ok" ? "var(--ok)" : t.tone === "warn" ? "var(--warn)" : "var(--dim)" } }, t.issue) : t.wait ? h("span", { className: "pd-faint", title: t.wait }, t.wait) : faint("None") }
        ],
        empty: "No orders in this view.",
        foot: "Completed today: " + w.done + " orders, on the Packing page. Waiting orders are released to a picker as stock lands or a picker frees up."
      })
    ]);

    // pickers
    const pk = PICKERS.filter((p) => inSite(s, p.site)).map((p) => Object.assign({}, p, p.k === "DQ" && ctx.done("fix-SO-10486") ? { st: "Picking", now: "Back on SO-10486, face cleared" } : null));
    const stTone = { Picking: "ok", Blocked: "bad", "Goods in": "neutral", "Off sick": "warn", "Annual leave": "neutral" };
    const pickers = UI.Card({ flush: true, title: "Pickers on the floor", meta: siteKeys(s).map((k) => DB.warehouses[k].short.toUpperCase() + " " + WL[k].pickersIn + " OF " + WL[k].rostered + " IN").join(" · "), delay: 100 }, UI.Table({
      rows: pk, rowKey: (p) => p.k,
      cols: [
        { label: "Picker", w: "minmax(160px,1.2fr)", ink: true, render: (p) => h("span", { className: "pd-split", style: { gap: 8 } }, UI.Avatar(initials(who(p.k))), who(p.k)) },
        { label: "Site", w: "64px", render: (p) => DB.warehouses[p.site].short },
        { label: "Doing now", w: "minmax(200px,1.8fr)", render: (p) => h("span", { title: p.now }, p.now) },
        { label: "Tasks", w: "52px", r: true, num: true, render: (p) => { const n = PICKS.filter((t) => t.who === p.k).length; return n || faint("None"); } },
        { label: "Lines today", w: "82px", r: true, num: true, render: (p) => (p.today ? p.today : faint("None")) },
        { label: "Lines / hr", w: "112px", render: (p) => p.rate ? h("div", { className: "pd-split", style: { gap: 7 } }, UI.Bar(100 * p.rate / WL[p.site].std, p.rate < WL[p.site].std * 0.75 ? "bad" : p.rate < WL[p.site].std ? "warn" : "ok", { w: 50 }), h("span", { className: "pd-mono", style: { fontSize: 11 } }, p.rate + "/" + WL[p.site].std)) : faint("None") },
        { label: "Status", w: "104px", render: (p) => UI.Badge(p.st, stTone[p.st] || "neutral") }
      ]
    }));

    const repl = UI.Card({ title: "Pick faces the queue will empty", icon: "shelf", meta: "REPLENISH BEFORE THE PICKER GETS THERE", delay: 140 }, [
      ...REPL.filter(() => inSite(s, "DUB")).map((r) => UI.Row({ key: r[0], onClick: () => ctx.open("product", r[0]) }, [
        UI.Dot(ctx.done("wh-replen") && r[5] !== "ok" ? "ok" : r[5]),
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 12.5 } }, (DB.product(r[0]) || { name: r[0] }).name, h("span", { className: "pd-faint" }, " · " + r[0])),
          h("div", { className: "pd-meta", style: { marginTop: 3 } }, r[1] + " · " + r[2].toUpperCase() + " · " + r[3].toUpperCase() + " · " + r[4].toUpperCase()))])),
      inSite(s, "DUB") ? h("div", { style: { marginTop: 12 } }, decBtn(ctx, "wh-replen", "Release 3 forklift drops", "Drops released", { pri: true })) : UI.Empty("Naas pick faces cover today's queue.")
    ]);

    const ai = UI.AI({ who: "Ops Watchdog", conf: "RE-SEQUENCED 09:18", text: s === "NAS"
      ? "Naas picks are in order and finish around 10:45. Two orders can't start until stock lands: SO-10546 waits on Polska's helmets at 13:00 and SO-10551 on SafePro's gloves at 14:00, half an hour before the pallet network cut-off. Pulse will release both the minute they are booked in."
      : "Sequenced by cut-off, three changes. Put Rūta Kazlauskienė with Jason Kinsella on SO-10491 for the trunking, so D07 run 2 isn't waiting at 12:15. Keep Darren Quinn on SO-10496 until A-22-04 is cleared. Nobody walks to D-14-03, D-11-08 or D-21-02 again today: those bins are empty or wrong until PO-8821 or the recount.",
      actions: [decBtn(ctx, "wh-reseq", "Apply sequence", "Sequence applied", { pri: true }), s === "NAS" ? UI.Btn("Goods in", () => go("Warehouse", "Goods In"), { sm: true }) : decBtn(ctx, "wh-10491-help", "Send Rūta to SO-10491", "Rūta sent"), UI.Btn("What will go late?", () => ctx.ask("What orders are likely to go late?"), { sm: true, ghost: true, icon: "spark" })] });

    return UI.Page({
      kicker: "Warehouse · picking", live: "WMS · SCANS LIVE · 09:20",
      title: w.open + " orders in the pick queue, " + num(w.left) + " lines left",
      sub: "Sequenced by dispatch cut-off. Short and blocked lines are flagged before a picker walks to an empty bin.",
      actions: [siteTabs(ctx)],
      children: [
        UI.Kpis([
          { label: "Lines left", value: num(w.left), sub: num(w.picked) + " of " + num(w.lines) + " picked" },
          { label: "Short or blocked lines", value: String(w.blocked), sub: "On " + w.urgent + " urgent orders", tone: "bad", toneValue: true, onClick: () => go("Warehouse", "Exceptions") },
          { label: "Pickers on pick", value: String(w.onPick), sub: "of " + w.pickersIn + " in · " + w.rostered + " rostered", tone: w.pickersIn < w.rostered ? "warn" : null },
          { label: "Pick rate", value: (Math.round(rate * 10) / 10) + " /hr", sub: s === "ALL" ? "Per picker · Dublin 20, Naas 15" : "Per picker · standard " + WL[s].std, subTone: "warn" },
          { label: "Waiting on goods in", value: onStock.length + (onStock.length === 1 ? " order" : " orders"), sub: onStock.map((t) => t.po).join(" · "), onClick: () => go("Warehouse", "Goods In") }
        ]),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } }, UI.Chips(F, f, (v) => ctx.set({ whPickF: v }))),
        table,
        gap(),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [pickers, h("div", null, ai, gap(), repl)])
      ]
    });
  }

  /* ================================================================ PACKING */
  function packing(ctx) {
    const s = siteOf(ctx), L = PD.lk(ctx), w = wl(s), go = ctx.go;
    const rows = PACK.filter((p) => inSite(s, p.site));
    const todayRows = rows.filter((p) => !p.tomorrow);
    const built = sum(todayRows.map((p) => p.built)), plan = sum(todayRows.map((p) => p.plan));
    const awaiting = AWAIT.filter((a) => inSite(s, a.site));
    const checks = CHECKS.filter((c) => inSite(s, c.site));
    const flagged = checks.filter((c) => c.tone !== "ok" && !(c.key && ctx.done(c.key))).length;
    const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

    const table = UI.Card({ flush: true, title: "Packing by route and bay", meta: "PALLETS BUILT AGAINST THE LOAD PLAN", delay: 60 }, UI.Table({
      rows, rowKey: (p) => p.label + p.bay,
      onRow: (p) => (p.route ? ctx.open("route", p.route) : go("Warehouse", "Dispatch")),
      rowTone: (p) => (p.docsTone === "bad" && !(p.docsKey && ctx.done(p.docsKey)) ? "bad" : null),
      cols: [
        { label: "Route", w: "minmax(150px,1.1fr)", ink: true, render: (p) => (p.route ? L.route(p.route, p.label) : p.label) },
        { label: "Bay", w: "64px", render: (p) => mono(p.bay) },
        { label: "Orders", w: "58px", r: true, num: true, render: (p) => p.orders },
        { label: "Pallets built", w: "150px", render: (p) => h("div", { className: "pd-split", style: { gap: 7 } }, UI.Bar(100 * p.built / p.plan, p.built >= p.plan ? "ok" : null, { w: 64 }), h("span", { className: "pd-mono", style: { fontSize: 11 } }, f1(p.built) + " / " + f1(p.plan))) },
        { label: "Weight", w: "136px", r: true, num: true, render: (p) => num(p.kg) + " / " + num(p.kgPlan) + " kg" },
        { label: "Labels", w: "150px", render: (p) => p.labels },
        { label: "Paperwork", w: "minmax(220px,1.6fr)", render: (p) => { const done = p.docsKey && ctx.done(p.docsKey); return h("span", { style: { color: done ? "var(--ok)" : p.docsTone ? toneFg(p.docsTone) : "var(--body)" } }, done ? p.docsDone : p.docs); } },
        { label: "Status", w: "140px", render: (p) => UI.Badge(p.status, p.tone) }
      ],
      foot: "Pallet network pallets are capped at 1,000 kg and 1.8 m. D14 is loaded in reverse drop order: Northside first, Core Facilities last."
    }));

    const awaitCard = UI.Card({ flush: true, title: "Packed, waiting for a vehicle", meta: awaiting.length + " ORDERS · " + f1(sum(awaiting.map((a) => a.pal))) + " PALLETS", delay: 100 }, UI.Table({
      rows: awaiting, rowKey: (a) => a.id, onRow: (a) => ctx.open("order", a.id),
      rowTone: (a) => (a.tone === "bad" && !(a.key && ctx.done(a.key)) ? "bad" : null),
      cols: [
        { label: "Order", w: "86px", render: (a) => mono(a.id, true) },
        { label: "Customer", w: "minmax(150px,1.3fr)", ink: true, render: (a) => L.cust(DB.order(a.id).cust) },
        { label: "Where", w: "108px", render: (a) => a.where },
        { label: "Packed", w: "60px", render: (a) => mono(a.packed) },
        { label: "Pallets", w: "58px", r: true, num: true, render: (a) => f1(a.pal) },
        { label: "Goes on", w: "minmax(150px,1.2fr)", render: (a) => a.forV },
        { label: "Note", w: "minmax(180px,1.4fr)", render: (a) => { const done = a.key && ctx.done(a.key); return h("span", { style: { color: done ? "var(--ok)" : toneFg(a.tone === "ok" ? null : a.tone) } }, done ? a.doneNote : a.note); } }
      ]
    }));

    const checkCard = UI.Card({ title: "Checks before the van", icon: "shield", meta: flagged + " TO SORT", delay: 140 },
      checks.map((c, i) => {
        const done = c.key && ctx.done(c.key);
        return UI.Row({ key: i, onClick: () => openRec(ctx, c.rec), style: { alignItems: "flex-start" } }, [
          h("span", { style: { marginTop: 5 } }, UI.Dot(done ? "ok" : c.tone)),
          h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, c.t), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3, lineHeight: 1.5, whiteSpace: "normal" } }, c.d)),
          c.key ? decBtn(ctx, c.key, c.btn, c.done) : null]);
      }));

    const d14 = inSite(s, "DUB") ? UI.Card({ title: "D14 load", icon: "truck", meta: "232-D-18420 · 7.5T BOX, TAIL-LIFT", delay: 180, onClick: () => ctx.open("route", "D14") }, [
      UI.Split([{ label: "Built", v: 5.2, color: "var(--accent)", d: "5.2" }, { label: "Still to build", v: 3.4, color: "var(--accent-hover)", d: "3.4" }, { label: "Free", v: 1.4, color: "var(--track)", d: "1.4" }]),
      h("div", { style: { marginTop: 12 } }, UI.Facts([["Pallet spaces", "8.6 of 10"], ["Weight planned", "2,412 kg", null, "Payload 2,650 kg"], ["Payload", "91%", "warn"], ["Drops", "12"]], 4)),
      UI.Note("Murphy's 3 short lines add 0.4 of a pallet tomorrow. Nothing else fits today without leaving a drop behind.", { marginTop: 10 })
    ]) : UI.Card({ title: "Naas shuttle load", icon: "truck", meta: "221-KE-9936 · DEPARTS 14:00", delay: 180 }, [
      UI.Split([{ label: "Glenview", v: 2, color: "var(--accent)", d: "2 pallets" }, { label: "EL-4408 transfer", v: 1, color: "var(--accent-hover)", d: ctx.done("dq-transfer") ? "1 pallet, approved" : "1 pallet, if approved" }, { label: "Free", v: 7, color: "var(--track)", d: "7" }]),
      UI.Note("Room for Dublin's share of the SafePro gloves, but SafePro lands at 14:00 as the shuttle leaves. They go on tomorrow's run.", { marginTop: 10 })
    ]);

    const ai = UI.AI({ who: "Dispatch Agent", text: s === "NAS"
      ? "Everything Naas has packed is waiting on a vehicle, not on the floor. Glenview goes on the 14:00 shuttle; Core Facilities and Kelleher on N04 at 07:15. Mark Ryan's request to move Kelleher to D14 would mean shuttling it to Dublin and back out to Newbridge for a delivery N04 makes by 08:10 anyway."
      : "D14 is planned at 8.6 pallets and 91% of payload, so there is room for Murphy's balance tomorrow and nothing else today. Build it in reverse drop order and keep the front of lane 4 for Brennan's 3 lines: they come off A-22-04 last. Southside DIY is packed and sitting at bay 3; D07 run 2 can take it at 12:30.",
      actions: s === "NAS"
        ? [decBtn(ctx, "fix-SO-10490", "Glenview on the shuttle", "On the shuttle", { pri: true }), decBtn(ctx, "wh-10518", "Keep Kelleher on N04", "Kept on N04")]
        : [decBtn(ctx, "so-partial", "Approve Murphy partial", "Partial approved", { pri: true }), decBtn(ctx, "fix-SO-10501", "Southside on D07 run 2", "Added"), UI.Btn("Open D14", () => ctx.open("route", "D14"), { sm: true, ghost: true })] });

    return UI.Page({
      kicker: "Warehouse · packing", live: "WMS · SCALES · 09:20",
      title: f1(built) + " of " + f1(plan) + " pallets built for this afternoon's vehicles",
      sub: "Packing by bay and route: pallets against the load plan, labels, dockets, check-weighs, and what is packed but still waiting for a van.",
      actions: [siteTabs(ctx)],
      children: [
        UI.Kpis([
          { label: "Packed today", value: String(w.done) + " orders", sub: s === "ALL" ? "Dublin " + WL.DUB.done + " · Naas " + WL.NAS.done : "Picked, packed, staged", subTone: "ok" },
          { label: "Pallets built", value: f1(built) + " / " + f1(plan), sub: Math.round(100 * built / plan) + "% of this afternoon's load plan" },
          { label: "Packed, no vehicle yet", value: String(awaiting.length), sub: f1(sum(awaiting.map((a) => a.pal))) + " pallets on the dock" },
          { label: "Checks to sort", value: String(flagged), sub: "Weight, dockets, labels", tone: flagged ? "warn" : "ok", toneValue: true },
          inSite(s, "DUB") ? { label: "D14 payload", value: "91%", sub: "2,412 of 2,650 kg · 8.6 of 10 spaces", tone: "warn", onClick: () => ctx.open("route", "D14") } : { label: "Shuttle space", value: "7 free", sub: "of 10 pallet spaces at 14:00" }
        ]),
        table,
        gap(),
        UI.Grid("minmax(0,1.45fr) minmax(0,1fr)", [awaitCard, checkCard]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [d14, ai])
      ]
    });
  }

  /* ================================================================ GOODS IN */
  function BookInSim(p) {
    const [step, setStep] = R.useState(p.done ? 5 : -1);
    R.useEffect(() => {
      if (step < 0 || step >= 5) return undefined;
      const t = setTimeout(() => setStep(step + 1), 650);
      return () => clearTimeout(t);
    }, [step]);
    R.useEffect(() => { if (step === 5 && !p.done && p.onDone) p.onDone(); }, [step]);
    const nodes = p.nodes.map((n, i) => Object.assign({}, n, { tone: step > i ? (n.warn ? "warn" : "ok") : step === i ? "info" : null }));
    return h("div", null,
      UI.HChain(nodes, { stagger: 0 }),
      h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" } },
        UI.Btn(step >= 5 ? p.doneLabel : step >= 0 ? "Booking in…" : p.label, () => { if (step < 0) setStep(0); }, { pri: step < 0, sm: true, icon: "bolt", done: step >= 5, doneLabel: p.doneLabel }),
        h("span", { className: "pd-note" }, p.note)));
  }

  const simNodes = (ctx, p) => {
    const g = GI[p.id], atlas = p.id === "PO-8821";
    return [
      { k: "Goods received", t: (g.pallets || p.pallets) + " pallets at " + g.bay, d: p.items + " SKUs checked against the PO" + (g.shortNote ? " · " + g.shortNote : ""), warn: !!g.shortNote, onClick: () => ctx.open("po", p.id) },
      { k: "Inventory updated", t: g.sku.map((x) => x[0] + " +" + num(x[1])).join(" · "), d: "Sage 200 and the WMS, " + DB.warehouses[p.wh].short, onClick: () => ctx.open("product", g.sku[0][0]) },
      { k: "Backorders released", t: p.deps ? (atlas ? p.deps + " orders · " + eur(p.depValue) : p.deps + (p.deps === 1 ? " order" : " orders")) : "Nothing waiting", d: g.rel, onClick: () => ctx.go("Orders", "Backorders") },
      { k: "Pick tasks created", t: g.tasks ? g.tasks + (g.tasks === 1 ? " pick task" : " pick tasks") : "No pick tasks", d: g.wave, onClick: () => ctx.go("Warehouse", "Picking") },
      { k: "Customers updated", t: g.cust ? g.cust + (g.cust === 1 ? " email sent" : " emails sent") : "No one to tell", d: g.cust ? "From each account manager's Outlook" : "Replenishment stock only", onClick: () => ctx.go("Orders", "Backorders") }
    ];
  };

  function goodsIn(ctx) {
    const s = siteOf(ctx), L = PD.lk(ctx), go = ctx.go;
    const today = DB.goodsInToday.filter((p) => inSite(s, p.wh)).slice().sort((a, b) => toMin(a.eta) - toMin(b.eta));
    const atlas = DB.po("PO-8821"), showAtlas = inSite(s, "DUB");
    const tbl = today.concat(showAtlas ? [atlas] : []);
    const sel = tbl.some((p) => p.id === ctx.st.giSel) ? ctx.st.giSel : showAtlas ? "PO-8821" : today[0].id;
    const selPo = DB.po(sel);
    const pallets = sum(today.map((p) => p.pallets)), value = sum(today.map((p) => p.value)), deps = sum(today.map((p) => p.deps));
    const where = s === "ALL" ? "" : s === "DUB" ? " into Dublin" : " into Naas";
    const simKey = sel === "PO-8821" ? "po-recv" : "gi-" + sel;
    const siteSplit = (f) => "Dublin " + num(sum(DB.goodsInToday.filter((p) => p.wh === "DUB").map(f))) + " · Naas " + num(sum(DB.goodsInToday.filter((p) => p.wh === "NAS").map(f)));

    const statusBadge = (p) => {
      if (p.id === "PO-8821") return UI.Badge("Late " + p.lateDays + " days", "bad");
      if (p.received) return UI.Badge(p.status, "warn");
      if (ctx.done("gi-" + p.id)) return UI.Badge("Booked in", "ok");
      if (toMin(p.eta) - NOW <= 60) return UI.Badge("Next · on the road", "info");
      return UI.Badge("Booked slot", "neutral");
    };

    const table = UI.Card({ flush: true, title: "Dock schedule", meta: "SLOTS, PALLETS AND WHAT EACH DELIVERY RELEASES", delay: 60 }, UI.Table({
      rows: tbl, rowKey: (p) => p.id, onRow: (p) => ctx.open("po", p.id), sel: (p) => p.id === sel,
      rowTone: (p) => (p.id === "PO-8821" ? "bad" : p.received ? "warn" : null),
      cols: [
        { label: "Slot", w: "94px", render: (p) => h("span", { className: "pd-mono", style: { fontSize: 12, color: p.id === "PO-8821" ? "var(--bad)" : "var(--ink)" } }, (p.expected ? rel(D(p.expected)) + " " : "") + p.eta) },
        { label: "PO", w: "80px", render: (p) => L.po(p.id) },
        { label: "Supplier", w: "minmax(160px,1.3fr)", ink: true, render: (p) => L.sup(p.supplier) },
        { label: "Bay", w: "86px", render: (p) => DB.warehouses[p.wh].short + " · " + GI[p.id].bay.replace("Bay ", "") },
        { label: "Pallets", w: "58px", r: true, num: true, render: (p) => GI[p.id].pallets || p.pallets },
        { label: "SKUs", w: "50px", r: true, num: true, render: (p) => p.items },
        { label: "Value", w: "84px", r: true, num: true, render: (p) => eur(p.value) },
        { label: "Status", w: "150px", render: statusBadge },
        { label: "Releases", w: "minmax(220px,1.8fr)", render: (p) => (p.deps ? h("span", { title: GI[p.id].rel }, GI[p.id].rel) : faint(GI[p.id].rel)) },
        { label: "", w: "104px", render: (p) => UI.Btn(p.id === sel ? "Showing" : "Show chain", () => ctx.set({ giSel: p.id }), { sm: true, ghost: p.id !== sel }) }
      ],
      foot: "Pallet counts come from the supplier's advance notice; PO-8821's is Pulse's estimate from the PO lines."
    }));

    const side = showAtlas ? UI.Card({ title: "PO-8821 · Atlas · " + relLower(D(1)) + " 10:30", icon: "alert", alert: "bad", meta: "CRITICAL", delay: 100 }, [
      UI.Facts([["Slot", rel(D(1)) + " 10:30", null, "Bay 1"], ["Late", "5 days", "bad", "Second date change 09:04"], ["Orders waiting", "6", "bad", eur(atlas.depValue)], ["SKUs", "14", null, "3 at zero cover"], ["Pallets", "11", null, "Estimate"], ["Value", eur(atlas.value)]], 3),
      UI.P(["EL-4408, EL-4631 and IC-3310 are the lines customers are waiting on. Eoin Farrell and two pickers are booked on bay 1 from 10:15 so the short lines are picked the moment they are scanned, not after put-away."], { marginTop: 12 }),
      h("div", { style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" } },
        decBtn(ctx, "dq-expedite", "Expedite for €420", "Expedite requested", { pri: true }),
        UI.Btn("Open PO-8821", () => ctx.open("po", "PO-8821"), { sm: true }),
        UI.Btn("What depends on Atlas?", () => ctx.ask("What orders depend on Atlas?"), { sm: true, ghost: true, icon: "spark" }))
    ]) : UI.Card({ title: "Naas goods in today", icon: "box", meta: "154 PALLETS · 3 DELIVERIES", delay: 100, alert: "warn" }, [
      UI.Facts([["Pallets", "154"], ["Busiest slot", "13:00", "warn", "Polska, 78 pallets"], ["Team", "2 + Aoife", null, "2 pickers free from 12:45"]], 3),
      UI.P(["The Polska trailer is a two-and-a-half-hour tip for one team, and SafePro backs in at 14:00 behind it. Naas picks finish around 10:45, so two pickers can move to N-1 without touching a cut-off."], { marginTop: 12 }),
      h("div", { style: { marginTop: 12 } }, decBtn(ctx, "wh-naas-gi", "Move 2 pickers to N-1", "Planned", { pri: true }))
    ]);

    const sim = UI.Card({ title: "When stock lands, the chain runs itself", icon: "bolt", meta: "GOODS RECEIVED → CUSTOMERS UPDATED · " + sel, delay: 140 }, [
      h("div", { style: { marginBottom: 12 } }, UI.Chips(tbl.map((p) => [p.id, p.id + " · " + DB.supplier(p.supplier).name.split(" ")[0]]), sel, (v) => ctx.set({ giSel: v }))),
      h(BookInSim, {
        key: sel, nodes: simNodes(ctx, selPo), done: selPo.received || ctx.done(simKey),
        label: selPo.received ? "Received" : "Simulate book-in", doneLabel: selPo.received ? "Received · " + GI[sel].shortNote : "Book-in simulated",
        note: selPo.received ? "Booked in by Eoin Farrell. The short 24 are held off the invoice, not chased by phone." : "What happens the moment " + sel + " is scanned at " + GI[sel].bay + ". Nobody has to tell anyone.",
        onDone: () => (sel === "PO-8821" ? act(ctx, "po-recv") : ctx.act(simKey, sel + " booked in (simulated)", GI[sel].tasks + " pick tasks created, " + GI[sel].cust + " customers updated."))
      })
    ]);

    const hours = [9, 10, 11, 12, 13, 14, 15];
    const byHr = (hr, wh) => sum(DB.goodsInToday.filter((p) => p.wh === wh && Math.floor(toMin(p.eta) / 60) === hr).map((p) => p.pallets));
    const keys = siteKeys(s);
    const chart = UI.Card({ title: "Pallets arriving by hour", icon: "spark", meta: "WHEN GOODS IN NEEDS HANDS", delay: 180 }, [
      UI.Stacked(hours.map((hr) => ({ l: hr + ":00", parts: keys.map((k) => byHr(hr, k)) })), keys.map((k) => (k === "DUB" ? "var(--accent)" : "var(--accent-hover)")), { h: 130 }),
      keys.length > 1 ? h("div", { className: "pd-legend", style: { marginTop: 10 } }, h("span", null, h("i", { style: { background: "var(--accent)" } }), "Dublin"), h("span", null, h("i", { style: { background: "var(--accent-hover)" } }), "Naas")) : null,
      UI.Note(s === "DUB" ? "Dublin's heaviest hour is 11:00 (EuroFix, 38 pallets). Bay 1 is clear by 13:30 until Northgate at 15:30." : "Naas takes 154 of today's 246 pallets, 142 of them between 10:15 and 13:00.", { marginTop: 10 })
    ]);

    const checks = GI_CHECKS.filter((c) => inSite(s, c.site));
    const checkCard = UI.Card({ title: "Receiving checks", icon: "shield", meta: checks.filter((c) => c.key && !ctx.done(c.key)).length + " TO ACT ON", delay: 220 },
      checks.map((c, i) => UI.Row({ key: i, onClick: () => openRec(ctx, c.rec), style: { alignItems: "flex-start" } }, [
        h("span", { style: { marginTop: 5 } }, UI.Dot(c.key && ctx.done(c.key) ? "ok" : c.tone)),
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, c.t), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3, lineHeight: 1.5, whiteSpace: "normal" } }, c.d)),
        c.key ? decBtn(ctx, c.key, c.btn, c.done) : c.go ? UI.Btn(c.go[0], () => go(c.go[1], c.go[2]), { sm: true, ghost: true }) : null])));

    const ai = UI.AI({ who: "Inventory Agent", conf: s === "NAS" ? null : "CROSS-DOCK SAVES 40 MIN", text: s === "NAS"
      ? "Kerry's van is at N-1 at 10:15, and FH-6710 hand soap still isn't on it: nobody raised a PO and 7 orders are waiting. Draft it now and Kerry can put it on their next run, 5 days out instead of 10."
      : "Cross-dock Hartmann's 8 × EL-4520 straight onto the Galway pallet for SO-10521. Putting them away first costs 40 minutes and misses the 14:30 pallet network. Northgate lands at 15:30, after that cut-off, so its 2 orders are already planned for tomorrow's first runs.",
      actions: s === "NAS"
        ? [decBtn(ctx, "po-fh6710", "Create FH-6710 PO", "PO drafted", { pri: true })]
        : [decBtn(ctx, "wh-xdock-8830", "Cross-dock on arrival", "Cross-dock set", { pri: true }), UI.Btn("Incoming POs", () => go("Purchasing", "Incoming"), { sm: true })] });

    return UI.Page({
      kicker: "Warehouse · goods in", live: "SUPPLIER NOTICES · WMS · 09:20",
      title: today.length + " deliveries, " + pallets + " pallets, " + eur(value) + " due in today" + where,
      sub: "Slots, pallets and receiving status for every supplier delivery, with the backorders each one releases the moment it is booked in.",
      actions: [siteTabs(ctx)],
      children: [
        UI.Kpis([
          { label: "Deliveries due", value: String(today.length), sub: today.filter((p) => p.received).length + " received · " + (s === "ALL" ? siteSplit(() => 1) : DB.warehouses[s].short) },
          { label: "Pallets", value: num(pallets), sub: s === "ALL" ? siteSplit((p) => p.pallets) : "Across " + today.length + " slots" },
          { label: "Value", value: eur(value), sub: s === "ALL" ? "Dublin " + eur(sum(DB.goodsInToday.filter((p) => p.wh === "DUB").map((p) => p.value))) + " · Naas " + eur(sum(DB.goodsInToday.filter((p) => p.wh === "NAS").map((p) => p.value))) : "At PO cost" },
          { label: "Orders released on receipt", value: String(deps), sub: "Backorders that pick the same day", subTone: "ok", onClick: () => go("Orders", "Backorders") },
          showAtlas ? { label: rel(D(1)) + " 10:30", value: "PO-8821", sub: "Atlas · 6 orders · " + eur(atlas.depValue), tone: "bad", onClick: () => ctx.open("po", "PO-8821") } : { label: "Busiest slot", value: "13:00", sub: "Polska · 78 pallets", tone: "warn" }
        ]),
        UI.Grid("minmax(0,1.7fr) minmax(0,1fr)", [table, side]),
        sim,
        gap(),
        UI.Grid("minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr)", [chart, checkCard, ai])
      ]
    });
  }

  /* ================================================================ DISPATCH */
  const bayCard = (ctx, b, i) => {
    const r = b.route ? DB.route(b.route) : null;
    const st = r ? routeStatus(ctx, r) : b.status;
    const tone = r ? statusTone(st) : b.tone;
    return UI.Card({ delay: 40 + i * 30, onClick: r ? () => ctx.open("route", r.id) : () => openRec(ctx, b.rec), alert: tone === "warn" && r ? "warn" : undefined }, [
      h("div", { className: "pd-split" }, h("span", { className: "pd-label pd-grow" }, b.bay + " · " + b.use), UI.Badge(st, tone)),
      h("div", { style: { fontSize: 15, fontWeight: 500, marginTop: 9, letterSpacing: "-.2px" } }, r ? "Route " + rLabel(r.id) + " · " + eur(r.value) : b.title),
      h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 3, lineHeight: 1.45 } }, b.sub),
      b.plan ? h("div", { style: { marginTop: 12 } },
        h("div", { className: "pd-split" }, h("span", { className: "pd-meta pd-grow" }, "PALLETS BUILT"), h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, b.built.toFixed(1) + " / " + b.plan.toFixed(1))),
        h("div", { style: { marginTop: 6 } }, UI.Bar(100 * b.built / b.plan, b.built >= b.plan ? "ok" : null))) : null,
      b.cut ? h("div", { className: "pd-meta", style: { marginTop: 10 } }, "CUT-OFF " + b.cut + " · DEPARTS " + b.dep + " · " + leftTxt(b.cut).toUpperCase() + " LEFT") : null
    ]);
  };

  const decisionBlock = (ctx, d, i) => {
    const done = ctx.done(d.key);
    return h("div", { key: d.key, style: { padding: "14px 16px", borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface-2)", marginTop: i ? 10 : 0, opacity: done ? .72 : 1, transition: "opacity .3s var(--ease)" } },
      h("div", { className: "pd-split" }, UI.Badge(d.tag, done ? "ok" : d.tone, true), h("span", { className: "pd-meta", style: { marginLeft: "auto" } }, done ? "DECIDED" : d.when)),
      h("div", { style: { fontSize: 14, fontWeight: 500, marginTop: 8, letterSpacing: "-.1px" } }, d.title),
      h("div", { style: { fontSize: 12.5, color: "var(--body)", marginTop: 4, lineHeight: 1.55 } }, d.why),
      h("div", { style: { fontSize: 12, color: "var(--ink)", marginTop: 6 } }, d.impact),
      h("div", { style: { display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" } },
        decBtn(ctx, d.key, d.btn, d.doneLabel, { pri: !done }),
        d.alt ? UI.Btn(d.alt[0], d.alt[1], { sm: true, ghost: true }) : null));
  };

  function dispatch(ctx) {
    const s = siteOf(ctx), L = PD.lk(ctx), go = ctx.go;
    const vans = ["D04·2", "D07·2", "D14"].map(DB.route).filter((r) => inSite(s, r.wh));
    const departed = DB.routes.filter((r) => /On route/.test(r.status) && inSite(s, r.wh));
    const atBays = sum(vans.map((r) => r.value)), dropsLeft = sum(vans.map((r) => r.stops));

    const DEC = [
      { site: "DUB", tag: "D14 · 13:45", tone: "warn", when: "DECIDE BY 13:00", title: "Go at 13:45 with Murphy's 15 lines", why: "Holding the van gains nothing: PO-8821 lands " + relLower(D(1)) + " at 10:30. Holding D14 past 14:15 makes the last three drops late.", impact: "€25,772.60 ships today · €1,867.40 follows " + relLower(D(1)), key: "so-partial", btn: "Approve partial shipment", doneLabel: "Partial approved", alt: ["Open SO-10482", () => ctx.open("order", "SO-10482")] },
      { site: "DUB", tag: "D04 RUN 2 · 12:00", tone: "bad", when: "DECIDE BY 11:30", title: "Go with 4 of Tallaght's 6 reels", why: "The recount found 4 reels in D-14-03, not 12. Naas stock reaches Dublin about 14:45, too late for Kevin Daly's second run.", impact: "€2,940 order · 1 line split · 2 reels " + relLower(D(1)), key: "fix-SO-10493", btn: "Go with 4 reels", doneLabel: "Going with 4", alt: ["Open SO-10493", () => ctx.open("order", "SO-10493")] },
      { site: "DUB", tag: "D07 RUN 2 · 12:30", tone: "warn", when: "DECIDE BY 12:15", title: "Add Southside DIY to D07 run 2", why: "SO-10501 was packed five minutes after the D09 cut-off. D07 run 2 passes Rathfarnham at 12:50 with 8 pallet spaces free.", impact: "€1,830 delivered today instead of " + relLower(D(1)) + " 07:05", key: "fix-SO-10501", btn: "Add to D07 run 2", doneLabel: "Added", alt: ["Open D07 run 2", () => ctx.open("route", "D07·2")] },
      { site: "NAS", tag: "SHUTTLE · 14:00", tone: "warn", when: "DECIDE BY 13:30", title: "Carry Glenview's 2 pallets on the shuttle", why: "N06 left them at 07:40, loaded to 104% of payload. The shuttle has 7 spaces free even with the EL-4408 transfer.", impact: "€2,310 delivered today", key: "fix-SO-10490", btn: "Put on the shuttle", doneLabel: "On the shuttle", alt: ["Open SO-10490", () => ctx.open("order", "SO-10490")] },
      { site: "NAS", tag: "SHUTTLE · 14:00", tone: "info", when: "DECIDE BY 13:00", title: "Send 40 × EL-4408 to Dublin", why: "Dublin needs 58 in the next 7 days and has 4 on the shelf. Naas has 64 and needs 11.", impact: "Protects 3 orders worth €12,460", key: "dq-transfer", btn: "Approve transfer", doneLabel: "Transfer approved", alt: ["Open EL-4408", () => ctx.open("product", "EL-4408")] }
    ].filter((d) => inSite(s, d.site));

    const CUTS = [
      { t: "09:00", site: "DUB", label: "D09", d: "Passed. SO-10501 packed at 09:05", tone: "bad", rec: ["order", "SO-10501"], key: "fix-SO-10501", doneD: "SO-10501 moved to D07 run 2" },
      { t: "11:30", site: "DUB", label: "D04 run 2 · departs 12:00", d: "Tallaght: 4 of 6 reels after the recount", tone: "warn", rec: ["route", "D04·2"], key: "fix-SO-10493", doneD: "Going with 4 reels" },
      { t: "12:15", site: "DUB", label: "D07 run 2 · departs 12:30", d: "Westbrook: 7 of 11 lines picked", tone: "info", rec: ["route", "D07·2"] },
      { t: "13:30", site: "DUB", label: "D14 · departs 13:45", d: "12 drops, " + d14Staged + " of " + d14Lines + " lines staged, 5 urgent", tone: "warn", rec: ["route", "D14"], key: "so-partial", doneD: "Murphy goes as a partial" },
      { t: "13:30", site: "NAS", label: "Naas shuttle · departs 14:00", d: "Glenview 2 pallets · EL-4408 transfer if approved", tone: "info", rec: ["go", "Warehouse", "Dispatch"] },
      { t: "14:30", site: "ALL", label: "Pallet network · collects 15:00", d: s === "NAS" ? "5 Naas consignments" : s === "DUB" ? "14 Dublin consignments" : "19 consignments: Dublin 14, Naas 5", tone: "neutral", rec: ["go", "Warehouse", "Packing"] },
      { t: "16:00", site: "ALL", label: "Order cut-off for " + relLower(D(1)) + "'s first runs", d: "142 orders due; pick starts at 12:00", tone: "neutral", rec: ["go", "Orders", "Overview"] }
    ].filter((c) => inSite(s, c.site));

    const bays = UI.Grid("repeat(3,minmax(0,1fr))", BAYS.filter((b) => inSite(s, b.site)).map((b, i) => bayCard(ctx, b, i)), { stretch: true });

    const decCard = UI.Card({ title: "Hold the van or go", icon: "truck", meta: DEC.filter((d) => !ctx.done(d.key)).length + " DECISIONS BEFORE 13:30", delay: 120 }, DEC.map((d, i) => decisionBlock(ctx, d, i)));
    const cutCard = UI.Card({ title: "Cut-offs today", icon: "clock", meta: "09:20 NOW", delay: 160 }, UI.Chain(CUTS.map((c) => {
      const done = c.key && ctx.done(c.key);
      return { k: c.t + (toMin(c.t) > NOW ? " · in " + leftTxt(c.t) : " · passed"), t: c.label, d: done ? c.doneD : c.d, tone: done ? "ok" : c.tone === "neutral" ? null : c.tone, icon: toMin(c.t) > NOW ? "clock" : "alert", onClick: () => openRec(ctx, c.rec) };
    })));

    const manifest = inSite(s, "DUB") ? UI.Card({ flush: true, title: "D14 manifest: what is staged and what is missing", meta: "12 DROPS · " + eur(DB.route("D14").value) + " · JAMES NOLAN · BAY 4", delay: 200, right: UI.Btn("Open D14", () => ctx.open("route", "D14"), { sm: true, ghost: true }) }, UI.Table({
      rows: DB.d14Stops, rowKey: (x) => x[1], onRow: (x) => ctx.open("order", x[1]),
      rowTone: (x) => { const m = D14X[x[1]]; return m[4] === "bad" && !(x[1] === "SO-10486" && ctx.done("fix-SO-10486")) ? "bad" : null; },
      cols: [
        { label: "Drop", w: "56px", render: (x) => h("span", { className: "pd-mono", style: { fontSize: 12 } }, (DB.d14Stops.indexOf(x) + 1) + " · " + x[4]) },
        { label: "Order", w: "86px", render: (x) => mono(x[1], true) },
        { label: "Customer", w: "minmax(170px,1.4fr)", ink: true, render: (x) => h("span", null, L.cust(x[0]), h("span", { className: "pd-faint" }, " · " + x[5])) },
        { label: "Value", w: "82px", r: true, num: true, render: (x) => eur(x[2]) },
        { label: "Lines staged", w: "118px", render: (x) => { const m = D14X[x[1]]; return progress({ lines: m[0], picked: m[1], tone: m[4] === "bad" ? "bad" : null, short: /PO-8821/.test(m[5]) ? 1 : 0 }, 46); } },
        { label: "Pallets", w: "60px", r: true, num: true, render: (x) => D14X[x[1]][2].toFixed(1) },
        { label: "Status", w: "112px", render: (x) => { const m = D14X[x[1]]; const p = x[1] === "SO-10482" && ctx.done("so-partial"), c = x[1] === "SO-10486" && ctx.done("fix-SO-10486"); return UI.Badge(p ? "Ready as partial" : c ? "Picking" : m[3], p ? "ok" : c ? "info" : m[4]); } },
        { label: "Missing", w: "minmax(190px,1.5fr)", render: (x) => { const m = D14X[x[1]]; if (x[1] === "SO-10482" && ctx.done("so-partial")) return h("span", { style: { color: "var(--ok)" } }, "Balance on " + relLower(D(1)) + "'s first run"); if (x[1] === "SO-10486" && ctx.done("fix-SO-10486")) return h("span", { style: { color: "var(--ok)" } }, "Face cleared, 3 lines left"); return m[5] ? h("span", { style: { color: toneFg(m[4] === "info" ? "warn" : m[4]) } }, m[5]) : faint("None"); } }
      ],
      foot: "Loaded in reverse drop order from 12:45. SO-10500 Atlantic FM is packed and already in lane 9."
    })) : null;

    const late = [
      { site: "NAS", t: "09:12", who: "Mark Ryan", what: "asked for SO-10518 Kelleher to go on D14 today", why: "The stock is packed in Naas and D14 doesn't go near Newbridge. N04 drops it by 08:10 " + relLower(D(1)) + ".", key: "wh-10518", btn: "Keep on N04, tell Kelleher", done: "Kept on N04", rec: ["order", "SO-10518"] },
      { site: "DUB", t: "09:05", who: "Warehouse system", what: "SO-10501 Southside DIY packed after the D09 cut-off", why: "Five minutes late. D07 run 2 can take it at 12:30.", key: "fix-SO-10501", btn: "Add to D07 run 2", done: "Added", rec: ["order", "SO-10501"] },
      { site: "DUB", t: "08:52", who: "Gráinne Foley", what: "added a 10:00 counter collection for Brennan Hire", why: "SO-10534, 6 lines, being picked by Aisling Ward.", rec: ["customer", "brennan"] },
      { site: "NAS", t: "08:09", who: "Dispatch Agent", what: "re-planned N06 around the 2 pallets that did not fit", why: "Glenview Maintenance needs a slot today: the 14:00 shuttle has room.", key: "fix-SO-10490", btn: "Put on the shuttle", done: "On the shuttle", rec: ["route", "N06"] }
    ].filter((x) => inSite(s, x.site));
    const lateCard = UI.Card({ title: "Late changes", icon: "alert", meta: "ADDED OR MOVED AFTER THE PLAN WAS SET", delay: 240 }, late.map((x, i) => UI.Row({ key: i, onClick: () => openRec(ctx, x.rec), style: { alignItems: "flex-start" } }, [
      h("span", { className: "pd-mono", style: { width: 40, fontSize: 11.5, color: "var(--faint)", flex: "none", paddingTop: 2 } }, x.t),
      h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, B(x.who), " " + x.what), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3, whiteSpace: "normal", lineHeight: 1.5 } }, x.why)),
      x.key ? decBtn(ctx, x.key, x.btn, x.done) : null])));

    const depCard = UI.Card({ flush: true, title: "Departed this morning", meta: departed.length + " ROUTES · " + sum(departed.map((r) => r.stops)) + " DROPS", delay: 280 }, UI.Table({
      rows: departed, rowKey: (r) => r.id, onRow: (r) => ctx.open("route", r.id), rowTone: (r) => (/left/.test(r.status) ? "warn" : null),
      cols: [
        { label: "Route", w: "58px", render: (r) => mono(r.id, true) },
        { label: "Area", w: "minmax(150px,1.4fr)", ink: true, render: (r) => r.area },
        { label: "Driver", w: "minmax(110px,1fr)", render: (r) => DB.person(r.driver) },
        { label: "Left", w: "54px", render: (r) => mono(r.depart) },
        { label: "Drops", w: "64px", r: true, num: true, render: (r) => r.delivered + " / " + r.stops },
        { label: "Back", w: "54px", render: (r) => mono(r.finish) },
        { label: "Status", w: "170px", render: (r) => UI.Badge(r.status, /left/.test(r.status) ? "warn" : "info") }
      ]
    }));

    return UI.Page({
      kicker: "Warehouse · dispatch", live: "TRANSPORT SYSTEM · WMS · 09:20",
      title: s === "NAS" ? "Naas: the 14:00 shuttle and tomorrow's N04 are staged" : dropsLeft + " drops still to leave, " + eur(atBays) + " at the bays",
      sub: "Loading bays, route cut-offs, what is loaded and what is missing on each van, and the hold-or-go calls that have to be made before the driver turns the key.",
      actions: [siteTabs(ctx), UI.Btn("Delivery today", () => go("Delivery", "Today"), { ghost: true, icon: "truck" })],
      children: [
        UI.Kpis(inSite(s, "DUB") ? [
          { label: "Awaiting dispatch", value: dropsLeft + " drops", sub: vans.map((r) => rLabel(r.id)).join(" · ") },
          { label: "Value at the bays", value: eur(atBays), sub: "D14 alone " + eur(DB.route("D14").value) },
          { label: "Next cut-off", value: "11:30", sub: "D04 run 2 · in " + leftTxt("11:30"), tone: "warn" },
          { label: "Departed this morning", value: departed.length + " routes", sub: sum(departed.map((r) => r.delivered)) + " of " + sum(departed.map((r) => r.stops)) + " drops delivered" },
          { label: "Missed cut-off", value: "1 order", sub: "SO-10501 · D09 by 5 minutes", tone: "bad", onClick: () => ctx.open("order", "SO-10501") },
          { label: "Left behind", value: "2 pallets", sub: "N06 · Glenview · €2,310", tone: "warn", onClick: () => ctx.open("order", "SO-10490") }
        ] : [
          { label: "Shuttle to Dublin", value: "14:00", sub: "Cut-off 13:30 · 7 spaces free" },
          { label: "Packed for N04 " + relLower(D(1)), value: "2 orders", sub: "SO-10478, SO-10518 · 3 pallets" },
          { label: "Departed this morning", value: departed.length + " routes", sub: sum(departed.map((r) => r.delivered)) + " of " + sum(departed.map((r) => r.stops)) + " drops delivered" },
          { label: "Left behind", value: "2 pallets", sub: "N06 · Glenview · €2,310", tone: "warn", onClick: () => ctx.open("order", "SO-10490") }
        ], inSite(s, "DUB") ? "repeat(6,minmax(0,1fr))" : undefined),
        bays,
        UI.Grid("minmax(0,1.35fr) minmax(0,1fr)", [decCard, cutCard]),
        manifest, manifest ? gap() : null,
        UI.Grid("minmax(0,1fr) minmax(0,1.2fr)", [lateCard, depCard])
      ]
    });
  }

  /* ================================================================ EXCEPTIONS */
  function exceptions(ctx) {
    const s = siteOf(ctx), L = PD.lk(ctx), go = ctx.go;
    const inS = EXC.filter((e) => inSite(s, e.site));
    const open = inS.filter((e) => !ctx.done(e.key));
    const TYPES = ["Stock", "Supplier", "Picking", "Packing", "Dispatch", "Return"];
    const F = [["all", "All", inS.length]].concat(TYPES.map((t) => [t, t, inS.filter((e) => e.type === t).length]).filter((f) => f[2] > 0));
    const f = F.some((x) => x[0] === ctx.st.whExF) ? ctx.st.whExF : "all";
    const rows = inS.filter((e) => f === "all" || e.type === f).sort((a, b) => (ctx.done(a.key) ? 1 : 0) - (ctx.done(b.key) ? 1 : 0) || (a.tone === "bad" ? 0 : 1) - (b.tone === "bad" ? 0 : 1));
    const risk = DB.atRiskToday.filter((o) => inSite(s, o.wh));
    const riskVal = sum(risk.map((o) => o.value));
    const TT = { Stock: "bad", Supplier: "warn", Picking: "info", Packing: "info", Dispatch: "warn", Return: "neutral" };

    const table = UI.Card({ flush: true, title: open.length + " open · " + (inS.length - open.length) + " fixed today", meta: "OWNER · AGE · ORDERS HIT · THE FIX", delay: 60 }, UI.Table({
      rows, rowKey: (e) => e.ref, onRow: (e) => openRec(ctx, e.rec),
      rowTone: (e) => (ctx.done(e.key) ? null : e.tone === "bad" ? "bad" : "warn"),
      cols: [
        { label: "Type", w: "84px", render: (e) => UI.Badge(e.type, ctx.done(e.key) ? "ok" : TT[e.type]) },
        { label: "Reference", w: "150px", render: (e) => h("span", { className: "pd-mono", style: { fontSize: 11.5, color: "var(--ink)" } }, e.ref) },
        { label: "What happened", w: "minmax(260px,2.2fr)", render: (e) => h("span", { title: e.what, style: { color: "var(--ink)" } }, e.what) },
        { label: "Owner", w: "124px", render: (e) => DB.person(e.owner) },
        { label: "Age", w: "64px", render: (e) => h("span", { className: "pd-mono", style: { fontSize: 11.5, color: /day/.test(e.age) ? "var(--bad)" : "var(--body)" } }, e.age) },
        { label: "Orders hit", w: "minmax(130px,1fr)", render: (e) => e.orders.length ? h("span", null, ...e.orders.map((id, i) => h("span", { key: id }, i ? ", " : "", DB.order(id) ? L.order(id) : id))) : faint("None") },
        { label: "Impact", w: "minmax(200px,1.5fr)", render: (e) => h("span", { title: e.impact, className: "pd-dim" }, e.impact) },
        { label: "Fix", w: "168px", render: (e) => decBtn(ctx, e.key, e.fix, "Fixed") }
      ],
      empty: "Nothing open of this type."
    }));

    const chain = inSite(s, "DUB") ? UI.Card({ title: "One exception, followed through", icon: "link", meta: "BIN D-14-03 · 09:06", delay: 100 }, UI.HChain([
      { k: "Bin count", t: "D-14-03: 4 found, 12 on system", d: "Siobhán Reilly, picking SO-10493", tone: "bad", onClick: () => ctx.open("product", "EL-4408") },
      { k: "Available stock", t: "Dublin EL-4408: 12 is really 4", d: "8 reels unaccounted for · €171.20", tone: ctx.done("wh-bin-d1403") ? "ok" : "warn", onClick: () => ctx.go("Inventory", "Stock") },
      { k: "Allocation", t: "SO-10493 short 2 reels", d: "Tallaght Trade Centre · €2,940", tone: "warn", onClick: () => ctx.open("order", "SO-10493") },
      { k: "Supply", t: "Naas transfer, 14:00 shuttle", d: ctx.done("dq-transfer") ? "Approved · 40 reels" : "Waiting on approval", tone: ctx.done("dq-transfer") ? "ok" : null, onClick: () => ctx.go("Inventory", "Transfers") },
      { k: "Dispatch", t: "D04 run 2 at 12:00", d: ctx.done("fix-SO-10493") ? "Going with 4 reels" : "4 reels now, or hold?", tone: ctx.done("fix-SO-10493") ? "ok" : "warn", onClick: () => ctx.open("route", "D04·2") },
      { k: "Customer", t: "Tallaght Trade Centre", d: ctx.done("fix-SO-10493") ? "Told: 2 reels " + relLower(D(1)) : "Not told yet", tone: ctx.done("fix-SO-10493") ? "ok" : null, onClick: () => ctx.open("customer", "tallaght") }
    ])) : null;

    const weeks = [3, 2, 4, 3, 5, 6, 8, 9], counted = [96, 94, 92, 88, 81, 72, 61, 54];
    const trend = UI.Card({ title: "Bin count mismatches per week", icon: "spark", meta: "DUBLIN · LAST 8 WEEKS", delay: 140 }, [
      UI.Columns(weeks.map((v, i) => ({ l: i === 7 ? "This wk" : "W-" + (7 - i), v, d: String(v), hi: i === 7 })), { h: 120, showValues: true }),
      UI.Note("Cycle counts done against plan: " + counted.map((c) => c + "%").join(", ") + ". Counters get borrowed for goods in on heavy delivery days, and the mismatches follow.", { marginTop: 10 })
    ]);
    const causes = UI.Card({ title: "What keeps going wrong", icon: "alert", meta: "BOTH SITES · LAST 4 WEEKS", delay: 180 }, [
      UI.HBars([
        { label: "Picking delays", v: 31, d: "31", sub: "blocked faces, heavy lines" },
        { label: "Bin count mismatches", v: 28, d: "28", tone: "bad", onClick: () => ctx.go("Inventory", "Stock") },
        { label: "Supplier short or damaged", v: 14, d: "14", sub: "Atlas 6", onClick: () => ctx.open("supplier", "atlas") },
        { label: "Missed van cut-offs", v: 9, d: "9", onClick: () => ctx.go("Delivery", "OTIF") },
        { label: "Returns put away wrong", v: 4, d: "4" }
      ], { tpl: "minmax(150px,1.2fr) 1.4fr 40px" }),
      UI.Note("Missed cut-offs feed straight into OTIF: warehouse delay is 15 of this month's 86 failed deliveries.", { marginTop: 10 })
    ]);
    const ai = UI.AI({ who: "Inventory Agent", conf: "ROOT CAUSE", text: "Mismatches tripled in eight weeks while cycle counts fell from 96% to 54% of plan. Today's D-14-03 miss is on an Atlas SKU, and PO-8821 lands into those same bins " + relLower(D(1)) + ". Count D-14 to D-21 tonight, before the receipt, so the 120 reels go onto a true figure.",
      actions: [decBtn(ctx, "wh-cycle", "Book tonight's count", "Count booked", { pri: true }), UI.Btn("Why has OTIF fallen?", () => ctx.ask("Why has OTIF fallen?"), { sm: true, ghost: true, icon: "spark" })] });

    const rets = DB.returns.filter((r) => RET_WHERE[r.id]);
    const retCard = inSite(s, "DUB") ? UI.Card({ flush: true, title: "Returns and quarantine", meta: rets.length + " RETURNS IN THE BUILDING · " + eur(sum(rets.map((r) => r.value)), 2), delay: 220, right: UI.Btn("Delivery issues", () => go("Delivery", "Delivery Issues"), { sm: true, ghost: true }) }, UI.Table({
      rows: rets, rowKey: (r) => r.id, onRow: (r) => ctx.open("customer", r.cust),
      rowTone: (r) => (RET_WHERE[r.id][1] === "bad" && !ctx.done("wh-rma1192") ? "bad" : null),
      cols: [
        { label: "Return", w: "84px", render: (r) => mono(r.id, true) },
        { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (r) => L.cust(r.cust) },
        { label: "SKU", w: "80px", render: (r) => L.sku(r.sku) },
        { label: "Qty", w: "44px", r: true, num: true, render: (r) => r.qty },
        { label: "Reason", w: "118px", render: (r) => r.reason },
        { label: "Where it is now", w: "minmax(210px,1.5fr)", render: (r) => { const wv = r.id === "RMA-1192" && ctx.done("wh-rma1192") ? ["Quarantine · back to Nordic", "ok"] : ctx.done("wh-insp-" + r.id.slice(4)) ? ["Inspected · credit released", "ok"] : RET_WHERE[r.id]; return h("span", { style: { color: wv[1] === "neutral" ? "var(--body)" : toneFg(wv[1]) } }, wv[0]); } },
        { label: "Age", w: "60px", render: (r) => mono(RET_WHERE[r.id][2]) },
        { label: "Owner", w: "112px", render: (r) => DB.person(r.owner) },
        { label: "Credit", w: "104px", render: (r) => UI.Badge(r.credit, /Pending/.test(r.credit) && !ctx.done("wh-insp-" + r.id.slice(4)) ? "warn" : "neutral") },
        { label: "Value", w: "76px", r: true, num: true, render: (r) => eur(r.value, 2) }
      ],
      foot: "Supplier claims wait in quarantine until collected. A return on a pick face is the one that costs money twice."
    })) : null;

    return UI.Page({
      kicker: "Warehouse · exceptions", live: "WMS · SCALES · RETURNS · 09:20",
      title: open.length + " exceptions open, behind " + risk.length + " at-risk " + (risk.length === 1 ? "order" : "orders") + " worth " + eur(riskVal),
      sub: "Stock discrepancies, supplier short-shipments, damaged deliveries, picking delays, missed cut-offs and returns: each with an owner, an age, the orders it touches and the fix.",
      actions: [siteTabs(ctx), UI.Btn("What will go late?", () => ctx.ask("What orders are likely to go late?"), { icon: "spark", ghost: true })],
      children: [
        UI.Kpis([
          { label: "Open exceptions", value: String(open.length), sub: inS.filter((e) => e.tone === "bad" && !ctx.done(e.key)).length + " stopping an order today", tone: open.length ? "bad" : "ok", toneValue: true },
          { label: "At-risk orders behind them", value: String(risk.length), sub: eur(riskVal) + " due out today", tone: "bad", onClick: () => go("Orders", "At Risk") },
          { label: "Stock discrepancies", value: String(inS.filter((e) => e.type === "Stock").length), sub: inSite(s, "DUB") ? "D-14-03 and D-08-02" : "None at Naas today" },
          { label: "Supplier and goods in", value: String(inS.filter((e) => e.type === "Supplier").length), sub: s === "NAS" ? "Kerry damaged pallet" : s === "DUB" ? "Celtic short-shipped" : "Celtic short · Kerry damaged" },
          { label: "Oldest open", value: inSite(s, "DUB") ? "4 days" : "1h 40m", sub: inSite(s, "DUB") ? "RMA-1187 waiting on inspection" : "SO-10490 left behind by N06", tone: "warn" }
        ]),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" } }, UI.Chips(F, f, (v) => ctx.set({ whExF: v }))),
        table,
        gap(),
        chain, chain ? gap() : null,
        UI.Grid("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", [trend, causes, ai]),
        retCard
      ]
    });
  }

  PD.pages.Warehouse = { "Control Board": board, "Picking": picking, "Packing": packing, "Goods In": goodsIn, "Dispatch": dispatch, "Exceptions": exceptions };
})();
