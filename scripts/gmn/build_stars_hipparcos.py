#!/usr/bin/env python3
"""「流星を眺める｜見上げる」の背景の星：ヒッパルコス星表から、6等より明るい星の位置と明るさだけを取り出す。

出典：ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200（CDS/VizieR I/239 の hip_main）
      https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=I/239
      VizieR の謝辞："This research has made use of the VizieR catalogue access tool, CDS, Strasbourg, France (DOI: 10.26093/cds/vizier)."
方針：星の位置と明るさは「誰のものでもない」ので、ESA のデータでも例外として使う（2026-11-22 オーナー）。探査機の模型などは都度判断。
- 位置は ICRS（J2000 とほぼ同じ。元期 J1991.25。固有運動は入れていない＝肉眼の目安としては十分）
- 6等未満（Vmag < 6.0）＝理想的な暗い夜空で肉眼で見える限界（国立天文台「星の明るさ」）

使い方：python3 -I scripts/gmn/build_stars_hipparcos.py
標準ライブラリだけで動く。
"""
import json, os, urllib.request

URL = ("https://vizier.cfa.harvard.edu/viz-bin/asu-tsv?-source=I/239/hip_main"
       "&-out=HIP&-out=RAICRS&-out=DEICRS&-out=Vmag&Vmag=%3C6.0&-out.max=20000")
OUT = os.path.join(os.path.dirname(__file__), "..", "..", "web", "meteors", "data", "stars-hipparcos.json")

req = urllib.request.Request(URL, headers={"User-Agent": "voyascope-static-site/0.1 (one-off download)"})
text = urllib.request.urlopen(req, timeout=180).read().decode("utf-8", "replace")
stars = []
for line in text.splitlines():
    if not line or line.startswith("#"):
        continue
    c = line.split("\t")
    if len(c) < 4 or not c[0].strip().isdigit():
        continue
    try:
        ra, dec, v = float(c[1]), float(c[2]), float(c[3])
    except ValueError:
        continue
    stars.append([round(ra, 2), round(dec, 2), round(v, 1)])
stars.sort(key=lambda s: s[2])
doc = {
    "meta": {
        "source": "ESA, 1997, The Hipparcos and Tycho Catalogues, ESA SP-1200 (Hipparcos main catalogue, CDS/VizieR I/239)",
        "url": "https://vizier.cfa.harvard.edu/viz-bin/VizieR?-source=I/239",
        "vizier_ack": "This research has made use of the VizieR catalogue access tool, CDS, Strasbourg, France (DOI: 10.26093/cds/vizier).",
        "fields": ["ra_deg_ICRS", "dec_deg_ICRS", "v_mag"],
        "filter": "Vmag < 6.0",
        "count": len(stars),
    },
    "stars": stars,
}
json.dump(doc, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(len(stars), "stars ->", OUT)
