import { connection } from "next/server";
import { Suspense } from "react";
import { kstDate } from "@/lib/date";
import LuckForm from "./LuckForm";

export const metadata = { title: "강화 운 분석" };

export default function LuckPage() {
  return (
    <>
      <h1>강화 운 분석</h1>
      <p className="muted">
        스타포스·큐브 사용 이력은 계정 단위로만 조회되기 때문에 본인의 넥슨 Open API 키가 필요합니다. 키는 분석에만 쓰고
        저장하지 않습니다.
      </p>
      <Suspense fallback={<p className="muted">불러오는 중…</p>}>
        <DatedLuckForm />
      </Suspense>
    </>
  );
}

/** 기본 기간이 오늘 날짜 기준이라 요청 시점에 렌더링한다. */
async function DatedLuckForm() {
  await connection();
  return <LuckForm defaultFrom={kstDate(-7)} defaultTo={kstDate(-1)} />;
}
