/**
 * Declares the official EZ-Tree presets used as reusable forest templates.
 * Structural parameters stay owned by EZ-Tree; this module only adds world-scale metadata.
 */

import { TreePreset } from '@dgreenheck/ez-tree';

export type TreeTemplateName = keyof typeof TreePreset;
export type TreeSpecies = 'aspen' | 'oak' | 'pine';

export interface TreeTemplate {
  readonly preset: TreeTemplateName;
  readonly species: TreeSpecies;
  readonly height: number;
}

export const TREE_TEMPLATES: readonly TreeTemplate[] = [
  { preset: 'Aspen Medium', species: 'aspen', height: 19 },
  { preset: 'Oak Medium', species: 'oak', height: 18 },
  { preset: 'Pine Medium', species: 'pine', height: 19 },
] as const;
