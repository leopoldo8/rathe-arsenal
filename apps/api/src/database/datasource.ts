import { DataSource } from 'typeorm';
import { join } from 'path';

/**
 * Standalone TypeORM DataSource used by the migration CLI and the
 * `scripts/delete-user.ts` dev script. The NestJS app builds its own
 * datasource via TypeOrmModule.forRootAsync() in Unit 2.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: false,
});
