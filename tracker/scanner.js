// =====================================================================
//  scanner.js — meal scanners.
//   1. Barcode scanner  : camera → barcode → Open Food Facts (free, no key).
//   2. AI photo scanner : photo (or a short description) → Claude estimates
//                          each food, grams, calories and macros.
//                          Needs your own Anthropic API key (Settings).
// =====================================================================

// ---------- Barcode ----------
const ZXING = 'https://cdn.jsdelivr.net/npm/@zxing/browser@0.1.5/+esm';

// Starts the camera inside `video` and resolves with the first barcode read.
// Returns { promise, stop }.
export function scanBarcode(video) {
  let stopped = false, stream = null, controls = null, raf = 0;
  const stop = () => {
    stopped = true; cancelAnimationFrame(raf);
    try { controls && controls.stop(); } catch {}
    if (stream) stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
  };
  const promise = (async () => {
    if ('BarcodeDetector' in window) {
      // Native detector (Chrome on Android, some desktops): fast and offline.
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream; await video.play();
      return await new Promise((res, rej) => {
        const tick = async () => {
          if (stopped) return rej(new Error('stopped'));
          try { const r = await det.detect(video); if (r.length) { stop(); return res(r[0].rawValue); } } catch {}
          raf = requestAnimationFrame(tick);
        };
        tick();
      });
    }
    // Fallback (iPhone Safari, Firefox): ZXing library from the CDN.
    const { BrowserMultiFormatReader } = await import(ZXING);
    const reader = new BrowserMultiFormatReader();
    return await new Promise((res, rej) => {
      reader.decodeFromVideoDevice(undefined, video, (result, err, c) => {
        controls = c;
        if (stopped) { try { c.stop(); } catch {} return rej(new Error('stopped')); }
        if (result) { stop(); res(result.getText()); }
      }).then((c) => { controls = c; if (stopped) c.stop(); }).catch(rej);
    });
  })();
  return { promise, stop };
}

// Look a barcode up in Open Food Facts. Returns a food object or null.
export async function lookupBarcode(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_ar,brands,nutriments,serving_size,serving_quantity`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.status !== 1 || !j.product) return null;
  const p = j.product, n = p.nutriments || {};
  const per100 = {
    kcal: +(n['energy-kcal_100g'] ?? (n.energy_100g ? n.energy_100g / 4.184 : 0)) || 0,
    p: +n.proteins_100g || 0, c: +n.carbohydrates_100g || 0, f: +n.fat_100g || 0,
  };
  const g = +p.serving_quantity || 100;
  const k = g / 100;
  return {
    id: 'bc-' + code,
    name: [p.product_name || 'Product ' + code, p.brands ? `(${p.brands.split(',')[0]})` : ''].join(' ').trim(),
    ar: p.product_name_ar || '',
    region: 'basic', cat: 'Scanned products',
    serving: p.serving_size || '100 g', g,
    kcal: Math.round(per100.kcal * k), p: +(per100.p * k).toFixed(1), c: +(per100.c * k).toFixed(1), f: +(per100.f * k).toFixed(1),
    meals: 'blds', barcode: code,
  };
}

// ---------- AI photo / description scanner ----------
const SDK = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.7.0/+esm';
export const AI_MODEL = 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'note'],
  properties: {
    note: { type: 'string', description: 'One short sentence about the meal, or why nothing could be identified.' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'name_ar', 'grams', 'kcal', 'protein', 'carbs', 'fat', 'confidence'],
        properties: {
          name: { type: 'string' }, name_ar: { type: 'string' },
          grams: { type: 'number' }, kcal: { type: 'number' },
          protein: { type: 'number' }, carbs: { type: 'number' }, fat: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
      },
    },
  },
};

const SYSTEM = `You are a nutrition assistant inside a calorie-tracking app used in Egypt.
Identify every food and drink in the user's photo or description, including Egyptian dishes
(ful, ta'ameya, koshari, molokhia, mahshi, fattah, hawawshi, feteer, basbousa, etc.) and
international dishes. For each item estimate the portion actually shown in grams and the
calories, protein, carbs and fat for that portion (not per 100 g). Count visible oil, ghee,
sauces, bread and sugar in drinks. Give the English name and the Egyptian Arabic name.
If the image contains no food, return an empty items list and say so in note.`;

let clientPromise = null, clientKey = '';
async function client(apiKey) {
  if (!clientPromise || clientKey !== apiKey) {
    clientKey = apiKey;
    clientPromise = import(SDK).then((m) => {
      const Anthropic = m.default || m.Anthropic;
      // The key belongs to the person using the app and never leaves their device
      // except to call Anthropic directly, so browser use is intended here.
      return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    });
  }
  return clientPromise;
}

// Shrink a photo to ≤ 1280 px JPEG and return base64 (keeps the request small and fast).
export function imageToBase64(file, max = 1280) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      res(c.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = () => rej(new Error('Could not read the photo.'));
    img.src = URL.createObjectURL(file);
  });
}

// Returns { items: [...], note }.
export async function analyzeMeal({ apiKey, imageB64, text, lang = 'en' }) {
  if (!apiKey) throw new Error('Add your Anthropic API key in Settings to use the AI meal scanner.');
  const anthropic = await client(apiKey);
  const content = [];
  if (imageB64) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageB64 } });
  content.push({ type: 'text', text: text ? `Meal description: ${text}` : 'Estimate the nutrition of this meal.' });

  const response = await anthropic.beta.messages.create({
    model: AI_MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: SCHEMA } },
    system: SYSTEM + (lang === 'ar' ? '\nThe user reads Arabic: write the note in Egyptian Arabic.' : ''),
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal') throw new Error('The AI could not analyse this photo. Try another photo or type a description.');
  if (response.stop_reason === 'max_tokens') throw new Error('The answer was cut off. Please try again.');
  const txt = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try { data = JSON.parse(txt); } catch { throw new Error('Could not read the AI answer. Please try again.'); }
  return data;
}

// Friendly message for API errors.
export function aiErrorMessage(e) {
  const s = e && (e.status || (e.error && e.error.status));
  if (s === 401) return 'Your API key was rejected. Check it in Settings.';
  if (s === 429) return 'Too many requests right now. Wait a minute and try again.';
  if (s >= 500) return 'The AI service is busy. Please try again shortly.';
  if (e && /Failed to fetch|NetworkError|Load failed/i.test(e.message || '')) return 'No internet connection, or the AI service could not be reached.';
  return (e && e.message) || 'Something went wrong.';
}
