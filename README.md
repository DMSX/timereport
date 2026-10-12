# TimeReport

Erste Pilotversion einer mandantenfähigen Zeiterfassung für Schweizer Teams:
Next.js / TypeScript, PostgreSQL mit Supabase Auth und Stripe-Firmenabos.

**Noch kein produktionsfertiger SaaS-Verkaufsbetrieb.** Ohne Konfiguration zeigt die
Anwendung ausschliesslich eine Einrichtungsseite, keine simulierte Zeiterfassung.
Supabase, E-Mail-Zustellung und Stripe müssen vor dem ersten echten Einsatz
eingerichtet und gemeinsam in einer Testumgebung durchgespielt werden.

## Lokal starten

Voraussetzung: Node.js 22.13 oder neuer und npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3000` öffnen. Keine echten Personal- oder Zeitdaten in dieses
öffentliche Repository aufnehmen. `.env.local` ist vom Commit ausgeschlossen.

## Supabase einrichten

1. Ein separates Supabase-Projekt erstellen, vorzugsweise mit EU-Datenstandort.
   Die Migration `supabase\migrations\202610120001_initial.sql` einmal im
   SQL-Editor ausführen. Die Anwendung verwendet das öffentliche Schema dieses
   Projekts; die Migration ist nicht für eine bereits anderweitig genutzte
   Datenbank gedacht.
2. Projekt-URL und Publishable Key in `.env.local` hinterlegen. Der
   `SUPABASE_SERVICE_ROLE_KEY` ist nur für serverseitige Einladungen,
   Firmenaufnahme und Stripe-Synchronisation bestimmt. Niemals als
   `NEXT_PUBLIC_...` konfigurieren.
3. Unter Auth die öffentliche Neuregistrierung deaktivieren, E-Mail/Passwort und
   TOTP-MFA aktivieren. Mindestpasswortlänge auf 12 setzen; E-Mail-Verifikation,
   Rate Limits und Schutz vor kompromittierten Passwörtern konfigurieren.
4. Site URL auf `APP_URL` setzen; Redirect-URLs für
   `http://localhost:3000/login` und später den echten HTTPS-Host freigeben.
   Kein Wildcard-Redirect für Produktionshosts.
5. Das **Invite user**-E-Mail-Template muss diesen Bestätigungslink verwenden:

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite">
     Einladung annehmen
   </a>
   ```

   Für vom Admin ausgelöste Passwortwiederherstellung analog `type=recovery`
   im **Reset password**-Template verwenden. Das Template vermeidet
   URL-Fragment-Tokens, die der serverseitige Bestätigungsendpunkt nicht liest.
   Eigenes SMTP für zuverlässige Zustellung einrichten.
6. Einen ersten Betreiber im Supabase-Auth-Dashboard erstellen/einladen und seine
   Benutzer-UUID im SQL-Editor freischalten:

   ```sql
   insert into public.operators(user_id) values ('BETREIBER-UUID');
   ```

7. Als Betreiber anmelden, Authenticator einrichten und unter
   **SaaS-Verwaltung** eine Firma mit Admin-E-Mail aufnehmen. Für eine kostenlose
   Pilotfirma **Kostenfrei freischalten** wählen.
8. Der eingeladene Firmen-Admin bestätigt seinen E-Mail-Link, richtet 2FA ein,
   legt ein Passwort fest und kann Mitarbeitende einladen, Arbeitsmodelle
   anlegen, Projekte erstellen und Personen zuweisen. Bestehende Benutzer
   werden anhand der E-Mail der weiteren Firma zugeordnet, ohne neue Einladung.
   Neue Mitarbeitende haben absichtlich **kein implizites Arbeitsmodell** und
   **keine impliziten Projektzuweisungen**.

Firmenaufnahme, Abostatus und Admin-Mitgliedschaft werden in einer
Datenbanktransaktion erstellt. Die externe E-Mail-Einladung kann nicht Teil
dieser Transaktion sein: Bei einem anschliessenden Datenbankfehler bleibt der
eingeladene Benutzer unzugewiesen. Nach Behebung erneut mit derselben E-Mail
aufnehmen; bestehende Benutzer werden wiederverwendet.

### Passwort- und Authenticator-Verlust

Passwortwiederherstellung wird im Pilotbetrieb vom Firmen-Admin über den
Supabase-Auth-Administrator ausgelöst. Ein 2FA-Reset wird ausschliesslich nach
Identitätsprüfung über Supabase Admin durchgeführt, niemals über einen
ungeprüften Selbstbedienungslink. Keine Recovery-Codes im Repository ablegen.
Vor Verkauf ist dieser Supportprozess mit Verantwortlichkeiten und
Nachweisführung verbindlich festzulegen.

## Arbeitsregeln

| Bereich | Verhalten |
| --- | --- |
| Firmen | Datenzugriff nur mit Firmenmitgliedschaft und `aal2` (bestätigter zweiter Faktor). |
| Rollen | Mitarbeitende: eigene Zeiten/Abwesenheiten; HR: firmenweite Rapporte, Korrekturen und Arbeitsmodelle; Admin: zusätzlich Projekte, Team, Einstellungen und Abo. |
| Betreiber | Firmen- und Abometadaten sowie Freischaltungen; kein pauschaler Zugriff auf Zeitrapporte. |
| Einchecken | Nur aktive, zugewiesene Projekte. Serverzeit statt manipulierbarer Browserzeit. Eine laufende Buchung pro Benutzer, auch über mehrere Firmen. |
| Pause | Auschecken beendet einen Arbeitsblock. Die Lücke vor dem nächsten Block zählt als Pause. Projektwechsel setzt die durchgehende Arbeitszeit nicht zurück. |
| Pausenregeln | Firmenregel plus strengere Projektregel; Regeln werden beim Einchecken gespeichert. Änderungen gelten für neue Blöcke. Eine kurze Pause setzt die Arbeitszeit nicht zurück. |
| Verstösse | Arbeitszeit wird vollständig weiter erfasst. HR/Admin klärt abgeschlossene Verstösse mit Grund. Korrekturen verwerfen betroffene spätere Klärungen, damit sie erneut geprüft werden. |
| Sollzeit | Minuten je Wochentag pro Person; Summe entspricht Wochen-Soll. Modelle sind ab Datum gültig bis zum nächsten Modell. Geplante Uhrzeiten sind informativ. |
| Korrekturen | Standard: bis Sonntag der Folgewoche, 23:59 Uhr Zürich. Frist je Firma 0–8 zusätzliche Wochen; danach nur HR/Admin. Änderungen und manuelle Nachträge mit Gründen werden protokolliert. Ein Verschieben in eine bereits gesperrte Woche ist ebenfalls gesperrt. Nachträge verwenden aktuelle Pausenregeln. |
| Ferien | Jahresguthaben in Tagen pro Person; ganze/halbe Tage oder Datumsbereiche. Offene und genehmigte Anträge reservieren Guthaben auf geplanten Arbeitstagen. Negative Restguthaben sind sichtbar, werden im Pilot nicht automatisch blockiert. |
| Krankheit | Separater Abwesenheitstyp, ohne begrenztes Guthaben. |
| Freigaben | Je Firma optional; bei ausgeschalteter Freigabe sind neue Anträge direkt genehmigt. Bestehende offene Anträge bleiben offen. |
| Abwesenheiten | Nur genehmigte Abwesenheiten werden mit den jeweiligen geplanten Minuten gutgeschrieben. Überschneidende Abwesenheiten sind gesperrt; historische Selbstbuchungen unterliegen der Korrekturfrist. |
| Rapporte | Tagesübersicht und Projektbuchungen in PDF/CSV, Zeitzone Zürich; Monatsgrenzen und Sommer-/Winterzeit berücksichtigen tatsächliche verstrichene Minuten. |

Die Anwendung beansprucht **keine automatische Schweizer
Arbeitsrechtskonformität**. Die beispielhafte 2h/15min-Regel ist eine frei
konfigurierbare Geschäftsregel, keine vollständige gesetzliche Pausenregel.

## Stripe einrichten

1. Zunächst ausschliesslich Stripe **Testmodus** verwenden.
2. Ein Produkt mit einem **monatlich wiederkehrenden Festpreis pro Firma**
   erstellen, beispielsweise in CHF. Betrag und steuerliche Behandlung müssen
   vor Verkauf entschieden werden; im Code ist kein Preis erfunden.
3. `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` und `APP_URL` konfigurieren.
4. Stripe Customer Portal aktivieren und erlaubte Kündigungs-/Änderungsoptionen
   konfigurieren.
5. Einen signierten Webhook auf
   `https://DEIN-HOST/api/stripe/webhook` für
   `customer.subscription.created`, `customer.subscription.updated` und
   `customer.subscription.deleted` registrieren.
   Signing Secret als `STRIPE_WEBHOOK_SECRET` setzen.
6. Mit Stripe CLI lokal testen:

   ```powershell
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook
   ```

   Das von diesem Befehl ausgegebene Test-Secret verwenden. Checkout, Zahlung,
   fehlgeschlagene Zahlung, Kündigung, Webhook-Wiederholung und Portal durchspielen.

Nur Firmen-Admins dürfen Checkout und Portal öffnen. Eine Datenbank-Lease und
Stripe-Idempotenz verhindern parallele Checkout-Erstellungen. Webhooks prüfen
die Signatur und laden den aktuellen Abozustand statt blind veraltete
Eventdaten zu übernehmen. Kunden werden ausschliesslich über die serverseitig
gespeicherte Stripe-Kunden-ID einer Firma zugeordnet.

Kostenfreie Freischaltungen sind nur über den Betreiber möglich und unabhängig
vom Stripe-Status. **Ein bestehendes bezahltes Abo wird dadurch nicht
automatisch gekündigt**; der Betreiber muss es in Stripe beenden und den
Kunden informieren.

**Bewusster Pilotmodus:** Abozustände werden erfasst, aber sperren bei fehlender
oder ausgefallener Zahlung noch keine Arbeitszeitbuchungen. So werden bei
Zahlungs-/Webhook-Problemen keine Arbeitszeiten verloren. Bevor öffentlich
verkauft wird, müssen Testphase, Zahlungsfristen, Mahnung, Schreibsperren und
dauerhafter Lese-/Exportzugriff festgelegt und implementiert werden.

## Entwicklung

Feature-Branches verwenden, keine direkte Featureentwicklung auf `main`.
Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Die Tests führen die echte SQL-Migration in eingebettetem PostgreSQL (PGlite)
aus und prüfen Mandantengrenzen, 2FA, direkte Schreibverbote, Korrekturen und
Abwesenheiten. Weitere Tests prüfen Zeitberechnung, Monatsgrenzen,
Zeitumstellung, Pausen bei Projektwechsel und CSV-Formelschutz.
Es werden keine Cloud-Zugangsdaten für diese Tests benötigt.

## Grenzen und nächste Produktetappen

- Supabase Auth, E-Mail-Versand und Stripe sind ohne echte Testkonfiguration
  nicht Ende-zu-Ende geprüft. Keine echten Zahlungen aktivieren, bevor diese
  Abläufe gemeinsam bestätigt sind.
- Keine automatische Feiertagsverwaltung (Kanton), Ferienüberträge,
  Teilzeit-Pro-rata-Guthaben oder jahresspezifische Ferienkonten.
- Abwesenheiten können noch nicht selbst zurückgezogen oder nachträglich
  umdatiert werden.
- Keine Deaktivierung/Austritte von Mitarbeitenden oder Benutzer-Self-Service
  für Passwortwiederherstellung. Keine automatische Migration alter
  Arbeitsmodelle oder Löschung von Firmen.
- Dashboard und Rapport laden paginiert alle zugänglichen Zeitblöcke, um
  Pausenketten und historische Modelle nicht an einer Monatsgrenze
  abzuschneiden. Für grosse Datenmengen folgt eine serverseitige,
  begrenzt aggregierte Auswertung; Änderungen anderer Teammitglieder
  erscheinen derzeit nach Neuladen, nicht live.
- PDF verwendet Helvetica mit lateinischem Zeichensatz. Nicht unterstützte
  Schriften benötigen vor internationaler Nutzung eingebettete Unicode-Fonts.
- Vor Produktivbetrieb fehlen insbesondere Datenschutzunterlagen nach
  Schweizer DSG / gegebenenfalls DSGVO, Aufbewahrungs-/Löschkonzept,
  Auftragsbearbeitungsvereinbarungen, Backups/Wiederherstellung, Monitoring,
  Supportprozesse, rechtlich geprüfte Arbeitsregeln und Abo-Zugangspolitik.
