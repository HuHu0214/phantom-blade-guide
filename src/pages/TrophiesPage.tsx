import { useMemo, useState } from "react";
import type { Guide, Progress, Trophy } from "../../shared/types";
import {
  TROPHY_TYPE_CN,
  TROPHY_TYPE_CHAR,
  earnedTrophyCount,
  matchedPsnCount,
  psnTrophyFor,
  trophyTotal,
  trophyEarned,
} from "../helpers";

const FILTERS: { id: string; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "unearned", label: "未获得" },
  { id: "earned", label: "已获得" },
  { id: "missable", label: "易错过" },
  { id: "boss", label: "首领" },
  { id: "quest", label: "支线" },
  { id: "collect", label: "收集" },
  { id: "upgrade", label: "强化" },
];

export function TrophiesPage({
  guide,
  progress,
  onToggle,
}: {
  guide: Guide;
  progress: Progress;
  onToggle: (kind: "trophiesManual", id: string, value: boolean) => void;
}) {
  const [filter, setFilter] = useState("all");
  const earned = earnedTrophyCount(guide, progress);
  const total = trophyTotal(guide, progress);
  const matched = matchedPsnCount(guide, progress);

  const typeCount = useMemo(() => {
    const counts: Record<string, number> = { 白金: 0, 金: 0, 银: 0, 铜: 0 };
    for (const trophy of guide.trophies) {
      const psn = psnTrophyFor(guide, progress, trophy);
      const type = TROPHY_TYPE_CN[psn?.type || trophy.type] || "铜";
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }, [guide, progress]);

  const list = useMemo(() => {
    return guide.trophies.filter((trophy) => {
      const isEarned = trophyEarned(guide, progress, trophy);
      if (filter === "earned") return isEarned;
      if (filter === "unearned") return !isEarned;
      if (filter === "missable") return Boolean(trophy.missable);
      if (["boss", "quest", "collect", "upgrade"].includes(filter)) {
        return trophy.category === filter;
      }
      return true;
    });
  }, [filter, guide, progress]);

  return (
    <div className="page trophies-page">
      <header className="page-head">
        <div>
          <span className="kicker">奖杯</span>
          <h1>奖杯簿</h1>
          <p className="quiet">
            已获得 {earned} / {total}
          </p>
        </div>
      </header>

      <div className="trophy-summary">
        <div className="trophy-total">
          <strong>
            {Math.round((earned / Math.max(total, 1)) * 100)}
            <small>%</small>
          </strong>
          <span>完成度</span>
        </div>
        <div className="trophy-types">
          {["白金", "金", "银", "铜"].map((type) => (
            <span key={type} className={`type-seal ${type}`}>
              {type}
              <b>{typeCount[type] || 0}</b>
            </span>
          ))}
        </div>
        <span className="quiet tiny">
          {progress.psn ? `PSN 匹配 ${matched} / ${guide.trophies.length}` : "未连接 PSN，可手动勾选"}
        </span>
      </div>

      <div className="trophy-toolbar">
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          {FILTERS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <span className="quiet tiny">{list.length} 个奖杯</span>
      </div>

      <div className="trophy-list">
        {list.map((trophy) => (
          <TrophyRow
            key={trophy.id}
            guide={guide}
            progress={progress}
            trophy={trophy}
            onToggle={onToggle}
          />
        ))}
        {!list.length && <p className="empty">没有匹配的奖杯。</p>}
      </div>
    </div>
  );
}

function TrophyRow({
  guide,
  progress,
  trophy,
  onToggle,
}: {
  guide: Guide;
  progress: Progress;
  trophy: Trophy;
  onToggle: (kind: "trophiesManual", id: string, value: boolean) => void;
}) {
  const psn = psnTrophyFor(guide, progress, trophy);
  const earned = trophyEarned(guide, progress, trophy);
  const type = TROPHY_TYPE_CN[psn?.type || trophy.type] || "铜";
  const typeChar = TROPHY_TYPE_CHAR[psn?.type || trophy.type] || "铜";
  const deadline = trophy.missable && trophy.deadline
    ? guide.deadlines?.[trophy.deadline]?.cn
    : "";

  return (
    <article className={`trophy-row ${earned ? "earned" : ""}`}>
      <span className={`trophy-seal ${type}`}>{typeChar}</span>
      <div className="trophy-main">
        <div className="row-title">
          <strong>{trophy.name}</strong>
          {earned && <span className="tag done">已获得</span>}
          {trophy.missable && <span className="tag red">易错过</span>}
          {deadline && <span className="tag">截止：{deadline}</span>}
        </div>
        <p className="row-meta">{trophy.req}</p>
      </div>
      {psn ? (
        <span className={`trophy-state ${earned ? "on" : ""}`}>
          {earned ? "PSN 已获得" : "PSN 未获得"}
        </span>
      ) : (
        <label className="check-inline">
          <input
            type="checkbox"
            checked={earned}
            onChange={(event) => onToggle("trophiesManual", trophy.id, event.target.checked)}
          />
          手动
        </label>
      )}
    </article>
  );
}
