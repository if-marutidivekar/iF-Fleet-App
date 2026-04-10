import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Assignment {
  id: string;
  decision: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  assignedAt: string;
  decisionAt?: string;
  declineReason?: string;
  trip?: { id: string; status: string; odometerStart?: number; actualStartAt?: string } | null;
  booking: {
    transportType: string;
    pickupLabel?: string;
    pickupCustomAddress?: string;
    dropoffLabel?: string;
    dropoffCustomAddress?: string;
    requestedAt: string;
    status: string;
  };
  vehicle: { vehicleNo: string; type: string; make?: string; model?: string; capacity: number };
  driver: { shiftReady: boolean; licenseNumber: string };
}

const DECISION_COLORS: Record<string, string> = {
  PENDING: '#d97706',
  ACCEPTED: '#f97316',
  DECLINED: '#dc2626',
};

const BOOKING_STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#d97706',
  APPROVED: '#2563eb',
  ASSIGNED: '#7c3aed',
  IN_TRIP: '#f97316',
  COMPLETED: '#059669',
  REJECTED: '#dc2626',
  CANCELLED: '#dc2626',
};

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
      {label.replace(/_/g, ' ')}
    </span>
  );
}

function AssignmentCard({ assignment }: { assignment: Assignment }) {
  const qc = useQueryClient();
  const [declineReason, setDeclineReason] = useState('');
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [endRemarks, setEndRemarks] = useState('');
  const [showEndForm, setShowEndForm] = useState(false);

  const acceptMutation = useMutation({
    mutationFn: () => api.post(`/assignments/${assignment.id}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });

  const declineMutation = useMutation({
    mutationFn: () =>
      api.post(`/assignments/${assignment.id}/decline`, { declineReason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setShowDeclineInput(false);
      setDeclineReason('');
    },
  });

  const startTripMutation = useMutation({
    mutationFn: () => api.post(`/trips/${assignment.id}/start`, startKm ? { odometerStart: parseFloat(startKm) } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });

  const endTripMutation = useMutation({
    mutationFn: () => api.post(`/trips/${assignment.trip?.id}/complete`, {
      ...(endKm ? { odometerEnd: parseFloat(endKm) } : {}),
      ...(endRemarks ? { remarks: endRemarks } : {}),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setShowEndForm(false);
    },
  });

  const { booking, vehicle, decision } = assignment;
  const pickup = booking.pickupLabel || booking.pickupCustomAddress || '—';
  const dropoff = booking.dropoffLabel || booking.dropoffCustomAddress || '—';
  const decisionColor = DECISION_COLORS[decision] ?? '#64748b';
  const bookingStatusColor = BOOKING_STATUS_COLORS[booking.status] ?? '#64748b';

  return (
    <div
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
      {/* Top row: decision + booking status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge label={decision} color={decisionColor} />
        <Badge label={booking.status} color={bookingStatusColor} />
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
          Assigned: {new Date(assignment.assignedAt).toLocaleString()}
        </span>
      </div>

      {/* Transport + route */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>
          {booking.transportType}
        </div>
        <div style={{ fontSize: 14, color: '#475569', marginTop: 4 }}>
          {pickup} → {dropoff}
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
          Requested: {new Date(booking.requestedAt).toLocaleString()}
        </div>
      </div>

      {/* Vehicle details (always shown for ACCEPTED, shown for PENDING too) */}
      {(decision === 'ACCEPTED' || decision === 'PENDING') && (
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            padding: '12px 16px',
            display: 'flex',
            gap: 24,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Vehicle No.
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>
              {vehicle.vehicleNo}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Type
            </div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>{vehicle.type}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Make / Model
            </div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>
              {vehicle.make || '—'} {vehicle.model || ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>
              Capacity
            </div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>{vehicle.capacity}</div>
          </div>
        </div>
      )}

      {/* Decline reason display */}
      {decision === 'DECLINED' && assignment.declineReason && (
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
          Decline reason: {assignment.declineReason}
        </div>
      )}

      {/* Actions for PENDING */}
      {decision === 'PENDING' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              onClick={() => acceptMutation.mutate()}
              disabled={acceptMutation.isPending}
              style={{
                background: '#059669',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {acceptMutation.isPending ? 'Accepting...' : 'Accept'}
            </button>
            <button
              onClick={() => setShowDeclineInput((v) => !v)}
              disabled={declineMutation.isPending}
              style={{
                background: '#fff',
                color: '#dc2626',
                border: '1px solid #dc2626',
                borderRadius: 7,
                padding: '8px 18px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Decline
            </button>
          </div>

          {showDeclineInput && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Reason for declining..."
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: 200,
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: 6,
                  fontSize: 13,
                  outline: 'none',
                }}
              />
              <button
                onClick={() => declineMutation.mutate()}
                disabled={declineMutation.isPending || !declineReason.trim()}
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 7,
                  padding: '8px 16px',
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  opacity: !declineReason.trim() ? 0.5 : 1,
                }}
              >
                {declineMutation.isPending ? 'Submitting...' : 'Submit Decline'}
              </button>
              <button
                onClick={() => setShowDeclineInput(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trip controls for ACCEPTED */}
      {decision === 'ACCEPTED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* No trip yet — show Start Trip */}
          {!assignment.trip && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#059669', marginBottom: 10 }}>Ready to start trip?</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number"
                  placeholder="Starting km (optional)"
                  value={startKm}
                  onChange={(e) => setStartKm(e.target.value)}
                  style={{ padding: '7px 12px', border: '1px solid #d1fae5', borderRadius: 6, fontSize: 13, width: 180 }}
                />
                <button
                  onClick={() => startTripMutation.mutate()}
                  disabled={startTripMutation.isPending}
                  style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  {startTripMutation.isPending ? 'Starting...' : '🚗 Start Trip'}
                </button>
              </div>
              {startTripMutation.isError && (
                <div style={{ color: '#dc2626', fontSize: 12, marginTop: 6 }}>Failed to start trip. Try again.</div>
              )}
            </div>
          )}

          {/* Trip STARTED or IN_PROGRESS — show End Trip */}
          {assignment.trip && (assignment.trip.status === 'STARTED' || assignment.trip.status === 'IN_PROGRESS') && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ea580c' }}>🚗 Trip in progress</div>
                {assignment.trip.actualStartAt && (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Started: {new Date(assignment.trip.actualStartAt).toLocaleString()}
                  </div>
                )}
              </div>
              {assignment.trip.odometerStart && (
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                  Start km: {assignment.trip.odometerStart}
                </div>
              )}
              {!showEndForm ? (
                <button
                  onClick={() => setShowEndForm(true)}
                  style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                >
                  🏁 End Trip
                </button>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    type="number"
                    placeholder="Ending km (optional)"
                    value={endKm}
                    onChange={(e) => setEndKm(e.target.value)}
                    style={{ padding: '7px 12px', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 13, width: 180 }}
                  />
                  <input
                    type="text"
                    placeholder="Remarks (optional)"
                    value={endRemarks}
                    onChange={(e) => setEndRemarks(e.target.value)}
                    style={{ padding: '7px 12px', border: '1px solid #fed7aa', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => endTripMutation.mutate()}
                      disabled={endTripMutation.isPending}
                      style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                    >
                      {endTripMutation.isPending ? 'Completing...' : 'Confirm End Trip'}
                    </button>
                    <button onClick={() => setShowEndForm(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
                  </div>
                  {endTripMutation.isError && (
                    <div style={{ color: '#dc2626', fontSize: 12 }}>Failed to end trip. Try again.</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Trip COMPLETED */}
          {assignment.trip && assignment.trip.status === 'COMPLETED' && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#059669', fontWeight: 500 }}>
              ✅ Trip completed successfully.
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export function ActiveTripPage() {
  const { data: assignments = [], isLoading } = useQuery<Assignment[]>({
    queryKey: ['assignments'],
    queryFn: async () => {
      const res = await api.get('/assignments');
      return res.data;
    },
  });

  const sorted = [...assignments].sort(
    (a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime(),
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
        My Assignments
      </h1>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
      ) : sorted.length === 0 ? (
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
          No assignments yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sorted.map((a) => (
            <AssignmentCard key={a.id} assignment={a} />
          ))}
        </div>
      )}
    </div>
  );
}
