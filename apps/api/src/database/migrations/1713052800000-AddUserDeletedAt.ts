import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Phase 1a Unit 2 (A8) — adds a nullable `deletedAt` column to the `user`
 * table for the soft-delete flow. `JwtStrategy.validate()` rejects users
 * with a non-null `deletedAt` on the same per-request DB lookup (no extra
 * query), and `scripts/purge-deleted-users.ts` permanently removes rows
 * whose `deletedAt < now() - 30 days`.
 *
 * Must run **before** the Unit 2 code deploys (migration-first deploy).
 */
export class AddUserDeletedAt1713052800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'user',
      new TableColumn({
        name: 'deletedAt',
        type: 'timestamptz',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user', 'deletedAt');
  }
}
