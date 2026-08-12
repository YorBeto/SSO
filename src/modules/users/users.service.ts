import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service.js'; // <-- Importar tu MailService
import { OtpService } from '../otp/otp.service.js';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService, // <-- Inyectar MailService
    private readonly otpService: OtpService,
  ) {}

  async createUser(dto: CreateUserDto) {
    const {
      email,
      phone,
      password,
      first_name,
      paternal_last_name,
      maternal_last_name,
      birth_date,
      gender,
      address,
      two_factor_enabled,
    } = dto;

    // 1. Validar correo o teléfono duplicado
    const cleanPhone = phone ? phone.replace('+52', '').trim() : phone;

    const existingUser = await this.prisma.users.findFirst({
      where: {
        OR: [{ email }, ...(cleanPhone ? [{ phone: cleanPhone }] : [])],
      },
    });

    if (existingUser) {
      throw new ConflictException({
        code: 'AUTH-009',
        message:
          'El correo electrónico o teléfono ya está registrado en el sistema',
        error: 'Conflict',
      });
    }

    try {
      // 2. Hash de contraseña
      const passwordHash = await bcrypt.hash(password, 10);

      // 3. Crear Persona + Usuario en la BD
      const newUser = await this.prisma.users.create({
        data: {
          email,
          phone: cleanPhone,
          password_hash: passwordHash,
          is_active: false, // Inactivo hasta activar por correo
          two_factor_method: two_factor_enabled === false ? false : true,
          persons: {
            create: {
              first_name,
              paternal_last_name,
              maternal_last_name,
              birth_date: new Date(birth_date),
              gender,
              address,
            },
          },
        },
        include: {
          persons: true,
        },
      });

      // 4. Generar OTP
      const otpCode = await this.otpService.generateOtp(newUser.id);

      // 5. Enviar el correo de activación vía Resend SDK (HTTPS - Puerto 443)
      await this.mailService.sendMail({
        to: newUser.email,
        subject: 'Activa tu cuenta - Vital ID',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2>¡Hola, ${first_name}!</h2>
            <p>Gracias por registrarte en <strong>Vital ID</strong>.</p>
            <p>Tu código de activación para confirmar tu cuenta es:</p>
            <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #0284c7;">${otpCode}</span>
            </div>
            <p>Este código vencerá en 24 horas.</p>
          </div>
        `,
      });

      // 6. Retornar respuesta
      return {
        message:
          'Usuario registrado exitosamente. Se ha enviado un código de activación a su correo.',
        data: {
          id: newUser.persons.id,
          first_name: newUser.persons.first_name,
          paternal_last_name: newUser.persons.paternal_last_name,
          maternal_last_name: newUser.persons.maternal_last_name,
          birth_date: newUser.persons.birth_date,
          gender: newUser.persons.gender,
          address: newUser.persons.address,
          email: newUser.email,
          phone: newUser.phone,
          two_factor_enabled: newUser.two_factor_method,
          is_active: newUser.is_active,
          created_at: newUser.created_at,
          updated_at: newUser.updated_at,
        },
      };
    } catch (err) {
      console.error('Error en createUser:', err);
      if (err instanceof ConflictException) throw err;
      throw new InternalServerErrorException({
        code: 'SYS-001',
        message: 'Internal Server Error',
        error: 'Unhandled exception',
      });
    }
  }
}
