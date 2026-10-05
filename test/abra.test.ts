import { expect } from 'chai';
import * as undici from 'undici';
import {
    MockAgent,
    setGlobalDispatcher,
    type MockPool
} from 'undici';

import abra, { Abra as AbraClass, AbraError } from '../dist/index.js';

// undici's MockAgent does not add a Content-Type by itself
const json = { headers: { 'content-type': 'application/json' } };

// Node's built-in fetch bundles its own undici, which can't read request bodies
// through a MockAgent from the undici package. Using the package's own
// fetch/Request/Response/Headers/FormData keeps both sides on the same version.
const globalNames = ['fetch', 'Request', 'Response', 'Headers', 'FormData'] as const;
const nativeGlobals: Record<string, unknown> = {};

describe('Abra', () => {
    const baseUrl = 'http://localhost:8082';
    const url = `${baseUrl}/datas`;

    let mockAgent: MockAgent;
    let mockPool: MockPool;

    before(() => {
        for (const name of globalNames) {
            nativeGlobals[name] = (globalThis as any)[name];
            (globalThis as any)[name] = (undici as any)[name];
        }
    });

    after(() => {
        for (const name of globalNames) {
            (globalThis as any)[name] = nativeGlobals[name];
        }
    });

    beforeEach(() => {
        mockAgent = new MockAgent();
        mockAgent.disableNetConnect();

        setGlobalDispatcher(mockAgent);

        mockPool = mockAgent.get(baseUrl);
    });

    afterEach(async () => {
        await mockAgent.close();
    });

    it('should keep the same instance', () => {
        expect(abra).to.equal(AbraClass.getInstance());
    });

    it('should perform a GET request', async () => {
        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, { message: 'Hello World' }, json);

        const response = await abra.get<{ message: string }>(`${url}/1`);

        expect(response.data?.message).to.equal('Hello World');
    });

    it('should perform a POST request', async () => {
        const body = { id: 2, message: 'Hello, world!' };

        mockPool
            .intercept({
                path: '/datas',
                method: 'POST',
                body: JSON.stringify(body)
            })
            .reply(200, { message: 'Hello, world!' }, json);

        const response = await abra.post<{ message: string }>(url, body, {
            headers: { 'Content-Type': 'application/json' }
        });

        expect(response.data?.message).to.equal('Hello, world!');
    });

    it('should send JSON by default when no Content-Type is given', async () => {
        const body = { message: 'no header' };

        mockPool
            .intercept({
                path: '/datas',
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(body)
            })
            .reply(200, { ok: true }, json);

        const response = await abra.post<{ ok: boolean }>(url, body);

        expect(response.data?.ok).to.equal(true);
    });

    it('should perform a PUT request', async () => {
        const body = { message: 'Bonjour le monde' };

        mockPool
            .intercept({
                path: '/datas/2',
                method: 'PUT',
                body: JSON.stringify(body)
            })
            .reply(200, { message: 'Bonjour le monde' }, json);

        const response = await abra.put<{ message: string }>(
            `${url}/2`,
            body,
            { headers: { 'Content-Type': 'application/json' } }
        );

        expect(response.data?.message).to.equal('Bonjour le monde');
    });

    it('should perform a PATCH request', async () => {
        const body = { message: 'Hello, world!' };

        mockPool
            .intercept({
                path: '/datas/2',
                method: 'PATCH',
                body: JSON.stringify(body)
            })
            .reply(200, { message: 'Hello, world!' }, json);

        const response = await abra.patch<{ message: string }>(
            `${url}/2`,
            body,
            { headers: { 'Content-Type': 'application/json' } }
        );

        expect(response.data?.message).to.equal('Hello, world!');
    });

    it('should perform a DELETE request', async () => {
        mockPool
            .intercept({ path: '/datas/2', method: 'DELETE' })
            .reply(200, {}, json);

        const response = await abra.delete<{}>(`${url}/2`);

        expect(response.data).to.deep.equal({});
    });

    it('should return null data for a 204 No Content', async () => {
        mockPool
            .intercept({ path: '/datas/3', method: 'DELETE' })
            .reply(204, '', json);

        const response = await abra.delete(`${url}/3`);

        expect(response.data).to.be.null;
        expect(response.response.status).to.equal(204);
    });

    it('should throw an AbraError with status, data and response', async () => {
        mockPool
            .intercept({ path: '/datas/404', method: 'GET' })
            .reply(404, { message: 'Error while fetching data' }, json);

        try {
            await abra.get<{ message: string }>(`${url}/404`);
            expect.fail('The request should have failed');
        } catch (error) {
            expect(error).to.be.instanceOf(AbraError);
            expect(error).to.be.instanceOf(Error);

            const abraError = error as AbraError<{ message: string }>;

            expect(abraError.name).to.equal('AbraError');
            expect(abraError.status).to.equal(404);
            expect(abraError.data).to.deep.equal({
                message: 'Error while fetching data'
            });
            expect(abraError.response.status).to.equal(404);
            expect(abraError.message).to.contain('404');
            expect(abraError.stack).to.be.a('string');
        }
    });

    it('should put the raw text in error.data when the error body is not JSON', async () => {
        mockPool
            .intercept({ path: '/boom', method: 'GET' })
            .reply(500, 'Internal Server Error');

        try {
            await abra.get(`${baseUrl}/boom`);
            expect.fail('The request should have failed');
        } catch (error) {
            expect(error).to.be.instanceOf(AbraError);
            expect((error as AbraError).status).to.equal(500);
            expect((error as AbraError).data).to.equal('Internal Server Error');
        }
    });

    it('should have null error.data when the error body is empty', async () => {
        mockPool
            .intercept({ path: '/empty', method: 'GET' })
            .reply(503, '');

        try {
            await abra.get(`${baseUrl}/empty`);
            expect.fail('The request should have failed');
        } catch (error) {
            expect(error).to.be.instanceOf(AbraError);
            expect((error as AbraError).status).to.equal(503);
            expect((error as AbraError).data).to.be.null;
        }
    });

    it('should not wrap network errors in an AbraError', async () => {
        // No interceptor defined and net connect disabled: fetch itself fails
        try {
            await abra.get(`${baseUrl}/not-mocked`);
            expect.fail('The request should have failed');
        } catch (error) {
            expect(error).to.not.be.instanceOf(AbraError);
            expect(error).to.be.instanceOf(Error);
        }
    });

    it('should add and remove an in interceptor', async () => {
        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, { message: 'Hello World' }, json);

        mockPool
            .intercept({ path: '/datas', method: 'GET' })
            .reply(200, { message: 'Hello World' }, json);

        const interceptor = (response: Response): Response => {
            const headers = new Headers(response.headers);

            headers.append('Hello', 'World');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers
            });
        };

        abra.addInInterceptor(interceptor);

        const response = await abra.get<{ message: string }>(`${url}/1`);

        expect(response.response.headers.get('Hello')).to.equal('World');

        abra.removeInterceptor(interceptor);

        const response2 = await abra.get<{ message: string }>(url);

        expect(response2.response.headers.get('Hello')).to.be.null;
    });

    it('should add and remove an out interceptor', async () => {
        const user = { email: 'toto@mail.fr', password: 'password' };
        const accessToken = 'fake-token';

        mockPool
            .intercept({
                path: '/login',
                method: 'POST',
                body: JSON.stringify(user)
            })
            .reply(200, { accessToken }, json);

        const loginResponse = await abra.post<{ accessToken: string }>(
            `${baseUrl}/login`,
            user,
            { headers: { 'Content-Type': 'application/json' } }
        );

        expect(loginResponse.data?.accessToken).to.equal(accessToken);

        // new Request(request, init) keeps method, body, signal...
        const interceptor = (request: Request): Request => {
            const headers = new Headers(request.headers);

            headers.append('Authorization', `Bearer ${accessToken}`);

            return new Request(request, { headers });
        };

        mockPool
            .intercept({
                path: '/secret',
                method: 'GET',
                headers: { authorization: `Bearer ${accessToken}` }
            })
            .reply(200, { message: 'Ceci est une phrase secrete' }, json);

        abra.addOutInterceptor(interceptor);

        const response = await abra.get<{ message: string }>(
            `${baseUrl}/secret`
        );

        expect(response.data?.message).to.equal(
            'Ceci est une phrase secrete'
        );

        abra.removeInterceptor(interceptor);

        mockPool
            .intercept({ path: '/secret', method: 'GET' })
            .reply(401, { message: 'Unauthorized' }, json);

        try {
            await abra.get(`${baseUrl}/secret`);
            expect.fail('The request should have failed');
        } catch (error) {
            expect(error).to.be.instanceOf(AbraError);
            expect((error as AbraError).status).to.equal(401);
            expect((error as AbraError).data).to.deep.equal({
                message: 'Unauthorized'
            });
        }
    });

    it('should call interceptors in order (default and last append, first prepends)', async () => {
        const calls: string[] = [];

        const make = (name: string) => (request: Request): Request => {
            calls.push(name);
            return request;
        };

        const a = make('a');
        const b = make('b');
        const c = make('c');
        const d = make('d');

        abra.addOutInterceptor(a);
        abra.addOutInterceptor(b);
        abra.addOutInterceptor(c, true);       // first
        abra.addOutInterceptor(d, false, true); // last

        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, { message: 'Hello World' }, json);

        await abra.get(`${url}/1`);

        [a, b, c, d].forEach(i => abra.removeInterceptor(i));

        expect(calls).to.deep.equal(['c', 'a', 'b', 'd']);
    });

    it('should wait for an async out interceptor', async () => {
        const api = AbraClass.create();

        api.addOutInterceptor(async (request) => {
            await new Promise(resolve => setTimeout(resolve, 20));

            const headers = new Headers(request.headers);

            headers.set('X-Token', 'refreshed');

            return new Request(request, { headers });
        });

        mockPool
            .intercept({
                path: '/datas/1',
                method: 'GET',
                headers: { 'x-token': 'refreshed' }
            })
            .reply(200, { message: 'Hello World' }, json);

        const response = await api.get<{ message: string }>(`${url}/1`);

        expect(response.data?.message).to.equal('Hello World');
    });

    it('should wait for an async in interceptor', async () => {
        const api = AbraClass.create();

        api.addInInterceptor(async (response) => {
            await new Promise(resolve => setTimeout(resolve, 20));

            const headers = new Headers(response.headers);

            headers.set('X-Async', 'done');

            return new Response(response.body, {
                status: response.status,
                statusText: response.statusText,
                headers
            });
        });

        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, { message: 'Hello World' }, json);

        const response = await api.get<{ message: string }>(`${url}/1`);

        expect(response.response.headers.get('X-Async')).to.equal('done');
        expect(response.data?.message).to.equal('Hello World');
    });

    it('should run mixed sync and async interceptors in order', async () => {
        const api = AbraClass.create();
        const calls: string[] = [];

        api.addOutInterceptor(async (request) => {
            await new Promise(resolve => setTimeout(resolve, 30));
            calls.push('slow-async');
            return request;
        });

        api.addOutInterceptor((request) => {
            calls.push('fast-sync');
            return request;
        });

        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, {}, json);

        await api.get(`${url}/1`);

        expect(calls).to.deep.equal(['slow-async', 'fast-sync']);
    });

    it('should let an interceptor remove itself while running', async () => {
        const api = AbraClass.create();
        const calls: string[] = [];

        const once = (request: Request): Request => {
            calls.push('once');
            api.removeInterceptor(once);
            return request;
        };

        api.addOutInterceptor(once);
        api.addOutInterceptor((request) => {
            calls.push('after');
            return request;
        });

        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, {}, json)
            .times(2);

        await api.get(`${url}/1`);
        await api.get(`${url}/1`);

        expect(calls).to.deep.equal(['once', 'after', 'after']);
    });

    it('should create independent instances', async () => {
        const first = AbraClass.create();
        const second = AbraClass.create();

        expect(first).to.not.equal(second);
        expect(first).to.not.equal(abra);

        first.addOutInterceptor((request) => {
            const headers = new Headers(request.headers);

            headers.set('X-Api', 'first');

            return new Request(request, { headers });
        });

        mockPool
            .intercept({
                path: '/a',
                method: 'GET',
                headers: { 'x-api': 'first' }
            })
            .reply(200, { from: 'first' }, json);

        mockPool
            .intercept({
                path: '/b',
                method: 'GET',
                headers: (headers: Record<string, string>) => !('x-api' in headers)
            })
            .reply(200, { from: 'second' }, json);

        const a = await first.get<{ from: string }>(`${baseUrl}/a`);
        const b = await second.get<{ from: string }>(`${baseUrl}/b`);

        expect(a.data?.from).to.equal('first');
        expect(b.data?.from).to.equal('second');
    });

    it('should return a typed tuple of data', async () => {
        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, { id: 1 }, json);

        mockPool
            .intercept({ path: '/posts/1', method: 'GET' })
            .reply(200, { title: 'Hello' }, json);

        // Two different types: this must compile and keep each type
        const [user, post] = await abra.all(
            abra.get<{ id: number }>(`${url}/1`),
            abra.get<{ title: string }>(`${baseUrl}/posts/1`)
        );

        expect(user.data?.id).to.equal(1);
        expect(post.data?.title).to.equal('Hello');
    });

    it('should perform a POST request with application/x-www-form-urlencoded payload', async () => {
        const formData = new URLSearchParams();

        formData.append('a', 'val_a');
        formData.append('b', 'val_b');

        mockPool
            .intercept({
                path: '/fields',
                method: 'POST',
                body: 'a=val_a&b=val_b'
            })
            .reply(200, { id: 1, a: 'val_a', b: 'val_b' }, json);

        mockPool
            .intercept({ path: '/fields/1', method: 'DELETE' })
            .reply(200, {}, json);

        const response = await abra.post<{
            id: number;
            a: string;
            b: string;
        }>(`${baseUrl}/fields`, formData, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        expect(response.data).to.deep.equal({
            id: 1,
            a: 'val_a',
            b: 'val_b'
        });

        const deleteResponse = await abra.delete<{}>(`${baseUrl}/fields/1`);

        expect(deleteResponse.data).to.deep.equal({});
    });

    it('should send an object as urlencoded when that Content-Type is set', async () => {
        mockPool
            .intercept({
                path: '/fields',
                method: 'POST',
                body: 'a=1&b=x'
            })
            .reply(200, { ok: true }, json);

        const response = await abra.post<{ ok: boolean }>(
            `${baseUrl}/fields`,
            { a: 1, b: 'x' },
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        expect(response.data?.ok).to.equal(true);
    });

    it('should return null data for an empty JSON body', async () => {
        mockPool
            .intercept({ path: '/datas/5', method: 'PUT' })
            .reply(200, '', json);

        const response = await abra.put(`${url}/5`, { message: 'x' });

        expect(response.data).to.be.null;
        expect(response.response.status).to.equal(200);
    });

    it('should parse a text response as a string', async () => {
        mockPool
            .intercept({ path: '/text', method: 'GET' })
            .reply(200, 'plain text', { headers: { 'content-type': 'text/plain' } });

        const response = await abra.get<string>(`${baseUrl}/text`);

        expect(response.data).to.equal('plain text');
    });

    it('should parse an unknown content type as a Blob', async () => {
        mockPool
            .intercept({ path: '/file', method: 'GET' })
            .reply(200, 'binary', {
                headers: { 'content-type': 'application/octet-stream' }
            });

        const response = await abra.get<Blob>(`${baseUrl}/file`);

        expect(response.data).to.be.instanceOf(Blob);
        expect(await response.data?.text()).to.equal('binary');
    });

    it('should parse a urlencoded response as FormData', async () => {
        mockPool
            .intercept({ path: '/form', method: 'GET' })
            .reply(200, 'a=1&b=2', {
                headers: { 'content-type': 'application/x-www-form-urlencoded' }
            });

        const response = await abra.get<FormData>(`${baseUrl}/form`);

        expect(response.data?.get('a')).to.equal('1');
        expect(response.data?.get('b')).to.equal('2');
    });

    it('should return null data when there is no Content-Type', async () => {
        mockPool
            .intercept({ path: '/nothing', method: 'GET' })
            .reply(200, 'ignored');

        const response = await abra.get(`${baseUrl}/nothing`);

        expect(response.data).to.be.null;
    });

    it('should send FormData as multipart, not as JSON', async () => {
        const formData = new FormData();

        formData.append('name', 'abra');

        let contentType = '';

        mockPool
            .intercept({
                path: '/uploads',
                method: 'POST',
                headers: (headers: Record<string, string>) => {
                    contentType = String(headers['content-type']);
                    return true;
                }
            })
            .reply(200, { ok: true }, json);

        const response = await abra.post<{ ok: boolean }>(
            `${baseUrl}/uploads`,
            formData
        );

        expect(response.data?.ok).to.equal(true);
        expect(contentType).to.match(/^multipart\/form-data; boundary=/);
    });

    it('should concat query params', async () => {
        mockPool
            .intercept({
                path: '/datas?id=1&message=Hello+World',
                method: 'GET'
            })
            .reply(200, { message: 'Hello World' }, json);

        const response = await abra.get(url, {
            params: { id: 1, message: 'Hello World' }
        });

        expect(response.response.url).to.equal(
            `${url}?id=1&message=Hello+World`
        );
    });

    it('should append params to a url that already has a query string', async () => {
        mockPool
            .intercept({ path: '/datas?a=1&b=2', method: 'GET' })
            .reply(200, {}, json);

        const response = await abra.get(`${url}?a=1`, { params: { b: 2 } });

        expect(response.response.url).to.equal(`${url}?a=1&b=2`);
    });

    it('should not add a trailing ? when there are no params', async () => {
        mockPool
            .intercept({ path: '/datas/1', method: 'GET' })
            .reply(200, {}, json);

        const response = await abra.get(`${url}/1`);

        expect(response.response.url).to.equal(`${url}/1`);
    });

    it('should abort when the timeout is reached', async () => {
        mockPool
            .intercept({ path: '/slow', method: 'GET' })
            .reply(200, {}, json)
            .delay(300);

        try {
            await abra.get(`${baseUrl}/slow`, { timeout: 50 });
            expect.fail('The request should have timed out');
        } catch (error) {
            expect((error as Error).name).to.be.oneOf([
                'TimeoutError',
                'AbortError'
            ]);
        }
    });

    it('should honour a user-provided AbortSignal', async () => {
        mockPool
            .intercept({ path: '/slow', method: 'GET' })
            .reply(200, {}, json)
            .delay(300);

        const controller = new AbortController();

        setTimeout(() => controller.abort(), 20);

        try {
            await abra.get(`${baseUrl}/slow`, { signal: controller.signal });
            expect.fail('The request should have been aborted');
        } catch (error) {
            expect((error as Error).name).to.equal('AbortError');
        }
    });
});