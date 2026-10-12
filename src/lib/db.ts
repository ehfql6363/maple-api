import postgres from "postgres";
import type { UpgradeEvent } from "./roadmap";
import type { SlotState, UpgradeChange } from "./snapshot";

let client: postgres.Sql | null = null;

/** DATABASE_URL이 없으면 null. 화면은 DB 없이도 현재 스펙까지는 보여준다. */
export function getDb(): postgres.Sql | null {
  if (!process.env.DATABASE_URL) return null;
  client ??= postgres(process.env.DATABASE_URL, { max: 5 });
  return client;
}

/** 비슷한 구간: 내 전투력의 ±band 비율 */
export const DEFAULT_BAND = 0.15;

export async function upsertCharacter(
  sql: postgres.Sql,
  c: { ocid: string; name: string; world: string; class: string },
) {
  await sql`
    INSERT INTO characters (ocid, name, world, class)
    VALUES (${c.ocid}, ${c.name}, ${c.world}, ${c.class})
    ON CONFLICT (ocid) DO UPDATE SET name = EXCLUDED.name, world = EXCLUDED.world, class = EXCLUDED.class`;
}

export async function knownNames(sql: postgres.Sql, names: string[]): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const rows = await sql<{ name: string }[]>`SELECT name FROM characters WHERE name IN ${sql(names)}`;
  return new Set(rows.map((r) => r.name));
}

/** 오늘 수집하지 않은 캐릭터를 오래된 순으로 */
export async function charactersToCollect(sql: postgres.Sql, date: string, limit: number) {
  return sql<{ ocid: string; name: string }[]>`
    SELECT ocid, name FROM characters
    WHERE last_collected IS NULL OR last_collected < ${date}
    ORDER BY last_collected NULLS FIRST
    LIMIT ${limit}`;
}

export async function previousSnapshot(sql: postgres.Sql, ocid: string, date: string) {
  const [row] = await sql<{ date: Date; slots: SlotState[] }[]>`
    SELECT date, slots FROM snapshots
    WHERE ocid = ${ocid} AND date < ${date}
    ORDER BY date DESC LIMIT 1`;
  return row ? { date: row.date.toISOString().slice(0, 10), slots: row.slots } : null;
}

/** 마지막으로 확인된 보스 프리셋 전투력. before를 주면 그 날짜 이전(포함 안 함)만 본다. */
export async function lastCombatPower(sql: postgres.Sql, ocid: string, before?: string): Promise<number | null> {
  const [row] = await sql<{ combat_power: string }[]>`
    SELECT combat_power FROM snapshots
    WHERE ocid = ${ocid} AND combat_power IS NOT NULL ${before ? sql`AND date < ${before}` : sql``}
    ORDER BY date DESC LIMIT 1`;
  return row ? Number(row.combat_power) : null;
}

export async function saveSnapshot(
  sql: postgres.Sql,
  s: { ocid: string; date: string; class: string; level: number; combatPower: number | null; slots: SlotState[] },
  events: { dateFrom: string; cpBefore: number | null; changes: UpgradeChange[] } | null,
) {
  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO snapshots (ocid, date, class, level, combat_power, slots)
      VALUES (${s.ocid}, ${s.date}, ${s.class}, ${s.level}, ${s.combatPower}, ${tx.json(s.slots as never)})
      ON CONFLICT (ocid, date) DO NOTHING`;
    if (events && events.changes.length > 0) {
      const rows = events.changes.map((c) => ({
        ocid: s.ocid,
        class: s.class,
        date_from: events.dateFrom,
        date_to: s.date,
        slot: c.slot,
        kind: c.kind,
        target: c.target,
        from_value: c.from,
        to_value: c.to,
        cp_before: events.cpBefore,
        cp_after: s.combatPower,
      }));
      await tx`INSERT INTO upgrade_events ${tx(rows)} ON CONFLICT DO NOTHING`;
    }
    await tx`UPDATE characters SET last_collected = ${s.date} WHERE ocid = ${s.ocid}`;
  });
}

/** 같은 직업·비슷한 전투력에서 일어난 스펙업 (최근 days일) */
export async function peerEvents(
  sql: postgres.Sql,
  cls: string,
  cp: number,
  { band = DEFAULT_BAND, days = 90 } = {},
): Promise<UpgradeEvent[]> {
  const rows = await sql<
    { ocid: string; slot: string; kind: UpgradeEvent["kind"]; target: string; to_value: string; cp_before: string; cp_after: string | null }[]
  >`
    SELECT ocid, slot, kind, target, to_value, cp_before, cp_after FROM upgrade_events
    WHERE class = ${cls}
      AND cp_before BETWEEN ${Math.floor(cp * (1 - band))} AND ${Math.ceil(cp * (1 + band))}
      AND date_to >= CURRENT_DATE - ${days}::int`;
  return rows.map((r) => ({
    ocid: r.ocid,
    slot: r.slot,
    kind: r.kind,
    target: r.target,
    to: r.to_value,
    cpBefore: Number(r.cp_before),
    cpAfter: r.cp_after === null ? null : Number(r.cp_after),
  }));
}

/** 같은 직업·비슷한 보스 전투력 유저들의 최신 보스 프리셋 장비 (최근 30일 중 전투력이 기록된 가장 최신 스냅샷) */
export async function peerSlots(
  sql: postgres.Sql,
  cls: string,
  cp: number,
  { band = DEFAULT_BAND } = {},
): Promise<SlotState[][]> {
  const rows = await sql<{ slots: SlotState[] }[]>`
    SELECT DISTINCT ON (ocid) slots FROM snapshots
    WHERE class = ${cls}
      AND combat_power BETWEEN ${Math.floor(cp * (1 - band))} AND ${Math.ceil(cp * (1 + band))}
      AND date >= CURRENT_DATE - 30
    ORDER BY ocid, date DESC`;
  return rows.map((r) => r.slots);
}
