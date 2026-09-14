import { createFileRoute } from '@tanstack/react-router';
import { RetirementPage, type RetirementRetrospectiveStep } from '../shared/retirement-screen.js';

type RetirementSearch = { retrospective?: RetirementRetrospectiveStep };

export const Route = createFileRoute('/career/$careerId/retirement')({
  validateSearch: (search: Record<string, unknown>): RetirementSearch => {
    const retrospective = search.retrospective;
    return typeof retrospective === 'string' &&
      (/^moment-[1-9]\d*$/.test(retrospective) ||
        retrospective === 'legacy' ||
        retrospective === 'final')
      ? { retrospective: retrospective as RetirementRetrospectiveStep }
      : {};
  },
  component: RetirementRoute,
});

function RetirementRoute() {
  const retrospective = Route.useSearch().retrospective;
  return (
    <RetirementPage
      careerId={Route.useParams().careerId}
      {...(retrospective === undefined ? {} : { retrospective })}
    />
  );
}
