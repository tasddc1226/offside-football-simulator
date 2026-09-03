// SCR-015 프로 시즌 결과 자리표시. T-2-009가 채운다(SeasonResult CompareCards).
import { createFileRoute } from '@tanstack/react-router';
import { PlaceholderScreen } from '../shared/PlaceholderScreen.js';

export const Route = createFileRoute('/career/$careerId/season-result')({
  component: SeasonResultPlaceholderScreen,
});

function SeasonResultPlaceholderScreen() {
  const { careerId } = Route.useParams();
  return <PlaceholderScreen careerId={careerId} />;
}
