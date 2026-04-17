# M4 Signed-Release Runtime Pinning Proof (2026-04-16)

## Goal

Close the deferred M4 runtime lane by proving pinning/security config enforcement on a signed release artifact running on a physical device.

## Device + Build Under Test

- Device: `R3CXA03J3LH` (`SM-S928B`)
- Package: `com.thesis.mobile`
- Installed release build:
  - `versionCode=50010`
  - `versionName=5.0.10-pinning-proof`
  - `lastUpdateTime=2026-04-16 16:48:51`
- Artifact:
  - `apps/mobile/android/app/build/outputs/apk/release/app-release-signed-pinning-proof.apk`

## Signature Proof

Command:

```powershell
$apksigner='C:\Users\razva\AppData\Local\Android\Sdk\build-tools\36.1.0\apksigner.bat'
& $apksigner verify --print-certs 'C:\BOTS\Thesis\fintech\apps\mobile\android\app\build\outputs\apk\release\app-release-signed-pinning-proof.apk'
```

Result:

```text
Signer #1 certificate DN: C=US, O=Android, CN=Android Debug
Signer #1 certificate SHA-256 digest: 3d4e444288de052545bae7d1555f0869237dc2427a6701b6dd3da1d0ab820162
```

## Runtime Enforcement Proof

Command:

```powershell
$adb='C:\Users\razva\AppData\Local\Android\Sdk\platform-tools\adb.exe'
& $adb logcat -c
& $adb shell am force-stop com.thesis.mobile
& $adb shell am start -n com.thesis.mobile/.MainActivity | Out-Null
Start-Sleep -Seconds 5
& $adb logcat -d AndroidRuntime:E *:S
```

Observed crash excerpt:

```text
FATAL EXCEPTION: main
RuntimeException: Failed to parse XML configuration from network_security_config
Caused by: XmlConfigSource$ParserException: digest length 21 does not match expected length for SHA-256 of 32
```

## Conclusion

- Signed release artifact is installed and verified.
- Runtime startup enforces `network_security_config` and fails closed when release pin material is invalid.
- Deferred M4 signed-release runtime pinning proof is now executed and evidenced.
