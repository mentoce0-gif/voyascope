// SpaceTips の帯（M13、2026-10-30 オーナー：A＋C 案）：地球の画面の下に、最近の出来事・近い予定を流し、
// 押すと「一言でわかる」ページ（5つの問い）を開く。材料は data/tips.json（build-summaries.mjs が curation/ から作る）
// 文はカードの出来事の名前と日付だけから作る（新しい事実は書かない）

const DAY = 86400000;
const JST = 9 * 3600000;
export const PAST_DAYS = 30; // 済んだ出来事を出す期間
export const NEXT_DAYS = 60; // これからの予定を出す期間

// 日本時間の「その日の0時」（ミリ秒）
const jstMidnight = (t) => Math.floor((t + JST) / DAY) * DAY - JST;

// tips.json の when（at / date / from。month だけのものは日数を数えない）を、日本時間の日付の0時に
export function whenDay(w) {
  const iso = w?.at ?? (w?.date ?? w?.from ? `${w.date ?? w.from}T00:00:00+09:00` : null);
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : jstMidnight(t);
}

// 帯に出す行。済んだ出来事は「〇〇から N日」、これからは「あと N日：〇〇」。近いものから
export function tipLines(items, now = Date.now()) {
  const today = jstMidnight(now);
  const out = [];
  for (const it of items ?? []) {
    const day = whenDay(it.when);
    if (day === null) continue;
    const n = Math.round((day - today) / DAY);
    if (it.status === "done" && n <= 0 && -n <= PAST_DAYS) {
      out.push({ ...it, n, text: n === 0 ? `きょう：${it.title}` : `${it.title}から${-n}日` });
    } else if (it.status !== "done" && it.status !== "cancelled" && n >= 0 && n <= NEXT_DAYS) {
      out.push({ ...it, n, text: n === 0 ? `きょう：${it.title}` : `あと${n}日：${it.title}${it.status === "postponed" ? "（延期）" : ""}` });
    }
  }
  return out.sort((a, b) => Math.abs(a.n) - Math.abs(b.n) || a.n - b.n);
}

// 何もないときの1行（一覧へ）
export const FALLBACK = { text: "ニュースで見た名前を、5つの問いで", name: "SpaceTips", href: "missions/" };
