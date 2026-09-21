import type { CareerArticle } from '@offside/contracts';
import { POSITION_LABELS } from './labels.js';
import './career-publication.css';

const STAT_LABELS = {
  GOALS: '골',
  ASSISTS: '도움',
  SAVES: '선방',
  CLEAN_SHEETS: '클린시트',
  KEY_PASSES: '키패스',
  TACKLES: '태클',
};
/** Authored sentence templates grounded exclusively in the public server projection. */
export function CareerArticleView({ article }: { article: CareerArticle }) {
  const best = [...article.highlights]
    .filter((stat) => stat.total > 0)
    .sort((a, b) => b.total - a.total)[0];
  return (
    <article className="os-panel os-career-article" aria-label="커리어 기사">
      <p>OFFSIDE · 커리어 기록실</p>
      <h1>
        {article.playerName}, {article.seasons}시즌의 선수 생활을 마치다
      </h1>
      <p>
        {POSITION_LABELS[article.initialPosition]}에서 시작한 {article.playerName}의 커리어가
        끝났습니다.{' '}
        {article.clubCount}개 팀을 거치며 총 {article.playedMatches}경기에 출전해{' '}
        {article.minutes.toLocaleString()}분을 뛰었습니다.
      </p>
      {best && (
        <h2>
          기록에 남은 {best.total.toLocaleString()}{best.kind === 'GOALS' ? '골' : `회의 ${STAT_LABELS[best.kind]}`}
        </h2>
      )}
      <p>
        {article.highlights
          .map((stat) => `${STAT_LABELS[stat.kind]} ${stat.total.toLocaleString()}`)
          .join(' · ')}
      </p>
      {article.averageRatingTenths !== null && (
        <p>평가된 경기 평균 평점 {(article.averageRatingTenths / 10).toFixed(1)}</p>
      )}
      <p>
        은퇴 시 저장된 클럽 경기 기록입니다. 서버 재경기 검증이나 공식 순위 인증을 뜻하지 않습니다.
      </p>
    </article>
  );
}
