// =====================================================================
//  labs.js — lab tests shown on the follow-up sheet.
//  [key, label, unit, low, high]  (null = no reference limit / not flagged)
//  Ranges are copied from the bottom of your follow-up sheet. Mg, blood gas
//  and protein ranges are standard values added by the app; edit as needed.
// =====================================================================
export const LABS = [
  ['na', 'Na', 'mEq/L', 130, 150],
  ['k', 'K', 'mEq/L', 3.5, 5],
  ['tca', 'T.Ca', 'mg/dL', 8.2, 10.4],
  ['ica', 'I.Ca', 'mmol/L', null, null],
  ['mg', 'Mg', 'mg/dL', 1.7, 2.4],
  ['po4', 'PO4', 'mg/dL', 2.7, 4.5],
  ['tbil', 'T.Bil', 'mg/dL', 0, 1.2],
  ['dbil', 'D.Bil', 'mg/dL', 0, 0.3],
  ['idbil', 'ID.Bil', 'mg/dL', 0, 0.9],
  ['uric', 'Uric acid', 'mg/dL', null, null],
  ['alt', 'ALT', 'U/L', 0, 41],
  ['ast', 'AST', 'U/L', 0, 40],
  ['urea', 'Urea', 'mg/dL', 0, 50],
  ['creat', 'Creat.', 'mg/dL', 0.7, 1.2],
  ['gfr', 'GFR', 'mL/min', null, null],
  ['alb', 'Albumin', 'g/dL', 3.5, 5.2],
  ['tp', 'T. protein', 'g/dL', null, null],
  ['tg', 'Triglycerides', 'mg/dL', null, 400],
  ['crp', 'CRP', 'mg/L', 0, 5],
  ['tlc', 'TLC', '×10⁹/L', 4.2, 9],
  ['hb', 'Hb', 'g/dL', 13.7, 17.5],
  ['plt', 'Plt', '×10⁹/L', 182, 369],
  ['bglu', 'Blood glucose', 'mg/dL', 70, 140],
  ['lipase', 'Lipase', 'U/L', 40, 140],
  ['amylase', 'Amylase', 'U/L', 24, 400],
  ['ph', 'pH', '', 7.35, 7.45],
  ['pco2', 'pCO2', 'mmHg', 35, 45],
  ['hco3', 'HCO3', 'mEq/L', 22, 26],
];

export function labFlag(key, value) {
  const def = LABS.find((l) => l[0] === key);
  if (!def || value === '' || value == null || isNaN(+value)) return '';
  const [, , , lo, hi] = def;
  if (lo != null && +value < lo) return 'low';
  if (hi != null && +value > hi) return 'high';
  return '';
}
