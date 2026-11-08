import fetch from 'node-fetch';

async function main() {
  try {
    const r = await fetch('http://localhost:3000/api/network/1?type=project');
    const j = await r.json();
    console.log(JSON.stringify(j, null, 2));
  } catch (e) {
    console.error(e);
  }
}
main();
