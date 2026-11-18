# Arbeitsanweisungen für Claude – Thors Bibliothek

Lies vor jeder Arbeit `docs/ROADMAP.md` (offene Aufgaben) und bei Bedarf `docs/PROJEKT.md`
(Architektur, Entscheidungen). Antworte Thor auf Deutsch.

## Grundsätze
- **Die App ist der Kern, Claude ist Erweiterung.** Alles Wesentliche muss ohne Claude und ohne
  Server funktionieren (offline, Daten lokal in IndexedDB, Sicherung als JSON in iCloud Drive).
- **Keine Bücherdaten ins Repository.** Das Repository ist öffentlich. Sicherungen, Start- und
  Ergänzungsdateien, Kindle-Exporte und `korrekturen.json` gehören nie hierher (`.gitignore`).
- **Eigene Änderungen des Nutzers haben Vorrang.** Importe und Ergänzungen dürfen nichts
  überschreiben, was Thor in der App selbst gesetzt hat (siehe Regeln in `docs/DATENPFLEGE.md`).
- **Keine Build-Schritte.** Reines HTML/CSS/JS, Bibliotheken liegen in `vendor/`.

## Bei jeder Änderung an der App
1. `APP_VERSION` in `js/app.js` und `CACHE` in `sw.js` gemeinsam hochzählen (sonst bekommen
   installierte Apps das Update nicht). Neue Dateien in die `FILES`-Liste von `sw.js` aufnehmen.
2. Testen (siehe unten), dann `docs/CHANGELOG.md` und `docs/ROADMAP.md` aktualisieren,
   bei Formatänderungen auch die Feldtabelle im `README.md`.
3. Auf `main` pushen – GitHub Pages veröffentlicht automatisch unter
   https://thorstenkra.github.io/thors-bibliothek/ (Status: `gh api repos/ThorstenKra/thors-bibliothek/actions/runs`).
4. Thor sagen, wie er aktualisiert: in der App **Daten → „Nach Update suchen“**.
5. Wurden Symbol-Dateien geändert: unter **neuem Dateinamen** ablegen (Safari hält Symbole fest),
   und daran erinnern, dass iOS beim Entfernen der Home-Bildschirm-App deren Daten löscht
   (vorher Sicherung erstellen).

## Testen
- Lokal: `python3 -m http.server` im Repo-Ordner, Browser-Tests mit `puppeteer-core` gegen das
  installierte Chrome (`/usr/bin/google-chrome`, `--no-sandbox`).
- Testdaten: eine aktuelle Sicherung von Thor (über den Willkommensbildschirm „Sicherungsdatei laden“).
- Nach `page.evaluate`-Eingriffen in IndexedDB `load()` aufrufen, sonst arbeitet die Oberfläche mit
  veraltetem Stand.
- Kamera, ISBN-Abfrage und externe Cover sind in der Sandbox nicht erreichbar – das auf Thors
  Gerät prüfen lassen und es so sagen.

## Daten für Thor aufbereiten (Ergänzungsdateien)
- Immer von seiner **aktuellen Sicherung** ausgehen (Datei hochladen lassen), nicht von alten Ständen.
- Ergebnis als Ergänzungsdatei: `{"format":"thors-bibliothek","version":1,"typ":"ergaenzung",
  "beschreibung":"…","felder":{ "<id>": { "<feld>": <wert> } }}` – füllt nur leere Felder
  (auch leere Listen und Kategorie „Ohne Kategorie“). Für Änderungen an bereits gefüllten Feldern den Abschnitt
  `aendern` nutzen (`{ id: { feld: { "von": alt, "nach": neu } } }`, greift nur bei unverändertem Wert).
- Kategorien: die 16 Kategorien aus `js/app.js` (`PALETTE`); Genres: `GENRES` in `js/app.js`; Themen-Vokabular siehe `docs/PROJEKT.md`.
- Werkzeuge der Erstübernahme liegen in `tools/` (Python, nur noch für Sonderfälle).

## Commits
Deutsch, kurze Zusammenfassung plus Begründung. Am Ende:

    Co-Authored-By: Claude <noreply@anthropic.com>
