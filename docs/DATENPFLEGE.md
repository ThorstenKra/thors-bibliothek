# Datenpflege

## Sicherung (regelmäßig)
App → **Daten → „Sicherung erstellen“** → Teilen-Menü → „In Dateien sichern“ → iCloud Drive,
am besten immer in denselben Ordner (z. B. *iCloud Drive › Bibliothek*). Die App erinnert, wenn
Änderungen länger als 7 Tage ungesichert sind. Dateiname: `bibliothek-JJJJ-MM-TT.json`.

## Mehrere Geräte (iPad, iPhone, Desktop)
Auf Gerät A sichern, auf Gerät B **„Sicherung zusammenführen“** mit derselben Datei.
Pro Buch gewinnt der neuere Stand (Feld `u`). Löschungen werden als Markierung (`del`) übertragen.
**„Alles ersetzen“** nur bewusst verwenden (überschreibt die Bibliothek auf dem Gerät).

## Ergänzungsdateien (z. B. von Claude)
Über **„Sicherung zusammenführen“** laden. Sie füllen nur **leere** Felder vorhandener Bücher
und lassen eigene Angaben unberührt. Bisher: `bibliothek-cover.json`, `bibliothek-kindle-links.json`, `bibliothek-science-fiction.json`, `bibliothek-bereinigung.json`.
Mit dem Abschnitt `aendern` können sie auch gefüllte Felder gezielt umstellen (z. B. Kategorie
Belletristik → Science-Fiction) – nur wo der alte Wert noch unverändert ist.

## Datenprüfung (gelegentlich)
**Daten → „Bibliothek prüfen“** zeigt Namensvarianten (vereinheitlichen per Knopf), Übersetzer im
Autorfeld („Rest → Übersetzer/Hrsg.“), mögliche Dubletten, Kategorie-Ausreißer und fehlende Angaben.
Alle Bereinigungen stehen in der Änderungsliste. Nach einem Kindle-Abgleich lohnt ein Blick auf Dubletten.

## Kindle-Abgleich (vierteljährlich)
1. amazon.de → Mein Konto → Datenschutz → „Meine Daten anfordern“ → Kindle; per E-Mail bestätigen.
2. ZIP (kommt nach einigen Tagen) in iCloud Drive ablegen.
3. App → **Daten → „Kindle-Export wählen (ZIP)“** → Vorschau prüfen → „Änderungen übernehmen“.
4. Danach sichern.

Regeln: Zuordnung über ASIN, sonst Titel + Autor + Bandnummer. Laut Kindle beendete Bücher werden
„Gelesen“, außer Thor hat sie auf „Gelesen“ oder „Abgebrochen“ gesetzt. Neue Kindle-Käufe kommen
unter „Ohne Kategorie“ dazu. Prime-Leihen und zurückgegebene Bücher werden nicht aufgenommen.

## App aktualisieren
App → **Daten → „Nach Update suchen“**. Die Version steht unter „Über die App“.

## App neu installieren (z. B. neues Symbol)
1. **Zuerst sichern** – iOS löscht beim Entfernen der Home-Bildschirm-App ihre Daten.
2. App entfernen, in Safari die Seite neu laden, „Teilen → Zum Home-Bildschirm“.
3. App öffnen → „Sicherungsdatei laden“.

## Mit Claude arbeiten
Für Auswertungen oder Ergänzungen eine **aktuelle Sicherung** im Chat hochladen. Claude liefert
eine Ergänzungsdatei zurück und dokumentiert Änderungen in CHANGELOG und ROADMAP.

## BookBuddy
Wird nicht mehr gepflegt. Der letzte Export (16.11.2026) ist in der App vollständig enthalten.
