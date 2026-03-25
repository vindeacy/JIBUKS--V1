import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

// Import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import familyRoutes from './routes/family.js';
import transactionRoutes from './routes/transactions.js';
import categoryRoutes from './routes/categories.js';
import paymentMethodRoutes from './routes/paymentMethods.js';
import dashboardRoutes from './routes/dashboard.js';
import goalsRoutes from './routes/goals.js';
import accountsRoutes from './routes/accounts.js';
import reportsRoutes from './routes/reports.js';
import businessRoutes from './routes/business.js';

// Professional Accounting Routes
import vendorsRoutes from './routes/vendors.js';
import purchasesRoutes from './routes/purchases.js';
import inventoryRoutes from './routes/inventory.js';
import bankRoutes from './routes/bank.js';
import fixedAssetsRoutes from './routes/fixed-assets.js';
import customersRoutes from './routes/customers.js';
import invoicesRoutes from './routes/invoices.js';
import chequesRoutes from './routes/cheques.js';
import transfersRoutes from './routes/transfers.js';
import lendingRoutes from './routes/lending.js';
import vatRatesRoutes from './routes/vat-rates.js';
import superAdminRoutes from './routes/super-admin.js';

// Registered routes
const app = express();

// Get configuration from environment
const LOCAL_IP = process.env.LOCAL_NETWORK_IP || '192.168.1.69';
const PORT = process.env.PORT || '4001';

// Build dynamic CORS origins
const buildCorsOrigins = () => {
  const developmentOrigins = [
    // Localhost for iOS simulator and web
    'http://localhost:4001',
    'http://localhost:8081',
    `http://localhost:${PORT}`,

    // Android emulator special IP
    'http://10.0.2.2:4001',
    'http://10.0.2.2:8081',
    `http://10.0.2.2:${PORT}`,
    'exp://10.0.2.2:8081',

    // Local network IP (for physical devices)
    `http://${LOCAL_IP}:4001`,
    `http://${LOCAL_IP}:8081`,
    `http://${LOCAL_IP}:${PORT}`,
    `exp://${LOCAL_IP}:8081`,
  ];

  const productionOrigins = [
    'https://jibuksapi.apbcafrica.com',
    'https://jibuks.apbcafrica.com', // web app if available
    null, // mobile apps often send Origin: null
  ];

  return process.env.NODE_ENV === 'production' ? productionOrigins : developmentOrigins;
};

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = buildCorsOrigins();
    console.log('🌐 CORS check - Origin:', origin, 'Allowed:', allowedOrigins.includes(origin));
    
    // Allow requests with no origin (mobile apps) or allowed origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    console.error('❌ CORS blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging for debugging
app.use((req, res, next) => {
  console.log('📥 Request:', {
    method: req.method,
    url: req.url,
    origin: req.headers.origin,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  });
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'JIBUKS backend – running successfully on Contabo',
    timestamp: new Date().toISOString(),
    network: {
      localIP: LOCAL_IP,
      port: PORT
    }
  });
});

// Serve static files (uploads)
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Root endpoint
app.get('/', (req, res) => res.json({ ok: true, message: 'JIBUKS backend' }));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/family', familyRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/payment-methods', paymentMethodRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/goals', goalsRoutes);
app.use('/api/accounts', accountsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/business', businessRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Professional Accounting Routes
app.use('/api/vendors', vendorsRoutes);
app.use('/api/purchases', purchasesRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/bank', bankRoutes);
app.use('/api/fixed-assets', fixedAssetsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/cheques', chequesRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/lending', lendingRoutes);
app.use('/api/vat-rates', vatRatesRoutes);
app.use('/api/super-admin', superAdminRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

export default app;