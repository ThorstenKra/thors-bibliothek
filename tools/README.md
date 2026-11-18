# Werkzeuge der Erstübernahme (Python)

Mit diesen Skripten wurden im November 2026 der BookBuddy-Export und der Kindle-Export
aufbereitet (Kategorien, Tags, Themen, Startdatei und Ergänzungsdateien für die App).
Seit Version 1.3.0 erledigt die App den Kindle-Abgleich selbst; die Skripte sind nur noch für
Sonderfälle gedacht.

- `kindle_import.py ORDNER kindle.json` – entpackten Amazon-Kindle-Export in `kindle.json` umwandeln
- `bibliothek.py EXPORT.csv korrekturen.json template.html ausgabe.html [--kindle kindle.json]
  [--app-json start.json] [--app-ergaenzung ergaenzung.json]`

Die zugehörigen Datendateien (`korrekturen.json`, `kindle.json`, Exporte) enthalten persönliche
Bibliotheksdaten und liegen **nicht** in diesem Repository.
