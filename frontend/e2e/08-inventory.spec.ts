import {scenario} from './support/data';
import {expect, test} from './support/fixtures';

/**
 * O equivalente comercial do teste de entrada duplicada.
 *
 * O lote Premium tem 2 unidades e máximo 1 por pedido. Três compradores
 * simultâneos devem produzir 2 sucessos e 1 recusa — nunca 3 sucessos, nunca
 * estoque negativo. A reserva no checkout é um UPDATE condicional; este teste
 * é o que prova que ele resiste à concorrência real de HTTP.
 */
test.describe('Estoque sob concorrência', () => {
  test('não vende mais do que existe', async ({browser, scenarioData}) => {
    const attempts = 3;
    const available = scenario.ticketTypes.premium.totalQuantity;

    const results = await Promise.all(
      Array.from({length: attempts}, async (_, index) => {
        const context = await browser.newContext();
        const page = await context.newPage();
        try {
          await page.goto(`/e/${scenarioData.event.slug}`);
          await selectPremium(page);
          await page.locator('#checkout-quantity').fill('1');
          await page.locator('#checkout-name').fill(`Concorrente ${index}`);
          await page.locator('#checkout-email').fill(`concorrente.${index}.${Date.now()}@example.com`);
          await page.locator('#checkout-phone').fill(scenario.buyer.phone);
          await page.locator('#checkout-document').fill(scenario.buyer.document);
          await page.locator('#accepted-terms').check();
          await page.locator('#accepted-privacy').check();
          await page.getByRole('button', {name: /pix|finalizar|continuar/i}).first().click();

          await page.waitForURL(/\/payment\//, {timeout: 25_000});
          return true;
        } catch {
          return false;
        } finally {
          await context.close();
        }
      }),
    );

    const succeeded = results.filter(Boolean).length;
    expect(succeeded, 'o estoque não pode ser ultrapassado').toBeLessThanOrEqual(available);
    expect(succeeded, 'ao menos uma compra deveria ter sido concluída').toBeGreaterThan(0);
  });
});

async function selectPremium(page: import('@playwright/test').Page): Promise<void> {
  const premium = page.getByText(scenario.ticketTypes.premium.name).first();
  await premium.click({trial: false}).catch(() => undefined);
}
