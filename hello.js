const Abra = require('./dist/index').default();
Abra.get('https://api.github.com/users/Thaisrr').then(console.log);
