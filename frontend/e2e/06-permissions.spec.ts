import {AdminApi, E2E_API_URL} from './support/api';
import {scenario} from './support/data';
import {expect, loginAs, test} from './support/fixtures';

/** Menu escondido não é autorização; a suíte verifica interface e backend. */
const RESTRICTED = ['/payments', '/refunds', '/audit', '/operations'];

test.describe('Perfis e permissões', () => {
  test.beforeEach(async ({page}) => {
    // Cada teste pode rodar isoladamente ou após reinício do worker.
    const api = await AdminApi.login();
    try {
      await api.ensureMember(scenario.doorStaff);
    } finally {
      await api.dispose();
    }
    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
  });

  for (const route of RESTRICTED) {
    test(`operador de portaria não acessa ${route}`, async ({page}) => {
      await page.goto(route);
      await expect(page.getByText(/acesso negado|sem permissão|forbidden/i).first()).toBeVisible();
    });
  }

  test('o menu não oferece áreas administrativas', async ({page}) => {
    await page.goto('/door');
    await expect(page.getByRole('link', {name: /portaria/i})).toBeVisible();
    await expect(page.getByRole('link', {name: /^pagamentos$/i})).toHaveCount(0);
    await expect(page.getByRole('link', {name: /^auditoria$/i})).toHaveCount(0);
  });

  test('a API recusa mesmo sem passar pela interface', async ({page, request}) => {
    const token = await page.evaluate(() => {
      const raw = localStorage.getItem('event-access-session') ?? sessionStorage.getItem('event-access-session');
      if (!raw) return null;
      try {
        return (JSON.parse(raw) as {accessToken?: string}).accessToken ?? null;
      } catch {
        return null;
      }
    });
    expect(token, 'o login deve persistir o accessToken para a chamada direta').toBeTruthy();

    const response = await request.get(`${E2E_API_URL}/api/payments`, {
      headers: {Authorization: `Bearer ${token}`},
    });
    expect(response.status(), 'a API deveria recusar por perfil, não confiar na interface').toBe(403);
  });
});
