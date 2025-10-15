import { Router } from 'express';
import { resetData } from '../services/systemService.js';

const router = Router();

router.delete('/data', async (_req, res, next) => {
  try {
    await resetData();
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
