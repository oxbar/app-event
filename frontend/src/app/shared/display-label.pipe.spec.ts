import {DisplayLabelPipe} from './display-label.pipe';

describe('DisplayLabelPipe', () => {
  const pipe = new DisplayLabelPipe();

  it('traduz situações e perfis conhecidos para pt-BR', () => {
    expect(pipe.transform('PENDING_PAYMENT')).toBe('Pagamento pendente');
    expect(pipe.transform('DOOR_STAFF')).toBe('Equipe de portaria');
  });

  it('humaniza valores ainda não mapeados', () => {
    expect(pipe.transform('CUSTOM_STATUS')).toBe('Custom status');
  });
});
