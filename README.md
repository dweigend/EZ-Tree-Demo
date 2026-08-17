# Endless Wilds

Experimenteller WebGL2-Prototyp einer praktisch unendlichen, prozedural erzeugten Landschaft mit frei steuerbarem Flug, gestreamten Terrain-Chunks, EZ-Tree-Wäldern und GPU-animiertem Gras.

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

- `terrain/`: kontinuierliches, deterministisches Höhenfeld und recycelte Terrain-Chunks
- `trees/` und `vegetation/`: zehn einmalig erzeugte EZ-Tree-Varianten, drei LOD-Bänder und ökologische Waldverteilung
- `grass/`: ein kamera-zentriertes Instancing-Batch mit inkrementellem CPU-Aufbau und GPU-Wind
- `wind/`: gemeinsamer Zeit-, Richtungs-, Böen- und Raumphasen-Vertrag für Bäume und Gras
- `controls/`: isolierte Pointer-Lock-Flugsteuerung
- `rendering/`: WebGL2, Color Management, Himmel, Licht und begrenzte Schatten
- `world/`: explizite Frame-Reihenfolge und Lifecycle

Die Laufzeit erzeugt keine neuen EZ-Tree-Geometrien. Terrain-Ränder werden im Nebel verdeckt, Wald-Chunks vorausberechnet und Gras- sowie Terrain-Streaming über mehrere Frames verteilt, um periodische Frame-Spikes zu vermeiden.

## Abhängigkeiten

- Three.js
- [EZ-Tree](https://github.com/dgreenheck/ez-tree), MIT License, Daniel Greenheck

Vegetations-, Stein- und Bodenassets stammen aus der offiziellen EZ-Tree-Demo und werden lokal
ausgeliefert. Herkunft und Lizenzen sind unter [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md)
dokumentiert.
