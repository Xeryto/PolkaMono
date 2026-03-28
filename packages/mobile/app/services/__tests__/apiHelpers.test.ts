import { ApiError, handleApiResponse } from '../apiHelpers';

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('ApiError', () => {
  it('sets name, message, and status', () => {
    const err = new ApiError('something went wrong', 404);
    expect(err.name).toBe('ApiError');
    expect(err.message).toBe('something went wrong');
    expect(err.status).toBe(404);
    expect(err).toBeInstanceOf(Error);
  });
});

describe('handleApiResponse', () => {
  it('returns parsed body on 200', async () => {
    const result = await handleApiResponse(makeResponse(200, { id: 1 }));
    expect(result).toEqual({ id: 1 });
  });

  it('throws ApiError with detail message on 400', async () => {
    await expect(
      handleApiResponse(makeResponse(400, { detail: 'Bad request' }))
    ).rejects.toMatchObject({ status: 400, message: 'Bad request' });
  });

  it('throws ApiError on 500 with fallback message', async () => {
    await expect(
      handleApiResponse(makeResponse(500, {}))
    ).rejects.toMatchObject({ status: 500 });
  });

  it('joins 422 validation error array into single message', async () => {
    const body = {
      detail: [
        { msg: 'field required', loc: ['body', 'email'] },
        { msg: 'invalid value', loc: ['body', 'username'] },
      ],
    };
    await expect(
      handleApiResponse(makeResponse(422, body))
    ).rejects.toMatchObject({
      status: 422,
      message: 'field required\ninvalid value',
    });
  });

  it('stringifies object detail', async () => {
    const body = { detail: { nested: 'error' } };
    const err = await handleApiResponse(makeResponse(400, body)).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toContain('nested');
  });
});
