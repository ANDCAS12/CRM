/**
 * @file Typed errors so callers can tell a permission problem from bad input.
 */

/** Thrown when the signed-in role may not perform an action (§3). */
export class PermissionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PermissionError';
  }
}

/** Thrown when input breaks a business rule (e.g. B-07, B-09). */
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

/** Thrown when a record id does not exist. */
export class NotFoundError extends Error {
  constructor(message = 'Record not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}
