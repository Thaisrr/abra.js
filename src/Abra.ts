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

    private async handleRequest<T>(response: Response) {
        if (!response.ok) {
            const error = await response.json();
            throw Error(error.message);
        }
        return await response.json() as T;
    }

    private addToInterceptors<T extends Response | Request>(i: Interceptor<T>, interceptors: Interceptor<T>[], first?, last?) {
        if (first) {
            interceptors.unshift(i);
        } else if (last) {
            interceptors.push(i);
        } else {
            interceptors.splice(1, 0, i);
        }
    }

    addInInterceptor(interceptor: Interceptor<Response>, first = false, last = false) {
            this.addToInterceptors(interceptor, this.inInterceptors, first, last);
    }

    addOutInterceptor(interceptor: Interceptor<Request>, first = false, last = false) {
        this.addToInterceptors(interceptor, this.outInterceptors, first, last);
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
     * @returns Promise<T> : the datas returned by the server
     */
    async cadabra<T>(url: string, options?: AbraConfigs, method: HttpMethod = 'GET') {
        try {
            let request = new Request(url + (options?.params || ''), {
                method,
                ...options
            });
            request = this.applyOutInterceptors(request.clone());
            let res = await fetch(request);
            res = this.applyInInterceptors(res);
            return await this.handleRequest<T>(res);
        } catch (e) {
            console.log(e);
            throw e;
        }

    }
}

export default Abra.getInstance();
