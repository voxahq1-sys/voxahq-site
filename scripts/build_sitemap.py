#!/usr/bin/env python3
# Regenerate sitemap.xml from the HTML files in the repository.
# Runs on every push to main via .github/workflows/sitemap.yml.
import os
import re
import subprocess
from datetime import date

BASE = "https://voxahq.in"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_FILES = {"404.html", "home-preview-single-file.html"}
SKIP_DIRS = {".git", ".github", "node_modules", "images", "css", "js", "scripts"}

LEGAL = {"privacy-policy.html", "terms.html", "disclaimer.html", "cookie-policy.html"}
INFO = {"about.html", "contact.html", "how-we-test.html", "editorial-policy.html", "start.html"}
HUBS = {"index.html", "guides.html", "notes.html", "news/index.html"}


def last_commit_date(path):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cs", "--", path],
            cwd=ROOT, capture_output=True, text=True, timeout=20,
        ).stdout.strip()
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", out or ""):
            return out
    except Exception:
        pass
    return date.today().isoformat()


def url_for(path):
    p = path.replace(os.sep, "/")
    if p == "index.html":
        return BASE + "/"
    if p.endswith("/index.html"):
        return BASE + "/" + p[: -len("index.html")]
    if p.endswith(".html"):
        p = p[: -len(".html")]
    return BASE + "/" + p


def meta(path):
    p = path.replace(os.sep, "/")
    if p in LEGAL:
        return "yearly", "0.3"
    if p in INFO:
        return "monthly", "0.5"
    if p == "index.html":
        return "daily", "1.0"
    if p in HUBS:
        return "daily", "0.9"
    if p.startswith("news/"):
        return "weekly", "0.8"
    return "weekly", "0.7"


def main():
    rows = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for name in filenames:
            if not name.endswith(".html") or name in SKIP_FILES:
                continue
            rel = os.path.relpath(os.path.join(dirpath, name), ROOT)
            freq, pri = meta(rel)
            rows.append((pri, url_for(rel), rel, freq))

    rows.sort(key=lambda r: (-float(r[0]), r[1]))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for pri, url, rel, freq in rows:
        lines += [
            "  <url>",
            "    <loc>" + url + "</loc>",
            "    <lastmod>" + last_commit_date(rel) + "</lastmod>",
            "    <changefreq>" + freq + "</changefreq>",
            "    <priority>" + pri + "</priority>",
            "  </url>",
        ]
    lines.append("</urlset>")

    out = "\n".join(lines) + "\n"
    target = os.path.join(ROOT, "sitemap.xml")
    old = ""
    if os.path.exists(target):
        with open(target, "r", encoding="utf-8") as fh:
            old = fh.read()
    if old != out:
        with open(target, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(out)
        print("sitemap.xml updated with " + str(len(rows)) + " urls")
    else:
        print("sitemap.xml already current (" + str(len(rows)) + " urls)")


if __name__ == "__main__":
    main()
