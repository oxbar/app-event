import {AdminApi} from './support/api';
import {RUN_ID} from './support/data';
import {expect, loginAs, test} from './support/fixtures';

/**
 * Recuperação de senha ponta a ponta.
 *
 * O teste cria um usuário exclusivo da execução — mexer na senha do organizador
 * derrubaria todos os outros cenários — pede a recuperação pela interface, lê o
 * e-mail que o backend produziu, abre o link recebido e entra com a nova senha.
 */
test.describe('Recuperação de senha', () => {
  const account = {
    name: `Recuperação E2E ${RUN_ID}`,
    email: `recuperacao.e2e.${RUN_ID}@eventaccess.local`,
    password: 'SenhaAntiga@123',
  };
  const novaSenha = 'SenhaNova@2026';

  test('do pedido ao login com a nova senha', async ({page, scenarioData}) => {
    await scenarioData.api.ensureMember(account);

    await page.goto('/login');
    await page.getByRole('link', {name: /esqueci minha senha/i}).click();
    await expect(page).toHaveURL(/\/forgot-password/);

    await page.locator('#forgot-email').fill(account.email);
    await page.getByRole('button', {name: /enviar link de recuperação/i}).click();

    // A confirmação não pode revelar se a conta existe: só repete o e-mail informado.
    await expect(page.getByTestId('reset-sent')).toContainText(account.email);
    // O reenvio entra em espera para evitar o clique repetido.
    await expect(page.getByRole('button', {name: /reenviar em \d+s/i})).toBeDisabled();

    const mail = await scenarioData.api.waitForMail(account.email);
    expect(mail.subject).toContain('Recuperação de senha');
    const link = extractResetLink(mail.text);

    await page.goto(link);
    // Com o token no link, o campo de token não aparece.
    await expect(page.locator('#reset-token')).toHaveCount(0);

    await page.locator('#reset-password').fill(novaSenha);
    await page.locator('#reset-confirmation').fill(novaSenha);
    await page.getByRole('button', {name: /redefinir senha/i}).click();

    await page.waitForURL(/\/login/, {timeout: 20_000});
    await expect(page.locator('.success-panel')).toContainText(/senha alterada/i);

    await loginAs(page, account.email, novaSenha);
    await expect(page).toHaveURL(/\/(dashboard|door|events)/);
  });

  test('o mesmo link não pode ser usado duas vezes', async ({page, scenarioData}) => {
    const single = {
      name: `Token Único E2E ${RUN_ID}`,
      email: `token.unico.e2e.${RUN_ID}@eventaccess.local`,
      password: 'SenhaAntiga@123',
    };
    await scenarioData.api.ensureMember(single);

    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill(single.email);
    await page.getByRole('button', {name: /enviar link de recuperação/i}).click();
    await expect(page.getByTestId('reset-sent')).toBeVisible();

    const link = extractResetLink((await scenarioData.api.waitForMail(single.email)).text);

    await resetWith(page, link, 'PrimeiraTroca@2026');
    await page.waitForURL(/\/login/, {timeout: 20_000});

    await resetWith(page, link, 'SegundaTroca@2026');
    await expect(page.locator('.error-panel')).toContainText(/inválido ou expirado/i);

    // A primeira troca continua valendo.
    await loginAs(page, single.email, 'PrimeiraTroca@2026');
  });

  test('e-mail inexistente recebe a mesma resposta, sem gerar mensagem', async ({page}) => {
    const desconhecido = `ninguem.${RUN_ID}@eventaccess.local`;

    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill(desconhecido);
    await page.getByRole('button', {name: /enviar link de recuperação/i}).click();

    await expect(page.getByTestId('reset-sent')).toContainText(desconhecido);

    const api = await AdminApi.login();
    try {
      expect(await api.mailbox(desconhecido)).toEqual([]);
    } finally {
      await api.dispose();
    }
  });
});

async function resetWith(page: import('@playwright/test').Page, link: string, senha: string): Promise<void> {
  await page.goto(link);
  await page.locator('#reset-password').fill(senha);
  await page.locator('#reset-confirmation').fill(senha);
  await page.getByRole('button', {name: /redefinir senha/i}).click();
}

function extractResetLink(text: string): string {
  const match = /https?:\/\/\S*\/reset-password\?token=\S+/.exec(text);
  if (!match) throw new Error(`O e-mail não trouxe o link de recuperação. Conteúdo:\n${text}`);
  return match[0].replace(/[.,)\]]+$/, '');
}
