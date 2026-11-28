#!/usr/bin/env python3
"""GMN（Global Meteor Network）の軌道サマリーから、流星群の夜に、各地域の上空を飛んだ流星を抜き出す。

データ：Global Meteor Network（CC BY 4.0） https://globalmeteornetwork.org/data/
列の定義：https://globalmeteornetwork.org/data/media/GMN_orbit_data_columns.pdf

- 日ごとのファイルは「太陽黄経 1 度ぶん」で区切られている（UTC の日付の区切りではない）。
  そのため、夜の始まりの日 D の前後（D-1・D・D+1）のファイルを読み、時刻で絞る
  （2026-11-28：前は D だけ・日本は D-1 と D で、ヨーロッパの夜の終わりを読み落としていた）。
- 局のコード（Participating stations）は読み飛ばし、出力に入れない。局の「数」（Num stat）だけ出す。
  軌道ごとの識別子（Unique trajectory identifier）も使わない。
- 夜の選び方（--auto）：有名な流星群ごと・地域ごとに、目安の日の前後2晩のうち、その流星群の流星が
  いちばん多く記録された夜。その数が MIN_SHOWER 個より少なければ載せない（曇り・その地域で見えにくい群）。
  「極大」とは書かない（実際に記録が多かった夜。2026-11-28 オーナー）。

使い方：
    python3 -I scripts/gmn/fetch_and_filter.py --auto [--local DIR]                 # 夜を選んで抜き出し、nights.json を作る
    python3 -I scripts/gmn/fetch_and_filter.py --region japan --night 2026-11-18 --shower LEO [--local DIR]
標準ライブラリだけで動く。
"""
import argparse
import datetime as dt
import json
import os
import re
import statistics
import sys
import urllib.request

BASE = "https://globalmeteornetwork.org/data/traj_summary_data/daily/"
# 地域：夜の時間帯（夜の始まりの日 D の 0時 UTC からの時間）と範囲。2026-11-22 オーナー：北アメリカ・ヨーロッパも
REGIONS = {
    "japan":    {"h": (8, 21),  "lat": (24.0, 46.0), "lon": (122.0, 146.0)},
    "europe":   {"h": (15, 32), "lat": (35.0, 62.0), "lon": (-12.0, 30.0)},
    "namerica": {"h": (21, 39), "lat": (25.0, 55.0), "lon": (-125.0, -60.0)},
}
# 有名な流星群：調べる範囲の目安の日（夜の始まりの日）。前後2晩を調べ、実際の記録でいちばん多い夜を選ぶ。
# この日は調べる範囲を決めるためだけに使い、画面には出さない
SHOWERS = {
    "QUA": "2026-01-03", "LYR": "2026-04-22", "ETA": "2026-05-06", "PER": "2026-08-12",
    "DRA": "2026-10-08", "ORI": "2026-10-21", "LEO": "2026-11-17", "GEM": "2025-12-13",
}
SPAN = 2           # 目安の日の前後何晩を調べるか
MIN_SHOWER = 150   # その流星群の流星がこれより少ない夜は載せない（2026-11-28 オーナー）
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "web", "meteors", "data")

# 列の定義 PDF の名前（ヘッダー1行目と2行目をつなげたもの）→ 出力のキー
WANTED = {
    "Beginning | UTC Time": "utc",
    "IAU | No": "iau_no",
    "IAU | code": "iau_code",
    "RAgeo | deg": "ra_geo",
    "DECgeo | deg": "dec_geo",
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
KEEP = ("lat_beg", "lon_beg", "ht_beg_km", "lat_end", "lon_end", "ht_end_km", "peak_absmag", "v_init_kms", "peak_ht_km", "duration_s", "num_stations")

UA = {"User-Agent": "voyascope-mockup/0.1 (static site; one-off download)"}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r:
        return r.read().decode("utf-8", "replace")


def parse_header(lines):
    hl = [l for l in lines if l.startswith("#") and ";" in l]  # 見出しの2行（あいだに空行がある）
    h1 = [c.strip() for c in hl[0].strip().lstrip("#").split(";")]
    h2 = [c.strip() for c in hl[1].strip().lstrip("#").split(";")]
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


class Source:
    """日ごとのファイル（ダウンロード、または --local の置き場所）"""
    def __init__(self, local=None):
        self.local, self.cache = local, {}
        listing = get(BASE) if not local else ""
        self.names = dict((d, n) for n, d in re.findall(r'href="(traj_summary_(\d{8})_solrange_[\d.\-]+\.txt)"', listing))
        if local:
            for f in os.listdir(local):
                m = re.match(r"traj_summary_(\d{8})_solrange_[\d.\-]+\.txt$", f)
                if m:
                    self.names[m.group(1)] = f

    def rows(self, day):
        """その日のファイルの流星（全部の列を辞書で）。ファイルがなければ []"""
        if day in self.cache:
            return self.cache[day]
        name = self.names.get(day)
        if not name:
            self.cache[day] = (None, None, [])
            return self.cache[day]
        text = open(os.path.join(self.local, name), encoding="utf-8", newline="").read() if self.local else get(BASE + name)
        lines = [l.lstrip("\r") for l in text.replace("\r\n", "\n").split("\n")]
        idx = parse_header(lines[:8])
        m = re.match(r"# Summary generated on (.+)", text)
        out = []
        for line in lines:
            if not line or line.startswith("#"):
                continue
            c = line.split(";")
            try:
                t = dt.datetime.strptime(c[idx["utc"]].strip()[:19], "%Y-%m-%d %H:%M:%S")
            except ValueError:
                continue
            r = {k: num(c[i]) for k, i in idx.items() if k not in ("utc", "iau_code")}
            code = c[idx["iau_code"]].strip()
            r["_t"], r["utc"], r["iau_code"] = t, c[idx["utc"]].strip()[:23].replace(" ", "T") + "Z", None if code == "..." else code
            out.append(r)
        self.cache[day] = (BASE + name, m.group(1).strip() if m else None, out)
        return self.cache[day]


def night_rows(src, region, night):
    """夜の始まりの日 night（date）に、region の範囲・時間帯に光った流星（D-1・D・D+1 のファイルから。重ねない）"""
    rg = REGIONS[region]
    t0 = dt.datetime.combine(night, dt.time()) + dt.timedelta(hours=rg["h"][0])
    t1 = dt.datetime.combine(night, dt.time()) + dt.timedelta(hours=rg["h"][1])
    inb = lambda la, lo: la is not None and lo is not None and rg["lat"][0] <= la <= rg["lat"][1] and rg["lon"][0] <= lo <= rg["lon"][1]
    urls, gens, seen, out = [], [], set(), []
    for k in (-1, 0, 1):
        url, gen, rows = src.rows((night + dt.timedelta(k)).strftime("%Y%m%d"))
        used = False
        for r in rows:
            if not (t0 <= r["_t"] < t1) or not (inb(r["lat_beg"], r["lon_beg"]) or inb(r["lat_end"], r["lon_end"])):
                continue
            key = (r["utc"], r["lat_beg"], r["lon_beg"])
            if key in seen:
                continue
            seen.add(key); out.append(r); used = True
        if used:
            urls.append(url); gens.append(gen)
    out.sort(key=lambda r: r["utc"])
    return out, urls, gens, (t0, t1)


def write_night(src, region, night, shower, out=None):
    rows, urls, gens, (t0, t1) = night_rows(src, region, night)
    meteors = []
    for r in rows:
        rec = {"utc": r["utc"], "iau_code": r["iau_code"]}
        # 画面で使う値だけ（ページを軽くする。2026-11-22：平均の速さ・流星群の番号は使っていないので出さない）
        for k in KEEP:
            v = r[k]
            if k == "num_stations" and v is not None:
                v = int(v)
            rec[k] = round(v, 4 if k.startswith(("lat", "lon")) else (1 if k.endswith("_km") else 2)) if isinstance(v, float) else v  # 緯度経度 約10 m・高さ 0.1 km
        meteors.append(rec)
    mem = [r for r in rows if r["iau_code"] == shower and r["ra_geo"] is not None and r["dec_geo"] is not None]
    radiant = None
    if mem:
        # 放射点：その夜にこの地域で記録された、その群の流星の地心放射点（RAgeo・DECgeo）の中央値（目安）
        ras = sorted(((r["ra_geo"] - mem[0]["ra_geo"] + 180) % 360 - 180 for r in mem))  # 0°/360° をまたいでも中央値がずれないように
        radiant = {"code": shower, "ra": round((statistics.median(ras) + mem[0]["ra_geo"]) % 360, 1),
                   "dec": round(statistics.median(r["dec_geo"] for r in mem), 1), "n": len(mem),
                   "method": "median of RAgeo/DECgeo of the shower members in this file"}
    doc = {
        "meta": {
            "source": "Global Meteor Network (GMN) trajectory summary",
            "region": region,
            "night": night.isoformat(),
            "shower": shower,
            "radiant": radiant,
            "source_page": "https://globalmeteornetwork.org/data/",
            "license": "CC BY 4.0 https://creativecommons.org/licenses/by/4.0/",
            "columns_doc": "https://globalmeteornetwork.org/data/media/GMN_orbit_data_columns.pdf",
            "files": urls,
            "files_generated_utc": gens,
            "extracted_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "filter": {
                "utc_from": t0.isoformat() + "Z", "utc_to": t1.isoformat() + "Z",
                "box": {"lat": REGIONS[region]["lat"], "lon": REGIONS[region]["lon"]},
                "rule": "beginning point OR end point inside the box",
            },
            "notes": [
                "heights are km above the WGS84 ellipsoid (HtBeg/HtEnd)",
                "peak_absmag is normalized to 100 km range (Peak AbsMag)",
                "iau_code null = sporadic (GMN code '...')",
                "station codes are intentionally not included (only the number of stations)",
                "duration_s is the meteor duration (Duration, sec); peak_ht_km is the height of peak magnitude (Peak Ht)",
            ],
            "count": len(meteors),
            "count_shower": sum(1 for m in meteors if m["iau_code"] == shower),
        },
        "meteors": meteors,
    }
    out = out or os.path.join(OUT_DIR, f"meteors_{night.strftime('%Y%m%d')}_{region}.json")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(doc, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{region} {night} {shower}: {len(meteors)} 件（{shower} {doc['meta']['count_shower']}） → {os.path.relpath(out)}")
    return doc["meta"], os.path.basename(out)


def auto(src):
    """有名な流星群の夜を選び、抜き出して、nights.json（夜の一覧）を作る"""
    index = {"note": "GMN が実際に多く記録した夜（流星群ごと・地域ごと）。極大の予報ではない。fetch_and_filter.py --auto で作る",
             "min_shower": MIN_SHOWER, "span": SPAN, "generated_at_utc": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
             "regions": {}}
    for region in REGIONS:
        nights = []
        for code, d in SHOWERS.items():
            d0 = dt.date.fromisoformat(d)
            best = None
            for k in range(-SPAN, SPAN + 1):
                n = d0 + dt.timedelta(k)
                rows = night_rows(src, region, n)[0]
                c = sum(1 for r in rows if r["iau_code"] == code)
                print(f"  {region} {code} {n}: {len(rows)} 件（{code} {c}）")
                if best is None or c > best[1]:
                    best = (n, c)
            if best[1] < MIN_SHOWER:
                print(f"→ {region} {code}：載せない（いちばん多い夜でも {best[1]} 個）")
                continue
            meta, file = write_night(src, region, best[0], code)
            nights.append({"night": best[0].isoformat(), "shower": code, "count": meta["count"], "count_shower": meta["count_shower"], "file": file})
        index["regions"][region] = sorted(nights, key=lambda x: x["night"])
    out = os.path.join(OUT_DIR, "nights.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=1)
    print(f"→ {os.path.relpath(out)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", help="ダウンロード済みファイルの置き場所")
    ap.add_argument("--auto", action="store_true", help="有名な流星群の夜を選んで抜き出し、nights.json を作る")
    ap.add_argument("--region", choices=sorted(REGIONS))
    ap.add_argument("--night", help="夜の始まりの日 YYYY-MM-DD")
    ap.add_argument("--shower", help="その夜の主な流星群のコード（放射点の計算に使う）")
    ap.add_argument("--out", default=None)
    a = ap.parse_args()
    src = Source(a.local)
    if a.auto:
        auto(src)
    elif a.region and a.night and a.shower:
        write_night(src, a.region, dt.date.fromisoformat(a.night), a.shower, a.out)
    else:
        ap.error("--auto か、--region・--night・--shower を指定してください")


if __name__ == "__main__":
    main()
