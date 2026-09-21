import { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LockerRoomSchema,
  PlayerNoteResponseSchema,
  LockerTeamSchema,
  TEAM_FORMATIONS,
  TeamInputSchema,
  type LockerPlayer,
  type LockerRoom,
  type LockerTeam,
  type TeamFormation,
  type TeamInput,
} from '@offside/contracts';
import { Button, Dialog, DialogContent } from '@offside/ui';
import { apiFetch, getProfile } from '../api/client.js';
import { POSITION_LABELS } from '../shared/labels.js';
import '../shared/locker-room.css';

export const Route = createFileRoute('/locker-room')({ component: LockerRoomScreen });
const emptyLineup = () => Array<string | null>(18).fill(null);
const statusLabel = (p: LockerPlayer) =>
  p.status === 'ACTIVE' ? '현역' : p.status === 'RETIRED' ? '은퇴' : '보관';
const pitchRows: Record<TeamFormation, number[][]> = {
  '4-3-3': [[8, 9, 10], [5, 6, 7], [1, 2, 3, 4], [0]],
  '4-4-2': [[9, 10], [5, 6, 7, 8], [1, 2, 3, 4], [0]],
  '3-5-2': [[9, 10], [4, 5, 6, 7, 8], [1, 2, 3], [0]],
};
export function LockerRoomScreen() {
  const profile = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const r = await getProfile();
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    staleTime: 30_000,
  });
  const key = ['locker-room', profile.data?.id] as const;
  const room = useQuery({
    queryKey: key,
    enabled: !!profile.data,
    // Background refetch must not remount an editor with unsaved changes.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      const r = await apiFetch('/v1/locker-room', {}, LockerRoomSchema);
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
  });
  const [selected, setSelected] = useState<string | null | undefined>();
  const selectedTeam =
    selected === undefined ? room.data?.teams[0] : room.data?.teams.find((t) => t.id === selected);
  const [tab, setTab] = useState<'PLAYERS' | 'TEAM'>('PLAYERS');
  const cache = useQueryClient();
  const saved = (team: LockerTeam) => {
    cache.setQueryData<LockerRoom>(key, (old) =>
      old ? { ...old, teams: [...old.teams.filter((t) => t.id !== team.id), team] } : old,
    );
    setSelected(team.id);
  };
  return (
    <main className="locker-room">
      <header className="locker-heading">
        <div>
          <p className="os-eyebrow">MY FOOTBALL CLUB</p>
          <h1>내 라커룸</h1>
          <p>내가 키운 선수들로, 나만의 팀을.</p>
        </div>
        <Link to="/">홈으로</Link>
      </header>
      <nav className="locker-tabs" aria-label="라커룸 구역">
        <button onClick={() => setTab('PLAYERS')} aria-pressed={tab === 'PLAYERS'}>
          선수 보관함
        </button>
        <button onClick={() => setTab('TEAM')} aria-pressed={tab === 'TEAM'}>
          팀 꾸리기
        </button>
      </nav>
      {(profile.isPending || (profile.data && room.isPending)) && (
        <p role="status">내 선수들을 불러오는 중…</p>
      )}
      {(profile.isError || room.isError) && (
        <section role="alert">
          <p>{profile.error?.message ?? room.error?.message}</p>
          <Button
            onClick={() => {
              void profile.refetch();
              void room.refetch();
            }}
          >
            다시 불러오기
          </Button>
        </section>
      )}
      {room.data && (
        <>
          <p className="locker-note">
            계정에 저장된 선수 {room.data.players.length}명 · 현역은 최근 저장 능력치, 은퇴 선수는
            은퇴 시점 능력치를 사용합니다.
          </p>
          <div hidden={tab !== 'PLAYERS'}>
            <PlayerCollection
              players={room.data.players}
              onBuild={() => setTab('TEAM')}
              onNoteChange={(careerId, note) => {
                cache.setQueryData<LockerRoom>(key, (old) =>
                  old
                    ? {
                        ...old,
                        players: old.players.map((player) =>
                          player.careerId === careerId ? { ...player, note } : player,
                        ),
                      }
                    : old,
                );
              }}
            />
          </div>
          <div hidden={tab !== 'TEAM'}>
            <TeamEditor
              key={`${room.data.profileId}:${selectedTeam?.id ?? 'new'}:${selectedTeam?.revision ?? 0}`}
              players={room.data.players}
              teams={room.data.teams}
              team={selectedTeam}
              onSelect={setSelected}
              onSaved={saved}
              onDeleted={() => {
                setSelected(null);
                void room.refetch();
              }}
            />
          </div>
          <p className="locker-note">
            <Link to="/friendlies">은퇴 선수로 친선 경기 시작하기 · 경기 기록 보기</Link>
          </p>
          <p className="locker-note">
            다른 기기에서도 이어가려면{' '}
            <Link to="/settings">설정에서 계정을 연결하거나 복구 코드</Link>를 보관하세요. 아직
            동기화되지 않은 선수는 저장이 완료된 뒤 나타납니다.
          </p>
        </>
      )}
    </main>
  );
}
export function PlayerCollection({
  players,
  onBuild,
  onNoteChange,
}: {
  players: LockerPlayer[];
  onBuild: () => void;
  onNoteChange: (careerId: string, note: string | null) => void;
}) {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('RECENT');
  const visible = players.filter(
    (p) =>
      (filter === 'ALL' || p.status === filter) &&
      p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  if (order === 'OVR') visible.sort((a, b) => b.ovr - a.ovr);
  else visible.reverse();
  return (
    <section aria-label="내 선수 보관함">
      <div className="locker-filters">
        <label>
          선수 찾기
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="선수 이름"
          />
        </label>
        <label>
          상태
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="ALL">전체 선수</option>
            <option value="ACTIVE">현역</option>
            <option value="RETIRED">은퇴</option>
            <option value="ARCHIVED">보관</option>
          </select>
        </label>
        <label>
          정렬
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="RECENT">최근 만든 선수</option>
            <option value="OVR">능력치 높은 순</option>
          </select>
        </label>
      </div>
      {visible.length === 0 ? (
        <div className="locker-empty">
          <h2>{players.length ? '조건에 맞는 선수가 없습니다' : '첫 번째 유니폼을 걸어 보세요'}</h2>
          <p>선수 생성을 마치고 커리어를 저장하면 이곳에 모입니다.</p>
          <Link to="/onboarding">새 선수 키우기 →</Link>
        </div>
      ) : (
        <div className="locker-collection">
          {visible.map((p) => (
            <article className="locker-player" key={p.careerId}>
              <div className="locker-player-top">
                <span>{p.position}</span>
                <strong>
                  {p.ovr}
                  <small> OVR</small>
                </strong>
              </div>
              <h2>{p.name}</h2>
              <p>
                {statusLabel(p)} · {p.age}세 · {p.seasons}시즌
              </p>
              <dl className="locker-player-evidence">
                <div>
                  <dt>전성기 OVR</dt>
                  <dd>{p.peakOvr === null ? '확인 불가' : p.peakOvr}</dd>
                </div>
                <div>
                  <dt>정점 시즌 시작 나이</dt>
                  <dd>{p.peakAge === null ? '확인 불가' : `${p.peakAge}세`}</dd>
                </div>
                <div>
                  <dt>최고 시즌</dt>
                  <dd>{p.bestSeasonIndex === null ? '확인 불가' : `${p.bestSeasonIndex}시즌`}</dd>
                </div>
              </dl>
              <small>최고 시즌은 평점이 기록된 10경기 이상 시즌만 표시합니다.</small>
              {p.isTest && <small>테스트 시즌 선수</small>}
              <PlayerNoteEditor player={p} onNoteChange={onNoteChange} />
              <div className="locker-card-actions">
                <Link to="/career/$careerId" params={{ careerId: p.careerId }}>
                  커리어 보기
                </Link>
                <button onClick={onBuild}>팀 편성</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function PlayerNoteEditor({
  player,
  onNoteChange,
}: {
  player: LockerPlayer;
  onNoteChange: (careerId: string, note: string | null) => void;
}) {
  const [value, setValue] = useState(player.note ?? '');
  const [savedNote, setSavedNote] = useState(player.note ?? '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const maxLength = 140;

  async function save() {
    const note = value.trim();
    if (note.length < 1 || note.length > maxLength) {
      setFeedback(`추억 한 줄은 1~${maxLength}자로 입력해 주세요.`);
      return;
    }
    setBusy(true);
    setFeedback(null);
    const result = await apiFetch(
      `/v1/locker-room/players/${encodeURIComponent(player.careerId)}/note`,
      { method: 'PUT', body: JSON.stringify({ note }) },
      PlayerNoteResponseSchema,
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.error.message);
      return;
    }
    setValue(result.data.note);
    setSavedNote(result.data.note);
    onNoteChange(player.careerId, result.data.note);
    setFeedback('이 기념 메모를 계정에 저장했습니다.');
  }

  async function remove() {
    setBusy(true);
    setFeedback(null);
    const result = await apiFetch(
      `/v1/locker-room/players/${encodeURIComponent(player.careerId)}/note`,
      { method: 'DELETE' },
    );
    setBusy(false);
    if (!result.ok) {
      setFeedback(result.error.message);
      return;
    }
    setValue('');
    setSavedNote('');
    onNoteChange(player.careerId, null);
    setFeedback('기념 메모를 삭제했습니다.');
  }

  return (
    <div className="locker-player-note">
      <label>
        추억 한 줄 <span>(나만 보기)</span>
        <textarea
          value={value}
          maxLength={maxLength}
          rows={2}
          placeholder="이 선수와의 순간을 짧게 남겨 보세요."
          onChange={(event) => setValue(event.target.value)}
          disabled={busy}
        />
      </label>
      <div className="locker-card-actions">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || value.trim() === savedNote}
        >
          {busy ? '저장 중…' : '메모 저장'}
        </button>
        {savedNote ? (
          <button type="button" onClick={() => void remove()} disabled={busy}>
            삭제
          </button>
        ) : null}
      </div>
      <small
        role={
          feedback
            ? feedback.includes('저장') || feedback.includes('삭제')
              ? 'status'
              : 'alert'
            : undefined
        }
      >
        {feedback ?? `${value.length}/${maxLength}`}
      </small>
    </div>
  );
}
export function TeamEditor({
  players,
  teams,
  team,
  onSelect,
  onSaved,
  onDeleted,
}: {
  players: LockerPlayer[];
  teams: LockerTeam[];
  team: LockerTeam | undefined;
  onSelect: (id: string | null) => void;
  onSaved: (t: LockerTeam) => void;
  onDeleted: () => void;
}) {
  const initial: TeamInput = team
    ? { name: team.name, formation: team.formation, lineup: team.lineup }
    : { name: '나의 첫 팀', formation: '4-3-3', lineup: emptyLineup() };
  const [draft, setDraft] = useState(initial);
  const [slot, setSlot] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState(
    team ? '계정에 저장된 편성입니다.' : '빈자리로 남겨도 팀을 저장할 수 있습니다.',
  );
  const dirty = JSON.stringify(initial) !== JSON.stringify(draft);
  const roster = new Map(players.map((p) => [p.careerId, p]));
  const starters = draft.lineup
    .slice(0, 11)
    .map((id) => (id ? roster.get(id) : undefined))
    .filter((p): p is LockerPlayer => !!p);
  const save = useMutation({
    mutationFn: async () => {
      const parsed = TeamInputSchema.safeParse(draft);
      if (!parsed.success)
        throw new Error('팀 이름을 1~30자로 입력하고 중복 선수를 확인해 주세요.');
      const r = await apiFetch(
        team ? `/v1/locker-room/teams/${team.id}` : '/v1/locker-room/teams',
        {
          method: team ? 'PUT' : 'POST',
          body: JSON.stringify(team ? { ...parsed.data, revision: team.revision } : parsed.data),
        },
        LockerTeamSchema,
      );
      if (!r.ok) throw new Error(r.error.message);
      return r.data;
    },
    onSuccess: onSaved,
  });
  const remove = useMutation({
    mutationFn: async () => {
      if (!team) return;
      const r = await apiFetch(`/v1/locker-room/teams/${team.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(r.error.message);
    },
    onSuccess: onDeleted,
  });
  const pending = save.isPending || remove.isPending;
  function assign(id: string | null) {
    if (slot === null) return;
    setDraft((d) => ({
      ...d,
      lineup: d.lineup.map((old, i) => (i === slot ? id : id !== null && old === id ? null : old)),
    }));
    setSlot(null);
    setSearch('');
    setNotice('아직 저장하지 않은 변경이 있습니다.');
  }
  function slotButton(i: number) {
    const p = roster.get(draft.lineup[i] ?? '');
    const label = i < 11 ? TEAM_FORMATIONS[draft.formation][i]! : `후보 ${i - 10}`;
    return (
      <button
        className="locker-slot"
        key={i}
        onClick={() => {
          setSlot(i);
          setSearch('');
        }}
        aria-label={`${label} · ${p?.name ?? '빈자리'} 선수 선택`}
        disabled={pending}
      >
        <small>{label}</small>
        <strong>{p?.name ?? '+'}</strong>
        <span>{p ? `${p.position} · ${p.ovr}` : '선수 선택'}</span>
      </button>
    );
  }
  const candidates = players
    .filter((p) =>
      slot === 0 ? p.position === 'GK' : slot !== null && slot < 11 ? p.position !== 'GK' : true,
    )
    .filter((p) => p.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    .sort((a, b) => b.ovr - a.ovr);
  return (
    <section aria-label="내 팀 편성" className="locker-editor">
      <label>
        저장된 팀
        <select
          value={team?.id ?? ''}
          disabled={dirty || pending}
          onChange={(e) => onSelect(e.target.value || null)}
        >
          <option value="">새 팀 만들기</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <div className="locker-filters">
        <label>
          팀 이름
          <input
            maxLength={30}
            value={draft.name}
            disabled={pending}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </label>
        <label>
          포메이션
          <select
            value={draft.formation}
            disabled={pending}
            onChange={(e) =>
              setDraft((d) => ({ ...d, formation: e.target.value as TeamFormation }))
            }
          >
            {Object.keys(TEAM_FORMATIONS).map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="locker-team-summary">
        <strong>선발 {starters.length}/11</strong>
        <span>
          편성 선수 평균{' '}
          {starters.length
            ? Math.round(starters.reduce((sum, p) => sum + p.ovr, 0) / starters.length)
            : '—'}{' '}
          OVR
        </span>
      </div>
      <div className="locker-pitch" aria-label={`${draft.formation} 선발 배치`}>
        {pitchRows[draft.formation].map((row, i) => (
          <div className="locker-pitch-row" key={i}>
            {row.map(slotButton)}
          </div>
        ))}
      </div>
      <h2>
        벤치 <small>{draft.lineup.slice(11).filter(Boolean).length}/7</small>
      </h2>
      <div className="locker-bench">{Array.from({ length: 7 }, (_, i) => slotButton(i + 11))}</div>
      <p className="locker-note">
        자리를 눌러 선수를 배치하세요. 이미 편성한 선수를 고르면 새 자리로 이동합니다. 필드 선수는
        다른 포지션에도 배치할 수 있습니다.
      </p>
      <div className="locker-save">
        <Button disabled={pending || (!!team && !dirty)} onClick={() => save.mutate()}>
          {save.isPending ? '저장 중…' : '팀 저장'}
        </Button>
        {dirty && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setDraft(initial);
              save.reset();
              setNotice('저장 전 편성으로 되돌렸습니다.');
            }}
          >
            변경 되돌리기
          </Button>
        )}
      </div>
      <p role="status">
        {dirty ? '변경 내용을 저장해 주세요. 팀을 바꾸려면 저장하거나 되돌리세요.' : notice}
      </p>
      {(save.error || remove.error) && (
        <p role="alert">{save.error?.message ?? remove.error?.message}</p>
      )}
      <p className="locker-note">
        저장한 팀의 은퇴 선수로 연습팀과 친선 경기를 할 수 있습니다. 실시간 팀 간 대전은 제공하지
        않습니다. 편성과 친선 기록은 선수의 개인 커리어에 영향을 주지 않습니다.
      </p>
      {team && (
        <Button variant="ghost" disabled={pending} onClick={() => setDeleteOpen(true)}>
          이 팀 삭제
        </Button>
      )}
      <Dialog
        open={slot !== null}
        onOpenChange={(open) => {
          if (!open) setSlot(null);
        }}
      >
        <DialogContent
          title="함께 뛸 선수 선택"
          description="내 라커룸에 저장된 선수만 편성할 수 있습니다."
          closeLabel="선수 선택 닫기"
        >
          <label className="locker-search">
            선수 찾기
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름으로 찾기"
            />
          </label>
          <Button variant="secondary" onClick={() => assign(null)}>
            이 자리 비우기
          </Button>
          <div className="locker-candidates">
            {candidates.map((p) => (
              <button key={p.careerId} onClick={() => assign(p.careerId)}>
                <span>
                  <strong>{p.name}</strong>
                  <small>
                    {POSITION_LABELS[p.position]} · {statusLabel(p)}
                    {draft.lineup.includes(p.careerId) ? ' · 편성 중' : ''}
                  </small>
                </span>
                <b>{p.ovr}</b>
              </button>
            ))}
            {candidates.length === 0 && (
              <p>
                선택할 수 있는 선수가 없습니다.{' '}
                {slot === 0
                  ? '골키퍼로 선수 생활을 시작해 보세요.'
                  : '다른 이름을 검색하거나 새 선수를 키워 보세요.'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent
          title="팀 편성을 삭제할까요?"
          description="선수와 개인 커리어 기록은 그대로 남습니다."
          closeLabel="취소"
        >
          <Button disabled={pending} onClick={() => remove.mutate()}>
            팀 삭제 확정
          </Button>
        </DialogContent>
      </Dialog>
    </section>
  );
}
