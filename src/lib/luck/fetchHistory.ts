import { dateRange } from "../date";
import type { NexonClient } from "../nexon/client";
import type { CubeHistory, StarforceHistory } from "../nexon/types";

const PAGE_SIZE = 1000;

/** 기간 내 모든 날짜의 스타포스·큐브 이력을 커서를 따라가며 모은다. */
export async function fetchHistory(client: NexonClient, from: string, to: string) {
  const starforce: StarforceHistory[] = [];
  const cube: CubeHistory[] = [];

  for (const date of dateRange(from, to)) {
    let res = await client.getStarforceHistory(PAGE_SIZE, { date });
    starforce.push(...res.starforce_history);
    while (res.next_cursor) {
      res = await client.getStarforceHistory(PAGE_SIZE, { cursor: res.next_cursor });
      starforce.push(...res.starforce_history);
    }

    let cres = await client.getCubeHistory(PAGE_SIZE, { date });
    cube.push(...cres.cube_history);
    while (cres.next_cursor) {
      cres = await client.getCubeHistory(PAGE_SIZE, { cursor: cres.next_cursor });
      cube.push(...cres.cube_history);
    }
  }
  return { starforce, cube };
}
