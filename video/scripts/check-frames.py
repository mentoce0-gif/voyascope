# 描き出した動画に、欠けたコマ（前後のコマより急に暗い・明るい1コマ）がないかを調べる
#   python3 scripts/check-frames.py out/voyascope-teaser.mp4
# 描き終わる前のコマが撮られると、背景だけになったり、画面の一部が四角く欠けたりする（2026-10-24 に見つかった）
import subprocess, sys

for f in sys.argv[1:] or ['out/voyascope-teaser.mp4']:
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-vf', 'signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-f', 'null', '-'], capture_output=True, text=True).stdout
    ys = [float(l.split('=')[1]) for l in out.splitlines() if 'YAVG' in l]
    bad = [i for i in range(1, len(ys) - 1) if abs(ys[i] - ys[i - 1]) > 6 and abs(ys[i] - ys[i + 1]) > 6 and (ys[i] - ys[i - 1]) * (ys[i] - ys[i + 1]) > 0]
    print(f'{f}: {len(ys)} コマ、欠けの疑い {len(bad)} コマ', [f'{i / 30:.2f}s' for i in bad[:30]])
