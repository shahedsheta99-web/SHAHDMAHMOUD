// =====================================================================
//  charts.js — draws growth charts (CDC centile curves) and small trend
//  lines as SVG. No external libraries, so it works offline and prints well.
// =====================================================================
import { LMS } from './growth-data.js';
import { lmsAt, valueAtZ } from './calc.js';

const CENTILES = [[3, -1.8808], [5, -1.6449], [10, -1.2816], [25, -0.6745], [50, 0], [75, 0.6745], [90, 1.2816], [95, 1.6449], [97, 1.8808]];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function niceStep(range, target = 8) {
  const raw = range / target, p = 10 ** Math.floor(Math.log10(raw)), n = raw / p;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * p;
}

export function growthChart({ table, sex, title, unit, points = [], width = 720, height = 440 }) {
  const rows = LMS[table]?.[sex === 'F' ? '2' : '1'];
  if (!rows) return '<p class="muted">No chart data.</p>';
  const xMin = rows[0][0], xMax = rows[rows.length - 1][0];
  const infant = xMax <= 36;
  const ages = rows.map((r) => r[0]);
  const curves = CENTILES.map(([c, z]) => ({ c, pts: ages.map((a) => [a, valueAtZ(z, lmsAt(table, sex, a))]) }));
  const inRange = points.filter((p) => p.ageM >= xMin && p.ageM <= xMax && p.value);
  let yMin = Math.min(...curves[0].pts.map((p) => p[1]), ...inRange.map((p) => p.value));
  let yMax = Math.max(...curves[8].pts.map((p) => p[1]), ...inRange.map((p) => p.value));
  const yStep = niceStep(yMax - yMin);
  yMin = Math.floor(yMin / yStep) * yStep; yMax = Math.ceil(yMax / yStep) * yStep;

  const m = { l: 48, r: 40, t: 34, b: 40 };
  const W = width - m.l - m.r, H = height - m.t - m.b;
  const X = (a) => m.l + ((a - xMin) / (xMax - xMin)) * W;
  const Y = (v) => m.t + H - ((v - yMin) / (yMax - yMin)) * H;
  let s = `<svg class="gchart" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">`;
  s += `<text x="${m.l}" y="20" class="gc-title">${esc(title)} — ${sex === 'F' ? 'Girls' : 'Boys'} (CDC)</text>`;
  // grid
  for (let v = yMin; v <= yMax + 1e-9; v += yStep) {
    s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(v)}" y2="${Y(v)}" class="gc-grid"/><text x="${m.l - 6}" y="${Y(v) + 4}" class="gc-ax" text-anchor="end">${+v.toFixed(1)}</text>`;
  }
  const xStep = infant ? 3 : 12;
  for (let a = Math.ceil(xMin / xStep) * xStep; a <= xMax; a += xStep) {
    s += `<line y1="${m.t}" y2="${m.t + H}" x1="${X(a)}" x2="${X(a)}" class="gc-grid"/><text x="${X(a)}" y="${m.t + H + 16}" class="gc-ax" text-anchor="middle">${infant ? a : a / 12}</text>`;
  }
  s += `<text x="${m.l + W / 2}" y="${height - 6}" class="gc-ax" text-anchor="middle">Age (${infant ? 'months' : 'years'})</text>`;
  s += `<text x="14" y="${m.t + H / 2}" class="gc-ax" text-anchor="middle" transform="rotate(-90 14 ${m.t + H / 2})">${esc(unit)}</text>`;
  // centile curves
  curves.forEach(({ c, pts }) => {
    const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join('');
    const cls = c === 50 ? 'gc-p50' : (c === 3 || c === 97) ? 'gc-pext' : 'gc-p';
    s += `<path d="${d}" class="${cls}"/><text x="${X(xMax) + 4}" y="${Y(pts[pts.length - 1][1]) + 3}" class="gc-lab">${c}</text>`;
  });
  // patient points
  const sorted = inRange.slice().sort((a, b) => a.ageM - b.ageM);
  if (sorted.length > 1) s += `<path d="${sorted.map((p, i) => `${i ? 'L' : 'M'}${X(p.ageM)},${Y(p.value)}`).join('')}" class="gc-pline"/>`;
  sorted.forEach((p) => { s += `<circle cx="${X(p.ageM)}" cy="${Y(p.value)}" r="4.5" class="gc-pt"><title>${esc(p.label || '')}: ${p.value} ${esc(unit)}</title></circle>`; });
  s += '</svg>';
  if (points.length && !inRange.length) s += '<p class="muted small">Patient measurements are outside the age range of this chart.</p>';
  return s;
}

// Simple line chart for trends (e.g. PYMS score, weight).
export function trendChart({ title, points, yMinFixed, yMaxFixed, width = 520, height = 200, unit = '' }) {
  const pts = points.filter((p) => p.y != null && !isNaN(p.y));
  if (!pts.length) return '';
  const m = { l: 40, r: 16, t: 28, b: 34 }, W = width - m.l - m.r, H = height - m.t - m.b;
  let yMin = yMinFixed ?? Math.min(...pts.map((p) => p.y)), yMax = yMaxFixed ?? Math.max(...pts.map((p) => p.y));
  if (yMin === yMax) { yMin -= 1; yMax += 1; }
  const n = pts.length;
  const X = (i) => m.l + (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const Y = (v) => m.t + H - ((v - yMin) / (yMax - yMin)) * H;
  const step = niceStep(yMax - yMin, 4);
  let s = `<svg class="tchart" viewBox="0 0 ${width} ${height}"><text x="${m.l}" y="18" class="gc-title">${esc(title)}</text>`;
  for (let v = Math.ceil(yMin / step) * step; v <= yMax + 1e-9; v += step) s += `<line x1="${m.l}" x2="${m.l + W}" y1="${Y(v)}" y2="${Y(v)}" class="gc-grid"/><text x="${m.l - 6}" y="${Y(v) + 4}" class="gc-ax" text-anchor="end">${+v.toFixed(1)}</text>`;
  s += `<path d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(i)},${Y(p.y)}`).join('')}" class="gc-pline"/>`;
  pts.forEach((p, i) => { s += `<circle cx="${X(i)}" cy="${Y(p.y)}" r="4" class="gc-pt"><title>${esc(p.x)}: ${p.y}${unit}</title></circle><text x="${X(i)}" y="${m.t + H + 16}" class="gc-ax" text-anchor="middle">${esc(p.x)}</text>`; });
  return s + '</svg>';
}
