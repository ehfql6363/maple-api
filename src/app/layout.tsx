import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "메이플 스펙업 로드맵",
  description: "비슷한 스펙 유저들의 실제 스펙업 데이터로 다음 스텝을 추천하고, 스타포스·큐브 운을 분석합니다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <header className="site-header">
          <Link href="/" className="brand">
            스펙업 로드맵
          </Link>
          <nav>
            <Link href="/">캐릭터 검색</Link>
            <Link href="/luck">강화 운 분석</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
