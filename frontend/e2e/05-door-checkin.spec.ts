import {Page} from '@playwright/test';
import {scenario} from './support/data';
import {expect, loginAs, test} from './support/fixtures';
import {buyCommonTicket, prepareDoorAccess} from './support/flows';
import {selectComboboxOption} from './support/ui';

/**
 * Roteiro passos 9 a 12 — o coração do produto.
 * O campo manual passa pelo mesmo serviço e pelo mesmo update atômico da câmera.
 */
test.describe('Portaria', () => {
  test('libera a entrada e mostra a cor da pulseira', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;
    const point = await prepareDoorAccess(scenarioData);

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name, point.name);
    await validate(page, code);

    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();
    await expect(page.getByText(scenario.ticketTypes.common.wristbandLabel)).toBeVisible();
    await expect(page.getByText(/1\s*liberadas/i)).toBeVisible();
  });

  test('nega a segunda leitura do mesmo ingresso', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;
    const point = await prepareDoorAccess(scenarioData);

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name, point.name);

    await validate(page, code);
    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();

    await validate(page, code);
    await expect(page.getByText('ENTRADA NEGADA')).toBeVisible();
    await expect(page.getByText(/já utilizado/i)).toBeVisible();
    await expect(page.getByText(/1\s*negadas/i)).toBeVisible();

    // Valida o ingresso deste fluxo, não a quantidade global de usados.
    // A listagem administrativa pode conter dados de execuções anteriores quando
    // a base E2E é reaproveitada; isso não muda a invariante de idempotência.
    const tickets = await scenarioData.api.ticketsOfEvent(scenarioData.event.id);
    const matching = tickets.filter(ticket => ticket['publicCode'] === code);
    expect(matching, `o ingresso ${code} deve aparecer uma única vez`).toHaveLength(1);
    expect(matching[0]?.['status']).toBe('USED');
  });

  test('nega ingresso de outro evento', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;

    const other = await scenarioData.api.createEvent(
      `${scenarioData.event.name} vizinho`,
      `${scenarioData.event.slug}-vizinho`,
      scenario.venue,
    );
    await scenarioData.api.createTicketType(other.id, scenario.ticketTypes.common);
    await scenarioData.api.publish(other.id);
    const point = await prepareDoorAccess(scenarioData, other);

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, other.name, point.name);

    await validate(page, code);
    await expect(page.getByText('ENTRADA NEGADA')).toBeVisible();
    await expect(page.getByText(/outro evento/i)).toBeVisible();
  });

  test('nega ingresso bloqueado e volta a liberar após desbloqueio', async ({page, organizer, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;
    const point = await prepareDoorAccess(scenarioData);

    await organizer.goto('/tickets');
    const row = organizer.locator('article').filter({hasText: code}).first();
    await row.getByRole('button', {name: /bloquear/i}).click();
    await expect(row.getByText('Bloqueado', {exact: true})).toBeVisible();

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name, point.name);
    await validate(page, code);
    await expect(page.getByText(/bloqueado/i)).toBeVisible();

    await organizer.reload();
    const refreshedRow = organizer.locator('article').filter({hasText: code}).first();
    await refreshedRow.getByRole('button', {name: /desbloquear/i}).click();
    await expect(refreshedRow.getByText('Válido', {exact: true})).toBeVisible();

    await validate(page, code);
    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();
  });

  test('o campo manual aceita o link completo do ingresso', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const qrValue = order.tickets?.[0]?.qrValue;
    expect(qrValue, 'pedido pago deveria devolver o link do ingresso').toBeTruthy();
    const point = await prepareDoorAccess(scenarioData);

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name, point.name);

    await validate(page, qrValue!);
    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();
  });
});

async function openDoor(page: Page, eventName: string, pointName: string): Promise<void> {
  await page.goto('/door');
  await selectComboboxOption(page, '#door-event', eventName);
  await selectComboboxOption(page, '#door-point', pointName);
}

async function validate(page: Page, token: string): Promise<void> {
  await page.locator('#door-token').fill(token);
  await page.getByRole('button', {name: /validar manualmente/i}).click();
}
