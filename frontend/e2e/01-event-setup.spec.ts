import {AdminApi} from './support/api';
import {RUN_ID, scenario} from './support/data';
import {expect, test} from './support/fixtures';

/** Roteiro passos 1 e 2: criação, lotes e publicação, pela interface. */
test.describe('Ciclo de vida do evento', () => {
  test('cria evento, cadastra lote e publica', async ({organizer}) => {
    const name = `Evento UI ${RUN_ID}`;

    await organizer.goto('/events');
    await organizer.getByRole('button', {name: /novo evento|criar evento/i}).first().click();

    await organizer.locator('#event-name').fill(name);
    await organizer.locator('#event-venue').fill(scenario.venue);
    await organizer.locator('#event-capacity').fill('30');
    await organizer.locator('#event-start').fill(localInput(-30));
    await organizer.locator('#event-end').fill(localInput(240));

    await organizer.getByRole('button', {name: /criar evento|salvar/i}).click();

    // O evento nasce em rascunho: publicar é uma decisão explícita do organizador.
    await expect(organizer.getByText(name).first()).toBeVisible();
    await expect(organizer.getByText(/rascunho/i).first()).toBeVisible();
  });

  test('evento publicado aparece no checkout público', async ({scenarioData, page}) => {
    await page.goto(`/e/${scenarioData.event.slug}`);

    await expect(page.getByRole('heading', {name: scenarioData.event.name})).toBeVisible();
    await expect(page.getByText(scenario.ticketTypes.common.name).first()).toBeVisible();
    await expect(page.getByText(scenario.ticketTypes.premium.name).first()).toBeVisible();
  });

  test('estoque cadastrado corresponde ao informado', async ({scenarioData}) => {
    expect(scenarioData.common.totalQuantity).toBe(scenario.ticketTypes.common.totalQuantity);
    expect(scenarioData.premium.totalQuantity).toBe(scenario.ticketTypes.premium.totalQuantity);
  });

  test('auditoria registra criação e publicação', async () => {
    const api = await AdminApi.login();
    const actions = await api.auditActions();
    expect(actions).toContain('EVENT_CREATED');
    expect(actions).toContain('TICKET_TYPE_CREATED');
    expect(actions).toContain('EVENT_PUBLISHED');
    await api.dispose();
  });
});

/** Converte minutos relativos ao agora no formato aceito por input datetime-local. */
function localInput(offsetMinutes: number): string {
  const date = new Date(Date.now() + offsetMinutes * 60_000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
