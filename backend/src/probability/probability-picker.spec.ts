import { pickWeightedPrize } from './probability-picker';

describe('pickWeightedPrize', () => {
  const prizes = [
    { name: 'No prize', weight: 70, amountPoints: 0, enabled: true },
    { name: 'Small', weight: 20, amountPoints: 100, enabled: true },
    { name: 'Disabled', weight: 10000, amountPoints: 99999, enabled: false },
    { name: 'Big', weight: 10, amountPoints: 500, enabled: true },
  ];

  it('can return a zero amount prize', () => {
    expect(pickWeightedPrize(prizes, () => 0).amountPoints).toBe(0);
  });

  it('ignores disabled prizes', () => {
    expect(pickWeightedPrize(prizes, () => 0.95).name).toBe('Big');
  });

  it('throws when no enabled positive weights exist', () => {
    expect(() => pickWeightedPrize([{ name: 'None', weight: 0, amountPoints: 0 }])).toThrow();
  });
});
