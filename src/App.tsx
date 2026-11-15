import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type {
  AssistantGuideTarget,
  AssistantStatus,
  BootstrapResponse,
  Guide,
  Progress,
  ProgressKind,
  PsnState,
} from "../shared/types";
import { api } from "./api";
import {
  currentRegion,
  nextRequiredBoss,
  regionById,
} from "./helpers";
import { Shell, type Tab } from "./components/Shell";
import { Toast, type ToastState } from "./components/Toast";
import { Lightbox, type LightboxState } from "./components/Lightbox";
import { OverviewPage } from "./pages/OverviewPage";
import { GuidePage } from "./pages/GuidePage";
import { TrophiesPage } from "./pages/TrophiesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { AssistantPage } from "./pages/AssistantPage";
import type { GuideSection } from "./ui-types";

const MapPage = lazy(() =>
  import("./pages/MapPage").then((module) => ({ default: module.MapPage }))
);

const TAB_IDS: Tab[] = [
  "overview",
  "guide",
  "map",
  "trophies",
  "assistant",
  "settings",
];
const SECTIONS: GuideSection[] = ["bosses", "tales", "collect", "ending"];

function hashFor(
  tab: Tab,
  regionId: string,
  section: GuideSection,
  mapRegion: string
): string {
  if (tab === "guide") return `#/guide/${regionId}/${section}`;
  if (tab === "map") return `#/map/${mapRegion}`;
  return `#/${tab}`;
}

function parseHash(hash: string): {
  tab?: Tab;
  regionId?: string;
  section?: GuideSection;
  mapRegion?: string;
} | null {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const tab = parts[0] as Tab;
  if (!TAB_IDS.includes(tab)) return null;
  const result: {
    tab?: Tab;
    regionId?: string;
    section?: GuideSection;
    mapRegion?: string;
  } = { tab };
  if (tab === "guide") {
    if (parts[1]) result.regionId = parts[1];
    const section = parts[2] as GuideSection;
    if (SECTIONS.includes(section)) result.section = section;
  }
  if (tab === "map" && parts[1]) result.mapRegion = parts[1];
  return result;
}

function emptyProgress(psn: PsnState | null): Progress {
  return {
    version: 1,
    items: {},
    tales: {},
    bosses: {},
    trueEnding: {},
    hiddens: {},
    trophiesManual: {},
    psn,
    updatedAt: null,
  };
}

export default function App() {
  const [data, setData] = useState<BootstrapResponse | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [regionId, setRegionId] = useState("weeping");
  const [section, setSection] = useState<GuideSection>("bosses");
  const [mapRegion, setMapRegion] = useState("251");
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lightbox, setLightbox] = useState<LightboxState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState<AssistantStatus | null>(null);
  const [guideFocus, setGuideFocus] = useState<{
    id: string;
    kind?: string;
    nonce: number;
  } | null>(null);
  const toastTimer = useRef<number | null>(null);

  function notify(message: string, tone: "ok" | "error" = "ok") {
    setToast({ message, tone });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3600);
  }

  useEffect(() => {
    let cancelled = false;
    api<BootstrapResponse>("/api/bootstrap")
      .then((response) => {
        if (cancelled) return;
        setData(response);
        const current = currentRegion(response.guide, response.progress);
        const currentMap = response.guide.mapRegions.find((item) =>
          item.regionIds.includes(current.id)
        );
        const parsed = parseHash(window.location.hash);
        if (parsed) {
          const nextRegion =
            parsed.regionId &&
            response.guide.regions.some((item) => item.id === parsed.regionId)
              ? parsed.regionId
              : current.id;
          const nextMap =
            parsed.mapRegion &&
            response.guide.mapRegions.some((item) => item.id === parsed.mapRegion)
              ? parsed.mapRegion
              : currentMap?.id || "251";
          setTab(parsed.tab || "overview");
          setRegionId(nextRegion);
          setSection(parsed.section || "bosses");
          setMapRegion(nextMap);
          window.history.replaceState(
            null,
            "",
            hashFor(parsed.tab || "overview", nextRegion, parsed.section || "bosses", nextMap)
          );
        } else {
          setRegionId(current.id);
          if (currentMap) setMapRegion(currentMap.id);
          window.history.replaceState(
            null,
            "",
            hashFor("overview", current.id, "bosses", currentMap?.id || "251")
          );
        }
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "加载失败");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<AssistantStatus>("/api/assistant/status")
      .then((status) => {
        if (!cancelled) setAssistantStatus(status);
      })
      .catch(() => {
        /* assistant status is optional */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const applyLocation = () => {
      const parsed = parseHash(window.location.hash);
      if (!parsed) return;
      setGuideFocus(null);
      if (parsed.tab) setTab(parsed.tab);
      if (parsed.regionId) setRegionId(parsed.regionId);
      if (parsed.section) setSection(parsed.section);
      if (parsed.mapRegion) setMapRegion(parsed.mapRegion);
    };
    window.addEventListener("popstate", applyLocation);
    window.addEventListener("hashchange", applyLocation);
    return () => {
      window.removeEventListener("popstate", applyLocation);
      window.removeEventListener("hashchange", applyLocation);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  if (error) {
    return <div className="boot error">加载失败：{error}</div>;
  }
  if (!data) {
    return <div className="boot">正在翻开手札…</div>;
  }

  const guide: Guide = data.guide;
  const progress: Progress = data.progress;
  const boss = nextRequiredBoss(guide, progress);
  const region = currentRegion(guide, progress);

  function toggle(kind: ProgressKind, id: string, value: boolean) {
    setData((previous) => {
      if (!previous) return previous;
      const map = { ...(previous.progress[kind] as Record<string, boolean>) };
      if (value) map[id] = true;
      else delete map[id];
      return {
        ...previous,
        progress: { ...previous.progress, [kind]: map },
      };
    });
    api("/api/progress", {
      method: "POST",
      body: JSON.stringify({ kind, id, value }),
    }).catch((updateError: unknown) => {
      setData((previous) => {
        if (!previous) return previous;
        const map = { ...(previous.progress[kind] as Record<string, boolean>) };
        if (value) delete map[id];
        else map[id] = true;
        return {
          ...previous,
          progress: { ...previous.progress, [kind]: map },
        };
      });
      notify(updateError instanceof Error ? updateError.message : "保存失败", "error");
    });
  }

  async function sync() {
    setSyncing(true);
    try {
      const response = await api<{ psn: PsnState }>("/api/psn/sync", { method: "POST" });
      setData((previous) =>
        previous
          ? {
              ...previous,
              progress: { ...previous.progress, psn: response.psn },
              server: { ...previous.server, hasNpsso: true },
            }
          : previous
      );
      notify("PSN 同步完成", "ok");
    } catch (syncError) {
      notify(syncError instanceof Error ? syncError.message : "同步失败", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function saveNpsso(token: string) {
    await api("/api/psn/npsso", {
      method: "POST",
      body: JSON.stringify({ npsso: token }),
    });
    setData((previous) =>
      previous
        ? { ...previous, server: { ...previous.server, hasNpsso: true } }
        : previous
    );
    await sync();
  }

  async function clearPsn() {
    if (!window.confirm("确定清除本机保存的 PSN 授权？已同步的奖杯进度会一起清除。")) return;
    try {
      await api("/api/psn/clear", { method: "POST" });
      setData((previous) =>
        previous
          ? {
              ...previous,
              progress: { ...previous.progress, psn: null },
              server: { ...previous.server, hasNpsso: false },
            }
          : previous
      );
      notify("已清除 PSN 授权", "ok");
    } catch (clearError) {
      notify(clearError instanceof Error ? clearError.message : "清除失败", "error");
    }
  }

  async function reset() {
    if (!window.confirm("确定清空所有手动勾选？此操作不可撤销。")) return;
    try {
      await api("/api/reset", {
        method: "POST",
        body: JSON.stringify({ confirm: "清空" }),
      });
      setData((previous) =>
        previous
          ? {
              ...previous,
              progress: emptyProgress(previous.progress.psn),
            }
          : previous
      );
      notify("手动进度已清空", "ok");
    } catch (resetError) {
      notify(resetError instanceof Error ? resetError.message : "清空失败", "error");
    }
  }

  async function saveAssistant(input: {
    apiKey?: string;
    model?: string;
  }): Promise<boolean> {
    try {
      const response = await api<{ status: AssistantStatus }>(
        "/api/assistant/config",
        {
          method: "POST",
          body: JSON.stringify(input),
        }
      );
      setAssistantStatus(response.status);
      notify("AI 助手配置已保存", "ok");
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "保存失败", "error");
      return false;
    }
  }

  async function testAssistantConnection(): Promise<void> {
    try {
      const response = await api<{ text: string }>("/api/assistant/test", {
        method: "POST",
        body: "{}",
      });
      notify(`连接成功：${response.text}`, "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : "连接测试失败", "error");
    }
  }

  async function clearAssistant(): Promise<void> {
    if (!window.confirm("确定清除本机保存的 DeepSeek API Key？")) return;
    try {
      const response = await api<{ status: AssistantStatus }>(
        "/api/assistant/clear",
        { method: "POST", body: "{}" }
      );
      setAssistantStatus(response.status);
      notify("已清除 AI 助手 Key", "ok");
    } catch (error) {
      notify(error instanceof Error ? error.message : "清除失败", "error");
    }
  }

  function commitLocation(
    nextTab: Tab,
    nextRegion: string,
    nextSection: GuideSection,
    nextMap: string
  ) {
    const hash = hashFor(nextTab, nextRegion, nextSection, nextMap);
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }

  function goTab(nextTab: Tab) {
    setGuideFocus(null);
    setTab(nextTab);
    commitLocation(nextTab, regionId, section, mapRegion);
  }

  function goRegion(nextRegion: string) {
    setGuideFocus(null);
    setRegionId(nextRegion);
    commitLocation("guide", nextRegion, section, mapRegion);
  }

  function goSection(nextSection: GuideSection) {
    setGuideFocus(null);
    setSection(nextSection);
    commitLocation("guide", regionId, nextSection, mapRegion);
  }

  function goMap(nextMap: string) {
    setGuideFocus(null);
    setMapRegion(nextMap);
    commitLocation("map", regionId, section, nextMap);
  }

  function openGuide(
    targetRegionId: string,
    targetSection: GuideSection = "bosses",
    focusTarget?: AssistantGuideTarget | null
  ) {
    const target = regionById(guide, targetRegionId);
    setGuideFocus(
      focusTarget?.id
        ? { id: focusTarget.id, kind: focusTarget.kind, nonce: Date.now() }
        : null
    );
    setRegionId(target.id);
    setSection(targetSection);
    setTab("guide");
    commitLocation("guide", target.id, targetSection, mapRegion);
  }

  function openMap(targetRegionId: string) {
    setGuideFocus(null);
    const map = guide.mapRegions.find((item) =>
      item.regionIds.includes(targetRegionId)
    );
    const nextMap = map?.id || mapRegion;
    if (map) setMapRegion(nextMap);
    setTab("map");
    commitLocation("map", regionId, section, nextMap);
  }

  return (
    <>
      <Shell
        tab={tab}
        onTab={goTab}
        guide={guide}
        progress={progress}
        boss={boss}
        region={region}
        onSync={sync}
        syncing={syncing}
      >
        {tab === "overview" && (
          <OverviewPage
            guide={guide}
            progress={progress}
            boss={boss}
            region={region}
            onOpenGuide={openGuide}
            onOpenMap={openMap}
          />
        )}
        {tab === "guide" && (
          <GuidePage
            guide={guide}
            progress={progress}
            regionId={regionId}
            section={section}
            onRegion={goRegion}
            onSection={goSection}
            onToggle={toggle}
            showLightbox={(images, caption, index) =>
              setLightbox({ images, caption, index })
            }
            onOpenMap={openMap}
            focus={guideFocus}
          />
        )}
        {tab === "map" && (
          <Suspense fallback={<div className="boot-inline">正在打开地图…</div>}>
            <MapPage
              guide={guide}
              mapRegion={mapRegion}
              onMapRegion={goMap}
              showLightbox={(images, caption, index) =>
                setLightbox({ images, caption, index })
              }
            />
          </Suspense>
        )}
        {tab === "trophies" && (
          <TrophiesPage guide={guide} progress={progress} onToggle={toggle} />
        )}
        {tab === "assistant" && (
          <AssistantPage
            status={assistantStatus}
            onOpenSettings={() => goTab("settings")}
            onOpenGuide={(target) =>
              openGuide(target.regionId, target.section, target)
            }
            notify={notify}
          />
        )}
        {tab === "settings" && (
          <SettingsPage
            guide={guide}
            progress={progress}
            hasNpsso={data.server.hasNpsso}
            syncing={syncing}
            lanUrls={data.server.lanUrls}
            assistantStatus={assistantStatus}
            onSaveNpsso={saveNpsso}
            onSync={sync}
            onClearPsn={clearPsn}
            onReset={reset}
            onSaveAssistant={saveAssistant}
            onTestAssistant={testAssistantConnection}
            onClearAssistant={clearAssistant}
          />
        )}
      </Shell>
      <Toast toast={toast} />
      <Lightbox state={lightbox} onClose={() => setLightbox(null)} />
    </>
  );
}
