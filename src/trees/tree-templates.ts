/**
 * Declares the official EZ-Tree presets used as reusable forest templates.
 * Structural parameters stay owned by EZ-Tree; this module only adds world-scale metadata.
 */

import { TreePreset } from '@dgreenheck/ez-tree';

export type TreeTemplateName = keyof typeof TreePreset;
export type TreeSpecies = 'ash' | 'aspen' | 'oak' | 'pine';
export type TreeSize = 'small' | 'medium' | 'large';

export interface TreeTemplate {
  readonly preset: TreeTemplateName;
  readonly species: TreeSpecies;
  readonly size: TreeSize;
  readonly height: number;
}

export const TREE_TEMPLATES: readonly TreeTemplate[] = [
  { preset: 'Ash Small', species: 'ash', size: 'small', height: 10.5 },
  { preset: 'Ash Medium', species: 'ash', size: 'medium', height: 18 },
  { preset: 'Ash Large', species: 'ash', size: 'large', height: 24 },
  { preset: 'Aspen Small', species: 'aspen', size: 'small', height: 12 },
  { preset: 'Aspen Medium', species: 'aspen', size: 'medium', height: 19 },
  { preset: 'Aspen Large', species: 'aspen', size: 'large', height: 25 },
  { preset: 'Oak Small', species: 'oak', size: 'small', height: 11.5 },
  { preset: 'Oak Medium', species: 'oak', size: 'medium', height: 18 },
  { preset: 'Oak Large', species: 'oak', size: 'large', height: 23 },
  { preset: 'Pine Small', species: 'pine', size: 'small', height: 13 },
  { preset: 'Pine Medium', species: 'pine', size: 'medium', height: 19 },
  { preset: 'Pine Large', species: 'pine', size: 'large', height: 27 },
] as const;
