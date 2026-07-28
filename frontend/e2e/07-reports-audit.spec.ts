import {expect, test} from './support/fixtures';
import {buyCommonTicket} from './support/flows';

/** Roteiro passos 17 e 19. */
test.describe('Relatórios e auditoria', () => {
  test('exporta o CSV de vendas com as colunas esperadas', async ({organizer, page, scenarioData}) => {
    await buyCommonTicket(page, scenarioData);

    await organizer.goto('/reports');
    const [download] = await Promise.all([
      organizer.waitForEvent('download'),
      organizer.getByRole('button', {name: /exportar vendas/i}).click(),
    ]);

    const content = await readDownload(download);
    expect(content.split('\n')[0].toLowerCase()).toMatch(/pedido|comprador|total/);
    expect(content.trim().split('\n').length).toBeGreaterThan(1);
  });

  test('exporta o CSV de check-ins', async ({organizer}) => {
    await organizer.goto('/reports');
    const [download] = await Promise.all([
      organizer.waitForEvent('download'),
      organizer.getByRole('button', {name: /exportar check-?ins/i}).click(),
    ]);

    const content = await readDownload(download);
    expect(content.split('\n')[0].toLowerCase()).toMatch(/resultado|participante|portaria/);
  });

  test('a auditoria registra as ações críticas do fluxo', async ({page, scenarioData}) => {
    await buyCommonTicket(page, scenarioData);
    const actions = await scenarioData.api.auditActions();

    for (const expected of ['EVENT_CREATED', 'TICKET_TYPE_CREATED', 'EVENT_PUBLISHED', 'PAYMENT_APPROVED']) {
      expect(actions, `auditoria deveria conter ${expected}`).toContain(expected);
    }
  });
});

async function readDownload(download: import('@playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}
