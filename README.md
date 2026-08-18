# Endless Wilds

Experimenteller WebGL2-Prototyp einer praktisch unendlichen, prozedural erzeugten Landschaft mit frei steuerbarem Flug, gestreamten Terrain-Chunks und instanzierter Vegetation aus lizenzierten Assets.

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

Zwei unveränderliche Startprofile halten die Qualitätsentscheidung vorhersehbar. Das PICO-Profil
aktiviert zusätzlich den minimalen WebXR-Einstieg und fordert auf unterstützten Geräten 90 Hz an:

```text
http://localhost:5173/?profile=desktop
https://<device-reachable-host>/?profile=pico90
```

Reproduzierbare Flugmessungen laufen ohne Pointer-Lock über `benchmark=desktop-flight` oder
`benchmark=xr-flight`. Messwerte stehen unter `window.__LANDSCAPE_BENCHMARK__` bereit.

## Steuerung

- Klick: Pointer Lock
- WASD: vorwärts, rückwärts und seitwärts
- Maus: Blickrichtung
- Space / Shift: steigen / sinken
- Mausrad: Fluggeschwindigkeit
- Escape: Pointer Lock verlassen

## Architektur

- `terrain/`: kontinuierliches Höhenfeld, recycelte Chunks und sieben organisch gemischte Atlas-Materialien
- `ecology/`: gemeinsame Feuchte-, Bodenbedeckungs- und Wald-Makrofelder ohne Platzierungsregeln
- `trees/`: drei offizielle mittlere EZ-Tree-Templates in globalen Instancing-Batches und drei harten LOD-Bändern
- `vegetation/`: deterministische Steinverteilung in drei globalen Ground-Cover-Batches
- `grass/`: organische Wiesenmaske, zusammengesetzte Patch-Cluster und größere Büschel in zwei Instancing-Batches
- `wind/`: gemeinsamer Zeit-, Richtungs-, Böen- und Raumphasen-Vertrag für Bäume und beide Grasebenen
- `controls/`: isolierte Pointer-Lock-Flugsteuerung
- `rendering/`: WebGL2, Color Management, atmosphärischer Himmel, Fog und begrenzte Schatten
- `world/`: explizite Frame-Reihenfolge und Lifecycle

Alle mehrfach vorkommenden Modellassets werden pro Geometrie-/Material-/LOD-Kombination in einem
fest dimensionierten `InstancedMesh` gebündelt. Nur Matrix, Farbe und Windwerte variieren je Instanz.
Terrain-Chunks bleiben recycelte Einzelmeshes, da jeder Chunk eigene Vertexhöhen und Bodengewichte trägt.

Wiese, Matsch, drei Waldböden, Fels und Geröllwege werden aus Höhe, Hang, Feuchte, Woodland und
verzerrten Weltkoordinaten gewichtet. Die Gewichte entstehen nur bei einer Chunk-Zuweisung. Desktop
und PICO mischen höchstens zwei Albedo-Samples; PICO liest nur die dominante Normalmap. Es entsteht
keine Per-Frame-CPU-Arbeit.

## Terrain-Materialien bauen

Die aktive Palette nutzt sieben lokale Poly-Haven-CC0-Materialien. Quellen, Autoren, Kachelung und
Download-URLs stehen in `assets/source/terrain-materials/polyhaven.json`. ImageMagick packt daraus
feste Desktop-/PICO-Atlanten:

```bash
bun run assets:all
```

`assets:all` und `assets:atlas` bauen ausschließlich aus den eingecheckten Quelldateien und benötigen
keinen Netz- oder API-Zugriff. Die bisherigen GPT-/PATINA-Skripte bleiben als getrennte Experimente
verfügbar, sind aber nicht Teil des aktiven Runtime-Builds.

## Tests

```bash
bun run test
bun run check
bun run build
bun run test:browser
```

Der Browser-Test prüft statischen dichten Wald, einen 12-Sekunden-Flug und die PICO-Geometriebudgets.
Die physische PICO-90-Freigabe bleibt ein separater Hardware-Test gemäß `docs/PERFORMANCE.md`.

Die Laufzeit erzeugt keine neuen EZ-Tree-Geometrien. Terrain-Ränder verschwinden in abgestimmtem Fog und Himmel. Das Terrain behält ein vollständiges Sicherheitsfenster um die Kamera. Vegetation nutzt darin einen vollen 3×3-Kern plus einen breiten Vorwärtssektor; weit hinter der Blickrichtung werden nur kleine Assets ausgelassen. Wald- und Ground-Cover-Daten werden vor Chunk-Wechseln in Blickrichtung priorisiert, während Gras- und Terrain-Aufbau ihre Arbeit über mehrere Frames verteilen.

## Abhängigkeiten

- Three.js
- [EZ-Tree](https://github.com/dgreenheck/ez-tree), MIT License, Daniel Greenheck
- [Poly Pizza](https://poly.pizza/), Grass Patch und Tuft of grass, CC BY 3.0

Vegetations-, Stein- und Bodenassets werden lokal ausgeliefert. Herkunft und Lizenzen sind unter
[`public/assets/ATTRIBUTION.md`](public/assets/ATTRIBUTION.md) dokumentiert.

Gemessene Budgets und priorisierte nächste Optimierungen stehen in [`docs/PERFORMANCE.md`](docs/PERFORMANCE.md).
