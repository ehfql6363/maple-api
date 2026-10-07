import type { CharacterItemEquipment, CharacterStat, ItemEquipment } from "./nexon/types";

/** 한 부위의 장비 상태 요약. 로드맵 비교에 필요한 것만 남긴다. */
export interface SlotState {
  slot: string;
  name: string;
  starforce: number;
  potential: string | null;
  additional: string | null;
}

export type UpgradeKind = "item" | "starforce" | "potential" | "additional";

export interface UpgradeChange {
  slot: string;
  kind: UpgradeKind;
  /** 같은 업그레이드끼리 묶는 키. 예) 아이템 이름, "22성", "레전드리" */
  target: string;
  from: string;
  to: string;
}

const GRADE_ORDER = ["레어", "에픽", "유니크", "레전드리"];

export function gradeRank(grade: string | null): number {
  return grade ? GRADE_ORDER.indexOf(grade) : -1;
}

export function toSlots(items: ItemEquipment[]): SlotState[] {
  return items.map((item) => ({
    slot: item.item_equipment_slot,
    name: item.item_name,
    starforce: Number(item.starforce) || 0,
    potential: item.potential_option_grade,
    additional: item.additional_potential_option_grade,
  }));
}

const HUNTING_OPTION = /아이템 드롭률|메소 획득량/;

/** 잠재·에디셔널 옵션 중 사냥용(아이템 드롭률, 메소 획득량) 줄 수 */
export function huntingLines(items: ItemEquipment[]): number {
  let n = 0;
  for (const i of items) {
    for (const line of [
      i.potential_option_1,
      i.potential_option_2,
      i.potential_option_3,
      i.additional_potential_option_1,
      i.additional_potential_option_2,
      i.additional_potential_option_3,
    ]) {
      if (line && HUNTING_OPTION.test(line)) n++;
    }
  }
  return n;
}

export interface BossEquipment {
  presetNo: number | null;
  slots: SlotState[];
  /** 지금 이 프리셋을 끼고 있는지. 아니면 스탯 API의 전투력은 보스 세팅 기준이 아니다. */
  wearing: boolean;
}

/**
 * 프리셋 중 보스용 세팅을 고른다. API는 전투력을 현재 착용 프리셋 기준으로만 주기 때문에
 * 사냥용 잠재 줄이 가장 적은 프리셋 → 스타포스 합이 높은 프리셋 → 현재 착용 프리셋 순으로 고른다.
 */
export function pickBossEquipment(eq: CharacterItemEquipment): BossEquipment {
  const current = toSlots(eq.item_equipment);
  const presets = ([1, 2, 3] as const)
    .map((no) => ({ no, items: eq[`item_equipment_preset_${no}`] ?? [] }))
    .filter((p) => p.items.length > 0)
    .map((p) => ({
      no: p.no,
      slots: toSlots(p.items),
      hunting: huntingLines(p.items),
      starforce: p.items.reduce((sum, i) => sum + (Number(i.starforce) || 0), 0),
    }));
  if (presets.length === 0) return { presetNo: eq.preset_no, slots: current, wearing: true };

  presets.sort(
    (a, b) =>
      a.hunting - b.hunting ||
      b.starforce - a.starforce ||
      Number(b.no === eq.preset_no) - Number(a.no === eq.preset_no),
  );
  const best = presets[0];
  return { presetNo: best.no, slots: best.slots, wearing: sameSlots(current, best.slots) };
}

function sameSlots(a: SlotState[], b: SlotState[]): boolean {
  const key = (xs: SlotState[]) =>
    JSON.stringify([...xs].sort((x, y) => x.slot.localeCompare(y.slot)).map((x) => [x.slot, x.name, x.starforce, x.potential, x.additional]));
  return key(a) === key(b);
}

export function combatPower(stat: CharacterStat): number | null {
  const raw = stat.final_stat.find((s) => s.stat_name === "전투력")?.stat_value;
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * 두 시점 사이의 장비 변화 중 "스펙업"에 해당하는 것만 뽑는다.
 * 같은 아이템의 스타포스·잠재 등급은 올라간 경우만 센다(파괴·하락은 스펙업이 아님).
 */
export function diffSlots(before: SlotState[], after: SlotState[]): UpgradeChange[] {
  const prev = new Map(before.map((s) => [s.slot, s]));
  const changes: UpgradeChange[] = [];

  for (const cur of after) {
    const old = prev.get(cur.slot);
    if (!old || old.name !== cur.name) {
      changes.push({
        slot: cur.slot,
        kind: "item",
        target: cur.name,
        from: old?.name ?? "없음",
        to: cur.name,
      });
      continue;
    }
    if (cur.starforce > old.starforce) {
      changes.push({
        slot: cur.slot,
        kind: "starforce",
        target: `${cur.starforce}성`,
        from: `${old.starforce}성`,
        to: `${cur.starforce}성`,
      });
    }
    if (gradeRank(cur.potential) > gradeRank(old.potential)) {
      changes.push({
        slot: cur.slot,
        kind: "potential",
        target: cur.potential!,
        from: old.potential ?? "없음",
        to: cur.potential!,
      });
    }
    if (gradeRank(cur.additional) > gradeRank(old.additional)) {
      changes.push({
        slot: cur.slot,
        kind: "additional",
        target: cur.additional!,
        from: old.additional ?? "없음",
        to: cur.additional!,
      });
    }
  }
  return changes;
}

/** 내 장비가 이미 해당 업그레이드 이상인지. 추천 목록에서 뺄 때 쓴다. */
export function alreadyHas(mine: SlotState[], change: Pick<UpgradeChange, "slot" | "kind" | "to">): boolean {
  const s = mine.find((m) => m.slot === change.slot);
  if (!s) return false;
  switch (change.kind) {
    case "item":
      return s.name === change.to;
    case "starforce":
      return s.starforce >= parseInt(change.to, 10);
    case "potential":
      return gradeRank(s.potential) >= gradeRank(change.to);
    case "additional":
      return gradeRank(s.additional) >= gradeRank(change.to);
  }
}
