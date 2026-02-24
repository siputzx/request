/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */

export class NonError extends Error {
  override name = "NonError";
  readonly value: unknown;

  constructor(value: unknown) {
    let message = "Non-error value was thrown";
    try {
      if (typeof value === "string") {
        message = value;
      } else if (value && typeof value === "object" && "message" in value && typeof (value as Record<string, unknown>)["message"] === "string") {
        message = (value as Record<string, unknown>)["message"] as string;
      }
    } catch {}
    super(message);
    this.value = value;
  }
}
