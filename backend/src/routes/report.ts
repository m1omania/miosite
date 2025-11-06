import { Router } from 'express';
import { getDb, initDatabase } from '../../database/db.js';

const router = Router();

let dbInitialized = false;

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ error: 'Report ID is required' });
    }

    // Initialize database if needed
    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    const db = getDb();
    
    const report = await db.get<{ id: string; url: string; report_data: string; created_at: string }>(
      'SELECT id, url, report_data, created_at FROM reports WHERE id = ?',
      [id]
    );

    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const reportData = JSON.parse(report.report_data);
    res.json(reportData);
  } catch (error) {
    console.error('Report error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
