import * as THREE from 'three';

export declare namespace Billboard {
    let Single: string;
    let Double: string;
}

declare class Branch {
    /**
     * Generates a new branch
     * @param {THREE.Vector3} origin The starting point of the branch
     * @param {THREE.Euler} orientation The starting orientation of the branch
     * @param {number} length The length of the branch
     * @param {number} radius The radius of the branch at its starting point
     */
    constructor(origin?: THREE.Vector3, orientation?: THREE.Euler, length?: number, radius?: number, level?: number, sectionCount?: number, segmentCount?: number);
    origin: THREE.Vector3;
    orientation: THREE.Euler;
    length: number;
    radius: number;
    level: number;
    sectionCount: number;
    segmentCount: number;
}

declare class RNG {
    constructor(seed: any);
    m_w: number;
    m_z: number;
    mask: number;
    /**
     * Returns a random number between min and max
     */
    random(max?: number, min?: number): number;
}

export declare class Tree extends THREE.Group<THREE.Object3DEventMap> {
    /**
     * @typedef {Object} LODDetail@typedef {Object} LODDetail
     * @property {number} [sectionStride=1] Sample every Nth section ring; the
     *   first and last rings are always kept so branch endpoints stay put
     * @property {number} [segmentFactor=1] Radial segment multiplier;
     *   segments = max(3, round(segmentCount * segmentFactor))
     * @property {number} [leafStride=1] Keep every Nth leaf
     * @property {number} [leafScale=1] Size multiplier for the kept leaves,
     *   typically 1/sqrt(kept fraction) to preserve canopy coverage
     * @property {string} [billboard] Billboard mode override for this level
     *   ('single' or 'double'); defaults to options.leaves.billboard
     */
    /**
     * @typedef {Object} LODLevel@typedef {Object} LODLevel
     * @property {number} distance Camera distance at which this level activates
     * @property {number} [hysteresis] Switch hysteresis as a fraction of distance
     * @property {LODDetail} [detail] Meshing detail for this level
     */
    /**
     * Default levels for generateLODs(). LOD1 is roughly 40% of the full
     * triangle count, LOD2 roughly 20%.
     * @type {LODLevel[]}
     */
    static defaultLODLevels: {
        /**
         * Camera distance at which this level activates
         */
        distance: number;
        /**
         * Switch hysteresis as a fraction of distance
         */
        hysteresis?: number;
        /**
         * Meshing detail for this level
         */
        detail?: {
            /**
             * Sample every Nth section ring; the
             * first and last rings are always kept so branch endpoints stay put
             */
            sectionStride?: number;
            /**
             * Radial segment multiplier;
             * segments = max(3, round(segmentCount * segmentFactor))
             */
            segmentFactor?: number;
            /**
             * Keep every Nth leaf
             */
            leafStride?: number;
            /**
             * Size multiplier for the kept leaves,
             * typically 1/sqrt(kept fraction) to preserve canopy coverage
             */
            leafScale?: number;
            /**
             * Billboard mode override for this level
             * ('single' or 'double'); defaults to options.leaves.billboard
             */
            billboard?: string;
        };
    }[];
    /**
     * @param {TreeOptions} params
     */
    constructor(options?: TreeOptions);
    /**
     * @type {RNG}
     */
    rng: RNG;
    /**
     * @type {TreeOptions}
     */
    options: TreeOptions;
    /**
     * @type {Branch[]}
     */
    branchQueue: Branch[];
    branchesMesh: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[], THREE.Object3DEventMap>;
    leavesMesh: THREE.Mesh<THREE.BufferGeometry<THREE.NormalBufferAttributes>, THREE.Material | THREE.Material[], THREE.Object3DEventMap>;
    trellisMesh: Trellis;
    lod: THREE.LOD<THREE.Object3DEventMap>;
    skeleton: {
        branches: any[];
        leaves: any[];
    };
    update(elapsedTime: any): void;
    /**
     * Loads a preset tree from JSON
     * @param {string} preset
     */
    loadPreset(name: any): void;
    /**
     * Loads a tree from JSON
     * @param {TreeOptions} json
     */
    loadFromJson(json: TreeOptions): void;
    /**
     * Generate a new tree
     */
    generate(): void;
    branches: {
        verts: any[];
        normals: any[];
        indices: any[];
        uvs: any[];
        windFactor: any[];
    };
    leaves: {
        verts: any[];
        normals: any[];
        indices: any[];
        uvs: any[];
    };
    /**
     * Generates the tree as a set of levels of detail hosted in a THREE.LOD
     * object inside this group. The renderer switches levels automatically
     * based on camera distance. All levels share one bark and one leaf
     * material, so update() animates wind at every level.
     * @param {LODLevel[]} levels Level descriptors, in any order
     */
    generateLODs(levels?: {
        /**
         * Camera distance at which this level activates
         */
        distance: number;
        /**
         * Switch hysteresis as a fraction of distance
         */
        hysteresis?: number;
        /**
         * Meshing detail for this level
         */
        detail?: {
            /**
             * Sample every Nth section ring; the
             * first and last rings are always kept so branch endpoints stay put
             */
            sectionStride?: number;
            /**
             * Radial segment multiplier;
             * segments = max(3, round(segmentCount * segmentFactor))
             */
            segmentFactor?: number;
            /**
             * Keep every Nth leaf
             */
            leafStride?: number;
            /**
             * Size multiplier for the kept leaves,
             * typically 1/sqrt(kept fraction) to preserve canopy coverage
             */
            leafScale?: number;
            /**
             * Billboard mode override for this level
             * ('single' or 'double'); defaults to options.leaves.billboard
             */
            billboard?: string;
        };
    }[]): void;
    /**
     * Builds branch and leaf geometry at the given detail level without
     * modifying the tree's own meshes. Useful for external instancing or
     * custom LOD systems. Reuses the current skeleton, generating one first
     * if none exists.
     * @param {LODDetail} detail
     * @returns {{ branches: THREE.BufferGeometry, leaves: THREE.BufferGeometry }}
     */
    createGeometry(detail?: {
        /**
         * Sample every Nth section ring; the
         * first and last rings are always kept so branch endpoints stay put
         */
        sectionStride?: number;
        /**
         * Radial segment multiplier;
         * segments = max(3, round(segmentCount * segmentFactor))
         */
        segmentFactor?: number;
        /**
         * Keep every Nth leaf
         */
        leafStride?: number;
        /**
         * Size multiplier for the kept leaves,
         * typically 1/sqrt(kept fraction) to preserve canopy coverage
         */
        leafScale?: number;
        /**
         * Billboard mode override for this level
         * ('single' or 'double'); defaults to options.leaves.billboard
         */
        billboard?: string;
    }): {
        branches: THREE.BufferGeometry;
        leaves: THREE.BufferGeometry;
    };
    /**
     * Generate branches from a parent branch
     * @param {number} count The number of child branches to generate
     * @param {number} level The level of the child branches
     * @param {{
             *  origin: THREE.Vector3,
             *  orientation: THREE.Euler,
             *  radius: number
             * }[]} sections The parent branch's sections
     * @returns
     */
    generateChildBranches(count: number, level: number, sections: {
        origin: THREE.Vector3;
        orientation: THREE.Euler;
        radius: number;
    }[]): void;
    /**
     * Logic for spawning child branches from a parent branch's section
     * @param {{
             *  origin: THREE.Vector3,
             *  orientation: THREE.Euler,
             *  radius: number
             * }[]} sections The parent branch's sections
     * @returns
     */
    generateLeaves(sections: {
        origin: THREE.Vector3;
        orientation: THREE.Euler;
        radius: number;
    }[]): void;
    /**
     * Fisher-Yates shuffle of [0..count-1] using the tree's RNG so results stay
     * seed-reproducible.
     * @param {number} count
     * @returns {number[]}
     */
    shuffledIndices(count: number): number[];
    /**
     * Generates the geometry for the branches
     */
    createBranchesGeometry(): void;
    /**
     * Generates the geometry for the leaves
     */
    createLeavesGeometry(): void;
    /**
     * Create or update the trellis geometry
     */
    createTrellis(): void;
    /**
     * Find the nearest point on the trellis grid to a given position
     * @param {THREE.Vector3} position
     * @returns {THREE.Vector3}
     */
    getNearestTrellisPoint(position: THREE.Vector3): THREE.Vector3;
    /**
     * Calculate the force vector toward the nearest trellis point
     * @param {THREE.Vector3} position Current section position
     * @param {number} radius Current section radius
     * @returns {{ direction: THREE.Vector3, strength: number } | null}
     */
    calculateTrellisForce(position: THREE.Vector3, radius: number): {
        direction: THREE.Vector3;
        strength: number;
    } | null;
    get vertexCount(): number;
    get triangleCount(): number;
    #private;
}

declare class TreeOptions {
    seed: number;
    type: string;
    bark: {
        type: string;
        maps: {
            color: any;
            ao: any;
            normal: any;
            roughness: any;
        };
        tint: number;
        flatShading: boolean;
        textured: boolean;
        textureScale: {
            x: number;
            y: number;
        };
    };
    branch: {
        levels: number;
        angle: {
            1: number;
            2: number;
            3: number;
        };
        children: {
            0: number;
            1: number;
            2: number;
        };
        force: {
            direction: {
                x: number;
                y: number;
                z: number;
            };
            strength: number;
        };
        gnarliness: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        length: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        radius: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        sections: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        segments: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        start: {
            1: number;
            2: number;
            3: number;
        };
        taper: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
        twist: {
            0: number;
            1: number;
            2: number;
            3: number;
        };
    };
    leaves: {
        type: string;
        map: any;
        billboard: string;
        angle: number;
        count: number;
        start: number;
        size: number;
        sizeVariance: number;
        tint: number;
        alphaTest: number;
        roundedNormals: boolean;
    };
    trellis: {
        enabled: boolean;
        position: {
            x: number;
            y: number;
            z: number;
        };
        width: number;
        height: number;
        spacing: number;
        force: {
            strength: number;
            maxDistance: number;
            falloff: number;
        };
        cylinderRadius: number;
        visible: boolean;
        color: number;
    };
    /**
     * Copies the values from source into this object
     * @param {TreeOptions} source
     */
    copy(source: TreeOptions, target?: this): void;
}

export declare const TreePreset: {
    'Ash Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Ash Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Ash Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Aspen Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Aspen Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Aspen Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Bush 1': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Bush 2': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Bush 3': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Oak Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Oak Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Oak Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Pine Small': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Pine Medium': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    'Pine Large': {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
        };
    };
    Trellis: {
        seed: number;
        type: string;
        bark: {
            type: string;
            tint: number;
            flatShading: boolean;
            textured: boolean;
            textureScale: {
                x: number;
                y: number;
            };
        };
        branch: {
            levels: number;
            angle: {
                "1": number;
                "2": number;
                "3": number;
            };
            children: {
                "0": number;
                "1": number;
                "2": number;
            };
            force: {
                direction: {
                    x: number;
                    y: number;
                    z: number;
                };
                strength: number;
            };
            gnarliness: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            length: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            radius: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            sections: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            segments: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            start: {
                "1": number;
                "2": number;
                "3": number;
            };
            taper: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
            twist: {
                "0": number;
                "1": number;
                "2": number;
                "3": number;
            };
        };
        leaves: {
            type: string;
            billboard: string;
            angle: number;
            count: number;
            start: number;
            size: number;
            sizeVariance: number;
            tint: number;
            alphaTest: number;
        };
        trellis: {
            enabled: boolean;
            position: {
                x: number;
                y: number;
                z: number;
            };
            width: number;
            height: number;
            spacing: number;
            force: {
                strength: number;
                maxDistance: number;
                falloff: number;
            };
            cylinderRadius: number;
            visible: boolean;
            color: number;
        };
    };
};

export declare namespace TreeType {
    let Deciduous: string;
    let Evergreen: string;
}

/**
 * Trellis structure for guiding tree branch growth
 * Creates a grid of cylinders that branches can be attracted to
 */
export declare class Trellis extends THREE.Group<THREE.Object3DEventMap> {
    /**
     * @param {Object} options Trellis configuration
     */
    constructor(options: any);
    options: any;
    material: THREE.MeshStandardMaterial;
    hCylinderGeo: THREE.CylinderGeometry;
    vCylinderGeo: THREE.CylinderGeometry;
    /**
     * Generate the trellis geometry
     */
    generate(): void;
    /**
     * Find the nearest point on the trellis grid to a given position
     * @param {THREE.Vector3} position
     * @returns {THREE.Vector3}
     */
    getNearestPoint(position: THREE.Vector3): THREE.Vector3;
    /**
     * Clean up geometry and materials
     */
    dispose(): void;
}

export { }

export namespace Billboard {
    let Single: string;
    let Double: string;
}


export namespace TreeType {
    let Deciduous: string;
    let Evergreen: string;
}

