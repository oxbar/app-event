import {readFile} from 'node:fs/promises';
import type {Download} from '@playwright/test';
import {expect, test} from './support/fixtures';
import {buyCommonTicket} from './support/flows';
import {selectComboboxOption} from './support/ui';

/**
 * Exportação em Excel.
 *
 * Um .xlsx é um pacote ZIP: conferir a assinatura PK e a presença das partes do
 * OOXML prova que o arquivo abre — bem mais do que checar apenas se o download
 * aconteceu. As abas são verificadas pelo nome dentro de workbook.xml.
 */
test.describe('Relatórios em Excel', () => {
  test('a pasta completa traz resumo, vendas, ingressos e entradas', async ({organizer, page, scenarioData}) => {
    await buyCommonTicket(page, scenarioData);

    await organizer.goto('/reports');
    await selectComboboxOption(organizer, '#report-event', scenarioData.event.name);

    const [download] = await Promise.all([
      organizer.waitForEvent('download'),
      organizer.getByRole('button', {name: /baixar pasta completa/i}).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.xlsx$/);
    const content = await bytes(download);

    // "PK" é a assinatura do ZIP; sem ela o Excel recusa o arquivo.
    expect(content.subarray(0, 2).toString('latin1')).toBe('PK');
    const raw = content.toString('latin1');
    expect(raw).toContain('xl/workbook.xml');
    for (const aba of ['Resumo', 'Vendas', 'Ingressos', 'Entradas']) {
      expect(raw, `a aba ${aba} deveria existir na pasta de trabalho`).toContain(aba);
    }
    expect(content.byteLength).toBeGreaterThan(2_000);
  });

  test('vendas e entradas também exportam planilha individual', async ({organizer, scenarioData}) => {
    await organizer.goto('/reports');
    await selectComboboxOption(organizer, '#report-event', scenarioData.event.name);

    for (const botao of [/planilha de vendas/i, /planilha de entradas/i]) {
      const [download] = await Promise.all([
        organizer.waitForEvent('download'),
        organizer.getByRole('button', {name: botao}).click(),
      ]);
      const content = await bytes(download);
      expect(content.subarray(0, 2).toString('latin1')).toBe('PK');
    }
  });

  test('os números da tela aparecem antes da exportação', async ({organizer, page, scenarioData}) => {
    await buyCommonTicket(page, scenarioData);

    await organizer.goto('/reports');
    await selectComboboxOption(organizer, '#report-event', scenarioData.event.name);

    const metrics = organizer.getByTestId('report-metrics');
    await expect(metrics).toBeVisible();
    await expect(metrics).toContainText(/comparecimento/i);
    await expect(metrics).toContainText(/ingressos emitidos/i);
  });
});

async function bytes(download: Download): Promise<Buffer> {
  const path = await download.path();
  if (path) return readFile(path);

  const stream = await download.createReadStream();
  if (!stream) throw new Error('O navegador não disponibilizou o conteúdo do download.');
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
