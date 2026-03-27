# M8 - lessons learned

## Purpose

This file captures what we learned while delivering M8, so M9 and later milestones keep the product quality gains without repeating the same mistakes.

## What M8 accomplished

### 1. The app stopped feeling like two separate tools

The biggest win in M8 was product coherence. Market Pulse, My Names, history/resume, and Deep Dive now feel connected instead of living as isolated features.

### 2. "Works" became "feels good to use"

M7 proved the Android app was real. M8 proved it could feel clear, intentional, and premium enough for a real user to come back tomorrow.

### 3. Push became a real product surface

Push was no longer just infrastructure. Real FCM delivery, relevant copy, and correct tap-through made it part of the user experience.

### 4. History and continuity improved trust

Remembering prior Pulse and Deep Dive context made the product feel less disposable and more like an ongoing research tool.

### 5. The milestone closed with evidence, not optimism

Physical-device smoke proof, Linear closeout, and milestone audit notes gave M8 a clean close instead of a vague "should be fine."

## What worked well

### 1. Repairing before polishing was the right call

The first M8 pass introduced regressions. Stopping to stabilize compile safety, restore M7-safe behavior, and remove mocked critical-path content saved the milestone.

### 2. Physical-device proof beat emulator churn

The phone gave faster and more trustworthy answers than the emulator. For mobile acceptance, real-device proof should stay the default.

### 3. Narrow Maestro smoke flows were enough

We did not need a giant mobile automation framework. Focused smoke flows in `qa/maestro/` gave repeatable proof for the exact milestone behaviors that mattered.

### 4. Product quality work still needs strict traceability

Even though M8 was "UX work," it still benefited from the same discipline as backend milestones: Linear tickets, repair notes, smoke artifacts, and explicit closeout decisions.

### 5. Contract-safe refinement avoided architecture drift

We improved the mobile experience mostly by adapting to existing contracts and flows instead of widening schemas or rewriting ownership boundaries.

## What hurt / where we lost time

### 1. The first UI pass broke too much at once

Compile breakage, auth regressions, mocked content, and navigation gaps all landed together. The lesson is simple: product refinement still needs safe incremental integration.

### 2. Raw design-export artifacts are dangerous in runtime code

Theme gaps and raw Stitch-generated files created avoidable Android build instability. Design handoff material should never silently become production runtime source.

### 3. Emulator instability was a distraction

System UI crashes and flaky emulator behavior cost time without adding confidence. The practical answer was to move to the phone sooner.

### 4. Human closeout doctrine must be explicit

The difference between engineering proof and owner/product sign-off matters. It is better to record that clearly than to blur the line at the end.

### 5. Product-quality milestones can hide real technical risk

"UX refinement" sounds soft, but it touched state handling, push routing, history memory, and analytics truth. These are real product systems, not cosmetic details.

## Decisions to preserve going forward

- Preserve M7-safe behavior before adding new polish.
- Use physical-device proof as the default acceptance path for mobile milestones.
- Keep Maestro focused on milestone smoke, not broad framework ambition.
- Treat push, history, and state handling as product features, not secondary details.
- Keep milestone closure honest: engineering proof, owner authorization, and sign-off should each be recorded clearly.
- Prefer contract-safe adaptation over schema churn when the problem is presentation quality.

## M8 closeout outcome

- No hidden engineering carry-over blocker remains from M8.
- M8 closed with owner-authorized sign-off and full Linear closeout.
- The product is now in a stronger position to enter M9 without obvious product-quality debt dominating the next milestone.

## Operational checklist for M9 start

1. Preserve the current M8 mobile smoke flows and do not let them rot.
2. Keep testing on a physical device available from the start.
3. Protect the now-stable mobile compile surface from raw design-export regressions.
4. Treat the M8 home loop and My Names behavior as baseline product expectations, not optional polish.
5. Let M9 focus on hardening and operational reality, not on re-fixing product-coherence gaps that M8 already solved.

## Bottom line

M8 was the milestone where Thesis stopped being just a functioning Android app and started feeling like a product.

The biggest lesson is that product quality is not decoration. It is the layer where architecture, state, messaging, continuity, and trust finally become visible to the user.
