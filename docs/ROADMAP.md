# Roadmap und offene Aufgaben

Stand: 18.11.2026. Bei jeder Arbeit aktualisieren.

## Geplant mit Termin (Erinnerungen in Thors Erinnerungen-App)
| Termin | Aufgabe | Nächster Schritt |
|---|---|---|
| 28.11.2026, 9:30 | Kindle-Markierungen über das Kindle-Notizbuch auslesen | Thor: am Computer Chrome mit „Claude in Chrome“, bei lesen.amazon.de/notebook anmelden, Bescheid geben |
| 28.11.2026, 10:00 | PDF-Bücher aus iCloud Drive einbinden | Thor: Desktop-App mit freigegebenem iCloud-Ordner **oder** Ordner als ZIP hochladen |
| 28.11.2026, 10:30 | My Clippings.txt vom Kindle-Reader | Thor: Datei per USB kopieren und hochladen; Claude baut damit den Import |
| alle 3 Monate, ab 18.02.2027 | Kindle-Daten bei Amazon anfordern und in der App abgleichen | Thor (in der App, ohne Claude); neue Kindle-Bücher ggf. von Claude einordnen lassen |

## Als Nächstes umzusetzen
- [ ] **Themen für Sachbücher**: rund 500 Sachbücher haben kein Thema außer der Kategorie (in der
      Übersicht „ohne Thema“, z. B. 117 in Philosophie). Per Ergänzung `tt` vergeben wie bei Belletristik.
- [ ] **Vokabeln aus dem Kindle** (28.11.): `vocab.db` des Vokabelbausteins mitkopieren; Ansicht
      „Vokabeln aus diesem Buch“ und Export als Lernpaket für den Vokabeltrainer.
- [ ] **Kernideen** je Buch (Feld, Claude-Ergänzung), zuerst gelesene Bücher, mit Kindle-Markierungen.
- [ ] **Zitatsammlung**: Import von My Clippings.txt direkt in der App (offline), Markierungen
      je Buch mit Position/Datum, durchsuchbar; zusätzlich Kindle-Notizbuch als Quelle.
- [ ] **PDF-Bücher**: neues Format „PDF“ mit Speicherort, Filter; Dubletten als „auch als PDF“.
- [ ] **Neue Kindle-Bücher einordnen**: Bücher unter „Ohne Kategorie“ (z. B. aus dem
      Kindle-Abgleich) per Ergänzung mit Kategorie und Themen versehen.
- [ ] Prüfen, ob Thor den Kindle-Abgleich mit dem vorhandenen Export schon gemacht hat
      (dann sind die 7 fehlenden Bände da).

- [ ] Rückmeldung zum Prüfbericht abwarten (Spalte „Einwand“); ggf. Bereinigungsdatei neu erzeugen.
- [ ] Winnetou (3 Kindle-Einträge): Bandnummern ergänzen.
- [ ] Feld `al` (Sortiername) bei geänderten Autorennamen mitpflegen (bisher alter Stand).

## Ideen (noch nicht entschieden)
- Leseempfehlungen und „Fragen an die Bibliothek“ (Claude-Erweiterung, z. B. aus einer Sicherung)
- Lesepfade durch den eigenen Bestand
- Leseprotokoll (Seitenfortschritt, Sitzungen), Leseziele, Jahresrückblick, Statistiken
- Export als BibTeX/Zotero; Schnittstelle zum Literatur-Agenten
- Graue „kein Bild“-Cover von Google Books erkennen und ausblenden
- Installation auf iPhone und Desktop (Abgleich über iCloud-Sicherungen)
- Mehr Barrierefreiheit (VoiceOver-Prüfung, Vorlesen)

## Aufräumen
- [ ] Claude-Skill „bookbuddy-katalog-aktualisieren“ an die App anpassen (BookBuddy wird nicht
      mehr gepflegt; künftig: Sicherung hochladen → Ergänzungsdatei erzeugen).
- [ ] Artefakt-Katalog bei Claude als Archiv kennzeichnen oder löschen.

## Erledigt
- [x] 20.11.: Internet nur auf Anweisung (1.8.0)
- [x] 18.11.: Autorenansicht mit weiteren Werken aus Open Library (1.7.0) – Live-Abfrage auf dem iPad prüfen lassen
- [x] 18.11.: Barcode-Scan repariert, Ersatzweg „Foto vom Barcode“ (1.6.1) – auf dem iPad noch bestätigen lassen
- [x] 18.11.: Genre als eigenes Feld, Landkarte mit drei Ansichten (1.6.0)
- [x] 18.11.: Suche am Wortanfang, Autorfilter, Feld Übersetzer/Hrsg., Datenprüfung, Bereinigung (1.5.0)
- [x] 18.11.: Landkarte ohne doppelte Punkte für Tags mit Kategorienamen (1.4.1)
- [x] 18.11.: Kategorie Science-Fiction (1.4.0), 160 Bücher per Ergänzung verschoben
- [x] 18.11.: App 1.0.0–1.3.2 (siehe CHANGELOG), Cover, Kindle-Links, Kindle-Abgleich, eigenes Symbol
- [x] 16.–18.11.: Übernahme aus BookBuddy und Kindle, Kategorien, Tags, Themen
