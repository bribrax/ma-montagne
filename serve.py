"""Petit serveur local pour tester Ma Montagne :  python serve.py  puis http://localhost:8322

(Sous Windows, `python -m http.server` sert parfois les .js en text/plain,
ce que les navigateurs refusent pour les modules. Ce script fixe les bons types.)
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8322
os.chdir(os.path.dirname(os.path.abspath(__file__)))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".webmanifest": "application/manifest+json",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
        print(f"Ma Montagne : http://localhost:{PORT}")
        httpd.serve_forever()
