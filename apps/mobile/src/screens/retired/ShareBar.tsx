// 은퇴 커리어 공유(웹 ShareBar.svelte, T-10-029 → T-10-067). 내 은퇴 선수 화면(은퇴 직후·선수 상세) 아래에 고정된 버튼으로,
// 로그인하지 않아도 보기 전용 공유 링크(/career/<id>)를 공유한다 — 링크는 공개 명예의 전당 상세라 로그인과 무관하다.
// T-10-069 이 기기에 없는 계정의 내 선수도 띄운다 — 띄울지는 LegendView.shareId(legend.ts)가 정한다. 왼쪽 반은 홈으로.
import { useState } from 'react';
import { Platform, Share, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { flushOutbox } from '@offside/app-core/outbox';
import { checkShareLink, SHARE_TEXT, SHARE_TITLE } from '@offside/app-core/shareLink';
import { shareUrl, toast } from '../../game/host';
import { goHome } from '../../game/nav';
import { useColors } from '../../theme/useColors';
import { rem } from '../../theme/type';
import { ActionBar } from '../../ui/ActionBar';
import { Btn } from '../../ui/Btn';

export function ShareBar({ id }: { id: string }) {
  const c = useColors();
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  // 링크를 서버에 확인한 뒤 공유한다.
  const checkLink = () => checkShareLink(id, { flush: flushOutbox, url: shareUrl });

  // 공유 시트를 못 쓰거나 실패했을 때: 클립보드로 복사한다.
  async function copyLink(link: string) {
    try {
      await Clipboard.setStringAsync(link);
      toast('공유 링크를 복사했어요.');
    } catch {
      toast('위 링크를 복사해 공유해 주세요.');
    }
  }

  async function run() {
    if (busy) return;
    setBusy(true);
    try {
      // 한 번 확인한 링크는 다시 서버에 묻지 않는다.
      let link = url;
      if (!link) {
        try {
          link = await checkLink();
        } catch (e) {
          return toast((e as Error).message);
        }
        setUrl(link);
      }
      // 네이티브 공유 시트 우선. 사용자가 닫으면 조용히 끝내고, 못 쓰면 복사로 넘어간다.
      // Android는 message만 실어 보내므로 링크를 글에 함께 넣는다.
      try {
        await Share.share({
          title: SHARE_TITLE,
          message: Platform.OS === 'ios' ? SHARE_TEXT : `${SHARE_TEXT}\n${link}`,
          url: link,
        });
        return;
      } catch {
        /* 공유 시트를 못 열면 복사로 */
      }
      await copyLink(link);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ActionBar>
      {url ? (
        <TextInput
          value={url}
          editable
          showSoftInputOnFocus={false}
          selectTextOnFocus
          accessibilityLabel="공유 링크"
          testID="share-url"
          // 읽기 전용: 값은 바꾸지 못하고 선택·복사만 된다.
          onChangeText={() => {}}
          style={{
            fontSize: rem(0.8125),
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.bg,
            color: c.ink,
          }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn style={{ flex: 1 }} testID="share-home" onPress={goHome}>
          홈으로
        </Btn>
        <Btn
          kind="primary"
          style={{ flex: 1 }}
          testID="share-career"
          disabled={busy}
          onPress={() => void run()}
        >
          {busy ? '링크 만드는 중…' : url ? '링크 다시 복사' : '커리어 공유하기'}
        </Btn>
      </View>
    </ActionBar>
  );
}
