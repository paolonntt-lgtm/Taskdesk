# TaskDesk Mobile — Play Store Setup Guide

This guide walks you through every manual step needed to publish TaskDesk Mobile on the Google Play Store with working push notifications.

---

## Prerequisites

- A computer with [Node.js 18+](https://nodejs.org/) and [pnpm](https://pnpm.io/) installed
- An [Expo account](https://expo.dev/signup) (free)
- A [Google account](https://accounts.google.com/) for Firebase and Play Console
- A [Google Play Developer account](https://play.google.com/console/signup) (one-time $25 fee)

---

## Step 1 — Create an EAS project and get your Project ID

EAS (Expo Application Services) is the hosted build and submit service for Expo apps.

1. Install the EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Log in with your Expo account:
   ```bash
   eas login
   ```

3. Inside the `artifacts/mobile/` directory, initialize the project:
   ```bash
   cd artifacts/mobile
   eas init
   ```
   This creates a project on expo.dev and prints your **Project ID** (a UUID such as `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

4. Open `artifacts/mobile/app.json` and replace `"YOUR_EAS_PROJECT_ID"` with the actual UUID:
   ```json
   "extra": {
     "eas": {
       "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
     }
   }
   ```

---

## Step 2 — Set up Firebase and enable push notifications (FCM)

Android push notifications are delivered via Firebase Cloud Messaging (FCM).

1. Open the [Firebase Console](https://console.firebase.google.com/) and use TaskDesk's existing Firebase project if one is already configured. Create a project only when setting up a new Firebase environment.

2. Give it any name (e.g. `taskdesk-mobile`). You can disable Google Analytics — it is not needed.

3. Inside the project, click **Add app** → choose the **Android** icon.

4. For the **Android package name**, enter exactly:
   ```
   com.taskdesk.mobile
   ```
   This must match `android.package` in `app.json`.

5. Click **Register app**, then **Download `google-services.json`**.

6. Copy `google-services.json` into `artifacts/mobile/`:
   ```bash
   cp ~/Downloads/google-services.json artifacts/mobile/google-services.json
   ```
   > **Important:** This file is client configuration, not a server credential, but keep the downloaded file out of Git. The repository ignores it locally and EAS build archives exclude it.

   For EAS cloud builds, create a **file** environment variable named
   `GOOGLE_SERVICES_JSON` in each environment used by an EAS build
   (`development`, `preview`, and `production`). Run the following from
   `artifacts/mobile/` once for each environment:
   ```bash
   eas env:create production \
     --name GOOGLE_SERVICES_JSON \
     --type file \
     --visibility secret \
     --value ./google-services.json \
     --non-interactive
   ```
   Replace `production` with `development` and `preview` for the other
   environments. Do not pass the JSON contents as a text variable. `app.config.js`
   requires this file variable for EAS builds; the local ignored file is used
   only for local native builds. If the Firebase config is renewed, replace the
   file variable in every environment and the local copy, then rebuild the app.

7. Restrict the Firebase Android API key used by this app:
   - In Firebase Console, open **Project settings → General** and confirm the
     Android app package is exactly `com.taskdesk.mobile`. Keep only the Android
     app entries TaskDesk actually ships.
   - In Google Cloud Console, open **APIs & Services → Credentials** and edit
     the Android API key referenced by this app's `google-services.json`.
   - Under **Application restrictions**, choose **Android apps** and allow
     package `com.taskdesk.mobile` with the SHA-1 certificate fingerprints for
     the builds that will run the app. Include the Google Play **App signing
     key** SHA-1 for Play installs and the EAS signing certificate SHA-1 for
     direct development/preview installs when those use a different key. Do
     not use the Play upload-key fingerprint unless an installed build is
     actually signed with it.
   - Under **API restrictions**, allow only **Firebase Installations API**
     (`firebaseinstallations.googleapis.com`) and **FCM Registration API**
     (`fcmregistrations.googleapis.com`). These are the Firebase APIs required
     for this app's Expo push-token registration. Do not add unrelated APIs to
     this Firebase key.
   - Save the restrictions, then verify push-token registration with a fresh
     Android build for each signing certificate. A missing package/certificate
     match can cause Firebase Installations to return `403 PERMISSION_DENIED`
     and prevent the app from receiving a push token.

8. Back in the Firebase Console, go to **Project Settings → Cloud Messaging** and verify that the **Firebase Cloud Messaging API (V1)** is enabled.

9. Upload your FCM server credentials to EAS so Expo can send notifications:
   ```bash
   cd artifacts/mobile
   eas credentials
   ```
   Follow the prompts to upload the FCM V1 service account key.

---

## Step 3 — Build the Android app bundle with EAS

1. From `artifacts/mobile/`, trigger a production build:
   ```bash
   eas build --platform android --profile production
   ```
   EAS will build an `.aab` (Android App Bundle) in the cloud. The first build takes about 10–15 minutes.

2. When the build finishes, download the `.aab` file from the URL shown in the terminal (or from [expo.dev/builds](https://expo.dev/builds)).

### Optional: build a testable APK first

To install the app directly on an Android device before uploading to the Play Store:

```bash
eas build --platform android --profile preview
```

This produces an `.apk` you can sideload for testing push notifications end-to-end.

---

## Step 4 — Create a Google Play Developer account

1. Go to [play.google.com/console](https://play.google.com/console) and sign in with your Google account.
2. Pay the one-time $25 registration fee.
3. Complete the account details (developer name, contact email, etc.).

---

## Step 5 — Create the app listing in Play Console

1. In the Play Console, click **Create app**.
2. Fill in:
   - **App name**: `TaskDesk`
   - **Default language**: Italian (or your preferred language)
   - **App or game**: App
   - **Free or paid**: your choice
3. Accept the declarations and click **Create app**.

4. Under **Grow → Store presence → Main store listing**, fill in:
   - Short description (max 80 chars): e.g. `Sistema di ticketing aziendale per gestire le richieste del team.`
   - Full description (max 4000 chars): describe TaskDesk's features.
   - Screenshots (at least 2 phone screenshots — use your test APK to capture them).
   - **Feature graphic** (1024×500 px banner): create one in Canva or Figma.
   - **Icon** (512×512 px): use `artifacts/mobile/assets/images/taskdesk-app-icon.png` (1024×1024; Play Console accepts it directly).

5. Under **App content**, complete all required declarations (privacy policy URL, content rating questionnaire, target audience, data safety form).

---

## Step 6 — Upload the app bundle and publish

### Option A — Submit via EAS (recommended)

```bash
cd artifacts/mobile
eas submit --platform android
```

Follow the prompts. EAS will ask you to log in to your Google Play account and select the app. It uploads the `.aab` automatically.

### Option B — Manual upload

1. In the Play Console, go to **Release → Production → Create new release**.
2. Upload the `.aab` file you downloaded in Step 3.
3. Write release notes (e.g. `Initial release`).
4. Click **Save**, then **Review release**, then **Start rollout to Production**.

---

## Push notification asset locations

| Asset | Path | Notes |
|-------|------|-------|
| App icon (1024×1024) | `assets/images/taskdesk-app-icon.png` | Used for iOS and Play Store launcher icon |
| Adaptive icon foreground (1024×1024) | `assets/images/taskdesk-adaptive-foreground.png` | Transparent official mark, sized for Android's adaptive mask |
| Adaptive icon background color | `#ffffff` (white) | Set in `app.json` → `android.adaptiveIcon.backgroundColor` |
| Splash mark (1024×1024) | `assets/images/icon.png` | Transparent full-color mark; splash plugin uses contain mode and a dark-theme background |
| Android notification icon (96×96) | `assets/images/notification-icon.png` | White silhouette on transparency; tinted `#0f62fe` by the notifications plugin |
| `google-services.json` | `artifacts/mobile/google-services.json` | **Not committed** — download from Firebase Console |

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Push tokens are `null` | Make sure `projectId` in `app.json` matches the one shown in `expo.dev`. |
| Notifications don't arrive on Android | Verify FCM V1 is enabled in Firebase and credentials are uploaded via `eas credentials`. |
| Build fails with "google-services.json not found" | Copy the file to `artifacts/mobile/` before running `eas build`. |
| Play Console rejects the bundle | Ensure `versionCode` in `app.json` is incremented for each new release. |

---

## Next steps after publishing

- Set up **internal testing** in Play Console to test builds with a small group before full rollout.
- Configure **staged rollouts** (e.g. 10% → 50% → 100%) for safer production releases.
- Monitor **Android vitals** in Play Console for crashes and ANRs.
- Increment `version` (semantic) and `android.versionCode` (integer, always increasing) in `app.json` for every new release.
