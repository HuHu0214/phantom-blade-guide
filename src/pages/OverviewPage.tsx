import type { Boss, Guide, Progress, Region } from "../../shared/types";
import type { GuideSection } from "../ui-types";
import {
  bossTrophy,
  coreStats,
  deadlinePassed,
  earnedTrophyCount,
  endingStats,
  formatDate,
  missableStatus,
  regionById,
  taleStats,
  trophyTotal,
  zhText,
} from "../helpers";

const CN_NUM = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];

export function OverviewPage({
  guide,
  progress,
  boss,
  region,
  onOpenGuide,
  onOpenMap,
}: {
  guide: Guide;
  progress: Progress;
  boss: Boss | null;
  region: Region;
  onOpenGuide: (regionId: string, section: GuideSection) => void;
  onOpenMap: (regionId: string) => void;
}) {
  const earned = earnedTrophyCount(guide, progress);
  const total = trophyTotal(guide, progress);
  const core = coreStats(guide, progress);
  const tales = taleStats(guide, progress);
  const ending = endingStats(guide, progress);
  const trophy = boss ? bossTrophy(guide, boss) : undefined;

  const alerts = guide.missables
    .map((rule) => ({ rule, status: missableStatus(guide, progress, rule) }))
    .filter((item) => item.status !== "done")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "missed" ? -1 : 1;
      const order = (key: string) => {
        const deadline = guide.deadlines?.[key];
        const boss = deadline && guide.bosses.find((item) => item.id === deadline.boss);
        return boss?.order ?? 999;
      };
      return order(a.rule.deadline) - order(b.rule.deadline);
    })
    .slice(0, 4);

  return (
    <div className="page overview">
      <section className="hero">
        <div className="hero-seal">
          <span>卷</span>
          <strong>{CN_NUM[region.order] || region.order}</strong>
          <em>{region.cn}</em>
        </div>
        <div className="hero-main">
          <span className="kicker">当前目标</span>
          <h1>{boss ? boss.name : "主线已通关"}</h1>
          <p className="hero-loc">
            {boss ? boss.loc : "可以回头清理收集、支线与真结局条件。"}
          </p>
          <div className="hero-meta">
            {boss && <span>{region.chapter}</span>}
            {trophy && <span>奖杯：{trophy.name}</span>}
            {!boss && <span>{region.cn}</span>}
          </div>
          <div className="hero-actions">
            <button className="btn primary" onClick={() => onOpenGuide(region.id, "bosses")} type="button">
              查看本章攻略
            </button>
            <button className="btn" onClick={() => onOpenMap(region.id)} type="button">
              打开本地地图
            </button>
          </div>
        </div>
      </section>

      <section className="ledger" aria-label="进度总览">
        <div className="ledger-row">
          <span className="ledger-name">奖杯</span>
          <span className="ledger-number">
            {earned}
            <small> / {total}</small>
          </span>
          <span className="ledger-track">
            <i style={{ width: `${total ? (earned / total) * 100 : 0}%` }} />
          </span>
        </div>
        <div className="ledger-row">
          <span className="ledger-name">核心收集</span>
          <span className="ledger-number">
            {core.done}
            <small> / {core.total}</small>
          </span>
          <span className="ledger-track">
            <i style={{ width: `${core.ratio * 100}%` }} />
          </span>
        </div>
        <div className="ledger-row">
          <span className="ledger-name">支线</span>
          <span className="ledger-number">
            {tales.done}
            <small> / {tales.total}</small>
          </span>
          <span className="ledger-track">
            <i style={{ width: `${tales.ratio * 100}%` }} />
          </span>
        </div>
        <div className="ledger-row">
          <span className="ledger-name">真结局</span>
          <span className="ledger-number">
            {ending.done}
            <small> / {ending.total}</small>
          </span>
          <span className="ledger-track">
            <i style={{ width: `${ending.ratio * 100}%` }} />
          </span>
        </div>
      </section>

      <div className="overview-columns">
        <section className="paper-block">
          <div className="block-head">
            <h2>别错过</h2>
            <span className={alerts.some((item) => item.status === "missed") ? "mark danger" : "mark"}>
              {alerts.filter((item) => item.status === "missed").length
                ? `${alerts.filter((item) => item.status === "missed").length} 项可能已错过`
                : "暂无已错过"}
            </span>
          </div>
          {alerts.length ? (
            <div className="alert-list">
              {alerts.map(({ rule, status }) => {
                const targetRegion = rule.region === "multiple" ? region.id : rule.region;
                const target = regionById(guide, targetRegion);
                return (
                  <button
                    key={rule.id}
                    className={`alert-row ${status}`}
                    onClick={() => onOpenGuide(target.id, "tales")}
                    type="button"
                  >
                    <span className="alert-state">{status === "missed" ? "失" : "急"}</span>
                    <span className="alert-main">
                      <strong>{rule.title}</strong>
                      <small>
                        截止：{guide.deadlines?.[rule.deadline]?.cn || "未知"}。
                        {zhText(rule.consequence)}
                      </small>
                    </span>
                    <span className="alert-where">{target.cn}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="quiet">目前没有即将到期的易错过内容。</p>
          )}
        </section>

        <section className="paper-block">
          <div className="block-head">
            <h2>真结局</h2>
            <span className="mark">{ending.done} / {ending.total}</span>
          </div>
          <p className="quiet">{guide.trueEnding.cutoff}</p>
          <button
            className="text-action"
            onClick={() => onOpenGuide(region.id, "ending")}
            type="button"
          >
            查看 11 项紫色任务
          </button>
          <div className="sync-line">
            <span className={progress.psn ? "dot on" : "dot"} />
            {progress.psn
              ? `PSN 已同步　${formatDate(progress.psn.syncedAt)}`
              : "尚未连接 PSN，奖杯需要手动勾选"}
          </div>
          <p className="quiet tiny">
            易错过判断依据：PSN 奖杯与手动勾选的首领进度；未勾选的首领不会误报“已错过”。
          </p>
        </section>
      </div>
    </div>
  );
}
