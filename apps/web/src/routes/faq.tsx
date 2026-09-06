import { createFileRoute } from '@tanstack/react-router';
import { FaqContent } from '../shared/public-content.js';

export const Route = createFileRoute('/faq')({ component: FaqContent });
