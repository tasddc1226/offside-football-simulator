import { createFileRoute } from '@tanstack/react-router';
import { RetirementPage } from '../shared/retirement-screen.js';
export const Route = createFileRoute('/career/$careerId/final-profile')({ component: FinalProfileRoute });
function FinalProfileRoute() { return <RetirementPage careerId={Route.useParams().careerId} mode="final-profile" />; }
