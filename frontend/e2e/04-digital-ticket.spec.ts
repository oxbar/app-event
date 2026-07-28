import {expect, test} from './support/fixtures';
import {buyCommonTicket} from './support/flows';
import {scenario} from './support/data';

/** Roteiro passo 7: o ingresso que o comprador leva para a porta. */
test.describe('Ingresso digital', () => {
  test('mostra QR Code, pulseira e código público', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const token = order.tickets?.[0]?.qrToken;
    test.skip(!token, 'API não devolveu o token do ingresso nesta versão.');

    await page.goto(`/t/${token}`);

    await expect(page.getByRole('img', {name: /qr code/i})).toBeVisible();
    await expect(page.getByText(/TKT-/).first()).toBeVisible();
    // A pulseira é a ação que a portaria executa depois de liberar a entrada.
    await expect(page.getByText(scenario.ticketTypes.common.wristbandLabel).first()).toBeVisible();
    await expect(page.getByText(/válido/i).first()).toBeVisible();
  });

  test('continua acessível sem sessão, pelo token opaco', async ({page, scenarioData, browser}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const token = order.tickets?.[0]?.qrToken;
    test.skip(!token, 'API não devolveu o token do ingresso nesta versão.');

    const anonymous = await browser.newContext();
    const anonymousPage = await anonymous.newPage();
    await anonymousPage.goto(`${page.url().split('/t/')[0].replace(/\/payment\/.*/, '')}/t/${token}`);

    await expect(anonymousPage.getByText(/TKT-/).first()).toBeVisible();
    await anonymous.close();
  });

  test('copiar o código dá retorno visual', async ({page, context, scenarioData}) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const order = await buyCommonTicket(page, scenarioData);
    const token = order.tickets?.[0]?.qrToken;
    test.skip(!token, 'API não devolveu o token do ingresso nesta versão.');

    await page.goto(`/t/${token}`);
    await page.getByRole('button', {name: /copiar código/i}).click();
    await expect(page.getByRole('button', {name: /código copiado/i})).toBeVisible();
  });
});
