#!/usr/bin/env python3
"""Local server for the Pulse client demo.

Serves the mockup at a clean address (http://pulse.localhost:8080) instead of the raw file
name, and only the files the page needs: no folder listing, nothing else in this directory
is reachable. Listens on this machine only, never on the network you are connected to.

    python3 serve.py          # port 8080
    python3 serve.py 8090     # another port
"""
import http.server
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
URL = "http://pulse.localhost:%d" % PORT

TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2",
}
FILES = {
    "/": "Pulse v4 Glass.dc.html",
    "/support.js": "support.js",
    "/AgentFace.dc.html": "AgentFace.dc.html",  # fetched by the page for the agent avatars
    "/favicon.svg": "favicon.svg",
}
for folder, _, names in os.walk(os.path.join(HERE, "vendor")):  # offline React + fonts
    for name in names:
        if os.path.splitext(name)[1] in TYPES:
            rel = os.path.relpath(os.path.join(folder, name), HERE)
            FILES["/" + rel.replace(os.sep, "/")] = rel


class DemoHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        name = FILES.get(self.path.split("?", 1)[0])
        if name is None:
            self.send_error(404)
            return
        with open(os.path.join(HERE, name), "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", TYPES[os.path.splitext(name)[1]])
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")  # edits show up on a plain refresh
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass  # keep the terminal quiet during a demo


if __name__ == "__main__":
    try:
        server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), DemoHandler)
    except OSError:
        sys.exit("Port %d is already in use. If the demo is already running, open %s" % (PORT, URL))
    print("Pulse demo running at %s  (Ctrl+C to stop)" % URL, flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
