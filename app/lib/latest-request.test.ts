import { describe, expect, it } from 'vitest';
import { LatestRequest } from './latest-request';

describe('LatestRequest', () => {
  it('accepts only the newest request token', () => {
    const requests = new LatestRequest();
    const first = requests.begin();
    const second = requests.begin();

    expect(requests.isCurrent(first)).toBe(false);
    expect(requests.isCurrent(second)).toBe(true);
  });

  it('invalidates an in-flight request without starting another', () => {
    const requests = new LatestRequest();
    const request = requests.begin();

    requests.invalidate();

    expect(requests.isCurrent(request)).toBe(false);
  });
});
