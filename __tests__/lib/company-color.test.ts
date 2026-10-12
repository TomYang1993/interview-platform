import { describe, expect, it } from 'vitest';
import { companyColor } from '@/lib/question-tags';

describe('companyColor', () => {
  it('uses the brand colour, matching names loosely', () => {
    expect(companyColor('Microsoft')).toBe('#00A4EF');
    expect(companyColor('Goldman Sachs')).toBe('#7399C6');
    expect(companyColor('goldman-sachs')).toBe('#7399C6');
  });

  it('gives unknown companies a stable generated hue', () => {
    const color = companyColor('Acme Corp');
    expect(color).toMatch(/^hsl\(\d{1,3} 65% 50%\)$/);
    expect(companyColor('acme corp')).toBe(color);
  });
});
