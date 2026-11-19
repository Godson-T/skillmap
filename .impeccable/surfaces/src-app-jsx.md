---
version: 1
slug: "src-app-jsx"
primary_target: "src/App.jsx"
related_targets: []
---

# SkillMap app (plan form + report)

Scope: the single SkillMap app screen (src/App.jsx and its components): plan form, live job-posting data, AI roadmap. Mode: Operate. Used equally on phones and laptops.

Audience & job: job seekers, career switchers, upskillers. Task: enter skills, target role, region; leave with the next 2–3 skills to learn, in order, and why. Success: a clear decision within a minute; measured vs AI-estimate impossible to confuse; warm, not corporate; screenshot-worthy; looks hand-made and artistic, not like generic AI-tool UI.

Constraints: keep every capability (form, measured posting data, AI roadmap, topology graph, rising/fading skills, quick wins, learning search links); flow may be reordered. Every AI number is labelled an estimate. Warm, encouraging copy (PRODUCT.md).

## Direction contract

THESIS: Your career plan is a timetable you can actually ride: stations, arrival times, the stops in between. It refuses the category's AI-dashboard default (gradient cards, glowing graph, hero metric).

OWN-WORLD: Indian Railways timetable plus Edmondson card tickets. Rail-blue top bar and primary actions; mint-tinted platform ground; near-white timetable sheets ruled in fine blue hairlines; ticket stubs in salmon, mint, sky and buff card stock; signal red/amber/green carry state only. Archivo throughout, condensed widths and tabular numerals for timetable heads and figures. Measured figures print in solid ink with an "n=" footnote; AI estimates carry a dagger (†) and the footnote "AI estimate".

STORY: The visitor fills a booking slip (From your skills, To a role, Region), gets three ticket stubs for the next skills to learn, sees why each one matters (postings count or † estimate), rides the timetable for each path, punches tickets as they learn, and shares the page.

FIRST VIEWPORT: Rail-blue top bar with wordmark and section nav. A booking-slip form in one row on desktop (From chips, To role, Region select, primary "Plan my route"), stacked on mobile. After a run: "Your next three tickets" stubs at left (two-thirds), readiness ("You hold 3 of 9 tickets") at right, timetable below.

FORM: Platform Timetable, position 6 of 7 on my ordered list; seed:5cf721b3f77b046f. Signature move: the career path set in a timetable's column rhythm (stop, role, arrives, via skills, upside†), and next-skill ticket stubs that punch when marked learned.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: real-posting data only when a target role is set; roll ran degraded (no challengers or quality-bar boards).
