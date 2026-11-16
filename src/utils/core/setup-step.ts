import { retrying, type RetryOptions } from './retry';

/**
 * Runs preparation the case under test does not check (filling the fields that are not the one being tested). It is tried
 * again when it fails (the back office is slow, a panel was still open). If it still fails, the case could not reach its check,
 * so the failure is reported as "blocked", not as a bug of the feature under test.
 */
export const SETUP_FAILED = 'SETUP_FAILED';

export const asSetup = async <T>(what: string, run: () => Promise<T>, options: RetryOptions = {}): Promise<T> => {
  try {
    return await retrying(what, run, options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${SETUP_FAILED}: could not ${what} before the check. ${detail}`, { cause: error });
  }
};

/**
 * Preparation that creates data (users, entities, correspondence ...): run once, never tried again. A second try after
 * a partial failure would create the same names again and fail on "already exists" instead of the real cause. A
 * failure is still reported as "blocked", not as a bug.
 */
export const createData = <T>(what: string, run: () => Promise<T>): Promise<T> => asSetup(what, run, { attempts: 1 });
