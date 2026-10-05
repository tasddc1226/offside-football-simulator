// T-11-098 친구 · 친선전(웹 team/TeamFriends.svelte) — 내 팀 '경기' 탭의 '친구' 칸. 친구 코드 · 받은/보낸 신청 · 친구 ·
// 최근 친선전. 친선전은 랭크와 따로 센다(레이팅·전적·업적에 들어가지 않고, 하루 한도와 친구별 상대 전적이 따로 있다).
// 친구 데이터는 이 칸을 처음 열 때만 불러온다(useFriends). 문구는 웹과 같이 고친다.
import { useRef, useState, type ReactNode } from 'react';
import { Alert, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { normalizeFriendCode } from '@offside/contracts/owner-team';
import {
  acceptFriend,
  fetchFriends,
  playFriendly,
  removeFriend,
  requestFriend,
  type FriendPerson,
  type FriendsResponse,
} from '@offside/app-core/api/friends';
import type { TeamMatch } from '@offside/app-core/api/team';
import {
  friendCodeLabel,
  friendInviteText,
  friendRequestText,
  h2hText,
} from '@offside/app-core/friendText';
import { LoadState, type LoadStatus } from '../../components/LoadState';
import { TeamLogo } from '../../components/TeamLogo';
import { toast } from '../../game/host';
import { useColors } from '../../theme/useColors';
import { DISPLAY, rem } from '../../theme/type';
import { Btn, Card, Txt } from '../../ui';
import { TextField } from '../settings/parts';
import { MatchRow } from './TeamHistory';
import { Seg, SegBtn } from './TeamParts';

export type OppTab = 'ranked' | 'friends';

/** '경기' 탭 맨 위 두 칸 고르기. */
export function OppSwitch({ value, onPick }: { value: OppTab; onPick: (v: OppTab) => void }) {
  return (
    <Seg label="경기 종류">
      <SegBtn
        center
        selected={value === 'ranked'}
        testID="opp-tab-ranked"
        onPress={() => onPick('ranked')}
      >
        <Txt bold>랭크 경기</Txt>
      </SegBtn>
      <SegBtn
        center
        selected={value === 'friends'}
        testID="opp-tab-friends"
        onPress={() => onPick('friends')}
      >
        <Txt bold>친구</Txt>
      </SegBtn>
    </Seg>
  );
}

/** 친구 데이터 · 쓰기. 칸을 처음 열 때(ensure)만 불러오고, 쓰기 뒤에는 조용히 다시 불러온다. */
export function useFriends() {
  const [data, setData] = useState<FriendsResponse | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [busy, setBusy] = useState(false);
  const dataRef = useRef<FriendsResponse | null>(null);
  const sequence = useRef(0);
  const loadingRef = useRef(false);
  const busyRef = useRef(false);

  function put(d: FriendsResponse | null) {
    dataRef.current = d;
    setData(d);
  }
  async function load(silent = false) {
    const seq = ++sequence.current;
    loadingRef.current = true;
    if (!silent) setStatus('loading');
    const r = await fetchFriends();
    if (seq !== sequence.current) return;
    loadingRef.current = false;
    if (!r.ok) {
      if (!silent) setStatus('error');
      return;
    }
    put(r.data);
    setStatus('ready');
  }
  /** 칸을 열 때. 이미 불러온 데이터가 있으면 다시 부르지 않는다. */
  function ensure() {
    if (!dataRef.current && !loadingRef.current) void load();
  }
  /** 쓰기 하나를 한 번에 하나씩. 성공하면 목록을 다시 불러온다. */
  async function write<T>(
    run: () => Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }>,
    done?: (data: T) => void,
  ): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    const r = await run();
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) {
      toast(r.error.message);
      return false;
    }
    done?.(r.data);
    void load(true);
    return true;
  }
  async function play(f: FriendPerson): Promise<TeamMatch | null> {
    if (busyRef.current) return null;
    busyRef.current = true;
    setBusy(true);
    const r = await playFriendly(f.code);
    busyRef.current = false;
    setBusy(false);
    if (!r.ok) {
      if (r.error.reason === 'FRIENDLY_DAILY_LIMIT')
        put(dataRef.current && { ...dataRef.current, matchesLeft: 0 });
      else void load(true);
      toast(r.error.message);
      return null;
    }
    const { match, h2h, matchesLeft } = r.data;
    const d = dataRef.current;
    if (d)
      put({
        ...d,
        matchesLeft,
        friends: d.friends.map((x) => (x.code === f.code ? { ...x, h2h } : x)),
        recent: [match, ...d.recent.filter((m) => m.id !== match.id)].slice(0, 10),
      });
    return match;
  }

  return {
    data,
    status,
    busy,
    reload: () => void load(),
    ensure,
    play,
    request: (body: Parameters<typeof requestFriend>[0]) =>
      write(
        () => requestFriend(body),
        (res) => toast(friendRequestText(res)),
      ),
    accept: (f: FriendPerson) =>
      write(
        () => acceptFriend(f.code),
        (res) => toast(friendRequestText(res)),
      ),
    remove: (f: FriendPerson) => write(() => removeFriend(f.code)),
  };
}
export type Friends = ReturnType<typeof useFriends>;

function Row({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <View
      style={{
        gap: 8,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: c.line,
      }}
    >
      {children}
    </View>
  );
}

function Who({ f, h2h = false }: { f: FriendPerson; h2h?: boolean }) {
  const record = h2h ? h2hText(f.h2h) : null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <TeamLogo logo={f.team?.logo} name={f.team?.name ?? f.name} size={32} decorative />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt bold numberOfLines={1}>
          {f.name}
        </Txt>
        <Txt tone="muted" v="sm">
          {f.team ? `${f.team.name} · OVR ${f.team.ovr}` : '이번 시즌 팀이 없어요'}
        </Txt>
        {record ? <Txt tone="muted" v="sm">{`상대 전적 ${record}`}</Txt> : null}
      </View>
    </View>
  );
}

const buttons = { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 } as const;

export function TeamFriends({
  friends,
  onPlayed,
  onOpen,
}: {
  friends: Friends;
  /** 친선전을 치르면(중계 화면으로). */
  onPlayed: (match: TeamMatch) => void;
  /** 최근 친선전을 누르면(결과 화면으로). */
  onOpen: (match: TeamMatch) => void;
}) {
  const c = useColors();
  const { data, status, busy } = friends;
  const [input, setInput] = useState('');

  async function copyCode(code: string) {
    try {
      await Clipboard.setStringAsync(friendCodeLabel(code));
      toast('코드를 복사했어요');
    } catch {
      toast('코드를 복사하지 못했어요');
    }
  }
  async function shareInvite(code: string) {
    try {
      await Share.share({ message: friendInviteText(code) });
    } catch {
      toast('공유하지 못했어요');
    }
  }
  async function submitCode() {
    const code = normalizeFriendCode(input);
    if (!code) return toast('친구 코드 8자리를 확인해 주세요.');
    if (await friends.request({ code })) setInput('');
  }
  async function challenge(f: FriendPerson) {
    const m = await friends.play(f);
    if (m) onPlayed(m);
  }
  function askRemove(f: FriendPerson) {
    Alert.alert('친구 끊기', `${f.name} 님과 친구를 끊을까요? 상대 전적도 사라져요.`, [
      { text: '취소', style: 'cancel' },
      { text: '끊기', style: 'destructive', onPress: () => void friends.remove(f) },
    ]);
  }

  return (
    <LoadState status={status} failText="친구를 불러오지 못했어요." retry={friends.reload}>
      {data ? (
        <>
          <Card gap={4}>
            <Txt v="eyebrow">Friends</Txt>
            <Txt v="h1" accessibilityRole="header">
              친구
            </Txt>
            <Txt tone="muted" v="sm" testID="friendly-left">
              {`친선전은 레이팅과 전적에 들어가지 않아요. 오늘 남은 친선전 ${data.matchesLeft}/${data.matchesPerDay}`}
            </Txt>
            {data.canPlay ? null : (
              <Txt tone="muted" v="sm" testID="friendly-cant-play">
                이번 시즌 팀을 만들면 친구와 친선전을 할 수 있어요.
              </Txt>
            )}
          </Card>

          <Card gap={10}>
            <Txt v="h2" accessibilityRole="header">
              내 친구 코드
            </Txt>
            <Txt
              selectable
              testID="friend-code"
              style={{
                fontFamily: DISPLAY[700],
                fontSize: rem(1.75),
                letterSpacing: 2,
                color: c.ink,
              }}
            >
              {friendCodeLabel(data.code)}
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Btn
                sm
                kind="primary"
                testID="friend-share"
                onPress={() => void shareInvite(data.code)}
              >
                초대 링크 공유
              </Btn>
              <Btn sm testID="friend-copy" onPress={() => void copyCode(data.code)}>
                코드 복사
              </Btn>
            </View>
          </Card>

          <Card gap={10}>
            <Txt v="h2" accessibilityRole="header">
              친구 코드로 신청
            </Txt>
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextField
                style={{ flex: 1 }}
                value={input}
                onChangeText={setInput}
                placeholder="ABCD-EFGH"
                autoCapitalize="characters"
                maxLength={12}
                testID="friend-code-input"
                accessibilityLabel="친구 코드"
                onSubmitEditing={() => void submitCode()}
              />
              <Btn
                kind="primary"
                testID="friend-request"
                disabled={busy}
                onPress={() => void submitCode()}
              >
                신청
              </Btn>
            </View>
          </Card>

          {data.received.length ? (
            <Card gap={0}>
              <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
                {`받은 신청 ${data.received.length}`}
              </Txt>
              {data.received.map((f) => (
                <Row key={f.code}>
                  <View testID={`friend-received-${f.code}`}>
                    <Who f={f} />
                  </View>
                  <View style={buttons}>
                    <Btn
                      sm
                      kind="primary"
                      disabled={busy}
                      testID="friend-accept"
                      accessibilityLabel={`${f.name} 신청 수락`}
                      onPress={() => void friends.accept(f)}
                    >
                      수락
                    </Btn>
                    <Btn
                      sm
                      disabled={busy}
                      testID="friend-decline"
                      accessibilityLabel={`${f.name} 신청 거절`}
                      onPress={() => void friends.remove(f)}
                    >
                      거절
                    </Btn>
                  </View>
                </Row>
              ))}
            </Card>
          ) : null}

          <Card gap={0}>
            <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
              {`친구 ${data.friends.length}/${data.max}`}
            </Txt>
            {data.friends.length ? (
              data.friends.map((f) => (
                <Row key={f.code}>
                  <View testID={`friend-${f.code}`}>
                    <Who f={f} h2h />
                  </View>
                  <View style={buttons}>
                    <Btn
                      sm
                      kind="primary"
                      testID="friend-play"
                      accessibilityLabel={`${f.name} 님과 친선전`}
                      disabled={
                        busy ||
                        data.matchesLeft === 0 ||
                        !data.canPlay ||
                        !f.team ||
                        f.team.filled === 0
                      }
                      onPress={() => void challenge(f)}
                    >
                      친선전
                    </Btn>
                    <Btn
                      sm
                      kind="ghost"
                      disabled={busy}
                      testID="friend-remove"
                      accessibilityLabel={`${f.name} 님과 친구 끊기`}
                      onPress={() => askRemove(f)}
                    >
                      끊기
                    </Btn>
                  </View>
                </Row>
              ))
            ) : (
              <Txt tone="muted">아직 친구가 없어요. 신청을 수락하면 여기에 보여요.</Txt>
            )}
          </Card>

          {data.sent.length ? (
            <Card gap={0}>
              <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
                보낸 신청
              </Txt>
              {data.sent.map((f) => (
                <Row key={f.code}>
                  <Who f={f} />
                  <View style={buttons}>
                    <Btn
                      sm
                      disabled={busy}
                      testID="friend-cancel"
                      accessibilityLabel={`${f.name} 신청 취소`}
                      onPress={() => void friends.remove(f)}
                    >
                      취소
                    </Btn>
                  </View>
                </Row>
              ))}
            </Card>
          ) : null}

          {data.recent.length ? (
            <Card gap={0}>
              <Txt v="h2" accessibilityRole="header" style={{ marginBottom: 6 }}>
                최근 친선전
              </Txt>
              {data.recent.map((m) => (
                <MatchRow key={m.id} m={m} open={onOpen} />
              ))}
            </Card>
          ) : null}
        </>
      ) : null}
    </LoadState>
  );
}
