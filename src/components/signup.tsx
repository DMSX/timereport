"use client";

import Link from "next/link";
import { useState } from "react";

export default function Signup() {
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setFailed(false);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/signup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ company: data.get("company"), name: data.get("name"), email: data.get("email") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Registrierung fehlgeschlagen.");
      setMessage(result.message); setDone(true);
    } catch (e) { setFailed(true); setMessage(e instanceof Error ? e.message : "Registrierung fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  return <main className="auth-layout">
    <section className="auth-story">
      <div><Link className="brand" href="/"><span className="brand-mark">T</span>TimeReport<span className="brand-country">CH</span></Link></div>
      <div><span className="eyebrow">14 Tage kostenlos testen</span><h2>In wenigen Minuten<br />startklar.</h2><p>Keine Zahlungsdaten nötig. Nach der Testphase entscheidest du, ob du mit einem Firmenabo weitermachst.</p><div className="auth-features"><span>Selbst einrichten</span><span>Jederzeit exportierbar</span><span>Sicher getrennt</span></div></div>
      <small>Arbeitszeiten im Blick. Firmendaten geschützt.</small>
    </section>
    <section className="auth-panel"><div className="auth">
      <span className="eyebrow">Neu bei TimeReport</span>
      <h1>Konto erstellen.</h1>
      {message && <p role={failed ? "alert" : "status"} className={`notice ${failed ? "error" : ""}`}>{message}</p>}
      {!done && <form onSubmit={submit}>
        <label htmlFor="signup-company">Firma oder Name</label><input id="signup-company" name="company" required maxLength={120} autoComplete="organization" disabled={busy} />
        <label htmlFor="signup-name">Dein Name</label><input id="signup-name" name="name" required maxLength={120} autoComplete="name" disabled={busy} />
        <label htmlFor="signup-email">E-Mail</label><input id="signup-email" name="email" type="email" required autoComplete="email" disabled={busy} />
        <button disabled={busy}>{busy ? "Bitte warten …" : "Kostenlos starten"}</button>
      </form>}
      <p className="muted">Bereits registriert? <Link href="/login">Anmelden</Link></p>
    </div></section>
  </main>;
}
