import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Booking {
  id: string;
  bookingNo: number;
  transportType: string;
  passengerCount?: number;
  materialDescription?: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  requestedAt: string;
  status: string;
  createdAt: string;
  rejectionReason?: string;
  requester: { id: string; name: string; email: string };
  assignment?: {
    vehicle: { vehicleNo: string; type: string; make?: string; model?: string };
    driver: { user: { name: string; mobileNumber?: string } };
    decision: string;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: '#d97706',
  APPROVED: '#2563eb',
  ASSIGNED: '#7c3aed',
  'ASSIGNED–PENDING': '#7c3aed',
  'ASSIGNED–ACCEPTED': '#059669',
  'ASSIGNED–DECLINED': '#dc2626',
  IN_TRIP: '#f97316',
  COMPLETED: '#059669',
  REJECTED: '#dc2626',
  CANCELLED: '#6b7280',
};

function getEffectiveStatus(booking: Booking): string {
  if (booking.status === 'ASSIGNED' && booking.assignment) {
    const d = booking.assignment.decision;
    if (d === 'PENDING') return 'ASSIGNED–PENDING';
    if (d === 'ACCEPTED') return 'ASSIGNED–ACCEPTED';
    if (d === 'DECLINED') return 'ASSIGNED–DECLINED';
  }
  return booking.status;
}

function StatusBadge({ booking }: { booking: Booking }) {
  const eff = getEffectiveStatus(booking);
  const color = STATUS_COLORS[eff] ?? '#64748b';
  return (
    <div>
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
        {eff.replace(/_/g, ' ')}
      </span>
      {booking.status === 'REJECTED' && booking.rejectionReason && (
        <div style={{ fontSize: 11, color: '#dc2626', marginTop: 3 }}>{booking.rejectionReason}</div>
      )}
    </div>
  );
}

const CANCELLABLE = new Set(['PENDING_APPROVAL', 'APPROVED', 'ASSIGNED']);

export function BookingHistoryPage() {
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: bookings = [], isLoading } = useQuery<Booking[]>({
    queryKey: ['bookings'],
    queryFn: async () => {
      const res = await api.get('/bookings');
      return res.data;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/bookings/${id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookings'] });
      setCancellingId(null);
    },
  });

  const sorted = [...bookings].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 24px' }}>
      <h1 style={{ margin: '0 0 24px', fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
        Booking History
      </h1>

      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: 12,
          overflow: 'auto',
        }}
      >
        {isLoading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : sorted.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            No bookings found.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {[
                  'Req #',
                  'Transport',
                  'Pickup → Dropoff',
                  'Requested Time',
                  'Status',
                  'Assigned Vehicle / Driver',
                  'Actions',
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: 12,
                      fontWeight: 600,
                      color: '#64748b',
                      borderBottom: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((b, i) => {
                const pickup = b.pickupLabel || b.pickupCustomAddress || '—';
                const dropoff = b.dropoffLabel || b.dropoffCustomAddress || '—';
                const isCancelling = cancellingId === b.id;
                const canCancel = CANCELLABLE.has(b.status);
                return (
                  <tr
                    key={b.id}
                    style={{
                      borderBottom: i < sorted.length - 1 ? '1px solid #f1f5f9' : undefined,
                      background: '#fff',
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#64748b', whiteSpace: 'nowrap' }}>
                      #{b.bookingNo}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 14, color: '#0f172a', fontWeight: 600 }}>
                      {b.transportType}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>
                      <div>{pickup}</div>
                      <div style={{ color: '#94a3b8', fontSize: 12 }}>→ {dropoff}</div>
                    </td>
                    <td
                      style={{
                        padding: '14px 16px',
                        fontSize: 13,
                        color: '#475569',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {new Date(b.requestedAt).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge booking={b} />
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: 13, color: '#475569' }}>
                      {b.assignment ? (
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            {b.assignment.vehicle.vehicleNo} —{' '}
                            {b.assignment.vehicle.make} {b.assignment.vehicle.model}
                          </div>
                          <div style={{ color: '#64748b', fontSize: 12 }}>
                            {b.assignment.driver.user.name}
                          </div>
                          {b.assignment.driver.user.mobileNumber && (
                            <div style={{ color: '#2563eb', fontSize: 11 }}>📞 {b.assignment.driver.user.mobileNumber}</div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#cbd5e1', fontSize: 12 }}>Not assigned</span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      {canCancel && (
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              if (isCancelling) {
                                cancelMutation.mutate(b.id);
                              } else {
                                setCancellingId(b.id);
                              }
                            }}
                            disabled={cancelMutation.isPending && isCancelling}
                            style={{
                              background: isCancelling ? '#dc2626' : '#fff',
                              color: isCancelling ? '#fff' : '#dc2626',
                              border: '1px solid #dc2626',
                              borderRadius: 6,
                              padding: '5px 14px',
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {isCancelling
                              ? cancelMutation.isPending
                                ? 'Cancelling...'
                                : 'Confirm Cancel'
                              : 'Cancel'}
                          </button>
                          {isCancelling && !cancelMutation.isPending && (
                            <button
                              onClick={() => setCancellingId(null)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#64748b',
                                fontSize: 12,
                                cursor: 'pointer',
                              }}
                            >
                              Keep
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
