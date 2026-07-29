import {readFile} from 'node:fs/promises';
import {inflateRawSync} from 'node:zlib';
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
    const workbook = zipEntry(content, 'xl/workbook.xml').toString('utf8');
    for (const aba of ['Resumo', 'Vendas', 'Ingressos', 'Entradas']) {
      expect(workbook, `a aba ${aba} deveria existir na pasta de trabalho`).toContain(`name="${aba}"`);
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

/**
 * Lê uma entrada do ZIP usando o diretório central.
 * Procurar texto diretamente no binário do .xlsx é incorreto porque o XML pode
 * estar comprimido — exatamente o que causava o falso negativo deste teste.
 */
function zipEntry(zip: Buffer, entryName: string): Buffer {
  const eocd = findSignatureBackwards(zip, 0x06054b50);
  if (eocd < 0) throw new Error('O arquivo baixado não contém o diretório central de um ZIP válido.');

  const totalEntries = zip.readUInt16LE(eocd + 10);
  let offset = zip.readUInt32LE(eocd + 16);

  for (let index = 0; index < totalEntries; index++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Cabeçalho inválido no diretório central do ZIP, posição ${offset}.`);
    }

    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const name = zip.subarray(nameStart, nameStart + fileNameLength).toString('utf8');

    if (name === entryName) {
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new Error(`Cabeçalho local inválido para ${entryName}.`);
      }

      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = zip.subarray(dataStart, dataStart + compressedSize);

      if (compressionMethod === 0) return compressed;
      if (compressionMethod === 8) return inflateRawSync(compressed);
      throw new Error(`Método de compressão ${compressionMethod} não suportado em ${entryName}.`);
    }

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error(`A entrada ${entryName} não existe no arquivo XLSX.`);
}

function findSignatureBackwards(buffer: Buffer, signature: number): number {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65_557); offset--) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  return -1;
}
