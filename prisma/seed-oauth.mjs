/**
 * Seed — Registro del cliente OAuth (skill de Alexa) en Vital ID.
 *
 * Account Linking de Alexa: Vital ID actúa como Authorization Server.
 * Este script registra el cliente OAuth que representa la skill de Alexa,
 * con los redirects que Amazon provee (layla/pitangui).
 *
 * ⚠️ IMPORTANTE:
 *  - Reemplaza CLIENT_ID / CLIENT_SECRET con los valores reales que Amazon
 *    asigne a la skill (se muestran al configurar Account Linking en la
 *    Alexa Developer Console).
 *  - Los redirects varían según mercado; copiarlos tal cual desde la consola.
 *
 * Ejecutar (desde la raíz de vital-id):
 *   node prisma/seed-oauth.mjs
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const CLIENT_ID = process.env.OAUTH_ALEXA_CLIENT_ID || 'amzn1.application-oa2-client.TU_CLIENT_ID';
const CLIENT_SECRET = process.env.OAUTH_ALEXA_CLIENT_SECRET || 'TU_CLIENT_SECRET';
const CLIENT_NAME = 'Skill Alexa - VitalGuard';

const REDIRECT_URIS = [
  'https://layla.amazon.com/api/skill/link/MVGB189LOOLIC',
  'https://pitangui.amazon.com/api/skill/link/MVGB189LOOLIC',
  'https://alexa.amazon.co.jp/api/skill/link/MVGB189LOOLIC',
];

const GRANT_TYPES = ['authorization_code', 'refresh_token'];
const ALLOWED_SCOPES = ['vitalguard:patient'];
const AUTH_METHOD = 'client_secret_basic';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const secretHash = await bcrypt.hash(CLIENT_SECRET, 10);

  const client = await prisma.oauth_clients.upsert({
    where: { client_id: CLIENT_ID },
    update: {
      client_secret_hash: secretHash,
      client_name: CLIENT_NAME,
      grant_types: GRANT_TYPES,
      redirect_uris: REDIRECT_URIS,
      allowed_scopes: ALLOWED_SCOPES,
      auth_method: AUTH_METHOD,
      is_active: true,
      deleted_at: null,
      updated_at: new Date(),
    },
    create: {
      client_id: CLIENT_ID,
      client_secret_hash: secretHash,
      client_name: CLIENT_NAME,
      grant_types: GRANT_TYPES,
      redirect_uris: REDIRECT_URIS,
      allowed_scopes: ALLOWED_SCOPES,
      auth_method: AUTH_METHOD,
      is_active: true,
    },
  });

  console.log('✅ Cliente OAuth registrado/actualizado:');
  console.log(`   client_id : ${client.client_id}`);
  console.log(`   client_name: ${client.client_name}`);
  console.log(`   auth_method: ${client.auth_method}`);
  console.log(`   scopes    : ${ALLOWED_SCOPES.join(', ')}`);
  console.log('');
  console.log('⚠️  Recuerda reemplazar CLIENT_ID/CLIENT_SECRET con los reales de Amazon.');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed-oauth:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
