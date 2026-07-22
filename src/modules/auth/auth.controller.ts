import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { AccountActivationService } from './services/account-activation.service.js';
import { PasswordService } from './services/password.service.js';
import { TokenService } from './services/token.service.js';

import { LoginDto } from './dto/logint.dto.js';
import { ActivateAccountDto } from './dto/activate-account.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { OtpRequestDto } from './dto/otp-request.dto.js';
import { OtpVerifyDto } from './dto/otp-verify.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly activationService: AccountActivationService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicio de sesión',
    description:
      'Autentica al usuario con email y contraseña, generando tokens JWT o solicitando 2FA.',
  })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 202, description: 'Requiere 2FA (OTP)' })
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // ==========================================
  // OTP ENDPOINTS (2FA)
  // ==========================================

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar o reenviar código OTP para 2FA' })
  @ApiResponse({ status: 200, description: 'OTP enviado exitosamente' })
  @ApiResponse({ status: 400, description: 'Usuario no encontrado o sin 2FA' })
  async requestOtp(@Body() dto: OtpRequestDto) {
    return this.activationService.request2faOtp(dto);
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar código OTP y completar Login 2FA' })
  @ApiResponse({ status: 200, description: 'OTP verificado, entrega de tokens' })
  @ApiResponse({ status: 400, description: 'Código OTP inválido o expirado' })
  async verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.activationService.verify2faOtp(dto);
  }

  // ==========================================
  // OTRAS RUTAS (ACTIVACIÓN, TOKEN, PERFIL, PASSSWORD)
  // ==========================================

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener información del usuario autenticado' })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user?.sub);
  }

  @Post('activate-account')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activación inicial de cuenta' })
  async activateAccount(@Body() activateAccountDto: ActivateAccountDto) {
    return this.activationService.activateAccount(activateAccountDto);
  }

  @Post('resend-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar código de activación' })
  async resendCode(@Body() dto: ResendCodeDto) {
    return this.activationService.resendActivationCode(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refrescar token de acceso y rotar refresh token' })
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.tokenService.rotateRefreshToken(refreshTokenDto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@Req() req: any, @Body() dto?: RefreshTokenDto) {
    return this.authService.logout(req.user?.sub, dto?.refresh_token);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cambiar contraseña (Usuario autenticado)' })
  async changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.passwordService.changePassword(req.user?.sub, dto);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Solicitar restablecimiento de contraseña' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.passwordService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restablecer contraseña mediante token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwordService.resetPassword(dto);
  }
}