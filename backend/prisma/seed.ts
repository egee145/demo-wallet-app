import 'dotenv/config';
import { argon2id, hash } from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '../src/generated/prisma/client.js';

const databaseUrl = process.env.DATABASE_URL ?? process.env.DIRECT_URL;
const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD;

if (process.env.NODE_ENV === 'production') {
  throw new Error('Development seed is disabled in production');
}

if (!databaseUrl) {
  throw new Error('DATABASE_URL or DIRECT_URL is required for seed');
}

if (!adminEmail || !adminPassword) {
  throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required for seed');
}

const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

try {
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: 'HepAntalya Admin',
      email: adminEmail,
      passwordHash: await hash(adminPassword, { type: argon2id }),
      role: Role.ADMIN,
    },
  });
} finally {
  await prisma.$disconnect();
}
