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

Die Sichtweite lässt sich beim Start validiert zwischen 720 und 1500 Metern setzen. Fog,
Terrain-Fenster und Vegetations-LOD werden gemeinsam daraus abgeleitet. `relief` skaliert
die großen Hügel und Täler zwischen `0.7` und `1.4`:

```text
http://localhost:5173/?distance=900
http://localhost:5173/?distance=1200&fog=0.0014
http://localhost:5173/?distance=900&relief=1.25
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
- `trees/`: zwölf offizielle EZ-Tree-Preset-Templates in globalen Instancing-Batches und drei LOD-Bändern
- `vegetation/`: deterministische Wald-, Blumen- und Steinverteilung; sechs globale Ground-Cover-Batches
- `grass/`: ein kamera-zentriertes Instancing-Batch mit Distanz-Ausdünnung und inkrementellem Aufbau
- `wind/`: gemeinsamer Zeit-, Richtungs-, Böen- und Raumphasen-Vertrag für Bäume, Gras, Blumen und Wolken
- `controls/`: isolierte Pointer-Lock-Flugsteuerung
- `rendering/`: WebGL2, Color Management, Himmel, eine GPU-Wolkenschicht, Fog und begrenzte Schatten
- `world/`: explizite Frame-Reihenfolge und Lifecycle

Die Laufzeit erzeugt keine neuen EZ-Tree-Geometrien. Terrain-Ränder verschwinden in abgestimmtem Fog und Himmel. Das Terrain behält ein vollständiges Sicherheitsfenster um die Kamera. Vegetation nutzt darin einen vollen 3×3-Kern plus einen breiten Vorwärtssektor; weit hinter der Blickrichtung werden nur kleine Assets ausgelassen. Wald- und Ground-Cover-Daten werden vor Chunk-Wechseln in Blickrichtung priorisiert, während Gras- und Terrain-Aufbau ihre Arbeit über mehrere Frames verteilen.

## Abhängigkeiten

- Three.js
- [EZ-Tree](https://github.com/dgreenheck/ez-tree), MIT License, Daniel Greenheck

Vegetations-, Stein- und Bodenassets stammen aus der offiziellen EZ-Tree-Demo und werden lokal
ausgeliefert. Herkunft und Lizenzen sind unter [`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md)
dokumentiert.
