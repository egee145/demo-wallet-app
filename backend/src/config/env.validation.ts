import Joi from 'joi';

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .required(),
  DIRECT_URL: Joi.string()
    .uri({ scheme: ['postgres', 'postgresql'] })
    .optional(),
  DB_POOL_MAX: Joi.number().integer().min(1).max(50).default(10),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).max(365).default(30),
  CORS_ORIGINS: Joi.string().allow('').default(''),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .default('info'),
  SESSION_TTL_SECONDS: Joi.number().integer().min(30).max(900).default(120),
  PAYMENT_MAX_AMOUNT: Joi.number().positive().default(999999.99),
  WALLET_MAX_BALANCE: Joi.number().positive().default(999999999999.99),
}).unknown(true);

export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> {
  const result = schema.validate(config, {
    abortEarly: false,
    convert: true,
  });

  if (result.error) {
    throw new Error(`Environment validation failed: ${result.error.message}`);
  }

  return result.value as Record<string, unknown>;
}
