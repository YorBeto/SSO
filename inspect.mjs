import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });
const q = async () => {
  const users = await p.users.findMany({ include: { persons: true } });
  console.log('USERS:', users.length);
  users.forEach((u) =>
    console.log(' -', u.id, u.email, u.is_active, u.persons?.first_name, '| 2fa:', u.two_factor_method),
  );
  const clients = await p.oauth_clients.findMany();
  console.log('OAUTH CLIENTS:', clients.length);
  clients.forEach((c) => console.log(' -', c.client_id, c.auth_method));
};
q().finally(() => p.$disconnect());
