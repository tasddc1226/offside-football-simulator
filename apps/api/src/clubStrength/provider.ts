import { fdSchema, afSchema, type StrengthSource } from '@offside/contracts/club-strength-provider';
export { SourcesSchema, type StrengthSource } from '@offside/contracts/club-strength-provider';
import type { StandingRow } from '@offside/contracts/club-strength-calc';
/** Only fixed provider hosts. The API key never enters history, errors or client responses. */
export async function collectStandings(
  source: StrengthSource,
  key: string,
  request: typeof fetch = fetch,
): Promise<{ season: string; rows: StandingRow[] }> {
  const url =
    source.provider === 'football-data'
      ? `https://api.football-data.org/v4/competitions/${source.competition}/standings`
      : `https://v3.football.api-sports.io/standings?league=${source.competition}&season=${source.season}`;
  if (source.provider === 'api-football' && !source.season) throw new Error('season-required');
  const res = await request(url, {
    headers:
      source.provider === 'football-data' ? { 'X-Auth-Token': key } : { 'x-apisports-key': key },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`provider-http-${res.status}`);
  const raw: unknown = await res.json();
  if (source.provider === 'football-data') {
    const data = fdSchema.parse(raw);
    const table = data.standings.filter((s) => s.type === 'TOTAL');
    if (table.length !== 1) throw new Error('unsupported-standing-groups');
    return {
      season: data.season.startDate,
      rows: table[0]!.table.map((r) => ({
        team: String(r.team.id),
        p: r.playedGames,
        w: r.won,
        d: r.draw,
        l: r.lost,
        pts: r.points,
        gf: r.goalsFor,
        ga: r.goalsAgainst,
      })),
    };
  }
  const data = afSchema.parse(raw);
  if (Object.keys(data.errors).length || data.response.length !== 1)
    throw new Error('provider-response-invalid');
  const league = data.response[0]!.league;
  if (league.season !== source.season) throw new Error('wrong-provider-season');
  // Conferences may repeat an overall table. Accept unique teams or identical repeats only.
  const teams = new Map<string, StandingRow>();
  for (const table of league.standings)
    for (const r of table) {
      const row = {
        team: String(r.team.id),
        p: r.all.played,
        w: r.all.win,
        d: r.all.draw,
        l: r.all.lose,
        pts: r.points,
        gf: r.all.goals.for,
        ga: r.all.goals.against,
      };
      const previous = teams.get(row.team);
      if (previous && JSON.stringify(previous) !== JSON.stringify(row))
        throw new Error('conflicting-standing-groups');
      teams.set(row.team, row);
    }
  return { season: String(league.season), rows: [...teams.values()] };
}
