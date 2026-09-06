import { createFileRoute } from '@tanstack/react-router';
import { RetirementPage } from '../shared/retirement-screen.js';
export const Route = createFileRoute('/career/$careerId/timeline')({ component: TimelineRoute });
function TimelineRoute() { return <RetirementPage careerId={Route.useParams().careerId} mode="timeline" />; }
