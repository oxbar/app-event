import {Injectable} from '@angular/core';
import {Ticket} from '../core/models';

@Injectable({providedIn: 'root'})
export class TicketDownloadService {
  downloadQr(ticket: Ticket): void {
    if (!ticket.qrCodeDataUrl) return;
    this.downloadDataUrl(ticket.qrCodeDataUrl, `qr-code-${this.safeName(ticket.publicCode)}.png`);
  }

  async downloadTicket(ticket: Ticket): Promise<void> {
    if (!ticket.qrCodeDataUrl) return;

    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1600;
    const context = canvas.getContext('2d');
    if (!context) return;

    const qrImage = await this.loadImage(ticket.qrCodeDataUrl);
    const wristbandColor = this.validColor(ticket.wristbandColorHex) ? ticket.wristbandColorHex! : '#6b4eff';

    context.fillStyle = '#f3f1ff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    this.roundedRect(context, 55, 55, 970, 1490, 48);
    context.fillStyle = '#ffffff';
    context.fill();

    context.fillStyle = '#6b4eff';
    context.fillRect(55, 55, 970, 210);

    context.fillStyle = '#ffffff';
    context.font = '700 42px Inter, Arial, sans-serif';
    context.fillText('EVENT ACCESS', 105, 145);
    context.font = '500 25px Inter, Arial, sans-serif';
    context.fillText('INGRESSO DIGITAL', 105, 195);

    this.drawStatus(context, this.statusLabel(ticket.status), 785, 112);

    context.fillStyle = '#111827';
    context.textAlign = 'center';
    context.font = '800 58px Inter, Arial, sans-serif';
    this.fillWrappedText(context, ticket.eventName, 540, 350, 810, 68, 2);

    context.font = '700 44px Inter, Arial, sans-serif';
    context.fillText(ticket.ticketType, 540, 475);

    context.fillStyle = '#4b5563';
    context.font = '500 30px Inter, Arial, sans-serif';
    context.fillText(ticket.attendeeName, 540, 540);

    const eventDate = this.formatDate(ticket.eventStartsAt);
    context.font = '500 25px Inter, Arial, sans-serif';
    context.fillText(eventDate, 540, 590);
    if (ticket.venueName) {
      this.fillWrappedText(context, ticket.venueName, 540, 630, 800, 34, 2);
    }

    const qrSize = 570;
    const qrX = (canvas.width - qrSize) / 2;
    const qrY = 700;
    context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

    context.fillStyle = '#111827';
    context.font = '600 28px ui-monospace, SFMono-Regular, Consolas, monospace';
    context.fillText(ticket.publicCode, 540, 1325);

    context.beginPath();
    context.arc(410, 1388, 18, 0, Math.PI * 2);
    context.fillStyle = wristbandColor;
    context.fill();
    context.strokeStyle = '#d1d5db';
    context.lineWidth = 2;
    context.stroke();

    context.fillStyle = '#374151';
    context.font = '500 27px Inter, Arial, sans-serif';
    context.textAlign = 'left';
    context.fillText(ticket.wristbandLabel || 'Pulseira não informada', 445, 1397);

    context.textAlign = 'center';
    context.fillStyle = '#6b7280';
    context.font = '500 23px Inter, Arial, sans-serif';
    context.fillText('Apresente o QR Code ou o código do ingresso na portaria.', 540, 1480);

    this.downloadDataUrl(canvas.toDataURL('image/png'), `ingresso-${this.safeName(ticket.publicCode)}.png`);
  }

  private loadImage(source: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível carregar o QR Code.'));
      image.src = source;
    });
  }

  private downloadDataUrl(source: string, filename: string): void {
    const link = document.createElement('a');
    link.href = source;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  private drawStatus(context: CanvasRenderingContext2D, status: string, x: number, y: number): void {
    this.roundedRect(context, x, y, 185, 60, 30);
    context.fillStyle = '#ffffff';
    context.fill();
    context.fillStyle = '#4c1d95';
    context.textAlign = 'center';
    context.font = '700 24px Inter, Arial, sans-serif';
    context.fillText(status, x + 92, y + 39);
  }

  private fillWrappedText(
    context: CanvasRenderingContext2D,
    value: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number,
    maxLines: number,
  ): void {
    const words = value.split(/\s+/);
    const lines: string[] = [];
    let current = '';

    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (context.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        current = word;
        if (lines.length === maxLines - 1) break;
      }
    }
    if (current && lines.length < maxLines) lines.push(current);

    lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  }

  private roundedRect(
    context: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ): void {
    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + safeRadius, y);
    context.arcTo(x + width, y, x + width, y + height, safeRadius);
    context.arcTo(x + width, y + height, x, y + height, safeRadius);
    context.arcTo(x, y + height, x, y, safeRadius);
    context.arcTo(x, y, x + width, y, safeRadius);
    context.closePath();
  }

  private safeName(value: string): string {
    return value.replace(/[^a-zA-Z0-9_-]/g, '-');
  }

  private validColor(value?: string): boolean {
    return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value));
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(date);
  }

  private statusLabel(value: string): string {
    const labels: Record<string, string> = {
      VALID: 'Válido',
      USED: 'Utilizado',
      BLOCKED: 'Bloqueado',
      CANCELED: 'Cancelado',
      REFUNDED: 'Reembolsado',
      EXPIRED: 'Expirado',
    };
    return labels[value] ?? value;
  }
}
