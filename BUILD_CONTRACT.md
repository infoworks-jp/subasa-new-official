# NEW TSUBASA SITE — COMPLETION CONTRACT

## Persistent execution rule
The user's instruction to complete the site remains active until an explicit STOP / 中止 / 待て. A progress question is not a stop command.

If execution fails or stalls: detect it, mark ALERT, identify the concrete cause, repair what can be repaired without user input, rerun, and re-check. Do not wait silently for the user to discover the stall.

## Definition of “出来た”
Only 100% qualifies: all specified content implemented, all required images present, public page loads successfully, desktop and mobile visual evidence inspected, links/menu interaction verified, and no blocking defect remains.

## Source isolation
This repository is a clean rebuild. Do not copy old HTML/CSS/JS, old 2–7 KB food thumbnails, old menu SVGs, old fluid.js, or old polish.css.

## Required structure
1. Susukino TOP / official image / vertical logo / restrained ink-neon effect
2. SIGNATURE 01: 究極の味噌ラーメン, full screen
3. SIGNATURE 02: つばさラーメン, full screen, equal status
4. Representative dishes
5. Store interior / atmosphere
6. MENU links: Japanese / English / Simplified Chinese / Korean full menu sheets
7. ACCESS

## Fixed facts
- OPEN 11:00–03:00
- CLOSED MONDAY / 毎週月曜日定休
- 札幌市中央区南4条西3丁目1-1 第3グリーンビル 新ラーメン横丁
- TEL 011-521-5963

## Progress gates
- 20%: source assets verified and manifest committed
- 35%: clean index/style/app committed
- 55%: all required local web assets installed and asset gate passes
- 70%: desktop/mobile functional QA passes
- 85%: desktop full-page visual evidence inspected
- 95%: mobile full-page visual evidence inspected
- 100%: public Pages URL rechecked after deployment; only then report “出来た”

No gate may advance based on an intention, status message, or CI success unrelated to the required evidence.
