import fetchMock from 'jest-fetch-mock';
import {
  DEFAULT_NETWORK_CONFIG,
  NetworkRetryError,
  NetworkTimeoutError,
  fetchWithTimeoutAndRetry,
  getNetworkErrorMessage,
  isRetryableError,
} from '../networkUtils';

const abortError = () => Object.assign(new Error('The user aborted a request.'), { name: 'AbortError' });

beforeEach(() => {
  fetchMock.resetMocks();
});

describe('fetchWithTimeoutAndRetry', () => {
  it('returns response on first successful attempt', async () => {
    fetchMock.mockResponseOnce('{"ok":true}', { status: 200 });
    const promise = fetchWithTimeoutAndRetry('https://api.test/foo', {}, { retries: 0 });
    jest.runAllTimers();
    const res = await promise;
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on abort/timeout up to retries limit', async () => {
    // Simulate what happens when each request is aborted (timeout fires)
    fetchMock.mockReject(abortError());
    fetchMock.mockReject(abortError());
    fetchMock.mockReject(abortError());

    await expect(
      fetchWithTimeoutAndRetry(
        'https://api.test/foo',
        {},
        { timeout: 10000, retries: 2, retryDelay: 0, retryBackoff: false }
      )
    ).rejects.toBeInstanceOf(NetworkRetryError);

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retryable errors', async () => {
    fetchMock.mockRejectOnce(new Error('some other error'));

    const promise = fetchWithTimeoutAndRetry(
      'https://api.test/foo',
      {},
      { retries: 3 }
    );
    jest.runAllTimers();

    await expect(promise).rejects.toThrow('some other error');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('succeeds on second attempt after first abort', async () => {
    fetchMock.mockRejectOnce(abortError());
    fetchMock.mockResponseOnce('{"ok":true}', { status: 200 });

    const res = await fetchWithTimeoutAndRetry(
      'https://api.test/foo',
      {},
      { timeout: 10000, retries: 2, retryDelay: 0, retryBackoff: false }
    );
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('isRetryableError', () => {
  it('returns true for NetworkTimeoutError', () => {
    expect(isRetryableError(new NetworkTimeoutError())).toBe(true);
  });

  it('returns true for AbortError', () => {
    const err = new Error('aborted');
    err.name = 'AbortError';
    expect(isRetryableError(err)).toBe(true);
  });

  it('returns true for NetworkRetryError', () => {
    const inner = new NetworkTimeoutError();
    expect(isRetryableError(new NetworkRetryError('failed', 3, inner))).toBe(true);
  });

  it('returns false for generic errors', () => {
    expect(isRetryableError(new Error('syntax error'))).toBe(false);
  });

  it('returns true for errors with "timeout" in message', () => {
    expect(isRetryableError(new Error('request timeout exceeded'))).toBe(true);
  });
});

describe('getNetworkErrorMessage', () => {
  it('returns Russian message for NetworkTimeoutError', () => {
    const msg = getNetworkErrorMessage(new NetworkTimeoutError());
    expect(msg).toContain('слишком долго');
  });

  it('includes attempt count for NetworkRetryError', () => {
    const inner = new NetworkTimeoutError();
    const msg = getNetworkErrorMessage(new NetworkRetryError('failed', 3, inner));
    expect(msg).toContain('3');
  });

  it('returns message for AbortError', () => {
    const err = new Error();
    err.name = 'AbortError';
    const msg = getNetworkErrorMessage(err);
    expect(msg).toContain('отмен');
  });

  it('falls back to error.message for unknown errors', () => {
    const msg = getNetworkErrorMessage(new Error('custom error text'));
    expect(msg).toBe('custom error text');
  });

  it('falls back to default for empty message', () => {
    const err = new Error('');
    const msg = getNetworkErrorMessage(err);
    expect(msg).toContain('неизвестная');
  });
});

describe('DEFAULT_NETWORK_CONFIG', () => {
  it('has expected defaults', () => {
    expect(DEFAULT_NETWORK_CONFIG.timeout).toBe(10000);
    expect(DEFAULT_NETWORK_CONFIG.retries).toBe(3);
    expect(DEFAULT_NETWORK_CONFIG.retryDelay).toBe(1000);
    expect(DEFAULT_NETWORK_CONFIG.retryBackoff).toBe(true);
  });
});
