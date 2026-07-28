import {defineConfig, devices} from '@playwright/test';

/**
 * Suíte end-to-end do Event Access.
 *
 * Não há mock: o navegador fala com o frontend real, que fala com o backend real.
 * Suba a stack antes (`podman compose up -d` ou `make up`) e rode `npm run e2e`.
 *
 * O backend precisa estar em perfil de desenvolvimento (`app.environment=development`),
 * porque a aprovação automática do Pix usa /api/dev/payments/{id}/approve. Sem isso
 * seria necessário o sandbox do Asaas a cada execução, o que torna o teste não determinístico.
 */
export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/.artifacts',
  timeout: 60_000,
  expect: {timeout: 10_000},
  // Os cenários compartilham estoque e contadores: rodar em paralelo geraria
  // falhas falsas. Concorrência real é testada de propósito em 08-inventory.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', {open: 'never'}]] : [['list']],
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    actionTimeout: 15_000,
  },
  projects: [
    {name: 'desktop', use: {...devices['Desktop Chrome']}},
    {
      name: 'portaria-mobile',
      testMatch: /05-door-checkin\.spec\.ts/,
      use: {
        ...devices['Pixel 7'],
        // A portaria opera no celular. Permissões concedidas para que o clique
        // em "Iniciar câmera" não trave num diálogo do navegador.
        permissions: ['camera'],
      },
    },
  ],
});
