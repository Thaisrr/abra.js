# Abra.JS

Abra.JS is a simple, lightweight, and easy to use Javascript library for HttP requests.

It is a wrapper around the native fetch API, and is designed to be as simple as possible.

## Installation

Abra.JS is available on NPM, and can be installed with the following command:

```bash
npm install abra.js
```

## Usage

Abra.JS is designed to be as simple as possible, and is designed to be used in a similar way to the native fetch API.

```js
import abra from 'abra.js';

abra.get('https://example.com')
    .then(data => console.log(data));
```

Abra.JS also supports the use of async/await, which is recommended for use in production.

```js
import abra from 'abra.js';

async function getData() {
    const data = await abra.get('https://example.com');
    console.log(data);
}
```

## Documentation

Abra.JS is designed to be as simple as possible.

### Get

Simple get request :

```js
    abra.get(url, options);
```

- url : (string) url to fetch
- options : (object) the options for the request ( params, headers, and any fetch options available)

### Post, Put, Patch

Simple post request :

```js
    abra.post(url, body, options);
```

- url : (string) url to fetch
- body : (object) the data to send ( any type accepted by fetch )
- options : (object) the options for the request ( params, headers, and any fetch options available)

Exemple : 

```js
    abra.post('https://example.com', 
        { name: 'Jean Micheline' }, 
        { headers: 
                { 'Content-Type': 'application/json' } 
        });
```

### Delete

Simple delete request :

```js
    abra.delete(url, options);
```


### Options

Basically any fetch options available ( see [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch) ) can be used.

Abra.JS also adds params options, which is an object containing the query parameters to add to the url.

```js
    abra.get('https://example.com', { params: { name: 'Jean Micheline' } });
```

**Caution :** the _method_ option, available in fetch, is not supported by Abra.JS, as it is automatically set by the method used.


### Interceptors

Abra.JS provides interceptors, which are functions that are called before the request is sent, and before the response is returned.

Interceptors are useful to add headers, or to modify the request before it is sent.

You can add 'in' interceptors, which are called before the request is sent, and 'out' interceptors, which are called before the response is returned.

You can add interceptors with the following methods :

```js

    // Add an interceptor for requests
    abra.addInInterceptor((request) => {
        // do something with the request
        return request;
    });


    // Add an interceptor for responses
    abra.addOutInterceptor((response) => {
        // do something with the response
        return response;
    });

```


## License

I have no idea what license to use, but feel free to use this however you want.

## Author

Abra.JS was created by Thaïs Révillon. 
You can find me on LinkedIn at [@ThaisRevillon](https://www.linkedin.com/in/tha%C3%AFs-r%C3%A9villon-66a41717a/).

## Contributing

Feel free to contribute to this project, I will be happy to review your pull requests !
Just make sure to follow the code style of the project, and the main goals of the project : simplicity and lightweight.

## Versioning

This project is still in development, and is not yet ready for production.
This is a personal project, and I will try to update it as much as possible, add tests and new features.

