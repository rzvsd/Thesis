# M3 — non-technical explanation

M3 installs the brain.
If M1 built the empty building, and M2 turned on the pipes, M3 is the phase where the building finally gets a trained analyst sitting inside it.

Before M3:
The system could already receive clean financial data and approved-source news. The raw ingredients could enter the building in the right shape. But the platform still was not doing the real thinking. It had numbers and articles, but no connected research engine yet to read them, reason about them, and turn them into a proper company report.

After M3:
The system now has Dexter connected as the main research engine for Company Deep Dive. That means the platform can accept a request to analyze a company, let Dexter run its own research process, and return a report in the official system format. It still is not the full end-user product experience yet — later milestones wrap this with API, job handling, and mobile delivery — but the core research brain is now alive.

## What specifically gets built — in plain English

### The research brain is connected

Dexter is an existing open-source financial research agent. M3 brings that brain into the project and connects it to the rest of the system. In simple terms: before M3, the system had ingredients but no chef. After M3, the chef is in the kitchen and can begin cooking.

### The worker that can actually run

M3 creates the working Dexter service inside the project setup so it can start normally, stay healthy, and be called when a company analysis request comes in. This matters because a brain written on paper is useless. It has to boot, stay alive, and respond when asked to do work.

### The full research flow

When a company request is sent in, Dexter runs its own chain of work: it plans what to analyze, retrieves what it needs, writes the report sections, scores the result, and then produces one final structured report. In plain English: it does not just spit out a paragraph. It follows a full research process.

### The official report shape check

M3 also makes sure Dexter’s output is checked against the platform’s official report format before it is accepted. That means the system does not trust a free-form answer just because it looks smart. The report has to match the contract exactly.

### The honesty rules for weak or missing evidence

One of the most important parts of M3 is that the system must stay honest when something is missing, weak, or broken.

If Dexter cannot support a section properly, that section must say so clearly.
If the evidence is too weak for a real signal, the system must say `no_signal` instead of inventing a confident answer.
If one part fails or times out, that part is marked as failed, while the rest of the report can still continue.

This is the milestone where the system learns not just to think, but to admit when it does not know enough.

### No blank mystery sections

M3 also prevents silent emptiness. A report section is not allowed to be left blank without explanation. Every section must either contain content or contain a clear status saying why it does not.

That sounds small, but it is a trust rule. Blank spaces create confusion. Explicit status creates honesty.

### The run inspection layer

Every Dexter run must also be visible in LangSmith. In non-technical terms, that means every research run leaves behind an inspection trail. The team can later open the run and see what happened, how long it took, which prompts were used, and where things went wrong.

Think of this as adding a cockpit recorder to the research brain.

### The failure drills

M3 also adds tests for ugly real-world cases:
missing data, weak evidence, and timeouts.

This is important because the milestone is not only about working when the sky is blue. It must also behave correctly when reality is messy.

## What M3 did NOT build

M3 does not yet build the full product experience around Dexter.
It does not yet create the complete user job system.
It does not yet handle full authentication and product API flow.
It does not yet make the mobile app experience complete.
It does not yet build the Market Pulse morning briefing.

It is also not the final “polished user feature” milestone.
M3 is about making the core research engine real and trustworthy inside the system.

## The simple version

M3 answers this question:
can the system now take a company analysis request, let Dexter do the real research work, and return an honest, structured report — even when some data is weak or missing?

That is what M3 delivers.
