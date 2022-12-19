import {AbraConfigs, HttpMethod, Interceptor} from "./types";

export class Abra {

    private outInterceptors: Interceptor<Request>[] = [];
    private inInterceptors: Interceptor<Response>[] = [];
    private static instance: Abra;

    private constructor() {}

    static getInstance() {
        return Abra.instance || new Abra();
    }


    async get<T>(url: string, options?: AbraConfigs) {
        return await this.cadabra<T>(url, options, 'GET');
    }

    async post<T>(url: string, body: BodyInit, options?: AbraConfigs) {
        return await this.cadabra<T>(url, {...options, body}, 'POST');
    }

    async put<T>(url: string, body: BodyInit, options: AbraConfigs) {
        return await this.cadabra<T>(url, {...options, body}, 'PUT');
    }

    async delete<T>(url: string, options: AbraConfigs) {
        return await this.cadabra<T>(url, options, 'DELETE');
    }

    async patch<T>(url: string, body: BodyInit, options?: AbraConfigs) {
        return await this.cadabra<T>(url, {...options, body}, 'PATCH');
    }

    async all<T>(...requests: Promise<T>[]) {
        return await Promise.all(requests);
    }

    private async handleRequest<T>(response: Response) {
        if (!response.ok) {
            const error = await response.json();
            throw Error(error.message);
        }
        return await response.json() as T;
    }

    private addToInterceptors<T extends Response | Request>(callback: (r: T) => T, interceptors: Interceptor<T>[], first?, last?) {
        if (first) {
            interceptors.unshift({intercept: callback});
        } else if (last) {
            interceptors.push({intercept: callback});
        } else {
            interceptors.splice(1, 0, {intercept: callback});
        }
    }

    addInInterceptor(callback: (response: Response) => Response, first = false, last = false) {
            this.addToInterceptors(callback, this.inInterceptors, first, last);
    }

    addOutInterceptor(callback: (request: Request) => Request, first = false, last = false) {
        this.addToInterceptors(callback, this.outInterceptors, first, last);
    }

    removeInterceptor(interceptor: Interceptor<any>) {
        const i_in = this.inInterceptors.indexOf(interceptor);
        const i_out = this.outInterceptors.indexOf(interceptor);
        if (i_out > -1) {
            this.outInterceptors.splice(i_out, 1);
        }
        if (i_in > -1) {
            this.inInterceptors.splice(i_in, 1);
        }
    }

    private applyOutInterceptors(request: Request) {
        return  this.outInterceptors.reduce((req, interceptor) => interceptor.intercept(req), request);
    }

    private applyInInterceptors(response:  Response) {
        return this.inInterceptors.reduce((res, interceptor) => interceptor.intercept(res), response);
    }

    /**
     * @description Perform the request, with the given options and interceptors.
     * @param url
     * @param options
     * @param method
     * @returns Promise<T> : the mocks returned by the server
     */
    async cadabra<T>(url: string, options?: AbraConfigs, method: HttpMethod = 'GET') {
        try {
            const abortController = (options.timeout)? new AbortController() : null ;
            let request = new Request(url + (options?.params || ''), {
                method,
                ...options,
                signal: abortController?.signal || null,
                body: options?.body ? JSON.stringify(options.body) : null,
            });

            request = this.applyOutInterceptors(request.clone());
            let res = await fetch(request);
            if(abortController) {
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
