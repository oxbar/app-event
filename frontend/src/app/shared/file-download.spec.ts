import {downloadBlob, filenameFromContentDisposition} from './file-download';

describe('file-download', () => {
  describe('filenameFromContentDisposition', () => {
    it('lê o nome do formato simples', () => {
      const header = 'attachment; filename="relatorio-festival-aurora-20260815-2200.xlsx"';

      expect(filenameFromContentDisposition(header, 'padrao.xlsx'))
        .toBe('relatorio-festival-aurora-20260815-2200.xlsx');
    });

    it('lê o nome sem aspas', () => {
      expect(filenameFromContentDisposition('attachment; filename=vendas.xlsx', 'padrao.xlsx'))
        .toBe('vendas.xlsx');
    });

    it('prefere o formato codificado quando existe acento', () => {
      const header = "attachment; filename=\"relatorio.xlsx\"; filename*=UTF-8''relat%C3%B3rio.xlsx";

      expect(filenameFromContentDisposition(header, 'padrao.xlsx')).toBe('relatório.xlsx');
    });

    it('cai no padrão quando o cabeçalho não vem', () => {
      expect(filenameFromContentDisposition(null, 'padrao.xlsx')).toBe('padrao.xlsx');
      expect(filenameFromContentDisposition('attachment', 'padrao.xlsx')).toBe('padrao.xlsx');
    });
  });

  describe('downloadBlob', () => {
    it('cria o link, dispara o clique e libera a URL temporária', () => {
      const createUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
      const revokeUrl = spyOn(URL, 'revokeObjectURL');
      const anchor = document.createElement('a');
      const click = spyOn(anchor, 'click');
      spyOn(document, 'createElement').and.returnValue(anchor);

      downloadBlob(new Blob(['x']), 'vendas.xlsx');

      expect(createUrl).toHaveBeenCalled();
      expect(anchor.download).toBe('vendas.xlsx');
      expect(anchor.href).toContain('blob:fake');
      expect(click).toHaveBeenCalled();
      // Sem revoke a aba acumula blobs até a memória reclamar.
      expect(revokeUrl).toHaveBeenCalledWith('blob:fake');
      expect(anchor.isConnected).toBeFalse();
    });
  });
});
