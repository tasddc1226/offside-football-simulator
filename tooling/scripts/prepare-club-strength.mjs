// Read-only free-provider connection preparation. Does not write secrets or publish strengths.
import fs from 'node:fs/promises';
const competitions = { ere: 'DED', l1: 'FL1', bl: 'BL1', sa: 'SA', ll: 'PD', pl: 'PL' };
const token = process.env.FOOTBALL_DATA_TOKEN;
if (!token) {
  console.error('Set FOOTBALL_DATA_TOKEN locally. Never pass the key as an argument.');
  process.exit(1);
}
const output = [];
for (const [league, competition] of Object.entries(competitions)) {
  const response = await fetch(
    `https://api.football-data.org/v4/competitions/${competition}/teams`,
    {
      headers: { 'X-Auth-Token': token },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error(`${competition}: HTTP ${response.status}`);
  const data = await response.json();
  if (!Array.isArray(data.teams) || !data.teams.length) throw new Error(`${competition}: no teams`);
  output.push({
    league,
    provider: 'football-data',
    competition,
    teams: Object.fromEntries(data.teams.map((team) => [String(team.id), ''])),
    exclude: [],
    review: data.teams.map((team) => ({ id: team.id, name: team.name })),
  });
}
await fs.writeFile(
  process.argv[2] ?? '/tmp/club-strength-source-review.json',
  JSON.stringify(output, null, 2) + '\n',
  { mode: 0o600 },
);
console.log(
  'Saved a review template. Fill game club IDs and remove review before configuring the server. Nothing was published.',
);
