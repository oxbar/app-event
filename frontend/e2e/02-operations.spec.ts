import {scenario} from './support/data';
import {expect, loginAs, test} from './support/fixtures';

/**
 * Roteiro passo 3: portaria, membro e vínculo.
 *
 * Este arquivo é feito pela interface de ponta a ponta porque o vínculo
 * funcionário-portaria é pré-requisito do check-in. Se ele quebrar aqui,
 * o 05 falharia com 403 e o motivo real ficaria escondido.
 */
test.describe('Equipe e portarias', () => {
  test('cria portaria, membro e vincula ao evento', async ({organizer, scenarioData}) => {
    await organizer.goto('/operations');
    await selectEvent(organizer, scenarioData.event.name);

    await organizer.locator('#point-name').fill(scenario.accessPointName);
    await organizer.locator('#point-description').fill('Entrada principal da suíte automatizada');
    await organizer.getByRole('button', {name: /adicionar portaria/i}).click();
    await expect(organizer.getByText(scenario.accessPointName).first()).toBeVisible();

    await organizer.locator('#member-name').fill(scenario.doorStaff.name);
    await organizer.locator('#member-email').fill(scenario.doorStaff.email);
    await organizer.locator('#member-password').fill(scenario.doorStaff.password);
    await organizer.getByRole('button', {name: /adicionar membro/i}).click();
    await expect(organizer.getByText(scenario.doorStaff.email).first()).toBeVisible();

    await organizer.getByRole('button', {name: /vincular funcionário/i}).click();
    await expect(organizer.getByText(scenario.doorStaff.name).first()).toBeVisible();
  });

  test('o operador criado consegue entrar', async ({page}) => {
    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await expect(page.getByRole('link', {name: /portaria/i})).toBeVisible();
  });

  test('cria convite de cortesia', async ({organizer, scenarioData}) => {
    await organizer.goto('/operations');
    await selectEvent(organizer, scenarioData.event.name);

    await organizer.locator('#invitation-name').fill('Convidado E2E');
    await organizer.locator('#invitation-email').fill(`convidado.${Date.now()}@example.com`);
    await organizer.locator('#invitation-phone').fill('(47) 99999-1234');
    await organizer.getByRole('button', {name: /criar convite/i}).click();

    await expect(organizer.getByText(/INV-/).first()).toBeVisible();
  });
});

async function selectEvent(page: import('@playwright/test').Page, eventName: string): Promise<void> {
  const selector = page.locator('select').first();
  await selector.selectOption({label: eventName});
}
