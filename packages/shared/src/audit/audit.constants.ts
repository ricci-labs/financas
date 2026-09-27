export const AUDIT_ACTIONS = [
  'create',
  'update',
  'archive',
  'unarchive',
  'delete',
  'restore',
] as const

export type AuditAction = (typeof AUDIT_ACTIONS)[number]

export const AUDIT_SOURCES = ['web', 'whatsapp', 'job', 'ops', 'system'] as const

export type AuditSource = (typeof AUDIT_SOURCES)[number]
