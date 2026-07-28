import {pathToFileURL} from 'node:url';

const DEFAULT_BASE_URL = 'http://localhost:4200';

export async function assertE2eReady(options = {}) {
  const baseUrl = normalize(options.baseUrl ?? process.env.E2E_BASE_URL ?? DEFAULT_BASE_URL);
  const email = process.env.E2E_ORGANIZER_EMAIL ?? 'organizer@eventaccess.local';
  const password = process.env.E2E_ORGANIZER_PASSWORD ?? 'Organizer@123';

  const login = await request(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({email, password}),
  }, 'autenticar o organizador da suíte');

  const accessToken = login.body?.accessToken;
  if (!accessToken) {
    throw new Error(`O login E2E respondeu sem accessToken: ${JSON.stringify(login.body)}`);
  }

  const status = await request(`${baseUrl}/api/dev/e2e/status`, {
    headers: {authorization: `Bearer ${accessToken}`},
  }, 'consultar o diagnóstico E2E');

  if (status.body?.environment !== 'development') {
    throw new Error([
      `APP_ENVIRONMENT inválido para E2E: ${status.body?.environment ?? '(ausente)'}.`,
      'A suíte precisa de development para usar os endpoints controlados de homologação.',
      'Execute: npm run e2e:full',
    ].join('\n'));
  }

  if (String(status.body?.paymentProvider).toUpperCase() !== 'FAKE' || status.body?.ready !== true) {
    throw new Error([
      `PAYMENT_PROVIDER atual: ${status.body?.paymentProvider ?? '(ausente)'}.`,
      'A suíte automatizada não deve depender do Asaas, internet ou confirmação manual.',
      'Execute: npm run e2e:full',
      'Ou reinicie manualmente: podman compose --env-file .env.e2e up -d --build --force-recreate',
    ].join('\n'));
  }

  console.log(`E2E preflight OK — ${baseUrl} · provider FAKE · development`);
  return status.body;
}

async function request(url, init, action) {
  let response;
  try {
    response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    throw new Error([
      `Não foi possível ${action} em ${url}.`,
      'Confirme se frontend, backend e banco estão ativos.',
      'Execute: npm run e2e:full',
    ].join('\n'), {cause});
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = {raw: text};
    }
  }

  if (!response.ok) {
    const rebuildHint = response.status === 404
      ? '\nO endpoint de diagnóstico não existe nesta imagem. Reconstrua a stack com o patch aplicado.'
      : '';
    throw new Error([
      `Falha ao ${action} — HTTP ${response.status} ${response.statusText}.`,
      JSON.stringify(body),
      rebuildHint,
      'Execute: npm run e2e:full',
    ].filter(Boolean).join('\n'));
  }

  return {response, body};
}

function normalize(value) {
  return value.replace(/\/+$/, '');
}

const executedDirectly = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  assertE2eReady().catch(error => {
    console.error(`\n[E2E preflight] ${error.message}\n`);
    process.exitCode = 1;
  });
}
