import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY || process.env.MAIL_PASS);
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    try {
      const { data, error } = await this.resend.emails.send({
        from: process.env.MAIL_FROM || 'VitalID <no-reply@vitalguard.app>',
        to: [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('Error de Resend API:', error);
        throw new InternalServerErrorException(`Resend Error: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error('Fallo al enviar correo vía Resend SDK (HTTPS):', err);
      throw err;
    }
  }
}