import { Module } from '@nestjs/common';
import { OAuthService } from './oauth.service.js';
import { OAuthController } from './oauth.controller.js';

/**
 * Módulo OAuth 2.0 — Account Linking.
 * Expone /oauth/authorize, /oauth/token y /oauth/userinfo para que Alexa
 * vincule la cuenta de Amazon del usuario con su identidad VitalGuard.
 */
@Module({
  controllers: [OAuthController],
  providers: [OAuthService],
  exports: [OAuthService],
})
export class OAuthModule {}
