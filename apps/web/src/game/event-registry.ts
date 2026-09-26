// ───────── 이벤트 정의 등록 ─────────
// 이벤트 정의 모듈은 import될 때 EVENTS(events-data.ts)에 push하는 부수효과로 등록된다.
// 게임을 진행하는 경로(ui/actions.ts)와 배럴(index.ts)이 모두 이 모듈을 import해야 한다 — 빠지면
// rollEvent가 군 복무 이벤트 2개만 보고 랜덤·스토리·현실 이벤트가 전혀 뜨지 않는다(T-10-033).
// 순서는 원본 스크립트 로드 순서(events → stories → military → realevents → positional)를 따른다.
import './events.js';
import './stories.js';
import './military.js';
import './realevents.js';
import './positional.js';
