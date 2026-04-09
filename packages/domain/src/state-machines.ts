import { BookingStatus, TripStatus, AssignmentDecision } from './enums';

// ─── Booking State Machine ────────────────────────────────────────────────────

/** Valid forward transitions for a booking. Enforce these in the API service layer. */
export const BOOKING_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.DRAFT]: [BookingStatus.PENDING_APPROVAL, BookingStatus.CANCELLED],
  [BookingStatus.PENDING_APPROVAL]: [
    BookingStatus.APPROVED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.APPROVED]: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  [BookingStatus.REJECTED]: [],                           // terminal
  [BookingStatus.ASSIGNED]: [BookingStatus.IN_TRIP, BookingStatus.CANCELLED],
  [BookingStatus.IN_TRIP]: [BookingStatus.COMPLETED, BookingStatus.EXCEPTION],
  [BookingStatus.COMPLETED]: [],                          // terminal
  [BookingStatus.CANCELLED]: [],                          // terminal
  [BookingStatus.EXCEPTION]: [BookingStatus.CANCELLED],
};

export function isValidBookingTransition(from: BookingStatus, to: BookingStatus): boolean {
  return BOOKING_TRANSITIONS[from].includes(to);
}

// ─── Trip State Machine ───────────────────────────────────────────────────────

export const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.CREATED]: [TripStatus.STARTED, TripStatus.CANCELLED],
  [TripStatus.STARTED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED, TripStatus.EXCEPTION],
  [TripStatus.IN_PROGRESS]: [TripStatus.PAUSED, TripStatus.COMPLETED, TripStatus.EXCEPTION],
  [TripStatus.PAUSED]: [TripStatus.IN_PROGRESS, TripStatus.EXCEPTION, TripStatus.CANCELLED],
  [TripStatus.COMPLETED]: [],                             // terminal
  [TripStatus.CANCELLED]: [],                             // terminal
  [TripStatus.EXCEPTION]: [TripStatus.CANCELLED],
};

export function isValidTripTransition(from: TripStatus, to: TripStatus): boolean {
  return TRIP_TRANSITIONS[from].includes(to);
}

// ─── Assignment Decision Machine ──────────────────────────────────────────────

export const ASSIGNMENT_DECISION_TRANSITIONS: Record<AssignmentDecision, AssignmentDecision[]> = {
  [AssignmentDecision.PENDING]: [AssignmentDecision.ACCEPTED, AssignmentDecision.DECLINED],
  [AssignmentDecision.ACCEPTED]: [],                      // terminal
  [AssignmentDecision.DECLINED]: [],                      // terminal — admin must reassign
};

export function isValidAssignmentDecision(
  from: AssignmentDecision,
  to: AssignmentDecision,
): boolean {
  return ASSIGNMENT_DECISION_TRANSITIONS[from].includes(to);
}
