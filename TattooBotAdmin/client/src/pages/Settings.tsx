import { SettingsForm } from "@/components/SettingsForm";

export default function Settings() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-white">Настройки</h1>
        <p className="text-sm text-white/60">Токен, контакты и координаты студии для корректной работы бота.</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#141821] p-4 shadow-sm shadow-black/40 md:p-6">
        <SettingsForm />
      </div>
    </div>
  );
}
