# Tidy Tolzmanns — session log

Single-file vanilla-JS Supabase app for Kara, Rachel, Ashley, Gail's daily deep-clean challenge.

## Stack

- `index.html` — entire app
- Supabase: **Cerebro** (`optzbdbavpnxstpxrpbh`), tables prefixed `tt_*`
- Repo: https://github.com/camhsmc/tidy-tolzmanns
- Live: **https://camhsmc.github.io/tidy-tolzmanns/**

## Data model

```sql
tt_day        (id, day_date unique, area, picker, picker_note, picked_at)
tt_completion (id, day_id fk, user_name, minutes_spent, note, completed_at, unique(day_id, user_name))
```

`picker` and `user_name` are CHECK-constrained to one of: Kara, Rachel, Ashley, Gail.

## Rotation

Round-robin Kara → Rachel → Ashley → Gail. Today's picker = next person after the picker of the most recent `tt_day` row. Empty DB ⇒ Kara starts.

## Day boundary

Canonical day = current date in `America/Chicago`, computed in JS:

```js
new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date())
// → "2026-05-18"
```

Stored as Postgres `date`. Single canonical TZ → no per-user drift; not user-visible.

## Session — 2026-05-18

**Built**
- Migration `tidy_tolzmanns_init` applied to Cerebro (tt_day, tt_completion, RLS, permissive policies)
- Single `index.html` with:
  - Name picker (4 cards) on first open, saved to `localStorage['tt.who']`
  - Topbar with current name + tap-to-switch
  - **Today** tab: pending state (waiting on picker), picker form, area display, 4 person cards with completion state
  - Mark Done form (note + minutes both optional)
  - **History** tab: per-person streak counts, last 14 days log, current-month calendar grid
- Warm sage / cream / terracotta palette, Fraunces display + Inter sans

## Session — 2026-05-19

**Deployed**
- `git init -b main`, initial commit `f1711fc`, 4 files / 951 insertions
- `gh repo create tidy-tolzmanns --public --source=. --remote=origin --push` → https://github.com/camhsmc/tidy-tolzmanns
- GitHub Pages enabled via `gh api -X POST repos/camhsmc/tidy-tolzmanns/pages -f 'source[branch]=main' -f 'source[path]=/'`
- Live URL: https://camhsmc.github.io/tidy-tolzmanns/

**Verified**
- Anon REST POST to `tt_day` returned HTTP 201 — browser writes will work from any device with the public URL
- Unique constraints reject duplicate `day_date` and duplicate `(day_id, user_name)`
- Streak math validated against seeded 7-day fake history (Kara 7, Ashley 5, Rachel 4, Gail 3); test rows wiped before deploy

**Sharing notes**
- iPhone users: open in Safari → Share → Add to Home Screen (works PWA-style with the existing meta tags)
- Public URL: anyone with the link can read/write — fine for v1, swap to passcode gate (Gringotts pattern) if abuse happens

## Status

✅ Schema deployed and verified
✅ App built
✅ End-to-end smoke test (REST + SQL) passed
✅ Deployed to GitHub Pages
⏳ First real use — Kara picks today's area as the rotation starter
⏳ Share URL with Rachel, Ashley, Gail

## Session — 2026-05-19 (later)

**Added: editable history**
- Kara asked for the ability to fix past days (e.g. forgot to mark herself done yesterday)
- Log rows in History tab + has-day calendar cells are now tappable
- Tap opens a sheet (reuses `.name-picker-wrap` overlay) showing date + area + picker, with a row per person
- Toggle button per person: insert/delete `tt_completion` row (no `(day_id, user_name)` uniqueness conflict because we delete the existing row before re-inserting)
- After each toggle: reloads today + recent, re-renders the underlying view, re-opens the sheet with fresh data so minutes/notes reflect current state
- Anyone can edit anyone's status — no per-row permission. Matches the "trust the family" v1 posture.

## Session — 2026-05-19 (even later)

**Added: calendar navigation + future planning**

Kara asked for two more things:
1. Be able to navigate to any past month in the calendar to see and edit
2. Be able to pre-set the area for her next assigned rotation day

**Changes**
- Calendar header has ‹ / › buttons; `state.calYear` + `state.calMonth` drive which month renders (default = current)
- `loadRecent()` no longer caps at 35 rows (limit 2000) — all history loaded so any month is browseable without re-fetching
- Empty future cells: dashed border, tappable → opens **plan-day sheet**
- Future cells with a row: terracotta-soft "planned" styling, tappable → opens plan-day sheet in edit mode (with Delete this day)
- Plan-day sheet shows predicted picker (computed via `predictPicker(ymd)` — one rotation step per calendar day from latest prior row) and saves with `picker = state.who`
- Past cells without rows are NOT tappable (intentional — no retroactive creation; only editing existing days)

**Bug fix tucked in**
- `loadToday()` now filters `day_date <= todayDate` — otherwise a pre-scheduled future row would be returned as "the latest day" and shadow today's logic
- `computeStreak` and the "Last 14 days" log filter out future-dated rows so streaks don't reset and the log doesn't surface plans

**predictPicker caveats**
- Assumes one rotation step per calendar day from the latest existing row's picker
- If days get skipped (no row), predicted picker drifts from actual picker — acceptable hint, not a guarantee
- Original "next picker = nextPicker(latest row's picker)" semantics in `loadToday` are unchanged

## Session — 2026-05-19 (third pass)

**Unified day sheet + reassignable picker**

Kara surfaced two follow-ups:
1. The picker (whose turn it is) needs to be editable on any day so they can swap if someone's sick/travelling.
2. She also wants to backfill calendar days *before* May 18 (when the app was built) — currently those empty past cells aren't tappable.

**Changes**
- `buildDayEditor` + `buildPlanSheet` collapsed into one `buildDaySheet(ymd, existingRow)`. Sheet now contains:
  - "Assigned to" section with 4 picker chips (radio-like; tap to select)
  - Area input + Note textarea
  - Save button (creates or updates)
  - For past/today rows: a "Completions" section with the original toggle buttons
  - Delete button (if row exists)
- Sheet handles all four cases uniformly: past-empty, past-with-row, today-empty/with-row, future-empty/with-row.
- All `cal-cell:not(.empty)` are now tappable — past empty cells too, so retroactive backfill works for any historical date.
- Single `open-day` action replaces `edit-day` + `plan-day`; single `save-day` replaces `save-plan`; new `set-day-picker` toggles the chip selection in-DOM.
- `togglePersonDone` now updates the toggle button in-place instead of rebuilding the sheet — preserves any in-progress edits to picker/area/note fields while she's marking completions.
- Picker prediction (`predictPicker`) still shown as a hint for new entries; user can override with any of the 4 chips before saving.

**Bug fix tucked in**
- `saveDay` now also writes `picker` on update — previously the picker was set at creation and immutable.

## Session — 2026-05-20 (QA pass)

Kara reported the app feeling glitchy. Did a careful code audit + listed 12 findings ordered by likelihood of being what she perceived. Took the top 3:

**Fixed**
- **Past empty cells had no visual hint they're tappable** — added `.cal-cell.past-empty` styling (paler dashed border, paler bg) so they look interactive like future cells do. Empty-padding (`.cal-cell.empty`) and today cells are unchanged.
- **"Predicted" label is wrong tense for backfilling** — when `ymd < todayDate`, the day-sheet hint now says "Suggested" instead of "Predicted." Today and future days still say "Predicted."
- **Cancel silently discarded form edits** — `openDaySheet` now snapshots `{picker, area, note}` into `state.daySheetInitial`. Cancel-button handler runs `isDaySheetDirty()` and `confirm('Discard your changes?')` before closing. Save and Delete close without prompting (since intent is explicit).

**Not yet fixed (lower-priority findings from the audit)**
- 5-min midnight refresh doesn't auto-close an open day sheet
- `loadRecent` issues a long `.in('day_id', ids)` URL after many months of data
- Today-tab "your turn to pick" form is a parallel flow to the day-sheet for today
- Streak breaks on legitimately skipped rotation days
- `confirm()` native dialog is jarring vs the warm UI
- Accidental double-tap on calendar cells; no `user-scalable=no` in viewport (mobile zoom risk)

## Session — 2026-05-22 (home-screen icon)

Cam asked how iPhone PWA icons work. Test case for the broader pattern: gave Tidy Tolzmanns a distinct home-screen icon (broom emoji on sage green) so it doesn't look like a screenshot of the app.

**Added**
- `apple-touch-icon.png` (180×180, sage-green `#7a936c`, 🧹 emoji rotated ~12° with drop shadow). Generated via headless Chrome screenshot of `/tmp/tt-icon-gen.html`.
- Three new lines in `<head>` of `index.html`:
  - `<meta name="apple-mobile-web-app-title" content="Tidy" />` — short label under the home-screen icon
  - `<link rel="apple-touch-icon" href="apple-touch-icon.png" />`
  - `apple-mobile-web-app-capable` was already there from initial build.

**The catch worth remembering**
- iOS caches the icon at install time. Anyone who already added the app to their home screen has to long-press → Remove Bookmark → re-open in Safari → Share → Add to Home Screen to pick up the new icon. Tell Kara, Rachel, Ashley, Gail when sharing the icon update.

**Pattern for other PWAs**
- The `/tmp/tt-icon-gen.html` recipe (HTML with solid bg + emoji + headless Chrome screenshot at `--window-size=180,180`) is the cheap reusable path for the other apps: Haines Harvest, Cam's Cave, CamNote, Spelling Practice, Haines Gringotts, Lawn Job Logger, Dagger Electric. Same three head tags, different icon file.

## Session — 2026-05-20 (celebration + live notifications)

Kara asked for a cowboy-shooting-pistols celebration when she marks a task done. Ashley asked to be notified when someone else finishes — Cam confirmed that should apply to everyone, not just Ashley. Cam also picked "in-app toast now, PWA push later," so PWA push is deferred.

**Added: cowboy celebration overlay**
- New `celebrate(name)` function. Full-screen sage-cream-terracotta wash; centered scene with 🤠 in the middle, mirrored 🔫🔫 on either side, alternating 💥 bangs, plus 24-piece confetti falling down the viewport.
- Big serif "Nice job, [Name]!" and italic "You did it!" below the scene.
- Triggers from the success path of `markDone()` (replaces the old `toast('Nice work 🧽')`).
- Auto-dismisses after 3.8s; tap anywhere to dismiss early. Closing class adds a fade-out.
- Backfill toggles (`togglePersonDone`) deliberately do NOT trigger the celebration — that path is an admin override, not "I just did my chore."

**Added: cross-family live notifications**
- New `notifyPersonDone(name, area)` function. Slides in a top-of-screen banner with the person's avatar (reuses `av-Kara/Rachel/Ashley/Gail` color classes), "[Name] did it! 🤠", and the area name underneath. Stacks if multiple come in. Auto-dismisses after 5s; tap to dismiss.
- `subscribeLiveUpdates()` opens a single `tt-live` Supabase Realtime channel listening to `postgres_changes` on `tt_completion` and `tt_day`. Any event triggers a debounced 250ms `refresh()` so all four phones stay in sync.
- INSERT on `tt_completion`: if the row is for **today's** `tt_day` row AND the `user_name` is not the local user, fires `notifyPersonDone`. Backfilled past-day inserts refresh silently — they're admin edits, not "she just did it."

**Migration (Cerebro)**
- `tidy_tolzmanns_realtime`: `ALTER PUBLICATION supabase_realtime ADD TABLE public.tt_completion, public.tt_day`. Cerebro had no `tt_*` tables in `supabase_realtime` before this — realtime broadcasting wouldn't have worked otherwise.

**Not done (deferred to a future session)**
- PWA push (real notifications on locked phones) — needs a service worker, a `push_subscriptions` table, an edge function with VAPID keys, and an iOS PWA install flow. Multi-session work; deferred per Cam's "ship the toast today, push later" call.

## Session — 2026-05-20 (QA pass 3)

**Fixed**
- **Streak no longer drops to 0 mid-day before she's logged today.** `computeStreak` used to break as soon as it saw a `tt_day` row for today without a completion for `name`. Now: if the missing day *is* today, we `continue` instead of `break` — so yesterday and prior keep counting. Once the day rolls over and today becomes yesterday, the normal miss-breaks-streak rule kicks in.

## Session — 2026-05-20 (QA pass 2)

Next 3 priorities:

**Fixed**
- **Backdrop-tap to close** (`name-picker-wrap` is the backdrop). Day-sheet wrap and switch-user name-picker wrap now listen for clicks where `ev.target === wrap` and close on backdrop click. Day-sheet path runs the dirty check first. First-run name picker is unchanged — they must pick a name.
- **Toggle re-mark used to silently wipe minutes/note**. `togglePersonDone` now confirms before deleting a completion that has `minutes_spent` or `note` content. Confirm shows the data being lost (e.g. `Remove Rachel's entry (25 min · "cleaned closet")?`). Confirm cancel returns early; toggle handler re-enables the button so its state stays "✓ Done".
- **`predictPicker` for pre-history backfill**. When there are no rows before `ymd` (e.g. backfilling April before the app existed), it now walks *backward* from the earliest later row. So if May 18 = Kara is the first row, backfilling May 17 suggests Gail (Kara − 1 step), not Kara.

## Open questions / future

- Photos (before/after) — out of scope v1; could add via Supabase Storage later
- SMS / email nudges — out of scope v1; Gail likely benefits most if added
- Editable rotation order — hardcoded for v1; settings UI could expose it
- ~~Editing past entries — not allowed v1~~ ✅ done 2026-05-19
- ~~Editing area/note/picker on existing days~~ ✅ done 2026-05-19 (third pass)

## How to run locally

```
cd ~/tidy-tolzmanns
python3 -m http.server 8765
open http://localhost:8765
```
