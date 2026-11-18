# Projekt „Thors Bibliothek“

## Ziel
Eine persönliche Bücher-App als **Ersatz für BookBuddy**, die gedruckte Bücher, Kindle-E-Books
und (geplant) PDF-Bücher in einer Bibliothek zusammenführt – auf iPad, iPhone und Desktop.
Sie soll **dauerhaft ohne Claude** funktionieren: Claude hilft beim Aufbau und bei Auswertungen,
ist aber für den Betrieb nicht nötig.

## Ausgangslage (Stand 16.–18.11.2026)
- BookBuddy-Export: 1.473 Bücher (CSV), Genres gemischt deutsch/englisch, ~1.000 Bücher ohne Tags.
- Kindle-Datenexport von Amazon: 632 aktive E-Books, 115 als beendet erfasst, Markierungen nur
  als Anzahl (ohne Text), 25 Notizen mit Text.
- Ergebnis der Übernahme: **1.806 Bücher** (inkl. 333 nur auf Kindle), 608 davon auf Kindle.

## Architektur
| Baustein | Umsetzung | Warum |
|---|---|---|
| App | Progressive Web App (HTML/CSS/JS, kein Build), GitHub Pages | läuft überall, installierbar, offline |
| Daten | IndexedDB auf jedem Gerät | keine Abhängigkeit von Server oder Konto |
| Sicherung/Abgleich | JSON-Datei in iCloud Drive, „Sicherung zusammenführen“ (neuerer Stand pro Buch gewinnt) | Thors Wahl: einfach, ohne weiteren Dienst |
| Offline | Service Worker; App-Dateien „erst Netz, sonst Cache“, Cover „erst Cache“ | Updates sofort, trotzdem offline nutzbar |
| Erfassen | Barcode-Scan (ZXing), ISBN bei Google Books/Open Library | ohne Claude |
| Kindle | Abgleich mit Amazons Datenexport (ZIP) direkt in der App (JSZip) | keine Amazon-Schnittstelle vorhanden |
| Claude | Ergänzungsdateien (Kategorien, Themen, Cover …), Auswertungen | optional |

## Wichtige Entscheidungen
- **App statt Artefakt als Kern** (18.11.): Der erste Katalog lag als Artefakt bei Claude. Weil
  die Bibliothek auch ohne Claude weiterleben soll, ist die eigenständige App jetzt führend.
  Der Artefakt-Katalog „Thors Bibliothek“ bei Claude ist nur noch ein Archivstand vom 18.11.
- **Abgleich über iCloud-Datei statt Datenbank-Dienst** (Supabase o. Ä. verworfen): genügt für
  einen Nutzer, keine Zusatzkosten, keine weitere Abhängigkeit.
- **Repository öffentlich, Daten privat**: nötig für kostenloses GitHub Pages; Bücherdaten nie im Repo.
- **Kategorien**: 15 deutsche Kategorien (Belletristik, Philosophie, Psychologie, Gesellschaft,
  Politik & Recht, Geschichte, Religion & Spiritualität, Medizin & Gesundheit, Naturwissenschaft,
  Wirtschaft, Musik & Kunst, Bildung & Ratgeber, Biografie, Literaturwissenschaft,
  Technik & Informatik) plus „Ohne Kategorie“.
- **Drei Arten von Schlagworten**: `tg` = Thors eigene Tags, `ts` = regelbasierte Vorschläge
  (aus Autor, Kategorie, Stichwörtern), `tt` = inhaltliche Themen für Belletristik (von Claude
  einzeln vergeben, z. B. Identität, Liebe, Tod, Macht, Diktatur, Realität, Sinnsuche, Phantastik).
- **Kindle-Links**: Die iOS-Kindle-App ignoriert die Buchkennung in `kindle://`-Links. Daher öffnet
  der Hauptknopf den Kindle Cloud Reader (`lesen.amazon.de/?asin=…`); der App-Knopf kopiert den Titel.
- **App-Symbol**: eigene Zeichnung nach einem Bibliotheksfoto (Bogenflucht), Quelle `icons/icon.svg`.

## Bekannte Grenzen
- Markierungstexte sind im Amazon-Export nicht enthalten (Abhilfe: My Clippings.txt, Kindle-Notizbuch).
- Google Books liefert für manche Bücher ein graues „kein Bild“-Cover.
- Kamera-Scan und ISBN-Abfrage brauchen HTTPS bzw. Internet.
- Auf iOS gehören die Daten zur installierten Home-Bildschirm-App; Entfernen löscht sie.

## Weitere Bausteine
- GitHub: https://github.com/ThorstenKra/thors-bibliothek
- App: https://thorstenkra.github.io/thors-bibliothek/
- Claude-Skill „bookbuddy-katalog-aktualisieren“: für den alten Artefakt-Katalog; muss an die App
  angepasst werden (siehe ROADMAP).
- Erinnerungen in Thors Erinnerungen-App: siehe ROADMAP.
