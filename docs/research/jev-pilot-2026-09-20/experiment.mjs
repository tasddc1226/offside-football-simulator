// Synthetic director-reaction experiment. No production data or engine mutations.
import { mkdir, writeFile, readFile, appendFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const out = import.meta.dirname;
const options = {
  NONE:'Do not interrupt the player; allow ordinary training to continue.',
  ENCOURAGE:'Privately encourage a discouraged player without promising selection.',
  WARNING:'Privately address a documented discipline problem.',
  OPPORTUNITY:'Offer an eligible, healthy player a limited playing opportunity.',
  PROMISE_MEETING:'Acknowledge an unmet playing-time promise and discuss a realistic plan.',
  ROLE_REVIEW:'Discuss a concrete tactical-role mismatch.',
  RECOVERY:'Protect an injured player with a recovery discussion.',
};
const koOptions = {
  NONE:'개입하지 않고 평소 훈련을 이어간다.', ENCOURAGE:'출전을 약속하지 않고 낙담한 선수를 격려한다.',
  WARNING:'기록된 규율 문제를 개별 면담한다.', OPPORTUNITY:'건강하고 출전 가능한 선수에게 제한적인 기회를 준다.',
  PROMISE_MEETING:'지키지 못한 출전 약속을 인정하고 현실적인 계획을 논의한다.',
  ROLE_REVIEW:'구체적인 전술 역할 부적합을 논의한다.', RECOVERY:'부상 선수에게 회복을 우선하는 면담을 한다.',
};
const styles=['supportive','strict','tactical','youth_developer'];
const families=['promise','injury','tactics','discipline','cadence'];
const cases=[];
for(const family of families)for(const style of styles)for(let i=0;i<5;i++)for(const variant of [0,1]){
  const state={managerStyle:style,age:19+i,fitness:'healthy',morale:'neutral',
    playingTime:'low',training:'good',promise:'none',tacticalFit:'good',
    discipline:'good',stepsSinceLastMeeting:5,criticalChange:false};
  if(family==='promise')state.promise=variant?'broken':'none';
  if(family==='injury')state.fitness=variant?'injured':'healthy';
  if(family==='tactics')state.tacticalFit=variant?'poor':'good';
  if(family==='discipline')state.discipline=variant?'documented_problem':'good';
  if(family==='cadence')state.stepsSinceLastMeeting=variant?0:5;
  const id=`${family}-${style}-${i}-${variant}`;
  const forbidden=[];
  if(state.fitness==='injured')forbidden.push('OPPORTUNITY');
  if(state.promise!=='broken')forbidden.push('PROMISE_MEETING');
  if(state.discipline!=='documented_problem')forbidden.push('WARNING');
  if(state.tacticalFit!=='poor')forbidden.push('ROLE_REVIEW');
  if(state.fitness!=='injured')forbidden.push('RECOVERY');
  cases.push({id,pairId:id.slice(0,-2),family,variant,state,forbidden});
}
// Proposed hand-authored comparator, NOT OFFSIDE's existing director or ground truth.
function rules(s){
  if(s.fitness==='injured')return 'RECOVERY';
  if(s.promise==='broken')return 'PROMISE_MEETING';
  if(s.discipline==='documented_problem')return 'WARNING';
  if(s.stepsSinceLastMeeting<2&&!s.criticalChange)return 'NONE';
  if(s.tacticalFit==='poor')return 'ROLE_REVIEW';
  if(s.managerStyle==='youth_developer'&&s.playingTime==='low')return 'OPPORTUNITY';
  if(s.managerStyle==='supportive')return 'ENCOURAGE';
  return 'NONE';
}
function weighted(id){
  // Deliberately context-free control, not the existing event-selector algorithm.
  const n=createHash('sha256').update(id).digest().readUInt32BE(0);
  return Object.keys(options)[n%Object.keys(options).length];
}
function korean(s){
  const values={supportive:'격려형',strict:'엄격형',tactical:'전술형',youth_developer:'유망주육성형',
    healthy:'건강',injured:'부상',neutral:'보통',low:'적음',good:'좋음',none:'없음',broken:'불이행',poor:'낮음',documented_problem:'기록된 규율 문제'};
  return {감독성향:values[s.managerStyle],나이:s.age,몸상태:values[s.fitness],사기:values[s.morale],
    출전시간:values[s.playingTime],훈련태도:values[s.training],출전약속:values[s.promise],
    전술적합도:values[s.tacticalFit],규율:values[s.discipline],마지막면담이후단계:s.stepsSinceLastMeeting,중대한변화:s.criticalChange};
}
function request(c,variant='base'){
  const ko=variant==='ko';
  const criteria=ko?koOptions:variant==='reorder'?Object.fromEntries(Object.entries(options).reverse()):options;
  return {model:'jev-1.13.0',state:ko?korean(c.state):c.state,questions:{reaction:{type:'choice',
    instructions:ko?'감독 성향과 선수 상황에 맞는 다음 반응 하나를 고르세요. 부상자에게 출전을 제안하지 마세요. 없는 문제나 약속을 만들어내지 마세요. 최근 면담했다면 긴급한 이유 없이 반복 개입하지 마세요. 선수의 선택을 존중하세요.':'Choose the next manager reaction fitting the manager style and player situation. Never offer play to an injured player. Do not invent problems or promises. Avoid repeated intervention after a recent meeting without an urgent reason. Respect player agency.',criteria}}};
}
function summarize(rows){
 const counts={};for(const r of rows)counts[r.choice]=(counts[r.choice]??0)+1;
 const pairs=new Map();for(const r of rows){const a=pairs.get(r.pairId)??[];a.push(r);pairs.set(r.pairId,a);}
 return {n:rows.length,forbidden:rows.filter(r=>r.forbidden.includes(r.choice)).length,counts,
   pairedChoiceChanges:Object.fromEntries(families.map(f=>{const ps=[...pairs.values()].filter(p=>p.length===2&&p[0].family===f);return [f,{changed:ps.filter(p=>p[0].choice!==p[1].choice).length,pairs:ps.length}];}))};
}
await mkdir(out,{recursive:true});
await writeFile(`${out}/cases.json`,JSON.stringify(cases,null,2)+'\n');
const controls={contextFreeControl:summarize(cases.map(c=>({...c,choice:weighted(c.pairId)}))),
  proposedRules:summarize(cases.map(c=>({...c,choice:rules(c.state)})))};
await writeFile(`${out}/controls.json`,JSON.stringify(controls,null,2)+'\n');
await writeFile(`${out}/request-example.json`,JSON.stringify(request(cases[1]),null,2)+'\n');
if(!process.argv.includes('--live')){
  console.log(JSON.stringify({cases:cases.length,pairs:cases.length/2,controls,jev:'NOT_RUN: use --live with TYPESAFE_API_KEY'},null,2));
}else{
  if(!process.env.TYPESAFE_API_KEY)throw new Error('Missing TYPESAFE_API_KEY; no model calls made');
  // 200 primary + balanced 40-case language/order/repeat probes = 320 maximum requests.
  const probes=cases.filter((c,i)=>i%10<2);
  const jobs=[...cases.map(c=>({c,v:'base'})),...['ko','reorder','repeat'].flatMap(v=>probes.map(c=>({c,v})))];
  const file=`${out}/live-responses.jsonl`;
  let old='';try{old=await readFile(file,'utf8');}catch{}
  const records=old.trim()?old.trim().split('\n').map(l=>JSON.parse(l)):[];
  const done=new Set(records.map(r=>r.key));
  let bytes=records.reduce((n,r)=>n+r.requestBytes,0);
  for(const {c,v}of jobs){
    const key=`${c.id}:${v}`;
    const body=JSON.stringify(request(c,v));
    const requestHash=createHash('sha256').update(body).digest('hex');
    if(done.has(key)){
      if(records.find(r=>r.key===key).requestHash!==requestHash)throw new Error('Saved request differs; use a fresh output directory');
      continue;
    }
    bytes+=Buffer.byteLength(body);
    // Conservative request-byte budget, no retries; stop far below $1 at published price.
    if(bytes>2_000_000)throw new Error('Experiment request budget exhausted');
    const started=performance.now();
    const response=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',
      headers:{Authorization:`Bearer ${process.env.TYPESAFE_API_KEY}`,'Content-Type':'application/json'},body,signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error(`Jev returned HTTP ${response.status}; stopped without logging credentials`);
    const answer=await response.json();
    const a=answer.answers?.reaction;
    if(!a||!Object.hasOwn(options,a.choice))throw new Error('Invalid reaction schema');
    const record={key,id:c.id,variant:v,model:answer.model,latencyMs:performance.now()-started,
      requestHash,requestBytes:Buffer.byteLength(body),answer:a,usage:answer.usage};
    records.push(record);await appendFile(file,JSON.stringify(record)+'\n');
  }
  const base=records.filter(r=>r.variant==='base');
  const match=new Map(base.map(r=>[r.id,r.answer.choice]));
  const latencies=records.map(r=>r.latencyMs).sort((a,b)=>a-b);
  const summary={model:'jev-1.13.0',requests:records.length,
    base:summarize(base.map(r=>({...cases.find(c=>c.id===r.id),choice:r.answer.choice}))),
    agreement:Object.fromEntries(['ko','reorder','repeat'].map(v=>{const rs=records.filter(r=>r.variant===v);return [v,{same:rs.filter(r=>r.answer.choice===match.get(r.id)).length,n:rs.length}];})),
    p50Ms:latencies[Math.ceil(latencies.length*.5)-1],p95Ms:latencies[Math.ceil(latencies.length*.95)-1],
    inputTokens:records.reduce((n,r)=>n+(r.usage?.input_tokens??0),0)};
  await writeFile(`${out}/live-summary.json`,JSON.stringify(summary,null,2)+'\n');
  console.log(summary);
}
