import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service.js';

/**
 * OAuth 2.0 — Authorization Server para Account Linking (Alexa).
 *
 * Vital ID actúa como Authorization Server: emite `code` (authorize), lo
 * intercambia por access/refresh tokens (token) y expone la identidad del
 * usuario (userinfo) para que VitalGuard resuelva quién habla.
 *
 * El `sub` de los tokens OAuth es el `user.id` (UUID), que equivale al
 * `vital_id` que VitalGuard espera en su tabla `app_profiles`.
 */
@Injectable()
export class OAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // ── Acceso a configuración de entorno ──────────────────────────────
  private get accessSecret(): string {
    return process.env.JWT_SECRET || '';
  }

  private get refreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET || '';
  }

  private get accessExpiresIn(): string {
    return process.env.OAUTH_ACCESS_TOKEN_EXPIRES || '24h';
  }

  private get refreshExpiresIn(): string {
    return process.env.OAUTH_REFRESH_TOKEN_EXPIRES || '30d';
  }

  private get codeExpiresMs(): number {
    return this.durationToMs(
      process.env.OAUTH_AUTHORIZATION_CODE_EXPIRES || '10m',
      10 * 60 * 1000,
    );
  }

  private durationToMs(value: string, fallback: number): number {
    const match = /^(\d+)([smhd])$/.exec(String(value).trim());
    if (!match) return fallback;
    const n = parseInt(match[1], 10);
    switch (match[2]) {
      case 's':
        return n * 1000;
      case 'm':
        return n * 60 * 1000;
      case 'h':
        return n * 60 * 60 * 1000;
      case 'd':
        return n * 24 * 60 * 60 * 1000;
      default:
        return fallback;
    }
  }

  private secondsFromDuration(value: string, fallback: number): number {
    return Math.round(this.durationToMs(value, fallback * 1000) / 1000);
  }

  // ── Helpers OAuth (RFC 6749 errors) ────────────────────────────────
  private oauthError(message: string, code: string): never {
    throw new UnauthorizedException({ oauth_error: code, message });
  }

  // ── 1. GET /oauth/authorize ────────────────────────────────────────
  /**
   * Inicia la vinculación (Account Linking).
   * Valida el cliente y, si el usuario ya tiene sesión SSO, emite un `code`
   * de un solo uso y redirige a Amazon (redirect_uri) con `?code=..&state=..`.
   */
  async authorize(query: any, res: Response) {
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    } = query;

    // 1. Validar parámetros básicos
    if (response_type !== 'code') {
      throw new BadRequestException({
        oauth_error: 'unsupported_response_type',
        message: 'Solo se soporta response_type=code',
      });
    }
    if (!client_id || !redirect_uri) {
      throw new BadRequestException({
        oauth_error: 'invalid_request',
        message: 'Faltan client_id o redirect_uri',
      });
    }

    // PKCE: solo se acepta S256 (rechazar plain/otros por seguridad)
    if (code_challenge && code_challenge_method !== 'S256') {
      throw new BadRequestException({
        oauth_error: 'invalid_request',
        message: 'code_challenge_method no soportado (solo S256)',
      });
    }

    // 2. Validar cliente
    const client = await this.findActiveClientByClientId(client_id);
    if (!client) {
      throw new BadRequestException({
        oauth_error: 'unauthorized_client',
        message: 'Cliente no autorizado',
      });
    }

    // 3. Validar redirect_uri contra los registrados
    const uris = client.redirect_uris as string[];
    if (!Array.isArray(uris) || !uris.includes(redirect_uri)) {
      throw new BadRequestException({
        oauth_error: 'invalid_request',
        message: 'redirect_uri no está permitido para este cliente',
      });
    }

    // 4. Validar scope
    const scopes = client.allowed_scopes as string[];
    if (scope && Array.isArray(scopes) && !scopes.includes(scope)) {
      throw new BadRequestException({
        oauth_error: 'invalid_scope',
        message: `Scope no permitido: ${scope}`,
      });
    }

    // 5. Autenticar usuario: JWT SSO en query o header
    const vitalId = await this.resolveSessionUser(query);
    if (!vitalId) {
      // Sin sesión → redirigir al login SSO (vuelve al authorize tras autenticarse)
      const loginUrl = this.buildLoginRedirect(
        redirect_uri,
        client_id,
        state,
        scope,
        code_challenge,
        code_challenge_method,
      );
      return res.redirect(loginUrl);
    }

    // 5.1 Consentimiento explícito. Si el usuario ya está autenticado pero aún
    // no aprobó la vinculación, redirigir a la pantalla de consentimiento de la
    // web de Vital ID. Solo se emite el code cuando query.consent === 'approved'.
    if (query.consent !== 'approved') {
      const consentUrl = this.buildConsentRedirect(
        query,
        vitalId,
      );
      return res.redirect(consentUrl);
    }

    // 6. Generar code de un solo uso
    const code = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.codeExpiresMs);

    await this.prisma.oauth_authorization_codes.create({
      data: {
        code,
        client_id: client.id,
        user_id: vitalId,
        redirect_uri,
        scope: scope ?? (Array.isArray(scopes) ? scopes[0] : null),
        code_challenge: code_challenge ?? null,
        code_challenge_method: code_challenge_method ?? null,
        expires_at: expiresAt,
      },
    });

    const sep = redirect_uri.includes('?') ? '&' : '?';
    const redirectTarget = state
      ? `${redirect_uri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
      : `${redirect_uri}${sep}code=${encodeURIComponent(code)}`;

    return res.redirect(redirectTarget);
  }

  // ── 2. POST /oauth/token ───────────────────────────────────────────
  /**
   * Intercambia un `code` por access/refresh tokens, o rota un refresh_token.
   * Responde en formato RFC 6749 (JSON plano).
   */
  async token(body: any, authorization?: string) {
    const { grant_type } = body;
    if (grant_type === 'authorization_code') {
      return this.exchangeAuthorizationCode(body, authorization);
    }
    if (grant_type === 'refresh_token') {
      return this.rotateRefresh(body, authorization);
    }
    this.oauthError('grant_type no soportado', 'unsupported_grant_type');
  }

  private async exchangeAuthorizationCode(body: any, authorization?: string) {
    const { code, code_verifier } = body;
    if (!code)
      this.oauthError('Falta el código de autorización', 'invalid_request');

    // Validar credenciales del cliente (Basic o body)
    const clientCredentials = this.resolveClientCredentials(
      body,
      authorization,
    );
    const client = await this.authenticateClient(clientCredentials);
    if (!client)
      this.oauthError('Credenciales de cliente inválidas', 'invalid_client');

    // Buscar y validar el code
    const codeRecord = await this.prisma.oauth_authorization_codes.findUnique({
      where: { code },
    });
    if (
      !codeRecord ||
      codeRecord.used_at ||
      codeRecord.client_id !== client.id
    ) {
      this.oauthError(
        'El código de autorización es inválido o ya fue usado',
        'invalid_grant',
      );
    }
    if (codeRecord.expires_at < new Date()) {
      this.oauthError('El código de autorización expiró', 'invalid_grant');
    }

    // Validar redirect_uri si se envió
    if (body.redirect_uri && body.redirect_uri !== codeRecord.redirect_uri) {
      this.oauthError('redirect_uri no coincide', 'invalid_grant');
    }

    // Validar PKCE (si el authorize envió code_challenge)
    if (codeRecord.code_challenge) {
      if (!code_verifier)
        this.oauthError('Falta code_verifier (PKCE)', 'invalid_grant');
      const expected =
        codeRecord.code_challenge_method === 'S256'
          ? createHash('sha256').update(code_verifier).digest('base64url')
          : code_verifier;
      if (expected !== codeRecord.code_challenge) {
        this.oauthError('code_verifier inválido (PKCE)', 'invalid_grant');
      }
    }

    // Marcar code como usado
    await this.prisma.oauth_authorization_codes.update({
      where: { id: codeRecord.id },
      data: { used_at: new Date() },
    });

    // Emitir tokens
    return this.issueTokens(client.id, codeRecord.user_id, codeRecord.scope);
  }

  private async rotateRefresh(body: any, authorization?: string) {
    const { refresh_token } = body;
    if (!refresh_token)
      this.oauthError('Falta el refresh_token', 'invalid_request');

    const clientCredentials = this.resolveClientCredentials(
      body,
      authorization,
    );
    const client = await this.authenticateClient(clientCredentials);
    if (!client)
      this.oauthError('Credenciales de cliente inválidas', 'invalid_client');

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refresh_token, {
        secret: this.refreshSecret,
      });
    } catch {
      this.oauthError('El refresh_token es inválido o expiró', 'invalid_grant');
    }

    const tokenRecord = await this.prisma.oauth_tokens.findFirst({
      where: {
        user_id: payload.sub,
        client_id: client.id,
        revoked_at: null,
        refresh_expires_at: { gt: new Date() },
      },
    });

    if (
      !tokenRecord ||
      !(await bcrypt.compare(refresh_token, tokenRecord.refresh_token_hash))
    ) {
      this.oauthError(
        'El refresh_token no es válido o fue revocado',
        'invalid_grant',
      );
    }

    // Revocar el token anterior (rotación)
    await this.prisma.oauth_tokens.update({
      where: { id: tokenRecord.id },
      data: { revoked_at: new Date() },
    });

    return this.issueTokens(client.id, payload.sub, tokenRecord.scope);
  }

  // ── 3. GET /oauth/userinfo ─────────────────────────────────────────
  /**
   * Devuelve la identidad del usuario ligada al access_token (Bearer).
   * VitalGuard usa este endpoint (o valida el JWT localmente) para saber
   * qué vital_id está hablando.
   */
  async userinfo(accessToken?: string) {
    if (!accessToken)
      this.oauthError('Token de acceso no proporcionado', 'invalid_token');

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(accessToken, {
        secret: this.accessSecret,
      });
    } catch {
      this.oauthError(
        'El token de acceso es inválido o expiró',
        'invalid_token',
      );
    }

    // Verificar que el jti sigue activo (no revocado)
    const tokenRecord = await this.prisma.oauth_tokens.findFirst({
      where: {
        access_token_jti: payload.jti,
        revoked_at: null,
        access_expires_at: { gt: new Date() },
      },
    });
    if (!tokenRecord)
      this.oauthError(
        'El token de acceso fue revocado o expiró',
        'invalid_token',
      );

    const user = await this.prisma.users.findUnique({
      where: { id: payload.sub },
      include: { persons: true },
    });
    if (!user) this.oauthError('Usuario no encontrado', 'invalid_token');

    return {
      sub: user.id, // vital_id
      email: user.email,
      first_name: user.persons?.first_name,
      paternal_last_name: user.persons?.paternal_last_name,
      maternal_last_name: user.persons?.maternal_last_name,
    };
  }

  // ── 4. POST /oauth/revoke (RFC 7009) ───────────────────────────────
  /**
   * Revoca un access_token o refresh_token de la skill.
   * Autentica al cliente y marca como revocado el token correspondiente.
   * RFC 7009 exige responder 200 aunque el token no exista (no revelar estado).
   */
  async revokeToken(body: any, authorization?: string) {
    const { token, token_type_hint } = body;
    if (!token)
      this.oauthError('Falta el token a revocar', 'invalid_request');

    // Autenticar al cliente (Basic o body), igual que en /token
    const clientCredentials = this.resolveClientCredentials(
      body,
      authorization,
    );
    const client = await this.authenticateClient(clientCredentials);
    if (!client)
      this.oauthError('Credenciales de cliente inválidas', 'invalid_client');

    // Buscar el registro del token por cliente (activos)
    const tokens = await this.prisma.oauth_tokens.findMany({
      where: {
        client_id: client.id,
        revoked_at: null,
      },
    });

    let target: (typeof tokens)[number] | null = null;

    // 1. Si es refresh_token o el hint lo indica → comparar por hash
    const checkAsRefresh =
      token_type_hint === 'refresh_token' || !token_type_hint;
    if (checkAsRefresh) {
      for (const record of tokens) {
        const ok = await bcrypt.compare(token, record.refresh_token_hash);
        if (ok) {
          target = record;
          break;
        }
      }
    }

    // 2. Si no se resolvió como refresh → intentar como access (JWT)
    if (!target) {
      for (const secret of [this.accessSecret, this.refreshSecret]) {
        try {
          const payload: any = await this.jwtService.verifyAsync(token, {
            secret,
          });
          target = tokens.find((t) => t.access_token_jti === payload.jti) || null;
          if (target) break;
        } catch {
          // intentar con el siguiente secreto
        }
      }
    }

    if (target) {
      await this.prisma.oauth_tokens.update({
        where: { id: target.id },
        data: { revoked_at: new Date() },
      });
    }

    // RFC 7009: responder 200 vacío en todos los casos
    return {};
  }

  // ── 5. DELETE /oauth/links (desvinculación por usuario SSO) ─────────
  /**
   * Revoca todos los tokens OAuth activos (vínculo de la skill) de un usuario.
   * Lo usa el frontend para "Desconectar Alexa". El usuario se autentica con
   * su propio access_token SSO (JwtAuthGuard).
   */
  async revokeUserLinks(userId: string) {
    const result = await this.prisma.oauth_tokens.updateMany({
      where: { user_id: userId, revoked_at: null },
      data: { revoked_at: new Date() },
    });

    return {
      success: true,
      message: 'Vínculo de la skill desvinculado correctamente',
      revoked_count: result.count,
    };
  }

  // ── Utilidades internas ────────────────────────────────────────────
  private async findActiveClientByClientId(client_id: string) {
    return this.prisma.oauth_clients.findFirst({
      where: { client_id, is_active: true, deleted_at: null },
    });
  }

  private resolveClientCredentials(
    body: any,
    authorization?: string,
  ): { client_id: string; client_secret: string } {
    if (authorization && authorization.startsWith('Basic ')) {
      const base64 = authorization.replace('Basic ', '').trim();
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      const [id, secret] = decoded.split(':');
      return { client_id: id, client_secret: secret || '' };
    }
    return { client_id: body.client_id, client_secret: body.client_secret };
  }

  private async authenticateClient(creds: {
    client_id: string;
    client_secret: string;
  }) {
    if (!creds.client_id || !creds.client_secret) return null;
    const client = await this.findActiveClientByClientId(creds.client_id);
    if (!client) return null;
    const ok = await bcrypt.compare(
      creds.client_secret,
      client.client_secret_hash,
    );
    return ok ? client : null;
  }

  private async resolveSessionUser(query: any): Promise<string | null> {
    // Token en query (?access_token=...) o en header Authorization
    const token = query.access_token || query.token;
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token, {
          secret: this.accessSecret,
        });
        return payload.sub || null;
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Elimina comillas dobles/spacios residuales de un valor de entorno.
   * Evita que URLs como `"https://…"` (con comillas literales) rompan el
   * redirect del flujo de Account Linking.
   */
  private cleanBaseUrl(url: string): string {
    return url.trim().replace(/^"|"$/g, '');
  }

  private buildLoginRedirect(
    redirect_uri: string,
    client_id: string,
    state?: string,
    scope?: string,
    codeChallenge?: string,
    codeChallengeMethod?: string,
  ): string {
    const base = this.cleanBaseUrl(
      process.env.OAUTH_LOGIN_URL ||
        `${process.env.VITAL_ID_BASE_URL || 'http://localhost:3000'}/auth/login`,
    );
    const params = new URLSearchParams({
      redirect_uri,
      client_id,
      ...(state ? { state } : {}),
      ...(scope ? { scope } : {}),
      ...(codeChallenge ? { code_challenge: codeChallenge } : {}),
      ...(codeChallengeMethod ? { code_challenge_method: codeChallengeMethod } : {}),
    });
    return `${base}?${params.toString()}`;
  }

  /**
   * Construye la URL a la pantalla de consentimiento de la web de Vital ID.
   * Reenvía los parámetros OAuth originales + el access_token para que la web
   * pueda re-disparar el authorize con consent=approved y resolver al usuario.
   * Conserva el code_challenge (PKCE). Si no hay access_token, la web usará el
   * de su localStorage o pedirá login (caso B).
   */
  private buildConsentRedirect(query: any, vitalId: string): string {
    const base = this.cleanBaseUrl(
      process.env.OAUTH_CONSENT_URL ||
        process.env.OAUTH_LOGIN_URL ||
        `${process.env.VITAL_ID_BASE_URL || 'http://localhost:3000'}/#authorize`,
    );
    const sep = base.includes('?') ? '&' : '?';
    const params = new URLSearchParams();
    for (const key of [
      'client_id',
      'redirect_uri',
      'response_type',
      'scope',
      'state',
      'code_challenge',
      'code_challenge_method',
    ]) {
      if (query[key] !== undefined) params.set(key, query[key]);
    }
    if (query.access_token) params.set('access_token', query.access_token);
    if (vitalId) params.set('vital_id', vitalId);
    return `${base}${sep}${params.toString()}`;
  }

  private async issueTokens(
    clientId: string,
    userId: string,
    scope: string | null,
  ) {
    const jti = randomUUID();
    const accessExpiresIn = this.accessExpiresIn;
    const refreshExpiresIn = this.refreshExpiresIn;

    const payload = { sub: userId, jti, scope: scope ?? 'vitalguard:patient' };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.accessSecret,
      expiresIn: accessExpiresIn as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.refreshSecret,
      expiresIn: refreshExpiresIn as any,
    });

    const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
    const now = Date.now();

    await this.prisma.oauth_tokens.create({
      data: {
        client_id: clientId,
        user_id: userId,
        access_token_jti: jti,
        refresh_token_hash: refreshTokenHash,
        scope: scope ?? 'vitalguard:patient',
        access_expires_at: new Date(
          now + this.durationToMs(accessExpiresIn, 24 * 60 * 60 * 1000),
        ),
        refresh_expires_at: new Date(
          now + this.durationToMs(refreshExpiresIn, 30 * 24 * 60 * 60 * 1000),
        ),
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: this.secondsFromDuration(accessExpiresIn, 24 * 60 * 60),
    };
  }
}
