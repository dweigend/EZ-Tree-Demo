/** Verifies that tree and hedge geometry come from explicitly classified official EZ-Tree presets. */

import { describe, expect, test } from 'bun:test';
import { TREE_TEMPLATES } from './tree-templates';

describe('TREE_TEMPLATES', () => {
  test('includes the two official bush presets as shrubs', () => {
    const shrubs = TREE_TEMPLATES.filter((template) => template.form === 'shrub');
    expect(shrubs.map((template) => template.preset)).toEqual(['Bush 1', 'Bush 2']);
    expect(shrubs.every((template) => template.height < 3)).toBe(true);
  });
});
