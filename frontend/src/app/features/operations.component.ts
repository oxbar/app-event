import {ChangeDetectionStrategy, Component, inject, signal} from '@angular/core';
import {FormBuilder, ReactiveFormsModule, Validators} from '@angular/forms';
import {TuiButton, TuiInput} from '@taiga-ui/core';
import {TuiSelect} from '@taiga-ui/kit';
import {EventApi, InvitationApi, OrganizationApi, CheckinApi} from '../core/api.services';
import {
  AccessPoint,
  EventModel,
  Invitation,
  Member,
  Organization,
  StaffAssignment,
  TicketType,
} from '../core/models';

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, TuiButton, TuiInput, TuiSelect],
  template: `
    <div class="page-title">
      <div><h1>Equipe, portarias e convites</h1><p>Configuração operacional por evento.</p></div>
    </div>

    <section class="panel operations-selector">
      <label>Evento</label>
      <tui-textfield>
        <select tuiSelect [value]="eventId()" (change)="selectEvent($any($event.target).value)">
          @for (event of events(); track event.id) {
            <option [value]="event.id">{{event.name}}</option>
          }
        </select>
      </tui-textfield>
    </section>

    <section class="operations-grid">
      <article class="panel">
        <h2>Portarias</h2>
        <form class="stack" [formGroup]="pointForm" (ngSubmit)="createPoint()">
          <tui-textfield><input tuiInput placeholder="Nome da portaria" formControlName="name" /></tui-textfield>
          <tui-textfield><input tuiInput placeholder="Descrição" formControlName="description" /></tui-textfield>
          <button tuiButton type="submit" [disabled]="pointForm.invalid || !eventId()">Adicionar portaria</button>
        </form>
        <div class="simple-list">
          @for (point of points(); track point.id) {
            <div><strong>{{point.name}}</strong><small>{{point.description}} · {{point.status}}</small></div>
          } @empty {
            <p class="empty-small">Nenhuma portaria cadastrada.</p>
          }
        </div>
      </article>

      <article class="panel">
        <h2>Membros da organização</h2>
        <form class="stack" [formGroup]="memberForm" (ngSubmit)="createMember()">
          <tui-textfield><input tuiInput placeholder="Nome" formControlName="name" /></tui-textfield>
          <tui-textfield><input tuiInput type="email" placeholder="E-mail" formControlName="email" /></tui-textfield>
          <tui-textfield><input tuiInput type="password" placeholder="Senha temporária" formControlName="temporaryPassword" /></tui-textfield>
          <tui-textfield>
            <select tuiSelect formControlName="role">
              <option value="EVENT_MANAGER">Gestor de evento</option>
              <option value="DOOR_STAFF">Portaria</option>
              <option value="FINANCE">Financeiro</option>
              <option value="VIEWER">Visualização</option>
            </select>
          </tui-textfield>
          <button tuiButton type="submit" [disabled]="memberForm.invalid || !organizationId()">Adicionar membro</button>
        </form>
        <div class="simple-list">
          @for (member of members(); track member.id) {
            <div><strong>{{member.name}}</strong><small>{{member.email}} · {{member.role}}</small></div>
          }
        </div>
      </article>

      <article class="panel">
        <h2>Funcionários do evento</h2>
        <form class="stack" [formGroup]="staffForm" (ngSubmit)="createStaff()">
          <tui-textfield>
            <select tuiSelect formControlName="userId">
              <option value="">Selecione o membro</option>
              @for (member of members(); track member.userId) {
                <option [value]="member.userId">{{member.name}} · {{member.role}}</option>
              }
            </select>
          </tui-textfield>
          <tui-textfield>
            <select tuiSelect formControlName="accessPointId">
              <option value="">Todas as portarias</option>
              @for (point of points(); track point.id) {
                <option [value]="point.id">{{point.name}}</option>
              }
            </select>
          </tui-textfield>
          <button tuiButton type="submit" [disabled]="staffForm.invalid || !eventId()">Vincular funcionário</button>
        </form>
        <div class="simple-list">
          @for (assignment of staff(); track assignment.id) {
            <div><strong>{{assignment.userName}}</strong><small>{{assignment.accessPointName || 'Todas as portarias'}} · {{assignment.role}}</small></div>
          }
        </div>
      </article>

      <article class="panel">
        <h2>Convites</h2>
        <form class="stack" [formGroup]="invitationForm" (ngSubmit)="createInvitation()">
          <tui-textfield>
            <select tuiSelect formControlName="ticketTypeId">
              <option value="">Selecione o ingresso</option>
              @for (ticketType of ticketTypes(); track ticketType.id) {
                <option [value]="ticketType.id">{{ticketType.name}}</option>
              }
            </select>
          </tui-textfield>
          <tui-textfield><input tuiInput placeholder="Nome do convidado" formControlName="name" /></tui-textfield>
          <tui-textfield><input tuiInput type="email" placeholder="E-mail" formControlName="email" /></tui-textfield>
          <button tuiButton type="submit" [disabled]="invitationForm.invalid || !eventId()">Criar convite</button>
        </form>
        <div class="simple-list">
          @for (invitation of invitations(); track invitation.id) {
            <div>
              <strong>{{invitation.attendeeName}}</strong>
              <small>{{invitation.ticketType}} · {{invitation.status}} · {{invitation.code}}</small>
            </div>
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
  readonly organizationId = signal('');

  readonly pointForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
  });
  readonly memberForm = this.formBuilder.nonNullable.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    temporaryPassword: ['', [Validators.required, Validators.minLength(8)]],
    role: ['DOOR_STAFF', Validators.required],
  });
  readonly staffForm = this.formBuilder.nonNullable.group({
    userId: ['', Validators.required],
    accessPointId: [''],
    role: ['DOOR_STAFF', Validators.required],
  });
  readonly invitationForm = this.formBuilder.nonNullable.group({
    ticketTypeId: ['', Validators.required],
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  constructor() {
    this.organizationApi.list().subscribe(page => {
      this.organizations.set(page.content);
      const organizationId = page.content[0]?.id ?? '';
      this.organizationId.set(organizationId);
      if (organizationId) this.loadMembers();
    });
    this.eventApi.list(0, 100).subscribe(page => {
      this.events.set(page.content);
      const eventId = page.content[0]?.id ?? '';
      if (eventId) this.selectEvent(eventId);
    });
  }

  selectEvent(eventId: string): void {
    this.eventId.set(eventId);
    this.checkinApi.points(eventId).subscribe(value => this.points.set(value));
    this.organizationApi.staff(eventId).subscribe(value => this.staff.set(value));
    this.invitationApi.list(eventId).subscribe(value => this.invitations.set(value));
    this.eventApi.types(eventId).subscribe(value => this.ticketTypes.set(value));
  }

  loadMembers(): void {
    this.organizationApi.members(this.organizationId()).subscribe(value => this.members.set(value));
  }

  createPoint(): void {
    if (this.pointForm.invalid || !this.eventId()) return;
    this.organizationApi.addAccessPoint(this.eventId(), this.pointForm.getRawValue()).subscribe(() => {
      this.pointForm.reset({name: '', description: ''});
      this.selectEvent(this.eventId());
    });
  }

  createMember(): void {
    if (this.memberForm.invalid || !this.organizationId()) return;
    this.organizationApi.addMember(this.organizationId(), this.memberForm.getRawValue()).subscribe(() => {
      this.memberForm.reset({name: '', email: '', temporaryPassword: '', role: 'DOOR_STAFF'});
      this.loadMembers();
    });
  }

  createStaff(): void {
    if (this.staffForm.invalid || !this.eventId()) return;
    const value = this.staffForm.getRawValue();
    this.organizationApi.addStaff(this.eventId(), {
      userId: value.userId,
      accessPointId: value.accessPointId || null,
      role: value.role,
    }).subscribe(() => this.selectEvent(this.eventId()));
  }

  createInvitation(): void {
    if (this.invitationForm.invalid || !this.eventId()) return;
    this.invitationApi.create(this.eventId(), this.invitationForm.getRawValue()).subscribe(() => {
      this.invitationForm.reset({ticketTypeId: '', name: '', email: '', phone: ''});
      this.selectEvent(this.eventId());
    });
  }
}
