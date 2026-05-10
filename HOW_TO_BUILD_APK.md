# How to Build the Pragati Path APK Yourself

Your code is **100% build-ready** (`expo-doctor` passes 17/17). Follow these steps to generate an APK file you can install directly on any Android device.

---

## Prerequisites (one-time, ~5 minutes)

1. **Install Node.js 20+** on your computer: https://nodejs.org/
2. **Create a free Expo account**: https://expo.dev/signup
3. **Install EAS CLI globally**:
   ```bash
   npm install -g eas-cli
   ```

---

## Step 1 — Get the project on your computer

**Option A: Download from Emergent**
- In the Emergent dashboard, click your profile → "Download project as ZIP"
- Unzip it somewhere, e.g. `C:\pragati-path` or `~/pragati-path`

**Option B: Push to GitHub from Emergent**
- Use Emergent's "Save to GitHub" feature, then `git clone` it locally

---

## Step 2 — Install dependencies

Open a terminal in the project folder, then:
```bash
cd frontend
npm install
```
(Takes 1–2 minutes.)

---

## Step 3 — Log into Expo

```bash
eas login
```
Enter the email/password you used to create your free Expo account.

---

## Step 4 — Link the project (first time only)

```bash
eas init
```
- It'll ask "Would you like to create a new EAS project?" → **Yes**
- This adds a `projectId` to `app.json` automatically.

---

## Step 5 — Build the APK 🚀

```bash
eas build --platform android --profile preview
```

What happens:
- EAS uploads your code to its cloud build farm (free tier: ~30 builds/month)
- Takes **10–20 minutes**
- When done, the terminal prints a link like:
  ```
  ✔ Build finished
  https://expo.dev/artifacts/eas/AbCxYz.apk
  ```

---

## Step 6 — Download & install on your phone

1. Open that URL on your **Android phone** (or email it to yourself)
2. Tap **Download** → tap the downloaded `.apk`
3. Allow "Install from unknown sources" if prompted
4. Done! 🎉 The Pragati Path app icon appears in your app drawer.

---

## Backend reminder ⚠️

The APK is hardcoded to point at:
```
EXPO_PUBLIC_BACKEND_URL=https://pragati-learning-hub.emergent.host
```
(already set in `eas.json`)

So **you must keep your backend deployed on Emergent** for the app to function. If you redeploy and the URL changes, edit that line in `eas.json` and rebuild.

---

## For Google Play Store later

When you're ready for the Play Store, build an AAB instead of APK:
```bash
eas build --platform android --profile playstore
```
Then upload the resulting `.aab` to Google Play Console.

---

## Troubleshooting

| Error | Fix |
|---|---|
| `eas: command not found` | Re-run `npm install -g eas-cli` |
| `Authentication failed` | `eas logout` then `eas login` again |
| Build fails on Gradle/Android step | Run `npx expo-doctor` first — must show 17/17 |
| App opens but shows "Network error" | Backend is down — redeploy on Emergent |

---

## Files I prepared for you

- **`/app/frontend/eas.json`** — pre-configured build profiles (preview = APK, playstore = AAB)
- **`/app/frontend/app.json`** — added `android.package: "com.pragatipath.app"` and `versionCode: 1`
- All icons cropped to 512×512 (square, as Google requires)
- All hex colors validated as 6-character format

You're ready. Just download the project, run the 5 commands above, and you'll have your APK in 20 minutes.
