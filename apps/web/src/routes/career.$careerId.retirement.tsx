import { createFileRoute } from '@tanstack/react-router';
import { RetirementPage } from '../shared/retirement-screen.js';
export const Route = createFileRoute('/career/$careerId/retirement')({ component: RetirementRoute });
function RetirementRoute() { return <RetirementPage careerId={Route.useParams().careerId} />; }
