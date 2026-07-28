import {Page} from '@playwright/test';
import {scenario} from './support/data';
import {expect, loginAs, test} from './support/fixtures';
import {buyCommonTicket} from './support/flows';

/**
 * Roteiro passos 9 a 12 — o coração do produto.
 *
 * A leitura por câmera não é simulável de forma confiável em CI, então usamos o
 * campo manual, que chega ao mesmo serviço de check-in
 * (POST /api/events/{id}/checkins/manual) e passa pelo mesmo UPDATE condicional.
 * O que está sendo provado é a regra, não o driver da câmera.
 */
test.describe('Portaria', () => {
  test('libera a entrada e mostra a cor da pulseira', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name);

    await validate(page, code);

    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();
    await expect(page.getByText(scenario.ticketTypes.common.wristbandLabel)).toBeVisible();
    // Contador de sessão: o operador acompanha o próprio ritmo sem sair da tela.
    await expect(page.getByText(/1\s*liberadas/i)).toBeVisible();
  });

  test('nega a segunda leitura do mesmo ingresso', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name);

    await validate(page, code);
    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();

    await validate(page, code);
    await expect(page.getByText('ENTRADA NEGADA')).toBeVisible();
    await expect(page.getByText(/já utilizado/i)).toBeVisible();
    await expect(page.getByText(/1\s*negadas/i)).toBeVisible();

    // A invariante que sustenta o negócio: duas leituras, uma entrada.
    const tickets = await scenarioData.api.ticketsOfEvent(scenarioData.event.id);
    const used = tickets.filter(ticket => ticket['status'] === 'USED');
    expect(used).toHaveLength(1);
  });

  test('nega ingresso de outro evento', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;

    // Segundo evento, mesma organização — o cenário do print do roteiro manual.
    const other = await scenarioData.api.createEvent(
      `${scenarioData.event.name} vizinho`,
      `${scenarioData.event.slug}-vizinho`,
      scenario.venue,
    );
    await scenarioData.api.createTicketType(other.id, scenario.ticketTypes.common);
    await scenarioData.api.publish(other.id);

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, other.name);

    await validate(page, code);
    await expect(page.getByText('ENTRADA NEGADA')).toBeVisible();
    await expect(page.getByText(/outro evento/i)).toBeVisible();
  });

  test('nega ingresso bloqueado e volta a liberar após desbloqueio', async ({page, organizer, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const code = order.tickets![0].publicCode;

    await organizer.goto('/tickets');
    // A lista de ingressos é montada com <article>, não com tabela.
    const row = organizer.locator('article').filter({hasText: code}).first();
    await row.getByRole('button', {name: /bloquear/i}).click();
    await expect(row.getByText(/bloqueado/i)).toBeVisible();

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name);
    await validate(page, code);
    await expect(page.getByText(/bloqueado/i)).toBeVisible();

    await organizer.reload();
    await organizer.locator('article').filter({hasText: code}).first()
      .getByRole('button', {name: /desbloquear/i}).click();

    await validate(page, code);
    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();
  });

  test('o campo manual aceita o link completo do ingresso', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const token = order.tickets![0].qrToken;
    test.skip(!token, 'API não devolveu o token do ingresso nesta versão.');

    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await openDoor(page, scenarioData.event.name);

    // O normalize() do backend extrai o token de uma URL inteira — é o que a
    // câmera entrega quando o QR carrega o link em vez do token puro.
    await validate(page, `http://localhost:4200/t/${token}`);
    await expect(page.getByText('ENTRADA LIBERADA')).toBeVisible();
  });
});

async function openDoor(page: Page, eventName: string): Promise<void> {
  await page.goto('/door');
  await page.locator('#door-event').selectOption({label: eventName});
  // A portaria carrega depois do evento; esperar a opção evita corrida.
  await expect(page.locator('#door-point option')).not.toHaveCount(1);
  await page.locator('#door-point').selectOption({index: 1});
}

async function validate(page: Page, token: string): Promise<void> {
  await page.locator('#door-token').fill(token);
  await page.getByRole('button', {name: /validar manualmente/i}).click();
}
