#!/usr/bin/env python3
"""Regenerate data/stars.json and data/tle-snapshot.json from upstream sources.

Committed copies ship in the repo; this refreshes them (used by the optional
Actions workflow on every deploy, or manually:  python3 tools/build_data.py)
"""
import csv, io, json, sys, pathlib, urllib.request, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv"
TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP={group}&FORMAT=tle"


def fetch(url, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "skylens-build/0.1"})
    return urllib.request.urlopen(req, timeout=timeout).read()


def build_stars():
    raw = fetch(HYG_URL).decode("utf-8", "replace")
    out = []
    for row in csv.DictReader(io.StringIO(raw)):
        try:
            mag = float(row["mag"])
        except (TypeError, ValueError):
            continue
        if mag > 4.6:
            continue
        ra, dec = float(row["ra"]), float(row["dec"])
        name = (row.get("proper") or "").strip() or (row.get("bf") or "").strip()
        entry = [round(ra, 5), round(dec, 5), round(mag, 2)]
        if name:
            entry.append(name)
        out.append(entry)
    out.sort(key=lambda s: s[2])
    if len(out) < 900:
        sys.exit(f"FAIL: only {len(out)} stars parsed")
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/stars.json").write_text(json.dumps(
        {"epoch": "J2000", "source": "HYG Database v4.1 (github.com/astronexus/HYG-Database)", "stars": out},
        separators=(",", ":")))
    print(f"stars.json: {len(out)} stars")


def build_tle():
    sats = []
    for group in ("stations", "visual"):
        txt = fetch(TLE_URL.format(group=group), 60).decode("utf-8", "replace")
        lines = [l.rstrip("\r\n") for l in txt.splitlines() if l.strip()]
        for i in range(0, len(lines) - 2, 3):
            n, l1, l2 = lines[i], lines[i + 1], lines[i + 2]
            if l1.startswith("1 ") and l2.startswith("2 "):
                sats.append({"name": n.strip(), "l1": l1.rstrip(), "l2": l2.rstrip()})
    seen, uniq = set(), []
    for s in sats:
        k = s["l1"][2:7]
        if k not in seen:
            seen.add(k)
            uniq.append(s)
    if len(uniq) < 100:
        sys.exit(f"FAIL: only {len(uniq)} satellites parsed")
    (ROOT / "data").mkdir(exist_ok=True)
    (ROOT / "data/tle-snapshot.json").write_text(json.dumps(
        {"fetchedAt": datetime.datetime.now(datetime.UTC).isoformat(),
         "groups": ["stations", "visual"], "satellites": uniq},
        separators=(",", ":")))
    print(f"tle-snapshot.json: {len(uniq)} satellites")


if __name__ == "__main__":
    build_stars()
    build_tle()
