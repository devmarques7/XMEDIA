"use client";

import { initials } from "@/lib/studio";
import { useMediaSrc } from "@/lib/media";

/** Avatar redondo: foto (se houver) ou iniciais. */
export function Avatar({ name, photo, size = 32, title, className = "", ring }: { name: string; photo?: string; size?: number; title?: string; className?: string; ring?: boolean }) {
  const src = useMediaSrc(photo || undefined);
  return (
    <span className={`av ${ring ? "ring" : ""} ${className}`} style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }} title={title ?? name}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}

export function AvatarStack({ list, max = 4, size = 26 }: { list: { name: string; photo?: string }[]; max?: number; size?: number }) {
  return (
    <span className="av-stack">
      {list.slice(0, max).map((p, i) => (
        <Avatar key={i} name={p.name} photo={p.photo} size={size} />
      ))}
      {list.length > max && <span className="av av-more" style={{ width: size, height: size }}>+{list.length - max}</span>}
    </span>
  );
}
