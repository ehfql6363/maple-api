import { Suspense } from "react";
import { DEFAULT_BAND, getDb, lastCombatPower, peerEvents, peerSlots } from "@/lib/db";
import { NexonApiError, NexonClient } from "@/lib/nexon/client";
import { compareSlots, recommend, type Recommendation, type SlotGap } from "@/lib/roadmap";
import { combatPower, pickBossEquipment, type SlotState, type UpgradeKind } from "@/lib/snapshot";

const KIND_LABEL: Record<UpgradeKind, string> = {
  item: "장비 교체",
  starforce: "스타포스",
  potential: "잠재능력",
  additional: "에디셔널",
};

export default function CharacterPage({ params }: PageProps<"/character/[name]">) {
  return (
    <Suspense fallback={<p className="muted">캐릭터 정보를 불러오는 중…</p>}>
      <CharacterView params={params} />
    </Suspense>
  );
}

async function CharacterView({ params }: { params: PageProps<"/character/[name]">["params"] }) {
  const name = decodeURIComponent((await params).name);
  const apiKey = process.env.NEXON_API_KEY;
  if (!apiKey) return <p className="notice">서버에 NEXON_API_KEY가 설정되지 않았습니다.</p>;

  const api = new NexonClient({ apiKey });
  let data;
  try {
    const ocid = await api.getOcid(name);
    const [basic, stat, equipment] = await Promise.all([
      api.getCharacterBasic(ocid),
      api.getCharacterStat(ocid),
      api.getItemEquipment(ocid),
    ]);
    data = { ocid, basic, currentCp: combatPower(stat), boss: pickBossEquipment(equipment) };
  } catch (e) {
    const msg = e instanceof NexonApiError && e.invalidParameter ? "캐릭터를 찾을 수 없습니다." : (e as Error).message;
    return <p className="notice">{msg}</p>;
  }

  const { ocid, basic, currentCp, boss } = data;
  const slots = boss.slots;
  const sql = getDb();
  // 사냥 프리셋을 끼고 있으면 현재 전투력이 낮게 나오므로, 수집된 마지막 보스 전투력을 쓴다.
  const savedCp = !boss.wearing && sql ? await lastCombatPower(sql, ocid) : null;
  const cp = boss.wearing ? currentCp : savedCp;
  let recs: Recommendation[] = [];
  let gaps: SlotGap[] = [];
  if (sql && cp) {
    const [events, peers] = await Promise.all([
      peerEvents(sql, basic.character_class, cp),
      peerSlots(sql, basic.character_class, cp),
    ]);
    recs = recommend(events, slots);
    gaps = compareSlots(peers, slots);
  }

  return (
    <>
      <div className="card" style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={basic.character_image} alt="" width={96} height={96} />
        <div>
          <h1 style={{ margin: 0 }}>{basic.character_name}</h1>
          <div className="muted">
            {basic.world_name} · {basic.character_class} · Lv.{basic.character_level}
          </div>
          <div className="big">{cp ? `전투력 ${cp.toLocaleString("ko-KR")}` : "전투력 정보 없음"}</div>
        </div>
      </div>
      {!boss.wearing && (
        <p className="notice">
          지금 사냥용 프리셋을 착용 중이라 아래 장비는 보스용으로 판단한 {boss.presetNo}번 프리셋 기준입니다.
          {savedCp
            ? " 전투력은 수집된 마지막 보스 세팅 전투력입니다."
            : ` 현재 전투력(${currentCp?.toLocaleString("ko-KR") ?? "-"})은 사냥 세팅 기준이라 추천 계산에 쓰지 않습니다. 보스 프리셋을 착용한 뒤 다시 조회해 주세요.`}
        </p>
      )}

      <h2>다음 스텝 추천</h2>
      {!sql ? (
        <p className="notice">아직 수집 데이터베이스가 연결되지 않아 추천을 계산할 수 없습니다.</p>
      ) : !cp ? (
        <p className="notice">보스 세팅 전투력을 알 수 없어 비슷한 구간을 찾을 수 없습니다.</p>
      ) : recs.length === 0 ? (
        <p className="notice">
          같은 직업·전투력 ±{DEFAULT_BAND * 100}% 구간의 스펙업 데이터가 아직 부족합니다. 데이터가 쌓이면 표시됩니다.
        </p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>부위</th>
                <th>종류</th>
                <th>목표</th>
                <th className="num">선택한 유저</th>
                <th className="num">전투력 상승(중앙값)</th>
              </tr>
            </thead>
            <tbody>
              {recs.map((r) => (
                <tr key={`${r.slot}|${r.kind}|${r.target}`}>
                  <td>{r.slot}</td>
                  <td>{KIND_LABEL[r.kind]}</td>
                  <td>{r.target}</td>
                  <td className="num">
                    {r.users}명 ({Math.round(r.share * 100)}%)
                  </td>
                  <td className="num good">{r.medianGain === null ? "-" : `+${(r.medianGain * 100).toFixed(1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {gaps.length > 0 && (
        <>
          <h2>비슷한 구간 대비 내 장비</h2>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>부위</th>
                  <th>내 장비</th>
                  <th>구간에서 가장 많이 쓰는 장비</th>
                  <th className="num">구간 스타포스 중앙값</th>
                </tr>
              </thead>
              <tbody>
                {gaps.map((g) => (
                  <tr key={g.slot} className={g.behind ? "bad" : undefined}>
                    <td>{g.slot}</td>
                    <td>{g.mine ? `${g.mine.name} ${g.mine.starforce}성` : "없음"}</td>
                    <td>
                      {g.commonItem} ({Math.round(g.commonItemShare * 100)}%)
                    </td>
                    <td className="num">{g.medianStarforce}성</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>보스 세팅 장비{boss.presetNo ? ` (${boss.presetNo}번 프리셋)` : ""}</h2>
      <div className="grid">
        {slots.map((s) => (
          <SlotCard key={s.slot} s={s} />
        ))}
      </div>
    </>
  );
}

function SlotCard({ s }: { s: SlotState }) {
  return (
    <div className="card">
      <div className="muted">{s.slot}</div>
      <div>{s.name}</div>
      <div className="muted">
        {s.starforce > 0 && `${s.starforce}성 · `}잠재 {s.potential ?? "-"} / 에디 {s.additional ?? "-"}
      </div>
    </div>
  );
}
