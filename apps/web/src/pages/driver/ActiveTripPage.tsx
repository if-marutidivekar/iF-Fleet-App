import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

interface Requester {
  id: string;
  name: string;
  email: string;
  mobileNumber?: string | null;
}

interface Assignment {
  id: string;
  decision: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  assignedAt: string;
  decisionAt?: string;
  declineReason?: string;
  trip?: { id: string; status: string; odometerStart?: number; actualStartAt?: string } | null;
  booking: {
    id: string;
    transportType: string;
    pickupLabel?: string;
    pickupCustomAddress?: string;
    dropoffLabel?: string;
    dropoffCustomAddress?: string;
    requestedAt: string;
    status: string;
    requester: Requester;
  };
  vehicle: { vehicleNo: string; type: string; make?: string; model?: string; capacity: number };
  driver: { shiftReady: boolean; licenseNumber: string };
}

interface AvailableBooking {
  id: string;
  transportType: string;
  pickupLabel?: string;
  pickupCustomAddress?: string;
  dropoffLabel?: string;
  dropoffCustomAddress?: string;
  requestedAt: string;
  requester: { name: string; email: string };
}

interface Vehicle {
  id: string;
  vehicleNo: string;
  type: string;
  make?: string;
  model?: string;
  capacity: number;
  status: string;
}

interface SystemConfig {
  approvalMode: 'MANUAL' | 'AUTO';
}

const DECISION_COLORS: Record<string, string> = {
  PENDING: '#d97706',
  ACCEPTED: '#059669',
  DECLINED: '#dc2626',
};

function RequesterBox({ requester }: { requester: Requester }) {
  return (
    <div
      style={{
        background: '#eff6ff',
        border: '1px solid #bfdbfe',
        borderRadius: 8,
        padding: '10px 14px',
        marginBottom: 12,
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
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelInput, setShowCancelInput] = useState(false);
  const [startKm, setStartKm] = useState('');
  const [endKm, setEndKm] = useState('');
  const [endRemarks, setEndRemarks] = useState('');
  const [showEndForm, setShowEndForm] = useState(false);
  const [showFuelForm, setShowFuelForm] = useState(false);
  const [fuelVolume, setFuelVolume] = useState('');
  const [fuelCost, setFuelCost] = useState('');
  const [fuelOdometer, setFuelOdometer] = useState('');

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

  const driverCancelMutation = useMutation({
    mutationFn: () =>
      api.post(`/assignments/${assignment.id}/driver-cancel`, {
        cancelReason: cancelReason || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setShowCancelInput(false);
      setCancelReason('');
    },
  });

  const startTripMutation = useMutation({
    mutationFn: () =>
      api.post(`/trips/${assignment.id}/start`, startKm ? { odometerStart: parseFloat(startKm) } : {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['assignments'] }),
  });

  const endTripMutation = useMutation({
    mutationFn: () =>
      api.post(`/trips/${assignment.trip?.id}/complete`, {
        ...(endKm ? { odometerEnd: parseFloat(endKm) } : {}),
        ...(endRemarks ? { remarks: endRemarks } : {}),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      setShowEndForm(false);
    },
  });

  const fuelLogMutation = useMutation({
    mutationFn: () =>
      api.post(`/trips/${assignment.trip?.id}/fuel`, {
        fuelVolume: parseFloat(fuelVolume),
        ...(fuelCost ? { fuelCost: parseFloat(fuelCost) } : {}),
        odometerAtRefuel: parseFloat(fuelOdometer),
      }),
    onSuccess: () => {
      setShowFuelForm(false);
      setFuelVolume('');
      setFuelCost('');
      setFuelOdometer('');
    },
  });

  const { booking, vehicle, decision } = assignment;
  const pickup = booking.pickupLabel || booking.pickupCustomAddress || '—';
  const dropoff = booking.dropoffLabel || booking.dropoffCustomAddress || '—';
  const decisionColor = DECISION_COLORS[decision] ?? '#64748b';

  const tripActive =
    assignment.trip &&
    (assignment.trip.status === 'STARTED' || assignment.trip.status === 'IN_PROGRESS');
  const tripCompleted = assignment.trip && assignment.trip.status === 'COMPLETED';

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
      {/* Top row: decision badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Badge label={decision} color={decisionColor} />
        {/* Step 4: Show BOOKING CANCELLED badge when requester cancelled the booking */}
        {booking.status === 'CANCELLED' && <Badge label="BOOKING CANCELLED" color="#dc2626" />}
        {tripActive && <Badge label="IN PROGRESS" color="#f97316" />}
        {tripCompleted && <Badge label="TRIP COMPLETED" color="#059669" />}
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>
          Assigned: {new Date(assignment.assignedAt).toLocaleString()}
        </span>
      </div>

      {/* Requester info */}
      <RequesterBox requester={booking.requester} />

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

      {/* Vehicle details */}
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
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Vehicle No.</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginTop: 2 }}>{vehicle.vehicleNo}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Type</div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>{vehicle.type}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Make / Model</div>
            <div style={{ fontSize: 14, color: '#475569', marginTop: 2 }}>
              {vehicle.make || '—'} {vehicle.model || ''}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>Capacity</div>
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
          Reason: {assignment.declineReason}
        </div>
      )}

      {/* Steps 1, 2, 5: Cancelled booking info panel — no action required */}
      {booking.status === 'CANCELLED' && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: '#dc2626',
            fontWeight: 500,
          }}
        >
          🚫 This booking was cancelled by the requester. No further action is required.
        </div>
      )}

      {/* Actions for PENDING — Step 5: hidden when booking is cancelled */}
      {decision === 'PENDING' && !tripCompleted && booking.status !== 'CANCELLED' && (
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
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {/* Trip controls for ACCEPTED — Step 2: hidden when booking is cancelled (cannot start trip) */}
      {decision === 'ACCEPTED' && booking.status !== 'CANCELLED' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* No trip yet — show Start Trip + Cancel option */}
          {!assignment.trip && (
            <>
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

              {/* Driver cancel (before trip starts) */}
              <div>
                {!showCancelInput ? (
                  <button
                    onClick={() => setShowCancelInput(true)}
                    style={{
                      background: '#fff',
                      color: '#dc2626',
                      border: '1px solid #dc2626',
                      borderRadius: 7,
                      padding: '7px 16px',
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    ✕ Cancel Acceptance
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>Cancel your acceptance?</div>
                    <input
                      type="text"
                      placeholder="Reason (optional)"
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      style={{ padding: '7px 12px', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => driverCancelMutation.mutate()}
                        disabled={driverCancelMutation.isPending}
                        style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 7, padding: '7px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                      >
                        {driverCancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancel'}
                      </button>
                      <button
                        onClick={() => setShowCancelInput(false)}
                        style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}
                      >
                        Keep
                      </button>
                    </div>
                    {driverCancelMutation.isError && (
                      <div style={{ color: '#dc2626', fontSize: 12 }}>Failed to cancel. Try again.</div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Trip STARTED or IN_PROGRESS — show End Trip */}
          {tripActive && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#ea580c' }}>🚗 Trip in progress</div>
                {assignment.trip!.actualStartAt && (
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Started: {new Date(assignment.trip!.actualStartAt).toLocaleString()}
                  </div>
                )}
              </div>
              {assignment.trip!.odometerStart && (
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                  Start km: {assignment.trip!.odometerStart}
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

          {/* Fuel Log (while trip is active) */}
          {tripActive && (
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showFuelForm ? 12 : 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1d4ed8' }}>⛽ Fuel Log</div>
                <button
                  onClick={() => setShowFuelForm((v) => !v)}
                  style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  {showFuelForm ? 'Cancel' : '+ Log Fuel'}
                </button>
              </div>
              {showFuelForm && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: 4 }}>
                        Fuel volume (liters) *
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 30"
                        value={fuelVolume}
                        onChange={(e) => setFuelVolume(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: 4 }}>
                        Fuel cost (optional)
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 2400"
                        value={fuelCost}
                        onChange={(e) => setFuelCost(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#1d4ed8', display: 'block', marginBottom: 4 }}>
                        Odometer at refuel *
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 54200"
                        value={fuelOdometer}
                        onChange={(e) => setFuelOdometer(e.target.value)}
                        style={{ width: '100%', padding: '7px 10px', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      onClick={() => fuelLogMutation.mutate()}
                      disabled={fuelLogMutation.isPending || !fuelVolume || !fuelOdometer}
                      style={{
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 7,
                        padding: '8px 20px',
                        fontWeight: 600,
                        fontSize: 13,
                        cursor: 'pointer',
                        opacity: !fuelVolume || !fuelOdometer ? 0.5 : 1,
                      }}
                    >
                      {fuelLogMutation.isPending ? 'Saving...' : 'Log Fuel'}
                    </button>
                    {fuelLogMutation.isSuccess && (
                      <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>✓ Fuel logged!</span>
                    )}
                    {fuelLogMutation.isError && (
                      <span style={{ fontSize: 12, color: '#dc2626' }}>Failed to log fuel. Try again.</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Trip COMPLETED */}
          {tripCompleted && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', fontSize: 13, color: '#059669', fontWeight: 500 }}>
              ✅ Trip completed successfully.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AvailableTripCard({ booking, vehicles }: { booking: AvailableBooking; vehicles: Vehicle[] }) {
  const qc = useQueryClient();
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [picking, setPicking] = useState(false);

  const selfAssignMutation = useMutation({
    mutationFn: () => api.post('/assignments/self-assign', { bookingId: booking.id, vehicleId: selectedVehicle }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignments'] });
      qc.invalidateQueries({ queryKey: ['available-trips'] });
    },
  });

  const pickup = booking.pickupLabel || booking.pickupCustomAddress || '—';
  const dropoff = booking.dropoffLabel || booking.dropoffCustomAddress || '—';
  const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE');

  return (
    <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{booking.transportType}</div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>{pickup} → {dropoff}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
            Requested by {booking.requester.name} · {new Date(booking.requestedAt).toLocaleString()}
          </div>
        </div>
        {!picking && (
          <button
            onClick={() => setPicking(true)}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            Take Trip
          </button>
        )}
      </div>
      {picking && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Select your vehicle:</div>
          <select
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
            style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none', background: '#fff', maxWidth: 300 }}
          >
            <option value="">Choose vehicle...</option>
            {availableVehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleNo} — {v.type} {v.make} {v.model} (cap: {v.capacity})
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => selfAssignMutation.mutate()}
              disabled={selfAssignMutation.isPending || !selectedVehicle}
              style={{
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                padding: '7px 18px',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                opacity: !selectedVehicle ? 0.5 : 1,
              }}
            >
              {selfAssignMutation.isPending ? 'Assigning...' : 'Confirm Take Trip'}
            </button>
            <button onClick={() => { setPicking(false); setSelectedVehicle(''); }} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
          {selfAssignMutation.isError && (
            <div style={{ color: '#dc2626', fontSize: 12 }}>Failed. Vehicle may no longer be available.</div>
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

  const { data: config } = useQuery<SystemConfig>({
    queryKey: ['admin-config'],
    queryFn: () => api.get<SystemConfig>('/admin/config').then((r) => r.data),
    staleTime: 5 * 60_000,
  });

  const isAutoMode = config?.approvalMode === 'AUTO';

  const { data: availableTrips = [] } = useQuery<AvailableBooking[]>({
    queryKey: ['available-trips'],
    queryFn: () => api.get('/assignments/available').then((r) => r.data),
    enabled: isAutoMode,
    refetchInterval: isAutoMode ? 30_000 : false,
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['fleet-vehicles'],
    queryFn: () => api.get('/fleet/vehicles').then((r) => r.data),
    enabled: isAutoMode,
  });

  // My Trip: only current active/actionable assignments — Steps 4-5, 6-7
  // Excludes COMPLETED, DECLINED, CANCELLED. Historical items belong in History only.
  const myTrip = assignments
    .filter((a) =>
      (a.booking.status === 'ASSIGNED' || a.booking.status === 'IN_TRIP') &&
      (a.decision === 'PENDING' || a.decision === 'ACCEPTED'),
    )
    .sort((a, b) => {
      // Active trips (STARTED / IN_PROGRESS) float to top
      const aActive = a.trip && (a.trip.status === 'STARTED' || a.trip.status === 'IN_PROGRESS') ? 1 : 0;
      const bActive = b.trip && (b.trip.status === 'STARTED' || b.trip.status === 'IN_PROGRESS') ? 1 : 0;
      if (bActive !== aActive) return bActive - aActive;
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });

  return (
    // Steps 6-10: Internal scroll layout — header fixed, content area scrolls
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Fixed page header */}
      <div style={{ flexShrink: 0, padding: '24px 24px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#0f172a' }}>
          Trip Tracking
        </h1>
      </div>

      {/* Scrollable content area */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '24px' }}>

        {/* AUTO MODE: Available trips section */}
        {isAutoMode && availableTrips.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                🚦 Available Trips
              </h2>
              <span style={{ fontSize: 12, background: '#2563eb1a', color: '#2563eb', borderRadius: 99, padding: '2px 10px', fontWeight: 700 }}>
                {availableTrips.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {availableTrips.map((t) => (
                <AvailableTripCard key={t.id} booking={t} vehicles={vehicles} />
              ))}
            </div>
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Loading...</div>
        ) : myTrip.length === 0 ? (
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
            No active or pending assignments right now.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {myTrip.map((a) => (
              <AssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
