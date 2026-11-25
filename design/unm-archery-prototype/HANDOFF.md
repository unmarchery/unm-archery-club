# UNM Archery Club: design handoff for Claude Code

> **Paste this to your Claude Code to start:**
>
> "Read `design/unm-archery-prototype/HANDOFF.md` from start to finish before you touch any code. It describes a finished, approved design for our site: a landing page, a shop page and a Book a session page, built as a static prototype in that folder. Your job is to bring that design into our existing Next.js site and then extend it to the remaining pages. Keep all our working functionality (auth, booking, ranking data, admin). Change the look and the motion only, and improve them where the handoff says so. Before each piece of work, give me a short plan (5–10 lines). After each piece, send me the review checklist from section 9 with screenshots."

This file is written for an AI coding agent (Claude Code). Everything here was decided with the club's designer in one long working session. **Where two notes disagree, the later decision wins. Section 7 lists the decisions in order.**

---

## 1. What you are working on

- **The real site:** https://unmarchery.netlify.app/ (Next.js). It already works: pages, auth, booking, ranking and the hidden mod/admin pages all function. **Do not rebuild the logic. Restyle it and improve the UX.**
- **The approved design:** a static HTML/CSS/JS prototype, so there is no build step. It covers:
  - `index.html`: the landing page (approved)
  - `shop.html`: the shop page (approved)
  - `samples/`: saved component ideas
- **Your work:**
  1. Bring the design system into the Next.js app.
  2. Replace the current landing page and shop with the approved versions.
  3. Apply the same system to the remaining pages: Ranking, Sign up / Sign in, Book a session, FAQ and the hidden mod pages.
  4. Build the phone item pages for the shop.

### Getting the files: everything is in the zip
The designer sends `unm-archery-handoff.zip`. Unzip it and put the `unm-archery-prototype/` folder into the repo as **`design/unm-archery-prototype/`**. **This markdown file is the guide. The code files in that folder are the source of truth** for every style, animation and effect. When this doc and the code disagree on a detail, copy the code.

What's in the folder:
- **The working prototype:** `index.html`, `shop.html`, `styles.css`, `main.js`, `components/`, `palettes/`, `samples/`, `versions/`. Every animation and effect is here as plain CSS/JS that you can read and port.
- **`assets/`:** the hero video, poster, logo, arrow cut-outs and merch photos. Copy these into `public/`.
- **`references/`:** what the design was built from. The designer's layout sketch (PDF), the footer-ribbon and CRT-plasma inspiration videos, the arrow reference renders, the Robin Hood merch posters (with prices), and screenshots of the two shop inspirations (hjeunecrack.fr/boutique for the arrangement, voltlites.com/gear for the card hover).
- **`skills/`:** the design skills the designer uses, ready to drop into the repo's `.claude/skills/`. See `skills/README.md` (two more are installed from their plugin sources).

Nothing is fetched from outside except Google Fonts.

**To view it:**
```
npx --yes http-server@14.1.1 design/unm-archery-prototype -p 5180 -c-1
```
Then open http://localhost:5180/ (landing) and http://localhost:5180/shop.html. It also opens straight from the file system (double-click), with one difference: the ambient fade falls back to a fixed colour, because a canvas can't read the video from `file://`.

### File map
| Path | What it is |
|---|---|
| `index.html` | Landing page markup: hero, ambient fade, Events, arrow divider, Join Club, arrow divider, Weekly Sessions, ribbon footer |
| `shop.html` | Shop markup: header, Passes (guest view), three collections, end-of-merch rule, item pop-up, cart |
| `book.html` | **Book a session**: card reader + member/guest card, day cards with hour slots, booking pop-up, enlarged card with My bookings, cancel confirm |
| `styles.css` | Global tokens, buttons, top bar, hero, ambient, sections, carousel, arrows, perks, marquee, footer |
| `components/shop.css` | Shop page styles: CRT bands, grid, item card, quantity stepper, pass tickets, end rule, cart, pop-up |
| `components/booking.css`, `components/booking.js` | Book a session styles and behaviour |
| `components/view-mode.js` | **Prototype only.** The "View as Member / Guest" switch and a mock account (bookings, passes) kept in localStorage so Shop and Book agree. In the real site this comes from the signed-in account |
| `components/shop-sign.{css,js}` | **Shop sign**: the neon ASCII-frame section title (landing sections and the SHOP header) |
| `components/crt-title.{css,js}` | **CRT ASCII band**: the canvas terminal title with light-wave sweeps (shop collection bands) |
| `main.js` | All page behaviour, guarded so each block runs only when its markup exists |
| `palettes/f3-visor-mist.css` | **The chosen palette** (load it before the styles). The other palettes are alternatives that were not chosen |
| `palettes/v1-forest-paper.css`, `versions/v1-forest-paper/` | The original round-1 look, kept so the team can switch back |
| `samples/shop-sign.html`, `samples/crt-title.html` | Pages for each component, with palette and replay controls |
| `assets/hero-loop.mp4` (+ `hero-poster.jpg`) | The hero animation (H.264, no audio, 4.5 MB, 9 s loop) |
| `assets/arrows/*.png` | Five transparent arrow cut-outs for the dividers |
| `assets/bows/*.webp` | Barebow, recurve and compound cut-outs (Join Club showcase) |
| `assets/passes/*.svg` | Hour pass and Day pass ticket art (our own design: gold tickets, washi stub with barcode, a target with arrows; no text inside the art) |
| `assets/merch/*.jpg` | Shop photos (see `assets/merch/CREDITS.md`) |
| `assets/logo.png` | The club logo |

---

## 2. Skills the designer works with: load them if you have them

They're bundled in `skills/`: copy them into `.claude/skills/` (see `skills/README.md`), then load the relevant ones before design work:

| Skill | Used for |
|---|---|
| **impeccable** | Main design brain: polish, critique, animate, audit |
| **emil-design-eng** (anthropic-skills) | Microinteractions: press and hover states, easing, enter and exit, clip-path tricks |
| **ui-ux-pro-max** | Palette, contrast and touch-target checks |
| **design-taste-frontend** (taste-skill) | House rules against generic templates: a quiet hover and press on every button, one entrance moment per page, equal side margins |
| **design-md-palettes** | How the palettes were built: role tokens (canvas / surface / ink / primary …) |
| **lemo-opuscar → "CRT ASCII Terminal" style** | The CRT look: phosphor ramp, scanlines, glyph density ramp `$@&%#0=+:-.` |
| **karpathy-guidelines**, **writing-plans**, **verification-before-completion**, **systematic-debugging** | How to work: small surgical changes, plan first, prove it works |

**If you don't have them, this document is enough.** Every rule that mattered is written out below. Do not pull in other design systems or aesthetics: they would override the approved look.

---

## 3. The look in one paragraph

**Futuristic Japanese forest, meeting archery and robotics.** A night-forest green page; warm, unbleached-paper text; torii-gate vermilion for actions; the cyan of the robot archer's visor for light and focus; target gold for prices and highlights. Section titles are neon ASCII shop signs. Shop collections open with CRT terminal bands, glyph text that a light wave switches off and back on. The hero is the club's own cinematic loop (a robot archer in a Japanese forest with a torii gate). The motion is calm and physical: liquid button fills, a gentle 3D tilt, arrows that flex in flight, glows that breathe. It is **spacious and precise**, never crowded.

---

## 4. Design tokens: copy them exactly

### Colour (palette F3 · Visor Mist; `color-scheme: dark`)
| Role | Hex | Use |
|---|---|---|
| `--canvas` | `#08130e` | Page background (night forest) |
| `--canvas-2` | `#050d09` | Deepest areas, footer, pop-up |
| `--surface` | `#0f2119` | Cards |
| `--surface-2` | `#163024` | Raised and art panels |
| `--hairline` | `#22402f` | 1px borders and rules |
| `--ink` | `#f1efe4` | Main text (kinari) |
| `--body` | `#aab8a5` | Paragraphs |
| `--muted` | `#8a9b84` | Labels, meta |
| `--primary` | `#c4421f` (hover `#d4502b`), text `#fff` | Torii vermilion: CTAs, the cart |
| `--accent` | `#5fe3d6` | Visor cyan: focus rings, links, glows, "Now on" |
| `--gold` | `#e3b955` | Prices, the RM30 perk, sign bolts |
| `--sign-tube` / `--sign-frame` / `--sign-stud` | `#5fe3d6` / `#ff6a3d` / `#e3b955` | Shop-sign letters / frame / bolts |
| `--crt-glass/off/1/2/3/4/scan` | `#030906 / #183a33 / #0b4a48 / #1c8f88 / #5fe3d6 / #e9fffb / #ff7a4a` | Default CRT ramp |

**Event colours** for the shop collections. Each is a class that sets the CRT ramp, the wave colour and `--glow` (an RGB triple):
- **Robin Hood (green):** ramp `#0f5a2e → #2f9a4a → #8fe36a → #efffd6`, wave `#d8ff8a`, glow `128 228 112`
- **Cupid's Valentine (pink):** ramp `#6b1840 → #d43a7a → #ff86b6 → #fff0f6`, wave `#ffd1e4`, glow `255 128 180`
- **Club Merch (navy):** ramp `#142a66 → #2f5bd0 → #7fa8ff → #eef4ff`, wave `#9fe8ff`, glow `120 158 255`

**Contrast** was checked to WCAG AA: ink, body and muted text on canvas and surface, and white on primary. Keep it that way. A glow colour never carries body text on its own.

### Type
- **Display:** Archivo, weight 850–900, *narrowed* (`font-stretch` 72–88%) for headings. The hero is 850 / 72% with line-height .98.
- **Body:** Atkinson Hyperlegible Next 400/500/700, 17px base, line-height 1.55.
- **Terminal labels:** VT323 for dates, tags, prices, counts and sign frames.
- **Inside CRT canvases:** JetBrains Mono 800.
- **Next.js:** load all four through `next/font/google` (Archivo with the `wdth` axis).

### Motion
- **Easing:** `--ease-out: cubic-bezier(.16,1,.3,1)`, `--spring: cubic-bezier(.34,1.56,.64,1)`.
- **Durations:** UI 150–400 ms; reveals 0.7–1.3 s.
- **Press:** every button scales to `.97` on `:active`.
- **Performance:** animate only `transform` and `opacity` (plus canvas). Pause everything that's off screen (IntersectionObserver).
- **Reduced motion:** honour `prefers-reduced-motion`. Draw a single still frame, with no flicker, sparks, tilt or marquee motion.

### Layout
- `--bar-h: 72px` · `--gutter: clamp(16px, 4vw, 56px)` · `--maxw: 1240px` · card radius 18–28px · pills `999px`.

---

## 5. Components: what each does, and the rules it must keep

Each one lives in the prototype; read its CSS/JS before porting it. The React ports will be client components (`'use client'`) that set up observers and requestAnimationFrame in `useEffect` and **clean them up on unmount**.

1. **Top bar.** Thin glass over the hero video (`#08130e14` with `blur(14px)`), turning solid dark glass once the hero leaves view. Nav links get an underline that draws in (cyan). **The current page is shown in cyan with its underline drawn, on every page** (`.nav__link.is-active` lives in the shared stylesheet, not in a page-specific one; round 7 fixed Book a session showing no mark).
   - **Landing scroll stops (round 7):** `scroll-snap-type: y proximity` on the landing only. The hero and each section sign are snap points, and a sign settles just under the nav (`scroll-margin-top: bar height + 12px`). Mouse-wheel scrolling then rests at a clean height for Events **and** Join Club; proximity (not mandatory) so it never fights the reader.
   - Join Club = glass pill. Its hover fill is **cyan with dark text**.
   - Sign In = light pill.
   - Hover text must never be the same colour as its fill. This happened once: an invisible "Join Club" label.
2. **Liquid button** (`.btn` + `data-liquid`). A circle fill wells up from the point where the pointer enters, and the arrow nudges right. Variants: primary (vermilion), light (kinari), glass, order (event colour). The magnetic pull applies only to the main CTA and only with a fine pointer.
3. **Hero.**
   - The video sits on a "stage" that copies `object-fit: cover`, biased left so the arrow stays in shot.
   - The headline "Aim, / Hit, / and Never Quit" and the **Book a session** button form one block, placed in video coordinates: left 6.2% of the stage, top 20.5%. They sit left of and below the arrowhead where it slows down.
   - **They fade in once, when the video reaches 2.6 s** (the start of the slow motion), and stay through later loops.
   - On portrait screens the block moves to the bottom-left instead.
   - Use `overflow: clip` (not hidden) on the hero. In-page links scrolled a hidden box and left a strip at the bottom.
4. **Ambient fade.**
   - A band that starts ~34svh up inside the hero and runs below it. It takes the video's live bottom-edge colours (sampled 4× a second from a 24×2 canvas) and dissolves them into the page.
   - A blur sits only over the video part.
   - No arrow divider directly after it.
   - Mask stops must stay in order, or you get a hard edge.
5. **Shop sign** (`components/shop-sign.*`), the title for every landing section and the SHOP header.
   - An ASCII frame (`*`, `=`, `|`, `o` bolts, a `[ 01 · TAG ]` label in the top edge) in torii neon, with outlined Archivo letters in cyan neon.
   - **Power-on once** when it scrolls into view: the frame lights in a sweep, then each letter flickers on, then a hum.
   - **Every 6–14 s** one letter (sometimes two) or a stretch of frame shorts out, and a few sparks fall from it.
   - **All signs on a page share one size**, set by the longest title.
6. **CRT ASCII band** (`components/crt-title.*`), the shop collection title and divider.
   - Full width, `clamp(90px, 15svh, 130px)` tall, **sticky under the nav for the whole of its section** (the next band takes over), so it can never be half hidden.
   - The title is set in glyphs coloured by density. The glyphs never move; only the light shimmers.
   - **Every 9–16 s a vertical light line sweeps left to right and switches the block off**, then a second sweep switches it back on. The first view powers on with the "on" sweep.
   - A column switched off keeps a short 160 ms phosphor afterglow. The sweep only ends once its trail has left the box. Both were bugs once: letters stayed lit.
7. **Events carousel.**
   - Borderless cards. The centre card is full size; the side cards are smaller, a little dimmer, and fade out at the edges through a mask.
   - Each card: text on the left (status badge, date, title, short description, a Time / Venue / X info row); artwork on the right.
   - Under the centre card: ‹ previous · ⤢ open event · › next. It loops (with fewer than 5 events, copies are added so the wrap is never seen), and works by swipe and by ← → keys.
   - **The title, cards and controls must fit one screen.** Heights use `svh` and clamp.
   - Do **not** put `backdrop-filter` on the cards inside the masked viewport. Chrome paints dark bands; this was a real bug.
   - Current content: **Robin Hood Shoot (now on)**, **Ranking Match Round 1 (upcoming)**, **Cupid's Valentine Shoot (upcoming)**.
   - **Under-glow:** a blurred light pool sits behind the centre card in that event's colour (Robin Hood green, Ranking gold, Cupid pink). It follows the carousel and breathes slowly.
   - Gaps around the arrow dividers: `clamp(40px, 5.2vw, 80px)` below the section before a divider and `clamp(28px, 4vw, 56px)` above the section after it (round 6 doubled them).
8. **Arrow dividers.**
   - Three lanes. **At most 4 arrows in view.**
   - Arrows fly at a **steady linear speed**, left to right in the first divider and right to left in the second. A slow-motion version was tried and rejected because it "keeps stopping".
   - They are real cut-out arrows (`assets/arrows`), each with a light trail in its colour and a slight flex in flight. They pause when off screen.
9. **Join Club perks** (approved). "Perks:" label, a 2×2 grid: Unlimited sessions · Ranking system unlocked · Coaches on the line · **RM30** for the whole academic year. On hover a spotlight follows the pointer, the border lights up, the card lifts and the icon tilts. A centred Join Club button follows.
   - **Bow showcase behind the right side** (round 5). The layout stays as above; a bow sits behind the right-hand perk cards, which overlap it (the cards are glass).
     - It cycles **Barebow → Recurve → Compound**, one at a time, about 3.6 s each, with a crossfade and a short slide, and floats gently. **No label, title or dots.**
     - **Scroll-linked:** it slides in from the right as Join Club arrives and slides out to the left as the section ends, reversing when you scroll back up.
     - The section clips horizontally, or the waiting bow causes sideways scroll. Static under reduced motion.
10. **Weekly Sessions marquee.**
    - Info cards (When / Venue / Members / Guests / Beginners; no Gear card) slide right to left **without stopping, even on hover**.
    - Enough copies are added that a gap never shows on wide screens.
    - A Book a session button sits centred below.
11. **Ribbon footer.** A wavy cyan band with "AIM, HIT, AND NEVER QUIT ✦ JOIN THE CLUB ✦ WEEKLY SESSIONS · TUE & THU ✦ BE PART OF US ✦" moving along the curve (SVG `textPath`, `startOffset` loop), with the brand and links below.
12. **Shop page.**
    - **Arrival:** the SHOP shop sign (round-5 size: `clamp(32px, min(3.75vw, 6.9svh), 61px)`) with the item count, and modest gaps: `clamp(20px, 4.5svh, 55px)` below the nav and `clamp(22px, 4.5svh, 55px)` above the first band. The count follows the view and **the cart pill on the same line, right-aligned and vertically centred**. Then the first CRT band and the first row of merch, cut off at the bottom so visitors know to scroll.
    - **Grid (round 6): minimalist and ruled.** Cells share 1px hairline borders like a spec sheet (no gaps, no shadows, no tilt): **4 across, then 3 (≤1180px), 2 (≤860px), 1 (≤540px)**.
    - **Card = picture + centred name + centred price, nothing else.** A square photo (rounded 14px) with the tag (Pre-order / Coming soon / Guests) in its corner, then the name in Archivo 850 condensed uppercase, then the price in VT323 in the event colour. Hover: the cell lights from the pointer in the event colour, its hairline lights up, the photo zooms to 1.05. The whole cell is one button that opens the pop-up.
    - **Buying lives in the pop-up:** quantity stepper [− n +] and Add to cart sit at the bottom right of the item pop-up (Add to cart gets focus when it opens). The cart count goes up by the quantity; the flying dot shows "×n".
    - **Cart:** a vermilion pill with a glowing cyan count and a soft pulse. Once the header scrolls away it **floats fixed under the nav at the right**. "Order" sends a glowing dot in the event colour along an arc into the cart; the cart bumps and the count goes up.
    - **Item pop-up (tablet and desktop):**
      - It grows out of the clicked card, with the backdrop blurred.
      - Left panel: the photo, large and never cropped (a blurred copy of the same photo fills the panel).
      - Right panel: tag, name, short description, a spec list, then the price and an **Add to cart** button at the bottom right.
      - It closes with ✕, Esc or a backdrop click.
      - Add to cart closes the pop-up, then flies the dot.
    - **Phones:** tapping an item goes to **its own item page** (e.g. `/shop/robin-hood-tee`), not the pop-up. Build these pages in the same style.
    - **No search, filters or categories.** There aren't enough products to need them.
    - **CRT bands** are `clamp(72px, 12svh, 104px)` tall.
    - Collections in order: **Passes** (guests only; gold band with slimmer lettering, `data-font="slim"`; Hour pass RM5 and Day pass RM12 as ordinary item cards using the ticket art), **Robin Hood** (5 items, pre-orders open), **Cupid's Valentine** (9), **Club Merch** (2). Members never see Passes; their sessions are free.
    - **End of merch:** a calm VT323 rule before the footer, `[ END OF MERCH · SEE YOU ON THE LINE ]`, with a blinking cursor and a slow cyan glint along a double line.
13. **Book a session** (rounds 5–6, from the live booking system; keep its rules and data).
    - **Top bar:** signed in, so the right side is the account chip from the live site (avatar initials, name, a small bar with **∞** for members or the pass count for guests). It opens the card.
    - **Header:** the shop-sign title "BOOK A SESSION" (same size as the SHOP sign) and, instead of a paragraph, a **schedule rail**: three stops on one lit line like a route map, `every Tue & Thu — 4pm–7pm — at Sports Complex`, each with a drawn icon in a glowing ring (calendar, clock, pin), a pulsing live dot at the start and a light travelling along the rails. Archivo 800 condensed, larger than body copy. The live site's long line and the "Member · Every session is free for you" box are gone.
    - **Card + reader (right of the title):** a **card reader drawn in SVG**, anchored to the window's right edge so only its left half shows (LCD `TAP ▸ / READY`, pulsing status light, contactless symbol). Beside it the user's **card**, credit-card shaped (1.586).
      - **One layout for both cards (round 7).** The same six rows, in the same place, for member and guest: (1) logo + **"UNM ARCHERY CLUB"** + chip, (2) `@username`, (3) tier line **"MEMBER · 2026/27"** / **"GUEST · 2026/27"**, (4) the meter, sitting at the same height in both, (5) a one-line note, (6) **My bookings: N**. Only the colours and the meter differ.
      - **Member:** cyan glass. Meter = a **smooth, fully charged bar** (one continuous gradient, no segments; a bright surge runs through every 2.4 s and the glow pulses slowly) with **∞**. Note: "Unlimited sessions, free all year".
      - **Guest:** gold variant. Meter = **passes inventory** (Hour pass N, Day pass N, each **+** opens the shop's Passes). Note: **"Pay less, shoot more"** in the card's gold, bold.
      - **Motion:** three layers. The card **faces the pointer** on hover (3D tilt up to ~9° plus a light under the pointer; no jump). It drifts very slightly at rest. **Every 9–14 s it goes to tap the reader** (slides and tilts onto the pad, holds) and the reader **approves**: green light, a drawn tick on the screen, a green ring off the pad. Then the card returns. No tap while hovered, while a dialog is open or when the header is off screen. Off under reduced motion.
      - **Click the card:** it grows to the centre (FLIP), the page blurs, and **My bookings** lists date, time, slot, equipment and **Cancel**. Cancel always asks first. The prototype refunds a guest's pass on cancel (a Day pass for a whole day); confirm that rule with the exco.
    - **Days:** "Days 1–2 of 2" with ‹ ›, then day cards: date, a 4–7pm pill, three hour rows (time, "N slots remaining" with a capacity bar, an action).
      - **Free slot:** **Book**.
      - **Booked slot:** the row **charges up left to right** (a cyan fill grows across, then a vertical light line keeps sweeping across it), a "Booked · Club bow · Right · 18 lbs" line with a drawn tick **in place of** "N slots remaining" (one line, ellipsis if narrow), so **a booked row is exactly as tall as the others**, and an **Edit** button. No coloured side border.
      - **Footer:** members see only **Book the whole day** (the "All three hours, free." text is gone); guests also see "RM5 an hour, or one Day pass for all three". When all three hours of a day are booked, the button becomes **Cancel whole day booking** (asks first, cancels all three).
    - **Booking pop-up:** a **page-level `<dialog>`**; never render a pop-up inside a card or an overflow container (the live site's bow pop-up was trapped and clipped inside the day card).
      - **Only the live site's options:** Equipment (Club bow / Own bow), Right / Left-handed, Draw weight 14 / 18 / 20 / 22 / 24 lbs / Not sure (club bows only) with the note "This is a preference. Club bows are shared, so it isn't guaranteed.", and the amber **no-show warning**. No bow-type picker.
      - **Book mode:** the title is the session, a price chip ("Free for members" / "Uses 1 Hour pass · you have N"; with 0 passes the button becomes **Get passes**), **Confirm booking**.
      - **Edit mode** (from **Edit**): "Edit · Tue 24 Nov · 5–6pm", the booking's settings preselected, **Cancel this slot** (asks first) and **Save changes**.
      - **On confirm / save:** "Booked" / "Saved", then counts update and the card bumps; a guest uses a pass.
14. **View as Member / Guest switch (prototype only).** A small dashed pill at the bottom-left of Shop and Book, plus `?view=guest|member` in the URL. **Do not ship it**: in the real site the view comes from the signed-in account and its membership status.

---

## 6. Content and assets: what's real and what's placeholder

- **Real:**
  - The hero video and logo.
  - Training is Tue & Thu, 4–7pm, at the Sports Complex. Members train free; guests pay RM5/hour or RM12/day; membership is RM30 for the academic year.
  - The Robin Hood merch photos and prices are from the club's own posters: tee RM35 (S–XL, cotton blend, beige), keycap RM15 (Cherry profile, dye-sublimated), keychain RM12 (enamel, approx. 4 cm).
- **Placeholder:**
  - Event dates and descriptions.
  - Cupid and Club merch items and prices.
  - The **Cupid and Club photos are Unsplash stand-ins** (`assets/merch/CREDITS.md`). Replace them with real product photos.
- **Licensing:** the arrow cut-outs were taken from reference renders the designer supplied. Two (the yellow-vane arrows) look like retail product shots, so swap in owned or licensed images before launch.
- **Links:** every `#…` link without a matching target is a placeholder. A click guard stops it jumping the page. Wire them to real routes.

---

## 7. Decisions, in order (later ones win)

1. Keep the live site's layout and spirit. Improve the components, interactions, motion and palette.
2. The hero is the club's loop video, full screen, with the nav as see-through glass over it. Headline "Aim, Hit, and Never Quit" on three lines, next to and under the slowing arrow. One CTA, Book a session. Both reveal once, at the slow motion.
3. The page is **dark forest** below the hero.
4. The palette is built from the animation plus Japanese traditional colours. **F3 · Visor Mist was chosen.** The v1 forest/paper look is kept so it can be restored.
5. Section titles: the CRT title was tried, then a **shop sign was chosen for the landing sections**. The CRT design moved to the **shop collection bands**.
6. Every section must fit **one screen**, title included, at the designer's window: **about 1277×630 CSS px** (a 1920×1080 screen at 150%). All title cards are the same size.
7. **No arrow divider after the ambient fade.** Arrow dividers: Events→Join and Join→Weekly. Steady flow, at most 4 arrows, 3 lanes, real arrow images.
8. Weekly Sessions: no Gear card, never pauses, plus a Book a session button.
9. Shop: spacious, a neat 4/3/2/1 grid, sticky event bands, the cart in line with the SHOP sign and floating under the nav once you scroll, real photos, a two-panel pop-up, item pages on phones.
10. **Never sign in to the live site with anyone's credentials while working.** Use test accounts on local or staging builds only.
11. Round 5: SHOP title +15% from its reduced size, gaps around it halved; bands 20% shorter than round 4; quantity steppers; Passes for guests; 5 more Cupid items; end-of-merch rule.
12. Round 5, landing: event under-glow; tighter divider gaps; Join Club keeps its original layout with the bow showcase behind the right-hand cards (no captions or dots); every Book a session link goes to the booking page.
13. Round 5, Book a session: the live system's content and rules in our design; card reader + floating member/guest card; enlarged card with bookings and cancel; the booking pop-up as a page-level dialog (fixing the live clipping bug).
14. Round 6, Shop: minimalist ruled grid; cards show only picture, name and price; quantity and Add to cart only in the pop-up; Passes are ordinary cards with our own ticket art; slimmer lettering on the Passes band.
15. Round 6, landing: the gaps around the arrow dividers doubled.
16. Round 6, Book: schedule rail instead of the paragraph and member box; card titled MEMBER / GUEST CARD; charged energy bar; pointer-facing tilt; periodic tap with reader approval; booked rows charge with a light wave; Edit replaces Book again; only the live options (no bow-type picker); Cancel whole day booking; no "All three hours, free." text.
17. Round 7, Book: card title back to UNM ARCHERY CLUB with a MEMBER / GUEST · 2026/27 tier line; member and guest cards share one row layout; smooth bar (no segments); guest note "Pay less, shoot more"; booked rows keep the normal row height; the nav marks Book a session as the current page. Card robustness: the reader never takes clicks, a pointer on the card cancels any running tap, taps pause while the tab is hidden, and closing the enlarged card always shows the small card again. Landing: proximity scroll snap so wheel scrolling rests cleanly at Events and Join Club.

---

## 8. What to do next (in this order)

0. **Map the repo.** List the existing routes, layout, components, styling approach (Tailwind? CSS modules?), fonts and the auth and data layer. Write a 10-line summary and a migration plan, and show them to the designer before you change anything.
1. **Foundation.**
   - Put the tokens (section 4) into the global CSS as custom properties, load the 4 fonts with `next/font`, and copy `assets/` into `public/`.
   - Port the shared pieces as React components: TopBar, LiquidButton, ShopSign, CrtBand, ArrowDivider, RibbonFooter, TiltCard, Modal, Cart (with a context for the count).
   - Keep them SSR-safe: canvas, observer and video code runs only on the client.
2. **Landing page.** Replace the current one with `index.html`'s structure and behaviour, pixel-faithful. Check it against the prototype side by side at 1277×630, 1440×900 and 390×844.
3. **Shop page and item pages.** Port `shop.html` (Passes show only for guests, from the account role). Connect the real cart if one exists; otherwise keep the look-only cart. Add `/shop/[slug]` item pages for phones, using the pop-up's layout stacked: photo, then details, then a sticky Add to cart.
4. **Pending pages.** Bring each into the system, **keeping its logic and data untouched**:
   - **Ranking:**
     - Shop-sign title.
     - A top-3 podium (gold / kinari / vermilion, like the "Ranking Match" event art).
     - The full table as glass rows with VT323 numbers and score bars, and the signed-in member's row glowing cyan.
     - Optionally a CRT band per category (for example Recurve / Compound / Beginner), each with its own colour.
     - Counts animate once on first view.
   - **Sign up / Sign in:**
     - A dark glass card centred over a dimmed, blurred frame of the hero video (the poster image is fine).
     - Shop-sign title.
     - Inputs on `--surface` with a hairline border that turns to a cyan focus ring.
     - Vermilion liquid primary button, and clear error states in vermilion text with an icon.
     - The Student ID field stays as it is in the current system.
   - **Book a session:** now designed: port `book.html` (component 13) onto the existing booking logic. Wire the card to the real account (role, passes, bookings), the slots to real capacity, Book/Cancel to the real endpoints, and remove the prototype view switch.
   - **FAQ:** shop-sign title, then an accordion of glass rows. The arrow icon rotates; open and close use height plus fade with `--ease-out`.
   - **Hidden mod / admin pages:** the **same tokens and fonts, calmer**. No video, signs, sparks or marquees. A small CRT band is allowed as a page header. Use dense, readable tables on `--surface`, VT323 for IDs and numbers, and vermilion only for destructive actions. Keep every control and permission exactly as it is.
5. **Polish pass** with the impeccable skill if you have it:
   - Accessibility: focus order, labels, contrast, reduced motion.
   - Performance: lazy-loaded images, videos and canvases that pause off screen, no layout shift.
   - Re-check every page with the checklist below.

**Golden rule:** this is a design-layer job. If a change would alter behaviour, a data flow, an API call or a permission, stop and ask.

---

## 9. How the designer reviews your work: check this yourself before you report

The designer reviews by **looking at screenshots of their real window**: about **1277×630 CSS px** (a 1920×1080 screen at 150% zoom), plus a phone. Run this checklist on every output, and include the screenshots in your report.

**Fit and space**
- [ ] At 1277×630, does each section show its **title, its content and its controls** in one view, with nothing cut off when you stop scrolling at a section?
- [ ] Is the title ever **half hidden** under the nav? It must not be: use sticky titles or `scroll-margin-top`.
- [ ] Is the spacing intentional, **spacious and precise**? No cramped stacks under the nav, and even gaps.
- [ ] Are cards in a grid the same size and aligned (unless the design says otherwise)?

**Readability and states**
- [ ] Hover, focus and pressed states on every button: is the label still readable on its fill? Check every variant.
- [ ] Contrast is AA for text. Glows are decoration only.

**Motion**
- [ ] Does it run smoothly, with nothing stuttering, stopping or snapping where a flow was expected?
- [ ] Is it calm rather than busy? (At most 4 arrows, one entrance moment per page, waves and sparks only every few seconds.)
- [ ] Do animations pause off screen, and is there a still frame under reduced motion?
- [ ] Do animations end cleanly, with no leftover lit glyphs and no flash at loop seams?

**Robustness**
- [ ] No console errors. No sideways scroll at 1440, 1277, 1100, 820 and 390 widths.
- [ ] No visible seams or hard edges, especially on fades, masks and blurs. Avoid `backdrop-filter` inside masked containers.
- [ ] In-page links never jump the page; placeholder links are inert.
- [ ] Real functionality (auth, booking, ranking data, admin actions) still works after your change. Say how you tested it.
- [ ] Check **both views**: member and guest (Shop: Passes appear only for guests; Book: card, prices, pass use).
- [ ] Every pop-up opens centred on screen and is never clipped by a card. Book → options → confirm updates the counts; Edit → save / cancel slot; book a whole day → Cancel whole day booking; card → bookings → cancel asks first.

**Report format** (keep it short)
1. What changed, in one line per item, each with its file path.
2. What you verified, and how (sizes, interactions).
3. What you did **not** verify or what's still a placeholder, said plainly.
4. Screenshots at 1277×630 and 390×844 (plus 1440×900 for big layout changes).

**Working style the designer expects**
- **A brief plan before each piece of work.** For a new visual component, **show one finished sample first** (like `samples/shop-sign.html`) and wait for approval before rolling it out.
- When a liked idea is replaced, **keep it as a named sample** so it can come back (the "shop sign" was recalled this way).
- Keep earlier looks **switchable**: palettes as files, old versions in `versions/`.
- Be efficient with words and tokens. Ask only when a decision is genuinely the designer's to make.

---

## 10. Known gaps

- The reduced-motion paths are written but not visually checked.
- All checks so far were headless Chrome screenshots. Safari and Firefox were not checked; in particular `textPath` animation, `backdrop-filter` and `@property` transitions.
- Placeholder content: listed in section 6.
