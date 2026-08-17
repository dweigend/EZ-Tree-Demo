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
bun run build
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
- `trees/`: zehn einmalig erzeugte EZ-Tree-Varianten in globalen Instancing-Batches und drei LOD-Bändern
- `vegetation/`: deterministische Wald-, Blumen- und Steinverteilung; sechs globale Ground-Cover-Batches
- `grass/`: ein kamera-zentriertes Instancing-Batch mit Distanz-Ausdünnung und inkrementellem Aufbau
- `wind/`: gemeinsamer Zeit-, Richtungs-, Böen- und Raumphasen-Vertrag für Bäume, Gras, Blumen und Wolken
- `controls/`: isolierte Pointer-Lock-Flugsteuerung
- `rendering/`: WebGL2, Color Management, Himmel, eine GPU-Wolkenschicht, Fog und begrenzte Schatten
- `world/`: explizite Frame-Reihenfolge und Lifecycle

Die Laufzeit erzeugt keine neuen EZ-Tree-Geometrien. Terrain-Ränder verschwinden in abgestimmtem Fog und Himmel. Wald- und Ground-Cover-Daten werden vor Chunk-Wechseln vorausberechnet; Gras- und Terrain-Aufbau verteilen ihre Arbeit über mehrere Frames.

## Abhängigkeiten

- Three.js
- [EZ-Tree](https://github.com/dgreenheck/ez-tree), MIT License, Daniel Greenheck

Vegetations-, Stein- und Bodenassets stammen aus der offiziellen EZ-Tree-Demo und werden lokal
ausgeliefert. Herkunft und Lizenzen sind unter [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md)
dokumentiert.
