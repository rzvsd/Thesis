# Local Admin Login Runbook
**Purpose:** Set a stable local builder account (verified + Pro) for repeatable testing.

## 1) Generate password hash
Run in `apps/product-api`:

```powershell
node -e "require('bcryptjs').hash(process.argv[1],12).then(console.log)" 'YourStrongPasswordHere'
```

Copy the printed hash.

## 2) Configure local `.env`
Edit `C:\BOTS\Thesis\fintech\.env` and set:

```env
ADMIN_BOOTSTRAP_ENABLED=true
ADMIN_BOOTSTRAP_EMAIL=admin.builder@thesis.local
ADMIN_BOOTSTRAP_PASSWORD_HASH=$2a$12$qUxXxMmk2yUxInC95galLu4eYOy50zF61BIEVBgc4iGjPVrJ3ZISq
ADMIN_BOOTSTRAP_AUTO_VERIFY=true
ADMIN_BOOTSTRAP_FORCE_PRO=true
```

Important:
- Keep this in `.env` only.
- Do not put real credentials in `.env.example`.

## 3) Restart Product API
Restart the local Product API process so the new env values load.

## 4) Login from Android app
- Use normal login screen.
- Enter `ADMIN_BOOTSTRAP_EMAIL` and the original plaintext password.
- No special endpoint is needed.

## 5) Quick verification
- Login succeeds immediately.
- Pro-only features are available.
- Force-close app and reopen.
- Re-login works with the same credentials.

## 6) Disable when needed
To disable bootstrap:

```env
ADMIN_BOOTSTRAP_ENABLED=false
```

Restart Product API.
