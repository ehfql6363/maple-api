"use client";

import { useState } from "react";
import type { CubeSummary } from "@/lib/luck/cube";
import type { LuckSummary } from "@/lib/luck/starforce";

interface Result {
  from: string;
  to: string;
  starforce: LuckSummary;
  cube: CubeSummary[];
}

export default function LuckForm({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/luck", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: form.get("apiKey"), from: form.get("from"), to: form.get("to") }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "분석에 실패했습니다.");
      setResult(data);
    } catch (err) {
      setResult(null);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="inline card">
        <input name="apiKey" type="password" placeholder="넥슨 Open API 키" required autoComplete="off" aria-label="넥슨 Open API 키" />
        <input name="from" type="date" defaultValue={defaultFrom} required aria-label="시작일" style={{ flex: "0 1 160px" }} />
        <input name="to" type="date" defaultValue={defaultTo} required aria-label="종료일" style={{ flex: "0 1 160px" }} />
        <button type="submit" disabled={loading}>
          {loading ? "분석 중…" : "분석"}
        </button>
      </form>
      {error && <p className="notice bad">{error}</p>}
      {result && <LuckResult r={result} />}
    </>
  );
}

function topPercent(p: number | null) {
  if (p === null) return "-";
  const top = (1 - p) * 100;
  return `상위 ${top < 1 ? top.toFixed(1) : Math.round(top)}%`;
}

function LuckResult({ r }: { r: Result }) {
  const s = r.starforce;
  return (
    <>
      <h2>
        스타포스 <span className="muted">({r.from} ~ {r.to})</span>
      </h2>
      {s.attempts === 0 ? (
        <p className="notice">분석할 강화 기록이 없습니다.</p>
      ) : (
        <>
          <div className="grid">
            <div className="card">
              <div className="muted">성공 운</div>
              <div className="big">{topPercent(s.successPercentile)}</div>
              <div className="muted">
                성공 {s.successes}회 / 기대 {s.expectedSuccesses.toFixed(1)}회
              </div>
            </div>
            <div className="card">
              <div className="muted">파괴 운</div>
              <div className="big">{topPercent(s.destroyPercentile)}</div>
              <div className="muted">
                파괴 {s.destroys}회 / 기대 {s.expectedDestroys.toFixed(1)}회
              </div>
            </div>
            <div className="card">
              <div className="muted">분석한 시도</div>
              <div className="big">{s.attempts.toLocaleString("ko-KR")}회</div>
              <div className="muted">제외 {s.excluded}회 (찬스타임·이벤트·슈페리얼 등)</div>
            </div>
          </div>
          <div className="table-wrap card" style={{ marginTop: 12 }}>
            <table>
              <thead>
                <tr>
                  <th>성급</th>
                  <th className="num">시도</th>
                  <th className="num">성공</th>
                  <th className="num">기대 성공</th>
                </tr>
              </thead>
              <tbody>
                {s.byStar.map((b) => (
                  <tr key={b.star}>
                    <td>
                      {b.star}→{b.star + 1}성
                    </td>
                    <td className="num">{b.attempts}</td>
                    <td className={`num ${b.successes >= b.expected ? "good" : "bad"}`}>{b.successes}</td>
                    <td className="num">{b.expected.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h2>큐브</h2>
      {r.cube.length === 0 ? (
        <p className="notice">큐브 사용 기록이 없습니다.</p>
      ) : (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>큐브</th>
                <th className="num">사용</th>
                <th className="num">등급 상승</th>
                <th className="num">그중 천장</th>
              </tr>
            </thead>
            <tbody>
              {r.cube.map((c) => (
                <tr key={c.cubeType}>
                  <td>{c.cubeType}</td>
                  <td className="num">{c.uses.toLocaleString("ko-KR")}</td>
                  <td className="num">{c.tierUps}</td>
                  <td className="num">{c.guaranteed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
