var H = Object.defineProperty;
var q = (x) => {
  throw TypeError(x);
};
var J = (x, i, e) => i in x ? H(x, i, { enumerable: !0, configurable: !0, writable: !0, value: e }) : x[i] = e;
var k = (x, i, e) => J(x, typeof i != "symbol" ? i + "" : i, e), U = (x, i, e) => i.has(x) || q("Cannot " + e);
var j = (x, i, e) => i.has(x) ? q("Cannot add the same private member more than once") : i instanceof WeakSet ? i.add(x) : i.set(x, e);
var f = (x, i, e) => (U(x, i, "access private method"), e);
import * as s from "three";
class Z {
  constructor(i) {
    k(this, "m_w", 123456789);
    k(this, "m_z", 987654321);
    k(this, "mask", 4294967295);
    this.m_w = 123456789 + i & this.mask, this.m_z = 987654321 - i & this.mask;
  }
  /**
   * Returns a random number between min and max
   */
  random(i = 1, e = 0) {
    this.m_z = 36969 * (this.m_z & 65535) + (this.m_z >> 16) & this.mask, this.m_w = 18e3 * (this.m_w & 65535) + (this.m_w >> 16) & this.mask;
    let t = (this.m_z << 16) + (this.m_w & 65535) >>> 0;
    return t /= 4294967296, (i - e) * t + e;
  }
}
class D {
  /**
   * Generates a new branch
   * @param {THREE.Vector3} origin The starting point of the branch
   * @param {THREE.Euler} orientation The starting orientation of the branch
   * @param {number} length The length of the branch
   * @param {number} radius The radius of the branch at its starting point
   */
  constructor(i = new s.Vector3(), e = new s.Euler(), t = 0, n = 0, c = 0, a = 0, l = 0) {
    this.origin = i.clone(), this.orientation = e.clone(), this.length = t, this.radius = n, this.level = c, this.sectionCount = a, this.segmentCount = l;
  }
}
const E = {
  Single: "single",
  Double: "double"
}, L = {
  Deciduous: "deciduous",
  Evergreen: "evergreen"
};
class I {
  constructor() {
    this.seed = 0, this.type = L.Deciduous, this.bark = {
      // Informational identifier carried through presets. The library does not
      // consume this field; the host app uses it to resolve which texture set
      // to assign to `maps` below.
      type: "Bark001",
      // Texture maps supplied by the caller. Each entry is a THREE.Texture or
      // null. When `textured` is true, non-null maps are applied to the
      // material; null maps fall back to the tint color for that channel.
      maps: {
        color: null,
        ao: null,
        normal: null,
        roughness: null
      },
      // Tint of the tree trunk
      tint: 16777215,
      // Use face normals for shading instead of vertex normals
      flatShading: !1,
      // Apply texture to bark
      textured: !0,
      // Scale for the texture
      textureScale: { x: 1, y: 1 }
    }, this.branch = {
      // Number of branch recursion levels. 0 = trunk only
      levels: 3,
      // Angle of the child branches relative to the parent branch (degrees)
      angle: {
        1: 70,
        2: 60,
        3: 60
      },
      // Number of children per branch level
      children: {
        0: 7,
        1: 7,
        2: 5
      },
      // External force encouraging tree growth in a particular direction
      force: {
        direction: { x: 0, y: 1, z: 0 },
        strength: 0.01
      },
      // Amount of curling/twisting at each branch level
      gnarliness: {
        0: 0.15,
        1: 0.2,
        2: 0.3,
        3: 0.02
      },
      // Length of each branch level
      length: {
        0: 20,
        1: 20,
        2: 10,
        3: 1
      },
      // Radius of each branch level
      radius: {
        0: 1.5,
        1: 0.7,
        2: 0.7,
        3: 0.7
      },
      // Number of sections per branch level
      sections: {
        0: 12,
        1: 10,
        2: 8,
        3: 6
      },
      // Number of radial segments per branch level
      segments: {
        0: 8,
        1: 6,
        2: 4,
        3: 3
      },
      // Defines where child branches start forming on the parent branch
      start: {
        1: 0.4,
        2: 0.3,
        3: 0.3
      },
      // Taper at each branch level
      taper: {
        0: 0.7,
        1: 0.7,
        2: 0.7,
        3: 0.7
      },
      // Amount of twist at each branch level
      twist: {
        0: 0,
        1: 0,
        2: 0,
        3: 0
      }
    }, this.leaves = {
      // Informational identifier (e.g. 'oak', 'ash'). Library does not consume
      // it; the host app uses it to resolve which texture to assign to `map`.
      type: "oak",
      // Color map supplied by the caller. THREE.Texture or null.
      // When null, leaves render as a flat tinted quad.
      map: null,
      // Whether to use single or double/perpendicular billboards
      billboard: E.Double,
      // Angle of leaves relative to parent branch (degrees)
      angle: 10,
      // Number of leaves
      count: 1,
      // Where leaves start to grow on the length of the branch (0 to 1)
      start: 0,
      // Size of the leaves
      size: 2.5,
      // Variance in leaf size between each instance
      sizeVariance: 0.7,
      // Tint color for the leaves
      tint: 16777215,
      // Controls transparency of leaf texture
      alphaTest: 0.5,
      // Calculates custom normals to imply a rounded canopy shape
      roundedNormals: !0
    }, this.trellis = {
      // Whether trellis is enabled
      enabled: !1,
      // Position of trellis (z is distance from tree)
      position: { x: 0, y: 0, z: -2 },
      // Width of trellis grid (X direction)
      width: 10,
      // Height of trellis grid (Y direction)
      height: 20,
      // Distance between grid lines
      spacing: 2,
      // Force parameters
      force: {
        // How strongly branches bend toward trellis
        strength: 0.02,
        // Maximum distance at which trellis affects branches
        maxDistance: 3,
        // Distance falloff exponent (1 = linear, 2 = quadratic)
        falloff: 1
      },
      // Radius of trellis cylinders
      cylinderRadius: 0.05,
      // Whether to show trellis geometry
      visible: !0,
      // Color of trellis
      color: 9127187
    };
  }
  /**
   * Copies the values from source into this object
   * @param {TreeOptions} source 
   */
  copy(i, e = this) {
    for (let t in i)
      if (i.hasOwnProperty(t) && e.hasOwnProperty(t)) {
        const n = i[t];
        n !== null && typeof n == "object" && n.constructor === Object ? this.copy(n, e[t]) : e[t] = n;
      }
  }
}
const K = 26867, ee = "deciduous", te = {
  type: "Bark001",
  tint: 13552830,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 0.5,
    y: 5
  }
}, se = {
  levels: 2,
  angle: {
    1: 48,
    2: 75,
    3: 60
  },
  children: {
    0: 10,
    1: 3,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.01
  },
  gnarliness: {
    0: 0.11,
    1: 0.09,
    2: 0.05,
    3: 0.09
  },
  length: {
    0: 23.87,
    1: 18,
    2: 5.59,
    3: 4.6
  },
  radius: {
    0: 0.81,
    1: 0.56,
    2: 0.76,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 10,
    3: 10
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.53,
    2: 0.33,
    3: 0
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0.3,
    1: -0.07,
    2: 0,
    3: 0
  }
}, ne = {
  type: "ash",
  billboard: "double",
  angle: 55,
  count: 30,
  start: 0,
  size: 2.05,
  sizeVariance: 0.717,
  tint: 16777215,
  alphaTest: 0.5
}, ie = {
  enabled: !1
}, ae = {
  seed: K,
  type: ee,
  bark: te,
  branch: se,
  leaves: ne,
  trellis: ie
}, re = 36330, oe = "deciduous", le = {
  type: "Bark001",
  tint: 13552830,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 0.5,
    y: 5
  }
}, ce = {
  levels: 3,
  angle: {
    1: 48,
    2: 75,
    3: 60
  },
  children: {
    0: 7,
    1: 4,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.01
  },
  gnarliness: {
    0: 0.03,
    1: 0.25,
    2: 0.2,
    3: 0.09
  },
  length: {
    0: 43.47,
    1: 27.14,
    2: 9.51,
    3: 4.6
  },
  radius: {
    0: 2,
    1: 0.63,
    2: 0.76,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 8,
    2: 6,
    3: 4
  },
  segments: {
    0: 12,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.23,
    2: 0.33,
    3: 0
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0.09,
    1: -0.07,
    2: 0,
    3: 0
  }
}, he = {
  type: "ash",
  billboard: "double",
  angle: 55,
  count: 16,
  start: 0,
  size: 2.67,
  sizeVariance: 0.72,
  tint: 16777215,
  alphaTest: 0.5
}, de = {
  enabled: !1
}, ue = {
  seed: re,
  type: oe,
  bark: le,
  branch: ce,
  leaves: he,
  trellis: de
}, pe = 29919, ge = "deciduous", me = {
  type: "Bark001",
  tint: 13552830,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 0.5,
    y: 5
  }
}, ye = {
  levels: 3,
  angle: {
    1: 39,
    2: 39,
    3: 51
  },
  children: {
    0: 10,
    1: 4,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.01
  },
  gnarliness: {
    0: -0.05,
    1: 0.2,
    2: 0.16,
    3: 0.049999999999999996
  },
  length: {
    0: 45,
    1: 29.42,
    2: 15.3,
    3: 4.6
  },
  radius: {
    0: 3.03,
    1: 0.53,
    2: 0.79,
    3: 1.11
  },
  sections: {
    0: 12,
    1: 8,
    2: 6,
    3: 4
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.32,
    2: 0.34,
    3: 0
  },
  taper: {
    0: 0.7,
    1: 0.6199999999999999,
    2: 0.7599999999999999,
    3: 0
  },
  twist: {
    0: 0.09,
    1: -0.07,
    2: 0,
    3: 0
  }
}, fe = {
  type: "ash",
  billboard: "double",
  angle: 30,
  count: 10,
  start: 0.01,
  size: 4.62,
  sizeVariance: 0.72,
  tint: 16777215,
  alphaTest: 0.5
}, ve = {
  enabled: !1
}, be = {
  seed: pe,
  type: ge,
  bark: me,
  branch: ye,
  leaves: fe,
  trellis: ve
}, xe = 36330, we = "deciduous", Me = {
  type: "Bark002",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 1
  }
}, ze = {
  levels: 2,
  angle: {
    1: 70,
    2: 35,
    3: 7
  },
  children: {
    0: 4,
    1: 3,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.010869565217391311
  },
  gnarliness: {
    0: 0.04,
    1: -0.010000000000000007,
    2: 0.12,
    3: 0.02
  },
  length: {
    0: 23.99,
    1: 3.36,
    2: 7.699999999999999,
    3: 1
  },
  radius: {
    0: 0.36999999999999994,
    1: 0.41,
    2: 0.7,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 8,
    3: 6
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.44999999999999996,
    2: 0.32999999999999996,
    3: 0
  },
  taper: {
    0: 0.37,
    1: 0.13,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  }
}, Se = {
  type: "aspen",
  billboard: "double",
  angle: 30,
  count: 13,
  start: 0.2,
  size: 2.5,
  sizeVariance: 0.7,
  tint: 16775778,
  alphaTest: 0.5
}, $e = {
  enabled: !1
}, ke = {
  seed: xe,
  type: we,
  bark: Me,
  branch: ze,
  leaves: Se,
  trellis: $e
}, Ve = 18020, Ce = "deciduous", Te = {
  type: "Bark002",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 1
  }
}, Be = {
  levels: 2,
  angle: {
    1: 75,
    2: 32,
    3: 7
  },
  children: {
    0: 10,
    1: 3,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.0148
  },
  gnarliness: {
    0: 0.05,
    1: 0.12,
    2: 0.12,
    3: 0.02
  },
  length: {
    0: 50,
    1: 6.07,
    2: 11.19,
    3: 1
  },
  radius: {
    0: 0.72,
    1: 0.41,
    2: 0.7,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 8,
    3: 6
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.59,
    2: 0.35,
    3: 0
  },
  taper: {
    0: 0.37,
    1: 0.13,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  }
}, Le = {
  type: "aspen",
  billboard: "double",
  angle: 30,
  count: 11,
  start: 0.124,
  size: 2.5,
  sizeVariance: 0.7,
  tint: 16775778,
  alphaTest: 0.5
}, Fe = {
  enabled: !1
}, Oe = {
  seed: Ve,
  type: Ce,
  bark: Te,
  branch: Be,
  leaves: Le,
  trellis: Fe
}, Ae = 30631, De = "deciduous", Ee = {
  type: "Bark002",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 1
  }
}, Ge = {
  levels: 2,
  angle: {
    1: 47,
    2: 63,
    3: 7
  },
  children: {
    0: 10,
    1: 6,
    2: 0
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.021739130434782622
  },
  gnarliness: {
    0: 0.05,
    1: -0.030000000000000006,
    2: 0.12,
    3: 0.02
  },
  length: {
    0: 69.60000000000001,
    1: 18.56,
    2: 11.19,
    3: 1
  },
  radius: {
    0: 1.11,
    1: 0.5800000000000001,
    2: 0.7,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 8,
    3: 6
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.62,
    2: 0.049999999999999975,
    3: 0
  },
  taper: {
    0: 0.7000000000000001,
    1: 0.13,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  }
}, Pe = {
  type: "aspen",
  billboard: "double",
  angle: 36,
  count: 20,
  start: 0.15217391304347827,
  size: 3.4782608695652173,
  sizeVariance: 0.7,
  tint: 16580390,
  alphaTest: 0.5
}, Qe = {
  enabled: !1
}, _e = {
  seed: Ae,
  type: De,
  bark: Ee,
  branch: Ge,
  leaves: Pe,
  trellis: Qe
}, qe = 45590, je = "deciduous", Ne = {
  type: "Bark001",
  tint: 13552830,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 0.5,
    y: 5
  }
}, Ie = {
  levels: 3,
  angle: {
    1: 21.521739130434785,
    2: 62.608695652173914,
    3: 60
  },
  children: {
    0: 7,
    1: 3,
    2: 2
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0
  },
  gnarliness: {
    0: 0.11,
    1: 0.09,
    2: 0.05,
    3: 0.09
  },
  length: {
    0: 0.1,
    1: 15.302173913043479,
    2: 5.59,
    3: 4.6
  },
  radius: {
    0: 0.5793478260869566,
    1: 0.9521739130434783,
    2: 0.76,
    3: 0.7
  },
  sections: {
    0: 6,
    1: 6,
    2: 10,
    3: 10
  },
  segments: {
    0: 4,
    1: 4,
    2: 4,
    3: 3
  },
  start: {
    1: 0.53,
    2: 0.33,
    3: 0
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0.3,
    1: -0.07,
    2: 0,
    3: 0
  }
}, Re = {
  type: "ash",
  billboard: "double",
  angle: 55,
  count: 12,
  start: 0,
  size: 2.4456521739130435,
  sizeVariance: 0.717,
  tint: 14745557,
  alphaTest: 0.5
}, We = {
  enabled: !1
}, Xe = {
  seed: qe,
  type: je,
  bark: Ne,
  branch: Ie,
  leaves: Re,
  trellis: We
}, Ye = 45590, He = "deciduous", Je = {
  type: "Bark001",
  tint: 13552830,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 0.5,
    y: 5
  }
}, Ue = {
  levels: 2,
  angle: {
    1: 19.565217391304348,
    2: 27.39130434782609,
    3: 60
  },
  children: {
    0: 10,
    1: 3,
    2: 2
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0
  },
  gnarliness: {
    0: 0.021739130434782594,
    1: 0.10869565217391308,
    2: 0.05,
    3: 0.09
  },
  length: {
    0: 0.1,
    1: 19.645652173913046,
    2: 7.701086956521739,
    3: 4.6
  },
  radius: {
    0: 0.5793478260869566,
    1: 0.9521739130434783,
    2: 0.76,
    3: 0.7
  },
  sections: {
    0: 3,
    1: 4,
    2: 10,
    3: 10
  },
  segments: {
    0: 4,
    1: 4,
    2: 4,
    3: 3
  },
  start: {
    1: 0.6413043478260869,
    2: 0.7065217391304348,
    3: 0
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0.3586956521739131,
    1: -0.043478260869565244,
    2: 0,
    3: 0
  }
}, Ze = {
  type: "aspen",
  billboard: "double",
  angle: 55,
  count: 7,
  start: 0,
  size: 2.4456521739130435,
  sizeVariance: 0.717,
  tint: 14745557,
  alphaTest: 0.5
}, Ke = {
  enabled: !1
}, et = {
  seed: Ye,
  type: He,
  bark: Je,
  branch: Ue,
  leaves: Ze,
  trellis: Ke
}, tt = 31343, st = "evergreen", nt = {
  type: "Bark001",
  tint: 13552830,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 0.5,
    y: 5
  }
}, it = {
  levels: 3,
  angle: {
    1: 66.52173913043478,
    2: 52.82608695652174,
    3: 0
  },
  children: {
    0: 13,
    1: 4,
    2: 4
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0
  },
  gnarliness: {
    0: 0.05434782608695654,
    1: 0.06521739130434778,
    2: 0.05,
    3: 0.09
  },
  length: {
    0: 10.958695652173914,
    1: 21.81739130434783,
    2: 13.130434782608695,
    3: 5.529347826086957
  },
  radius: {
    0: 0.5793478260869566,
    1: 0.9521739130434783,
    2: 0.6858695652173914,
    3: 0.7391304347826086
  },
  sections: {
    0: 4,
    1: 3,
    2: 3,
    3: 10
  },
  segments: {
    0: 3,
    1: 3,
    2: 3,
    3: 3
  },
  start: {
    1: 0.14130434782608695,
    2: 0.29347826086956524,
    3: 0
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0.3,
    1: -0.03260869565217389,
    2: 0,
    3: 0
  }
}, at = {
  type: "pine",
  billboard: "double",
  angle: 54,
  count: 3,
  start: 0.15217391304347827,
  size: 3.0434782608695654,
  sizeVariance: 0.45652173913043476,
  tint: 10339327,
  alphaTest: 0.5
}, rt = {
  enabled: !1
}, ot = {
  seed: tt,
  type: st,
  bark: nt,
  branch: it,
  leaves: at,
  trellis: rt
}, lt = 30895, ct = "deciduous", ht = {
  type: "Bark001",
  tint: 16774097,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 10
  }
}, dt = {
  levels: 3,
  angle: {
    1: 54,
    2: 58,
    3: 32
  },
  children: {
    0: 4,
    1: 2,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.01
  },
  gnarliness: {
    0: 0.07,
    1: -0.08,
    2: 0.11,
    3: 0.09
  },
  length: {
    0: 28.08,
    1: 4.55,
    2: 9.78,
    3: 7.16
  },
  radius: {
    0: 1,
    1: 1.02,
    2: 0.69,
    3: 1.19
  },
  sections: {
    0: 16,
    1: 9,
    2: 8,
    3: 1
  },
  segments: {
    0: 7,
    1: 5,
    2: 3,
    3: 3
  },
  start: {
    1: 0.49,
    2: 0.06,
    3: 0.12
  },
  taper: {
    0: 0.73,
    1: 0.42,
    2: 0.69,
    3: 0.75
  },
  twist: {
    0: -0.23,
    1: 0.42,
    2: 0,
    3: 0
  }
}, ut = {
  type: "oak",
  billboard: "double",
  angle: 42,
  count: 14,
  start: 0.16,
  size: 1.38,
  sizeVariance: 0.7,
  tint: 14013901,
  alphaTest: 0.5
}, pt = {
  enabled: !1
}, gt = {
  seed: lt,
  type: ct,
  bark: ht,
  branch: dt,
  leaves: ut,
  trellis: pt
}, mt = 35729, yt = "deciduous", ft = {
  type: "Bark001",
  tint: 16774097,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 10
  }
}, vt = {
  levels: 3,
  angle: {
    1: 54,
    2: 58,
    3: 32
  },
  children: {
    0: 6,
    1: 4,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.02
  },
  gnarliness: {
    0: 0,
    1: -0.1,
    2: -0.15,
    3: 0.09
  },
  length: {
    0: 37.24,
    1: 11.08,
    2: 12.39,
    3: 7.16
  },
  radius: {
    0: 1.41,
    1: 0.9,
    2: 0.69,
    3: 1.19
  },
  sections: {
    0: 8,
    1: 6,
    2: 3,
    3: 1
  },
  segments: {
    0: 7,
    1: 5,
    2: 3,
    3: 3
  },
  start: {
    1: 0.49,
    2: 0.06,
    3: 0.12
  },
  taper: {
    0: 0.73,
    1: 0.42,
    2: 0.69,
    3: 0.75
  },
  twist: {
    0: -0.23,
    1: 0.42,
    2: 0,
    3: 0
  }
}, bt = {
  type: "oak",
  billboard: "double",
  angle: 42,
  count: 18,
  start: 0.16,
  size: 2.5,
  sizeVariance: 0.7,
  tint: 14013901,
  alphaTest: 0.5
}, xt = {
  enabled: !1
}, wt = {
  seed: mt,
  type: yt,
  bark: ft,
  branch: vt,
  leaves: bt,
  trellis: xt
}, Mt = 23399, zt = "deciduous", St = {
  type: "Bark001",
  tint: 16774097,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 10
  }
}, $t = {
  levels: 3,
  angle: {
    1: 54,
    2: 43,
    3: 32
  },
  children: {
    0: 9,
    1: 5,
    2: 3
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.02
  },
  gnarliness: {
    0: -0.04,
    1: 0.16,
    2: -0.06,
    3: 0.09
  },
  length: {
    0: 47.7,
    1: 29.39,
    2: 17.62,
    3: 7.16
  },
  radius: {
    0: 3,
    1: 0.69,
    2: 0.69,
    3: 1.19
  },
  sections: {
    0: 16,
    1: 9,
    2: 8,
    3: 3
  },
  segments: {
    0: 12,
    1: 5,
    2: 3,
    3: 3
  },
  start: {
    1: 0.35,
    2: 0.1,
    3: 0
  },
  taper: {
    0: 0.73,
    1: 0.42,
    2: 0.69,
    3: 0.75
  },
  twist: {
    0: -0.23,
    1: 0.42,
    2: 0,
    3: 0
  }
}, kt = {
  type: "oak",
  billboard: "double",
  angle: 36,
  count: 10,
  start: 0.16,
  size: 4.5,
  sizeVariance: 0.7,
  tint: 14013901,
  alphaTest: 0.5
}, Vt = {
  enabled: !1
}, Ct = {
  seed: Mt,
  type: zt,
  bark: St,
  branch: $t,
  leaves: kt,
  trellis: Vt
}, Tt = 11744, Bt = "evergreen", Lt = {
  type: "Bark003",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 1
  }
}, Ft = {
  levels: 1,
  angle: {
    1: 117,
    2: 60,
    3: 60
  },
  children: {
    0: 91,
    1: 7,
    2: 5
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0
  },
  gnarliness: {
    0: 0.05,
    1: 0.08,
    2: 0,
    3: 0
  },
  length: {
    0: 39.55,
    1: 12.12,
    2: 10,
    3: 1
  },
  radius: {
    0: 0.55,
    1: 0.41,
    2: 0.7,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 8,
    3: 6
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.16,
    2: 0.3,
    3: 0.3
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  }
}, Ot = {
  type: "pine",
  billboard: "double",
  angle: 10,
  count: 21,
  start: 0,
  size: 0.965,
  sizeVariance: 0.7,
  tint: 16777215,
  alphaTest: 0.3
}, At = {
  enabled: !1
}, Dt = {
  seed: Tt,
  type: Bt,
  bark: Lt,
  branch: Ft,
  leaves: Ot,
  trellis: At
}, Et = 13977, Gt = "evergreen", Pt = {
  type: "Bark003",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 1
  }
}, Qt = {
  levels: 1,
  angle: {
    1: 110,
    2: 16,
    3: 60
  },
  children: {
    0: 82,
    1: 3,
    2: 5
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: -3e-3
  },
  gnarliness: {
    0: 0.05,
    1: 0.08,
    2: 0,
    3: 0
  },
  length: {
    0: 50,
    1: 23.87,
    2: 14.08,
    3: 1
  },
  radius: {
    0: 1.05,
    1: 0.36,
    2: 0.7,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 8,
    3: 6
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.27,
    2: 0.14,
    3: 0.3
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  }
}, _t = {
  type: "pine",
  billboard: "double",
  angle: 39,
  count: 30,
  start: 0.09,
  size: 1.435,
  sizeVariance: 0.201,
  tint: 16777215,
  alphaTest: 0.3
}, qt = {
  enabled: !1
}, jt = {
  seed: Et,
  type: Gt,
  bark: Pt,
  branch: Qt,
  leaves: _t,
  trellis: qt
}, Nt = 44166, It = "evergreen", Rt = {
  type: "Bark003",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 1
  }
}, Wt = {
  levels: 1,
  angle: {
    1: 129.1304347826087,
    2: 16,
    3: 60
  },
  children: {
    0: 100,
    1: 3,
    2: 0
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.009000000000000001
  },
  gnarliness: {
    0: 0.05,
    1: 0.08,
    2: 0,
    3: 0
  },
  length: {
    0: 65.25217391304348,
    1: 34.84782608695652,
    2: 27.246739130434783,
    3: 1
  },
  radius: {
    0: 1.271739130434783,
    1: 0.366304347826087,
    2: 0.7,
    3: 0.7
  },
  sections: {
    0: 12,
    1: 10,
    2: 8,
    3: 6
  },
  segments: {
    0: 8,
    1: 6,
    2: 4,
    3: 3
  },
  start: {
    1: 0.29347826086956524,
    2: 0.14,
    3: 0.3
  },
  taper: {
    0: 0.7,
    1: 0.7,
    2: 0.7,
    3: 0.7
  },
  twist: {
    0: 0,
    1: 0,
    2: 0,
    3: 0
  }
}, Xt = {
  type: "pine",
  billboard: "double",
  angle: 17,
  count: 18,
  start: 0.07608695652173914,
  size: 2.608695652173913,
  sizeVariance: 0.201,
  tint: 16777215,
  alphaTest: 0.3
}, Yt = {
  enabled: !1
}, Ht = {
  seed: Nt,
  type: It,
  bark: Rt,
  branch: Wt,
  leaves: Xt,
  trellis: Yt
}, Jt = 41563, Ut = "deciduous", Zt = {
  type: "Bark001",
  tint: 16777215,
  flatShading: !1,
  textured: !0,
  textureScale: {
    x: 1,
    y: 8
  }
}, Kt = {
  levels: 3,
  angle: {
    1: 26,
    2: 79,
    3: 0
  },
  children: {
    0: 7,
    1: 5,
    2: 1
  },
  force: {
    direction: {
      x: 0,
      y: 1,
      z: 0
    },
    strength: 0.026
  },
  gnarliness: {
    0: 0,
    1: 0.02,
    2: -0.41,
    3: 0.09
  },
  length: {
    0: 4.8,
    1: 16.9,
    2: 11.3,
    3: 11.1
  },
  radius: {
    0: 0.27,
    1: 0.71,
    2: 0.84,
    3: 0.48
  },
  sections: {
    0: 6,
    1: 12,
    2: 10,
    3: 4
  },
  segments: {
    0: 3,
    1: 3,
    2: 3,
    3: 3
  },
  start: {
    1: 0.19,
    2: 0.1,
    3: 0.06
  },
  taper: {
    0: 0.6,
    1: 0.5,
    2: 0.5,
    3: 0.5
  },
  twist: {
    0: -0.02,
    1: -0.01,
    2: 0.09,
    3: 0
  }
}, es = {
  type: "ash",
  billboard: "single",
  angle: 30,
  count: 13,
  start: 0,
  size: 1.7,
  sizeVariance: 0.5,
  tint: 15204310,
  alphaTest: 0.5
}, ts = {
  enabled: !0,
  position: {
    x: 0,
    y: 0,
    z: 1.3
  },
  width: 20,
  height: 32,
  spacing: 4,
  force: {
    strength: 0.014,
    maxDistance: 18.2,
    falloff: 1.3
  },
  cylinderRadius: 0.08,
  visible: !0,
  color: 5519173
}, ss = {
  seed: Jt,
  type: Ut,
  bark: Zt,
  branch: Kt,
  leaves: es,
  trellis: ts
}, ns = {
  "Ash Small": ae,
  "Ash Medium": ue,
  "Ash Large": be,
  "Aspen Small": ke,
  "Aspen Medium": Oe,
  "Aspen Large": _e,
  "Bush 1": Xe,
  "Bush 2": et,
  "Bush 3": ot,
  "Oak Small": gt,
  "Oak Medium": wt,
  "Oak Large": Ct,
  "Pine Small": Dt,
  "Pine Medium": jt,
  "Pine Large": Ht,
  Trellis: ss
};
function is(x) {
  const i = ns[x];
  return i ? structuredClone(i) : new I();
}
class as extends s.Group {
  /**
   * @param {Object} options Trellis configuration
   */
  constructor(i) {
    super(), this.name = "Trellis", this.options = i, this.material = null, this.hCylinderGeo = null, this.vCylinderGeo = null;
  }
  /**
   * Generate the trellis geometry
   */
  generate() {
    const i = this.options;
    this.dispose(), this.material = new s.MeshStandardMaterial({
      color: i.color,
      roughness: 0.8
    }), this.hCylinderGeo = new s.CylinderGeometry(
      i.cylinderRadius,
      i.cylinderRadius,
      i.width,
      8
    ), this.hCylinderGeo.rotateZ(Math.PI / 2), this.vCylinderGeo = new s.CylinderGeometry(
      i.cylinderRadius,
      i.cylinderRadius,
      i.height,
      8
    );
    const e = Math.floor(i.height / i.spacing) + 1;
    for (let n = 0; n < e; n++) {
      const c = n * i.spacing, a = new s.Mesh(this.hCylinderGeo, this.material);
      a.position.set(i.position.x, i.position.y + c, i.position.z), this.add(a);
    }
    const t = Math.floor(i.width / i.spacing) + 1;
    for (let n = 0; n < t; n++) {
      const c = -i.width / 2 + n * i.spacing, a = new s.Mesh(this.vCylinderGeo, this.material);
      a.position.set(i.position.x + c, i.position.y + i.height / 2, i.position.z), this.add(a);
    }
  }
  /**
   * Find the nearest point on the trellis grid to a given position
   * @param {THREE.Vector3} position
   * @returns {THREE.Vector3}
   */
  getNearestPoint(i) {
    const e = this.options, t = e.position.x, n = e.position.y, c = e.position.z, a = t - e.width / 2, l = t + e.width / 2, h = n, r = n + e.height, o = Math.max(a, Math.min(l, i.x)), p = Math.max(h, Math.min(r, i.y)), m = Math.round((p - h) / e.spacing) * e.spacing + h, w = Math.max(h, Math.min(r, m)), d = Math.round((o - a) / e.spacing) * e.spacing + a, y = Math.max(a, Math.min(l, d)), v = new s.Vector3(o, w, c), b = new s.Vector3(y, p, c), g = i.distanceTo(v), M = i.distanceTo(b);
    return g < M ? v : b;
  }
  /**
   * Clean up geometry and materials
   */
  dispose() {
    this.children.forEach((i) => {
      i.geometry && (i.geometry = null);
    }), this.clear(), this.hCylinderGeo && (this.hCylinderGeo.dispose(), this.hCylinderGeo = null), this.vCylinderGeo && (this.vCylinderGeo.dispose(), this.vCylinderGeo = null), this.material && (this.material.dispose(), this.material = null);
  }
}
var u, G, F, O, R, P, W, X, V, Q, _;
const A = class A extends s.Group {
  /**
   * @param {TreeOptions} params
   */
  constructor(e = new I()) {
    super();
    j(this, u);
    /**
     * @type {RNG}
     */
    k(this, "rng");
    /**
     * @type {TreeOptions}
     */
    k(this, "options");
    /**
     * @type {Branch[]}
     */
    k(this, "branchQueue", []);
    this.name = "Tree", this.branchesMesh = new s.Mesh(), this.leavesMesh = new s.Mesh(), this.trellisMesh = null, this.lod = null, this.skeleton = null, this.add(this.branchesMesh), this.add(this.leavesMesh), this.options = e;
  }
  update(e) {
    const t = this.leavesMesh.material.userData.shader;
    t && (t.uniforms.uTime.value = e);
  }
  /**
   * Loads a preset tree from JSON 
   * @param {string} preset 
   */
  loadPreset(e) {
    const t = is(e);
    this.loadFromJson(t);
  }
  /**
   * Loads a tree from JSON
   * @param {TreeOptions} json 
   */
  loadFromJson(e) {
    this.options.copy(e), this.generate();
  }
  /**
   * Generate a new tree
   */
  generate() {
    f(this, u, G).call(this), f(this, u, F).call(this);
    const e = f(this, u, O).call(this);
    this.branches = e.branches, this.leaves = e.leaves, this.createBranchesGeometry(), this.createLeavesGeometry(), this.createTrellis();
  }
  /**
   * Generates the tree as a set of levels of detail hosted in a THREE.LOD
   * object inside this group. The renderer switches levels automatically
   * based on camera distance. All levels share one bark and one leaf
   * material, so update() animates wind at every level.
   * @param {LODLevel[]} levels Level descriptors, in any order
   */
  generateLODs(e = A.defaultLODLevels) {
    f(this, u, G).call(this), f(this, u, F).call(this);
    const t = f(this, u, Q).call(this), n = f(this, u, _).call(this);
    this.lod = new s.LOD(), this.lod.name = "TreeLOD", [...e].sort(
      (a, l) => (a.distance ?? 0) - (l.distance ?? 0)
    ).forEach((a, l) => {
      const h = f(this, u, O).call(this, a.detail ?? {});
      let r, o;
      l === 0 ? (this.branches = h.branches, this.leaves = h.leaves, r = this.branchesMesh, o = this.leavesMesh, r.geometry.dispose(), r.material.dispose(), o.geometry.dispose(), o.material.dispose()) : (r = new s.Mesh(), o = new s.Mesh()), r.geometry = f(this, u, V).call(this, h.branches), r.material = t, o.geometry = f(this, u, V).call(this, h.leaves), o.material = n;
      for (const m of [r, o])
        m.castShadow = !0, m.receiveShadow = !0;
      const p = new s.Group();
      p.add(r, o), this.lod.addLevel(p, a.distance ?? 0, a.hysteresis ?? 0);
    }), this.add(this.lod), this.createTrellis();
  }
  /**
   * Builds branch and leaf geometry at the given detail level without
   * modifying the tree's own meshes. Useful for external instancing or
   * custom LOD systems. Reuses the current skeleton, generating one first
   * if none exists.
   * @param {LODDetail} detail
   * @returns {{ branches: THREE.BufferGeometry, leaves: THREE.BufferGeometry }}
   */
  createGeometry(e = {}) {
    this.skeleton || f(this, u, F).call(this);
    const t = f(this, u, O).call(this, e);
    return {
      branches: f(this, u, V).call(this, t.branches),
      leaves: f(this, u, V).call(this, t.leaves)
    };
  }
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
  generateChildBranches(e, t, n) {
    const c = this.rng.random(), a = this.options.branch.start[t], l = (1 - a) / e, h = this.shuffledIndices(e);
    for (let r = 0; r < e; r++) {
      let o = a + (r + this.rng.random()) * l;
      const p = Math.floor(o * (n.length - 1));
      let m, w;
      m = n[p], p === n.length - 1 ? w = m : w = n[p + 1];
      const d = (o - p / (n.length - 1)) / (1 / (n.length - 1)), y = new s.Vector3().lerpVectors(
        m.origin,
        w.origin,
        d
      ), v = this.options.branch.radius[t] * ((1 - d) * m.radius + d * w.radius), b = new s.Quaternion().setFromEuler(m.orientation), g = new s.Quaternion().setFromEuler(w.orientation), M = new s.Euler().setFromQuaternion(
        g.slerp(b, d)
      ), z = this.rng.random(0.5, -0.5), S = 2 * Math.PI * (c + (h[r] + z) / e), $ = new s.Quaternion().setFromAxisAngle(
        new s.Vector3(1, 0, 0),
        this.options.branch.angle[t] / (180 / Math.PI)
      ), C = new s.Quaternion().setFromAxisAngle(
        new s.Vector3(0, 1, 0),
        S
      ), T = new s.Quaternion().setFromEuler(M), B = new s.Euler().setFromQuaternion(
        T.multiply(C.multiply($))
      );
      let Y = this.options.branch.length[t] * (this.options.type === L.Evergreen ? 1 - o : 1);
      this.branchQueue.push(
        new D(
          y,
          B,
          Y,
          v,
          t,
          this.options.branch.sections[t],
          this.options.branch.segments[t]
        )
      );
    }
  }
  /**
   * Logic for spawning child branches from a parent branch's section
   * @param {{
  *  origin: THREE.Vector3,
  *  orientation: THREE.Euler,
  *  radius: number
  * }[]} sections The parent branch's sections
  * @returns
  */
  generateLeaves(e) {
    const t = this.rng.random(), n = this.options.leaves.count, c = this.options.leaves.start, a = (1 - c) / n, l = this.shuffledIndices(n);
    for (let h = 0; h < n; h++) {
      let r = c + (h + this.rng.random()) * a;
      const o = Math.floor(r * (e.length - 1));
      let p, m;
      p = e[o], o === e.length - 1 ? m = p : m = e[o + 1];
      const w = (r - o / (e.length - 1)) / (1 / (e.length - 1)), d = new s.Vector3().lerpVectors(
        p.origin,
        m.origin,
        w
      ), y = new s.Quaternion().setFromEuler(p.orientation), v = new s.Quaternion().setFromEuler(m.orientation), b = new s.Euler().setFromQuaternion(
        v.slerp(y, w)
      ), g = this.rng.random(0.5, -0.5), M = 2 * Math.PI * (t + (l[h] + g) / n), z = new s.Quaternion().setFromAxisAngle(
        new s.Vector3(1, 0, 0),
        this.options.leaves.angle / (180 / Math.PI)
      ), S = new s.Quaternion().setFromAxisAngle(
        new s.Vector3(0, 1, 0),
        M
      ), $ = new s.Quaternion().setFromEuler(b), C = new s.Euler().setFromQuaternion(
        $.multiply(S.multiply(z))
      );
      f(this, u, P).call(this, d, C);
    }
  }
  /**
   * Fisher-Yates shuffle of [0..count-1] using the tree's RNG so results stay
   * seed-reproducible.
   * @param {number} count
   * @returns {number[]}
   */
  shuffledIndices(e) {
    const t = Array.from({ length: e }, (n, c) => c);
    for (let n = e - 1; n > 0; n--) {
      const c = Math.floor(this.rng.random() * (n + 1));
      [t[n], t[c]] = [t[c], t[n]];
    }
    return t;
  }
  /**
   * Generates the geometry for the branches
   */
  createBranchesGeometry() {
    this.branchesMesh.geometry.dispose(), this.branchesMesh.geometry = f(this, u, V).call(this, this.branches), this.branchesMesh.material.dispose(), this.branchesMesh.material = f(this, u, Q).call(this), this.branchesMesh.castShadow = !0, this.branchesMesh.receiveShadow = !0;
  }
  /**
   * Generates the geometry for the leaves
   */
  createLeavesGeometry() {
    this.leavesMesh.geometry.dispose(), this.leavesMesh.geometry = f(this, u, V).call(this, this.leaves), this.leavesMesh.material.dispose(), this.leavesMesh.material = f(this, u, _).call(this), this.leavesMesh.castShadow = !0, this.leavesMesh.receiveShadow = !0;
  }
  /**
   * Create or update the trellis geometry
   */
  createTrellis() {
    this.trellisMesh && (this.remove(this.trellisMesh), this.trellisMesh.dispose(), this.trellisMesh = null), this.options.trellis.enabled && this.options.trellis.visible && (this.trellisMesh = new as(this.options.trellis), this.trellisMesh.generate(), this.add(this.trellisMesh));
  }
  /**
   * Find the nearest point on the trellis grid to a given position
   * @param {THREE.Vector3} position
   * @returns {THREE.Vector3}
   */
  getNearestTrellisPoint(e) {
    const t = this.options.trellis, n = t.position.x, c = t.position.y, a = t.position.z, l = n - t.width / 2, h = n + t.width / 2, r = c, o = c + t.height, p = Math.max(l, Math.min(h, e.x)), m = Math.max(r, Math.min(o, e.y)), w = Math.round((m - r) / t.spacing) * t.spacing + r, d = Math.max(r, Math.min(o, w)), y = Math.round((p - l) / t.spacing) * t.spacing + l, v = Math.max(l, Math.min(h, y)), b = new s.Vector3(p, d, a), g = new s.Vector3(v, m, a), M = e.distanceTo(b), z = e.distanceTo(g);
    return M < z ? b : g;
  }
  /**
   * Calculate the force vector toward the nearest trellis point
   * @param {THREE.Vector3} position Current section position
   * @param {number} radius Current section radius
   * @returns {{ direction: THREE.Vector3, strength: number } | null}
   */
  calculateTrellisForce(e, t) {
    const n = this.options.trellis, c = this.getNearestTrellisPoint(e), a = e.distanceTo(c);
    if (a > n.force.maxDistance || a < 1e-3) return null;
    const l = new s.Vector3().subVectors(c, e).normalize(), h = 1 - Math.pow(
      a / n.force.maxDistance,
      n.force.falloff
    ), r = n.force.strength * h / t;
    return { direction: l, strength: r };
  }
  get vertexCount() {
    return (this.branches.verts.length + this.leaves.verts.length) / 3;
  }
  get triangleCount() {
    return (this.branches.indices.length + this.leaves.indices.length) / 3;
  }
};
u = new WeakSet(), /**
 * Tears down any LOD state and restores the flat branches/leaves meshes
 * as direct children, so generate() behaves as if LODs never existed.
 */
G = function() {
  this.lod && (this.lod.levels.forEach((e) => {
    for (const t of e.object.children)
      t === this.branchesMesh || t === this.leavesMesh || t.geometry.dispose();
  }), this.remove(this.lod), this.lod = null, this.add(this.branchesMesh, this.leavesMesh));
}, /**
 * Grows the tree skeleton: the section frames of every branch and the
 * placement of every leaf. All RNG consumption happens here, so any
 * number of meshing passes can run against one skeleton without changing
 * the tree's shape.
 */
F = function() {
  for (this.skeleton = {
    branches: [],
    leaves: []
  }, this.rng = new Z(this.options.seed), this.branchQueue.push(
    new D(
      new s.Vector3(),
      new s.Euler(),
      this.options.branch.length[0],
      this.options.branch.radius[0],
      0,
      this.options.branch.sections[0],
      this.options.branch.segments[0]
    )
  ); this.branchQueue.length > 0; ) {
    const e = this.branchQueue.shift();
    f(this, u, R).call(this, e);
  }
}, /**
 * Meshes the current skeleton into geometry buffers at the given detail.
 * Consumes no RNG, so it can run repeatedly with different detail specs.
 * @param {LODDetail} detail
 */
O = function(e = {}) {
  const t = Math.max(1, Math.floor(e.sectionStride ?? 1)), n = e.segmentFactor ?? 1, c = Math.max(1, Math.floor(e.leafStride ?? 1)), a = e.leafScale ?? 1, l = e.billboard ?? this.options.leaves.billboard, h = {
    verts: [],
    normals: [],
    indices: [],
    uvs: [],
    windFactor: []
  }, r = {
    verts: [],
    normals: [],
    indices: [],
    uvs: []
  };
  for (const o of this.skeleton.branches)
    f(this, u, X).call(this, h, o, t, n);
  for (let o = 0; o < this.skeleton.leaves.length; o += c)
    f(this, u, W).call(this, r, this.skeleton.leaves[o], a, l);
  return { branches: h, leaves: r };
}, /**
 * Grows a branch's skeleton, queueing child branches and recording leaf
 * placements. Consumes RNG in the exact order of the original interleaved
 * generator so seeds keep producing identical trees.
 * @param {Branch} branch
 * @returns
 */
R = function(e) {
  let t = e.orientation.clone(), n = e.origin.clone(), c = e.length / e.sectionCount / (this.options.type === "Deciduous" ? this.options.branch.levels - 1 : 1), a = [];
  for (let l = 0; l <= e.sectionCount; l++) {
    let h = e.radius;
    l === e.sectionCount && e.level === this.options.branch.levels ? h = 1e-3 : this.options.type === L.Deciduous ? h *= 1 - this.options.branch.taper[e.level] * (l / e.sectionCount) : this.options.type === L.Evergreen && (h *= 1 - l / e.sectionCount), a.push({
      origin: n.clone(),
      orientation: t.clone(),
      radius: h
    }), n.add(
      new s.Vector3(0, c, 0).applyEuler(t)
    );
    const r = Math.max(1, 1 / Math.sqrt(h)) * this.options.branch.gnarliness[e.level];
    t.x += this.rng.random(r, -r), t.z += this.rng.random(r, -r);
    const o = new s.Quaternion().setFromEuler(t), p = new s.Quaternion().setFromAxisAngle(
      new s.Vector3(0, 1, 0),
      this.options.branch.twist[e.level]
    );
    o.multiply(p);
    const m = new s.Vector3(0, 1, 0).applyQuaternion(o), w = new s.Vector3().copy(this.options.branch.force.direction).normalize(), d = new s.Vector3().crossVectors(m, w), y = d.length();
    if (y > 1e-6) {
      d.divideScalar(y);
      const v = Math.atan2(y, m.dot(w)), b = this.options.branch.force.strength / h, g = Math.max(-v, Math.min(v, b));
      o.premultiply(
        new s.Quaternion().setFromAxisAngle(d, g)
      );
    }
    if (this.options.trellis.enabled) {
      const v = this.calculateTrellisForce(n, h);
      if (v) {
        const b = new s.Quaternion().setFromUnitVectors(
          new s.Vector3(0, 1, 0),
          v.direction
        );
        o.rotateTowards(b, v.strength);
      }
    }
    t.setFromQuaternion(o);
  }
  if (this.skeleton.branches.push({
    sections: a,
    segmentCount: e.segmentCount,
    baseRadius: e.radius
  }), this.options.type === "deciduous") {
    const l = a[a.length - 1];
    e.level < this.options.branch.levels ? this.branchQueue.push(
      new D(
        l.origin,
        l.orientation,
        this.options.branch.length[e.level + 1],
        l.radius,
        e.level + 1,
        // Section count and segment count must be same as parent branch
        // since the child branch is growing from the end of the parent branch
        e.sectionCount,
        e.segmentCount
      )
    ) : f(this, u, P).call(this, l.origin, l.orientation);
  }
  e.level === this.options.branch.levels ? this.generateLeaves(a) : e.level < this.options.branch.levels && this.generateChildBranches(
    this.options.branch.children[e.level],
    e.level + 1,
    a
  );
}, /**
* Records a leaf placement in the skeleton. The size variance is sampled
* here so the meshing passes stay RNG-free.
* @param {THREE.Vector3} origin The starting point of the leaf
* @param {THREE.Euler} orientation The orientation of the leaf
*/
P = function(e, t) {
  const n = this.options.leaves.size * (1 + this.rng.random(
    this.options.leaves.sizeVariance,
    -this.options.leaves.sizeVariance
  ));
  this.skeleton.leaves.push({
    origin: e.clone(),
    orientation: t.clone(),
    size: n
  });
}, /**
* Emits the quad geometry for one skeleton leaf into the buffers
* @param {{verts: number[], normals: number[], indices: number[], uvs: number[]}} buffers
* @param {{origin: THREE.Vector3, orientation: THREE.Euler, size: number}} leaf
* @param {number} scale Size multiplier for this detail level
* @param {string} billboard Billboard mode for this detail level
*/
W = function(e, t, n, c) {
  let a = e.verts.length / 3;
  const { origin: l, orientation: h } = t, r = t.size * n, o = r, p = r, m = (w) => {
    const d = [
      new s.Vector3(-o / 2, p, 0),
      new s.Vector3(-o / 2, 0, 0),
      new s.Vector3(o / 2, 0, 0),
      new s.Vector3(o / 2, p, 0)
    ].map(
      (S) => S.applyEuler(new s.Euler(0, w, 0)).applyEuler(h).add(l)
    );
    e.verts.push(
      d[0].x,
      d[0].y,
      d[0].z,
      d[1].x,
      d[1].y,
      d[1].z,
      d[2].x,
      d[2].y,
      d[2].z,
      d[3].x,
      d[3].y,
      d[3].z
    );
    const y = new s.Vector3(0, 0, 1).applyEuler(h), v = this.options.leaves.roundedNormals;
    let b = v ? new s.Vector3().copy(y).add(d[0]).sub(l).normalize() : y, g = v ? new s.Vector3().copy(y).add(d[1]).sub(l).normalize() : y, M = v ? new s.Vector3().copy(y).add(d[2]).sub(l).normalize() : y, z = v ? new s.Vector3().copy(y).add(d[3]).sub(l).normalize() : y;
    e.normals.push(
      b.x,
      b.y,
      b.z,
      g.x,
      g.y,
      g.z,
      M.x,
      M.y,
      M.z,
      z.x,
      z.y,
      z.z
    ), e.uvs.push(0, 1, 0, 0, 1, 0, 1, 1), e.indices.push(a, a + 1, a + 2, a, a + 2, a + 3), a += 4;
  };
  m(0), c === E.Double && m(Math.PI / 2);
}, /**
 * Emits the ring geometry and indices for one skeleton branch
 * @param {{verts: number[], normals: number[], indices: number[], uvs: number[]}} buffers
 * @param {{sections: {origin: THREE.Vector3, orientation: THREE.Euler, radius: number}[], segmentCount: number, baseRadius: number}} skeletonBranch
 * @param {number} sectionStride Sample every Nth section ring
 * @param {number} segmentFactor Radial segment multiplier
 */
X = function(e, t, n, c) {
  const { sections: a, segmentCount: l, baseRadius: h } = t, r = Math.max(3, Math.round(l * c)), o = Math.max(
    1,
    Math.round(h * this.options.bark.textureScale.x)
  ), p = [];
  for (let g = 0; g < a.length; g += n)
    p.push(a[g]);
  (a.length - 1) % n !== 0 && p.push(a[a.length - 1]);
  const m = e.verts.length / 3;
  for (let g = 0; g < p.length; g++) {
    const M = p[g];
    let z;
    for (let S = 0; S < r; S++) {
      let $ = 2 * Math.PI * S / r;
      const C = new s.Vector3(Math.cos($), 0, Math.sin($)).multiplyScalar(M.radius).applyEuler(M.orientation).add(M.origin), T = new s.Vector3(Math.cos($), 0, Math.sin($)).applyEuler(M.orientation).normalize(), B = new s.Vector2(
        S / r * o,
        g % 2 === 0 ? 0 : 1
      );
      e.verts.push(...Object.values(C)), e.normals.push(...Object.values(T)), e.uvs.push(...Object.values(B)), S === 0 && (z = { vertex: C, normal: T, uv: B });
    }
    e.verts.push(...Object.values(z.vertex)), e.normals.push(...Object.values(z.normal)), e.uvs.push(o, z.uv.y);
  }
  let w, d, y, v;
  const b = r + 1;
  for (let g = 0; g < p.length - 1; g++)
    for (let M = 0; M < r; M++)
      w = m + g * b + M, d = m + g * b + (M + 1), y = w + b, v = d + b, e.indices.push(w, y, d, d, y, v);
}, /**
 * Builds a BufferGeometry from raw attribute buffers
 * @param {{verts: number[], normals: number[], indices: number[], uvs: number[]}} buffers
 * @returns {THREE.BufferGeometry}
 */
V = function(e) {
  const t = new s.BufferGeometry();
  return t.setAttribute(
    "position",
    new s.BufferAttribute(new Float32Array(e.verts), 3)
  ), t.setAttribute(
    "normal",
    new s.BufferAttribute(new Float32Array(e.normals), 3)
  ), t.setAttribute(
    "uv",
    new s.BufferAttribute(new Float32Array(e.uvs), 2)
  ), t.setIndex(
    new s.BufferAttribute(new Uint16Array(e.indices), 1)
  ), t.computeBoundingSphere(), t;
}, /**
 * Creates the bark material from the current options
 * @returns {THREE.MeshStandardMaterial}
 */
Q = function() {
  const e = new s.MeshStandardMaterial({
    name: "branches",
    flatShading: this.options.bark.flatShading,
    color: new s.Color(this.options.bark.tint),
    metalness: 0,
    roughness: 1
  });
  if (this.options.bark.textured) {
    const t = this.options.bark.textureScale, n = this.options.bark.maps, c = (a) => a ? (a.wrapS = s.RepeatWrapping, a.wrapT = s.RepeatWrapping, a.repeat.x = 1, a.repeat.y = 1 / t.y, a) : null;
    n.color && (e.map = c(n.color)), n.ao && (e.aoMap = c(n.ao)), n.normal && (e.normalMap = c(n.normal)), n.roughness && (e.roughnessMap = c(n.roughness), e.metalnessMap = e.roughnessMap);
  }
  return e;
}, /**
 * Creates the leaf material, including the wind sway vertex shader, from
 * the current options
 * @returns {THREE.MeshStandardMaterial}
 */
_ = function() {
  const e = new s.MeshStandardMaterial({
    name: "leaves",
    map: this.options.leaves.map ?? null,
    color: new s.Color(this.options.leaves.tint),
    side: s.DoubleSide,
    alphaTest: this.options.leaves.alphaTest,
    metalness: 0,
    roughness: 1,
    dithering: !0
  });
  return e.onBeforeCompile = (t) => {
    t.uniforms.uTime = { value: 0 }, t.uniforms.uWindStrength = { value: new s.Vector3(0.5, 0, 0.5) }, t.uniforms.uWindFrequency = { value: 0.5 }, t.uniforms.uWindScale = { value: 70 }, t.uniforms.uCustomNormals = { value: this.options.leaves.roundedNormals }, t.vertexShader = `
        uniform float uTime;
        uniform vec3 uWindStrength;
        uniform float uWindFrequency;
        uniform float uWindScale;
        ` + t.vertexShader, t.vertexShader = t.vertexShader.replace(
      "void main() {",
      `
        // GLSL Simplex Noise 3D
        // Source: https://github.com/ashima/webgl-noise

        vec3 mod289(vec3 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 mod289(vec4 x) {
            return x - floor(x * (1.0 / 289.0)) * 289.0;
        }

        vec4 permute(vec4 x) {
            return mod289(((x*34.0)+1.0)*x);
        }

        vec4 taylorInvSqrt(vec4 r) {
            return 1.79284291400159 - 0.85373472095314 * r;
        }

        vec3 fade(vec3 t) {
            return t*t*t*(t*(t*6.0-15.0)+10.0);
        }

        // Classic Simplex Noise 3D
        float simplex3(vec3 v) {
            const vec2  C = vec2(1.0/6.0, 1.0/3.0);
            const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

            // First corner
            vec3 i  = floor(v + dot(v, C.yyy) );
            vec3 x0 = v - i + dot(i, C.xxx);

            // Other corners
            vec3 g = step(x0.yzx, x0.xyz);
            vec3 l = 1.0 - g;
            vec3 i1 = min( g.xyz, l.zxy );
            vec3 i2 = max( g.xyz, l.zxy );

            //  x0 = x0 - 0. + 0.0 * C 
            vec3 x1 = x0 - i1 + C.xxx;
            vec3 x2 = x0 - i2 + C.yyy; // 2.0 * C.x = 1/3 = C.y
            vec3 x3 = x0 - D.yyy;      // -1.0 + 3.0 * C.x = -0.5

            // Permutations
            i = mod289(i);
            vec4 p = permute( permute( permute( 
                        i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                      + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
                      + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

            // Gradients: 7x7 points over a square, mapped onto an octahedron.
            // The ring size 17*17 = 289 is close to the mapping's singularity.
            float n_ = 0.142857142857; // 1.0/7.0
            vec3  ns = n_ * D.wyz - D.xzx;

            vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

            vec4 x_ = floor(j * ns.z);
            vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

            vec4 x = x_ *ns.x + ns.yyyy;
            vec4 y = y_ *ns.x + ns.yyyy;
            vec4 h = 1.0 - abs(x) - abs(y);

            vec4 b0 = vec4( x.xy, y.xy );
            vec4 b1 = vec4( x.zw, y.zw );

            vec4 s0 = floor(b0)*2.0 + 1.0;
            vec4 s1 = floor(b1)*2.0 + 1.0;
            vec4 sh = -step(h, vec4(0.0));

            vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
            vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

            vec3 g0 = vec3(a0.xy,h.x);
            vec3 g1 = vec3(a0.zw,h.y);
            vec3 g2 = vec3(a1.xy,h.z);
            vec3 g3 = vec3(a1.zw,h.w);

            // Normalise gradients
            vec4 norm = taylorInvSqrt(vec4(dot(g0,g0), dot(g1,g1), dot(g2,g2), dot(g3,g3)));
            g0 *= norm.x;
            g1 *= norm.y;
            g2 *= norm.z;
            g3 *= norm.w;

            // Mix contributions from the four corners
            vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
            m = m * m;
            return 42.0 * dot( m*m, vec4( dot(g0,x0), dot(g1,x1), 
                                          dot(g2,x2), dot(g3,x3) ) );
        }
          
        void main() {`
    ), t.vertexShader = t.vertexShader.replace(
      "#include <project_vertex>",
      `
        vec4 mvPosition = vec4(transformed, 1.0);

        float windOffset = 2.0 * 3.14 * simplex3(mvPosition.xyz / uWindScale);
        vec3 windSway = uv.y * uWindStrength * (
          0.5 * sin(uTime * uWindFrequency + windOffset) +
          0.3 * sin(2.0 * uTime * uWindFrequency + 1.3 * windOffset) +
          0.2 * sin(5.0 * uTime * uWindFrequency + 1.5 * windOffset)
        );
        mvPosition.xyz += windSway;

        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;
        `
    ), t.fragmentShader = `uniform bool uCustomNormals;
` + t.fragmentShader.replace(
      "#include <normal_fragment_begin>",
      s.ShaderChunk.normal_fragment_begin.replace(
        "normal *= faceDirection;",
        "if (!uCustomNormals) { normal *= faceDirection; }"
      )
    ), Object.defineProperty(e.userData, "shader", {
      value: t,
      configurable: !0,
      enumerable: !1
    });
  }, e;
}, /**
 * @typedef {Object} LODDetail
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
 * @typedef {Object} LODLevel
 * @property {number} distance Camera distance at which this level activates
 * @property {number} [hysteresis] Switch hysteresis as a fraction of distance
 * @property {LODDetail} [detail] Meshing detail for this level
 */
/**
 * Default levels for generateLODs(). LOD1 is roughly 40% of the full
 * triangle count, LOD2 roughly 20%.
 * @type {LODLevel[]}
 */
k(A, "defaultLODLevels", [
  { distance: 0, detail: {} },
  {
    distance: 100,
    hysteresis: 0.05,
    detail: {
      sectionStride: 3,
      segmentFactor: 0.75,
      leafStride: 2,
      // Slightly under the area-preserving sqrt(2): individual leaves are
      // still resolvable at this distance, so a full compensation reads as
      // "bigger leaves" rather than "same canopy".
      leafScale: 1.25
    }
  },
  {
    distance: 250,
    hysteresis: 0.05,
    detail: {
      sectionStride: 6,
      segmentFactor: 0.4,
      leafStride: 2,
      // Deliberately under-compensated: full coverage compensation for the
      // thinning + single billboard would need 2x scale, which reads as
      // balloon leaves. A slightly sparser canopy with natural-size leaves
      // looks better at this distance (fogged, 250+ units in the demo).
      leafScale: 1.3,
      billboard: E.Single
    }
  }
]);
let N = A;
export {
  E as Billboard,
  N as Tree,
  ns as TreePreset,
  L as TreeType,
  as as Trellis
};
//# sourceMappingURL=ez-tree.es.js.map
