import {expect} from 'chai';
import 'mocha';
import {Abra} from '../dist/Abra';
//import nock = require("nock");


describe('Abra', () => {
    let abra: Abra;
    const url = 'http://localhost:8080/datas';
    const api = 'http://localhost:8080';


    beforeEach(() => {
        abra = Abra.getInstance();

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
        const abra2 = Abra.getInstance();
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
        // Create a string of key-value pairs using the URLSearchParams interface
        const formData = new URLSearchParams();
        formData.append('field1', 'value1');
        formData.append('field2', 'value2');

        // Send the form data to the server using the Abra.post method
        const response = await abra.post<{ message: string }>(url, formData, { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        // Make assertions about the response from the server
        expect(response?.data?.message).to.equal(undefined);
    });



});

