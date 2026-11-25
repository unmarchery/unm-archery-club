---
name: design-md-palettes
description: Pick a colour palette and design language from a library of 84 DESIGN.md analyses of well-known sites (Stripe, Linear, Apple, Notion, Spotify, Ferrari, Claude and more), then apply its colour tokens, type, spacing and components to a website or UI. Use when the user wants palette options, wants their site to feel like a named product, or asks for a DESIGN.md.
---

# DESIGN.md Palettes

A library of 84 design-system write-ups (from VoltAgent's awesome-design-md, MIT). Each file in `designs/` holds one site's colour palette with named roles (primary, ink, canvas, hairline, semantic), typography, spacing, radius, elevation, components, do's and don'ts, and responsive rules. `catalog.md` lists every design with its mood and first key colours.

## Workflow

1. **Read the brief.** Note what the site is, who it is for, light or dark, and the mood the user wants. If they named a product ("like Linear"), go straight to that file.
2. **Shortlist from `catalog.md`.** Read only the catalogue first, not the design files. Pick 3 designs whose mood fits the brief, and include one less obvious choice so the options really differ.
3. **Show the palettes and let the user choose.** For each option give the file name, a one-line mood, and its core palette as swatches: primary, primary-active, ink, body, canvas, surface, hairline and any accent, each with hex and role. Where the chat can render it, draw the swatches visually. Ask which one, or whether to blend (for example one design's palette on another's layout).
4. **Open only the chosen file.** Read `designs/<name>.md` in full.
5. **Apply it as tokens.** Turn the palette into CSS custom properties named by role (`--color-primary`, `--color-ink`, `--color-canvas`…), and do the same for type scale, spacing, radius and shadows. Use roles in components, never raw hex. Follow the file's component specs and its do's and don'ts.
6. **Check contrast.** Body text against canvas should meet WCAG AA (4.5:1) and large text 3:1. If a role pair fails in the user's use, darken or lighten it slightly and say so.
7. **Optionally hand over a DESIGN.md.** If the user wants to reuse the system, write a `DESIGN.md` for their project from the chosen file, renamed to their brand and limited to what they use.

## Keep it inspired, not copied

These are style references. Use the palette, rhythm and component feel, but:
- Never put the real company's name, logo, wordmark, mascot or product imagery on the user's page, and never make a page that could pass as that company's site.
- Proprietary fonts (Söhne, SF Pro, Circular, BMW Type…) may not be licensed for the user. Use the substitute the file names under its font notes, or a close free font from Google Fonts.
- Swapping one accent hue for the user's own brand colour is encouraged. Keep the file's role structure and contrast relationships when you do.

## Working with other design skills

If another design skill is driving the build (taste-skill, frontend-design-anchors, UI/UX Pro Max), use this library as the palette source when the user asks for it, and let that skill handle layout and process. If that skill locks its own palette and the user chose one from here, the user's choice wins.
