import { StreamBuffer } from '../src/executor/stream-buffer';

describe('StreamBuffer', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('append and flush', () => {
    it('should buffer content and flush on timer', async () => {
      const flushMock = jest.fn();
      const buffer = new StreamBuffer({
        flushIntervalMs: 1500,
        maxBufferSize: 1500,
        onFlush: flushMock,
      });

      buffer.start();
      buffer.append('Hello ');
      buffer.append('World');

      expect(flushMock).not.toHaveBeenCalled();

      // Advance timer
      jest.advanceTimersByTime(1500);

      expect(flushMock).toHaveBeenCalledWith('Hello World');

      await buffer.stop();
    });

    it('should force flush when buffer exceeds max size', () => {
      const flushMock = jest.fn();
      const buffer = new StreamBuffer({
        flushIntervalMs: 5000,
        maxBufferSize: 10,
        onFlush: flushMock,
      });

      buffer.start();
      buffer.append('12345678901'); // 11 chars, exceeds 10

      expect(flushMock).toHaveBeenCalledWith('12345678901');
    });

    it('should not flush empty buffer', async () => {
      const flushMock = jest.fn();
      const buffer = new StreamBuffer({
        flushIntervalMs: 1000,
        onFlush: flushMock,
      });

      buffer.start();
      jest.advanceTimersByTime(1000);

      expect(flushMock).not.toHaveBeenCalled();

      await buffer.stop();
    });

    it('should flush remaining content on stop', async () => {
      const flushMock = jest.fn().mockResolvedValue(undefined);
      const buffer = new StreamBuffer({
        flushIntervalMs: 5000,
        onFlush: flushMock,
      });

      buffer.start();
      buffer.append('remaining');

      await buffer.stop();

      expect(flushMock).toHaveBeenCalledWith('remaining');
    });
  });

  describe('clear', () => {
    it('should clear buffer without flushing', () => {
      const flushMock = jest.fn();
      const buffer = new StreamBuffer({
        flushIntervalMs: 5000,
        onFlush: flushMock,
      });

      buffer.append('content');
      buffer.clear();

      expect(buffer.getBufferSize()).toBe(0);
      expect(flushMock).not.toHaveBeenCalled();
    });
  });

  describe('getBufferSize', () => {
    it('should return current buffer size', () => {
      const buffer = new StreamBuffer({
        onFlush: jest.fn(),
      });

      expect(buffer.getBufferSize()).toBe(0);

      buffer.append('test');
      expect(buffer.getBufferSize()).toBe(4);

      buffer.append(' more');
      expect(buffer.getBufferSize()).toBe(9);
    });
  });

  describe('isRunning', () => {
    it('should return false before start', () => {
      const buffer = new StreamBuffer({
        onFlush: jest.fn(),
      });

      expect(buffer.isRunning()).toBe(false);
    });

    it('should return true after start', () => {
      const buffer = new StreamBuffer({
        onFlush: jest.fn(),
      });

      buffer.start();
      expect(buffer.isRunning()).toBe(true);
    });

    it('should return false after stop', async () => {
      const buffer = new StreamBuffer({
        onFlush: jest.fn(),
      });

      buffer.start();
      await buffer.stop();

      expect(buffer.isRunning()).toBe(false);
    });
  });

  describe('concurrent flushing', () => {
    it('should queue content if flush is in progress', async () => {
      jest.useRealTimers(); // Need real timers for async

      let flushResolve: () => void;
      const flushPromise = new Promise<void>(resolve => {
        flushResolve = resolve;
      });

      const flushCalls: string[] = [];
      const flushMock = jest.fn().mockImplementation((content: string) => {
        flushCalls.push(content);
        if (flushCalls.length === 1) {
          return flushPromise;
        }
        return Promise.resolve();
      });

      const buffer = new StreamBuffer({
        flushIntervalMs: 100000, // Won't trigger
        maxBufferSize: 5,
        onFlush: flushMock,
      });

      buffer.append('12345'); // Triggers flush
      buffer.append('67890'); // Should be queued

      // First flush is in progress
      expect(flushCalls).toEqual(['12345']);

      // Resolve first flush
      flushResolve!();

      // Wait for queued content to flush
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(flushCalls).toEqual(['12345', '67890']);
    });
  });

  describe('error handling', () => {
    it('should continue working after flush error', async () => {
      jest.useRealTimers();

      let callCount = 0;
      const flushMock = jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Flush error');
        }
        return Promise.resolve();
      });

      const buffer = new StreamBuffer({
        flushIntervalMs: 100000,
        maxBufferSize: 5,
        onFlush: flushMock,
      });

      buffer.append('12345'); // Triggers flush, will error
      await new Promise(resolve => setTimeout(resolve, 10));

      buffer.append('67890'); // Should still work
      await new Promise(resolve => setTimeout(resolve, 10));

      // Error logged internally via logger, but buffer should continue working
      expect(flushMock).toHaveBeenCalledTimes(2);
    });
  });
});
