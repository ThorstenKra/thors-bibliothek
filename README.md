# Thors Bibliothek

Persönliche Bücher-App als Ersatz für BookBuddy – läuft im Browser auf iPad, iPhone und Desktop,
funktioniert **offline** und **ohne Server oder KI-Dienst**. Die Daten liegen ausschließlich auf dem
eigenen Gerät (IndexedDB) und in Sicherungsdateien, die du selbst in iCloud Drive ablegst.
**In diesem Repository liegen keine Bücherdaten**, nur der Programmcode.

App: https://thorstenkra.github.io/thors-bibliothek/

## Funktionen (Stufe 1)
- Katalog mit Suche (Titel, Autor, Tags, Klappentext, Notizen), Filtern (Kategorie, Status, Sprache,
  Format, verliehen) und Sortierungen; Kachel- und Listenansicht
- Bücher hinzufügen: Barcode-Scan mit der Kamera, ISBN nachschlagen (Google Books, Open Library),
  Dublettenprüfung, Erfassen von Hand
- Bearbeiten aller Felder, Schnell-Status, Löschen; Standort im Regal, Verleihen (an wen, seit wann),
  Wunschliste, Format (gedruckt / Kindle / beides)
- Cover: aus BookBuddy-Bildern, Google Books, Open Library und Amazon (Kindle); werden beim ersten
  Anzeigen geladen und auf dem Gerät zwischengespeichert; eigenes Cover per Foto möglich
- Kindle-Bücher öffnen: direkt im Kindle Cloud Reader (Browser); die Kindle-App für iOS ignoriert die
  Buchkennung in Links, daher kopiert die App den Titel für die Suche in der Kindle-App
- Themenlandkarte (Kategorien, Themen, Autoren), wird aus den aktuellen Daten berechnet
- Historie: Änderungsprotokoll und jede einzelne Änderung an Büchern
- Sicherung als JSON (vollständig) und CSV (für Numbers/Excel), Zusammenführen von Sicherungen

## Installation auf iPad / iPhone
1. Die App-Adresse in **Safari** öffnen.
2. Teilen-Symbol → **„Zum Home-Bildschirm“**.
3. Die App vom Home-Bildschirm starten und beim ersten Start die Sicherungsdatei laden
   (z. B. `bibliothek-start.json` aus iCloud Drive).

Wichtig: Die Daten gehören zu der installierten App auf diesem Gerät. Regelmäßig unter **Daten →
Sicherung erstellen** eine Sicherung in iCloud Drive ablegen. Die App erinnert, wenn Änderungen
länger als 7 Tage ungesichert sind.

## Geräte abgleichen (über iCloud Drive)
Auf Gerät A: **Daten → Sicherung erstellen** → „In Dateien sichern“ → iCloud Drive.
Auf Gerät B: **Daten → Sicherung zusammenführen** → dieselbe Datei wählen.
Pro Buch gewinnt der neuere Stand (Feld `u`); Löschungen werden als Markierung übertragen.

## Datenformat (offen dokumentiert)
Eine Sicherung ist eine JSON-Datei:

```json
{
  "format": "thors-bibliothek", "version": 1,
  "exportiert": "2026-11-18T08:00:00Z", "geraet": "iPad",
  "buecher": [ { "id": "bb-…", "t": "Titel", "a": "Autor", "…": "…" } ],
  "historie": [ { "datum": "2026-11-18", "art": "Kindle", "text": "…" } ],
  "aenderungen": [ ["Bearbeitet", "Titel", "Autor", "Status: Ungelesen → Gelesen", "2026-11-18"] ],
  "regeln": { "genre_kategorien": { "Philosophie": ["Philosophy", "…"] }, "karte_ausgeblendete_tags": ["…"] }
}
```

Felder eines Buchs (leere Felder können fehlen):

| Feld | Bedeutung |
|---|---|
| `id` | eindeutige Kennung (`bb-…` aus BookBuddy, `kd-ASIN` aus Kindle, `b-…` in der App angelegt) |
| `t`, `s`, `a`, `al` | Titel, Untertitel, Autor(en), Autor für Sortierung („Nachname, Vorname“) |
| `p`, `y`, `pg`, `i`, `l` | Verlag, Erscheinungsjahr, Seiten, ISBN-13, Sprache |
| `c`, `g`, `cz` | Kategorie, ursprüngliches BookBuddy-Genre, Kategorie nachträglich zugeordnet (1) |
| `tg`, `ts`, `tt` | eigene Tags, vorgeschlagene Tags, inhaltliche Themen (Listen) |
| `st` | Status: Ungelesen, Lese ich, Gelesen, Abgebrochen, Wunschliste |
| `r` | Bewertung 0–5 |
| `ds`, `df`, `da` | begonnen, beendet, hinzugefügt (JJJJ-MM-TT) |
| `su`, `n` | Klappentext, Notizen |
| `fm`, `kd` | `"Kindle"` = nur E-Book; `kd: 1` = (auch) auf Kindle |
| `ka` | Kindle-Kennung (ASIN) – für „In Kindle-App öffnen“ (`kindle://book?action=open&asin=…`) |
| `kdf`, `km`, `kn`, `stk` | auf Kindle beendet am, Anzahl Kindle-Markierungen, Kindle-Notizen, Status aus Kindle übernommen |
| `cv` | Cover: Bild-Adresse (https) oder eigenes Foto als data-URL |
| `loc`, `lendTo`, `lendSince` | Standort im Regal, verliehen an, verliehen seit |
| `u` | Zeitpunkt der letzten Änderung (ISO 8601) – entscheidet beim Zusammenführen |
| `del` | gelöscht (Markierung, damit Löschungen auf andere Geräte übertragen werden) |

Die CSV-Ausgabe enthält dieselben Felder mit lesbaren Spaltennamen.

**Ergänzungsdateien** (`"typ": "ergaenzung"`, Feld `felder`: `{ id: { feld: wert } }`) füllen nur
leere Felder vorhandener Bücher und lassen eigene Änderungen unberührt. Sie werden wie eine
Sicherung über „Sicherung zusammenführen“ geladen.

## Aufbau
- `index.html`, `css/` – Oberfläche
- `js/data.js` – Speicherung (IndexedDB), Sicherung, Zusammenführen
- `js/isbn.js` – ISBN-Prüfung, Nachschlagen, Barcode-Scan
- `js/map.js` – Themenlandkarte
- `js/app.js` – Katalog, Bearbeiten, Historie, Daten
- `sw.js`, `manifest.webmanifest` – Offline-Betrieb und Installation
- `vendor/` – d3 (Karte) und ZXing (Barcode), lokal eingebunden, damit die App offline läuft

Keine Build-Schritte, keine Abhängigkeiten zur Laufzeit. Bei einer neuen Version in `sw.js` die
Konstante `CACHE` hochzählen, damit installierte Apps aktualisiert werden.

## Lizenzen
d3: ISC (`vendor/d3.LICENSE`), ZXing: Apache 2.0 (`vendor/zxing.LICENSE`).
