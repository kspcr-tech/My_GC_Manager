const { execSync, spawn } = require('child_process');

execSync('npm run build', { stdio: 'inherit' });
const srv = spawn('node', ['dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production' } });
srv.stdout.on('data', d => console.log(d.toString()));
srv.stderr.on('data', d => console.error(d.toString()));

setTimeout(() => {
  const http = require('http');
  http.get('http://127.0.0.1:3000/', (res) => {
    console.log('PROD STATUS:', res.statusCode);
    res.setEncoding('utf8');
    res.on('data', chunk => console.log('PROD HTML:', chunk.substring(0,200)));
    srv.kill();
  });
}, 2000);
