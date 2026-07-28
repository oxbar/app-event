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
 * Cenário montado uma vez por arquivo de teste: evento publicado com dois lotes.
 * Cada arquivo recebe o seu, então uma falha em 05 não contamina 07.
 */
export const test = base.extend<{organizer: Page; scenarioData: Scenario}>({
  scenarioData: async ({}, use, testInfo) => {
    const api = await AdminApi.login();
    const suffix = testInfo.title.slice(0, 6).replace(/\W/g, '') || 'x';
    const slug = `${scenario.eventSlug}-${suffix}-${testInfo.workerIndex}`.toLowerCase();

    const event = await api.createEvent(`${scenario.eventName} ${suffix}`, slug, scenario.venue);
    const common = await api.createTicketType(event.id, scenario.ticketTypes.common);
    const premium = await api.createTicketType(event.id, scenario.ticketTypes.premium);
    await api.publish(event.id);

    await use({api, event, common, premium});
    await api.dispose();
  },

  organizer: async ({page}, use) => {
    await loginAs(page, ORGANIZER.email, ORGANIZER.password);
    await use(page);
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
    await page.waitForURL(/\/(dashboard|events)/, {timeout: 20_000});
  } catch (error) {
    // Um timeout de navegação não diz se a culpa foi credencial, backend ou seletor.
    // A própria tela costuma ter a resposta, então lemos o painel de erro antes de falhar.
    const panel = page.locator('.error-panel');
    const shown = (await panel.count()) > 0 ? (await panel.first().innerText()).trim() : '';
    throw new Error(
      [
        `Login pela interface não concluiu para ${email}.`,
        shown ? `A tela exibiu: "${shown}"` : 'A tela não exibiu nenhum erro — pode ser o backend fora do ar.',
        `URL no momento da falha: ${page.url()}`,
        '',
        'Se a mensagem for de credencial, confirme a senha real e use:',
        '  E2E_ORGANIZER_EMAIL=... E2E_ORGANIZER_PASSWORD=... npm run e2e',
      ].join('\n'),
      {cause: error},
    );
  }
}
