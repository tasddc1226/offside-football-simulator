import { useRef, useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FriendlyHistorySchema,
  FriendlyReceiptSchema,
  LockerRoomSchema,
  type FriendlyReceipt,
} from '@offside/contracts';
import { Button } from '@offside/ui';
import { apiFetch, getProfile } from '../api/client.js';
import { platform } from '../platform/index.js';
import '../shared/friendlies.css';

export const Route = createFileRoute('/friendlies')({ component: FriendliesScreen });
const tactics = {
  BALANCED: { label: '균형', description: '공격과 수비의 기본 균형을 유지합니다.' },
  PRESS: { label: '압박', description: '공격과 볼 전개를 높이는 대신 수비에 빈틈이 생깁니다.' },
  COUNTER: {
    label: '역습',
    description: '수비를 강화하는 대신 공격 기회의 질에 불리할 수 있습니다.',
  },
} as const;
type Tactic = keyof typeof tactics;

export function FriendliesScreen() {
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await getProfile();
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  if (profile.isPending)
    return (
      <div className="friendlies" role="status">
        계정을 확인하는 중…
      </div>
    );
  if (profile.isError)
    return (
      <div className="friendlies" role="alert">
        <p>{profile.error.message}</p>
        <Button
          onClick={() => {
            void profile.refetch();
          }}
        >
          계정 다시 불러오기
        </Button>
      </div>
    );
  return <OwnedFriendlies key={profile.data.id} owner={profile.data.id} />;
}

function OwnedFriendlies({ owner }: { owner: string }) {
  const cache = useQueryClient();
  const room = useQuery({
    queryKey: ['friendly-teams', owner],
    enabled: !!owner,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const response = await apiFetch('/v1/locker-room', {}, LockerRoomSchema);
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  const history = useQuery({
    queryKey: ['friendly-history', owner],
    enabled: !!owner,
    queryFn: async () => {
      const response = await apiFetch(
        '/v1/locker-room/friendlies',
        { cache: 'no-store' },
        FriendlyHistorySchema,
      );
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
  });
  const [teamId, setTeamId] = useState('');
  const [tactic, setTactic] = useState<Tactic>('BALANCED');
  const [receipt, setReceipt] = useState<FriendlyReceipt | null>(null);
  const request = useRef<{ intent: string; key: string } | null>(null);
  const team = room.data?.teams.find((candidate) => candidate.id === teamId);
  const start = useMutation({
    retry: false,
    mutationFn: async () => {
      if (!team) throw new Error('저장한 팀을 선택해 주세요.');
      const intent = JSON.stringify({ owner, teamId: team.id, revision: team.revision, tactic });
      if (request.current?.intent !== intent)
        request.current = { intent, key: crypto.randomUUID() };
      const response = await apiFetch(
        `/v1/locker-room/teams/${encodeURIComponent(team.id)}/friendlies`,
        {
          method: 'POST',
          headers: { 'Idempotency-Key': request.current.key },
          body: JSON.stringify({ revision: team.revision, tactic }),
        },
        FriendlyReceiptSchema,
      );
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (saved) => {
      setReceipt(saved);
      request.current = null;
      platform.analytics.track('growth_action', { action: 'FRIENDLY_STARTED' });
      void cache.invalidateQueries({ queryKey: ['friendly-history', owner] });
    },
  });
  const replay = useMutation({
    retry: false,
    mutationFn: async (id: string) => {
      const response = await apiFetch(
        `/v1/locker-room/friendlies/${encodeURIComponent(id)}`,
        { cache: 'no-store' },
        FriendlyReceiptSchema,
      );
      if (!response.ok) throw new Error(response.error.message);
      return response.data;
    },
    onSuccess: (saved) => {
      setReceipt(saved);
      platform.analytics.track('growth_action', { action: 'FRIENDLY_REPLAYED' });
    },
  });
  const change = () => {
    request.current = null;
    start.reset();
  };
  const displayed = receipt ?? history.data?.matches[0];
  return (
    <div className="friendlies">
      <header>
        <p className="os-eyebrow">ONE MORE MATCH</p>
        <h1>은퇴 선수 친선 경기</h1>
        <p>커리어는 끝나도, 우리 팀의 경기는 계속됩니다.</p>
        <Link to="/locker-room">라커룸에서 팀 편성하기</Link>
      </header>
      <p className="friendly-note">
        내 계정만 볼 수 있는 연습팀과의 경기입니다. 친선 기록은 원본 커리어의 성적에 더해지지
        않습니다.
      </p>
      {room.isError && (
        <section role="alert">
          <p>{room.error.message}</p>
          <Button
            onClick={() => {
              void room.refetch();
            }}
          >
            팀 다시 불러오기
          </Button>
        </section>
      )}
      {owner && room.isPending && <p role="status">저장한 팀을 불러오는 중…</p>}
      {room.data && (
        <section aria-label="친선 경기 준비" className="friendly-card">
          <h2>이번 경기 준비</h2>
          <p>
            선발에 은퇴 선수 1명 이상이 필요합니다. 현역 선수는 출전할 수 없고, 비어 있는 선발
            자리는 기본 동료로 채웁니다.
          </p>
          {room.data.teams.length === 0 ? (
            <p>
              아직 저장한 팀이 없습니다. 라커룸에서 은퇴 선수를 선발로 배치하고 팀을 저장해 주세요.
            </p>
          ) : (
            <>
              <label className="friendly-field">
                저장한 팀
                <select
                  value={teamId}
                  disabled={start.isPending}
                  onChange={(event) => {
                    setTeamId(event.target.value);
                    change();
                  }}
                >
                  <option value="">팀을 선택해 주세요</option>
                  {room.data.teams.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} · {item.formation}
                    </option>
                  ))}
                </select>
              </label>
              {team && (
                <p className="friendly-note">
                  {team.formation} · 빈 선발 자리{' '}
                  {team.lineup.slice(0, 11).filter((id) => id === null).length}곳. 포지션 적합도와
                  인접 선수의 패스 조합이 계산에 반영됩니다. 후보는 후반에 최대 3명까지 적합한
                  자리에 교체됩니다.
                </p>
              )}
              <fieldset disabled={start.isPending}>
                <legend>경기 전술</legend>
                {Object.entries(tactics).map(([value, info]) => (
                  <label className="friendly-tactic" key={value}>
                    <input
                      type="radio"
                      name="friendly-tactic"
                      value={value}
                      checked={tactic === value}
                      onChange={() => {
                        setTactic(value as Tactic);
                        change();
                      }}
                    />
                    <span>
                      <strong>{info.label}</strong>
                      <span>{info.description}</span>
                    </span>
                  </label>
                ))}
              </fieldset>
              <p className="friendly-note">
                어떤 전술도 승리를 보장하지 않습니다. 팀을 수정했다면 새로 불러온 뒤 시작해 주세요.
              </p>
              <Button disabled={start.isPending || !team} onClick={() => start.mutate()}>
                {start.isPending
                  ? '경기 결과를 저장하는 중…'
                  : start.isError
                    ? '같은 경기 다시 요청'
                    : '친선 경기 시작'}
              </Button>
              {start.isError && (
                <p role="alert">
                  {start.error.message} 연결 오류라면 같은 경기로 다시 요청할 수 있습니다.
                </p>
              )}
              <Button
                variant="secondary"
                disabled={start.isPending}
                onClick={() => {
                  void room.refetch();
                }}
              >
                팀 새로 불러오기
              </Button>
            </>
          )}
        </section>
      )}
      <section className="friendly-card" aria-label="친선 경기 기록">
        <h2>최근 경기 기록</h2>
        <p className="friendly-note">
          최근 50경기를 표시합니다. 팀을 삭제해도 저장된 경기 기록은 남습니다.
        </p>
        {owner && history.isPending && <p role="status">경기 기록을 불러오는 중…</p>}
        {history.isError && (
          <div role="alert">
            <p>{history.error.message}</p>
            <Button
              onClick={() => {
                void history.refetch();
              }}
            >
              기록 다시 불러오기
            </Button>
          </div>
        )}
        {history.data?.matches.length === 0 && (
          <p>아직 친선 경기 기록이 없습니다. 첫 경기를 시작해 보세요.</p>
        )}
        <ul className="friendly-history">
          {history.data?.matches.map((match) => (
            <li key={match.id}>
              <button disabled={replay.isPending} onClick={() => replay.mutate(match.id)}>
                {match.teamName} {match.result.homeGoals}:{match.result.awayGoals} 연습팀
                <span>{new Date(match.createdAt).toLocaleString('ko-KR')}</span>
              </button>
            </li>
          ))}
        </ul>
        {replay.isPending && <p role="status">저장된 결과를 불러오는 중…</p>}
        {replay.isError && <p role="alert">{replay.error.message} 기록을 다시 선택해 주세요.</p>}
      </section>
      {displayed && <FriendlyResultView receipt={displayed} />}
    </div>
  );
}

export function FriendlyResultView({ receipt }: { receipt: FriendlyReceipt }) {
  const { result } = receipt;
  const names = new Map([...result.home, ...result.away].map((player) => [player.id, player.name]));
  return (
    <section className="friendly-card" aria-label="저장된 경기 결과">
      <p className="os-eyebrow">FULL TIME · 저장된 결과</p>
      <h2>{receipt.teamName} vs 연습팀</h2>
      <p
        className="friendly-score"
        aria-label={`최종 점수 ${result.homeGoals} 대 ${result.awayGoals}`}
      >
        {result.homeGoals} : {result.awayGoals}
      </p>
      <p>
        {receipt.input.formation} · {tactics[receipt.input.tactic].label} ·{' '}
        {new Date(receipt.createdAt).toLocaleString('ko-KR')}
      </p>
      <p className="friendly-note">
        다시 보기는 재경기가 아닙니다. 당시 편성과 저장된 결과를 그대로 표시합니다.
      </p>
      <h3>우리 팀 출전 기록</h3>
      <ul className="friendly-players">
        {result.home.map((player) => (
          <li key={`${player.id}:${player.fromMinute}`}>
            <strong>
              {player.name}
              {player.basic ? ' · 기본 동료' : ''}
            </strong>
            <span>
              {player.position} · {player.fromMinute}–{player.toMinute}분 · 적합도{' '}
              {player.fitPercent}%
            </span>
            <span>
              득점 {player.goals} · 도움 {player.assists} · 선방 {player.saves}
            </span>
          </li>
        ))}
      </ul>
      <h3>경기 타임라인</h3>
      <ol className="friendly-timeline">
        {result.moments.map((moment, index) => (
          <li key={index}>
            <strong>
              {moment.minute}분 · {moment.side === 'HOME' ? '우리 팀' : '연습팀'}
            </strong>
            <span>
              {names.get(moment.shooterId) ?? '선수'} ·{' '}
              {moment.outcome === 'GOAL'
                ? '골'
                : moment.outcome === 'SAVE'
                  ? '상대 선방'
                  : '슈팅 빗나감'}
            </span>
            {moment.outcome === 'GOAL' && (
              <span>도움: {names.get(moment.providerId) ?? '선수'}</span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
