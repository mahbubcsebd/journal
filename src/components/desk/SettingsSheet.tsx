"use client";

import { fmt } from "@/lib/desk/format";
import { useSettings, useT } from "@/lib/desk/settings";
import { inputClass, Modal, Segmented, Switch } from "./ui";

function NumberField({ label, value, onChange, step = 1, min = 0 }: { label: string; value: number; onChange(v: number): void; step?: number; min?: number }) {
  return (
    <label className="block text-[13px] text-mute">
      {label}
      <input
        type="number"
        className={`${inputClass} mt-1 text-ink`}
        value={value}
        step={step}
        min={min}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= min) onChange(v);
        }}
      />
    </label>
  );
}


function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2 text-[13px] font-semibold text-mute">{title}</h3>
      {children}
    </section>
  );
}

export default function SettingsSheet({ telegram, onClose }: { telegram: boolean; onClose(): void }) {
  const { s, set } = useSettings();
  const t = useT();

  const toggleNotify = async (on: boolean) => {
    if (on && "Notification" in window && Notification.permission !== "granted") {
      const answer = await Notification.requestPermission();
      if (answer !== "granted") return set({ alertNotify: false });
    }
    set({ alertNotify: on });
  };
  const notifyBlocked = typeof window !== "undefined" && "Notification" in window && Notification.permission === "denied";

  return (
    <Modal title={t("action.settings")} onClose={onClose}>
      <Group title={t("set.display")}>
        <div className="flex items-center justify-between py-1.5">
          <span>{t("set.language")}</span>
          <Segmented
            label={t("set.language")}
            value={s.lang}
            onChange={(lang) => set({ lang })}
            options={[
              { value: "en", label: "English" },
              { value: "bn", label: "বাংলা" },
            ]}
          />
        </div>
        <Switch label={t("set.localTime")} checked={s.localTime} onChange={(localTime) => set({ localTime })} />
        <p className="text-[13px] text-mute">{t("set.localTime.help")}</p>
      </Group>

      <Group title={t("set.alerts")}>
        <Switch label={t("set.alertToast")} checked={s.alertToast} onChange={(alertToast) => set({ alertToast })} />
        <Switch label={t("set.alertNotify")} checked={s.alertNotify} onChange={toggleNotify} />
        {notifyBlocked && <p className="text-[13px] text-coral">{t("set.notifyBlocked")}</p>}
        <Switch label={t("set.alertSound")} checked={s.alertSound} onChange={(alertSound) => set({ alertSound })} />
        <p className="mt-1 text-[13px] text-mute">{t(telegram ? "set.telegram.on" : "set.telegram.off")}</p>
      </Group>

      <Group title={t("set.risk")}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t("set.balance")} value={s.balance} onChange={(balance) => set({ balance })} step={100} />
          <NumberField label={t("set.riskPct")} value={s.riskPct} onChange={(riskPct) => set({ riskPct })} step={0.25} />
        </div>
        <p className="mt-2 text-[13px] text-mute">{t("set.risk.help", { money: fmt((s.balance * s.riskPct) / 100, 2) })}</p>
      </Group>

      <Group title={t("set.limits")}>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label={t("set.maxTrades")} value={s.maxTrades} onChange={(maxTrades) => set({ maxTrades })} min={1} />
          <NumberField label={t("set.maxLossR")} value={s.maxLossR} onChange={(maxLossR) => set({ maxLossR })} step={0.5} min={0.5} />
        </div>
        <p className="mt-2 text-[13px] text-mute">{t("set.limits.help")}</p>
      </Group>

      <Group title={t("set.shortcuts")}>
        <p className="text-[13px] text-mute">{t("set.shortcuts.help")}</p>
      </Group>
    </Modal>
  );
}
