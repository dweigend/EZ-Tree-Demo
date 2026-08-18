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

- `terrain/`: kontinuierliches Höhenfeld, recycelte Chunks und vier organisch gemischte Atlas-Materialien
- `ecology/`: gemeinsame Feuchte-, Bodenbedeckungs- und Wald-Makrofelder ohne Platzierungsregeln
- `trees/`: drei offizielle mittlere EZ-Tree-Templates in globalen Instancing-Batches und drei harten LOD-Bändern
- `vegetation/`: deterministische Steinverteilung in drei globalen Ground-Cover-Batches
- `grass/`: organische Wiesenmaske, zusammengesetzte Patch-Cluster und größere Büschel in zwei Instancing-Batches
- `wind/`: gemeinsamer Zeit-, Richtungs-, Böen- und Raumphasen-Vertrag für Bäume und beide Grasebenen
- `controls/`: isolierte Pointer-Lock-Flugsteuerung
- `rendering/`: WebGL2, Color Management, atmosphärischer Himmel, Fog und begrenzte Schatten
- `world/`: explizite Frame-Reihenfolge und Lifecycle

Wiese, Talboden, Waldboden und exponierter Boden werden aus Höhe, Hang, Feuchte und Woodland in
absoluten Weltkoordinaten gewichtet. Die Gewichte entstehen nur bei einer Chunk-Zuweisung. PICO
mischt zwei Albedo-Samples und liest eine dominante Normalmap; es entsteht keine Per-Frame-CPU-Arbeit.

## Terrain-Materialien erzeugen

Die zehn reproduzierbaren GPT-Referenzprompts liegen in `assets/source/terrain-materials/prompts.jsonl`.
Die Pipeline erzeugt daraus PATINA-PBR-Kandidaten und packt die vier markierten Gewinner in feste
Desktop-/PICO-Atlanten:

```bash
export OPENAI_API_KEY=...
export FAL_KEY=...
bun run assets:all
```

Einzelne Stufen sind `assets:references`, `assets:patina` und `assets:atlas`. Die Zugangsdaten werden
nur von den Offline-CLIs gelesen und nie an den Browser ausgeliefert. Solange noch keine API-Ausgabe
erzeugt wurde, nutzt die Demo einen kompatiblen vierteiligen Platzhalter-Atlas aus den vorhandenen
EZ-Tree-Bodentexturen.

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
