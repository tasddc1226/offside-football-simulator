// UX-001: 설정 "구단 이름" 섹션에서만 쓰는 팀별 플레이버 텍스트. 축구 팬 커뮤니티식 자조·애정이
// 섞인 한 줄로, activeRuleset의 leagueTier·reputation·tacticalStyleId를 힌트 삼아 팀마다 다르게
// 썼다. 게임 로직에는 관여하지 않는 순수 표시 텍스트라 팀 id가 늘거나 룰셋이 바뀌어도 안전하게
// 빠지도록 항상 `TEAM_FLAVOR_TEXT[id] ?? ''`로 읽는다.
//
// 1.0.0~1.4.0(가상 구단 12개, hangang-u18 등)과 1.5.0(K리그식 27개, seoul-hangang-fc 등)이 공존한다 —
// 과거 커리어가 옛 id를 계속 쓰므로 옛 항목은 지우지 않는다.
export const TEAM_FLAVOR_TEXT: Readonly<Record<string, string>> = {
  // 1.0.0~1.4.0
  'hangang-u18': '유망주는 여기서 다 만든다. 정작 우리 팀 성적은 유망하지 않다.',
  'seorabeol-united': '우승 후보 소리 들은 지 오래. 이번엔 진짜 트로피 들고 싶다.',
  'cheongyeon-fc': '닥치고 역습. 점유율은 내주고 결과는 가져온다.',
  'gangdong-rovers': '전방 압박 하나는 리그 최고. 뛰다가 승격권 확보가 목표다.',
  'onsaemiro-city': '패스는 예쁜데 골이 안 들어간다. 그래도 우리는 계속 돌린다.',
  'byeolbit-united': '역습 한 방 믿고 버틴다. 후반 추가시간이 제일 무섭다.',
  'galmae-town': '3부에서 제일 많이 뛰는 팀. 순위는 안 따라와도 체력은 최고다.',
  'noeulhang-fc': '리그 끝자락 단골 손님. 그래도 우리 팬은 끝까지 남는다.',
  'geumbit-fc': '압박으로 1부까지 왔다. 이제 숨 고르기가 필요한 시점이다.',
  'eunha-rovers': '앞에서 조이다 뒷공간 내준다. 그래도 응원가는 우리가 제일 신난다.',
  'gangnaru-united': '3부인데 점유율 축구 고집한다. 승격권은 놓쳐도 낭만은 챙긴다.',
  'dalbit-town-fc': '최하위권 단골이지만 역습 골 하나로 다음 시즌을 버틴다.',
  // 1.5.0 R리그(B팀)
  'seoul-hangang-fc-b': 'U18 주니어 출신들이 모이는 곳. 1군 승격 명단에 이름 한 줄 올리는 게 목표다.',
  // 1.5.0 K1
  'seoul-hangang-fc': '수도 연고 명문 소리는 듣는다. 우승 트로피는 계속 남 얘기다.',
  'suwon-hwahong-fc': '성곽 도시답게 수비 하나는 단단하다. 골 넣을 때가 문제다.',
  'incheon-gaetbeol-fc': '갯벌처럼 끈적하게 버틴다. 시즌 막판까지 잔류 싸움이 일상이다.',
  'jeonju-deulnyeok-united': '들녘 넓은 만큼 점유율도 넓게 돌린다. 마무리가 아쉬울 뿐이다.',
  'ulsan-pado-fc': '파도처럼 몰아붙이는 압박 축구. 우승 후보 단골 명단이다.',
  'pohang-donghae-fc': '동해 바닷바람 맞으며 역습 한 방을 노린다. 골결정력만 조금 더 있었으면.',
  'daegu-palgong-fc': '산악 지형처럼 오르내림이 심하다. 그래도 압박은 꾸준하다.',
  'jeju-halla-city': '섬 특유의 여유로 점유율 축구를 고집한다. 원정 이동 거리는 리그 최고다.',
  'gangneung-haesol-fc': '해안 도시 특유의 빠른 역습이 무기다. 후반 체력이 늘 아쉽다.',
  'gwangju-mudeung-fc': '산 이름처럼 묵묵히 버틴다. 화려하진 않아도 꾸준하다.',
  'daejeon-gapcheon-fc': '하천 물살처럼 거세게 압박한다. 뒷공간 관리가 늘 과제다.',
  'busan-deungdae-fc': '항구 도시 뚝심으로 역습 한 번을 노린다. 중위권이 편안한 자리다.',
  // 1.5.0 K2
  'anyang-pyeongchon-fc': '압박 축구로 승격권을 노린다. 체력 소모가 큰 게 흠이다.',
  'bucheon-wonmi-fc': '역습 한 방을 믿는다. 그래도 우리 서포터즈는 끝까지 남는다.',
  'seongnam-tancheon-fc': '하천 옆 훈련장에서 점유율 축구를 갈고닦는다. 골이 안 들어가는 게 문제다.',
  'gimpo-pyeongya-fc': '평야처럼 넓게 뛴다. 승강 플레이오프가 늘 남 얘기는 아니다.',
  'cheonan-heungtaryeong-fc': '흥 넘치는 응원가만큼 압박도 흥겹다. 결과가 따라오면 더 좋겠다.',
  'asan-oncheon-fc': '온천 도시처럼 느긋한 점유율 축구. 승강 경쟁에선 늘 뜨겁다.',
  'cheongju-jikji-fc': '기록의 도시답게 꾸준한 압박 축구를 새겨 넣는다.',
  'changwon-jinhae-fc': '벚꽃 피는 봄마다 역습 한 방을 노린다. 잔류가 우선 목표다.',
  'gwangyang-maehwa-fc': '매화처럼 이른 봄에 반짝인다. 시즌 막판엔 늘 힘이 빠진다.',
  'gimcheon-hwangak-fc': '산악 도시 뚝심으로 압박한다. 승격권 문턱에서 아쉬움이 많다.',
  'ansan-gaetgol-fc': '갯골처럼 끈질기게 버틴다. 역습 한 번이면 충분하다.',
  'yongin-hanteo-fc': '점유율 축구를 고집한다. 승강 경쟁은 매 시즌 살얼음판이다.',
  'hwaseong-gukhwa-fc': '가을 국화 축제처럼 시즌 막판에 힘을 낸다. 초반이 늘 아쉽다.',
  'seoul-namsan-fc': '수도 두 번째 구단이라는 자부심 하나로 버틴다. 존재감은 이제부터다.',
  // 3.4.0 candidate K3 identities (presentation metadata only; no published badge assets).
  'yeoncheon-hantangang-fc': '한탄강 물길처럼 꾸준히 전진한다. 수비에서 시작해 경기를 만든다.',
  'boeun-songni-fc': '속리산 숲처럼 단단히 버틴다. 한 번의 역습을 오래 준비한다.',
  'namhae-bomulseom-fc': '보물섬의 바람을 타고 넓게 뛴다. 홈에서 더 과감해진다.',
  'yeongwol-donggang-fc': '동강 물살처럼 빠르게 전환한다. 끝까지 집중하는 팀이다.',
  'goyang-haedam-fc': '해를 품은 항구처럼 천천히 단단해진다. 홈 팬의 목소리가 우리의 전술이다.',
  'gumi-geumoh-fc': '금오산처럼 버티는 압박 축구. 한 골 차 승부에 강하다.',
  'mokpo-yudalsan-fc': '유달산 오르듯 끈질기게 전진한다. 원정에서도 리듬을 놓치지 않는다.',
  'sokcho-seorak-fc': '설악의 바람처럼 빠르게 전환한다. 후반 집중력이 우리의 약속이다.',
  'jecheon-cheongpung-fc': '청풍처럼 차분히 공을 돌린다. 결정적인 순간을 기다린다.',
  'gimhae-gaya-fc': '가야의 기세로 전방을 압박한다. 한 발 먼저 움직이는 팀이다.',
  'suncheon-dongcheon-fc': '동천 물결처럼 유연하게 이어간다. 팀워크가 가장 큰 무기다.',
  'paju-yulgok-fc': '율곡의 절제처럼 안정적인 수비를 쌓는다. 승부는 끝까지 모른다.',
  'yeosu-odongdo-fc': '오동도 바람처럼 넓게 움직인다. 홈 경기의 여유를 믿는다.',
  'wonju-chiak-fc': '치악산처럼 묵직하게 버틴다. 세트피스 한 번을 노린다.',
  'andong-hahoe-fc': '하회마을처럼 서로의 움직임을 읽는다. 조직력이 자랑이다.',
  'jeonju-hannuri-fc': '한누리의 꿈을 품고 넓게 뛴다. 승격권은 다음 목표다.',
};
