import {Page, expect} from '@playwright/test';
import {AccessPointView, EventView, OrderView} from './api';
import {Scenario} from './fixtures';
import {scenario} from './data';

/**
 * Compra um ingresso Comum pela interface e aprova o Pix.
 * Devolve o pedido já pago, com ingressos emitidos.
 */
export async function buyCommonTicket(page: Page, data: Scenario, buyerName?: string): Promise<OrderView> {
  await page.goto(`/e/${data.event.slug}`);

  await page.locator('#checkout-quantity').fill('1');
  await page.locator('#checkout-name').fill(buyerName ?? scenario.buyer.name);
  await page.locator('#checkout-email').fill(`c.${Date.now()}.${Math.random().toString(36).slice(2, 7)}@example.com`);
  await page.locator('#checkout-phone').fill(scenario.buyer.phone);
  await page.locator('#checkout-document').fill(scenario.buyer.document);
  await page.locator('#accepted-terms').check();
  await page.locator('#accepted-privacy').check();
  await page.getByRole('button', {name: /pix|finalizar|continuar/i}).first().click();

  await page.waitForURL(/\/payment\//, {timeout: 20_000});
  const publicCode = orderCodeFromUrl(page.url());

  await expect.poll(
    async () => (await data.api.order(publicCode)).payment?.id,
    {timeout: 15_000, message: 'a cobrança Pix deveria existir antes da aprovação'},
  ).toBeTruthy();

  const pending = await data.api.order(publicCode);
  expect(pending.status, 'pedido deveria nascer aguardando pagamento').toBe('PENDING_PAYMENT');
  const paymentId = pending.payment?.id;
  expect(paymentId, 'a cobrança Pix deveria existir antes da aprovação').toBeTruthy();

  await data.api.approvePayment(paymentId!);

  // A tela faz polling; esperamos o estado real em vez de dormir um tempo fixo.
  await expect
    .poll(async () => (await data.api.order(publicCode)).status, {timeout: 30_000})
    .toBe('PAID');

  return data.api.order(publicCode);
}

/** Prepara usuário, portaria e vínculo exato exigidos pelo backend do check-in. */
export async function prepareDoorAccess(data: Scenario, event: EventView = data.event): Promise<AccessPointView> {
  const member = await data.api.ensureMember(scenario.doorStaff);
  const point = await data.api.ensureAccessPoint(event.id, doorPointName(event));
  await data.api.ensureDoorAssignment(event.id, member.userId, point.id);
  return point;
}

export function doorPointName(event: EventView): string {
  return `${scenario.accessPointName} ${event.id.slice(0, 8)}`;
}

export function orderCodeFromUrl(url: string): string {
  const match = /\/payment\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`Não foi possível extrair o código do pedido da URL: ${url}`);
  return decodeURIComponent(match[1]);
}
