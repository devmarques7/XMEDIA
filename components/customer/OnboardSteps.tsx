"use client";

// Passos do onboarding do portal: Código → Email → Instagram (mesma moldura de duas colunas, AuthSplit).
import { Icon } from "@/components/Icon";
import { useT, type Key } from "@/lib/i18n";

export const OB_STEPS = ["code", "email", "ig"] as const;
export type ObStep = (typeof OB_STEPS)[number];

export function OnboardSteps({ step, done = [] }: { step: ObStep; done?: ObStep[] }) {
  const { t } = useT();
  const i = OB_STEPS.indexOf(step);
  return (
    <ol className="ac2-steps ob-steps" aria-label="onboarding">
      {OB_STEPS.map((k, j) => (
        <li key={k} className={j === i ? "on" : j < i || done.includes(k) ? "done" : ""}>
          <i>{j < i || done.includes(k) ? <Icon name="check" size={12} /> : j + 1}</i>
          <span>{t(`ob.${k}` as Key)}</span>
        </li>
      ))}
    </ol>
  );
}
