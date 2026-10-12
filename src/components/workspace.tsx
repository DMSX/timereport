"use client";

import Link from "next/link";

export const sections = {
  time: { title: "Mein Arbeitstag", description: "Deine Zeit im Blick. Ein Projekt wählen und loslegen.", group: "Arbeitsplatz" },
  history: { title: "Zeitbuchungen", description: "Arbeitsblöcke prüfen, nachtragen und korrigieren.", group: "Arbeitsplatz" },
  absences: { title: "Abwesenheiten", description: "Ferien planen, Krankheit erfassen und Anträge verfolgen.", group: "Arbeitsplatz" },
  report: { title: "Monatsrapport", description: "Arbeitszeit, Soll und Abwesenheiten in einem Auszug.", group: "Arbeitsplatz" },
  notifications: { title: "Hinweise", description: "Fehlende Zeiterfassung prüfen, erinnern und nachvollziehbar klären.", group: "Arbeitsplatz" },
  team: { title: "Team", description: "Menschen, Rollen und Arbeitsmodelle übersichtlich verwalten.", group: "Verwaltung" },
  projects: { title: "Projekte", description: "Projekte organisieren und Mitarbeitende zuweisen.", group: "Verwaltung" },
  settings: { title: "Firmenregeln", description: "Pausen, Korrekturfristen und Freigaben für dein Team.", group: "Verwaltung" },
  billing: { title: "Firmenabo", description: "Abo und Rechnungen zentral verwalten.", group: "Verwaltung" },
  operator: { title: "SaaS-Verwaltung", description: "Firmen aufnehmen und Freischaltungen verwalten.", group: "Betreiber" },
} as const;
export type Section = keyof typeof sections;

export function isSection(value: string): value is Section {
  return Object.hasOwn(sections, value);
}

const paths: Record<Section, string> = {
  time: "M12 8v4l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  history: "M8 6h12M8 12h12M8 18h12M3 6h1M3 12h1M3 18h1",
  absences: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2M8 14h3M8 17h6",
  report: "M5 3h10l4 4v14H5ZM15 3v5h4M8 17v-3M12 17v-6M16 17v-4",
  team: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 4a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-4-4M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  projects: "M3 7V4h7l2 3h9v13H3ZM3 10h18",
  settings: "M4 7h16M4 17h16M8 4v6M16 14v6",
  billing: "M3 5h18v14H3ZM3 9h18M7 15h4",
  operator: "M3 21V8h8v13M11 21V3h10v18M6 12h2M6 16h2M14 7h4M14 11h4M14 15h4",
  notifications: "M18 8a6 6 0 0 0-12 0v6l-2 3h16l-2-3ZM10 21h4",
};
export function Icon({ name }: { name: Section }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export function WorkspaceNav({ allowed, current, name, role, busy, onNavigate, onSignOut }: {
  allowed: Section[]; current: Section; name: string; role: string; busy: boolean;
  onNavigate: (section: Section) => void; onSignOut: () => void;
}) {
  return <aside className="sidebar">
    <Link className="brand" href="/"><span className="brand-mark">T</span>TimeReport<span className="brand-country">CH</span></Link>
    <p className="sidebar-caption">Mehr Klarheit. Jeden Tag.</p>
    <nav aria-label="Hauptnavigation">
      {["Arbeitsplatz", "Verwaltung", "Betreiber"].map((group) => {
        const items = allowed.filter((key) => sections[key].group === group);
        return items.length > 0 && <div className="nav-group" key={group}>
          <span className="nav-label">{group}</span>
          {items.map((key) => <a key={key} href={`#${key}`} aria-current={current === key ? "page" : undefined}
            aria-disabled={busy || undefined} onClick={(event) => { event.preventDefault(); if (!busy) onNavigate(key); }}>
            <Icon name={key} /><span>{sections[key].title}</span>
          </a>)}
        </div>;
      })}
    </nav>
    <div className="sidebar-profile">
      <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
      <div><strong>{name}</strong><small>{role}</small></div>
      <button className="sign-out" disabled={busy} onClick={onSignOut} aria-label="Abmelden" title="Abmelden">↗</button>
    </div>
  </aside>;
}
