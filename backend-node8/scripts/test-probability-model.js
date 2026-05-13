'use strict';

const assert = require('assert');
const path = require('path');
const probabilityModel = require('../src/domain/probability-model');

function main() {
  assertProbabilityModelDoesNotLoadServer();
  assertLegacyConfigNormalization();
  assertDeterministicDraws();
  assertValidationErrorStaysInDomain();

  console.log('Probability model independent test passed.');
}

function assertProbabilityModelDoesNotLoadServer() {
  const cacheEntries = Object.keys(require.cache).map(normalizePath);
  const forbiddenFragments = [
    normalizePath(path.join('src', 'app.js')),
    normalizePath(path.join('src', 'container.js')),
    normalizePath(path.join('src', 'db.js')),
    normalizePath(path.join('src', 'controllers')) + '/',
    normalizePath(path.join('src', 'services')) + '/',
    normalizePath(path.join('node_modules', 'express')) + '/'
  ];

  forbiddenFragments.forEach(function (fragment) {
    const loaded = cacheEntries.filter(function (entry) {
      return entry.indexOf(fragment) !== -1;
    });

    assert.deepStrictEqual(loaded, [], 'probability model should not load server module: ' + fragment);
  });
}

function assertLegacyConfigNormalization() {
  const config = probabilityModel.normalizeConfig(createLegacyConfig());
  const stage = config.stages[0];
  const prizeA = stage.prizes[0];
  const prizeB = stage.prizes[1];

  assert.strictEqual(config.dailyPayoutLimitPoints, 0);
  assert.strictEqual(config.stages.length, 5);
  assert.strictEqual(stage.stageNumber, 1);
  assert.strictEqual(prizeA.rewardCode, 'A');
  assert.strictEqual(prizeA.prizeWeight, prizeA.highWeight);
  assert.strictEqual(prizeA.dailyLimitWeight, prizeA.lowWeight);
  assert.strictEqual(prizeB.prizeWeight, prizeB.highWeight);
  assert.strictEqual(prizeB.dailyLimitWeight, prizeB.lowWeight);
}

function assertDeterministicDraws() {
  const config = probabilityModel.normalizeConfig(createLegacyConfig());
  const stage = config.stages[0];
  const drawConfig = {
    stage: stage,
    prizes: stage.prizes
  };

  const lowDraw = probabilityModel.drawPrizeFromConfig(drawConfig, createRng([0, 0]));
  const highDraw = probabilityModel.drawPrizeFromConfig(drawConfig, createRng([0.99, 0]));
  const prizeDraw = probabilityModel.drawPrizeFromConfigForTable(drawConfig, 'prize', createRng([0]));
  const dailyLimitDraw = probabilityModel.drawPrizeFromConfigForTable(drawConfig, 'dailyLimit', createRng([0]));

  assert.strictEqual(lowDraw.table, 'low');
  assert.strictEqual(lowDraw.prize.rewardCode, 'A');
  assert.strictEqual(highDraw.table, 'high');
  assert.strictEqual(highDraw.prize.rewardCode, 'B');
  assert.strictEqual(prizeDraw.table, 'prize');
  assert.strictEqual(prizeDraw.prize.rewardCode, 'B');
  assert.strictEqual(dailyLimitDraw.table, 'dailyLimit');
  assert.strictEqual(dailyLimitDraw.prize.rewardCode, 'A');
}

function assertValidationErrorStaysInDomain() {
  assert.throws(function () {
    probabilityModel.normalizeConfig({
      version: 1,
      stages: []
    });
  }, function (err) {
    return probabilityModel.isProbabilityModelError(err) &&
      /exactly five stages/.test(err.message);
  });
}

function createLegacyConfig() {
  return {
    version: 1,
    stages: [5, 4, 3, 2, 1].map(function (stageNumber) {
      return {
        stageNumber: stageNumber,
        turnoverThresholdPoints: stageNumber * 1000,
        lowTableWeight: 20,
        highTableWeight: 80,
        prizes: [
          createPrize('E', stageNumber, 5, 0, 0),
          createPrize('D', stageNumber, 4, 0, 0),
          createPrize('C', stageNumber, 3, 0, 0),
          createPrize('B', stageNumber, 2, 0, 20),
          createPrize('A', stageNumber, 1, 10, 0)
        ]
      };
    })
  };
}

function createPrize(rewardCode, stageNumber, sortOrder, lowWeight, highWeight) {
  return {
    rewardCode: rewardCode,
    name: 'Stage ' + stageNumber + ' ' + rewardCode,
    amountPoints: stageNumber * sortOrder * 100,
    lowWeight: lowWeight,
    highWeight: highWeight,
    sortOrder: sortOrder
  };
}

function createRng(values) {
  let index = 0;

  return function () {
    if (index >= values.length) {
      return values[values.length - 1];
    }

    const value = values[index];
    index += 1;
    return value;
  };
}

function normalizePath(value) {
  return value.replace(/\\/g, '/').toLowerCase();
}

main();
