/**
 * 매일 한 번 실행하는 수집기.
 * 1) 종합 랭킹에서 새 캐릭터를 찾아 등록하고
 * 2) 등록된 캐릭터의 어제자 스펙을 저장하면서, 이전 스냅샷과 비교해 스펙업을 기록한다.
 *    장비는 보스 프리셋 기준이고, 전투력은 보스 프리셋을 끼고 있던 날만 기록한다.
 *
 * 환경변수: NEXON_API_KEY, DATABASE_URL
 *          RANKING_PAGES(기본 1, 페이지당 200명), MAX_CHARACTERS(기본 250, 하루치당), MIN_INTERVAL_MS(기본 200)
 *          COLLECT_FROM, COLLECT_TO(YYYY-MM-DD, 기본 어제): 과거 날짜를 백필할 때. 날짜 순서대로 수집해야
 *          직전 스냅샷과 비교가 맞다.
 * 호출 한도에 걸리면 거기서 정상 종료한다. 같은 범위로 다시 실행하면 이미 수집한 캐릭터·날짜는 건너뛰고 이어간다.
 */
import { dateRange, kstDate } from "../src/lib/date";
import {
  charactersToCollect,
  getDb,
  knownNames,
  lastCombatPower,
  previousSnapshot,
  saveSnapshot,
  upsertCharacter,
} from "../src/lib/db";
import type postgres from "postgres";
import { NexonApiError, NexonClient } from "../src/lib/nexon/client";
import { combatPower, diffSlots, pickBossEquipment } from "../src/lib/snapshot";

// 기본값은 개발 키(일일 약 1,000회로 추정)에 맞춘 값: 250명 × 3회 + 랭킹·신규 등록
const rankingPages = Number(process.env.RANKING_PAGES ?? 1);
const maxCharacters = Number(process.env.MAX_CHARACTERS ?? 250);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function main() {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL이 필요합니다.");
  const api = new NexonClient({
    apiKey: process.env.NEXON_API_KEY ?? "",
    minIntervalMs: Number(process.env.MIN_INTERVAL_MS ?? 200),
  });
  const yesterday = kstDate(-1);
  const from = process.env.COLLECT_FROM || yesterday;
  const to = process.env.COLLECT_TO || yesterday;
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to || to > yesterday) {
    throw new Error(`수집 기간이 올바르지 않습니다: ${from} ~ ${to} (어제 ${yesterday}까지 가능)`);
  }

  try {
    for (const date of dateRange(from, to)) await collectDate(sql, api, date);
  } catch (e) {
    if (!(e instanceof NexonApiError && e.rateLimited)) throw e;
    console.log("API 호출 한도에 도달해 중단합니다. 다음 실행에서 이어서 수집합니다.");
  } finally {
    await sql.end();
  }
}

async function collectDate(sql: postgres.Sql, api: NexonClient, date: string) {
  let added = 0;
  for (let page = 1; page <= rankingPages; page++) {
    const { ranking } = await api.getOverallRanking(date, { page });
    if (ranking.length === 0) break;
    const known = await knownNames(sql, ranking.map((r) => r.character_name));
    for (const r of ranking) {
      if (known.has(r.character_name)) continue;
      try {
        const ocid = await api.getOcid(r.character_name);
        await upsertCharacter(sql, {
          ocid,
          name: r.character_name,
          world: r.world_name,
          class: r.sub_class_name || r.class_name,
        });
        added++;
      } catch (e) {
        if (e instanceof NexonApiError && e.rateLimited) throw e;
        console.warn(`등록 실패: ${r.character_name}`, (e as Error).message);
      }
    }
  }
  console.log(`[${date}] 새 캐릭터 ${added}명 등록`);

  const targets = await charactersToCollect(sql, date, maxCharacters);
  let saved = 0;
  let upgrades = 0;
  for (const { ocid, name } of targets) {
    try {
      const [basic, stat, equipment] = await Promise.all([
        api.getCharacterBasic(ocid, date),
        api.getCharacterStat(ocid, date),
        api.getItemEquipment(ocid, date),
      ]);
      if (!basic.character_class) continue;
      const boss = pickBossEquipment(equipment);
      const cp = boss.wearing ? combatPower(stat) : null;
      const [prev, cpBefore] = await Promise.all([
        previousSnapshot(sql, ocid, date),
        lastCombatPower(sql, ocid, date),
      ]);
      const changes = prev ? diffSlots(prev.slots, boss.slots) : [];
      await saveSnapshot(
        sql,
        { ocid, date, class: basic.character_class, level: basic.character_level, combatPower: cp, slots: boss.slots },
        prev ? { dateFrom: prev.date, cpBefore, changes } : null,
      );
      saved++;
      upgrades += changes.length;
    } catch (e) {
      if (e instanceof NexonApiError && e.rateLimited) throw e;
      console.warn(`수집 실패: ${name}`, (e as Error).message);
    }
  }
  console.log(`[${date}] 스냅샷 ${saved}/${targets.length}건 저장, 스펙업 ${upgrades}건 감지`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
