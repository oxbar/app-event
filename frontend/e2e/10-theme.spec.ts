import {expect, test} from './support/fixtures';

/**
 * Tema claro e escuro.
 *
 * A verificação central é o atributo no elemento <html>: era exatamente ele que
 * faltava — com o tema preso a um elemento interno, o fundo da página seguia
 * claro e o modo escuro aparecia pela metade. Por isso o teste confere também
 * a cor efetiva do body, e não apenas o atributo.
 */
test.describe('Tema claro e escuro', () => {
  test('a tela de login permite trocar o tema antes de entrar', async ({page}) => {
    await page.goto('/login');

    const toggle = page.getByTestId('theme-toggle');
    await expect(toggle).toBeVisible();

    const claro = await backgroundColor(page);
    await toggle.click();

    await expect(page.locator('html')).toHaveAttribute('tuiTheme', 'dark');
    const escuro = await backgroundColor(page);
    expect(escuro).not.toBe(claro);
    expect(luminance(escuro)).toBeLessThan(luminance(claro));
  });

  test('a escolha sobrevive ao recarregamento', async ({page}) => {
    await page.goto('/login');
    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('tuiTheme', 'dark');

    await page.reload();

    await expect(page.locator('html')).toHaveAttribute('tuiTheme', 'dark');
    expect(await page.evaluate(() => localStorage.getItem('event-access-theme'))).toBe('dark');
  });

  test('o painel administrativo alterna e volta ao tema claro', async ({organizer}) => {
    await organizer.goto('/dashboard');

    const toggle = organizer.getByTestId('theme-toggle');
    await toggle.click();
    await expect(organizer.locator('html')).toHaveAttribute('tuiTheme', 'dark');
    const escuro = await backgroundColor(organizer);

    await toggle.click();
    await expect(organizer.locator('html')).not.toHaveAttribute('tuiTheme', 'dark');
    const claro = await backgroundColor(organizer);

    expect(luminance(claro)).toBeGreaterThan(luminance(escuro));
  });
});

async function backgroundColor(page: import('@playwright/test').Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** Luminância aproximada de uma cor `rgb(...)`, suficiente para comparar temas. */
function luminance(color: string): number {
  const parts = color.match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) ?? [0, 0, 0];
  const [red, green, blue] = parts;
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
