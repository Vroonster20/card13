// server.ts (root)
// Custom Next.js server that integrates Socket.IO
// Run with: ts-node --project tsconfig.server.json server.ts

import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { setupSocketServer } from './src/server/socket-server';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME ?? 'localhost';
const port = parseInt(process.env.PORT ?? '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling request', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  const io = setupSocketServer(httpServer);

  // Store io globally for use in API routes if needed
  (global as any).__socketio = io;

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`▲ Next.js ${dev ? 'development' : 'production'} server ready on http://${hostname}:${port}`);
      console.log(`⚡ Socket.IO server ready`);
    });
});