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
  LoanReturnPayloadSchema,
  NegotiatePayloadSchema,
  RejectOfferPayloadSchema,
  ResolveEventPayloadSchema,
  ResolveRolePayloadSchema,
  SettleSeasonPayloadSchema,
  StartSeasonPayloadSchema,
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

  // T-2-001·T-2-002 D-25/D-34: 시즌 명령 3종.
  it('START_SEASON', () => {
    expectTypeOf<z.infer<typeof StartSeasonPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'START_SEASON' }>['payload']
    >();
  });

  it('SETTLE_SEASON', () => {
    expectTypeOf<z.infer<typeof SettleSeasonPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'SETTLE_SEASON' }>['payload']
    >();
  });

  it('RESOLVE_ROLE', () => {
    expectTypeOf<z.infer<typeof ResolveRolePayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'RESOLVE_ROLE' }>['payload']
    >();
  });

  // T-3-001 D-44/D-46: 처리기는 T-3-003 전까지 없지만, payload 형태는 domain Command와 여기서 맞춘다.
  it('NEGOTIATE', () => {
    expectTypeOf<z.infer<typeof NegotiatePayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'NEGOTIATE' }>['payload']
    >();
  });

  it('REJECT_OFFER', () => {
    expectTypeOf<z.infer<typeof RejectOfferPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'REJECT_OFFER' }>['payload']
    >();
  });

  it('LOAN_RETURN', () => {
    expectTypeOf<z.infer<typeof LoanReturnPayloadSchema>>().toEqualTypeOf<
      Extract<Command, { type: 'LOAN_RETURN' }>['payload']
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

describe('NegotiatePayloadSchema', () => {
  it('offerId·ask가 유효하면 받아들인다', () => {
    expect(NegotiatePayloadSchema.safeParse({ offerId: 'OFR-2-0', ask: 'WAGE' }).success).toBe(true);
  });

  it('ask가 화이트리스트 밖이면 거부한다', () => {
    expect(NegotiatePayloadSchema.safeParse({ offerId: 'OFR-2-0', ask: 'SIGNING_BONUS' }).success).toBe(false);
  });

  it('offerId가 빈 문자열이면 거부한다', () => {
    expect(NegotiatePayloadSchema.safeParse({ offerId: '', ask: 'WAGE' }).success).toBe(false);
  });
});

describe('RejectOfferPayloadSchema', () => {
  it('offerId가 문자열이면 받아들인다', () => {
    expect(RejectOfferPayloadSchema.safeParse({ offerId: 'OFR-2-0' }).success).toBe(true);
  });

  it('offerId가 null이면 받아들인다(전부 거절 → 잔류)', () => {
    expect(RejectOfferPayloadSchema.safeParse({ offerId: null }).success).toBe(true);
  });

  it('offerId가 빈 문자열이면 거부한다', () => {
    expect(RejectOfferPayloadSchema.safeParse({ offerId: '' }).success).toBe(false);
  });

  it('offerId가 없으면 거부한다', () => {
    expect(RejectOfferPayloadSchema.safeParse({}).success).toBe(false);
  });
});

describe('LoanReturnPayloadSchema', () => {
  it('decision이 RETURN/PERMANENT면 받아들인다', () => {
    expect(LoanReturnPayloadSchema.safeParse({ decision: 'RETURN' }).success).toBe(true);
    expect(LoanReturnPayloadSchema.safeParse({ decision: 'PERMANENT' }).success).toBe(true);
  });

  it('decision이 화이트리스트 밖이면 거부한다', () => {
    expect(LoanReturnPayloadSchema.safeParse({ decision: 'EXTEND' }).success).toBe(false);
  });
});

describe('T-3-004 계약 명령 strict payload 회귀', () => {
  const cases = [
    {
      type: 'NEGOTIATE' as const,
      schema: NegotiatePayloadSchema,
      valid: { offerId: 'OFR-16-1', ask: 'WAGE' as const },
      invalid: [
        { offerId: 'OFR-16-1', ask: 'BONUS' },
        { offerId: '', ask: 'WAGE' },
        { offerId: 'OFR-16-1', ask: 'WAGE', extra: true },
      ],
    },
    {
      type: 'ACCEPT_OFFER' as const,
      schema: AcceptOfferPayloadSchema,
      valid: { offerId: 'OFR-16-1' },
      invalid: [{ offerId: '' }, { offerId: null }, { offerId: 'OFR-16-1', extra: true }],
    },
    {
      type: 'REJECT_OFFER' as const,
      schema: RejectOfferPayloadSchema,
      valid: { offerId: null },
      invalid: [{ offerId: '' }, { offerId: 123 }, { offerId: null, extra: true }],
    },
    {
      type: 'LOAN_RETURN' as const,
      schema: LoanReturnPayloadSchema,
      valid: { decision: 'RETURN' as const },
      invalid: [{ decision: 'EXTEND' }, { decision: null }, { decision: 'RETURN', extra: true }],
    },
  ] as const;

  it.each(cases)('$type의 직접 payload 스키마가 유효한 값만 받는다', ({ schema, valid, invalid }) => {
    expect(schema.safeParse(valid).success).toBe(true);
    for (const value of invalid) {
      expect(schema.safeParse(value).success).toBe(false);
    }
  });

  it.each(cases)('$type의 CommandRequestSchema가 payload drift를 거부한다', ({ type, valid, invalid }) => {
    const base = { commandId: `cmd-${type.toLowerCase()}`, expectedRevision: 17, type };
    expect(CommandRequestSchema.safeParse({ ...base, payload: valid }).success).toBe(true);
    for (const value of invalid) {
      expect(CommandRequestSchema.safeParse({ ...base, payload: value }).success).toBe(false);
    }
  });

  it.each(cases)('$type의 CommandLogEntrySchema가 payload drift를 거부한다', ({ type, valid, invalid }) => {
    const base = {
      careerId: 'car_contract_sync',
      revision: 17,
      commandId: `cmd-log-${type.toLowerCase()}`,
      resultHash: 'a'.repeat(64),
      createdAt: '2026-09-04T00:00:00Z',
      commandType: type,
    };
    expect(CommandLogEntrySchema.safeParse({ ...base, payload: valid }).success).toBe(true);
    for (const value of invalid) {
      expect(CommandLogEntrySchema.safeParse({ ...base, payload: value }).success).toBe(false);
    }
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

  // T-2-002 D-34 CMD-SIM-004: RESOLVE_ROLE도 START_SEASON·SETTLE_SEASON처럼 domain Command와 같은
  // 형태의 payload 스키마를 갖는다(임의 payload가 아니다). COMMAND_TYPES에 있는지는 index.test.ts의
  // CommandTypeSchema 순회 테스트가 이미 검사한다.
  it('RESOLVE_ROLE은 decision이 ACCEPT·DECLINE이면 통과하고 그 외 값·임의 payload는 거부한다', () => {
    const accept = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'RESOLVE_ROLE',
      payload: { decision: 'ACCEPT' },
    });
    expect(accept.success).toBe(true);

    const decline = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'RESOLVE_ROLE',
      payload: { decision: 'DECLINE' },
    });
    expect(decline.success).toBe(true);

    const invalidDecision = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'RESOLVE_ROLE',
      payload: { decision: 'MAYBE' },
    });
    expect(invalidDecision.success).toBe(false);

    const arbitraryPayload = CommandRequestSchema.safeParse({
      commandId: 'cmd_1',
      expectedRevision: 1,
      type: 'RESOLVE_ROLE',
      payload: { anything: 'goes' },
    });
    expect(arbitraryPayload.success).toBe(false);
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
      commandType: 'RETIRE',
      payload: { anything: true },
    });
    expect(result.success).toBe(true);
  });
});
