import { BadRequestException } from '@nestjs/common';
import { getBusinessDate, resolveCurrentBusinessDate } from './business-date';

describe('business date current-day guard', () => {
  it('allows the current configured business date', () => {
    const today = getBusinessDate();

    expect(resolveCurrentBusinessDate(today)).toBe(today);
    expect(resolveCurrentBusinessDate()).toBe(today);
  });

  it('uses BUSINESS_TIME_ZONE when it is configured', () => {
    const previousTimeZone = process.env.BUSINESS_TIME_ZONE;

    try {
      process.env.BUSINESS_TIME_ZONE = 'UTC';
      expect(getBusinessDate(new Date('2026-01-01T23:30:00.000Z'))).toBe('2026-01-01');

      process.env.BUSINESS_TIME_ZONE = 'Pacific/Kiritimati';
      expect(getBusinessDate(new Date('2026-01-01T23:30:00.000Z'))).toBe('2026-01-02');
    } finally {
      if (previousTimeZone === undefined) {
        delete process.env.BUSINESS_TIME_ZONE;
      } else {
        process.env.BUSINESS_TIME_ZONE = previousTimeZone;
      }
    }
  });

  it('rejects non-current business dates', () => {
    const today = getBusinessDate();
    const otherDate = today === '2000-01-01' ? '2000-01-02' : '2000-01-01';

    expect(() => resolveCurrentBusinessDate(otherDate)).toThrow(BadRequestException);
  });
});
