/**
 * Thrown when the server answers with a status outside the 2xx range.
 * Network errors, timeouts and aborts are NOT wrapped: they keep the native
 * TypeError / TimeoutError / AbortError of fetch.
 */
export class AbraError<T = unknown> extends Error {
    /** HTTP status code, e.g. 404 */
    readonly status: number;

    /** HTTP status text, e.g. "Not Found" (may be empty with HTTP/2) */
    readonly statusText: string;

    /** Parsed body of the error response: JSON, raw text, or null if empty */
    readonly data: T;

    /** The native Response (headers, url...). Its body is already consumed. */
    readonly response: Response;

    constructor(response: Response, data: T) {
        super(
            `Request failed with status ${response.status}` +
            (response.statusText ? ` (${response.statusText})` : '')
        );

        this.name = 'AbraError';
        this.status = response.status;
        this.statusText = response.statusText;
        this.data = data;
        this.response = response;
    }
}