import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Bootstraps the initial schema that was previously created by
 * TypeORM `synchronize: true` in development. This migration creates
 * the base tables in dependency order so that subsequent migrations
 * (AddRejectedSubstitute, AddUserDeletedAt, etc.) can reference them.
 *
 * Table creation order:
 *   1. user              (no FK dependencies)
 *   2. tracked_deck      (FK -> user)
 *   3. collection_card   (FK -> user)
 *   4. deck_card         (FK -> tracked_deck)
 *   5. deck_readiness_snapshot (FK -> tracked_deck)
 */
export class InitialSchema1712880000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable uuid-ossp for uuid_generate_v4()
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // ----------------------------------------------------------------- user
    await queryRunner.createTable(
      new Table({
        name: 'user',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'passwordHash',
            type: 'varchar',
            length: '60',
            isNullable: false,
          },
          {
            name: 'emailVerifiedAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'verificationTokenHash',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'verificationTokenExpiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'passwordResetTokenHash',
            type: 'varchar',
            length: '64',
            isNullable: true,
          },
          {
            name: 'passwordResetTokenExpiresAt',
            type: 'timestamptz',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'user',
      new TableIndex({
        name: 'IDX_user_email_unique',
        columnNames: ['email'],
        isUnique: true,
      }),
    );

    // --------------------------------------------------------- tracked_deck
    await queryRunner.createTable(
      new Table({
        name: 'tracked_deck',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'fabraryUlid',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'hero',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'format',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'trackedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'tracked_deck',
      new TableIndex({
        name: 'IDX_tracked_deck_user_fabrary_unique',
        columnNames: ['userId', 'fabraryUlid'],
        isUnique: true,
      }),
    );

    // ------------------------------------------------------- collection_card
    await queryRunner.createTable(
      new Table({
        name: 'collection_card',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'userId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'cardIdentifier',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'lastUpdated',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['userId'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'collection_card',
      new TableIndex({
        name: 'IDX_collection_card_user_card_unique',
        columnNames: ['userId', 'cardIdentifier'],
        isUnique: true,
      }),
    );

    // ------------------------------------------------------------ deck_card
    await queryRunner.createTable(
      new Table({
        name: 'deck_card',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'trackedDeckId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'cardIdentifier',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'quantity',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'slot',
            type: 'varchar',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['trackedDeckId'],
            referencedTableName: 'tracked_deck',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    // ------------------------------------------- deck_readiness_snapshot
    await queryRunner.createTable(
      new Table({
        name: 'deck_readiness_snapshot',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'trackedDeckId',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'rawPercent',
            type: 'float',
            isNullable: false,
          },
          {
            name: 'effectivePercent',
            type: 'float',
            isNullable: false,
          },
          {
            name: 'breakdown',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'substitutions',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'computedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['trackedDeckId'],
            referencedTableName: 'tracked_deck',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'deck_readiness_snapshot',
      new TableIndex({
        name: 'IDX_deck_readiness_snapshot_deck_computedAt',
        columnNames: ['trackedDeckId', 'computedAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('deck_readiness_snapshot');
    await queryRunner.dropTable('deck_card');
    await queryRunner.dropTable('collection_card');
    await queryRunner.dropTable('tracked_deck');
    await queryRunner.dropTable('user');
  }
}
