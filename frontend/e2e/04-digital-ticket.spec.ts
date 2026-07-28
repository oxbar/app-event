import {expect, test} from './support/fixtures';
import {buyCommonTicket} from './support/flows';
import {scenario} from './support/data';

/** Roteiro passo 7: o ingresso que o comprador leva para a porta. */
test.describe('Ingresso digital', () => {
  test('mostra QR Code, pulseira e código público', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const ticketUrl = absoluteTicketUrl(order.tickets?.[0]?.qrValue, page.url());

    await page.goto(ticketUrl);

    await expect(page.getByRole('img', {name: /qr code/i})).toBeVisible();
    await expect(page.getByText(/TKT-/).first()).toBeVisible();
    const wristband = page.locator('.wristband');
    await expect(wristband).toBeVisible();
    await expect(wristband).toContainText(/pulseira/i);
    await expect(wristband).toContainText(new RegExp(scenario.ticketTypes.common.wristbandColorName, 'i'));
    await expect(page.getByText(/válido/i).first()).toBeVisible();
  });

  test('continua acessível sem sessão, pelo token opaco', async ({page, scenarioData, browser}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const ticketUrl = absoluteTicketUrl(order.tickets?.[0]?.qrValue, page.url());

    const anonymous = await browser.newContext();
    try {
      const anonymousPage = await anonymous.newPage();
      await anonymousPage.goto(ticketUrl);
      await expect(anonymousPage.getByText(/TKT-/).first()).toBeVisible();
    } finally {
      await anonymous.close();
    }
  });

  test('copiar o código dá retorno visual', async ({page, context, scenarioData}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const order = await buyCommonTicket(page, scenarioData);
    const ticketUrl = absoluteTicketUrl(order.tickets?.[0]?.qrValue, page.url());

    await page.goto(ticketUrl);
    await page.getByRole('button', {name: /copiar código/i}).click();
    await expect(page.getByRole('button', {name: /código copiado/i})).toBeVisible();
  });
});

function absoluteTicketUrl(value: string | undefined, base: string): string {
  expect(value, 'pedido pago deveria devolver qrValue do ingresso').toBeTruthy();
  const normalized = value!.trim();
  if (/^https?:\/\//i.test(normalized) || normalized.startsWith('/')) {
    return new URL(normalized, base).toString();
  }
  if (normalized.includes('/t/')) return new URL(normalized, base).toString();
  return new URL(`/t/${encodeURIComponent(normalized)}`, base).toString();
}
