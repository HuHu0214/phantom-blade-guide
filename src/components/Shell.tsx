import type { ReactNode } from "react";
import type { Boss, Guide, Progress, Region } from "../../shared/types";
import {
  earnedTrophyCount,
  formatDate,
  trophyTotal,
} from "../helpers";

export type Tab =
  | "overview"
  | "guide"
  | "map"
  | "trophies"
  | "assistant"
  | "settings";

const NAV: { id: Tab; label: string; seal: string }[] = [
  { id: "overview", label: "首页", seal: "首" },
  { id: "guide", label: "攻略", seal: "攻" },
  { id: "map", label: "地图", seal: "图" },
  { id: "trophies", label: "奖杯", seal: "杯" },
  { id: "assistant", label: "助手", seal: "问" },
  { id: "settings", label: "设置", seal: "设" },
];

export function Shell({
  tab,
  onTab,
  guide,
  progress,
  boss,
  region,
  onSync,
  syncing,
  children,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  guide: Guide;
  progress: Progress;
  boss: Boss | null;
  region: Region;
  onSync: () => void;
  syncing: boolean;
  children: ReactNode;
}) {
  const earned = earnedTrophyCount(guide, progress);
  const total = trophyTotal(guide, progress);
  const psn = progress.psn;

  return (
    <div className="app">
      <aside className="rail">
        <div className="brand">
          <span className="brand-seal">影</span>
          <span className="brand-text">
            <strong>影境手札</strong>
            <small>影之刃零指南</small>
          </span>
        </div>

        <nav className="rail-nav" aria-label="主导航">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => onTab(item.id)}
              type="button"
            >
              <span className="nav-seal">{item.seal}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="rail-current">
          <span className="rail-label">当前目标</span>
          <strong>{boss ? boss.name : "主线已通关"}</strong>
          <p>{boss ? boss.loc : "清理收集与真结局"}</p>
          <span className="rail-region">{region.cn}</span>
        </div>

        <div className="rail-foot">
          <div className="rail-progress">
            <span>奖杯</span>
            <strong>
              {earned}
              <small> / {total}</small>
            </strong>
          </div>
          <div className="rail-sync">
            <span className={psn ? "dot on" : "dot"} />
            {psn ? `已同步 ${formatDate(psn.syncedAt)}` : "未连接 PSN"}
          </div>
          <button className="btn ghost small" onClick={onSync} disabled={syncing} type="button">
            {syncing ? "同步中…" : "同步 PSN"}
          </button>
        </div>
      </aside>

      <div className="page-wrap">
        <header className="topbar">
          <div className="topbar-brand">
            <span className="brand-seal small">影</span>
            <strong>影境手札</strong>
          </div>
          <div className="topbar-actions">
            <span className="topbar-progress">
              {earned}/{total} 奖杯
            </span>
            <button className="btn ghost small" onClick={onSync} disabled={syncing} type="button">
              {syncing ? "同步中" : "同步"}
            </button>
          </div>
        </header>

        <main className="main">{children}</main>

        <nav className="bottom-nav" aria-label="底部导航">
          {NAV.map((item) => (
            <button
              key={item.id}
              className={tab === item.id ? "active" : ""}
              onClick={() => onTab(item.id)}
              type="button"
            >
              <span className="nav-seal">{item.seal}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
