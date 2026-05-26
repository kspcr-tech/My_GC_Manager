const http = require('http');

http.get('http://127.0.0.1:3000/index.tsx', (res) => {
  console.log('STATUS:', res.statusCode);
  res.setEncoding('utf8');
  res.on('data', (chunk) => console.log('BODY:', chunk.substring(0, 200)));
}).on('error', (e) => console.error(e));
