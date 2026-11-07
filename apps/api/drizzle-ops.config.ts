import { defineConfig } from 'drizzle-kit';

// T-11-662 운영 기록 DB(OPS_DB). 게임 DB(drizzle.config.ts)와 마이그레이션 폴더가 따로다.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/opsSchema.ts',
  out: './migrations-ops',
});
