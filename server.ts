import { createServer } from 'http';
import next from 'next';
import { parse } from 'url';
import { initializeSocket } from './lib/socket/server';
import { taskRecoveryService } from './lib/tasks/task-recovery';
import { logger } from './lib/logging/structured-logger';
import { validateDatabaseSchema } from './lib/db/schema-validator';
import { prisma } from './lib/db';
import { initCleanupScheduler, stopCleanupScheduler } from './lib/registry/cleanup-scheduler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// Create the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Validate database schema before starting server
  try {
    await validateDatabaseSchema(prisma);
  } catch (error) {
    logger.error('Database validation failed during startup', { module: 'server' }, error as Error);
    process.exit(1);
  }

  // Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      logger.error(
        'Error occurred handling request',
        { url: req.url },
        err as Error
      );
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Initialize Socket.IO
  const io = initializeSocket(server);

  // Initialize project registry cleanup scheduler
  try {
    await initCleanupScheduler();
    logger.info('> Project registry cleanup scheduler initialized', { module: 'server' });
  } catch (error) {
    logger.error('Failed to initialize cleanup scheduler', { module: 'server' }, error as Error);
  }

  server
    .once('error', err => {
      logger.error('Server error', { module: 'server' }, err);
      process.exit(1);
    })
    .listen(port, () => {
      logger.info(`> Ready on http://${hostname}:${port}`, {
        module: 'server',
      });
      logger.info(`> Socket.IO server initialized`, { module: 'server' });
      logger.info('> Task recovery system active', { module: 'server' });
    });

  // Graceful shutdown
  let isShuttingDown = false;

  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`${signal} signal received again, forcing exit`, {
        module: 'server',
      });
      process.exit(1);
    }

    isShuttingDown = true;
    logger.info(`${signal} signal received: closing HTTP server`, {
      module: 'server',
    });

    // Set a timeout to force exit if shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      logger.error('Shutdown timeout reached, forcing exit', {
        module: 'server',
      });
      process.exit(1);
    }, 5000);

    server.close(() => {
      logger.info('HTTP server closed', { module: 'server' });
      
      // Stop cleanup scheduler
      try {
        stopCleanupScheduler();
        logger.info('Project registry cleanup scheduler stopped', { module: 'server' });
      } catch (error) {
        logger.warn('Error stopping cleanup scheduler', { module: 'server' }, error as Error);
      }
      
      if (io) {
        io.close(() => {
          logger.info('Socket.IO server closed', { module: 'server' });
          clearTimeout(forceExitTimeout);
          process.exit(0);
        });
      } else {
        clearTimeout(forceExitTimeout);
        process.exit(0);
      }
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
});
