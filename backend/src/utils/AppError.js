/**
 * An error with an HTTP status and a message that is safe to show to users.
 * `errors` is an optional { field: message } map for form validation.
 */
export default class AppError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    if (errors && Object.keys(errors).length) this.errors = errors;
  }
}
