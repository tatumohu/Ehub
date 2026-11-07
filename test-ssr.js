import { createServer } from 'vite';

async function test() {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
  });
  
  try {
    const { renderToString } = await vite.ssrLoadModule('/node_modules/react-dom/server.js');
    const { createElement } = await vite.ssrLoadModule('/node_modules/react/index.js');
    const Profile = (await vite.ssrLoadModule('/src/pages/Profile.tsx')).default;
    
    // We would need AppContext etc., might be hard to mock.
    console.log("Profile module loaded.");
  } catch (e) {
    console.error("Error loading:", e);
  }
  
  vite.close();
}
test();
