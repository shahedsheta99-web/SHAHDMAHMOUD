// =====================================================================
//  calc.js — every clinical equation used by the app lives here.
//  If you want to change a formula, this is the file to edit.
// =====================================================================
import { LMS } from './growth-data.js';

const r1 = (x) => Math.round(x * 10) / 10;
export const round = (x, d = 1) => (x == null || isNaN(x) ? null : Math.round(x * 10 ** d) / 10 ** d);
const num = (x) => (x === '' || x == null || isNaN(+x) ? null : +x);

// ---------- Age ----------
export function ageAt(dob, onDate) {
  if (!dob) return null;
  const b = new Date(dob), d = onDate ? new Date(onDate) : new Date();
  if (isNaN(b) || isNaN(d)) return null;
  const days = (d - b) / 86400000;
  const months = days / 30.4375;
  return { days, months, years: months / 12 };
}
export function ageText(a) {
  if (!a) return '—';
  if (a.months < 1) return `${Math.floor(a.days)} days`;
  if (a.years < 2) return `${Math.floor(a.months)} months`;
  const y = Math.floor(a.years), m = Math.floor(a.months - y * 12);
  return m ? `${y} y ${m} m` : `${y} y`;
}

// ---------- BMI ----------
export function bmi(weightKg, heightCm) {
  const w = num(weightKg), h = num(heightCm);
  if (!w || !h) return null;
  return w / (h / 100) ** 2;
}

// ---------- Ideal body weight ----------
//  Height <= 150 cm : IBW = (height cm × height cm × 1.65) / 1000   (your equation)
//  Height  > 150 cm : chosen method —
//     'bmi50'  : 50th percentile BMI-for-age (CDC) × height(m)²   [default]
//     'devine' : Male 50 kg / Female 45.5 kg + 2.3 kg per inch above 5 ft
export function ibw(heightCm, sex, ageMonths, tallMethod = 'bmi50') {
  const h = num(heightCm);
  if (!h) return null;
  if (h <= 150) return { value: (h * h * 1.65) / 1000, method: '(Ht² × 1.65) / 1000' };
  if (tallMethod === 'devine') {
    const inchesOver = (h / 2.54) - 60;
    const base = sex === 'F' ? 45.5 : 50;
    return { value: base + 2.3 * inchesOver, method: 'Devine (Ht > 150 cm)' };
  }
  const lms = lmsAt('bmiage', sex, Math.min(Math.max(ageMonths ?? 240, 24), 240));
  if (!lms) return null;
  return { value: lms.M * (h / 100) ** 2, method: '50th centile BMI-for-age × Ht² (Ht > 150 cm)' };
}

// ---------- Adjusted body weight ----------
//  AdjBW = IBW + factor × (Actual − IBW)   (factor default 0.25)
export function adjustedBW(actual, ideal, factor = 0.25) {
  const a = num(actual), i = num(ideal);
  if (!a || !i) return null;
  return i + factor * (a - i);
}

// ---------- Schofield equations (kcal/day) ----------
//  W = weight (kg), H = height (m)
const SCHOFIELD_W = {
  M: [[3, (W) => 59.512 * W - 30.4], [10, (W) => 22.706 * W + 504.3], [18, (W) => 17.686 * W + 658.2],
      [30, (W) => 15.057 * W + 692.2], [60, (W) => 11.472 * W + 873.1], [999, (W) => 11.711 * W + 587.7]],
  F: [[3, (W) => 58.317 * W - 31.1], [10, (W) => 20.315 * W + 485.9], [18, (W) => 13.384 * W + 692.6],
      [30, (W) => 14.818 * W + 486.6], [60, (W) => 8.126 * W + 845.6], [999, (W) => 9.082 * W + 658.5]],
};
const SCHOFIELD_WH = {
  M: [[3, (W, H) => 0.167 * W + 1517.4 * H - 617.6], [10, (W, H) => 19.59 * W + 130.3 * H + 414.9],
      [18, (W, H) => 16.25 * W + 137.2 * H + 515.5]],
  F: [[3, (W, H) => 16.252 * W + 1023.2 * H - 413.5], [10, (W, H) => 16.969 * W + 161.8 * H + 371.2],
      [18, (W, H) => 8.365 * W + 465 * H + 200]],
};
const SCH_TEXT = {
  W: { M: ['59.512W − 30.4', '22.706W + 504.3', '17.686W + 658.2', '15.057W + 692.2', '11.472W + 873.1', '11.711W + 587.7'],
       F: ['58.317W − 31.1', '20.315W + 485.9', '13.384W + 692.6', '14.818W + 486.6', '8.126W + 845.6', '9.082W + 658.5'] },
  WH: { M: ['0.167W + 1517.4H − 617.6', '19.59W + 130.3H + 414.9', '16.25W + 137.2H + 515.5'],
        F: ['16.252W + 1023.2H − 413.5', '16.969W + 161.8H + 371.2', '8.365W + 465H + 200'] },
};
const BANDS = ['0–3 y', '3–10 y', '10–18 y', '18–30 y', '30–60 y', '> 60 y'];

export function schofield(equation, sex, ageYears, weightKg, heightCm) {
  const W = num(weightKg), H = num(heightCm) ? num(heightCm) / 100 : null;
  if (!W || ageYears == null || !sex) return null;
  const s = sex === 'F' ? 'F' : 'M';
  if (equation === 'WH') {
    if (!H) return null;
    if (ageYears >= 18) return schofield('W', sex, ageYears, weightKg, heightCm); // WH only to 18 y
    const i = SCHOFIELD_WH[s].findIndex(([max]) => ageYears < max);
    return { value: SCHOFIELD_WH[s][i][1](W, H), text: `Schofield (W+H) ${BANDS[i]}: ${SCH_TEXT.WH[s][i]}` };
  }
  const i = SCHOFIELD_W[s].findIndex(([max]) => ageYears < max);
  return { value: SCHOFIELD_W[s][i][1](W), text: `Schofield (W) ${BANDS[i]}: ${SCH_TEXT.W[s][i]}` };
}

export const ACTIVITY_FACTORS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5];
export const STRESS_FACTORS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.95, 2.0, 2.25];

// ---------- Protein ----------
//  'aspen' (unit protocol, default):  < 1 y 2.5–3 g/kg · 1–10 y 1.5–2.5 g/kg · > 10 y 0.8–2 g/kg
//  'dri'  : DRI/RDA values for stable / healthy maintenance
export function driProtein(ageYears) {
  if (ageYears < 0.5) return 1.52;
  if (ageYears < 1) return 1.2;
  if (ageYears < 4) return 1.05;
  if (ageYears < 14) return 0.95;
  if (ageYears < 19) return 0.85;
  return 0.8;
}
export function proteinGuide(guideline, ageYears) {
  if (ageYears == null) return null;
  if (guideline === 'dri') { const d = driProtein(ageYears); return { min: d, max: d, label: 'DRI for age' }; }
  if (ageYears < 1) return { min: 2.5, max: 3, label: 'Age < 1 y' };
  if (ageYears <= 10) return { min: 1.5, max: 2.5, label: 'Age 1–10 y' };
  return { min: 0.8, max: 2, label: 'Age > 10 y' };
}

//  Protein restriction in renal impairment. Default ranges (editable in the app):
//   CKD stage 3      : 100–140 % of DRI for age (KDOQI pediatric CKD 2008)
//   CKD stage 4–5    : 100–120 % of DRI for age (KDOQI pediatric CKD 2008)
//   AKI / other renal: 100–120 % of DRI for age (starting point only; adjust to the clinical picture)
export const RENAL_OPTIONS = [
  ['none', 'No renal impairment'], ['aki', 'AKI'], ['ckd3', 'CKD stage 3'],
  ['ckd45', 'CKD stage 4–5'], ['other', 'Other renal impairment'],
];
const RENAL_FACTORS = { aki: [1, 1.2], ckd3: [1, 1.4], ckd45: [1, 1.2], other: [1, 1.2] };
export function renalDefault(renal, ageYears) {
  const f = RENAL_FACTORS[renal];
  if (!f || ageYears == null) return null;
  const d = driProtein(ageYears);
  return { min: +(d * f[0]).toFixed(2), max: +(d * f[1]).toFixed(2) };
}

// ---------- Fluid (Holliday–Segar) ----------
//  100 mL/kg for first 10 kg + 50 mL/kg for next 10 kg + 20 mL/kg for each kg above 20
export function hollidaySegar(weightKg) {
  const w = num(weightKg);
  if (!w) return null;
  let ml;
  if (w <= 10) ml = 100 * w;
  else if (w <= 20) ml = 1000 + 50 * (w - 10);
  else ml = 1500 + 20 * (w - 20);
  return ml;
}

// ---------- Choose which weight to use ----------
export const WEIGHT_OPTIONS = [
  ['actual', 'Actual weight'], ['ideal', 'Ideal BW'], ['adjusted', 'Adjusted BW'],
  ['usual', 'Usual / pre-illness wt'], ['custom', 'Custom weight'],
];
export function pickWeight(basis, w, custom) {
  if (basis === 'custom') return num(custom);
  return num(w[basis]);
}

// ---------- Run the full assessment ----------
export function computeAssessment(patient, a) {
  const age = ageAt(patient.dob, a.date);
  const ageY = age?.years, ageM = age?.months;
  const actual = num(a.weight), height = num(a.height);
  const ibwRes = num(a.ibwOverride) ? { value: num(a.ibwOverride), method: 'Manual entry' }
    : ibw(height, patient.sex, ageM, a.ibwTallMethod);
  const ideal = ibwRes?.value ?? null;
  const adjusted = adjustedBW(actual, ideal, num(a.adjFactor) ?? 0.25);
  const weights = { actual, ideal, adjusted, usual: num(a.usualWeight) };
  const b = bmi(actual, height);

  const e = a.energy || {}, p = a.protein || {}, f = a.fluid || {};
  // Energy
  const eW = pickWeight(e.weightBasis || 'actual', weights, e.customWeight);
  const ree = schofield(e.equation || 'W', patient.sex, ageY, eW, height);
  const act = (e.activity === 'custom' ? num(e.activityCustom) : num(e.activity)) ?? 1.0;
  const str = (e.stress === 'custom' ? num(e.stressCustom) : num(e.stress)) ?? 1.0;
  const teeCalc = ree ? ree.value * act * str : null;
  const tee = num(e.override) ?? teeCalc;
  // Protein
  const pW = pickWeight(p.weightBasis || 'actual', weights, p.customWeight);
  let guide = proteinGuide(p.guideline || 'aspen', ageY);
  const renal = p.renal && p.renal !== 'none' ? p.renal : null;
  if (renal && ageY != null) {
    const d = renalDefault(renal, ageY);
    const min = num(p.restrictMin) ?? d.min, max = num(p.restrictMax) ?? d.max;
    guide = { min, max, label: `Protein restriction: ${RENAL_OPTIONS.find((o) => o[0] === renal)[1]}`, renal: true };
  }
  const gkg = num(p.gPerKg) ?? guide?.max ?? null;
  const proteinCalc = pW && gkg ? pW * gkg : null;
  const protein = num(p.override) ?? proteinCalc;
  const pMin = pW && guide ? pW * guide.min : null, pMax = pW && guide ? pW * guide.max : null;
  const pStatus = gkg == null || !guide ? null : gkg < guide.min - 1e-9 ? 'below' : gkg > guide.max + 1e-9 ? 'above' : 'within';
  // Fluid
  const fW = pickWeight(f.weightBasis || 'actual', weights, f.customWeight);
  const hs = hollidaySegar(fW);
  const pct = num(f.percent) ?? 100;
  const fluidCalc = hs != null ? hs * pct / 100 : null;
  const fluid = num(f.override) ?? fluidCalc;

  return {
    age, ageY, ageM, weights, bmi: b, ibw: ibwRes,
    pctIBW: actual && ideal ? (actual / ideal) * 100 : null,
    wtChange: actual && num(a.usualWeight) ? ((actual - num(a.usualWeight)) / num(a.usualWeight)) * 100 : null,
    energy: { weight: eW, ree, activity: act, stress: str, teeCalc, tee, perKg: tee && eW ? tee / eW : null, overridden: num(e.override) != null },
    protein: { weight: pW, guide, gkg, calc: proteinCalc, value: protein, min: pMin, max: pMax, status: pStatus, renal, overridden: num(p.override) != null },
    fluid: { weight: fW, hs, percent: pct, calc: fluidCalc, value: fluid, perHour: fluid ? fluid / 24 : null, overridden: num(f.override) != null },
    z: growthZ(patient.sex, ageM, actual, height, b),
  };
}

// ---------- Growth: LMS, z-scores, centiles ----------
export function lmsAt(table, sex, ageMonths) {
  const rows = LMS[table]?.[sex === 'F' ? '2' : '1'];
  if (!rows || ageMonths == null) return null;
  if (ageMonths < rows[0][0] || ageMonths > rows[rows.length - 1][0]) return null;
  for (let i = 0; i < rows.length - 1; i++) {
    const [a0, L0, M0, S0] = rows[i], [a1, L1, M1, S1] = rows[i + 1];
    if (ageMonths >= a0 && ageMonths <= a1) {
      const t = a1 === a0 ? 0 : (ageMonths - a0) / (a1 - a0);
      return { L: L0 + t * (L1 - L0), M: M0 + t * (M1 - M0), S: S0 + t * (S1 - S0) };
    }
  }
  const last = rows[rows.length - 1];
  return { L: last[1], M: last[2], S: last[3] };
}
export function zScore(x, lms) {
  if (!lms || !x) return null;
  const { L, M, S } = lms;
  return Math.abs(L) < 1e-9 ? Math.log(x / M) / S : ((x / M) ** L - 1) / (L * S);
}
export function valueAtZ(z, lms) {
  const { L, M, S } = lms;
  return Math.abs(L) < 1e-9 ? M * Math.exp(S * z) : M * (1 + L * S * z) ** (1 / L);
}
export function normCdf(z) {
  // Abramowitz–Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
export const pctFromZ = (z) => (z == null ? null : normCdf(z) * 100);

export function weightTable(ageMonths) { return ageMonths != null && ageMonths < 24 ? 'wtageinf' : 'wtage'; }

export function growthZ(sex, ageM, w, h, b) {
  const res = {};
  const wl = lmsAt(weightTable(ageM), sex, ageM);
  const hl = lmsAt('statage', sex, ageM);
  const bl = lmsAt('bmiage', sex, ageM);
  res.wfa = wl && w ? zScore(w, wl) : null;
  res.hfa = hl && h ? zScore(h, hl) : null;
  res.bfa = bl && b ? zScore(b, bl) : null;
  return res;
}

// ---------- PYMS ----------
//  BMI cut-off table from the PYMS form (age in completed years 1–17)
export const PYMS_CUTOFF = {
  M: [15.0, 14.5, 14.0, 13.5, 13.5, 13.5, 13.5, 13.5, 13.5, 14.0, 14.0, 14.5, 15.0, 15.5, 16.0, 16.5, 17.0],
  F: [15.0, 14.0, 13.5, 13.5, 13.0, 13.0, 13.0, 13.0, 13.0, 13.5, 14.0, 14.5, 15.0, 15.5, 16.0, 16.5, 17.0],
};
export function pymsCutoff(sex, ageYears) {
  if (ageYears == null) return null;
  const y = Math.floor(ageYears);
  if (y < 1 || y > 17) return null;
  return PYMS_CUTOFF[sex === 'F' ? 'F' : 'M'][y - 1];
}
export function pymsRisk(total) {
  if (total == null) return null;
  if (total >= 2) return { label: 'High risk', cls: 'bad' };
  if (total === 1) return { label: 'Medium risk', cls: 'warn' };
  return { label: 'Low risk', cls: 'good' };
}

// ---------- Oncology nutrition risk factors (form in photo 1) ----------
export function oncologyRisk(r = {}, pctIBW, albumin) {
  let pts = 0;
  const ibwPts = pctIBW == null ? 0 : pctIBW > 90 ? 0 : pctIBW >= 81 ? 2 : 3;
  const wl = num(r.wtLoss1m);
  const wlPts = wl == null ? 0 : wl < 5 ? 0 : wl <= 10 ? 2 : 3;
  const alb = num(albumin);
  const albPts = alb == null ? 0 : alb > 3.5 ? 0 : alb >= 3.2 ? 2 : 3;
  pts += ibwPts + wlPts + albPts;
  const twoPt = ['lowIntake', 'surgeryGIT', 'radiationGIT', 'bmt', 'enteritis', 'gitProblem', 'growthCurve'];
  const onePt = ['wilms', 'neuroblastoma', 'metastatic', 'nhl', 'aml', 'all', 'brain'];
  twoPt.forEach((k) => { if (r[k]) pts += 2; });
  onePt.forEach((k) => { if (r[k]) pts += 1; });
  const cat = pts <= 1 ? { label: 'Low risk', cls: 'good' } : pts <= 3 ? { label: 'Moderate risk', cls: 'warn' } : { label: 'High risk', cls: 'bad' };
  return { pts, ibwPts, wlPts, albPts, cat };
}

export { r1, num };
