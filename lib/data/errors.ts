/** A user-facing rule violation (duplicate dial, name taken, …). */
export class DomainError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data?: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
