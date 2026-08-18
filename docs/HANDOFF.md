<!--
Purpose: Records the verified landscape implementation, performance invariants, and remaining acceptance gates.
Context: Dense instanced vegetation, seven terrain surfaces, fixed quality profiles, and browser benchmarks share one lifecycle.
Boundary: Desktop browser evidence does not claim physical PICO performance or resolve documented asset defects.
-->

# Landscape implementation handoff

## Implementierter Stand

- `desktop` und `pico90` sind unveränderliche Startprofile. Sie begrenzen Sichtweite, Geometrie,
  Instanzkapazitäten, Pixel Ratio, Schatten und XR-Auflösung ohne laufenden Auto-Quality-Regler.
- `WorldRuntime` besitzt Lifecycle und Frame-Reihenfolge. Terrain, Bäume, Steine und Gras bleiben
  getrennte Systeme mit deterministischer Verteilung und festen GPU-Ressourcen.
- Ein recycelter Terrain-Pool erzeugt eine kontinuierliche Welt, ohne während des Flugs neue Chunk-Meshes
  anzulegen. Neue Chunks werden nach Blickrichtung priorisiert und einzeln über Folgeframes resampelt.
- Sieben Poly-Haven-CC0-Materialien bilden Wiese, Matsch, drei Waldböden, Fels und Geröllweg. Zwei
  Albedo-Samples mischen Zonengrenzen; eine dominante RGBA-Surface-Map liefert Normalen und räumliche
  Roughness ohne weiteren Texture-Sample oder Displacement.
- Eine kamerabegleitende `DirectionalLight` dient als Sonne. Das begrenzte Shadow-Frustum folgt der
  Kamera; Hemisphere- und Ambient-Light bleiben niedrig genug, damit Materialrelief sichtbar bleibt.
- Drei EZ-Tree-Varianten werden einmalig erzeugt. Harte Near/Middle/Far-LODs, gemeinsame Distanzgeometrie,
  vereinfachte Distanzstämme und globale `InstancedMesh`-Batches halten Draw Calls stabil.
- Zwei Gras-Batches rendern organische Wiesen-Cluster und größere Büschel. Platzierung geschieht
  schrittweise auf der CPU; Wind, Rotation und individuelle Phase laufen anschließend im Vertex-Shader.
- Drei globale Stein-Batches behalten die importierten PBR-Materialien und variieren nur Matrix und Farbe.
- Browserdiagnostik und deterministische Flugtests prüfen Dichte, Draw Calls, Dreiecke, FPS und
  Framezeit-Perzentile. Messwerte und die physische PICO-Prozedur stehen in `docs/PERFORMANCE.md`.

## Performance-Invarianten

Diese Regeln sind bewusst einfach gehalten und sollten nur nach einer reproduzierbaren Messung geändert werden:

1. Wiederholte Assets bleiben instanziert; pro sichtbarem Objekt entstehen keine eigenen `Object3D`s.
2. Kapazitätsbuffer sind fest alloziert, aber Three.js lädt nur ihren belegten Präfix zur GPU hoch.
3. Chunk-Wechsel, Vegetations-Rebuild und Prefetch/Resampling werden nicht im selben Frame gestapelt.
4. Gras wird erst nach einer relevanten Kamerabewegung neu aufgebaut und pro Frame auf 160 Kandidaten begrenzt.
5. Baum- und Steinfenster werden bei Chunk-Wechseln oder deutlichen Richtungsänderungen neu aufgebaut,
   nicht durch hunderte CPU-Sichtbarkeitstests pro Frame.
6. Terrain mischt zwei Farbschichten, liest aber nur eine gepackte Surface-Schicht. Mehr Materialdetail
   darf diesen Texture-Sample-Vertrag nicht ohne neue GPU-Messung vergrößern.
7. Fog, harte LOD-Grenzen und begrenzte Schatten ersetzen Crossfades und große globale Shadow-Maps.

## Lokale Verifikation

Vor jedem Performance-Checkpoint müssen folgende Gates erfolgreich sein:

```bash
bun run assets:atlas
bun run test
bun run check
bun run build
bun run test:browser
git diff --check
```

`bun run test:browser` enthält statische Dichte-, Desktop-Flug- und PICO-Profilbudgets. Ein bestandener
PICO-Browsertest ist lediglich ein Geometrie-/Draw-Call-Gate und keine Headset-Freigabe.

## Bekannte Grenze: Stein-Decimation

`GroundCoverSystem` reduziert die drei texturierten Rock-GLBs beim Start mit `SimplifyModifier` auf 22 %
der Quellvertices. Die Originale sind geometrisch geschlossen und ihre Materialien sind opaque sowie
doppelseitig. Die aggressive Vereinfachung öffnet jedoch 227, 174 und 218 geometrische Kanten und erzeugt
teilweise umgedrehte Normalen. Direktes Sonnenlicht macht diese Flächen als scheinbare Löcher sichtbar.

Die dauerhafte Lösung sind offline erzeugte, watertichte Low-Poly-GLBs mit neu berechneten Normalen.
Dadurch bleiben drei Instancing-Batches und der aktuelle Laufzeitpfad erhalten. Als kurzfristige Variante
blieben bei 75 % Retention alle drei Testgeometrien geschlossen; diese Änderung erhöht die Stein-Dreiecke
jedoch ungefähr um Faktor fünf und muss deshalb erneut gegen Desktop und physische PICO 4 gemessen werden.
`DoubleSide`, mehr Ambient Light oder `flatShading` beheben die beschädigte Topologie nicht.

## Verbleibende externe Gates

- Physische PICO-4-Prüfung: 90 Hz, p99, thermische Stabilität, Stereoqualität sowie zehn XR-Ein-/Ausstiege.
- Die GPT-/PATINA-Skripte sind optionale Asset-Experimente. Die aktive Terrain-Palette wird vollständig
  aus eingecheckten Poly-Haven-Quelldateien gebaut und benötigt keine API-Zugangsdaten.

## KISS-/YAGNI-Grenze

Keinen Biome-Manager, Material-Registry, Runtime-Palettenwechsel, adaptiven Quality-Controller,
LOD-Crossfade oder zusätzliche Render-Pässe ergänzen, solange ein gemessener Engpass sie nicht verlangt.
Neue Assets sollen vorhandene Instancing-Batches und Profile nutzen. KTX2, regionale Batches und Impostors
bleiben evidenzgebundene Eskalationsstufen gemäß `docs/PERFORMANCE.md`.
