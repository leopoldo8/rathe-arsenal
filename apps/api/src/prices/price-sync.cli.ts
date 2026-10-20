import { HttpTcgcsvClient } from './tcgcsv-client';
import { PriceSyncService } from './price-sync.service';

/** `prices:sync`: one pass by hand, with the same rules as the hourly check (never twice in a UTC day, only when tcgcsv rebuilt). */
async function main(): Promise<void> {
  const { AppDataSource } = await import('../database/datasource');
  await AppDataSource.initialize();
  try {
    const report = await new PriceSyncService(AppDataSource, new HttpTcgcsvClient()).runOnce();
    process.stdout.write(
      `groups read: ${report.groupsRead}, failed: ${report.groupsFailed}, skipped: ${report.groupsSkipped}\n`,
    );
  } finally {
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    process.stderr.write(`prices:sync failed: ${error instanceof Error ? error.message : 'unknown'}\n`);
    process.exit(1);
  });
}
