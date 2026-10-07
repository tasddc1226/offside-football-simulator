// 이벤트 일본어 문구(events-data.ts EventText) — 이벤트 id → 문구. 정의 모듈별 파일을 묶는다.
import type { EventText } from '../../events-data';
import { events_base } from './events-base';
import { events_military } from './events-military';
import { events_positional } from './events-positional';
import { events_real } from './events-real';
import { events_story } from './events-story';

export const events: Record<string, EventText> = {
  ...events_base,
  ...events_real,
  ...events_story,
  ...events_positional,
  ...events_military,
};
