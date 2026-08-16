import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const p = new PrismaClient({ adapter });
const q = async () => {
  const pw = await bcrypt.hash('Test1234!', 10);
  const u = await p.users.create({
    data: {
      email: 'test.alexa@vitalguard.local',
      phone: '5550000001',
      password_hash: pw,
      is_active: true,
      two_factor_method: false,
      persons: {
        create: {
          first_name: 'Usuario',
          paternal_last_name: 'Prueba',
          gender: 'M',
        },
      },
    },
    include: { persons: true },
  });
  console.log('CREATED USER:', u.id, u.email, '| person_id:', u.persons.id);
};
q()
  .catch((e) => { console.error('ERR', e.message); process.exit(1); })
  .finally(() => p.$disconnect());
