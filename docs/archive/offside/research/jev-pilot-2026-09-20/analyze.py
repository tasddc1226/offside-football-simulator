"""Recompute the offline pilot from saved synthetic engine outputs."""
import csv
import json
import random
import statistics
from pathlib import Path

HERE = Path(__file__).resolve().parent

def load(name):
    return json.loads((HERE / name).read_text())

def careers(name):
    with (HERE / name).open() as f:
        return {r['seed']: r for r in csv.DictReader(f)}

def trace(name):
    rows = [json.loads(l) for l in (HERE / name).read_text().splitlines()]
    seen, repeats = set(), []
    for row in rows:
        key = (row['careerId'], row['eventId'])
        if key in seen:
            repeats.append(row)
        seen.add(key)
    agent = [r for r in rows if r['eventId'] == 'EVT-REL-008']
    repeated_agent = [r for r in repeats if r['eventId'] == 'EVT-REL-008']
    return {
        'resolvedEvents': len(rows),
        'uniqueEventIds': len({r['eventId'] for r in rows}),
        'repeatedEventOccurrences': len(repeats),
        'nonInjuryNonNationalOccurrences': sum(not r['eventId'].startswith(('EVT-INJ-', 'EVT-NAT-')) for r in rows),
        'nonInjuryNonNationalRepeatedOccurrences': sum(not r['eventId'].startswith(('EVT-INJ-', 'EVT-NAT-')) for r in repeats),
        'agentDiscontentOccurrences': len(agent),
        'agentDiscontentCareers': len({r['careerId'] for r in agent}),
        'agentDiscontentRepeated': len(repeated_agent),
        'agentDiscontentRepeatedWithRelationshipChange': sum(r['changedRelationships'] for r in repeated_agent),
        'agentDiscontentRepeatedWithoutRelationshipChange': sum(not r['changedRelationships'] for r in repeated_agent),
        'emptyManagerMemory': sum(not r['memory'] for r in rows),
    }

a = careers('random-careers.csv')
b = careers('opportunity-careers.csv')
c = careers('observed-careers.csv')
assert a.keys() == b.keys() == c.keys()
assert all(a[k]['stateHash'] == c[k]['stateHash'] for k in a), 'Observer changed simulation'
deltas = [float(b[k]['peakOvr']) - float(a[k]['peakOvr']) for k in a]
rng = random.Random(20260920)
bootstrap = sorted(statistics.mean(rng.choices(deltas, k=len(deltas))) for _ in range(5000))
result = {
    'engine': {'ruleset': '2.0.0', 'pack': '0.7.0', 'seedPrefix': 'jev-pilot-20260920', 'seeds': 40, 'seasons': 10, 'mode': 'FAST'},
    'policies': {p: {'careers': load(p+'-summary.json')['careers'], **load(p+'-summary.json')['overall']} for p in ['random', 'opportunity', 'per-visit']},
    'pairedPeakOvrDifference': {'mean': statistics.mean(deltas), 'bootstrap95': [bootstrap[124], bootstrap[4874]], 'method': 'paired percentile bootstrap 5000 resamples, seed 20260920; exploratory'},
    'trace': {**trace('event-trace.jsonl'), 'observerHashesEqual': True},
    'perVisitIntervention': {**trace('per-visit-event-trace.jsonl'), 'choiceChangedOnlyInCopiedCLI': True},
    'jev': {'status': 'NOT_RUN', 'reason': 'TYPESAFE_API_KEY unavailable', 'requests': 0, 'measuredCost': 0},
}
if (HERE / 'live-summary.json').exists():
    result['jev'] = {'status': 'EXECUTED', **load('live-summary.json')}
(HERE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'observerHashCheck': '40/40', 'trace': result['trace'], 'perVisit': result['perVisitIntervention']}, ensure_ascii=False, indent=2))
