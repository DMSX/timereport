# TimeReport – Produkt- und Umsetzungskonzept

**Projekt:** Projektbezogene Zeiterfassung als SaaS  
**Stand:** 12. Oktober 2026 · Version 1.0  
**Zweck:** Entscheidungsgrundlage für Pilotierung und anschliessende Produktentwicklung  
**Status:** Technische Pilotversion vorhanden; öffentlicher Verkaufsbetrieb noch nicht freigegeben

## 1. Management Summary

TimeReport soll kleinen Unternehmen und Teams eine einfach bedienbare,
projektbezogene Zeiterfassung bieten. Mitarbeitende starten und beenden ihre
Arbeitszeit per Knopfdruck. Die Anwendung ordnet Arbeitsblöcke Projekten zu,
erstellt Monatsrapporte und vergleicht Zeiten nur bei ausdrücklich gewähltem Soll-Modell mit dem individuellen Soll.
Firmen verwalten ihre Mitarbeitenden, Projekte und Arbeitsregeln selbst.

Das Produkt wird als browserbasierte Software mit einem monatlichen
**Festpreis pro Firma** angeboten. Zusätzlich kann der Betreiber ausgewählte
Firmen kostenfrei freischalten. Von Beginn an werden die Daten unterschiedlicher
Firmen voneinander getrennt; ein späterer Ausbau auf mehrere Kunden erfordert
somit keine grundlegende Umstellung des Datenmodells.

Eine erste Pilotversion einschliesslich überarbeiteter Benutzeroberfläche ist
bereits implementiert. Sie bildet die wesentlichen Arbeitsabläufe ab, ersetzt
aber noch kein produktionsreifes Personal- oder Abrechnungssystem.
Insbesondere Cloud-Integration, Datenschutz, Betrieb und Zahlungsprozesse
benötigen vor dem Verkauf weitere Absicherung.

**Empfehlung:** Zunächst einen begrenzten Pilotbetrieb mit einer Firma
freigeben. Eine verbindliche Entscheidung über Preis, Vertriebsstart und
Skalierung erst anhand der Pilotergebnisse und einer belastbaren
Betriebskostenrechnung treffen.

## 2. Ausgangslage und Nutzen

In kleinen Unternehmen werden Arbeitszeiten häufig manuell in Tabellen,
Formularen oder nachträglich aus Erinnerungen zusammengestellt. Dadurch
entstehen Medienbrüche, Fehler und zusätzlicher Aufwand am Monatsende.
Projektbezug und unterschiedliche Arbeitsmodelle erhöhen die Komplexität.

TimeReport bündelt Erfassung, Prüfung und Auswertung in einem Arbeitsablauf:

| Zielgruppe | Nutzen |
| --- | --- |
| Mitarbeitende | Einfache Erfassung, Überblick über Tageszeit und Soll, nachvollziehbare eigene Buchungen. |
| HR / Personalverantwortliche | Einheitliche Rapporte, Prüfung von Abwesenheiten und Pausenverstössen, nachvollziehbare Korrekturen. |
| Firmen-Admin | Zentrale Verwaltung von Projekten, Mitarbeitenden und Firmenregeln. |
| SaaS-Betreiber | Wiederverwendbares Produkt für mehrere Firmen mit zentraler Aufnahme, Abostatus und Freischaltung. |

Der erste Anwendungsfall ist eine kleine Firma mit einer oder wenigen Personen.
Die Architektur berücksichtigt zugleich Firmen mit mehreren Mitarbeitenden
und Projekten. Nachfrage, Zahlungsbereitschaft und Wettbewerbsvorteile sind
noch im Pilot beziehungsweise durch Marktgespräche zu validieren.

## 3. Zielbild und Abgrenzung

**Produktziel:** Eine Person soll nach der Einrichtung ohne technisches Wissen
ein Projekt wählen, einchecken und ihre erfasste Zeit nachvollziehen können.
Ein Firmen-Admin soll sein Team eigenständig einrichten und am Monatsende
einen verständlichen Auszug erhalten.

Die Anwendung ist zunächst eine deutschsprachige Weblösung für Schweizer
Teams mit der Zeitzone `Europe/Zurich`. Desktop und Smartphone verwenden
dieselbe responsive Oberfläche.

Nicht Bestandteil des ersten Zielumfangs sind Lohnabrechnung,
Kundenfakturierung, Projektbudgets, Ressourcenplanung, native Apps,
Offline-Erfassung und Anbindungen an bestehende ERP-/HR-Systeme.
Eine gesetzliche Arbeitsrechtskonformität wird nicht pauschal zugesichert.

**Begriffsklärung:** Projekte sind die Buchungsziele innerhalb einer Firma,
keine Benutzerlizenzen oder automatisch begrenzten Stundenkontingente.
Ferien besitzen dagegen ein Guthaben; Krankheit wird separat als Abwesenheit
erfasst, ohne begrenztes Guthaben.

## 4. Rollen und Verantwortlichkeiten

| Rolle | Verantwortungsbereich |
| --- | --- |
| Mitarbeitende | Eigene Zeiten auf zugewiesene Projekte buchen, zulässige Nachträge/Korrekturen erfassen, eigene Abwesenheiten eintragen und Rapporte exportieren. |
| HR | Zeiten und Abwesenheiten der eigenen Firma prüfen, Arbeitsmodelle verwalten, gesperrte Zeiten korrigieren und Pausenverstösse klären. |
| Firmen-Admin | Zusätzlich Personen einladen, Rollen und Projekte verwalten, Firmenregeln festlegen und das Abo verwalten. |
| SaaS-Betreiber | Firmen aufnehmen, Abometadaten verwalten und kostenfreie Nutzung freischalten. Kein pauschaler Zugriff auf Zeit- oder Abwesenheitsdaten. |

Der Betreiber benötigt für inhaltlichen Zugriff eine ausdrücklich zugewiesene
Firmenmitgliedschaft. Privilegierte Infrastrukturzugänge sind hiervon zu
unterscheiden: Sie können technisch weitreichenden Zugriff ermöglichen und
müssen organisatorisch begrenzt, geschützt und überwacht werden.

## 5. Fachlicher Funktionsumfang

### 5.1 Projektbezogene Zeiterfassung

Eine Buchung gehört immer zu einer Person, einer Firma und einem Projekt.
Mitarbeitende können nur auf aktive, ihnen zugewiesene Projekte einchecken.
Beliebig viele Arbeitsblöcke pro Tag sind möglich; Überschneidungen und
mehrere gleichzeitig laufende Buchungen einer Person sind gesperrt.

Start und Ende regulärer Buchungen werden serverseitig gespeichert.
Ein laufender Block bleibt beim Schliessen des Browsers bestehen.
Vergessene Blöcke können innerhalb der erlaubten Frist mit Begründung
nachgetragen werden.

### 5.2 Sollzeit und Arbeitsmodelle

Das Zeiterfassungsmodell ist **pro Person wählbar**, unabhängig von
Unternehmensgrösse oder Rolle. Stundenbasis erfasst ausschliesslich Iststunden:
kein Soll, keine Minus-/Überstundenbewertung und keine automatische Prüfung
fehlender Buchungen. Ein Modellwechsel gilt ab einem Datum und schreibt
historische Auswertungen nicht pauschal um.

Abwesenheiten und Fehlbuchungshinweise sind separate Firmenoptionen; es gibt
kein starres Solo-/Team-Paket. So können auch mehrere Personen ohne
Personalprozesse einfach Stunden buchen. Neue Arbeitsbereiche starten ohne
beide Zusatzfunktionen, bestehende behalten ihre Einstellung. Abschalten
löscht keine historischen Einträge. Das geschützte Mandantenmodell bleibt.

**Nur bei einem Soll-Modell:**
Die Wochen-Sollzeit wird pro Person über die Verteilung auf sieben Wochentage
festgelegt. Die Oberfläche verwendet Stunden; die Datenbank speichert Minuten.
Arbeitsmodelle haben ein Gültigkeitsdatum, sodass Änderungen historisch
zugeordnet werden können. Optionale geplante Anfangs- und Endzeiten dienen
der Information und der Fristberechnung für aktivierte Hinweise; sie starten
keine automatische Zeiterfassung.

Erfasste Arbeitszeit ist **Istzeit**, nicht Sollzeit. Das Soll ergibt sich aus
dem hinterlegten Arbeitsmodell. Genehmigte Abwesenheiten können Sollstunden
ausgleichen.

### 5.3 Pausen und Regelverstösse

Die Firma definiert eine Grundregel; Projekte können diese verschärfen.
Beispiel: spätestens nach 120 Minuten Arbeit eine Pause von 15 Minuten.
Ein Projektwechsel setzt die seit der letzten ausreichenden Pause
angesammelte Arbeitszeit nicht zurück.

Auschecken beendet einen Arbeitsblock. Der Abstand zum nächsten Einchecken
wird als Pause gewertet. Damit wird ein zeitlicher Unterbruch erkannt, nicht
automatisch die tatsächliche Art der Unterbrechung.

**Bewusste Entscheidung:** Bei einem Verstoss wird die Arbeitszeit weiter
erfasst und der betroffene Block markiert. Es gibt keine automatische Löschung
geleisteter Arbeit. HR/Admin klärt den Sachverhalt mit Begründung.
Die beispielhafte Regel ist eine Geschäftsregel und keine vollständige
Abbildung gesetzlicher Schweizer Pausenvorschriften.

### 5.4 Korrekturen und Nachvollziehbarkeit

Die Firma bestimmt die Selbstkorrekturfrist. Standardmässig bleibt eine
Arbeitswoche bis Sonntag der Folgewoche, 23:59 Uhr Zürich, bearbeitbar.
Danach sind Änderungen nur durch HR/Admin erlaubt.

Nachträge und Korrekturen benötigen einen Grund und werden protokolliert.
Eine Zeitverschiebung in eine bereits gesperrte Woche ist ebenfalls gesperrt.
Eine Korrekturfrist ist kein formeller Monatsabschluss; ein verbindlicher
Abschluss- und Freigabeprozess wäre eine zusätzliche Funktion.

### 5.5 Ferien und Krankheit

Bei Soll-Modellen werden Ferien gegen ein Jahresguthaben in Tagen ausgewertet.
Ganze Tage, halbe Tage und Datumsbereiche sind möglich.
Krankheit wird getrennt erfasst und besitzt kein begrenztes Guthaben.

Die Firma entscheidet, ob Abwesenheiten genehmigt werden müssen.
Ohne Genehmigungspflicht werden neue Einträge direkt genehmigt.
Nur genehmigte Abwesenheiten werden in der Soll-/Ist-Auswertung gutgeschrieben;
offene Ferienanträge reservieren bereits Guthaben.

Bei Stundenbasis werden aktivierte Abwesenheiten dokumentiert, aber ohne
Stunden- oder Ferienrestberechnung, da keine erwarteten Arbeitstage vorliegen.
Ferienlohn und variable Arbeitspensen sind keine Funktionen dieser Pilotversion.

Für den marktfähigen Ausbau sind insbesondere jahresspezifische Ferienkonten,
Überträge, Ein-/Austritte, Teilzeitberechnung und kantonale Feiertage zu klären.

### 5.6 Monatsrapporte

Der Monatsrapport enthält Iststunden und Projektbuchungen. Soll und Saldo
werden nur für die Tage mit gültigem Soll-Modell ausgewertet. Stundenbasis
erzeugt keine positiven oder negativen Salden. Optional dokumentierte
Abwesenheiten stehen als Kalendertage und auf Soll-Tagen als Stundengutschriften
im Rapport. Exportformate sind PDF und CSV
für die Weiterverarbeitung in Excel.

Monatsgrenzen und Zeitumstellungen werden in der Zeitzone Zürich berücksichtigt.
Laufende Buchungen bleiben vorläufig; der Monats-Saldo berücksichtigt
gegenwärtig auch das Soll zukünftiger Tage im gewählten Monat.
Der Export ist kein Lohnabrechnungs- oder Rechnungsbeleg.

### 5.7 Hinweise bei fehlender Zeiterfassung

An vorgesehenen Arbeitstagen soll das System erkennen, wenn eine Person bis
zu einem festgelegten Prüfzeitpunkt noch keine Arbeitszeit erfasst hat und
keine passende Abwesenheit vorliegt. Die dafür verantwortliche Person erhält
einen Hinweis und kann die betroffene Person zur Klärung oder zum Nachtragen
auffordern.

Beispiel: Für eine Person ist am Montag Arbeit vorgesehen. Bis zum
Nachmittags-Prüfzeitpunkt existiert weder ein Arbeitsblock noch ein laufender
Check-in oder eine passende Abwesenheit. Im Verantwortlichenbereich erscheint
„Zeiterfassung fehlt – bitte klären“.

**Keine automatische Fehlzeitenbewertung:** Ein fehlender Eintrag beweist
nicht, dass die Person nicht gearbeitet hat. Es werden keine Arbeitsstunden
erfunden, keine Abwesenheiten automatisch gebucht und keine disziplinarischen
Bewertungen erzeugt.

Für die Umsetzung sind je Firma folgende Regeln festzulegen:

| Regel | Erforderliche Entscheidung |
| --- | --- |
| Prüfzeitpunkt | Je Person relativ zum geplanten Arbeitsbeginn; Zeitzone Zürich. Eine feste Firmenuhrzeit ist kein aktueller Funktionsumfang. |
| Auslöser | Zunächst keinerlei Buchung bis zum Prüfzeitpunkt; eine fehlende Nachmittagsbuchung trotz Vormittagsarbeit wäre ein eigener, gesondert zu definierender Fall. |
| Ausnahmen | Freie Tage, gültige Arbeitsmodelle, Teil-/Ganztagsabwesenheiten und Feiertage berücksichtigen. Offene Abwesenheitsanträge benötigen eine ausdrücklich definierte Behandlung. |
| Empfänger | Zuständige Person je Mitarbeitendem oder eine ausdrücklich konfigurierte HR-/Admin-Zuständigkeit, nicht automatisch alle Admins. |
| Kanal | Hinweis in der Anwendung; E-Mail beziehungsweise weitere Kanäle nach Freigabe. Keine unnötigen Krankheitsdetails in Benachrichtigungen. |
| Bearbeitung | Verantwortliche können erinnern und den Hinweis mit Grund klären. Nachträge müssen den Status neu bewerten; ursprüngliche Hinweise bleiben nachvollziehbar. |
| Wiederholung | Doppelte Meldungen verhindern; Erinnerungs- und Eskalationsabstände ausdrücklich festlegen. |

Die Prüfung muss serverseitig geplant laufen, auch wenn niemand die Anwendung
geöffnet hat. Benachrichtigungen benötigen gespeicherten Bearbeitungsstatus,
Zuständigkeit, Wiederholungs-/Fehlerbehandlung und eine nachvollziehbare
Zustellung. Das bestehende informative Arbeitszeitfenster wird nicht ohne
zusätzliche Konfiguration als verbindlicher Schichtplan interpretiert.

Diese Funktion ist im Pilotcode implementiert. Die neue Datenbankmigration,
SMTP und der externe 15-Minuten-Scheduler müssen vor Einsatz eingerichtet
und mit echten Testkonten abgenommen werden. Details stehen im README.

**Bestätigte Produktentscheidungen (12. Oktober 2026):**

- Auslöser ist ausschliesslich: am vorgesehenen Arbeitstag bis zur Prüffrist
  überhaupt keine Zeitbuchung. Ein Vormittagsblock verhindert diesen Hinweis;
  eine gesonderte Prüfung auf fehlende Nachmittagsbuchungen ist nicht enthalten.
- Die Prüffrist wird je Person relativ zum geplanten Arbeitsbeginn
  konfiguriert. Die konkrete Dauer wird in der Einrichtung festgelegt.
  Ohne gültigen Arbeitsbeginn oder konfigurierte Frist erfolgt keine
  spekulative Fehlmeldung; die fehlende Konfiguration muss sichtbar sein.
- Je Mitarbeitendem wird eine zuständige Person innerhalb der Firma
  hinterlegt. Deren Zugriff auf notwendige Hinweise und Zeitdaten muss
  ausdrücklich durch die Rollen-/Berechtigungsregeln gedeckt sein.
- Verantwortliche erhalten Hinweise in der Anwendung und per E-Mail.
  Erinnerungen an Mitarbeitende werden von ihnen manuell ausgelöst;
  es gibt zunächst keine automatische Eskalation.
- Liegt eine passende, noch offene Abwesenheit vor, lautet der Hinweis
  „Abwesenheit zur Prüfung offen“ statt „Zeiterfassung fehlt“.
  Halbtagsfälle müssen dem betroffenen Arbeitszeitfenster zugeordnet werden;
  das bisherige Datenmodell unterscheidet noch nicht Vormittag/Nachmittag.
- Erkennung und Hinweiszustellung laufen serverseitig alle 15 Minuten.
  Manuelle Erinnerungen werden in der App und per E-Mail bereitgestellt.
  Die Warteschlange speichert Zustellstatus und Fehlversuche, verhindert
  wiederholte Beauftragung derselben Erinnerung und erlaubt HR/Admin
  manuelle Wiederholungen fehlgeschlagener Zustellungen.
- Neue Halbtage unterscheiden Vormittag/Nachmittag; bestehende Einträge
  ohne Zuordnung erzeugen einen Klärungshinweis. Das geplante Zeitfenster
  wird in zwei gleich lange Hälften geteilt. Bei fehlendem oder ungeeignetem
  Zeitfenster erfolgt keine automatische Interpretation als Schichtplan.

## 6. Benutzerführung

| Schritt | Ablauf |
| --- | --- |
| Firmenaufnahme | Der Betreiber legt eine Firma an und bestimmt ihren Admin. |
| Sicherer Einstieg | Benutzer bestätigen ihre Einladung, richten Authenticator-2FA ein und setzen ein Passwort. |
| Einrichtung | Die Oberfläche führt durch Arbeitsmodelle, erstes Projekt und Teamzuweisung. |
| Tägliche Nutzung | „Mein Arbeitstag“ zeigt Uhr und Istzeit; Soll und Fortschritt nur bei einem Soll-Modell. Projekt wählen, einchecken, für Pause oder Feierabend auschecken. |
| Prüfung | Buchungen und Abwesenheiten werden in eigenen Bereichen geprüft. Änderungen erfolgen in fokussierten Dialogen. |
| Monatsende | HR/Admin beziehungsweise Mitarbeitende erstellen den zulässigen PDF-/CSV-Auszug. |

Die Navigation trennt den persönlichen Arbeitsplatz von Firmenverwaltung und
Betreiberbereich. Team und Projekte sind durchsuchbar; Bearbeitungsdetails
werden erst bei Bedarf geöffnet. Die Nutzer sehen nur Bereiche, die zu ihrer
Rolle gehören. Zugriffsregeln werden zusätzlich in der Datenbank durchgesetzt,
nicht nur über ausgeblendete Schaltflächen.

### 6.1 Geführte Ersteinrichtung

Jeder neue Benutzer soll einen schrittweisen Einrichtungsassistenten erhalten,
vergleichbar mit der Ersteinrichtung eines neuen Geräts: ein Schritt pro
Modal, verständliche Erklärung, sichtbarer Fortschritt sowie Zurück und
Weiter. Der Fortschritt wird dauerhaft gespeichert und lässt sich nach einer
Unterbrechung auf einem anderen Gerät fortsetzen. Eine Übersicht am Ende zeigt,
was eingerichtet wurde und welche Schritte noch von Verantwortlichen abhängen.

Die Führung richtet sich nach Rolle und Firmenkontext:

| Rolle | Vorgesehene Schritte |
| --- | --- |
| Betreiber | Zugang absichern, erste Firma aufnehmen, Firmen-Admin bestimmen, Pilot-/Abostatus festlegen. |
| Firmen-Admin | Firmenangaben und Regeln prüfen, Arbeitsmodelle hinterlegen, Projekte erstellen, Team einladen/zuweisen, Zuständigkeiten und Erinnerungsregeln festlegen, Abschlussübersicht. |
| Mitarbeitende / HR | Einladung und Zugang abschliessen, eigenen Firmenkontext und hinterlegte Arbeitszeiten prüfen, zugewiesene Projekte kennenlernen, Ein-/Auschecken und Abwesenheitsablauf verstehen. |

Mitarbeitende ändern im Assistenten keine Firmenregeln, Rollen oder Sollzeiten,
für die sie keine Berechtigung besitzen. Fehlende Admin-Konfiguration wird
als offene Voraussetzung angezeigt, nicht durch stille Standardwerte ersetzt.
Ein Tutorial legt keine echte Arbeitsbuchung an. Optionale Erklärungen sind
überspringbar; verpflichtende Sicherheits- und Einrichtungsschritte nicht.

Der Abschluss gilt pro Benutzer und gegebenenfalls pro Firmenmitgliedschaft:
Eine neu hinzugefügte Firma kann eine erneute kontextspezifische Einführung
erfordern, ohne die bereits vorhandene Authenticator-Einrichtung zu wiederholen.
Im Alltag lässt sich die Hilfe erneut öffnen, ohne Konfiguration zurückzusetzen.

**Aktueller Stand:** Login-/2FA-Schritte, Einrichtungsliste und ein
rollenabhängiger Assistent mit dauerhaft gespeichertem Fortschritt sind
im Pilotcode implementiert. Der Assistent enthält die echten Formulare
direkt im Modal, statt auf andere Seiten zu verweisen. Firmen-Admins
wählen Funktionen, speichern pro Person Stundenbasis oder Soll und erstellen
Projekte samt Zuweisungen direkt darin. Mitarbeitende erhalten eine Einführung
ohne unberechtigte Konfigurationsrechte. HR kann das eigene Modell bearbeiten.
Erforderliche Arbeitsmodelle und Projektzuweisungen blockieren den Abschluss,
solange sie fehlen; Stundenbasis ist ein gültiges Modell ohne Soll.
Abwesenheiten und Hinweise sind explizit aktivierbare Firmenoptionen.

## 7. Technisches Konzept

```text
Browser: Desktop / Smartphone
              |
              v
Next.js / React / TypeScript
Oberfläche, serverseitige Schnittstellen, PDF-/CSV-Auszüge
              |
              +--> Supabase Auth: E-Mail/Passwort und TOTP-2FA
              |
              +--> Supabase-Daten-API / PostgreSQL:
              |                Firmen, Rollen, Projekte, Buchungen,
              |                Arbeitsmodelle, Abwesenheiten, Änderungsprotokoll
              |
              +--> Stripe: Checkout, Kundenportal, Abo-Ereignisse
              |
              +--> SMTP: Rapportierungshinweise und manuelle Erinnerungen

Browser --> Supabase-Daten-API --> PostgreSQL RLS / geprüfte Funktionen
           Benutzergebundener Zugriff, kein Service-Schlüssel im Browser

Externer Scheduler --> geschützter Next.js-Endpunkt
                      --> PostgreSQL-Prüfung / E-Mail-Warteschlange --> SMTP

Supabase Auth --> separat eingerichtetes SMTP für Einladungen / Wiederherstellung
```

### 7.1 Architekturentscheidung und Nutzen

**Entscheidung:** Ein zentraler Next.js-Anwendungscode mit modular getrennten
Oberflächen, serverseitigen Schnittstellen und Fachfunktionen, ergänzt durch
verwaltetes PostgreSQL/Auth, einen Zahlungsdienst und SMTP.
Es handelt sich nicht um eine Microservice-Landschaft mit eigenen Diensten
für jede Fachfunktion. Sicherheits- und Datenkonsistenzregeln liegen zusätzlich
in der Datenbank, nicht ausschliesslich in der Weboberfläche.

**Warum passt dies zu unserem Vorhaben?** Der wichtigste Engpass im Pilot ist
die schnelle, verlässliche Umsetzung und Prüfung der Geschäftsabläufe:
Zeiten, Projekte, Soll-Modelle, Abwesenheiten und Berechtigungen gehören eng
zusammen. Eine überschaubare Anwendung reduziert Deployment-, Schnittstellen-
und Abstimmungsaufwand. Verwaltete Dienste vermeiden zunächst den Eigenbau
von Anmeldung, Zahlungsabwicklung und Datenbankbetrieb.

| Ziel | Architekturbeitrag | Konkreter Nutzen |
| --- | --- | --- |
| Kleiner Einstieg, spätere Firmenkunden | Gemeinsame Anwendung mit mandantenbezogenen Daten und optionalen Funktionen. | Kein separates Produkt pro Firmengrösse; Stundenbasis und Soll-Modelle können in derselben Firma bestehen. |
| Verlässliche Zeitdaten | Relationale Beziehungen, Constraints, Transaktionen und geprüfte Schreibfunktionen. | Zusammengehörige Änderungen bleiben konsistent; paralleles Einchecken oder Manipulation über direkte API-Aufrufe wird nicht nur durch die UI verhindert. |
| Schutz von Personaldaten | Benutzergebundener Zugriff, RLS, rollenabhängige Rechte und bestätigte 2FA. | Die Datenbank prüft Zugriffsregeln auch ausserhalb der sichtbaren Oberfläche. Das ersetzt keine Prüfung der konkreten Regeln. |
| Schnelle Produktentwicklung | TypeScript für Oberfläche und Server; wiederverwendete Formulare und Fachfunktionen. | Weniger doppelte Implementierung, früh erkennbare Typfehler und kleinere Änderungskosten. |
| Begrenzter Betriebsaufwand | Verwaltete Authentifizierung/Datenbank und Stripe statt selbst betriebener Speziallösungen. | Mehr Entwicklungszeit für den Produktnutzen; weniger eigene Infrastrukturkomponenten. Verträge, Monitoring und Wiederherstellung bleiben erforderlich. |
| Erweiterbarkeit | Fachbereiche im Code getrennt, versionierte SQL-Migrationen und Tests. | Neue Funktionen lassen sich schrittweise ergänzen, ohne sofort ein verteiltes System einzuführen. |

Die Architektur ist **für diesen Pilot und die aktuelle Entwicklungsorganisation
zweckmässiger**, nicht grundsätzlich schneller, sicherer oder günstiger als
jede Alternative. Diese Eigenschaften hängen von Umsetzung, Auslastung,
Dienstverträgen und Betrieb ab. Ein Lasttest oder eine belastbare
Betriebskostenmessung ist noch nicht vorhanden.

### 7.2 Technologien: Auswahl und bewusste Nachteile

| Technologie | Aufgabe | Warum gewählt? | Nachteil / Grenze |
| --- | --- | --- | --- |
| Next.js mit React | Browseroberfläche und serverseitige HTTP-Endpunkte in einem Projekt. | Passt zu einer interaktiven Webanwendung mit Dialogen, Rollenansichten und serverseitigen Exporten; kein separates Frontend-/Backend-Projekt für den Pilot nötig. | Framework-Komplexität und Versionsänderungen; Browser-/Servergrenzen müssen sauber eingehalten werden. Serverlaufzeiten des gewählten Hostings begrenzen lange Aufträge. |
| TypeScript | Typisierte Entwicklung von Oberfläche, Schnittstellen und Fachfunktionen. | Datenmodelle und Funktionsverträge werden explizit; viele inkonsistente Änderungen fallen vor der Auslieferung auf. | Typen validieren keine externen Eingaben zur Laufzeit und beweisen keine fachliche Korrektheit. |
| PostgreSQL | Speicherung der Mandanten-, Projekt-, Zeit- und Abwesenheitsdaten. | Die Daten sind stark miteinander verknüpft; Fremdschlüssel, eindeutige Regeln, Transaktionen und SQL-Auswertungen passen dazu. RLS erlaubt Datenzugriffsregeln nahe an den Daten. | SQL-/Berechtigungslogik benötigt Fachwissen, sorgfältige Migrationen und Tests. Eine gemeinsame Datenbank ist eine gemeinsame Betriebsabhängigkeit. |
| Supabase | Verwaltetes PostgreSQL, Authentifizierung und benutzergebundene Daten-API. | Verkürzt die Umsetzung von Login, MFA und Datenzugriff; verbindet Auth-Identität mit PostgreSQL-Zugriffsregeln. | Anbieterabhängigkeit durch Auth, SDKs und API-Verhalten; Kosten, Regionen, Limits und vertragliche Bedingungen müssen geprüft werden. |
| Stripe | Firmenabos, Checkout, Kundenportal und Zahlungsereignisse. | Zahlungsdaten und Zahlungsabläufe werden nicht selbst aufgebaut; der Pilot nutzt etablierte Schnittstellen statt eigener Kartenverarbeitung. | Gebühren, externe Verfügbarkeit und Webhook-Komplexität. Steuer-/Vertragsfragen und die Zugangsregeln bei Zahlungsproblemen bleiben unsere Aufgabe. |
| Luxon | Datums-/Zeitberechnung mit Europe/Zurich. | Explizite Zeitzonen helfen bei Tagesgrenzen, Monatswechsel und Sommer-/Winterzeit; Arbeitsdauer wird über tatsächliche verstrichene Zeit berechnet. | Eine Bibliothek entscheidet keine fachlichen Regeln für Schichtarbeit, Halbtage oder Feiertage. Diese müssen separat definiert und getestet werden. |
| Zod | Laufzeitprüfung serverseitiger Anfrageparameter. | Ungültige Formate und Werte werden vor Verarbeitung zurückgewiesen; ergänzt TypeScript an externen Eingabegrenzen. | Validierung ersetzt weder Autorisierung noch Datenbank-Constraints. Nicht jeder direkte Datenzugriff läuft durch einen Next.js-Endpunkt. |
| pdf-lib und CSV-Ausgabe | Serverseitige Monatsauszüge. | PDF lässt sich ohne zusätzlichen Browser-/PDF-Dienst erzeugen; CSV ist einfach weiterverarbeitbar. | PDF-Layout muss selbst gepflegt werden; CSV besitzt kein visuelles Layout. Ein Export ist noch kein rechtsverbindlicher Lohnbeleg. |
| Nodemailer mit SMTP | Versand von Hinweisen und manuellen Erinnerungen. | SMTP ermöglicht die Auswahl eines passenden Mailanbieters; Versand bleibt serverseitig. | Zustellung, Absenderkonfiguration und Providerlimits müssen betrieben werden. Annahme durch SMTP ist kein Nachweis des Empfangs oder Lesens. |
| Node-Testläufe, PGlite, Playwright und ESLint | Fachlogik-, SQL-, Browser- und statische Prüfungen. | Die zentralen Regeln werden auf mehreren Ebenen überprüft: Berechnung, echte PostgreSQL-Funktionen und Benutzerabläufe. | Isolierte Tests ersetzen weder Cloud-Integrationstests noch Lasttests, Restore-Tests oder eine unabhängige Sicherheitsprüfung. |

Es wird bewusst **keine zusätzliche Verschlüsselung des Passworts im
Browser selbst erfunden**: HTTPS schützt die Übertragung; Supabase Auth
speichert laut seiner Dokumentation gesalzene bcrypt-Passworthashes.
Hashing ist keine rückgängig machbare Verschlüsselung. TOTP ist eine weitere,
separate Zugriffshürde. Die Konfiguration des Hostings und sichere
Wiederherstellungsprozesse bleiben notwendig.

### 7.3 Verantwortlichkeiten und Sicherheitsgrenzen

Die Architektur kombiniert zwei Zugriffswege, nicht nur einen:

| Weg | Einsatz | Verbindliche Grenze |
| --- | --- | --- |
| Browser → Supabase-Daten-API | Benutzergebundene Lesezugriffe und erlaubte Konfigurationsänderungen; Zeitoperationen über Datenbankfunktionen. | Publishable Key ist kein administratives Geheimnis. Benutzeridentität, RLS, Constraints und Funktionsrechte müssen jede Operation schützen. Ausgeblendete UI-Elemente sind keine Autorisierung. |
| Browser → Next.js-Endpunkt | Einladungen, Firmenaufnahme, Abos und Rapporte. | Endpunkt prüft Anmeldung, 2FA und erforderliche Rolle. Administrative Zugangsdaten bleiben auf dem Server; eine Service-Verbindung umgeht RLS und benötigt deshalb ausdrückliche Autorisierung. |
| Scheduler → Next.js-Endpunkt | Prüfung fehlender Buchungen und Abarbeitung der E-Mail-Warteschlange. | Separates geheimes Bearer-Token statt öffentlichem Aufruf. Zeitplan, Laufzeit und Fehleralarmierung müssen beim Hosting eingerichtet werden. |
| Stripe → Next.js-Webhook | Synchronisation des Abostatus. | Signaturprüfung und Zuordnung anhand gespeicherter Kunden-IDs; keine Übernahme beliebiger vom Browser übermittelter Zahlungszustände. |

Beispiel **Einchecken**: Der Browser fordert eine Buchung mit einem
zugewiesenen Projekt an. Die Datenbankfunktion prüft Berechtigung und
Geschäftsregeln und setzt die Datenbankzeit. Ein manipulierter Browser darf
damit weder fremde Firmen buchen noch eine beliebige Startzeit oder
gleichzeitig mehrere laufende Buchungen durchsetzen.

Beispiel **Monatsrapport**: Ein serverseitiger Endpunkt prüft, ob die Person
ihren eigenen oder als HR/Admin einen zulässigen Firmenrapport abrufen darf.
Die Tagesauswertung verwendet die datierten Arbeitsmodelle und Zürich als
Zeitzone. Darstellung und Export dürfen Stundenbasis nicht als Pluszeit
gegen ein künstliches Null-Soll ausweisen.

Beispiel **E-Mail-Hinweis**: Die Prüfung speichert den Hinweis und einen
Versandauftrag in PostgreSQL. Erst danach wird SMTP verwendet.
Eine gespeicherte Warteschlange macht fehlgeschlagenen Versand sichtbar und
erlaubt erneute Versuche. Datenbank und SMTP bilden aber keine gemeinsame
Transaktion: Eine doppelte Zustellung nach einem Ausfall bleibt möglich.
Die Architektur bietet deshalb keine Exactly-once-Zustellgarantie.

### 7.4 Alternativen und warum wir sie zunächst nicht wählen

Die folgende Gegenüberstellung ist eine Entscheidungsbegründung, keine
gemessene Kosten- oder Leistungsrangliste.

| Alternative | Wann sinnvoll? | Warum nicht unsere erste Wahl? |
| --- | --- | --- |
| Getrenntes Frontend und eigenes Backend, z. B. React plus .NET, Java oder NestJS | Vorhandene Backend-Teams, zentrale Unternehmensschnittstellen oder mehrere unterschiedliche Clients. | Für den aktuellen Pilot zusätzlicher Deployment- und Schnittstellenaufwand. Diese Technologien sind nicht schlechter; ihr Mehrwert müsste unsere organisatorischen Anforderungen rechtfertigen. |
| Microservices für Zeiten, Projekte, Abwesenheiten und Abos | Unabhängige Teams, stark unterschiedliche Lastprofile oder nachgewiesene technische Grenzen. | Die Fachbereiche teilen viele Daten und Regeln. Verteilte Transaktionen, Authentifizierung, Monitoring und Releases erhöhen die Komplexität, bevor ein entsprechender Nutzen nachgewiesen ist. |
| Selbst betriebenes PostgreSQL und eigener Identity-Dienst | Strenge Infrastrukturvorgaben, entsprechendes Betriebsteam oder benötigte Kontrolle über die Plattform. | Mehr Verantwortung für Updates, Auth-Sicherheit, Verfügbarkeit und Wiederherstellung. Kann später bei konkreten Kundenanforderungen neu bewertet werden. |
| Dokumentenorientierte Datenbank als Hauptspeicher | Wenig relationale Daten oder andere dominierende Zugriffs-/Synchronisationsanforderungen. | Unser Kern benötigt Beziehungen und Konsistenz zwischen Firmen, Rollen, Projekten, Buchungen und datierten Modellen. PostgreSQL bildet diese Regeln unmittelbar ab; eine Dokumentendatenbank wäre nicht unmöglich, verlangte aber andere Daten- und Konsistenzentscheidungen. |
| Eigene Datenbank je Firma | Vertraglich verlangte Isolation, individuelle Datenstandorte oder getrennte Wiederherstellung je Kunde. | Provisionierung, Migrationen und Betrieb vervielfachen sich. Für den Pilot verwenden wir logisch getrennte Mandanten; das erfüllt nicht automatisch jede spätere Isolationserwartung. |
| Bestehendes Zeiterfassungsprodukt einkaufen | Interner Bedarf ohne eigenes SaaS-Geschäft oder ohne wesentlichen Differenzierungsbedarf. | Wäre für reine Eigennutzung ausdrücklich zu prüfen. Das Vorhaben verfolgt aber ein eigenes Produkt mit konfigurierbaren Abläufen. Eigenentwicklung muss ihren Mehrwert und laufenden Aufwand im Pilot erst belegen. |

### 7.5 Wachstum, Kosten und Neubewertung

Die gemeinsame Anwendung ist ein **bewusster Startpunkt**, keine Zusage
unbegrenzter Skalierung. Vor dem Verkauf müssen realistische Datenmengen,
gleichzeitige Buchungen, grosse Monatsrapporte und E-Mail-Rückstände
gemessen werden. Aktuell lädt die Oberfläche mehrere vollständige
Datenbestände pro Firma beziehungsweise zugänglicher Person; das kann bei
langer Historie oder grossen Teams teuer und langsam werden.

Der sinnvolle Ausbau erfolgt anhand messbarer Engpässe:

| Anlass | Gezielte Weiterentwicklung |
| --- | --- |
| Lange Ladezeiten und grosse Historie | Zeitlich begrenzte Datenabfragen, serverseitige Aggregation und geeignete Indizes; nicht sofort Microservices einführen. |
| Export- oder Versandaufträge überschreiten Host-Laufzeiten | Dedizierter Hintergrund-Worker beziehungsweise geeignete Job-Ausführung, sichtbarer Fortschritt und ausreichende Kapazität. |
| Viele gleichzeitig aktive Firmen | Lasttests, Verbindungsmanagement, Ressourcenplanung und Monitoring der Datenbank-/API-Limits. |
| Höhere vertragliche Isolation oder bestimmte Datenstandorte | Getrennte Datenbanken/Instanzen oder anderes Hosting bewerten; Kosten und Migration vor Vertragszusage klären. |
| Anbieterwechsel oder Eigenbetrieb | PostgreSQL-Datenmigration plus Ersatz für Supabase Auth, SDKs und APIs planen und testen. |

Die laufenden Kosten entstehen aus Anwendungshosting, Datenbank/Auth,
Speicher-/Backupbedarf, SMTP, Zahlungsgebühren sowie Support, Wartung und
Betrieb. Verwaltete Dienste reduzieren eigenen Betriebsaufwand, beseitigen
ihn aber nicht. Ohne Nutzungsannahmen, Tarifprüfung und Betriebsmessung
wird kein belastbarer Preis- oder Kostenvorteil behauptet.

**Entscheidung für die nächste Etappe:** Architektur im Pilot beibehalten,
fachliche Abläufe und reale Integrationen abnehmen, Hosting und
Betriebsverantwortung festlegen und anhand des Nutzungsverhaltens
Kosten-/Lastgrenzen bestimmen. Erst bei konkretem Bedarf weitere
Infrastruktur oder getrennte Dienste einführen.

### 7.6 Betriebsrahmen und bestehende Abhängigkeiten

**Mandantentrennung:** Eine Firma bildet einen Mandanten. Geschäftsobjekte
werden einer Firma zugeordnet. PostgreSQL Row Level Security prüft
Firmenmitgliedschaft, Rolle und bestätigte 2FA. Besonders relevante
Schreiboperationen laufen über geprüfte Datenbankfunktionen.

**Datenhaltung:** Supabase stellt verwaltetes PostgreSQL und Authentifizierung
bereit. PostgreSQL erleichtert grundsätzlich den Datenexport; die aktuelle
Anwendung verwendet jedoch Supabase-spezifische Authentifizierung und APIs.
Ein Anbieterwechsel ist deshalb ein eigenes Migrationsvorhaben, kein einfacher
Austausch einer Verbindungsadresse.

**Authentifizierung:** Für das öffentlich erreichbare SaaS sind Login und
Authenticator-2FA verpflichtend. Eine öffentlich zugängliche Version ohne
Login ist nicht Teil dieses Konzepts. Lokale Demonstrationen ohne echte
Personaldaten wären separat möglich.

**Hosting:** Noch festzulegen. Anwendung, Datenbank und Dienstleister sind
bezüglich Standort, Verträgen, Kosten und Betriebsanforderungen gemeinsam
zu bewerten. Eine EU-Region ist nicht gleichbedeutend mit Schweizer
Datenhaltung oder automatisch erfülltem Datenschutz.

**Entwicklung:** Feature-Branches, Conventional Commits und Pull Requests.
Automatisierte Fachlogik-, Datenbank- und Browserprüfungen unterstützen die
Qualitätssicherung. Test-/Pilot- und Produktionsumgebungen sind vor dem
Livebetrieb zu trennen.

## 8. SaaS- und Geschäftsmodell

Das vorgesehene Modell ist ein monatlicher Festpreis pro Firma, nicht eine
Abrechnung pro Buchung oder Projekt. Betrag, Währung, Steuern, Vertragslaufzeit
und Leistungsgrenzen sind noch nicht beschlossen.

| Element | Vorgesehenes Verhalten |
| --- | --- |
| Bezahlte Firma | Firmen-Admin schliesst das Abo über Stripe ab und verwaltet es im Kundenportal. |
| Kostenfreie Firma | Ausschliesslich der Betreiber erteilt eine manuelle Freischaltung, beispielsweise für Pilotkunden oder eigene Nutzung. |
| Abozustand | Signierte Stripe-Ereignisse synchronisieren den Status mit der Anwendung. |
| Kündigung / Zahlungsproblem | Vertrags- und Zugangsregeln müssen vor Verkauf definiert werden; im Pilot wird die Zeiterfassung noch nicht gesperrt. |

Eine kostenfreie Freischaltung beendet ein bestehendes Stripe-Abo nicht
automatisch. Kündigung und Kundeninformation sind in diesem Fall separat
erforderlich.

**Preisempfehlung als Vorgehen, nicht als Betrag:** Zuerst Nutzungsverhalten,
Supportaufwand und Zahlungsbereitschaft ermitteln. Danach ein transparentes
Firmenpaket mit ausdrücklich festgelegten Mitarbeitenden-/Nutzungsgrenzen
kalkulieren. Ein Festpreis darf nicht unbeabsichtigt eine unbegrenzte
Leistungszusage bedeuten. Eine spätere Staffelung nach Firmengrösse ist eine
offene Produktentscheidung und noch nicht implementiert.

## 9. Datenschutz, Sicherheit und Betrieb

Arbeits- und Abwesenheitsdaten sind personenbezogen. Angaben zu Krankheit
benötigen besonderen Schutz. Die Anwendung soll keine medizinischen
Diagnosen erfassen; rechtliche Einordnung und notwendige Schutzmassnahmen
sind vor dem Produktivbetrieb fachlich zu prüfen.

Vor einer produktiven Freigabe sind mindestens folgende Punkte erforderlich:

| Bereich | Erforderliche Festlegung / Massnahme |
| --- | --- |
| Datenschutz | Verantwortlichkeiten, Datenzwecke, Rechtsgrundlagen, Datenminimierung sowie Schweizer DSG und gegebenenfalls DSGVO prüfen. |
| Vertragsgrundlagen | Kundenvertrag, Datenschutzhinweise, Auftragsbearbeitungsvereinbarungen und eingesetzte Dienstleister prüfen. |
| Zugriff | Berechtigungen nach Aufgaben, geschützte Infrastrukturzugänge, geregelte Ein-/Austritte und überprüfbare Supportzugriffe. |
| Wiederherstellung | Verbindlicher Prozess bei verlorenem Passwort/Authenticator mit Identitätsprüfung und Nachweisführung. |
| Aufbewahrung | Fristen für Zeitdaten, Abwesenheiten und Protokolle; Export, Löschung und Verhalten bei Vertragsende. |
| Ausfallsicherheit | Backup- und Wiederherstellungsverfahren mit praktisch geprüftem Restore; Wiederanlaufziele festlegen. |
| Betrieb | Monitoring, Alarmierung, Fehlerbehandlung, Updates und benannte Zuständigkeiten. |
| Sicherheit | HTTPS, Secret-Verwaltung, Rate Limits, unabhängige Sicherheitsprüfung und dokumentierte Reaktion auf Vorfälle. |

Die Pilotversion ist weder eine Datenschutz-Zertifizierung noch ein Nachweis
vollständiger gesetzlicher Konformität.

## 10. Aktueller Stand und offene Lücken

| Bereich | Projektstand |
| --- | --- |
| Firmen, Rollen und Projektzuweisungen | Im Pilotcode implementiert. |
| Ein-/Auschecken, Sollzeit, Pausenprüfung | Im Pilotcode implementiert. |
| Nachträge, Korrekturfristen und Änderungsprotokoll | Im Pilotcode implementiert. |
| Abwesenheiten mit optionaler Freigabe | Im Pilotcode implementiert; Rückzug und Umdatierung noch nicht vollständig umgesetzt. |
| PDF-/CSV-Auszüge | Implementiert; PDF-Zeichensatz aktuell für lateinische Texte ausgelegt. |
| Geführte Oberfläche | Implementiert, einschliesslich Desktop-/Mobilansicht und Rollen-Navigation. |
| Ersteinrichtungsassistent | Im Pilotcode implementiert: rollenabhängige Schritte, gespeicherter Fortschritt und offene Voraussetzungen. |
| Hinweise bei fehlender Zeiterfassung | Im Pilotcode implementiert: Prüfung, Zuständigkeiten, Erinnerungen, Klärung und SMTP-Warteschlange. Scheduler/SMTP-Einrichtung und reale Zustellabnahme noch erforderlich. |
| Authenticator-Login und Einladungen | Implementiert; Einrichtung und reale Betriebsabläufe müssen in der Pilotumgebung abgenommen werden. |
| Stripe-Abos und kostenfreie Freischaltung | Integration implementiert; Zahlungsabläufe noch in Stripe-Testumgebung abzunehmen. |
| Austritte, Ferienüberträge und Feiertage | Noch nicht implementiert. |
| Grosses Datenvolumen | Weitere Optimierung notwendig: Auswertungen laden derzeit paginiert die zugängliche Historie. |
| Produktionsbetrieb und Verkaufsfreigabe | Offen: Hosting, Verträge, Betriebsprozesse und Abo-Zugangspolitik. |

Automatisierte Prüfungen des aktuellen Entwicklungsstands umfassen
Fachlogik-/Datenbanktests und isolierte Browsertests sowie Typecheck,
Lint und Produktionsbuild. Diese Prüfungen ersetzen keine Abnahme mit real
konfigurierten Cloud-Diensten und keinen Praxistest im Unternehmen.

## 11. Umsetzung und Meilensteine

Die Planung erfolgt in Etappen mit überprüfbaren Freigabekriterien.
Verbindliche Termine und Aufwände werden nach Klärung der offenen
Produkt- und Betriebsentscheidungen geschätzt.

| Etappe | Ergebnis | Freigabekriterium |
| --- | --- | --- |
| 1 · Pilot vorbereiten | Separate Testumgebung, Datenbank, Authenticator, E-Mail-Versand und Testfirma eingerichtet. | Einladung, Login, Rollen, Buchungen, Korrekturen und Exporte mit Testdaten Ende zu Ende bestätigt. |
| 2 · Kontrolliert erproben | Eine kleine Firma nutzt die Kernabläufe; Feedback und Abweichungen werden erfasst. | Mindestens ein vollständiger Monatszyklus mit nachvollziehbarem Rapport; keine ungeklärten Datenverluste oder Mandantenzugriffe. Vor Nutzung echter Daten notwendige Datenschutz-/Betriebsvoraussetzungen erfüllen. |
| 3 · Marktfähig machen | Relevante fachliche Lücken, Austritts-/Supportprozesse, Backups, Monitoring und Vertragsunterlagen umgesetzt. | Fachliche Abnahme, Sicherheitsprüfung und Wiederherstellung erfolgreich; Verantwortlichkeiten benannt. |
| 4 · Bezahlten Start freigeben | Preis, Grenzen, Stripe-Abläufe und Zahlungs-/Kündigungsregeln festgelegt. | Testzahlungen, Kündigung, Zahlungsausfall und Export bei Vertragsende nachvollziehbar geprüft. |
| 5 · Gezielt skalieren | Weitere Firmen, Performanceoptimierungen und priorisierte Erweiterungen. | Last- und Betriebsmessungen stützen die gewählten Leistungsgrenzen und Kosten. |

Erweiterungen erfolgen anhand von Pilotfeedback, nicht durch pauschalen
Funktionsausbau vor dem Nachweis des Kundennutzens.

## 12. Wirtschaftlichkeit und Erfolgsmessung

Es liegen noch keine freigegebene Budgetplanung, Anbieterangebote oder
validierten Umsatzprognosen vor. Das Konzept verspricht deshalb weder einen
bestimmten Gewinn noch fixe Infrastrukturkosten.

| Kostenblock | Zu berücksichtigen |
| --- | --- |
| Einmalig | Fertigstellung, Pilotbetreuung, UX-Verbesserungen, Sicherheits-/Datenschutzprüfung, Vertragsunterlagen und Inbetriebnahme. |
| Laufend | Hosting, Datenbank/Auth, E-Mail, Zahlungsgebühren, Backups, Monitoring, Support und Wartung. |
| Wachstumsabhängig | Datenvolumen, aktive Firmen, Supportfälle, Leistungsanforderungen und zusätzlicher Betriebsaufwand. |

Vereinfachte Kalkulation:

**Monatlicher Deckungsbeitrag = bezahlte Firmen × Netto-Firmenpreis
− laufende Betriebskosten − Zahlungsgebühren − Support-/Wartungsaufwand.**

Kostenfreie Firmen verursachen ebenfalls Aufwand und sind separat zu
berücksichtigen. Entwicklungsinvestitionen, Steuern und weitere
Unternehmenskosten sind zusätzlich zu bewerten.

Der Pilot soll folgende Kennzahlen liefern; Zielwerte werden vor Start vereinbart:

| Kennzahl | Messung |
| --- | --- |
| Einrichtungsaufwand | Zeit bis zum ersten erfolgreichen Projekt-Check-in. |
| Akzeptanz | Anteil der vorgesehenen Arbeitstage mit vollständiger Erfassung. |
| Rapportqualität | Abweichungen zwischen Rapport und fachlicher Gegenprüfung. |
| Verwaltungsaufwand | Zeit für Monatsabschluss gegenüber dem bisherigen Verfahren. |
| Supportbedarf | Anfragen je Firma und Aufwand je Anfrage. |
| Zahlungsbereitschaft | Rückmeldungen zu Nutzen, Preis und notwendigen Funktionen. |

## 13. Wesentliche Risiken

| Risiko | Gegenmassnahme |
| --- | --- |
| Umfang wächst vor dem ersten Kundennutzen | Pilotumfang begrenzen; Erweiterungen nach Nutzen und Risiko priorisieren. |
| Falsche oder missverständliche Zeit-/Saldoauswertung | Fachliche Gegenprüfung mit realistischen Arbeitsmodellen, Monatswechseln und Abwesenheiten. |
| Unberechtigter Zugriff auf Personaldaten | Datenbankregeln, Rollenprüfungen, unabhängige Prüfung und eingeschränkte Infrastrukturzugänge. |
| Zahlungs- oder Dienstleisterausfall | Keine Arbeitszeit löschen; Wiederholungs-/Supportprozesse und Export-/Zugangsregeln festlegen. |
| Zu hoher Aufwand bei Firmen-Festpreis | Klare Paketgrenzen sowie Messung von Nutzung und Supportkosten. |
| Anbieterabhängigkeit | Datenexport und Backups vorsehen; Migrationsaufwand für Auth/API ausdrücklich berücksichtigen. |
| Unklare rechtliche oder betriebliche Verantwortung | Verantwortliche benennen und erforderliche Prüfung vor Produktivfreigabe abschliessen. |

## 14. Entscheidungsvorlage

Zur Freigabe vorgeschlagen wird **ein begrenzter Pilot**, noch kein öffentlicher
SaaS-Verkaufsstart. Dafür sind folgende Entscheidungen erforderlich:

| Entscheidung | Empfohlene Richtung |
| --- | --- |
| Pilotumfang | Eine Firma mit wenigen Personen und den bestehenden Kernabläufen. |
| Verantwortung | Produktverantwortung, technische Betriebsverantwortung und fachliche Abnahme eindeutig zuweisen. |
| Budget und Kapazität | Zeitbudget für Einrichtung, Pilotbegleitung und Behebung priorisierter Lücken festlegen. |
| Hosting und Datenstandort | Anbieter, Region und Vertragsgrundlagen vor echten Personaldaten auswählen. |
| Fachliche Priorität | Feiertage, Ferienkonten, Austritte und Abwesenheitskorrekturen mit der Pilotfirma bewerten. |
| Fehlende Zeiterfassung | Prüfzeitpunkt, auslösende Fälle, Zuständigkeiten, Kanäle und Ausnahmen vor Umsetzung festlegen. |
| Ersteinrichtung | Rollenabhängigen Assistenten im Pilot einsetzen und anhand von Nutzerfeedback weiter verbessern. |
| Erlösmodell | Firmen-Festpreis grundsätzlich bestätigen; Betrag, Leistungsgrenzen und Vertragsbedingungen nach Pilotdaten festlegen. |
| Verkaufsfreigabe | Erst nach fachlicher, rechtlicher, technischer und betrieblicher Abnahme. |

**Erwartetes Ergebnis des Pilots:** Eine belegbare Entscheidung, ob TimeReport
den Erfassungs- und Verwaltungsaufwand reduziert und mit vertretbaren Kosten
als SaaS weiterentwickelt werden soll.
