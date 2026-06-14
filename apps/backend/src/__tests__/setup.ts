// Set test environment variables BEFORE any imports
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jwt';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/direct_democracy';
process.env.NODE_ENV = 'test';
process.env.REDIS_ENABLED = 'false';

// Override the listen() call so the app doesn't start a server during tests
import express from 'express';
const originalListen = express.application.listen;
express.application.listen = function (this: any, ...args: any[]) {
  return this;
} as any;
