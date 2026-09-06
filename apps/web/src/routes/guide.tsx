import { createFileRoute } from '@tanstack/react-router';
import { GuideContent } from '../shared/public-content.js';

export const Route = createFileRoute('/guide')({ component: GuideContent });
