// 시트 본문 고르기(웹 sheets/SheetBody.svelte + PlaySheets.svelte). 종류마다 한 컴포넌트.
// 웹은 이벤트·결산·이적시장·미니게임 본문을 첫 화면 번들 밖에서 지연 로드했지만 앱은 한 번들이라 바로 고른다.
import type { SheetView } from '@offside/app-core/sheets';
import { Achieve } from './Achieve';
import { Block } from './Block';
import { Contract } from './Contract';
import { DragShot } from './DragShot';
import { EventChoice } from './EventChoice';
import { EventResult } from './EventResult';
import { Flight } from './Flight';
import { Judge } from './Judge';
import { Market } from './Market';
import { Minigame } from './Minigame';
import { Notice } from './Notice';
import { SeasonResult } from './SeasonResult';
import { Steps } from './Steps';

export function SheetBody({ v }: { v: SheetView }) {
  switch (v.kind) {
    case 'steps':
      return <Steps v={v} />;
    case 'block':
      return <Block v={v} />;
    case 'judge':
      return <Judge v={v} />;
    case 'minigame':
      return <Minigame v={v} />;
    case 'dragShot':
      return <DragShot v={v} />;
    case 'event':
      return <EventChoice v={v} />;
    case 'eventResult':
      return <EventResult v={v} />;
    case 'season':
      return <SeasonResult v={v} />;
    case 'market':
      return <Market v={v} />;
    case 'contract':
      return <Contract v={v} />;
    case 'flight':
      return <Flight v={v} />;
    case 'notice':
      return <Notice v={v} />;
    case 'achieve':
      return <Achieve v={v} />;
  }
}
