import {inject, Injectable} from '@angular/core';
import {HttpClient, HttpParams} from '@angular/common/http';
import {
  AccessPoint,
  AdminRow,
  CheckinResult,
  DashboardSummary,
  EventModel,
  Invitation,
  Member,
  Order,
  Organization,
  Page,
  Payment,
  PublicEvent,
  ReportSummary,
  StaffAssignment,
  Ticket,
  TicketType,
} from './models';

@Injectable({providedIn: 'root'})
export class EventApi {
  private readonly http = inject(HttpClient);

  list(page = 0, size = 20) {
    return this.http.get<Page<EventModel>>('/api/events', {params: {page, size}});
  }

  get(id: string) {
    return this.http.get<EventModel>(`/api/events/${id}`);
  }

  create(value: Partial<EventModel>) {
    return this.http.post<EventModel>('/api/events', value);
  }

  update(id: string, value: Partial<EventModel>) {
    return this.http.put<EventModel>(`/api/events/${id}`, value);
  }

  publish(id: string) {
    return this.http.post<EventModel>(`/api/events/${id}/publish`, {});
  }

  cancel(id: string) {
    return this.http.post<EventModel>(`/api/events/${id}/cancel`, {});
  }

  types(id: string) {
    return this.http.get<TicketType[]>(`/api/events/${id}/ticket-types`);
  }

  createType(id: string, value: Partial<TicketType>) {
    return this.http.post<TicketType>(`/api/events/${id}/ticket-types`, value);
  }

  public(slug: string) {
    return this.http.get<PublicEvent>(`/api/public/events/${slug}`);
  }
}

@Injectable({providedIn: 'root'})
export class CheckoutApi {
  private readonly http = inject(HttpClient);

  checkout(eventId: string, payload: unknown) {
    return this.http.post<Order>(`/api/public/events/${eventId}/checkout`, payload);
  }

  pix(code: string) {
    return this.http.post<Payment>(`/api/public/orders/${code}/payments/pix`, {});
  }

  status(code: string) {
    return this.http.get<Order>(`/api/public/orders/${code}/payment-status`);
  }

  ticket(token: string) {
    return this.http.get<Ticket>(`/api/public/tickets/${encodeURIComponent(token)}`);
  }

  approveFake(id: string) {
    return this.http.post<Order>(`/api/dev/payments/${id}/approve`, {});
  }

  synchronizePayment(id: string) {
    return this.http.post<Order>(`/api/dev/payments/${id}/synchronize`, {});
  }
}

@Injectable({providedIn: 'root'})
export class DashboardApi {
  private readonly http = inject(HttpClient);
  summary() {
    return this.http.get<DashboardSummary>('/api/dashboard/summary');
  }
}

@Injectable({providedIn: 'root'})
export class CheckinApi {
  private readonly http = inject(HttpClient);

  points(eventId: string) {
    return this.http.get<AccessPoint[]>(`/api/events/${eventId}/access-points`);
  }

  scan(eventId: string, token: string, accessPointId: string) {
    return this.submit(eventId, 'scan', token, accessPointId);
  }

  manual(eventId: string, token: string, accessPointId: string) {
    return this.submit(eventId, 'manual', token, accessPointId);
  }

  private submit(eventId: string, mode: 'scan' | 'manual', token: string, accessPointId: string) {
    return this.http.post<CheckinResult>(`/api/events/${eventId}/checkins/${mode}`, {
      token,
      accessPointId,
      deviceIdentifier: navigator.userAgent,
    });
  }
}

export type AdminKind = 'orders' | 'payments' | 'tickets' | 'attendees' | 'audit' | 'refunds';

@Injectable({providedIn: 'root'})
export class AdminApi {
  private readonly http = inject(HttpClient);

  list(kind: AdminKind, page = 0, size = 20) {
    return this.http.get<Page<AdminRow>>(`/api/${kind}`, {params: {page, size}});
  }

  blockTicket(id: string, reason: string) {
    return this.http.post<AdminRow>(`/api/tickets/${id}/block`, {reason});
  }

  unblockTicket(id: string) {
    return this.http.post<AdminRow>(`/api/tickets/${id}/unblock`, {});
  }

  resendTicket(id: string) {
    return this.http.post<AdminRow>(`/api/tickets/${id}/resend`, {});
  }

  refund(paymentId: string, amount: number, reason: string) {
    return this.http.post<AdminRow>(`/api/payments/${paymentId}/refund`, {amount, reason});
  }

  downloadReport(eventId: string, type: 'sales' | 'checkins') {
    return this.http.get(`/api/events/${eventId}/reports/${type}`, {responseType: 'blob'});
  }

  /**
   * Planilha XLSX. `workbook` traz resumo, vendas, ingressos e entradas em abas
   * separadas; os demais valores exportam um assunto por arquivo.
   */
  downloadWorkbook(eventId: string, type: 'sales' | 'checkins' | 'workbook') {
    return this.http.get(`/api/events/${eventId}/reports/${type}.xlsx`, {
      responseType: 'blob',
      observe: 'response',
    });
  }

  reportSummary(eventId: string) {
    return this.http.get<ReportSummary>(`/api/events/${eventId}/reports/summary`);
  }
}

@Injectable({providedIn: 'root'})
export class InvitationApi {
  private readonly http = inject(HttpClient);

  list(eventId: string) {
    return this.http.get<Invitation[]>(`/api/events/${eventId}/invitations`);
  }

  create(eventId: string, payload: unknown) {
    return this.http.post<Invitation>(`/api/events/${eventId}/invitations`, payload);
  }
}

@Injectable({providedIn: 'root'})
export class OrganizationApi {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Page<Organization>>('/api/organizations');
  }

  members(organizationId: string) {
    return this.http.get<Member[]>(`/api/organizations/${organizationId}/members`);
  }

  addMember(organizationId: string, payload: unknown) {
    return this.http.post<Member>(`/api/organizations/${organizationId}/members`, payload);
  }

  staff(eventId: string) {
    return this.http.get<StaffAssignment[]>(`/api/events/${eventId}/staff`);
  }

  addStaff(eventId: string, payload: unknown) {
    return this.http.post<StaffAssignment>(`/api/events/${eventId}/staff`, payload);
  }

  addAccessPoint(eventId: string, payload: unknown) {
    return this.http.post<AccessPoint>(`/api/events/${eventId}/access-points`, payload);
  }
}
