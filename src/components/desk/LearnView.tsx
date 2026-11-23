"use client";

import { useT } from "@/lib/desk/settings";

const STEPS = ["bias", "wait", "confirm", "risk", "review"] as const;
const TERMS = ["structure", "bos", "choch", "ob", "fvg", "liquidity", "sweep", "pd", "ote", "breaker", "killzone", "judas", "displacement", "mitigation", "r"] as const;
const SCORE = ["displacement", "fvg", "sweep", "location", "fresh"] as const;

export default function LearnView() {
  const t = useT();
  return (
    <div className="brief-scroll min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-[720px]">
        <h1 className="text-[28px] font-semibold tracking-tight">{t("learn.title")}</h1>
        <p className="mt-1 text-mute">{t("learn.lede")}</p>

        <h2 className="mb-3 mt-8 text-[18px] font-semibold">{t("learn.stepsTitle")}</h2>
        <ol className="space-y-3">
          {STEPS.map((k, i) => (
            <li key={k} className="grid grid-cols-[2rem_1fr] gap-x-2">
              <span className="font-semibold tabular-nums text-gold">{i + 1}</span>
              <span>
                <span className="font-semibold">{t(`learn.step.${k}.title`)}</span>
                <span className="block text-mute">{t(`learn.step.${k}.body`)}</span>
              </span>
            </li>
          ))}
        </ol>

        <h2 className="mb-3 mt-10 text-[18px] font-semibold">{t("learn.scoreTitle")}</h2>
        <p className="mb-3 text-mute">{t("learn.scoreLede")}</p>
        <ul className="space-y-2">
          {SCORE.map((k) => (
            <li key={k}>
              <span className="font-semibold">{t(`learn.score.${k}.title`)}</span>
              <span className="text-mute"> {t(`learn.score.${k}.body`)}</span>
            </li>
          ))}
        </ul>

        <h2 className="mb-3 mt-10 text-[18px] font-semibold">{t("learn.termsTitle")}</h2>
        <dl className="divide-y divide-line border-y border-line">
          {TERMS.map((k) => (
            <div key={k} className="grid gap-x-6 gap-y-1 py-3 sm:grid-cols-[11rem_1fr]">
              <dt className="font-semibold">{t(`term.${k}.name`)}</dt>
              <dd className="text-mute">{t(`term.${k}.body`)}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-8 text-[13px] text-mute">{t("disclaimer")}</p>
      </div>
    </div>
  );
}
