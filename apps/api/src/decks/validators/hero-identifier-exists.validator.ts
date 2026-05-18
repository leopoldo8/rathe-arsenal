import { Injectable } from '@nestjs/common';
import {
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { catalog } from '@rathe-arsenal/engine';
import { Type } from '@rathe-arsenal/engine';

/**
 * class-validator constraint that checks whether a `heroIdentifier` string
 * maps to a Hero-type card in the catalog.
 *
 * Wired as a NestJS-injectable so that tests and U6 can inject a mock catalog.
 * At runtime the validator falls back to the static catalog singleton because
 * `useContainer` is not yet configured in `main.ts` (tracked as a gap for U6
 * to resolve: add `useContainer(app.select(AppModule), { fallbackOnErrors: true })`
 * before `app.listen()`). Without `useContainer`, class-validator instantiates
 * this class without DI and `this.catalog` falls back to the singleton below.
 *
 * Shared infrastructure: U6 reuses this validator for the
 * `PUT /decks/:id` `UpdateDeckCompositionDto`.
 */
@ValidatorConstraint({ name: 'HeroIdentifierExistsInCatalog', async: false })
@Injectable()
export class HeroIdentifierExistsInCatalog
  implements ValidatorConstraintInterface
{
  validate(identifier: unknown): boolean {
    if (typeof identifier !== 'string' || identifier.length === 0) {
      return false;
    }

    const card = catalog.indices.byIdentifier.get(identifier);
    if (!card) {
      return false;
    }

    return (card.types as readonly string[]).includes(Type.Hero as string);
  }

  defaultMessage(): string {
    return 'heroIdentifier must be a valid hero card identifier';
  }
}
