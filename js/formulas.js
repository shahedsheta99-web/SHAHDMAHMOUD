// =====================================================================
//  formulas.js — Oral nutrition supplements (ONS) from "Nutrition.pdf".
//  To add / change a product, edit this list (one line per product).
//    minAge / maxAge are in YEARS (maxAge: 99 = no upper limit)
//    scoops / volume = per serving (null when the PDF shows "-----")
//    kcal / protein  = per serving
//    type: 'complete' = can be used as main formula, 'module' = add-on (e.g. protein powder)
//  IV products are intentionally ignored for now.
// =====================================================================
export const FORMULAS = [
  { id: 'pediasure',     name: 'Pediasure',      age: '1–10 y',  minAge: 1,  maxAge: 10, scoops: 5,    volume: 200,  kcal: 225, protein: 6.7,  type: 'complete', note: '' },
  { id: 'gf',            name: 'G.F',            age: '1–12 y',  minAge: 1,  maxAge: 12, scoops: 2,    volume: 100,  kcal: 118, protein: 6.2,  type: 'complete', note: '' },
  { id: 'ensure',        name: 'Ensure',         age: '> 10 y',  minAge: 10, maxAge: 99, scoops: 6,    volume: 230,  kcal: 230, protein: 8.5,  type: 'complete', note: '' },
  { id: 'bioganers',     name: 'Bioganers',      age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: 2,    volume: 100,  kcal: 120, protein: 7,    type: 'complete', note: '' },
  { id: 'blendra',       name: 'Blendra',        age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: 6,    volume: 160,  kcal: 225, protein: 8.4,  type: 'complete', note: '' },
  { id: 'forticare',     name: 'Forticare',      age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 203, protein: 11,   type: 'complete', note: '' },
  { id: 'fortisip',      name: 'Fortisip',       age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 203, protein: 11,   type: 'complete', note: '' },
  { id: 'supportan',     name: 'Supportan',      age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 300, protein: 20,   type: 'complete', note: '' },
  { id: 'ferrusbin',     name: 'Ferrusbin',      age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: null, volume: null, kcal: 400, protein: 20,   type: 'complete', note: '' },
  { id: 'neomune',       name: 'Neomune',        age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: 7,    volume: 250,  kcal: 254, protein: 15.6, type: 'complete', note: '' },
  { id: 'aminoliban',    name: 'Aminoliban',     age: '> 3 y',   minAge: 3,  maxAge: 99, scoops: 5,    volume: 200,  kcal: 210, protein: 13.5, type: 'complete', note: '' },
  { id: 'peptaminjr',    name: 'Peptamen Jr.',   age: '1–10 y',  minAge: 1,  maxAge: 10, scoops: 7,    volume: 210,  kcal: 250, protein: 7,    type: 'complete', note: '' },
  { id: 'peptaminace',   name: 'Peptamen ACE',   age: '10–13 y', minAge: 10, maxAge: 13, scoops: 6,    volume: 210,  kcal: 242, protein: 9,    type: 'complete', note: '' },
  { id: 'peptamin',      name: 'Peptamen',       age: '> 13 y',  minAge: 13, maxAge: 99, scoops: 6,    volume: 210,  kcal: 250, protein: 10,   type: 'complete', note: '' },
  { id: 'ferrusbinpd',   name: 'Ferrusbin pd.',  age: '> 1 y',   minAge: 1,  maxAge: 99, scoops: 2,    volume: 100,  kcal: 54,  protein: 13.2, type: 'module',   note: 'Protein powder – use as add-on' },
];

export const formulaById = (id) => FORMULAS.find((f) => f.id === id);
export const fitsAge = (f, ageY) => ageY != null && ageY >= f.minAge && ageY <= f.maxAge;

// How much of a product supplies the energy target, and how close the protein is.
export function evaluateFormula(f, kcalTarget, proteinTarget) {
  if (!kcalTarget) return null;
  const servings = kcalTarget / f.kcal;
  const protein = servings * f.protein;
  return {
    servings,
    scoops: f.scoops ? servings * f.scoops : null,
    volume: f.volume ? servings * f.volume : null,
    protein,
    proteinPct: proteinTarget ? (protein / proteinTarget) * 100 : null,
    density: (f.protein / f.kcal) * 100, // g protein per 100 kcal
  };
}

// Rank age-appropriate complete formulas: the one whose protein (when energy
// needs are fully met) is closest to the protein requirement comes first.
export function recommendFormulas(ageY, kcalTarget, proteinTarget) {
  return FORMULAS.filter((f) => f.type === 'complete' && fitsAge(f, ageY))
    .map((f) => ({ f, ev: evaluateFormula(f, kcalTarget, proteinTarget) }))
    .filter((x) => x.ev)
    .sort((a, b) => Math.abs((a.ev.proteinPct ?? 100) - 100) - Math.abs((b.ev.proteinPct ?? 100) - 100));
}

// Totals for a regimen made of several products [{id, servings}]
export function regimenTotals(items = []) {
  let kcal = 0, protein = 0, volume = 0, scoops = 0;
  items.forEach((it) => {
    const f = formulaById(it.id); const s = +it.servings || 0;
    if (!f || !s) return;
    kcal += f.kcal * s; protein += f.protein * s;
    if (f.volume) volume += f.volume * s;
    if (f.scoops) scoops += f.scoops * s;
  });
  return { kcal, protein, volume, scoops };
}
