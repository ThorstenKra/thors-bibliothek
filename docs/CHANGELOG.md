# Änderungsprotokoll

## 1.7.0 – 18.11.2026
- **Autorenansicht** (Filter „Autor: …“): Bücher getrennt nach „Gelesen“, „Noch nicht gelesen“ und
  „Auf der Wunschliste“, darunter **weitere Werke des Autors** aus Open Library – zuerst Werke mit
  deutscher Ausgabe (deutscher Titel, Original dazu), sonst „Nur in anderen Sprachen“. Eigene Bücher
  werden über den Titelanfang herausgefiltert. „＋ Wunschliste“ legt das Werk mit Status Wunschliste
  an (Kategorie und Sprache wie beim Autor üblich, ISBN und Cover soweit bekannt).
- Ergebnisse werden 30 Tage auf dem Gerät gespeichert (Meta `werke`), offline wird der letzte Stand gezeigt.

## 1.6.1 – 18.11.2026
- **Barcode-Scan repariert**: Die eingebaute Videoschleife von ZXing erkannte keinen Barcode (ihre
  Zeichenfläche entstand, bevor das Kamerabild Maße hatte). Jetzt eigene Schleife: alle 200 ms der
  mittlere Bildstreifen, dekodiert mit ZXing; wo vorhanden zuerst der eingebaute `BarcodeDetector`.
  Kamera wird beim Schließen des Dialogs sicher beendet.
- Neuer Ersatzweg **„Foto vom Barcode“** (Kamera-App mit Autofokus, Foto wird ausgewertet).
- Verständliche Meldungen, wenn der Kamerazugriff fehlt.

## 1.6.0 – 18.11.2026
- Neues Feld **Genre** (`ge`) mit Filter im Katalog (zählt je gewählter Kategorie), in Buchansicht
  (antippbar), Bearbeiten, Suche und CSV.
- **Themenlandkarte in drei Ansichten**: Themen (farbige Kategorie-Bereiche), Autoren (ähnliche
  Autoren über seltene gemeinsame Themen, Mitautoren gestrichelt, Seitenleiste mit Genres und
  Themen), Übersicht (Flächen Kategorie → Genre bzw. Hauptthema, antippen filtert den Katalog).
  Gattungs-Tags („Lyrik“, „Anthologie“, „Science Fiction“, „Belletristik“) sind keine Themen mehr.
- Ergänzung `bibliothek-genres.json`: Genre für 775 Bücher aus Belletristik und Science-Fiction.

## 1.5.0 – 18.11.2026
- **Suche am Wortanfang**: „icke“ findet nicht mehr „Dickens“ oder „entwickelt“; `*` davor sucht
  überall im Wort. Ein Tipp auf „Alle Bücher von …“ (oder einen Autor auf der Landkarte) filtert
  genau nach diesem Autor; bei mehreren Personen gibt es je einen Knopf.
- Neues Feld **Übersetzer/Herausgeber** (`ue`) in Bearbeiten, Buchansicht, Suche und CSV.
- **Datenprüfung** unter Daten: Namensvarianten (mit „Vereinheitlichen“), mehrere Personen im
  Autorfeld (mit „Rest → Übersetzer/Hrsg.“), mögliche Dubletten, Kategorie-Ausreißer, fehlende Angaben.
- Ergänzungen mit `aendern` können auch Autor, Übersetzer, Kindle-Angaben und Löschungen setzen
  (zum Zusammenführen von Dubletten); verständlichere Einträge in der Änderungsliste.
- Ergänzung `bibliothek-bereinigung.json`: 94 Namensschreibweisen, 63 Übersetzer/Herausgeber,
  19 Dubletten, 7 Kategorien, 1 Autor (Prüfbericht als Claude-Dokument).

## 1.4.1 – 18.11.2026
- Themenlandkarte: Tags, die wie eine Kategorie heißen (z. B. „Belletristik“, „Science Fiction“,
  „Philosophie“), erscheinen nicht mehr als zweiter Punkt neben der Kategorie.

## 1.4.0 – 18.11.2026
- Neue Kategorie **Science-Fiction** (eigene Farbe). Bisher gab es Science Fiction nur als Tag
  innerhalb von Belletristik.
- Ergänzungsdateien können mit `aendern` gefüllte Felder gezielt umstellen – nur, wenn der alte
  Wert noch unverändert ist; jede Änderung landet in der Änderungsliste.
- Ergänzung `bibliothek-science-fiction.json`: 160 Bücher von Belletristik nach Science-Fiction
  (alle mit Tag „Science Fiction“ plus eindeutige SF-Titel ohne Tag, z. B. Lem, Asimov, Liu).

## 1.3.3 – 18.11.2026
- Ergänzungsdateien füllen auch leere Listen und die Kategorie „Ohne Kategorie“ – damit lassen
  sich neue Kindle-Bücher per Ergänzung einordnen.
- Projektdokumentation (`docs/`), Arbeitsanweisungen für Claude (`CLAUDE.md`), Werkzeuge (`tools/`).

## 1.3.2 – 18.11.2026
- App-Symbol unter neuem Dateinamen (`*-v2.png`), weil Safari das alte Symbol im Cache festhielt.

## 1.3.1 – 18.11.2026
- Neues App-Symbol: eigene Zeichnung einer Bibliotheks-Bogenflucht mit Lesepult (`icons/icon.svg`).

## 1.3.0 – 18.11.2026
- **Kindle-Abgleich in der App**: ZIP aus Amazons Datenexport laden, Vorschau (neue Kindle-Käufe,
  auf Kindle beendete Bücher, „auch auf Kindle“, neue Notizen), dann übernehmen. Zuordnung über
  ASIN, sonst Titel + Autor + Bandnummer. Wiederholter Abgleich ändert nichts.
- Fand 7 bisher fehlende Bände (u. a. Humboldt „Kosmos“ Bd. 2–4), die bei der Erstübernahme
  fälschlich zusammengefasst worden waren.

## 1.2.2 – 18.11.2026
- Service Worker umgeht den 10-Minuten-Cache von GitHub Pages; Knopf „Nach Update suchen“.

## 1.2.1 – 18.11.2026
- Kindle: Hauptknopf öffnet das Buch im Kindle Cloud Reader; „Kindle-App“ kopiert den Titel
  (iOS-App öffnet per Link kein bestimmtes Buch).

## 1.2.0 – 18.11.2026
- Kindle-Bücher öffnen (Kindle-App, Browser, Amazon); neues Feld `ka` (ASIN).
- Ergänzungsdatei `bibliothek-kindle-links.json` (608 Bücher).

## 1.1.0 – 18.11.2026
- Cover-Bilder (BookBuddy-Bilder, Google Books, Open Library, Amazon), offline zwischengespeichert;
  eigenes Cover per Foto; neue ISBN-Erfassungen bringen das Cover mit.
- Ergänzungsdateien (`typ: ergaenzung`) füllen nur leere Felder.
- Ergänzungsdatei `bibliothek-cover.json` (1.805 Bücher).

## 1.0.0 – 18.11.2026
- Erste eigenständige Version: Katalog, Suche, Filter, Barcode-Scan, ISBN-Abfrage, Bearbeiten,
  Verleihen, Standort, Wunschliste, Themenlandkarte, Historie, Sicherung (JSON/CSV),
  Zusammenführen von Sicherungen, Offline-Betrieb.
- Startdatei `bibliothek-start.json` mit 1.806 Büchern.

## Vorgeschichte – 16.–18.11.2026 (bei Claude)
- BookBuddy-Export ausgewertet; Katalog „Thors Bibliothek“ als Artefakt bei Claude.
- Genres auf 15 Kategorien vereinheitlicht; 193 Bücher ohne/mit unklarem Genre zugeordnet;
  67 Sachbücher aus der Belletristik umsortiert.
- 983 regelbasierte Tag-Vorschläge; inhaltliche Themen für 607 Belletristik-Bücher.
- Korrekturliste mit stabilen Schlüsseln (ISBN + Titel), Historie-Reiter, Themenlandkarte.
- Kindle-Export eingebunden: 333 Kindle-Bücher aufgenommen, 15 als gelesen übernommen,
  Notizen angezeigt.
