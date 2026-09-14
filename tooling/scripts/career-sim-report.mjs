#!/usr/bin/env node
// T-7-021: career-sim 결과 디렉터리(careers.csv/seasons.csv/summary.json)를 읽어 밸런스 기준선
// 마크다운 보고를 만드는 집계 스크립트. Node 내장 모듈만 사용한다(의존성 추가 금지, D-79 브리프).
// career-sim.ts를 import하지 않는다(그 파일은 TypeScript라 plain node로 실행할 수 없다) —
// CSV 헤더·숫자 컬럼 목록은 career-sim.ts의 CAREERS_CSV_HEADER/SEASONS_CSV_HEADER,
// CAREERS_NUMERIC_COLUMNS/SEASONS_NUMERIC_COLUMNS와 동일해야 한다(코드가 아니라 상수만 복제).
import { readFile } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

// `pnpm --filter @offside/scripts`(루트 `pnpm sim:report`가 이를 통해 실행됨)는 cwd를
// tooling/scripts로 바꾸지만, `--a`/`--b`의 공개 예시는 리포 루트 기준 상대 경로다
// (career-sim.ts의 REPO_ROOT/resolveOut과 동일한 이유·동일한 처리).
const REPO_ROOT = resolve(new URL('../..', import.meta.url).pathname);
function resolveRunDir(dir) {
  return isAbsolute(dir) ? dir : resolve(REPO_ROOT, dir);
}

const CAREERS_NUMERIC_COLUMNS = new Set([
  'index', 'truePotential', 'baseOvrStart', 'peakOvr', 'peakOvrAge', 'finalOvr', 'seasons',
  'retiredAge', 'clubs', 'seasonsInTier1', 'seasonsInTier2', 'seasonsInTier3', 'totalApps',
  'totalMinutes', 'totalGoals', 'totalAssists', 'avgRatingTenths', 'injuries', 'severeInjuries',
  'contracts', 'peakWageMinorPerWeek', 'totalIncomeMinor', 'nationalCallUps', 'captainSeasons',
  'legacyScore', 'commands',
]);

const SEASONS_NUMERIC_COLUMNS = new Set([
  'index', 'seasonIndex', 'age', 'finalRank', 'apps', 'started', 'minutes',
  'possibleMinutes', 'avgRatingTenths', 'injuries', 'ovrBefore', 'ovrAfter', 'formAfter',
  'fitnessAfter', 'moraleAfter', 'managerTrustAfter', 'wageMinorPerWeek',
]);

// ---------------------------------------------------------------------------
// CSV 파싱 (career-sim.ts의 parseCsvLine/parseCsv와 동일한 규칙: 따옴표 이스케이프 지원)
// ---------------------------------------------------------------------------

function parseCsvLine(line) {
  const cells = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

function parseCsv(text, numericColumns) {
  const lines = text.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i]);
    const row = {};
    header.forEach((key, idx) => {
      const raw = cells[idx] ?? '';
      row[key] = raw !== '' && numericColumns.has(key) ? Number(raw) : raw;
    });
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 통계 헬퍼
// ---------------------------------------------------------------------------

function num(rows, key) {
  return rows.map((r) => r[key]).filter((v) => typeof v === 'number' && Number.isFinite(v));
}

function quantile(sorted, p) {
  if (sorted.length === 0) return null;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return round2(sorted[rank]);
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

function stats(values) {
  if (values.length === 0) return { n: 0, mean: null, p10: null, p50: null, p90: null };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = round2(values.reduce((a, b) => a + b, 0) / values.length);
  return { n: values.length, mean, p10: quantile(sorted, 0.1), p50: quantile(sorted, 0.5), p90: quantile(sorted, 0.9) };
}

function pct(n, total) {
  return total > 0 ? round2((n / total) * 100) : 0;
}

function fmtStats(s) {
  if (s.n === 0) return 'n=0';
  return `평균 ${s.mean} · p10 ${s.p10} · p50 ${s.p50} · p90 ${s.p90} (n=${s.n})`;
}

function histogram(values, buckets) {
  // buckets: [{ label, test(v) }]
  const counts = buckets.map(() => 0);
  for (const v of values) {
    for (let i = 0; i < buckets.length; i += 1) {
      if (buckets[i].test(v)) {
        counts[i] += 1;
        break;
      }
    }
  }
  return buckets.map((b, i) => ({ label: b.label, count: counts[i], pct: pct(counts[i], values.length) }));
}

function distribution(rows, key) {
  const counts = new Map();
  for (const r of rows) {
    const v = String(r[key] ?? '');
    if (v === '') continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------------------------------------------------------------------------
// 데이터 로드
// ---------------------------------------------------------------------------

async function loadRun(dir) {
  const [careersCsv, seasonsCsv, failuresCsv, summaryJson] = await Promise.all([
    readFile(resolve(dir, 'careers.csv'), 'utf8'),
    readFile(resolve(dir, 'seasons.csv'), 'utf8'),
    readFile(resolve(dir, 'failures.csv'), 'utf8').catch(() => ''),
    readFile(resolve(dir, 'summary.json'), 'utf8'),
  ]);
  return {
    dir,
    careers: parseCsv(careersCsv, CAREERS_NUMERIC_COLUMNS),
    seasons: parseCsv(seasonsCsv, SEASONS_NUMERIC_COLUMNS),
    failures: parseCsv(failuresCsv, new Set(['index', 'seasonIndex', 'commandIndex'])),
    summary: JSON.parse(summaryJson),
  };
}

// ---------------------------------------------------------------------------
// 커리어 지표
// ---------------------------------------------------------------------------

const AGE_BUCKETS = [
  { label: '19-22', test: (a) => a >= 19 && a <= 22 },
  { label: '23-27', test: (a) => a >= 23 && a <= 27 },
  { label: '28-32', test: (a) => a >= 28 && a <= 32 },
  { label: '33-37', test: (a) => a >= 33 && a <= 37 },
  { label: '38+', test: (a) => a >= 38 },
];

const PEAK_AGE_BUCKETS = [
  { label: '19-23', test: (a) => a >= 19 && a <= 23 },
  { label: '24-28', test: (a) => a >= 24 && a <= 28 },
  { label: '29-33', test: (a) => a >= 29 && a <= 33 },
  { label: '34-38', test: (a) => a >= 34 && a <= 38 },
  { label: '39+', test: (a) => a >= 39 },
];

const INJURY_SEASON_BUCKETS = [
  { label: '0', test: (n) => n === 0 },
  { label: '1', test: (n) => n === 1 },
  { label: '2', test: (n) => n === 2 },
  { label: '3', test: (n) => n === 3 },
  { label: '4', test: (n) => n === 4 },
  { label: '5', test: (n) => n === 5 },
  { label: '6+', test: (n) => n >= 6 },
];

// seasons.csv에서 seed별 "가장 이른 1부(leagueTier===1) 도달 seasonIndex"를 구한다.
// (누적 도달률 = seasonIndex <= N인 시즌 중 하나라도 1부였던 커리어의 비율)
function firstTier1SeasonIndexBySeed(seasons) {
  const map = new Map();
  for (const s of seasons) {
    if (String(s.leagueTier) !== '1') continue;
    const idx = Number(s.seasonIndex);
    if (!Number.isFinite(idx)) continue;
    const prev = map.get(s.seed);
    if (prev === undefined || idx < prev) map.set(s.seed, idx);
  }
  return map;
}

function careerSummary(careers, seasonRows) {
  const ok = careers.filter((c) => c.status !== 'FAILED');
  const firstTier1BySeed = firstTier1SeasonIndexBySeed(seasonRows);
  const peakOvr = stats(num(ok, 'peakOvr'));
  const finalOvr = stats(num(ok, 'finalOvr'));
  const truePotential = stats(num(ok, 'truePotential'));
  const potentialReach = ok.filter(
    (c) => typeof c.peakOvr === 'number' && typeof c.truePotential === 'number' && c.peakOvr >= c.truePotential - 3,
  ).length;
  const potentialReachRate = pct(potentialReach, ok.length);
  const peakOvrAgeHist = histogram(num(ok, 'peakOvrAge'), PEAK_AGE_BUCKETS);
  const retireReasonDist = distribution(ok, 'retireReason');
  const reviewAges = num(ok.filter((c) => c.retireReason === 'REVIEW'), 'retiredAge');
  const reviewAgeStats = stats(reviewAges);
  const seasons = stats(num(ok, 'seasons'));
  const tier1Reach = ok.filter((c) => Number(c.seasonsInTier1) > 0).length;
  const tier1ReachRate = pct(tier1Reach, ok.length);
  const tier1ReachBySeason = {};
  for (const mark of [5, 10, 15, 20]) {
    const reached = ok.filter((c) => {
      const firstIdx = firstTier1BySeed.get(c.seed);
      return firstIdx !== undefined && firstIdx <= mark;
    }).length;
    tier1ReachBySeason[mark] = pct(reached, ok.length);
  }
  const clubs = stats(num(ok, 'clubs'));
  const contracts = stats(num(ok, 'contracts'));
  const peakWage = stats(num(ok, 'peakWageMinorPerWeek'));
  const totalIncome = stats(num(ok, 'totalIncomeMinor'));
  const legacyScore = stats(num(ok, 'legacyScore'));
  const legacyBandDist = distribution(ok, 'legacyBandId').map(([band, n]) => [band, n, pct(n, ok.length)]);
  const nationalCallUps = stats(num(ok, 'nationalCallUps'));
  const captainSeasons = stats(num(ok, 'captainSeasons'));
  return {
    n: ok.length,
    failed: careers.length - ok.length,
    peakOvr,
    finalOvr,
    truePotential,
    potentialReachRate,
    peakOvrAgeHist,
    retireReasonDist,
    retireReasonTotal: ok.length,
    reviewAgeStats,
    seasons,
    tier1ReachRate,
    tier1ReachBySeason,
    clubs,
    contracts,
    peakWage,
    totalIncome,
    legacyScore,
    legacyBandDist,
    nationalCallUps,
    captainSeasons,
  };
}

// ---------------------------------------------------------------------------
// 시즌 지표
// ---------------------------------------------------------------------------

function seasonSummary(seasons) {
  const ages = new Map();
  for (const s of seasons) {
    const age = s.age;
    if (typeof age !== 'number') continue;
    if (!ages.has(age)) ages.set(age, []);
    ages.get(age).push(s.ovrAfter);
  }
  const ovrByAge = {};
  for (let age = 19; age <= 49; age += 1) {
    const values = (ages.get(age) ?? []).filter((v) => typeof v === 'number');
    if (values.length === 0) continue;
    const sorted = [...values].sort((a, b) => a - b);
    ovrByAge[age] = { mean: round2(values.reduce((a, b) => a + b, 0) / values.length), p50: quantile(sorted, 0.5), n: values.length };
  }

  const byAgeBucket = AGE_BUCKETS.map((bucket) => {
    const rows = seasons.filter((s) => typeof s.age === 'number' && bucket.test(s.age));
    const minutes = rows.reduce((a, r) => a + (typeof r.minutes === 'number' ? r.minutes : 0), 0);
    const possible = rows.reduce((a, r) => a + (typeof r.possibleMinutes === 'number' ? r.possibleMinutes : 0), 0);
    const minutesShare = possible > 0 ? round2((minutes / possible) * 100) : 0;
    const injuries = rows.reduce((a, r) => a + (typeof r.injuries === 'number' ? r.injuries : 0), 0);
    const injuriesPerSeason = rows.length > 0 ? round2(injuries / rows.length) : 0;
    const ratings = rows.map((r) => r.avgRatingTenths).filter((v) => typeof v === 'number');
    const avgRating = ratings.length > 0 ? round2(ratings.reduce((a, b) => a + b, 0) / ratings.length / 10) : null;
    const reserveCount = rows.filter((r) => r.squadRoleAtEnd === 'RESERVE').length;
    const reserveRate = pct(reserveCount, rows.length);
    return { label: bucket.label, n: rows.length, minutesShare, injuriesPerSeason, avgRating, reserveRate };
  });

  const tierBySeasonIndex = {};
  const bySeasonIndex = new Map();
  for (const s of seasons) {
    const idx = s.seasonIndex;
    if (typeof idx !== 'number') continue;
    if (!bySeasonIndex.has(idx)) bySeasonIndex.set(idx, []);
    bySeasonIndex.get(idx).push(s);
  }
  for (const [idx, rows] of [...bySeasonIndex.entries()].sort((a, b) => a[0] - b[0])) {
    const t1 = rows.filter((r) => r.leagueTier === '1').length;
    const t2 = rows.filter((r) => r.leagueTier === '2').length;
    const t3 = rows.filter((r) => r.leagueTier === '3').length;
    tierBySeasonIndex[idx] = { 1: pct(t1, rows.length), 2: pct(t2, rows.length), 3: pct(t3, rows.length), n: rows.length };
  }

  const roleDist = distribution(seasons, 'squadRoleAtEnd').map(([role, n]) => [role, n, pct(n, seasons.length)]);

  const careerKeyOf = (s) => `${s.seed}:${s.index}`;
  const perSeasonInjuryValues = seasons.map((s) => (typeof s.injuries === 'number' ? s.injuries : 0));
  const injuriesPerSeasonHist = histogram(perSeasonInjuryValues, INJURY_SEASON_BUCKETS);

  const contractKindDist = distribution(seasons, 'contractKind').map(([kind, n]) => [kind, n, pct(n, seasons.length)]);

  // 승격/강등 빈도: 같은 커리어 내에서 seasonIndex 순으로 leagueTier가 바뀐 횟수(숫자 낮을수록 상위 리그).
  const byCareer = new Map();
  for (const s of seasons) {
    const key = careerKeyOf(s);
    if (!byCareer.has(key)) byCareer.set(key, []);
    byCareer.get(key).push(s);
  }
  let promotions = 0;
  let relegations = 0;
  let tierChangeOpportunities = 0;
  for (const rows of byCareer.values()) {
    const sorted = [...rows].sort((a, b) => a.seasonIndex - b.seasonIndex);
    for (let i = 1; i < sorted.length; i += 1) {
      const prev = Number(sorted[i - 1].leagueTier);
      const cur = Number(sorted[i].leagueTier);
      if (!Number.isFinite(prev) || !Number.isFinite(cur)) continue;
      tierChangeOpportunities += 1;
      if (cur < prev) promotions += 1;
      else if (cur > prev) relegations += 1;
    }
  }
  const promotionRate = pct(promotions, tierChangeOpportunities);
  const relegationRate = pct(relegations, tierChangeOpportunities);

  return {
    ovrByAge,
    byAgeBucket,
    tierBySeasonIndex,
    roleDist,
    roleDistTotal: seasons.length,
    injuriesPerSeasonHist,
    contractKindDist,
    contractKindTotal: seasons.length,
    promotionRate,
    relegationRate,
    tierChangeOpportunities,
  };
}

// ---------------------------------------------------------------------------
// 그룹(포지션/archetype/background)별 요약
// ---------------------------------------------------------------------------

function groupBreakdown(careers, key) {
  const groups = new Map();
  for (const c of careers) {
    if (c.status === 'FAILED') continue;
    const g = String(c[key] ?? '');
    if (g === '') continue;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(c);
  }
  const rows = [];
  for (const [g, rows_] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const peakOvr = stats(num(rows_, 'peakOvr'));
    const tier1 = rows_.filter((c) => Number(c.seasonsInTier1) > 0).length;
    const tier1Rate = pct(tier1, rows_.length);
    const topBand = rows_.filter((c) => c.legacyBandId === 'BAND-LEGEND' || c.legacyBandId === 'BAND-ICON').length;
    const topBandRate = pct(topBand, rows_.length);
    rows.push({ group: g, n: rows_.length, peakOvrMean: peakOvr.mean, tier1Rate, topBandRate });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// 마크다운 렌더링
// ---------------------------------------------------------------------------

function mdTable(header, rows) {
  const lines = [`| ${header.join(' | ')} |`, `| ${header.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.join(' | ')} |`);
  return lines.join('\n');
}

function renderRuntime(label, summary) {
  const rt = summary.runtime;
  return [
    `### ${label} — 실행 정보`,
    '',
    `- 룰셋 ${rt.rulesetVersion} / 팩 ${rt.contentPackVersion} / 정책 ${rt.policy} / 모드 ${rt.mode}`,
    `- seeds ${rt.seeds} · seasonsCap ${rt.seasonsCap} · toRetirement ${rt.toRetirement} · jobs ${rt.jobs} · hashProvider ${rt.hashProvider}`,
    `- 시작 ${rt.startedAt} · 소요 ${(rt.elapsedMs / 1000).toFixed(1)}s · msPerCareer 평균 ${rt.msPerCareer.mean}ms(p50 ${rt.msPerCareer.p50}, p90 ${rt.msPerCareer.p90})`,
    `- 커리어 ${summary.careers.count}개, 실패 ${summary.careers.failed}개`,
    '',
  ].join('\n');
}

function renderCareerSection(labelA, a, labelB, b) {
  const lines = ['## 커리어 지표', ''];
  const hasB = b !== undefined;
  const header = hasB ? ['지표', labelA, labelB, '차이'] : ['지표', labelA];
  const diffNum = (x, y) => (typeof x === 'number' && typeof y === 'number' ? round2(y - x) : '');
  const row = (label, va, vb) => (hasB ? [label, va, vb, ''] : [label, va]);
  const rowNum = (label, sa, sb) => {
    if (!hasB) return [label, fmtStats(sa)];
    return [label, fmtStats(sa), fmtStats(sb), diffNum(sa.mean, sb.mean)];
  };

  lines.push('### 분포 (peakOvr/finalOvr/truePotential/seasons/구단이동/계약수/주급/수입/대표팀/주장)', '');
  lines.push(
    mdTable(header, [
      rowNum('peakOvr', a.peakOvr, b?.peakOvr),
      rowNum('finalOvr', a.finalOvr, b?.finalOvr),
      rowNum('truePotential', a.truePotential, b?.truePotential),
      row('잠재 도달률 %(peak≥potential-3)', a.potentialReachRate, b?.potentialReachRate),
      rowNum('seasons', a.seasons, b?.seasons),
      row('1부 도달률 %', a.tier1ReachRate, b?.tier1ReachRate),
      row('1부 도달률(시즌5누적) %', a.tier1ReachBySeason[5], b?.tier1ReachBySeason[5]),
      row('1부 도달률(시즌10누적) %', a.tier1ReachBySeason[10], b?.tier1ReachBySeason[10]),
      row('1부 도달률(시즌15누적) %', a.tier1ReachBySeason[15], b?.tier1ReachBySeason[15]),
      row('1부 도달률(시즌20누적) %', a.tier1ReachBySeason[20], b?.tier1ReachBySeason[20]),
      rowNum('구단 이동 횟수(clubs)', a.clubs, b?.clubs),
      rowNum('계약 수(contracts)', a.contracts, b?.contracts),
      rowNum('최고 주급(minor/week)', a.peakWage, b?.peakWage),
      rowNum('총 수입(minor)', a.totalIncome, b?.totalIncome),
      rowNum('Legacy 점수', a.legacyScore, b?.legacyScore),
      rowNum('대표팀 차출 수', a.nationalCallUps, b?.nationalCallUps),
      rowNum('주장 시즌 수', a.captainSeasons, b?.captainSeasons),
    ]),
    '',
  );

  lines.push('### peakOvrAge 히스토그램(5세 구간)', '');
  const ageHeader = hasB ? ['구간', `${labelA} n`, `${labelA} %`, `${labelB} n`, `${labelB} %`] : ['구간', 'n', '%'];
  const ageRows = a.peakOvrAgeHist.map((bucket, i) => {
    if (!hasB) return [bucket.label, bucket.count, bucket.pct];
    const bb = b.peakOvrAgeHist[i];
    return [bucket.label, bucket.count, bucket.pct, bb.count, bb.pct];
  });
  lines.push(mdTable(ageHeader, ageRows), '');

  lines.push('### retireReason 분포와 REVIEW 은퇴 나이', '');
  const reasons = new Set([...a.retireReasonDist.map(([r]) => r), ...(hasB ? b.retireReasonDist.map(([r]) => r) : [])]);
  const reasonHeader = hasB ? ['사유', `${labelA} n`, `${labelA} %`, `${labelB} n`, `${labelB} %`] : ['사유', 'n', '%'];
  const reasonRows = [...reasons].map((reason) => {
    const na = a.retireReasonDist.find(([r]) => r === reason)?.[1] ?? 0;
    if (!hasB) return [reason, na, pct(na, a.retireReasonTotal)];
    const nb = b.retireReasonDist.find(([r]) => r === reason)?.[1] ?? 0;
    return [reason, na, pct(na, a.retireReasonTotal), nb, pct(nb, b.retireReasonTotal)];
  });
  lines.push(mdTable(reasonHeader, reasonRows), '');
  lines.push(
    hasB
      ? `REVIEW 은퇴 나이 — ${labelA}: ${fmtStats(a.reviewAgeStats)} / ${labelB}: ${fmtStats(b.reviewAgeStats)}`
      : `REVIEW 은퇴 나이 — ${fmtStats(a.reviewAgeStats)}`,
    '',
  );

  lines.push('### Legacy 밴드 분포', '');
  const bands = new Set([...a.legacyBandDist.map(([bd]) => bd), ...(hasB ? b.legacyBandDist.map(([bd]) => bd) : [])]);
  const bandHeader = hasB ? ['밴드', `${labelA} n`, `${labelA} %`, `${labelB} n`, `${labelB} %`] : ['밴드', 'n', '%'];
  const bandRows = [...bands].map((band) => {
    const ra = a.legacyBandDist.find(([bd]) => bd === band);
    const rb = hasB ? b.legacyBandDist.find(([bd]) => bd === band) : undefined;
    if (!hasB) return [band, ra?.[1] ?? 0, ra?.[2] ?? 0];
    return [band, ra?.[1] ?? 0, ra?.[2] ?? 0, rb?.[1] ?? 0, rb?.[2] ?? 0];
  });
  lines.push(mdTable(bandHeader, bandRows), '');

  return lines.join('\n');
}

function renderSeasonSection(labelA, a, labelB, b) {
  const lines = ['## 시즌 지표', ''];
  const hasB = b !== undefined;

  lines.push('### 나이별(19~49) OVR 평균/p50/n', '');
  const ageHeader = hasB ? ['나이', `${labelA} 평균`, `${labelA} p50`, `${labelA} n`, `${labelB} 평균`, `${labelB} p50`, `${labelB} n`] : ['나이', '평균', 'p50', 'n'];
  const ages = new Set([...Object.keys(a.ovrByAge), ...(hasB ? Object.keys(b.ovrByAge) : [])].map(Number));
  const ageRows = [...ages].sort((x, y) => x - y).map((age) => {
    const ra = a.ovrByAge[age];
    if (!hasB) return [age, ra?.mean ?? '', ra?.p50 ?? '', ra?.n ?? 0];
    const rb = b.ovrByAge[age];
    return [age, ra?.mean ?? '', ra?.p50 ?? '', ra?.n ?? 0, rb?.mean ?? '', rb?.p50 ?? '', rb?.n ?? 0];
  });
  lines.push(mdTable(ageHeader, ageRows), '');

  lines.push('### 나이 구간별 출전시간 점유율·부상·평점', '');
  const bucketHeader = hasB
    ? ['구간', `${labelA} 출전점유%`, `${labelA} 부상/시즌`, `${labelA} 평균평점`, `${labelA} RESERVE%`, `${labelB} 출전점유%`, `${labelB} 부상/시즌`, `${labelB} 평균평점`, `${labelB} RESERVE%`]
    : ['구간', '출전점유%', '부상/시즌', '평균평점', 'RESERVE%'];
  const bucketRows = a.byAgeBucket.map((ba, i) => {
    if (!hasB) return [ba.label, ba.minutesShare, ba.injuriesPerSeason, ba.avgRating, ba.reserveRate];
    const bb = b.byAgeBucket[i];
    return [ba.label, ba.minutesShare, ba.injuriesPerSeason, ba.avgRating, ba.reserveRate, bb.minutesShare, bb.injuriesPerSeason, bb.avgRating, bb.reserveRate];
  });
  lines.push(mdTable(bucketHeader, bucketRows), '');

  lines.push('### 시즌 인덱스별 티어 분포(%, 1/2/3부)', '');
  const idxHeader = hasB
    ? ['시즌', `${labelA} T1%`, `${labelA} T2%`, `${labelA} T3%`, `${labelA} n`, `${labelB} T1%`, `${labelB} T2%`, `${labelB} T3%`, `${labelB} n`]
    : ['시즌', 'T1%', 'T2%', 'T3%', 'n'];
  const idxSet = new Set([...Object.keys(a.tierBySeasonIndex), ...(hasB ? Object.keys(b.tierBySeasonIndex) : [])].map(Number));
  const idxRows = [...idxSet].sort((x, y) => x - y).map((idx) => {
    const ta = a.tierBySeasonIndex[idx];
    if (!hasB) return [idx, ta?.[1] ?? '', ta?.[2] ?? '', ta?.[3] ?? '', ta?.n ?? 0];
    const tb = b.tierBySeasonIndex[idx];
    return [idx, ta?.[1] ?? '', ta?.[2] ?? '', ta?.[3] ?? '', ta?.n ?? 0, tb?.[1] ?? '', tb?.[2] ?? '', tb?.[3] ?? '', tb?.n ?? 0];
  });
  lines.push(mdTable(idxHeader, idxRows), '');

  lines.push('### 역할(squadRoleAtEnd) 분포', '');
  const roles = new Set([...a.roleDist.map(([r]) => r), ...(hasB ? b.roleDist.map(([r]) => r) : [])]);
  const roleHeader = hasB ? ['역할', `${labelA} n`, `${labelA} %`, `${labelB} n`, `${labelB} %`] : ['역할', 'n', '%'];
  const roleRows = [...roles].map((role) => {
    const ra = a.roleDist.find(([r]) => r === role);
    if (!hasB) return [role, ra?.[1] ?? 0, ra?.[2] ?? 0];
    const rb = b.roleDist.find(([r]) => r === role);
    return [role, ra?.[1] ?? 0, ra?.[2] ?? 0, rb?.[1] ?? 0, rb?.[2] ?? 0];
  });
  lines.push(mdTable(roleHeader, roleRows), '');

  lines.push('### 시즌당 부상 히스토그램(0~6+) — 중상 비율은 커리어 단위 severeInjuries/injuries 참고(시즌 단위 세부 심각도는 CSV에 없음)', '');
  const injHeader = hasB ? ['부상 수', `${labelA} n`, `${labelA} %`, `${labelB} n`, `${labelB} %`] : ['부상 수', 'n', '%'];
  const injRows = a.injuriesPerSeasonHist.map((h, i) => {
    if (!hasB) return [h.label, h.count, h.pct];
    const hb = b.injuriesPerSeasonHist[i];
    return [h.label, h.count, h.pct, hb.count, hb.pct];
  });
  lines.push(mdTable(injHeader, injRows), '');

  lines.push('### 계약 종류(PERMANENT/LOAN) 비율', '');
  const kinds = new Set([...a.contractKindDist.map(([k]) => k), ...(hasB ? b.contractKindDist.map(([k]) => k) : [])]);
  const kindHeader = hasB ? ['종류', `${labelA} n`, `${labelA} %`, `${labelB} n`, `${labelB} %`] : ['종류', 'n', '%'];
  const kindRows = [...kinds].map((kind) => {
    const ra = a.contractKindDist.find(([k]) => k === kind);
    if (!hasB) return [kind, ra?.[1] ?? 0, ra?.[2] ?? 0];
    const rb = b.contractKindDist.find(([k]) => k === kind);
    return [kind, ra?.[1] ?? 0, ra?.[2] ?? 0, rb?.[1] ?? 0, rb?.[2] ?? 0];
  });
  lines.push(mdTable(kindHeader, kindRows), '');

  lines.push('### 승격/강등(티어 변화) 빈도', '');
  if (!hasB) {
    lines.push(`- 시즌 경계(티어 변화 가능 지점) ${a.tierChangeOpportunities}회 중 승격 ${a.promotionRate}%, 강등 ${a.relegationRate}%`, '');
  } else {
    lines.push(
      `- ${labelA}: 시즌 경계 ${a.tierChangeOpportunities}회 중 승격 ${a.promotionRate}%, 강등 ${a.relegationRate}%`,
      `- ${labelB}: 시즌 경계 ${b.tierChangeOpportunities}회 중 승격 ${b.promotionRate}%, 강등 ${b.relegationRate}%`,
      '',
    );
  }

  return lines.join('\n');
}

function renderGroupSection(title, key, labelA, careersA, labelB, careersB) {
  const lines = [`## ${title}`, ''];
  const ga = groupBreakdown(careersA, key);
  const gb = careersB !== undefined ? groupBreakdown(careersB, key) : undefined;
  const groups = new Set([...ga.map((r) => r.group), ...(gb ?? []).map((r) => r.group)]);
  const header = gb
    ? ['그룹', `${labelA} n`, `${labelA} peakOvr평균`, `${labelA} 1부도달%`, `${labelA} 상위밴드%`, `${labelB} n`, `${labelB} peakOvr평균`, `${labelB} 1부도달%`, `${labelB} 상위밴드%`]
    : ['그룹', 'n', 'peakOvr평균', '1부도달%', '상위밴드%(LEGEND+ICON)'];
  const rows = [...groups].sort().map((g) => {
    const ra = ga.find((r) => r.group === g);
    if (!gb) return [g, ra?.n ?? 0, ra?.peakOvrMean ?? '', ra?.tier1Rate ?? '', ra?.topBandRate ?? ''];
    const rb = gb.find((r) => r.group === g);
    return [
      g, ra?.n ?? 0, ra?.peakOvrMean ?? '', ra?.tier1Rate ?? '', ra?.topBandRate ?? '',
      rb?.n ?? 0, rb?.peakOvrMean ?? '', rb?.tier1Rate ?? '', rb?.topBandRate ?? '',
    ];
  });
  lines.push(mdTable(header, rows), '');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argValue(argv, name) {
  const i = argv.indexOf(name);
  return i < 0 ? undefined : argv[i + 1];
}

async function main(argv = process.argv.slice(2)) {
  const dirA = argValue(argv, '--a');
  const dirB = argValue(argv, '--b');
  const labelA = argValue(argv, '--label-a') ?? 'A';
  const labelB = argValue(argv, '--label-b') ?? 'B';
  if (dirA === undefined) {
    process.stderr.write('career-sim-report: --a <dir>는 필수다. 선택: --b <dir> --label-a <text> --label-b <text>\n');
    process.exitCode = 1;
    return;
  }
  const runA = await loadRun(resolveRunDir(dirA));
  const runB = dirB !== undefined ? await loadRun(resolveRunDir(dirB)) : undefined;

  const careerA = careerSummary(runA.careers, runA.seasons);
  const careerB = runB !== undefined ? careerSummary(runB.careers, runB.seasons) : undefined;
  const seasonA = seasonSummary(runA.seasons);
  const seasonB = runB !== undefined ? seasonSummary(runB.seasons) : undefined;

  const out = [];
  out.push(`# career-sim 기준선 보고: ${labelA}${runB ? ` vs ${labelB}` : ''}`, '');
  out.push(renderRuntime(labelA, runA.summary));
  if (runB !== undefined) out.push(renderRuntime(labelB, runB.summary));

  if (runA.failures.length > 0) {
    out.push(`### ${labelA} 실패 목록(failures.csv, ${runA.failures.length}건)`, '');
    out.push(mdTable(['seed', 'seasonIndex', 'commandIndex', 'pendingKind', 'commandType', 'errorCode', 'message'],
      runA.failures.map((f) => [f.seed, f.seasonIndex, f.commandIndex, f.pendingKind, f.commandType, f.errorCode, f.message])), '');
  }
  if (runB !== undefined && runB.failures.length > 0) {
    out.push(`### ${labelB} 실패 목록(failures.csv, ${runB.failures.length}건)`, '');
    out.push(mdTable(['seed', 'seasonIndex', 'commandIndex', 'pendingKind', 'commandType', 'errorCode', 'message'],
      runB.failures.map((f) => [f.seed, f.seasonIndex, f.commandIndex, f.pendingKind, f.commandType, f.errorCode, f.message])), '');
  }

  out.push(renderCareerSection(labelA, careerA, runB !== undefined ? labelB : undefined, careerB));
  out.push(renderSeasonSection(labelA, seasonA, runB !== undefined ? labelB : undefined, seasonB));
  out.push(renderGroupSection('포지션별(GK/DF/MF/FW)', 'position', labelA, runA.careers, runB !== undefined ? labelB : undefined, runB?.careers));
  out.push(renderGroupSection('archetype별', 'archetypeId', labelA, runA.careers, runB !== undefined ? labelB : undefined, runB?.careers));
  out.push(renderGroupSection('background별', 'backgroundId', labelA, runA.careers, runB !== undefined ? labelB : undefined, runB?.careers));

  out.push('## 표본 오차 안내', '', '- 비율 지표(도달률·분포 %)는 n=10,000 기준 95% 신뢰구간이 대략 ±1퍼센트포인트 수준이다. n이 수백 단위로 작은 그룹(archetype·background·보조 정책 2,000표본)은 이 폭이 훨씬 커지므로 절대값 비교보다 경향만 참고한다.', '');

  process.stdout.write(out.join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export { parseCsv, careerSummary, seasonSummary, groupBreakdown };
