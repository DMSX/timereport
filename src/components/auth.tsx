"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { encodeQrImage } from "@/lib/qr";

export default function Auth() {
  const router = useRouter();
  const [db] = useState(browserClient);
  const [step, setStep] = useState<"loading" | "password" | "enroll" | "verify">("loading");
  const [factor, setFactor] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordSetup, setPasswordSetup] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [aal2, setAal2] = useState(false);
  const initialized = useRef(false);
  const prepare = useCallback(async () => {
    const { data, error } = await db.auth.getUser();
    if (!data.user) { setStep("password"); return; }
    if (error) throw error;
    setSignedIn(true);
    const { data: level, error: levelError } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (levelError) throw levelError;
    setAal2(level.currentLevel === "aal2");
    if (level.currentLevel === "aal2" && !window.location.search.includes("setPassword")) {
      router.replace("/"); router.refresh(); return;
    }
    const { data: factors, error: factorError } = await db.auth.mfa.listFactors();
    if (factorError) throw factorError;
    const verified = factors.totp.find((f) => f.status === "verified");
    if (verified) { setFactor(verified.id); setStep("verify"); }
    else {
      for (const pending of factors.all.filter((f) => f.status === "unverified")) {
        const { error: removeError } = await db.auth.mfa.unenroll({ factorId: pending.id });
        if (removeError) throw removeError;
      }
      const { data: enrollment, error: enrollmentError } = await db.auth.mfa.enroll({ factorType: "totp", friendlyName: "TimeReport" });
      if (enrollmentError) throw enrollmentError;
      setFactor(enrollment.id); setQr(encodeQrImage(enrollment.totp.qr_code)); setSecret(enrollment.totp.secret); setStep("enroll");
    }
  }, [db, router]);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setPasswordSetup(window.location.search.includes("setPassword"));
    prepare().catch((e: unknown) => { setMessage(e instanceof Error ? e.message : "Login fehlgeschlagen."); setStep("password"); });
  }, [prepare]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      if (step === "password") {
        const { error } = await db.auth.signInWithPassword({ email: String(data.get("email")), password: String(data.get("password")) });
        if (error) throw error;
        await prepare();
      } else {
        const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor, code: String(data.get("code")).trim() });
        if (error) throw error;
        if (passwordSetup) { setAal2(true); setQr(""); setSecret(""); }
        else { router.replace("/"); router.refresh(); }
      }
    } catch (e) { setMessage(e instanceof Error ? e.message : "Login fehlgeschlagen."); }
    finally { setBusy(false); }
  }

  const verifiedSetup = passwordSetup && aal2;
  return <main className="auth-layout">
    <section className="auth-story">
      <div><Link className="brand" href="/"><span className="brand-mark">T</span>TimeReport<span className="brand-country">CH</span></Link></div>
      <div><span className="eyebrow">Mehr Klarheit. Weniger Aufwand.</span><h2>Dein Team.<br />Deine Projekte.<br />Deine Zeit.</h2><p>Vom ersten Einchecken bis zum Monatsrapport. Ein Arbeitsplatz, der deinen Alltag einfacher macht.</p><div className="auth-features"><span>Projektbezogen</span><span>Für Schweizer Teams</span><span>Sicher getrennt</span></div></div>
      <small>Arbeitszeiten im Blick. Firmendaten geschützt.</small>
    </section>
    <section className="auth-panel"><div className="auth">
    <div className="auth-steps" aria-label="Anmeldeschritte"><span className={step === "password" || step === "loading" ? "current" : ""}>1 · Anmelden</span><span className={!verifiedSetup && (step === "enroll" || step === "verify") ? "current" : ""}>2 · Bestätigen</span>{passwordSetup && <span className={verifiedSetup ? "current" : ""}>3 · Passwort</span>}</div>
    <span className="eyebrow">{step === "enroll" ? "Einmalige Einrichtung" : "Dein Arbeitsplatz wartet"}</span>
    <h1>{verifiedSetup ? "Passwort festlegen" : step === "password" || step === "loading" ? "Willkommen zurück." : step === "enroll" ? "Zugang absichern." : "Kurz bestätigen."}</h1>
    <p>{verifiedSetup ? "Wähle ein persönliches Passwort mit mindestens zwölf Zeichen." : step === "enroll" ? "Verbinde deine Authenticator-App. Damit bleiben deine Firmendaten geschützt." : step === "verify" ? "Öffne deine Authenticator-App und gib den aktuellen Code für TimeReport ein." : "Melde dich mit deiner Firmen-E-Mail an. Neue Zugänge erhältst du auf Einladung."}</p>
    {message && <p role="alert" className="notice error">{message}</p>}
    {verifiedSetup ? <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const password = String(new FormData(e.currentTarget).get("newPassword"));
      const { error } = await db.auth.updateUser({ password });
      setBusy(false);
      if (error) setMessage(error.message); else { router.replace("/"); router.refresh(); }
    }}><label>Neues Passwort<input name="newPassword" type="password" minLength={12} required autoComplete="new-password" /></label><button disabled={busy}>Passwort speichern</button></form>
      : step === "loading" ? <p>Login wird geladen …</p>
      : <form onSubmit={submit}>
        {step === "password" ? <>
          <label>E-Mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Passwort<input name="password" type="password" required autoComplete="current-password" /></label>
        </> : <>
          {step === "enroll" && <>
            <p>Scanne den QR-Code mit deiner Authenticator-App und gib den sechsstelligen Code ein.</p>
            <div className="qr-frame"><Image src={qr} width={220} height={220} alt="QR-Code für Authenticator-Einrichtung" unoptimized /></div>
            <details><summary>Manueller Einrichtungsschlüssel</summary><code className="secret">{secret}</code></details>
          </>}
          <label>Authenticator-Code<input name="code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required autoComplete="one-time-code" /></label>
        </>}
        <button disabled={busy}>{busy ? "Bitte warten …" : step === "password" ? "Anmelden" : "Code bestätigen"}</button>
      </form>}
    {signedIn && <button className="secondary" onClick={async () => {
      const { error } = await db.auth.signOut();
      if (error) setMessage(error.message);
      else { setSignedIn(false); setAal2(false); setStep("password"); setQr(""); setSecret(""); router.replace("/login"); router.refresh(); }
    }}>Abmelden</button>}
    <p className="muted">Passwort oder Authenticator verloren? Kontaktiere deinen Firmen-Admin. Ein 2FA-Reset erfolgt nur nach Identitätsprüfung.</p>
    </div></section>
  </main>;
}
