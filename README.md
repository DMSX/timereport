# TimeReport

Erste Pilotversion einer mandantenfähigen Zeiterfassung für Selbstständige und Schweizer Teams:
Next.js / TypeScript, PostgreSQL mit Supabase Auth und Stripe-Firmenabos.

Das [Produkt- und Umsetzungskonzept](docs/KONZEPT.md) beschreibt Zielbild,
Geschäftsmodell, Architektur und die Entscheidungsvorlage für den Pilotbetrieb.

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
   Bei einer Neuinstallation anschliessend
   `202610120002_onboarding_alerts.sql`, `202610120003_flexible_work_models.sql`,
   `202610120004_self_service_billing.sql` und
   `202610140001_departments_and_work_rules.sql` in dieser Reihenfolge ausführen.
   **Bestehende Installationen führen nur die noch fehlenden Migrationen
   einmal in Reihenfolge aus**, nicht bereits angewendete wiederholen.
   Spätere Migrationen laufen automatisch (siehe «Automatisierung»).
2. Projekt-URL und Publishable Key in `.env.local` hinterlegen. Der
   `SUPABASE_SERVICE_ROLE_KEY` ist nur für serverseitige Einladungen,
   Firmenaufnahme und Stripe-Synchronisation bestimmt. Niemals als
   `NEXT_PUBLIC_...` konfigurieren.
3. Unter Auth die öffentliche Neuregistrierung **deaktiviert lassen**: Die
   Selbstregistrierung unter `/signup` läuft serverseitig über eine Einladung
   (E-Mail-Bestätigung) und ist auf 30 neue Firmen pro Stunde begrenzt.
   E-Mail/Passwort und
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
   Neue Benutzer erhalten jetzt einen rollenabhängigen Einrichtungsassistenten
   mit pro Benutzer/Firmenmitgliedschaft gespeichertem Fortschritt.
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

### Schutz der Anmeldedaten

Passwort-, TOTP- und Passwortänderungsformulare sind getrennte DOM-Instanzen
mit eindeutigen Feld-IDs. Beim erfolgreichen Login wird das Passwortformular
geleert; das kontrollierte TOTP-Feld beginnt leer und akzeptiert nur sechs
Ziffern. Ein Passwort wird nicht als Authenticator-Code übernommen.
Die `autocomplete`-Angaben unterstützen Passwortmanager, können deren
externes Verhalten aber nicht garantieren.

Verbindungen zu externen Supabase-Instanzen benötigen HTTPS; nur lokale
Loopback-Adressen dürfen für Entwicklungsinstanzen HTTP verwenden.
Die veröffentlichte Anwendung selbst muss ebenfalls ausschliesslich über
HTTPS erreichbar sein; dies wird beim Hosting eingerichtet.
Passwörter werden nicht von TimeReport gespeichert. Supabase Auth speichert
laut [Passwortsicherheitsdokumentation](https://supabase.com/docs/guides/auth/password-security)
gesalzene bcrypt-Hashes, keine entschlüsselbaren Passwörter. Transportverschlüsselung,
Passwort-Hashing und 2FA sind unterschiedliche Schutzmassnahmen; ein
zusätzlicher clientseitiger Verschlüsselungsschritt ersetzt diese nicht.

## Arbeitsregeln

### Oberfläche und Einstieg

Nach dem Login öffnet sich **Mein Arbeitstag** mit eigener Tageszeit,
Wochenzeit bis heute und Ein-/Auschecken. Soll und Tagesfortschritt erscheinen
nur bei einem Soll-Modell. Neue Firmen-Admins sehen
eine Einrichtungshilfe: Arbeitsmodelle hinterlegen, Projekt erstellen und
Team zuweisen. Betreiber ohne Firma erhalten einen eigenen Einstieg zur
Firmenaufnahme, statt einer leeren Zeiterfassung.

Der Ersteinrichtungsassistent ist ein **Modal mit direkten Formularen**:
Arbeitsbereich anlegen, Funktionen auswählen, Zeiterfassungsmodell pro Person
speichern, Projekte erstellen und Personen zuweisen – ohne Seitenwechsel.
Betreiber, Firmen-Admins und Mitarbeitende/HR erhalten rollenabhängige Schritte. Mit **Später
fortsetzen** kann die Führung vorübergehend ausgeblendet werden; der letzte
gespeicherte Schritt bleibt erhalten. **Einführung öffnen** startet die Führung
erneut, ohne Arbeitsdaten oder Firmeneinstellungen zurückzusetzen.
Arbeitsmodell und Projektzuweisung sind für den Abschluss erforderliche
Voraussetzungen; Stundenbasis zählt als vollständiges Modell ohne Soll.
Neue Arbeitsbereiche starten ohne Abwesenheitserfassung und Fehlbuchungshinweise.
Bestehende Arbeitsbereiche behalten ihre bisherigen Funktionen.
Die Modellauswahl ist zunächst **Stundenbasis**, wird jedoch erst beim
ausdrücklichen Speichern angewendet. Es gibt keine Tutorial-Arbeitsbuchungen.
Login und 2FA bleiben unabhängig vom
Assistenten verpflichtend.

Die Seitennavigation trennt Arbeitsplatz (Arbeitstag, Zeitbuchungen,
Abwesenheiten, Monatsrapport), Verwaltung (Team, Projekte, Firmenregeln,
Firmenabo) und Betreiberbereich. Bereiche bleiben über den URL-Hash nach
Neuladen erhalten; Browser-Zurück/Vorwärts wechselt den Bereich mit.
Auf Mobilgeräten ist die Navigation horizontal scrollbar.

Der **Monatsrapport** hat eine eigene Monatsnavigation mit Vor/Zurück und
**Dieser Monat**, Kennzahlen sowie direkten PDF-/CSV-Downloads. In der
**Tagesübersicht** lassen sich Arbeitsblöcke mit Zeiten, Notizen und anteiliger
Tagesdauer aufklappen. **Nach Projekten** zeigt Stunden und Anteil je Projekt
für den ausgewählten Monat, einschliesslich historischer Projekte.
Ein Filter blendet Tage ohne Buchung oder Abwesenheit aus; offene
Abwesenheiten bleiben sichtbar, erzeugen aber keine Gutschrift.
Ansichtswechsel und Filter verändern weder Kennzahlen noch Exportumfang.
Stundenbasis zeigt keine Soll-/Saldo-Spalten; laufende Zeiten sind ausdrücklich
vorläufig. Rechenhinweise stehen in einem aufklappbaren Bereich.

Manuelle Nachträge und Korrekturen liegen unter **Zeitbuchungen**; neue
Abwesenheiten, Einladungen, Projekte und Firmen öffnen sich in Dialogen mit
Fokusführung und Escape zum Schliessen. Fehler bleiben im Dialog sichtbar,
ohne eingegebene Werte zu verlieren. Team- und Projektlisten sind durchsuchbar;
Bearbeitungsformulare werden nur bei Bedarf aufgeklappt. Arbeitsmodelle werden
bei gewähltem Soll-Modell in Stunden eingegeben und zeigen das Wochen-Soll live an; die Datenbank
speichert weiterhin volle Minuten.

| Bereich | Verhalten |
| --- | --- |
| Firmen | Datenzugriff nur mit Firmenmitgliedschaft und `aal2` (bestätigter zweiter Faktor). |
| Rollen | Mitarbeitende: eigene Zeiten/Abwesenheiten; HR: firmenweite Rapporte, Korrekturen und Arbeitsmodelle; Admin: zusätzlich Projekte, Team, Einstellungen und Abo. |
| Betreiber | Firmen- und Abometadaten sowie Freischaltungen; kein pauschaler Zugriff auf Zeitrapporte. |
| Einchecken | Nur aktive, zugewiesene Projekte. Serverzeit statt manipulierbarer Browserzeit. Eine laufende Buchung pro Benutzer, auch über mehrere Firmen. |
| Pause | Auschecken beendet einen Arbeitsblock. Die Lücke vor dem nächsten Block zählt als Pause. Projektwechsel setzt die durchgehende Arbeitszeit nicht zurück. |
| Pausenregeln | Firmenregel plus strengere Projektregel; Regeln werden beim Einchecken gespeichert. Änderungen gelten für neue Blöcke. Eine kurze Pause setzt die Arbeitszeit nicht zurück. |
| Verstösse | Arbeitszeit wird vollständig weiter erfasst. HR/Admin klärt abgeschlossene Verstösse mit Grund. Korrekturen verwerfen betroffene spätere Klärungen, damit sie erneut geprüft werden. |
| Zeiterfassungsmodell | Pro Person Stundenbasis ohne Soll oder Modell mit Soll. Ab Datum gültig bis zum nächsten Modell; historische Rapporte bleiben dem damals gültigen Modell zugeordnet. |
| Stundenbasis | Tatsächlich erfasste Arbeitsstunden, keine Soll-Erfüllung oder Plus-/Minuszeit und keine automatische Fehlbuchungsprüfung. Abwesenheiten nur dokumentiert, keine automatischen Stunden-/Ferienlohnansprüche. |
| Sollzeit | Optional: Minuten je Wochentag pro Person; Summe entspricht Wochen-Soll. Geplante Uhrzeiten dienen aktivierten Hinweisen, starten keine Buchungen. |
| Optionale Funktionen | Abwesenheitserfassung und Fehlbuchungshinweise getrennt je Arbeitsbereich an-/abschaltbar, unabhängig von der Anzahl Personen. Abschalten löscht keine Historie. |
| Korrekturen | Standard: bis Sonntag der Folgewoche, 23:59 Uhr Zürich. Frist je Firma 0–8 zusätzliche Wochen; danach nur HR/Admin. Änderungen und manuelle Nachträge mit Gründen werden protokolliert. Ein Verschieben in eine bereits gesperrte Woche ist ebenfalls gesperrt. Nachträge verwenden aktuelle Pausenregeln. |
| Ferien | Bei Soll-Modellen Jahresguthaben in Tagen pro Person; offene und genehmigte Anträge reservieren Guthaben auf geplanten Arbeitstagen. Ohne geplante Arbeitstage keine automatische Ferienrestberechnung. Keine Lohnabrechnung. |
| Krankheit | Separater Abwesenheitstyp, ohne begrenztes Guthaben. |
| Freigaben | Je Firma optional; bei ausgeschalteter Freigabe sind neue Anträge direkt genehmigt. Bestehende offene Anträge bleiben offen. |
| Abwesenheiten | Neue Einträge nur bei aktivierter Funktion. Genehmigte Abwesenheiten bleiben im Rapport dokumentiert, Stunden nur auf Soll-Tagen gutgeschrieben. Überschneidungen gesperrt; historische Selbstbuchungen unterliegen der Korrekturfrist. |
| Rapporte | Tagesübersicht und Projektbuchungen in PDF/CSV, Zeitzone Zürich; Monatsgrenzen und Sommer-/Winterzeit berücksichtigen tatsächliche verstrichene Minuten. |
| Fehlende Zeiterfassung | Je Person aktivierbare Prüffrist nach geplantem Arbeitsbeginn; zuständige HR-/Admin-Person derselben Firma. Hinweise und manuelle Erinnerungen stehen unter **Hinweise**. |
| Halbtage | Neue Einträge benötigen Vormittag/Nachmittag. HR/Admin kann alte Einträge mit Änderungsgrund zuordnen. Das geplante Zeitfenster wird für Halbtage in zwei gleich lange Hälften geteilt. |

Die Anwendung beansprucht **keine automatische Schweizer
Arbeitsrechtskonformität**. Die beispielhafte 2h/15min-Regel ist eine frei
konfigurierbare Geschäftsregel, keine vollständige gesetzliche Pausenregel.

## Hinweise und E-Mail-Erinnerungen aktivieren

1. Fehlende SQL-Migrationen ausführen; unter **Firmenregeln** die Hinweise
   ausdrücklich aktivieren. Nach Änderungen der Serverkonfiguration neu starten.
2. Unter **Team → Arbeitsmodell** ein **Soll-Modell** und den geplanten Arbeitsbeginn hinterlegen.
   Für Halbtage zusätzlich das geplante Ende setzen. Tagesfenster mit Ende
   vor Beginn werden nicht als Halbtags-Schichtplan interpretiert, sondern
   erzeugen einen Klärungshinweis.
3. Unter **Team → Fehlende Zeiterfassung** je Person eine Frist in Minuten,
   die zuständige HR-/Admin-Person und die Aktivierung festlegen.
   Keine automatische Aktivierung oder vorgetäuschte Zuständigkeit.
4. Firmenweite Feiertage/arbeitsfreie Tage unter **Firmenregeln** hinterlegen.
   Sie unterdrücken Hinweise, ändern derzeit aber nicht die Sollzeit im Rapport.
5. Diese zusätzlichen Werte lokal bzw. als Hosting-Secrets konfigurieren:

   ```dotenv
   CRON_SECRET=LANGES-ZUFAELLIGES-GEHEIMNIS
   SMTP_HOST=DEIN-SMTP-SERVER
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=DEIN-SMTP-BENUTZER
   SMTP_PASSWORD=DEIN-SMTP-PASSWORT
   SMTP_FROM=TimeReport <ABSENDER@DEINE-DOMAIN>
   ```

   Port 587 verwendet verpflichtendes STARTTLS; bei implizitem TLS
   üblicherweise Port 465 und `SMTP_SECURE=true`. Absenderberechtigung,
   SPF/DKIM und Zustellfähigkeit mit dem Maildienst einrichten.
   Die SMTP-Einstellungen für Supabase-Einladungen sind separat:
   TimeReport übernimmt diese nicht automatisch aus Supabase.
6. Einen Hosting-Scheduler **alle 15 Minuten** mit folgendem HTTP-Aufruf
   konfigurieren (keine automatische Hosting-Einrichtung durch das Projekt):

   ```text
   POST https://DEIN-HOST/api/jobs/report-alerts
   Authorization: Bearer DEIN-CRON-SECRET
   ```

   Scheduler mit POST, geschütztem Header, ausreichender Laufzeit
   (mindestens drei Minuten für den Versandbatch) und Alarmierung bei
   Nicht-2xx-Antworten verwenden. Geheimnis nicht in die URL aufnehmen.
   Lokal lässt sich dieser Endpunkt mit demselben Header gezielt auslösen.

Der Lauf prüft den aktuellen Zürcher Arbeitstag, den Vortag sowie bestehende offene
Hinweise. Eine einzige Buchung, einschliesslich eines laufenden oder
über Mitternacht reichenden Blocks, verhindert den Fehlbuchungshinweis.
Es gibt keine Prüfung auf eine fehlende zusätzliche Nachmittagsbuchung.
Freie Tage, deaktivierte Regeln, fehlender geplanter Beginn und genehmigte
Ganztagsabwesenheiten erzeugen keine Fehlbuchungsmeldung. Konfigurationslücken
werden im Team angezeigt. Bei offener Abwesenheit erscheint ein Prüfhinweis;
alte Halbtage ohne Zuordnung oder ohne klares Zeitfenster erzeugen einen
Klärungshinweis statt einer Fehlzeitenbehauptung. Eine genehmigte
Vormittagsabwesenheit verschiebt die Prüffrist auf den Beginn der zweiten Hälfte
des geplanten Fensters. Bei genehmigtem Nachmittag wird die Prüfung auf das
Ende der ersten Hälfte begrenzt.

Verantwortliche sehen Hinweise und können **manuell** eine Erinnerung
auslösen. Mitarbeitende sehen diesen Hinweis erst nach der Erinnerung.
E-Mails enthalten keine Diagnosen oder Namen der betroffenen Person;
Details sind nur nach berechtigtem Login zugänglich. HR/Admin kann Hinweise
mit Grund klären. Nachträge und Abwesenheitsänderungen werden im nächsten
Scheduler-Lauf neu bewertet, ursprüngliche Hinweisdatensätze bleiben erhalten.
Verschiebt sich dabei eine offene Prüffrist in die Zukunft, wird der Hinweis
als zurückgestellt angezeigt und bis dahin keine Erinnerung versendet.
Die geöffnete Oberfläche aktualisiert Daten im Hintergrund jede Minute;
alternativ **Hinweise aktualisieren** verwenden.

E-Mail-Aufträge werden dauerhaft gespeichert, dedupliziert und in Batches
von bis zu fünf Nachrichten mit einer Lease abgearbeitet. Fehlversuche werden
mit zunehmendem Abstand bis zu fünfmal versucht. Der Status bleibt in
**Hinweise** sichtbar; HR/Admin kann einen weiteren Versuch beauftragen.
Vor dem Versand werden Hinweis und Empfängerberechtigung erneut geprüft.
Fehlende SMTP-Konfiguration oder Versandfehler liefern eine Fehlerantwort,
keine Erfolgsmeldung. In-App-Hinweise können dennoch bereits gespeichert sein.
**Vom Mailserver angenommen** bedeutet nicht nachweislich im Postfach gelesen.
SMTP und Datenbank bilden keine gemeinsame Transaktion: Bei einem Ausfall
zwischen Versand und Statusspeicherung ist eine doppelte Zustellung möglich.
Ein stabiler Message-ID-Wert unterstützt die Zuordnung, garantiert aber keine
Exactly-once-Zustellung.

Der Vortag wird ebenfalls geprüft, damit eine lange Frist nach einem späten
Arbeitsbeginn nicht an Mitternacht verloren geht. Das gilt auch unmittelbar
nach Aktivierung einer Prüfregel. Der Scheduler führt keinen allgemeinen
rückwirkenden Scan aller nie geprüften Tage aus. Bei
längeren Scheduler-Ausfällen müssen fehlende Tage fachlich nachgeprüft werden.
Die letzte erfolgreiche Datenprüfung ist für HR/Admin unter **Hinweise**
sichtbar; sie ist kein Nachweis, dass alle E-Mails erfolgreich versendet wurden.

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

**Testphase und Sperre (automatisch):** Jede neue Firma startet mit 14 Tagen
Testphase ohne Zahlungsdaten. Danach gilt: aktives Abo (`active`, `trialing`,
`past_due`) oder Kostenfreigabe ⇒ voller Zugang; sonst ist die Firma
**nur lesbar** (Rapporte/Exporte bleiben verfügbar). Die Sperre erzwingt ein
Datenbank-Trigger auf Arbeitszeiten und Abwesenheiten
(`company_access`/`billing_write_guard`), nicht nur die Oberfläche. Bei
Zahlungsverzug (`past_due`) bleibt der Zugang bis zum Abo-Ende durch Stripe;
Mahnregeln in Stripe konfigurieren. Bestehende Firmen erhalten durch die
Migration 14 Tage ab Migrationszeitpunkt. Hinweise/E-Mail-Erinnerungen für
gesperrte Firmen werden noch nicht unterdrückt.

## Automatisierung

Neue Firmen registrieren sich selbst unter `/signup`; Testphase, Abo und Sperre
laufen automatisch (siehe «Stripe einrichten»). Der Betreiber ist nur noch für
Ausnahmen zuständig (Kostenfreigabe, Support, 2FA-Reset). Die Workflows unter
`.github\workflows` übernehmen den Betrieb. Einmalig in GitHub unter
*Settings → Secrets and variables → Actions* anlegen:

| Secret | Zweck |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`, `SUPABASE_DB_PASSWORD` | `Datenbank-Migrationen`: wendet neue Dateien in `supabase\migrations` bei Änderungen auf `main` an. |
| `APP_URL`, `CRON_SECRET` | `Rapport-Erinnerungen`: ruft alle 15 Minuten den Worker auf. GitHub kann geplante Läufe verzögern; bei strengen Anforderungen den Hosting-Scheduler verwenden. |

`CI` führt Lint, Typprüfung und Tests bei jedem Pull Request aus. Wurden
Migrationen bisher von Hand angewendet, vor dem ersten Lauf lokal
`supabase migration repair --status applied 202610120001 202610120002 202610120003`
ausführen, damit sie nicht erneut angewendet werden. Die vierte Migration
anschliessend durch den Workflow oder einmal manuell anwenden.

## Entwicklung

Feature-Branches verwenden, keine direkte Featureentwicklung auf `main`.
Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `chore:`.

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Browserprüfungen mit vollständig isolierten Beispieldaten:

```powershell
npx playwright install chromium
npm run test:ui
```

Die UI-Tests starten einen eigenen Entwicklungsserver auf Port 3190 mit
`NEXT_UI_TEST=1` und dem separaten Build-Verzeichnis `.next-ui`. Ein laufender
Entwicklungsserver muss dafür nicht beendet werden. Die Tests verwenden weder echte Benutzer
noch Cloud-Daten und prüfen Einstieg, Rollen-Navigation, Ein-/Auschecken,
Dialoge, Fehleranzeige sowie mobile Darstellung.

Die Tests führen die echte SQL-Migration in eingebettetem PostgreSQL (PGlite)
aus und prüfen Mandantengrenzen, 2FA, direkte Schreibverbote, Korrekturen und
Abwesenheiten. Weitere Tests prüfen Zeitberechnung, Monatsgrenzen,
Zeitumstellung, Pausen bei Projektwechsel und CSV-Formelschutz.
Es werden keine Cloud-Zugangsdaten für diese Tests benötigt.

Der statische [Auditbericht](docs/audit-result.html) dokumentiert Befunde,
Korrekturen, Regressionsergebnisse und verbleibende Prüfgrenzen. Die Datei lässt
sich direkt im Browser öffnen und benötigt weder Server noch externe Ressourcen.

## Grenzen und nächste Produktetappen

- Supabase Auth, E-Mail-Versand und Stripe sind ohne echte Testkonfiguration
  nicht Ende-zu-Ende geprüft. Keine echten Zahlungen aktivieren, bevor diese
  Abläufe gemeinsam bestätigt sind.
- Keine automatische Feiertagsverwaltung (Kanton), Ferienüberträge,
  Teilzeit-Pro-rata-Guthaben oder jahresspezifische Ferienkonten.
- Abwesenheiten können noch nicht selbst zurückgezogen oder nachträglich
  umdatiert werden; HR/Admin kann die Tageshälfte mit Grund korrigieren.
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
