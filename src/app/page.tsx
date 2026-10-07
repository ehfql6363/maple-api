import { redirect } from "next/navigation";

async function search(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  if (name) redirect(`/character/${encodeURIComponent(name)}`);
}

export default function Home() {
  return (
    <>
      <h1>다음 스펙업, 데이터로 정하기</h1>
      <p className="muted">
        같은 직업·비슷한 전투력 유저들이 실제로 어떤 스펙업을 했는지 모아서, 내가 다음에 할 만한 스펙업을 추천합니다.
      </p>
      <form action={search} className="inline card">
        <input name="name" placeholder="캐릭터 닉네임" required aria-label="캐릭터 닉네임" />
        <button type="submit">검색</button>
      </form>
    </>
  );
}
