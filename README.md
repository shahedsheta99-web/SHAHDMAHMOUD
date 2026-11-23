# Pediatric Nutrition App

A pediatric clinical nutrition app that works on **Android, iPhone/iPad and desktop**
from a single codebase. It is an *installable web app* (PWA): you open a link once, tap
**Add to Home Screen** or **Install**, and it behaves like a normal app, including offline.

## What it does

| Feature | Details |
|---|---|
| Patient files | A separate file for each patient: demographics, assessments, PYMS, follow-ups, discharge |
| Energy | **Schofield** (weight, or weight + height) × activity factor × stress factor (includes **1.95** and **2.25**, plus custom) |
| Protein | Range by age (< 1 y 2.5–3, 1–10 y 1.5–2.5, > 10 y 0.8–2 g/kg) shown as min–max g/day, or DRI. **Protein restriction** for AKI / CKD / other renal impairment |
| Fluid | **Holliday–Segar** (100 / 50 / 20 mL/kg), % of maintenance, mL/h |
| Weights | Actual, **Ideal** (≤ 150 cm: Ht² × 1.65 / 1000), **Adjusted** (IBW + 0.25 × (Actual − IBW)), usual or custom. **Each calculation (energy, protein, fluid) can use a different weight** |
| Anthropometry | BMI, %IBW, weight change, z-scores and centiles |
| Growth charts | CDC weight/age (0–36 m and 2–20 y), height/age and BMI/age (2–20 y), with patient points plotted |
| Formula | Oral formulas filtered by **age group**, ranked by protein range and by **abnormal lab electrolytes**; electrolyte (Na, K, Ca, P, Mg) warnings; **editable formula list inside the app** |
| TPN | Parenteral nutrition order by ASPEN ranges (Tables 5–8): you give the **% of TEE**; protein and lipid by g/kg, dextrose fills the rest (GIR shown); electrolytes lab-aware; volumes for each additive, SWFI, rate, per-bag split, kcal, NPC:N, osmolarity and central/peripheral line; printable order |
| PYMS | Weekly screening with automatic BMI cut-off (S1), totals, risk and a trend chart |
| Oncology risk | The nutrition risk factor score from your sheet |
| Follow-up | Daily sheet: prescription, feeding, **fluid balance (medication fluids, IV, formula → mL remaining)**, events, vitals and labs flagged HIGH (red) / LOW (blue), plus a lab trend table |
| Discharge | Discharge summary with an automatic weight/PYMS/LOS summary |
| Printing | Print or save as PDF: the full file or any single section |
| Sync | Optional login + live sync across all devices (Firebase) |

## Files: where to change things

| File | What is inside |
|---|---|
| `js/calc.js` | All equations (Schofield, ASPEN, Holliday–Segar, IBW, PYMS, …) |
| `js/formulas.js` | The starting oral formula list (edit products inside the app on the Formulas page) |
| `js/tpn.js` | TPN calculations and ASPEN ranges |
| `js/labs.js` | Lab tests and reference ranges |
| `js/growth-data.js` | CDC growth data (generated from your .xls files) |
| `js/app.js` | Screens, forms and printed reports |
| `css/style.css` | Colours and layout |
| `js/firebase-config.js` | Paste your Firebase settings here to turn on accounts and sync |

---

## Step 1: Put the app online (free, with GitHub Pages)

1. Make sure the app files are on the `main` branch.
2. Make the repository **public**: **Settings → General → Danger Zone → Change visibility**.
   (On a free GitHub plan the repository must be public for Pages. The app's code
   has no patient data in it; patient data lives only in each user's account.)
3. Go to **Settings → Pages**. Under **Build and deployment → Source**, choose
   **Deploy from a branch**, then set **Branch** to `main` and the folder to `/ (root)`, and click **Save**.
4. Wait 1–2 minutes. The app will be at
   `https://<your-github-username>.github.io/<repository-name>/`
   (for this repository: https://shahedsheta99-web.github.io/SHAHDMAHMOUD/).

Every time `main` changes, the site updates automatically, so **every device gets the new version**.

### Install it on devices
- **Android (Chrome):** open the link → menu ⋮ → **Install app** / **Add to Home screen**.
- **iPhone / iPad (Safari):** open the link → Share button → **Add to Home Screen**.
- **Windows / Mac (Chrome or Edge):** open the link → the install icon in the address bar.

## Step 2: Turn on accounts and sync between devices (Firebase, free)

Without this step the app runs in **Local mode**: data stays on the one device you used.

1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics is not needed).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** → choose a location near you → *production mode*.
4. In Firestore open the **Rules** tab, replace everything with the contents of
   [`firestore.rules`](firestore.rules) and click **Publish**.
   This makes sure **each user can only see their own patients**.
5. **Project settings (⚙) → General → Your apps → Web (`</>`)** → register an app → copy the
   `firebaseConfig = { … }` object.
6. Open `js/firebase-config.js`, replace `null` with that object, and commit.
7. **Authentication → Settings → Authorized domains** → add `<your-github-username>.github.io`.

Now anyone can open the link, **Create account**, and keep their own patient files.
The same login on a phone and a computer shows the same files, and changes appear live.

## Try it on your computer

Because the app uses JavaScript modules, open it through a small local server rather
than double-clicking the file:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Privacy note
Patient data is health information. Follow your hospital's rules on storing patient data
in cloud services. Consider using hospital numbers rather than full names if required.
This tool supports, and does not replace, clinical judgement.
