import type { CatalogModel, Id } from './types';
import { defaultSellingModelId } from './visibility';

/** The five buckets the configurator's summary panel totals into. */
export type Frequency = 'One Time' | 'Monthly' | 'Quarterly' | 'Semi-Annual' | 'Annual';

export const FREQUENCIES: Frequency[] = ['One Time', 'Monthly', 'Annual', 'Quarterly', 'Semi-Annual'];

/**
 * Which bucket a product's amount lands in, derived from its default selling
 * model. One-time is its own bucket; everything else is placed by term length.
 */
export function frequencyOf(m: CatalogModel, productId: Id): Frequency {
  const sm = m.sellingModels.find((s) => s.id === defaultSellingModelId(m, productId));
  if (!sm || sm.type === 'OneTime') return 'One Time';
  if (sm.type === 'Evergreen') return 'Monthly';

  const months =
    sm.pricingTermUnit === 'Years'
      ? (sm.pricingTerm ?? 1) * 12
      : sm.pricingTermUnit === 'Days'
        ? Math.max(1, Math.round((sm.pricingTerm ?? 30) / 30))
        : (sm.pricingTerm ?? 12);

  if (months <= 1) return 'Monthly';
  if (months <= 3) return 'Quarterly';
  if (months <= 6) return 'Semi-Annual';
  return 'Annual';
}

export const money = (amount: number, currency: string) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount);
