import fs from "node:fs";
import path from "node:path";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, streamText } from "ai";
import type {
  AssistantAction,
  AssistantGuideTarget,
  AssistantMessage,
  AssistantNextResponse,
  AssistantStatus,
  Boss,
  Guide,
  HiddenItem,
  Missable,
  Progress,
  Region,
  Tale,
  Trophy,
  TrueEndingQuest,
} from "../shared/types.js";
import { deleteSecret, loadSecret, saveSecret } from "./secrets.js";

const ROOT = process.env.PBZ_ROOT || process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const DPAPI_SCRIPT = path.join(ROOT, "lib", "dpapi.ps1");
const CONFIG_FILE = path.join(DATA_DIR, "assistant.json");
const KEY_FILE = path.join(DATA_DIR, "assistant-key.enc");

interface AssistantConfig {
  provider: "deepseek";
  model: string;
}

const MODELS = ["deepseek-chat", "deepseek-reasoner"];

function defaultConfig(): AssistantConfig {
  return { provider: "deepseek", model: "deepseek-chat" };
}

function loadConfig(): AssistantConfig {
  try {
    const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8")) as AssistantConfig;
    return {
      provider: "deepseek",
      model: MODELS.includes(parsed.model) ? parsed.model : "deepseek-chat",
    };
  } catch {
    return defaultConfig();
  }
}

function saveConfig(config: AssistantConfig): void {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 1), "utf8");
}

function loadKey(): string | null {
  return loadSecret(DATA_DIR, DPAPI_SCRIPT, KEY_FILE);
}

export function getAssistantKey(): string | null {
  return loadKey();
}

export function getAssistantStatus(): AssistantStatus {
  const config = loadConfig();
  return {
    configured: fs.existsSync(KEY_FILE),
    provider: "deepseek",
    model: config.model,
  };
}

export function saveAssistantConfig(input: {
  apiKey?: string;
  model?: string;
}): AssistantStatus {
  const config = loadConfig();
  if (input.model && MODELS.includes(input.model)) {
    config.model = input.model;
    saveConfig(config);
  }
  if (input.apiKey != null && input.apiKey.trim()) {
    const key = input.apiKey.trim();
    if (key.length < 10) throw new Error("API Key 格式不对。");
    saveSecret(DATA_DIR, DPAPI_SCRIPT, KEY_FILE, key);
  }
  return getAssistantStatus();
}

export function clearAssistantKey(): AssistantStatus {
  deleteSecret(KEY_FILE);
  return getAssistantStatus();
}

function createModel(apiKey: string, modelId: string) {
  const baseURL = process.env.DEEPSEEK_BASE_URL?.trim();
  const provider = createDeepSeek({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });
  return provider((MODELS.includes(modelId) ? modelId : "deepseek-chat") as any);
}

function timeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

/* ------------------------------------------------------------------ */
/* local game logic (read-only; no writes)                             */
/* ------------------------------------------------------------------ */

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]+/gu, "");
}

function zhText(value?: string | null): string {
  return String(value ?? "")
    .replace(/\bBOSS\b/gi, "首领")
    .replace(/\bBoss\b/g, "首领")
    .replace(/\bNPC\b/gi, "角色")
    .replace(/\bDebuff\b/gi, "减益")
    .replace(/\bBuff\b/gi, "增益")
    .replace(/\bHP\b/g, "生命");
}

function earnedSet(progress: Progress): Set<string> {
  const set = new Set<string>();
  for (const trophy of progress.psn?.trophies || []) {
    if (trophy.earned) set.add(norm(trophy.name));
  }
  return set;
}

function trophyEarned(
  trophy: Trophy | undefined,
  progress: Progress,
  earned: Set<string>
): boolean {
  if (!trophy) return false;
  if (progress.trophiesManual[trophy.id]) return true;
  return (
    earned.has(norm(trophy.nameEn)) ||
    earned.has(norm(trophy.nameCn)) ||
    earned.has(norm(trophy.name))
  );
}

function trophyById(guide: Guide, id?: string | null): Trophy | undefined {
  if (!id) return undefined;
  return guide.trophies.find((trophy) => trophy.id === id);
}

function bossDoneDirect(
  guide: Guide,
  progress: Progress,
  boss: Boss,
  earned: Set<string>
): boolean {
  if (progress.bosses[boss.id]) return true;
  return trophyEarned(trophyById(guide, boss.trophy), progress, earned);
}

function bossDone(
  guide: Guide,
  progress: Progress,
  boss: Boss,
  earned: Set<string>
): boolean {
  if (bossDoneDirect(guide, progress, boss, earned)) return true;
  if (!boss.required) return false;
  return guide.bosses.some(
    (other) =>
      other.required &&
      other.order > boss.order &&
      bossDoneDirect(guide, progress, other, earned)
  );
}

function nextRequiredBoss(
  guide: Guide,
  progress: Progress,
  earned: Set<string>
): Boss | null {
  return (
    guide.bosses
      .filter((boss) => boss.required)
      .sort((a, b) => a.order - b.order)
      .find((boss) => !bossDone(guide, progress, boss, earned)) || null
  );
}

function regionById(guide: Guide, id: string): Region {
  return guide.regions.find((region) => region.id === id) || guide.regions[0];
}

function currentRegion(
  guide: Guide,
  progress: Progress,
  earned: Set<string>
): Region {
  const boss = nextRequiredBoss(guide, progress, earned);
  return regionById(guide, boss ? boss.region : "soulrend");
}

function questTrophyId(guide: Guide, name: string): string | undefined {
  const target = norm(name);
  for (const [trophyId, names] of Object.entries(guide.trophyQuests || {})) {
    if (names.some((item) => norm(item) === target)) return trophyId;
  }
  return undefined;
}

function questDoneByName(
  guide: Guide,
  progress: Progress,
  name: string,
  earned: Set<string>
): boolean {
  const tale = guide.tales.find((item) => norm(item.name) === norm(name));
  if (tale) {
    if (progress.tales[tale.id]) return true;
    const trophyId = questTrophyId(guide, tale.name);
    if (trophyEarned(trophyById(guide, trophyId), progress, earned)) return true;
  }
  const direct = questTrophyId(guide, name);
  return Boolean(trophyEarned(trophyById(guide, direct), progress, earned));
}

function taleDone(
  guide: Guide,
  progress: Progress,
  tale: Tale,
  earned: Set<string>
): boolean {
  if (progress.tales[tale.id]) return true;
  const trophyId = questTrophyId(guide, tale.name);
  return trophyEarned(trophyById(guide, trophyId), progress, earned);
}

function trueEndingDone(
  guide: Guide,
  progress: Progress,
  quest: TrueEndingQuest,
  earned: Set<string>
): boolean {
  if (progress.trueEnding[quest.id]) return true;
  if (quest.taleName && questDoneByName(guide, progress, quest.taleName, earned)) {
    return true;
  }
  return trophyEarned(trophyById(guide, "with_heart_and_blood"), progress, earned);
}

function hiddenForEntry(guide: Guide, entryId: string): HiddenItem | undefined {
  return (guide.hiddenItems || []).find((item) => item.entryId === entryId);
}

function entryDone(
  guide: Guide,
  progress: Progress,
  entryId: string
): boolean {
  if (progress.items[entryId]) return true;
  const hidden = hiddenForEntry(guide, entryId);
  return Boolean(hidden && progress.hiddens[hidden.id]);
}

function missableDone(
  guide: Guide,
  progress: Progress,
  rule: Missable,
  earned: Set<string>
): boolean {
  if (progress.hiddens[rule.id]) return true;
  if (rule.hidden && progress.hiddens[rule.hidden]) return true;
  if (rule.entry && progress.items[rule.entry]) return true;
  if (trophyEarned(trophyById(guide, rule.trophy), progress, earned)) return true;
  if (rule.quest && questDoneByName(guide, progress, rule.quest, earned)) return true;
  if (rule.id === "true_ending_quests") {
    return guide.trueEnding.quests.every((quest) =>
      trueEndingDone(guide, progress, quest, earned)
    );
  }
  return false;
}

function deadlinePassed(
  guide: Guide,
  progress: Progress,
  rule: Missable,
  earned: Set<string>
): boolean {
  const deadline = guide.deadlines?.[rule.deadline];
  if (!deadline) return false;
  const boss = guide.bosses.find((item) => item.id === deadline.boss);
  if (boss && bossDone(guide, progress, boss, earned)) return true;
  const fallback = deadline.fallbackBoss
    ? guide.bosses.find((item) => item.id === deadline.fallbackBoss)
    : undefined;
  return Boolean(fallback && bossDone(guide, progress, fallback, earned));
}

type MissableStatus = "done" | "missed" | "open";

function missableStatus(
  guide: Guide,
  progress: Progress,
  rule: Missable,
  earned: Set<string>
): MissableStatus {
  if (missableDone(guide, progress, rule, earned)) return "done";
  if (deadlinePassed(guide, progress, rule, earned)) return "missed";
  return "open";
}

function coreStats(guide: Guide, progress: Progress) {
  let done = 0;
  let total = 0;
  for (const region of guide.regions) {
    for (const item of region.items) {
      if (!guide.progressTypes.includes(item.type)) continue;
      total += 1;
      if (entryDone(guide, progress, item.id)) done += 1;
    }
  }
  return { done, total };
}

function taleStats(guide: Guide, progress: Progress, earned: Set<string>) {
  const done = guide.tales.filter((tale) =>
    taleDone(guide, progress, tale, earned)
  ).length;
  return { done, total: guide.tales.length };
}

function endingStats(guide: Guide, progress: Progress, earned: Set<string>) {
  const done = guide.trueEnding.quests.filter((quest) =>
    trueEndingDone(guide, progress, quest, earned)
  ).length;
  return { done, total: guide.trueEnding.quests.length };
}

function earnedTrophyCount(guide: Guide, progress: Progress, earned: Set<string>) {
  if (progress.psn && Number.isFinite(progress.psn.earnedCount)) {
    return progress.psn.earnedCount;
  }
  return guide.trophies.filter((trophy) =>
    trophyEarned(trophy, progress, earned)
  ).length;
}

/* ------------------------------------------------------------------ */
/* context + actions                                                   */
/* ------------------------------------------------------------------ */

function currentTrophyName(guide: Guide, boss: Boss | null): string {
  if (!boss || !boss.trophy) return "";
  return trophyById(guide, boss.trophy)?.name || "";
}

function regionBlock(
  guide: Guide,
  progress: Progress,
  region: Region,
  earned: Set<string>,
  includeItems: boolean
): string[] {
  const lines: string[] = [];
  lines.push(`【区域：${region.cn}】${region.chapter}；${region.notes.join(" ")}`);
  const bosses = region.bosses
    .slice()
    .sort((a, b) => a.order - b.order)
    .slice(0, 8);
  for (const boss of bosses) {
    const state = bossDone(guide, progress, boss, earned) ? "已击败" : "未击败";
    lines.push(
      `- 首领 ${boss.name}（${boss.required ? "主线" : "可选"}，${state}，${boss.loc}）${
        boss.trophy ? `，奖杯：${trophyById(guide, boss.trophy)?.name || ""}` : ""
      }`
    );
    for (const tip of (boss.tips || []).slice(0, 4)) {
      lines.push(`  打法：${zhText(tip)}`);
    }
  }
  if (includeItems) {
    const pending = region.items
      .filter(
        (item) =>
          guide.progressTypes.includes(item.type) &&
          !entryDone(guide, progress, item.id)
      )
      .slice(0, 12);
    if (pending.length) {
      lines.push(
        `- 本章未收集（前 ${pending.length} 条）：${pending
          .map((item) => `${item.name}（${zhText(item.desc || "").slice(0, 60)}）`)
          .join("；")}`
      );
    }
  }
  return lines;
}

function buildContext(
  guide: Guide,
  progress: Progress,
  question: string
): string {
  const earned = earnedSet(progress);
  const boss = nextRequiredBoss(guide, progress, earned);
  const region = currentRegion(guide, progress, earned);
  const core = coreStats(guide, progress);
  const tales = taleStats(guide, progress, earned);
  const ending = endingStats(guide, progress, earned);
  const lines: string[] = [];

  lines.push("【本地进度摘要】");
  lines.push(
    `奖杯 ${earnedTrophyCount(guide, progress, earned)}/${progress.psn?.totalCount || guide.trophies.length}；核心收集 ${core.done}/${core.total}；支线 ${tales.done}/${tales.total}；真结局 ${ending.done}/${ending.total}。`
  );
  lines.push(
    `下一场主线首领：${boss ? `${boss.name}（${boss.loc}）` : "无，主线已通关"}；当前区域：${region.cn}。`
  );
  if (currentTrophyName(guide, boss)) {
    lines.push(`对应奖杯：${currentTrophyName(guide, boss)}。`);
  }

  lines.push(...regionBlock(guide, progress, region, earned, true));

  const regionMissables = guide.missables.filter(
    (rule) => rule.region === region.id || rule.region === "multiple"
  );
  if (regionMissables.length) {
    lines.push("【本章易错过】");
    for (const rule of regionMissables) {
      const status = missableStatus(guide, progress, rule, earned);
      if (status === "done") continue;
      lines.push(
        `- ${rule.title}：${status === "missed" ? "可能已错过" : "未完成"}；截止 ${guide.deadlines?.[rule.deadline]?.cn || "未知"}。${zhText(rule.how)}`
      );
    }
  }

  const missingEnding = guide.trueEnding.quests.filter(
    (quest) => !trueEndingDone(guide, progress, quest, earned)
  );
  if (missingEnding.length) {
    lines.push(
      `【真结局】还差 ${missingEnding.length} 项：${missingEnding
        .map((quest) => quest.name)
        .join("、")}。截止：${guide.trueEnding.cutoff}`
    );
  }

  const normalizedQuestion = norm(question);
  if (normalizedQuestion) {
    const matches: string[] = [];
    for (const other of guide.regions) {
      if (norm(other.cn) && normalizedQuestion.includes(norm(other.cn))) {
        matches.push(...regionBlock(guide, progress, other, earned, true));
      }
    }
    for (const bossItem of guide.bosses) {
      if (
        (norm(bossItem.name) && normalizedQuestion.includes(norm(bossItem.name))) ||
        (norm(bossItem.nameEn) && normalizedQuestion.includes(norm(bossItem.nameEn)))
      ) {
        matches.push(
          `首领 ${bossItem.name}：${bossItem.loc}；${(bossItem.tips || [])
            .map(zhText)
            .join("；")}`
        );
      }
    }
    for (const tale of guide.tales) {
      if (norm(tale.name) && normalizedQuestion.includes(norm(tale.name))) {
        matches.push(
          `支线 ${tale.name}：${zhText((tale.steps || []).join(" ")).slice(0, 700)}`
        );
      }
    }
    for (const other of guide.regions) {
      for (const item of other.items) {
        if (norm(item.name) && normalizedQuestion.includes(norm(item.name))) {
          matches.push(
            `${other.cn} · ${item.name}：${zhText(item.desc || "").slice(0, 300)}`
          );
        }
      }
    }
    if (matches.length) {
      lines.push("【与问题相关的本地攻略】");
      lines.push(...matches.slice(0, 8));
    }
  }

  lines.push(
    "【回答规则】只使用以上本地资料和进度；不要编造物品、地点、奖杯或数值；资料没有就明确说“本地攻略库没有这条”；不要给外部链接；不要剧透当前进度之后的主线剧情，除非用户明确要求。"
  );
  return lines.join("\n").slice(0, 14000);
}

function regionForItem(guide: Guide, id: string): Region | undefined {
  return guide.regions.find((region) =>
    region.items.some((item) => item.id === id)
  );
}

function regionForHidden(guide: Guide, id: string): Region | undefined {
  return guide.regions.find((region) =>
    (region.hidden || []).some((item) => item.id === id)
  );
}

function targetForMissable(
  guide: Guide,
  progress: Progress,
  rule: Missable,
  fallback: Region,
  earned: Set<string>
): AssistantGuideTarget {
  if (rule.id === "true_ending_quests") {
    const missing = guide.trueEnding.quests.find(
      (quest) => !trueEndingDone(guide, progress, quest, earned)
    );
    return {
      regionId: fallback.id,
      section: "ending",
      id: missing?.id,
      kind: "ending",
    };
  }
  if (rule.entry) {
    const found = regionForItem(guide, rule.entry);
    if (found) {
      return {
        regionId: found.id,
        section: "collect",
        id: rule.entry,
        kind: "item",
      };
    }
  }
  if (rule.hidden) {
    const found = regionForHidden(guide, rule.hidden);
    if (found) {
      return {
        regionId: found.id,
        section: "collect",
        id: rule.hidden,
        kind: "hidden",
      };
    }
  }
  if (rule.quest) {
    const tale = guide.tales.find((item) => norm(item.name) === norm(rule.quest));
    if (tale) {
      return {
        regionId:
          tale.region !== "multiple" && guide.regions.some((r) => r.id === tale.region)
            ? tale.region
            : fallback.id,
        section: "tales",
        id: tale.id,
        kind: "tale",
      };
    }
  }
  if (rule.trophy) {
    const boss = guide.bosses.find((item) => item.trophy === rule.trophy);
    if (boss) {
      return {
        regionId: boss.region,
        section: "bosses",
        id: boss.id,
        kind: "boss",
      };
    }
  }
  return {
    regionId:
      rule.region !== "multiple" &&
      guide.regions.some((item) => item.id === rule.region)
        ? rule.region
        : fallback.id,
    section: "collect",
  };
}

function computeActions(
  guide: Guide,
  progress: Progress
): AssistantAction[] {
  const earned = earnedSet(progress);
  const boss = nextRequiredBoss(guide, progress, earned);
  const region = currentRegion(guide, progress, earned);
  const actions: AssistantAction[] = [];

  const missed = guide.missables
    .filter((rule) => missableStatus(guide, progress, rule, earned) === "missed")
    .slice(0, 2);
  for (const rule of missed) {
    actions.push({
      level: "danger",
      title: `可能已错过：${rule.title}`,
      reason: zhText(rule.consequence),
      where: rule.region === "multiple" ? "多区域" : regionById(guide, rule.region).cn,
      deadline: guide.deadlines?.[rule.deadline]?.cn,
      target: targetForMissable(guide, progress, rule, region, earned),
    });
  }

  const openNear = guide.missables
    .filter(
      (rule) =>
        (rule.region === region.id || rule.region === "multiple") &&
        missableStatus(guide, progress, rule, earned) === "open"
    )
    .slice(0, 3);
  for (const rule of openNear) {
    actions.push({
      level: "warn",
      title: `尽快：${rule.title}`,
      reason: zhText(rule.how),
      where: region.cn,
      deadline: guide.deadlines?.[rule.deadline]?.cn,
      target: targetForMissable(guide, progress, rule, region, earned),
    });
  }

  if (boss) {
    actions.push({
      level: "info",
      title: `下一场：${boss.name}`,
      reason: `${region.cn} · ${boss.loc}${
        boss.trophy ? `；奖杯：${trophyById(guide, boss.trophy)?.name || ""}` : ""
      }`,
      where: region.cn,
      target: {
        regionId: boss.region,
        section: "bosses",
        id: boss.id,
        kind: "boss",
      },
    });
  }

  const ending = endingStats(guide, progress, earned);
  const missingEnding = guide.trueEnding.quests.filter(
    (quest) => !trueEndingDone(guide, progress, quest, earned)
  );
  if (ending.done < ending.total) {
    actions.push({
      level: "warn",
      title: `真结局还差 ${ending.total - ending.done} 项`,
      reason: guide.trueEnding.cutoff,
      where: "攻略 · 真结局",
      target: {
        regionId: region.id,
        section: "ending",
        id: missingEnding[0]?.id,
        kind: "ending",
      },
    });
  }

  const pending = region.items.filter(
    (item) =>
      guide.progressTypes.includes(item.type) &&
      !entryDone(guide, progress, item.id)
  );
  const hidden = region.hidden.filter(
    (item) => !progress.hiddens[item.id] && !(item.entryId && progress.items[item.entryId])
  );
  if (hidden.length || pending.length) {
    actions.push({
      level: "tip",
      title: `本章还有 ${hidden.length + pending.length} 个未收集/未完成`,
      reason: [
        ...hidden.slice(0, 3).map((item) => item.name),
        ...pending.slice(0, 4).map((item) => item.name),
      ].join("、"),
      where: region.cn,
      target: hidden[0]
        ? {
            regionId: region.id,
            section: "collect",
            id: hidden[0].id,
            kind: "hidden",
          }
        : pending[0]
          ? {
              regionId: region.id,
              section: "collect",
              id: pending[0].id,
              kind: "item",
            }
          : undefined,
    });
  }

  if (!actions.length) {
    actions.push({
      level: "tip",
      title: "当前没有紧急事项",
      reason: "主线已通关，可以回头清收集或准备白金收尾。",
      where: region.cn,
      target: {
        regionId: region.id,
        section: "collect",
      },
    });
  }
  return actions.slice(0, 5);
}

/* ------------------------------------------------------------------ */
/* LLM                                                                 */
/* ------------------------------------------------------------------ */

export async function* streamAssistantChat(input: {
  guide: Guide;
  progress: Progress;
  messages: AssistantMessage[];
  apiKey: string;
  model: string;
  abortSignal?: AbortSignal;
}): AsyncGenerator<string> {
  const lastUser = [...input.messages].reverse().find((item) => item.role === "user");
  const context = buildContext(input.guide, input.progress, lastUser?.content || "");
  const instructions = [
    "你是《影之刃零》本地攻略助手「影境手札·参谋」。",
    "你只依据下面提供的本地攻略资料和进度作答。",
    "用简体中文，简洁、可执行；优先给下一步、地点、截止点。",
    context,
  ].join("\n\n");

  const reasoning = input.model === "deepseek-reasoner";
  const result = streamText({
    model: createModel(input.apiKey, input.model),
    instructions,
    messages: input.messages.map((message) => ({
      role: message.role,
      content: message.content,
    })) as any,
    ...(reasoning ? {} : { temperature: 0.4 }),
    maxOutputTokens: reasoning ? 2000 : 900,
    abortSignal: input.abortSignal,
  });

  for await (const part of result.fullStream) {
    if (part.type === "error") {
      throw new Error(
        part.error instanceof Error ? part.error.message : String(part.error)
      );
    }
    if (part.type === "text-delta") {
      yield part.text;
    }
  }
}

export async function generateAssistantNext(input: {
  guide: Guide;
  progress: Progress;
}): Promise<AssistantNextResponse> {
  const actions = computeActions(input.guide, input.progress);
  const fallback = actions[0]
    ? `最优先：${actions[0].title}。${actions[0].reason}`
    : "当前没有紧急事项。";
  const apiKey = loadKey();
  if (!apiKey) {
    return { briefing: fallback, actions, source: "rules" };
  }
  try {
    const config = loadConfig();
    const reasoning = config.model === "deepseek-reasoner";
    const { text } = await generateText({
      model: createModel(apiKey, config.model),
      instructions:
        "你是《影之刃零》攻略参谋。只使用候选行动，不要新增行动、不要编造、不要给外部链接。用简体中文写 2-3 句，说明最优先做什么和原因，语气直接。",
      prompt: `当前进度：${buildContext(input.guide, input.progress, "")}\n\n候选行动：\n${actions
        .map(
          (action, index) =>
            `${index + 1}. ${action.title}｜${action.reason}｜${action.where || ""}｜${action.deadline || ""}`
        )
        .join("\n")}`,
      ...(reasoning ? {} : { temperature: 0.3 }),
      maxOutputTokens: reasoning ? 1200 : 260,
      abortSignal: timeout(20000),
    });
    return {
      briefing: text.trim() || fallback,
      actions,
      source: "llm",
    };
  } catch {
    return { briefing: fallback, actions, source: "rules" };
  }
}

export async function testAssistant(): Promise<string> {
  const apiKey = loadKey();
  if (!apiKey) throw new Error("还没有配置 DeepSeek API Key。");
  const config = loadConfig();
  try {
    const { text } = await generateText({
      model: createModel(apiKey, config.model),
      instructions: "你是连接测试。",
      prompt: "请只回复：连接成功",
      maxOutputTokens: config.model === "deepseek-reasoner" ? 200 : 20,
      abortSignal: timeout(20000),
    });
    return text.trim();
  } catch (error) {
    throw new Error(
      `连接 DeepSeek 失败：${error instanceof Error ? error.message : String(error)}`
    );
  }
}
