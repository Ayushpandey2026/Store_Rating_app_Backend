require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { initDb } = require('./config/initDb');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const storeRoutes = require('./routes/stores');

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET is required in .env');
  process.exit(1);
}
if (!process.env.DB_PASSWORD) {
  console.error('❌ DB_PASSWORD is required in .env');
  process.exit(1);
}

const app = express();

// Middleware
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
].filter(Boolean);

// Allow common hosting platforms (Render, Vercel, Netlify, GitHub Pages)
const isKnownPlatform = (origin) => {
  if (!origin) return false;
  return origin.endsWith('.onrender.com') ||
         origin.endsWith('.vercel.app') ||
         origin.endsWith('.netlify.app') ||
         origin.endsWith('.github.io');
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isKnownPlatform(origin)) {
      callback(null, true);
    } else {
      console.warn(`Blocked CORS origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later' },
});
app.use('/api', limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/stores', storeRoutes);

// Health checks
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));
app.get('/api/health/db', async (req, res) => {
  try {
    const pool = require('./config/db');
    const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
    res.json({ status: 'OK', users: parseInt(result.rows[0].user_count), timestamp: new Date() });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', message: err.message });
  }
});

// 404 handler
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

// Start server after DB init
(async () => {
  const dbResult = await initDb();
  if (!dbResult.success) {
    console.error('❌ Server startup aborted: database initialization failed');
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
})();
