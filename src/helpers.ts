import type {
  Boss,
  Guide,
  HiddenItem,
  Missable,
  Progress,
  Region,
  Tale,
  Trophy,
  TrueEndingQuest,
} from "../shared/types";

export const TROPHY_TYPE_CN: Record<string, string> = {
  Platinum: "白金",
  Gold: "金",
  Silver: "银",
  Bronze: "铜",
  platinum: "白金",
  gold: "金",
  silver: "银",
  bronze: "铜",
};

export const TROPHY_TYPE_CHAR: Record<string, string> = {
  Platinum: "白",
  Gold: "金",
  Silver: "银",
  Bronze: "铜",
  platinum: "白",
  gold: "金",
  silver: "银",
  bronze: "铜",
};

const CATEGORY_CN: Record<string, string> = {
  Bells: "铃铛",
  "Required Phantom Edge": "必需影之武装",
  "Challenge Locations": "挑战",
  "Hidden Locations": "隐藏区域",
  "locked area": "未解锁区域",
  "Chapter Transitions": "章节过渡",
  shortcut: "捷径",
  Weapons: "武器",
  "Phantom Edges": "影之武装",
  Accessories: "饰品",
  Medicine: "秘药",
  "Medicine Items": "秘药",
  "Blackstone Fragment": "黑石碎片",
  "Sha-Chi Amber Fragment": "杀气琥珀碎片",
  "Memory Flower": "记忆之花",
  Key: "钥匙",
  "Story Items": "剧情道具",
  Treasures: "宝物",
  Books: "书籍",
  Consumables: "消耗品",
  "Remnant Dust": "意识尘埃",
  "Main Weapon Upgrade Materials": "主武器升级材料",
  "Phantom Edge Upgrade Materials": "影之武装升级材料",
  "Accessory Materials": "饰品材料",
  "Medicine Materials": "秘药材料",
  "story NPCs": "剧情角色",
  "Service NPCs": "服务角色",
  "Main Quests": "主线任务",
  "Wulin Tales": "武林异闻",
  "Collectible Quests": "收集任务",
  Bosses: "首领",
  "Developer Messages": "开发信息",
  Notes: "笔记",
  "Guide Notes": "指引",
  "Side Quests": "支线任务",
  "Side Stories": "支线故事",
  "locked one-way gate": "单向门",
};

export function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function localImageSrc(path?: string): string {
  if (!path) return "";
  return path.startsWith("/assets/") ? `/map${path}` : path;
}

const TEXT_REPLACEMENTS: [RegExp, string][] = [
  [/\bBOSS\b/gi, "首领"],
  [/\bBoss\b/g, "首领"],
  [/\bNPC\b/gi, "角色"],
  [/\bBuff\b/gi, "增益"],
  [/\bDebuff\b/gi, "减益"],
  [/\bDPS\b/gi, "输出"],
  [/\bAOE\b/gi, "范围伤害"],
  [/\bCD\b/g, "冷却"],
  [/\bHP\b/g, "生命"],
  [/\bMP\b/g, "杀气"],
];

export function zhText(value?: string | null): string {
  let text = String(value ?? "");
  for (const [pattern, replacement] of TEXT_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

export function categoryCn(name?: string | null): string {
  return CATEGORY_CN[String(name ?? "")] || "其他点位";
}

export function mapNormEn(value?: string | null): string {
  return String(value ?? "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/^(bell|weapon|accessory|tale|boss|treasure|medicine|memory flower)\s*/i, " ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function psnTrophyFor(
  guide: Guide,
  progress: Progress,
  trophy: Trophy
): { earned: boolean } | null {
  if (!progress.psn) return null;
  const map = new Map<string, { earned: boolean }>();
  for (const item of progress.psn.trophies || []) {
    map.set(norm(item.name), item);
  }
  return (
    map.get(norm(trophy.nameEn)) ||
    map.get(norm(trophy.nameCn)) ||
    map.get(norm(trophy.name)) ||
    null
  );
}

export function trophyEarned(guide: Guide, progress: Progress, trophy?: Trophy | null): boolean {
  if (!trophy) return false;
  const psn = psnTrophyFor(guide, progress, trophy);
  if (psn) return Boolean(psn.earned);
  return Boolean(progress.trophiesManual[trophy.id]);
}

export function trophyById(guide: Guide, id?: string | null): Trophy | undefined {
  if (!id) return undefined;
  return guide.trophies.find((trophy) => trophy.id === id);
}

function bossDoneDirect(guide: Guide, progress: Progress, boss: Boss): boolean {
  if (progress.bosses[boss.id]) return true;
  if (boss.trophy && trophyEarned(guide, progress, trophyById(guide, boss.trophy))) {
    return true;
  }
  return false;
}

export function bossDone(guide: Guide, progress: Progress, boss: Boss): boolean {
  if (bossDoneDirect(guide, progress, boss)) return true;
  if (!boss.required) return false;
  return guide.bosses.some(
    (other) =>
      other.required &&
      other.order > boss.order &&
      bossDoneDirect(guide, progress, other)
  );
}

export function bossTrophy(guide: Guide, boss: Boss): Trophy | undefined {
  return trophyById(guide, boss.trophy);
}

export function nextRequiredBoss(guide: Guide, progress: Progress): Boss | null {
  const bosses = guide.bosses
    .filter((boss) => boss.required)
    .sort((a, b) => a.order - b.order);
  return bosses.find((boss) => !bossDone(guide, progress, boss)) || null;
}

export function regionById(guide: Guide, id: string): Region {
  return guide.regions.find((region) => region.id === id) || guide.regions[0];
}

export function currentRegion(guide: Guide, progress: Progress): Region {
  const boss = nextRequiredBoss(guide, progress);
  return regionById(guide, boss ? boss.region : "soulrend");
}

export function taleById(guide: Guide, id: string): Tale | undefined {
  return guide.tales.find((tale) => tale.id === id);
}

function questTrophyId(guide: Guide, name: string): string | undefined {
  const target = norm(name);
  for (const [trophyId, names] of Object.entries(guide.trophyQuests || {})) {
    if (names.some((item) => norm(item) === target)) return trophyId;
  }
  return undefined;
}

export function questDoneByName(guide: Guide, progress: Progress, name: string): boolean {
  const tale = guide.tales.find((item) => norm(item.name) === norm(name));
  if (tale) {
    if (progress.tales[tale.id]) return true;
    const trophyId = questTrophyId(guide, tale.name);
    if (trophyId && trophyEarned(guide, progress, trophyById(guide, trophyId))) {
      return true;
    }
  }
  const directTrophy = questTrophyId(guide, name);
  return Boolean(directTrophy && trophyEarned(guide, progress, trophyById(guide, directTrophy)));
}

export function taleDone(guide: Guide, progress: Progress, tale: Tale): boolean {
  if (progress.tales[tale.id]) return true;
  const trophyId = questTrophyId(guide, tale.name);
  return Boolean(trophyId && trophyEarned(guide, progress, trophyById(guide, trophyId)));
}

export function trueEndingDone(
  guide: Guide,
  progress: Progress,
  quest: TrueEndingQuest
): boolean {
  if (progress.trueEnding[quest.id]) return true;
  if (quest.taleName && questDoneByName(guide, progress, quest.taleName)) return true;
  return trophyEarned(guide, progress, trophyById(guide, "with_heart_and_blood"));
}

function hiddenForEntry(guide: Guide, entryId: string): HiddenItem | undefined {
  return (guide.hiddenItems || []).find((item) => item.entryId === entryId);
}

export function entryDone(guide: Guide, progress: Progress, entryId: string): boolean {
  if (progress.items[entryId]) return true;
  const hidden = hiddenForEntry(guide, entryId);
  return Boolean(hidden && progress.hiddens[hidden.id]);
}

export function hiddenDone(guide: Guide, progress: Progress, item: HiddenItem): boolean {
  if (progress.hiddens[item.id]) return true;
  return Boolean(item.entryId && progress.items[item.entryId]);
}

export function deadlinePassed(
  guide: Guide,
  progress: Progress,
  deadlineKey: string
): boolean {
  const deadline = guide.deadlines?.[deadlineKey];
  if (!deadline) return false;
  const boss = guide.bosses.find((item) => item.id === deadline.boss);
  if (boss && bossDone(guide, progress, boss)) return true;
  const fallback = deadline.fallbackBoss
    ? guide.bosses.find((item) => item.id === deadline.fallbackBoss)
    : undefined;
  return Boolean(fallback && bossDone(guide, progress, fallback));
}

export function missableDone(guide: Guide, progress: Progress, rule: Missable): boolean {
  if (progress.hiddens[rule.id]) return true;
  if (rule.hidden && progress.hiddens[rule.hidden]) return true;
  if (rule.trophy && trophyEarned(guide, progress, trophyById(guide, rule.trophy))) {
    return true;
  }
  if (rule.entry && progress.items[rule.entry]) return true;
  if (rule.quest && questDoneByName(guide, progress, rule.quest)) return true;
  if (rule.id === "true_ending_quests") {
    return guide.trueEnding.quests.every((quest) =>
      trueEndingDone(guide, progress, quest)
    );
  }
  return false;
}

export type MissableStatus = "done" | "missed" | "open";

export function missableStatus(
  guide: Guide,
  progress: Progress,
  rule: Missable
): MissableStatus {
  if (missableDone(guide, progress, rule)) return "done";
  if (deadlinePassed(guide, progress, rule.deadline)) return "missed";
  return "open";
}

export function regionProgress(guide: Guide, progress: Progress, region: Region) {
  const items = region.items.filter((item) => guide.progressTypes.includes(item.type));
  const done = items.filter((item) => entryDone(guide, progress, item.id)).length;
  return { done, total: items.length, ratio: items.length ? done / items.length : 0 };
}

export function coreStats(guide: Guide, progress: Progress) {
  let total = 0;
  let done = 0;
  for (const region of guide.regions) {
    for (const item of region.items) {
      if (!guide.progressTypes.includes(item.type)) continue;
      total += 1;
      if (entryDone(guide, progress, item.id)) done += 1;
    }
  }
  return { done, total, ratio: total ? done / total : 0 };
}

export function taleStats(guide: Guide, progress: Progress) {
  const done = guide.tales.filter((tale) => taleDone(guide, progress, tale)).length;
  return { done, total: guide.tales.length, ratio: guide.tales.length ? done / guide.tales.length : 0 };
}

export function endingStats(guide: Guide, progress: Progress) {
  const done = guide.trueEnding.quests.filter((quest) =>
    trueEndingDone(guide, progress, quest)
  ).length;
  return {
    done,
    total: guide.trueEnding.quests.length,
    ratio: guide.trueEnding.quests.length ? done / guide.trueEnding.quests.length : 0,
  };
}

export function earnedTrophyCount(guide: Guide, progress: Progress): number {
  if (progress.psn && Number.isFinite(progress.psn.earnedCount)) {
    return progress.psn.earnedCount;
  }
  return guide.trophies.filter((trophy) => trophyEarned(guide, progress, trophy)).length;
}

export function trophyTotal(guide: Guide, progress: Progress): number {
  if (progress.psn && Number.isFinite(progress.psn.totalCount)) {
    return progress.psn.totalCount;
  }
  return guide.trophies.length;
}

export function matchedPsnCount(guide: Guide, progress: Progress): number {
  if (!progress.psn) return 0;
  const names = new Set((progress.psn.trophies || []).map((item) => norm(item.name)));
  return guide.trophies.filter(
    (trophy) => names.has(norm(trophy.nameEn)) || names.has(norm(trophy.nameCn))
  ).length;
}

export function typeLabel(guide: Guide, type: string): string {
  return guide.typeLabels?.[type] || type;
}

export function sortBosses(bosses: Boss[]): Boss[] {
  return [...bosses].sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1;
    return a.order - b.order;
  });
}
