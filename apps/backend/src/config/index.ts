import dotenv from 'dotenv';
import path from 'path';
import { parseExpiresIn } from '../utils/duration';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Validate the JWT duration values at module load. If
// JWT_EXPIRES_IN / REFRESH_TOKEN_EXPIRES_IN is malformed (e.g. a
// typo like "15x" or a forgotten unit like "60") we'd rather crash
// the boot than silently default to long-lived tokens in
// production. `parseExpiresIn` throws on bad input, so this is the
// one line that does the actual validation: the rest is just
// building the config object.
function validateDuration(value: string, envName: string): void {
  try {
    parseExpiresIn(value);
  } catch (err: any) {
    throw new Error(
      `[config] Invalid ${envName}=${JSON.stringify(value)}: ${err.message}`,
    );
  }
}

const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '15m';
const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';
validateDuration(jwtExpiresIn, 'JWT_EXPIRES_IN');
validateDuration(refreshExpiresIn, 'REFRESH_TOKEN_EXPIRES_IN');

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:4200',

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    expiresIn: jwtExpiresIn,
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'dev-refresh-secret',
    refreshExpiresIn: refreshExpiresIn,
  },

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.GEMMA_MODEL || 'gemma2:2b',
  },

  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/direct_democracy',
  },

  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    enabled: process.env.REDIS_ENABLED !== 'false',
  },

  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || 'noreply@city.gov',
  },

  appUrl: process.env.APP_URL || 'http://localhost:4200',
};
