import './env.js'; // Load environment variables first
import app from './app.js';
import { prisma } from './lib/prisma.js';
// Server initialization



const PORT = process.env.PORT || 4400;

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('Received shutdown signal. Closing server gracefully...');

  try {
    await prisma.$disconnect();
    console.log('Database connection closed.');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Server listening on port ${PORT}`);
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);

const parsed = (process.env.SUPER_ADMIN_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

console.log('Super-admin whitelist at runtime:', parsed);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});