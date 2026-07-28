import { canonicalHash } from './canonical-hash.js';

describe('canonicalHash', () => {
  it('is stable across object key order', () => {
    expect(canonicalHash({ amount: '50.00', sessionId: 'x' })).toBe(
      canonicalHash({ sessionId: 'x', amount: '50.00' }),
    );
  });

  it('changes when a meaningful field changes', () => {
    expect(canonicalHash({ amount: '50.00' })).not.toBe(canonicalHash({ amount: '50.01' }));
  });
});
