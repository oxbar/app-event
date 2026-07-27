import {Pipe, PipeTransform} from '@angular/core';

const LABELS: Record<string, string> = {
  ACCESS_POINT: 'Portaria',
  ATTENDEE: 'Participante',
  CHECKIN: 'Entrada',
  EVENT: 'Evento',
  EVENT_CANCELED: 'Evento cancelado',
  EVENT_CREATED: 'Evento criado',
  EVENT_PUBLISHED: 'Evento publicado',
  EVENT_UPDATED: 'Evento atualizado',
  INVITATION_CREATED: 'Convite criado',
  MANUAL_CHECKIN: 'Entrada manual',
  PAYMENT: 'Pagamento',
  PAYMENT_APPROVED: 'Pagamento aprovado',
  PAYMENT_REFUNDED: 'Pagamento reembolsado',
  REFUND: 'Reembolso',
  TICKET: 'Ingresso',
  TICKET_BLOCKED: 'Ingresso bloqueado',
  TICKET_RESEND_REQUESTED: 'Reenvio de ingresso solicitado',
  TICKET_TRANSFERRED: 'Ingresso transferido',
  TICKET_TYPE: 'Tipo de ingresso',
  TICKET_TYPE_CREATED: 'Tipo de ingresso criado',
  TICKET_TYPE_STATUS_CHANGED: 'Situação do tipo de ingresso alterada',
  TICKET_TYPE_UPDATED: 'Tipo de ingresso atualizado',
  TICKET_UNBLOCKED: 'Ingresso desbloqueado',
  ACTIVE: 'Ativo',
  APPROVED: 'Aprovado',
  ALREADY_USED: 'Ingresso já utilizado',
  BLOCKED: 'Bloqueado',
  CANCELED: 'Cancelado',
  CANCELLED: 'Cancelado',
  CLOSED: 'Encerrado',
  COMMON: 'Comum',
  CABIN: 'Camarote',
  BACKSTAGE: 'Backstage',
  COURTESY: 'Cortesia',
  CREATED: 'Criado',
  CREDIT_CARD: 'Cartão de crédito',
  DEBIT_CARD: 'Cartão de débito',
  DOOR_SALE: 'Venda na portaria',
  DOOR_STAFF: 'Equipe de portaria',
  DRAFT: 'Rascunho',
  EVENT_FINISHED: 'Evento encerrado',
  EVENT_MANAGER: 'Gestor de evento',
  EVENT_NOT_STARTED: 'Evento ainda não iniciado',
  EXPIRED: 'Expirado',
  FAILED: 'Falhou',
  FINANCE: 'Financeiro',
  FINISHED: 'Finalizado',
  INACTIVE: 'Inativo',
  IN_PROGRESS: 'Em andamento',
  INVALID_QR_CODE: 'QR Code inválido',
  INVITATION: 'Convite',
  MANUAL_DENIAL: 'Entrada recusada manualmente',
  ONLINE_CHECKOUT: 'Página de vendas on-line',
  ORGANIZATION: 'Organização',
  ORGANIZER_ADMIN: 'Administrador da organização',
  ORDER: 'Pedido',
  PARTIALLY_REFUNDED: 'Reembolso parcial',
  PAID: 'Pago',
  PAUSED: 'Pausado',
  PAYMENT_FAILED: 'Pagamento não aprovado',
  PAYMENT_PENDING: 'Pagamento pendente',
  PENDING: 'Pendente',
  PENDING_ACTIVATION: 'Aguardando ativação',
  PENDING_PAYMENT: 'Pagamento pendente',
  PIX: 'Pix',
  PREMIUM: 'Premium',
  PROCESSED: 'Processado',
  PROCESSING: 'Processando',
  PUBLISHED: 'Publicado',
  RECEIVED: 'Recebido',
  REFUNDED: 'Reembolsado',
  REQUESTED: 'Solicitado',
  SALES_CLOSED: 'Vendas encerradas',
  SALES_OPEN: 'Vendas abertas',
  SOLD_OUT: 'Esgotado',
  SUPER_ADMIN: 'Administrador da plataforma',
  SUSPENDED: 'Suspenso',
  USER: 'Usuário',
  USED: 'Utilizado',
  VALID: 'Válido',
  VIEWER: 'Somente leitura',
  VIP: 'VIP',
  WRONG_EVENT: 'Ingresso de outro evento',
  CASH: 'Dinheiro',
  FAKE: 'Simulado',
};

@Pipe({
  name: 'displayLabel',
  standalone: true,
  pure: true,
})
export class DisplayLabelPipe implements PipeTransform {
  transform(value: string | null | undefined, fallback = 'Não informado'): string {
    if (!value) return fallback;
    const normalized = value.trim().toUpperCase();
    return LABELS[normalized] ?? this.toSentence(value);
  }

  private toSentence(value: string): string {
    const text = value
      .replaceAll('_', ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLocaleLowerCase('pt-BR');
    return text.charAt(0).toLocaleUpperCase('pt-BR') + text.slice(1);
  }
}
