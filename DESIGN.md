---
name: SkillMap
description: Plan the route from the skills you have to the role you want, set as a railway timetable with card tickets.
colors:
  rail: "#1f3c88"
  rail-deep: "#162c66"
  rail-ink: "#e8eefc"
  rail-ink-dim: "#aebce6"
  rail-tint: "#e3eafb"
  rail-wash: "#eef2fb"
  platform-mint: "#e6efe8"
  platform-line: "#cfdcd3"
  sheet: "#fbfcfb"
  sheet-alt: "#f2f6f4"
  hairline: "#c9d4e6"
  hairline-strong: "#8fa2c8"
  ink: "#142033"
  ink-2: "#3f4d63"
  ink-3: "#5d6b80"
  stock-salmon: "#f4c3ae"
  stock-mint: "#c3e3cd"
  stock-sky: "#c2dcf1"
  signal-green: "#237a4b"
  signal-green-bg: "#dcefe3"
  signal-green-ink: "#17583a"
  signal-amber: "#a86500"
  signal-amber-bg: "#fbecd0"
  signal-red: "#b8322a"
  signal-red-bg: "#f8dedb"
typography:
  display:
    fontFamily: "'Barlow Condensed', 'Barlow', system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  ticket:
    fontFamily: "'Barlow Condensed', 'Barlow', system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: 1.02
    letterSpacing: "-0.005em"
  headline:
    fontFamily: "'Barlow Condensed', 'Barlow', system-ui, sans-serif"
    fontSize: "23px"
    fontWeight: 700
    letterSpacing: "-0.005em"
  title:
    fontFamily: "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  station:
    fontFamily: "'Barlow Semi Condensed', 'Barlow', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
  body:
    fontFamily: "'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  body-small:
    fontFamily: "'Barlow', system-ui, -apple-system, 'Segoe UI', sans-serif"
    fontSize: "13.5px"
    fontWeight: 400
    lineHeight: 1.45
  figure:
    fontFamily: "'Barlow Condensed', 'Barlow', system-ui, sans-serif"
    fontWeight: 700
    fontFeature: "'tnum' 1, 'lnum' 1"
  label:
    fontFamily: "'Barlow Condensed', 'Barlow', system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    letterSpacing: "0.1em"
rounded:
  mark: "3px"
  chip: "4px"
  control: "6px"
  stub: "7px"
  sheet: "10px"
  round: "50%"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  sheet-x: "22px"
  gutter: "20px"
  page-x: "24px"
  section: "36px"
components:
  button-primary:
    backgroundColor: "{colors.rail}"
    textColor: "#ffffff"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.rail-deep}"
  button-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.rail-deep}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "34px"
  button-quiet-hover:
    backgroundColor: "{colors.rail-tint}"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 12px"
    height: "44px"
  chip:
    backgroundColor: "{colors.sheet-alt}"
    textColor: "{colors.ink}"
    rounded: "{rounded.chip}"
    padding: "3px 4px 3px 9px"
  mark-measured:
    backgroundColor: "{colors.rail-tint}"
    textColor: "{colors.rail-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.mark}"
    padding: "2px 7px"
  mark-estimate:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.mark}"
    padding: "2px 7px"
  sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sheet}"
    padding: "20px 22px"
  ticket-stub:
    backgroundColor: "{colors.stock-salmon}"
    textColor: "{colors.ink}"
    typography: "{typography.ticket}"
    rounded: "{rounded.stub}"
  timetable-header:
    backgroundColor: "{colors.rail-wash}"
    textColor: "{colors.rail-deep}"
    typography: "{typography.label}"
    padding: "10px 14px"
  topbar:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.rail-ink}"
    height: "56px"
  mini-ticket-held:
    backgroundColor: "{colors.rail}"
    textColor: "#ffffff"
    rounded: "5px"
    padding: "8px 12px"
  mini-ticket-learned:
    backgroundColor: "{colors.stock-mint}"
    textColor: "#10422b"
    rounded: "5px"
    padding: "8px 12px"
---

# Design System: SkillMap

## Overview

**Creative North Star: "Platform Timetable"**

A career plan printed the way Indian Railways prints a timetable and issues an Edmondson card ticket. The page is a mint-tinted platform; on it sit near-white timetable sheets ruled in fine blue hairlines, and on those sit card-stock ticket stubs in salmon, mint and sky. A rail-blue bar runs across the top. Everything the visitor reads is either a sheet (information laid out in columns) or a ticket (something they hold, or will hold once learned).

The system is an operating tool, not a showcase: dense, tabular, legible at arm's length. One superfamily, Barlow, does all the work, and its three widths carry the hierarchy: Barlow Condensed for heads, ticket skills, labels and figures; Barlow Semi Condensed for titles, station names and marks; Barlow at normal width for prose. Colour is strictly role-bound. Rail blue is structure and action, card stock is possession, and the three signal colours carry state and nothing else.

The second load-bearing idea is provenance. Every figure is visibly either measured (counted from real postings: solid ink, solid MEASURED mark) or an AI estimate (italic, dashed AI ESTIMATE mark, a dagger †, dashed bars). The two never look alike.

**Key Characteristics:**
- Mint platform ground, near-white sheets, blue hairline rules, rail-blue shell.
- Barlow only, in three widths (Condensed, Semi Condensed, normal); condensed sets heads, labels and figures; tabular lining numerals for every number.
- Ticket stubs with perforation notches and a conductor's punch hole cut by masks, not drawn.
- Timetable tables with a double-ruled header that collapse to stacked entries on phones.
- Measured vs estimate is a visual grammar: solid vs dashed, roman vs italic, plain vs †.
- Soft, cool, ambient shadows; no hard offsets, no gradients on surfaces.

## Colors

A cool railway palette: deep rail blue over pale platform mint, with warm-to-cool card stocks as the only saturated fields and signal lamps reserved for state.

### Primary
- **Rail Blue** (`rail`): the top bar, primary button, focus outline, link colour, active tab underline, timetable header double rule, route-map track and station marks, measured bars, and "held" mini tickets. It is the colour of the railway itself.
- **Deep Rail** (`rail-deep`): primary hover, top-bar bottom border (3px), label and header ink, terminus station mark, wordmark ticket stroke.
- **Rail Tint** (`rail-tint`) and **Rail Wash** (`rail-wash`): the measured mark fill, listbox selection, route-map skill pills, quiet-button hover (tint); the timetable header band and hover fills on postings and video links (wash).
- **Rail Ink / Rail Ink Dim** (`rail-ink`, `rail-ink-dim`): text on the top bar; dim for resting nav links, white on hover.

### Secondary: Card Stock
- **Salmon Stock** (`stock-salmon`): first ticket stub, the terminus board on the route map, and the logo/favicon ticket.
- **Mint Stock** (`stock-mint`): second stub, and the "learned" (punched) mini ticket in the wallet.
- **Sky Stock** (`stock-sky`): third stub.

Card stock marks things the visitor holds or is headed to. It is never used for chrome, buttons or alerts.

### Tertiary: Signals
- **Signal Green** (`signal-green`, bg `signal-green-bg`, ink `signal-green-ink`): held skills, rising trend, "Easy" difficulty, high impact, pressed/learned states, share confirmation.
- **Signal Amber** (`signal-amber`, bg `signal-amber-bg`): "Medium" difficulty, medium impact, warning notices and data-caveat notes (ink #5a3700 on amber bg).
- **Signal Red** (`signal-red`, bg `signal-red-bg`): "Hard" difficulty, declining trend, field errors, chip-remove hover.

### Neutral
- **Platform Mint** (`platform-mint`): page ground. **Platform Line** (`platform-line`): footer rule on the ground.
- **Timetable Sheet** (`sheet`) and **Zebra Row** (`sheet-alt`): sheet surface and even table rows; chip fill.
- **Blue Hairline** (`hairline`): every 1px rule inside sheets, sheet borders, row dividers. **Strong Hairline** (`hairline-strong`): control borders, dashed separators, estimate mark border, scrollbar thumb.
- **Ink** (`ink`), **Ink 2** (`ink-2`), **Ink 3** (`ink-3`): primary text; secondary prose and estimate text; meta, hints, dagger.
- Controls, listboxes, via pills and posting links sit on pure white to read as paper inserts on the sheet.

### Named Rules
**The Signal-Lamp Rule.** Green, amber and red mean state (held, difficulty, trend, impact, error, warning). They never decorate, never fill a section and never brand.

**The Card-Stock Rule.** Salmon, mint and sky belong to tickets and the destination: things the visitor holds or is travelling to. Stubs take them in order 1-2-3.

## Typography

**Display Font:** Barlow Condensed (600, 700, 800) for board-printed heads, labels and figures; Barlow Semi Condensed (600, 700) for titles, station names and marks. All self-hosted via Fontsource static files; fallback Barlow, system-ui.
**Body Font:** Barlow (400, 400 italic, 500, 600, 700)
**Label/Mono Font:** Barlow Condensed with tabular numerals; no mono face.

**Character:** One grotesque, three widths. Condensed and heavy for things printed on a board (headings, station names, ticket skills, figures); normal width for reading; condensed, tracked uppercase for the small printed captions of a form or ticket.

### Hierarchy
- **Display** (Condensed 700, 32px / 25px under 720px, 1.08): the single page heading in the intro; balanced, max 22ch.
- **Ticket** (Condensed 700, 28px, 1.02): the skill name on a stub. The loudest type on the page after the display line.
- **Headline** (Condensed 700, 23px): section heads ("Your next three tickets", "Your timetable").
- **Title** (Semi Condensed 700, 17px): sheet titles and wallet head. Station names on the route map run at Semi Condensed 15px/700.
- **Station** (Semi Condensed 700, 16px): role names in timetable rows; the arrival figure uses Condensed 700/16px.
- **Body** (400, 15px, 1.55): prose, max 58-70ch. **Body small** (13.5px) for sheet subtitles, stub reasons, legends.
- **Label** (600-700, 11-12px, 0.06-0.1em, uppercase): Condensed for timetable column heads, the slip header, ticket serial print and route-map annotations; Semi Condensed for form field labels and MEASURED / AI ESTIMATE marks.
- **Figure** (`.num`: Barlow Condensed, tabular + lining numerals): every count, month, serial and score.

### Named Rules
**The Width-Not-Weight Rule.** Hierarchy comes from Barlow's three widths and size first; heads hold at 700 (600 for small captions, 800 only for the PUNCHED stamp). Never bring in a family outside Barlow.

**The Italic-Is-Estimate Rule.** Italic body text appears only on AI-estimated content (stub reasons, upside column, fading reasons, estimate figures), always closed with a dagger †. Measured content is never italic.

## Layout

A single 1160px column (24px side padding, 16px under 720px), sticky 56px top bar, sections spaced 36px apart, each opened by a baseline-aligned head row (title left, actions or a short note right). Inside sheets the standard inset is 20px vertical by 22px horizontal (16px on phones), and tables align their first and last cells to the same 22px.

Grids: the results lead is two-thirds tickets / one-third readiness (`2fr 1fr`); paired sheets use two equal columns; ticket stubs sit three across; the wallet auto-fills 132px-minimum mini tickets. The booking slip is one row on desktop (From 2.2fr, To 1.4fr, Region 0.9fr, button), two columns under 960px, one column under 720px.

Breakpoints: 960px (grids collapse to one column, slip to two) and 720px (tickets stack, timetable rows stack into grid entries, route map turns vertical, legend stacks). Spacing steps observed: 4, 6, 8, 10, 12, 14, 16, 20, 22, 24, 28, 36, 48, 72px. Touch targets are 44px for primary controls and 34px for quiet buttons and punch buttons.

Print is a supported layout: chrome, form, share and links are removed, sheets lose shadows, stubs keep their card-stock colour.

## Elevation & Depth

Three flat planes: platform ground, sheets resting on it, tickets resting on sheets or the ground. Depth is cool, soft and ambient, tinted with rail-blue or ink, never black and never offset hard.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 2px rgba(22,44,102,0.06), 0 8px 24px -12px rgba(22,44,102,0.18)`): every timetable sheet.
- **Stub** (`filter: drop-shadow(0 6px 10px rgba(20,32,51,0.16)) drop-shadow(0 1px 1px rgba(20,32,51,0.1))`): ticket stubs. A drop-shadow filter, so the shadow follows the masked notches and punch hole.
- **Primary button** (`box-shadow: 0 1px 0 #162c66, 0 4px 12px -6px rgba(22,44,102,0.6)`): a one-pixel deep-rail lip plus a soft lift.
- **Listbox** (`box-shadow: 0 12px 28px -12px rgba(22,44,102,0.35)`): autocomplete popovers.
- **Focus ring on controls** (`box-shadow: 0 0 0 3px rgba(31,60,136,0.18)` with rail border); elsewhere `outline: 2px solid` rail, offset 2px.

### Named Rules
**The Paper-On-Platform Rule.** Only sheets, stubs, the primary button and popovers cast shadows. Rows, chips, marks and mini tickets are flat and separated by hairlines or dashes.

## Shapes

Small, practical radii from printed matter: 3px marks and via pills, 4px chips, nav links and punch buttons, 5px mini tickets, 6px controls and buttons, 7px stubs, 10px sheets. Circles are reserved for the stop number, signal dots, wallet dots and route stations; the terminus is a 4px-radius square.

Line language carries meaning. Solid 1px blue hairlines divide information; a 4px double rule closes the timetable header; dashed lines mean "tear here" or "not yet / not measured": the slip header perforation, the stub foot tear line (1.5px dashed), the source footnote rule, unheld mini tickets, the estimate mark, and estimate bars (6px dash, 2px gap).

## Components

### Buttons
- **Shape:** gently squared (6px), 44px tall.
- **Primary:** rail blue, white 600-weight label, 18px side padding, deep-rail lip shadow. One per view ("Plan my route").
- **Hover / Focus / Active:** darkens to deep rail; presses down 1px; disabled turns to #8193c4 with a progress cursor.
- **Quiet:** transparent with strong-hairline border and deep-rail text, 34px tall; hover fills rail tint; `aria-pressed` turns signal green.

### Chips
- **Style:** zebra-row fill, hairline border, 4px radius, 13.5px/500; a 20px remove button that turns signal red on hover.
- **Via pills (timetable):** white, strong hairline, 3px radius, 12.5px/600; held skills turn green bg + green border with a check icon.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** sheet, 1px blue-hairline border.
- **Shadow Strategy:** Sheet shadow (see Elevation).
- **Internal Padding:** 20px 22px; 16px on phones.

### Inputs / Fields
- **Style:** white, 1px strong hairline, 6px radius, 44px min height; field labels in rail-deep condensed uppercase above; hints in ink-3 below.
- **Focus:** rail border plus a 3px rail-tinted ring. Hover moves the border to rail.
- **Error:** signal-red hint text at 600 weight. Selects carry a rail-blue chevron.

### Navigation
- Sticky rail-blue bar with a 3px deep-rail bottom edge; wordmark (ticket logo + "SkillMap", Semi Condensed 700, 19px). Section links 13.5px/500 in rail-ink-dim, 4px radius, white with an 8% white wash on hover; scrolls horizontally on phones without a visible scrollbar.
- **Tabs (timetable paths):** text tabs over a hairline; selected tab in deep rail with a 3px rail underline; arrow-key roving focus.

### Ticket Stub (signature)
An Edmondson card ticket for each next skill. Card stock fill in order salmon, mint, sky; 7px radius; two 7px perforation notches cut on both long edges at 64% height and a dashed tear line across the foot. The head carries the skill in the Ticket style with a MEASURED or AI ESTIMATE mark; the body states why (counted postings in bold tabular figures, or italic reason with †); the foot holds learning links, a "Punch when learned" button and a serial print ("NO. 0001 · TO <ROLE>"). Punching animates a CSS `--punch` length from 0 to 9px over 240ms, cutting a real hole through the stub via mask, and prints "PUNCHED <date>" in green ink.

### Measured / Estimate Marks
Small uppercase tags (Semi Condensed 11px/700, 0.06em, 3px radius). Measured: solid rail border on rail tint, deep-rail text. Estimate: dashed strong-hairline border, no fill, ink-2 text. Bars follow suit: measured bars are a solid 6px rail (green when held) on #e4e9f2; estimate bars are dashed in ink-3 over a dashed track.

### Timetable (signature)
A full-width table on a sheet: meta strip (journey †, difficulty as a signal lamp †, stop count), then columns Stop / Station (role) / Arrives † / Via (skills to learn) / Upside †. Header band in rail wash with condensed uppercase labels and a 4px double rail rule beneath; zebra rows; stop numbers in 26px rail-ringed circles. Under 720px the header disappears and each row becomes a grid entry: stop circle in a 40px left column, station and arrival on the first line, via and upside spanning below.

### Route Map (signature)
The skill graph as a rail line diagram: a 6px rail track, filled stations for held skills (with skill pills), ringed interchange stations for bridge skills, a square deep-rail terminus with the target role on a salmon board. Small uppercase annotations ("Board here", "Change here", "Alight") mark the line. Horizontal on desktop, vertical under 720px. Legend sits in a hairline footer with the connections flagged as an estimate †.

### Mini-Ticket Wallet
Every skill on the route as a 40px mini ticket (5px radius, Semi Condensed 13.5px/600) with a 9px dot: held = rail blue fill with white text, learned = mint stock with dark green text, still to collect = dashed strong hairline, transparent, open dot. The head counts "You hold N of M tickets" in tabular figures.

### Notices
Bordered 6px boxes with an icon at left; warning variant in amber bg, #e2b65f border, brown ink.

## Do's and Don'ts

### Do:
- **Do** set every number in tabular lining figures in Barlow Condensed.
- **Do** mark every AI-derived figure with a dagger † and italic text, and every AI section with the dashed AI ESTIMATE mark; reserve the solid MEASURED mark and solid bars for counts from real postings.
- **Do** put information on sheets (10px radius, sheet fill, blue hairline border, sheet shadow) and lay repeated records out in timetable columns that stack on phones.
- **Do** use dashed lines for perforations, unheld items and estimates; solid hairlines for structure.
- **Do** give primary controls a 44px target and a visible rail-blue focus outline.
- **Do** keep the print stylesheet working: stubs print in their card stock, chrome drops out.

### Don't:
- **Don't** use signal green, amber or red for anything but state.
- **Don't** use card stock colours on chrome, buttons or notices.
- **Don't** add a typeface outside the Barlow family; reach for Condensed or Semi Condensed instead.
- **Don't** set measured content in italic or give estimates a solid mark or solid bar.
- **Don't** use hard offset shadows, black shadows or gradient-filled surfaces; depth is soft and rail-tinted.
- **Don't** draw the stub notches or punch hole as overlaid shapes; they are mask cut-outs so the ground shows through.
