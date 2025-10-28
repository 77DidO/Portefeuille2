import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('4000'),
  DATABASE_URL: z.string().default('file:./dev.db'),
  CORS_ORIGIN: z.string().default('http://localhost:3000'),
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).pipe(z.number().int().positive()).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).pipe(z.number().int().positive()).default('100'),
  API_REQUEST_TIMEOUT: z.string().transform(Number).pipe(z.number().int().positive()).default('30000'),
  MAX_UPLOAD_SIZE: z.string().default('5mb'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  LOG_PRETTY: z.string().transform((val) => val === 'true').default('true'),
  REDIS_ENABLED: z.string().transform((val) => val === 'true').default('true'),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('6379'),
  PRICE_CACHE_TTL: z.string().transform(Number).pipe(z.number().int().positive()).default('3600'),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

export const loadEnv = (): Env => {
  if (env) {
    return env;
  }

  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
  }

  env = parsed.data;
  return env;
};

export const getEnv = (): Env => {
  if (!env) {
    throw new Error('Environment variables not loaded. Call loadEnv() first.');
  }
  return env;
};
