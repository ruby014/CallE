# CallE Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a recognizable CallE favicon in the browser tab.

**Architecture:** A static SVG in `public/` contains the icon. The Vite entry HTML links that file as the page icon, so no runtime JavaScript or dependency is involved.

**Tech Stack:** SVG, Vite HTML entry point.

**Spec:** `docs/superpowers/specs/2026-11-14-calle-favicon-design.md`

## Global Constraints

- Add no dependencies.
- Do not change the app UI, API, or runtime behavior.
- Use a CallE-green speech bubble with a white `C`.

## Review Focus

- A production build must retain the favicon asset and link.
- The SVG must use a view box so it remains legible at browser-tab sizes.
- The icon link must use a root-relative public path that Vite preserves in development and production.

---

### Task 1: Add and link the SVG favicon

**Files:**
- Create: `public/calle-favicon.svg`
- Modify: `index.html:7`
- Test: production build output

**Interfaces:**
- Consumes: Vite's public directory convention.
- Produces: `/calle-favicon.svg`, linked by the document head.

- [ ] **Step 1: Create the local SVG asset**

Create `public/calle-favicon.svg` with a square view box, a green speech-bubble shape, and a centered white `C` that remains clear at 16×16 pixels.

- [ ] **Step 2: Link the asset in `index.html`**

Add `<link rel="icon" type="image/svg+xml" href="/calle-favicon.svg" />` within the existing `<head>`.

- [ ] **Step 3: Build the application**

Run: `npm run build`

Expected: PASS, with `dist/calle-favicon.svg` and the icon reference in `dist/index.html`.

- [ ] **Step 4: Commit the implementation**

```bash
git add public/calle-favicon.svg index.html docs/superpowers/specs/2026-11-14-calle-favicon-design.md docs/superpowers/plans/2026-11-14-calle-favicon.md
git commit -m "feat: add CallE favicon"
```
