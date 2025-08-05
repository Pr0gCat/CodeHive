import {
  cn,
  generateId,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatShortNumber,
  truncate,
  debounce,
  throttle,
  sleep,
  retry,
} from '@/lib/utils/index';

describe('Utility Functions', () => {
  describe('cn', () => {
    it('should combine class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-100');
      expect(result).toBe('text-red-500 bg-blue-100');
    });

    it('should merge conflicting Tailwind classes', () => {
      const result = cn('text-red-500', 'text-blue-500');
      expect(result).toBe('text-blue-500');
    });

    it('should handle conditional classes', () => {
      const result = cn('base-class', {
        'conditional-class': true,
        'hidden-class': false,
      });
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
      expect(result).not.toContain('hidden-class');
    });

    it('should handle undefined and null values', () => {
      const result = cn('text-red-500', undefined, null, 'bg-blue-100');
      expect(result).toBe('text-red-500 bg-blue-100');
    });
  });

  describe('generateId', () => {
    it('should generate a unique string ID', () => {
      const id1 = generateId();
      const id2 = generateId();

      expect(typeof id1).toBe('string');
      expect(typeof id2).toBe('string');
      expect(id1).not.toBe(id2);
      expect(id1.length).toBeGreaterThan(0);
    });

    it('should generate IDs with consistent length', () => {
      const ids = Array.from({ length: 10 }, () => generateId());
      const lengths = ids.map(id => id.length);
      const uniqueLengths = new Set(lengths);

      // All IDs should have the same length
      expect(uniqueLengths.size).toBe(1);
    });
  });

  describe('formatDate', () => {
    it('should format Date object correctly', () => {
      const date = new Date('2023-06-15T10:30:00Z');
      const formatted = formatDate(date);

      expect(formatted).toMatch(/Jun 15, 2023/);
    });

    it('should format date string correctly', () => {
      const dateString = '2023-12-25T15:45:00Z';
      const formatted = formatDate(dateString);

      expect(formatted).toMatch(/Dec 25, 2023/);
    });

    it('should handle invalid date strings', () => {
      const invalidDate = 'invalid-date';
      const formatted = formatDate(invalidDate);

      expect(formatted).toMatch(/Invalid Date/);
    });
  });

  describe('formatDateTime', () => {
    it('should format Date object with time', () => {
      const date = new Date('2023-06-15T10:30:00Z');
      const formatted = formatDateTime(date);

      expect(formatted).toMatch(/Jun 15, 2023/);
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    });

    it('should format date string with time', () => {
      const dateString = '2023-12-25T15:45:00Z';
      const formatted = formatDateTime(dateString);

      expect(formatted).toMatch(/Dec 25, 2023/);
      expect(formatted).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/);
    });
  });

  describe('formatDuration', () => {
    it('should format seconds correctly', () => {
      expect(formatDuration(5000)).toBe('5s');
      expect(formatDuration(30000)).toBe('30s');
      expect(formatDuration(59000)).toBe('59s');
    });

    it('should format minutes and seconds correctly', () => {
      expect(formatDuration(60000)).toBe('1m 0s');
      expect(formatDuration(90000)).toBe('1m 30s');
      expect(formatDuration(125000)).toBe('2m 5s');
    });

    it('should format hours and minutes correctly', () => {
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3900000)).toBe('1h 5m');
      expect(formatDuration(7290000)).toBe('2h 1m');
    });

    it('should handle zero duration', () => {
      expect(formatDuration(0)).toBe('0s');
    });

    it('should handle fractional seconds', () => {
      expect(formatDuration(1500)).toBe('1s');
      expect(formatDuration(999)).toBe('0s');
    });
  });

  describe('formatNumber', () => {
    it('should format numbers with thousand separators', () => {
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1000000)).toBe('1,000,000');
      expect(formatNumber(123456789)).toBe('123,456,789');
    });

    it('should handle small numbers', () => {
      expect(formatNumber(0)).toBe('0');
      expect(formatNumber(42)).toBe('42');
      expect(formatNumber(999)).toBe('999');
    });

    it('should handle negative numbers', () => {
      expect(formatNumber(-1000)).toBe('-1,000');
      expect(formatNumber(-123456)).toBe('-123,456');
    });
  });

  describe('formatShortNumber', () => {
    it('should format numbers less than 1000 as is', () => {
      expect(formatShortNumber(0)).toBe('0');
      expect(formatShortNumber(42)).toBe('42');
      expect(formatShortNumber(999)).toBe('999');
    });

    it('should format thousands with K suffix', () => {
      expect(formatShortNumber(1000)).toBe('1K');
      expect(formatShortNumber(1500)).toBe('1.5K');
      expect(formatShortNumber(12000)).toBe('12K');
      expect(formatShortNumber(999999)).toBe('1000K');
    });

    it('should format millions with M suffix', () => {
      expect(formatShortNumber(1000000)).toBe('1M');
      expect(formatShortNumber(1500000)).toBe('1.5M');
      expect(formatShortNumber(12000000)).toBe('12M');
      expect(formatShortNumber(999999999)).toBe('1000M');
    });

    it('should format billions with B suffix', () => {
      expect(formatShortNumber(1000000000)).toBe('1B');
      expect(formatShortNumber(1500000000)).toBe('1.5B');
      expect(formatShortNumber(12000000000)).toBe('12B');
    });

    it('should remove trailing .0', () => {
      expect(formatShortNumber(1000)).toBe('1K');
      expect(formatShortNumber(1000000)).toBe('1M');
      expect(formatShortNumber(1000000000)).toBe('1B');
    });
  });

  describe('truncate', () => {
    it('should truncate strings longer than specified length', () => {
      const longString = 'This is a very long string that should be truncated';
      const result = truncate(longString, 20);

      expect(result.length).toBe(20);
      expect(result.endsWith('...')).toBe(true);
      expect(result).toBe('This is a very l...');
    });

    it('should not truncate strings shorter than specified length', () => {
      const shortString = 'Short string';
      const result = truncate(shortString, 20);

      expect(result).toBe(shortString);
      expect(result.endsWith('...')).toBe(false);
    });

    it('should handle exact length strings', () => {
      const exactString = 'Exactly 20 chars!!!';
      const result = truncate(exactString, 20);

      expect(result).toBe(exactString);
    });

    it('should handle very short truncation lengths', () => {
      const string = 'Hello World';
      const result = truncate(string, 5);

      expect(result).toBe('He...');
      expect(result.length).toBe(5);
    });
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('test');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should cancel previous calls when called multiple times', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('first');
      debouncedFn('second');
      debouncedFn('third');

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('third');
    });

    it('should handle multiple arguments', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1', 'arg2', 'arg3');
      jest.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 'arg3');
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('should execute function immediately on first call', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('test');
      expect(mockFn).toHaveBeenCalledWith('test');
    });

    it('should ignore subsequent calls within throttle period', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      throttledFn('second');
      throttledFn('third');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('first');
    });

    it('should allow execution after throttle period', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('first');
      expect(mockFn).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(100);
      throttledFn('second');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('second');
    });
  });

  describe('sleep', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('should resolve after specified time', async () => {
      const promise = sleep(1000);
      const mockCallback = jest.fn();

      promise.then(mockCallback);

      expect(mockCallback).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);
      await promise;

      expect(mockCallback).toHaveBeenCalled();
    });

    it('should resolve with undefined', async () => {
      const promise = sleep(100);
      jest.advanceTimersByTime(100);
      const result = await promise;

      expect(result).toBeUndefined();
    });
  });

  describe('retry', () => {
    jest.useFakeTimers();

    afterEach(() => {
      jest.clearAllTimers();
    });

    it('should return result on successful first attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');

      const result = await retry(mockFn);

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockResolvedValue('success');

      const retryPromise = retry(mockFn, { delay: 100 });

      // Advance timers for each retry delay
      jest.advanceTimersByTime(100); // After first failure
      await Promise.resolve(); // Let microtasks run
      jest.advanceTimersByTime(200); // After second failure (exponential backoff)
      await Promise.resolve();

      const result = await retryPromise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should throw last error after max attempts', async () => {
      const lastError = new Error('final failure');
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockRejectedValueOnce(new Error('attempt 2'))
        .mockRejectedValue(lastError);

      const retryPromise = retry(mockFn, { maxAttempts: 3, delay: 100 });

      // Advance timers for retries
      jest.advanceTimersByTime(100);
      await Promise.resolve();
      jest.advanceTimersByTime(200);
      await Promise.resolve();

      await expect(retryPromise).rejects.toThrow('final failure');
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should use custom retry options', async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValueOnce(new Error('attempt 1'))
        .mockResolvedValue('success');

      const retryPromise = retry(mockFn, {
        maxAttempts: 5,
        delay: 200,
        backoff: 1.5,
      });

      jest.advanceTimersByTime(200);
      await Promise.resolve();

      const result = await retryPromise;

      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should handle immediate success without delay', async () => {
      const mockFn = jest.fn().mockResolvedValue('immediate success');

      const result = await retry(mockFn);

      expect(result).toBe('immediate success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
