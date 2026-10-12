"use client";

import { useState } from "react";
import type { OnboardingProgress } from "@/lib/types";
import type { Section } from "./workspace";

export type WizardStep = { title: string; description: string; section?: Section; ready: boolean; required: boolean };

export default function FirstRun({ steps, progress, busy, error, onSave, onNavigate, onLater }: {
  steps: WizardStep[]; progress: OnboardingProgress | null; busy: boolean; error: string;
  onSave: (step: number, completed: boolean) => Promise<void>;
  onNavigate: (section: Section) => void; onLater: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const index = Math.min(progress?.step ?? 0, steps.length - 1);
  const step = steps[index];
  const blocked = step.required && !step.ready;
  async function save(next: number, complete: boolean) {
    setSaving(true);
    try { await onSave(next, complete); } finally { setSaving(false); }
  }
  return <section className="card first-run" aria-label="Einrichtungsassistent">
    <div className="section-heading"><span className="eyebrow">Deine Ersteinrichtung · Schritt {index + 1} von {steps.length}</span><button className="secondary compact" disabled={busy || saving} onClick={onLater}>Später fortsetzen</button></div>
    <progress max={steps.length} value={index + 1} aria-label="Fortschritt der Ersteinrichtung" />
    <h2>{step.title}</h2><p>{step.description}</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    <div className="actions">
      {step.section && <button className="secondary" disabled={busy || saving} onClick={() => onNavigate(step.section!)}>Diesen Schritt öffnen →</button>}
      <button disabled={busy || saving || index === 0} className="secondary" onClick={() => save(index - 1, false)}>Zurück</button>
      <button disabled={busy || saving || blocked} onClick={() => save(index + 1, index === steps.length - 1)}>{saving ? "Wird gespeichert …" : index === steps.length - 1 ? "Einrichtung abschliessen" : blocked ? "Voraussetzung noch offen" : step.required ? "Weiter" : "Verstanden / Weiter"}</button>
    </div>
    {blocked && <p className="muted">Die Einrichtung wird nicht mit stillen Standardwerten abgeschlossen. Bitte die offene Voraussetzung zuerst erfüllen.</p>}
    <p className="muted">Fortschritt wird für deinen Zugang gespeichert. Diese Einführung erstellt keine Arbeitszeitbuchung.</p>
  </section>;
}
