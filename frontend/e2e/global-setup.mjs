import {assertE2eReady} from './scripts/preflight.mjs';

/**
 * Interrompe a suíte antes do primeiro cenário quando a stack está apontando
 * para Asaas, produção ou uma imagem antiga. Sem isso, um único erro de
 * configuração vira dezenas de timeouts em cascata no checkout.
 */
export default async function globalSetup() {
  await assertE2eReady();
}
