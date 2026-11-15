import { useMemo, useState } from "react";
import type { Boss, Guide, HiddenItem, Item, Progress, Region, Tale } from "../../shared/types";
import type { GuideSection } from "../ui-types";
import {
  bossDone,
  bossTrophy,
  entryDone,
  hiddenDone,
  localImageSrc,
  regionById,
  regionProgress,
  sortBosses,
  taleDone,
  trueEndingDone,
  typeLabel,
  zhText,
} from "../helpers";
import { Thumb } from "../components/Thumb";
import { BottomSheet } from "../components/BottomSheet";
import { useMediaQuery } from "../hooks/useMediaQuery";

type ProgressKind = "items" | "tales" | "bosses" | "trueEnding" | "hiddens";

export function GuidePage({
  guide,
  progress,
  regionId,
  section,
  onRegion,
  onSection,
  onToggle,
  showLightbox,
  onOpenMap,
}: {
  guide: Guide;
  progress: Progress;
  regionId: string;
  section: GuideSection;
  onRegion: (id: string) => void;
  onSection: (section: GuideSection) => void;
  onToggle: (kind: ProgressKind, id: string, value: boolean) => void;
  showLightbox: (images: string[], caption: string, index?: number) => void;
  onOpenMap: (regionId: string) => void;
}) {
  const region = regionById(guide, regionId);
  const progressValue = regionProgress(guide, progress, region);
  const regionTales = guide.tales.filter(
    (tale) => tale.region === region.id || tale.region === "multiple"
  );
  const coreItems = region.items.filter((item) => guide.progressTypes.includes(item.type));

  return (
    <div className="page guide-page">
      <nav className="chapter-strip" aria-label="区域">
        {guide.regions.map((item) => (
          <button
            key={item.id}
            className={item.id === region.id ? "active" : ""}
            onClick={() => onRegion(item.id)}
            type="button"
          >
            <span>{item.order}</span>
            {item.cn}
          </button>
        ))}
      </nav>

      <header className="region-head">
        <div>
          <span className="kicker">{region.chapter}</span>
          <h1>{region.cn}</h1>
          <p className="quiet">
            {region.bossRange}　·　已收集 {progressValue.done} / {progressValue.total}
          </p>
        </div>
        <div className="region-actions">
          <button className="btn" onClick={() => onOpenMap(region.id)} type="button">
            本地地图
          </button>
        </div>
      </header>

      <div className="region-track">
        <i style={{ width: `${progressValue.ratio * 100}%` }} />
      </div>

      <div className="segmented" role="tablist">
        <button
          className={section === "bosses" ? "active" : ""}
          onClick={() => onSection("bosses")}
          type="button"
        >
          首领 <span>{region.bosses.length}</span>
        </button>
        <button
          className={section === "tales" ? "active" : ""}
          onClick={() => onSection("tales")}
          type="button"
        >
          支线 <span>{regionTales.length}</span>
        </button>
        <button
          className={section === "collect" ? "active" : ""}
          onClick={() => onSection("collect")}
          type="button"
        >
          收集 <span>{coreItems.length}</span>
        </button>
        <button
          className={section === "ending" ? "active" : ""}
          onClick={() => onSection("ending")}
          type="button"
        >
          真结局 <span>{guide.trueEnding.quests.length}</span>
        </button>
      </div>

      <details className="region-notes">
        <summary>本章提示与推荐路线</summary>
        <div className="notes-body">
          {region.notes.map((note, index) => (
            <p key={`${note}-${index}`}>{zhText(note)}</p>
          ))}
          {region.route?.length ? (
            <div className="route-lines">
              {region.route.map((line, index) => (
                <p key={`${line}-${index}`}>{zhText(line).replaceAll("→", " → ")}</p>
              ))}
            </div>
          ) : null}
        </div>
      </details>

      {section === "bosses" && (
        <BossList
          guide={guide}
          progress={progress}
          region={region}
          onToggle={onToggle}
          showLightbox={showLightbox}
        />
      )}

      {section === "tales" && (
        <TaleList
          guide={guide}
          progress={progress}
          tales={regionTales}
          onToggle={onToggle}
          showLightbox={showLightbox}
        />
      )}

      {section === "collect" && (
        <CollectList
          guide={guide}
          progress={progress}
          region={region}
          onToggle={onToggle}
          showLightbox={showLightbox}
        />
      )}

      {section === "ending" && (
        <EndingList guide={guide} progress={progress} onToggle={onToggle} />
      )}
    </div>
  );
}

function BossList({
  guide,
  progress,
  region,
  onToggle,
  showLightbox,
}: {
  guide: Guide;
  progress: Progress;
  region: Region;
  onToggle: (kind: ProgressKind, id: string, value: boolean) => void;
  showLightbox: (images: string[], caption: string, index?: number) => void;
}) {
  if (!region.bosses.length) {
    return <p className="empty">本区域没有记录首领。</p>;
  }
  return (
    <div className="boss-list">
      {sortBosses(region.bosses).map((boss) => (
        <BossRow
          key={boss.id}
          guide={guide}
          progress={progress}
          boss={boss}
          onToggle={onToggle}
          showLightbox={showLightbox}
        />
      ))}
    </div>
  );
}

function BossRow({
  guide,
  progress,
  boss,
  onToggle,
  showLightbox,
}: {
  guide: Guide;
  progress: Progress;
  boss: Boss;
  onToggle: (kind: ProgressKind, id: string, value: boolean) => void;
  showLightbox: (images: string[], caption: string, index?: number) => void;
}) {
  const record = guide.bosses.find((item) => item.id === boss.id) || boss;
  const trophy = bossTrophy(guide, boss);
  const derived = Boolean(trophy && trophy.id && bossDone(guide, progress, boss));
  const checked = bossDone(guide, progress, boss);
  const tips = (record.tips || []).map(zhText);

  return (
    <article className={`boss-row ${checked ? "done" : ""}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={derived}
        onChange={(event) => onToggle("bosses", boss.id, event.target.checked)}
        aria-label={record.name}
      />
      <div className="boss-main">
        <div className="row-title">
          <strong>{record.name}</strong>
          <span className="tag">{record.required ? "主线" : "可选"}</span>
          {trophy && <span className="tag gold">奖杯 · {trophy.name}</span>}
          {checked && <span className="tag done">已完成</span>}
        </div>
        <p className="row-meta">{record.loc}{record.hp ? `　生命 ${record.hp}` : ""}</p>
        {tips.length ? (
          <details className="boss-tips">
            <summary>打法要点（{tips.length}）</summary>
            <ul>
              {tips.map((tip, index) => (
                <li key={`${tip}-${index}`}>{tip}</li>
              ))}
            </ul>
            {record.reward ? <p className="quiet tiny">奖励：{zhText(record.reward)}</p> : null}
          </details>
        ) : null}
      </div>
      {record.images?.length ? (
        <Thumb
          src={record.images[0]}
          count={record.images.length}
          alt={record.name}
          onClick={() => showLightbox(record.images || [], record.name)}
        />
      ) : null}
    </article>
  );
}

function TaleList({
  guide,
  progress,
  tales,
  onToggle,
  showLightbox,
}: {
  guide: Guide;
  progress: Progress;
  tales: Tale[];
  onToggle: (kind: ProgressKind, id: string, value: boolean) => void;
  showLightbox: (images: string[], caption: string, index?: number) => void;
}) {
  if (!tales.length) return <p className="empty">本区域没有记录支线。</p>;
  return (
    <div className="tale-list">
      {tales.map((tale) => {
        const derived = taleDone(guide, progress, tale) && !progress.tales[tale.id];
        const checked = taleDone(guide, progress, tale);
        return (
          <article key={tale.id} className={`tale-row ${checked ? "done" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              disabled={derived}
              onChange={(event) => onToggle("tales", tale.id, event.target.checked)}
              aria-label={tale.name}
            />
            <div className="tale-main">
              <div className="row-title">
                <strong>{tale.name}</strong>
                {tale.type && <span className="tag">{tale.type}</span>}
                {tale.missable && <span className="tag red">易错过</span>}
                {tale.trophyName && <span className="tag gold">奖杯 · {tale.trophyName}</span>}
                {checked && <span className="tag done">已完成</span>}
              </div>
              <p className="row-meta">{tale.location}</p>
              {tale.steps?.length ? (
                <details className="tale-steps">
                  <summary>查看步骤（{tale.steps.length}）</summary>
                  <ol>
                    {tale.steps
                      .filter((step) => !["触发", "任务流程"].includes(step))
                      .map((step, index) => (
                        <li key={`${step}-${index}`}>{zhText(step)}</li>
                      ))}
                  </ol>
                  {tale.reward ? <p className="quiet tiny">奖励：{zhText(tale.reward)}</p> : null}
                </details>
              ) : null}
            </div>
            {tale.images?.length ? (
              <Thumb
                src={tale.images[0]}
                count={tale.images.length}
                alt={tale.name}
                onClick={() => showLightbox(tale.images || [], tale.name)}
              />
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function CollectList({
  guide,
  progress,
  region,
  onToggle,
  showLightbox,
}: {
  guide: Guide;
  progress: Progress;
  region: Region;
  onToggle: (kind: ProgressKind, id: string, value: boolean) => void;
  showLightbox: (images: string[], caption: string, index?: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("core");
  const mobile = useMediaQuery("(max-width: 700px)");
  const [detail, setDetail] = useState<Item | null>(null);
  const [hiddenDetail, setHiddenDetail] = useState<HiddenItem | null>(null);
  const types = useMemo(() => {
    const present = new Set(region.items.map((item) => item.type));
    return Array.from(present).sort();
  }, [region.items]);

  const filtered = useMemo(() => {
    const target = query.trim().toLowerCase();
    return region.items.filter((item) => {
      const inType =
        typeFilter === "all" ||
        (typeFilter === "core" && guide.progressTypes.includes(item.type)) ||
        item.type === typeFilter;
      if (!inType) return false;
      if (!target) return true;
      return `${item.name} ${item.desc || ""}`.toLowerCase().includes(target);
    });
  }, [guide.progressTypes, query, region.items, typeFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    for (const item of filtered) {
      const list = map.get(item.type) || [];
      list.push(item);
      map.set(item.type, list);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div className="collect">
      <div className="collect-toolbar">
        <label>
          类别
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="core">核心收集（{region.items.filter((item) => guide.progressTypes.includes(item.type)).length}）</option>
            <option value="all">全部点位（{region.items.length}）</option>
            {types.map((type) => (
              <option key={type} value={type}>
                {typeLabel(guide, type)}（{region.items.filter((item) => item.type === type).length}）
              </option>
            ))}
          </select>
        </label>
        <input
          className="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索名称或位置提示"
        />
        <span className="quiet tiny">共 {filtered.length} 条</span>
      </div>

      {region.hidden?.length ? (
        <div className="hidden-block">
          <div className="group-head">
            <h3>关键道具与易错过</h3>
            <span>{region.hidden.length}</span>
          </div>
          {region.hidden.map((item) => {
            const checked = hiddenDone(guide, progress, item);
            return (
              <article
                key={item.id}
                className={`collect-row hidden-row ${checked ? "done" : ""}`}
                onClick={(event) => {
                  if (!mobile) return;
                  if ((event.target as HTMLElement).closest("input,button")) return;
                  setDetail(null);
                  setHiddenDetail(item);
                }}
                onKeyDown={(event) => {
                  if (mobile && event.key === "Enter") {
                    setDetail(null);
                    setHiddenDetail(item);
                  }
                }}
                role={mobile ? "button" : undefined}
                tabIndex={mobile ? 0 : undefined}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => onToggle("hiddens", item.id, event.target.checked)}
                  aria-label={item.name}
                />
                <div className="row-main">
                  <div className="row-title">
                    <strong>{item.name}</strong>
                    <span className="tag gold">{item.tag}</span>
                    {item.deadline && (
                      <span className="tag red">截止：{guide.deadlines?.[item.deadline]?.cn}</span>
                    )}
                    {checked && <span className="tag done">已完成</span>}
                  </div>
                  <p className="row-hint">{zhText(item.how)}</p>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {groups.map(([type, items]) => {
        const done = items.filter((item) => entryDone(guide, progress, item.id)).length;
        return (
          <section key={type} className="collect-group">
            <div className="group-head">
              <h3>{typeLabel(guide, type)}</h3>
              <span>
                {done} / {items.length}
              </span>
            </div>
            {items.map((item) => {
              const checked = entryDone(guide, progress, item.id);
              return (
                <article
                  key={item.id}
                  className={`collect-row ${checked ? "done" : ""}`}
                  onClick={(event) => {
                    if (!mobile) return;
                    if ((event.target as HTMLElement).closest("input,button")) return;
                    setDetail(item);
                  }}
                  onKeyDown={(event) => {
                    if (mobile && event.key === "Enter") setDetail(item);
                  }}
                  role={mobile ? "button" : undefined}
                  tabIndex={mobile ? 0 : undefined}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => onToggle("items", item.id, event.target.checked)}
                    aria-label={item.name}
                  />
                  <span className="row-index">{item.n}</span>
                  <div className="row-main">
                    <div className="row-title">
                      <strong>{item.name}</strong>
                      {item.subtype && <span className="tag">{item.subtype}</span>}
                      {checked && <span className="tag done">已拿</span>}
                    </div>
                    {item.desc ? <p className="row-hint">{zhText(item.desc)}</p> : null}
                  </div>
                  {item.images?.length ? (
                    <Thumb
                      src={item.images[0]}
                      count={item.images.length}
                      alt={item.name}
                      onClick={() => showLightbox(item.images || [], item.name)}
                    />
                  ) : null}
                </article>
              );
            })}
          </section>
        );
      })}

      {!filtered.length && <p className="empty">没有匹配的点位。</p>}

      {mobile && detail ? (
        <BottomSheet open title={detail.name} onClose={() => setDetail(null)}>
          <div className="sheet-detail">
            <div className="row-title">
              <strong>{detail.name}</strong>
              <span className="tag">{typeLabel(guide, detail.type)}</span>
              {detail.subtype ? <span className="tag">{detail.subtype}</span> : null}
            </div>
            {detail.desc ? <p className="row-hint">{zhText(detail.desc)}</p> : null}
            {detail.images?.length ? (
              <div className="sheet-images">
                {(detail.images || []).map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    onClick={() => showLightbox(detail.images || [], detail.name, index)}
                    type="button"
                  >
                    <img src={localImageSrc(image)} alt={detail.name} loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
            <label className="check-inline sheet-check">
              <input
                type="checkbox"
                checked={entryDone(guide, progress, detail.id)}
                onChange={(event) =>
                  onToggle("items", detail.id, event.target.checked)
                }
              />
              {entryDone(guide, progress, detail.id) ? "已拿" : "标记为已拿"}
            </label>
          </div>
        </BottomSheet>
      ) : null}

      {mobile && hiddenDetail ? (
        <BottomSheet
          open
          title={hiddenDetail.name}
          onClose={() => setHiddenDetail(null)}
        >
          <div className="sheet-detail">
            <div className="row-title">
              <strong>{hiddenDetail.name}</strong>
              <span className="tag gold">{hiddenDetail.tag}</span>
              {hiddenDetail.deadline ? (
                <span className="tag red">
                  截止：{guide.deadlines?.[hiddenDetail.deadline]?.cn}
                </span>
              ) : null}
            </div>
            <p className="row-hint">{zhText(hiddenDetail.how)}</p>
            <label className="check-inline sheet-check">
              <input
                type="checkbox"
                checked={hiddenDone(guide, progress, hiddenDetail)}
                onChange={(event) =>
                  onToggle("hiddens", hiddenDetail.id, event.target.checked)
                }
              />
              {hiddenDone(guide, progress, hiddenDetail) ? "已完成" : "标记为已完成"}
            </label>
          </div>
        </BottomSheet>
      ) : null}
    </div>
  );
}

function EndingList({
  guide,
  progress,
  onToggle,
}: {
  guide: Guide;
  progress: Progress;
  onToggle: (kind: ProgressKind, id: string, value: boolean) => void;
}) {
  return (
    <div className="ending-list">
      <div className="ending-note">
        <strong>截止点</strong>
        <p>{guide.trueEnding.cutoff}</p>
        <p>{guide.trueEnding.summary}</p>
      </div>
      {guide.trueEnding.quests.map((quest, index) => {
        const checked = trueEndingDone(guide, progress, quest);
        return (
          <article key={quest.id} className={`ending-row ${checked ? "done" : ""}`}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => onToggle("trueEnding", quest.id, event.target.checked)}
              aria-label={quest.name}
            />
            <span className="ending-index">{index + 1}</span>
            <div className="row-main">
              <div className="row-title">
                <strong>{quest.name}</strong>
                {checked && <span className="tag done">已完成</span>}
              </div>
              <p className="row-hint">{zhText(quest.note)}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
