import {expect, Page} from '@playwright/test';

/**
 * Seleciona uma opção nos campos Taiga UI (tuiSelect).
 * Eles expõem semântica de combobox, mas não são elementos HTML <select>;
 * por isso selectOption() nunca os encontrará.
 */
export async function selectComboboxOption(
  page: Page,
  selector: string,
  optionName: string | RegExp,
): Promise<void> {
  const combobox = page.locator(selector);
  await expect(combobox).toBeVisible();
  await expect(combobox).toBeEnabled();

  const current = await combobox.inputValue();
  if (matches(current, optionName)) return;

  await combobox.click();
  const option = page.getByRole('option', {
    name: optionName,
    exact: typeof optionName === 'string',
  }).first();

  await expect(option).toBeVisible();
  await option.click();
  await expect(combobox).toHaveValue(optionName);
}

function matches(value: string, expected: string | RegExp): boolean {
  if (typeof expected === 'string') return value === expected;
  expected.lastIndex = 0;
  return expected.test(value);
}
