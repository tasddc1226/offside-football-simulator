// T-10-016 운영 대시보드(웹 admin/AdminDashboard.svelte): 가입·활동·커리어·댓글 수와 최근 14일(KST) 추이. 집계는 서버에서 1분 캐시된다.
// 막대 그림은 웹처럼 막대(View)로 그린다 — 차트 라이브러리 없이 막대 높이만 비율로.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import * as api from '@offside/app-core/api/admin';
import type { AdminStats } from '@offside/app-core/api/admin';
import { kstDateTime as kst } from '@offside/app-core/boardText';
import type { LoadStatus } from '../../../components/LoadState';
import { rem } from '../../../theme/type';
import { useColors } from '../../../theme/useColors';
import { Btn } from '../../../ui/Btn';
import { Txt } from '../../../ui/Txt';
import { Seg } from '../../board/parts';

const AUDIT: Record<string, string> = {
  PROFILE_DELETED: '프로필 삭제',
  RECOVERY_CODE_ISSUED: '복구 코드 발급',
  GOOGLE_LINKED: '구글 연결',
  GOOGLE_UNLINKED: '구글 연결 해제',
  CAREERS_MERGED: '커리어 합치기',
  BALANCE_ACTIVATED: '밸런스 적용',
  COMMENTS_PURGED: '작성자 댓글 일괄 삭제',
};
const SERIES = [
  { key: 'profiles', label: '신규 가입' },
  { key: 'careers', label: '새 커리어' },
  { key: 'retired', label: '은퇴' },
] as const;

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const maxOf = (s: AdminStats, key: (typeof SERIES)[number]['key']) =>
  Math.max(1, ...s.daily.map((d) => d[key]));

function Stat({
  id,
  label,
  value,
  sub,
}: {
  id: string;
  label: string;
  value: string;
  sub: string;
}) {
  const c = useColors();
  return (
    <View
      testID={`stat-${id}`}
      accessible
      accessibilityLabel={`${label} ${value}, ${sub}`}
      style={{
        flex: 1,
        gap: 2,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: c.line,
        borderRadius: 12,
        minWidth: 0,
      }}
    >
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        {label}
      </Txt>
      <Txt
        bold
        style={{
          fontSize: rem(1.375),
          lineHeight: rem(1.375) * 1.3,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Txt>
      <Txt tone="muted" style={{ fontSize: rem(0.75) }}>
        {sub}
      </Txt>
    </View>
  );
}

export default function AdminDashboard() {
  const c = useColors();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  const load = useCallback(
    async (fresh = false) => {
      const r = await api.fetchAdminStats(fresh);
      if (!r.ok) {
        setStatus(stats ? 'ready' : 'error');
        return;
      }
      setStats(r.data);
      setStatus('ready');
    },
    [stats],
  );
  useEffect(() => void load(), []);

  const muted = { fontSize: rem(0.75) } as const;
  const s = stats;
  return (
    <View testID="admin-dashboard" style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Txt v="h2" accessibilityRole="header">
          대시보드
        </Txt>
        <Btn sm testID="refresh-stats" onPress={() => void load(true)}>
          새로고침
        </Btn>
      </View>
      {status === 'loading' ? (
        <Txt tone="muted" accessibilityLiveRegion="polite">
          불러오는 중…
        </Txt>
      ) : status === 'error' || !s ? (
        <View style={{ gap: 8 }}>
          <Txt tone="muted">대시보드를 불러오지 못했어요.</Txt>
          <Btn sm style={{ alignSelf: 'flex-start' }} onPress={() => void load(true)}>
            다시 시도
          </Btn>
        </View>
      ) : (
        <>
          <Txt tone="muted" style={muted}>{`${kst(s.generatedAt)} 기준(KST) · 1분마다 갱신`}</Txt>
          <Seg cols={2}>
            <Stat
              id="users"
              label="전체 유저"
              value={s.profiles.total.toLocaleString()}
              sub={`구글 연결 ${s.profiles.linked.toLocaleString()} (${pct(s.profiles.linked, s.profiles.total)})`}
            />
            <Stat
              id="active"
              label="활동 유저 (24시간)"
              value={s.profiles.active24h.toLocaleString()}
              sub={`7일 ${s.profiles.active7d.toLocaleString()}`}
            />
            <Stat
              id="signups"
              label="신규 가입 (24시간)"
              value={s.profiles.new24h.toLocaleString()}
              sub={`7일 ${s.profiles.new7d.toLocaleString()}`}
            />
            <Stat
              id="careers"
              label="업로드된 커리어"
              value={s.careers.total.toLocaleString()}
              sub={`진행 ${s.careers.active.toLocaleString()} · 은퇴 ${s.careers.retired.toLocaleString()}`}
            />
            <Stat
              id="careers7d"
              label="최근 7일 커리어"
              value={s.careers.new7d.toLocaleString()}
              sub={`은퇴 ${s.careers.retired7d.toLocaleString()}`}
            />
            <Stat
              id="board"
              label="댓글"
              value={s.board.comments.toLocaleString()}
              sub={`7일 ${s.board.comments7d.toLocaleString()} · 글 ${s.board.posts}`}
            />
          </Seg>
          <Txt tone="muted" testID="stat-balance" style={muted}>
            {`밸런스 ${s.balance ? `v${s.balance.version} 적용 중${s.balance.activatedAt ? ` (${kst(s.balance.activatedAt)})` : ''}` : '기본값'}`}
          </Txt>
          <Txt tone="muted" style={muted}>
            활동 유저는 앱을 열어 서버에 프로필을 확인한 수예요. 게임은 기기에서 돌아가 실제 플레이
            수와 다를 수 있어요.
          </Txt>

          {SERIES.map((ser) => {
            const max = maxOf(s, ser.key);
            return (
              <View key={ser.key} testID={`series-${ser.key}`} style={{ gap: 6 }}>
                <Txt style={{ fontSize: rem(0.8125), fontWeight: '600' }}>
                  {`${ser.label} · 최근 14일 `}
                  <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                    {`(합계 ${s.daily.reduce((a, d) => a + d[ser.key], 0).toLocaleString()})`}
                  </Txt>
                </Txt>
                <View style={{ flexDirection: 'row', gap: 3, height: 90, alignItems: 'flex-end' }}>
                  {s.daily.map((d) => (
                    <View
                      key={d.day}
                      accessible
                      accessibilityLabel={`${d.day} ${d[ser.key]}`}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <View
                        style={{
                          width: '100%',
                          height: `${Math.round((d[ser.key] / max) * 100)}%`,
                          minHeight: 2,
                          backgroundColor: c.pitch,
                          borderTopLeftRadius: 3,
                          borderTopRightRadius: 3,
                        }}
                      />
                      <Txt
                        tone="muted"
                        style={{
                          fontSize: rem(0.625),
                          lineHeight: rem(0.625) * 1.5,
                          fontVariant: ['tabular-nums'],
                        }}
                      >
                        {d.day.slice(8)}
                      </Txt>
                    </View>
                  ))}
                </View>
              </View>
            );
          })}

          <View style={{ gap: 6 }}>
            <Txt v="h3" accessibilityRole="header">
              최근 운영 기록
            </Txt>
            <View>
              {s.audit.length ? (
                s.audit.map((a, i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: 8,
                      paddingVertical: 6,
                      borderBottomWidth: 1,
                      borderBottomColor: c.line,
                    }}
                  >
                    <Txt style={{ fontSize: rem(0.8125), flexShrink: 1 }}>
                      {AUDIT[a.kind] ?? a.kind}
                    </Txt>
                    <Txt tone="muted" style={{ fontSize: rem(0.8125) }}>
                      {kst(a.createdAt)}
                    </Txt>
                  </View>
                ))
              ) : (
                <Txt tone="muted">기록이 없어요.</Txt>
              )}
            </View>
          </View>
        </>
      )}
    </View>
  );
}
