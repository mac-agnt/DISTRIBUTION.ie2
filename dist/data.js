/* Pulse · Consulting DISTRIBUTION.ie
   One database under the whole demo. Every number that appears on more than one
   screen is defined here once; pages read it, they never restate it. Dates are
   offsets from today so the demo always reads as live. */
(function () {
  "use strict";
  const PD = window.PD;
  const { D } = PD.date;

  const DB = (PD.DB = {});

  /* ---------------- company ---------------- */
  DB.company = {
    name: "Consulting DISTRIBUTION.ie", short: "CD", tagline: "Distribution, under control.",
    warehouses: 2, vehicles: 18, skus: 8426, accounts: 437, suppliers: 64, staff: 58,
    monthlyRevenue: 1280000, annualised: 15400000, ordersPerMonth: 1840,
    inventory: 2460000, receivables: 318000, erp: "Sage 200"
  };

  /* ---------------- people ---------------- */
  DB.staff = {
    PB: { name: "Patrick Byrne", role: "Managing Director", dept: "Management" },
    MD: { name: "Michael Doyle", role: "Commercial Director", dept: "Commercial" },
    EW: { name: "Emma Walsh", role: "Purchasing Manager", dept: "Purchasing" },
    SB: { name: "Sarah Byrne", role: "Senior Account Manager", dept: "Sales" },
    DK: { name: "David Kelly", role: "Account Manager", dept: "Sales" },
    MR: { name: "Mark Ryan", role: "Account Manager", dept: "Sales" },
    LM: { name: "Liam Murphy", role: "Warehouse Manager, Dublin", dept: "Warehouse" },
    AB: { name: "Aoife Brennan", role: "Warehouse Manager, Naas", dept: "Warehouse" },
    JN: { name: "James Nolan", role: "Driver", dept: "Transport" },
    NC: { name: "Niamh Clarke", role: "Financial Controller", dept: "Finance" },
    RH: { name: "Rachel Hayes", role: "Credit Controller", dept: "Finance" },
    CK: { name: "Ciarán Kavanagh", role: "Buyer", dept: "Purchasing" },
    CW: { name: "Conor Whelan", role: "Transport Planner", dept: "Transport" },
    GF: { name: "Gráinne Foley", role: "Customer Service Lead", dept: "Sales" },
    TN: { name: "Tomasz Nowak", role: "Pick Team Lead, Dublin", dept: "Warehouse" },
    DQ: { name: "Darren Quinn", role: "Picker, Dublin", dept: "Warehouse" },
    SR: { name: "Siobhán Reilly", role: "Picker, Dublin", dept: "Warehouse" },
    PK: { name: "Piotr Kowalski", role: "Picker, Dublin", dept: "Warehouse" },
    EF: { name: "Eoin Farrell", role: "Goods In, Dublin", dept: "Warehouse" },
    AP: { name: "Andrius Petrauskas", role: "Picker, Naas", dept: "Warehouse" },
    KM: { name: "Karen Moloney", role: "Packer, Naas", dept: "Warehouse" },
    PM: { name: "Paddy Moran", role: "Driver", dept: "Transport" },
    KD: { name: "Kevin Daly", role: "Driver", dept: "Transport" },
    DB: { name: "Declan Burke", role: "Driver", dept: "Transport" },
    ST: { name: "Shane Tierney", role: "Driver", dept: "Transport" },
    AK: { name: "Alan Keogh", role: "Driver", dept: "Transport" },
    MH: { name: "Martin Healy", role: "Driver", dept: "Transport" },
    DL: { name: "Dermot Lynch", role: "Driver", dept: "Transport" },
    GB: { name: "Gavin Byrne", role: "Driver", dept: "Transport" },
    CD: { name: "Colm Dunne", role: "Driver", dept: "Transport" },
    RF: { name: "Ray Fitzpatrick", role: "Driver", dept: "Transport" }
  };
  DB.person = (k) => (DB.staff[k] ? DB.staff[k].name : k);

  /* ---------------- sites ---------------- */
  DB.warehouses = {
    DUB: { id: "DUB", name: "Dublin Distribution Centre", short: "Dublin", role: "Primary warehouse", inventory: 1720000, manager: "LM", skus: 7310, staff: 29, bays: 6, address: "Unit 12, Greenhills Business Park, Dublin 24" },
    NAS: { id: "NAS", name: "Naas Distribution Centre", short: "Naas", role: "Secondary warehouse", inventory: 740000, manager: "AB", skus: 4180, staff: 14, bays: 3, address: "Unit 3, Millennium Park, Naas, Co. Kildare" }
  };

  /* ---------------- categories (revenue MTD sums to €1,084,620) ---------------- */
  DB.categories = [
    { id: "Electrical", rev: 286400, gm: 21.9, target: 24.0, inv: 612000 },
    { id: "Fixings & Fasteners", rev: 168200, gm: 27.8, target: 27.0, inv: 428000 },
    { id: "Safety & PPE", rev: 112600, gm: 29.4, target: 28.0, inv: 286000 },
    { id: "Hand & Power Tools", rev: 154300, gm: 24.6, target: 25.0, inv: 364000 },
    { id: "Industrial Consumables", rev: 142800, gm: 17.6, target: 24.0, inv: 318000 },
    { id: "Adhesives & Sealants", rev: 71420, gm: 26.2, target: 26.0, inv: 142000 },
    { id: "Facilities & Hygiene", rev: 98700, gm: 21.4, target: 22.0, inv: 188000 },
    { id: "Lighting", rev: 50200, gm: 25.1, target: 25.0, inv: 122000 }
  ];

  /* ---------------- headline KPIs ---------------- */
  DB.kpi = {
    revenueMTD: 1084620, revenueMTDLabel: "€1,084,620", revenueDelta: "+8.4% vs same period last month",
    gm: 23.8, gmTarget: 25.0, gp: 258000, gapMonthly: 13008, gapAnnual: 156096,
    ordersToday: 94, ordersTodayValue: 176420, atRiskToday: 7, atRiskTodayValue: 46280,
    otif: 94.2, otifTarget: 97.0,
    inventory: 2460000, slow: 286420, dead: 74200,
    backorders: 31, backorderValue: 84760,
    atRisk: 14, atRiskValue: 84760,
    openOrders: 286, openValue: 684200, ready: 174, picking: 58, awaitingStock: 31, creditHold: 9, deliveryRisk: 14,
    decisions: 4
  };

  /* ---------------- suppliers ---------------- */
  DB.suppliers = [
    { id: "atlas", name: "Atlas Industrial Supplies", country: "Ireland", ccy: "EUR", cat: "Electrical & consumables", spend: 1840000, otif: 86.2, fill: 91.4, delay: 3.8, quality: 7, returns: 14, priceChanges: 11, leadAcc: 74, claims: 3, affected: 126, lead: 28, terms: "60 days", status: "Needs review", tone: "bad", contact: "Declan Moore, key account manager", buyer: "EW", openPOs: 6, openValue: 71480, lateNow: 2 },
    { id: "eurofix", name: "EuroFix GmbH", country: "Germany", ccy: "EUR", cat: "Fixings & fasteners", spend: 1320000, otif: 95.4, fill: 97.2, delay: 0.9, quality: 2, returns: 4, priceChanges: 1, leadAcc: 93, claims: 0, affected: 18, lead: 14, terms: "45 days", status: "Watch pricing", tone: "warn", contact: "Katrin Vogel, export sales", buyer: "CK", openPOs: 9, openValue: 96420, lateNow: 0 },
    { id: "northgate", name: "Northgate Tools Ltd", country: "United Kingdom", ccy: "GBP", cat: "Hand & power tools", spend: 1160000, otif: 92.6, fill: 95.8, delay: 1.6, quality: 3, returns: 9, priceChanges: 3, leadAcc: 88, claims: 1, affected: 31, lead: 12, terms: "30 days", status: "Good", tone: "ok", contact: "Gareth Hughes, account manager", buyer: "CK", openPOs: 8, openValue: 88140, lateNow: 1 },
    { id: "hartmann", name: "Hartmann Elektro GmbH", country: "Germany", ccy: "EUR", cat: "Distribution boards & protection", spend: 880000, otif: 90.8, fill: 94.9, delay: 2.1, quality: 2, returns: 5, priceChanges: 4, leadAcc: 85, claims: 1, affected: 22, lead: 21, terms: "45 days", status: "Watch", tone: "warn", contact: "Jonas Keller, sales", buyer: "EW", openPOs: 5, openValue: 84220, lateNow: 1 },
    { id: "kerry", name: "Kerry Hygiene Supplies", country: "Ireland", ccy: "EUR", cat: "Facilities & hygiene", spend: 730000, otif: 94.8, fill: 97.0, delay: 1.0, quality: 2, returns: 3, priceChanges: 1, leadAcc: 91, claims: 0, affected: 15, lead: 5, terms: "30 days", status: "Good", tone: "ok", contact: "Siobhán O'Connor, trade desk", buyer: "CK", openPOs: 7, openValue: 38660, lateNow: 0 },
    { id: "safepro", name: "SafePro Ltd", country: "United Kingdom", ccy: "GBP", cat: "Safety & PPE", spend: 690000, otif: 97.1, fill: 98.6, delay: 0.4, quality: 1, returns: 3, priceChanges: 2, leadAcc: 96, claims: 0, affected: 6, lead: 10, terms: "30 days", status: "Preferred", tone: "ok", contact: "Hannah Price, key accounts", buyer: "CK", openPOs: 6, openValue: 41380, lateNow: 0 },
    { id: "celtic", name: "Celtic Chemicals", country: "Ireland", ccy: "EUR", cat: "Adhesives & sealants", spend: 610000, otif: 96.3, fill: 98.0, delay: 0.6, quality: 1, returns: 2, priceChanges: 2, leadAcc: 94, claims: 0, affected: 8, lead: 7, terms: "30 days", status: "Good", tone: "ok", contact: "Brian Kiely, sales", buyer: "CK", openPOs: 4, openValue: 22940, lateNow: 0 },
    { id: "eurocable", name: "EuroCable BV", country: "Netherlands", ccy: "EUR", cat: "Cable", spend: 540000, otif: 97.8, fill: 99.1, delay: 0.3, quality: 0, returns: 1, priceChanges: 1, leadAcc: 97, claims: 0, affected: 4, lead: 9, terms: "45 days", status: "Preferred", tone: "ok", contact: "Pieter de Vries, export", buyer: "EW", openPOs: 3, openValue: 29840, lateNow: 0 },
    { id: "midland", name: "Midland Abrasives Ltd", country: "United Kingdom", ccy: "GBP", cat: "Abrasives & cutting", spend: 420000, otif: 93.9, fill: 96.4, delay: 1.2, quality: 4, returns: 6, priceChanges: 3, leadAcc: 90, claims: 2, affected: 12, lead: 12, terms: "30 days", status: "Watch pricing", tone: "warn", contact: "Neil Barker, sales", buyer: "CK", openPOs: 3, openValue: 19260, lateNow: 0 },
    { id: "nordic", name: "Nordic Lighting AB", country: "Sweden", ccy: "EUR", cat: "Lighting", spend: 390000, otif: 91.2, fill: 95.0, delay: 2.4, quality: 3, returns: 7, priceChanges: 2, leadAcc: 83, claims: 1, affected: 11, lead: 18, terms: "60 days", status: "Watch", tone: "warn", contact: "Elin Berg, trade sales", buyer: "EW", openPOs: 3, openValue: 26910, lateNow: 1 },
    { id: "polska", name: "Polska Workwear Sp. z o.o.", country: "Poland", ccy: "EUR", cat: "Workwear & PPE", spend: 310000, otif: 89.4, fill: 93.2, delay: 3.1, quality: 5, returns: 11, priceChanges: 1, leadAcc: 80, claims: 2, affected: 9, lead: 21, terms: "45 days", status: "Watch", tone: "warn", contact: "Marta Nowak, export", buyer: "CK", openPOs: 4, openValue: 44310, lateNow: 1 }
  ];
  DB.supplier = (id) => DB.suppliers.find((s) => s.id === id);

  /* ---------------- customers ---------------- */
  DB.customers = [
    { id: "murphy", name: "Murphy Building Supplies", type: "Builders merchant", area: "Naas Road, Dublin 12", am: "SB", ytd: 418420, gm: 25.4, out: 18240, limit: 75000, orders: 84, avg: 4981, otif: 93.6, trend: 12.4, health: "Growing", terms: "30 days", priceList: "Contract · Murphy BS 2026", since: 2011, tier: "A",
      contacts: [["Ger Murphy", "Owner", "087 214 6630"], ["Karen Dolan", "Purchasing", "01 456 2210"], ["Tony Keane", "Yard manager", "086 391 0048"]] },
    { id: "leinster", name: "Leinster Retail Group", type: "National account · 14 stores", area: "Head office, Sandyford", am: "MD", ytd: 386900, gm: 19.8, out: 64210, limit: 120000, orders: 212, avg: 1825, otif: 95.9, trend: 4.1, health: "Stable", terms: "45 days", priceList: "Contract · Leinster Retail national", since: 2016, tier: "A",
      contacts: [["Alison Grant", "Category buyer", "01 293 8810"], ["Rory Phelan", "Store operations", "087 552 0193"]] },
    { id: "core", name: "Core Facilities Ltd", type: "Facilities management · multi-site", area: "Citywest, Dublin 24", am: "MR", ytd: 312640, gm: 28.1, out: 22480, limit: 60000, orders: 138, avg: 2265, otif: 97.2, trend: 6.8, health: "Growing", terms: "30 days", priceList: "Contract · Core FM 2025 to 2027", since: 2014, tier: "A",
      contacts: [["Deirdre Walsh", "Procurement lead", "01 466 0921"], ["Owen Flynn", "Site services", "086 774 1302"]] },
    { id: "doyle", name: "Doyle Construction", type: "Main contractor", area: "Blanchardstown, Dublin 15", am: "SB", ytd: 264180, gm: 22.6, out: 42680, limit: 50000, orders: 41, avg: 6443, otif: 91.8, trend: 2.2, health: "At risk", terms: "30 days", priceList: "Project pricing · Hansfield", since: 2019, tier: "B",
      contacts: [["Noel Doyle", "Director", "087 660 4412"], ["Sinéad Carey", "Accounts", "01 822 7301"]] },
    { id: "westbrook", name: "Westbrook Hardware", type: "Independent retailer · 3 branches", area: "Dundrum, Swords, Bray", am: "DK", ytd: 198760, gm: 26.9, out: 12940, limit: 40000, orders: 96, avg: 2070, otif: 96.4, trend: 3.5, health: "Stable", terms: "30 days", priceList: "Tier A trade", since: 2012, tier: "A",
      contacts: [["Paul Westbrook", "Owner", "087 118 4402"]] },
    { id: "obrien", name: "O'Brien Facilities", type: "Facilities management", area: "Park West, Dublin 12", am: "DK", ytd: 174300, gm: 21.7, out: 16820, limit: 45000, orders: 58, avg: 3005, otif: 95.1, trend: 9.2, health: "Growing", terms: "30 days", priceList: "Tier B trade", since: 2018, tier: "B",
      contacts: [["Martina O'Brien", "Managing director", "01 620 4471"], ["Ciarán Lacey", "Procurement", "086 202 9913"]] },
    { id: "horizon", name: "Horizon Electrical", type: "Electrical contractor", area: "Ballymount, Dublin 12", am: "MR", ytd: 156420, gm: 23.9, out: 9860, limit: 35000, orders: 64, avg: 2444, otif: 92.4, trend: 1.8, health: "Stable", terms: "30 days", priceList: "Tier B trade", since: 2015, tier: "B",
      contacts: [["Seán Horan", "Contracts manager", "087 903 5521"]] },
    { id: "harbour", name: "Harbour Point Construction", type: "Contractor", area: "Dún Laoghaire", am: "SB", ytd: 148900, gm: 24.2, out: 21300, limit: 50000, orders: 37, avg: 4024, otif: 94.0, trend: 14.6, health: "Growing", terms: "30 days", priceList: "Project pricing · Harbour Point", since: 2021, tier: "B",
      contacts: [["Fiona Ward", "Site QS", "086 448 1720"]] },
    { id: "midland", name: "Midland Merchants", type: "Builders merchant", area: "Portlaoise", am: "MR", ytd: 142380, gm: 24.9, out: 17650, limit: 45000, orders: 57, avg: 2498, otif: 93.8, trend: 3.9, health: "Stable", terms: "30 days", priceList: "Tier A trade", since: 2013, tier: "A",
      contacts: [["Tom Delaney", "Buyer", "057 862 1190"]] },
    { id: "liffey", name: "Liffey Mechanical", type: "M&E contractor", area: "Clondalkin, Dublin 22", am: "MR", ytd: 132560, gm: 23.1, out: 14700, limit: 40000, orders: 52, avg: 2549, otif: 93.1, trend: 5.0, health: "Stable", terms: "30 days", priceList: "Tier B trade", since: 2017, tier: "B",
      contacts: [["Mick Byrne", "Buyer", "087 330 7765"]] },
    { id: "atlantic", name: "Atlantic FM Services", type: "Facilities management", area: "Dublin Airport", am: "DK", ytd: 118340, gm: 20.4, out: 11260, limit: 30000, orders: 71, avg: 1667, otif: 96.2, trend: -3.1, health: "Stable", terms: "30 days", priceList: "Tier B trade", since: 2020, tier: "B",
      contacts: [["Lorraine Kinsella", "Facilities buyer", "01 814 5520"]] },
    { id: "dunmore", name: "Dunmore Civil Engineering", type: "Civil contractor", area: "Navan, Co. Meath", am: "SB", ytd: 108760, gm: 22.8, out: 19440, limit: 40000, orders: 23, avg: 4729, otif: 91.3, trend: -6.2, health: "Declining", terms: "30 days", priceList: "Tier B trade", since: 2019, tier: "B",
      contacts: [["Joe Dunmore", "Director", "046 902 4418"]] },
    { id: "kelleher", name: "Kelleher Plumbing & Heating", type: "Contractor", area: "Newbridge, Co. Kildare", am: "MR", ytd: 94820, gm: 26.0, out: 7880, limit: 25000, orders: 49, avg: 1935, otif: 95.8, trend: 2.4, health: "Stable", terms: "30 days", priceList: "Tier B trade", since: 2016, tier: "B",
      contacts: [["Aidan Kelleher", "Owner", "087 441 9906"]] },
    { id: "brennan", name: "Brennan Hire & Tool", type: "Tool hire", area: "Tallaght, Dublin 24", am: "DK", ytd: 86300, gm: 29.2, out: 5420, limit: 20000, orders: 61, avg: 1415, otif: 97.8, trend: 7.1, health: "Growing", terms: "30 days", priceList: "Tier B trade", since: 2018, tier: "B",
      contacts: [["Lisa Brennan", "Operations", "01 451 7780"]] },
    { id: "tallaght", name: "Tallaght Trade Centre", type: "Trade counter", area: "Tallaght, Dublin 24", am: "DK", ytd: 77940, gm: 27.6, out: 8360, limit: 25000, orders: 88, avg: 886, otif: 94.7, trend: 0.6, health: "Stable", terms: "30 days", priceList: "Tier B trade", since: 2015, tier: "B",
      contacts: [["Wayne Doran", "Counter manager", "01 462 3309"]] },
    { id: "ryan", name: "Ryan Trade Supplies", type: "Trade merchant", area: "Drogheda, Co. Louth", am: "DK", ytd: 71240, gm: 27.3, out: 6120, limit: 25000, orders: 44, avg: 1619, otif: 97.0, trend: -28.0, health: "Declining", terms: "30 days", priceList: "Tier B trade", since: 2014, tier: "B",
      contacts: [["Declan Ryan", "Owner", "041 983 2215"]] },
    { id: "glenview", name: "Glenview Maintenance", type: "Property maintenance", area: "Kildare town", am: "MR", ytd: 64210, gm: 25.3, out: 4980, limit: 20000, orders: 39, avg: 1646, otif: 92.9, trend: -1.4, health: "Stable", terms: "30 days", priceList: "Tier C trade", since: 2020, tier: "C",
      contacts: [["Emer Nolan", "Office manager", "045 521 3302"]] },
    { id: "southside", name: "Southside DIY", type: "Retailer", area: "Rathfarnham, Dublin 14", am: "DK", ytd: 58640, gm: 30.1, out: 9720, limit: 15000, orders: 47, avg: 1248, otif: 95.5, trend: -11.8, health: "Declining", terms: "30 days", priceList: "Tier C trade", since: 2017, tier: "C",
      contacts: [["Gerry Mahon", "Owner", "01 490 7718"]] }
  ];
  DB.customer = (id) => DB.customers.find((c) => c.id === id);
  // Smaller accounts that appear on orders and routes.
  DB.minor = {
    clondalkin: "Clondalkin Plumbing Supplies", fingal: "Fingal Electrical", lucan: "Lucan Build Centre", blanch: "Blanchardstown Facilities Co",
    meath: "Meath Maintenance Services", northside: "Northside Property Maintenance", carlow: "Carlow Build Centre", rathmines: "Rathmines Hardware",
    kildare: "Kildare Mechanical", bray: "Bray Maintenance Co", portmarnock: "Portmarnock Property Services", swords: "Swords Builders Supplies"
  };
  DB.custName = (id) => (DB.customer(id) ? DB.customer(id).name : DB.minor[id] || id);

  /* ---------------- products ---------------- */
  // stock by site: [onHand, available, allocated]
  DB.products = [
    { sku: "EL-4408", name: "Industrial Cable 100m", cat: "Electrical", wh: "DUB", onHand: 38, avail: 12, alloc: 26, incoming: 120, weekly: 32, cover: "2.6 days", rop: 75, safety: 48, supplier: "atlas", lead: 28, moq: 100, cost: 21.40, price: 29.60, health: "Critical", naas: [71, 64, 7], po: "PO-8821", bin: "D-14-03" },
    { sku: "EL-4412", name: "Industrial Cable Pro 100m", cat: "Electrical", wh: "DUB", onHand: 96, avail: 84, alloc: 12, incoming: 0, weekly: 14, cover: "6.0 weeks", rop: 40, safety: 20, supplier: "eurocable", lead: 9, moq: 50, cost: 28.08, price: 38.00, health: "Healthy", naas: [18, 18, 0] },
    { sku: "EL-4631", name: "SWA Cable Gland 20mm (10)", cat: "Electrical", wh: "DUB", onHand: 22, avail: 0, alloc: 22, incoming: 400, weekly: 45, cover: "0 days", rop: 120, safety: 60, supplier: "atlas", lead: 21, moq: 200, cost: 6.80, price: 9.95, health: "Critical", naas: [0, 0, 0], po: "PO-8821", bin: "D-11-08" },
    { sku: "IC-3310", name: "Heavy Duty Cable Ties 300mm (1000)", cat: "Industrial Consumables", wh: "DUB", onHand: 10, avail: 0, alloc: 10, incoming: 200, weekly: 26, cover: "0 days", rop: 60, safety: 30, supplier: "atlas", lead: 21, moq: 100, cost: 14.20, price: 18.40, health: "Critical", naas: [6, 0, 6], po: "PO-8821", bin: "D-21-02" },
    { sku: "FIX-2201", name: "M10 Hex Bolt Box 100", cat: "Fixings & Fasteners", wh: "DUB", onHand: 684, avail: 520, alloc: 164, incoming: 500, weekly: 148, cover: "4.6 weeks", rop: 320, safety: 150, supplier: "eurofix", lead: 14, moq: 250, cost: 18.10, oldCost: 16.40, price: 22.90, health: "Healthy", naas: [212, 190, 22], po: "PO-8829", bin: "D-03-11" },
    { sku: "SAF-1892", name: "Safety Glasses Clear", cat: "Safety & PPE", wh: "NAS", onHand: 1840, avail: 1630, alloc: 210, incoming: 0, weekly: 82, cover: "22 weeks", rop: 300, safety: 160, supplier: "safepro", lead: 10, moq: 500, cost: 1.85, price: 3.40, health: "Excess", naas: [1840, 1630, 210], dub: [420, 388, 32] },
    { sku: "FIX-2214", name: "M12 Chemical Anchor Stud (10)", cat: "Fixings & Fasteners", wh: "DUB", onHand: 212, avail: 180, alloc: 32, incoming: 0, weekly: 38, cover: "4.7 weeks", rop: 90, safety: 40, supplier: "eurofix", lead: 14, moq: 100, cost: 11.60, price: 16.20, health: "Healthy", naas: [64, 60, 4] },
    { sku: "FIX-2330", name: "Plasterboard Screw 3.5x32 (1000)", cat: "Fixings & Fasteners", wh: "DUB", onHand: 880, avail: 702, alloc: 178, incoming: 0, weekly: 112, cover: "6.3 weeks", rop: 300, safety: 120, supplier: "eurofix", lead: 14, moq: 500, cost: 6.90, price: 10.20, health: "Healthy", naas: [310, 290, 20] },
    { sku: "FIX-2402", name: "Unistrut Channel 41x41 3m", cat: "Fixings & Fasteners", wh: "DUB", onHand: 420, avail: 350, alloc: 70, incoming: 0, weekly: 6, cover: "58 weeks", rop: 60, safety: 30, supplier: "eurofix", lead: 14, moq: 100, cost: 18.90, price: 24.60, health: "Slow", naas: [0, 0, 0], idle: 188 },
    { sku: "TL-5120", name: "18V Combi Drill Kit", cat: "Hand & Power Tools", wh: "DUB", onHand: 46, avail: 31, alloc: 15, incoming: 24, weekly: 9, cover: "3.4 weeks", rop: 18, safety: 8, supplier: "northgate", lead: 12, moq: 12, cost: 142.00, price: 189.00, health: "Healthy", naas: [14, 12, 2], po: "PO-8832" },
    { sku: "TL-5204", name: "SDS Plus Drill Bit Set 7pc", cat: "Hand & Power Tools", wh: "DUB", onHand: 318, avail: 296, alloc: 22, incoming: 0, weekly: 6, cover: "49 weeks", rop: 40, safety: 20, supplier: "northgate", lead: 12, moq: 50, cost: 18.40, price: 29.90, health: "Excess", naas: [40, 40, 0], idle: 104 },
    { sku: "TL-5388", name: "Tile Cutter 600mm", cat: "Hand & Power Tools", wh: "NAS", onHand: 58, avail: 58, alloc: 0, incoming: 0, weekly: 0.3, cover: "3 years+", rop: 8, safety: 4, supplier: "northgate", lead: 12, moq: 10, cost: 64.00, price: 99.00, health: "Dead", naas: [58, 58, 0], idle: 196 },
    { sku: "IC-3405", name: "Nitrile Gloves Box 100 (L)", cat: "Safety & PPE", wh: "DUB", onHand: 1120, avail: 940, alloc: 180, incoming: 1000, weekly: 260, cover: "3.6 weeks", rop: 600, safety: 300, supplier: "safepro", lead: 10, moq: 500, cost: 4.10, price: 6.90, health: "Low", naas: [380, 330, 50], po: "PO-8833" },
    { sku: "AD-7102", name: "Low Modulus Silicone Clear 310ml", cat: "Adhesives & Sealants", wh: "DUB", onHand: 1460, avail: 1310, alloc: 150, incoming: 0, weekly: 120, cover: "11 weeks", rop: 400, safety: 180, supplier: "celtic", lead: 7, moq: 480, cost: 2.35, price: 4.10, health: "Healthy", naas: [520, 500, 20] },
    { sku: "AD-7340", name: "PU Foam Gun Grade 750ml", cat: "Adhesives & Sealants", wh: "NAS", onHand: 380, avail: 372, alloc: 8, incoming: 0, weekly: 4, cover: "95 weeks", rop: 80, safety: 40, supplier: "celtic", lead: 7, moq: 120, cost: 5.60, price: 8.90, health: "Slow", naas: [380, 372, 8], dub: [12, 4, 8], idle: 128 },
    { sku: "FH-6602", name: "Centrefeed Roll 2-ply (6)", cat: "Facilities & Hygiene", wh: "NAS", onHand: 420, avail: 300, alloc: 120, incoming: 600, weekly: 140, cover: "2.1 weeks", rop: 350, safety: 150, supplier: "kerry", lead: 5, moq: 300, cost: 11.20, price: 15.60, health: "Low", naas: [420, 300, 120], po: "PO-8834" },
    { sku: "FH-6710", name: "Hand Soap Foam 800ml Cartridge", cat: "Facilities & Hygiene", wh: "NAS", onHand: 96, avail: 40, alloc: 56, incoming: 0, weekly: 48, cover: "5.8 days", rop: 120, safety: 60, supplier: "kerry", lead: 5, moq: 240, cost: 6.40, price: 9.80, health: "Critical", naas: [96, 40, 56] },
    { sku: "LT-8120", name: "LED Batten 5ft 40W", cat: "Lighting", wh: "DUB", onHand: 188, avail: 154, alloc: 34, incoming: 120, weekly: 21, cover: "7.3 weeks", rop: 60, safety: 30, supplier: "nordic", lead: 18, moq: 60, cost: 17.80, price: 26.50, health: "Healthy", naas: [30, 30, 0], po: "PO-8844" },
    { sku: "LT-8305", name: "LED Floodlight 100W IP65", cat: "Lighting", wh: "DUB", onHand: 260, avail: 258, alloc: 2, incoming: 0, weekly: 1, cover: "5 years", rop: 30, safety: 10, supplier: "nordic", lead: 18, moq: 40, cost: 34.20, price: 52.00, health: "Dead", naas: [0, 0, 0], idle: 212 },
    { sku: "IC-3120", name: "Cutting Disc 115mm (25)", cat: "Industrial Consumables", wh: "DUB", onHand: 540, avail: 402, alloc: 138, incoming: 0, weekly: 64, cover: "6.3 weeks", rop: 180, safety: 80, supplier: "midland", lead: 12, moq: 200, cost: 9.80, oldCost: 9.00, price: 12.40, health: "Healthy", naas: [150, 140, 10] },
    { sku: "EL-4520", name: "Consumer Unit 10-way RCBO", cat: "Electrical", wh: "DUB", onHand: 34, avail: 20, alloc: 14, incoming: 12, weekly: 6, cover: "3.3 weeks", rop: 12, safety: 6, supplier: "hartmann", lead: 21, moq: 6, cost: 168.00, price: 219.00, health: "Healthy", naas: [6, 6, 0], po: "PO-8830" },
    { sku: "EL-4712", name: "Twin & Earth 2.5mm 100m", cat: "Electrical", wh: "DUB", onHand: 64, avail: 28, alloc: 36, incoming: 80, weekly: 22, cover: "9 days", rop: 60, safety: 30, supplier: "eurocable", lead: 9, moq: 40, cost: 72.40, oldCost: 62.40, price: 81.90, health: "Low", naas: [20, 16, 4], po: "PO-8836" },
    { sku: "SAF-1740", name: "Hi-Vis Vest Orange XXL", cat: "Safety & PPE", wh: "NAS", onHand: 1640, avail: 1640, alloc: 0, incoming: 0, weekly: 0, cover: "No demand", rop: 100, safety: 50, supplier: "polska", lead: 21, moq: 500, cost: 2.10, price: 4.20, health: "Dead", naas: [1640, 1640, 0], idle: 190 },
    { sku: "SAF-1905", name: "Safety Boot S3 Size 9", cat: "Safety & PPE", wh: "NAS", onHand: 142, avail: 128, alloc: 14, incoming: 0, weekly: 3, cover: "43 weeks", rop: 20, safety: 10, supplier: "polska", lead: 21, moq: 24, cost: 24.50, price: 42.00, health: "Slow", naas: [142, 128, 14], idle: 141 },
    { sku: "LT-8410", name: "Emergency Exit Sign LED", cat: "Lighting", wh: "DUB", onHand: 124, avail: 124, alloc: 0, incoming: 0, weekly: 0, cover: "Discontinued", rop: 0, safety: 0, supplier: "nordic", lead: 18, moq: 20, cost: 38.00, price: 61.00, health: "Dead", naas: [0, 0, 0], idle: 233 },
    { sku: "TL-5610", name: "Industrial Fan Heater 3kW", cat: "Hand & Power Tools", wh: "DUB", onHand: 42, avail: 42, alloc: 0, incoming: 0, weekly: 0.5, cover: "Seasonal", rop: 10, safety: 5, supplier: "northgate", lead: 12, moq: 12, cost: 118.00, price: 179.00, health: "Slow", naas: [0, 0, 0], idle: 164 },
    { sku: "IC-3650", name: "Pallet Wrap 500mm Cast (6)", cat: "Industrial Consumables", wh: "NAS", onHand: 610, avail: 590, alloc: 20, incoming: 0, weekly: 12, cover: "49 weeks", rop: 80, safety: 40, supplier: "atlas", lead: 21, moq: 120, cost: 14.20, price: 19.80, health: "Excess", naas: [610, 590, 20], idle: 97 },
    { sku: "SAF-1930", name: "Safety Helmet White", cat: "Safety & PPE", wh: "NAS", onHand: 36, avail: 0, alloc: 36, incoming: 400, weekly: 30, cover: "0 days", rop: 90, safety: 45, supplier: "polska", lead: 21, moq: 200, cost: 3.90, price: 7.40, health: "Critical", naas: [36, 0, 36], po: "PO-8839" }
  ];
  DB.product = (sku) => DB.products.find((p) => p.sku === sku);

  /* ---------------- orders ----------------
     req = days from today; risk reasons use the operational vocabulary. */
  const O = (id, cust, am, value, margin, lines, stock, wh, req, status, route, risk, extra) =>
    Object.assign({ id, cust, am, value, margin, lines, stock, wh, req, status, route, risk }, extra || {});
  DB.orders = [
    O("SO-10482", "murphy", "SB", 27640, 24.7, 18, "3 short", "DUB", 1, "Part allocated", "D14", "HIGH", { reason: "Stock shortage", reasonDetail: "3 lines waiting on PO-8821 from Atlas, 5 days late", po: "PO-8821", short: 3, allocated: 15, atRiskToday: true, channel: "B2B portal", placed: -3, custPO: "MBS-44718", site: "Naas Road yard, Dublin 12", delCost: 214 }),
    O("SO-10491", "westbrook", "DK", 8420, 26.8, 11, "Available", "DUB", 1, "Picking", "D07", "ON TRACK", { channel: "Email", placed: -1, custPO: "WB-D-2291", site: "Dundrum branch" }),
    O("SO-10503", "doyle", "SB", 16240, 22.1, 9, "Available", "DUB", 1, "Credit Hold", null, "HIGH", { reason: "Credit hold", reasonDetail: "Account would reach €58,920 against a €50,000 limit", hold: true, channel: "Rep", placed: 0, custPO: "DC-HANS-0917", site: "Hansfield site, Dublin 15" }),
    O("SO-10478", "core", "MR", 11880, 28.4, 7, "Available", "NAS", 1, "Packed", "N04", "ON TRACK", { channel: "B2B portal", placed: -2, custPO: "CF-77120", site: "Naas campus" }),
    O("SO-10488", "horizon", "MR", 4120, 23.9, 8, "1 short", "DUB", 1, "Part allocated", "D14", "HIGH", { reason: "Late supplier", reasonDetail: "40 × SWA glands on PO-8821", po: "PO-8821", short: 1, atRiskToday: true, channel: "Phone", placed: -2 }),
    O("SO-10486", "brennan", "DK", 3980, 29.2, 12, "Available", "DUB", 0, "Picking delayed", "D14", "HIGH", { reason: "Picking delay", reasonDetail: "Pick face A-22-04 blocked by an unreceived pallet; 9 of 12 lines picked", atRiskToday: true, channel: "B2B portal", placed: -1 }),
    O("SO-10495", "liffey", "MR", 3460, 23.1, 6, "1 short", "DUB", 1, "Part allocated", "D14", "MEDIUM", { reason: "Late supplier", reasonDetail: "20 × cable ties on PO-8821", po: "PO-8821", short: 1, atRiskToday: true, channel: "Email", placed: -2 }),
    O("SO-10493", "tallaght", "DK", 2940, 27.6, 10, "Count mismatch", "DUB", 0, "Allocation failed", "D04", "HIGH", { reason: "Stock discrepancy", reasonDetail: "System shows 12 reels of EL-4408 in bin D-14-03; picker counted 4", atRiskToday: true, channel: "Counter", placed: -1 }),
    O("SO-10490", "glenview", "MR", 2310, 25.3, 5, "Available", "NAS", 0, "Left at depot", "N06", "MEDIUM", { reason: "Vehicle capacity", reasonDetail: "N06 left 2 pallets behind at 07:40; needs a slot today", atRiskToday: true, channel: "Phone", placed: -1 }),
    O("SO-10501", "southside", "DK", 1830, 30.1, 4, "Available", "DUB", 0, "Missed cutoff", null, "MEDIUM", { reason: "Warehouse delay", reasonDetail: "Packed 09:05, five minutes after the D09 cut-off. Next slot is tomorrow 07:05 unless D07 run 2 takes it", atRiskToday: true, channel: "Email", placed: -1 }),
    O("SO-10517", "midland", "MR", 6060, 24.9, 14, "Available", "NAS", 2, "Allocated", "N06", "MEDIUM", { reason: "Vehicle capacity", reasonDetail: "N06 is booked to 104% of payload on " + PD.date.rel(D(2)), channel: "Rep", placed: -1 }),
    O("SO-10509", "harbour", "SB", 5740, 24.2, 13, "1 short", "DUB", 3, "Part allocated", "D12", "MEDIUM", { reason: "Stock shortage", reasonDetail: "12 × EL-4408 not covered until the Naas transfer lands", short: 1, transfer: true, channel: "B2B portal", placed: -1 }),
    O("SO-10515", "leinster", "MD", 3780, 20.6, 16, "1 short", "DUB", 3, "Part allocated", "D02", "MEDIUM", { reason: "Stock shortage", reasonDetail: "8 × EL-4408 not covered until the Naas transfer lands", short: 1, transfer: true, channel: "EDI", placed: 0 }),
    O("SO-10499", "atlantic", "DK", 2860, 20.4, 6, "1 short", "DUB", 2, "Part allocated", "D07", "MEDIUM", { reason: "Late supplier", reasonDetail: "50 × SWA glands on PO-8821", po: "PO-8821", short: 1, channel: "Email", placed: -2 }),
    O("SO-10507", "kelleher", "MR", 2140, 26.0, 5, "1 short", "NAS", 3, "Part allocated", "N04", "LOW", { reason: "Late supplier", reasonDetail: "12 × cable ties on PO-8821", po: "PO-8821", short: 1, channel: "Phone", placed: -1 }),
    O("SO-10511", "dunmore", "SB", 1660, 22.8, 4, "1 short", "DUB", 4, "Part allocated", "D11", "LOW", { reason: "Late supplier", reasonDetail: "18 × cable ties on PO-8821", po: "PO-8821", short: 1, channel: "Email", placed: -1 }),
    // credit holds
    O("SO-10520", "dunmore", "SB", 5410, 23.2, 12, "Available", "DUB", 2, "Credit Hold", null, "MEDIUM", { reason: "Credit hold", reasonDetail: "€8,120 over 60 days; account on watch", hold: true, channel: "Email", placed: 0 }),
    O("SO-10522", "southside", "DK", 2180, 29.4, 8, "Available", "DUB", 2, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "Would take the account to €11,900 against €15,000 with €2,410 overdue", hold: true, channel: "B2B portal", placed: 0 }),
    O("SO-10524", "carlow", "MR", 3060, 25.8, 9, "Available", "NAS", 2, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "Cheque returned unpaid last week", hold: true, channel: "Phone", placed: 0 }),
    O("SO-10526", "rathmines", "DK", 1240, 28.2, 5, "Available", "DUB", 2, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "Account over 60 days", hold: true, channel: "Counter", placed: 0 }),
    O("SO-10527", "kildare", "MR", 2760, 24.6, 7, "Available", "NAS", 3, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "Limit €5,000; would reach €6,340", hold: true, channel: "Email", placed: 0 }),
    O("SO-10529", "bray", "DK", 980, 27.0, 3, "Available", "DUB", 3, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "New account; references not back", hold: true, channel: "B2B portal", placed: 0 }),
    O("SO-10531", "portmarnock", "DK", 1420, 26.4, 4, "Available", "DUB", 3, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "Payment promised Friday, not received", hold: true, channel: "Email", placed: 0 }),
    O("SO-10533", "swords", "SB", 2150, 25.1, 6, "Available", "DUB", 3, "Credit Hold", null, "LOW", { reason: "Credit hold", reasonDetail: "Over limit by €640", hold: true, channel: "Phone", placed: 0 }),
    // route D14 companions and the rest of today's book
    O("SO-10480", "core", "MR", 2480, 27.9, 5, "Available", "DUB", 1, "Allocated", "D14", "ON TRACK", { channel: "B2B portal", placed: -1, site: "Citywest campus" }),
    O("SO-10494", "westbrook", "DK", 1960, 26.2, 6, "Available", "DUB", 1, "Allocated", "D14", "ON TRACK", { channel: "Email", placed: -1, site: "Swords branch" }),
    O("SO-10496", "clondalkin", "MR", 1280, 25.4, 4, "Available", "DUB", 1, "Picking", "D14", "ON TRACK", { channel: "Phone", placed: -1 }),
    O("SO-10498", "fingal", "MR", 1040, 24.1, 5, "Available", "DUB", 1, "Allocated", "D14", "ON TRACK", { channel: "B2B portal", placed: -1 }),
    O("SO-10500", "atlantic", "DK", 1190, 22.8, 3, "Available", "DUB", 1, "Packed", "D14", "ON TRACK", { channel: "Email", placed: -1, site: "Airside" }),
    O("SO-10502", "lucan", "SB", 460, 27.5, 4, "Available", "DUB", 1, "Allocated", "D14", "ON TRACK", { channel: "Counter", placed: -1 }),
    O("SO-10504", "blanch", "MR", 580, 29.1, 3, "Available", "DUB", 1, "Allocated", "D14", "ON TRACK", { channel: "B2B portal", placed: -1 }),
    O("SO-10506", "meath", "MR", 1720, 26.6, 6, "Available", "DUB", 2, "Allocated", "D11", "ON TRACK", { channel: "Email", placed: -1 }),
    O("SO-10508", "northside", "DK", 430, 28.0, 5, "Available", "DUB", 1, "Allocated", "D14", "ON TRACK", { channel: "B2B portal", placed: -1 }),
    O("SO-10512", "murphy", "SB", 2150, 25.9, 6, "Available", "DUB", 3, "New", null, "ON TRACK", { channel: "B2B portal", placed: 0 }),
    O("SO-10514", "obrien", "DK", 4380, 23.9, 9, "Available", "NAS", 2, "Allocated", "N04", "ON TRACK", { channel: "Email", placed: 0 }),
    O("SO-10516", "ryan", "DK", 960, 27.1, 4, "Available", "DUB", 2, "New", null, "ON TRACK", { channel: "Phone", placed: 0 }),
    O("SO-10518", "kelleher", "MR", 1840, 26.0, 7, "Available", "NAS", 1, "Packed", "N04", "ON TRACK", { channel: "Email", placed: -1 }),
    O("SO-10523", "core", "MR", 3960, 28.6, 8, "Available", "NAS", 2, "Allocated", "N02", "ON TRACK", { channel: "B2B portal", placed: 0 }),
    O("SO-10525", "leinster", "MD", 7240, 19.2, 31, "Available", "DUB", 2, "Allocated", "D02", "ON TRACK", { channel: "EDI", placed: 0, marginFlag: true }),
    O("SO-10528", "horizon", "MR", 2760, 24.4, 8, "Available", "DUB", 3, "New", null, "ON TRACK", { channel: "B2B portal", placed: 0 })
  ];
  DB.order = (id) => DB.orders.find((o) => o.id === id);
  DB.atRisk = DB.orders.filter((o) => ["SO-10482", "SO-10503", "SO-10488", "SO-10486", "SO-10495", "SO-10493", "SO-10490", "SO-10501", "SO-10517", "SO-10509", "SO-10515", "SO-10499", "SO-10507", "SO-10511"].indexOf(o.id) > -1);
  DB.atRiskToday = DB.orders.filter((o) => o.atRiskToday);
  DB.creditHolds = DB.orders.filter((o) => o.hold);

  /* Murphy's order lines: 15 allocated, 3 waiting on PO-8821. Sum €27,640.00 */
  DB.murphyLines = [
    ["EL-4408", "Industrial Cable 100m", 28, 29.60, "short"],
    ["EL-4631", "SWA Cable Gland 20mm (10)", 60, 9.95, "short"],
    ["IC-3310", "Heavy Duty Cable Ties 300mm (1000)", 24, 18.40, "short"],
    ["EL-4520", "Consumer Unit 10-way RCBO", 20, 219.00, "allocated"],
    ["EL-4712", "Twin & Earth 2.5mm 100m", 20, 81.83, "allocated"],
    ["FIX-2201", "M10 Hex Bolt Box 100", 40, 21.20, "allocated"],
    ["FIX-2214", "M12 Chemical Anchor Stud (10)", 60, 16.20, "allocated"],
    ["FIX-2330", "Plasterboard Screw 3.5x32 (1000)", 80, 10.20, "allocated"],
    ["TL-5120", "18V Combi Drill Kit", 10, 189.00, "allocated"],
    ["LT-8120", "LED Batten 5ft 40W", 120, 26.50, "allocated"],
    ["AD-7102", "Low Modulus Silicone Clear 310ml", 480, 4.10, "allocated"],
    ["IC-3120", "Cutting Disc 115mm (25)", 90, 12.40, "allocated"],
    ["EL-4815", "Galvanised Trunking 50x50 3m", 140, 14.80, "allocated"],
    ["EL-4820", "Cable Tray 150mm 3m", 60, 28.40, "allocated"],
    ["FIX-2402", "Unistrut Channel 41x41 3m", 50, 24.60, "allocated"],
    ["EL-4301", "Metal Clad Double Socket", 200, 6.95, "allocated"],
    ["EL-4330", "Weatherproof Switch IP66", 90, 11.40, "allocated"],
    ["TL-5230", "Cable Rod Set 10m", 40, 38.60, "allocated"]
  ];
  DB.murphyProfit = { revenue: 27640, cost: 20599, delivery: 214, discount: 1184, gp: 6827 };

  /* ---------------- purchase orders ---------------- */
  const P = (id, supplier, value, items, ordered, promised, expected, eta, wh, status, deps, risk, extra) =>
    Object.assign({ id, supplier, value, items, ordered, promised, expected, eta, wh, status, deps, risk }, extra || {});
  DB.pos = [
    P("PO-8821", "atlas", 38640, 14, -10, -5, 1, "10:30", "DUB", "Late", 6, "CRITICAL", { lateDays: 5, depValue: 41880, buyer: "EW", depOrders: ["SO-10482", "SO-10488", "SO-10495", "SO-10499", "SO-10507", "SO-10511"],
      lines: [["EL-4408", "Industrial Cable 100m", 120, 21.40], ["EL-4631", "SWA Cable Gland 20mm (10)", 400, 6.80], ["IC-3310", "Heavy Duty Cable Ties 300mm (1000)", 200, 14.20]] }),
    P("PO-8809", "hartmann", 26300, 8, -19, -3, 4, "09:00", "DUB", "Late", 1, "HIGH", { lateDays: 3, depValue: 2760, buyer: "EW", depOrders: ["SO-10528"] }),
    P("PO-8818", "northgate", 18420, 9, -12, -2, 2, "11:00", "DUB", "Late", 2, "MEDIUM", { lateDays: 2, depValue: 5210, buyer: "CK" }),
    P("PO-8807", "atlas", 12840, 7, -16, -4, 3, "14:00", "DUB", "Late", 0, "MEDIUM", { lateDays: 4, buyer: "EW" }),
    P("PO-8812", "nordic", 9460, 5, -24, -6, 2, "12:00", "DUB", "Late", 0, "LOW", { lateDays: 6, buyer: "EW" }),
    P("PO-8816", "polska", 12600, 6, -15, -4, 3, "10:00", "NAS", "Late", 0, "LOW", { lateDays: 4, buyer: "CK" }),
    P("PO-8829", "eurofix", 22960, 11, -8, 0, 0, "11:00", "DUB", "Arriving today", 3, "LOW", { buyer: "CK", pallets: 38 }),
    P("PO-8833", "safepro", 9860, 7, -6, 0, 0, "14:00", "NAS", "Arriving today", 3, "LOW", { buyer: "CK", pallets: 12 }),
    P("PO-8826", "celtic", 6180, 4, -5, 0, 0, "09:40", "DUB", "Received · 24 short", 0, "LOW", { buyer: "CK", pallets: 14, received: true }),
    P("PO-8830", "hartmann", 31400, 9, -14, 0, 0, "12:30", "DUB", "Arriving today", 1, "LOW", { buyer: "EW", pallets: 22 }),
    P("PO-8834", "kerry", 18240, 6, -4, 0, 0, "10:15", "NAS", "Arriving today", 2, "LOW", { buyer: "CK", pallets: 64 }),
    P("PO-8832", "northgate", 27880, 12, -9, 0, 0, "15:30", "DUB", "Arriving today", 2, "LOW", { buyer: "CK", pallets: 18 }),
    P("PO-8839", "polska", 31480, 15, -20, 0, 0, "13:00", "NAS", "Arriving today", 2, "LOW", { buyer: "CK", pallets: 78 }),
    P("PO-8836", "eurocable", 14280, 6, -4, 1, 1, "08:30", "DUB", "Confirmed", 4, "LOW", { buyer: "EW" }),
    P("PO-8838", "atlas", 16920, 8, -5, 2, 6, "", "DUB", "At risk", 2, "HIGH", { buyer: "EW", note: "Atlas moved the date by four days this morning" }),
    P("PO-8841", "eurofix", 19740, 10, -3, 11, 11, "", "DUB", "Confirmed", 0, "LOW", { buyer: "CK" }),
    P("PO-8844", "nordic", 11280, 4, -2, 16, 16, "", "DUB", "Confirmed", 2, "LOW", { buyer: "EW" }),
    P("PO-8845", "midland", 8740, 5, -2, 10, 10, "", "DUB", "Confirmed", 0, "LOW", { buyer: "CK" })
  ];
  DB.po = (id) => DB.pos.find((p) => p.id === id);
  DB.goodsInToday = DB.pos.filter((p) => p.expected === 0); // 7 deliveries, €148,000, 246 pallets

  /* ---------------- routes ---------------- */
  const RT = (id, driver, reg, wh, stops, value, depart, finish, status, delivered, extra) =>
    Object.assign({ id, driver, reg, wh, stops, value, depart, finish, status, delivered }, extra || {});
  DB.routes = [
    RT("D02", "DB", "191-D-40218", "DUB", 7, 21480, "08:34", "13:10", "On route", 1, { otif: 95.1, area: "Southside & Sandyford" }),
    RT("D04", "KD", "221-D-11873", "DUB", 6, 12610, "07:00", "11:20", "On route", 3, { otif: 93.8, area: "Tallaght & Firhouse", run: 1 }),
    RT("D04·2", "KD", "221-D-11873", "DUB", 1, 2940, "12:00", "12:50", "Ready", 0, { otif: 93.8, area: "Tallaght Trade Centre, balance after recount", run: 2, parent: "D04" }),
    RT("D07", "PM", "211-D-27764", "DUB", 8, 16940, "06:55", "11:40", "On route", 3, { otif: 96.4, area: "Dundrum & Stillorgan", run: 1 }),
    RT("D07·2", "PM", "211-D-27764", "DUB", 1, 8420, "12:30", "13:20", "Loading", 0, { otif: 96.4, area: "Westbrook Hardware, Dundrum", run: 2, parent: "D07" }),
    RT("D09", "ST", "202-D-41177", "DUB", 5, 9880, "07:05", "12:40", "On route", 4, { otif: 94.2, area: "Rathfarnham & Templeogue" }),
    RT("D11", "AK", "192-D-23408", "DUB", 7, 14920, "07:10", "13:45", "On route", 5, { otif: 92.8, area: "Clondalkin & Lucan" }),
    RT("D12", "MH", "231-D-5096", "DUB", 6, 11760, "07:20", "12:55", "On route", 3, { otif: 94.9, area: "Dún Laoghaire & Bray" }),
    RT("D14", "JN", "232-D-18420", "DUB", 12, 48620, "13:45", "17:20", "Waiting on SO-10482", 0, { otif: 93.1, area: "West Dublin & Fingal" }),
    RT("D16", "DL", "222-D-30581", "DUB", 5, 8450, "07:30", "12:15", "On route", 3, { otif: 97.0, area: "North city" }),
    RT("N02", "GB", "231-KE-2217", "NAS", 6, 7640, "07:00", "12:30", "On route", 4, { otif: 96.8, area: "Kildare & Newbridge" }),
    RT("N04", "CD", "222-KE-1440", "NAS", 6, 6930, "07:15", "13:05", "On route", 5, { otif: 95.2, area: "Naas & Sallins" }),
    RT("N06", "RF", "212-KE-3968", "NAS", 6, 5830, "07:40", "14:10", "On route · 2 pallets left", 3, { otif: 94.4, area: "Portlaoise & Monasterevin" })
  ];
  DB.route = (id) => DB.routes.find((r) => r.id === id);
  // Route D14 stops, sum €48,620
  DB.d14Stops = [
    ["core", "SO-10480", 2480, "Scheduled", "14:05", "Citywest campus"],
    ["murphy", "SO-10482", 27640, "At risk", "14:30", "Naas Road yard"],
    ["horizon", "SO-10488", 4120, "At risk", "14:55", "Ballymount"],
    ["westbrook", "SO-10494", 1960, "Scheduled", "15:20", "Swords branch"],
    ["brennan", "SO-10486", 3980, "At risk", "15:35", "Tallaght depot"],
    ["liffey", "SO-10495", 3460, "At risk", "15:50", "Clondalkin"],
    ["clondalkin", "SO-10496", 1280, "Scheduled", "16:05", "Clondalkin"],
    ["fingal", "SO-10498", 1040, "Scheduled", "16:20", "Blanchardstown"],
    ["atlantic", "SO-10500", 1190, "Scheduled", "16:35", "Airside"],
    ["lucan", "SO-10502", 460, "Scheduled", "16:50", "Lucan"],
    ["blanch", "SO-10504", 580, "Scheduled", "17:05", "Blanchardstown"],
    ["northside", "SO-10508", 430, "Scheduled", "17:20", "Finglas"]
  ];
  // Route D02 is the live example of a route mid-run.
  DB.d02Stops = [
    ["leinster", "SO-10474", 5860, "Delivered", "08:58", "Store 3, Sandyford"],
    ["harbour", "SO-10476", 3420, "Next", "09:25", "Dún Laoghaire site"],
    ["core", "SO-10471", 2710, "Scheduled", "09:50", "Leopardstown"],
    ["westbrook", "SO-10470", 1840, "Scheduled", "10:20", "Bray branch"],
    ["obrien", "SO-10477", 3150, "Scheduled", "10:45", "Cherrywood"],
    ["kelleher", "SO-10479", 2110, "Scheduled", "11:25", "Stepaside"],
    ["leinster", "SO-10481", 2390, "Scheduled", "12:40", "Store 7, Dundrum"]
  ];

  DB.vehicles = [
    ["232-D-18420", "7.5t box, tail-lift", 10, "D14", "JN", "Loading bay 4", 91, "6 weeks", "DUB"],
    ["191-D-40218", "7.5t box, tail-lift", 10, "D02", "DB", "On route", 84, "2 weeks", "DUB"],
    ["221-D-11873", "7.5t box", 10, "D04", "KD", "On route, run 2 ready in bay 2", 76, "9 weeks", "DUB"],
    ["211-D-27764", "7.5t box", 10, "D07", "PM", "On route, run 2 loading in bay 3", 82, "4 weeks", "DUB"],
    ["202-D-41177", "7.5t box", 10, "D09", "ST", "On route", 78, "11 weeks", "DUB"],
    ["192-D-23408", "12t curtain-sider", 14, "D11", "AK", "On route", 88, "Due Friday", "DUB"],
    ["231-D-5096", "7.5t box, tail-lift", 10, "D12", "MH", "On route", 81, "7 weeks", "DUB"],
    ["222-D-30581", "3.5t van", 3, "D16", "DL", "On route", 66, "5 weeks", "DUB"],
    ["241-D-7702", "3.5t van", 3, "", "", "Spare, no driver rostered", 0, "14 weeks", "DUB"],
    ["241-D-7703", "3.5t van", 3, "", "", "Collections cover", 0, "14 weeks", "DUB"],
    ["182-D-12004", "18t rigid, crane", 16, "", "", "In service, back tomorrow", 0, "In service", "DUB"],
    ["201-D-44391", "7.5t box", 10, "", "", "Spare", 0, "3 weeks", "DUB"],
    ["231-KE-2217", "7.5t box, tail-lift", 10, "N02", "GB", "On route", 86, "8 weeks", "NAS"],
    ["222-KE-1440", "12t curtain-sider", 14, "N04", "CD", "On route", 79, "6 weeks", "NAS"],
    ["212-KE-3968", "7.5t box", 10, "N06", "RF", "On route, over payload", 104, "3 weeks", "NAS"],
    ["201-KE-1109", "3.5t van", 3, "", "", "Spare", 0, "10 weeks", "NAS"],
    ["221-KE-9936", "7.5t box", 10, "", "", "Transfer shuttle Naas to Dublin", 0, "12 weeks", "NAS"],
    ["242-KE-2051", "3.5t van", 3, "", "", "In service, back 14:00", 0, "In service", "NAS"]
  ];

  /* ---------------- delivery / OTIF ---------------- */
  DB.delivery = {
    today: { total: 76, delivered: 34, transit: 28, awaiting: 14, otif: 94.2, atRisk: 7 },
    mtd: { deliveries: 1488, otif: 1402, failures: 86 },
    reasons: [["Supplier delay", 31, 27], ["Stock shortage", 24, 21], ["Warehouse delay", 18, 15], ["Transport", 14, 12], ["Customer unavailable", 8, 7], ["Other", 5, 4]],
    trend: [95.6, 95.1, 96.0, 95.4, 94.9, 95.8, 95.2, 94.6, 94.0, 93.8, 94.4, 94.2],
    byWarehouse: [["Dublin", 93.6], ["Naas", 95.8]],
    byCategory: [["Electrical", 91.2], ["Industrial Consumables", 92.6], ["Hand & Power Tools", 95.4], ["Fixings & Fasteners", 96.1], ["Safety & PPE", 96.8], ["Facilities & Hygiene", 95.0], ["Adhesives & Sealants", 97.3], ["Lighting", 94.1]],
    bySupplier: [["Atlas Industrial Supplies", 81.4, 126], ["Polska Workwear", 88.9, 9], ["Hartmann Elektro", 91.7, 22], ["Nordic Lighting", 92.6, 11], ["Northgate Tools", 94.8, 31], ["EuroFix GmbH", 96.8, 18], ["SafePro", 97.9, 6], ["EuroCable", 98.3, 4]]
  };

  /* ---------------- quotes (open €186,000) ---------------- */
  DB.quotes = [
    { id: "QT-2841", cust: "obrien", am: "DK", value: 18420, margin: 17.2, target: 24.0, status: "Pending approval", age: 2, annual: 92100, reason: "Strategic deal: 5-site FM supply agreement", approver: "MD", lines: 34 },
    { id: "QT-2847", cust: "atlantic", am: "DK", value: 11260, margin: 19.9, target: 24.0, status: "Pending approval", age: 3, annual: 67560, reason: "Matching a competitor quote on consumables", approver: "MD", lines: 22 },
    { id: "QT-2853", cust: "liffey", am: "MR", value: 8940, margin: 20.6, target: 25.0, status: "Pending approval", age: 1, annual: 53640, reason: "Volume commitment on cable and containment", approver: "MD", lines: 18 },
    { id: "QT-2859", cust: "harbour", am: "SB", value: 14860, margin: 20.1, target: 25.0, status: "Pending approval", age: 1, annual: 81940, reason: "Phase 2 fit-out, 14 months", approver: "MD", lines: 27 },
    { id: "QT-2838", cust: "leinster", am: "MD", value: 42600, margin: 24.8, target: 22.0, status: "With customer", age: 9, lines: 112 },
    { id: "QT-2844", cust: "murphy", am: "SB", value: 9780, margin: 26.2, target: 25.0, status: "With customer", age: 6, lines: 21 },
    { id: "QT-2850", cust: "core", am: "MR", value: 16400, margin: 28.9, target: 26.0, status: "With customer", age: 4, lines: 40 },
    { id: "QT-2855", cust: "midland", am: "MR", value: 12340, margin: 25.2, target: 25.0, status: "With customer", age: 12, lines: 26 },
    { id: "QT-2861", cust: "westbrook", am: "DK", value: 6920, margin: 27.4, target: 26.0, status: "With customer", age: 3, lines: 15 },
    { id: "QT-2862", cust: "horizon", am: "MR", value: 5480, margin: 24.9, target: 24.0, status: "Draft", age: 1, lines: 11 },
    { id: "QT-2864", cust: "southside", am: "DK", value: 3210, margin: 31.0, target: 28.0, status: "No response · 34 days", age: 34, lines: 9 },
    { id: "QT-2865", cust: "kelleher", am: "MR", value: 7380, margin: 26.1, target: 25.0, status: "With customer", age: 5, lines: 14 },
    { id: "QT-2866", cust: "doyle", am: "SB", value: 18900, margin: 23.4, target: 24.0, status: "Blocked · credit", age: 7, lines: 30 },
    { id: "QT-2867", cust: "brennan", am: "DK", value: 9510, margin: 29.6, target: 27.0, status: "With customer", age: 2, lines: 12 }
  ];
  DB.quote = (id) => DB.quotes.find((q) => q.id === id);
  // Accepting the four low-margin quotes as priced costs €15,408 of gross profit over their 12-month terms.
  DB.lowMarginQuotes = DB.quotes.filter((q) => q.annual);

  /* ---------------- margin leakage (sums to €13,008 a month) ---------------- */
  DB.leakage = [
    { id: "pricing", label: "Outdated customer pricing", v: 4820, detail: "42 contract price lists not repriced since supplier increases in June and September", owner: "MD" },
    { id: "discount", label: "Excessive discounting", v: 3260, detail: "Discounts above the rep's band on 118 order lines this month", owner: "MD" },
    { id: "cost", label: "Supplier cost increases not passed through", v: 2940, detail: "EuroFix, Midland Abrasives and EuroCable increases still selling at old prices", owner: "EW" },
    { id: "quotes", label: "Low margin quotes", v: 1460, detail: "Quotes converted this month below the category floor", owner: "MD" },
    { id: "override", label: "Manual price overrides", v: 528, detail: "63 overrides at order entry, 9 without a reason code", owner: "GF" }
  ];

  DB.costChanges = [
    { supplier: "eurofix", sku: "FIX-2201", name: "M10 Hex Bolt Box 100", old: 16.40, now: 18.10, pct: 10.4, customers: 37, volume: 482, impact: 819, since: "1 " + PD.date.MS[PD.date.TODAY.getMonth()] },
    { supplier: "eurocable", sku: "EL-4712", name: "Twin & Earth 2.5mm 100m", old: 62.40, now: 72.40, pct: 16.0, customers: 24, volume: 71, impact: 710, since: "Copper surcharge" },
    { supplier: "midland", sku: "IC-3120", name: "Cutting Disc 115mm (25)", old: 9.00, now: 9.80, pct: 8.9, customers: 58, volume: 402, impact: 322, since: "Last month" },
    { supplier: "atlas", sku: "IC-3310", name: "Heavy Duty Cable Ties 300mm (1000)", old: 13.37, now: 14.20, pct: 6.2, customers: 41, volume: 118, impact: 98, since: "Last month" },
    { supplier: "kerry", sku: "FH-6602", name: "Centrefeed Roll 2-ply (6)", old: 10.69, now: 11.20, pct: 4.8, customers: 29, volume: 560, impact: 286, since: "This month" },
    { supplier: "midland", sku: "IC-3144", name: "Flap Disc 115mm 80 grit (10)", old: 11.10, now: 12.10, pct: 9.0, customers: 33, volume: 128, impact: 128, since: "Last month" },
    { supplier: "polska", sku: "SAF-1930", name: "Safety Helmet White", old: 3.77, now: 3.90, pct: 3.5, customers: 19, volume: 440, impact: 57, since: "This month" }
  ];

  /* ---------------- finance ---------------- */
  DB.finance = {
    receivables: 318000, overdue: 124000, ageing: [["Current", 194000], ["30 days", 68000], ["60 days", 34000], ["90+ days", 22000]],
    inventoryOver120: 189580, cashTied: 2778000, payables: 486000, bank: 386400, facility: 750000, facilityUsed: 270000,
    wcRelease: [["Slow stock reduction", 168000], ["Improved collections", 38000], ["Supplier terms", 12000], ["Stock optimisation", 8000]]
  };
  DB.invoices = [
    { id: "INV-28482", cust: "doyle", value: 11860, days: 61, status: "Overdue" },
    { id: "INV-28617", cust: "doyle", value: 9340, days: 47, status: "Overdue" },
    { id: "INV-28790", cust: "doyle", value: 13120, days: 28, status: "Current" },
    { id: "INV-28902", cust: "doyle", value: 8360, days: 12, status: "Current" },
    { id: "INV-28844", cust: "murphy", value: 9120, days: 22, status: "Current" },
    { id: "INV-28911", cust: "murphy", value: 6480, days: 9, status: "Current" },
    { id: "INV-28956", cust: "murphy", value: 2640, days: 3, status: "Current" }
  ];
  // Debtor ledger, top accounts: [cust, current, 30, 60, 90+]
  DB.debtors = [
    ["leinster", 41820, 16240, 6150, 0],
    ["doyle", 21480, 9340, 11860, 0],
    ["core", 22480, 0, 0, 0],
    ["harbour", 14200, 7100, 0, 0],
    ["dunmore", 6120, 5200, 3940, 4180],
    ["murphy", 18240, 0, 0, 0],
    ["midland", 11650, 6000, 0, 0],
    ["obrien", 12420, 4400, 0, 0],
    ["liffey", 9200, 5500, 0, 0],
    ["westbrook", 12940, 0, 0, 0],
    ["atlantic", 7260, 4000, 0, 0],
    ["southside", 7310, 0, 1210, 1200]
  ];

  /* ---------------- returns & claims ---------------- */
  DB.returns = [
    { id: "RMA-1201", cust: "tallaght", order: "SO-10493", sku: "EL-4408", qty: 4, reason: "Shortage", value: 118.40, repl: "Balance on D04 run 2", credit: "Not needed", claim: "None", owner: "LM" },
    { id: "RMA-1199", cust: "liffey", order: "SO-10431", sku: "EL-4631", qty: 30, reason: "Wrong item", value: 298.50, repl: "Sent " + PD.date.relLower(D(-2)), credit: "Credited", claim: "Atlas · mis-pack", owner: "GF" },
    { id: "RMA-1198", cust: "atlantic", order: "SO-10428", sku: "IC-3310", qty: 5, reason: "Defective", value: 92.00, repl: "Sent", credit: "Credited", claim: "Atlas · brittle batch 24-311", owner: "GF" },
    { id: "RMA-1196", cust: "harbour", order: "SO-10458", sku: "EL-4712", qty: 2, reason: "Transport damage", value: 163.66, repl: "Sent", credit: "Pending", claim: "Carrier · internal", owner: "CW" },
    { id: "RMA-1195", cust: "dunmore", order: "SO-10452", sku: "FIX-2214", qty: 20, reason: "Shortage", value: 324.00, repl: "Sent", credit: "Not needed", claim: "None", owner: "LM" },
    { id: "RMA-1193", cust: "westbrook", order: "SO-10441", sku: "TL-5120", qty: 1, reason: "Defective", value: 189.00, repl: "Sent", credit: "Credited", claim: "Northgate · battery", owner: "GF" },
    { id: "RMA-1192", cust: "leinster", order: "SO-10433", sku: "LT-8120", qty: 6, reason: "Defective", value: 159.00, repl: "Sent", credit: "Credited", claim: "Nordic · driver fault", owner: "GF" },
    { id: "RMA-1190", cust: "core", order: "SO-10417", sku: "FH-6710", qty: 12, reason: "Defective", value: 117.60, repl: "Sent", credit: "Credited", claim: "Kerry · pump", owner: "GF" },
    { id: "RMA-1187", cust: "horizon", order: "SO-10402", sku: "EL-4631", qty: 20, reason: "Wrong item", value: 199.00, repl: "On D14 today", credit: "Pending", claim: "Atlas · mis-pack", owner: "LM" },
    { id: "RMA-1184", cust: "murphy", order: "SO-10311", sku: "AD-7102", qty: 24, reason: "Customer error", value: 98.40, repl: "Collected", credit: "Restocking 15%", claim: "None", owner: "GF" }
  ];

  /* ---------------- decisions (Home) ---------------- */
  DB.decisions = [
    { id: "dq-obrien", title: "Approve €18,420 quote at 17.2% margin", who: "O'Brien Facilities", area: "Commercial", impact: "−€1,252 GP on this order · −€6,263 a year at this price", reason: "David Kelly is matching a 5-site FM tender. Target is 24%.", rec: "Counter at €19,429 (21.5%): inside the band, and recovers €1,009 of gross profit on this call-off.", owner: "MD", due: "Today 11:00", tone: "warn", open: ["quote", "QT-2841"] },
    { id: "dq-doyle", title: "Release €16,240 order above customer credit limit", who: "Doyle Construction", area: "Finance", impact: "Exposure €58,920 against a €50,000 limit", reason: "INV-28482 (€11,860) is 61 days old. The order is for Hansfield, due tomorrow.", rec: "Release €7,320 now against available credit; hold the rest until INV-28482 is paid.", owner: "PB", due: "Today 10:00", tone: "bad", open: ["customer", "doyle"] },
    { id: "dq-transfer", title: "Transfer 40 units from Naas to Dublin", who: "EL-4408 Industrial Cable 100m", area: "Inventory", impact: "Protects 3 orders worth €12,460", reason: "Dublin needs 58 in the next 7 days and has 12. Naas has 64 and needs 11.", rec: "Put 40 on today's 14:00 shuttle; lands before the D12 and D02 runs.", owner: "EW", due: "Today 13:00", tone: "info", open: ["product", "EL-4408"] },
    { id: "dq-expedite", title: "Expedite PO-8821 for €420 additional freight", who: "Atlas Industrial Supplies", area: "Purchasing", impact: "€41,880 of customer orders waiting", reason: "Atlas can put the 3 short SKUs on a dedicated van for 07:30 instead of 10:30.", rec: "Approve: the remaining Murphy lines make tomorrow's first run instead of the afternoon.", owner: "EW", due: "Today 12:00", tone: "warn", open: ["po", "PO-8821"] }
  ];

  /* ---------------- activity (company feels alive) ---------------- */
  DB.activity = [
    ["09:14", "agent", "Inventory Agent", "detected a projected stockout for EL-4408 Industrial Cable 100m in Dublin within 3 days.", ["product", "EL-4408"], "bad"],
    ["09:11", "person", "Sarah Byrne", "updated Murphy Building Supplies order SO-10482: customer accepts a split delivery.", ["order", "SO-10482"], "info"],
    ["09:06", "system", "Warehouse system", "flagged a count mismatch on bin D-14-03: 4 reels found, 12 expected.", ["product", "EL-4408"], "warn"],
    ["09:04", "system", "Atlas supplier portal", "changed PO-8821 expected arrival to " + PD.date.relLower(D(1)) + " 10:30.", ["po", "PO-8821"], "warn"],
    ["09:02", "person", "Gráinne Foley", "logged a call from Horizon Electrical asking for an ETA on SO-10488.", ["order", "SO-10488"], "warn"],
    ["08:58", "agent", "Margin Agent", "identified 37 customer price agreements affected by the EuroFix cost increase.", ["sku", "FIX-2201"], "warn"],
    ["08:52", "system", "Sage 200", "synced 18 new orders from the B2B portal and EDI.", null, "neutral"],
    ["08:47", "system", "Warehouse system", "completed SO-10478 for Core Facilities: packed, 7 lines, bay N-2.", ["order", "SO-10478"], "ok"],
    ["08:44", "agent", "Purchasing Agent", "found 6 customer orders worth €41,880 depending on PO-8821.", ["po", "PO-8821"], "bad"],
    ["08:42", "agent", "Credit Agent", "placed SO-10503 on hold: Doyle Construction would reach €58,920 against a €50,000 limit.", ["order", "SO-10503"], "bad"],
    ["08:39", "system", "Microsoft Outlook", "linked a customer email to SO-10482 (\"Can we get what you have today?\").", ["order", "SO-10482"], "neutral"],
    ["08:34", "system", "Transport system", "marked Route D02 departed Dublin: 7 stops, €21,480.", ["route", "D02"], "ok"],
    ["08:31", "system", "Supplier feeds", "imported the EuroFix price file: 428 changes identified.", ["supplier", "eurofix"], "warn"],
    ["08:22", "person", "David Kelly", "submitted QT-2841 for O'Brien Facilities at 17.2% margin for approval.", ["quote", "QT-2841"], "warn"],
    ["08:16", "system", "Sage 200", "updated 12 customer payment statuses; €21,340 received overnight.", null, "ok"],
    ["08:09", "agent", "Dispatch Agent", "re-planned N06: 2 pallets for Glenview Maintenance need a slot today.", ["order", "SO-10490"], "warn"],
    ["08:03", "agent", "Briefing Agent", "completed the morning operational briefing for Patrick Byrne.", null, "info"],
    ["07:58", "system", "Warehouse system", "confirmed 244 units received against PO-8819 (Kerry Hygiene).", null, "ok"],
    ["07:40", "person", "Ray Fitzpatrick", "left 2 pallets at Naas: N06 at 104% of payload.", ["route", "N06"], "warn"],
    ["07:12", "agent", "Customer Agent", "noticed Ryan Trade Supplies has not bought M10 hex bolts in 47 days.", ["customer", "ryan"], "warn"]
  ];

  /* ---------------- sanity checks: a console warning beats a wrong number on a slide ---------------- */
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  const chk = (label, got, want) => { if (Math.abs(got - want) > 0.51) console.warn("[PD data] " + label + ": " + got + " ≠ " + want); };
  chk("category revenue", sum(DB.categories.map((c) => c.rev)), 1084620);
  chk("category inventory", sum(DB.categories.map((c) => c.inv)), 2460000);
  chk("warehouse inventory", DB.warehouses.DUB.inventory + DB.warehouses.NAS.inventory, 2460000);
  chk("at-risk value", sum(DB.atRisk.map((o) => o.value)), 84760);
  chk("at-risk count", DB.atRisk.length, 14);
  chk("at-risk today", sum(DB.atRiskToday.map((o) => o.value)), 46280);
  chk("at-risk today count", DB.atRiskToday.length, 7);
  chk("PO-8821 dependents", sum(DB.po("PO-8821").depOrders.map((id) => DB.order(id).value)), 41880);
  chk("credit holds", DB.creditHolds.length, 9);
  chk("Murphy lines", Math.round(100 * sum(DB.murphyLines.map((l) => l[2] * l[3]))) / 100, 27640);
  chk("D14 value", sum(DB.d14Stops.map((s) => s[2])), 48620);
  chk("D14 stops", DB.d14Stops.length, 12);
  chk("route stops", sum(DB.routes.map((r) => r.stops)), 76);
  chk("route delivered", sum(DB.routes.map((r) => r.delivered)), 34);
  chk("route awaiting", sum(DB.routes.filter((r) => ["Ready", "Loading"].indexOf(r.status) > -1 || r.id === "D14").map((r) => r.stops)), 14);
  chk("route value = orders today", sum(DB.routes.map((r) => r.value)), 176420);
  chk("D02 stops value", sum(DB.d02Stops.map((x) => x[2])), 21480);
  chk("goods in value", sum(DB.goodsInToday.map((p) => p.value)), 148000);
  chk("goods in pallets", sum(DB.goodsInToday.map((p) => p.pallets)), 246);
  chk("goods in count", DB.goodsInToday.length, 7);
  chk("quotes open", sum(DB.quotes.map((q) => q.value)), 186000);
  chk("low margin GP at stake", Math.round(sum(DB.lowMarginQuotes.map((q) => q.annual * (q.target - q.margin) / 100))), 15408);
  chk("leakage", sum(DB.leakage.map((l) => l.v)), 13008);
  chk("ageing", sum(DB.finance.ageing.map((a) => a[1])), 318000);
  chk("wc release", sum(DB.finance.wcRelease.map((a) => a[1])), 226000);
  chk("Doyle balance", sum(DB.invoices.filter((i) => i.cust === "doyle").map((i) => i.value)), 42680);
  chk("Murphy balance", sum(DB.invoices.filter((i) => i.cust === "murphy").map((i) => i.value)), 18240);
  chk("OTIF failures", sum(DB.delivery.reasons.map((r) => r[2])), 86);
  chk("OTIF reasons %", sum(DB.delivery.reasons.map((r) => r[1])), 100);
  chk("Murphy GP", DB.murphyProfit.revenue - DB.murphyProfit.cost - DB.murphyProfit.delivery, DB.murphyProfit.gp);
})();
