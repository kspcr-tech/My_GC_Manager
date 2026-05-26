const { execSync } = require('child_process');
try {
  execSync('npm run build', { stdio: 'inherit' });
  const server = require('child_process').spawn('node', ['dist/server.cjs']);
  server.stdout.on('data', d => console.log(d.toString()));
  server.stderr.on('data', d => console.error(d.toString()));
  
  setTimeout(async () => {
    try {
      const res = await fetch('http://127.0.0.1:3000/api/health');
      const text = await res.text();
      console.log('Health check:', text);
      
      const proxyUrl = 'http://127.0.0.1:3000/api/proxyCheckBalance?url=' + encodeURIComponent("https://gift-card-balance-api.onrender.com/api/checkBalance?cardNumber=1006770147949188&pin=194374");
      const res2 = await fetch(proxyUrl);
      const text2 = await res2.text();
      console.log('Proxy check status:', res2.status);
      console.log('Proxy check response:', text2);
      
    } catch(e) { console.error('Fetch error:', e); }
    server.kill();
  }, 2000);
} catch(e) { }
