import { hasVerticalOverflow } from './overflow';

describe('hasVerticalOverflow', () => {
  it('is true when content is taller than the box', () => {
    expect(hasVerticalOverflow({ scrollHeight: 500, clientHeight: 300 })).toBe(true);
  });
  it('is false when content fits, including an exact fit', () => {
    expect(hasVerticalOverflow({ scrollHeight: 300, clientHeight: 300 })).toBe(false);
    expect(hasVerticalOverflow({ scrollHeight: 100, clientHeight: 300 })).toBe(false);
  });
});
