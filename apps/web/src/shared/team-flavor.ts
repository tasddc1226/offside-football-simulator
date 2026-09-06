// UX-001: 설정 "구단 이름" 섹션에서만 쓰는 팀별 플레이버 텍스트. 축구 팬 커뮤니티식 자조·애정이
// 섞인 한 줄로, activeRuleset(1.0.0)의 leagueTier·reputation·tacticalStyleId를 힌트 삼아 12개 팀을
// 전부 다르게 썼다. 게임 로직에는 관여하지 않는 순수 표시 텍스트라 팀 id가 늘거나 룰셋이 바뀌어도
// 안전하게 빠지도록 항상 `TEAM_FLAVOR_TEXT[id] ?? ''`로 읽는다.
export const TEAM_FLAVOR_TEXT: Readonly<Record<string, string>> = {
  'hangang-u18': '유망주는 여기서 다 만든다. 정작 우리 팀 성적은 유망하지 않다.',
  'seorabeol-united': '우승 후보 소리 들은 지 오래. 이번엔 진짜 트로피 들고 싶다.',
  'cheongyeon-fc': '닥치고 역습. 점유율은 내주고 결과는 가져온다.',
  'gangdong-rovers': '전방 압박 하나는 리그 최고. 뛰다가 승격하는 게 목표다.',
  'onsaemiro-city': '패스는 예쁜데 골이 안 들어간다. 그래도 우리는 계속 돌린다.',
  'byeolbit-united': '역습 한 방 믿고 버틴다. 후반 추가시간이 제일 무섭다.',
  'galmae-town': '3부에서 제일 많이 뛰는 팀. 순위는 안 따라와도 체력은 최고다.',
  'noeulhang-fc': '리그 끝자락 단골 손님. 그래도 우리 팬은 끝까지 남는다.',
  'geumbit-fc': '압박으로 1부까지 왔다. 이제 숨 고르기가 필요한 시점이다.',
  'eunha-rovers': '앞에서 조이다 뒷공간 내준다. 그래도 응원가는 우리가 제일 신난다.',
  'gangnaru-united': '3부인데 점유율 축구 고집한다. 승격은 못해도 낭만은 챙긴다.',
  'dalbit-town-fc': '최하위권 단골이지만 역습 골 하나로 다음 시즌을 버틴다.',
};
