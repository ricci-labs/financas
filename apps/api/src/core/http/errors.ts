export class AppError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = new.target.name
    this.code = code
  }
}

export class ValidationError extends AppError {}

export class NotFoundError extends AppError {}

export class ConflictError extends AppError {}
