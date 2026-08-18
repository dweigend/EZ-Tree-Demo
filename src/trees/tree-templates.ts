/**
 * Declares the official EZ-Tree presets used as reusable tree and shrub templates.
 * Structural parameters stay owned by EZ-Tree; this module only adds world-scale and placement metadata.
 */

import { TreePreset } from '@dgreenheck/ez-tree';

export type TreeTemplateName = keyof typeof TreePreset;
export type TreeSpecies = 'ash' | 'aspen' | 'oak' | 'pine';
export type TreeForm = 'tree' | 'shrub';

export interface TreeTemplate {
  readonly preset: TreeTemplateName;
  readonly species: TreeSpecies;
  readonly form: TreeForm;
  readonly height: number;
}

export const TREE_TEMPLATES: readonly TreeTemplate[] = [
  { preset: 'Ash Small', species: 'ash', form: 'tree', height: 10.5 },
  { preset: 'Ash Medium', species: 'ash', form: 'tree', height: 18 },
  { preset: 'Aspen Small', species: 'aspen', form: 'tree', height: 12 },
  { preset: 'Aspen Medium', species: 'aspen', form: 'tree', height: 19 },
  { preset: 'Oak Small', species: 'oak', form: 'tree', height: 11.5 },
  { preset: 'Oak Medium', species: 'oak', form: 'tree', height: 18 },
  { preset: 'Pine Small', species: 'pine', form: 'tree', height: 13 },
  { preset: 'Pine Medium', species: 'pine', form: 'tree', height: 19 },
  { preset: 'Bush 1', species: 'ash', form: 'shrub', height: 2.4 },
  { preset: 'Bush 2', species: 'aspen', form: 'shrub', height: 2.7 },
] as const;
