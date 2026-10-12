const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 YYYY-MM-DD. offsetDays가 -1이면 어제. */
export function kstDate(offsetDays = 0, now: Date = new Date()): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS + offsetDays * 86_400_000);
  return kst.toISOString().slice(0, 10);
}

/** from부터 to까지(양 끝 포함) 날짜 목록. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}
