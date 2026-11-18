#!/usr/bin/env python3
"""
Kindle-Datenexport von Amazon ("Meine Daten anfordern" → Kindle) in kindle.json umwandeln.

Aufruf:
  python3 kindle_import.py ORDNER_DES_ENTPACKTEN_EXPORTS kindle.json

Liest:
  Digital.Content.Ownership/*.json            → E-Books, Herkunft (Kauf, Prime …), Status, Kaufdatum
  Kindle.ReadingInsights/…UserUniqueTitlesCompleted → als beendet erfasste Bücher mit Datum
  Digital.Content.Whispersync/whispersync.csv → Anzahl Markierungen, Notizen (Text der Markierungen
                                                ist im Export nicht enthalten)
  Kindle.UnifiedLibraryIndex/…AuthorNameRelationship → Autoren
Wörterbücher und Kindle-Handbücher werden übersprungen.
"""
import collections, glob, json, re, sys
import pandas as pd


def clean(name):
    n = re.sub(r"\s*\((German|English|Spanish|French) Edition\)\s*$", "", name)
    n = re.sub(r"\s*\([^)]*(Reihe|Classics|Taschenbuch|Bibliothek|Edition|Landmark)[^)]*\)\s*", " ", n)
    return n.strip()


def language(name):
    m = re.search(r"\((German|English|Spanish|French) Edition\)", name)
    if m: return {"German": "Deutsch", "English": "Englisch", "Spanish": "Spanisch", "French": "Französisch"}[m.group(1)]
    w = set(re.findall(r"[a-záéíóúñàèçâêîôû']+", name.lower()))
    if w & {"the", "of", "and", "complete", "works", "book", "volume", "our", "dream", "stories"}: return "Englisch"
    if w & {"el", "los", "las", "cuentos", "obras", "del", "novelas", "rimas", "vida", "sueño", "quién", "conquista"}: return "Spanisch"
    if w & {"le", "les", "histoires", "trois", "petit", "soir"}: return "Französisch"
    return "Deutsch"


def main(src, out):
    rows = []
    for f in glob.glob(f"{src}/Digital.Content.Ownership/*.json"):
        for d in json.load(open(f, encoding="utf-8")):
            r = d["resource"]
            if r.get("resourceType") != "KindleEBook": continue
            for rt in d.get("rights", []):
                o = rt.get("origin", {}).get("originType")
                if o in ("KindleDictionary", "KindleUserGuide"): continue
                rows.append(dict(asin=r["ASIN"], name=r.get("Product Name", ""), origin=o,
                                 status=rt.get("rightStatus"), acq=rt.get("acquiredDate", "")[:10]))
    o = pd.DataFrame(rows)
    o["rank"] = (o.status == "Active").astype(int)
    o = o.sort_values(["rank", "acq"], ascending=False).drop_duplicates("asin")

    cf = glob.glob(f"{src}/Kindle.ReadingInsights/datasets/Kindle.UserUniqueTitlesCompleted/*.csv")
    done = {}
    if cf:
        comp = pd.read_csv(cf[0])
        for v in comp.iloc[:, 0].astype(str):
            p = v.split("_")
            if len(p) >= 2: done[p[0]] = max(done.get(p[0], ""), p[1])

    hl, nt = {}, collections.defaultdict(list)
    wf = glob.glob(f"{src}/Digital.Content.Whispersync/whispersync.csv")
    if wf:
        w = pd.read_csv(wf[0], low_memory=False)
        w = w[w["Is Deleted"] != "Yes"]
        hl = w[w["Annotation Type"] == "kindle.highlight"].groupby("ASIN")["Creation Date"].nunique().to_dict()
        for _, r in w[(w["Annotation Type"] == "kindle.note") & (w["Note"] != "Not Available")].iterrows():
            if r["Note"] not in nt[r["ASIN"]]: nt[r["ASIN"]].append(r["Note"])

    auth = {}
    for f in glob.glob(f"{src}/Kindle.UnifiedLibraryIndex/datasets/*AuthorNameRelationship*/*.csv"):
        for _, r in pd.read_csv(f).iterrows():
            if r["Author Name"] != "Not Available": auth.setdefault(r["ASIN"], r["Author Name"])

    books = []
    for _, r in o.iterrows():
        books.append(dict(asin=r.asin, titel=clean(r["name"]), original=r["name"], autor=auth.get(r.asin, ""),
                          sprache=language(r["name"]), herkunft=r.origin, status=r.status, erworben=r.acq,
                          beendet=done.get(r.asin, ""), markierungen=int(hl.get(r.asin, 0)),
                          notizen=nt.get(r.asin, [])))
    json.dump({"stand": max(x["erworben"] for x in books), "buecher": books},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    a = [b for b in books if b["status"] == "Active"]
    print(f"{len(books)} E-Books ({len(a)} aktiv) | beendet: {sum(1 for b in a if b['beendet'])} | "
          f"mit Markierungen: {sum(1 for b in a if b['markierungen'])} | mit Notizen: {sum(1 for b in a if b['notizen'])}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
