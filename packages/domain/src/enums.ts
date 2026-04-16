// ─── User & Auth ──────────────────────────────────────────────────────────────

export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

/** Admin-controlled driver authentication method. Drivers cannot change their own. */
export enum DriverAuthMethod {
  EMAIL_OTP = 'EMAIL_OTP',
  MOBILE_PIN = 'MOBILE_PIN',
}

// ─── Vehicle ──────────────────────────────────────────────────────────────────

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  ASSIGNED = 'ASSIGNED',
  IN_TRIP = 'IN_TRIP',
  MAINTENANCE = 'MAINTENANCE',
  INACTIVE = 'INACTIVE',
}

export enum VehicleType {
  SEDAN = 'SEDAN',
  SUV = 'SUV',
  VAN = 'VAN',
  TRUCK = 'TRUCK',
  BUS = 'BUS',
}

export enum VehicleOwnership {
  OWNED = 'OWNED',
  LEASED = 'LEASED',
  HIRED = 'HIRED',
}

// ─── Booking ──────────────────────────────────────────────────────────────────

/**
 * Booking lifecycle:
 * DRAFT → PENDING_APPROVAL → APPROVED → ASSIGNED → IN_TRIP → COMPLETED
 *                          ↘ REJECTED
 *                                    ↘ CANCELLED (any stage before IN_TRIP)
 */
export enum BookingStatus {
  DRAFT = 'DRAFT',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ASSIGNED = 'ASSIGNED',
  IN_TRIP = 'IN_TRIP',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXCEPTION = 'EXCEPTION',
}

export enum TransportType {
  PERSON = 'PERSON',
  PERSON_WITH_MATERIAL = 'PERSON_WITH_MATERIAL',
  MATERIAL_ONLY = 'MATERIAL_ONLY',
}

// ─── Assignment ───────────────────────────────────────────────────────────────

export enum AssignmentDecision {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
}

// ─── Trip ─────────────────────────────────────────────────────────────────────

/**
 * Trip lifecycle:
 * CREATED → STARTED → IN_PROGRESS → COMPLETED
 *                   ↘ CANCELLED | EXCEPTION
 */
export enum TripStatus {
  CREATED = 'CREATED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  EXCEPTION = 'EXCEPTION',
}

// ─── Location ─────────────────────────────────────────────────────────────────

export enum LocationSource {
  LIVE = 'LIVE',        // real-time GPS push
  DELAYED_SYNC = 'DELAYED_SYNC', // batched replay after reconnect
  SIMULATED = 'SIMULATED', // prototype/demo mode
}

// ─── Notifications ────────────────────────────────────────────────────────────

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
}

export enum NotificationDeliveryState {
  PENDING = 'PENDING',
  SENT = 'SENT',
  FAILED = 'FAILED',
  READ = 'READ',
}

// ─── Audit ────────────────────────────────────────────────────────────────────

export enum AuditAction {
  BOOKING_CREATED = 'BOOKING_CREATED',
  BOOKING_APPROVED = 'BOOKING_APPROVED',
  BOOKING_REJECTED = 'BOOKING_REJECTED',
  BOOKING_CANCELLED = 'BOOKING_CANCELLED',
  ASSIGNMENT_CREATED = 'ASSIGNMENT_CREATED',
  ASSIGNMENT_ACCEPTED = 'ASSIGNMENT_ACCEPTED',
  ASSIGNMENT_DECLINED = 'ASSIGNMENT_DECLINED',
  ASSIGNMENT_REASSIGNED = 'ASSIGNMENT_REASSIGNED',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  TRIP_EXCEPTION = 'TRIP_EXCEPTION',
  VEHICLE_CREATED = 'VEHICLE_CREATED',
  VEHICLE_UPDATED = 'VEHICLE_UPDATED',
  VEHICLE_DEACTIVATED = 'VEHICLE_DEACTIVATED',
  DRIVER_CREATED = 'DRIVER_CREATED',
  DRIVER_UPDATED = 'DRIVER_UPDATED',
  DRIVER_DEACTIVATED = 'DRIVER_DEACTIVATED',
  DRIVER_AUTH_METHOD_CHANGED = 'DRIVER_AUTH_METHOD_CHANGED',
  DRIVER_PIN_SET = 'DRIVER_PIN_SET',
  DRIVER_PIN_RESET = 'DRIVER_PIN_RESET',
  USER_LOGIN = 'USER_LOGIN',
  USER_SUSPENDED = 'USER_SUSPENDED',
}
