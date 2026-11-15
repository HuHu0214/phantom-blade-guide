import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import type {
  Guide,
  MapData,
  MapManifest,
  MapManifestEntry,
} from "../../shared/types";
import {
  categoryCn,
  localImageSrc,
  mapNormEn,
} from "../helpers";
import { Thumb } from "../components/Thumb";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface MapPoint {
  id: string;
  label: string;
  category: string;
  images: string[];
  position: [number, number];
}

export function MapPage({
  guide,
  mapRegion,
  onMapRegion,
  showLightbox,
}: {
  guide: Guide;
  mapRegion: string;
  onMapRegion: (id: string) => void;
  showLightbox: (images: string[], caption: string, index?: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const manifestRef = useRef<MapManifest | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [query, setQuery] = useState("");
  const [onlyImages, setOnlyImages] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const mobile = useMediaQuery("(max-width: 960px)");
  const [sheetOpen, setSheetOpen] = useState(false);

  const region = guide.mapRegions.find((item) => item.id === mapRegion) || guide.mapRegions[0];

  useEffect(() => {
    let cancelled = false;
    let resizeTimer: number | null = null;
    const container = containerRef.current;
    if (!container) return;

    async function load() {
      setLoading(true);
      setError("");
      setSelected(null);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();
      try {
        const [manifestData, mapData] = await Promise.all([
          manifestRef.current
            ? Promise.resolve(manifestRef.current)
            : fetch("/map/data/manifest.json").then((response) => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.json() as Promise<MapManifest>;
              }),
          fetch(`/map/data/maps/${region.id}.json`).then((response) => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.json() as Promise<MapData>;
          }),
        ]);
        if (cancelled) return;
        manifestRef.current = manifestData;

        const manifestMap: MapManifestEntry | undefined = manifestData.maps.find(
          (item) => String(item.id) === region.id
        );
        const catalogs = new Map<string, string>();
        for (const group of manifestMap?.catalogGroups || []) {
          for (const catalog of group.catalogs || []) {
            if (catalog.name) catalogs.set(catalog.id, catalog.name);
          }
        }
        const zhNames = guide.mapZhNames?.[region.id] || {};
        const nextPoints: MapPoint[] = (mapData.landmarks || []).map((landmark) => {
          const category = categoryCn(catalogs.get(landmark.catalogId));
          const zh = zhNames[mapNormEn(landmark.name)];
          return {
            id: String(landmark.id),
            label: zh || `${category}点位`,
            category,
            images: landmark.images || [],
            position: landmark.position,
          };
        });

        const map = L.map(container, {
          crs: L.CRS.EPSG3857,
          center: [region.center[1], region.center[0]],
          zoom: Math.min(region.defaultZoom + 1, region.maxZoom),
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
          zoomControl: true,
          attributionControl: false,
        });
        mapRef.current = map;

        L.tileLayer(`/map${region.tileUrl}`, {
          tileSize: region.tileSize,
          minZoom: region.minZoom,
          maxZoom: region.maxZoom,
          bounds: [
            [region.bounds[1], region.bounds[0]],
            [region.bounds[3], region.bounds[2]],
          ],
          noWrap: true,
        }).addTo(map);

        resizeTimer = window.setTimeout(() => {
          if (!cancelled) map.invalidateSize();
        }, 60);

        for (const landmark of mapData.landmarks || []) {
          const category = catalogs.get(landmark.catalogId) || "";
          const categoryLabel = categoryCn(category);
          const zh = zhNames[mapNormEn(landmark.name)];
          const label = zh || `${categoryLabel}点位`;
          const catalog = (manifestMap?.catalogGroups || [])
            .flatMap((group) => group.catalogs || [])
            .find((item) => item.id === landmark.catalogId);
          const icon = catalog?.iconUrl
            ? L.icon({
                iconUrl: localImageSrc(catalog.iconUrl),
                iconSize: [22, 22],
                iconAnchor: [11, 11],
              })
            : L.divIcon({
                className: "map-dot",
                html: "<span></span>",
                iconSize: [14, 14],
                iconAnchor: [7, 7],
              });
          const marker = L.marker([landmark.position[1], landmark.position[0]], {
            icon,
            title: label,
            zIndexOffset: typeof landmark.z === "number" ? landmark.z : 0,
          });
          marker.bindPopup(`<strong>${escapeHtml(label)}</strong><br>${escapeHtml(categoryLabel)}`);
          marker.on("click", () => setSelected(String(landmark.id)));
          marker.addTo(map);
          markersRef.current.set(String(landmark.id), marker);
        }

        setPoints(nextPoints);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            `本地地图素材未找到（${loadError instanceof Error ? loadError.message : "加载失败"}）。请在项目目录运行 scripts/fetch-map-assets.ps1 后再刷新。`
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current.clear();
    };
  }, [guide.mapZhNames, region.id]);

  const filtered = useMemo(() => {
    const target = query.trim().toLowerCase();
    return points.filter((point) => {
      if (onlyImages && !point.images.length) return false;
      if (!target) return true;
      return `${point.label} ${point.category}`.toLowerCase().includes(target);
    });
  }, [onlyImages, points, query]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const visible = new Set(filtered.map((point) => point.id));
    for (const point of points) {
      const marker = markersRef.current.get(point.id);
      if (!marker) continue;
      if (visible.has(point.id)) {
        if (!map.hasLayer(marker)) marker.addTo(map);
      } else if (map.hasLayer(marker)) {
        map.removeLayer(marker);
      }
    }
  }, [filtered, points]);

  function focusPoint(point: MapPoint) {
    const map = mapRef.current;
    const marker = markersRef.current.get(point.id);
    if (!map || !marker) return;
    setSelected(point.id);
    map.setView([point.position[1], point.position[0]], Math.max(map.getZoom(), 12));
    marker.openPopup();
    if (mobile) setSheetOpen(false);
  }

  return (
    <div className="page map-page">
      <header className="page-head">
        <div>
          <span className="kicker">本地地图</span>
          <h1>游戏地图</h1>
          <p className="quiet">地图瓦片与点位截图都在本机，不跳外链。</p>
        </div>
      </header>

      <div className="map-chapters">
        {guide.mapRegions.map((item) => (
          <button
            key={item.id}
            className={item.id === region.id ? "active" : ""}
            onClick={() => onMapRegion(item.id)}
            type="button"
          >
            {item.cn}
          </button>
        ))}
      </div>

      <div className="map-toolbar">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索点位名称"
          className="search"
        />
        <label className="check-inline">
          <input
            type="checkbox"
            checked={onlyImages}
            onChange={(event) => setOnlyImages(event.target.checked)}
          />
          只看有截图
        </label>
        {mobile ? (
          <button
            className={`btn small map-sheet-toggle ${sheetOpen ? "active" : ""}`}
            onClick={() => setSheetOpen((value) => !value)}
            type="button"
          >
            点位列表 {filtered.length}
          </button>
        ) : null}
        <span className="quiet tiny">
          显示 {filtered.length} / {points.length} 个点位
        </span>
      </div>

      <div className="map-layout">
        <div className="map-frame">
          {loading ? <div className="map-loading">正在读取本地地图…</div> : null}
          {error ? <div className="map-error">{error}</div> : null}
          <div ref={containerRef} className="map-canvas" />
        </div>

        <aside className={`map-side ${mobile ? "mobile" : ""} ${sheetOpen ? "open" : ""}`}>
          <div
            className="map-side-head"
            onClick={() => {
              if (mobile) setSheetOpen((value) => !value);
            }}
            onKeyDown={(event) => {
              if (mobile && event.key === "Enter") setSheetOpen((value) => !value);
            }}
            role={mobile ? "button" : undefined}
            tabIndex={mobile ? 0 : undefined}
          >
            <strong>{region.cn}</strong>
            <span>
              {filtered.length} 个点位
              {mobile ? (sheetOpen ? " · 收起" : " · 展开") : ""}
            </span>
          </div>
          <div className="map-list">
            {filtered.map((point) => (
              <div
                key={point.id}
                className={`map-item ${selected === point.id ? "active" : ""}`}
                onClick={() => focusPoint(point)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter") focusPoint(point);
                }}
              >
                <div className="map-item-main">
                  <strong>{point.label}</strong>
                  <span>{point.category}</span>
                </div>
                {point.images.length ? (
                  <Thumb
                    src={point.images[0]}
                    count={point.images.length}
                    alt={point.label}
                    onClick={() => showLightbox(point.images, point.label)}
                  />
                ) : (
                  <span className="map-no-image">无图</span>
                )}
              </div>
            ))}
            {!filtered.length && !loading && !error ? (
              <p className="empty">没有匹配的点位。</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char] as string));
}
