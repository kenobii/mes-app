const { Router } = require('express');
const { adminMiddleware } = require('../middleware/auth');
const { runSync, getLastSync } = require('../services/facil123Sync');

const router = Router();

let syncRunning = false;

// GET /api/sync — retorna status do último sync
router.get('/', (req, res) => {
  res.json({ running: syncRunning, lastSync: getLastSync() });
});

// POST /api/sync — dispara sync manual (admin)
router.post('/', adminMiddleware, async (req, res) => {
  if (syncRunning) {
    return res.status(409).json({ error: 'Sincronização já em andamento.' });
  }
  syncRunning = true;
  // Responde imediatamente — sync roda em background
  res.json({ ok: true, message: 'Sincronização iniciada.' });

  try {
    await runSync();
  } finally {
    syncRunning = false;
  }
});

module.exports = router;
