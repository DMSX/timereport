"use client";

import { useState } from "react";
import { minutesLabel } from "@/lib/time";
import type { WorkModel } from "@/lib/types";

const weekdays = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export default function WorkSchedule({ model, today, busy, onSubmit }: {
  model: WorkModel | undefined; today: string; busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const [hours, setHours] = useState(() => weekdays.map((_, i) => String((model?.weekday_minutes[i] ?? (i < 5 ? 480 : 0)) / 60)));
  const [mode, setMode] = useState(model?.mode ?? "hourly");
  const weekly = hours.reduce((sum, h) => sum + Math.round((Number(h) || 0) * 60), 0);
  return <form onSubmit={onSubmit}>
    <label>Zeiterfassungsmodell<select name="mode" value={mode} onChange={(e) => setMode(e.target.value === "hourly" ? "hourly" : "scheduled")}><option value="hourly">Stundenbasis – ohne Soll</option><option value="scheduled">Arbeitszeit mit Soll</option></select></label>
    <label>Gültig ab<input name="from" type="date" required defaultValue={today} /></label>
    {mode === "hourly" ? <p className="notice">Nur tatsächlich erfasste Stunden. Kein Soll, kein Plus-/Minussaldo und keine automatische Prüfung auf fehlende Buchungen. Abwesenheiten sind Dokumentation, keine berechnete Stundengutschrift oder Lohnabrechnung.</p> : <>
    <div className="schedule-total"><span>Wochen-Soll</span><strong>{minutesLabel(weekly)} <small>Stunden</small></strong></div>
    <p className="muted">Stunden auf die Wochentage verteilen, z. B. 8 oder 8,5. Die Tageswerte werden auf volle Minuten gerundet.</p>
    <div className="form-grid weekdays">{weekdays.map((day, i) => <label key={day}>{day}<input name={`day${i}`} type="number" min={0} max={24} step="any" value={hours[i]} onChange={(e) => setHours((values) => values.map((v, j) => i === j ? e.target.value : v))} required /></label>)}</div>
    <div className="form-grid"><label>Geplanter Beginn (optional)<input name="start" type="time" defaultValue={model?.planned_start?.slice(0, 5) ?? ""} /></label><label>Geplantes Ende (optional)<input name="end" type="time" defaultValue={model?.planned_end?.slice(0, 5) ?? ""} /></label></div>
    </>}
    <button disabled={busy}>Arbeitsmodell speichern</button>
  </form>;
}
