import {expect} from 'chai';
import 'mocha';
import abra from '../dist';
import {Abra as  AbraClass } from '../dist';
//import nock = require("nock");


describe('Abra', () => {
    const url = 'http://localhost:8082/datas';
    const api = 'http://localhost:8082';


    beforeEach(() => {
       // abra = Abra();

       /* nock(url)
            .get('/1')
            .reply(200, { message: 'Hello World' });

        nock(url)
            .post('/', { id: 2, message: 'Hello, world!' })
            .reply(200, { message: 'Hello, world!' });

        nock(url)
            .put('/2', { message: 'Bonjour le monde' })
            .reply(200, { message: 'Bonjour le monde' });

        nock(url)
            .patch('/2', { message: 'Hello, world!' })
            .reply(200, { message: 'Hello, world!' });

        nock(url)
            .delete('/2')
            .reply(200, {});

        nock(url)
            .get('/404')
            .reply(404, { message: 'Error while fetching data' });

        nock(url)
            .post('/', 'field1=value1&field2=value2')
            .matchHeader('Content-Type', 'application/x-www-form-urlencoded')
            .reply(200, { message: 'Success' });*/
    });


    it('should keep the same instance', () => {
        const abra2 =AbraClass.getInstance() ;
        expect(abra).to.equal(abra2);
    });

    it('should perform a GET request', async () => {
        const response = await abra.get<{ message: string }>(url + '/1');
        expect(response?.data?.message).to.equal('Hello World');
    });

    it('should perform a POST request', async () => {
        const body = { id: 2, message: 'Hello, world!' };
        const response = await abra.post<{ message: string }>(url, body, { headers: { 'Content-Type': 'application/json' } });
        expect(response?.data?.message).to.equal('Hello, world!');
    });

    it('should perform a PUT request', async () => {
        const body = { message: 'Bonjour le monde' };
        const response = await abra.put<{ message: string }>(url + '/2', body, { headers: { 'Content-Type': 'application/json' } });
        expect(response?.data?.message).to.equal('Bonjour le monde');
    });

    it('should perform a PATCH request', async () => {
        const body = { message: 'Hello, world!' };
        const response = await abra.patch<{ message: string }>(url + '/2', body, { headers: { 'Content-Type': 'application/json' } });
        expect(response?.data?.message).to.equal('Hello, world!');
    });

    it('should perform a DELETE request', async () => {
        const response = await abra.delete<{}>(url + '/2');
        expect(response.data).to.deep.equal({});
    });


    it('should return an error for a failed request', async () => {
        try {
            await abra.get<{ message: string }>(url + '/404');
            expect.fail();
        } catch (error: any) {
          //  expect(error.message).to.equal('Error while fetching data');
        }
    });

    it('should add and remove an in interceptor', async () => {
        const interceptor: (response: Response) => Response = (response: Response) => {
            const headers = new Headers(response.headers);
            headers.append('Hello', 'World');
            return new Response(response.body, {...response, headers});
        };

        abra.addInInterceptor(interceptor);
        const response = await abra.get<{ message: string }>(url + '/1');
        expect(response.response.headers.get('Hello')).to.equal('World');
        abra.removeInterceptor(interceptor);
        const response2 = await abra.get<{ message: string }>(url);
        expect(response2.response.headers.get('Hello')).to.be.null;
    });

    it('should add and remove an out interceptor', async () => {
        const user = {email: 'toto@mail.fr', password: 'password'};
        const res = await abra.post<any>(api + '/login', user, {headers: {'Content-Type': 'application/json'}});
        console.log(res.data);
        expect(res.data.accessToken).to.not.be.undefined;

        const interceptor = (request: Request) => {
            const headers = new Headers(request.headers);
            headers.append('Authorization', 'Bearer ' + res.data.accessToken);
            return new Request(request.url, {
                ...request,
                headers
            });
        };
        abra.addOutInterceptor(interceptor);
        const {data} = await abra.get<{ message: string }>(api + '/secret');
        expect(data?.message).to.equal('Ceci est une phrase secrete');

        abra.removeInterceptor(interceptor);
        try {
            await abra.get<{ message: string }>(api + '/secret');
            expect.fail();
        } catch (error: any) {
            //expect(error.message).to.equal('Error while fetching data');
        }
        console.log('ok');
    });

    it('should return an array of data', async () => {
        const response = await abra.all(
            abra.get<{ message: string }>(url + '/1'),
            abra.get<{ message: string }>(url + '/1'),
        );
        expect(response.length).to.equal(2);
        expect(response[0].data?.message).to.equal('Hello World');
        expect(response[1].data?.message).to.equal('Hello World');
    });



    it('should perform a POST request with application/x-www-form-urlencoded payload', async () => {
        const formData = new URLSearchParams();
        formData.append('a', 'val_a');
        formData.append('b', 'val_b');
        const response = await abra.post< {id: string, a: string, b: string} >(api + '/fields', formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        expect(response?.data).to.deep.equal({id: 1, a: 'val_a', b: 'val_b'});

        const deleteResponse = await abra.delete< {} >(api + '/fields/1');
        expect(deleteResponse.data).to.deep.equal({});
    });

    it('should concat query params', async () => {
        const response = await abra.get(url, {
            params: {
                id: 1,
                message: 'Hello World'
            }
        });
        console.log('url', response.response.url);
        expect(response.response.url).to.equal(url + '?id=1&message=Hello+World');
    })

});

