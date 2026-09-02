import { CORS_ALLOWED_HEADERS, CORS_EXPOSED_HEADERS } from '@offside/contracts';
import { cors as honoCors } from 'hono/cors';
import { parseAllowedOrigins, type Bindings } from '../env.js';

export const cors = honoCors({
  origin: (origin, c) => {
    const allowed = parseAllowedOrigins(c.env as Bindings);
    return allowed.includes(origin) ? origin : undefined;
  },
  allowHeaders: [...CORS_ALLOWED_HEADERS],
  exposeHeaders: [...CORS_EXPOSED_HEADERS],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
  maxAge: 600,
});
