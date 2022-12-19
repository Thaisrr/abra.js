export type AbraConfigs = {
    params?: object | URLSearchParams,
    timeout?: number,
} & RequestInit;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type Interceptor <T extends Response | Request> = (request: T ) => T;
