// SCR-031 핵심 경기 챕터 자리표시. T-2-008이 채운다(RESOLVE_CHAPTER 흐름).
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/chapter')({
  component: ChapterPlaceholderScreen,
});

function ChapterPlaceholderScreen() {
  const { careerId } = Route.useParams();
  return <PlaceholderScreen careerId={careerId} />;
}
