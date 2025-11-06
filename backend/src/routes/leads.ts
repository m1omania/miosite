import { Router } from 'express';
import { getDb, initDatabase } from '../../database/db.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

let dbInitialized = false;

router.post('/', async (req, res) => {
  try {
    const { reportId, name, phone, email, comment } = req.body;
    
    // Validation
    if (!reportId || !name || !phone || !email) {
      return res.status(400).json({ 
        error: 'Missing required fields: reportId, name, phone, email are required' 
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Basic phone validation (at least 10 digits)
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    // Initialize database if needed
    if (!dbInitialized) {
      await initDatabase();
      dbInitialized = true;
    }

    const db = getDb();

    // Verify report exists
    const report = await db.get('SELECT id FROM reports WHERE id = ?', [reportId]);
    if (!report) {
      return res.status(404).json({ error: 'Report not found' });
    }

    // Save lead
    const leadId = uuidv4();
    await db.run(
      'INSERT INTO leads (id, report_id, name, phone, email, comment) VALUES (?, ?, ?, ?, ?, ?)',
      [leadId, reportId, name, phone, email, comment || null]
    );

    res.json({ 
      success: true, 
      leadId,
      message: 'Lead saved successfully' 
    });
  } catch (error) {
    console.error('Leads error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
