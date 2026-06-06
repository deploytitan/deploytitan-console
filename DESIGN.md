---
name: DeployTitan
description: Release coordination software for teams who want the sprint to end before dinner.
colors:
  surface: "#fafaf9"
  surface-alt: "#f5f4f1"
  ink: "#1a1512"
  ink-secondary: "#3d3530"
  ink-tertiary: "#6b6059"
  ink-quaternary: "#9e9189"
  line: "#e5e2dc"
  line-subtle: "#eeece8"
  primary: "#c9a84c"
  primary-light: "#e8d48b"
  primary-dark: "#a68a3e"
  primary-accessible: "#7a6530"
  signal-success: "#22c55e"
  signal-success-text: "#166534"
  signal-warning: "#f59e0b"
  signal-warning-text: "#92400e"
  signal-danger: "#ef4444"
  signal-danger-text: "#b91c1c"
  signal-deploy: "#3b82f6"
  signal-deploy-text: "#1d4ed8"
  dark-surface: "#0d0c0a"
  dark-surface-alt: "#161512"
  dark-ink: "#f5f4f1"
  dark-ink-secondary: "#c8c2b8"
  dark-ink-tertiary: "#8a8078"
  dark-ink-quaternary: "#4a453e"
  dark-line: "#2a2825"
  dark-line-subtle: "#1e1c19"
  dark-primary: "#d4b454"
  dark-primary-light: "#e8d48b"
  dark-primary-dark: "#c9a84c"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(3.25rem, 8vw, 6.2rem)"
    fontWeight: 500
    lineHeight: 0.92
    letterSpacing: "-0.055em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2.1rem, 4vw, 4rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.04em"
  title:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Instrument Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.08em"
rounded:
  micro: "1px"
  sharp: "2px"
  cta: "8px"
  card: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "40px"
  page: "48px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.cta}"
    padding: "16px 32px"
  button-primary-nav:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.sharp}"
    padding: "10px 20px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.cta}"
    padding: "16px 32px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.lg}"
  panel-muted:
    backgroundColor: "{colors.surface-alt}"
    rounded: "{rounded.sharp}"
    padding: "{spacing.lg}"
  summary-card:
    backgroundColor: "{colors.surface-alt}"
    rounded: "{rounded.card}"
    padding: "{spacing.lg}"
  cta-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "40px"
  status-badge:
    backgroundColor: "{colors.signal-success}"
    textColor: "{colors.signal-success-text}"
    rounded: "{rounded.micro}"
    padding: "2px 6px"
---

# Design System: DeployTitan

## 1. Overview

**Creative North Star: "The Instrument Panel, With Human Edges"**

DeployTitan should still feel like release infrastructure, but now the system makes a clearer distinction between machine surfaces and human decision surfaces. Structural UI stays sharp, dense, and exact. Conversion UI, summaries, and grouped content can soften slightly so the product feels usable and confident rather than severe.

The visual system is warm-neutral, amber-accented, and operational. It avoids both generic SaaS softness and macho DevOps theatrics. The result should feel like a control surface built by people who understand release work, not a marketing theme pasted onto an ops product.

**Key Characteristics**
- Warm paper-like neutrals instead of pure white
- One amber accent used sparingly for emphasis and state
- Dark charcoal primary CTA, not amber-filled CTA, for readable contrast
- Mixed corner system:
  - `2px` for operational UI, tables, dashboards, release panels, and status surfaces
  - `8px` for buttons and direct actions
  - `12px` for summary cards, CTA blocks, and approachable grouping containers
- Full-width layout is acceptable for operational sections where scanning benefits from more horizontal space

## 2. Colors

DeployTitan uses restrained neutrals with one precision amber accent and a small set of signal colors.

### Primary
- **Precision Amber** (`#c9a84c`, dark: `#d4b454`): focus states, active highlights, subtle blueprint motifs, rare accent moments
- **Accessible Amber** (`#7a6530`): small amber text on light surfaces

### Neutral
- **Bone White** (`#fafaf9`): default page surface
- **Cartridge Paper** (`#f5f4f1`): secondary surface and grouped sections
- **Deep Charcoal** (`#1a1512`): primary ink and primary button fill
- **Warm Ash** (`#3d3530`): body copy
- **Muted Ore** (`#6b6059`): labels and support text
- **Pale Ore** (`#9e9189`): low-priority metadata only
- **Fine Line** (`#e5e2dc`): main borders
- **Ghost Line** (`#eeece8`): subtle dividers

### Signals
- **Healthy Green** / `#166534` text
- **Warning Amber** / `#92400e` text
- **Danger Red** / `#b91c1c` text
- **Deploy Blue** / `#1d4ed8` text

### Rules
- Never use pure `#000` or `#fff`
- Amber stays rare
- Small text should prefer `ink-secondary`, `ink-tertiary`, or accessible signal text, not quaternary text unless it is truly low-priority

## 3. Typography

- **Display:** Inter, compressed and consequence-first
- **Body:** Instrument Sans, readable and un-fussy
- **Mono:** JetBrains Mono for machine-originated content only

### Hierarchy
- **Display:** hero statements and high-authority openings
- **Headline:** section titles
- **Title:** card and module headings
- **Body:** primary reading copy
- **Label:** system labels, statuses, integration strips, timestamps

### Rules
- Headlines should say the consequence first
- Body line length stays around 65 to 75ch where possible
- Mono is for the machine layer, not as decoration

## 4. Layout

DeployTitan no longer forces everything into a narrow centered stack. Use width intentionally.

- Full-width sections are encouraged for release tables, dashboards, pricing ladders, and comparison-style layouts
- Narrower text widths are still preferred for long reading copy
- Use asymmetry or split layouts where it improves comprehension
- Rhythm matters more than uniform spacing

## 5. Components

### Buttons
- **Primary CTA:** dark charcoal fill, light text, `8px` radius
- **Secondary CTA:** outline style, `8px` radius
- **Nav CTA:** can stay sharper at `2px` radius to match product chrome

### Panels
- **Operational panels:** `2px` radius, bordered, precise
- **Summary cards:** `12px` radius, more approachable, still restrained
- **CTA cards:** `12px` radius

### Status badges
- `1px` radius
- mono uppercase
- use accessible signal text colors

### Navigation
- Transparent at rest, lightly surfaced on scroll
- active state uses amber text or underline
- no decorative heaviness

### Motion
- Use reveal and state transitions sparingly
- Prefer opacity and transform
- Respect `prefers-reduced-motion`

## 6. Do's and Don'ts

### Do
- Use `2px` corners for machine-facing surfaces
- Use `8px` corners for buttons
- Use `12px` corners for summary and CTA containers
- Keep the product feeling engineered, but let key actions feel approachable
- Use full-width sections when the content benefits from it
- Keep CTA contrast strong, especially in light mode

### Don't
- Don’t make every surface equally sharp
- Don’t flood the UI with amber
- Don’t use rounded-everything SaaS softness
- Don’t use glow-heavy DevOps clichés
- Don’t let low-contrast metadata take over light mode
- Don’t use decorative complexity where a clear operational layout would do better
