import {expect, loginAs, test} from './support/fixtures';
import {RUN_ID} from './support/data';

test.describe('Experiência da conta', () => {
  test('alterna o tema e mantém a preferência após recarregar', async ({organizer}) => {
    await organizer.goto('/reports');
    await organizer.evaluate(() => localStorage.setItem('event-access-theme', 'light'));
    await organizer.reload();

    await expect(organizer.locator('html')).toHaveAttribute('data-theme', 'light');
    await organizer.getByRole('button', {name: 'Tema escuro', exact: true}).click();
    await expect(organizer.locator('html')).toHaveAttribute('data-theme', 'dark');

    await organizer.reload();
    await expect(organizer.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(organizer.getByRole('button', {name: 'Tema claro', exact: true})).toBeVisible();
  });

  test('solicita recuperação, redefine a senha e entra com a nova credencial', async ({page, scenarioData}, testInfo) => {
    const suffix = `${RUN_ID}.${testInfo.testId.replace(/\W/g, '').slice(-8)}`;
    const member = {
      name: `Recuperação E2E ${suffix}`,
      email: `recuperacao.${suffix}@eventaccess.local`,
      password: 'BeforeReset@123',
    };
    const newPassword = 'AfterReset@123';
    await scenarioData.api.ensureMember(member);

    await page.goto('/forgot-password');
    await page.locator('#forgot-email').fill(member.email);
    await page.getByRole('button', {name: 'Enviar instruções', exact: true}).click();
    await expect(page.getByText('Verifique sua caixa de entrada', {exact: true})).toBeVisible();

    const token = (await page.getByTestId('development-token').textContent())?.trim();
    expect(token, 'o ambiente de desenvolvimento deve devolver o token para o E2E').toBeTruthy();
    await page.goto(`/reset-password?token=${encodeURIComponent(token!)}`);
    await page.locator('#reset-password').fill(newPassword);
    await page.locator('#reset-confirmation').fill(newPassword);
    await page.getByRole('button', {name: 'Redefinir senha', exact: true}).click();

    await page.waitForURL(/\/login\?passwordReset=success/);
    await expect(page.getByText(/senha redefinida com sucesso/i)).toBeVisible();
    await loginAs(page, member.email, newPassword);
    await expect(page.getByRole('link', {name: /portaria/i})).toBeVisible();
  });
});
