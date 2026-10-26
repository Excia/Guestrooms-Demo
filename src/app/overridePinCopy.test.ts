import { lockoutMessage, waitText } from './overridePinCopy';

describe('waitText', () => {
  it('counts seconds under a minute and rounds minutes up', () => {
    expect(waitText(1)).toBe('1 second');
    expect(waitText(45)).toBe('45 seconds');
    expect(waitText(60)).toBe('1 minute');
    expect(waitText(61)).toBe('2 minutes');
    expect(waitText(300)).toBe('5 minutes');
  });

  it('never says zero', () => {
    expect(waitText(0)).toBe('1 second');
    expect(lockoutMessage(0.2)).toBe('Too many incorrect codes. Try again in 1 second.');
  });
});
