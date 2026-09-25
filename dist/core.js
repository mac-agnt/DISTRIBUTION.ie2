/* Pulse · Consulting DISTRIBUTION.ie
   Core: dates, formatting, the glass UI kit and the page registry.
   Every page is plain React (window.React), rendered into the Pulse v4 Glass shell
   through one template slot. Colours come from the shell's CSS variables only. */
(function () {
  "use strict";
  const R = window.React;
  const h = R.createElement;
  const F = R.Fragment;
  const PD = (window.PD = window.PD || {});
  PD.h = h;
  PD.F = F;
  PD.pages = PD.pages || {};
  PD.records = PD.records || {};

  /* ---------- dates: the demo always reads as "today" ---------- */
  // A distributor's day: shown at the weekend, the demo reads as the next working day, so
  // "94 orders dispatching today" and "delivery tomorrow" stay true.
  const TODAY = new Date();
  TODAY.setHours(0, 0, 0, 0);
  while (TODAY.getDay() === 0 || TODAY.getDay() === 6) TODAY.setDate(TODAY.getDate() + 1);
  const MS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const ML = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const WDL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const D = (n) => { const x = new Date(TODAY); x.setDate(x.getDate() + n); return x; };
  const dm = (d) => d.getDate() + " " + MS[d.getMonth()];
  const dml = (d) => d.getDate() + " " + ML[d.getMonth()];
  const daysFrom = (d) => Math.round((d - TODAY) / 864e5);
  const rel = (d) => {
    const n = daysFrom(d);
    if (n === 0) return "Today";
    if (n === 1) return "Tomorrow";
    if (n === -1) return "Yesterday";
    if (n > 1 && n < 7) return WD[d.getDay()] + " " + dm(d);
    return dm(d);
  };
  const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const nowHM = () => { const n = new Date(), hr = n.getHours(); return hr >= 7 && hr < 18 && TODAY.getDate() === n.getDate() ? n.toTimeString().slice(0, 5) : "09:21"; };
  PD.date = { TODAY, D, dm, dml, rel, nowHM, relLower: (d) => lower(rel(d)), daysFrom, MS, ML, WD, WDL,
    monthName: ML[TODAY.getMonth()], weekday: WDL[TODAY.getDay()] };

  /* ---------- formatting ---------- */
  const eur = (v, dp) => (v < 0 ? "−€" : "€") + Math.abs(Number(v)).toLocaleString("en-IE", { minimumFractionDigits: dp || 0, maximumFractionDigits: dp || 0 });
  const eurK = (v) => {
    const a = Math.abs(v);
    if (a >= 1e6) return "€" + (v / 1e6).toFixed(2) + "m";
    if (a >= 1e4) return "€" + Math.round(v / 1e3) + "k";
    if (a >= 1e3) return "€" + (v / 1e3).toFixed(1) + "k";
    return eur(v);
  };
  const num = (v) => Number(v).toLocaleString("en-IE");
  const pct = (v, dp) => Number(v).toFixed(dp === undefined ? 1 : dp) + "%";
  PD.fmt = { eur, eurK, num, pct };

  /* ---------- tones ---------- */
  const TONE = {
    ok: { fg: "var(--ok)", bg: "var(--ok-soft)" },
    warn: { fg: "var(--warn)", bg: "var(--warn-soft)" },
    bad: { fg: "var(--bad)", bg: "var(--bad-soft)" },
    info: { fg: "var(--accent-text)", bg: "var(--accent-soft)" },
    accent: { fg: "var(--on-accent)", bg: "var(--accent)" },
    neutral: { fg: "var(--dim)", bg: "var(--track)" }
  };
  PD.TONE = TONE;
  const riskTone = (r) => ({ CRITICAL: "bad", HIGH: "bad", MEDIUM: "warn", LOW: "neutral", "ON TRACK": "ok", "AT RISK": "warn", LATE: "bad" }[String(r).toUpperCase()] || "neutral");
  PD.riskTone = riskTone;

  /* ---------- styles: injected once, all through the shell's tokens ---------- */
  const CSS = `
.pd{padding:2px 0 56px;max-width:1520px;margin:0 auto}
.pd *{box-sizing:border-box}
.pd-head{display:flex;align-items:flex-end;gap:18px;margin:4px 0 18px;flex-wrap:wrap}
.pd-head-main{flex:1 1 420px;min-width:0}
.pd-crumbs{display:flex;align-items:center;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase}
.pd-back{height:26px;display:inline-flex;align-items:center;gap:6px;padding:0 11px 0 8px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--dim);font-family:inherit;font-size:11.5px;letter-spacing:0;text-transform:none;cursor:pointer;transition:border-color .2s var(--ease),color .2s var(--ease)}
.pd-back:hover{border-color:var(--border-strong);color:var(--ink)}
.pd-title{margin:7px 0 0;font-size:27px;font-weight:500;letter-spacing:-.9px;line-height:1.15;text-wrap:balance}
.pd-sub{margin:7px 0 0;font-size:14px;line-height:1.6;color:var(--dim);max-width:760px;text-wrap:pretty}
.pd-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.pd-grid{display:grid;gap:14px;margin-bottom:14px;align-items:start}
.pd-grid.stretch{align-items:stretch}
.pd-card{position:relative;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:22px;backdrop-filter:blur(20px) saturate(1.3);-webkit-backdrop-filter:blur(20px) saturate(1.3);box-shadow:var(--card-shadow);padding:18px 20px;animation:riseIn .42s var(--ease) both}
.pd-card.flush{padding:0;overflow:hidden}
.pd-card.strong{background:var(--surface-strong)}
.pd-card.tint{background:linear-gradient(160deg,var(--accent-faint),transparent 60%),var(--surface);border-color:var(--accent-line)}
.pd-card.alert-bad{border-color:color-mix(in srgb,var(--bad) 42%,transparent)}
.pd-card.alert-warn{border-color:color-mix(in srgb,var(--warn) 38%,transparent)}
.pd-click{cursor:pointer;transition:border-color .2s var(--ease),transform .22s var(--ease),background .2s var(--ease)}
.pd-click:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.pd-click:active{transform:translateY(0) scale(.995)}
.pd-ct{display:flex;align-items:center;gap:10px;margin-bottom:12px;min-width:0}
.pd-ct h3{flex:1;min-width:0;margin:0;font-size:13.5px;font-weight:500;letter-spacing:-.1px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-flush .pd-ct,.pd-card.flush .pd-ct{padding:16px 20px 0}
.pd-mono{font-family:'IBM Plex Mono',monospace}
.pd-label{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase}
.pd-meta{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--faint);white-space:nowrap}
.pd-dim{color:var(--dim)}
.pd-faint{color:var(--faint)}
.pd-p{margin:0;font-size:13.5px;line-height:1.65;color:var(--body);text-wrap:pretty}
.pd-p+.pd-p{margin-top:10px}
.pd-p b{color:var(--ink);font-weight:500}
.pd-kpi{padding:15px 17px 16px;border-radius:18px;background:var(--surface);border:1px solid var(--border);backdrop-filter:blur(20px);min-width:0;animation:springIn .5s var(--ease) both}
.pd-kpi .v{font-size:23px;font-weight:500;letter-spacing:-.8px;margin-top:8px;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-kpi .l{font-size:12px;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-kpi .s{font-size:11.5px;margin-top:6px;color:var(--faint);line-height:1.35}
.pd-kpi.hero{background:var(--accent);border-color:var(--accent)}
.pd-kpi.hero .l,.pd-kpi.hero .s{color:var(--on-accent-2)}
.pd-kpi.hero .v{color:var(--on-accent)}
.pd-badge{display:inline-flex;align-items:center;gap:5px;height:20px;padding:0 8px;border-radius:999px;font-size:10.5px;font-weight:500;white-space:nowrap;letter-spacing:.01em;flex:none}
.pd-badge.mono{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.06em}
.pd-btn{height:34px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:0 15px;border-radius:999px;border:1px solid var(--border);background:var(--surface-2);color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:500;cursor:pointer;white-space:nowrap;transition:background .2s var(--ease),border-color .2s var(--ease),transform .18s var(--ease),box-shadow .24s var(--ease),color .2s var(--ease)}
.pd-btn:hover{border-color:var(--border-strong);transform:translateY(-1px)}
.pd-btn:active{transform:translateY(0) scale(.98)}
.pd-btn.pri{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.pd-btn.pri:hover{background:var(--accent-hover);border-color:var(--accent-hover);box-shadow:0 8px 22px var(--accent-soft)}
.pd-btn.ghost{background:none}
.pd-btn.sm{height:28px;padding:0 12px;font-size:11.5px}
.pd-btn.done{background:var(--ok-soft);border-color:transparent;color:var(--ok);cursor:default;transform:none}
.pd-link{color:var(--accent-text);cursor:pointer;text-decoration:none;border-bottom:1px solid transparent;transition:border-color .2s var(--ease),color .2s var(--ease)}
.pd-link:hover{border-bottom-color:currentColor;color:var(--ink)}
.pd-tbl{width:100%;overflow-x:auto}
.pd-tr{display:grid;align-items:center;border-top:1px solid var(--border);transition:background .16s var(--ease)}
.pd-tr.hd{border-top:0}
.pd-tr.hd .pd-td{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.09em;color:var(--faint);text-transform:uppercase;padding-top:11px;padding-bottom:9px}
.pd-td{padding:11px 14px;font-size:12.5px;color:var(--body);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-td:first-child{padding-left:20px}
.pd-td:last-child{padding-right:20px}
.pd-td.r{text-align:right;justify-self:stretch}
.pd-td.num{font-family:'IBM Plex Mono',monospace;font-size:12px}
.pd-td.ink{color:var(--ink)}
.pd-tr.click{cursor:pointer}
.pd-tr.click:hover{background:var(--surface)}
.pd-tr.sel{background:var(--accent-faint);box-shadow:inset 2px 0 0 var(--accent)}
.pd-tr.bad{box-shadow:inset 2px 0 0 var(--bad)}
.pd-tr.warn{box-shadow:inset 2px 0 0 var(--warn)}
.pd-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--border);min-width:0}
.pd-row:first-child{border-top:0}
.pd-row.click{cursor:pointer;border-radius:10px;transition:background .16s var(--ease),padding .2s var(--ease)}
.pd-row.click:hover{background:var(--surface);padding-left:8px;padding-right:8px}
.pd-dot{width:7px;height:7px;border-radius:50%;flex:none}
.pd-bar{position:relative;height:6px;border-radius:999px;overflow:hidden;min-width:40px}
.pd-bar>i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;transform-origin:left center;animation:sweep .7s var(--ease) both}
.pd-sep{height:1px;background:var(--border);margin:14px 0}
.pd-chips{display:flex;flex-wrap:wrap;gap:6px}
.pd-chip{height:28px;display:inline-flex;align-items:center;gap:7px;padding:0 12px;border-radius:999px;border:1px solid var(--border);background:var(--surface);font-size:12px;color:var(--dim);cursor:pointer;white-space:nowrap;font-family:inherit;transition:border-color .2s var(--ease),color .2s var(--ease),background .2s var(--ease)}
.pd-chip:hover{border-color:var(--border-strong);color:var(--ink)}
.pd-chip.on{background:var(--pill-bg);color:var(--pill-ink);border-color:var(--accent-line)}
.pd-chain{display:flex;flex-direction:column}
.pd-node{position:relative;display:flex;gap:14px;min-width:0}
.pd-node .rail{flex:none;width:30px;display:flex;flex-direction:column;align-items:center}
.pd-node .pin{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;border:1px solid var(--border);background:var(--surface-2);color:var(--dim)}
.pd-node .wire{flex:1;width:1.5px;min-height:14px;background:linear-gradient(var(--border-strong),var(--border))}
.pd-node .body{flex:1;min-width:0;padding:4px 0 16px}
.pd-node.click .body{cursor:pointer}
.pd-node.click:hover .t{color:var(--accent-text)}
.pd-node .k{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase}
.pd-node .t{font-size:14px;font-weight:500;margin-top:3px;transition:color .2s var(--ease)}
.pd-node .d{font-size:12.5px;color:var(--dim);margin-top:3px;line-height:1.5}
.pd-hchain{display:flex;align-items:stretch;gap:0;overflow-x:auto;padding-bottom:2px}
.pd-hnode{flex:1 1 0;min-width:128px;padding:12px 13px;border-radius:14px;border:1px solid var(--border);background:var(--surface-2);transition:border-color .3s var(--ease),background .3s var(--ease)}
.pd-hnode .k{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase}
.pd-hnode .t{font-size:12.5px;font-weight:500;margin-top:5px;line-height:1.35}
.pd-hnode .d{font-size:11px;color:var(--dim);margin-top:4px;line-height:1.4}
.pd-hnode.click{cursor:pointer}
.pd-hnode.click:hover{border-color:var(--border-strong)}
.pd-harrow{flex:none;width:22px;display:flex;align-items:center;justify-content:center;color:var(--faint)}
.pd-ai{position:relative;border-radius:20px;padding:16px 18px;background:linear-gradient(150deg,var(--accent-soft),var(--accent-faint) 55%,transparent),var(--surface);border:1px solid var(--accent-line)}
.pd-ai .who{display:flex;align-items:center;gap:8px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;color:var(--accent-text);text-transform:uppercase}
.pd-ai .txt{font-size:13.5px;line-height:1.65;color:var(--ink);margin-top:9px;text-wrap:pretty}
.pd-ai .btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pd-pipe{display:flex;gap:6px;align-items:stretch}
.pd-stage{flex:1 1 0;min-width:0;padding:13px 14px 14px;border-radius:16px;border:1px solid var(--border);background:var(--surface-2);position:relative;overflow:hidden}
.pd-stage.hot{border-color:color-mix(in srgb,var(--warn) 55%,transparent);background:linear-gradient(180deg,var(--warn-soft),transparent 80%),var(--surface-2)}
.pd-stage .n{font-size:24px;font-weight:500;letter-spacing:-.8px;margin-top:6px}
.pd-stage .v{font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--faint);margin-top:2px}
.pd-stage .fill{position:absolute;left:0;right:0;bottom:0;height:3px;transform-origin:left;animation:sweep .8s var(--ease) both}
.pd-cols{display:flex;align-items:flex-end;gap:6px}
.pd-col{flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end}
.pd-col>i{display:block;width:100%;max-width:38px;border-radius:7px 7px 3px 3px;transform-origin:bottom;animation:growBar .6s var(--ease) both}
.pd-col>span{font-family:'IBM Plex Mono',monospace;font-size:9.5px;color:var(--faint);white-space:nowrap}
.pd-hbar{display:grid;align-items:center;gap:12px;padding:7px 0}
.pd-hbar .lb{font-size:12.5px;color:var(--body);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-hbar .vl{font-family:'IBM Plex Mono',monospace;font-size:11.5px;color:var(--ink);text-align:right;white-space:nowrap}
.pd-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11.5px;color:var(--dim)}
.pd-legend span{display:inline-flex;align-items:center;gap:6px}
.pd-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}
.pd-tabs{display:inline-flex;gap:2px;padding:3px;border-radius:999px;background:var(--surface);border:1px solid var(--border)}
.pd-tab{height:28px;padding:0 13px;border:0;border-radius:999px;background:none;color:var(--dim);font-family:inherit;font-size:12px;cursor:pointer;white-space:nowrap;transition:background .2s var(--ease),color .2s var(--ease)}
.pd-tab:hover{color:var(--ink)}
.pd-tab.on{background:var(--pill-bg);color:var(--pill-ink);font-weight:500}
.pd-facts{display:grid;gap:1px;background:var(--border);border-radius:16px;overflow:hidden;border:1px solid var(--border)}
.pd-fact{background:var(--surface-strong);padding:12px 14px;min-width:0}
.pd-fact .k{font-family:'IBM Plex Mono',monospace;font-size:9.5px;letter-spacing:.1em;color:var(--faint);text-transform:uppercase}
.pd-fact .v{font-size:15px;font-weight:500;margin-top:5px;letter-spacing:-.2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pd-fact .s{font-size:11px;color:var(--dim);margin-top:3px}
.pd-feed{display:flex;flex-direction:column}
.pd-ev{display:flex;gap:12px;padding:9px 0;min-width:0}
.pd-ev .tm{flex:none;width:40px;font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--faint);padding-top:2px}
.pd-ev .tx{flex:1;min-width:0;font-size:12.5px;line-height:1.5;color:var(--body)}
.pd-ev .tx b{color:var(--ink);font-weight:500}
.pd-ev .src{flex:none;height:18px;padding:0 6px;border-radius:6px;font-family:'IBM Plex Mono',monospace;font-size:9px;display:flex;align-items:center;background:var(--track);color:var(--dim)}
.pd-toasts{position:fixed;right:26px;bottom:26px;z-index:120;display:flex;flex-direction:column;gap:8px;pointer-events:none}
.pd-toast{min-width:280px;max-width:420px;display:flex;align-items:flex-start;gap:11px;padding:12px 16px;border-radius:16px;background:var(--tooltip);color:var(--tooltip-ink);border:1px solid var(--border);box-shadow:0 18px 40px rgba(0,0,0,.4);font-size:12.5px;line-height:1.5;animation:popIn .3s var(--ease) both}
.pd-toast .dt{width:7px;height:7px;border-radius:50%;margin-top:6px;flex:none}
.pd-empty{padding:26px 20px;text-align:center;font-size:12.5px;color:var(--dim)}
.pd-split{display:flex;gap:10px;align-items:center;min-width:0}
.pd-grow{flex:1;min-width:0}
.pd-nowrap{white-space:nowrap}
.pd-ell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pd-steps{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.pd-step{height:26px;display:inline-flex;align-items:center;padding:0 10px;border-radius:8px;background:var(--surface-2);border:1px solid var(--border);font-size:11.5px;color:var(--body);white-space:nowrap}
.pd-step.gate{border-color:color-mix(in srgb,var(--warn) 50%,transparent);color:var(--warn)}
.pd-step.go{border-color:var(--accent-line);color:var(--accent-text)}
.pd-arrow{color:var(--faint);font-size:12px}
.pd-lane{display:flex;flex-direction:column;gap:8px}
.pd-note{font-size:11.5px;color:var(--faint);line-height:1.5}
.pd-ring{width:9px;height:9px;border-radius:50%;border:2px solid currentColor;flex:none}
.pd-live{display:inline-flex;align-items:center;gap:6px;font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;color:var(--faint)}
.pd-live i{width:6px;height:6px;border-radius:50%;background:var(--ok);animation:tickPulse 1.6s ease-in-out infinite}
@media (max-width:1180px){.pd-grid{grid-template-columns:1fr !important}.pd-grid>*{grid-column:auto !important}}
@media (max-width:760px){.pd-title{font-size:22px}.pd-pipe{flex-wrap:wrap}.pd-stage{flex:1 1 40%}}
@media (prefers-reduced-motion:reduce){.pd *{animation:none !important;transition:none !important}}
`;
  if (!document.getElementById("pd-css")) {
    const s = document.createElement("style");
    s.id = "pd-css";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---------- icons (same drawing grammar as the shell: 24 grid, 1.6 stroke) ---------- */
  const IC = {
    arrow: "M5 12h14 M13 6l6 6-6 6",
    down: "M12 5v14 M6 13l6 6 6-6",
    back: "M19 12H5 M11 6l-6 6 6 6",
    check: "M20 6 9 17l-5-5",
    alert: "M12 3.5 2.8 19.5h18.4L12 3.5Z M12 10v4.2 M12 17.2h.01",
    box: "M12 3 20 7.4v9.2L12 21l-8-4.4V7.4L12 3Z M4 7.4l8 4.4 8-4.4 M12 11.8V21",
    truck: "M2.5 6.5h11v9h-11z M13.5 9.5h4.2l3.3 3.4v2.6h-7.5 M6.5 18.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z M17 18.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z",
    user: "M12 12.5a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2Z M5 20.2c.9-3.1 3.6-4.9 7-4.9s6.1 1.8 7 4.9",
    cart: "M3.5 4.5h2.4l2.2 10.4h9.6l2-7.4H7 M10 19.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z M17 19.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z",
    factory: "M3.5 20V10l5 3V10l5 3V6.5h4l1 6.5H20.5V20Z M7 16.5h2 M11 16.5h2 M15 16.5h2",
    doc: "M6.4 3.6h7.4l4.2 4.2v12.6H6.4V3.6Z M13.4 3.8v4.2h4.2 M9 12.4h6 M9 16h4",
    euro: "M17.5 6.2A7 7 0 1 0 17.5 17.8 M4.5 10.2h9 M4.5 13.8h8",
    tag: "M3.8 12.6V4.4h8.2l8.2 8.2-8.2 8.2-8.2-8.2Z M8.4 8.8h.01",
    spark: "M2 12h4l2.5-6 3.5 12 3-8 2 2h5",
    clock: "M12 7v5l3.4 2 M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9",
    route: "M6 19.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M18 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z M8.5 17h6.5a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5",
    swap: "M4 8h14 M14 4l4 4-4 4 M20 16H6 M10 12l-4 4 4 4",
    shelf: "M4 4v16 M20 4v16 M4 9h16 M4 15h16 M7 6.5h3 M13 12h4 M8 17.5h4",
    pin: "M12 21s6.5-5.6 6.5-11a6.5 6.5 0 1 0-13 0C5.5 15.4 12 21 12 21Z M12 12.8a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z",
    shield: "M12 3.6 19.5 6v6.1c0 4-3.1 6.9-7.5 8.3-4.4-1.4-7.5-4.3-7.5-8.3V6L12 3.6Z",
    link: "M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1 M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1",
    plus: "M12 5v14 M5 12h14",
    mail: "M4 7.2 12 13 20 7.2 M4 7.2v10.6h16V7.2 M4 7.2 8.5 4h7L20 7.2",
    phone: "M5 4.5h3.5l1.6 4.2-2.2 1.4a11 11 0 0 0 6 6l1.4-2.2 4.2 1.6V19a1.5 1.5 0 0 1-1.6 1.5A15.5 15.5 0 0 1 3.5 6.1 1.5 1.5 0 0 1 5 4.5Z",
    bolt: "M13 3 4.5 14H10l-1 7 9-11h-5.5z",
    return: "M9 14 4 9l5-5 M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
  };
  PD.IC = IC;
  const Icon = (d, size, extra) => h("svg", Object.assign({ width: size || 14, height: size || 14, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", style: { flex: "none" } }, extra || {}), h("path", { d: IC[d] || d }));

  /* ---------- UI kit ---------- */
  const cx = (...a) => a.filter(Boolean).join(" ");
  const kids = (c) => (Array.isArray(c) ? c : c === undefined || c === null ? [] : [c]);
  let _k = 0;
  const key = () => "k" + (++_k);

  const UI = {};
  UI.Icon = Icon;

  UI.Page = (p) => h("div", { className: "pd", key: p.pageKey },
    h("div", { className: "pd-head" },
      h("div", { className: "pd-head-main" },
        h("div", { className: "pd-crumbs" },
          p.back ? h("button", { className: "pd-back", onClick: p.back }, Icon("back", 12), p.backLabel || "Back") : null,
          p.kicker ? h("span", null, p.kicker) : null,
          p.live ? h("span", { className: "pd-live" }, h("i"), p.live) : null),
        h("h1", { className: "pd-title" }, p.title),
        p.sub ? h("p", { className: "pd-sub" }, p.sub) : null),
      p.actions ? h("div", { className: "pd-actions" }, ...kids(p.actions)) : null),
    ...kids(p.children));

  UI.Grid = (cols, children, extra) => h("div", { className: cx("pd-grid", extra && extra.stretch && "stretch"), style: Object.assign({ gridTemplateColumns: cols }, extra && extra.style) }, ...kids(children));

  UI.Card = (p, children) => h("section", {
    className: cx("pd-card", p.flush && "flush", p.strong && "strong", p.tint && "tint", p.alert && "alert-" + p.alert, p.onClick && "pd-click"),
    style: Object.assign({ gridColumn: p.span ? "span " + p.span : undefined, animationDelay: p.delay ? p.delay + "ms" : undefined }, p.style),
    onClick: p.onClick
  },
    p.title || p.meta || p.right ? h("div", { className: "pd-ct", style: p.flush ? { padding: "16px 20px 0" } : null },
      p.icon ? h("span", { style: { color: "var(--dim)", display: "flex" } }, Icon(p.icon, 15)) : null,
      h("h3", null, p.title || ""),
      p.meta ? h("span", { className: "pd-meta" }, p.meta) : null,
      ...kids(p.right)) : null,
    ...kids(children));

  UI.Kpi = (k, i) => h("div", {
    key: k.label, className: cx("pd-kpi", k.hero && "hero", k.onClick && "pd-click"), onClick: k.onClick,
    style: { animationDelay: (i || 0) * 60 + "ms", borderColor: k.tone && !k.hero ? "color-mix(in srgb," + TONE[k.tone].fg + " 36%,transparent)" : undefined }
  },
    h("div", { className: "l" }, k.label),
    h("div", { className: "v", style: k.tone && !k.hero ? { color: k.toneValue ? TONE[k.tone].fg : undefined } : null }, k.value),
    k.sub ? h("div", { className: "s", style: k.subTone ? { color: TONE[k.subTone].fg } : null }, k.sub) : null);

  UI.Kpis = (items, cols) => h("div", { className: "pd-grid", style: { gridTemplateColumns: cols || "repeat(" + items.length + ",minmax(0,1fr))" } }, ...items.map(UI.Kpi));

  UI.Badge = (text, tone, mono) => {
    const t = TONE[tone || "neutral"] || TONE.neutral;
    return h("span", { className: cx("pd-badge", mono && "mono"), style: { background: t.bg, color: t.fg } }, text);
  };
  UI.Risk = (r) => UI.Badge(String(r).toUpperCase(), riskTone(r), true);
  UI.Dot = (tone) => h("span", { className: "pd-dot", style: { background: (TONE[tone] || TONE.neutral).fg } });

  UI.Btn = (label, onClick, opt) => {
    opt = opt || {};
    return h("button", {
      className: cx("pd-btn", opt.pri && "pri", opt.ghost && "ghost", opt.sm && "sm", opt.done && "done"),
      onClick: (e) => { e.stopPropagation(); if (!opt.done && onClick) onClick(e); },
      title: opt.title
    }, opt.icon ? Icon(opt.done ? "check" : opt.icon, 13) : (opt.done ? Icon("check", 13) : null), opt.done && opt.doneLabel ? opt.doneLabel : label);
  };

  UI.Link = (label, onClick) => h("span", { className: "pd-link", onClick: (e) => { e.stopPropagation(); onClick && onClick(); } }, label);

  UI.Bar = (pct, tone, opt) => h("div", { className: "pd-bar", style: { background: "var(--track)", height: (opt && opt.h) || 6, width: (opt && opt.w) || "100%" } },
    h("i", { style: { width: Math.max(0, Math.min(100, pct)) + "%", background: tone ? (TONE[tone] || TONE.info).fg : "var(--accent)" } }));

  /* Table: cols [{label, w, r (right), num, ink, render(row), key}] */
  /* Every row is its own grid, so tracks must not size to content: bare "fr" becomes
     minmax(0, fr) and the fixed minimums add up to the table's scroll width. */
  const track = (w) => {
    w = String(w || "1fr").trim();
    return /^[\d.]+fr$/.test(w) ? "minmax(0," + w + ")" : w;
  };
  const minOf = (w) => {
    w = String(w || "");
    const m = w.match(/^([\d.]+)px$/) || w.match(/^minmax\(\s*([\d.]+)px/);
    return m ? parseFloat(m[1]) : 0;
  };
  UI.Table = (p) => {
    const tpl = p.cols.map((c) => track(c.w)).join(" ");
    const minW = p.cols.reduce((a, c) => a + minOf(c.w), 0) + 12;
    const rows = p.max ? p.rows.slice(0, p.max) : p.rows;
    return h("div", { className: "pd-tbl" },
      h("div", { className: "pd-tr hd", style: { gridTemplateColumns: tpl, minWidth: minW } },
        ...p.cols.map((c, i) => h("div", { key: i, className: cx("pd-td", c.r && "r") }, c.label))),
      ...rows.map((row, ri) => h("div", {
        key: (p.rowKey ? p.rowKey(row) : ri),
        className: cx("pd-tr", p.onRow && "click", p.sel && p.sel(row) && "sel", p.rowTone && p.rowTone(row)),
        style: { gridTemplateColumns: tpl, minWidth: minW, animation: "rowIn .3s var(--ease) " + Math.min(ri * 22, 400) + "ms both" },
        onClick: p.onRow ? () => p.onRow(row) : undefined
      }, ...p.cols.map((c, ci) => h("div", { key: ci, className: cx("pd-td", c.r && "r", c.num && "num", c.ink && "ink") },
        c.render ? c.render(row) : row[c.key])))),
      rows.length === 0 ? h("div", { className: "pd-empty" }, p.empty || "Nothing here.") : null,
      p.foot ? h("div", { className: "pd-tr", style: { gridTemplateColumns: "minmax(0,1fr)", minWidth: minW } }, h("div", { className: "pd-td pd-faint", style: { fontSize: 11.5 } }, p.foot)) : null);
  };

  /* Vertical chain: nodes [{k, t, d, tone, icon, onClick, badge}] */
  UI.Chain = (nodes) => h("div", { className: "pd-chain" }, ...nodes.map((n, i) => {
    const t = TONE[n.tone] || null;
    return h("div", { key: i, className: cx("pd-node", n.onClick && "click"), onClick: n.onClick, style: { animation: "rowIn .36s var(--ease) " + i * 70 + "ms both" } },
      h("div", { className: "rail" },
        h("div", { className: "pin", style: t ? { color: t.fg, borderColor: "color-mix(in srgb," + t.fg + " 50%,transparent)", background: t.bg } : null }, Icon(n.icon || "arrow", 14)),
        i < nodes.length - 1 ? h("div", { className: "wire" }) : null),
      h("div", { className: "body" },
        h("div", { className: "pd-split" }, h("div", { className: "k" }, n.k), n.badge ? n.badge : null),
        h("div", { className: "t" }, n.t),
        n.d ? h("div", { className: "d" }, n.d) : null));
  }));

  /* Horizontal chain: nodes [{k, t, d, tone, onClick, on}] */
  UI.HChain = (nodes, opt) => h("div", { className: "pd-hchain" }, ...nodes.flatMap((n, i) => {
    const t = TONE[n.tone] || null;
    const el = h("div", {
      key: "n" + i, className: cx("pd-hnode", n.onClick && "click"), onClick: n.onClick,
      style: Object.assign({ animation: "rowIn .36s var(--ease) " + i * ((opt && opt.stagger) || 60) + "ms both" },
        t ? { borderColor: "color-mix(in srgb," + t.fg + " 45%,transparent)", background: "linear-gradient(180deg," + t.bg + ",transparent 90%),var(--surface-2)" } : null)
    }, h("div", { className: "k", style: t ? { color: t.fg } : null }, n.k), h("div", { className: "t" }, n.t), n.d ? h("div", { className: "d" }, n.d) : null);
    return i < nodes.length - 1 ? [el, h("div", { key: "a" + i, className: "pd-harrow" }, Icon("arrow", 13))] : [el];
  }));

  /* AI recommendation card */
  UI.AI = (p) => h("div", { className: "pd-ai", style: p.style },
    h("div", { className: "who" }, Icon("spark", 13), p.who || "Pulse recommends", p.conf ? h("span", { style: { marginLeft: "auto", color: "var(--faint)", letterSpacing: ".06em" } }, p.conf) : null),
    h("div", { className: "txt" }, p.text),
    p.note ? h("div", { className: "pd-note", style: { marginTop: 8 } }, p.note) : null,
    p.actions ? h("div", { className: "btns" }, ...kids(p.actions)) : null);

  /* Order pipeline: stages [{label, n, v, hot, tone, pct}] */
  UI.Pipeline = (stages) => h("div", { className: "pd-pipe" }, ...stages.map((s, i) => h("div", { key: i, className: cx("pd-stage", s.hot && "hot", s.onClick && "pd-click"), onClick: s.onClick, style: { animation: "springIn .5s var(--ease) " + i * 60 + "ms both" } },
    h("div", { className: "pd-split" }, h("span", { className: "pd-label", style: s.hot ? { color: "var(--warn)" } : null }, s.label), s.hot ? h("span", { style: { marginLeft: "auto" } }, UI.Badge("BOTTLENECK", "warn", true)) : null),
    h("div", { className: "n" }, s.n),
    h("div", { className: "v" }, s.v),
    s.note ? h("div", { className: "pd-note", style: { marginTop: 6 } }, s.note) : null,
    h("i", { className: "fill", style: { background: s.hot ? "var(--warn)" : "var(--accent)", width: (s.pct || 100) + "%", opacity: s.hot ? 1 : .55 } }))));

  /* Column chart: data [{l, v, d, tone, hi}] */
  UI.Columns = (data, opt) => {
    opt = opt || {};
    const max = opt.max || Math.max.apply(null, data.map((d) => d.v)) || 1;
    const H = opt.h || 150;
    return h("div", { style: { position: "relative" } },
      opt.target !== undefined ? h("div", { style: { position: "absolute", left: 0, right: 0, bottom: 22 + (H - 22) * opt.target / max, borderTop: "1px dashed var(--warn)", opacity: .8 } },
        h("span", { className: "pd-meta", style: { position: "absolute", right: 0, top: -16, color: "var(--warn)" } }, opt.targetLabel || "Target")) : null,
      h("div", { className: "pd-cols", style: { height: H } }, ...data.map((d, i) => h("div", { key: i, className: "pd-col", title: d.l + " · " + (d.d || d.v) },
        opt.showValues ? h("span", { style: { color: d.hi ? "var(--ink)" : "var(--faint)" } }, d.d || d.v) : null,
        h("i", { style: { height: Math.max(3, (H - (opt.showValues ? 40 : 22)) * d.v / max), background: d.tone ? TONE[d.tone].fg : d.hi ? "var(--accent)" : "var(--track)", animationDelay: i * 35 + "ms", opacity: d.tone && !d.hi ? .75 : 1 } }),
        h("span", null, d.l)))));
  };

  /* Stacked columns: data [{l, parts:[v...]}], colors [...] */
  UI.Stacked = (data, colors, opt) => {
    opt = opt || {};
    const H = opt.h || 150;
    const max = Math.max.apply(null, data.map((d) => d.parts.reduce((a, b) => a + b, 0)));
    return h("div", { className: "pd-cols", style: { height: H } }, ...data.map((d, i) => h("div", { key: i, className: "pd-col" },
      h("div", { style: { width: "100%", maxWidth: 38, display: "flex", flexDirection: "column-reverse", borderRadius: "7px 7px 3px 3px", overflow: "hidden", height: Math.max(3, (H - 22) * d.parts.reduce((a, b) => a + b, 0) / max), transformOrigin: "bottom", animation: "growBar .6s var(--ease) " + i * 35 + "ms both" } },
        ...d.parts.map((v, j) => h("div", { key: j, style: { flex: v + " 0 0", background: colors[j] } }))),
      h("span", null, d.l))));
  };

  /* Horizontal bars: items [{label, v, d, tone, sub, onClick}] */
  UI.HBars = (items, opt) => {
    opt = opt || {};
    const max = opt.max || Math.max.apply(null, items.map((i) => i.v)) || 1;
    const tpl = opt.tpl || "minmax(120px,1.1fr) 2fr 84px";
    return h("div", null, ...items.map((it, i) => h("div", { key: i, className: cx("pd-hbar", it.onClick && "pd-click"), onClick: it.onClick, style: { gridTemplateColumns: tpl, borderRadius: 8 } },
      h("div", { className: "lb", title: it.label }, it.label, it.sub ? h("span", { className: "pd-faint", style: { marginLeft: 6, fontSize: 11 } }, it.sub) : null),
      UI.Bar(100 * it.v / max, it.tone || (i === 0 && !opt.flat ? "info" : null), { h: opt.barH || 7 }),
      h("div", { className: "vl", style: it.tone && opt.colorValue ? { color: TONE[it.tone].fg } : null }, it.d || it.v))));
  };

  /* Segmented horizontal bar with legend: parts [{label, v, color, d}] */
  UI.Split = (parts, opt) => {
    const total = parts.reduce((a, p) => a + p.v, 0) || 1;
    return h("div", null,
      h("div", { style: { display: "flex", height: (opt && opt.h) || 12, borderRadius: 999, overflow: "hidden", gap: 2, background: "var(--track)" } },
        ...parts.map((p, i) => h("div", { key: i, title: p.label + " · " + (p.d || p.v), style: { flex: p.v + " 0 0", background: p.color, transformOrigin: "left", animation: "sweep .7s var(--ease) " + i * 60 + "ms both" } }))),
      h("div", { className: "pd-legend", style: { marginTop: 12 } }, ...parts.map((p, i) => h("span", { key: i }, h("i", { style: { background: p.color } }), p.label, h("b", { style: { color: "var(--ink)", fontWeight: 500 } }, p.d || Math.round(100 * p.v / total) + "%")))));
  };

  /* Line chart: labels [..], series [{name, values, color, dash, area}], opt {h, min, max, band:{from,to,label}, marks:[{i, label, tone}]} */
  UI.Lines = (labels, series, opt) => {
    opt = opt || {};
    const W = 640, H = opt.h || 180, padL = 4, padR = 4, padT = 14, padB = 4;
    const all = series.flatMap((s) => s.values.filter((v) => v !== null));
    const min = opt.min !== undefined ? opt.min : Math.min.apply(null, all);
    const max = opt.max !== undefined ? opt.max : Math.max.apply(null, all);
    const x = (i) => padL + i * (W - padL - padR) / Math.max(1, labels.length - 1);
    const y = (v) => padT + (H - padT - padB) * (1 - (v - min) / ((max - min) || 1));
    const path = (vals) => vals.map((v, i) => v === null ? null : (i === 0 || vals[i - 1] === null ? "M" : "L") + x(i).toFixed(1) + "," + y(v).toFixed(1)).filter(Boolean).join(" ");
    return h("div", { style: { position: "relative" } },
      h("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", style: { width: "100%", height: H, display: "block", overflow: "visible" } },
        [0, 1, 2, 3].map((g) => h("line", { key: "g" + g, x1: 0, x2: W, y1: padT + g * (H - padT - padB) / 3, y2: padT + g * (H - padT - padB) / 3, stroke: "var(--border)", strokeWidth: 1, vectorEffect: "non-scaling-stroke" })),
        opt.band ? h("rect", { x: 0, width: W, y: y(opt.band.to), height: Math.max(0, y(opt.band.from) - y(opt.band.to)), fill: opt.band.fill || "var(--bad-soft)" }) : null,
        opt.hline !== undefined ? h("line", { x1: 0, x2: W, y1: y(opt.hline), y2: y(opt.hline), stroke: opt.hlineColor || "var(--warn)", strokeDasharray: "5 5", strokeWidth: 1.2, vectorEffect: "non-scaling-stroke" }) : null,
        ...series.map((s, si) => h(F, { key: "s" + si },
          s.area ? h("path", { d: path(s.values) + " L" + x(s.values.length - 1) + "," + (H - padB) + " L" + x(0) + "," + (H - padB) + " Z", fill: s.color, opacity: .12 }) : null,
          h("path", { d: path(s.values), fill: "none", stroke: s.color, strokeWidth: s.w || 2, strokeDasharray: s.dash ? "6 5" : undefined, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round", strokeLinecap: "round", style: { strokeDashoffset: 0 } }))),
        ...(opt.marks || []).map((m, mi) => h("line", { key: "m" + mi, x1: x(m.i), x2: x(m.i), y1: padT - 6, y2: H - padB, stroke: (TONE[m.tone] || TONE.bad).fg, strokeWidth: 1.2, strokeDasharray: "3 4", vectorEffect: "non-scaling-stroke" }))),
      ...(opt.marks || []).map((m, mi) => h("span", { key: "ml" + mi, className: "pd-meta", style: { position: "absolute", top: -8, left: "calc(" + (100 * x(m.i) / W) + "% + 6px)", color: (TONE[m.tone] || TONE.bad).fg, background: "var(--bg)", padding: "0 4px", borderRadius: 4 } }, m.label)),
      h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 8 } }, ...labels.map((l, i) => h("span", { key: i, className: "pd-meta", style: { fontSize: 9.5, visibility: opt.every && i % opt.every !== 0 && i !== labels.length - 1 ? "hidden" : "visible" } }, l))),
      opt.legend !== false && series.length > 1 ? h("div", { className: "pd-legend", style: { marginTop: 10 } }, ...series.map((s, i) => h("span", { key: i }, h("i", { style: { background: s.color, height: 3, borderRadius: 2 } }), s.name))) : null);
  };

  UI.Spark = (vals, tone, w, hh) => {
    const W = w || 80, H = hh || 24, max = Math.max.apply(null, vals), min = Math.min.apply(null, vals);
    const pts = vals.map((v, i) => (i * W / (vals.length - 1)).toFixed(1) + "," + (H - 2 - (H - 4) * (v - min) / ((max - min) || 1)).toFixed(1)).join(" ");
    return h("svg", { width: W, height: H, viewBox: "0 0 " + W + " " + H, style: { display: "block", flex: "none" } },
      h("polyline", { points: pts, fill: "none", stroke: (TONE[tone] || TONE.info).fg, strokeWidth: 1.6, strokeLinejoin: "round", strokeLinecap: "round" }));
  };

  UI.Facts = (items, cols) => h("div", { className: "pd-facts", style: { gridTemplateColumns: "repeat(" + (cols || items.length) + ",minmax(0,1fr))" } },
    ...items.map((f, i) => h("div", { key: i, className: "pd-fact" },
      h("div", { className: "k" }, f[0]),
      h("div", { className: "v", style: f[2] ? { color: TONE[f[2]].fg } : null }, f[1]),
      f[3] ? h("div", { className: "s" }, f[3]) : null)));

  UI.Tabs = (options, value, onPick) => h("div", { className: "pd-tabs" }, ...options.map((o) => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o;
    return h("button", { key: v, className: cx("pd-tab", value === v && "on"), onClick: () => onPick(v) }, l);
  }));

  UI.Chips = (options, value, onPick) => h("div", { className: "pd-chips" }, ...options.map((o) => {
    const v = Array.isArray(o) ? o[0] : o, l = Array.isArray(o) ? o[1] : o, c = Array.isArray(o) ? o[2] : null;
    return h("button", { key: v, className: cx("pd-chip", value === v && "on"), onClick: () => onPick(v) }, l, c !== null && c !== undefined ? h("span", { className: "pd-mono", style: { fontSize: 10, opacity: .7 } }, c) : null);
  }));

  /* Feed: items [{t, text (node), src, tone, onClick}] */
  UI.Feed = (items) => h("div", { className: "pd-feed" }, ...items.map((e, i) => h("div", { key: i, className: cx("pd-ev", e.onClick && "pd-click"), onClick: e.onClick, style: { borderTop: i ? "1px solid var(--border)" : 0, animation: "rowIn .3s var(--ease) " + Math.min(i * 30, 360) + "ms both" } },
    h("span", { className: "tm" }, e.t),
    e.tone ? h("span", { className: "pd-dot", style: { marginTop: 6, background: (TONE[e.tone] || TONE.neutral).fg } }) : null,
    h("div", { className: "tx" }, e.text),
    e.src ? h("span", { className: "src" }, e.src) : null)));

  /* Flow of steps: [{l, kind:'gate'|'go'}] */
  UI.Steps = (steps) => h("div", { className: "pd-steps" }, ...steps.flatMap((s, i) => {
    const el = h("span", { key: "s" + i, className: cx("pd-step", s.kind) }, s.l);
    return i < steps.length - 1 ? [el, h("span", { key: "a" + i, className: "pd-arrow" }, "→")] : [el];
  }));

  UI.Row = (p, children) => h("div", { className: cx("pd-row", p.onClick && "click"), onClick: p.onClick, style: p.style }, ...kids(children));
  UI.P = (children, style) => h("p", { className: "pd-p", style }, ...kids(children));
  UI.B = (t) => h("b", null, t);
  UI.Label = (t, style) => h("div", { className: "pd-label", style }, t);
  UI.Note = (t, style) => h("div", { className: "pd-note", style }, t);
  UI.Sep = () => h("div", { className: "pd-sep" });
  UI.Empty = (t) => h("div", { className: "pd-empty" }, t);
  UI.Split2 = (l, r, style) => h("div", { className: "pd-split", style }, h("div", { className: "pd-grow" }, l), r);
  UI.Mono = (t, style) => h("span", { className: "pd-mono", style: Object.assign({ fontSize: 11.5 }, style) }, t);
  UI.Avatar = (initials, tone, size) => h("span", { style: { width: size || 24, height: size || 24, borderRadius: "50%", flex: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 600, background: tone === "accent" ? "var(--accent)" : "var(--track)", color: tone === "accent" ? "var(--on-accent)" : "var(--body)" } }, initials);
  PD.UI = UI;

  /* Record links: every id on screen opens its record. Lookups are lazy, so this
     works before the database file has loaded. */
  PD.lk = (ctx) => {
    const DB = PD.DB;
    const L = (label, type, id) => UI.Link(label, () => ctx.open(type, id));
    return {
      order: (id, label) => L(label || id, "order", id),
      cust: (id, label) => DB.customer(id) ? L(label || DB.custName(id), "customer", id) : h("span", null, label || DB.custName(id)),
      po: (id, label) => L(label || id, "po", id),
      sku: (sku, label) => DB.product(sku) ? L(label || sku, "product", sku) : h("span", null, label || sku),
      sup: (id, label) => L(label || (DB.supplier(id) || {}).name || id, "supplier", id),
      route: (id, label) => id ? L(label || id, "route", id) : h("span", { className: "pd-faint" }, "None"),
      quote: (id, label) => L(label || id, "quote", id),
      person: (k) => h("span", null, DB.person(k))
    };
  };
  PD.cx = cx;
  PD.kids = kids;
  PD.key = key;

  /* ---------- modules: the sidebar and each module's pages ---------- */
  PD.MODULES = [
    { id: "Home", icon: "M12 3.2 3.6 9.1v10a1.5 1.5 0 0 0 1.5 1.5h13.8a1.5 1.5 0 0 0 1.5-1.5v-10L12 3.2Z M8.9 13.1h2l1-2.6 1.5 5 1.1-2.4h1.6", subs: ["Home", "Command Centre", "Executive Dashboard"] },
    { id: "Orders", icon: "M7.5 4.5h9A1.5 1.5 0 0 1 18 6v14.5l-2.2-1.4-2 1.4-1.8-1.4-1.8 1.4-2-1.4L6 20.5V6a1.5 1.5 0 0 1 1.5-1.5Z M9 9h6 M9 12.5h6 M9 16h3.5", subs: ["Overview", "Live Orders", "At Risk", "Backorders", "Allocation", "Order Detail"] },
    { id: "Inventory", icon: "M12 3 20 7.4v9.2L12 21l-8-4.4V7.4L12 3Z M4 7.4l8 4.4 8-4.4 M12 11.8V21 M8 5.2l8 4.4", subs: ["Overview", "Stock", "Availability", "Replenishment", "Slow & Dead Stock", "Forecast", "Transfers"] },
    { id: "Purchasing", icon: "M3.5 4.5h2.4l2.2 10.4h9.6l2-7.4H7 M10 19.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z M17 19.6a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z", subs: ["Overview", "Recommendations", "Purchase Orders", "Incoming", "Suppliers", "Supplier Performance"] },
    { id: "Warehouse", icon: "M3.5 20V9.2L12 4l8.5 5.2V20 M7 20v-7.5h10V20 M7 15.5h10 M3.5 20h17", subs: ["Control Board", "Picking", "Packing", "Goods In", "Dispatch", "Exceptions"] },
    { id: "Delivery", icon: "M2.5 6.5h11v9h-11z M13.5 9.5h4.2l3.3 3.4v2.6h-7.5 M6.5 18.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z M17 18.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z", subs: ["Today", "Routes", "Vehicles", "OTIF", "Delivery Issues", "Proof of Delivery"] },
    { id: "Customers", icon: "M9 12a3.2 3.2 0 1 0 0-6.4A3.2 3.2 0 0 0 9 12Z M16.5 12.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2Z M2.6 19.6c.8-2.8 3.2-4.4 6.4-4.4s5.6 1.6 6.4 4.4 M17 15.4c2.2.4 3.7 1.8 4.3 4.2", subs: ["Overview", "Accounts", "Opportunities", "Customer Health", "Quotes", "Customer Detail"] },
    { id: "Pricing & Margin", icon: "M3.8 12.6V4.4h8.2l8.2 8.2-8.2 8.2-8.2-8.2Z M8.4 8.8h.01 M10.5 15.5l5-5", subs: ["Margin Control", "Price Lists", "Exceptions", "Cost Changes", "Discount Approvals", "Product Profitability"] },
    { id: "Finance", icon: "M17.5 6.2A7 7 0 1 0 17.5 17.8 M4.5 10.2h9 M4.5 13.8h8", subs: ["Overview", "Revenue", "Debtors", "Credit Control", "Cash", "Working Capital"] },
    { divider: true },
    { id: "Work", icon: "M9.4 4.4h5.2a1.4 1.4 0 0 1 1.4 1.4v1.1h2.4A1.6 1.6 0 0 1 20 8.5v9.1a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 17.6V8.5a1.6 1.6 0 0 1 1.6-1.6H8V5.8a1.4 1.4 0 0 1 1.4-1.4Z M8 6.9h8 M9.6 13.3l1.8 1.8 3.4-3.6", subs: ["Tasks", "Approvals", "Workflows", "Schedules"], native: true },
    { id: "Agents", icon: "M12 2.4v2.3 M12 2.4a.9.9 0 1 0 0-.02 M8.2 6.5h7.6A2.2 2.2 0 0 1 18 8.7v5.1a2.2 2.2 0 0 1-2.2 2.2H8.2A2.2 2.2 0 0 1 6 13.8V8.7a2.2 2.2 0 0 1 2.2-2.2Z M9.9 10.6v1.4 M14.1 10.6v1.4 M6 10h-1.9 M18 10h1.9 M9.2 18.6h5.6 M9.2 21.2h5.6", subs: ["Agents", "Agent Activity", "Chat"], native: true },
    { id: "Activity", icon: "M2.5 12.5h3.6l2.1-6.4 3.2 12.2 2.6-8.4 1.8 2.6h5.7", subs: ["Everything", "People", "Agents", "Systems", "Needs Attention"], native: true },
    { id: "Settings", icon: "M5.5 20v-5.5 M5.5 9.5V4 M12 20v-7.5 M12 7.5V4 M18.5 20v-4 M18.5 11V4 M3 12.5h5 M9.5 5.5h5 M16 14h5", subs: ["Organisation", "Teams", "Systems", "Integrations", "Governance", "AI Controls", "Experience"], native: true, bottom: true }
  ];
  PD.module = (id) => PD.MODULES.find((m) => m.id === id);

  /* Record types open inside the module that owns them. */
  PD.REC_HOME = {
    order: ["Orders", "Order Detail"],
    customer: ["Customers", "Customer Detail"],
    product: ["Inventory", "Stock"],
    po: ["Purchasing", "Purchase Orders"],
    supplier: ["Purchasing", "Suppliers"],
    route: ["Delivery", "Routes"],
    vehicle: ["Delivery", "Vehicles"],
    quote: ["Customers", "Quotes"],
    invoice: ["Finance", "Debtors"]
  };

  /* ---------- root: page, record overlay, toasts ---------- */
  PD.render = function (ctx) {
    let body;
    try {
      if (ctx.rec && PD.records[ctx.rec.type]) body = PD.records[ctx.rec.type](ctx, ctx.rec.id);
      else {
        const pg = (PD.pages[ctx.module] || {})[ctx.sub];
        body = pg ? pg(ctx) : UI.Page({ kicker: ctx.module, title: ctx.sub, sub: "This page is being prepared." });
      }
    } catch (err) {
      console.error(err);
      body = UI.Page({ kicker: "Error", title: "This page failed to render", sub: String(err && err.message || err) });
    }
    const toasts = (ctx.st.toasts || []).slice(-3);
    return h(F, null,
      h("div", { key: ctx.module + "/" + ctx.sub + "/" + (ctx.rec ? ctx.rec.type + ctx.rec.id : ""), style: { animation: "fadeUp .32s var(--ease) both" } }, body),
      h("div", { className: "pd-toasts" }, ...toasts.map((t) => h("div", { key: t.id, className: "pd-toast" },
        h("span", { className: "dt", style: { background: (TONE[t.tone] || TONE.ok).fg } }),
        h("div", null, t.title ? h("div", { style: { fontWeight: 500 } }, t.title) : null, h("div", { style: { opacity: .8 } }, t.text))))));
  };
})();
