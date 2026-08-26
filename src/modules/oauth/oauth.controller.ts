import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  Headers,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { OAuthService } from './oauth.service.js';
import { TokenRequestDto } from './dto/token-request.dto.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

/**
 * OAuth 2.0 — Account Linking.
 * Vital ID actúa como Authorization Server para que Alexa (skill) vincule la
 * cuenta de Amazon del usuario con su identidad VitalGuard.
 */
@ApiTags('OAuth 2.0 - Account Linking')
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('authorize')
  @ApiOperation({
    summary: 'Iniciar vinculación (Account Linking)',
    description:
      'Punto de entrada que Amazon/la app llama. Valida el cliente, detecta la ' +
      'sesión SSO del usuario y, si está autenticado, redirige a la redirect_uri ' +
      'con un code de un solo uso (?code=..&state=..). Si no hay sesión, redirige al login SSO.',
  })
  @ApiQuery({ name: 'response_type', example: 'code' })
  @ApiQuery({
    name: 'client_id',
    description: 'Client ID de la skill de Alexa',
  })
  @ApiQuery({
    name: 'redirect_uri',
    description: 'URI que Amazon asigna (layla/pitangui)',
  })
  @ApiQuery({ name: 'scope', required: false, example: 'vitalguard:patient' })
  @ApiQuery({
    name: 'state',
    required: false,
    description: 'Anti-CSRF que Amazon reenvía',
  })
  @ApiQuery({
    name: 'code_challenge',
    required: false,
    description: 'PKCE (S256)',
  })
  async authorize(@Query() query: any, @Res() res: Response) {
    return this.oauthService.authorize(query, res);
  }

  @Post('token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Intercambiar code por tokens o rotar refresh_token',
    description:
      'grant_type=authorization_code: intercambia el code por access+refresh. ' +
      'grant_type=refresh_token: rota un refresh_token previo. Responde RFC 6749 (JSON plano).',
  })
  async token(
    @Body() dto: TokenRequestDto,
    @Headers('authorization') authorization?: string,
  ) {
    return this.oauthService.token(dto, authorization);
  }

  @Get('userinfo')
  @ApiOperation({
    summary: 'Resolución de identidad',
    description:
      'Devuelve { sub: vital_id, email } dado un access_token (Bearer). ' +
      'Lo usa VitalGuard para saber quién habla. RFC 6749 (JSON plano).',
  })
  async userinfo(@Req() req: Request) {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ')
      ? auth.replace('Bearer ', '')
      : undefined;
    return this.oauthService.userinfo(token);
  }

  @Post('revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revocar un token de la skill (RFC 7009)',
    description:
      'Revoca un access_token o refresh_token OAuth. Autentica al cliente ' +
      'y responde 200 vacío en todos los casos (RFC 7009).',
  })
  async revoke(
    @Body() body: any,
    @Headers('authorization') authorization?: string,
  ) {
    return this.oauthService.revokeToken(body, authorization);
  }

  @Get('link-status')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Estado del vínculo de la skill (Alexa) del usuario',
    description:
      'Devuelve si el usuario autenticado (SSO) tiene un vínculo OAuth activo ' +
      'con la skill de Alexa. Lo usa el móvil para mostrar el estado real ' +
      '(linked, client_name, linked_at, vital_id).',
  })
  async getUserLinkStatus(@Req() req: any) {
    return this.oauthService.getUserLinkStatus(req.user?.sub);
  }

  @Delete('links')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Desvincular la skill (revoca los tokens OAuth del usuario)',
    description:
      'Revoca todos los tokens OAuth activos del usuario autenticado (SSO). ' +
      'Lo usa el frontend para "Desconectar Alexa".',
  })
  async revokeUserLinks(@Req() req: any) {
    return this.oauthService.revokeUserLinks(req.user?.sub);
  }
}
