"use strict";

// ---------------- actions ----------------
function newSpell() {
  const id = "custom-" + Date.now().toString(36);
  const s = {
    id, name: { de: "Neuer Zauber", en: "New Spell" }, level: 1,
    school: { de: "Hervorrufung", en: "Evocation" },
    classes: { de: ["Magier"], en: ["Wizard"] },
    castingTime: { de: "Aktion", en: "Action" },
    range: { de: "18 Meter", en: "60 feet" },
    components: { de: "V, G", en: "V, S" },
    duration: { de: "Unmittelbar", en: "Instantaneous" },
    description: { de: "Beschreibung …", en: "Description …" },
    higherLevels: { de: "", en: "" },
    ritual: false, concentration: false, source: "Homebrew", custom: true,
  };
  db.spells.push(s);
  sortSpells(); saveDb();
  selectSpell(id);
}
function duplicateSpell() {
  const s = spellById(currentId);
  if (!s) return alert("Erst eine Karte auswählen.");
  const copy = JSON.parse(JSON.stringify(s));
  copy.id = "custom-" + Date.now().toString(36);
  copy.name.de += " (Kopie)"; copy.custom = true; copy.source = s.source || "Homebrew";
  db.spells.push(copy);
  sortSpells(); saveDb();
  selectSpell(copy.id);
}
function deleteSpell() {
  const s = spellById(currentId);
  if (!s) return;
  if (!s.custom) return alert("SRD-Karten können nicht gelöscht werden (nur eigene Karten). Nutze Filter, um sie auszublenden.");
  if (!confirm(`„${s.name.de}“ wirklich löschen?`)) return;
  db.spells = db.spells.filter(x => x.id !== s.id);
  selected.delete(s.id);
  currentId = null;
  saveDb(); renderList(); renderPreview(); renderEditor();
}
function sortSpells() {
  db.spells.sort((a, b) => a.level - b.level || (a.name[lang] || a.name.de || a.name.en).localeCompare(b.name[lang] || b.name.de || b.name.en, "de"));
}
async function resetAll() {
  if (!confirm("Alle lokalen Änderungen und eigenen Karten verwerfen und die SRD-Daten neu laden?")) return;
  localStorage.removeItem(LS_KEY);
  try { await loadDb(); } catch (e) { alert("spells.json konnte nicht geladen werden. Bitte die Seite über einen Webserver öffnen."); console.error(e); return; }
  currentId = null; selected.clear();
  sortSpells(); renderList(); renderPreview(); renderEditor();
}

function exportJson() {
  const blob = new Blob([JSON.stringify(db, null, 1)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "spells.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJson() {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = ".json,application/json";
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    f.text().then(t => {
      try {
        const data = JSON.parse(t);
        if (!data.spells || !Array.isArray(data.spells)) throw new Error("Kein 'spells'-Array gefunden");
        db = data;
        sortSpells(); saveDb();
        currentId = null; selected.clear();
        renderList(); renderPreview(); renderEditor();
        alert(`${db.spells.length} Karten importiert.`);
      } catch (e) { alert("Import fehlgeschlagen: " + e.message); }
    });
  };
  inp.click();
}

function setLang(l) {
  lang = l;
  document.getElementById("langDe").classList.toggle("on", l === "de");
  document.getElementById("langEn").classList.toggle("on", l === "en");
  sortSpells();
  renderList(); renderPreview(); renderEditor();
}
