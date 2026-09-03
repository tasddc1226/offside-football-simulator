import type { Command } from '@offside/domain';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { z } from 'zod';
import {
  AcceptOfferPayloadSchema,
  AdvancePayloadSchema,
  CommandLogEntrySchema,
  CommandRequestSchema,
  ConfirmPlayerPayloadSchema,
  CreateCareerPayloadSchema,
  ResolveEventPayloadSchema,
  UpdatePlayerDraftPayloadSchema,
} from './commands.js';

describe('명령 payload 타입 동일성(domain Command와)', () => {
  it('CREATE_CAREER', () => {
    expectTypeOf<z.infer<typeof CreateCareerPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'CREATE_CAREER' }>['payload']
    >();
  });

  it('UPDATE_PLAYER_DRAFT', () => {
    expectTypeOf<z.infer<typeof UpdatePlayerDraftPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'UPDATE_PLAYER_DRAFT' }>['payload']
    >();
  });

  it('CONFIRM_PLAYER', () => {
    expectTypeOf<z.infer<typeof ConfirmPlayerPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'CONFIRM_PLAYER' }>['payload']
    >();
  });

  it('ADVANCE', () => {
    expectTypeOf<z.infer<typeof AdvancePayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'ADVANCE' }>['payload']
    >();
  });

  it('RESOLVE_EVENT', () => {
    expectTypeOf<z.infer<typeof ResolveEventPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'RESOLVE_EVENT' }>['payload']
    >();
  });

  // T-1-005가 main에 머지되어 domain Command에 ACCEPT_OFFER가 있다(2026-09-02). D-9 리터럴과의
  // 비교가 아니라 domain Command에서 직접 Extract한다.
  it('ACCEPT_OFFER', () => {
    expectTypeOf<z.infer<typeof AcceptOfferPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'ACCEPT_OFFER' }>['payload']
    >();
  });
});

describe('CreateCareerPayloadSchema', () => {
  const valid = {
    careerId: 'car_1',
    seed: 'seed-1',
    simulationMode: 'FAST' as const,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  };

  it('유효한 payload를 받아들인다', () => {
    expect(CreateCareerPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('semver 형식이 아닌 rulesetVersion은 거부한다', () => {
    expect(CreateCareerPayloadSchema.safeParse({ ...valid, rulesetVersion: '1.0' }).success).toBe(false);
  });
});

describe('UpdatePlayerDraftPayloadSchema', () => {
  it('일부 필드만 있는 draft를 받아들인다', () => {
    expect(UpdatePlayerDraftPayloadSchema.safeParse({ draft: { name: '김서준' } }).success).toBe(true);
  });

  it('draft에 알 수 없는 필드가 있으면 거부한다', () => {
    expect(UpdatePlayerDraftPayloadSchema.safeParse({ draft: { nickname: 'x' } }).success).toBe(false);
  });
});

describe('ConfirmPlayerPayloadSchema', () => {
  it('빈 객체를 받아들인다', () => {
    expect(ConfirmPlayerPayloadSchema.safeParse({}).success).toBe(true);
  });

  it('필드가 있으면 거부한다', () => {
    expect(ConfirmPlayerPayloadSchema.safeParse({ foo: 1 }).success).toBe(false);
  });
});

describe('AdvancePayloadSchema', () => {
  it('eventId 오름차순 eligibleEvents를 받아들인다', () => {
    const result = AdvancePayloadSchema.safeParse({
      eligibleEvents: [
        { eventId: 'EVT-CON-002', version: 1, weight: 1 },
        { eventId: 'EVT-CON-003', version: 1, weight: 2 },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('빈 배열을 받아들인다', () => {
    expect(AdvancePayloadSchema.safeParse({ eligibleEvents: [] }).success).toBe(true);
  });

  it('eventId 정렬이 어긋나면 거부한다', () => {
    const result = AdvancePayloadSchema.safeParse({
      eligibleEvents: [
        { eventId: 'EVT-CON-003', version: 1, weight: 1 },
        { eventId: 'EVT-CON-002', version: 1, weight: 1 },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('weight 0은 거부한다', () => {
    const result = AdvancePayloadSchema.safeParse({
      eligibleEvents: [{ eventId: 'EVT-CON-002', version: 1, weight: 0 }],
    });
    expect(result.success).toBe(false);
  });
});

describe('ResolveEventPayloadSchema', () => {
  const validOutcome = { id: 'a', weight: 1, effects: [] };

  it('outcomes 1개 이상이면 받아들인다', () => {
    const result = ResolveEventPayloadSchema.safeParse({
      eventId: 'EVT-CON-002',
      definitionVersion: 1,
      choiceId: 'a',
      outcomes: [validOutcome],
    });
    expect(result.success).toBe(true);
  });

  it('outcomes가 빈 배열이면 거부한다', () => {
    const result = ResolveEventPayloadSchema.safeParse({
      eventId: 'EVT-CON-002',
      definitionVersion: 1,
      choiceId: 'a',
      outcomes: [],
    });
    expect(result.success).toBe(false);
  });
});

describe('AcceptOfferPayloadSchema', () => {
  it('offerId가 있으면 받아들인다', () => {
    expect(AcceptOfferPayloadSchema.safeParse({ offerId: 'OFR-2-0' }).success).toBe(true);
  });

  it('offerId가 없으면 거부한다', () => {
    expect(AcceptOfferPayloadSchema.safeParse({}).success).toBe(false);
  });
});

describe('CommandRequestSchema', () => {
  it('알 수 없는 type은 거부한다', () => {
    const result = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 0,
      type: 'UNKNOWN_COMMAND',
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it('Phase 1 명령은 payload가 스키마에 맞아야 성공한다', () => {
    const result = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 0,
      type: 'CONFIRM_PLAYER',
      payload: {},
    });
    expect(result.success).toBe(true);
  });

  it('Phase 1 명령은 payload가 스키마에 맞지 않으면 실패한다', () => {
    const result = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 0,
      type: 'CONFIRM_PLAYER',
      payload: { foo: 1 },
    });
    expect(result.success).toBe(false);
  });

  // T-2-001: START_SEASON은 domain Command와 같은 형태의 payload 스키마를 갖는다(더는 임의 payload가 아니다).
  it('START_SEASON은 simulationMode·serviceSeasonId가 있으면 통과한다', () => {
    const result = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'START_SEASON',
      payload: { simulationMode: 'FAST', serviceSeasonId: 'svc_1' },
    });
    expect(result.success).toBe(true);
  });

  it('START_SEASON은 임의 payload를 거부한다', () => {
    const result = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'START_SEASON',
      payload: { anything: 'goes' },
    });
    expect(result.success).toBe(false);
  });

  it('SETTLE_SEASON은 빈 payload면 통과하고, 필드가 있으면 거부한다', () => {
    const ok = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'SETTLE_SEASON',
      payload: {},
    });
    expect(ok.success).toBe(true);

    const rejected = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'SETTLE_SEASON',
      payload: { extra: true },
    });
    expect(rejected.success).toBe(false);
  });

  it('Phase 2+ 명령(RETIRE)도 임의 payload를 통과시킨다', () => {
    const result = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 5,
      type: 'RETIRE',
      payload: {},
    });
    expect(result.success).toBe(true);
  });
});

describe('CommandLogEntrySchema', () => {
  const base = {
    careerId: 'car_1',
    revision: 1,
    commandId: 'cmd_1',
    resultHash: 'a'.repeat(64),
    createdAt: '2026-09-02T00:00:00Z',
  };

  it('commandType과 payload가 맞으면 성공한다', () => {
    const result = CommandLogEntrySchema.safeParse({
      ...base,
      commandType: 'ACCEPT_OFFER',
      payload: { offerId: 'OFR-1-0' },
    });
    expect(result.success).toBe(true);
  });

  it('commandType과 payload가 맞지 않으면 실패한다', () => {
    const result = CommandLogEntrySchema.safeParse({
      ...base,
      commandType: 'CONFIRM_PLAYER',
      payload: { offerId: 'OFR-1-0' },
    });
    expect(result.success).toBe(false);
  });

  it('Phase 2+ 명령은 임의 payload로 성공한다', () => {
    const result = CommandLogEntrySchema.safeParse({
      ...base,
      commandType: 'NEGOTIATE',
      payload: { anything: true },
    });
    expect(result.success).toBe(true);
  });
});
