# Yard Inventory

Finished-goods external yard system: phone QR scan **IN/OUT**, offline queue, multi-person **stock take**, **admin** grids with CSV export, and a **TV dashboard** of stock per yard.

## Stack

- React + Vite + TypeScript (PWA)
- Firebase Hosting + Firestore + Auth
- GitHub for source control

## Quick start

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Email/Password**, **Firestore**, and **Hosting**
3. Create a web app in Firebase and copy the config keys
4. Copy env and Firebase project files:

```bash
cp .env.example .env
cp .firebaserc.example .firebaserc
```

5. Fill `.env` with your Firebase web config; set `.firebaserc` project id
6. Create an Auth user (email/password) for admin
7. Install and run:

```bash
npm install
npm run dev
```

8. Deploy rules + hosting:

```bash
npx firebase login
npm run deploy
```

After deploy, open the Hosting URL:

- `/scan` — yard phones  
- `/stocktake` — stock take  
- `/admin` — login with Auth user; set Admin PIN in Settings; add yards  
- `/dashboard` — office TV  

## First-time ops

1. Sign in to **Admin** with your Firebase Auth user  
2. **Yards** tab → add yards (e.g. Yard A, Yard B)  
3. **Settings** → set a 4–8 digit admin PIN (used when confirming stock take)  
4. Phones: open `/scan`, enter staff number, pick yard, IN or OUT, scan chassis QR  

## Offline

If the yard has no signal, scans are stored on the phone and upload when mobile data returns. A banner shows the pending queue count.

## CSV export

Admin → **Export this table CSV** or **Export all tables CSV** (transactions, units, yards, stock-take sessions).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run deploy` | Build + deploy Hosting + rules |
| `npm run deploy:hosting` | Hosting only |
| `npm run deploy:rules` | Firestore rules only |
