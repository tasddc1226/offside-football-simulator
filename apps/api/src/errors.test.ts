import { describe, expect, it } from 'vitest';
import { toErrorEnvelope } from './errors.js';
import { localizeMessage } from './errorText.js';
import { pushText } from './push/text.js';
import { createApp } from './app.js';

describe('toErrorEnvelope unknown errors (T-2-015)', () => {
  it('SQL 전문 대신 고정 문구를 503으로 돌려준다', () => {
    const err = new Error(
      'Failed query: insert into "analytics_events" ("id","client_id") values (?,?)',
    );
    const { status, body } = toErrorEnvelope(err, 'req_test');

    expect(status).toBe(503);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.message).toBe('일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.');
    expect(body.error.message).not.toContain('insert');
  });

  it('Error가 아닌 값을 던져도 같은 고정 문구를 돌려준다', () => {
    const { status, body } = toErrorEnvelope('boom', 'req_test');

    expect(status).toBe(503);
    expect(body.error.message).toBe('일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.');
  });
});

describe('오류 문구 영어(T-11-106)', () => {
  const korean = '일시적인 오류가 생겼어요. 잠시 후 다시 시도해 주세요.';
  it('lang이 없으면 한국어 그대로, en이면 영어이고 code·retryable은 같다', () => {
    const ko = toErrorEnvelope(new Error('x'), 'req_test');
    const en = toErrorEnvelope(new Error('x'), 'req_test', 'en');
    expect(ko.body.error.message).toBe(korean);
    expect(en.body.error.message).toBe('Something went wrong. Please try again in a moment.');
    expect(en.body.error.code).toBe(ko.body.error.code);
    expect(en.body.error.retryable).toBe(ko.body.error.retryable);
  });

  it('숫자·이름이 끼는 문장도 옮기고, 표에 없는 문장은 한국어로 둔다', () => {
    expect(localizeMessage('한 번에 5명까지 내놓을 수 있어요.', 'en')).toBe(
      'You can list up to 5 players at a time.',
    );
    expect(localizeMessage('쓸 수 없는 팀 이름이에요.', 'en')).toBe(
      "That team name isn't allowed.",
    );
    expect(localizeMessage("'운영자'처럼 운영진으로 보이는 감독 이름은 쓸 수 없어요.", 'en')).toBe(
      "A manager name that looks like staff, such as 'Moderator', isn't allowed.",
    );
    expect(localizeMessage('글 항목을 찾을 수 없어요.', 'en')).toBe("We couldn't find that post.");
    expect(localizeMessage('지난 시즌 선수는 선발에 3명까지 넣을 수 있어요.', 'en')).toBe(
      'You can start up to 3 players from past seasons.',
    );
    expect(localizeMessage('표에 없는 문장', 'en')).toBe('표에 없는 문장');
    expect(localizeMessage('팀을 찾을 수 없어요.', 'ko')).toBe('팀을 찾을 수 없어요.');
  });

  it('없는 경로와 라우트 오류도 ?lang=en이면 영어 봉투로 나간다', async () => {
    const app = createApp();
    const body = async (path: string) =>
      ((await (await app.request(path)).json()) as { error: { message: string } }).error.message;
    expect(await body('/v1/없는-경로')).toBe('요청한 경로를 찾을 수 없어요.');
    expect(await body('/v1/없는-경로?lang=en')).toBe("We couldn't find what you asked for.");
  });
});

describe('알림 문구 영어 (T-11-106)', () => {
  it('친구·팀 경기 결과 본문은 팀 이름을 두고 안내만 옮긴다', () => {
    expect(pushText('새 친구 신청이 왔어요', 'en')).toBe('You have a new friend request');
    expect(pushText('FC 하나 2 : 1 FC 둘. 친구 목록에서 경기 결과를 확인해 주세요.', 'en')).toBe(
      'FC 하나 2 : 1 FC 둘. Check the result in your friend list.',
    );
    expect(pushText('FC 하나 2 : 1 FC 둘. 최근 경기에서 결과를 확인해 주세요.', 'ko')).toBe(
      'FC 하나 2 : 1 FC 둘. 최근 경기에서 결과를 확인해 주세요.',
    );
  });
});
