import { alreadyHas, type SlotState, type UpgradeKind } from "./snapshot";

/** DB에 쌓인 업그레이드 이벤트 한 건. */
export interface UpgradeEvent {
  ocid: string;
  slot: string;
  kind: UpgradeKind;
  target: string;
  to: string;
  cpBefore: number;
  cpAfter: number;
}

export interface Recommendation {
  slot: string;
  kind: UpgradeKind;
  target: string;
  /** 이 업그레이드를 한 비슷한 구간 유저 수 */
  users: number;
  /** 비슷한 구간에서 다음 스펙업으로 이걸 고른 비율 (0~1) */
  share: number;
  /** 업그레이드 전후 스냅샷 사이 전투력 상승률 중앙값 (0.05 = +5%) */
  medianGain: number;
}

/**
 * 비슷한 구간 유저들이 실제로 한 스펙업을 묶어 많이 한 순으로 정렬한다.
 * 내가 이미 갖춘 업그레이드는 뺀다.
 */
export function recommend(peerEvents: UpgradeEvent[], mine: SlotState[], limit = 5): Recommendation[] {
  const totalUsers = new Set(peerEvents.map((e) => e.ocid)).size;
  if (totalUsers === 0) return [];

  const groups = new Map<string, { e: UpgradeEvent; users: Set<string>; gains: number[] }>();
  for (const e of peerEvents) {
    if (alreadyHas(mine, e)) continue;
    const key = `${e.slot}|${e.kind}|${e.target}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { e, users: new Set(), gains: [] }));
    g.users.add(e.ocid);
    if (e.cpBefore > 0) g.gains.push((e.cpAfter - e.cpBefore) / e.cpBefore);
  }

  return [...groups.values()]
    .map(({ e, users, gains }) => ({
      slot: e.slot,
      kind: e.kind,
      target: e.target,
      users: users.size,
      share: users.size / totalUsers,
      medianGain: median(gains),
    }))
    .sort((a, b) => b.users - a.users || b.medianGain - a.medianGain)
    .slice(0, limit);
}

export interface SlotGap {
  slot: string;
  mine: SlotState | null;
  /** 같은 구간 유저 중 이 부위에 가장 많이 낀 아이템 */
  commonItem: string;
  commonItemShare: number;
  medianStarforce: number;
  /** 내 스타포스가 구간 중앙값보다 낮거나 더 흔한 아이템이 있으면 true */
  behind: boolean;
}

/** 비슷한 구간 유저들의 현재 장비와 내 장비를 부위별로 비교한다. */
export function compareSlots(peers: SlotState[][], mine: SlotState[]): SlotGap[] {
  const bySlot = new Map<string, SlotState[]>();
  for (const slots of peers) {
    for (const s of slots) {
      let list = bySlot.get(s.slot);
      if (!list) bySlot.set(s.slot, (list = []));
      list.push(s);
    }
  }

  return [...bySlot.entries()].map(([slot, list]) => {
    const counts = new Map<string, number>();
    for (const s of list) counts.set(s.name, (counts.get(s.name) ?? 0) + 1);
    const [commonItem, n] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const medianStarforce = median(list.map((s) => s.starforce));
    const my = mine.find((m) => m.slot === slot) ?? null;
    const commonItemShare = n / list.length;
    return {
      slot,
      mine: my,
      commonItem,
      commonItemShare,
      medianStarforce,
      behind: !my || my.starforce < medianStarforce || (my.name !== commonItem && commonItemShare >= 0.5),
    };
  });
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
