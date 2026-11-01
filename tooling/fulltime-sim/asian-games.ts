// Fixed-condition comparison. This is not a production-user success-rate estimate.
import '@offside/game/index';
import { newGame, newSeason } from '@offside/game/engine';
import { CLUBS } from '@offside/game/data';
import { syncFace } from '@offside/game/attributes';
import { natSeasonEnd } from '@offside/game/national';
import { applyBalance, BAL } from '@offside/game/balance';
import { createRng, setActiveRng } from '@offside/game/rng';

const n = Number(process.argv[2] ?? 5000);
for (const bonus of [0, 6])
  for (const ability of [70, 80, 90]) {
    let called = 0,
      wins = 0;
    for (let seed = 1; seed <= n; seed++) {
      setActiveRng(createRng(seed));
      const s = newGame(
        { name: 'SIM', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
        seed,
      );
      Object.assign(s, { year: 2030, age: 22, leagueId: 'k1', injury: 0, fame: 30, phase: 2 });
      s.club = { ...CLUBS.find((c) => c.leagueId === 'k1')! };
      for (const k of Object.keys(s.sub)) s.sub[k] = ability;
      syncFace(s);
      s.season = newSeason(s);
      s.season.apps = 30;
      s.season.ratingSum = 30 * 7;
      s.nat.qual[2030] = false;
      applyBalance({ agKoreaBonus: bonus });
      const t = natSeasonEnd(s).tours.find((t) => t.key === 'ag')!;
      if (t.inSquad) {
        called++;
        if (t.stage === '우승') wins++;
      }
    }
    console.log(
      JSON.stringify({
        bonus: BAL.agKoreaBonus,
        ovr: ability,
        n,
        called,
        wins,
        winRate: called ? wins / called : null,
      }),
    );
  }
applyBalance();
