# Tidy Tolzmanns

A tiny shared web app for Kara, Rachel, Ashley, and Gail's daily deep-clean challenge.

One person picks an area each day; all four clean that same area in their own homes; everyone checks in when done.

## How it works

- **Pick your name** the first time you open the app (saved on your device — no login).
- **Today's picker** rotates Kara → Rachel → Ashley → Gail → Kara → ... every day.
- When it's your turn, type the area (e.g. "master bathroom baseboards") and set it.
- Everyone else taps "Mark Done" when they've finished cleaning, with an optional note and minutes spent.
- The **History** tab shows streaks, the last 14 days, and a calendar view.

## Local dev

```
cd ~/tidy-tolzmanns
python3 -m http.server 8765
open http://localhost:8765
```

## Deploy (GitHub Pages)

1. Create a new public GitHub repo named `tidy-tolzmanns`.
2. From this folder: `git init && git add . && git commit -m "init" && git branch -M main && git remote add origin git@github.com:<you>/tidy-tolzmanns.git && git push -u origin main`.
3. In the repo settings → Pages, source `main` branch, root folder.
4. Share `https://<you>.github.io/tidy-tolzmanns/` with the four cleaners. Add to home screen on iPhone for a PWA-like feel.

## Stack

- Vanilla JS / HTML — one file, no build step.
- Supabase (Cerebro project `optzbdbavpnxstpxrpbh`) tables: `tt_day`, `tt_completion`.
- Day boundary uses America/Chicago to keep "today" consistent across phones.
