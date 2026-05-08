import { pickProbabilityTable, pickWeightedItem, pickWeightedPrize } from './probability-picker';

describe('pickWeightedPrize', () => {
  const prizes = [
    { name: 'No prize', weight: 70, amountPoints: 0 },
    { name: 'Small', weight: 20, amountPoints: 100 },
    { name: 'Zero weight', weight: 0, amountPoints: 99999 },
    { name: 'Big', weight: 10, amountPoints: 500 },
  ];

  it('can return a zero amount prize', () => {
    expect(pickWeightedPrize(prizes, () => 0).amountPoints).toBe(0);
  });

  it('ignores zero-weight prizes', () => {
    expect(pickWeightedPrize(prizes, () => 0.95).name).toBe('Big');
  });

  it('throws when no positive weights exist', () => {
    expect(() => pickWeightedPrize([{ name: 'None', weight: 0, amountPoints: 0 }])).toThrow();
  });

  it('picks low or high table by split weight', () => {
    expect(pickProbabilityTable(80, 20, () => 0.1)).toBe('low');
    expect(pickProbabilityTable(80, 20, () => 0.9)).toBe('high');
  });

  it('supports generic weighted item selection', () => {
    expect(
      pickWeightedItem(
        [
          { code: 'A', lowWeight: 10 },
          { code: 'B', lowWeight: 90 },
        ],
        (item) => item.lowWeight,
        () => 0.5,
      ).code,
    ).toBe('B');
  });
});
