import { printingSubType } from '../price-sub-type';

describe('printingSubType', () => {
  it('names finishes and editions the way tcgcsv does', () => {
    expect(printingSubType(null, null)).toBe('Normal');
    expect(printingSubType('Rainbow', null)).toBe('Rainbow Foil');
    expect(printingSubType('Cold', 'First')).toBe('1st Edition Cold Foil');
    expect(printingSubType('Gold', null)).toBe('Gold Foil');
    expect(printingSubType(null, 'Unlimited')).toBe('Unlimited Edition Normal');
    expect(printingSubType('Rainbow', 'Unlimited')).toBe('Unlimited Edition Rainbow Foil');
  });

  it('has no sub type for Alpha or an unknown finish', () => {
    expect(printingSubType(null, 'Alpha')).toBeNull();
    expect(printingSubType('Sparkle', null)).toBeNull();
  });
});
