import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 1b Unit 1 — seeds the single allow-listed store for Phase 1b.
 *
 * Cúpula DT is the only store in the allow-list for Phase 1b (R30, R31).
 * Explicit consent and a crawl-rate exception (1-2s per request, overriding
 * the robots.txt Crawl-delay of 360s) were granted by the store owner —
 * a personal friend of the project owner. Full artifact:
 *   docs/brainstorms/gates/gate-2-cupula-dt-consent-and-accuracy.md
 *
 * rateLimitMs=1500 encodes the Gate 2 exception as data, not code, so it
 * can be adjusted without a deployment if the owner changes their preference.
 */
export class SeedCupulaDt1744329601000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO store (slug, name, "baseUrl", "listingPath", "rateLimitMs", active, "lastScrapedAt", "lastFetchedAt")
      VALUES (
        'cupula-dt',
        'Cúpula DT',
        'https://www.cupuladt.com.br',
        '/?view=ecom/itens&tcg=8',
        1500,
        true,
        NULL,
        NULL
      )
      ON CONFLICT (slug) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM store WHERE slug = 'cupula-dt'`);
  }
}
