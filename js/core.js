"use strict";

// ---------------- data ----------------
const LS_KEY = "dnd-zauberkarten-db-v1";
let db = null;          // { meta, spells: [...] }
let SPELL_DB = null;    // shipped data loaded from spells.json
let lang = "de";        // card language
let currentId = null;
let selected = new Set();

const SCHOOLS_EN = ["Abjuration","Conjuration","CunningActions","Divination","Enchantment","Evocation","Illusion","Necromancy","Transmutation"];
const SCHOOL_DE = { Abjuration:"Bannmagie", Conjuration:"Beschwörung", CunningActions:"Raffinierter Schlag", Divination:"Erkenntnismagie",
  Enchantment:"Verzauberung", Evocation:"Hervorrufung", Illusion:"Illusion", Necromancy:"Nekromantie", Transmutation:"Verwandlung" };
const SCHOOL_ZAUBER = { Bannmagie:"Bannzauber", Beschwörung:"Beschwörungszauber", "Raffinierter Schlag":"Raffinierter Schlagzauber", Erkenntnismagie:"Erkenntniszauber",
  Verzauberung:"Verzauberungszauber", Hervorrufung:"Hervorrufungszauber", Illusion:"Illusionszauber",
  Nekromantie:"Nekromantiezauber", Verwandlung:"Verwandlungszauber" };
const SCHOOL_TRICK = { Bannmagie:"Zaubertrick des Banns", Beschwörung:"Zaubertrick der Beschwörung",
  "Raffinierter Schlag":"Zaubertrick des raffinierten Schlags", Erkenntnismagie:"Zaubertrick der Erkenntnismagie",
  Verzauberung:"Zaubertrick der Verzauberung", Hervorrufung:"Zaubertrick der Hervorrufung", Illusion:"Zaubertrick der Illusion",
  Nekromantie:"Zaubertrick der Nekromantie", Verwandlung:"Zaubertrick der Verwandlung" };
const SCHOOL_GLYPH = { Abjuration:"🛡", Conjuration:"✳", CunningActions:"🦊", Divination:"👁", Enchantment:"♥",
  Evocation:"🔥", Illusion:"◐", Necromancy:"☠", Transmutation:"⚙" };
const CLASSES = ["Barde","Druide","Hexenmeister","Kleriker","Magier","Paladin","Schurke","Waldläufer","Zauberer"];
const CLASS_EN = { Barde:"Bard", Druide:"Druid", Hexenmeister:"Warlock", Kleriker:"Cleric",
  Magier:"Wizard", Paladin:"Paladin", Schurke:"Rogue", Waldläufer:"Ranger", Zauberer:"Sorcerer" };

async function loadDb() {
  const res = await fetch("spells.json");
  if (!res.ok){
    throw new Error(`spells.json konnte nicht geladen werden (${res.status})`);
  }
  SPELL_DB = await res.json();
  if (!SPELL_DB || !Array.isArray(SPELL_DB.spells)){
    throw new Error("spells.json enthält kein 'spells'-Array");
  }

  let stored = null;
  
  try {
    stored = JSON.parse(localStorage.getItem(LS_KEY));
  } catch (e) {
    console.warn("localStorage kaputt", e);
  }
  
  db = stored || JSON.parse(JSON.stringify(SPELL_DB));

  // pull in newly shipped spells without touching stored user edits
  if (!stored) {
    return;
  }

  const storedSpellIds = new Set(db.spells.map(s => s.id));
  let newlyAddedSpells = 0;
  for (const spell of SPELL_DB.spells) {
    if (!storedSpellIds.has(spell.id)){
      db.spells.push(JSON.parse(JSON.stringify(spell)));
      newlyAddedSpells++;
    }
  }
  if (newlyAddedSpells) saveDb();
}
function saveDb() { localStorage.setItem(LS_KEY, JSON.stringify(db)); }

function spellById(id) { return db.spells.find(s => s.id === id); }
