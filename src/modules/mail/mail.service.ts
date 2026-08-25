import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private resend: Resend | null = null;

  /**
   * Crea el cliente de Resend de forma perezosa: si RESEND_API_KEY no está
   * configurado, el resto de la app puede arrancar igual (solo falla al
   * intentar enviar un correo), en vez de usar por error MAIL_PASS (una
   * contraseña SMTP) como si fuera la API key de Resend.
   */
  private getClient(): Resend {
    if (!this.resend) {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        throw new InternalServerErrorException(
          'RESEND_API_KEY no está configurado; no se puede enviar correo.',
        );
      }
      this.resend = new Resend(apiKey);
    }
    return this.resend;
  }

  async sendMail(options: { to: string; subject: string; html: string }) {
    try {
      const { data, error } = await this.getClient().emails.send({
        from: process.env.MAIL_FROM || 'VitalID <no-reply@vitalguard.app>',
        to: [options.to],
        subject: options.subject,
        html: options.html,
      });

      if (error) {
        console.error('Error de Resend API:', error);
        throw new InternalServerErrorException(
          `Resend Error: ${error.message}`,
        );
      }

      return data;
    } catch (err) {
      console.error('Fallo al enviar correo vía Resend SDK (HTTPS):', err);
      throw err;
    }
  }
}
