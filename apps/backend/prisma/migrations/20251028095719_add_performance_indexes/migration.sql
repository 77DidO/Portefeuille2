-- Add performance indexes for frequently queried columns
-- Index on Asset.symbol for faster lookups
CREATE INDEX IF NOT EXISTS "idx_asset_symbol" ON "Asset"("symbol");

-- Index on Asset.portfolioId for faster joins
CREATE INDEX IF NOT EXISTS "idx_asset_portfolio_id" ON "Asset"("portfolioId");

-- Index on Transaction.date for faster time-based queries
CREATE INDEX IF NOT EXISTS "idx_transaction_date" ON "Transaction"("date");

-- Index on Transaction.assetId for faster asset transaction lookups
CREATE INDEX IF NOT EXISTS "idx_transaction_asset_id" ON "Transaction"("assetId");

-- Index on PricePoint.date for faster historical queries
CREATE INDEX IF NOT EXISTS "idx_pricepoint_date" ON "PricePoint"("date");

-- Index on PricePoint.assetId for faster asset price lookups
CREATE INDEX IF NOT EXISTS "idx_pricepoint_asset_id" ON "PricePoint"("assetId");

-- Composite index for asset-date queries (already has unique constraint but added for clarity)
-- CREATE INDEX IF NOT EXISTS "idx_pricepoint_asset_date" ON "PricePoint"("assetId", "date");
