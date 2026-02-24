/*
 * Derived from Ky — MIT License © Sindre Sorhus
 */
export class NonError extends Error {
    name = "NonError";
    value;
    constructor(value) {
        let message = "Non-error value was thrown";
        try {
            if (typeof value === "string") {
                message = value;
            }
            else if (value && typeof value === "object" && "message" in value && typeof value["message"] === "string") {
                message = value["message"];
            }
        }
        catch { }
        super(message);
        this.value = value;
    }
}
//# sourceMappingURL=NonError.js.map