"use client";

// Pré-visualização do Instagram no editor: perfil, ficheiro(s) com setas e pontos no carrossel, ações e legenda
// com "mais". Reels e stories em 9:16; posts e carrosséis em 4:5 — como aparecem no feed.
import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { hasCover, type ContentPost } from "@/lib/customer";
import { useT } from "@/lib/i18n";
import { Avatar } from "@/components/team/Avatar";
import { Cover, Video } from "./parts";

export function IgPreview({ post, handle, picture }: { post: Pick<ContentPost, "type" | "media" | "cover" | "caption">; handle?: string; picture?: string }) {
  const { t } = useT();
  const items = post.media.length ? post.media : post.cover ? [{ src: post.cover, kind: "image" as const }] : [];
  const [i, setI] = useState(0);
  const [more, setMore] = useState(false);
  useEffect(() => setI((x) => Math.min(x, Math.max(0, items.length - 1))), [items.length]);
  const tall = post.type === "reel" || post.type === "story";
  const cur = items[i];
  const name = handle || "instagram";
  const long = post.caption.length > 110;
  return (
    <div className="igp" data-testid="ig-preview">
      <header className="igp-head">
        <Avatar name={name} photo={picture} size={28} />
        <b>{name}</b>
        <Icon name="more" size={16} />
      </header>
      <div className={`igp-media ${tall ? "tall" : ""}`}>
        {!cur ? (
          <span className="igp-empty muted small">
            <Icon name="image" size={22} />
            {t("igp.empty")}
          </span>
        ) : cur.kind === "video" ? (
          <Video src={cur.src} className="igp-fill" poster={hasCover(post.type) ? post.cover : undefined} />
        ) : (
          <Cover src={cur.src} />
        )}
        {items.length > 1 && (
          <>
            {i > 0 && (
              <button className="igp-nav prev" onClick={() => setI(i - 1)} aria-label={t("cal.prev")}>
                <Icon name="chevronLeft" size={16} />
              </button>
            )}
            {i < items.length - 1 && (
              <button className="igp-nav next" onClick={() => setI(i + 1)} aria-label={t("cal.next")} data-testid="igp-next">
                <Icon name="chevron" size={16} />
              </button>
            )}
            <span className="igp-count mono">
              {i + 1}/{items.length}
            </span>
          </>
        )}
      </div>
      <div className="igp-actions">
        <Icon name="heart" size={20} />
        <Icon name="chat" size={20} />
        <Icon name="send" size={20} />
        {items.length > 1 && (
          <span className="igp-dots" aria-hidden>
            {items.map((_, k) => (
              <i key={k} className={k === i ? "on" : ""} />
            ))}
          </span>
        )}
        <Icon name="bookmark" size={20} className="igp-save" />
      </div>
      <p className="igp-caption">
        <b>{name}</b> {post.caption ? (long && !more ? post.caption.slice(0, 110) : post.caption) : <span className="muted">{t("igp.noCaption")}</span>}
        {long && !more && (
          <button className="igp-more" onClick={() => setMore(true)}>
            … {t("igp.more")}
          </button>
        )}
      </p>
    </div>
  );
}
