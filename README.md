# Endless Wilds

Experimenteller WebGL2-Prototyp einer praktisch unendlichen, prozedural erzeugten Landschaft mit frei steuerbarem Flug, gestreamten Terrain-Chunks und instanzierter Vegetation aus EZ-Tree-Assets.

## Start

```bash
bun install
bun run dev
```

Produktionsprüfung:

```bash
bun run check
bun test
bun run build
```

Alle öffentlichen Laufzeitparameter werden in `src/config.ts` validiert. Die Sichtweite liegt
zwischen 720 und 1500 Metern; Fog, Terrain-Fenster und Vegetations-LOD werden daraus abgeleitet.
`relief`, `forestDensity` und `grassDensity` verändern die Landschaft, ohne Renderbudgets
aufzuheben:

```text
http://localhost:5173/?distance=900
http://localhost:5173/?distance=1200&fog=0.0014
http://localhost:5173/?distance=900&relief=1.25
http://localhost:5173/?forestDensity=1.25&grassDensity=0.8
```

Mit `seed` lässt sich eine andere deterministische Welt wählen. Die Feature-Parameter `trees`,
`grass`, `flowers`, `rocks`, `hedges`, `lakes` und `surface` folgen einer einfachen Regel:
Nur der Wert `0` deaktiviert ein Feature. Ein Feature wird wirksam, sobald sein Besitzer im
`WorldRuntime` verdrahtet ist; eigenständige Render-Layer aktivieren sich nicht selbst.

```text
http://localhost:5173/?seed=meine-welt&rocks=0&lakes=0
```

## Steuerung

- Klick: Pointer Lock
- WASD: vorwärts, rückwärts und seitwärts
- Maus: Blickrichtung
- Space / Shift: steigen / sinken
- Mausrad: Fluggeschwindigkeit
- Escape: Pointer Lock verlassen

## Architektur

- `terrain/`: kontinuierliches Höhenfeld, recycelte Chunks und weltkoordinatenbasierte Gras-Erde-Mischung
- `ecology/`: gemeinsame deterministische Habitatmasken und Makroelemente ohne Rendering
- `trees/`: acht Baum- und zwei Busch-Templates aus offiziellen EZ-Tree-Presets in globalen Instancing-Batches und drei LOD-Bändern
- `vegetation/`: deterministische Wald-, Blumen- und Steinverteilung; sechs globale Ground-Cover-Batches
- `grass/`: ein kamera-zentriertes Instancing-Batch mit Distanz-Ausdünnung und inkrementellem Aufbau
- `wind/`: gemeinsamer Zeit-, Richtungs-, Böen- und Raumphasen-Vertrag für Bäume, Gras und Blumen
- `controls/`: isolierte Pointer-Lock-Flugsteuerung
- `rendering/`: WebGL2, Color Management, atmosphärischer Himmel, Fog und begrenzte Schatten
- `world/`: explizite Frame-Reihenfolge und Lifecycle

Die Laufzeit erzeugt keine neuen EZ-Tree-Geometrien. Terrain-Ränder verschwinden in abgestimmtem Fog und Himmel. Das Terrain behält ein vollständiges Sicherheitsfenster um die Kamera. Vegetation nutzt darin einen vollen 3×3-Kern plus einen breiten Vorwärtssektor; weit hinter der Blickrichtung werden nur kleine Assets ausgelassen. Wald- und Ground-Cover-Daten werden vor Chunk-Wechseln in Blickrichtung priorisiert, während Gras- und Terrain-Aufbau ihre Arbeit über mehrere Frames verteilen.

Der vollständige Einstieg mit Modulbesitz, Startup- und Frame-Fluss, CPU-/GPU-Grenzen und dem
Vorgehen für neue Landschaftselemente steht in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Abhängigkeiten

- Three.js
- [EZ-Tree](https://github.com/dgreenheck/ez-tree), MIT License, Daniel Greenheck

Vegetations-, Stein- und Bodenassets stammen aus der offiziellen EZ-Tree-Demo und werden lokal
ausgeliefert. Herkunft und Lizenzen sind unter [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md)
dokumentiert.

Gemessene Budgets und priorisierte nächste Optimierungen stehen in [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).
