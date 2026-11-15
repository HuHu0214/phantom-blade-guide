import { useEffect, useRef, useState } from "react";
import { localImageSrc } from "../helpers";

export interface LightboxState {
  images: string[];
  caption: string;
  index?: number;
}

export function Lightbox({
  state,
  onClose,
}: {
  state: LightboxState | null;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    setIndex(state?.index ?? 0);
  }, [state]);

  useEffect(() => {
    if (!state) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") {
        setIndex((current) => Math.min(current + 1, state.images.length - 1));
      }
      if (event.key === "ArrowLeft") {
        setIndex((current) => Math.max(current - 1, 0));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state, onClose]);

  if (!state || !state.images.length) return null;
  const images = state.images.map(localImageSrc).filter(Boolean);
  const current = images[Math.min(index, images.length - 1)];

  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true">
      <button className="lightbox-close" onClick={onClose} aria-label="关闭">
        ×
      </button>
      <div
        className="lightbox-stage"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStart.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStart.current;
          if (!start) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            setIndex((current) =>
              dx > 0
                ? Math.max(current - 1, 0)
                : Math.min(current + 1, images.length - 1)
            );
          } else if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
            onClose();
          }
          touchStart.current = null;
        }}
      >
        <img src={current} alt={state.caption} />
        <div className="lightbox-caption">
          {state.caption}
          <span>
            {index + 1} / {images.length}
          </span>
        </div>
        {images.length > 1 && (
          <div className="lightbox-thumbs">
            {images.map((src, itemIndex) => (
              <button
                key={`${src}-${itemIndex}`}
                className={itemIndex === index ? "active" : ""}
                onClick={() => setIndex(itemIndex)}
                aria-label={`第 ${itemIndex + 1} 张`}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
