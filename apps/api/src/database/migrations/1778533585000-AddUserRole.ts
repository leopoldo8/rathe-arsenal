import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Adds `user.role` for role-based authorization (default 'user'). Replaces the
 * earlier env-email owner check with a proper DB-backed role, so any user can
 * be promoted to 'admin' by updating this column.
 */
export class AddUserRole1778533585000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'user',
      new TableColumn({
        name: 'role',
        type: 'varchar',
        length: '20',
        isNullable: false,
        default: "'user'",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('user', 'role');
  }
}
