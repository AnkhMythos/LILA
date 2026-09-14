// backend/src/routes/memory.js
import express from 'express';
import memoryStore from '../services/memoryStore.js';

const router = express.Router();

router.get('/:userId', async (req, res) => {
    const { userId } = req.params;
    const data = memoryStore.get(userId);
    res.json(data);
});

router.post('/:userId', async (req, res) => {
    const { userId } = req.params;
    const { key, value } = req.body;
    if (!key || value === undefined) {
        return res.status(400).json({ error: 'Se requiere key y value' });
    }
    await memoryStore.set(userId, key, value);
    res.json({ status: 'ok' });
});

router.delete('/:userId/:key', async (req, res) => {
    const { userId, key } = req.params;
    const result = await memoryStore.delete(userId, key);
    res.json({ deleted: result });
});

router.delete('/:userId', async (req, res) => {
    const { userId } = req.params;
    const result = await memoryStore.deleteAll(userId);
    res.json({ deleted: result });
});

export default router;