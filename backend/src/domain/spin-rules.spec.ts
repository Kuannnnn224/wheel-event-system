import { validateRealSpinRule } from './spin-rules';

describe('validateRealSpinRule', () => {
  it('blocks stages that are not unlocked', () => {
    expect(validateRealSpinRule({ requestedStage: 2, unlockedStage: 1, playedStages: [1] })).toEqual({
      allowed: false,
      reason: 'Stage is not unlocked for this business date.',
    });
  });

  it('blocks repeated stage play', () => {
    expect(validateRealSpinRule({ requestedStage: 1, unlockedStage: 5, playedStages: [1] }).allowed).toBe(false);
  });

  it('requires sequential stage play', () => {
    expect(validateRealSpinRule({ requestedStage: 3, unlockedStage: 5, playedStages: [1] }).reason).toBe(
      'Previous stage must be completed first.',
    );
  });

  it('allows the next unlocked sequential stage', () => {
    expect(validateRealSpinRule({ requestedStage: 3, unlockedStage: 5, playedStages: [1, 2] }).allowed).toBe(true);
  });
});
