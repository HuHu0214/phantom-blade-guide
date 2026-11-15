import {
  exchangeNpssoForAccessCode,
  exchangeAccessCodeForAuthTokens,
  getUserTitles,
  getTitleTrophies,
  getUserTrophiesEarnedForTitle,
} from "psn-api";

const LANGUAGE = "en-US";

export interface PsnTrophy {
  trophyId: number;
  name: string;
  detail: string;
  type: string;
  hidden: boolean;
  earned: boolean;
  earnedDateTime: string | null;
  rarity: unknown;
  earnedRate: unknown;
}

export interface PsnSyncResult {
  titleName: string;
  npCommunicationId: string;
  npServiceName: string;
  platform: string;
  progress: number;
  definedTrophies: unknown;
  earnedTrophies: unknown;
  earnedCount: number;
  totalCount: number;
  trophies: PsnTrophy[];
}

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function friendlyAuthError(error: unknown): Error {
  const message = String(error instanceof Error ? error.message : error);
  if (/401|unauthorized|invalid|expired|npsso/i.test(message)) {
    return new Error(
      "授权码无效或已过期。请重新登录 playstation.com，再打开 ca.account.sony.com/api/v1/ssocookie 复制新的授权码。"
    );
  }
  return new Error(`连接 PSN 失败：${message}`);
}

async function getAllTitles(authorization: { accessToken: string }): Promise<any[]> {
  const all: any[] = [];
  const limit = 100;
  let offset = 0;
  for (let page = 0; page < 20; page += 1) {
    const response: any = await getUserTitles(authorization, "me", {
      limit,
      offset,
      headerOverrides: { "Accept-Language": LANGUAGE },
    });
    const titles = Array.isArray(response.trophyTitles) ? response.trophyTitles : [];
    all.push(...titles);
    const total = Number(response.totalItemCount || all.length);
    offset += titles.length;
    if (!titles.length || offset >= total) break;
  }
  return all;
}

function pickTitle(titles: any[]): any | null {
  const isTarget = (title: any) => {
    const name = normalize(title.trophyTitleName);
    return name.includes("phantombladezero") || name.includes("phantomblade") || name.includes("影之刃");
  };
  const matches = titles.filter(isTarget);
  if (!matches.length) return null;
  matches.sort((a, b) => {
    const count = (title: any) =>
      Number(title.definedTrophies?.bronze || 0) +
      Number(title.definedTrophies?.silver || 0) +
      Number(title.definedTrophies?.gold || 0) +
      Number(title.definedTrophies?.platinum || 0);
    const isZero = (title: any) => (/zero|零/.test(normalize(title.trophyTitleName)) ? 1 : 0);
    return (
      isZero(b) - isZero(a) ||
      count(b) - count(a) ||
      Number(b.progress || 0) - Number(a.progress || 0)
    );
  });
  return matches[0];
}

function mergeTrophies(definitions: any, earned: any): PsnTrophy[] {
  const earnedById = new Map<number, any>();
  for (const item of earned.trophies || []) {
    earnedById.set(item.trophyId, item);
  }
  return (definitions.trophies || []).map((trophy: any) => {
    const earnedItem = earnedById.get(trophy.trophyId);
    const isEarned =
      Boolean(earnedItem) &&
      (earnedItem.earned === true || earnedItem.trophyEarned === true);
    return {
      trophyId: trophy.trophyId,
      name: trophy.trophyName || `Trophy ${trophy.trophyId}`,
      detail: trophy.trophyDetail || "",
      type: trophy.trophyType || "",
      hidden: Boolean(trophy.trophyHidden),
      earned: isEarned,
      earnedDateTime: earnedItem?.earnedDateTime || earnedItem?.trophyEarnedDateTime || null,
      rarity: trophy.trophyRare ?? null,
      earnedRate: trophy.trophyEarnedRate ?? null,
    };
  });
}

export async function syncTrophies(npsso: string): Promise<PsnSyncResult> {
  if (!npsso || npsso.trim().length < 10) {
    throw new Error("还没有保存授权码。请先在设置页粘贴授权码。");
  }
  try {
    const accessCode = await exchangeNpssoForAccessCode(npsso.trim());
    const auth = await exchangeAccessCodeForAuthTokens(accessCode);
    const authorization = { accessToken: auth.accessToken };

    const titles = await getAllTitles(authorization);
    const title = pickTitle(titles);
    if (!title) {
      throw new Error(
        "这个 PSN 账号的奖杯列表里没有找到《影之刃零》。请先在 PS5 上打开该游戏的奖杯列表并同步到 PSN，再回来重试。"
      );
    }

    const npServiceName = title.npServiceName || "trophy2";
    const options = {
      npServiceName,
      headerOverrides: { "Accept-Language": LANGUAGE },
    } as const;
    const [definitions, earned]: [any, any] = await Promise.all([
      getTitleTrophies(authorization, title.npCommunicationId, "all", options as any),
      getUserTrophiesEarnedForTitle(
        authorization,
        "me",
        title.npCommunicationId,
        "all",
        options as any
      ),
    ]);

    const trophies = mergeTrophies(definitions, earned);
    const earnedCount = trophies.filter((trophy) => trophy.earned).length;

    return {
      titleName: title.trophyTitleName,
      npCommunicationId: title.npCommunicationId,
      npServiceName,
      platform: title.trophyTitlePlatform || "PS5",
      progress: Number(title.progress || 0),
      definedTrophies: title.definedTrophies || null,
      earnedTrophies: title.earnedTrophies || null,
      earnedCount,
      totalCount: trophies.length,
      trophies,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      /授权码无效|没有找到|连接 PSN 失败/.test(error.message)
    ) {
      throw error;
    }
    throw friendlyAuthError(error);
  }
}
