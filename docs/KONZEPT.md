# TimeReport – SaaS-Konzept

**Stand:** 12. Oktober 2026

**Zweck:** Entscheidungsgrundlage für den Pilotbetrieb

**Status:** Technische Pilotversion mit automatisiertem Kundenlebenszyklus (Registrierung, Testphase, Abo, Sperre); noch keine Freigabe für den öffentlichen Verkauf

## 1. Idee und Nutzen

TimeReport ist eine browserbasierte, projektbezogene Zeiterfassung für
Selbstständige und Unternehmen. Personen checken per Knopfdruck ein und aus;
am Monatsende stehen nachvollziehbare PDF-/CSV-Rapporte bereit.

**Nutzen:** Weniger manuelle Tabellen, einfachere Projektzuordnung und weniger
Aufwand bei der Prüfung von Zeiten. Desktop und Smartphone verwenden dieselbe
Oberfläche. Ob eine Person oder ein grösseres Team: Funktionen werden nach
Bedarf gewählt, nicht durch starre Solo-/Team-Pakete vorgegeben.

## 2. Wichtigste Funktionen

| Bereich | Umfang |
| --- | --- |
| Zeiterfassung | Ein-/Auschecken auf zugewiesene Projekte; laufende Zeit bleibt bei geschlossenem Browser erhalten. |
| Arbeitsmodelle | Pro Person Stundenbasis **ohne Soll und Saldo** oder Modell mit Soll. Änderungen gelten ab Datum. |
| Rapporte | Monatsübersicht, aufklappbare Tagesdetails, Projektstunden sowie PDF-/CSV-Auszüge. Sollwerte erscheinen nur bei Soll-Modellen. |
| Korrekturen und Pausen | Nachträge mit Grund und Änderungsprotokoll; konfigurierbare Fristen und Pausenregeln. |
| Abwesenheiten – optional | Ferien und Krankheit mit optionaler Freigabe. Bei Stundenbasis Dokumentation ohne automatische Stundengutschrift oder Ferienrestberechnung. |
| Hinweise – optional | Bei fehlender Buchung nach einer festgelegten Frist erhält die zuständige HR-/Admin-Person einen App-/E-Mail-Hinweis. Sie kann manuell erinnern. Ohne Soll-Modell keine automatische Prüfung. |
| Einrichtung | Modal mit direkten Formularen für Funktionen, Arbeitsmodelle, Projekte und Zuweisungen; Fortschritt wird gespeichert. |
| Zugriff | Getrennte Firmendaten, Rollen und verpflichtendes Login mit Authenticator-2FA. |

Neue Arbeitsbereiche starten ohne Abwesenheitserfassung und Hinweise.
Abschalten löscht keine Historie. Genehmigte Abwesenheiten und arbeitsfreie
Tage werden bei aktivierten Hinweisen berücksichtigt; offene Anträge ergeben
Klärungsbedarf statt einer pauschalen Fehlzeitenbehauptung.

**Rollen:** Mitarbeitende verwalten eigene Zeiten; HR prüft Firmenrapporte
und Arbeitsmodelle; Admin verwaltet zusätzlich Personen, Projekte, Regeln und
Abo. Firmen entstehen per Selbstregistrierung. Der SaaS-Betreiber behandelt
nur Ausnahmen (Kostenfreigabe, Support), hat aber ohne Firmenmitgliedschaft
keinen pauschalen Zugriff auf Personalrapporte.

**Nicht enthalten:** Lohnabrechnung, Kundenfakturierung, ERP-Anbindungen,
Offline-Erfassung und eine pauschale Zusicherung gesetzlicher Arbeitsrechtskonformität.

## 3. Architektur und Technologieentscheidung

**Ansatz:** Eine zentrale Webanwendung mit getrennten Fachbereichen,
verwalteter Datenbank/Auth und externen Zahlungs-/Maildiensten.
Keine eigenen Microservices für jede Funktion.

```text
Browser --> Next.js: Oberfläche, geschützte Endpunkte, Exporte
        --> Supabase Auth / Daten-API --> PostgreSQL mit Zugriffsregeln

Next.js --> Stripe: Firmenabos
Besucher --> /signup --> Einladung per E-Mail --> Firma + Admin + Testphase
GitHub Actions --> Migrationen (Supabase) und geschützter Scheduler-Aufruf
Scheduler --> geschützter Next.js-Endpunkt --> Datenbank-Warteschlange --> SMTP
Supabase Auth --> separates SMTP für Einladungen und Wiederherstellung
```

| Technologie | Warum diese Wahl? | Wichtige Grenze |
| --- | --- | --- |
| Next.js / React / TypeScript | Oberfläche und Server in einem Projekt; wiederverwendbare Komponenten und typisierte Datenmodelle reduzieren Entwicklungsaufwand. | Framework-Komplexität; Typen ersetzen keine Laufzeitprüfung oder Autorisierung. |
| PostgreSQL / Supabase | Firmen, Personen, Projekte und Buchungen sind relationale Daten. Transaktionen, Constraints und Row Level Security schützen Konsistenz und Zugriffe; verwaltete Authentifizierung reduziert Eigenbau. | Supabase-Abhängigkeit bei Auth/API; ein Anbieterwechsel ist ein Migrationsprojekt. |
| Stripe | Checkout, Firmenabos und Kundenportal ohne eigene Kartenverarbeitung. | Gebühren, Webhooks und vertragliche Zahlungs-/Zugangsregeln bleiben zu berücksichtigen. |
| Luxon / Zod | Explizite Zürcher Zeitzone für Zeitberechnung; Laufzeitprüfung serverseitiger Eingaben. | Fachregeln und Berechtigungen müssen zusätzlich umgesetzt werden. |
| pdf-lib / CSV | Auszüge ohne zusätzlichen PDF-Dienst; CSV für Weiterverarbeitung. | Layoutpflege; kein Lohn- oder Rechnungsbeleg. |
| Nodemailer / SMTP | Serverversand mit wählbarem Mailanbieter und gespeicherten Versandaufträgen. | Zustellung muss überwacht werden; Wiederholungen können nach Ausfällen doppelte E-Mails verursachen. |
| PGlite / Playwright / Fachtests | Prüfung echter PostgreSQL-Regeln, Berechnungen und Browserabläufe. | Kein Ersatz für reale Integration, Lasttests oder unabhängige Sicherheitsprüfung. |

**Warum diese Architektur für uns?** Die eng zusammenhängenden Fachabläufe
lassen sich in einer Anwendung einfacher entwickeln und betreiben.
Verwaltete Dienste geben mehr Kapazität für Produkt und Pilotfeedback.
Mandanten und optionale Funktionen ermöglichen mehrere Kunden, ohne pro
Firmengrösse eine eigene Anwendung aufzubauen.

**Warum nicht gleich Microservices oder ein separates Backend?** Sie sind
sinnvoll bei unabhängigen Teams oder konkreten Last-/Integrationsanforderungen,
bringen hier zunächst aber zusätzliche Schnittstellen und Betriebsaufwand.
Eine Datenbank je Firma bietet stärkere betriebliche Trennung, vervielfacht
jedoch Einrichtung und Migrationen. Für reine interne Eigennutzung wäre auch
der Einkauf bestehender Software zu prüfen; Eigenentwicklung muss ihren
Mehrwert als eigenes SaaS-Produkt im Pilot belegen.

Diese Wahl ist **für den aktuellen Pilot zweckmässig**, nicht pauschal
schneller, sicherer oder günstiger als alle Alternativen. Leistungsfähigkeit
und Kosten müssen gemessen werden. Bei Wachstum werden zuerst Abfragen,
Indizes und Hintergrundaufträge optimiert; zusätzliche Dienste erst bei
nachgewiesenem Bedarf.

## 4. Sicherheit und Betrieb

Firmendaten werden über Mitgliedschaft, Rolle und bestätigte 2FA geschützt.
Zentrale Schreibregeln liegen in PostgreSQL-Funktionen; administrative
Serverzugriffe benötigen zusätzliche Autorisierung und bleiben ausserhalb
des Browsers. Eine ausgeblendete Schaltfläche ist keine Sicherheitsgrenze.

HTTPS schützt die Übertragung; Supabase Auth speichert gesalzene
bcrypt-Passworthashes, keine entschlüsselbaren Passwörter.
Passwort- und Authenticator-Felder sind getrennt. Infrastrukturzugänge
benötigen trotzdem organisatorische Kontrolle.

**Vor echten Personaldaten beziehungsweise öffentlichem Verkauf erforderlich:**
Hosting und Datenstandort wählen, Datenschutz-/Vertragsgrundlagen prüfen,
Support- und Wiederherstellungsprozesse festlegen sowie Backups, Restore,
Monitoring und Sicherheitsprüfung abnehmen. EU-Hosting bedeutet nicht
automatisch Schweizer Datenhaltung oder erfüllten Datenschutz.

## 5. Geschäftsmodell

Vorgesehen ist ein **monatlicher Festpreis pro Firma**. Preis, Nutzungsgrenzen,
Steuern und Vertragsbedingungen werden anhand des Pilots festgelegt.

Die Kalkulation berücksichtigt Hosting, Datenbank/Auth, E-Mail,
Zahlungsgebühren, Support und Wartung. Ein Festpreis ist keine Zusage
unbegrenzter Nutzung. Kostenfreie Firmen verursachen ebenfalls Aufwand.

**Automatischer Kundenlebenszyklus – ohne Betreiberaufwand im Normalfall:**

1. **Registrierung:** Selbstregistrierung mit E-Mail-Bestätigung; Firma und
   Admin entstehen automatisch, der Admin richtet Passwort und 2FA selbst ein.
2. **Testphase:** 14 Tage kostenlos, ohne Zahlungsdaten.
3. **Abo:** Der Admin schliesst es selbst über Stripe ab; Stripe-Webhooks
   steuern den Status.
4. **Ende oder Kündigung:** Die Firma wird automatisch **nur lesbar** – Daten
   bleiben sichtbar und exportierbar, neue Zeiten sind gesperrt. Mit
   aktivem Abo ist sie sofort wieder freigeschaltet. Bei Zahlungsverzug
   bleibt der Zugang, bis Stripe das Abo beendet (Mahnregeln in Stripe).
5. **Betrieb:** Tests, Datenbankmigrationen und der 15-Minuten-Scheduler
   laufen über GitHub Actions.

Der Betreiber greift nur noch bei Ausnahmen ein: kostenfreie Freischaltung
für Sonderfälle, Support und 2FA-Reset nach Identitätsprüfung. Vor Verkauf
bleiben Datenschutz-/Vertragsprüfung, Missbrauchsschutz (z. B. Captcha)
und die Einrichtung der Dienste (einmalig) menschliche Aufgaben.

## 6. Projektstand und nächster Entscheid

Die Kernfunktionen, flexible Arbeitsmodelle, Modal-Einrichtung, Rapporte,
Hinweise, Stripe-Anbindung sowie Selbstregistrierung, Testphase,
automatische Lese-Sperre und Betriebsautomatisierung (CI, Migrationen,
Scheduler) sind im Pilotcode implementiert und automatisiert getestet.
**Implementiert bedeutet noch nicht produktiv abgenommen:** Auth, SMTP,
GitHub-Secrets und Stripe-Testabläufe (Checkout, Zahlungsausfall,
Kündigung) müssen einmalig in der Zielumgebung eingerichtet und mit echten
Diensten geprüft werden. Offen sind zudem Missbrauchsschutz bei der
Registrierung (z. B. Captcha), Unterdrücken von Hinweisen für gesperrte
Firmen und ein automatischer Ablauf für Passwort-/2FA-Verlust.

Offene Ausbauten sind unter anderem Ferienüberträge/Austritte, vollständige
Abwesenheitskorrekturen, automatische Feiertags-Sollberechnung und
Optimierungen für grosse Historien. Einrichtung und technische Details
stehen im [README](../README.md).

**Empfehlung:** Einen begrenzten Pilot mit ein bis drei kleinen Firmen über
die Selbstregistrierung starten, noch keinen öffentlichen Verkaufsstart.
Dafür Produkt-/Betriebsverantwortung,
Budget und Datenschutzvoraussetzungen festlegen. Mindestens einen Monatszyklus
erproben und Einrichtungsaufwand, Rapportqualität, Supportkosten sowie
Zahlungsbereitschaft bewerten, einschliesslich Testende und Abo-Abschluss.
Danach Preis, Leistungsgrenzen und Produktionsfreigabe entscheiden.
