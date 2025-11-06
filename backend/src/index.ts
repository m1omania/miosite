import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import auditRoutes from './routes/audit.js';
import reportRoutes from './routes/report.js';
import leadsRoutes from './routes/leads.js';
import { initDatabase } from '../database/db.js';

dotenv.config();

// Initialize database on startup
initDatabase().catch(console.error);

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:4000',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/audit', auditRoutes);
app.use('/api/report', reportRoutes);
app.use('/api/leads', leadsRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

