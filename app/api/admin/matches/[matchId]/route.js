import { NextResponse } from 'next/server';
import { getMatch } from '@/lib/opendota.js';
import { getDb } from '@/lib/db.js';

// GET /api/admin/matches/[matchId]
// Fetches a match from OpenDota and returns a shape tailored for the
// "New LAN" form prefill: the match date + one row per player with the info
// the admin needs to pick LAN members.
export async function GET(_req, { params }) {
  const matchId = (await params).matchId;
  if (!matchId || !/^\d+$/.test(matchId)) {
    return NextResponse.json({ error: 'bad match id' }, { status: 400 });
  }

  let match;
  try {
    match = await getMatch(matchId);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 });
  }
  if (!match || !match.match_id) {
    return NextResponse.json({ error: 'match not found' }, { status: 404 });
  }

  // Best-effort hero name lookup from our local heroes table. If it's empty
  // (admin hasn't run Sync heroes yet) we just fall back to hero_id.
  const db = getDb();
  const heroIds = (match.players || [])
    .map((p) => p.hero_id)
    .filter((id) => Number.isFinite(id));
  const heroes = heroIds.length
    ? await db
      .selectFrom('heroes')
      .select(['id', 'localized_name', 'img_url'])
      .where('id', 'in', heroIds)
      .execute()
    : [];
  const heroById = new Map(heroes.map((h) => [h.id, h]));

  const players = (match.players || []).map((p) => {
    const hero = heroById.get(p.hero_id);
    return {
      accountId: p.account_id ?? null,
      personaName: p.personaname || (p.account_id ? String(p.account_id) : 'Anonymous'),
      isRadiant: (p.player_slot & 128) === 0,
      heroId: p.hero_id,
      heroName: hero?.localized_name || null,
      heroImg: hero?.img_url || null,
      isAnonymous: p.account_id == null,
    };
  });

  const startDate = new Date(match.start_time * 1000).toISOString().slice(0, 10);

  return NextResponse.json({
    matchId: String(match.match_id),
    startTime: match.start_time,
    startDate,
    duration: match.duration,
    radiantWin: !!match.radiant_win,
    players,
  });
}
