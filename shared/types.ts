export interface GuideMeta {
  game: string;
  gameEn?: string;
  release?: string;
  trophyCount?: number;
  sourceNote?: string;
  visualGuide?: string;
  sources?: string[];
  [key: string]: unknown;
}

export interface Item {
  id: string;
  n: number;
  name: string;
  nameEn?: string;
  type: string;
  typeLabel: string;
  subtype?: string;
  desc?: string;
  effect?: string;
  images?: string[];
  mapId?: string;
  landmarkId?: string;
  missable?: boolean;
  guideUrl?: string;
  [key: string]: unknown;
}

export interface Boss {
  id: string;
  name: string;
  nameCn: string;
  nameEn: string;
  cn?: string;
  region: string;
  order: number;
  required: boolean;
  trophy?: string | null;
  loc: string;
  tips?: string[];
  hp?: string;
  at?: string;
  reward?: string;
  images?: string[];
  guideUrl?: string;
  [key: string]: unknown;
}

export interface Tale {
  id: string;
  name: string;
  cn?: string;
  type: string;
  region: string;
  location: string;
  missable: boolean;
  trophy?: string;
  trophyName?: string;
  accepted?: string[];
  objectives?: string[];
  reward?: string;
  requiredFor?: string;
  steps?: string[];
  images?: string[];
  url?: string;
  [key: string]: unknown;
}

export interface Trophy {
  id: string;
  name: string;
  nameCn: string;
  nameEn: string;
  type: string;
  category: string;
  req: string;
  missable?: boolean;
  deadline?: string;
  [key: string]: unknown;
}

export interface Region {
  id: string;
  order: number;
  cn: string;
  en?: string;
  chapter: string;
  kind: "main" | "side" | string;
  bossRange: string;
  notes: string[];
  route: string[];
  guides?: { label: string; url: string }[];
  items: Item[];
  entries: Item[];
  bosses: Boss[];
  hidden: HiddenItem[];
  counts: Record<string, number>;
  [key: string]: unknown;
}

export interface TrueEndingQuest {
  id: string;
  name: string;
  cn?: string;
  region: string;
  taleName?: string;
  note: string;
  order: number;
}

export interface Deadline {
  cn: string;
  boss: string;
  fallbackBoss?: string;
  hint?: string;
}

export interface Missable {
  id: string;
  title: string;
  region: string;
  hidden?: string;
  quest?: string;
  trophy?: string;
  entry?: string;
  deadline: string;
  consequence: string;
  how: string;
}

export interface HiddenItem {
  id: string;
  region: string;
  name: string;
  tag: string;
  how: string;
  deadline?: string;
  url?: string;
  entryId?: string;
}

export interface MapRegion {
  id: string;
  cn: string;
  en: string;
  regionIds: string[];
  center: [number, number];
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  defaultZoom: number;
  tileSize: number;
  tileUrl: string;
}

export interface Guide {
  meta: GuideMeta;
  regions: Region[];
  tales: Tale[];
  trophies: Trophy[];
  bosses: Boss[];
  trueEnding: { summary: string; cutoff: string; quests: TrueEndingQuest[] };
  deadlines: Record<string, Deadline>;
  missables: Missable[];
  hiddenItems: HiddenItem[];
  mapRegions: MapRegion[];
  mapZhNames: Record<string, Record<string, string>>;
  typeLabels: Record<string, string>;
  progressTypes: string[];
  trophyQuests: Record<string, string[]>;
  trophyBossGroups: Record<string, string[]>;
  [key: string]: unknown;
}

export interface PsnTrophy {
  trophyId: number;
  name: string;
  detail: string;
  type: string;
  hidden: boolean;
  earned: boolean;
  earnedDateTime: string | null;
}

export interface PsnState {
  titleName: string;
  npCommunicationId: string;
  npServiceName: string;
  platform: string;
  progress: number;
  earnedCount: number;
  totalCount: number;
  trophies: PsnTrophy[];
  syncedAt: string;
  [key: string]: unknown;
}

export type ProgressMap = Record<string, boolean>;

export interface Progress {
  version: number;
  items: ProgressMap;
  tales: ProgressMap;
  bosses: ProgressMap;
  trueEnding: ProgressMap;
  hiddens: ProgressMap;
  trophiesManual: ProgressMap;
  psn: PsnState | null;
  updatedAt?: string | null;
}

export interface BootstrapResponse {
  guide: Guide;
  progress: Progress;
  server: {
    port: number;
    lanUrls: string[];
    hasNpsso: boolean;
  };
}

export type ProgressKind =
  | "items"
  | "tales"
  | "bosses"
  | "trueEnding"
  | "hiddens"
  | "trophiesManual";

export interface MapLandmark {
  id: string;
  catalogId: string;
  position: [number, number];
  z?: number;
  images?: string[];
  name: string;
  description?: string;
}

export interface MapData {
  mapId: string;
  landmarks: MapLandmark[];
}

export interface MapCatalog {
  id: string;
  name: string;
  iconUrl?: string | null;
}

export interface MapManifestEntry {
  id: string;
  center: [number, number];
  bounds: [number, number, number, number];
  minZoom: number;
  maxZoom: number;
  defaultZoom: number;
  tileSize: number;
  tileUrl: string;
  catalogGroups?: { catalogs?: MapCatalog[] }[];
}

export interface MapManifest {
  maps: MapManifestEntry[];
}
