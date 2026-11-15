import { localImageSrc } from "../helpers";

export function Thumb({
  src,
  count,
  alt,
  onClick,
}: {
  src: string;
  count?: number;
  alt: string;
  onClick: () => void;
}) {
  return (
    <button
      className="thumb"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      type="button"
      title="查看本地截图"
    >
      <img src={localImageSrc(src)} alt={alt} loading="lazy" />
      {count && count > 1 ? <span>{count}</span> : null}
    </button>
  );
}
