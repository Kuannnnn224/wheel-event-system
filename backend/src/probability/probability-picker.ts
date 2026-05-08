export interface WeightedPrize {
  id?: string | number;
  name: string;
  weight: number;
  amountPoints: number;
  enabled?: boolean;
}

export function pickWeightedPrize<T extends WeightedPrize>(prizes: T[], rng = Math.random): T {
  const enabledPrizes = prizes.filter((prize) => prize.enabled !== false && prize.weight > 0);
  const totalWeight = enabledPrizes.reduce((sum, prize) => sum + prize.weight, 0);

  if (totalWeight <= 0) {
    throw new Error('At least one enabled prize with positive weight is required.');
  }

  let roll = rng() * totalWeight;

  for (const prize of enabledPrizes) {
    roll -= prize.weight;
    if (roll < 0) {
      return prize;
    }
  }

  return enabledPrizes[enabledPrizes.length - 1];
}
