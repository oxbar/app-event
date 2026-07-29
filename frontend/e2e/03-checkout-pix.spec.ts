import {scenario, TOTAL_COMMON} from './support/data';
import {expect, test} from './support/fixtures';
import {buyCommonTicket, selectCommonTicket} from './support/flows';

/** Roteiro passos 5 e 6: compra pública, Pix pendente e aprovação. */
test.describe('Checkout público e pagamento Pix', () => {
  test('compra gera pedido pendente com o total correto', async ({page, scenarioData}) => {
    await page.goto(`/e/${scenarioData.event.slug}`);
    await selectCommonTicket(page);

    await page.locator('#checkout-quantity').fill('1');
    await page.locator('#checkout-name').fill(scenario.buyer.name);
    await page.locator('#checkout-email').fill(scenario.buyer.email);
    await page.locator('#checkout-phone').fill(scenario.buyer.phone);
    await page.locator('#checkout-document').fill(scenario.buyer.document);
    await page.locator('#accepted-terms').check();
    await page.locator('#accepted-privacy').check();

    // Escopo no resumo evita colisão com o preço unitário do card do ingresso.
    await expect(page.locator('.purchase-summary__total strong')).toContainText(`${TOTAL_COMMON},00`);

    await page.getByRole('button', {name: /pix|finalizar|continuar/i}).first().click();
    await page.waitForURL(/\/payment\//, {timeout: 20_000});

    await expect(page.locator('#pix-code')).toBeVisible();
    const pixCode = await page.locator('#pix-code').inputValue();
    expect(pixCode.trim().length).toBeGreaterThan(30);
  });

  test('o CPF é obrigatório quando o evento exige documento', async ({page, scenarioData}) => {
    await page.goto(`/e/${scenarioData.event.slug}`);

    await page.locator('#checkout-name').fill(scenario.buyer.name);
    await page.locator('#checkout-email').fill(scenario.buyer.email);
    await page.locator('#checkout-phone').fill(scenario.buyer.phone);
    await page.locator('#accepted-terms').check();
    await page.locator('#accepted-privacy').check();

    const submit = page.getByRole('button', {name: /pix|finalizar|continuar/i}).first();
    await expect(submit, 'sem CPF o checkout deve permanecer inválido').toBeDisabled();

    await page.locator('#checkout-document').fill(scenario.buyer.document);
    await expect(submit, 'com os demais dados válidos, informar o CPF libera o envio').toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`/e/${scenarioData.event.slug}`));
  });

  test('aprovação emite o ingresso e muda o pedido para pago', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);

    expect(order.status).toBe('PAID');
    expect(order.tickets?.length).toBe(1);
    expect(order.tickets?.[0].status).toBe('VALID');
  });

  test('webhook duplicado não emite ingresso extra', async ({page, scenarioData}) => {
    const order = await buyCommonTicket(page, scenarioData);
    const paymentId = order.payment?.id;
    expect(paymentId, 'pedido pago deveria ter pagamento associado').toBeTruthy();

    await scenarioData.api.duplicateApproval(paymentId!);

    const reloaded = await scenarioData.api.order(order.publicCode);
    expect(reloaded.tickets?.length).toBe(1);
    expect(reloaded.status).toBe('PAID');
  });
});
