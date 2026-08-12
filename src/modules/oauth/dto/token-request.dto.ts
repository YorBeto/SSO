import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * Body del endpoint POST /oauth/token (RFC 6749).
 *
 * El flujo acepta dos grant types:
 *  - `authorization_code`: intercambia el `code` emitido por /oauth/authorize por
 *    un access_token + refresh_token (Account Linking de Alexa).
 *  - `refresh_token`: rota un refresh_token previo por un par nuevo (re-emisión
 *    sin re-consentimiento del usuario).
 *
 * Las credenciales del cliente se envían por `Authorization: Basic` o en el body
 * (`client_id` + `client_secret`), según `auth_method` del cliente registrado.
 */
export class TokenRequestDto {
  @ApiProperty({
    example: 'authorization_code',
    description: 'Tipo de concesión',
  })
  @IsString()
  grant_type!: 'authorization_code' | 'refresh_token';

  @ApiProperty({
    example: 'abc123',
    required: false,
    description: 'Código de autorización (grant_type=authorization_code)',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty({
    required: false,
    description: 'Refresh token (grant_type=refresh_token)',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;

  @ApiProperty({
    required: false,
    description: 'URI de redirección usada en el authorize',
  })
  @IsOptional()
  @IsString()
  redirect_uri?: string;

  @ApiProperty({
    required: false,
    description: 'Client ID (si auth_method=client_secret_post)',
  })
  @IsOptional()
  @IsString()
  client_id?: string;

  @ApiProperty({
    required: false,
    description: 'Client secret (si auth_method=client_secret_post)',
  })
  @IsOptional()
  @IsString()
  client_secret?: string;

  @ApiProperty({
    required: false,
    description: 'Verificador PKCE (S256) del authorize',
  })
  @IsOptional()
  @IsString()
  code_verifier?: string;
}
