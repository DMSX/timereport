# TimeReport – Produkt- und Umsetzungskonzept

**Projekt:** Projektbezogene Zeiterfassung als SaaS  
**Stand:** 12. Oktober 2026 · Version 1.0  
**Zweck:** Entscheidungsgrundlage für Pilotierung und anschliessende Produktentwicklung  
**Status:** Technische Pilotversion vorhanden; öffentlicher Verkaufsbetrieb noch nicht freigegeben

## 1. Management Summary

TimeReport soll kleinen Unternehmen und Teams eine einfach bedienbare,
projektbezogene Zeiterfassung bieten. Mitarbeitende starten und beenden ihre
Arbeitszeit per Knopfdruck. Die Anwendung ordnet Arbeitsblöcke Projekten zu,
vergleicht sie mit dem individuellen Soll und erstellt Monatsrapporte.
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

Die Wochen-Sollzeit wird pro Person über die Verteilung auf sieben Wochentage
festgelegt. Die Oberfläche verwendet Stunden; die Datenbank speichert Minuten.
Arbeitsmodelle haben ein Gültigkeitsdatum, sodass Änderungen historisch
zugeordnet werden können. Optionale geplante Anfangs- und Endzeiten dienen
der Information und starten keine automatische Zeiterfassung.

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

Ferien werden gegen ein Jahresguthaben in Tagen ausgewertet.
Ganze Tage, halbe Tage und Datumsbereiche sind möglich.
Krankheit wird getrennt erfasst und besitzt kein begrenztes Guthaben.

Die Firma entscheidet, ob Abwesenheiten genehmigt werden müssen.
Ohne Genehmigungspflicht werden neue Einträge direkt genehmigt.
Nur genehmigte Abwesenheiten werden in der Soll-/Ist-Auswertung gutgeschrieben;
offene Ferienanträge reservieren bereits Guthaben.

Für den marktfähigen Ausbau sind insbesondere jahresspezifische Ferienkonten,
Überträge, Ein-/Austritte, Teilzeitberechnung und kantonale Feiertage zu klären.

### 5.6 Monatsrapporte

Der Monatsrapport enthält Tageswerte für Arbeit, Soll, Ferien, Krankheit und
Saldo sowie die zugehörigen Projektbuchungen. Exportformate sind PDF und CSV
für die Weiterverarbeitung in Excel.

Monatsgrenzen und Zeitumstellungen werden in der Zeitzone Zürich berücksichtigt.
Laufende Buchungen bleiben vorläufig; der Monats-Saldo berücksichtigt
gegenwärtig auch das Soll zukünftiger Tage im gewählten Monat.
Der Export ist kein Lohnabrechnungs- oder Rechnungsbeleg.

## 6. Benutzerführung

| Schritt | Ablauf |
| --- | --- |
| Firmenaufnahme | Der Betreiber legt eine Firma an und bestimmt ihren Admin. |
| Sicherer Einstieg | Benutzer bestätigen ihre Einladung, richten Authenticator-2FA ein und setzen ein Passwort. |
| Einrichtung | Die Oberfläche führt durch Arbeitsmodelle, erstes Projekt und Teamzuweisung. |
| Tägliche Nutzung | „Mein Arbeitstag“ zeigt die laufende Uhr, Tageszeit, Soll und Fortschritt. Projekt wählen, einchecken, für Pause oder Feierabend auschecken. |
| Prüfung | Buchungen und Abwesenheiten werden in eigenen Bereichen geprüft. Änderungen erfolgen in fokussierten Dialogen. |
| Monatsende | HR/Admin beziehungsweise Mitarbeitende erstellen den zulässigen PDF-/CSV-Auszug. |

Die Navigation trennt den persönlichen Arbeitsplatz von Firmenverwaltung und
Betreiberbereich. Team und Projekte sind durchsuchbar; Bearbeitungsdetails
werden erst bei Bedarf geöffnet. Die Nutzer sehen nur Bereiche, die zu ihrer
Rolle gehören. Zugriffsregeln werden zusätzlich in der Datenbank durchgesetzt,
nicht nur über ausgeblendete Schaltflächen.

## 7. Technisches Konzept

```text
Browser: Desktop / Smartphone
              |
              v
Next.js / TypeScript
Oberfläche, serverseitige Schnittstellen, PDF-/CSV-Auszüge
              |
              +--> Supabase Auth: E-Mail/Passwort und TOTP-2FA
              |
              +--> PostgreSQL: Firmen, Rollen, Projekte, Buchungen,
              |                Arbeitsmodelle, Abwesenheiten, Änderungsprotokoll
              |
              +--> Stripe: Checkout, Kundenportal, Abo-Ereignisse
              |
              +--> SMTP-Dienst: Einladungen und Wiederherstellung
```

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
| Authenticator-Login und Einladungen | Implementiert; Einrichtung und reale Betriebsabläufe müssen in der Pilotumgebung abgenommen werden. |
| Stripe-Abos und kostenfreie Freischaltung | Integration implementiert; Zahlungsabläufe noch in Stripe-Testumgebung abzunehmen. |
| Austritte, Ferienüberträge und Feiertage | Noch nicht implementiert. |
| Grosses Datenvolumen | Weitere Optimierung notwendig: Auswertungen laden derzeit paginiert die zugängliche Historie. |
| Produktionsbetrieb und Verkaufsfreigabe | Offen: Hosting, Verträge, Betriebsprozesse und Abo-Zugangspolitik. |

Automatisierte Prüfungen des aktuellen Entwicklungsstands umfassen
39 Fachlogik-/Datenbanktests und sechs isolierte Browsertests sowie Typecheck,
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
| Erlösmodell | Firmen-Festpreis grundsätzlich bestätigen; Betrag, Leistungsgrenzen und Vertragsbedingungen nach Pilotdaten festlegen. |
| Verkaufsfreigabe | Erst nach fachlicher, rechtlicher, technischer und betrieblicher Abnahme. |

**Erwartetes Ergebnis des Pilots:** Eine belegbare Entscheidung, ob TimeReport
den Erfassungs- und Verwaltungsaufwand reduziert und mit vertretbaren Kosten
als SaaS weiterentwickelt werden soll.
