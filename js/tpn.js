// =====================================================================
//  tpn.js — Parenteral nutrition (TPN) calculations.
//  Ranges: ASPEN "Appropriate Parenteral Nutrition Dosing for Neonatal and
//  Pediatric Patients" (Tables 5–8). Product concentrations follow your
//  Clinical Pharmacy Pediatric Oncology NST order form (all editable).
// =====================================================================

// ---- Table 5: macronutrients. [min, max]; "max" = absolute maximum ----
export const MACRO = {
  preterm: { label: 'Preterm infant (< 1 y)',
    protein: { init: [1, 3], goal: [3, 4], max: 4 },
    gir: { init: [6, 8], adv: [1, 2], goal: [10, 14], max: 18 },
    lipid: { init: [0.5, 1], adv: [0.5, 1], goal: [3, 3] } },
  term: { label: 'Term infant (< 1 y)',
    protein: { init: [2.5, 3], goal: [2.5, 3] },
    gir: { init: [6, 8], adv: [1, 2], goal: [10, 14], max: 18 },
    lipid: { init: [0.5, 1], adv: [0.5, 1], goal: [2.5, 3] } },
  child: { label: 'Child (1–10 y)',
    protein: { init: [1.5, 2.5], goal: [1.5, 2.5] },
    gir: { init: [3, 6], adv: [1, 2], goal: [8, 10] },
    lipid: { init: [1, 2], adv: [0.5, 1], goal: [2, 2.5] } },
  adolescent: { label: 'Adolescent (> 10 y)',
    protein: { init: [0.8, 2], goal: [0.8, 2] },
    gir: { init: [2.5, 3], adv: [1, 2], goal: [5, 6] },
    lipid: { init: [1, 1], adv: [1, 1], goal: [1, 2] } },
};
export const LIPID_MAX_RATE = 0.15; // g/kg/h (infants)

// ---- Table 6: electrolytes per kg/day (big = adolescents & children > 50 kg: Ca/P/Mg per DAY) ----
export const LYTES = {
  preterm: { na: [2, 5], k: [2, 4], ca: [2, 4], p: [1, 2], mg: [0.3, 0.5] },
  infantChild: { na: [2, 5], k: [2, 4], ca: [0.5, 4], p: [0.5, 2], mg: [0.3, 0.5] },
  big: { na: [1, 2], k: [1, 2], caDay: [10, 20], pDay: [10, 40], mgDay: [10, 30] },
};
export const LYTE_INFO = [
  ['na', 'Sodium', 'mEq'], ['k', 'Potassium', 'mEq'], ['ca', 'Calcium', 'mEq'], ['p', 'Phosphorus', 'mmol'], ['mg', 'Magnesium', 'mEq'],
];

// ---- Products (concentrations editable per order) ----
export const AA_PRODUCTS = [
  ['amiparen', 'Amiparen 10%', 10], ['aminoven', 'Aminoven 10%', 10], ['aminoveninf', 'Aminoven Infant 10%', 10],
  ['nephrosteril', 'Nephrosteril 7%', 7], ['nhepa', 'N-Hepa 8%', 8], ['kidmin', 'Kidmin 7.2%', 7.2], ['aminoleban', 'Aminoleban 8%', 8],
];
export const LIPID_PRODUCTS = [['smof', 'SMOFlipid 20%', 20]];
export const DEX_STOCKS = [5, 10, 20, 25, 50];
export const DEFAULT_CONC = {
  nacl: 0.155,   // mEq/mL (155 mEq/L, as on the order form)
  kcl: 2,        // mEq/mL (10 mEq/5 mL)
  glycoP: 1,     // mmol P/mL (Glycophos)
  glycoNa: 1.3,  // mEq Na/mL (as written on the order form — check your product label)
  mgso4: 0.81,   // mEq/mL
  cagluc: 0.45,  // mEq/mL (Ca gluconate 10%)
  dipeptiven: 20,// g/100 mL
  lipidKcal: 10, // kcal per g of 20% emulsion (ASPEN: 2 kcal/mL); your sheet used 9
};

// ---- Tables 7 & 8: vitamins and trace elements (reference) ----
export function mviRef(w) { return w < 1 ? 1.5 : w < 3 ? 3.25 : 5; }
export function traceRef(w, preterm) {
  if (preterm) return { label: 'Preterm neonate', zn: '400 mcg/kg', cu: '20 mcg/kg', mn: '1 mcg/kg', cr: '0.05–0.3 mcg/kg', se: '2 mcg/kg', calc: { zn: 400 * w, cu: 20 * w, mn: w, se: 2 * w } };
  if (w < 10) return { label: 'Term neonate / infant 3–10 kg', zn: '250 mcg/kg', cu: '20 mcg/kg', mn: '1 mcg/kg', cr: '0.2 mcg/kg', se: '2 mcg/kg', calc: { zn: 250 * w, cu: 20 * w, mn: w, se: 2 * w } };
  if (w <= 40) return { label: 'Child 10–40 kg', zn: '50 mcg/kg (max 5000 mcg/d)', cu: '20 mcg/kg (max 500 mcg/d)', mn: '1 mcg/kg (max 55 mcg/d)', cr: '0.2 mcg/kg (max 5 mcg/d)', se: '2 mcg/kg (max 100 mcg/d)',
    calc: { zn: Math.min(50 * w, 5000), cu: Math.min(20 * w, 500), mn: Math.min(w, 55), se: Math.min(2 * w, 100) } };
  return { label: 'Adolescent > 40 kg', zn: '2–5 mg/d', cu: '200–500 mcg/d', mn: '40–100 mcg/d', cr: '5–15 mcg/d', se: '40–60 mcg/d', calc: null };
}

// ---- Patient group ----
export function tpnGroup(ageY, preterm) {
  if (ageY == null) return null;
  if (ageY < 1) return preterm ? 'preterm' : 'term';
  return ageY <= 10 ? 'child' : 'adolescent';
}
export function lyteGroup(ageY, w, preterm) {
  if (w > 50) return 'big';
  if (ageY != null && ageY < 1 && preterm) return 'preterm';
  return 'infantChild';
}
// Range for a stage: init / adv (between init and goal) / goal
export function stageRange(r, stage) {
  if (!r) return null;
  if (stage === 'init') return r.init;
  if (stage === 'adv') return [r.init[0], r.goal[1]];
  return r.goal;
}
// Electrolyte range per kg for this patient (big group Ca/P/Mg given per day → per kg)
export function lyteRange(key, lg, w) {
  const t = LYTES[lg];
  if (t[key]) return { perKg: t[key], text: `${t[key][0]}–${t[key][1]} per kg` };
  const d = t[key + 'Day'];
  return { perKg: w ? [d[0] / w, d[1] / w] : null, text: `${d[0]}–${d[1]} per day` };
}

const n = (x) => (x === '' || x == null || isNaN(+x) ? null : +x);

// Suggested starting values (lab-aware): high lab → 0, low lab → top of range, else bottom of range.
export function suggestLytes(lg, w, labStatus = {}) {
  const out = {};
  ['na', 'k', 'ca', 'p', 'mg'].forEach((k) => {
    const r = lyteRange(k, lg, w).perKg;
    if (!r) return;
    out[k] = labStatus[k] === 'high' ? 0 : labStatus[k] === 'low' ? +r[1].toFixed(2) : +r[0].toFixed(2);
  });
  return out;
}

// ---- Main calculation ----
//  t = order inputs, ctx = { w, ageY, tee, maintenance, labs: {key:{v}}, labFlag }
export function computeTPN(t, ctx) {
  const w = ctx.w, ageY = ctx.ageY;
  const conc = { ...DEFAULT_CONC, ...(t.conc || {}) };
  Object.keys(conc).forEach((k) => { conc[k] = n(conc[k]) ?? DEFAULT_CONC[k]; });
  const g = tpnGroup(ageY, t.preterm), lg = lyteGroup(ageY, w, t.preterm);
  const macro = g ? MACRO[g] : null, stage = t.stage || 'goal';
  const hours = n(t.hours) || 24;
  const res = { w, g, lg, macro, stage, hours, conc, warnings: [], errors: [] };
  if (!w || !macro) { res.errors.push('Enter the date of birth and a weight to calculate.'); return res; }

  // Energy target
  const tee = n(t.tee) ?? ctx.tee;
  const pct = n(t.teePct);
  res.tee = tee; res.pct = pct;
  res.target = tee && pct ? tee * pct / 100 : null;

  // Protein (amino acids)
  const aa = AA_PRODUCTS.find((x) => x[0] === t.aaProduct) || AA_PRODUCTS[0];
  const aaConc = n(t.aaConc) ?? aa[2];
  res.aa = { name: aa[1], conc: aaConc, gkg: n(t.proteinGkg) ?? 0 };
  res.aa.g = res.aa.gkg * w; res.aa.ml = res.aa.g / (aaConc / 100);
  res.glut = t.glutamine ? { gkg: n(t.glutGkg) ?? 0.3 } : null;
  if (res.glut) { res.glut.g = res.glut.gkg * w; res.glut.ml = res.glut.g / (conc.dipeptiven / 100); }
  const proteinG = res.aa.g + (res.glut?.g || 0);
  res.proteinKcal = proteinG * 4;

  // Lipid
  const lp = LIPID_PRODUCTS.find((x) => x[0] === t.lipidProduct) || LIPID_PRODUCTS[0];
  res.lipid = { name: lp[1], conc: lp[2], gkg: n(t.lipidGkg) ?? 0 };
  res.lipid.g = res.lipid.gkg * w; res.lipid.ml = res.lipid.g / (lp[2] / 100);
  res.lipid.kcal = res.lipid.g * conc.lipidKcal;
  res.lipid.inBag = t.lipidInBag !== 'separate';
  res.lipid.rate = res.lipid.g / w / hours; // g/kg/h

  // Dextrose: fills the rest of the energy target, or set by GIR
  let dexG;
  if (t.dexMode === 'gir') dexG = (n(t.gir) || 0) * w * hours * 60 / 1000;
  else dexG = res.target ? Math.max(0, (res.target - res.proteinKcal - res.lipid.kcal) / 3.4) : 0;
  res.dex = { g: dexG, kcal: dexG * 3.4, gir: dexG * 1000 / (w * hours * 60) };
  if (t.dexMode !== 'gir' && res.target && res.target - res.proteinKcal - res.lipid.kcal < 0)
    res.errors.push('Protein + lipid already give more energy than the target. Lower them or raise the % of TEE.');

  // Electrolytes
  const L = {}; ['na', 'k', 'ca', 'p', 'mg'].forEach((k) => { L[k] = n(t.lytes?.[k]) ?? 0; });
  res.lytes = {};
  ['na', 'k', 'ca', 'p', 'mg'].forEach((k) => { res.lytes[k] = { perKg: L[k], day: L[k] * w, range: lyteRange(k, lg, w) }; });
  const pMl = res.lytes.p.day / conc.glycoP;
  const naFromGlyco = pMl * conc.glycoNa;
  const naclMeq = Math.max(0, res.lytes.na.day - naFromGlyco);
  if (naFromGlyco > res.lytes.na.day + 0.01 && res.lytes.p.day > 0) res.warnings.push(['warn', `Glycophos alone gives ${naFromGlyco.toFixed(1)} mEq Na, more than the ${res.lytes.na.day.toFixed(1)} mEq Na ordered.`]);
  res.add = [
    { key: 'nacl', name: 'NaCl', amount: naclMeq, unit: 'mEq', ml: naclMeq / conc.nacl, conc: `${conc.nacl * 1000} mEq/L` },
    { key: 'kcl', name: 'KCl', amount: res.lytes.k.day, unit: 'mEq', ml: res.lytes.k.day / conc.kcl, conc: `${conc.kcl} mEq/mL` },
    { key: 'glyco', name: 'Na PO4 (Glycophos)', amount: res.lytes.p.day, unit: 'mmol', ml: pMl, conc: `${conc.glycoP} mmol P/mL (Na ${conc.glycoNa})` },
    { key: 'mgso4', name: 'MgSO4', amount: res.lytes.mg.day, unit: 'mEq', ml: res.lytes.mg.day / conc.mgso4, conc: `${conc.mgso4} mEq/mL` },
    { key: 'cagluc', name: 'Ca gluconate', amount: res.lytes.ca.day, unit: 'mEq', ml: res.lytes.ca.day / conc.cagluc, conc: `${conc.cagluc} mEq/mL` },
  ];
  // Vitamins & trace elements (local products, mL/day)
  res.vit = [
    { key: 'soluvit', name: 'Soluvit N', ml: n(t.soluvit) ?? 0 },
    { key: 'vitalipid', name: 'Vitalipid N', ml: n(t.vitalipid) ?? 0 },
    { key: 'addamel', name: 'Addamel N', ml: n(t.addamel) ?? 0 },
  ];

  // Volume
  const volTarget = n(t.volume) ?? ctx.maintenance;
  res.volTarget = volTarget;
  const fixed = res.aa.ml + (res.glut?.ml || 0) + res.add.reduce((s, a) => s + a.ml, 0) + res.vit.reduce((s, v) => s + v.ml, 0) + (res.lipid.inBag ? res.lipid.ml : 0);
  const avail = (volTarget || 0) - fixed;
  let stock = t.dexStock && t.dexStock !== 'auto' ? +t.dexStock : null;
  if (!stock) stock = DEX_STOCKS.find((c) => dexG / (c / 100) <= avail + 1e-9) || 50;
  res.dex.stock = stock; res.dex.ml = dexG / (stock / 100);
  res.swfi = avail - res.dex.ml;
  if (res.swfi < -0.5) res.errors.push(`The volume is ${Math.ceil(-res.swfi)} mL too small for this order. Increase the volume, choose a stronger dextrose stock, or lower the doses.`);
  res.swfi = Math.max(0, res.swfi);
  res.bagVol = fixed - (res.lipid.inBag ? 0 : 0) + res.dex.ml + res.swfi; // main bag (includes lipid when in bag)
  res.finalVol = res.bagVol + (res.lipid.inBag ? 0 : res.lipid.ml);
  res.rate = res.bagVol / hours;
  res.lipidRate = res.lipid.inBag ? null : res.lipid.ml / hours;
  const bags = Math.max(1, Math.round(n(t.bags) || 1));
  res.bags = bags;

  // Energy summary
  res.totalKcal = res.proteinKcal + res.dex.kcal + res.lipid.kcal;
  res.pctTEE = tee ? res.totalKcal / tee * 100 : null;
  const N = proteinG / 6.25;
  res.npcN = N ? (res.dex.kcal + res.lipid.kcal) / N : null;
  res.dexN = N ? res.dex.kcal / N : null;
  res.kcalPerKg = res.totalKcal / w;

  // Osmolarity (your sheet's method): AA g×10 + dextrose g×5 + lipid g×1.3 (if in bag) + (Na+K+Ca+Mg mEq + P mmol)×2
  const lyteSum = res.lytes.na.day + res.lytes.k.day + res.lytes.ca.day + res.lytes.mg.day + res.lytes.p.day;
  const osm = proteinG * 10 + dexG * 5 + (res.lipid.inBag ? res.lipid.g * 1.3 : 0) + lyteSum * 2;
  res.osmolarity = res.bagVol ? osm / (res.bagVol / 1000) : null;
  const aqVol = res.bagVol - (res.lipid.inBag ? res.lipid.ml : 0);
  res.dexConcFinal = aqVol ? dexG / aqVol * 100 : null;
  res.caConc = aqVol ? res.lytes.ca.day / (aqVol / 1000) : null; // mEq/L
  res.pConc = aqVol ? res.lytes.p.day / (aqVol / 1000) : null;   // mmol/L
  res.line = res.osmolarity > 900 || res.dexConcFinal > 12.5 ? 'central' : 'peripheral';

  // ---- Range checks (ASPEN) ----
  const chk = (val, r, label, unit) => {
    if (!r || val == null) return;
    if (val < r[0] - 1e-9) res.warnings.push(['warn', `${label} ${val.toFixed(2)} ${unit} is below the ASPEN range (${r[0]}–${r[1]}).`]);
    else if (val > r[1] + 1e-9) res.warnings.push(['bad', `${label} ${val.toFixed(2)} ${unit} is above the ASPEN range (${r[0]}–${r[1]}).`]);
  };
  res.ranges = { protein: stageRange(macro.protein, stage), gir: stageRange(macro.gir, stage), lipid: stageRange(macro.lipid, stage) };
  chk(proteinG / w, res.ranges.protein, 'Protein', 'g/kg/day');
  chk(res.dex.gir, res.ranges.gir, 'GIR', 'mg/kg/min');
  chk(res.lipid.gkg, res.ranges.lipid, 'Lipid', 'g/kg/day');
  if (macro.gir.max && res.dex.gir > macro.gir.max) res.warnings.push(['bad', `GIR is above the absolute maximum of ${macro.gir.max} mg/kg/min.`]);
  if ((g === 'preterm' || g === 'term') && res.lipid.rate > LIPID_MAX_RATE) res.warnings.push(['bad', `Lipid rate ${res.lipid.rate.toFixed(3)} g/kg/h is above the maximum 0.15 g/kg/h.`]);
  ['na', 'k', 'ca', 'p', 'mg'].forEach((k) => {
    const r = res.lytes[k].range.perKg; const info = LYTE_INFO.find((x) => x[0] === k);
    if (r && res.lytes[k].perKg > r[1] + 1e-9) res.warnings.push(['warn', `${info[1]} ${res.lytes[k].perKg} ${info[2]}/kg is above the ASPEN range (${res.lytes[k].range.text}).`]);
  });
  if (volTarget && ctx.maintenance) res.volPct = volTarget / ctx.maintenance * 100;
  if (res.volPct > 120) res.warnings.push(['warn', `TPN volume is ${res.volPct.toFixed(0)}% of maintenance fluid (${Math.round(ctx.maintenance)} mL).`]);
  if (res.osmolarity > 900) res.warnings.push(['bad', `Osmolarity ${res.osmolarity.toFixed(0)} mOsm/L is above 900: give through a CENTRAL line.`]);
  if (res.dexConcFinal > 12.5) res.warnings.push(['bad', `Final dextrose ${res.dexConcFinal.toFixed(1)}% is above 12.5%: give through a CENTRAL line.`]);
  res.warnings.push(['warn', 'Use caution with calcium and phosphate together (compatibility): check with pharmacy.']);

  // ---- Lab-based warnings ----
  const labs = ctx.labs || {}, flag = ctx.labFlag;
  const lab = (k) => (labs[k] ? { v: labs[k].v, f: flag(k, labs[k].v) } : null);
  const map = [['na', 'na', 'Sodium'], ['k', 'k', 'Potassium'], ['tca', 'ca', 'Calcium'], ['po4', 'p', 'Phosphate'], ['mg', 'mg', 'Magnesium']];
  map.forEach(([lk, key, name]) => {
    const l = lab(lk); if (!l?.f) return;
    const dose = res.lytes[key].perKg;
    if (l.f === 'high' && dose > 0) res.warnings.unshift(['bad', `${name} is HIGH in the labs (${l.v}) but ${dose} per kg is ordered. Consider reducing or removing it.`]);
    if (l.f === 'low') res.warnings.unshift(['warn', `${name} is LOW in the labs (${l.v}). Consider the upper part of the range (${res.lytes[key].range.text}) or a correction dose.`]);
  });
  const tg = lab('tg'); if (tg?.f === 'high' && res.lipid.gkg > 0) res.warnings.unshift(['bad', `Triglycerides are HIGH (${tg.v} mg/dL). ASPEN: reduce the lipid dose when TG > 400 mg/dL.`]);
  const glu = lab('bglu'); if (glu?.f === 'high') res.warnings.unshift(['bad', `Blood glucose is HIGH (${glu.v} mg/dL). Consider lowering the GIR or starting insulin per protocol.`]);
  if (glu?.f === 'low') res.warnings.unshift(['warn', `Blood glucose is LOW (${glu.v} mg/dL). Consider raising the GIR.`]);
  const ur = lab('urea'), cr = lab('creat');
  if (ur?.f === 'high' || cr?.f === 'high') res.warnings.unshift(['warn', 'Urea / creatinine are HIGH: review the protein dose, fluid volume and K, P and Mg.']);
  const db = lab('dbil'); if (db?.f === 'high') res.warnings.unshift(['warn', `Direct bilirubin is HIGH (${db.v}): watch for PN-associated cholestasis (lipid dose, manganese and copper).`]);
  return res;
}
