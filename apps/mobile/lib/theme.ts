export const C = {
  primary:      '#1d4ed8',
  primaryLight: '#eff6ff',
  success:      '#059669',
  successLight: '#f0fdf4',
  warning:      '#d97706',
  warningLight: '#fffbeb',
  danger:       '#dc2626',
  dangerLight:  '#fef2f2',
  purple:       '#7c3aed',
  purpleLight:  '#f5f3ff',
  orange:       '#ea580c',
  orangeLight:  '#fff7ed',
  surface:      '#ffffff',
  bg:           '#f1f5f9',
  border:       '#e2e8f0',
  text:         '#0f172a',
  muted:        '#64748b',
  light:        '#94a3b8',
};

export const STATUS_COLOR: Record<string, string> = {
  PENDING_APPROVAL: C.warning,
  APPROVED:         C.primary,
  ASSIGNED:         C.purple,
  IN_TRIP:          C.orange,
  COMPLETED:        C.success,
  REJECTED:         C.danger,
  CANCELLED:        C.light,
  EXCEPTION:        C.danger,
  DRAFT:            C.light,
};

export const STATUS_LABEL: Record<string, string> = {
  PENDING_APPROVAL: 'Pending',
  APPROVED:         'Approved',
  ASSIGNED:         'Assigned',
  IN_TRIP:          'In Trip',
  COMPLETED:        'Completed',
  REJECTED:         'Rejected',
  CANCELLED:        'Cancelled',
  EXCEPTION:        'Exception',
  DRAFT:            'Draft',
};

export const DECISION_COLOR: Record<string, string> = {
  PENDING:  C.warning,
  ACCEPTED: C.success,
  DECLINED: C.danger,
};

export const TRIP_STATUS_COLOR: Record<string, string> = {
  CREATED:     C.muted,
  STARTED:     C.primary,
  IN_PROGRESS: C.orange,
  COMPLETED:   C.success,
  CANCELLED:   C.light,
  EXCEPTION:   C.danger,
};
