import {scenario} from './support/data';
import {expect, loginAs, test} from './support/fixtures';
import {selectComboboxOption} from './support/ui';

/** Roteiro passo 3: portaria, membro, vínculo e convite pela interface. */
test.describe('Equipe e portarias', () => {
  test('cria portaria, membro e vincula ao evento', async ({organizer, scenarioData}) => {
    await organizer.goto('/operations');
    await selectComboboxOption(organizer, '#operations-event', scenarioData.event.name);

    const pointPanel = panelByHeading(organizer, 'Portarias');
    await organizer.locator('#point-name').fill(scenario.accessPointName);
    await organizer.locator('#point-description').fill('Entrada principal da suíte automatizada');
    await organizer.getByRole('button', {name: /adicionar portaria/i}).click();
    await expect(pointPanel.getByText(scenario.accessPointName, {exact: true})).toBeVisible();

    const memberPanel = panelByHeading(organizer, 'Membros da organização');
    await organizer.locator('#member-name').fill(scenario.doorStaff.name);
    await organizer.locator('#member-email').fill(scenario.doorStaff.email);
    await organizer.locator('#member-password').fill(scenario.doorStaff.password);
    await organizer.getByRole('button', {name: /adicionar membro/i}).click();
    await expect(memberPanel.getByText(scenario.doorStaff.email, {exact: false})).toBeVisible();

    await selectComboboxOption(
      organizer,
      '#staff-user',
      new RegExp(`^${escapeRegex(scenario.doorStaff.name)}\\s*·`, 'i'),
    );
    await selectComboboxOption(organizer, '#staff-point', scenario.accessPointName);
    await organizer.getByRole('button', {name: /vincular funcionário/i}).click();

    const staffPanel = panelByHeading(organizer, 'Funcionários do evento');
    await expect(staffPanel.getByText(scenario.doorStaff.name, {exact: true})).toBeVisible();
    await expect(staffPanel.getByText(scenario.accessPointName, {exact: false})).toBeVisible();
  });

  test('o operador criado consegue entrar', async ({page, scenarioData}) => {
    // Torna o teste independente: ao executar apenas este caso, o usuário existe.
    await scenarioData.api.ensureMember(scenario.doorStaff);
    await loginAs(page, scenario.doorStaff.email, scenario.doorStaff.password);
    await expect(page.getByRole('link', {name: /portaria/i})).toBeVisible();
  });

  test('cria convite de cortesia', async ({organizer, scenarioData}) => {
    await organizer.goto('/operations');
    await selectComboboxOption(organizer, '#operations-event', scenarioData.event.name);
    await selectComboboxOption(
      organizer,
      '#invitation-ticket',
      new RegExp(`^${escapeRegex(scenarioData.common.name)}\\s*·`, 'i'),
    );

    await organizer.locator('#invitation-name').fill('Convidado E2E');
    await organizer.locator('#invitation-email').fill(`convidado.${Date.now()}@example.com`);
    await organizer.locator('#invitation-phone').fill('(47) 99999-1234');
    await organizer.getByRole('button', {name: /criar convite/i}).click();

    const invitationPanel = panelByHeading(organizer, 'Convites');
    await expect(invitationPanel.getByText(/INV-/).first()).toBeVisible();
  });
});

function panelByHeading(page: import('@playwright/test').Page, heading: string) {
  return page.locator('article').filter({has: page.getByRole('heading', {name: heading, exact: true})});
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
