export interface WeightedPrize {
  id?: string | number;
  name: string;
  weight: number;
  amountPoints: number;
}

export type ProbabilityTable = 'low' | 'high';

export function pickWeightedItem<T>(items: T[], getWeight: (item: T) => number, rng = Math.random): T {
  const weightedItems = items.filter((item) => getWeight(item) > 0);
  const totalWeight = weightedItems.reduce((sum, item) => sum + getWeight(item), 0);

  if (totalWeight <= 0) {
    throw new Error('At least one item with positive weight is required.');
  }

  let roll = rng() * totalWeight;

  for (const item of weightedItems) {
    roll -= getWeight(item);
    if (roll < 0) {
      return item;
    }
  }

  return weightedItems[weightedItems.length - 1];
}

export function pickProbabilityTable(lowWeight: number, highWeight: number, rng = Math.random): ProbabilityTable {
  return pickWeightedItem(
    [
      { table: 'low' as const, weight: lowWeight },
      { table: 'high' as const, weight: highWeight },
    ],
    (item) => item.weight,
    rng,
  ).table;
}

export function pickWeightedPrize<T extends WeightedPrize>(prizes: T[], rng = Math.random): T {
  const weightedPrizes = prizes.filter((prize) => prize.weight > 0);
  const totalWeight = weightedPrizes.reduce((sum, prize) => sum + prize.weight, 0);

  if (totalWeight <= 0) {
    throw new Error('At least one prize with positive weight is required.');
  }

  let roll = rng() * totalWeight;

  for (const prize of weightedPrizes) {
    roll -= prize.weight;
    if (roll < 0) {
      return prize;
    }
  }

  return weightedPrizes[weightedPrizes.length - 1];
}
