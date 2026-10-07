/**
 * 매일 한 번 실행하는 수집기.
 * 1) 종합 랭킹에서 새 캐릭터를 찾아 등록하고
 * 2) 등록된 캐릭터의 어제자 스펙을 저장하면서, 이전 스냅샷과 비교해 스펙업을 기록한다.
 *    장비는 보스 프리셋 기준이고, 전투력은 보스 프리셋을 끼고 있던 날만 기록한다.
 *
 * 환경변수: NEXON_API_KEY, DATABASE_URL
 *          RANKING_PAGES(기본 5, 페이지당 200명), MAX_CHARACTERS(기본 500), MIN_INTERVAL_MS(기본 200)
 */
import { kstDate } from "../src/lib/date";
import {
  charactersToCollect,
  getDb,
  knownNames,
  lastCombatPower,
  previousSnapshot,
  saveSnapshot,
  upsertCharacter,
} from "../src/lib/db";
import { NexonApiError, NexonClient } from "../src/lib/nexon/client";
import { combatPower, diffSlots, pickBossEquipment } from "../src/lib/snapshot";

const rankingPages = Number(process.env.RANKING_PAGES ?? 5);
const maxCharacters = Number(process.env.MAX_CHARACTERS ?? 500);

async function main() {
  const sql = getDb();
  if (!sql) throw new Error("DATABASE_URL이 필요합니다.");
  const api = new NexonClient({
    apiKey: process.env.NEXON_API_KEY ?? "",
    minIntervalMs: Number(process.env.MIN_INTERVAL_MS ?? 200),
  });
  const date = kstDate(-1);

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
        console.warn(`등록 실패: ${r.character_name}`, (e as Error).message);
      }
    }
  }
  console.log(`새 캐릭터 ${added}명 등록`);

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
      if (e instanceof NexonApiError && e.status === 429) throw e; // 호출 한도 소진: 다음 실행에서 이어서
      console.warn(`수집 실패: ${name}`, (e as Error).message);
    }
  }
  console.log(`스냅샷 ${saved}/${targets.length}건 저장, 스펙업 ${upgrades}건 감지 (${date})`);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
