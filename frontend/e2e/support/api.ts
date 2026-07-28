import {APIRequestContext, expect, request} from '@playwright/test';
import {ORGANIZER} from './data';

const API = process.env['E2E_API_URL'] ?? 'http://localhost:8080';

export interface EventView {
  id: string;
  name: string;
  slug: string;
  status: string;
}

export interface TicketTypeView {
  id: string;
  name: string;
  totalQuantity: number;
  availableQuantity?: number;
}

export interface OrderView {
  id: string;
  publicCode: string;
  status: string;
  totalAmount: number;
  tickets?: {publicCode: string; status: string; qrToken?: string}[];
  payments?: {id: string; status: string}[];
}

/**
 * Cliente da API usado apenas para PREPARAR e CONFERIR cenários.
 *
 * Os fluxos que o usuário percorre — checkout, portaria, permissões — são
 * exercidos pela interface. Montar dado de apoio por API é o que mantém a suíte
 * rápida e o motivo da falha legível: se o teste da portaria quebra, foi a portaria,
 * não o formulário de cadastro de lote.
 */
export class AdminApi {
  private constructor(
    private readonly context: APIRequestContext,
    private readonly token: string,
  ) {}

  static async login(email = ORGANIZER.email, password = ORGANIZER.password): Promise<AdminApi> {
    const context = await request.newContext({baseURL: API});
    const response = await context.post('/api/auth/login', {data: {email, password}});

    if (!response.ok()) {
      const status = response.status();
      const body = await response.text();
      // Um "falhou ao autenticar" sem status não diz nada a quem está depurando.
      // O que resolve o problema é o código HTTP e a dica do que costuma causá-lo.
      throw new Error(
        [
          `Login recusado para ${email} em ${API}/api/auth/login`,
          `HTTP ${status} — ${body || '(corpo vazio)'}`,
          '',
          hintFor(status),
        ].join('\n'),
      );
    }

    const body = await response.json();
    if (!body.accessToken) {
      throw new Error(`Login respondeu 200 sem accessToken. Corpo: ${JSON.stringify(body)}`);
    }
    return new AdminApi(context, body.accessToken);
  }

  private get headers(): Record<string, string> {
    return {Authorization: `Bearer ${this.token}`};
  }

  async createEvent(name: string, slug: string, venueName: string): Promise<EventView> {
    const now = Date.now();
    const response = await this.context.post('/api/events', {
      headers: this.headers,
      data: {
        name,
        slug,
        description: 'Evento criado automaticamente pela suíte end-to-end.',
        venueName,
        address: 'Rua da Homologação, 100',
        city: 'Blumenau',
        state: 'SC',
        country: 'BR',
        // Janela deliberada: começou há 30 minutos e termina em 4 horas.
        // Evita as recusas EVENT_NOT_STARTED e EVENT_FINISHED, que são corretas
        // mas atrapalhariam o caminho feliz.
        startsAt: new Date(now - 30 * 60_000).toISOString(),
        endsAt: new Date(now + 4 * 60 * 60_000).toISOString(),
        salesStartAt: new Date(now - 60 * 60_000).toISOString(),
        salesEndAt: new Date(now + 3 * 60 * 60_000).toISOString(),
        capacity: 30,
        requireDocument: true,
      },
    });
    expect(response.ok(), await failureText(response, 'criar evento')).toBeTruthy();
    return response.json();
  }

  async createTicketType(eventId: string, type: Record<string, unknown>): Promise<TicketTypeView> {
    const response = await this.context.post(`/api/events/${eventId}/ticket-types`, {
      headers: this.headers,
      data: {
        description: null,
        salesStartAt: null,
        salesEndAt: null,
        sortOrder: 0,
        ...type,
      },
    });
    expect(response.ok(), await failureText(response, 'criar tipo de ingresso')).toBeTruthy();
    return response.json();
  }

  async publish(eventId: string): Promise<EventView> {
    const response = await this.context.post(`/api/events/${eventId}/publish`, {headers: this.headers});
    expect(response.ok(), await failureText(response, 'publicar evento')).toBeTruthy();
    return response.json();
  }

  async order(publicCode: string): Promise<OrderView> {
    const response = await this.context.get(`/api/public/orders/${publicCode}`);
    expect(response.ok(), await failureText(response, `carregar pedido ${publicCode}`)).toBeTruthy();
    return response.json();
  }

  /**
   * Aprova o Pix pelo endpoint de desenvolvimento.
   *
   * O roteiro manual usa o sandbox do Asaas. Numa suíte automatizada isso
   * introduz rede externa, latência e um serviço de terceiro no caminho crítico —
   * três motivos para o teste falhar sem que o produto tenha problema.
   */
  async approvePayment(paymentId: string): Promise<void> {
    const response = await this.context.post(`/api/dev/payments/${paymentId}/approve`, {headers: this.headers});
    if (response.ok()) return;

    const body = await response.text();
    // A trava está correta: cobrança Asaas real não pode ser marcada como paga
    // por endpoint interno. Mas o erro cru não diz o que fazer, então dizemos aqui.
    if (body.includes('MANUAL_APPROVAL_NOT_ALLOWED')) {
      throw new Error(
        [
          'A suíte e2e precisa do provedor FAKE para aprovar o Pix de forma determinística.',
          'O backend está rodando com PAYMENT_PROVIDER=ASAAS, e ele recusa aprovação manual — corretamente.',
          '',
          'Suba a stack de teste com o provedor local:',
          '  podman compose --env-file .env.e2e up -d',
          '',
          'Ou exporte antes de subir:  PAYMENT_PROVIDER=FAKE',
          'Veja frontend/e2e/README.md.',
        ].join('\n'),
      );
    }
    expect(response.ok(), `Falha ao aprovar o pagamento — HTTP ${response.status()}: ${body}`).toBeTruthy();
  }

  /** Reenvia o mesmo evento de aprovação, para provar que ingresso não duplica. */
  async duplicateApproval(paymentId: string): Promise<void> {
    await this.context.post(`/api/dev/payments/${paymentId}/duplicate`, {headers: this.headers});
  }

  async ticketsOfEvent(eventId: string): Promise<Record<string, unknown>[]> {
    const response = await this.context.get(`/api/tickets?eventId=${eventId}&size=100`, {headers: this.headers});
    if (!response.ok()) return [];
    const body = await response.json();
    return body.content ?? body;
  }

  async auditActions(): Promise<string[]> {
    const response = await this.context.get('/api/audit?size=100', {headers: this.headers});
    if (!response.ok()) return [];
    const body = await response.json();
    return (body.content ?? []).map((entry: {action: string}) => entry.action);
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}

function hintFor(status: number): string {
  switch (status) {
    case 401:
      return [
        'Credenciais recusadas. Confira no banco qual é a senha real deste usuário:',
        '  podman compose exec postgres psql -U event_access -d event_access \\',
        '    -c "select email, status from users order by created_at;"',
        '',
        'Se a senha foi alterada, aponte a suíte para as credenciais corretas:',
        '  E2E_ORGANIZER_EMAIL=... E2E_ORGANIZER_PASSWORD=... npm run e2e',
      ].join('\n');
    case 404:
      return 'Rota não encontrada. O backend nesta porta pode ser outra aplicação, ou a stack não subiu.';
    case 429:
      return 'Rate limit atingido (60 req/min). Aguarde um minuto antes de repetir.';
    case 500:
    case 503:
      return 'O backend falhou ao responder. Veja: podman compose logs backend';
    default:
      return 'Verifique se a stack está no ar: podman compose ps';
  }
}

async function failureText(response: {status(): number; text(): Promise<string>}, action: string): Promise<string> {
  return `Falha ao ${action} — HTTP ${response.status()}: ${await response.text()}`;
}
