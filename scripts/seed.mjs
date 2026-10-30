/**
 * Seed sample yards. Requires .env with Firebase web config and
 * GOOGLE_APPLICATION_CREDENTIALS or run after rules allow admin writes.
 *
 * Simpler path: use Admin UI → Yards → Add yard after first login.
 *
 * This script uses the Firebase REST-less client via firebase npm package
 * with anonymous writes to yards (blocked by rules — yards need Auth).
 * Prefer Admin UI for seeding.
 */
console.log(`
Seed yards from the Admin UI after you deploy:

1. firebase login
2. Copy .env.example → .env and fill Firebase web keys
3. Copy .firebaserc.example → .firebaserc with your project id
4. Create Auth email/password user in Firebase Console
5. npm run deploy
6. Open /admin → sign in → Yards → add "Yard A", "Yard B"
7. Settings → set admin PIN
`)
