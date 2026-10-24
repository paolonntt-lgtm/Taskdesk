---
name: Android push credentials
description: Distinguish the Firebase client config bundled with TaskDesk Android from the FCM V1 service-account credential Expo uses to send pushes.
---

Android push uses two separate Firebase artifacts: `google-services.json` is client configuration bundled with the app, while the private FCM V1 service-account JSON is configured in the Expo project's Android credentials for server-side delivery. The service account in Expo must have the Firebase Cloud Messaging API Admin role on the matching Firebase project.

**Why:** The admin push test returned `InvalidCredentials` until the matching FCM V1 service-account credential was added to Expo. Updating only this server-side credential does not require rebuilding the app.

**How to apply:** Compare the uploaded key's `client_email` with its IAM principal and ensure it belongs to the same Firebase project as the app's `google-services.json`. Rebuild only when the app-bundled Firebase configuration changes. Never ask the user to share the private key.
