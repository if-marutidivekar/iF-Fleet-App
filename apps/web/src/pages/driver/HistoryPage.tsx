import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Requester {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string | null;
}

interface Assignment {
  id: string;
  decision: string;
  assignedAt: string;
  decisionAt?: string;
  declineReason?: string;
  booking: {
    id: string;
    bookingNo?: number;
    transportType: string;
    pickupLabel?: string;
    pickupCustomAddress?: string;
    dropoffLabel?: string;
    dropoffCustomAddress?: string;
    requestedAt: string;
    status: string;
    requester: Requester;
  };
  vehicle: { vehicleNo: string; type: string; make?: string; model?: string };
  trip?: {
    id: string;
    status: string;
    odometerStart?: number;
    odometerEnd?: number;
    actualStartAt?: string;
    actualEndAt?: string;
    remarks?: string;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEffectiveStatus(a: Assignment): { label: string; color: string } {
  if (a.booking.status === 'COMPLETED') return { label: 'Completed',  color: '#059669' };
  if (a.booking.status === 'CANCELLED') return { label: 'Cancelled',  color: '#6b7280' };
  if (a.decision === 'DECLINED')        return { label: 'Declined',   color: '#dc2626' };
  return { label: a.booking.status.replace(/_/g, ' '), color: '#64748b' };
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 12,
        background: color + '1a',
        color,
        fontWeight: 600,
        fontSize: 12,
        border: `1px solid ${color}44`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

function RequesterBox({ requester }: { requester: Requester }) {
  return (
    <div
      style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
        👤 Requested by
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{requester.name}</div>
      <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{requester.email}</div>
      {requester.mobileNumber && (
        <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>📞 {requester.mobileNumber}</div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function DriverHistoryPage() {
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['driver-assignments'],
    queryFn: () => api.get<Assignment[]>('/assignments').then((r) => r.data),
    refetchInterval: 30_000,
  });

  // Steps 2, 6-7: History = COMPLETED + DECLINED + CANCELLED only.
  // No active items (ASSIGNED-PENDING, ASSIGNED-ACCEPTED, IN_TRIP) included here.
  const history = assignments
    .filter((a) =>
      a.booking.status === 'COMPLETED' ||
      a.decision === 'DECLINED' ||
      a.booking.status === 'CANCELLED',
    )
    .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());

  return (
    // Internal scroll layout — matching the rest of the driver pages
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Fixed page header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
          History
        </h1>
        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 14 }}>
          Completed, declined, and cancelled trip records.
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
        ) : history.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              padding: 40,
              textAlign: 'center',
              color: '#94a3b8',
            }}
          >
            No trip history yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {history.map((a) => {
              const { label: statusLabel, color: statusColor } = getEffectiveStatus(a);
              const pickup  = a.booking.pickupLabel  || a.booking.pickupCustomAddress  || '—';
              const dropoff = a.booking.dropoffLabel || a.booking.dropoffCustomAddress || '—';
              const hasDistance =
                a.trip?.odometerStart != null && a.trip?.odometerEnd != null;

              return (
                <div
                  key={a.id}
                  style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 14,
                  }}
                >
                  {/* Top row: status badge + booking ref + assigned date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge label={statusLabel} color={statusColor} />
                    {a.booking.bookingNo != null && (
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Req #{a.booking.bookingNo}</span>
                    )}
                    <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
                      Assigned: {new Date(a.assignedAt).toLocaleString()}
                    </span>
                  </div>

                  {/* Requester */}
                  <RequesterBox requester={a.booking.requester} />

                  {/* Transport type + route */}
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
                      {a.booking.transportType.replace(/_/g, ' ')}
                    </div>
                    <div style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
                      {pickup} → {dropoff}
                    </div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
                      Requested: {new Date(a.booking.requestedAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Vehicle + trip stats */}
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '12px 16px',
                      display: 'flex',
                      gap: 28,
                      flexWrap: 'wrap',
                    }}
                  >
                    {/* Vehicle */}
                    <div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Vehicle</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{a.vehicle.vehicleNo}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        {[a.vehicle.make, a.vehicle.model].filter(Boolean).join(' ')}{a.vehicle.make || a.vehicle.model ? ' — ' : ''}{a.vehicle.type}
                      </div>
                    </div>

                    {/* Distance (completed trips only) */}
                    {hasDistance && (
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Distance</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
                          {(a.trip!.odometerEnd! - a.trip!.odometerStart!).toFixed(0)} km
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          {a.trip!.odometerStart} → {a.trip!.odometerEnd} km
                        </div>
                      </div>
                    )}

                    {/* Trip times (completed trips only) */}
                    {a.trip?.actualStartAt && (
                      <div>
                        <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Trip Times</div>
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                          Start: {new Date(a.trip.actualStartAt).toLocaleString()}
                        </div>
                        {a.trip?.actualEndAt && (
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            End: &nbsp; {new Date(a.trip.actualEndAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Decline reason */}
                  {a.decision === 'DECLINED' && a.declineReason && (
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        color: '#dc2626',
                      }}
                    >
                      Reason: {a.declineReason}
                    </div>
                  )}

                  {/* Cancelled info */}
                  {a.booking.status === 'CANCELLED' && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        color: '#64748b',
                        fontWeight: 500,
                      }}
                    >
                      🚫 This booking was cancelled by the requester.
                    </div>
                  )}

                  {/* Trip remarks */}
                  {a.trip?.remarks && (
                    <div
                      style={{
                        background: '#f0fdf4',
                        border: '1px solid #bbf7d0',
                        borderRadius: 8,
                        padding: '10px 14px',
                        fontSize: 13,
                        color: '#059669',
                      }}
                    >
                      💬 Remarks: {a.trip.remarks}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
