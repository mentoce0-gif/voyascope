#!/usr/bin/env python3
"""「見上げるver.」の背景の星：IAU 恒星名ワーキンググループの星名カタログ（IAU-CSN）から、明るい星の位置と明るさだけを取り出す。

出典：IAU Catalog of Star Names (IAU-CSN) https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt
      公式の版：https://www.iau.org/public/themes/naming_stars/
      ファイルの頭に "All IAU-produced products (Images, Videos, Texts) are released under Creative Commons Attribution" とある。
      このプロジェクトでは、しし座・ふたご座の星の位置にすでに使っている（docs/changelog.md 2026-10-26）。
- 名前のある星だけの一覧なので、すべての明るい星が入っているわけではない（背景の星空の目安）
- 位置は J2000（2026年の位置とは歳差で 0.4°ほどずれる）
使い方：python3 -I scripts/gmn/build_stars.py IAU-CSN.txt
"""
import json, os, re, sys

MAG_MAX = 5.5
src = sys.argv[1]
out = os.path.join(os.path.dirname(__file__), "..", "..", "web", "lab", "meteors-look-up", "stars-iau-csn.json")
stars = []
for line in open(src, encoding="utf-8"):
    if line.startswith(("#", "$")) or not line.strip():
        continue
    t = line.split()
    di = next((i for i, x in enumerate(t) if re.fullmatch(r"\d{4}-\d{2}-\d{2}", x)), None)
    if di is None or di < 7:
        continue
    try:
        ra, dec, mag, bnd = float(t[di - 2]), float(t[di - 1]), float(t[di - 6]), t[di - 5]
    except ValueError:
        continue
    if bnd != "V" or mag > MAG_MAX:
        continue
    stars.append([round(ra, 3), round(dec, 3), round(mag, 2)])
stars.sort(key=lambda s: s[2])
doc = {
    "meta": {
        "source": "IAU Catalog of Star Names (IAU-CSN), IAU Division C Working Group on Star Names",
        "url": "https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt",
        "official": "https://www.iau.org/public/themes/naming_stars/",
        "license_note": "All IAU-produced products (Images, Videos, Texts) are released under Creative Commons Attribution (IAU-CSN header)",
        "fields": ["ra_deg_J2000", "dec_deg_J2000", "v_mag"],
        "filter": f"V band, mag <= {MAG_MAX}",
        "count": len(stars),
    },
    "stars": stars,
}
json.dump(doc, open(out, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(stars), "stars ->", out)
