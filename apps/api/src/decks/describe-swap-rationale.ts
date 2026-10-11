import { describeRationale, IRationaleDetail, TSubstitutionTier } from '@rathe-arsenal/engine';
import { CatalogService } from '../catalog/catalog.service';

export function describeSwapRationale(
  catalogService: CatalogService,
  originalIdentifier: string,
  substituteIdentifier: string,
  tier: TSubstitutionTier,
): IRationaleDetail | null {
  try {
    return describeRationale(
      catalogService.getCard(originalIdentifier),
      catalogService.getCard(substituteIdentifier),
      tier,
    );
  } catch {
    return null;
  }
}
