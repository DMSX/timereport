"use client";

import type { Member, ReportSetting, WorkModel } from "@/lib/types";

export default function ReportRuleForm({ members, setting, model, busy, onSubmit }: {
  members: Member[]; setting?: ReportSetting; model: WorkModel; busy: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return <form onSubmit={onSubmit}>
    <p className="muted">Optional für Soll-Modelle: Zuständige müssen HR/Admin dieser Firma sein. Der geplante Beginn bestimmt die Frist, für Halbtage ist auch ein Ende erforderlich.</p>
    <label className="check"><input name="enabled" type="checkbox" defaultChecked={setting?.enabled} /> Fehlende Zeiterfassung prüfen</label>
    <div className="form-grid"><label>Zuständige Person<select name="responsible" defaultValue={setting?.responsible_id ?? ""}><option value="">Bitte wählen</option>{members.filter((m) => m.role !== "employee").map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name}</option>)}</select></label>
      <label>Frist nach Arbeitsbeginn (Minuten)<input name="delay" type="number" min={1} max={720} defaultValue={setting?.delay_minutes ?? ""} /></label></div>
    {setting?.enabled && !model.planned_start && <p className="notice error">Geplanter Arbeitsbeginn fehlt: keine Fehlbuchungshinweise. Bitte Modell ergänzen.</p>}
    {setting?.enabled && !members.some((m) => m.user_id === setting.responsible_id && m.role !== "employee") && <p className="notice error">Zuständigkeit nicht mehr gültig. Bitte HR/Admin zuweisen.</p>}
    <button disabled={busy} className="secondary">Hinweisregeln speichern</button>
  </form>;
}
