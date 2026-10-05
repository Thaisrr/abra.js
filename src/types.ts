export type AbraConfigs = {
    params?: object | URLSearchParams,
    timeout?: number,
} & RequestInit;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * An interceptor receives a Request (out) or a Response (in) and returns it,
 * modified or not. It can be async.
 */
export type Interceptor<T extends Response | Request> =
    (value: T) => T | Promise<T>;