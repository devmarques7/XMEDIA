"use client";

// Zona única de importação por drag & drop: aceita vários ficheiros de uma vez, aplica as regras do destino
// (lib/uploadRules) e mostra onde soltar. Clicar abre o seletor como alternativa.
import { useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { UPLOAD_RULES, checkFiles, type DropTarget } from "@/lib/uploadRules";
import { useT, type Key } from "@/lib/i18n";

export function DropZone({
  target,
  existing = 0,
  onFiles,
  children,
  className = "",
  compact,
  busy,
  disabled,
  testId,
  noPick,
}: {
  target: DropTarget;
  existing?: number;
  onFiles: (files: File[]) => unknown;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  busy?: boolean | number;
  disabled?: boolean;
  testId?: string;
  noPick?: boolean;
}) {
  const { t } = useT();
  const [over, setOver] = useState(false);
  const [msg, setMsg] = useState("");
  const depth = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const rule = UPLOAD_RULES[target];

  function take(list: File[]) {
    if (disabled || !list.length) return;
    const { ok, rejected } = checkFiles(target, list, existing);
    const type = rejected.filter((r) => r.reason === "type").length;
    const limit = rejected.filter((r) => r.reason === "limit").length;
    setMsg([type ? t("dz.type", { n: type }) : "", limit ? t("dz.limit", { n: limit, max: rule.max }) : ""].filter(Boolean).join(" "));
    if (ok.length) onFiles(ok);
  }
  const hasFiles = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");

  return (
    <div
      className={`dz ${over ? "over" : ""} ${compact ? "compact" : ""} ${disabled ? "off" : ""} ${className}`}
      data-testid={testId}
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current++;
        setOver(true);
      }}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        if (--depth.current <= 0) (depth.current = 0), setOver(false);
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        e.stopPropagation();
        depth.current = 0;
        setOver(false);
        take([...e.dataTransfer.files]);
      }}
    >
      {children ?? (
        <button type="button" className="dz-face" onClick={() => input.current?.click()} disabled={disabled}>
          <Icon name="upload" size={compact ? 16 : 22} />
          <span className="dz-txt">
            <b>{busy ? t("dz.uploading", { n: typeof busy === "number" ? busy : "" }) : t(`dz.hint.${target}` as Key)}</b>
            {!compact && <span className="muted small">{t("dz.or")}</span>}
          </span>
        </button>
      )}
      {children && !noPick && (
        <button type="button" className="dz-pick" onClick={() => input.current?.click()} disabled={disabled} aria-label={t(`dz.hint.${target}` as Key)}>
          <Icon name="upload" size={14} />
        </button>
      )}
      <input ref={input} type="file" hidden accept={rule.accept} multiple={rule.max > 1} onChange={(e) => (take([...(e.target.files ?? [])]), (e.target.value = ""))} />
      {over && (
        <div className="dz-over" aria-hidden>
          <Icon name="upload" size={22} />
          <b>{t("dz.drop")}</b>
          <span className="small">{t(`dz.hint.${target}` as Key)}</span>
        </div>
      )}
      {msg && (
        <p className="dz-msg small" role="status" onClick={() => setMsg("")}>
          <Icon name="alert" size={13} /> {msg}
        </p>
      )}
    </div>
  );
}
