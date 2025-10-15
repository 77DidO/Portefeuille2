import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import portfolioRoutes from './routes/portfolioRoutes.js';
import assetRoutes from './routes/assetRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import importRoutes from './routes/importRoutes.js';
import { ensureGlobalPortfolio } from './services/importService.js';

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/portfolios', portfolioRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/import', importRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof Error) {
    res.status(400).json({ message: err.message });
    return;
  }
  res.status(500).json({ message: 'Erreur serveur inconnue' });
});

app.listen(port, async () => {
  await ensureGlobalPortfolio();
  console.log(`API portefeuille démarrée sur http://localhost:${port}`);
});
