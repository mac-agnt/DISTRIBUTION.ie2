# Pulse demo script

## Start and stop

1. Double-click **Start Demo.command**. Chrome opens at **http://pulse.localhost:8080**.
2. Close that Terminal window when you're done. That stops the demo.

The first time, macOS may ask whether Terminal can access your Downloads folder: click **Allow**.
No internet needed; React and the fonts are bundled in `vendor/`.

## Questions Helios answers

Type these on Home, or click the matching suggestion. The wording can change; Helios listens for the key words.

| Ask | Helios shows | Key words it listens for |
|---|---|---|
| Which organisations are over their credit limit? | Three accounts over limit; Dunne & Sons is 74 days | credit, limit, owe, outstanding, Dunne |
| What is overdue in my work? | Eleven late tasks; seven of them at Ballincollig | tasks, late, overdue, behind, my work |
| What site visits are booked this week? | Four visits, one with no installer (a module's tool) | visit, visits, installer |
| Why did the Xero sync fail? | Expired token; 148 invoices queued, nothing lost | Xero, sync, failed, integration, broken |
| Draft a chase email for Dunne & Sons | A write tool: drafts it and waits for your yes | chase, email, draft, send |

Anything else gets: "Everything I reach goes through a registered tool with a declared permission, and none of them covers that question yet." It then offers buttons for the questions above, so click one and carry on.

## Watch out for

- **Chase email:** stop at the **NEEDS YOUR YES** card, which is the point to make. Clicking **Confirm and send** or **Edit draft** makes Helios draft the same email again.
- **Stay in dark mode.** Light mode still shows some lime on the Dashboard charts.
- **Old link:** `localhost:8080/Pulse%20v4%20Glass.dc.html` no longer works. Use http://pulse.localhost:8080.
