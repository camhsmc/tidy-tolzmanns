// tt-remind — Tidy Tolzmanns "your turn to pick" push reminder.
// Called hourly by pg_cron. Figures out whose turn it is today (America/Chicago),
// and if they haven't set an area yet, pushes to their phone(s) when THEIR local
// clock reads one of SLOTS. tt_reminder_log makes each (day, user, slot) fire once.
//
// POST {}                      -> normal hourly run
// POST { "test": "Kara" }      -> immediate test push to that user's devices (no log, ignores hour)
// Header x-webhook-secret must match TT_REMIND_SECRET.
import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'npm:@supabase/supabase-js@2';

const NAMES = ['Kara', 'Rachel', 'Ashley', 'Gail'];
const SLOTS = [8, 11]; // local hours to nag at
const DAY_TZ = 'America/Chicago';
const APP_URL = 'https://camhsmc.github.io/tidy-tolzmanns/';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!);

function ymdIn(tz: string, d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
}
function hourIn(tz: string, d = new Date()) {
  const h = new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hour12: false }).format(d);
  return parseInt(h, 10) % 24; // some engines print "24" for midnight
}
function safeTz(tz: string | null) {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz || DAY_TZ }); return tz || DAY_TZ; } catch { return DAY_TZ; }
}
function nextPicker(prev: string | null) {
  if (!prev) return NAMES[0];
  return NAMES[(NAMES.indexOf(prev) + 1) % NAMES.length];
}

type Sub = { id: string; user_name: string; endpoint: string; p256dh: string; auth: string; tz: string; fail_count?: number };

async function sendTo(sub: Sub, payload: Record<string, string>) {
  try {
    const r = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 3 * 3600 },
    );
    if (sub.fail_count) await sb.from('tt_push_sub').update({ fail_count: 0 }).eq('id', sub.id);
    return { endpoint: sub.endpoint.slice(-24), status: r.statusCode };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode ?? 0;
    // 404/410 = subscription expired or unsubscribed at the push service. FCM can return a
    // transient 410 right after subscribing, so drop the device only on the 2nd consecutive failure.
    if (status === 404 || status === 410) {
      if ((sub.fail_count || 0) + 1 >= 2) await sb.from('tt_push_sub').delete().eq('id', sub.id);
      else await sb.from('tt_push_sub').update({ fail_count: (sub.fail_count || 0) + 1 }).eq('id', sub.id);
    }
    const body = String((e as { body?: string }).body || '').slice(0, 300);
    return { endpoint: sub.endpoint.slice(-24), status, error: String((e as Error).message || e).slice(0, 200), body };
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('TT_REMIND_SECRET')) {
    return new Response('unauthorized', { status: 401 });
  }
  let body: { test?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  // ---- Test mode: push now to one user, no log ----
  if (body.test && NAMES.includes(body.test)) {
    const { data: subs } = await sb.from('tt_push_sub').select('*').eq('user_name', body.test);
    const results = [];
    for (const s of (subs || []) as Sub[]) {
      results.push(await sendTo(s, { title: 'Test reminder 🧹', body: `Hi ${s.user_name}! Reminders are working on this phone.`, url: APP_URL, tag: 'tt-test' }));
    }
    return Response.json({ mode: 'test', user: body.test, results });
  }

  // ---- Normal run ----
  const today = ymdIn(DAY_TZ);
  const { data: dayRows, error: e1 } = await sb.from('tt_day').select('day_date,picker').lte('day_date', today).order('day_date', { ascending: false }).limit(1);
  if (e1) return Response.json({ error: e1.message }, { status: 500 });
  const latest = dayRows?.[0];
  if (latest && latest.day_date === today) return Response.json({ today, skipped: 'area already picked' });

  const picker = latest ? nextPicker(latest.picker) : NAMES[0];
  const { data: subs, error: e2 } = await sb.from('tt_push_sub').select('*').eq('user_name', picker);
  if (e2) return Response.json({ error: e2.message }, { status: 500 });
  if (!subs || subs.length === 0) return Response.json({ today, picker, skipped: 'no subscriptions' });

  // Which slot (if any) is it right now for this person's devices?
  const now = new Date();
  const slot = SLOTS.find(h => (subs as Sub[]).some(s => hourIn(safeTz(s.tz), now) === h));
  if (slot == null) return Response.json({ today, picker, skipped: 'not a reminder hour', hours: (subs as Sub[]).map(s => hourIn(safeTz(s.tz), now)) });

  // Claim the (day, user, slot) — if the row already exists, another run already sent it.
  const { data: claimed } = await sb.from('tt_reminder_log').insert({ day_date: today, user_name: picker, slot }).select('id').maybeSingle();
  if (!claimed) return Response.json({ today, picker, slot, skipped: 'already sent' });

  const first = slot === SLOTS[0];
  const payload = {
    title: first ? `${picker}, it's your turn to pick 🧹` : `Still waiting on today's area`,
    body: first ? 'Pick today\'s area so everyone can get going.' : `${picker}, the crew is waiting on you. Tap to pick.`,
    url: APP_URL,
    tag: 'tt-remind',
  };
  const results = [];
  for (const s of subs as Sub[]) results.push(await sendTo(s, payload));
  await sb.from('tt_reminder_log').update({ sent: results.filter(r => r.status >= 200 && r.status < 300).length, detail: results }).eq('id', claimed.id);
  return Response.json({ today, picker, slot, results });
});
