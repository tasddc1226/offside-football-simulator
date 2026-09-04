import type { CareerState, ChapterTrigger, Position } from '@offside/domain';
import type { ChapterDefinition } from '../schema/chapter.ts';
import type { ContentPack } from '../packs/load-content-pack.ts';

export type ChapterCandidate = {
  chapterId: string;
  version: number;
  importance: 'MAJOR' | 'MINOR';
  trigger: ChapterTrigger;
  weight: number;
  decisionsTotal: number;
};

/**
 * domain의 `statGroupOf`와 같은 매핑이다. content는 domain 런타임 함수를 import할 수
 * 없으므로(ADR-005, 타입만 import) 이 pure 매핑을 복제한다. Position에 새 값이 추가되면
 * 이 switch가 컴파일 오류를 낸다.
 */
function resolveStatGroup(position: Position): 'GK' | 'DF' | 'MF' | 'FW' {
  switch (position) {
    case 'GK':
      return 'GK';
    case 'CB':
    case 'FB':
      return 'DF';
    case 'DM':
    case 'CM':
    case 'AM':
      return 'MF';
    case 'W':
    case 'ST':
      return 'FW';
  }
}

function passesPositionGroupFilter(chapter: ChapterDefinition, state: CareerState): boolean {
  if (chapter.positionGroups === undefined) return true;
  const profile = state.player.profile;
  if (profile === null) return false;
  return chapter.positionGroups.includes(resolveStatGroup(profile.primaryPosition));
}

function isAlreadyResolvedThisSeason(chapter: ChapterDefinition, state: CareerState): boolean {
  const seasonIndex = state.season?.index ?? null;
  if (seasonIndex === null) return false;
  return state.resolvedChapterIds.includes(`${chapter.id}@${seasonIndex}`);
}

function passesInjuryReturnFilter(chapter: ChapterDefinition, state: CareerState): boolean {
  if (chapter.trigger.kind !== 'INJURY_RETURN') return true;
  // Content는 ADVANCE 직전의 불완전한 state만 본다. 한 번의 walk가 REHAB 결장 해소와 첫 복귀
  // 경기까지 진행할 수 있고, 그 경기 직후 forced pending이 열리면 payload state에는 아직
  // RECOVERED/window 또는 transient marker가 없다. 후보를 여기서 제거하면 domain의 실제
  // `injuryReturnMatchId` 판정에 도달할 기회 자체를 잃으므로, readiness는 domain에 위임한다.
  void state;
  return true;
}

function compareChapterId(a: ChapterCandidate, b: ChapterCandidate): number {
  if (a.chapterId < b.chapterId) return -1;
  if (a.chapterId > b.chapterId) return 1;
  return 0;
}

/**
 * `state`에서 이번 ADVANCE가 후보로 보낼 수 있는 핵심 경기 챕터 목록을 chapterId 오름차순으로
 * 돌려준다(포지션군 필터 `positionGroups`, `resolvedChapterIds` 제외). 실제로 어느 챕터가
 * 열릴지·어느 경기에 걸릴지는 domain의 `selectChapter`가 이 목록과 이번 step 경기 기록으로
 * 다시 판정한다(roll 없음, 이 함수도 roll 없음).
 */
export function selectChapterCandidates(pack: ContentPack, state: CareerState): ChapterCandidate[] {
  if (state.status !== 'ACTIVE' || state.pending !== null) return [];

  return pack.chapters
    .filter((chapter) => passesPositionGroupFilter(chapter, state))
    .filter((chapter) => passesInjuryReturnFilter(chapter, state))
    .filter((chapter) => !isAlreadyResolvedThisSeason(chapter, state))
    .map((chapter) => ({
      chapterId: chapter.id,
      version: chapter.version,
      importance: chapter.importance,
      trigger: chapter.trigger,
      weight: chapter.weight,
      decisionsTotal: chapter.decisions.length,
    }))
    .sort(compareChapterId);
}
