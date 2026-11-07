import http from 'http';

http.get('http://localhost:3000/api/users', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => { console.log(`BODY: ${data.substring(0, 500)}`); });
}).on('error', (err) => {
  console.error(`ERROR: ${err.message}`);
});
