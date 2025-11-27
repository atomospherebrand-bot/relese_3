// client/src/pages/Schedule.tsx
import React from "react";

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || "/api";
async function jget<T=any>(path: string): Promise<T> {
  const res = await fetch(API_BASE + path, { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function jpost<T=any>(path: string, body: any): Promise<T> {
  const res = await fetch(API_BASE + path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

type Master = { id: string; name: string; nickname?: string; isActive?: boolean };
type DayCfg = { isWorking: boolean; start?: string; end?: string; note?: string };

function ruWeekday(d: Date) { return (d.getDay() + 6) % 7; } // 0=Mon..6=Sun
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function fmtYM(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; }
function dayKey(d: Date) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

export default function SchedulePage() {
  const [masters, setMasters] = React.useState<Master[]>([]);
  const [selectedMaster, setSelectedMaster] = React.useState<string>("");
  const [month, setMonth] = React.useState<Date>(() => {
    const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const ym = React.useMemo(() => fmtYM(month), [month]);
  const [map, setMap] = React.useState<Record<string, DayCfg>>({});
  const [defStart, setDefStart] = React.useState("10:00");
  const [defEnd, setDefEnd] = React.useState("20:00");
  const defaultsRef = React.useRef({ start: "10:00", end: "20:00" });
  const pendingTimers = React.useRef<Record<string, NodeJS.Timeout>>({});
  const [err, setErr] = React.useState<string | null>(null);

  const applyUpdate = React.useCallback(
    (updates: Record<string, DayCfg>, nextDefaults?: { start: string; end: string }) => {
      setMap((prev) => ({ ...prev, ...updates }));
      if (!selectedMaster) return;
      setErr(null);
      const defaultsPayload = nextDefaults ?? defaultsRef.current;
      jpost<{ days: Record<string, DayCfg>; defaults?: { start?: string; end?: string } }>(
        `/masters/${selectedMaster}/availability`,
        { update: updates, ym, defaults: defaultsPayload },
      )
        .then((response) => {
          if (response?.days) {
            setMap((prev) => ({ ...prev, ...response.days }));
          }
          if (response?.defaults?.start) setDefStart(response.defaults.start);
          if (response?.defaults?.end) setDefEnd(response.defaults.end);
        })
        .catch((e) => setErr(String(e)));
    },
    [selectedMaster, ym],
  );

  React.useEffect(() => {
    jget<{masters: Master[]}>("/masters").then(d => {
      setMasters(d.masters || []);
      const first = (d.masters || []).find(m => m.isActive) || (d.masters || [])[0];
      if (first?.id) setSelectedMaster(first.id);
    }).catch(e => setErr(String(e)));
  }, []);

  React.useEffect(() => {
    return () => {
      Object.values(pendingTimers.current).forEach((t) => clearTimeout(t));
    };
  }, []);

  React.useEffect(() => {
    setMap({});
    setErr(null);
    if (!selectedMaster) return;
    jget<{days: Record<string, DayCfg>; defaults?: { start?: string; end?: string } }>(`/masters/${selectedMaster}/availability?ym=${ym}`)
      .then((d) => {
        setMap(d.days || {});
        if (d.defaults?.start) setDefStart(d.defaults.start);
        if (d.defaults?.end) setDefEnd(d.defaults.end);
        defaultsRef.current = {
          start: d.defaults?.start || defaultsRef.current.start,
          end: d.defaults?.end || defaultsRef.current.end,
        };
      })
      .catch((e) => setErr(String(e)));
  }, [selectedMaster, ym]);

  React.useEffect(() => {
    const prev = defaultsRef.current;
    if (prev.start === defStart && prev.end === defEnd) return;

    const updates: Record<string, DayCfg> = {};
    Object.entries(map).forEach(([date, cfg]) => {
      if (!cfg?.isWorking) return;
      const nextStart = cfg.start?.trim() || defStart;
      const nextEnd = cfg.end?.trim() || defEnd;
      const needsUpdate =
        (!cfg.start && defStart !== prev.start) ||
        (!cfg.end && defEnd !== prev.end) ||
        (cfg.start === prev.start && defStart !== prev.start) ||
        (cfg.end === prev.end && defEnd !== prev.end);

      if (needsUpdate) {
        updates[date] = { ...cfg, isWorking: true, start: nextStart, end: nextEnd };
      }
    });

    const nextDefaults = { start: defStart, end: defEnd };
    defaultsRef.current = nextDefaults;

    if (Object.keys(updates).length > 0) {
      applyUpdate(updates, nextDefaults);
    } else if (prev.start !== defStart || prev.end !== defEnd) {
      // прогоняем пустое обновление, чтобы зафиксировать дефолтные часы
      applyUpdate({}, nextDefaults);
    }
  }, [defStart, defEnd, map, applyUpdate]);

  const days: (Date | null)[] = React.useMemo(() => {
    const first = startOfMonth(month);
    const last = endOfMonth(month);
    const lead = ruWeekday(first);
    const total = lead + last.getDate();
    const rows = Math.ceil(total / 7) * 7;
    const arr: (Date | null)[] = [];
    for (let i = 0; i < lead; i++) arr.push(null);
    for (let d = 1; d <= last.getDate(); d++) arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (arr.length < rows) arr.push(null);
    return arr;
  }, [month]);

  const toggleDay = (d: Date) => {
    const k = dayKey(d);
    const cur = map[k] || { isWorking: false };
    const next = { ...cur, isWorking: !cur.isWorking, start: cur.start || defStart, end: cur.end || defEnd };
    applyUpdate({ [k]: next });
  };

  const setDayHours = (d: Date, start: string, end: string) => {
    const k = dayKey(d);
    const cur = map[k] || { isWorking: true };
    const next = { ...cur, isWorking: true, start, end };
    setMap((prev) => ({ ...prev, [k]: next }));

    if (pendingTimers.current[k]) {
      clearTimeout(pendingTimers.current[k]);
    }

    pendingTimers.current[k] = setTimeout(() => {
      applyUpdate({ [k]: next });
      delete pendingTimers.current[k];
    }, 5000);
  };

  return (
    <div className="p-6 space-y-4">
      {err && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">График работы мастеров</h1>
        <div className="flex gap-3 items-center">
          <select value={selectedMaster} onChange={(e)=>setSelectedMaster(e.target.value)} className="rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500">
            {masters.map(m => <option key={m.id} value={m.id}>{m.name}{m.nickname ? ` (@${m.nickname})` : ""}</option>)}
          </select>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-sm text-white/60">По умолчанию:</span>
            <input type="time" value={defStart} onChange={(e)=>setDefStart(e.target.value)} className="bg-black/20 border border-white/10 rounded px-2 py-1 text-sm" />
            <span>—</span>
            <input type="time" value={defEnd} onChange={(e)=>setDefEnd(e.target.value)} className="bg-black/20 border border-white/10 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))} className="rounded-md bg-white/10 px-2 py-1">«</button>
            <div className="w-40 text-center">{month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}</div>
            <button onClick={()=>setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))} className="rounded-md bg-white/10 px-2 py-1">»</button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#1c1f26] p-4">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-white/60 mb-2">
          <div>Пн</div><div>Вт</div><div>Ср</div><div>Чт</div><div>Пт</div><div>Сб</div><div>Вс</div>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((d, idx) => {
            if (d === null) return <div key={"b"+idx} />;
            const k = dayKey(d);
            const v = map[k];
            const isWorking = v?.isWorking ?? false;
            const hours = isWorking ? (v?.start || defStart) + "–" + (v?.end || defEnd) : "выходной";
            return (
              <div key={k} className={"relative h-28 rounded-lg border text-left p-2 transition select-none " + (isWorking ? "border-emerald-500/40 bg-emerald-500/10" : "border-white/10 bg-white/5")}>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-white/70">{d.getDate()}</div>
                  <div className="flex gap-1">
                    <button onClick={()=>toggleDay(d)} className="text-[11px] px-2 py-0.5 rounded bg-white/10 hover:bg-white/20">{isWorking ? "выходной" : "рабочий"}</button>
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 right-2 text-[11px] text-white/70 flex items-center justify-between gap-2">
                  <span>{hours}</span>
                  {isWorking && (
                    <div className="flex items-center gap-1">
                      <input type="time" value={v?.start || defStart} onChange={(e)=>setDayHours(d, e.target.value, v?.end || defEnd)} className="bg-black/20 border border-white/10 rounded px-1 py-0.5 text-[11px]" />
                      <span>—</span>
                      <input type="time" value={v?.end || defEnd} onChange={(e)=>setDayHours(d, v?.start || defStart, e.target.value)} className="bg-black/20 border border-white/10 rounded px-1 py-0.5 text-[11px]" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
