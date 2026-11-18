#!/usr/bin/env python3
"""
Thors Bibliothek – BookBuddy-Export aufbereiten und Korrekturen wieder anwenden.

Aufruf:
  python3 bibliothek.py EXPORT.csv korrekturen.json template.html AUSGABE.html [--d3 d3.min.js]
                        [--neu-korrekturen korrekturen_neu.json]

Was passiert:
  1. Der BookBuddy-Export wird eingelesen, Genres über die Regeln in korrekturen.json
     auf deutsche Kategorien abgebildet.
  2. Für jedes Buch werden die gespeicherten Korrekturen angewendet (Schlüssel: ISBN + Titel,
     ohne ISBN: Titel + Autor). Änderungen, die du inzwischen selbst in BookBuddy gemacht hast,
     haben Vorrang:
       - Kategorie-Korrektur nur, wenn das Genre in BookBuddy noch dasselbe ist wie damals.
       - Tag-Vorschläge nur, solange das Buch in BookBuddy keine eigenen Tags hat.
       - Inhaltliche Themen immer, außer sie stehen schon in deinen eigenen Tags.
  3. Bücher, die neu im Export sind, bekommen regelbasierte Tag-Vorschläge und werden als
     "neu" gemeldet (für sie können später Kategorie/Themen ergänzt werden).
  4. Katalogseite (Katalog, Themenlandkarte, Historie) wird geschrieben.
"""
import argparse, collections, datetime, difflib, json, re, sys, unicodedata
import pandas as pd


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def s(v):
    return "" if pd.isna(v) else str(v).strip()


def num(v):
    return "" if pd.isna(v) else str(int(v))


def key_of(isbn, title, author):
    return f"{isbn}|{norm(title)}" if isbn else f"-|{norm(title)}|{norm(author.split(',')[0])}"


def cover_url(uploaded, gid, isbn):
    """Cover-Adresse: eigenes BookBuddy-Bild, sonst Google Books, sonst Open Library (immer https)."""
    if uploaded:
        u = re.sub(r"^http://images\.amazon\.com/", "https://images-na.ssl-images-amazon.com/", uploaded)
        return re.sub(r"^http://", "https://", u)
    if gid:
        return f"https://books.google.com/books/content?id={gid}&printsec=frontcover&img=1&zoom=1"
    if isbn:
        return f"https://covers.openlibrary.org/b/isbn/{isbn}-M.jpg?default=false"
    return ""


def read_export(path, R):
    df = pd.read_csv(path)
    genre_map = {g: c for c, gs in R["genre_kategorien"].items() for g in gs}
    books = []
    for _, r in df.iterrows():
        g = s(r["Genre"])
        summ = re.sub(r"\s+", " ", s(r["Summary"]))
        for a, b in R["textkorrekturen"].items():
            summ = summ.replace(a, b)
        summ = summ.replace("�", "")
        if summ[:2] in ('p”', 'p"'):
            summ = summ[2:]
        title = s(r["Title"]).replace(",,", "„")
        title = R["titelkorrekturen"].get(title, title)
        al = s(r["Author (Last, First)"])
        b = {
            "t": title, "s": s(r["Subtitle"]),
            "a": re.sub(r",\s*", ", ", s(r["Author"])),
            "al": ",".join(al.split(",")[:2]),
            "p": s(r["Publisher"]), "y": num(r["Year Published"]),
            "g": g, "c": genre_map.get(g, "Sonstiges" if g else "Ohne Kategorie"),
            "tg": [t.strip() for t in s(r["Tags"]).split(",") if t.strip()],
            "l": R["sprachen"].get(s(r["Language"]), s(r["Language"])),
            "pg": num(r["Number of Pages"]), "i": num(r["ISBN"]),
            "st": R["status"].get(s(r["Status"]), s(r["Status"])),
            "r": int(r["Rating"]) if not pd.isna(r["Rating"]) else 0,
            "ds": s(r["Date Started"]).replace("/", "-"),
            "df": s(r["Date Finished"]).replace("/", "-"),
            "da": s(r["Date Added"])[:10].replace("/", "-"),
            "su": summ, "n": s(r["Notes"]),
        }
        b["cv"] = cover_url(s(r.get("Uploaded Image URL", "")), s(r.get("Google VolumeID", "")), b["i"])
        b["key"] = key_of(b["i"], s(r["Title"]), b["a"])
        books.append(b)
    return books


# ---------- regelbasierte Tag-Vorschläge (für Bücher ohne gespeicherte Vorschläge) ----------
def rule_suggestions(books, R):
    KW = R["stichwoerter"]
    RX = {t: re.compile(p, re.I) for t, p in KW.items()}
    RX["Macht"] = re.compile(r"\bMacht\b|[Hh]errschaft|\b[Ee]lite")
    fiction_ok = set(R["stichwoerter_belletristik"])
    catdef = R["kategorie_standardtag"]
    at = collections.defaultdict(collections.Counter); an = collections.Counter()
    for b in books:
        if b["tg"]:
            an[b["a"]] += 1
            for t in b["tg"]: at[b["a"]][t] += 1

    def suggest(b):
        score = collections.Counter()
        if an[b["a"]]:
            for t, n in at[b["a"]].items():
                if n / an[b["a"]] >= .5: score[t] += 3
        if b["c"] in catdef: score[catdef[b["c"]]] += 2
        head = " ".join([b["t"], b["s"]]); su = b["su"]
        fiction = b["c"] in ("Belletristik", "Science-Fiction")
        for t, rx in RX.items():
            if fiction and t not in fiction_ok: continue
            h = len(rx.findall(head)) * 3 + len(rx.findall(su))
            if h >= 3: score[t] += 1 + min(h, 4) / 4
        if not fiction:
            score.pop("Belletristik", None); score.pop("Science Fiction", None)
        return [t for t, sc in score.most_common() if sc >= 1.5][:4]
    return suggest


def apply(books, K):
    R = K["regeln"]; E = K["eintraege"]
    suggest = rule_suggestions(books, R)
    bekannt = set(K.get("bekannte_buecher", []))
    stats = collections.Counter(); neu, konflikt = [], []
    seen = set()
    for b in books:
        e = E.get(b["key"])
        seen.add(b["key"])
        if b["key"] not in bekannt:
            neu.append(b)
        if e is None:
            if not b["tg"] and b["key"] not in bekannt:
                sg = suggest(b)
                if sg: b["ts"] = sg; b["tsneu"] = 1
            continue
        k = e.get("kategorie")
        if k:
            if b["g"] == k["genre_bookbuddy"]:
                b["c"] = k["nach"]; b["cz"] = 1; stats["kategorie"] += 1
            else:
                konflikt.append((b, "Genre in BookBuddy geändert – deine Angabe gilt"))
        if e.get("tags_vorschlag") and not b["tg"]:
            b["ts"] = e["tags_vorschlag"]; stats["tags"] += 1
        th = [t for t in e.get("themen", []) if t not in b["tg"]]
        if th:
            b["tt"] = th; stats["themen"] += 1
    fehlend = [k for k in bekannt if k not in seen]
    return stats, neu, konflikt, fehlend


# ---------- Kindle ----------
TRANS = {"tolstoy": "tolstoj", "tolstoi": "tolstoj", "dostojewski": "dostoevskij", "dostoevsky": "dostoevskij"}


def _names(a):
    return {TRANS.get(w, w) for w in norm(a).split() if len(w) > 3}


def _main_title(t):
    return norm(re.split(r":| - | – |\. ", t)[0])


def _band(t):
    return re.findall(r"band\s*(\d+)", norm(t))


def kindle_author(a):
    """Kindle schreibt 'Nachname, Vorname' – umdrehen."""
    a = (a or "").strip()
    if a.count(",") == 1:
        last, first = [x.strip() for x in a.split(",")]
        return f"{first} {last}".strip()
    return a


def merge_kindle(books, KD, K, suggest, stand):
    """Kindle-Bibliothek mit BookBuddy abgleichen. Gibt Statistik und Historienzeilen zurück."""
    idx = collections.defaultdict(list)
    for i, b in enumerate(books): idx[_main_title(b["t"])].append(i)
    keys = list(idx)
    E = K["eintraege"]; bekannt = set(K.get("bekannte_kindle", []))
    st = collections.Counter(); rows = []; neu = []; added = []; seen_new = set()
    for x in KD["buecher"]:
        if x["status"] != "Active": continue
        mt = _main_title(x["titel"]); ks = _names(x["autor"])
        cand = idx.get(mt, [])
        if not cand and len(mt) > 6:
            m = difflib.get_close_matches(mt, keys, n=1, cutoff=.88)
            if m: cand = idx[m[0]]
        hit = [i for i in cand if ks & _names(books[i]["a"]) and _band(x["original"]) == _band(books[i]["t"])]
        if not hit and cand and not ks: hit = cand
        if hit:
            for i in hit:
                b = books[i]; b["kd"] = 1; st["abgeglichen"] += 1
                b.setdefault("ka", x["asin"])
                if x["beendet"]: b["kdf"] = x["beendet"]
                if x["markierungen"]: b["km"] = x["markierungen"]
                if x["notizen"]: b["kn"] = b.get("kn", []) + [n for n in x["notizen"] if n not in b.get("kn", [])]
                if x["beendet"] and b["st"] != "Gelesen":
                    rows.append(["Kindle", b["t"], b["a"], f'Status {b["st"]} → Gelesen (auf Kindle beendet)', x["beendet"]])
                    b["st"] = "Gelesen"; b["stk"] = 1; b["df"] = b.get("df") or x["beendet"]; st["status"] += 1
            continue
        if x["herkunft"] != "Purchase": continue
        dkey = (mt, norm(x["autor"]))
        if dkey in seen_new: continue
        seen_new.add(dkey)
        key = "kindle:" + x["asin"]
        e = E.get(key, {})
        tt = x["titel"]
        for _ in range(3): tt = re.sub(r"\s*[\(\[][^)\]]*[\)\]]\s*$", "", tt).strip()
        sub = ""
        if ": " in tt: tt, sub = [p.strip() for p in tt.split(": ", 1)]
        b = {"t": tt, "s": sub, "a": kindle_author(x["autor"]) or "Unbekannt", "al": x["autor"], "p": "", "y": "",
             "g": "", "c": e.get("kategorie", {}).get("nach", "Ohne Kategorie"), "tg": [], "l": x["sprache"], "pg": "",
             "i": "", "st": "Gelesen" if x["beendet"] else "Ungelesen", "r": 0, "ds": "", "df": x["beendet"],
             "da": x["erworben"], "su": "", "n": "", "fm": "Kindle", "kd": 1, "key": key,
             "cv": f"https://m.media-amazon.com/images/P/{x['asin']}.01._SCLZZZZZZZ_.jpg", "ka": x["asin"]}
        if e.get("kategorie"): b["cz"] = 1
        if e.get("themen"): b["tt"] = e["themen"]
        if x["markierungen"]: b["km"] = x["markierungen"]
        if x["notizen"]: b["kn"] = x["notizen"]
        if x["beendet"]: b["kdf"] = x["beendet"]
        if not e.get("themen"):
            sg = suggest(b)
            if sg: b["ts"] = sg
        if key not in bekannt: neu.append(b)
        added.append(b); st["neu_aufgenommen"] += 1
    books.extend(added)
    return st, rows, neu, added


def graph(books, R):
    alltags = lambda b: list(dict.fromkeys(b.get("tg", []) + b.get("ts", []) + b.get("tt", [])))
    cat_n = collections.Counter(b["c"] for b in books)
    tag_n = collections.Counter(t for b in books for t in alltags(b))
    auth = collections.Counter(b["a"] for b in books)
    dup = set(R["karte_ausgeblendete_tags"])
    tags = {t for t, n in tag_n.items() if n >= 5 and t not in dup}
    authors = {a for a, n in auth.items() if n >= 4 and a != "Gitarre"}
    nodes = [{"id": "c:"+c, "k": "c", "n": c, "v": v} for c, v in cat_n.items()]
    nodes += [{"id": "t:"+t, "k": "t", "n": t, "v": tag_n[t]} for t in tags]
    nodes += [{"id": "a:"+a, "k": "a", "n": a, "v": auth[a]} for a in authors]
    E = collections.Counter()
    for b in books:
        bt = [t for t in alltags(b) if t in tags]
        if b["a"] in authors:
            E[("a:"+b["a"], "c:"+b["c"])] += 1
            for t in bt: E[("a:"+b["a"], "t:"+t)] += 1
        for t in bt: E[("t:"+t, "c:"+b["c"])] += 1
        for i in range(len(bt)):
            for j in range(i+1, len(bt)):
                x, y = sorted((bt[i], bt[j])); E[("t:"+x, "t:"+y)] += 1
    def keep(k, w):
        a, b = k
        if a[0] == "a": return True
        if a[0] == "t" and b[0] == "c": return w >= 3
        return w >= 8
    links = [{"s": a, "t": b, "w": w} for (a, b), w in E.items() if keep((a, b), w)]
    deg = collections.Counter([l["s"] for l in links] + [l["t"] for l in links])
    return {"nodes": [n for n in nodes if deg[n["id"]]], "links": links}


def history_view(K, books, neu, konflikt, krows=(), kneu=()):
    """Kompakte Daten für den Reiter 'Historie'."""
    byk = {b["key"]: b for b in books}
    rows = []
    for k, e in K["eintraege"].items():
        b = byk.get(k)
        if e.get("kategorie"):
            von = "Kindle" if k.startswith("kindle:") else (e["kategorie"]["genre_bookbuddy"] or "—")
            rows.append(["Kategorie", e["titel"], e["autor"], f'{von} → {e["kategorie"]["nach"]}', e["kategorie"]["datum"]])
        if e.get("themen"):
            rows.append(["Themen", e["titel"], e["autor"], ", ".join(e["themen"]), e["themen_datum"]])
        if e.get("tags_vorschlag"):
            rows.append(["Tags", e["titel"], e["autor"], ", ".join(e["tags_vorschlag"]), e["tags_datum"]])
    rows += [list(r) for r in krows]
    return {"log": K["historie"], "rows": rows,
            "neu": [[b["t"], b["a"]] for b in neu], "kneu": [[b["t"], b["a"]] for b in kneu],
            "konflikt": [[b["t"], b["a"], msg] for b, msg in konflikt],
            "regeln": {"genres": sum(len(v) for v in K["regeln"]["genre_kategorien"].values()),
                       "kategorien": len(K["regeln"]["genre_kategorien"])}}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv"); ap.add_argument("korrekturen"); ap.add_argument("template"); ap.add_argument("out")
    ap.add_argument("--d3", help="lokale d3.min.js einbetten (sonst von cdnjs laden)")
    ap.add_argument("--stand", default=datetime.date.today().isoformat())
    ap.add_argument("--app-json", help="zusätzlich Startdatei für die eigenständige App (Thors Bibliothek PWA) schreiben")
    ap.add_argument("--app-ergaenzung", help="Ergänzungsdatei für die App schreiben (nur leere Felder füllen, z. B. Cover)")
    ap.add_argument("--kindle", help="kindle.json (aus kindle_import.py) einbeziehen")
    ap.add_argument("--speichern", action="store_true",
                    help="neue Bücher als bekannt eintragen, ihre Tag-Vorschläge und einen Historie-Eintrag in korrekturen.json speichern")
    a = ap.parse_args()
    K = json.load(open(a.korrekturen, encoding="utf-8"))
    books = read_export(a.csv, K["regeln"])
    stats, neu, konflikt, fehlend = apply(books, K)
    kst, krows, kneu, kadded = collections.Counter(), [], [], []
    if a.kindle:
        KD = json.load(open(a.kindle, encoding="utf-8"))
        kst, krows, kneu, kadded = merge_kindle(books, KD, K, rule_suggestions(books, K["regeln"]), a.stand)
        if a.speichern and kneu:
            K["bekannte_kindle"] = sorted(set(K.get("bekannte_kindle", [])) | {b["key"] for b in kadded})
            K["historie"].append({"datum": a.stand, "art": "Kindle",
                "text": f"Kindle-Export eingelesen: {len(kneu)} neue Kindle-Bücher ohne BookBuddy-Eintrag aufgenommen."})
            t = json.dumps(K, ensure_ascii=False, indent=1).replace("\ufffd", "\\ufffd")
            open(a.korrekturen, "w", encoding="utf-8").write(t)
    if a.speichern and (neu or fehlend):
        for b in neu:
            if b.get("tsneu"):
                K["eintraege"].setdefault(b["key"], {"titel": b["t"], "autor": b["a"]}).update(
                    {"tags_vorschlag": b["ts"], "tags_datum": a.stand})
        K["bekannte_buecher"] = sorted({b["key"] for b in books})
        K["historie"].append({"datum": a.stand, "art": "Export",
            "text": f"Neuer BookBuddy-Export eingelesen: {len(books)} Bücher, {len(neu)} neu, {len(fehlend)} nicht mehr enthalten."
                    + (f" Regelbasierte Tag-Vorschläge für {sum(1 for b in neu if b.get('tsneu'))} neue Bücher." if neu else "")})
        K["stand"] = a.stand
        t = json.dumps(K, ensure_ascii=False, indent=1).replace("\ufffd", "\\ufffd")
        open(a.korrekturen, "w", encoding="utf-8").write(t)
    G = graph(books, K["regeln"])
    H = history_view(K, books, neu, konflikt, krows, kneu)
    import hashlib
    used = set()
    for b in books:
        k = b.get("key", "")
        base = ("kd-" + k[7:]) if k.startswith("kindle:") else "bb-" + hashlib.sha1(k.encode()).hexdigest()[:12]
        bid, n = base, 1
        while bid in used: n += 1; bid = f"{base}-{n}"
        used.add(bid); b["id"] = bid
    for b in books:
        for f in ("key", "tsneu"): b.pop(f, None)
        for f in [f for f, v in b.items() if v in ("", [], 0) and f not in ("t", "a", "c", "st")]: b.pop(f)
    if a.app_json:
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        app = {"format": "thors-bibliothek", "version": 1, "exportiert": now, "geraet": "Übernahme aus BookBuddy/Kindle",
               "buecher": [dict(b, u=now) for b in books], "historie": K["historie"], "aenderungen": H["rows"],
               "regeln": {"genre_kategorien": K["regeln"]["genre_kategorien"], "karte_ausgeblendete_tags": K["regeln"]["karte_ausgeblendete_tags"]}}
        json.dump(app, open(a.app_json, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    if a.app_ergaenzung:
        app = {"format": "thors-bibliothek", "version": 1, "typ": "ergaenzung",
               "exportiert": datetime.datetime.now(datetime.timezone.utc).isoformat(),
               "beschreibung": "Kindle-Kennungen (ASIN) für Kindle-Bücher",
               "felder": {b["id"]: {"ka": b["ka"]} for b in books if b.get("ka")}}
        json.dump(app, open(a.app_ergaenzung, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    esc = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    d3 = (f"<script>{open(a.d3).read()}</script>" if a.d3 else
          '<script src="https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js"></script>')
    h = open(a.template, encoding="utf-8").read()
    h = (h.replace("__DATA__", esc(books)).replace("__GRAPH__", esc(G)).replace("__HIST__", esc(H))
          .replace("__STAND__", a.stand).replace("<script>__D3__</script>", d3))
    assert "�" not in h, "Zeichensalat im Export"
    open(a.out, "w", encoding="utf-8").write(h)
    print(f"{len(books)} Bücher | Korrekturen angewendet: Kategorie {stats['kategorie']}, "
          f"Tags {stats['tags']}, Themen {stats['themen']} | neu im Export: {len(neu)} | "
          f"Konflikte: {len(konflikt)} | nicht mehr im Export: {len(fehlend)}")
    if a.kindle:
        print(f"Kindle: {kst['abgeglichen']} Bücher in BookBuddy gefunden, {kst['status']} Status auf 'Gelesen' gesetzt, "
              f"{kst['neu_aufgenommen']} nur auf Kindle aufgenommen ({len(kneu)} davon neu seit dem letzten Kindle-Abgleich, {sum(1 for b in kadded if not b.get('cz'))} ohne Kategorie-Korrektur)")
        for b in kneu[:50]: print("  neu (Kindle):", b["t"], "–", b["a"])
    for b in neu[:50]: print("  neu:", b["t"], "–", b["a"])
    for b, m in konflikt: print("  Konflikt:", b["t"], "–", m)


if __name__ == "__main__":
    main()
