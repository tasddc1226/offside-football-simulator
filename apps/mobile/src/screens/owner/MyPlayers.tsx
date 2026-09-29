// 구단주 화면의 '내 선수'(웹 MyPlayers.svelte) — 레전드 점수 순.
// T-10-013: 계정에 연결돼 있으면 계정 기록(서버), 아니면 이 기기 기록(ft_hof)이다. 서버에는 선수 이름이
// 없어(공개를 고른 경우만) 같은 기기의 기록이 있으면 그 이름·공개 설정을 쓴다.
// 한 줄의 틀(순위 칸·위 구분선·안쪽 여백)은 HofRow의 RowFrame이 그린다 — 여기서는 누르는 자리만 감싼다.
import { useEffect, useMemo, useState } from 'react';
import type { PublicHofEntry } from '@offside/contracts';
import type { DetailPos, POS } from '@offside/game/data';
import { loadHOF } from '@offside/game/season';
import type { HofEntry } from '@offside/game/types';
import { getMyCareers, getRetiredNumbers } from '@offside/app-core/api/client';
import { pendingRetirementIds } from '@offside/app-core/outbox';
import { anonName } from '@offside/app-core/format';
import { fillGranted, openLocalLegend, openPublicLegend } from '../../game/host';
import { HofRow, type RowStats } from '../../components/HofRow';
import { rem } from '../../theme/type';
import { Btn, Card, Press, Txt } from '../../ui';

type MineRow = {
  key: string;
  name: string;
  pos: keyof typeof POS;
  dpos?: DetailPos | null | undefined;
  club: string;
  clubId?: string | null | undefined;
  rn?: number | null | undefined;
  tag: string | null;
  stats: RowStats;
  title: string | null;
  open: () => void;
};
/** 처음엔 이만큼만 보이고 '모두 보기'로 펼친다. */
const SHOW = 10;

const localRow = (h: HofEntry, i: number): MineRow => ({
  key: h.id ?? h.name + i,
  name: h.name,
  pos: h.pos,
  dpos: h.dpos,
  club: h.lastClub,
  clubId: h.lastClubId,
  rn: h.rn?.kind === 'granted' ? h.rn.number : null,
  tag: h.public ? '공개' : null,
  stats: h,
  title: h.title ?? null,
  open: () => openLocalLegend(h),
});
const serverRow = (e: PublicHofEntry): MineRow => ({
  key: e.id,
  name: e.name ?? anonName(e.pos, e.number),
  pos: e.pos,
  dpos: e.dpos,
  club: e.lastClub,
  clubId: e.lastClubId,
  rn: e.retiredNumber?.number,
  tag: e.name ? '공개' : null,
  stats: { ...e, score: e.legendScore },
  title: e.title ?? null,
  open: () => void openPublicLegend(e),
});

export function MyPlayers() {
  const local = useMemo(() => loadHOF(), []);
  const [source, setSource] = useState<'loading' | 'account' | 'device' | 'offline'>('loading');
  const [rows, setRows] = useState<MineRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, SHOW);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getMyCareers();
      if (!alive) return;
      let list: MineRow[];
      let src: 'account' | 'device' | 'offline';
      if (!r.ok || !r.data.linked) {
        src = !r.ok && r.error.code === 'NETWORK_ERROR' ? 'offline' : 'device';
        list = local.map(localRow);
      } else {
        const onServer = new Set(r.data.entries.map((e) => e.id));
        const byId = new Map(
          local.flatMap((h, i) => (h.id ? [[h.id, localRow(h, i)] as const] : [])),
        );
        // 방금 은퇴해 아직 업로드 대기 중인 선수도 잠깐 더한다.
        const pending = pendingRetirementIds();
        list = [
          ...r.data.entries.map((e) => {
            const row = byId.get(e.id);
            // 이 기기 기록이 있어도 결번(T-10-076)은 서버 값을 쓴다 — 소급으로 받은 결번은 기기에 없다.
            return row ? { ...row, rn: row.rn ?? e.retiredNumber?.number } : serverRow(e);
          }),
          ...[...byId].filter(([id]) => !onServer.has(id) && pending.has(id)).map(([, row]) => row),
        ];
        src = 'account';
      }
      list.sort((a, b) => b.stats.score - a.stats.score);
      setRows(list);
      setSource(src);
      // T-10-076 배포 전 은퇴를 소급해 받은 결번은 이 기기에 없다 — 결과를 모르는 기록이 있을 때만 서버 목록에서 채운다
      // (계정 목록은 서버가 결번을 함께 준다).
      if (src === 'device' && local.some((h) => h.id && h.detail && h.rn === undefined)) {
        const rn = await getRetiredNumbers();
        if (!alive || !rn.ok) return;
        fillGranted(rn.data.items);
        const byCareer = new Map(rn.data.items.map((x) => [x.careerId, x.number]));
        setRows((prev) => prev.map((row) => ({ ...row, rn: row.rn ?? byCareer.get(row.key) })));
      }
    })();
    return () => {
      alive = false;
    };
  }, [local]);

  return (
    <Card gap={0}>
      <Txt v="eyebrow">My players</Txt>
      <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 8 }}>
        내 선수
      </Txt>
      {source === 'loading' ? (
        <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
          불러오는 중…
        </Txt>
      ) : (
        <>
          <Txt
            tone="muted"
            testID={`my-source-${source}`}
            style={{ fontSize: rem(0.75), marginBottom: 6 }}
          >
            {source === 'account'
              ? '계정에 기록된 선수예요. 다른 기기에서도 똑같이 보여요.'
              : source === 'offline'
                ? '서버에 연결하지 못해 이 기기에 저장된 선수를 보여 줘요.'
                : '이 기기에 저장된 선수예요. 구글 계정을 연결하면 계정에 모아 볼 수 있어요.'}
          </Txt>
          {shown.length ? (
            shown.map((r, i) => (
              <Press
                key={r.key}
                scale={0.985}
                testID={`my-player-${i}`}
                accessibilityLabel={`${r.name} 선수 기록 열기`}
                onPress={r.open}
              >
                <HofRow
                  rank={i}
                  name={r.name}
                  pos={r.pos}
                  dpos={r.dpos}
                  club={r.club}
                  clubId={r.clubId}
                  rn={r.rn}
                  tag={r.tag}
                  t={r.stats}
                  titleId={r.title}
                />
              </Press>
            ))
          ) : (
            <Txt tone="muted" style={{ fontSize: rem(0.875), paddingVertical: 8 }}>
              아직 은퇴한 선수가 없어요. 첫 커리어를 끝까지 뛰어 보세요.
            </Txt>
          )}
          {!expanded && rows.length > SHOW ? (
            <Btn
              sm
              testID="my-players-all"
              style={{ alignSelf: 'flex-start', marginTop: 8 }}
              onPress={() => setExpanded(true)}
            >
              {`모두 보기 (${rows.length}명)`}
            </Btn>
          ) : null}
        </>
      )}
    </Card>
  );
}
