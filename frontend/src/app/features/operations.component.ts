import {ChangeDetectionStrategy, Component, computed, inject, signal} from '@angular/core';
import {FormBuilder, FormControl, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {apiErrorMessage} from '../core/api-error';
import {CheckinApi, EventApi, InvitationApi, OrganizationApi} from '../core/api.services';
import {
  AccessPoint,
  EventModel,
  Invitation,
  Member,
  Organization,
  StaffAssignment,
  TicketType,
} from '../core/models';
import {DisplayLabelPipe} from '../shared/display-label.pipe';
import {FormErrorComponent} from '../shared/form-error.component';
import {InputMaskDirective} from '../shared/input-mask.directive';
import {SelectFieldComponent, SelectOption} from '../shared/select-field.component';
import {brazilianPhoneValidator, strongPasswordValidator} from '../shared/validators';

@Component({
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TuiButton,
    TuiInput,
    SelectFieldComponent,
    DisplayLabelPipe,
    FormErrorComponent,
    InputMaskDirective,
  ],
  template: `
    <div class="page-title">
      <div><h1>Equipe, portarias e convites</h1><p>Configuração operacional por evento.</p></div>
    </div>

    @if (error()) {<section class="error-panel" role="alert">{{error()}}</section>}

    <section class="panel operations-selector">
      <label for="operations-event">Evento</label>
      <app-select-field
        [control]="eventControl"
        [options]="eventOptions()"
        placeholder="Selecione o evento"
        ariaLabel="Evento"
        inputId="operations-event"
      />
    </section>

    <section class="operations-grid">
      <article class="panel">
        <h2>Portarias</h2>
        <form class="stack" [formGroup]="pointForm" (ngSubmit)="createPoint()" novalidate>
          <div class="form-field">
            <label for="point-name">Nome da portaria</label>
            <tui-textfield><input id="point-name" tuiInput placeholder="Ex.: Entrada principal" formControlName="name" /></tui-textfield>
            <app-form-error [control]="pointForm.controls.name" label="Nome da portaria" />
          </div>
          <div class="form-field">
            <label for="point-description">Descrição</label>
            <tui-textfield><input id="point-description" tuiInput placeholder="Ex.: Acesso comum" formControlName="description" /></tui-textfield>
          </div>
          <button tuiButton type="submit" [disabled]="!eventId()">Adicionar portaria</button>
        </form>
        <div class="simple-list">
          @for (point of points(); track point.id) {
            <div><strong>{{point.name}}</strong><small>{{point.description || 'Sem descrição'}} · {{point.status | displayLabel}}</small></div>
          } @empty {
            <p class="empty-small">Nenhuma portaria cadastrada.</p>
          }
        </div>
      </article>

      <article class="panel">
        <h2>Membros da organização</h2>
        <form class="stack" [formGroup]="memberForm" (ngSubmit)="createMember()" novalidate>
          <div class="form-field">
            <label for="member-name">Nome</label>
            <tui-textfield><input id="member-name" tuiInput placeholder="Nome completo" formControlName="name" /></tui-textfield>
            <app-form-error [control]="memberForm.controls.name" label="Nome" />
          </div>
          <div class="form-field">
            <label for="member-email">E-mail</label>
            <tui-textfield><input id="member-email" tuiInput type="email" placeholder="nome@empresa.com" formControlName="email" /></tui-textfield>
            <app-form-error [control]="memberForm.controls.email" label="E-mail" />
          </div>
          <div class="form-field">
            <label for="member-password">Senha temporária</label>
            <tui-textfield><input id="member-password" tuiInput type="password" placeholder="Mínimo de 8 caracteres" formControlName="temporaryPassword" /></tui-textfield>
            <app-form-error [control]="memberForm.controls.temporaryPassword" label="Senha temporária" />
          </div>
          <div class="form-field">
            <label for="member-role">Perfil de acesso</label>
            <app-select-field
              [control]="memberForm.controls.role"
              [options]="memberRoleOptions"
              placeholder="Selecione o perfil"
              ariaLabel="Perfil de acesso"
              inputId="member-role"
            />
            <app-form-error [control]="memberForm.controls.role" label="Perfil de acesso" />
            <p class="form-hint">Administradores podem gerenciar a organização. A equipe de portaria acessa somente o controle de entrada.</p>
          </div>
          <button tuiButton type="submit" [disabled]="!organizationId()">Adicionar membro</button>
        </form>
        <div class="simple-list">
          @for (member of members(); track member.id) {
            <div><strong>{{member.name}}</strong><small>{{member.email}} · {{member.role | displayLabel}} · {{member.status | displayLabel}}</small></div>
          } @empty {
            <p class="empty-small">Nenhum membro cadastrado.</p>
          }
        </div>
      </article>

      <article class="panel">
        <h2>Funcionários do evento</h2>
        <form class="stack" [formGroup]="staffForm" (ngSubmit)="createStaff()" novalidate>
          <div class="form-field">
            <label for="staff-user">Membro</label>
            <app-select-field
              [control]="staffForm.controls.userId"
              [options]="memberOptions()"
              placeholder="Selecione o membro"
              ariaLabel="Membro"
              inputId="staff-user"
            />
            <app-form-error [control]="staffForm.controls.userId" label="Membro" />
          </div>
          <div class="form-field">
            <label for="staff-point">Portaria autorizada</label>
            <app-select-field
              [control]="staffForm.controls.accessPointId"
              [options]="accessPointOptions()"
              placeholder="Todas as portarias"
              ariaLabel="Portaria autorizada"
              inputId="staff-point"
            />
          </div>
          <button tuiButton type="submit" [disabled]="!eventId()">Vincular funcionário</button>
        </form>
        <div class="simple-list">
          @for (assignment of staff(); track assignment.id) {
            <div><strong>{{assignment.userName}}</strong><small>{{assignment.accessPointName || 'Todas as portarias'}} · {{assignment.role | displayLabel}} · {{assignment.status | displayLabel}}</small></div>
          } @empty {
            <p class="empty-small">Nenhum funcionário vinculado.</p>
          }
        </div>
      </article>

      <article class="panel">
        <h2>Convites</h2>
        <form class="stack" [formGroup]="invitationForm" (ngSubmit)="createInvitation()" novalidate>
          <div class="form-field">
            <label for="invitation-ticket">Tipo de ingresso</label>
            <app-select-field
              [control]="invitationForm.controls.ticketTypeId"
              [options]="ticketTypeOptions()"
              placeholder="Selecione o ingresso"
              ariaLabel="Tipo de ingresso"
              inputId="invitation-ticket"
            />
            <app-form-error [control]="invitationForm.controls.ticketTypeId" label="Tipo de ingresso" />
          </div>
          <div class="form-field">
            <label for="invitation-name">Nome do convidado</label>
            <tui-textfield><input id="invitation-name" tuiInput placeholder="Nome completo" formControlName="name" /></tui-textfield>
            <app-form-error [control]="invitationForm.controls.name" label="Nome do convidado" />
          </div>
          <div class="form-field">
            <label for="invitation-email">E-mail</label>
            <tui-textfield><input id="invitation-email" tuiInput type="email" placeholder="convidado@email.com" formControlName="email" /></tui-textfield>
            <app-form-error [control]="invitationForm.controls.email" label="E-mail" />
          </div>
          <div class="form-field">
            <label for="invitation-phone">Telefone</label>
            <tui-textfield>
              <input id="invitation-phone" tuiInput inputmode="tel" placeholder="(47) 99999-9999" appInputMask="phone" formControlName="phone" />
            </tui-textfield>
            <app-form-error [control]="invitationForm.controls.phone" label="Telefone" />
          </div>
          <button tuiButton type="submit" [disabled]="!eventId()">Criar convite</button>
        </form>
        <div class="simple-list">
          @for (invitation of invitations(); track invitation.id) {
            <div>
              <strong>{{invitation.attendeeName}}</strong>
              <small>{{invitation.ticketType}} · {{invitation.status | displayLabel}} · {{invitation.code}}</small>
            </div>
          } @empty {
            <p class="empty-small">Nenhum convite criado.</p>
          }
        </div>
      </article>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsComponent {
  private readonly eventApi = inject(EventApi);
  private readonly invitationApi = inject(InvitationApi);
  private readonly organizationApi = inject(OrganizationApi);
  private readonly checkinApi = inject(CheckinApi);
  private readonly formBuilder = inject(FormBuilder);

  readonly events = signal<EventModel[]>([]);
  readonly organizations = signal<Organization[]>([]);
  readonly members = signal<Member[]>([]);
  readonly points = signal<AccessPoint[]>([]);
  readonly staff = signal<StaffAssignment[]>([]);
  readonly invitations = signal<Invitation[]>([]);
  readonly ticketTypes = signal<TicketType[]>([]);
  readonly eventId = signal('');
  readonly eventControl = new FormControl('', {nonNullable: true});
  readonly error = signal('');
  readonly organizationId = signal('');

  readonly memberRoleOptions: readonly SelectOption[] = [
    {value: 'ORGANIZER_ADMIN', label: 'Administrador da organização'},
    {value: 'EVENT_MANAGER', label: 'Gestor de evento'},
    {value: 'DOOR_STAFF', label: 'Equipe de portaria'},
    {value: 'FINANCE', label: 'Financeiro'},
    {value: 'VIEWER', label: 'Somente leitura'},
  ];

  readonly eventOptions = computed<readonly SelectOption[]>(() =>
    this.events().map(event => ({value: event.id, label: event.name})),
  );
  readonly memberOptions = computed<readonly SelectOption[]>(() => [
    {value: '', label: 'Selecione o membro'},
    ...this.members().map(member => ({
      value: member.userId,
      label: `${member.name} · ${this.roleLabel(member.role)}`,
    })),
  ]);
  readonly accessPointOptions = computed<readonly SelectOption[]>(() => [
    {value: '', label: 'Todas as portarias'},
    ...this.points().map(point => ({value: point.id, label: point.name})),
  ]);
  readonly ticketTypeOptions = computed<readonly SelectOption[]>(() => [
    {value: '', label: 'Selecione o ingresso'},
    ...this.ticketTypes().map(type => ({value: type.id, label: `${type.name} · ${type.category}`})),
  ]);

  readonly pointForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(100)]],
    description: ['', Validators.maxLength(300)],
  });
  readonly memberForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    temporaryPassword: ['', [Validators.required, Validators.minLength(8), strongPasswordValidator]],
    role: ['DOOR_STAFF', Validators.required],
  });
  readonly staffForm = this.formBuilder.nonNullable.group({
    userId: ['', Validators.required],
    accessPointId: [''],
    role: ['DOOR_STAFF', Validators.required],
  });
  readonly invitationForm = this.formBuilder.nonNullable.group({
    ticketTypeId: ['', Validators.required],
    name: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    phone: ['', [Validators.required, brazilianPhoneValidator]],
  });

  constructor() {
    this.eventControl.valueChanges.subscribe(eventId => {
      if (eventId) this.selectEvent(eventId);
    });
    this.organizationApi.list().subscribe({
      next: page => {
        this.organizations.set(page.content);
        const organizationId = page.content[0]?.id ?? '';
        this.organizationId.set(organizationId);
        if (organizationId) this.loadMembers();
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar as organizações.')),
    });
    this.eventApi.list(0, 100).subscribe({
      next: page => {
        this.events.set(page.content);
        this.eventControl.setValue(page.content[0]?.id ?? '');
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os eventos.')),
    });
  }

  selectEvent(eventId: string): void {
    this.eventId.set(eventId);
    this.error.set('');
    this.checkinApi.points(eventId).subscribe({
      next: value => this.points.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar as portarias.')),
    });
    this.organizationApi.staff(eventId).subscribe({
      next: value => this.staff.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os funcionários.')),
    });
    this.invitationApi.list(eventId).subscribe({
      next: value => this.invitations.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os convites.')),
    });
    this.eventApi.types(eventId).subscribe({
      next: value => this.ticketTypes.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os tipos de ingresso.')),
    });
  }

  loadMembers(): void {
    this.organizationApi.members(this.organizationId()).subscribe({
      next: value => this.members.set(value),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível carregar os membros.')),
    });
  }

  private roleLabel(role: string): string {
    return this.memberRoleOptions.find(option => option.value === role)?.label ?? role;
  }

  createPoint(): void {
    if (this.pointForm.invalid || !this.eventId()) {
      this.pointForm.markAllAsTouched();
      return;
    }
    this.organizationApi.addAccessPoint(this.eventId(), this.pointForm.getRawValue()).subscribe({
      next: () => {
        this.pointForm.reset({name: '', description: ''});
        this.selectEvent(this.eventId());
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível adicionar a portaria.')),
    });
  }

  createMember(): void {
    if (this.memberForm.invalid || !this.organizationId()) {
      this.memberForm.markAllAsTouched();
      return;
    }
    this.organizationApi.addMember(this.organizationId(), this.memberForm.getRawValue()).subscribe({
      next: () => {
        this.memberForm.reset({name: '', email: '', temporaryPassword: '', role: 'DOOR_STAFF'});
        this.loadMembers();
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível adicionar o membro.')),
    });
  }

  createStaff(): void {
    if (this.staffForm.invalid || !this.eventId()) {
      this.staffForm.markAllAsTouched();
      return;
    }
    const value = this.staffForm.getRawValue();
    this.organizationApi.addStaff(this.eventId(), {
      userId: value.userId,
      accessPointId: value.accessPointId || null,
      role: value.role,
    }).subscribe({
      next: () => this.selectEvent(this.eventId()),
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível vincular o funcionário.')),
    });
  }

  createInvitation(): void {
    if (this.invitationForm.invalid || !this.eventId()) {
      this.invitationForm.markAllAsTouched();
      return;
    }
    this.invitationApi.create(this.eventId(), this.invitationForm.getRawValue()).subscribe({
      next: () => {
        this.invitationForm.reset({ticketTypeId: '', name: '', email: '', phone: ''});
        this.selectEvent(this.eventId());
      },
      error: error => this.error.set(apiErrorMessage(error, 'Não foi possível criar o convite.')),
    });
  }
}
