import { ConfigService } from '@nestjs/config';

export interface IStoreAnswersConfig {
  readonly priceValidDays: number;
  readonly availabilityPassDays: number;
  readonly monthlyCreditBudget: number;
  readonly creditsPerPass: number;
  readonly creditsPerDetail: number;
  readonly creditsPerListingPage: number;
}

const DEFAULTS: IStoreAnswersConfig = {
  priceValidDays: 30,
  availabilityPassDays: 7,
  monthlyCreditBudget: 1000,
  creditsPerPass: 150,
  creditsPerDetail: 5,
  creditsPerListingPage: 1,
};

function readNumber(config: Pick<ConfigService, 'get'>, key: string, fallback: number): number {
  const raw = config.get<number | string | undefined>(key);
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function readStoreAnswersConfig(config: Pick<ConfigService, 'get'>): IStoreAnswersConfig {
  return {
    priceValidDays: readNumber(config, 'STORE_PRICE_VALID_DAYS', DEFAULTS.priceValidDays),
    availabilityPassDays: readNumber(config, 'STORE_AVAILABILITY_PASS_DAYS', DEFAULTS.availabilityPassDays),
    monthlyCreditBudget: readNumber(config, 'FIRECRAWL_MONTHLY_CREDIT_BUDGET', DEFAULTS.monthlyCreditBudget),
    creditsPerPass: readNumber(config, 'FIRECRAWL_CREDITS_PER_PASS', DEFAULTS.creditsPerPass),
    creditsPerDetail: readNumber(config, 'FIRECRAWL_CREDITS_PER_DETAIL', DEFAULTS.creditsPerDetail),
    creditsPerListingPage: readNumber(config, 'FIRECRAWL_CREDITS_PER_LISTING_PAGE', DEFAULTS.creditsPerListingPage),
  };
}
