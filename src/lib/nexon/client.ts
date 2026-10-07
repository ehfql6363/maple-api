import type {
  CharacterBasic,
  CharacterItemEquipment,
  CharacterStat,
  CubeHistoryResponse,
  OverallRankingResponse,
  StarforceHistoryResponse,
} from "./types";

const BASE_URL = "https://open.api.nexon.com/maplestory/v1";

export class NexonApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
    this.name = "NexonApiError";
  }
}

type Query = Record<string, string | number | undefined>;

export interface NexonClientOptions {
  apiKey: string;
  /** 연속 호출 사이 최소 간격(ms). 키의 초당 호출 제한에 맞춰 조정한다. */
  minIntervalMs?: number;
  maxRetries?: number;
}

export class NexonClient {
  private readonly apiKey: string;
  private readonly minIntervalMs: number;
  private readonly maxRetries: number;
  private lastCallAt = 0;

  constructor({ apiKey, minIntervalMs = 0, maxRetries = 3 }: NexonClientOptions) {
    if (!apiKey) throw new Error("넥슨 API 키가 필요합니다.");
    this.apiKey = apiKey;
    this.minIntervalMs = minIntervalMs;
    this.maxRetries = maxRetries;
  }

  async get<T>(path: string, query: Query = {}): Promise<T> {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }

    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      const res = await fetch(url, {
        headers: { "x-nxopen-api-key": this.apiKey },
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as T;

      const body = (await res.json().catch(() => null)) as
        | { error?: { name?: string; message?: string } }
        | null;
      const retryable = res.status === 429 || res.status >= 500;
      if (retryable && attempt < this.maxRetries) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      throw new NexonApiError(
        res.status,
        body?.error?.name,
        body?.error?.message ?? `넥슨 API 오류 (HTTP ${res.status})`,
      );
    }
  }

  private async throttle() {
    const wait = this.lastCallAt + this.minIntervalMs - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCallAt = Date.now();
  }

  async getOcid(characterName: string): Promise<string> {
    const { ocid } = await this.get<{ ocid: string }>("/id", {
      character_name: characterName,
    });
    return ocid;
  }

  getCharacterBasic(ocid: string, date?: string) {
    return this.get<CharacterBasic>("/character/basic", { ocid, date });
  }

  getCharacterStat(ocid: string, date?: string) {
    return this.get<CharacterStat>("/character/stat", { ocid, date });
  }

  getItemEquipment(ocid: string, date?: string) {
    return this.get<CharacterItemEquipment>("/character/item-equipment", { ocid, date });
  }

  getOverallRanking(date: string, opts: { page?: number; worldName?: string; characterClass?: string } = {}) {
    return this.get<OverallRankingResponse>("/ranking/overall", {
      date,
      page: opts.page,
      world_name: opts.worldName,
      class: opts.characterClass,
    });
  }

  /** 확률 이력 API는 캐릭터가 아니라 API 키를 발급한 계정 기준으로 조회된다. */
  getStarforceHistory(count: number, by: { date: string } | { cursor: string }) {
    return this.get<StarforceHistoryResponse>("/history/starforce", { count, ...by });
  }

  getCubeHistory(count: number, by: { date: string } | { cursor: string }) {
    return this.get<CubeHistoryResponse>("/history/cube", { count, ...by });
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
