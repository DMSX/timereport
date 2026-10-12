import Link from "next/link";
import Dashboard from "@/components/dashboard";
import { Suspense } from "react";

export default function Home() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return <main className="setup">
      <span className="eyebrow">TimeReport · Schweiz</span>
      <h1>Arbeitszeit. Klar erfasst.</h1>
      <p>Einchecken, Projekte zuordnen, Pausen im Blick behalten. Ein gemeinsamer Ort für dein Team und den Monatsrapport.</p>
      <section className="card">
        <h2>Die Grundlage ist bereit – die Datenbank fehlt noch.</h2>
        <p>Diese Ansicht speichert keine Daten und enthält keine echten Mitarbeitenden.</p>
        <ol>
          <li>Supabase-Projekt erstellen und die Migration aus <code>supabase\migrations</code> ausführen.</li>
          <li><code>.env.example</code> nach <code>.env.local</code> kopieren und die Supabase-Schlüssel eintragen.</li>
          <li>Ersten Betreiber und die Pilotfirma gemäss README einrichten.</li>
        </ol>
        <Link href="https://github.com/DMSX/timereport">Einrichtungsanleitung im Repository</Link>
      </section>
      <div className="tiles">
        <section className="card"><h2>Projekte & Teams</h2><p>Getrennte Firmendaten, Projektzuweisungen und Rollen für Mitarbeitende, HR und Admin.</p></section>
        <section className="card"><h2>Verlässliche Rapporte</h2><p>Wochen-Sollzeit, Abwesenheiten und Auszüge als PDF und CSV. Zeitzone Zürich.</p></section>
        <section className="card"><h2>SaaS mit Freischaltung</h2><p>Stripe-Firmenabos und kostenfreie Firmen, die ausschliesslich der Betreiber freischaltet.</p></section>
      </div>
    </main>;
  }
  return <Suspense fallback={<main className="loading-state" role="status">Dein Arbeitsplatz wird geladen …</main>}><Dashboard /></Suspense>;
}
