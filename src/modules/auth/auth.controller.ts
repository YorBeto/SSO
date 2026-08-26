import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Put,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
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
import { SessionsService } from './services/sessions.service.js';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';

import { LoginDto } from './dto/logint.dto.js';
import { ActivateAccountDto } from './dto/activate-account.dto.js';
import { ResendCodeDto } from './dto/resend-code.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { OtpRequestDto } from './dto/otp-request.dto.js';
import { OtpVerifyDto } from './dto/otp-verify.dto.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { Toggle2FADto } from './dto/toggle-2fa.dto.js';
import { RegisterAdminDto } from './dto/register-admin.dto.js';
import { UpdateAdminDto } from './dto/update-admin.dto.js';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly activationService: AccountActivationService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionsService: SessionsService,
  ) { }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inicio de sesión',
    description:
      'Autentica al usuario con email y contraseña, generando tokens JWT o solicitando 2FA.',
  })
  @ApiResponse({ status: 200, description: 'Login exitoso' })
  @ApiResponse({ status: 202, description: 'Requiere 2FA (OTP)' })
  async login(@Body() loginDto: LoginDto, @Req() req: any) {
    const ua = req.headers['user-agent'] || '';
    let deviceName = 'Navegador Web';

    // Detect OS
    const isWindows = ua.includes('Windows');
    const isMac = ua.includes('Macintosh') || ua.includes('Mac OS');
    const isLinux = ua.includes('Linux') && !ua.includes('Android');
    const isAndroid = ua.includes('Android');
    const isIOS = ua.includes('iPhone') || ua.includes('iPad');

    const os = isWindows
      ? 'Windows'
      : isMac
        ? 'Mac'
        : isAndroid
          ? 'Android'
          : isIOS
            ? 'iOS'
            : isLinux
              ? 'Linux'
              : 'Dispositivo';

    // IMPORTANT: check specific browsers BEFORE Chrome,
    // because Edge/Opera/Brave UAs also contain "Chrome"
    if (ua.includes('Edg/') || ua.includes('EdgA/'))
      deviceName = `Edge en ${os}`;
    else if (ua.includes('OPR/') || ua.includes('Opera/'))
      deviceName = `Opera en ${os}`;
    else if (ua.includes('Chrome') || ua.includes('CriOS'))
      deviceName = `Chrome en ${os}`;
    else if (ua.includes('Firefox') || ua.includes('FxiOS'))
      deviceName = `Firefox en ${os}`;
    else if (ua.includes('Safari')) deviceName = `Safari en ${os}`;

    // Brave has the same UA as Chrome — the frontend sends X-Browser-Hint to identify it
    const browserHint = req.headers['x-browser-hint'];
    if (browserHint === 'Brave') {
      deviceName = `Brave en ${os}`;
    }

    return this.authService.login(loginDto, deviceName);
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
  @ApiResponse({
    status: 200,
    description: 'OTP verificado, entrega de tokens',
  })
  @ApiResponse({ status: 400, description: 'Código OTP inválido o expirado' })
  async verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.activationService.verify2faOtp(dto);
  }

  // ==========================================
  // OTRAS RUTAS (ACTIVACIÓN, TOKEN, PERFIL, PASSSWORD)
  // ==========================================

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtener información del usuario autenticado' })
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user?.sub);
  }

  @Get('user/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener información de un usuario por su ID (Para microservicios)' })
  async getUserById(@Param('id') id: string) {
    const userProfile = await this.authService.getProfile(id);

    return {
      email: userProfile.email,
      person: {
        first_name: userProfile.first_name,
        paternal_last_name: userProfile.paternal_last_name
      }
    };
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
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Req() req: any,
  ) {
    const ua = req.headers['user-agent'] || '';
    let deviceName = 'Navegador Web';

    const isWindows = ua.includes('Windows');
    const isMac = ua.includes('Macintosh') || ua.includes('Mac OS');
    const isLinux = ua.includes('Linux') && !ua.includes('Android');
    const isAndroid = ua.includes('Android');
    const isIOS = ua.includes('iPhone') || ua.includes('iPad');

    const os = isWindows
      ? 'Windows'
      : isMac
        ? 'Mac'
        : isAndroid
          ? 'Android'
          : isIOS
            ? 'iOS'
            : isLinux
              ? 'Linux'
              : 'Dispositivo';

    if (ua.includes('Edg/') || ua.includes('EdgA/'))
      deviceName = `Edge en ${os}`;
    else if (ua.includes('OPR/') || ua.includes('Opera/'))
      deviceName = `Opera en ${os}`;
    else if (ua.includes('Chrome') || ua.includes('CriOS'))
      deviceName = `Chrome en ${os}`;
    else if (ua.includes('Firefox') || ua.includes('FxiOS'))
      deviceName = `Firefox en ${os}`;
    else if (ua.includes('Safari')) deviceName = `Safari en ${os}`;

    const browserHint = req.headers['x-browser-hint'];
    if (browserHint === 'Brave') {
      deviceName = `Brave en ${os}`;
    }

    return this.tokenService.rotateRefreshToken(
      refreshTokenDto.refresh_token,
      deviceName,
    );
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cerrar sesión' })
  async logout(@Req() req: any, @Body() dto?: Partial<RefreshTokenDto>) {
    return this.authService.logout(
      req.user?.sub,
      req.user?.jti,
      dto?.refresh_token,
    );
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
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

  // ==========================================
  // PERFIL & CONFIGURACIÓN DE CUENTA
  // ==========================================

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Actualizar datos del perfil del usuario autenticado',
  })
  @ApiResponse({ status: 200, description: 'Perfil actualizado exitosamente' })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos o teléfono duplicado',
  })
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user?.sub, dto);
  }

  @Patch('2fa')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Activar o desactivar autenticación de dos factores (2FA)',
  })
  @ApiResponse({ status: 200, description: 'Estado 2FA actualizado' })
  async toggle2FA(@Req() req: any, @Body() dto: Toggle2FADto) {
    return this.authService.toggle2FA(req.user?.sub, dto);
  }

  // ==========================================
  // SESIONES ACTIVAS
  // ==========================================

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sesiones activas del usuario autenticado' })
  @ApiResponse({ status: 200, description: 'Lista de sesiones activas' })
  async getSessions(@Req() req: any) {
    return this.sessionsService.getSessions(req.user?.sub, req.user?.jti);
  }

  @Delete('sessions/:sessionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar una sesión activa específica' })
  @ApiResponse({ status: 200, description: 'Sesión cerrada exitosamente' })
  @ApiResponse({ status: 404, description: 'Sesión no encontrada' })
  @ApiResponse({
    status: 403,
    description: 'Sin permiso para revocar esta sesión',
  })
  async revokeSession(@Req() req: any, @Param('sessionId') sessionId: string) {
    return this.sessionsService.revokeSession(req.user?.sub, sessionId);
  }

  @Delete('sessions')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revocar todas las sesiones activas del usuario' })
  @ApiResponse({ status: 200, description: 'Todas las sesiones cerradas' })
  async revokeAllSessions(@Req() req: any) {
    return this.sessionsService.revokeAllSessions(req.user?.sub);
  }

  @Post('admin/register') 
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registro directo de usuarios administradores' })
  async registerAdmin(@Body() dto: RegisterAdminDto) {
    return this.authService.registerAdmin(dto);
  }

  @Put('admin/update/:id')
  async updateAdmin(@Param('id') id: string, @Body() dto: UpdateAdminDto) {
    return this.authService.updateAdmin(id, dto);
  }

}
