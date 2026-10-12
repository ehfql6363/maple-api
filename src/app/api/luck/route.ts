import { dateRange, kstDate } from "@/lib/date";
import { summarizeCubes } from "@/lib/luck/cube";
import { fetchHistory } from "@/lib/luck/fetchHistory";
import { analyzeStarforce } from "@/lib/luck/starforce";
import { NexonApiError, NexonClient } from "@/lib/nexon/client";

const MAX_DAYS = 31;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 사용자의 API 키로 확률 이력을 조회해 운을 분석한다.
 * 이력 API는 키를 발급한 계정 기준이라 사용자 본인의 키가 필요하다.
 * 키는 이 요청 처리에만 쓰고 저장·로그하지 않는다.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { apiKey?: string; from?: string; to?: string } | null;
  const apiKey = body?.apiKey?.trim();
  const to = body?.to ?? kstDate(-1);
  const from = body?.from ?? kstDate(-7);

  if (!apiKey) return Response.json({ error: "API 키를 입력해 주세요." }, { status: 400 });
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return Response.json({ error: "기간이 올바르지 않습니다." }, { status: 400 });
  }
  if (dateRange(from, to).length > MAX_DAYS) {
    return Response.json({ error: `한 번에 최대 ${MAX_DAYS}일까지 조회할 수 있습니다.` }, { status: 400 });
  }

  try {
    const { starforce, cube } = await fetchHistory(new NexonClient({ apiKey }), from, to);
    return Response.json({
      from,
      to,
      starforce: analyzeStarforce(starforce),
      cube: summarizeCubes(cube),
    });
  } catch (e) {
    if (e instanceof NexonApiError) {
      if (e.invalidKey) return Response.json({ error: "API 키가 올바르지 않습니다." }, { status: 401 });
      if (e.rateLimited) {
        return Response.json({ error: "이 API 키의 호출 한도를 초과했습니다. 기간을 줄이거나 내일 다시 시도해 주세요." }, { status: 429 });
      }
      return Response.json({ error: e.message }, { status: 502 });
    }
    throw e;
  }
}
