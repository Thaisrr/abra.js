import {AbraConfigs, HttpMethod, Interceptor} from "./types";

export class Abra {

    private outInterceptors: Interceptor<Request>[] = [];
    private inInterceptors: Interceptor<Response>[] = [];
    private static instance: Abra;

    private constructor() {}

    static getInstance() {
        if (!Abra.instance) {
            Abra.instance = new Abra();
        }
        return Abra.instance;
    }

    async get<T>(url: string, options?: AbraConfigs) {
        return await this.cadabra<T>(url, options, 'GET');
    }

    async post<T>(url: string, body: object, options?: AbraConfigs) {
        return await this.cadabra<T>(url, {...options}, 'POST', body);
    }

    async put<T extends object>(url: string, body: object, options?: AbraConfigs) {
        return await this.cadabra<T>(url, {...options}, 'PUT', body);
    }

    async delete<T>(url: string, options?: AbraConfigs) {
        return await this.cadabra<T>(url, options, 'DELETE');
    }

    async patch<T>(url: string, body: Partial<T>, options?: AbraConfigs) {
        return await this.cadabra<T>(url, {...options}, 'PATCH', body);
    }

    async all<T>(...requests: Promise<T>[]) {
        return await Promise.all(requests);
    }

    private async handleRequest<T>(response: Response) {
        let data: T | null = null;
        if (!response.ok) {
            const error = await response.json();
            throw Error(error.message);
        }
        const contentType = response.headers.get('Content-Type') || response.headers.get('content-type');
        if(contentType) {
            if(contentType.includes('application/json')) {
                data = await response.json() as T;
            } else if (contentType.includes('text/') || contentType.includes('application/xml')) {
                data = await response.text() as unknown as T;
            }  else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
                data = await response.formData() as unknown as T;
            } else {
                data = await response.blob() as unknown as T;
            }
        }
        return {data, response: response};
    }

    private addToInterceptors<T extends Response | Request>(callback: Interceptor<T>, interceptors: Interceptor<T>[], first?: boolean, last?: boolean) {
        if (first) {
            interceptors.unshift(callback);
        } else if (last) {
            interceptors.push(callback);
        } else {
            interceptors.splice(1, 0, callback);
        }
    }

    addInInterceptor(callback: (response: Response) => Response, first = false, last = false) {
            this.addToInterceptors(callback, this.inInterceptors, first, last);
    }

    addOutInterceptor(callback: (request: Request) => Request, first = false, last = false) {
        this.addToInterceptors(callback, this.outInterceptors, first, last);
    }

    removeInterceptor(interceptor: Interceptor<any>) {
        const i_in = this.inInterceptors.findIndex(i => i == interceptor);
        const i_out = this.outInterceptors.findIndex(i => i == interceptor);
        if (i_out > -1) {
            this.outInterceptors.splice(i_out, 1);
        }
        if (i_in > -1) {
            this.inInterceptors.splice(i_in, 1);
        }
    }

    private applyOutInterceptors(request: Request) {
        return  this.outInterceptors.reduce((req, interceptor) => interceptor(req), request);
    }

    private applyInInterceptors(response:  Response) {
        return this.inInterceptors.reduce((res, interceptor) => interceptor(res), response);
    }

    private initRequest(method: HttpMethod, url: string, options?: AbraConfigs, body?: object, abortController? : AbortController) {
        const headers = new Headers(options?.headers);
        if(!headers.get('Content-Type') && body) {
            headers.set('Content-Type', 'application/json');
        }
        return new Request(url + (options?.params || ''), {
            ...options,
            method,
            headers,
            body: (body) ? JSON.stringify(body) :   null,
            signal: abortController?.signal || null,
        });
    }

    /**
     * @description Perform the request, with the given options and interceptors.
     * @param url
     * @param options
     * @param method
     * @param body
     * @returns Promise<T> : the datas returned by the server
     */
    async cadabra<T>(url: string, options?: AbraConfigs, method: HttpMethod = 'GET', body?: object): Promise<{ data: T | null, response: Response }> {
        try {
            const abortController = (options?.timeout)? new AbortController() : undefined ;
            let initial_request = this.initRequest(method, url, options, body, abortController);

            let final_request = this.applyOutInterceptors(initial_request.clone());
            let res = await fetch(final_request);
            if(abortController && options?.timeout) {
                setTimeout(() => abortController.abort(), options.timeout);
            }
            res = this.applyInInterceptors(res);
            return await this.handleRequest<T>(res);
        } catch (e) {
            console.log(e);
            throw e;
        }

    }
}

export default Abra.getInstance();
