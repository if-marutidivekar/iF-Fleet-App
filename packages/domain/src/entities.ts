import type {
  UserRole,
  UserStatus,
  VehicleStatus,
  VehicleType,
  VehicleOwnership,
  BookingStatus,
  TransportType,
  AssignmentDecision,
  TripStatus,
  LocationSource,
  NotificationChannel,
  NotificationDeliveryState,
  AuditAction,
} from './enums';

// ─── User ─────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  employeeId: string;
  name: string;
  email: string;           // must be company domain
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;        // soft-delete
}

// ─── Driver Profile ───────────────────────────────────────────────────────────

export interface DriverProfile {
  id: string;
  userId: string;
  licenseNumber: string;
  licenseExpiry: Date;
  shiftReady: boolean;     // admin-controlled readiness flag
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;        // soft-delete preserves referential history
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export interface Vehicle {
  id: string;
  vehicleNo: string;       // registration number
  type: VehicleType;
  make?: string;
  model?: string;
  year?: number;
  capacity: number;        // passenger seats
  ownership: VehicleOwnership;
  status: VehicleStatus;
  maintenanceDueAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;        // soft-delete
}

// ─── Pre-fed Location ─────────────────────────────────────────────────────────

/** Admin-maintained list of known origins/destinations shown in the booking flow */
export interface PresetLocation {
  id: string;
  name: string;            // e.g. "Head Office", "Warehouse B", "Site Alpha"
  address: string;
  latitude?: number;
  longitude?: number;
  isActive: boolean;
  createdAt: Date;
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export interface BookingLocation {
  presetLocationId?: string; // set when chosen from pre-fed list
  customAddress?: string;    // set when user selects "Other"
  label?: string;            // display name (resolved from preset or user-typed)
  latitude?: number;
  longitude?: number;
}

export interface Booking {
  id: string;
  requesterId: string;
  transportType: TransportType;
  passengerCount?: number;
  materialDescription?: string;
  pickup: BookingLocation;
  dropoff: BookingLocation;
  requestedAt: Date;        // desired departure time
  status: BookingStatus;
  approvedById?: string;
  approvalNote?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export interface Assignment {
  id: string;
  bookingId: string;
  vehicleId: string;
  driverId: string;        // references DriverProfile.id
  assignedById: string;    // admin user
  assignedAt: Date;
  decision: AssignmentDecision;
  decisionAt?: Date;
  declineReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

export interface Trip {
  id: string;
  bookingId: string;
  assignmentId: string;
  status: TripStatus;
  odometerStart?: number;  // km
  odometerEnd?: number;    // km
  actualStartAt?: Date;
  actualEndAt?: Date;
  remarks?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Location Log ─────────────────────────────────────────────────────────────

export interface LocationLog {
  id: string;
  tripId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;       // meters
  source: LocationSource;
  capturedAt: Date;        // when GPS was sampled on device
  syncedAt: Date;          // when server received the record
}

// ─── Fuel Log ─────────────────────────────────────────────────────────────────

export interface FuelLog {
  id: string;
  tripId: string;
  vehicleId: string;
  fuelVolume: number;      // litres
  fuelCost?: number;       // currency units
  odometerAtRefuel: number; // km
  receiptRef?: string;
  recordedById: string;
  recordedAt: Date;
  createdAt: Date;
}

// ─── Notification ─────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  recipientId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  payload?: Record<string, unknown>;
  deliveryState: NotificationDeliveryState;
  readAt?: Date;
  createdAt: Date;
}

// ─── Audit Log ────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  actorId: string;
  action: AuditAction;
  entityType: string;      // e.g. "Booking", "Vehicle"
  entityId: string;
  before?: Record<string, unknown>; // snapshot before change
  after?: Record<string, unknown>;  // snapshot after change
  metadata?: Record<string, unknown>;
  createdAt: Date;         // append-only; never updated
}
