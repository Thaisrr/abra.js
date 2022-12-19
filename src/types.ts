export type AbraConfigs = {
    params?: object | URLSearchParams,
    timeout?: number,
} & RequestInit;

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface Interceptor <T extends Response | Request>{
    intercept : (request: T ) => T;
}
