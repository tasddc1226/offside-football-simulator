export const chatShareText = {
  unnamed: 'Unnamed player',
  team: (p: { name: string; ovr: number }) => `Shared the team ${p.name}. OVR ${p.ovr}`,
  listing: (p: { name: string; ovr: number }) =>
    `${p.name} is on the transfer market. OVR ${p.ovr}`,
  player: (p: { name: string; ovr: number }) => `Shared the player ${p.name}. OVR ${p.ovr}`,
  league: (p: { tier: number; round: number; home: string; away: string; score: string }) =>
    `[Tier ${p.tier} · Round ${p.round}] ${p.home} ${p.score} ${p.away}`,
};
