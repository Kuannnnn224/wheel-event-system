'use strict';

/**
 * @callback WeightSelector
 * @param {*} item
 * @returns {number}
 */

/**
 * Picks one weighted item using the same roll-down behavior as the NestJS service.
 *
 * @param {Array<*>} items
 * @param {WeightSelector} getWeight
 * @param {Function} [rng]
 * @returns {*}
 */
function pickWeightedItem(items, getWeight, rng) {
  const random = rng || Math.random;
  const weightedItems = items.filter(function (item) {
    return getWeight(item) > 0;
  });
  const totalWeight = weightedItems.reduce(function (sum, item) {
    return sum + getWeight(item);
  }, 0);

  if (totalWeight <= 0) {
    throw new Error('At least one item with positive weight is required.');
  }

  let roll = random() * totalWeight;

  for (let index = 0; index < weightedItems.length; index += 1) {
    const item = weightedItems[index];
    roll -= getWeight(item);
    if (roll < 0) {
      return item;
    }
  }

  return weightedItems[weightedItems.length - 1];
}

/**
 * @param {number} lowWeight
 * @param {number} highWeight
 * @param {Function} [rng]
 * @returns {'low'|'high'}
 */
function pickProbabilityTable(lowWeight, highWeight, rng) {
  return pickWeightedItem(
    [
      { table: 'low', weight: lowWeight },
      { table: 'high', weight: highWeight }
    ],
    function (item) {
      return item.weight;
    },
    rng
  ).table;
}

module.exports = {
  pickWeightedItem: pickWeightedItem,
  pickProbabilityTable: pickProbabilityTable
};
