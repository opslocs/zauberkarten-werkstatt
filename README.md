# Zauberkarten-Werkstatt

Druckbare deutsche D&D-Zauberkarten (Pokergröße) im Browser — Editor, A4-Bogenvorschau
und Vektor-PDF-Export. Enthält alle 339 Zauber des System Reference Document 5.2.1,
vollständig zweisprachig (Deutsch/Englisch).

**Live:** https://opslocs.github.io/zauberkarten-werkstatt/

## Funktionen

- Suche & Filter (Grad, Klasse, Schule, Quelle), DE/EN-Umschalter
- Karten bearbeiten, eigene Karten anlegen, JSON-Import/-Export (Änderungen bleiben im Browser gespeichert)
- 📑 Bogenvorschau: alle Karten auf A4-Bögen (3×3, mit Schnittmarken)
- 📄 PDF-Export: Vektor-PDF mit Bögen in Pokergröße (63,5 × 88,9 mm) und Anhang für sehr lange Zauber
- Automatische Silbentrennung, Abkürzungen bei Platznot, Felder-Angabe bei Reichweiten (1,5 m = 1 Feld)

## Eigene Inhalte

Über **Import JSON** lässt sich eine erweiterte Kartendatenbank laden (gleiches Format
wie der Export). So können z. B. Zauber aus anderen Quellenbüchern ergänzt werden —
solche Inhalte gehören aber nicht in dieses öffentliche Repository.

## Lokal öffnen

Die Zauberdaten werden aus `spells.json` geladen. Browser blockieren `fetch()` für lokale
Dateien (`file://`), daher die Seite bitte über einen Webserver öffnen, z. B.:

```bash
python3 -m http.server
```

Danach <http://localhost:8000> aufrufen.

## Lizenz

Dieses Werk enthält Material aus dem System Reference Document 5.2.1 („SRD 5.2.1“) und
dem deutschen Systemreferenzdokument 5.2.1 von Wizards of the Coast LLC, verfügbar unter
der Creative-Commons-Namensnennung-4.0-International-Lizenz (CC-BY-4.0):
https://creativecommons.org/licenses/by/4.0/legalcode

Schrift: Fira Sans Condensed (SIL Open Font License). PDF-Erzeugung: jsPDF (MIT).
