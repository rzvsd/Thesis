# Design System Document: The Sovereign Interface

## 1. Overview & Creative North Star
**The Creative North Star: "The Financial Architect"**
This design system moves beyond the "standard utility app" to create a bespoke, high-end editorial experience. It treats personal finance not as a chore, but as a high-stakes command center. By rejecting the "boxed-in" layout of traditional Android apps, we embrace **Organic Structuralism**. 

We achieve this through intentional asymmetry, massive typographic contrast (pairing the architectural precision of *Manrope* with the functional clarity of *Inter*), and a "No-Line" philosophy. The UI should feel like a series of obsidian slabs floating in a deep-space void—authoritative, premium, and calm.

---

## 2. Colors & Tonal Depth
The palette is rooted in deep ink tones to ensure the high-contrast accents (#4F8CFF and #00D68F) feel luminous rather than neon.

### Surface Hierarchy & Nesting
To achieve a premium feel, we strictly prohibit 1px solid borders for sectioning. Boundaries are defined solely through background color shifts.
*   **Base Layer:** `surface_dim` (#0F131F) or `surface_container_lowest` (#0A0E1A) for the main canvas.
*   **The Nesting Rule:** Place a `surface_container_low` (#171B28) card atop a `surface_dim` background. To create internal hierarchy within that card, use `surface_container_high` (#262A37) for headers or CTA zones. This "tonal stepping" creates depth without visual noise.

### The "Glass & Gradient" Rule
Standard flat buttons are forbidden for primary actions. 
*   **CTAs:** Use a linear gradient from `primary` (#AFC6FF) to `primary_container` (#528DFF) at a 135-degree angle. This adds "soul" and a tactile, curved-glass feel.
*   **Floating Elements:** Use `surface_bright` at 60% opacity with a `20px` backdrop blur for navigation bars or top-level modals. This allows the data underneath to bleed through softly.

---

## 3. Typography
We use typography as a structural element, not just for legibility.

*   **Display & Headline (Manrope):** These are your "Architectural Anchors." Use `display-lg` for account balances and `headline-sm` for section titles. The wide apertures of Manrope convey transparency and modern luxury.
*   **Body & Label (Inter):** The "Functional Engine." Inter is used for all data points, transaction histories, and descriptions. Its tall x-height ensures readability even at `body-sm` (0.75rem) on high-density mobile screens.
*   **The Editorial Scale:** Create high-contrast pairings. A `display-md` balance should sit immediately above a `label-md` timestamp in `on_surface_variant` (#C2C6D6) for a sophisticated, magazine-style layout.

---

## 4. Elevation & Depth
In this system, light is the architect. We move away from Material3's standard shadows in favor of **Ambient Glow**.

*   **The Layering Principle:** Depth is achieved by "stacking" surface tiers. Avoid shadows on standard cards; let the shift from `surface_container_lowest` to `surface_container` do the work.
*   **Ambient Shadows:** For high-priority floating actions (FABs) or modals, use an extra-diffused shadow: `Y: 16px, Blur: 32px, Color: #000000 (15% opacity)`. 
*   **The Ghost Border:** If a boundary is required for accessibility (e.g., in a search input), use `outline_variant` (#424753) at **15% opacity**. This creates a "whisper" of a container that doesn't break the visual flow.

---

## 5. Components

### Buttons
*   **Primary:** Roundedness `xl` (0.75rem). Gradient fill (Primary to Primary Container). Text is `on_primary` (#002D6C), Semi-bold.
*   **Secondary:** Ghost style. No fill. `Ghost Border` (15% opacity `outline_variant`). 
*   **Tertiary:** Text-only using `primary_fixed_dim`. Used for "Cancel" or "View All" actions.

### Cards & Data Lists
*   **Rule:** Forbid the use of divider lines. 
*   **Implementation:** Use `8px` (`spacing-2`) of vertical white space to separate list items. For distinct sections, shift the background color from `surface_container_low` to `surface_container_highest`.
*   **Contextual Indication:** Use a 4px wide vertical "Status Bar" on the far left of a card using `tertiary` (#27E199) for positive trends and `error` (#FFB4AB) for negative, rather than coloring the whole card.

### Input Fields
*   **State:** The default state is a flat `surface_container_high` fill with no border. On focus, the field transforms with a `1px` border of `primary` and a subtle glow (0% to 10% opacity primary color).

### Additional Financial Components
*   **The Pulse Graph:** Use a non-filled path for line charts using `tertiary`. Apply a subtle vertical gradient *under* the line that fades from `tertiary` (20% opacity) to `transparent`.
*   **The Wealth Slider:** A custom range-picker with a large `xl` rounded thumb. The track should be `surface_variant`, while the active portion is the Primary Gradient.

---

## 6. Do's and Don'ts

### Do
*   **Do** use asymmetrical margins (e.g., 24dp left, 16dp right) for headline elements to create an editorial, non-template look.
*   **Do** lean heavily on `surface_container_lowest` (#0A0E1A) for background areas to make the high-contrast text "pop."
*   **Do** use `letter-spacing: -0.02em` on `display` and `headline` tokens to give them a premium, tight-knit appearance.

### Don't
*   **Don't** use 100% opaque borders. It makes the app look like a generic wireframe.
*   **Don't** use standard Material3 "Elevated" cards with default shadows. Use tonal shifting.
*   **Don't** use pure white (#FFFFFF) for text. Always use `on_surface` (#DFE2F3) to reduce eye strain in dark mode and maintain the premium "ink" feel.
*   **Don't** use dividers. If the content feels cluttered, increase the `spacing` scale (e.g., move from `spacing-4` to `spacing-6`).