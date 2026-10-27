"use strict";

// ---------------- helpers ----------------
function esc(t) { return (t || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
// language accessor with EN fallback (PHB'24 spells have no German text)
function TX(obj, lg) { return (obj && (obj[lg] || obj.en || obj.de)) || ""; }
function txLang(obj, lg) { return (lg === "de" && obj && !obj.de && obj.en) ? "en" : lg; }

// ---- German hyphenation (Liang's algorithm over hypher-format patterns) ----
function buildHyphenator(langObj) {
  const trie = Object.create(null);
  let maxLen = 0;
  for (const key in langObj.patterns) {
    const k = +key, s = langObj.patterns[key];
    for (let i = 0; i + k <= s.length; i += k) {
      const chunk = s.substr(i, k);
      const letters = chunk.replace(/\d/g, "");
      const pts = new Array(letters.length + 1).fill(0);
      let li = 0;
      for (const ch of chunk) {
        if (ch >= "0" && ch <= "9") pts[li] = +ch; else li++;
      }
      trie[letters] = pts;
      if (letters.length > maxLen) maxLen = letters.length;
    }
  }
  const cache = Object.create(null);
  const leftmin = Math.max(langObj.leftmin || 2, 3), rightmin = Math.max(langObj.rightmin || 2, 3);
  return function (word) {
    const lw = word.toLowerCase();
    if (cache[lw]) return cache[lw];
    if (word.length < leftmin + rightmin + 2 || /[^a-zäöüß]/.test(lw)) return (cache[lw] = [word]);
    const w = "." + lw + ".";
    const pts = new Array(w.length + 1).fill(0);
    for (let i = 0; i < w.length; i++) {
      const lim = Math.min(maxLen, w.length - i);
      for (let l = 1; l <= lim; l++) {
        const p = trie[w.substr(i, l)];
        if (p) for (let j = 0; j < p.length; j++) if (p[j] > pts[i + j]) pts[i + j] = p[j];
      }
    }
    const parts = [];
    let last = 0;
    for (let i = 1; i < word.length; i++) {
      if (i >= leftmin && i <= word.length - rightmin && pts[i + 1] % 2 === 1) {
        parts.push(word.slice(last, i)); last = i;
      }
    }
    parts.push(word.slice(last));
    return (cache[lw] = parts);
  };
}
const hyphDe = window.HYPH_DE ? buildHyphenator(window.HYPH_DE) : null;
function hyphFor(lg) { return lg === "de" ? hyphDe : null; }

// ---- auto-abbreviations, applied only when a card would overflow ----
const ATTR_ABBR = { "Stärke": "STÄ", "Geschicklichkeits": "GES", "Konstitutions": "KON",
                    "Intelligenz": "INT", "Weisheits": "WEI", "Charisma": "CHA" };
const ABBREV = {
  de: [
    [/\bTrefferpunktemaximum\b/g, "TP-Maximum"],
    [/\bTrefferpunkte?n?\b/g, "TP"],
    [/\b(Stärke|Geschicklichkeits|Konstitutions|Intelligenz|Weisheits|Charisma)rettungsw[uü]rf(?:e|en|s)?\b/g,
      (m, a) => ATTR_ABBR[a] + "-RW"],
    [/\bRettungsw[uü]rf(?:e|en|s)?\b/g, "RW"],
    [/\bRettungswurf\b/g, "RW"],
    [/(\d(?:[.,]\d+)?)\s*Metern?\b/g, "$1 m"],
    [/(\d+)\s*Zentimetern?\b/g, "$1 cm"],
    [/(\d+(?:,\d+)?)\s*Kilometern?\b/g, "$1 km"],
    [/(\d+)\s*Minuten?\b/g, "$1 Min."],
    [/(\d+)\s*Stunden?\b/g, "$1 Std."],
    [/\bbeispielsweise\b/g, "z. B."],
    [/\bSchwierigkeitsgrad\b/g, "SG"],
  ],
  en: [
    [/\bHit Points?\b/g, "HP"],
    [/\bsaving throws\b/g, "saves"],
    [/\bsaving throw\b/g, "save"],
    [/(\d+)-foot\b/g, "$1-ft."],
    [/(\d+) feet\b/g, "$1 ft."],
  ],
};
function abbrevText(t, lg) {
  let out = t || "";
  for (const [re, rep] of (ABBREV[lg] || [])) out = out.replace(re, rep);
  return out;
}
function abbrevSpell(s, lg) {
  return { ...s,
    description: { ...s.description, [lg]: abbrevText(TX(s.description, lg), txLang(s.description, lg)) },
    higherLevels: { ...s.higherLevels, [lg]: abbrevText(TX(s.higherLevels, lg), txLang(s.higherLevels, lg)) },
  };
}
function md(t) {
  return esc(t)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/\*([^*\n]+)\*/g, "<i>$1</i>");
}
function typeLine(s, lg) {
  if (lg === "en") {
    return s.level === 0 ? `${s.school.en} Cantrip` : `Level ${s.level} ${s.school.en}`;
  }
  const de = s.school.de || SCHOOL_DE[s.school.en] || s.school.en;
  return s.level === 0 ? (SCHOOL_TRICK[de] || `Zaubertrick der ${de}`)
                       : `${SCHOOL_ZAUBER[de] || de + "zauber"} ${s.level}. Grades`;
}
function classesLine(s, lg) { return (s.classes[lg] || []).join(", "); }

// compact range display: abbreviated units + grid squares
// DE: "45 Meter" -> "45 m (30 F)"   (1,5 m = 1 Feld)
// EN: "150 feet" -> "150 ft (30 sq)" (5 ft = 1 square)
function withSquares(r, lg) {
  if (!r) return r;
  if (lg === "de") {
    r = r.replace(/([\d.]+(?:,\d+)?)\s*Metern?\b/g, "$1 m");
    r = r.replace(/([\d.]+(?:,\d+)?)\s*Kilometern?\b/g, "$1 km");
    return r.replace(/([\d.]+(?:,\d+)?) m\b/g, (m, num) => {
      const n = parseFloat(num.replace(/\./g, "").replace(",", "."));
      const sq = n / 1.5;
      if (!isFinite(sq) || sq < 1 || Math.abs(sq - Math.round(sq)) > 0.01) return m;
      return m + ` (${Math.round(sq)} F)`;
    });
  }
  r = r.replace(/(\d+)[-\s]f(?:ee|oo)t\b/g, "$1 ft");
  r = r.replace(/(\d+) miles?\b/g, "$1 mi");
  return r.replace(/(\d+) ft(\s+\w+)?/g, (m, num, rest) => {
    const sq = +num / 5;
    if (sq < 1 || sq % 1) return m;
    return `${num} ft${rest || ""} (${sq} sq)`;
  });
}

function splitComponents(comp) {
  // "V, G, M (Material)" -> ["V, G, M", "Material"]
  const m = (comp || "").match(/^([^(]*?)\s*\((.*)\)\s*$/s);
  return m ? [m[1].trim(), m[2].trim()] : [(comp || "").trim(), ""];
}
