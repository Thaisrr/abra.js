# Abra.JS

Abra.JS is a simple, lightweight and easy to use library for HTTP requests.

It is a thin wrapper around the native `fetch` API. No more `.json()`: your data is available in the `.data` property of the result.

## Installation

```bash
npm install abra.js
```

Abra.JS is an **ES module** and requires **Node.js 20 or later** (or any modern browser, through your bundler). It relies on the native `fetch`, `Request`, `Response` and `Headers`, so there is nothing to polyfill.

```js
import abra from 'abra.js';
```

The default export is a ready to use instance (a singleton). If you need the class itself, for example for typing:

```ts
import abra, { Abra } from 'abra.js';

abra === Abra.getInstance(); // true
```

## Usage

```js
import abra from 'abra.js';

abra.get('https://example.com/api/users')
    .then(res => console.log(res.data));
```

`async/await` works the same way:

```js
async function getUsers() {
    const { data, response } = await abra.get('https://example.com/api/users');

    console.log(data);            // parsed body
    console.log(response.status); // the original fetch Response
}
```

Every request resolves to `{ data, response }`:

- `data`: the parsed body (see [Response parsing](#response-parsing))
- `response`: the native `Response` object, for headers, status, url...

With TypeScript, you can type the data:

```ts
type User = { id: number; name: string };

const { data } = await abra.get<User[]>('https://example.com/api/users');
```

## Documentation

### Get

```js
abra.get(url, options);
```

- `url`: (string) the URL to fetch
- `options`: (object) the options of the request (`params`, `headers`, `timeout`, and any fetch option)

### Post, Put, Patch

```js
abra.post(url, body, options);
abra.put(url, body, options);
abra.patch(url, body, options);
```

- `url`: (string) the URL to fetch
- `body`: (object) the data to send, see below
- `options`: (object) the options of the request

```js
abra.post('https://example.com/api/users', { name: 'Jean Micheline' });
```

Abra.JS handles the body for you:

| Body you give                                              | What is sent                                              |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| An object or an array                                      | JSON, with `Content-Type: application/json` added for you |
| A `FormData`                                               | `multipart/form-data`, boundary handled by fetch          |
| A `URLSearchParams`                                        | `application/x-www-form-urlencoded`                       |
| A string, `Blob`, `ArrayBuffer`, typed array or stream     | Sent as is                                                |

If you set your own `Content-Type` header with an object body, Abra.JS only serializes it to JSON when that header is a JSON type. Otherwise, the body is passed as is and the transformation is up to you.

```js
// Upload a file
const form = new FormData();
form.append('file', fileInput.files[0]);

await abra.post('https://example.com/upload', form);

// Form urlencoded
await abra.post(
    'https://example.com/login',
    new URLSearchParams({ email: 'toto@mail.fr', password: 'secret' })
);
```

**Do not set `Content-Type: multipart/form-data` by hand.** Abra.JS removes it, because fetch must generate it itself to add the boundary.

### Delete

```js
abra.delete(url, options);
```

### All

Run several requests in parallel:

```js
const [users, posts] = await abra.all(
    abra.get('https://example.com/api/users'),
    abra.get('https://example.com/api/posts')
);

console.log(users.data, posts.data);
```

### Options

Any [fetch option](https://developer.mozilla.org/en-US/docs/Web/API/fetch#options) can be used (`headers`, `credentials`, `mode`, `cache`...), plus two extra ones:

#### `params`

An object (or a `URLSearchParams`) of query parameters to add to the URL.

```js
abra.get('https://example.com/api/users', { params: { name: 'Jean Micheline', page: 2 } });
// GET https://example.com/api/users?name=Jean+Micheline&page=2
```

If the URL already contains a query string, the params are appended to it.

#### `timeout`

A delay in milliseconds. If the server has not answered in time, the request is aborted and the promise rejects with a `TimeoutError`.

```js
abra.get('https://example.com/api/slow', { timeout: 5000 });
```

You can also pass your own `signal`. It is combined with the timeout, whichever comes first aborts the request.

```js
const controller = new AbortController();

abra.get('https://example.com/api/users', { signal: controller.signal });

controller.abort();
```

**Caution:** the `method` option of fetch is not supported, it is set by the method you call.

### Response parsing

`data` is parsed according to the `Content-Type` of the response:

| Content-Type                                                 | `data`                  |
| ------------------------------------------------------------ | ----------------------- |
| contains `json`                                              | the parsed JSON         |
| `text/*` or `application/xml`                                | a string                |
| `multipart/form-data` or `application/x-www-form-urlencoded` | a `FormData`            |
| anything else                                                | a `Blob`                |
| no `Content-Type`, or `204` / `205` / empty body             | `null`                  |

### Errors

When the status is not in the 2xx range, the promise **rejects** with an `AbraError`, which extends `Error`:

| Property     | Content                                                          |
| ------------ | ---------------------------------------------------------------- |
| `status`     | the HTTP status code, e.g. `404`                                 |
| `statusText` | the HTTP status text, e.g. `Not Found`                           |
| `data`       | the body of the error: parsed JSON, raw text, or `null` if empty |
| `response`   | the native `Response` (headers, url...), its body is already read |

```js
import abra, { AbraError } from 'abra.js';

try {
    await abra.get('https://example.com/api/users/404');
} catch (error) {
    if (error instanceof AbraError) {
        console.log(error.status); // 404
        console.log(error.data);   // for example { message: 'User not found' }
    } else {
        throw error; // network error, timeout, abort...
    }
}
```

You can type `data`:

```ts
type ApiError = { message: string };

if (error instanceof AbraError) {
    const { message } = (error as AbraError<ApiError>).data;
}
```

Network errors, timeouts and aborts are **not** wrapped: they reject with the usual `TypeError`, `TimeoutError` and `AbortError` of fetch.

### Interceptors

Interceptors are functions that let you change a request before it is sent, or a response before it is returned.

- **Out** interceptors receive the **request** before it is sent.
- **In** interceptors receive the **response** before it is parsed.

```js
// Add a header to every request
const addToken = (request) => {
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return new Request(request, { headers });
};

abra.addOutInterceptor(addToken);

// Do something with every response
const logResponse = (response) => {
    console.log(response.status, response.url);
    return response;
};

abra.addInInterceptor(logResponse);
```

An interceptor must **return** a `Request` (out) or a `Response` (in), or a promise of one. Interceptors can be `async`, and Abra.JS waits for each of them before calling the next one:

```js
let token = null;

abra.addOutInterceptor(async (request) => {
    token ??= await fetchToken();

    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return new Request(request, { headers });
});
```

An in interceptor only receives the response, not the request that produced it. It is therefore not the right place to retry a failed request.

When you build a new object, use `new Request(request, { headers })`. Do not spread it (`{ ...request }`): the method, the body and the signal would be lost.

Interceptors are called in the order they were added. To change that:

```js
abra.addOutInterceptor(callback);              // appended at the end (default)
abra.addOutInterceptor(callback, true);        // first
abra.addOutInterceptor(callback, false, true); // last (same as the default)
```

`addInInterceptor` takes the same arguments.

To remove an interceptor, give the same function back:

```js
abra.removeInterceptor(addToken);
```

## Several instances

The default export is a shared instance, and so are its interceptors: they apply to every request made through it, anywhere in your app. If you talk to several APIs, create independent instances:

```js
import { Abra } from 'abra.js';

const github = Abra.create();
const internal = Abra.create();

github.addOutInterceptor(addGithubToken);
internal.addOutInterceptor(addInternalToken);
```

`Abra.create()` returns a new instance each time, with no interceptors. `Abra.getInstance()` always returns the shared one.

## Migrating from 1.x

- **Errors**: failed requests used to reject with the raw body of the response. They now reject with an `AbraError` (see [Errors](#errors)): read the old value in `error.data`.
- **Node.js 20.3 or later** is required, and `isomorphic-fetch` is no longer used.
- **Interceptors order**: a new interceptor used to be inserted in second position. It is now appended at the end, `first` still puts it at the beginning.
- **ES module only**: `require('abra.js')` is no longer supported.
- 
## License

MIT, feel free to use this however you want.

## Author

Abra.JS was created by Thaïs Labouré.

## Contributing

Feel free to contribute to this project, I will be happy to review your pull requests!
Just make sure to follow the code style of the project, and its main goals: simplicity and lightweight.

```bash
npm install
npm test
```

## Versioning

This is a personal project, and I will try to update it as much as possible, add tests and new features.