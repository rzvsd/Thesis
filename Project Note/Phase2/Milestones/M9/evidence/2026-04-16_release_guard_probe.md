# M9 Release Guard Probe - 2026-04-16

## Scope

Validate that Android release configuration fails early for unsafe pinning values even before full release assembly.

File under test:

- `apps/mobile/android/app/build.gradle.kts`

## Environment

- Repo: `C:\BOTS\Thesis\fintech`
- Shell: PowerShell
- JDK path used for this run: `C:\Program Files\Android\Android Studio\jbr`
- Command pattern: `./gradlew :app:releaseGuardProbe ...` (intentional non-existent task name containing `release` so release guards execute during configuration)

## Probe Results

1. Host mismatch rejection
   - Input:
     - `API_BASE_URL_RELEASE=https://api.thesisprod.app`
     - `RELEASE_API_HOST=api.otherdomain.app`
   - Result: `PASS` (guard rejected)
   - Failure observed:
     - `RELEASE_API_HOST must match API_BASE_URL_RELEASE host or its parent domain`

2. Repeated-character pin rejection
   - Input:
     - `RELEASE_CERT_PIN_PRIMARY=CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=`
   - Result: `PASS` (guard rejected)
   - Failure observed:
     - `RELEASE_CERT_PIN_PRIMARY uses a repeated-character placeholder pin value`

3. Duplicate pin rejection
   - Input:
     - `RELEASE_CERT_PIN_PRIMARY == RELEASE_CERT_PIN_BACKUP`
   - Result: `PASS` (guard rejected)
   - Failure observed:
     - `RELEASE_CERT_PIN_PRIMARY and RELEASE_CERT_PIN_BACKUP must be different`

4. Valid-shape guard path
   - Input:
     - host/base alignment + distinct pin strings with valid shape
   - Result: `PASS` for guard stage
   - Expected command outcome:
     - build fails only with `task 'releaseGuardProbe' not found`, meaning release guard configuration succeeded.

## Notes

- This probe strengthens M9 hardening confidence but does **not** replace the deferred real MITM proof against production host/certificate chain.
- Deferred items remain unchanged:
  - real production host + real intermediate pin pair + MITM execution evidence
  - Deep Dive offline-cache proof path requiring provider-key unblocking in this environment
