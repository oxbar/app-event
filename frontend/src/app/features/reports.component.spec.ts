import {provideHttpClient} from '@angular/common/http';
import {HttpTestingController, provideHttpClientTesting} from '@angular/common/http/testing';
import {ComponentFixture, TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {ReportsComponent} from './reports.component';

describe('ReportsComponent', () => {
  const EVENT_ID = '2f6d0d0e-1111-4a2b-9c3d-000000000001';
  let fixture: ComponentFixture<ReportsComponent>;
  let component: ReportsComponent;
  let http: HttpTestingController;

  const summary = {
    eventId: EVENT_ID,
    eventName: 'Festival Aurora',
    eventSlug: 'festival-aurora',
    eventStatus: 'PUBLISHED',
    totalOrders: 2,
    paidOrders: 1,
    grossAmount: 200,
    serviceFees: 20,
    discounts: 0,
    totalAmount: 220,
    issuedTickets: 2,
    usedTickets: 1,
    blockedTickets: 0,
    totalCheckins: 2,
    approvedCheckins: 1,
    deniedCheckins: 1,
    attendanceRate: 0.5,
    ticketTypes: [
      {
        ticketTypeId: 'tipo-1',
        name: 'Pista',
        category: 'COMUM',
        price: 100,
        serviceFee: 10,
        totalQuantity: 200,
        soldQuantity: 2,
        reservedQuantity: 1,
        availableQuantity: 197,
        issuedTickets: 2,
        usedTickets: 1,
        revenue: 220,
      },
    ],
    generatedAt: '2026-08-16T02:00:00Z',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');

    fixture = TestBed.createComponent(ReportsComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();

    http.expectOne(request => request.url === '/api/events')
      .flush({content: [{id: EVENT_ID, name: 'Festival Aurora'}], totalElements: 1, number: 0, size: 20});
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function flushSummary(): void {
    http.expectOne(`/api/events/${EVENT_ID}/reports/summary`).flush(summary);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('carrega os números do primeiro evento e mostra os cartões', () => {
    flushSummary();

    expect(component.summary()?.eventName).toBe('Festival Aurora');
    expect(text()).toContain('Comparecimento');
    expect(text()).toContain('50%');
    expect(text()).toContain('Pista');
  });

  it('a falha no resumo não impede a exportação', () => {
    http.expectOne(`/api/events/${EVENT_ID}/reports/summary`)
      .flush({message: 'Falhou'}, {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();

    expect(component.summary()).toBeNull();
    expect(component.busy()).toBeFalse();
    expect(text()).toContain('Falhou');
  });

  it('baixa a pasta completa usando o nome enviado pelo servidor', () => {
    flushSummary();

    component.workbook('workbook');

    const request = http.expectOne(`/api/events/${EVENT_ID}/reports/workbook.xlsx`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['planilha']), {
      headers: {'Content-Disposition': 'attachment; filename="relatorio-festival-aurora-20260815-2200.xlsx"'},
    });
    fixture.detectChanges();

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(component.status()).toContain('relatorio-festival-aurora-20260815-2200.xlsx');
  });

  it('exporta vendas e entradas em planilha separada', () => {
    flushSummary();

    component.workbook('sales');
    http.expectOne(`/api/events/${EVENT_ID}/reports/sales.xlsx`).flush(new Blob(['x']));

    component.workbook('checkins');
    http.expectOne(`/api/events/${EVENT_ID}/reports/checkins.xlsx`).flush(new Blob(['x']));

    expect(component.busy()).toBeFalse();
  });

  it('mantém a exportação CSV existente', () => {
    flushSummary();

    component.download('sales');

    const request = http.expectOne(`/api/events/${EVENT_ID}/reports/sales`);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob(['pedido,status\n']));

    expect(component.status()).toContain('vendas');
  });

  it('avisa quando a geração da planilha falha', () => {
    flushSummary();

    component.workbook('workbook');
    http.expectOne(`/api/events/${EVENT_ID}/reports/workbook.xlsx`)
      .flush(null, {status: 500, statusText: 'Server Error'});
    fixture.detectChanges();

    expect(component.busy()).toBeFalse();
    expect(text()).toContain('Não foi possível gerar o relatório.');
  });

  it('recarrega os números ao trocar de evento', () => {
    flushSummary();
    const other = '2f6d0d0e-1111-4a2b-9c3d-000000000002';

    component.eventControl.setValue(other);

    http.expectOne(`/api/events/${other}/reports/summary`).flush({...summary, eventId: other});
    expect(component.summary()?.eventId).toBe(other);
  });
});
