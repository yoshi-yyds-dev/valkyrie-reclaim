---
name: Void Vanguard
colors:
  surface: '#11131d'
  surface-dim: '#11131d'
  surface-bright: '#373944'
  surface-container-lowest: '#0b0e18'
  surface-container-low: '#191b26'
  surface-container: '#1d1f2a'
  surface-container-high: '#272935'
  surface-container-highest: '#323440'
  on-surface: '#e1e1f1'
  on-surface-variant: '#b9cacb'
  inverse-surface: '#e1e1f1'
  inverse-on-surface: '#2e303b'
  outline: '#849495'
  outline-variant: '#3a494b'
  surface-tint: '#00dce6'
  primary: '#e3fdff'
  on-primary: '#00373a'
  primary-container: '#00f3ff'
  on-primary-container: '#006b71'
  inverse-primary: '#00696f'
  secondary: '#ddb7ff'
  on-secondary: '#490080'
  secondary-container: '#6f00be'
  on-secondary-container: '#d6a9ff'
  tertiary: '#fff7f2'
  on-tertiary: '#472a00'
  tertiary-container: '#ffd5a6'
  on-tertiary-container: '#885500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ff6ff'
  primary-fixed-dim: '#00dce6'
  on-primary-fixed: '#002022'
  on-primary-fixed-variant: '#004f53'
  secondary-fixed: '#f0dbff'
  secondary-fixed-dim: '#ddb7ff'
  on-secondary-fixed: '#2c0051'
  on-secondary-fixed-variant: '#6900b3'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#11131d'
  on-background: '#e1e1f1'
  surface-variant: '#323440'
typography:
  display-lg:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: 0.05em
  display-lg-mobile:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: 0.04em
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: 0.03em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: 0.02em
  headline-sm:
    fontFamily: Space Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: 0.02em
  body-lg:
    fontFamily: Chivo
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Chivo
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Chivo
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.08em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.1em
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2.5rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
The design system establishes an adrenaline-fueled, high-stakes tactical telemetry aesthetic tailored for a vertical-scrolling sci-fi space shooter. The visual identity bridges the gap between classic coin-op arcade intensity and elite military cyberpunk cockpit instrumentation. 

Key attributes:
- **Atmospheric & High-Contrast:** The interface is built on deep void darkness punctuated by razor-sharp luminescent vector lines, plasma discharges, and reactive warning indicators.
- **Instrumental & Tactical:** UI elements behave like physical HUD projections and combat flight computer telemetry—angular framing, status gauges, corner brackets, and diagnostic readouts.
- **Design Style:** Cyberpunk-Arcade HUD. It fuses sharp geometric paneling, 45-degree chamfers, layered neon chromatic glows, and high-legibility monospaced data visualization. Visual noise is minimized during intense gameplay, while menus and tactical debriefings offer dense, atmospheric industrial-tech immersion.

## Colors
The color palette reflects deep stellar voids cut through by high-energy particle beams, plasma drives, and hazard-state alerts.

- **Primary (`#00f3ff` - Hyper Cyan):** Core shields, player weapon telemetry, primary navigational vectors, active targeting Reticles, and interactive focus states. Emits an electric 4px-8px diffuse glow on active interactions.
- **Secondary (`#a855f7` - Plasma Violet):** Hyperdrive readiness, special ordnance gauges, warp signatures, and exotic boss anomalies.
- **Tertiary (`#f59e0b` - Hazard Amber):** Overheat diagnostics, low-shield warnings, ballistic ammo reserves, and critical operational cautions.
- **Alert / Boss Crimson (`#ff0055`):** Reserved strictly for catastrophic hull integrity, incoming missile locks, emergency alerts, and boss phase encounters.
- **Void Neutrals:** The canvas foundation is `#070913` (Deep Void Canvas), layered with `#0d1224` (Sub-surface Cockpit Panels) and `#161f38` (Structural Framing/Dividers). Text shades utilize `#e2f1ff` for primary data readouts and `#5d729a` for deactivated telemetry channels.

## Typography
The typography system uses a triple-engine hierarchy designed for instant comprehension under rapid optical motion:

- **Display & Headlines (`Space Grotesk`):** Industrial, wide-aperture geometry. Used for stage titles, boss warning announcements, weapon designations, and score tally screens. Rendered in all-caps with generous letter-spacing to reinforce military-grade aerospace branding.
- **Body (`Chivo`):** Clean, modern, high-legibility sans-serif with a crisp technical cadence. Used for ship lore, upgrade trees, pilot briefings, and setting descriptions.
- **Labels & Tactical HUD Data (`JetBrains Mono`):** Monospaced precision for high-frequency dynamic values: coordinates, shield percentages, fire rate multipliers, multiplier meters, and sector codes. Ensures zero jitter during number rollups and gauge oscillations.

## Layout & Spacing
The layout adheres to a dual operational posture: **Flight Mode (HUD)** and **Hangar Mode (Menus/Upgrades)**.

- **Grid Architecture:** 
  - **Mobile / Portrait (In-Combat & Portrait Menus):** 4-column fluid layout with an inner screen margin of `1rem`. Critical HUD components (scores, bombs, shield bars) anchor to outer edge rails, preserving an unobstructed 9:16 vertical combat corridor in the center.
  - **Desktop / Landscape Displays:** 12-column fixed-max layout (`1440px` maximum viewport container) with `1.5rem` gutters and `2.5rem` canvas margins. Flanked by telemetry sidebars, keeping central viewports dedicated to vertical flight action or tactical ship diagrams.
- **Rhythm & Safe Areas:** Vertical spacing enforces an absolute 4px/8px micro-grid. In-game HUD elements must strictly observe dynamic safe zones of `2rem` top and bottom to accommodate device notches, gesture bars, and peripheral visual tracking during bullet-hell bullet navigation.

## Elevation & Depth
Elevation is not conveyed through soft drop shadows; instead, it relies on **Luminescent Vector Stratification**:

- **Tier 0 (Deep Space Void):** `#070913` static background, occasionally broken by parallax starfield dust and distant nebula mesh.
- **Tier 1 (Sub-Panel / Structural Grids):** `#0d1224` with 1px solid borders in `#161f38`. Contains secondary ship diagnostic readouts and dormant loadout slots.
- **Tier 2 (Active Telemetry Glass):** `#0d1224` at 85% opacity with a `12px` backdrop blur (`backdrop-filter: blur(12px)`). Trimmed with 1px borders in `rgba(0, 243, 255, 0.25)`.
- **Tier 3 (Floating Tactical HUD & Alerts):** Fully luminous overlays. Outlined in solid `#00f3ff` or `#ff0055` with an exterior `box-shadow: 0 0 12px rgba(0, 243, 255, 0.35), inset 0 0 8px rgba(0, 243, 255, 0.15)`.
- **Scanline & CRT Texturing:** All Tier 1 and Tier 2 containers carry a subtle 1px horizontal micro-scanline repeating gradient at 3% opacity to maintain arcade cabinet tactical fidelity.

## Shapes
The shape philosophy is strictly **Sharp (0)**, rejecting organic curvature in favor of hard-angled sci-fi ballistics and cockpit canopies:

- **Zero-Radius Primitives:** All structural panels, buttons, chips, and gauges have strict `0px` border-radii.
- **Corner Chamfers (Angled Cuts):** Primary cards and interactive panels replace rounded corners with 45-degree chamfers (cut-corners) using CSS clip-paths (e.g., `polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))`).
- **Tactical Corner Brackets:** Modals and targeting boxes feature L-shaped outer corner brackets (2px line thickness, 8px width/height) floating 4px outside the container boundary to evoke laser-etched target locks.

## Components

### Buttons & Trigger Controls
- **Primary Arcade Button:** Cut-corner rectangular geometry. Background in `rgba(0, 243, 255, 0.12)`, border in `1.5px solid #00f3ff`. Typography is `label-lg`, uppercase, centered. Hover/Focus transitions background to `#00f3ff`, text to `#070913`, accompanied by an intense cyan outer glow (`box-shadow: 0 0 16px rgba(0, 243, 255, 0.6)`).
- **Secondary / Tactical Action:** Bordered in `#5d729a`, background `#0d1224`. Hover activates Plasma Violet `#a855f7` border and text glow.
- **Hazard / Purge Action:** Bordered in `#ff0055`, red scanline interior. Used for stage aborts, overdrive activations, and bomb triggers.

### Tactical Chips & Badges
- **Status Badges:** Compact monospaced telemetry tags. Height `24px`, background `rgba(13, 18, 36, 0.9)`, border `1px solid rgba(255, 255, 255, 0.15)`.
- Prefixed with a live status pip: 6px solid square pulsing in Cyan (Normal), Amber (Warning), or Red (Critical).

### HUD Telemetry Cards & Panels
- **Avionics Card:** `#0d1224` background with 45-degree chamfered top-right corner. Features a top utility bar displaying technical specs (e.g., `// SEC-04 // SYS_OK`) in `label-sm` font, followed by content and metric readouts.
- **Corner Brackets:** Absolute positioned pseudoelements on card corners that project outward during selection.

### Progress & Segmented Power Gauges
- **Segmented Health & Shield Bars:** Replaces continuous smooth bars with segmented block rows (e.g., 10 distinct vertical blocks separated by 2px gaps). Filled blocks emit primary cyan or crimson light; depleted blocks retain a dim, de-energized `#161f38` wireframe.

### Input Fields & System Selectors
- **Command Inputs:** Sharp-edged rectangular fields with inset dark styling (`#05070e`). Inactive borders are `#161f38`. Focused borders snap to `#00f3ff` with an active terminal caret cursor. Placeholder text is rendered in `JetBrains Mono` at 40% opacity.

### Selection Indicators (Radio & Checkbox)
- **Checkbox:** Diamond-angled square (`transform: rotate(45deg)`). Check status fills the diamond with an inner glowing core of `#00f3ff`.
- **Radio Reticle:** Concentric sharp octagonal or circular target bracket that displays an animated crosshair reticle when active.