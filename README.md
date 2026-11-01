# Yard Inventory

Finished-goods external yard system: phone QR scan **IN/OUT**, offline queue, multi-person **stock take**, **admin** grids with CSV export, and a **TV dashboard** of stock per yard.

## Live site (GitHub Pages)

**https://wmaminuddin.github.io/yard-inventory/**

| Path | Use |
|---|---|
| `/` | Home |
| `/scan` | Yard phones |
| `/stocktake` | Stock take |
| `/admin` | Admin (Firebase Auth) |
| `/dashboard` | Office TV |

Backend remains **Firebase Auth + Firestore**. Firebase Hosting is optional/unused for day-to-day.

## Stack

- React + Vite + TypeScript (PWA)
- GitHub Pages (static site)
- Firebase Auth + Firestore
- GitHub Actions deploy on push to `master`

## Quick start (local)

1. Create a Firebase project; enable **Authentication → Email/Password** and **Firestore**
2. Register a web app and copy config keys
3. Copy env files:

```bash
cp .env.example .env
cp .firebaserc.example .firebaserc
```

4. Fill `.env`; set `.firebaserc` project id
5. Create an Auth user (email/password) for admin
6. Add `localhost` (and for production `wmaminuddin.github.io`) under Firebase **Authentication → Settings → Authorized domains**
7. Install and run:

```bash
npm install
npm run dev
```

Open `http://localhost:5173/yard-inventory/` (app `base` is `/yard-inventory/` for Pages).

## Deploy to GitHub Pages

Deploys automatically on push to `master` via [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

**Repo secrets** (Settings → Secrets and variables → Actions), same as `.env`:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

Pages source must be **GitHub Actions**. Manual run: Actions → Deploy GitHub Pages → Run workflow.

Optional Firestore rules deploy (still uses Firebase CLI):

```bash
npx firebase login
npm run deploy:rules
```

## First-time ops

1. Sign in to **Admin** with your Firebase Auth user  
2. **Yards** tab → add yards and set **max capacity** (`0` = hide % on TV)  
3. **Settings** → set a 4–8 digit admin PIN  
4. Phones: open `/scan`, enter staff number, pick yard, IN or OUT, scan chassis QR  

## Yard capacity (TV dashboard)

Each active yard card shows current stock. When max capacity is greater than 0, it also shows **% full** and a progress bar (warns at 90%+, over-capacity when stock exceeds max).

## Batch IN (Admin)

**Admin → Batch IN**:

1. Download the template CSV (column `chassisNo`) or use Excel with a chassis/VIN column  
2. Select the target yard  
3. Upload `.csv` / `.xlsx` / `.xls`  
4. Preview → **Run batch IN**  
5. Download results CSV (ok / transferred / skipped / failed)

Units already IN another yard are auto-transferred. Units already IN the target yard are skipped.

## Offline

If the yard has no signal, scans are stored on the phone and upload when mobile data returns. A banner shows the pending queue count.

## CSV export

Admin → **Export this table CSV** or **Export all tables CSV** (transactions, units, yards, stock-take sessions).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run deploy:rules` | Deploy Firestore rules only |
| `npm run deploy` | Build + Firebase Hosting + rules (optional) |
