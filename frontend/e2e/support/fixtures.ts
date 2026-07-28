import {Page, test as base} from '@playwright/test';
import {AdminApi, EventView, TicketTypeView} from './api';
import {ORGANIZER, scenario} from './data';

export interface Scenario {
  api: AdminApi;
  event: EventView;
  common: TicketTypeView;
  premium: TicketTypeView;
}

/**
 * Cada teste recebe evento e lotes próprios. O identificador usa o testId do
 * Playwright, evitando colisão entre títulos que começam igual e entre projetos.
 */
export const test = base.extend<{organizer: Page; scenarioData: Scenario}>({
  scenarioData: async ({}, use, testInfo) => {
    const api = await AdminApi.login();
    try {
      const readable = slugPart(testInfo.title).slice(0, 24) || 'teste';
      const identity = testInfo.testId.replace(/\W/g, '').slice(-10) || `${testInfo.workerIndex}`;
      const project = slugPart(testInfo.project.name).slice(0, 16) || 'projeto';
      const suffix = `${readable}-${project}-${identity}`;
      const slug = `${scenario.eventSlug}-${suffix}`.toLowerCase();

      const event = await api.createEvent(`${scenario.eventName} ${readable} ${identity.slice(-6)}`, slug, scenario.venue);
      const common = await api.createTicketType(event.id, scenario.ticketTypes.common);
      const premium = await api.createTicketType(event.id, scenario.ticketTypes.premium);
      await api.publish(event.id);

      await use({api, event, common, premium});
    } finally {
      await api.dispose();
    }
  },

  // Contexto isolado: login do operador na página principal não pode substituir
  // a sessão do organizador usada simultaneamente em testes administrativos.
  organizer: async ({browser, baseURL}, use) => {
    const context = await browser.newContext({
      baseURL: baseURL ?? process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
      locale: 'pt-BR',
      timezoneId: 'America/Sao_Paulo',
    });
    const organizer = await context.newPage();
    try {
      await loginAs(organizer, ORGANIZER.email, ORGANIZER.password);
      await use(organizer);
    } finally {
      await context.close();
    }
  },
});

export const expect = base.expect;

/** Login pela interface: é o caminho que o usuário percorre, então é o que testamos. */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', {name: /^entrar$/i}).click();

  try {
    await page.waitForURL(/\/(dashboard|events|door)/, {timeout: 20_000});
  } catch (error) {
    const panel = page.locator('.error-panel');
    const shown = (await panel.count()) > 0 ? (await panel.first().innerText()).trim() : '';
    throw new Error(
      [
        `Login pela interface não concluiu para ${email}.`,
        shown ? `A tela exibiu: "${shown}"` : 'A tela não exibiu nenhum erro — pode ser o backend fora do ar.',
        `URL no momento da falha: ${page.url()}`,
        '',
        email === ORGANIZER.email
          ? 'Para trocar as credenciais do organizador use E2E_ORGANIZER_EMAIL e E2E_ORGANIZER_PASSWORD.'
          : 'Confirme se o usuário de teste foi criado e está ativo antes do login.',
      ].join('\n'),
      {cause: error},
    );
  }
}

function slugPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
