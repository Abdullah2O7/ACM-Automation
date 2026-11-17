import type { Response } from '@playwright/test';

/** The HTTP code that matches the portal's own answer status (the `status` of its `{ status, value, errorMessage }`). */
const CODES: Record<string, number> = {
  BadRequest: 400,
  Invalid: 400,
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  Conflict: 409,
  Error: 500,
};

/**
 * The real outcome of a portal answer. The portal sends some refusals as HTTP 200 with the refusal in its body (seen
 * live 2026-11-17: POST /registry/incoming/{id}/route answered 200 `{"status":"BadRequest","errorMessage":"Choose an
 * active internal recipient."}`), and others with the HTTP code (409 for a duplicate user name). This gives the HTTP code
 * when it is an error, else the code of the body's `status` when that is not 'Ok', else the HTTP code.
 */
export const answerStatus = async (response: Response): Promise<number> => {
  if (!response.ok()) {
    return response.status();
  }
  const body = (await response.json().catch(() => undefined)) as { status?: unknown } | undefined;
  if (body && typeof body === 'object' && typeof body.status === 'string' && body.status !== 'Ok') {
    return CODES[body.status] ?? 422;
  }
  return response.status();
};
