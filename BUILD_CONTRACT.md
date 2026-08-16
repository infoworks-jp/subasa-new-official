# NEW TSUBASA SITE — COMPLETION CONTRACT

## Persistent execution rule
The user's instruction to complete the site remains active until an explicit STOP / 中止 / 待て. A progress question is not a stop command.

If execution fails or stalls: detect it, mark ALERT, identify the concrete cause, repair what can be repaired without user input, rerun, and re-check. Do not wait silently for the user to discover the stall.

## Independent watchdog
Required workflows are monitored by `.github/workflows/watchdog.yml`. Any failed Visual QA or Deploy Pages run must automatically create/update a blocking BUILD ALERT issue. A failed run may never be treated as idle or ignored.

## Preflight rule
Before relying on an external capability (GitHub Pages enablement, permissions, deployment, browser runtime, assets), verify that capability first. Do not assume it exists because a workflow file was written. If the capability cannot be verified or cannot be changed by the current token, stop that path immediately with a specific actionable ALERT instead of repeatedly retrying the same failing design.

## Fail-closed rule
Checks are meaningful only if failure blocks completion. Therefore:
- A QA failure blocks the 70% gate and above.
- A deployment failure blocks the 100% gate.
- A checker bug is itself a blocking defect until the checker is repaired and rerun.
- No statement such as “改善した”, “動いている”, “公開済み”, or “出来た” may be made unless the relevant evidence from the latest commit proves it.
- A fix is not complete when code is written; it is complete only after the repaired check passes.

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
