import {APIRequestContext, expect, request} from '@playwright/test';
import {ORGANIZER} from './data';

/**
 * Por padrão, as chamadas auxiliares da suíte passam pelo mesmo endereço do
 * frontend. Assim, /api usa o proxy do Angular ou do Nginx e não depende de a
 * porta 8080 do host estar livre. Para acessar o backend diretamente, defina
 * E2E_API_URL explicitamente.
 */
export const E2E_API_URL = normalizeBaseUrl(
  process.env['E2E_API_URL'] ?? process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
);

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

export interface PaymentView {
  id: string;
  status: string;
  provider?: string;
}

export interface TicketView {
  publicCode: string;
  status: string;
  qrValue?: string;
}

/** Espelha CheckoutService.OrderView: pagamento é singular, não uma coleção. */
export interface OrderView {
  publicCode: string;
  status: string;
  totalAmount: number;
  tickets?: TicketView[];
  payment?: PaymentView;
}

export interface MemberView {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

export interface AccessPointView {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export interface StaffView {
  id: string;
  userId: string;
  accessPointId?: string;
  accessPointName?: string;
  role: string;
  status: string;
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
    private organizationId?: string,
  ) {}

  static async login(email = ORGANIZER.email, password = ORGANIZER.password): Promise<AdminApi> {
    const context = await request.newContext({baseURL: E2E_API_URL});
    const response = await context.post('/api/auth/login', {data: {email, password}});

    if (!response.ok()) {
      const status = response.status();
      const body = await response.text();
      throw new Error(
        [
          `Login recusado para ${email} em ${E2E_API_URL}/api/auth/login`,
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
    return new AdminApi(context, body.accessToken, body.user?.organizationId);
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
        startsAt: new Date(now - 30 * 60_000).toISOString(),
        endsAt: new Date(now + 4 * 60 * 60_000).toISOString(),
        salesStartAt: new Date(now - 60 * 60_000).toISOString(),
        salesEndAt: new Date(now + 3 * 60 * 60_000).toISOString(),
        capacity: 30,
        requireDocument: true,
      },
    });
    await assertOk(response, 'criar evento');
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
    await assertOk(response, 'criar tipo de ingresso');
    return response.json();
  }

  async publish(eventId: string): Promise<EventView> {
    const response = await this.context.post(`/api/events/${eventId}/publish`, {headers: this.headers});
    await assertOk(response, 'publicar evento');
    return response.json();
  }

  async order(publicCode: string): Promise<OrderView> {
    const response = await this.context.get(`/api/public/orders/${publicCode}`);
    await assertOk(response, `carregar pedido ${publicCode}`);
    return response.json();
  }

  async ensureMember(member: {name: string; email: string; password: string}): Promise<MemberView> {
    const organizationId = await this.requireOrganizationId();
    const existing = await this.memberByEmail(organizationId, member.email);
    if (existing) return existing;

    const response = await this.context.post(`/api/organizations/${organizationId}/members`, {
      headers: this.headers,
      data: {
        name: member.name,
        email: member.email,
        temporaryPassword: member.password,
        role: 'DOOR_STAFF',
      },
    });

    // Em retry ou execução concorrente outro teste pode ter criado entre GET e POST.
    if (response.status() === 409) {
      const created = await this.memberByEmail(organizationId, member.email);
      if (created) return created;
    }

    await assertOk(response, `criar membro ${member.email}`);
    return response.json();
  }

  async ensureAccessPoint(eventId: string, name: string): Promise<AccessPointView> {
    const listed = await this.context.get(`/api/events/${eventId}/access-points`, {headers: this.headers});
    await assertOk(listed, `listar portarias do evento ${eventId}`);
    const points = (await listed.json()) as AccessPointView[];
    const existing = points.find(point => point.name === name);
    if (existing) return existing;

    const response = await this.context.post(`/api/events/${eventId}/access-points`, {
      headers: this.headers,
      data: {name, description: 'Portaria preparada pela suíte end-to-end', status: 'ACTIVE'},
    });
    await assertOk(response, `criar portaria ${name}`);
    return response.json();
  }

  async ensureDoorAssignment(eventId: string, userId: string, accessPointId: string): Promise<StaffView> {
    const listed = await this.context.get(`/api/events/${eventId}/staff`, {headers: this.headers});
    await assertOk(listed, `listar equipe do evento ${eventId}`);
    const staff = (await listed.json()) as StaffView[];
    const existing = staff.find(item => item.userId === userId && item.accessPointId === accessPointId);
    if (existing) return existing;

    const response = await this.context.post(`/api/events/${eventId}/staff`, {
      headers: this.headers,
      data: {userId, accessPointId, role: 'DOOR_STAFF'},
    });
    await assertOk(response, `vincular operador ${userId} à portaria ${accessPointId}`);
    return response.json();
  }

  /**
   * Aprova o Pix pelo endpoint de desenvolvimento.
   * O backend deve estar com PAYMENT_PROVIDER=FAKE.
   */
  async approvePayment(paymentId: string): Promise<void> {
    const response = await this.context.post(`/api/dev/payments/${paymentId}/approve`, {headers: this.headers});
    if (response.ok()) return;

    const body = await response.text();
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
    const response = await this.context.post(`/api/dev/payments/${paymentId}/duplicate`, {headers: this.headers});
    await assertOk(response, `reenviar aprovação do pagamento ${paymentId}`);
  }

  async ticketsOfEvent(eventId: string): Promise<Record<string, unknown>[]> {
    const response = await this.context.get(`/api/tickets?eventId=${eventId}&size=100`, {headers: this.headers});
    await assertOk(response, `listar ingressos do evento ${eventId}`);
    const body = await response.json();
    return body.content ?? body;
  }

  async auditActions(): Promise<string[]> {
    const response = await this.context.get('/api/audit?size=100', {headers: this.headers});
    await assertOk(response, 'consultar auditoria');
    const body = await response.json();
    return (body.content ?? []).map((entry: {action: string}) => entry.action);
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }

  private async memberByEmail(organizationId: string, email: string): Promise<MemberView | undefined> {
    const response = await this.context.get(`/api/organizations/${organizationId}/members`, {headers: this.headers});
    await assertOk(response, `listar membros da organização ${organizationId}`);
    const members = (await response.json()) as MemberView[];
    return members.find(member => member.email.toLowerCase() === email.toLowerCase());
  }

  private async requireOrganizationId(): Promise<string> {
    if (this.organizationId) return this.organizationId;

    const response = await this.context.get('/api/organizations?size=1', {headers: this.headers});
    await assertOk(response, 'descobrir organização autenticada');
    const body = await response.json();
    const organizationId = body.content?.[0]?.id as string | undefined;
    if (!organizationId) {
      throw new Error(`Nenhuma organização disponível para o usuário autenticado. Corpo: ${JSON.stringify(body)}`);
    }
    this.organizationId = organizationId;
    return organizationId;
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

async function assertOk(
  response: {ok(): boolean; status(): number; text(): Promise<string>},
  action: string,
): Promise<void> {
  if (response.ok()) return;
  throw new Error(`Falha ao ${action} — HTTP ${response.status()}: ${await response.text()}`);
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}
