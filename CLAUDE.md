# Tidy Tolzmanns — session log

Single-file vanilla-JS Supabase app for Kara, Rachel, Ashley, Gail's daily deep-clean challenge.

## Stack

- `index.html` — entire app
- Supabase: **Cerebro** (`optzbdbavpnxstpxrpbh`), tables prefixed `tt_*`
- Hosted: local for now, then GitHub Pages

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

## Status

✅ Schema deployed and verified
✅ App built
⏳ End-to-end smoke test through local server
⏳ Deploy to GitHub Pages
⏳ Share URL with Kara, Rachel, Ashley, Gail

## Open questions / future

- Photos (before/after) — out of scope v1; could add via Supabase Storage later
- SMS / email nudges — out of scope v1; Gail likely benefits most if added
- Editable rotation order — hardcoded for v1; settings UI could expose it
- Editing past entries — not allowed v1; can add an "edit" affordance if requested

## How to run locally

```
cd ~/tidy-tolzmanns
python3 -m http.server 8765
open http://localhost:8765
```
