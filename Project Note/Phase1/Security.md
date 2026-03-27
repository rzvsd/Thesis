# Security.md
**Status:** Working Security and Secrets Note  
**Last Revised:** 2026-03-23  
**Scope:** Local development, release builds, and production secret handling for Thesis

---

## 1. Purpose

This file explains how secrets and environment-bound configuration work in this project.

It exists to answer practical questions such as:

- Why does the app work when some files exist only on a local laptop?
- What must never be pushed to GitHub?
- What belongs on a Hetzner VPS versus a developer machine?
- What happens if the current laptop is replaced?

This is an operating note. It does not change service ownership, architecture, or milestone doctrine.

---

## 2. Core Rule

**Secrets are never stored in GitHub.**  
GitHub stores code and safe templates.  
Real credentials live only in:

- local developer machines for local testing
- deployment servers for runtime
- release build machines / CI for app builds

If a file contains a real credential, token, private key, or service-account material, it must not be committed.

---

## 3. Three Different Kinds of Sensitive Configuration

Not all configuration works the same way. For this project there are three categories:

### 3.1 Backend runtime secrets

These are required when the backend is actually running.

Examples:

- database connection string
- JWT secret
- internal worker token
- Firebase Admin service account JSON
- provider API keys

These belong on:

- local `.env` for local development
- server environment / mounted secret files in production

These do **not** belong in GitHub.

### 3.2 Android build-time configuration

These are needed when the Android app is built into an APK/AAB.

Examples:

- `google-services.json`
- Gradle properties such as PostHog config
- release API base URL

These belong on:

- the developer machine used to build locally
- the CI/release build machine used to create release artifacts

These do **not** need to be available on the production backend server unless the server also builds the Android app.

### 3.3 Local developer convenience files

These exist only to make local development work smoothly on one machine.

Examples:

- local `.env`
- `C:\Users\razva\.gradle\gradle.properties`
- local test outputs

These are machine-specific and are expected to be recreated on a new laptop.

---

## 4. Current Local Development Wiring

As of the current repo state, local development uses the following files and paths.

### 4.1 Local backend environment

Local file:

- `C:\BOTS\Thesis\fintech\.env`

Purpose:

- local runtime values for Docker / backend services
- provider keys
- JWT and internal worker values
- push mode selection

Git status:

- ignored by `.gitignore`
- never pushed

### 4.2 Local backend Firebase Admin key

Local file:

- `C:\BOTS\Thesis\fintech\secrets\firebase-admin.json`

Purpose:

- backend Product API uses this to send real FCM push notifications

How it is wired locally:

- `docker-compose.yml` mounts `./secrets` into the container as `/run/secrets`
- Product API uses:
  - `PUSH_PROVIDER_MODE=fcm`
  - `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/firebase-admin.json`

Git status:

- `secrets/` is ignored by `.gitignore`
- never pushed

### 4.3 Android Firebase client config

Local file:

- `C:\BOTS\Thesis\fintech\apps\mobile\android\app\google-services.json`

Purpose:

- enables Firebase client SDK wiring inside the Android app

Git status:

- explicitly ignored by `.gitignore`
- not pushed under current project policy

### 4.4 Local Gradle properties

Local file:

- `C:\Users\razva\.gradle\gradle.properties`

Purpose:

- local Android build-time properties
- currently used for PostHog and similar build values

Current examples:

- `POSTHOG_ENABLED`
- `POSTHOG_API_KEY`
- `POSTHOG_HOST`
- `POSTHOG_WATCHLIST_FLAG_KEY`

Git status:

- outside the repo
- never pushed

---

## 5. Why the App Works Today Even Though Those Files Are Local

The app works today because the current setup is still partly **local-development mode**.

That means:

- Docker reads local env values from the current machine
- Product API reads its local mounted secret file
- the Android app is built on the current machine using the current machine's Gradle properties

So the app is not “magically depending on GitHub.”  
It is depending on the local machine that currently holds the runtime/build secrets.

This is normal during milestone development and local testing.

---

## 6. What Happens If This Laptop Changes

Changing laptops does **not** automatically break already installed apps in the wild.

But it **does** affect development and local operations.

### 6.1 What does not break immediately

- code already pushed to GitHub remains in GitHub
- already built APKs remain built
- a running production server would keep running if it has its own secrets

### 6.2 What does break on a new laptop unless re-provisioned

- local Docker stack if `.env` is missing
- local push sending if `firebase-admin.json` is missing
- local Android builds if `google-services.json` or Gradle properties are missing
- local analytics-enabled builds if `C:\Users\razva\.gradle\gradle.properties` is missing

So the correct mental model is:

**The laptop is currently a development environment, not the long-term system-of-record for production secrets.**

---

## 7. What Must Live on Hetzner in Production

For production on Hetzner VPS, backend runtime secrets must move to the server.

Recommended production pattern:

### 7.1 On the VPS

Keep runtime secrets on the VPS, for example:

- `/opt/thesis/.env`
- `/opt/thesis/secrets/firebase-admin.json`

The exact path can vary, but the idea is fixed:

- env file on server
- secret file on server
- mounted into containers at runtime

### 7.2 Product API production requirements

The production server must provide:

- `DATABASE_URL`
- `JWT_SECRET`
- `INTERNAL_WORKER_TOKEN`
- `PUSH_PROVIDER_MODE=fcm`
- `GOOGLE_APPLICATION_CREDENTIALS=<server path inside container>`
- any required provider API keys

### 7.3 Important rule

**Production must not depend on a personal laptop.**

Once deployed properly:

- Hetzner runs the backend
- Hetzner stores backend runtime secrets
- the system continues to run even if the developer laptop is turned off or replaced

---

## 8. What Must Exist on the Android Release Build Machine

The Android release build machine must have the files needed to build the app.

That includes:

- `google-services.json`
- Gradle properties needed for release build configuration
- the correct production API base URL

Important:

The build machine and the runtime server are not the same thing.

- Hetzner hosts the backend runtime
- the build machine creates the Android release artifact

If the build machine changes, these files must be re-provisioned there before the next release build.

---

## 9. Release-Critical Difference: Local IP vs Real Production URL

The Android app currently has a local-development fallback base URL in:

- `apps/mobile/android/app/build.gradle.kts`

Current dev fallback:

- `http://192.168.1.114:3001`

This is valid only for local development / testing.

For a real market release:

- the app must be built with the real public backend URL
- not a home LAN IP
- not a localhost address

If this is not changed for release, the app will point to the wrong backend.

---

## 10. Current Git Safety Rules

The following are intentionally kept out of GitHub:

- `.env`
- `secrets/`
- `secrets/firebase-admin.json`
- `apps/mobile/android/app/google-services.json`
- `qa/maestro/.maestro.env`
- `qa/maestro/output/`

This is enforced through `.gitignore`.

Templates may be committed when they contain no real secret values.  
Example:

- `.env.example` is allowed because it contains placeholders only

---

## 11. What To Do When Setting Up a New Laptop

To restore a working local environment on a new machine:

1. Clone the repo
2. Recreate local `.env`
3. Recreate or copy `secrets/firebase-admin.json`
4. Re-add `apps/mobile/android/app/google-services.json`
5. Recreate `C:\Users\<your-user>\.gradle\gradle.properties`
6. Confirm Docker mounts and envs still point to valid paths
7. Rebuild backend containers
8. Rebuild the Android app

If these files are not restored, local development may fail even though the codebase itself is fine.

---

## 12. What To Do Before Real Production Launch

Before production launch, complete this migration:

1. Move backend runtime secrets to Hetzner VPS
2. Confirm Product API uses server-side secret mount, not developer-laptop paths
3. Confirm production `.env` exists only on the server
4. Confirm Android release build uses production API URL
5. Confirm release build machine has the required Firebase and Gradle config
6. Confirm no real secrets are present in Git history
7. Confirm onboarding notes exist for replacing a laptop or rebuilding a release machine

---

## 13. Simple Answer to the Original Concern

If secrets stay only on one personal laptop, then:

- local development depends on that laptop
- local push testing depends on that laptop
- future local rebuilds depend on that laptop unless the secrets are copied elsewhere

That is acceptable for milestone-stage local testing.  
That is **not** acceptable as the final production operating model.

The final production model must be:

- backend secrets on Hetzner
- app build secrets on the release build machine / CI
- code in GitHub
- no production dependency on one personal laptop

---

## 14. Non-Negotiable Rules

- Never commit real secrets
- Never commit service-account JSON files
- Never assume local dev paths are valid production paths
- Never ship a release app pointing to a home/LAN IP
- Never treat a developer laptop as the production secret store

