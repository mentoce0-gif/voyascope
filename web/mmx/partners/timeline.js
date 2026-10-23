// MMX の国際協力のページ：機関ごとの「いつ」を比べる（ブラウザとテストの両方で使う）
// 日付は "YYYY-MM" か "YYYY-MM-DD"。from〜to をその月の初め〜終わりとして、重なりを見る

// "2027-08" → 2027*12+7（月の通し番号）
export const monthIndex = (s) => {
  const [y, m] = s.split("-").map(Number);
  return y * 12 + (m - 1);
};

// 1つの出来事の比べ方：日付つきの言い分が全部重なる月があるか、JAXA（主導）が日付を出しているか
export function compareMilestone(claims, lead = "JAXA") {
  const dated = claims.filter((c) => c.from && c.to);
  const undated = claims.filter((c) => !(c.from && c.to));
  const lo = Math.max(...dated.map((c) => monthIndex(c.from)));
  const hi = Math.min(...dated.map((c) => monthIndex(c.to)));
  const issues = [];
  let status;
  if (dated.length === 0) {
    status = "no-date";
    issues.push("No source gives a date yet.");
  } else if (lo > hi) {
    status = "disagree";
    const years = [...new Set(dated.map((c) => `${c.publisher}: ${c.text}`))];
    issues.push(`Sources disagree — the dates do not overlap. ${years.join(" / ")}`);
  } else if (dated.length === 1) {
    status = "single";
    issues.push(`Only one source gives a date (${dated[0].publisher}).`);
  } else {
    status = "agree";
  }
  if (dated.length && !dated.some((c) => c.publisher === lead)) {
    issues.push(`${lead}, the mission lead, has not published a date for this.`);
    if (status === "agree") status = "no-lead-date";
  }
  return { status, dated, undated, overlap: lo <= hi && dated.length ? [lo, hi] : null, issues };
}

export function compareAll(timeline) {
  return timeline.milestones.map((m) => ({
    ...m,
    ...compareMilestone(timeline.claims.filter((c) => c.milestone === m.id), timeline.lead)
  }));
}
