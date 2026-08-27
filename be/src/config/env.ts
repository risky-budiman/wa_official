// ===========================================
// Environment Configuration & Validation
// ===========================================

export const env = {
  // Server
  PORT: Number(process.env.PORT) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // MySQL
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT) || 3306,
  DB_USER: process.env.DB_USER || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'wa_crm',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT) || 6379,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change-this-to-a-random-secret-key-min-32-chars',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Meta WhatsApp Cloud API
  META_APP_ID: process.env.META_APP_ID || '',
  META_APP_SECRET: process.env.META_APP_SECRET || '',
  META_ACCESS_TOKEN: process.env.META_ACCESS_TOKEN || '',
  META_PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID || '',
  META_WABA_ID: process.env.META_WABA_ID || '',
  META_WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN || 'my-custom-verify-token',
  META_API_VERSION: process.env.META_API_VERSION || 'v20.0',

  // S3 / MinIO
  S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9000',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'minioadmin',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'minioadmin',
  S3_BUCKET: process.env.S3_BUCKET || 'wa-crm-media',
  S3_REGION: process.env.S3_REGION || 'us-east-1',
} as const;

/**
 * Validate required environment variables at startup
 */
export function validateEnv(): void {
  const required: (keyof typeof env)[] = ['JWT_SECRET', 'DB_NAME'];
  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    console.warn(`⚠️  Missing environment variables: ${missing.join(', ')}`);
  }

  if (env.JWT_SECRET === 'change-this-to-a-random-secret-key-min-32-chars') {
    console.warn('⚠️  WARNING: Using default JWT_SECRET. Please set a secure secret in production!');
  }

  console.log(`✅ Environment loaded (${env.NODE_ENV})`);
}
