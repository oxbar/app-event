/** Credenciais do ambiente de demonstração, iguais às do roteiro de homologação. */
export const ORGANIZER = {
  email: process.env['E2E_ORGANIZER_EMAIL'] ?? 'organizer@eventaccess.local',
  password: process.env['E2E_ORGANIZER_PASSWORD'] ?? 'Organizer@123',
};

/**
 * Cada execução cria seu próprio evento e seu próprio operador de portaria.
 * Sem isso, a segunda rodada esbarraria em e-mail duplicado, estoque consumido
 * e ingressos antigos já expirados — exatamente o problema que o roteiro manual
 * pede para evitar criando um evento exclusivo.
 */
export const RUN_ID = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const scenario = {
  eventName: `Homologação E2E ${RUN_ID}`,
  eventSlug: `homologacao-e2e-${RUN_ID}`.toLowerCase(),
  venue: 'Arena de Homologação',
  accessPointName: `Entrada E2E ${RUN_ID}`,
  doorStaff: {
    name: `Operador E2E ${RUN_ID}`,
    email: `operador.e2e.${RUN_ID}@eventaccess.local`,
    password: 'DoorQA@123',
  },
  buyer: {
    name: 'Cliente Caminho Feliz',
    email: `cliente.${RUN_ID}@example.com`,
    phone: '(47) 99999-9999',
    // CPF válido de teste, aceito pelo validador de dígito verificador.
    document: '529.982.247-25',
  },
  ticketTypes: {
    common: {
      name: 'Comum',
      category: 'Comum',
      price: 50,
      serviceFee: 5,
      totalQuantity: 20,
      maxPerOrder: 2,
      wristbandLabel: 'Pulseira branca',
      wristbandColorName: 'Branca',
      wristbandColorHex: '#FFFFFF',
    },
    premium: {
      name: 'Premium',
      category: 'Premium',
      price: 150,
      serviceFee: 10,
      // Estoque curto de propósito: é o que torna o teste de concorrência possível.
      totalQuantity: 2,
      maxPerOrder: 1,
      wristbandLabel: 'Pulseira preta',
      wristbandColorName: 'Preta',
      wristbandColorHex: '#111111',
    },
  },
} as const;

export const TOTAL_COMMON = scenario.ticketTypes.common.price + scenario.ticketTypes.common.serviceFee;
