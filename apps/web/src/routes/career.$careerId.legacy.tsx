import { createFileRoute } from '@tanstack/react-router';
import { RetirementPage } from '../shared/retirement-screen.js';
export const Route = createFileRoute('/career/$careerId/legacy')({ component: LegacyRoute });
function LegacyRoute() { return <RetirementPage careerId={Route.useParams().careerId} mode="legacy" />; }
