import { BadRequestException } from '@nestjs/common';
import { getBusinessDate, resolveCurrentBusinessDate } from './business-date';

describe('business date current-day guard', () => {
  it('allows the current Asia/Taipei business date', () => {
    const today = getBusinessDate();

    expect(resolveCurrentBusinessDate(today)).toBe(today);
    expect(resolveCurrentBusinessDate()).toBe(today);
  });

  it('rejects non-current business dates', () => {
    const today = getBusinessDate();
    const otherDate = today === '2000-01-01' ? '2000-01-02' : '2000-01-01';

    expect(() => resolveCurrentBusinessDate(otherDate)).toThrow(BadRequestException);
  });
});
