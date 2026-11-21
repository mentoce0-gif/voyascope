#!/usr/bin/env python3
"""GMN（Global Meteor Network）の軌道サマリーから、2026-11-18 の夜に日本上空を飛んだ流星を抜き出す。

データ：Global Meteor Network（CC BY 4.0） https://globalmeteornetwork.org/data/
列の定義：https://globalmeteornetwork.org/data/media/GMN_orbit_data_columns.pdf

- 日ごとのファイルは「太陽黄経 1 度ぶん」で区切られている（UTC の日付の区切りではない）。
  そのため、ファイル名の日付が 2026-11-17 と 2026-11-18 の2つを読み、時刻で絞る。
- 局のコード（Participating stations）は読み飛ばし、出力に入れない。局の「数」（Num stat）だけ出す。
  軌道ごとの識別子（Unique trajectory identifier）も使わない。

使い方：
    python3 scripts/gmn/fetch_and_filter.py                 # ダウンロードして抽出
    python3 scripts/gmn/fetch_and_filter.py --local DIR     # DIR に置いたファイルを使う
標準ライブラリだけで動く。
"""
import argparse
import datetime as dt
import json
import os
import re
import sys
import urllib.request

BASE = "https://globalmeteornetwork.org/data/traj_summary_data/daily/"
FILE_DATES = ("20261117", "20261118")
T_START = dt.datetime(2026, 11, 18, 8, 0, 0)
T_END = dt.datetime(2026, 11, 18, 21, 0, 0)
LAT = (24.0, 46.0)
LON = (122.0, 146.0)
OUT_DEFAULT = os.path.join(os.path.dirname(__file__), "..", "..", "web", "lab",
                           "meteors-from-space", "meteors_20261118_japan.json")

# 列の定義 PDF の名前（ヘッダー1行目と2行目をつなげたもの）→ 出力のキー
WANTED = {
    "Beginning | UTC Time": "utc",
    "IAU | No": "iau_no",
    "IAU | code": "iau_code",
    "LatBeg | +N deg": "lat_beg",
    "LonBeg | +E deg": "lon_beg",
    "HtBeg | km": "ht_beg_km",
    "LatEnd | +N deg": "lat_end",
    "LonEnd | +E deg": "lon_end",
    "HtEnd | km": "ht_end_km",
    "Peak | AbsMag": "peak_absmag",
    "Vinit | km/s": "v_init_kms",
    "Vavg | km/s": "v_avg_kms",
    "Peak Ht | km": "peak_ht_km",
    "Duration | sec": "duration_s",
    "Num | stat": "num_stations",
}
EXCLUDED = ("Participating", "Unique trajectory")  # 読まない列（出力に出さない）。局の「数」（Num stat）は出してよい（2026-11-21 オーナー）

UA = {"User-Agent": "voyascope-mockup/0.1 (static site; one-off download)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read().decode("utf-8", "replace")


def find_files():
    listing = get(BASE)
    names = sorted(set(re.findall(r'href="(traj_summary_(\d{8})_solrange_[\d.\-]+\.txt)"', listing)))
    picked = [n for n, d in names if d in FILE_DATES]
    if len(picked) != len(FILE_DATES):
        sys.exit(f"日ごとのファイルが見つからない：{picked}")
    return [BASE + n for n in picked]


def parse_header(lines):
    h1 = [c.strip() for c in lines[1].strip().lstrip("#").split(";")]
    h2 = [c.strip() for c in lines[2].strip().lstrip("#").split(";")]
    names, prev = [], ""
    for a, b in zip(h1, h2):
        if a == "+/-":
            names.append(prev + " | sigma")
        else:
            prev = f"{a} | {b}"
            names.append(prev)
    idx = {}
    for want, key in WANTED.items():
        if names.count(want) != 1:
            sys.exit(f"列が見つからない・重複：{want}")
        idx[key] = names.index(want)
    return idx


def num(s):
    s = s.strip()
    return None if s in ("", "None", "nan") else float(s)


def in_japan(lat, lon):
    return lat is not None and lon is not None and LAT[0] <= lat <= LAT[1] and LON[0] <= lon <= LON[1]


def extract(text):
    lines = [l.lstrip("\r") for l in text.replace("\r\n", "\n").split("\n")]
    idx = parse_header([l for l in lines[:4]])
    out = []
    for line in lines:
        if not line or line.startswith("#"):
            continue
        c = line.split(";")
        t = dt.datetime.strptime(c[idx["utc"]].strip()[:19], "%Y-%m-%d %H:%M:%S")
        if not (T_START <= t < T_END):
            continue
        r = {k: num(c[i]) for k, i in idx.items() if k not in ("utc", "iau_code")}
        if not (in_japan(r["lat_beg"], r["lon_beg"]) or in_japan(r["lat_end"], r["lon_end"])):
            continue
        code = c[idx["iau_code"]].strip()
        r["iau_no"] = int(r["iau_no"]) if r["iau_no"] is not None else -1
        rec = {"utc": c[idx["utc"]].strip()[:23].replace(" ", "T") + "Z",
               "iau_code": None if code == "..." else code}
        for k in ("iau_no", "lat_beg", "lon_beg", "ht_beg_km", "lat_end", "lon_end",
                  "ht_end_km", "peak_absmag", "v_init_kms", "v_avg_kms", "peak_ht_km", "duration_s", "num_stations"):
            v = r[k]
            if k == "num_stations" and v is not None:
                v = int(v)
            rec[k] = round(v, 5 if k.startswith(("lat", "lon")) else 2) if isinstance(v, float) else v
        out.append(rec)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="ダウンロード済みファイルの置き場所")
    ap.add_argument("--out", default=OUT_DEFAULT)
    a = ap.parse_args()

    if a.local:
        files = sorted(os.path.join(a.local, f) for f in os.listdir(a.local)
                       if re.match(r"traj_summary_(%s)_" % "|".join(FILE_DATES), f))
        texts = [(os.path.basename(f), open(f, encoding="utf-8").read()) for f in files]
        urls = [BASE + os.path.basename(f) for f in files]
    else:
        urls = find_files()
        texts = [(u, get(u)) for u in urls]

    meteors, generated = [], []
    for name, text in texts:
        m = re.match(r"# Summary generated on (.+)", text)
        generated.append(m.group(1).strip() if m else None)
        meteors += extract(text)
    meteors.sort(key=lambda r: r["utc"])
    # 2つのファイルに同じ流星が入ることはない想定だが、念のため重ねない
    seen, uniq = set(), []
    for r in meteors:
        key = (r["utc"], r["lat_beg"], r["lon_beg"])
        if key not in seen:
            seen.add(key)
            uniq.append(r)

    doc = {
        "meta": {
            "source": "Global Meteor Network (GMN) trajectory summary",
            "source_page": "https://globalmeteornetwork.org/data/",
            "license": "CC BY 4.0 https://creativecommons.org/licenses/by/4.0/",
            "columns_doc": "https://globalmeteornetwork.org/data/media/GMN_orbit_data_columns.pdf",
            "files": urls,
            "files_generated_utc": generated,
            "extracted_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "filter": {
                "utc_from": T_START.isoformat() + "Z", "utc_to": T_END.isoformat() + "Z",
                "box": {"lat": LAT, "lon": LON},
                "rule": "beginning point OR end point inside the box",
            },
            "notes": [
                "heights are km above the WGS84 ellipsoid (HtBeg/HtEnd)",
                "peak_absmag is normalized to 100 km range (Peak AbsMag)",
                "iau_code null = sporadic (GMN code '...')",
                "station codes are intentionally not included (only the number of stations)",
                "duration_s is the meteor duration (Duration, sec); peak_ht_km is the height of peak magnitude (Peak Ht)",
            ],
            "count": len(uniq),
        },
        "meteors": uniq,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    by = {}
    for r in uniq:
        by[r["iau_code"] or "散在"] = by.get(r["iau_code"] or "散在", 0) + 1
    print(f"{len(uniq)} 件 → {a.out}")
    print(sorted(by.items(), key=lambda x: -x[1]))


if __name__ == "__main__":
    main()
