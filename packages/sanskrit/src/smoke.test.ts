import { describe, it, expect } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('workspace', () => {
  it('resolves package exports', () => {
    expect(PACKAGE_NAME).toBe('@sanskritify/sanskrit');
  });
});
