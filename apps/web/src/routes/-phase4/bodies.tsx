import type { EventDecisionContext } from '../../shared/event-screen.js';
import { InjuryContext } from './injury.js';
import { NationalTeamContext } from './national-team.js';
import { SlumpContext } from './slump.js';
import { LockerRoomContext } from './locker-room.js';
import { EthicsContext } from './ethics.js';
import { MediaContext } from './media.js';

/** 표시만 바꾸고 확정·재시도·저장은 EventDecisionScreen에서 공통 처리한다. */
export function Phase4Context(context: EventDecisionContext) {
  const kind = context.state.pending?.kind;
  if (kind === 'INJURY') return <InjuryContext {...context} />;
  if (kind === 'NATIONAL_TEAM') return <NationalTeamContext {...context} />;
  const presentation = context.definition.presentation;
  if (presentation === 'SLUMP') return <SlumpContext {...context} />;
  if (presentation === 'LOCKER_ROOM') return <LockerRoomContext {...context} />;
  if (presentation === 'ETHICS') return <EthicsContext {...context} />;
  if (presentation === 'MEDIA') return <MediaContext {...context} />;
  return null;
}
