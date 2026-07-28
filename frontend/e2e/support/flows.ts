import {Page, expect} from '@playwright/test';
import {OrderView} from './api';
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
  await page.locator('#checkout-email').fill(`c.${Date.now()}@example.com`);
  await page.locator('#checkout-phone').fill(scenario.buyer.phone);
  await page.locator('#checkout-document').fill(scenario.buyer.document);
  await page.locator('#accepted-terms').check();
  await page.locator('#accepted-privacy').check();
  await page.getByRole('button', {name: /pix|finalizar|continuar/i}).first().click();

  await page.waitForURL(/\/payment\//, {timeout: 20_000});
  const publicCode = orderCodeFromUrl(page.url());

  const pending = await data.api.order(publicCode);
  expect(pending.status, 'pedido deveria nascer aguardando pagamento').toBe('PENDING_PAYMENT');
  const paymentId = pending.payments?.[0]?.id;
  expect(paymentId, 'a cobrança Pix deveria existir antes da aprovação').toBeTruthy();

  await data.api.approvePayment(paymentId!);

  // A tela faz polling; esperamos o estado real em vez de dormir um tempo fixo.
  await expect
    .poll(async () => (await data.api.order(publicCode)).status, {timeout: 30_000})
    .toBe('PAID');

  return data.api.order(publicCode);
}

export function orderCodeFromUrl(url: string): string {
  const match = /\/payment\/([^/?#]+)/.exec(url);
  if (!match) throw new Error(`Não foi possível extrair o código do pedido da URL: ${url}`);
  return decodeURIComponent(match[1]);
}
