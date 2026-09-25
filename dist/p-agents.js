/* Agents → Agent Activity: what each agent did today, what it is waiting on, and where it stopped. */
(function () {
  "use strict";
  const PD = window.PD, h = PD.h, UI = PD.UI, DB = PD.DB;
  const B = UI.B;

  const AGENTS = [
    { id: "briefing", name: "Briefing", job: "Morning and evening management briefs", actions: 14, waiting: 0, saved: "12h", tone: "ok" },
    { id: "ops", name: "Ops Watchdog", job: "Late orders, bottlenecks, fulfilment risk", actions: 96, waiting: 1, saved: "20h", tone: "warn" },
    { id: "inventory", name: "Inventory Agent", job: "Stockouts, excess, reorder points, balancing", actions: 71, waiting: 2, saved: "22h", tone: "warn" },
    { id: "purchasing", name: "Purchasing Agent", job: "Supplier POs, delays, recommendations", actions: 48, waiting: 7, saved: "18h", tone: "warn" },
    { id: "margin", name: "Margin Agent", job: "Leakage, cost changes, discounts", actions: 63, waiting: 2, saved: "14h", tone: "warn" },
    { id: "customer", name: "Customer Agent", job: "Account health, buying patterns, opportunities", actions: 39, waiting: 1, saved: "10h", tone: "ok" },
    { id: "dispatch", name: "Dispatch Agent", job: "Routes, sequencing, delivery risk, OTIF", actions: 57, waiting: 0, saved: "8h", tone: "ok" },
    { id: "credit", name: "Credit Agent", job: "Exposure, held orders, collections", actions: 24, waiting: 2, saved: "11h", tone: "warn" }
  ];

  // [time, agent, what it did, effect, record, state]
  const LOG = [
    ["09:14", "Inventory Agent", "Projected a stockout for EL-4408 in Dublin within 3 days and proposed a 40-unit transfer from Naas", "read → proposal", ["product", "EL-4408"], "Waiting on Emma Walsh"],
    ["09:14", "Inventory Agent", "Drafted a 160-unit PO to EuroCable for EL-4408 (9-day lead instead of 28)", "write · needs a yes", ["product", "EL-4408"], "Waiting on Emma Walsh"],
    ["09:06", "Ops Watchdog", "Flagged a bin count mismatch at D-14-03 and booked a recount for 16:00", "write · task created", ["product", "EL-4408"], "Done"],
    ["08:58", "Margin Agent", "Matched the EuroFix price file to 37 customer agreements still on the old M10 cost", "read", ["supplier", "eurofix"], "Done"],
    ["08:44", "Purchasing Agent", "Traced 6 customer orders worth €41,880 to PO-8821 and drafted 6 customer updates", "write · needs a yes", ["po", "PO-8821"], "Waiting on account managers"],
    ["08:42", "Credit Agent", "Held SO-10503 before it reached the pick queue: exposure would be €58,920", "write · order held", ["order", "SO-10503"], "Waiting on Patrick Byrne"],
    ["08:23", "Margin Agent", "Held QT-2841 at 17.2% and calculated a counter at €19,429", "write · pricing held", ["quote", "QT-2841"], "Waiting on Michael Doyle"],
    ["08:09", "Dispatch Agent", "Re-planned N06 around 2 pallets that did not fit", "read → proposal", ["route", "N06"], "Done"],
    ["08:03", "Briefing", "Posted the morning brief: 7 orders at risk, 4 decisions", "read", null, "Done"],
    ["07:12", "Customer Agent", "Noticed Ryan Trade has not bought M10 bolts in 47 days", "read → task", ["customer", "ryan"], "Assigned to David Kelly"],
    ["06:40", "Ops Watchdog", "Checked 1,284 pick lines against today's cut-offs", "read", null, "Done"]
  ];

  function agentActivity(ctx) {
    const total = AGENTS.reduce((a, g) => a + g.actions, 0), waiting = AGENTS.reduce((a, g) => a + g.waiting, 0);
    return UI.Page({
      kicker: "Agents · today", live: "8 AGENTS WORKING",
      title: "What the agents did this morning",
      sub: "Every action an agent took, the record it touched, and where it stopped for a person. Agents read, detect and draft. Anything that changes a record or leaves the building waits for a yes.",
      actions: [UI.Btn("Ask the Briefing Agent", () => ctx.ask("What do I need to fix today?"), { pri: true, icon: "spark" }), UI.Btn("Open agents", () => ctx.go("Agents", "Agents"), { ghost: true })],
      children: [
        UI.Kpis([
          { label: "Agent actions today", value: String(total), sub: "Since 06:00" },
          { label: "Waiting on a person", value: String(waiting), sub: "Drafts, holds and proposals", tone: "warn" },
          { label: "Sent without asking", value: "0", sub: "Write and external tools always wait", subTone: "ok" },
          { label: "Time saved this month", value: "115 hours", sub: "Across 11 workflows" },
          { label: "Spend today", value: "€0.71", sub: "Cap €40 a month" }
        ]),
        UI.Grid("minmax(0,1.55fr) minmax(0,1fr)", [
          UI.Card({ flush: true, title: "Action log", meta: "NEWEST FIRST · EVERY LINE LINKS TO ITS RECORD" }, UI.Table({
            rows: LOG, rowKey: (r) => r[0] + r[2], onRow: (r) => r[4] ? ctx.open(r[4][0], r[4][1]) : null,
            rowTone: (r) => /Waiting/.test(r[5]) ? "warn" : null,
            cols: [
              { label: "Time", w: "56px", render: (r) => h("span", { className: "pd-mono", style: { fontSize: 11.5 } }, r[0]) },
              { label: "Agent", w: "132px", ink: true, render: (r) => r[1] },
              { label: "What it did", w: "minmax(280px,3fr)", render: (r) => h("span", { title: r[2], style: { color: "var(--body)" } }, r[2]) },
              { label: "Effect", w: "150px", render: (r) => UI.Badge(r[3], /needs a yes/.test(r[3]) ? "warn" : /write/.test(r[3]) ? "info" : "neutral") },
              { label: "Now", w: "minmax(150px,1.2fr)", render: (r) => h("span", { style: { color: /Waiting/.test(r[5]) ? "var(--warn)" : "var(--dim)" } }, r[5]) }
            ]
          })),
          h("div", null,
            UI.Card({ title: "By agent", icon: "spark", delay: 60 }, AGENTS.map((g) => UI.Row({ key: g.id, onClick: () => ctx.go("Agents", "Agents") }, [
              UI.Dot(g.tone),
              h("div", { className: "pd-grow" }, h("div", { style: { fontSize: 12.5, fontWeight: 500 } }, g.name), h("div", { className: "pd-ell", style: { fontSize: 11.5, color: "var(--dim)" } }, g.job)),
              h("div", { style: { textAlign: "right" } }, h("div", { className: "pd-mono", style: { fontSize: 12, color: "var(--ink)" } }, g.actions + " actions"), h("div", { className: "pd-meta", style: { color: g.waiting ? "var(--warn)" : "var(--faint)" } }, g.waiting ? g.waiting + " WAITING" : "NOTHING WAITING"))]))),
            h("div", { style: { height: 14 } }),
            UI.Card({ title: "Guardrails", icon: "shield", delay: 120 }, [
              UI.Steps([{ l: "Read" }, { l: "Detect" }, { l: "Draft" }, { l: "Propose", kind: "go" }, { l: "A person says yes", kind: "gate" }, { l: "Write to Sage 200" }]),
              UI.Note("Write and external tools store the proposal with a hash of its exact arguments. Confirming replays the stored arguments, never anything typed after.", { marginTop: 12 })
            ]))
        ]),
        UI.Card({ tint: true, title: "Asked this morning", icon: "spark", meta: "PATRICK BYRNE · 08:41", delay: 160 }, [
          h("div", { style: { fontSize: 13.5, color: "var(--ink)", fontWeight: 500 } }, "“What is most likely to cost us money today?”"),
          UI.P([B("Three issues represent approximately €59,288 of immediate commercial exposure. "), "1. ", PD.lk(ctx).cust("murphy"), ", €27,640: order ", PD.lk(ctx).order("SO-10482"), " is at risk due to three stock shortages linked to late supplier ", PD.lk(ctx).po("PO-8821"), ". 2. ", PD.lk(ctx).cust("doyle"), ", €16,240: order ", PD.lk(ctx).order("SO-10503"), " is held because the account would exceed its €50,000 credit limit. 3. Margin exceptions, €15,408: four pending quotes are below target margin; ", PD.lk(ctx).quote("QT-2841", "O'Brien Facilities"), " has the largest variance at 17.2% versus a 24% target. I recommend resolving the Murphy order first because its required delivery date is tomorrow."], { marginTop: 10 }),
          h("div", { style: { display: "flex", gap: 8, marginTop: 14 } }, UI.Btn("Ask it yourself", () => ctx.ask("What is most likely to cost us money today?"), { sm: true, pri: true }), UI.Btn("Open SO-10482", () => ctx.open("order", "SO-10482"), { sm: true }))
        ])
      ]
    });
  }

  PD.pages.Agents = Object.assign(PD.pages.Agents || {}, { "Agent Activity": agentActivity });
})();
