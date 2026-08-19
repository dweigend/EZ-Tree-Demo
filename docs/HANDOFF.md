<!--
Purpose: Summarises the current landscape implementation, invariants, verification, and open external gate.
Context: Six ecology zones drive eight ground surfaces, four tree slots, hedges, and worker variants.
Boundary: This handoff records implemented code; physical PICO acceptance remains external.
-->

# Landscape implementation handoff

## Implementierter Stand

- Alle 16 offiziellen EZ-Tree-1.1-Presets liegen unverändert unter `src/trees/presets/`.
- Ash, Aspen, Oak und Pine starten mit Medium-Presets. Bush 1–3 und Trellis speisen einen Hecken-Slot;
  beim Trellis bleibt das künstliche Gitter unsichtbar.
- Sechs kontinuierliche Zonen (`meadow`, `wetLowland`, `dryBroadleaf`, `moistBroadleaf`,
  `coniferHighland`, `rockyRidge`) werden von Terrain und Baumartenwahl gemeinsam genutzt.
- Acht lokale Poly-Haven-CC0-Flächen enthalten nun Forest Ground 03 als Nadelboden. Der gemeinsame
  1536²-3×3-Atlas behält einen freien Füllslot und benötigt zur Laufzeit keinen Netzzugriff.
- Hecken entstehen als deterministische, gebogene und absichtlich lückenhafte Makro-Zeilen. Sie meiden
  steile Hänge, Felsrücken und Wege und besitzen eindeutige Chunk-Zugehörigkeit.
- Ein ES-Module-Worker rotiert alle Presets. Seed, Astwinkel, Gnarliness und Länge variieren um höchstens
  fünf Prozent, Blattgröße um höchstens acht Prozent; Topologiebudgets bleiben unverändert.
- Neue Worker-Geometrie wird nur als Typed Array übertragen. Ohne unsichtbare Slot-Lücke bleibt die
  bisherige Geometrie aktiv. Bei Workerfehler gibt es keinen Main-Thread-Fallback.

## Visuelle QA

Player-Screenshots liegen unter `output/playwright/`. Geprüft wurden Startbereich und mehrere Punkte
des 320-m/s-Flugs. Der erste Durchgang zeigte polygonale Top-2-Bodeninseln und schwarze, zu kleine
Fernkronen. Der finale Shader nutzt kontinuierliche Makrofarben, ein gemeinsames neutrales Albedo-
Mikrodetail und zonengerechte dominante Surface-Daten; dadurch verschwanden die Konturringe ohne einen
zusätzlichen Texture-Sample. Baumfarben und Blattkarten wurden ohne zusätzliche Geometrie aufgehellt.

Im finalen Stand sind keine Chunk-Nähte, Atlasblutungen, schwarzen Alpha-Ränder, schwebenden Hecken oder
harten Materialkonturen sichtbar. Wege und Fels-/Reliefzonen bleiben bewusst erkennbar. Fernkronen sind
aus Performancegründen weiterhin luftiger als Nahbäume, aber nicht mehr schwarz.

## Invarianten

1. Keine per-Objekt-`Object3D`s für wiederholte Landschaftsassets.
2. Feste Kapazitäten und nur belegte GPU-Bufferpräfixe.
3. Höchstens ein Variantenjob; niemals synchrone EZ-Tree-Erzeugung nach dem Start.
4. Terrain, Wald, Hecken, Gras und Steine behalten getrennte fachliche Verteilungen.
5. Ein Albedo- plus ein gepackter Surface-Sample für den Boden.
6. Keine gelockerten Browserbudgets als Ersatz für eine Optimierung.

## Lokale Verifikation

```bash
bun run assets:atlas
bun run test
bun run check
bun run build
bun run test:browser
git diff --check
```

Die exakten Langlaufwerte stehen in `docs/PERFORMANCE.md`. Das PICO-Browserprofil ist nur ein Draw-Call-
und Geometrie-Gate; 90 Hz, Thermik, Stereoqualität und XR-Lifecycle müssen physisch geprüft werden.
