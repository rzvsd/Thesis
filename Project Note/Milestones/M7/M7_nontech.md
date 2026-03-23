# M7 - non-technical explanation

M7 puts the product in a real person's hand.
If M6 proved backend delivery flows, M7 is the milestone where the app becomes a usable Android product, not just a backend system with endpoints.

Before M7:
The platform had strong backend capabilities, but a normal user could not yet install an app, sign in, request analysis, and consume results end-to-end on a phone.

After M7:
A user can install the Android app, create an account, log in, request a Deep Dive, read Market Pulse, manage watchlist entries, receive push notifications, and recover from common failures without app crashes.

## What specifically gets built - in plain English

### A real Android app, not a placeholder

M7 delivers a Kotlin Android app as the mobile source of truth. This is no longer a "mock mobile layer." It is a real installable app with real screens and real flows.

### Full account entry flow on device

Users can register, verify, log in, refresh session tokens, and log out from the phone experience. In plain terms: identity is no longer a backend-only concept; it works where the user lives.

### Deep Dive request flow from mobile

The app can search tickers, create Deep Dive jobs, show progress while work is running, and render results. Evidence links can open in the device browser.

### Market Pulse as a daily product surface

The app can open and display the latest pulse view, including degraded states when a source is unavailable. It also supports push receipt and tap-through routing into the app.

### Watchlist and settings become user controls

Users can add/view/remove watchlist tickers, toggle notifications, and open Android notification settings from within the app.

### Honest UX in bad conditions

M7 hardens edge states:
- invalid login shows a clear auth error
- offline mode shows connectivity messaging
- Deep Dive failure paths show clear retry behavior
- smoke paths remain crash-free

### Product observability from mobile

M7 also verifies product telemetry behavior using PostHog events and feature-flag gating, so the team can see real usage flow quality, not just backend health.

## What M7 did NOT fully close

One explicit item was owner-approved for carry-over:
- Deep Dive full-render proof hardening is deferred to M8

This was logged as an approved scope carry-over so milestone closeout remains honest.

## The simple version

M7 answers this question:
Can a real person install the Android app and use the product end-to-end each day without engineering help?

That is what M7 delivers.

