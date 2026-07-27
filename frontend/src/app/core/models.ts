export type Role = 'SUPER_ADMIN' | 'ORGANIZER_ADMIN' | 'EVENT_MANAGER' | 'DOOR_STAFF' | 'FINANCE' | 'VIEWER';

export interface UserSession {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  roles: Role[];
}


export interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserSession;
}

export interface EventModel {
  id: string;
  name: string;
  slug: string;
  description?: string;
  venueName?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  startsAt: string;
  endsAt: string;
  salesStartAt?: string;
  salesEndAt?: string;
  capacity?: number;
  status: string;
  bannerUrl?: string;
  requireDocument: boolean;
}

export interface TicketType {
  id: string;
  eventId: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  serviceFee: number;
  totalQuantity: number;
  soldQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  maxPerOrder: number;
  wristbandLabel?: string;
  wristbandColorName?: string;
  wristbandColorHex?: string;
  status: string;
}

export interface PublicEvent {
  event: EventModel;
  ticketTypes: TicketType[];
}

export interface Payment {
  id: string;
  provider: string;
  paymentMethod: string;
  status: string;
  amount: number;
  currency: string;
  pixCopyPaste: string;
  pixQrCodeUrl: string;
  expiresAt: string;
}

export interface Ticket {
  publicCode: string;
  status: string;
  attendeeName: string;
  ticketType: string;
  wristbandLabel?: string;
  wristbandColorName?: string;
  wristbandColorHex?: string;
  qrValue?: string;
  qrCodeDataUrl?: string;
  checkedInAt?: string;
}

export interface Order {
  publicCode: string;
  status: string;
  subtotal: number;
  serviceFee: number;
  totalAmount: number;
  currency: string;
  expiresAt?: string;
  paidAt?: string;
  payment?: Payment;
  tickets: Ticket[];
}

export interface Page<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface DashboardSummary {
  revenue: number;
  events: number;
  pendingOrders: number;
  issuedTickets: number;
  present: number;
  absent: number;
  duplicateAttempts: number;
}

export interface AccessPoint {
  id: string;
  name: string;
  description?: string;
  status: string;
}

export interface CheckinResult {
  approved: boolean;
  result: string;
  message: string;
  attendeeName?: string;
  ticketType?: string;
  wristbandLabel?: string;
  wristbandColorName?: string;
  wristbandColorHex?: string;
  accessPoint?: string;
  checkedInAt?: string;
}

export interface ApiError {
  timestamp: string;
  status: number;
  code: string;
  message: string;
  fieldErrors: {field: string; message: string}[];
  traceId?: string;
}

export interface AdminRow {
  id: string;
  publicCode?: string;
  orderCode?: string;
  eventName?: string;
  buyerName?: string;
  buyerEmail?: string;
  attendeeName?: string;
  attendeeEmail?: string;
  name?: string;
  email?: string;
  phoneMasked?: string;
  documentMasked?: string;
  typeName?: string;
  provider?: string;
  method?: string;
  status?: string;
  totalAmount?: number;
  amount?: number;
  currency?: string;
  wristbandLabel?: string;
  action?: string;
  entityType?: string;
  entityId?: string;
  reason?: string;
  createdAt?: string;
  requestedAt?: string;
  processedAt?: string;
  paidAt?: string;
  approvedAt?: string;
  checkedInAt?: string;
}

export interface Invitation {
  id: string;
  eventId: string;
  ticketTypeId: string;
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  code: string;
  status: string;
  expiresAt?: string;
  acceptedAt?: string;
  orderCode?: string;
}

export interface Organization {
  id: string;
  name: string;
  legalName?: string;
  documentNumber?: string;
  email?: string;
  phone?: string;
  slug: string;
  status: string;
  primaryColor?: string;
  timezone: string;
}

export interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: Role;
  status: string;
}

export interface StaffAssignment {
  id: string;
  userId: string;
  userName: string;
  email: string;
  accessPointId?: string;
  accessPointName?: string;
  role: Role;
  status: string;
}

export interface ForgotPasswordResult {message: string; developmentToken?: string}
