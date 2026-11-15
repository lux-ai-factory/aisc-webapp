// A launch is sent once: each click carries a key of its own (Idempotency-Key), so a double click or a retried
// request makes one run. The engine answers the same key again with the run it already made.

/** A new key for one click on Launch, in the shape the engine takes (letters, digits, '-' and '_'). */
export function newLaunchKey(): string {
    return crypto.randomUUID();
}

/** The request of one launch, with its key. */
export function launchInit(body: unknown, key: string): RequestInit {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
        body: JSON.stringify(body),
    };
}
