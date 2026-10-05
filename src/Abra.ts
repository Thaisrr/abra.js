import { AbraError } from './AbraError.js';
import { AbraConfigs, HttpMethod, Interceptor } from './types.js';

export class Abra {
    private outInterceptors: Interceptor<Request>[] = [];
    private inInterceptors: Interceptor<Response>[] = [];
    private static instance: Abra;

    private constructor() {}

    /**
     * The shared instance, also exported as the default export.
     */
    static getInstance(): Abra {
        if (!Abra.instance) {
            Abra.instance = new Abra();
        }

        return Abra.instance;
    }

    /**
     * A brand new instance with its own interceptors, independent from the
     * shared one. Useful to talk to several APIs.
     */
    static create(): Abra {
        return new Abra();
    }

    async get<T>(url: string, options?: AbraConfigs) {
        return this.cadabra<T>(url, options, 'GET');
    }

    async post<T>(url: string, body: BodyInit | object, options?: AbraConfigs) {
        return this.cadabra<T>(url, options, 'POST', body);
    }

    async put<T>(url: string, body: BodyInit | object, options?: AbraConfigs) {
        return this.cadabra<T>(url, options, 'PUT', body);
    }

    async delete<T>(url: string, options?: AbraConfigs) {
        return this.cadabra<T>(url, options, 'DELETE');
    }

    async patch<T>(url: string, body: BodyInit | object, options?: AbraConfigs) {
        return this.cadabra<T>(url, options, 'PATCH', body);
    }

    all<T extends readonly Promise<unknown>[]>(
        ...requests: T
    ): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
        return Promise.all(requests) as Promise<{ [K in keyof T]: Awaited<T[K]> }>;
    }

    /**
     * Read the body of a failed response without ever throwing a parsing error:
     * JSON if possible, raw text otherwise, null if the body is empty.
     */
    private async parseErrorBody(response: Response): Promise<unknown> {
        const text = await response.text();

        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }

    private async handleRequest<T>(
        response: Response
    ): Promise<{ data: T | null; response: Response }> {
        if (!response.ok) {
            throw new AbraError(response, await this.parseErrorBody(response));
        }

        // No content: nothing to parse (calling .json() here would throw)
        if (
            response.status === 204 ||
            response.status === 205 ||
            response.headers.get('Content-Length') === '0'
        ) {
            return { data: null, response };
        }

        const contentType = response.headers.get('Content-Type');
        let data: T | null = null;

        if (contentType) {
            if (contentType.includes('json')) {
                // An empty body is valid (e.g. a PUT or DELETE answering 200 with nothing)
                const text = await response.text();
                data = (text ? JSON.parse(text) : null) as T;
            } else if (
                contentType.includes('text/') ||
                contentType.includes('application/xml')
            ) {
                data = await response.text() as unknown as T;
            } else if (
                contentType.includes('multipart/form-data') ||
                contentType.includes('application/x-www-form-urlencoded')
            ) {
                data = await response.formData() as unknown as T;
            } else {
                data = await response.blob() as unknown as T;
            }
        }

        return { data, response };
    }

    private addToInterceptors<T extends Response | Request>(
        callback: Interceptor<T>,
        interceptors: Interceptor<T>[],
        first = false,
        last = false
    ): void {
        if (first) {
            interceptors.unshift(callback);
        } else {
            // `last` or default: append
            interceptors.push(callback);
        }
    }

    addInInterceptor(
        callback: Interceptor<Response>,
        first = false,
        last = false
    ): void {
        this.addToInterceptors(callback, this.inInterceptors, first, last);
    }

    addOutInterceptor(
        callback: Interceptor<Request>,
        first = false,
        last = false
    ): void {
        this.addToInterceptors(callback, this.outInterceptors, first, last);
    }

    removeInterceptor(interceptor: Interceptor<any>): void {
        const inIndex = this.inInterceptors.indexOf(interceptor);
        const outIndex = this.outInterceptors.indexOf(interceptor);

        if (outIndex > -1) {
            this.outInterceptors.splice(outIndex, 1);
        }

        if (inIndex > -1) {
            this.inInterceptors.splice(inIndex, 1);
        }
    }

    private async applyOutInterceptors(request: Request): Promise<Request> {
        let current = request;

        // Iterate on a copy: an interceptor may remove itself while running
        for (const interceptor of [...this.outInterceptors]) {
            current = await interceptor(current);
        }

        return current;
    }

    private async applyInInterceptors(response: Response): Promise<Response> {
        let current = response;

        for (const interceptor of [...this.inInterceptors]) {
            current = await interceptor(current);
        }

        return current;
    }

    /**
     * Turn the body into something fetch understands.
     * - FormData: sent as is, the Content-Type (with its boundary) is left to fetch
     * - string, URLSearchParams, Blob, buffers, streams: sent as is
     * - objects with a urlencoded Content-Type: converted to URLSearchParams
     * - other objects and arrays: JSON, unless another Content-Type was set
     */
    private serializeBody(body: unknown, headers: Headers): BodyInit | undefined {
        if (body === undefined || body === null) {
            return undefined;
        }

        if (body instanceof FormData) {
            headers.delete('Content-Type');
            return body;
        }

        if (headers.get('Content-Type')?.includes('multipart/form-data')) {
            headers.delete('Content-Type');
        }

        const isRawBody =
            typeof body === 'string' ||
            body instanceof URLSearchParams ||
            body instanceof Blob ||
            body instanceof ArrayBuffer ||
            ArrayBuffer.isView(body) ||
            body instanceof ReadableStream;

        if (isRawBody) {
            return body as BodyInit;
        }

        const contentType = headers.get('Content-Type');

        if (!contentType) {
            headers.set('Content-Type', 'application/json');
        }

        if (!contentType || contentType.includes('json')) {
            return JSON.stringify(body);
        }

        if (contentType.includes('application/x-www-form-urlencoded')) {
            return new URLSearchParams(body as Record<string, string>);
        }

        return body as BodyInit;
    }

    private initRequest(
        method: HttpMethod,
        url: string,
        options?: AbraConfigs,
        body?: unknown,
        signal?: AbortSignal
    ): Request {
        const headers = new Headers(options?.headers);
        const payload = this.serializeBody(body, headers);

        const query = options?.params
            ? new URLSearchParams(options.params as URLSearchParams).toString()
            : '';

        const requestUrl = query
            ? `${url}${url.includes('?') ? '&' : '?'}${query}`
            : url;

        return new Request(requestUrl, {
            ...options,
            method,
            headers,
            body: payload,
            signal
        });
    }

    /**
     * Merge the user's own signal (if any) with the timeout (if any).
     */
    private buildSignal(options?: AbraConfigs): AbortSignal | undefined {
        const signals: AbortSignal[] = [];

        if (options?.signal) {
            signals.push(options.signal);
        }

        if (options?.timeout) {
            signals.push(AbortSignal.timeout(options.timeout));
        }

        return signals.length > 1 ? AbortSignal.any(signals) : signals[0];
    }

    /**
     * Perform the request with the given options and interceptors.
     *
     * @param url Request URL
     * @param options Request options
     * @param method HTTP method
     * @param body Request body
     */
    async cadabra<T>(
        url: string,
        options?: AbraConfigs,
        method: HttpMethod = 'GET',
        body?: unknown
    ): Promise<{ data: T | null; response: Response }> {
        const request = await this.applyOutInterceptors(
            this.initRequest(method, url, options, body, this.buildSignal(options))
        );

        const response = await this.applyInInterceptors(await fetch(request));

        return this.handleRequest<T>(response);
    }
}