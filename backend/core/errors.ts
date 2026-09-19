export type ErrorCode = 'INVALID_REQUEST' | 'RESOURCE_NOT_FOUND' | 'UNAUTHORIZED' | 'CONFLICT' | 'INTERNAL_ERROR'

const STATUS: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNAUTHORIZED: 401,
  RESOURCE_NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
}

export class AppError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly details?: unknown) {
    super(message)
  }
  get status(): number {
    return STATUS[this.code]
  }
}
