import app from './app.js';
import { env } from './config/env.js';
import { checkDatabaseHealth } from './db/pool.js';

const PORT = env.PORT || 3000;

const server = app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(` Safe Route Backend listening on port ${PORT}`);
  console.log(` Environment : ${env.NODE_ENV}`);
  console.log(` Mock Mode   : ${env.MOCK_MODE ? 'ENABLED' : 'DISABLED'}`);
  console.log(`=======================================================`);

  // Verify database connectivity at startup
  const dbStatus = await checkDatabaseHealth();
  console.log(`[Database] Status: ${dbStatus.status} (${dbStatus.message || (dbStatus.postgisInstalled ? 'PostGIS Active' : 'Connected')})`);
});

// Graceful shutdown
function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;
