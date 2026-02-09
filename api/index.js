import app from '../src/app.js';
import connectDB from '../src/config/db.js';
import authRoutes from '../src/route/auth.routes.js';
import issueRoutes from '../src/route/issue.routes.js';

// 1. Connect to DB (Vercel will reuse the connection across requests)
connectDB();

// 2. Attach Routes
app.use('/api/auth', authRoutes);
app.use('/api/issues', issueRoutes);

// 3. Health check for production testing
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', environment: 'production' });
});

// 4. Export for Vercel
export default app;