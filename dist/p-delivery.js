/* Delivery: every run on the road, OTIF as a management report, returns and claims,
   and proof of delivery through to the invoice. Problems surface here before the
   customer rings, not after. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB;
  const { eur, num } = PD.fmt;
  const { D, rel, relLower, dm } = PD.date;
  const B = UI.B, TONE = PD.TONE;
  const DL = DB.delivery, T = DL.today, M = DL.mtd;

  /* ---------------- helpers ---------------- */
  const DL_TARGET = DB.kpi.otifTarget;
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const rl = (id) => id.replace("·", " run ");
  const mono = (t, style) => h("span", { className: "pd-mono", style: Object.assign({ fontSize: 12, color: "var(--ink)" }, style || {}) }, t);
  const none = (t) => h("span", { className: "pd-faint" }, t || "None");
  const spacer = () => h("div", { style: { height: 14 } });
  const ordRef = (ctx, id) => DB.order(id) ? PD.lk(ctx).order(id) : mono(id, { color: "var(--body)", fontSize: 11.5 });
  const custRef = (ctx, id) => id === "counter" ? h("span", null, "Trade counter, cash sale") : PD.lk(ctx).cust(id);
  const rTone = (r) => /left/i.test(r.status) ? "bad" : /Waiting/i.test(r.status) ? "warn" : /Ready|Loading/.test(r.status) ? "info" : "ok";
  const rShort = (r) => /left/i.test(r.status) ? "2 pallets left" : /Waiting/i.test(r.status) ? "Held for SO-10482" : r.status;
  const supId = (name) => (DB.suppliers.find((s) => s.name.indexOf(name.split(" ")[0]) === 0) || {}).id;
  // Shared data sometimes lower-cases a relative date ("Sent 24 sep"); show months capitalised.
  const capMonth = (t) => String(t).replace(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/g, (m) => m.charAt(0).toUpperCase() + m.slice(1));
  const pts = (n) => (100 * n / M.deliveries).toFixed(1);
  const otifPct = (ok, all) => (100 * ok / all).toFixed(1) + "%";
  // Gap-to-target bars: the bar is how far below 97% something runs, so the worst stand out.
  const gapBars = (items, onClick) => UI.HBars(items.map((it) => ({
    label: it[0], sub: it[2] || null, v: Math.max(0.05, DL_TARGET - it[1]), d: it[1].toFixed(1) + "%",
    tone: it[1] < 90 ? "bad" : it[1] < 94 ? "warn" : it[1] >= DL_TARGET ? "ok" : "neutral",
    onClick: onClick ? () => onClick(it) : undefined
  })), { tpl: "minmax(120px,1.2fr) 1.4fr 58px", max: 16, colorValue: true });

  /* ---------------- routes and sites ---------------- */
  const R = DB.routes;
  const site = (wh) => { const rs = R.filter((r) => r.wh === wh); return { runs: rs.length, stops: sum(rs.map((r) => r.stops)), delivered: sum(rs.map((r) => r.delivered)), value: sum(rs.map((r) => r.value)) }; };
  const awaiting = R.filter((r) => ["Ready", "Loading"].indexOf(r.status) > -1 || r.id === "D14");
  const onRoad = R.filter((r) => /On route/.test(r.status));

  // Today's run costs: [km, cost]. Second runs carry only the extra driver time and fuel. Sums to €3,218, €42.34 a drop.
  const RUN_COST = { "D02": [88, 286], "D04": [62, 268], "D04·2": [18, 58], "D07": [71, 274], "D07·2": [16, 54], "D09": [58, 262], "D11": [84, 318], "D12": [76, 272], "D14": [112, 296], "D16": [44, 196], "N02": [118, 302], "N04": [96, 314], "N06": [142, 318] };
  const costToday = sum(Object.keys(RUN_COST).map((k) => RUN_COST[k][1]));
  const perDrop = (r) => RUN_COST[r.id][1] / r.stops;

  // Month to date transport cost: drivers + fuel + vehicle + subcontract = €64,820 over 1,488 drops = €43.56 a drop.
  const FLEET = { cost: 64820, drivers: 38960, fuel: 12940, vehicle: 10480, sub: 2440, litres: 8190, km: 39000 };
  const costPerDrop = FLEET.cost / M.deliveries;

  /* ---------------- today: the seven at-risk deliveries (DB.atRiskToday) ---------------- */
  const RISK = {
    "SO-10482": ["D14", "14:30", "15 of 18 lines can go; 3 wait on PO-8821"],
    "SO-10488": ["D14", "14:55", "40 glands on PO-8821; the other 7 lines are ready"],
    "SO-10486": ["D14", "15:35", "Makes D14 only if the last 3 lines are picked by 13:30"],
    "SO-10495": ["D14", "15:50", "20 cable ties on PO-8821; the other 5 lines are ready"],
    "SO-10493": ["D04·2", "12:25", "4 reels from the recount now, 2 on the Naas transfer"],
    "SO-10490": [null, "14:40", "Both pallets go on the 14:00 Naas shuttle via Kildare town"],
    "SO-10501": ["D07·2", "12:50", "Fits on D07 run 2 past Rathfarnham, otherwise tomorrow 07:05"]
  };
  const ETA_CALLS = [
    { t: "09:16", cust: "glenview", order: "SO-10490", via: "Phone", who: "Emer Nolan", q: "The pallets were due before nine. Where are they?", known: "07:40", note: "N06 left them at Naas at 07:40. The Dispatch Agent re-planned them at 08:09. Nobody told the customer." },
    { t: "09:02", cust: "horizon", order: "SO-10488", via: "Phone", who: "Seán Horan", q: "What time is the drop, and is it all there?", known: "08:44", note: "Traced to PO-8821 by the Purchasing Agent at 08:44, 18 minutes before the call. Logged by Gráinne Foley." },
    { t: "08:39", cust: "murphy", order: "SO-10482", via: "Email", who: "Ger Murphy", q: "Can we get what you have today?", known: dm(D(-3)), note: "Short since the order was placed. Sarah Byrne agreed a split delivery at 09:11." }
  ];
  const UNTOLD = ["SO-10486", "SO-10495", "SO-10493", "SO-10501"];

  /* ================================================================ TODAY */
  function today(ctx) {
    const go = ctx.go;
    const dub = site("DUB"), nas = site("NAS");
    const told = ctx.done("dl-eta");
    const risk = DB.atRiskToday.slice().sort((a, b) => RISK[a.id][1] < RISK[b.id][1] ? -1 : 1);

    const runCard = (r, i) => {
      const tone = rTone(r), t = TONE[tone], hot = tone !== "ok";
      const notYet = !/On route/.test(r.status);
      return h("div", {
        key: r.id, className: "pd-click", onClick: () => ctx.open("route", r.id),
        style: { padding: "13px 14px 12px", borderRadius: 16, minWidth: 0, border: "1px solid " + (hot ? "color-mix(in srgb," + t.fg + " 45%,transparent)" : "var(--border)"), background: hot ? "linear-gradient(180deg," + t.bg + ",transparent 85%),var(--surface-2)" : "var(--surface-2)", animation: "rowIn .36s var(--ease) " + i * 35 + "ms both" }
      },
        h("div", { className: "pd-split", style: { gap: 8 } }, mono(rl(r.id), { fontSize: 13 }), h("span", { className: "pd-grow" }), UI.Badge(rShort(r), tone)),
        h("div", { className: "pd-ell", style: { fontSize: 12, color: "var(--dim)", marginTop: 4 } }, r.area),
        h("div", { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 11 } }, UI.Bar(100 * r.delivered / r.stops, hot ? tone : "neutral"), mono(r.delivered + "/" + r.stops, { fontSize: 11 })),
        h("div", { className: "pd-split", style: { marginTop: 9, fontSize: 11.5, color: "var(--body)" } }, h("span", { className: "pd-grow pd-ell" }, DB.person(r.driver)), h("span", { className: "pd-meta" }, r.reg)),
        h("div", { className: "pd-split", style: { marginTop: 4, fontSize: 11.5 } }, h("span", { className: "pd-grow pd-mono", style: { color: "var(--ink)" } }, eur(r.value)), h("span", { className: "pd-meta" }, notYet ? "DEPARTS " + r.depart : "BACK " + r.finish)));
    };

    const runs = UI.Card({ title: "Runs on the road", icon: "truck", meta: R.length + " RUNS · " + T.total + " DROPS · CLICK A RUN FOR ITS STOPS", delay: 60 }, [
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(206px,1fr))", gap: 10 } }, ...R.map(runCard)),
      UI.Note("No map needed: each card is one run from the transport system and the driver app. Amber and red cards are the ones someone has to act on before the customer notices.", { marginTop: 12 })
    ]);

    const riskCard = UI.Card({ title: "At-risk deliveries", icon: "alert", meta: T.atRisk + " TODAY · " + eur(DB.kpi.atRiskTodayValue), delay: 100, alert: "bad", right: UI.Btn("Orders at risk", () => go("Orders", "At Risk"), { sm: true, ghost: true }) },
      risk.map((o) => {
        const e = RISK[o.id];
        return UI.Row({ onClick: () => ctx.open("order", o.id), style: { alignItems: "flex-start" } }, [
          h("div", { style: { width: 50, flex: "none" } }, mono(e[1], { fontSize: 12.5 }), h("div", { className: "pd-meta", style: { marginTop: 3 } }, e[0] ? rl(e[0]).toUpperCase() : "SHUTTLE")),
          h("div", { className: "pd-grow" },
            h("div", { style: { fontSize: 13 } }, DB.custName(o.cust), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, o.id)),
            h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2, lineHeight: 1.45 } }, h("span", { style: { color: TONE[PD.riskTone(o.risk)].fg } }, o.reason), " · " + e[2])),
          mono(eur(o.value))]);
      }));

    const tell = UI.AI({ who: "Customer Agent", conf: told ? "QUEUED" : "4 NOT TOLD",
      text: "Four customers with a delivery at risk today have heard nothing: Brennan Hire & Tool, Liffey Mechanical, Tallaght Trade Centre and Southside DIY. Each draft gives the new ETA and what is still to come, from the account manager's own mailbox. Nobody should have to ring us to find out.",
      actions: [UI.Btn("Send 4 ETA updates", () => ctx.act("dl-eta", "4 ETA updates queued", "Sent from David Kelly and Mark Ryan's Outlook with today's ETA. Replies thread back to " + UNTOLD.join(", ") + "."), { pri: true, sm: true, done: told, doneLabel: "Queued" }),
        UI.Btn("Open D14", () => ctx.open("route", "D14"), { sm: true })] });

    const calls = UI.Card({ title: "The customer rang first", icon: "phone", meta: "ETA ENQUIRIES TODAY", delay: 160 }, [
      ...ETA_CALLS.map((c) => UI.Row({ onClick: () => ctx.open("order", c.order), style: { alignItems: "flex-start" } }, [
        mono(c.t, { width: 40, flex: "none" }),
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 12.5 } }, DB.custName(c.cust), h("span", { className: "pd-faint", style: { fontSize: 11.5 } }, " · " + c.via + " · " + c.who)),
          h("div", { style: { fontSize: 12, color: "var(--ink)", marginTop: 4 } }, "“" + c.q + "”"),
          h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3, lineHeight: 1.45 } }, c.note)),
        UI.Badge("Known " + c.known, "warn", true)])),
      UI.Note("All three were known inside the business before the customer made contact. The gap is telling them.", { marginTop: 8 })
    ]);

    const sites = UI.Card({ title: "Deliveries by site", icon: "pin", meta: T.delivered + " OF " + T.total + " DELIVERED", delay: 200, onClick: () => go("Delivery", "Proof of Delivery") }, [
      UI.Split([
        { label: "Delivered", v: T.delivered, color: "var(--ok)", d: String(T.delivered) },
        { label: "In transit", v: T.transit, color: "var(--accent)", d: String(T.transit) },
        { label: "Awaiting dispatch", v: T.awaiting, color: "var(--neutral)", d: String(T.awaiting) }
      ], { h: 10 }),
      h("div", { style: { height: 10 } }),
      ...[["Dublin Distribution Centre", dub], ["Naas Distribution Centre", nas]].map((s) => UI.Row({}, [
        h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, s[0]), h("div", { className: "pd-meta", style: { marginTop: 3 } }, s[1].runs + " RUNS · " + s[1].stops + " DROPS · " + eur(s[1].value))),
        h("div", { style: { width: 90 } }, UI.Bar(100 * s[1].delivered / s[1].stops, "ok")),
        mono(s[1].delivered + "/" + s[1].stops, { width: 44, textAlign: "right", fontSize: 11.5 })])),
      UI.Note("Naas is " + Math.round(100 * nas.delivered / nas.stops) + "% through its drops and Dublin " + Math.round(100 * dub.delivered / dub.stops) + "%, because D14's 12 drops do not leave until 13:45. Every drop has a POD; one is on paper.", { marginTop: 10 })
    ]);

    const afternoon = UI.Card({ title: "The rest of the day", icon: "clock", meta: "DEPARTURES AND CUT-OFFS", delay: 240 }, UI.Feed([
      { t: "12:00", tone: "warn", text: [B("D04 run 2"), " leaves with Tallaght Trade Centre's balance: 4 reels found on the recount of D-14-03."], onClick: () => ctx.open("route", "D04·2") },
      { t: "12:30", tone: "info", text: [B("D07 run 2"), " takes Westbrook's SO-10491 (" + eur(8420) + "). Room for Southside's missed drop past Rathfarnham."], onClick: () => ctx.open("route", "D07·2") },
      { t: "13:30", tone: "bad", text: [B("D14 cut-off."), " Murphy 15 of 18 lines at bay 4; Brennan 3 lines still to pick at A-22-04."], onClick: () => go("Warehouse", "Dispatch") },
      { t: "13:45", tone: "warn", text: [B("D14 departs"), ": James Nolan, 12 drops, " + eur(48620) + ", back 17:20."], onClick: () => ctx.open("route", "D14") },
      { t: "14:00", tone: "info", text: [B("Naas shuttle"), ": Glenview's 2 pallets, and 40 × EL-4408 for Dublin if the transfer is approved."], onClick: () => go("Inventory", "Transfers") },
      { t: "17:20", tone: "neutral", text: [B("Last van back."), " Every POD in, invoices raised in Sage 200 before anyone goes home."], onClick: () => go("Delivery", "Proof of Delivery") }
    ]));

    return UI.Page({
      kicker: "Delivery · today", live: "TRANSPORT SYSTEM AND DRIVER APP · LIVE",
      title: T.total + " deliveries today, " + T.atRisk + " at risk",
      sub: "Every run on the road, what is late or about to be, and why. Delivery problems should be found here, not when the customer rings.",
      actions: [UI.Btn("Why has OTIF fallen?", () => ctx.ask("Why has OTIF fallen?"), { icon: "spark" }), UI.Btn("Routes", () => go("Delivery", "Routes"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Deliveries", value: String(T.total), sub: R.length + " runs · " + eur(DB.kpi.ordersTodayValue) },
          { label: "Delivered", value: String(T.delivered), sub: "POD on all 34 · 1 on paper", subTone: "ok", onClick: () => go("Delivery", "Proof of Delivery") },
          { label: "In transit", value: String(T.transit), sub: "On " + onRoad.length + " vehicles" },
          { label: "Awaiting dispatch", value: String(T.awaiting), sub: "D14 plus 2 second runs", onClick: () => ctx.open("route", "D14") },
          { label: "OTIF", value: T.otif.toFixed(1) + "%", sub: "Target " + DL_TARGET.toFixed(1) + "% · month to date", tone: "warn", subTone: "warn", onClick: () => go("Delivery", "OTIF") },
          { label: "At risk", value: String(T.atRisk), sub: eur(DB.kpi.atRiskTodayValue) + " · 4 on D14", tone: "bad", toneValue: true, onClick: () => go("Orders", "At Risk") }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [runs, h("div", null, riskCard, spacer(), tell)]),
        UI.Grid("minmax(0,1.25fr) minmax(0,1fr) minmax(0,1fr)", [calls, sites, afternoon])
      ]
    });
  }

  /* ================================================================ ROUTES */
  const CHANGES = [
    ["09:06", "warn", "D04 run 2 created: the recount of bin D-14-03 found 4 reels, not 12. Tallaght's balance goes at 12:00.", ["route", "D04·2"]],
    ["09:05", "warn", "Southside DIY's SO-10501 packed five minutes after the D09 cut-off. Offered on D07 run 2.", ["order", "SO-10501"]],
    ["08:34", "ok", "D02 departed Dublin with 7 drops, " + eur(21480) + ".", ["route", "D02"]],
    ["08:09", "warn", "Dispatch Agent re-planned N06: Glenview's 2 pallets moved to the 14:00 Naas shuttle.", ["route", "N06"]],
    ["07:40", "bad", "Ray Fitzpatrick left 2 pallets at Naas rather than run N06 at 104% of payload.", ["route", "N06"]],
    ["07:10", "neutral", "D07 run 2 added for Westbrook Hardware's SO-10491, picking late for the first run.", ["route", "D07·2"]]
  ];

  function routes(ctx) {
    const L = PD.lk(ctx), go = ctx.go;
    const pick = ctx.st.dlRoute || "D14";
    const partial = ctx.done("so-partial"), reseq = ctx.done("d02-reseq");
    const stTone = { Delivered: "ok", Next: "info", Scheduled: "neutral", "At risk": "warn" };
    const firstRuns = R.filter((r) => !r.parent).length;

    const table = UI.Card({ flush: true, title: "Today's runs", meta: R.length + " RUNS · " + T.total + " DROPS · CLICK A ROW TO OPEN THE ROUTE", delay: 40 }, UI.Table({
      rows: R, rowKey: (r) => r.id, onRow: (r) => ctx.open("route", r.id), sel: (r) => r.id === pick,
      rowTone: (r) => rTone(r) === "bad" ? "bad" : rTone(r) === "warn" ? "warn" : null,
      cols: [
        { label: "Route", w: "88px", render: (r) => mono(rl(r.id)) },
        { label: "Area", w: "minmax(170px,1.5fr)", ink: true, render: (r) => r.area },
        { label: "Driver", w: "minmax(110px,1fr)", render: (r) => DB.person(r.driver) },
        { label: "Vehicle", w: "104px", render: (r) => mono(r.reg, { fontSize: 11.5, color: "var(--body)" }) },
        { label: "Delivered", w: "118px", render: (r) => h("div", { className: "pd-split", style: { gap: 8 } }, UI.Bar(100 * r.delivered / r.stops, rTone(r) === "ok" ? "neutral" : rTone(r), { w: 50 }), mono(r.delivered + " of " + r.stops, { fontSize: 11 })) },
        { label: "Value", w: "84px", r: true, num: true, ink: true, render: (r) => eur(r.value) },
        { label: "Departs", w: "66px", num: true, render: (r) => r.depart },
        { label: "Back", w: "58px", num: true, render: (r) => r.finish },
        { label: "Status", w: "150px", render: (r) => UI.Badge(rShort(r), rTone(r)) },
        { label: "Cost/drop", w: "78px", r: true, num: true, render: (r) => h("span", { style: { color: perDrop(r) > 50 ? "var(--warn)" : "var(--body)" } }, eur(perDrop(r), 2)) },
        { label: "OTIF MTD", w: "76px", r: true, num: true, render: (r) => h("span", { style: { color: r.otif < 94 ? "var(--warn)" : "var(--body)" } }, r.otif.toFixed(1) + "%") }
      ],
      foot: "Cost per drop is today's driver, fuel and vehicle cost for the run divided by its drops. Second runs carry only the extra time and fuel."
    }));

    let preview;
    if (pick === "D02") {
      const r = DB.route("D02");
      const rows = DB.d02Stops.map((s, i) => {
        const flag = s[1] === "SO-10481";
        return { n: i + 1, cust: s[0], order: s[1], value: s[2], state: flag ? (reseq ? "Scheduled" : "At risk") : s[3], time: flag && reseq ? "11:25" : s[4], site: s[5],
          note: flag ? (reseq ? "Resequenced: before the break" : "Store goods-in closes 12:30; planned 12:40") : s[3] === "Delivered" ? "POD signed " + s[4] : s[3] === "Next" ? "Driver 6 minutes away" : "" };
      });
      preview = UI.Card({ title: "D02 · Southside & Sandyford", icon: "route", meta: "LIVE · " + r.delivered + " OF " + r.stops + " DELIVERED", delay: 80, right: UI.Btn("Open route", () => ctx.open("route", "D02"), { sm: true, ghost: true }) }, [
        UI.Facts([["Driver", DB.person(r.driver)], ["Vehicle", r.reg], ["Departed", r.depart], ["Back", r.finish], ["Value", eur(r.value)], ["Delivered", r.delivered + " of " + r.stops, "ok"]], 6),
        h("div", { style: { height: 12 } }),
        UI.Table({
          rows, rowKey: (s) => s.order, rowTone: (s) => s.state === "At risk" ? "warn" : null,
          cols: [
            { label: "#", w: "34px", num: true, render: (s) => s.n },
            { label: "Time", w: "58px", num: true, render: (s) => s.time },
            { label: "Customer", w: "minmax(150px,1.3fr)", ink: true, render: (s) => L.cust(s.cust) },
            { label: "Site", w: "minmax(120px,1fr)", render: (s) => s.site },
            { label: "Order", w: "84px", render: (s) => ordRef(ctx, s.order) },
            { label: "Value", w: "76px", r: true, num: true, render: (s) => eur(s.value) },
            { label: "Status", w: "92px", render: (s) => UI.Badge(s.state, stTone[s.state]) },
            { label: "", w: "minmax(150px,1.2fr)", render: (s) => h("span", { className: "pd-faint", style: { fontSize: 11.5 } }, s.note) }
          ]
        }),
        h("div", { style: { marginTop: 12 } }, UI.AI({ who: "Dispatch Agent", conf: reseq ? "DONE" : "1 DROP AT RISK",
          text: reseq ? "Declan takes his break after Store 7. He reaches Dundrum at 11:25, an hour inside the goods-in window, and is still back by 13:10."
            : "Leinster's Store 7 in Dundrum stops receiving at 12:30, and D02 is planned there at 12:40 because Declan's break falls between Stepaside and Dundrum. Move the break after Store 7 and he arrives at 11:25. Otherwise the store refuses the drop and it comes back on the van.",
          actions: [UI.Btn("Move the break", () => ctx.act("d02-reseq", "D02 resequenced", "Declan Burke's break moved after Store 7. New ETA 11:25, sent to his driver app."), { pri: true, sm: true, done: reseq, doneLabel: "Resequenced" })] }))
      ]);
    } else {
      const r = DB.route("D14");
      const atRiskVal = sum(DB.d14Stops.filter((s) => s[3] === "At risk").map((s) => s[2]));
      preview = UI.Card({ title: "D14 · West Dublin & Fingal", icon: "route", meta: "AFTERNOON RUN · LOADING AT BAY 4", delay: 80, right: UI.Btn("Open route", () => ctx.open("route", "D14"), { sm: true, ghost: true }) }, [
        UI.Facts([["Driver", DB.person(r.driver)], ["Vehicle", r.reg], ["Stops", String(r.stops)], ["Value", eur(r.value)], ["Departure", r.depart], ["Expected completion", r.finish]], 6),
        h("div", { style: { height: 12 } }),
        UI.Table({
          rows: DB.d14Stops, rowKey: (s) => s[1], onRow: (s) => DB.order(s[1]) ? ctx.open("order", s[1]) : null,
          rowTone: (s) => s[3] === "At risk" && !(partial && s[1] === "SO-10482") ? "warn" : null,
          cols: [
            { label: "ETA", w: "56px", num: true, render: (s) => s[4] },
            { label: "Customer", w: "minmax(160px,1.4fr)", ink: true, render: (s) => L.cust(s[0]) },
            { label: "Site", w: "minmax(110px,1fr)", render: (s) => s[5] },
            { label: "Order", w: "84px", render: (s) => ordRef(ctx, s[1]) },
            { label: "Value", w: "80px", r: true, num: true, render: (s) => eur(s[2]) },
            { label: "Status", w: "92px", render: (s) => { const st = partial && s[1] === "SO-10482" ? "Scheduled" : s[3]; return UI.Badge(st, stTone[st]); } },
            { label: "Why", w: "minmax(170px,1.6fr)", render: (s) => partial && s[1] === "SO-10482" ? h("span", { style: { color: "var(--ok)", fontSize: 11.5 } }, "15 of 18 lines, balance " + relLower(D(1))) : s[3] === "At risk" ? h("span", { className: "pd-ell", style: { color: "var(--dim)", fontSize: 11.5 } }, DB.order(s[1]).reasonDetail) : "" }
          ]
        }),
        h("div", { style: { marginTop: 12 } }, UI.AI({ who: "Dispatch Agent", conf: partial ? "ON THE MANIFEST" : "4 DROPS · " + eur(atRiskVal),
          text: partial ? "Murphy's 15 lines are on the manifest and D14 leaves at 13:45. Horizon and Liffey go without their PO-8821 lines; the balance joins tomorrow's first run."
            : "Four drops worth " + eur(atRiskVal) + " are at risk, three of them waiting on Atlas. Leave at 13:45 with what is allocated rather than hold the van: every 15 minutes past 14:15 pushes the last three drops outside their window.",
          actions: [UI.Btn("Approve partial shipment", () => ctx.act("so-partial", "Partial shipment approved", "15 lines released to D14. Murphy notified; balance booked for " + relLower(D(1)) + " afternoon."), { pri: true, sm: true, done: partial, doneLabel: "Partial approved" }),
            UI.Btn("PO-8821", () => ctx.open("po", "PO-8821"), { sm: true })] }))
      ]);
    }

    const otifRoutes = R.filter((r) => !r.parent).slice().sort((a, b) => a.otif - b.otif).map((r) => [rl(r.id), r.otif, DB.person(r.driver).split(" ")[0], r.id]);

    return UI.Page({
      kicker: "Delivery · routes", live: "TRANSPORT SYSTEM · UPDATED 09:18",
      title: "Routes today",
      sub: R.length + " runs from two warehouses: " + firstRuns + " first runs and 2 second runs. Open any run for its stops, or preview the two that matter most this morning.",
      actions: [UI.Tabs([["D14", "D14 · waiting on stock"], ["D02", "D02 · live"]], pick, (v) => ctx.set({ dlRoute: v }))],
      children: [
        UI.Kpis([
          { label: "Runs", value: String(R.length), sub: onRoad.length + " on the road · " + awaiting.length + " at the bays" },
          { label: "Drops", value: String(T.total), sub: (T.total / R.length).toFixed(1) + " a run" },
          { label: "Value on the road", value: eur(sum(R.map((r) => r.value))), sub: "All of today's orders" },
          { label: "Held for stock", value: "D14", sub: eur(48620) + " · waiting on SO-10482", tone: "warn", onClick: () => ctx.open("order", "SO-10482") },
          { label: "Cost per drop today", value: eur(costToday / T.total, 2), sub: "Month to date " + eur(costPerDrop, 2), onClick: () => go("Delivery", "Vehicles") }
        ]),
        table,
        UI.Grid("minmax(0,1.6fr) minmax(0,1fr)", [
          preview,
          h("div", null,
            UI.Card({ title: "Route OTIF, month to date", icon: "spark", meta: "POINTS BELOW 97%", delay: 120 }, [
              gapBars(otifRoutes.map((x) => [x[0], x[1], x[2], x[3]]), (it) => ctx.open("route", it[3])),
              UI.Note("D11 and D14 run lowest. Both carry most of the Atlas cable and gland drops in West Dublin.", { marginTop: 8 })
            ]),
            spacer(),
            UI.Card({ title: "What changed since 07:00", icon: "clock", meta: "CONOR WHELAN · TRANSPORT PLANNER", delay: 160 }, UI.Feed(CHANGES.map((c) => ({ t: c[0], tone: c[1], text: c[2], onClick: () => ctx.open(c[3][0], c[3][1]) })))))
        ])
      ]
    });
  }

  /* ================================================================ VEHICLES */
  const V = DB.vehicles.map((v) => ({ reg: v[0], type: v[1], pallets: v[2], route: v[3] === "—" ? null : v[3], driver: v[4] === "—" ? null : v[4], status: v[5], util: v[6], service: v[7], wh: v[8] }));
  // Fuel, litres per 100 km, month to date (fleet average 21.0).
  const FUEL = { "232-D-18420": 20.4, "191-D-40218": 20.8, "221-D-11873": 19.6, "211-D-27764": 19.9, "202-D-41177": 20.2, "192-D-23408": 28.6, "231-D-5096": 20.1, "222-D-30581": 11.4, "241-D-7702": 11.8, "241-D-7703": 11.6, "182-D-12004": 31.2, "201-D-44391": 21.4, "231-KE-2217": 20.6, "222-KE-1440": 26.1, "212-KE-3968": 23.9, "201-KE-1109": 11.9, "221-KE-9936": 20.8, "242-KE-2051": 12.2 };
  const vTone = (v) => v.util > 100 ? "bad" : /In service/.test(v.status) ? "warn" : v.route ? "ok" : "neutral";
  const vShort = (v) => v.util > 100 ? "Over payload" : /In service/.test(v.status) ? v.status.replace("In service, ", "Service, ") : /Loading bay/.test(v.status) ? "At bay 4" : /run 2/.test(v.status) ? "On route, run 2 at bay" : v.status.replace(/\s*[–—]\s*/g, " to ");

  function vehicles(ctx) {
    const go = ctx.go;
    const working = V.filter((v) => v.route);
    const spares = V.filter((v) => /Spare/.test(v.status));
    const service = V.filter((v) => /In service/.test(v.status));
    const avgUtil = sum(working.map((v) => v.util)) / working.length;
    const n06 = ctx.done("veh-n06"), d11 = ctx.done("veh-d11"), minDrop = ctx.done("veh-mindrop");

    const fleet = UI.Card({ flush: true, title: "Fleet", meta: V.length + " VEHICLES · DUBLIN " + V.filter((v) => v.wh === "DUB").length + " · NAAS " + V.filter((v) => v.wh === "NAS").length, delay: 40 }, UI.Table({
      rows: V, rowKey: (v) => v.reg, onRow: (v) => v.route ? ctx.open("route", v.route) : null,
      rowTone: (v) => vTone(v) === "bad" ? "bad" : vTone(v) === "warn" ? "warn" : null,
      cols: [
        { label: "Reg", w: "104px", render: (v) => mono(v.reg, { fontSize: 11.5 }) },
        { label: "Type", w: "minmax(130px,1.2fr)", ink: true, render: (v) => v.type },
        { label: "Pallets", w: "60px", r: true, num: true, render: (v) => v.pallets },
        { label: "Site", w: "62px", render: (v) => DB.warehouses[v.wh].short },
        { label: "Route", w: "62px", render: (v) => v.route ? PD.lk(ctx).route(v.route, rl(v.route)) : none("None") },
        { label: "Driver", w: "minmax(100px,1fr)", render: (v) => v.driver ? DB.person(v.driver) : none("Not rostered") },
        { label: "Status", w: "minmax(130px,1.1fr)", render: (v) => UI.Badge(vShort(v), vTone(v)) },
        { label: "Load", w: "108px", render: (v) => v.route ? h("div", { className: "pd-split", style: { gap: 6 } }, UI.Bar(v.util, v.util > 100 ? "bad" : v.util >= 90 ? "warn" : "neutral", { w: 50 }), mono(v.util + "%", { fontSize: 11, color: v.util > 100 ? "var(--bad)" : "var(--body)" })) : none("Idle") },
        { label: "L/100km", w: "66px", r: true, num: true, render: (v) => h("span", { style: { color: FUEL[v.reg] > 27 && v.pallets < 16 ? "var(--warn)" : "var(--body)" } }, FUEL[v.reg].toFixed(1)) },
        { label: "Next service", w: "108px", render: (v) => h("span", { style: { color: /Friday|In service/.test(v.service) ? "var(--warn)" : "var(--body)" } }, v.service) }
      ],
      foot: "Load is booked weight against legal payload. Working vehicles open their route."
    }));

    const payload = UI.Card({ title: "N06 is over its legal payload", icon: "alert", meta: "212-KE-3968 · 7.5T BOX", alert: "bad", delay: 80 }, [
      UI.Facts([["Legal payload", "2,650 kg"], ["Booked today", "2,756 kg", "bad", "104%"], ["Left at Naas", "2 pallets", null, "318 kg · Glenview"], ["Running at", "92%", "ok", "After leaving them"]], 4),
      UI.P(["At 07:40 ", B("Ray Fitzpatrick"), " left Glenview Maintenance's 2 pallets (", PD.lk(ctx).order("SO-10490"), ") at Naas rather than drive overweight. Payload is weight, not space: the pallets fitted. Glenview rang at 09:16."], { marginTop: 12 }),
      UI.P(["It happens again on " + rel(D(2)) + ": N06 is booked to 104% with ", PD.lk(ctx).order("SO-10517"), " for ", PD.lk(ctx).cust("midland"), " (" + eur(6060) + ", 14 lines). N04's 12-tonne curtain-sider covers Portlaoise that day with 3 pallets spare."]),
      h("div", { style: { marginTop: 12 } }, UI.AI({ who: "Dispatch Agent", conf: n06 ? "MOVED" : "BEFORE IT LEAVES THE YARD",
        text: n06 ? "SO-10517 is on N04 for " + rel(D(2)) + ". N06 is booked at 91% that day. Weights now checked at planning, not at the tail-lift." : "Move SO-10517 to N04 for " + rel(D(2)) + ", and check booked weight when the route is planned, not when the driver is loading. A roadside weight check at 104% is a fine and a prohibition notice.",
        actions: [UI.Btn("Move SO-10517 to N04", () => ctx.act("veh-n06", "SO-10517 moved to N04", "Midland Merchants moved to N04 for " + rel(D(2)) + ". N06 now booked at 91%. Colm Dunne's manifest updated."), { pri: true, sm: true, done: n06, doneLabel: "Moved" }),
          UI.Btn("Route N06", () => ctx.open("route", "N06"), { sm: true })] }))
    ]);

    const utilCols = working.slice().sort((a, b) => b.util - a.util).map((v) => ({ l: rl(v.route).replace(" run ", "·"), v: v.util, d: v.util + "%", tone: v.util > 100 ? "bad" : v.util < 70 ? "warn" : null }));
    const byRunCost = R.slice().sort((a, b) => perDrop(b) - perDrop(a)).map((r) => ({ label: rl(r.id), sub: r.stops + (r.stops === 1 ? " drop" : " drops"), v: perDrop(r), d: eur(perDrop(r), 2), tone: r.parent ? "warn" : perDrop(r) > 50 ? "neutral" : null, onClick: () => ctx.open("route", r.id) }));

    return UI.Page({
      kicker: "Delivery · vehicles", live: "TELEMATICS AND FUEL CARDS · 09:15",
      title: V.length + " vehicles, " + working.length + " working, one over payload",
      sub: "Which vehicle is where, how full it is, what it costs to drop an order, and what is due in the workshop. Payload problems belong at planning, not at the roadside.",
      actions: [UI.Btn("Today's runs", () => go("Delivery", "Today"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Fleet", value: String(V.length), sub: "Dublin " + V.filter((v) => v.wh === "DUB").length + " · Naas " + V.filter((v) => v.wh === "NAS").length },
          { label: "Working today", value: String(working.length), sub: onRoad.length + " on route · D14 at bay 4" },
          { label: "Load utilisation", value: Math.round(avgUtil) + "%", sub: "Average of working vehicles" },
          { label: "Over payload", value: "1", sub: "N06 at 104% · 2 pallets left", tone: "bad", toneValue: true, onClick: () => ctx.open("route", "N06") },
          { label: "Spare or in service", value: String(spares.length + service.length), sub: spares.length + " spare · " + service.length + " in service" },
          { label: "Cost per drop", value: eur(costPerDrop, 2), sub: "Month to date · " + num(M.deliveries) + " drops" }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.7fr) minmax(0,1fr)", [fleet, payload]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", [
          UI.Card({ title: "Load by vehicle today", icon: "truck", meta: "BOOKED WEIGHT VS PAYLOAD", delay: 120 }, [
            UI.Columns(utilCols, { h: 150, target: 100, targetLabel: "LEGAL PAYLOAD", showValues: true, max: 108 }),
            UI.Note("D16 is the small-drop van: 5 drops worth " + eur(8450) + " at 66%. That is the right vehicle for north city; the 7.5t boxes are the ones to fill.", { marginTop: 10 })
          ]),
          UI.Card({ title: "Cost per drop by run", icon: "euro", meta: "TODAY · " + eur(costToday) + " FOR " + T.total + " DROPS", delay: 160 }, [
            UI.HBars(byRunCost, { tpl: "minmax(84px,.9fr) 1.4fr 64px", flat: true }),
            UI.Note("The two second runs cost €54 to €58 for a single drop. One exists because of a bin count, the other because of a late pick.", { marginTop: 8 })
          ]),
          UI.Card({ title: "Transport cost, month to date", icon: "euro", meta: eur(FLEET.cost), delay: 200 }, [
            UI.Split([
              { label: "Drivers", v: FLEET.drivers, color: "var(--accent)", d: eur(FLEET.drivers) },
              { label: "Fuel", v: FLEET.fuel, color: "var(--warn)", d: eur(FLEET.fuel) },
              { label: "Vehicles", v: FLEET.vehicle, color: "var(--neutral)", d: eur(FLEET.vehicle) },
              { label: "Couriers", v: FLEET.sub, color: "var(--dim)", d: eur(FLEET.sub) }
            ], { h: 10 }),
            h("div", { style: { height: 12 } }),
            UI.Facts([["Of revenue", (100 * FLEET.cost / DB.kpi.revenueMTD).toFixed(1) + "%"], ["Diesel", eur(FLEET.fuel / FLEET.litres, 2) + "/L", null, num(FLEET.litres) + " litres"], ["Fleet average", (100 * FLEET.litres / FLEET.km).toFixed(1), null, "L/100km · " + num(FLEET.km) + " km"]], 3),
            UI.Note("192-D-23408 (D11) is using 28.6 L/100km against 26 for the other 12-tonne. It is due its service Friday.", { marginTop: 10 })
          ])
        ]),
        UI.Grid("minmax(0,1.2fr) minmax(0,1fr)", [
          UI.Card({ title: "Small drops cost more than they make", icon: "tag", meta: "MONTH TO DATE", delay: 240 }, [
            UI.Facts([["Drops under €250", "184", null, "12% of all drops"], ["Gross profit on them", eur(7820)], ["Delivery cost", eur(Math.round(184 * costPerDrop)), "bad", "at " + eur(costPerDrop, 2) + " a drop"]], 3),
            h("div", { style: { marginTop: 12 } }, UI.AI({ who: "Dispatch Agent", conf: minDrop ? "WITH MICHAEL DOYLE" : null,
              text: "184 drops this month were worth under €250, and between them they lost " + eur(Math.round(184 * costPerDrop) - 7820) + " before overheads. 61 went to customers who had another delivery within two days. Hold small orders for the customer's next scheduled run, or set a €250 minimum drop with a delivery charge below it.",
              actions: [UI.Btn("Send the proposal", () => ctx.act("veh-mindrop", "Proposal sent", "Minimum drop €250 or next scheduled run, sent to Michael Doyle to approve. Account managers see it on the order screen once agreed."), { pri: true, sm: true, done: minDrop, doneLabel: "Sent" }),
                UI.Btn("Where are we losing margin?", () => ctx.ask("Where are we losing margin?"), { sm: true, ghost: true, icon: "spark" })] }))
          ]),
          UI.Card({ title: "Workshop and spares", icon: "clock", meta: service.length + " IN SERVICE · " + spares.length + " SPARE", delay: 280 }, [
            ...[
              ["192-D-23408", "12t curtain-sider · D11", "Service due Friday", "warn", d11 ? "Booked for Friday 16:00, after the run" : "Booked for 08:00. D11 averages 12 pallets; the spare 7.5t takes 10."],
              ["182-D-12004", "18t rigid, crane", "In service, back tomorrow", "warn", "Only crane vehicle. No crane drops booked until " + rel(D(2)) + "."],
              ["242-KE-2051", "3.5t van · Naas", "Back 14:00", "warn", "Covers Naas collections this afternoon."],
              ["212-KE-3968", "7.5t box · N06", "Service in 3 weeks", "bad", "Ran at 104% today. Ask the garage to check springs and brakes early."],
              ["241-D-7702", "3.5t van · Dublin", "Spare, no driver", "neutral", "Could take Glenview's pallets today if a driver were free."],
              ["201-D-44391", "7.5t box · Dublin", "Spare", "neutral", "Ready. The obvious cover for any Dublin 7.5t."]
            ].map((s) => UI.Row({ style: { alignItems: "flex-start" } }, [
              UI.Dot(s[3]),
              h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5 } }, mono(s[0], { fontSize: 11.5 }), h("span", { className: "pd-faint", style: { fontSize: 11.5, marginLeft: 8 } }, s[1])), h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 3 } }, s[4])),
              h("span", { className: "pd-meta" }, s[2].toUpperCase())])),
            h("div", { style: { marginTop: 10 } }, UI.Btn("Move D11's service to 16:00", () => ctx.act("veh-d11", "Service moved", "192-D-23408 booked in for Friday 16:00, after D11 is back. No cover needed."), { sm: true, done: d11, doneLabel: "Moved to 16:00" }))
          ])
        ])
      ]
    });
  }

  /* ================================================================ OTIF */
  // Month to date by site: Dublin 992 of 1,060 (93.6%), Naas 410 of 428 (95.8%). Sums to 1,402 of 1,488.
  const WH = { Dublin: [1060, 992], Naas: [428, 410] };
  // Failures by type: late only, incomplete only, both. Sums to 86 across DB.delivery.reasons.
  const TYPES = { "Supplier delay": [4, 17, 6], "Stock shortage": [2, 15, 4], "Warehouse delay": [12, 2, 1], "Transport": [11, 0, 1], "Customer unavailable": [7, 0, 0], "Other": [2, 2, 0] };
  const late = sum(Object.keys(TYPES).map((k) => TYPES[k][0] + TYPES[k][2]));
  const incomplete = sum(Object.keys(TYPES).map((k) => TYPES[k][1] + TYPES[k][2]));
  // Deliveries containing an Atlas line: 96 of 118 OTIF (81.4%). Everything else: 1,306 of 1,370 (95.3%).
  const ATLAS = { n: 118, ok: 96 };
  const EX_ATLAS = [95.9, 95.5, 96.3, 95.8, 95.3, 96.1, 95.6, 95.5, 95.2, 95.1, 95.4, 95.3];
  const REASON_GO = { "Supplier delay": ["Purchasing", "Supplier Performance"], "Stock shortage": ["Inventory", "Replenishment"], "Warehouse delay": ["Warehouse", "Exceptions"], "Transport": ["Delivery", "Vehicles"], "Customer unavailable": ["Delivery", "Proof of Delivery"] };
  const FAILS = [
    [-1, "SO-10463", "kelleher", "N04", "Late", "Transport", "N04 ran 70 minutes over after the Newbridge roadworks; morning slot missed", null, 1420, "€25 delivery charge credited"],
    [-1, "SO-10460", "midland", "N06", "Late", "Customer unavailable", "Yard closed at 16:00; redelivered this morning", null, 1940, "None"],
    [-1, "SO-10461", "leinster", "D02", "Incomplete", "Supplier delay", "12 LED battens short: Nordic's PO-8812 is six days late", "LT-8120", 2890, "None, balance on D02"],
    [-2, "SO-10455", "horizon", "D14", "Incomplete", "Supplier delay", "SWA glands on PO-8821; the rest went", "EL-4631", 2310, "None"],
    [-2, "SO-10453", "liffey", "D11", "Both", "Supplier delay", "Held a day for cable ties on PO-8821, then sent without them", "IC-3310", 3120, "None"],
    [-2, "SO-10452", "dunmore", "D11", "Incomplete", "Warehouse delay", "Site reported 20 anchors short. POD signed clean; replacement sent anyway", "FIX-2214", 324, "Replacement, RMA-1195"],
    [-3, "SO-10449", "core", "D14", "Incomplete", "Stock shortage", "12 hand soap cartridges short: no PO raised with Kerry", "FH-6710", 1880, "None"],
    [-3, "SO-10447", "westbrook", "D07", "Late", "Warehouse delay", "Packed 13:41, eleven minutes after the second-run cut-off", null, 2260, "None"],
    [-4, "SO-10444", "harbour", "D12", "Late", "Transport", "Tail-lift fault on 231-D-5096; two drops moved to the next morning", null, 2640, "None"],
    [-4, "SO-10442", "atlantic", "D16", "Both", "Stock shortage", "EL-4408 short in Dublin with 71 on hand in Naas; nobody checked", "EL-4408", 1180, "None"]
  ];

  function otif(ctx) {
    const go = ctx.go, L = PD.lk(ctx);
    const target = DL_TARGET, cur = 100 * M.otif / M.deliveries;
    const need = Math.ceil(target / 100 * M.deliveries) - M.otif;
    const lev = ctx.st.dlLev || {};
    const on = (id) => lev[id] !== false;
    const toggle = (id) => ctx.set({ dlLev: Object.assign({}, lev, { [id]: !on(id) }) });
    const LEVERS = [
      { id: "atlas", label: "Atlas-dependent deliveries", n: 19, owner: "EW", fix: "Dual-source cable and glands to EuroCable, check Atlas deliveries at goods in, expedite PO-8821.", act: UI.Btn("Open Atlas", () => ctx.open("supplier", "atlas"), { sm: true }) },
      { id: "stock", label: "Stock shortages", n: 9, owner: "EW", fix: "Check Naas before promising a date; raise reorder points on the 14 SKUs that ran out twice this quarter.", act: UI.Btn("Replenishment", () => go("Inventory", "Replenishment"), { sm: true }) },
      { id: "wh", label: "Warehouse delays", n: 8, owner: "LM", fix: "Fill pick faces before 07:00 and alert at 13:00 on anything not picked for a 13:30 cut-off.", act: UI.Btn("Exceptions", () => go("Warehouse", "Exceptions"), { sm: true }) },
      { id: "tr", label: "Transport", n: 6, owner: "CW", fix: "Check booked weight at planning and plan to store and site receiving windows.", act: UI.Btn("Add receiving windows", () => ctx.act("otif-windows", "Receiving windows added", "Goods-in windows for Leinster Retail's 14 stores, Core Facilities and 9 other sites loaded into the route planner. Conor Whelan to confirm."), { sm: true, done: ctx.done("otif-windows"), doneLabel: "Windows added" }) }
    ];
    const recovered = sum(LEVERS.filter((l) => on(l.id)).map((l) => l.n));
    const proj = 100 * (M.otif + recovered) / M.deliveries;
    let run = M.otif;
    const weeks = Array.from({ length: 12 }, (_, i) => dm(D(-7 * (11 - i))));
    const atlasPct = 100 * ATLAS.ok / ATLAS.n, restPct = 100 * (M.otif - ATLAS.ok) / (M.deliveries - ATLAS.n);

    const trend = UI.Card({ title: "OTIF, last 12 weeks", icon: "spark", meta: "TARGET " + target.toFixed(1) + "%", delay: 60 }, [
      UI.Lines(weeks, [
        { name: "All deliveries", values: DL.trend, color: "var(--accent)", area: true },
        { name: "Excluding deliveries with an Atlas line", values: EX_ATLAS, color: "var(--dim)", dash: true }
      ], { h: 190, min: 92.5, max: 97.5, hline: target, every: 2, marks: [{ i: 7, label: "ATLAS LEAD TIMES SLIP", tone: "bad" }] }),
      UI.Note("Of the 1.2 points lost since Atlas started missing dates, 0.7 is deliveries with an Atlas line on them. Without them OTIF would be " + restPct.toFixed(1) + "%, not " + cur.toFixed(1) + "%.", { marginTop: 10 })
    ]);

    const reasons = UI.Card({ title: "Why deliveries fail", icon: "alert", meta: M.failures + " OF " + num(M.deliveries) + " THIS MONTH", delay: 100 }, [
      UI.HBars(DL.reasons.map((r) => ({ label: r[0], v: r[2], d: r[1] + "% · " + r[2], tone: r[0] === "Supplier delay" ? "bad" : null, onClick: REASON_GO[r[0]] ? () => go(REASON_GO[r[0]][0], REASON_GO[r[0]][1]) : undefined })), { tpl: "minmax(130px,1.1fr) 1.3fr 70px", flat: true }),
      UI.Sep(),
      UI.Label("Late, incomplete, or both"),
      h("div", { style: { height: 8 } }),
      UI.Split([
        { label: "Late only", v: late - 12, color: "var(--warn)", d: String(late - 12) },
        { label: "Incomplete only", v: incomplete - 12, color: "var(--bad)", d: String(incomplete - 12) },
        { label: "Both", v: 12, color: "var(--neutral)", d: "12" }
      ], { h: 9 }),
      UI.Note("Supplier and stock problems make deliveries incomplete. Warehouse and transport problems make them late.", { marginTop: 10 })
    ]);

    const leverRows = LEVERS.map((l) => {
      const inc = on(l.id);
      if (inc) run += l.n;
      return h("div", { key: l.id, className: "pd-row", style: { alignItems: "flex-start", gap: 14, opacity: inc ? 1 : .55, transition: "opacity .2s var(--ease)" } },
        h("button", { className: PD.cx("pd-chip", inc && "on"), onClick: () => toggle(l.id), style: { flex: "none", width: 92, justifyContent: "center" } }, inc ? "Included" : "Left out"),
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 13.5, fontWeight: 500 } }, l.label),
          h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 3, lineHeight: 1.5 } }, l.fix),
          h("div", { className: "pd-meta", style: { marginTop: 5 } }, "OWNER " + DB.person(l.owner).toUpperCase() + " · " + l.n + " FEWER FAILURES A MONTH")),
        h("div", { style: { width: 92, flex: "none", textAlign: "right" } }, mono("+" + pts(l.n) + " pts", { fontSize: 13.5, color: inc ? "var(--ok)" : "var(--dim)" }), h("div", { className: "pd-meta", style: { marginTop: 4 } }, inc ? "TO " + (100 * run / M.deliveries).toFixed(1) + "%" : "NOT COUNTED")),
        h("div", { style: { flex: "none" } }, l.act));
    });

    const path = UI.Card({ tint: true, title: "What it takes to reach " + target.toFixed(0) + "%", icon: "bolt", meta: "FROM " + M.failures + " FAILURES A MONTH TO " + (M.failures - need), delay: 140 }, [
      UI.Grid("minmax(0,1.7fr) minmax(0,1fr)", [
        h("div", null,
          UI.P(["97% of " + num(M.deliveries) + " deliveries is " + num(M.otif + need) + ". We made " + num(M.otif) + ", so the gap is ", B(need + " deliveries a month"), ", " + (target - cur).toFixed(1) + " points. Each failure fixed is worth " + (100 / M.deliveries).toFixed(2) + " of a point. Fixing Atlas-dependent lines alone recovers ", B(pts(19) + " points"), "."]),
          h("div", { style: { marginTop: 8 } }, ...leverRows)),
        h("div", null,
          h("div", { style: { padding: "16px 18px", borderRadius: 18, border: "1px solid var(--border)", background: "var(--surface-strong)" } },
            UI.Label("Projected OTIF"),
            h("div", { style: { fontSize: 38, fontWeight: 500, letterSpacing: "-1.4px", marginTop: 6, color: proj >= target - 0.05 ? "var(--ok)" : "var(--ink)" } }, proj.toFixed(1) + "%"),
            h("div", { style: { fontSize: 12, color: "var(--dim)", marginTop: 2 } }, "from " + cur.toFixed(1) + "% · " + recovered + " of " + need + " deliveries recovered"),
            h("div", { style: { marginTop: 12, position: "relative" } },
              UI.Bar(100 * (proj - 90) / 10, proj >= target - 0.05 ? "ok" : "info", { h: 8 }),
              h("div", { style: { position: "absolute", top: -3, bottom: -3, left: (100 * (target - 90) / 10) + "%", width: 0, borderLeft: "1.5px dashed var(--warn)" } })),
            h("div", { className: "pd-split", style: { marginTop: 6 } }, h("span", { className: "pd-meta" }, "90%"), h("span", { className: "pd-grow" }), h("span", { className: "pd-meta", style: { color: "var(--warn)" } }, "TARGET " + target.toFixed(0) + "%"), h("span", { className: "pd-meta", style: { marginLeft: 22 } }, "100%"))),
          h("div", { style: { height: 12 } }),
          UI.AI({ who: "Ops Watchdog", conf: "HIGH CONFIDENCE",
            text: "Atlas is the lever. Deliveries with an Atlas line run at " + atlasPct.toFixed(1) + "% against " + restPct.toFixed(1) + "% for everything else. The other 1.5 points are habits: look in Naas before promising, fill pick faces before the pickers arrive, weigh the load at planning, and respect the store's receiving window.",
            actions: [
              UI.Btn("Order EL-4408 from EuroCable", () => ctx.act("po-el4408", "PO drafted", "PO-8846 · 160 × EL-4408 from EuroCable (9-day lead). Waiting for Emma Walsh."), { pri: true, sm: true, done: ctx.done("po-el4408"), doneLabel: "PO drafted" }),
              UI.Btn("Expedite PO-8821", () => ctx.act("dq-expedite", "Expedite requested", "Atlas asked for a 07:30 dedicated van at €420 freight. Emma Walsh copied."), { sm: true, done: ctx.done("dq-expedite"), doneLabel: "Expedite requested" }),
              UI.Btn("Ask why", () => ctx.ask("Why has OTIF fallen?"), { sm: true, ghost: true, icon: "spark" })] }))
      ], { style: { marginBottom: 0 } })
    ]);

    const byWh = UI.Card({ title: "By warehouse", icon: "pin", meta: "MONTH TO DATE", delay: 180 }, [
      UI.Facts(DL.byWarehouse.map((w) => [w[0], w[1].toFixed(1) + "%", w[1] < 94 ? "warn" : null, num(WH[w[0]][0]) + " deliveries · " + (WH[w[0]][0] - WH[w[0]][1]) + " failed"]), 2),
      h("div", { style: { height: 12 } }),
      UI.Split([{ label: "Dublin failures", v: WH.Dublin[0] - WH.Dublin[1], color: "var(--bad)", d: String(WH.Dublin[0] - WH.Dublin[1]) }, { label: "Naas", v: WH.Naas[0] - WH.Naas[1], color: "var(--neutral)", d: String(WH.Naas[0] - WH.Naas[1]) }], { h: 9 }),
      UI.Note("Dublin carries " + Math.round(100 * (WH.Dublin[0] - WH.Dublin[1]) / M.failures) + "% of failures on " + Math.round(100 * WH.Dublin[0] / M.deliveries) + "% of deliveries. Atlas stock lands in Dublin, and Naas stock is not checked before Dublin promises a date.", { marginTop: 10 })
    ]);
    const bySup = UI.Card({ title: "By supplier dependency", icon: "factory", meta: "ORDERS CONTAINING THEIR LINES", delay: 200 }, [
      gapBars(DL.bySupplier.map((s) => [s[0], s[1], s[2] + " orders YTD"]), (it) => supId(it[0]) && ctx.open("supplier", supId(it[0]))),
      UI.Note("Bars show points below 97%. " + ATLAS.n + " deliveries this month had an Atlas line; " + (ATLAS.n - ATLAS.ok) + " of them failed.", { marginTop: 8 })
    ]);
    const byRoute = UI.Card({ title: "By route", icon: "route", meta: "MONTH TO DATE", delay: 220 },
      gapBars(R.filter((r) => !r.parent).slice().sort((a, b) => a.otif - b.otif).map((r) => [r.id, r.otif, r.area.split(" & ")[0], r.id]), (it) => ctx.open("route", it[3])));
    const byCust = UI.Card({ title: "By customer", icon: "user", meta: "LOWEST, ROLLING 90 DAYS", delay: 240 }, [
      gapBars(DB.customers.slice().sort((a, b) => a.otif - b.otif).slice(0, 8).map((c) => [c.name, c.otif, null, c.id]), (it) => ctx.open("customer", it[3])),
      UI.Note("Four of the bottom six buy Atlas cable, glands or ties: Dunmore, Horizon, Liffey and Murphy.", { marginTop: 8 })
    ]);
    const byCat = UI.Card({ title: "By product category", icon: "box", meta: "MONTH TO DATE", delay: 260 }, [
      gapBars(DL.byCategory.slice().sort((a, b) => a[1] - b[1])),
      UI.Note("Electrical and Industrial Consumables are the two categories Atlas supplies most.", { marginTop: 8 })
    ]);

    const todayAll = M.deliveries + T.total;
    const failTable = UI.Card({ flush: true, title: "Late and incomplete deliveries, last 5 days", meta: "ROOT CAUSE, NOT JUST THE REASON CODE", delay: 280 }, UI.Table({
      rows: FAILS, rowKey: (f) => f[1], onRow: (f) => DB.customer(f[2]) ? ctx.open("customer", f[2]) : null,
      rowTone: (f) => f[4] === "Late" ? "warn" : "bad",
      cols: [
        { label: "When", w: "80px", render: (f) => rel(D(f[0])) },
        { label: "Order", w: "84px", render: (f) => ordRef(ctx, f[1]) },
        { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (f) => L.cust(f[2]) },
        { label: "Route", w: "58px", render: (f) => L.route(f[3]) },
        { label: "Failed", w: "96px", render: (f) => UI.Badge(f[4], f[4] === "Late" ? "warn" : "bad") },
        { label: "Reason", w: "minmax(120px,.9fr)", render: (f) => f[5] },
        { label: "Root cause", w: "minmax(260px,2.4fr)", render: (f) => h("span", { title: f[6] }, f[6]) },
        { label: "SKU", w: "78px", render: (f) => f[7] ? L.sku(f[7]) : "" },
        { label: "Value", w: "74px", r: true, num: true, render: (f) => eur(f[8]) },
        { label: "Credit or replacement", w: "minmax(150px,1fr)", render: (f) => /None$/.test(f[9]) ? none() : f[9] }
      ],
      foot: "Today's 7 at-risk deliveries decide the month: if all of them miss, month to date falls to " + otifPct(M.otif + T.total - T.atRisk, todayAll) + "; if they all make it, it rises to " + otifPct(M.otif + T.total, todayAll) + "."
    }));

    return UI.Page({
      kicker: "Delivery · OTIF", title: "OTIF " + cur.toFixed(1) + "% against a " + target.toFixed(1) + "% target",
      sub: "On time in full, month to date: " + num(M.otif) + " of " + num(M.deliveries) + " deliveries. " + M.failures + " failed. Why, where, and exactly what it takes to get back to " + target.toFixed(0) + "%.",
      actions: [UI.Btn("Why has OTIF fallen?", () => ctx.ask("Why has OTIF fallen?"), { icon: "spark" }), UI.Btn("What orders depend on Atlas?", () => ctx.ask("What orders depend on Atlas?"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "OTIF month to date", value: cur.toFixed(1) + "%", sub: num(M.otif) + " of " + num(M.deliveries) + " deliveries", hero: true },
          { label: "Target", value: target.toFixed(1) + "%", sub: (target - cur).toFixed(1) + " pts · " + need + " deliveries short", subTone: "warn" },
          { label: "On time", value: otifPct(M.deliveries - late, M.deliveries), sub: late + " late" },
          { label: "In full", value: otifPct(M.deliveries - incomplete, M.deliveries), sub: incomplete + " incomplete" },
          { label: "Failures", value: String(M.failures), sub: "Supplier delay " + DL.reasons[0][1] + "% of them", tone: "bad" },
          { label: "Atlas-dependent", value: atlasPct.toFixed(1) + "%", sub: ATLAS.n + " deliveries · " + (ATLAS.n - ATLAS.ok) + " failed", tone: "bad", toneValue: true, onClick: () => ctx.open("supplier", "atlas") }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.5fr) minmax(0,1fr)", [trend, reasons]),
        path,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)", [byWh, bySup, byRoute]),
        UI.Grid("minmax(0,1fr) minmax(0,1fr)", [byCust, byCat]),
        failTable
      ]
    });
  }

  /* ================================================================ DELIVERY ISSUES */
  // DB.returns plus two that never reach an account record: a counter sale and a minor account.
  const RETURNS = DB.returns.concat([
    { id: "RMA-1189", cust: "swords", order: "SO-10419", sku: "AD-7340", qty: 12, reason: "Damaged", value: 106.80, repl: "Sent", credit: "Not needed", claim: "Internal · Naas forklift", owner: "AB" },
    { id: "RMA-1185", cust: "counter", order: "CS-40718", sku: "EL-4631", qty: 10, reason: "Wrong item", value: 99.50, repl: "Exchanged at counter", credit: "Not needed", claim: "Atlas · mis-pack", owner: "GF" }
  ]).sort((a, b) => a.id < b.id ? 1 : -1);
  const RET_NAME = { "AD-7340": "PU Foam Gun Grade 750ml" };
  // Supplier claims at cost. Open: €722.60, of which Atlas €615.80 on 3 claims.
  const CLAIMS = [
    ["SC-325", "atlas", "RMA-1185", "EL-4631", 68.00, "Submitted", 4, "warn"],
    ["SC-324", "atlas", "RMA-1187", "EL-4631", 136.00, "Submitted", 6, "warn"],
    ["SC-322", "atlas", "RMA-1198", "IC-3310", 411.80, "No response · 9 days", 9, "bad"],
    ["SC-320", "nordic", "RMA-1192", "LT-8120", 106.80, "Acknowledged", 14, "neutral"],
    ["SC-319", "northgate", "RMA-1193", "TL-5120", 142.00, "Credited", 18, "ok"],
    ["SC-318", "atlas", "RMA-1199", "EL-4631", 204.00, "Credited", 24, "ok"],
    ["SC-317", "kerry", "RMA-1190", "FH-6710", 76.80, "Credited", 29, "ok"]
  ];
  const ISSUES = [
    { type: "Return", ref: "RMA-1187", cust: "horizon", order: "SO-10402", what: "20 × EL-4631 glands, 25mm packed as 20mm", cause: "Atlas mis-pack", sku: "EL-4631", value: 199.00, credit: "€199.00 pending", next: "Replacement on D14 today, 14:55", owner: "LM", atlas: true },
    { type: "Incomplete", ref: "SO-10482", cust: "murphy", order: "SO-10482", what: "3 of 18 lines short", cause: "PO-8821, 5 days late", sku: "EL-4408", value: 1867.40, credit: "None if the balance lands " + relLower(D(1)), next: "Balance on tomorrow's first run", owner: "SB", atlas: true },
    { type: "Incomplete", ref: "SO-10488", cust: "horizon", order: "SO-10488", what: "40 × SWA glands short", cause: "PO-8821, 5 days late", sku: "EL-4631", value: 398.00, credit: "None", next: "Balance tomorrow", owner: "MR", atlas: true },
    { type: "Incomplete", ref: "SO-10495", cust: "liffey", order: "SO-10495", what: "20 × cable ties short", cause: "PO-8821, 5 days late", sku: "IC-3310", value: 368.00, credit: "None", next: "Balance tomorrow", owner: "MR", atlas: true },
    { type: "Claim", ref: "SC-322", cust: "atlantic", order: "SO-10428", what: "IC-3310 ties from batch 24-311 snapping", cause: "Atlas quality", sku: "IC-3310", value: 411.80, credit: "Customer credited €92.00", next: "Atlas silent for 9 days", owner: "EW", atlas: true },
    { type: "Late", ref: "SO-10490", cust: "glenview", order: "SO-10490", what: "2 pallets left at Naas", cause: "N06 at 104% of payload", sku: null, value: 2310, credit: "Waive delivery charge", next: "14:00 Naas shuttle", owner: "CW" },
    { type: "Late", ref: "SO-10486", cust: "brennan", order: "SO-10486", what: "3 of 12 lines not picked", cause: "Pick face A-22-04 blocked by a pallet", sku: null, value: 3980, credit: "None", next: "D14 if picked by 13:30", owner: "TN" },
    { type: "Late", ref: "SO-10501", cust: "southside", order: "SO-10501", what: "Missed the D09 cut-off by five minutes", cause: "Packed 09:05", sku: null, value: 1830, credit: "None", next: "D07 run 2, 12:50", owner: "LM" },
    { type: "Shortage", ref: "RMA-1201", cust: "tallaght", order: "SO-10493", what: "4 reels EL-4408 short", cause: "Bin D-14-03 count wrong: 4 found, 12 on system", sku: "EL-4408", value: 118.40, credit: "Not needed", next: "D04 run 2 at 12:00", owner: "LM" },
    { type: "Return", ref: "RMA-1196", cust: "harbour", order: "SO-10458", what: "2 coils EL-4712 crushed", cause: "Load not strapped on D12", sku: "EL-4712", value: 163.66, credit: "€163.66 pending", next: "Replacement sent", owner: "CW" },
    { type: "POD", ref: "SO-10474", cust: "leinster", order: "SO-10474", what: "Store 3 says 2 cartons short", cause: "POD claused, unchecked", sku: null, value: 312.40, credit: "Hold until checked", next: "Photo and pick record to store", owner: "GF" },
    { type: "Late", ref: "SO-10463", cust: "kelleher", order: "SO-10463", what: "Delivered 16:40, morning slot booked", cause: "N04 overran after roadworks", sku: null, value: 1420, credit: "€25 delivery charge credited", next: "Closed with customer", owner: "GF" }
  ];
  const ISS_TONE = { Return: "warn", Incomplete: "bad", Claim: "warn", Late: "warn", Shortage: "bad", POD: "info" };

  function issues(ctx) {
    const L = PD.lk(ctx), go = ctx.go;
    const f = ctx.st.dlIss || "all";
    const rf = ctx.st.dlRet || "all";
    const pick = { all: () => true, atlas: (i) => i.atlas, Incomplete: (i) => i.type === "Incomplete" || i.type === "Shortage", Late: (i) => i.type === "Late", Return: (i) => i.type === "Return" || i.type === "Claim", POD: (i) => i.type === "POD" }[f] || (() => true);
    const rows = ISSUES.filter(pick);
    const pending = RETURNS.filter((r) => r.credit === "Pending");
    const credited = RETURNS.filter((r) => r.credit === "Credited");
    const openClaims = CLAIMS.filter((c) => c[5] !== "Credited");
    const atlasOpen = openClaims.filter((c) => c[1] === "atlas");
    const reasons = ["Shortage", "Wrong item", "Defective", "Damaged", "Transport damage", "Customer error"];
    const retRows = RETURNS.filter((r) => rf === "all" || r.reason === rf);
    const gi = ctx.done("gi-el4631"), esc = ctx.done("clm-atlas"), rule = ctx.done("rule-pod");

    const issueTable = UI.Card({ flush: true, title: "Open service issues", meta: rows.length + " SHOWN · " + ISSUES.length + " OPEN · " + ISSUES.filter((i) => i.atlas).length + " LINKED TO ATLAS", delay: 60 }, [
      h("div", { style: { padding: "0 20px 12px" } }, UI.Chips([
        ["all", "All", ISSUES.length], ["atlas", "Atlas", ISSUES.filter((i) => i.atlas).length], ["Incomplete", "Incomplete", ISSUES.filter((i) => i.type === "Incomplete" || i.type === "Shortage").length],
        ["Late", "Late", ISSUES.filter((i) => i.type === "Late").length], ["Return", "Returns and claims", ISSUES.filter((i) => i.type === "Return" || i.type === "Claim").length], ["POD", "POD disputes", ISSUES.filter((i) => i.type === "POD").length]
      ], f, (v) => ctx.set({ dlIss: v }))),
      UI.Table({
        rows, rowKey: (i) => i.ref, onRow: (i) => DB.order(i.order) ? ctx.open("order", i.order) : DB.customer(i.cust) ? ctx.open("customer", i.cust) : null,
        rowTone: (i) => i.atlas ? "bad" : null, empty: "No open issues of that kind.",
        cols: [
          { label: "Type", w: "96px", render: (i) => UI.Badge(i.type, ISS_TONE[i.type]) },
          { label: "Ref", w: "84px", render: (i) => DB.order(i.ref) ? L.order(i.ref) : mono(i.ref, { fontSize: 11.5 }) },
          { label: "Customer", w: "minmax(140px,1.1fr)", ink: true, render: (i) => L.cust(i.cust) },
          { label: "What happened", w: "minmax(190px,1.6fr)", render: (i) => h("span", { title: i.what }, i.what) },
          { label: "Root cause", w: "minmax(160px,1.3fr)", render: (i) => h("span", { style: { color: i.atlas ? "var(--bad)" : "var(--body)" } }, i.cause) },
          { label: "Value", w: "80px", r: true, num: true, ink: true, render: (i) => eur(i.value, 2) },
          { label: "Credit", w: "minmax(130px,1fr)", render: (i) => /pending|Hold/i.test(i.credit) ? h("span", { style: { color: "var(--warn)" } }, i.credit) : i.credit },
          { label: "Next delivery or step", w: "minmax(160px,1.2fr)", render: (i) => i.next },
          { label: "Owner", w: "110px", render: (i) => DB.person(i.owner) }
        ]
      })
    ]);

    const patterns = UI.Card({ title: "Recurring patterns", icon: "link", meta: "FOUND ACROSS RETURNS, CLAIMS AND PODS", delay: 100 }, [
      h("div", { style: { padding: "2px 0 12px" } },
        h("div", { className: "pd-split" }, UI.Badge("3 IN 5 WEEKS", "bad", true), h("span", { style: { fontSize: 13.5, fontWeight: 500 } }, "Atlas mis-packs EL-4631 glands")),
        UI.P(["25mm glands in 20mm cartons: ", h("span", { className: "pd-mono" }, "RMA-1199"), " Liffey, ", h("span", { className: "pd-mono" }, "RMA-1187"), " Horizon, ", h("span", { className: "pd-mono" }, "RMA-1185"), " a counter sale. ", L.po("PO-8821"), " brings ", B("400 more tomorrow"), ", and ", L.cust("murphy"), " and ", L.cust("horizon"), " are waiting on them."], { marginTop: 8, fontSize: 12.5 }),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10 } }, UI.Btn("Check every carton at goods in", () => ctx.act("gi-el4631", "Goods-in check added", "Eoin Farrell will open and gauge every EL-4631 carton on PO-8821 before put-away. Mis-packs go back on Atlas's van."), { pri: true, sm: true, done: gi, doneLabel: "Check added" }), UI.Btn("EL-4631", () => ctx.open("product", "EL-4631"), { sm: true, ghost: true }))),
      UI.Sep(),
      h("div", { style: { padding: "0 0 12px" } },
        h("div", { className: "pd-split" }, UI.Badge("BATCH 24-311", "bad", true), h("span", { style: { fontSize: 13.5, fontWeight: 500 } }, "IC-3310 cable ties snapping")),
        UI.P([L.cust("atlantic"), " returned 5 boxes (", h("span", { className: "pd-mono" }, "RMA-1198"), "). 24 more from the same batch sit in quarantine in Dublin, on the SKU Murphy is short of today. Claim SC-322 for ", B(eur(411.80, 2)), " has had no answer from Atlas in 9 days."], { marginTop: 8, fontSize: 12.5 }),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10 } }, UI.Btn("Escalate to Declan Moore", () => ctx.act("clm-atlas", "Claim escalated", "SC-322 escalated to Declan Moore, Atlas key account manager, with photos and the batch number. Emma Walsh copied; on the agenda for the supplier review."), { sm: true, done: esc, doneLabel: "Escalated" }), UI.Btn("Atlas", () => ctx.open("supplier", "atlas"), { sm: true, ghost: true }))),
      UI.Sep(),
      h("div", null,
        h("div", { className: "pd-split" }, UI.Badge("€324 GIVEN AWAY", "warn", true), h("span", { style: { fontSize: 13.5, fontWeight: 500 } }, "Shortages replaced before the POD is checked")),
        UI.P([L.cust("dunmore"), " reported 20 anchors short on SO-10452. The POD was signed clean by the site and the replacement went out anyway. Tallaght's shortage today is real: the bin count was wrong."], { marginTop: 8, fontSize: 12.5 }),
        h("div", { style: { display: "flex", gap: 8, marginTop: 10 } }, UI.Btn("Require POD check first", () => ctx.act("rule-pod", "Rule proposed", "Shortage replacements against a clean POD now need the driver photo and pick record first. Sent to Gráinne Foley and Liam Murphy to approve."), { sm: true, done: rule, doneLabel: "Proposed" }), UI.Btn("Proof of delivery", () => go("Delivery", "Proof of Delivery"), { sm: true, ghost: true })))
    ]);

    const retTable = UI.Card({ flush: true, title: "Returns this quarter", meta: RETURNS.length + " RETURNS · " + eur(sum(RETURNS.map((r) => r.value)), 2), delay: 140 }, [
      h("div", { style: { padding: "0 20px 12px" } }, UI.Chips([["all", "All", RETURNS.length]].concat(reasons.map((r) => [r, r, RETURNS.filter((x) => x.reason === r).length])), rf, (v) => ctx.set({ dlRet: v }))),
      UI.Table({
        rows: retRows, rowKey: (r) => r.id, onRow: (r) => DB.order(r.order) ? ctx.open("order", r.order) : DB.customer(r.cust) ? ctx.open("customer", r.cust) : ctx.open("product", r.sku),
        rowTone: (r) => /Atlas/.test(r.claim) ? "bad" : null, empty: "No returns with that reason.",
        cols: [
          { label: "Return", w: "82px", render: (r) => mono(r.id, { fontSize: 11.5 }) },
          { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (r) => custRef(ctx, r.cust) },
          { label: "Order", w: "84px", render: (r) => ordRef(ctx, r.order) },
          { label: "Product", w: "minmax(170px,1.4fr)", render: (r) => h("span", null, L.sku(r.sku), h("span", { className: "pd-faint" }, " " + (DB.product(r.sku) ? DB.product(r.sku).name : RET_NAME[r.sku] || ""))) },
          { label: "Qty", w: "46px", r: true, num: true, render: (r) => r.qty },
          { label: "Reason", w: "120px", render: (r) => UI.Badge(r.reason, /Customer error/.test(r.reason) ? "neutral" : /Wrong|Defective/.test(r.reason) ? "bad" : "warn") },
          { label: "Value", w: "76px", r: true, num: true, ink: true, render: (r) => eur(r.value, 2) },
          { label: "Replacement", w: "minmax(130px,1fr)", render: (r) => { const t = capMonth(r.repl); return /today|run 2/i.test(t) ? h("span", { style: { color: "var(--accent-text)" } }, t) : t; } },
          { label: "Credit", w: "104px", render: (r) => h("span", { style: { color: r.credit === "Pending" ? "var(--warn)" : r.credit === "Credited" ? "var(--ok)" : "var(--body)" } }, r.credit) },
          { label: "Supplier claim", w: "minmax(150px,1.1fr)", render: (r) => r.claim === "—" ? none() : /Atlas/.test(r.claim) ? h("span", { style: { color: "var(--bad)" } }, r.claim) : r.claim },
          { label: "Owner", w: "108px", render: (r) => DB.person(r.owner) }
        ],
        foot: "Credit notes post to Sage 200 when approved. Supplier claims are raised at cost from the same record."
      })
    ]);

    const why = UI.Card({ title: "Why goods come back", icon: "return", meta: "THIS QUARTER", delay: 180 }, [
      UI.HBars(reasons.map((r) => ({ label: r, v: RETURNS.filter((x) => x.reason === r).length, d: String(RETURNS.filter((x) => x.reason === r).length), tone: r === "Wrong item" || r === "Defective" ? "bad" : null, onClick: () => ctx.set({ dlRet: r }) })).sort((a, b) => b.v - a.v), { tpl: "minmax(110px,1fr) 1.3fr 30px", flat: true }),
      UI.Note("Wrong items and defects are supplier problems 6 times out of 7. Shortages and damage are ours.", { marginTop: 8 })
    ]);

    const claims = UI.Card({ flush: true, title: "Supplier claims", meta: openClaims.length + " OPEN · " + eur(sum(openClaims.map((c) => c[4])), 2), delay: 200 }, UI.Table({
      rows: CLAIMS, rowKey: (c) => c[0], onRow: (c) => ctx.open("supplier", c[1]), rowTone: (c) => c[7] === "bad" ? "bad" : null,
      cols: [
        { label: "Claim", w: "70px", render: (c) => mono(c[0], { fontSize: 11.5 }) },
        { label: "Supplier", w: "minmax(130px,1.2fr)", ink: true, render: (c) => L.sup(c[1]) },
        { label: "Return", w: "82px", render: (c) => mono(c[2], { fontSize: 11.5, color: "var(--body)" }) },
        { label: "SKU", w: "76px", render: (c) => L.sku(c[3]) },
        { label: "At cost", w: "76px", r: true, num: true, render: (c) => eur(c[4], 2) },
        { label: "Status", w: "minmax(130px,1fr)", render: (c) => UI.Badge(c[5], c[7]) }
      ]
    }));

    const credits = UI.Card({ title: "Credits and recoveries", icon: "euro", meta: "THIS QUARTER", delay: 220 }, [
      UI.Facts([
        ["Credited to customers", eur(sum(credited.map((r) => r.value)), 2), null, credited.length + " returns"],
        ["Credits pending", eur(sum(pending.map((r) => r.value)), 2), "warn", pending.map((r) => r.id).join(" · ")],
        ["Recovered from suppliers", eur(sum(CLAIMS.filter((c) => c[5] === "Credited").map((c) => c[4])), 2), "ok", "3 claims settled"],
        ["Still to recover", eur(sum(openClaims.map((c) => c[4])), 2), "bad", "Atlas " + eur(sum(atlasOpen.map((c) => c[4])), 2)]
      ], 2),
      UI.Note("Murphy's customer-error return (RMA-1184) is credited less 15% restocking once the stock is back on the shelf.", { marginTop: 10 })
    ]);

    return UI.Page({
      kicker: "Delivery · issues", title: ISSUES.length + " open service issues, " + ISSUES.filter((i) => i.atlas).length + " of them Atlas",
      sub: "Returns, short and late deliveries, supplier claims and POD disputes in one place, each tied to its order, customer, SKU and supplier, so the same problem is not paid for three times.",
      actions: [UI.Btn("Which supplier is causing the most disruption?", () => ctx.ask("Which supplier is causing the most disruption?"), { icon: "spark" })],
      children: [
        UI.Kpis([
          { label: "Open issues", value: String(ISSUES.length), sub: ISSUES.filter((i) => i.atlas).length + " linked to Atlas", tone: "bad" },
          { label: "Returns this quarter", value: String(RETURNS.length), sub: eur(sum(RETURNS.map((r) => r.value)), 2) + " of goods" },
          { label: "Credits pending", value: eur(sum(pending.map((r) => r.value)), 2), sub: pending.length + " returns waiting on approval", tone: "warn" },
          { label: "Open supplier claims", value: eur(sum(openClaims.map((c) => c[4])), 2), sub: "Atlas " + eur(sum(atlasOpen.map((c) => c[4])), 2) + " on " + atlasOpen.length + " claims", onClick: () => ctx.open("supplier", "atlas") },
          { label: "Replacements out today", value: "2", sub: "D14 and D04 run 2", onClick: () => go("Delivery", "Today") },
          { label: "Recurring patterns", value: "3", sub: "2 of them Atlas", tone: "warn" }
        ], "repeat(6,minmax(0,1fr))"),
        UI.Grid("minmax(0,1.75fr) minmax(0,1fr)", [issueTable, patterns]),
        retTable,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1fr) minmax(0,1.3fr) minmax(0,1fr)", [why, claims, credits])
      ]
    });
  }

  /* ================================================================ PROOF OF DELIVERY */
  // Latest 12 of today's 34 PODs. D02's four come from the route itself.
  const PODS = [
    ["10:02", "D02", "westbrook", "SO-10470", "Aidan Kinsella, Bray branch", "ePOD + photo", "", "Clean"],
    ["09:44", "D02", "core", "SO-10471", "Owen Flynn, site services", "ePOD + photo", "", "Clean"],
    ["09:21", "D02", "harbour", "SO-10476", "Fiona Ward, site QS", "ePOD + photo", "", "Clean"],
    ["09:14", "N02", "kelleher", "SO-10485", "Aidan Kelleher", "ePOD + photo", "", "Clean"],
    ["09:09", "D11", "lucan", "SO-10484", "Unattended, agreed drop", "Photo only", "Left in the locked cage as agreed", "Clean"],
    ["08:58", "D02", "leinster", "SO-10474", "K. Doherty, Store 3 goods in", "ePOD + photo", "2 cartons short, unchecked", "Claused"],
    ["08:52", "N06", "midland", "SO-10460", "Tom Delaney", "Paper", "Driver app offline, paper signature", "Clean"],
    ["08:47", "N02", "kildare", "SO-10475", "P. Walsh, stores", "ePOD + photo", "1 cable tray bent", "Claused"],
    ["08:41", "D12", "bray", "SO-10473", "Unattended, agreed drop", "Photo only", "Side gate, as agreed", "Clean"],
    ["08:36", "D16", "swords", "SO-10472", "G. Hanley", "ePOD + photo", "", "Clean"],
    ["08:20", "D09", "southside", "SO-10469", "Gerry Mahon", "ePOD + photo", "Arrived 50 minutes after the booked slot", "Claused"],
    ["08:05", "D04", "brennan", "SO-10468", "Lisa Brennan", "ePOD + photo", "", "Clean"]
  ];
  // PODs holding invoicing in Sage 200. Sums to €17,780.
  const HELD = [
    ["SO-10460", "midland", "N06", 0, 1940, "Paper POD, driver app offline in Portlaoise", "RF"],
    ["SO-10464", "glenview", "N06", -1, 1260, "Paper POD, driver app offline again", "RF"],
    ["SO-10462", "leinster", "D02", -1, 2890, "Store 11 EDI goods receipt not returned", "GF"],
    ["SO-10457", "atlantic", "D16", -2, 1410, "Left at airside security: photo, no signature", "DL"],
    ["SO-10446", "liffey", "D11", -2, 2760, "Signed, name illegible, no printed name", "AK"],
    ["SO-10450", "core", "N04", -3, 4280, "Unattended drop; Core's accounts team pays on a signed POD only", "CD"],
    ["SO-10459", "harbour", "D12", -3, 3240, "Paper POD still in the cab", "MH"]
  ];
  // PODs not captured electronically this month, by driver (40 of 1,488).
  const NON_EPOD = [["RF", 14], ["MH", 6], ["AK", 5], ["CD", 4], ["DL", 3], ["ST", 3], ["PM", 2], ["DB", 1], ["KD", 1], ["GB", 1], ["JN", 0]];
  const DELIVERED_TODAY = 61780;

  function pod(ctx) {
    const L = PD.lk(ctx), go = ctx.go;
    const heldVal = sum(HELD.map((x) => x[4]));
    const todayHeld = sum(HELD.filter((x) => x[3] === 0).map((x) => x[4]));
    const claused = 3, paper = 1, photoOnly = 2, clean = T.delivered - claused;
    const sentEv = ctx.done("pod-leinster"), chased = ctx.done("pod-chase"), offline = ctx.done("pod-offline");

    const chain = UI.Card({ title: "From signature to cash", icon: "link", meta: "WHAT A GOOD POD DOES", delay: 60 }, [
      UI.HChain([
        { k: "Delivered", t: T.delivered + " drops so far", d: "Driver app, GPS and time stamped", tone: "ok" },
        { k: "Proof", t: (T.delivered - paper) + " captured electronically", d: "Signature, printed name, photo of the load", tone: "ok" },
        { k: "Discrepancy", t: claused + " claused", d: "Short, damaged or late, noted at the door", tone: "warn" },
        { k: "Invoice", t: "Raised in Sage 200", d: "Within 2 minutes of a clean signature", onClick: () => go("Finance", "Debtors") },
        { k: "Held", t: eur(heldVal) + " not invoiced", d: HELD.length + " PODs missing or unusable", tone: "bad", onClick: () => { const el = typeof document !== "undefined" && document.getElementById ? document.getElementById("pd-pod-held") : null; if (el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" }); } },
        { k: "Cash", t: "Terms start on the invoice", d: "A paper POD adds 3.4 days on average", onClick: () => go("Finance", "Credit Control") }
      ])
    ]);

    const podTable = UI.Card({ flush: true, title: "Today's proofs of delivery", meta: "LATEST " + PODS.length + " OF " + T.delivered, delay: 100 }, UI.Table({
      rows: PODS, rowKey: (p) => p[3], onRow: (p) => DB.customer(p[2]) ? ctx.open("customer", p[2]) : ctx.open("route", p[1]),
      rowTone: (p) => p[7] === "Claused" ? "warn" : p[5] === "Paper" ? "bad" : null,
      cols: [
        { label: "Time", w: "52px", num: true, render: (p) => p[0] },
        { label: "Route", w: "54px", render: (p) => L.route(p[1]) },
        { label: "Customer", w: "minmax(150px,1.2fr)", ink: true, render: (p) => L.cust(p[2]) },
        { label: "Order", w: "84px", render: (p) => ordRef(ctx, p[3]) },
        { label: "Signed by", w: "minmax(150px,1.2fr)", render: (p) => /Unattended/.test(p[4]) ? none(p[4]) : p[4] },
        { label: "Captured", w: "104px", render: (p) => UI.Badge(p[5], p[5] === "Paper" ? "bad" : p[5] === "Photo only" ? "neutral" : "ok") },
        { label: "Noted at the door", w: "minmax(170px,1.4fr)", render: (p) => p[6] ? h("span", { style: { color: p[7] === "Claused" ? "var(--warn)" : "var(--dim)" } }, p[6]) : none("Nothing noted") },
        { label: "POD", w: "80px", render: (p) => UI.Badge(p[7], p[7] === "Clean" ? "ok" : "warn", true) }
      ],
      foot: "Photo-only drops are agreed in advance with the customer and held on their account record."
    }));

    const held = h("div", { id: "pd-pod-held", style: { scrollMarginTop: 12 } }, UI.Card({ title: "Invoicing held for a POD", icon: "euro", meta: eur(heldVal) + " IN SAGE 200", alert: "bad", delay: 140 }, [
      ...HELD.map((x) => UI.Row({ onClick: DB.customer(x[1]) ? () => ctx.open("customer", x[1]) : undefined, style: { alignItems: "flex-start" } }, [
        h("div", { className: "pd-grow" },
          h("div", { style: { fontSize: 12.5 } }, DB.custName(x[1]), h("span", { className: "pd-mono pd-faint", style: { marginLeft: 8, fontSize: 11 } }, x[0])),
          h("div", { style: { fontSize: 11.5, color: "var(--dim)", marginTop: 2 } }, x[5]),
          h("div", { className: "pd-meta", style: { marginTop: 3 } }, rl(x[2]) + " · " + DB.person(x[6]).toUpperCase() + " · " + rel(D(x[3])).toUpperCase())),
        mono(eur(x[4]))])),
      h("div", { style: { marginTop: 12 } }, UI.AI({ who: "Credit Agent", conf: chased ? "CHASED" : null,
        text: eur(heldVal) + " of goods has been delivered and not invoiced, " + eur(heldVal - todayHeld) + " of it from before today. Terms do not start until the invoice does. Martin Healy has one POD in his cab; Ray Fitzpatrick has two on paper; three need the customer to confirm.",
        actions: [UI.Btn("Chase all 7", () => ctx.act("pod-chase", "7 PODs chased", "Drivers asked to scan paper PODs at the depot tonight. Leinster, Liffey and Core asked to confirm receipt by email; invoices raise automatically on reply."), { pri: true, sm: true, done: chased, doneLabel: "Chased" }),
          UI.Btn("Where is our working capital trapped?", () => ctx.ask("Where is our working capital trapped?"), { sm: true, ghost: true, icon: "spark" })] }))
    ]));

    const DISPUTES = [
      { order: "SO-10474", cust: "leinster", when: "Today 08:58", claim: "Store 3 says 2 cartons short (" + eur(312.40, 2) + ")", pod: "Claused: “2 cartons short, unchecked”", evidence: "Driver photo shows 14 cartons on the pallet. Pick record 14, dispatch scan 14 of 14.", status: "Evidence ready", tone: "warn",
        action: UI.Btn("Send photo and pick record", () => ctx.act("pod-leinster", "Evidence sent", "Photo, pick record and dispatch scan sent to Leinster Retail Store 3 and Alison Grant. Credit held until they check the back store."), { sm: true, pri: true, done: sentEv, doneLabel: "Sent" }) },
      { order: "SO-10458", cust: "harbour", when: dm(D(-4)), claim: "2 coils of EL-4712 crushed (" + eur(163.66, 2) + ")", pod: "Claused at the door: “2 coils crushed”", evidence: "Photo confirms it. The load was not strapped on D12. Credit is fair; RMA-1196.", status: "Credit pending", tone: "warn", action: UI.Btn("Finance", () => go("Finance", "Debtors"), { sm: true }) },
      { order: "SO-10452", cust: "dunmore", when: dm(D(-2)), claim: "Site says 20 × FIX-2214 short", pod: "Signed clean by J. Dunmore", evidence: "Replacement (RMA-1195, " + eur(324) + ") went out before anyone opened the POD. Conceded.", status: "Closed · lost", tone: "bad", action: null }
    ];
    const disputes = UI.Card({ title: "Disputes", icon: "shield", meta: "2 OPEN · 1 CONCEDED", delay: 180 },
      DISPUTES.map((d, i) => h("div", { key: d.order, style: { padding: i ? "14px 0 0" : "2px 0 0", marginTop: i ? 14 : 0, borderTop: i ? "1px solid var(--border)" : 0 } },
        h("div", { className: "pd-split", style: { gap: 8 } }, UI.Badge(d.status, d.tone, true), h("span", { style: { fontSize: 13.5, fontWeight: 500 } }, DB.custName(d.cust)), h("span", { className: "pd-mono pd-faint", style: { fontSize: 11 } }, d.order), h("span", { className: "pd-grow" }), h("span", { className: "pd-meta" }, d.when.toUpperCase())),
        h("div", { style: { display: "grid", gridTemplateColumns: "76px 1fr", gap: "5px 10px", marginTop: 10, fontSize: 12.5, lineHeight: 1.5 } },
          h("span", { className: "pd-label", style: { paddingTop: 2 } }, "Claim"), h("span", { style: { color: "var(--ink)" } }, d.claim),
          h("span", { className: "pd-label", style: { paddingTop: 2 } }, "POD"), h("span", null, d.pod),
          h("span", { className: "pd-label", style: { paddingTop: 2 } }, "Evidence"), h("span", { style: { color: "var(--dim)" } }, d.evidence)),
        d.action ? h("div", { style: { marginTop: 10 } }, d.action) : null)));

    const drivers = UI.Card({ title: "PODs not captured electronically", icon: "user", meta: "BY DRIVER · MONTH TO DATE", delay: 220 }, [
      UI.HBars(NON_EPOD.map((d) => ({ label: DB.person(d[0]), v: d[1], d: String(d[1]), tone: d[1] >= 10 ? "bad" : d[1] >= 5 ? "warn" : null })), { tpl: "minmax(110px,1fr) 1.4fr 30px", flat: true, max: 14 }),
      UI.Note(sum(NON_EPOD.map((d) => d[1])) + " of " + num(M.deliveries) + " this month, " + (100 * (1 - sum(NON_EPOD.map((d) => d[1])) / M.deliveries)).toFixed(1) + "% electronic. A third are Ray Fitzpatrick's on N06: his handset loses signal between Monasterevin and Portlaoise and the app does not store offline.", { marginTop: 8 }),
      h("div", { style: { marginTop: 12 } }, UI.AI({ who: "Dispatch Agent", conf: offline ? "REQUESTED" : null,
        text: "Two paper PODs from N06 in two days, and " + eur(1940 + 1260) + " of invoicing waiting on them. Turn on offline capture for N06's handset so signatures store and send when signal returns.",
        actions: [UI.Btn("Request offline capture", () => ctx.act("pod-offline", "Request logged", "Offline ePOD requested for 212-KE-3968 with the transport system provider. Spare handset issued to Ray Fitzpatrick for tomorrow."), { pri: true, sm: true, done: offline, doneLabel: "Requested" })] }))
    ]);

    return UI.Page({
      kicker: "Delivery · proof of delivery", live: "DRIVER APP · SYNCED WITH SAGE 200",
      title: T.delivered + " delivered, " + clean + " clean PODs, " + eur(heldVal) + " waiting to be invoiced",
      sub: "Who signed, when, what they noted, and whether the invoice has gone. A missing POD is an invoice that has not been raised and a dispute you cannot win.",
      actions: [UI.Btn("Debtors", () => go("Finance", "Debtors"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Delivered today", value: String(T.delivered), sub: eur(DELIVERED_TODAY) + " of goods" },
          { label: "Captured electronically", value: (T.delivered - paper) + " of " + T.delivered, sub: photoOnly + " photo-only drops · " + paper + " on paper" },
          { label: "Clean", value: String(clean), sub: "Nothing noted at the door", subTone: "ok" },
          { label: "Claused", value: String(claused), sub: "Short, damaged or late at the door", tone: "warn" },
          { label: "Invoiced today on POD", value: eur(DELIVERED_TODAY - todayHeld), sub: eur(todayHeld) + " held · N06 paper POD", onClick: () => go("Finance", "Debtors") },
          { label: "Invoicing held", value: eur(heldVal), sub: HELD.length + " PODs missing or unusable", tone: "bad", toneValue: true }
        ], "repeat(6,minmax(0,1fr))"),
        chain,
        h("div", { style: { height: 14 } }),
        UI.Grid("minmax(0,1.7fr) minmax(0,1fr)", [podTable, held]),
        UI.Grid("minmax(0,1.2fr) minmax(0,1fr)", [disputes, drivers])
      ]
    });
  }

  PD.pages.Delivery = { "Today": today, "Routes": routes, "Vehicles": vehicles, "OTIF": otif, "Delivery Issues": issues, "Proof of Delivery": pod };
})();
