# Architektur und Einstieg

Dieses Dokument ist der Startpunkt für Änderungen an der Landschaft. Die Architektur hält
Erzeugung, Rendering und Lifecycle bewusst getrennt: Ein gemeinsames Feld beschreibt die Welt,
konkrete Systeme rendern sie, und `WorldRuntime` verbindet beides explizit.

## Start here: Modulbesitz

| Modul | Hauptverantwortung | Besitzt ausdrücklich nicht |
|---|---|---|
| `src/config.ts` | validierte Defaults, URL-Parameter und Feature-Flags | Rendering und Lifecycle |
| `src/core/` | deterministische Hash- und Zufallsfunktionen | Landschaftsregeln |
| `src/ecology/` | zusammenhängende Wald-, Wiesen-, Fels-, Hecken- und See-Masken | Meshes und Assets |
| `src/terrain/` | Höhe, Bodenoberfläche, Chunk-Recycling und einfache Landschafts-Layer | Vegetationsarten |
| `src/grass/` | Gras-Build-Job, Instancing und GPU-Wind | globale Habitatdefinition |
| `src/trees/` | EZ-Tree-Templates, LOD-Geometrien, Materialien und Baum-Batches | Waldmaske |
| `src/vegetation/` | Baum-, Blumen- und Steinplatzierung sowie Ground-Cover-Batches | Frame-Loop |
| `src/wind/` | gemeinsamer Uniform-Vertrag und günstige Shaderwellen | Instanzplatzierung |
| `src/rendering/` | Renderer, Licht, Himmel und kleine Render-Hilfen | Weltregeln |
| `src/world/` | Chunk-Koordinaten, Diagnostics, Composition Root und Frame-Reihenfolge | Detailalgorithmen der Systeme |
| `src/main.ts` | DOM, Asset-Startup und Seiten-Lifecycle | Szenenaufbau |

Neue Logik gehört in den Besitzer ihres fachlichen Zustands. `WorldRuntime` darf Systeme
zusammenstecken und aufrufen, aber keine neue Verteilungsformel aufnehmen.

## Konfiguration und URL-Parameter

`createLandscapeConfig()` in `src/config.ts` ist die einzige öffentliche Tuning-Oberfläche.
Externe URL-Werte werden dort gelesen, begrenzt und anschließend als unveränderliche `CONFIG`
bereitgestellt. Laufzeitsysteme parsen keine URLs.

| Parameter | Default | gültiger Bereich oder Regel | Wirkung |
|---|---:|---|---|
| `seed` | `endless-wilds-2026` | nicht-leere Zeichenfolge | deterministische Welt |
| `distance` | `1050` | `720` bis `1500` | Terrain-Fenster, LOD, Fog und CPU-Arbeit |
| `fog` | `1.7 / distance` | `0.0008` bis `0.0026` | GPU-Fog |
| `relief` | `1` | `0.7` bis `1.4` | große Höhenunterschiede auf der CPU |
| `forestDensity` | `1` | `0.5` bis `1.5` | akzeptierte Baumkandidaten |
| `grassDensity` | `1` | `0.5` bis `1.5` | akzeptierte Graskandidaten |
| Feature-Name | aktiv | nur `0` deaktiviert | Aufbau und Update des Feature-Besitzers |

Feature-Namen sind `trees`, `grass`, `flowers`, `rocks`, `hedges`, `lakes` und `surface`.
Beispiele:

```text
?distance=900&relief=1.2
?seed=review-03&forestDensity=1.25&grassDensity=0.8
?rocks=0&lakes=0
```

Ein Flag ist zunächst nur validierte Konfiguration. Die Aktivierung geschieht ausdrücklich im
Composition Root: Konstruktion überspringen, Scene-Objekt nicht hinzufügen, Updates auslassen und
nichts entsorgen, was nicht erzeugt wurde. Ein Layer aktiviert sich nie durch seinen Import.

Aktueller Integrationsstand:

- `WorldRuntime` erzeugt ein gemeinsames `EcologyField` für Terrain, Gras, Wald und Ground Cover.
- Terrain, Bäume, Gras, Blumen, Steine und niedrige Hecken reagieren auf ihre Feature-Flags.
- `LakeLayer` wird bei aktivem `lakes`-Flag erzeugt, beim Terrain-Fensterwechsel neu belegt und in
  Diagnostics sowie `dispose()` berücksichtigt.
- `surface` ist bereits Teil des Konfigurationsvertrags, wird aber noch von keinem eigenen
  Render-Layer ausgewertet.
- Der Asset Loader lädt Gras-, Blumen- und Stein-GLBs derzeit gemeinsam beim Start. Ein deaktivierter
  Renderer spart deshalb Laufzeitarbeit, aber erst ein späterer bedingter Loader würde auch Download
  und Startup-Arbeit sparen.

## Startup und Lifecycle

```text
main.ts
  -> loadLandscapeAssets()
  -> new WorldRuntime(mount, diagnostics, assets)
       -> Renderer, Scene, Environment
       -> HeightField und TerrainSystem
       -> Controls, Wind und Vegetationssysteme
       -> Scene-Objekte hinzufügen
  -> runtime.start()
       -> erste Terrain- und Vegetationsbelegung
       -> Renderer-Animation-Loop starten
  -> pagehide
       -> runtime.dispose()
```

Jeder Besitzer stellt eine kleine Lifecycle-Oberfläche bereit: typischerweise `update()` oder
`rebuild()` und immer `dispose()`. Ressourcen werden dort freigegeben, wo Geometrie, Material oder
Event Listener erzeugt wurden.

Der `LakeLayer` folgt genau diesem Vertrag:

- `mesh`: ein `InstancedMesh`, das der Composition Root zur Scene hinzufügt
- `rebuild(position, viewDirection?)`: sucht deterministische Makro-Seen in der Umgebung und lädt
  höchstens acht Instanzmatrizen hoch
- `visibleLakeCount`: Diagnostics-Wert
- `dispose()`: gibt Instanz-, Geometrie- und Materialressourcen frei

Er verwendet dieselbe `EcologyField`-Instanz wie der dazugehörige `HeightField`. Der Root erzeugt
ihn nur bei aktivem `CONFIG.features.lakes`, belegt ihn beim Start und nach einem
Terrain-Fensterwechsel neu, schreibt den Count in Diagnostics und entsorgt ihn am Ende.

## Frame-Reihenfolge

Die Reihenfolge in `WorldRuntime.renderFrame()` ist Teil des Verhaltens:

1. Delta begrenzen und Flugsteuerung aktualisieren.
2. Blickrichtung lesen und Verteilungs-Caches vorladen.
3. Terrain-Fenster prüfen und höchstens eine teure Streaming-Arbeit ausführen.
4. Baum- und Ground-Cover-Batches nur bei Fenster- oder deutlicher Richtungsänderung erneuern.
5. Den inkrementellen Gras-Build fortsetzen.
6. Wind-Uniforms und kameragebundene Umgebung aktualisieren.
7. Scene rendern und Diagnostics in niedrigerer Frequenz aktualisieren.

Ein neues Feature darf nicht mehrere dieser teuren Schritte in demselben Grenzframe bündeln. Statische
Makro-Layer werden nur bei einem relevanten Fensterwechsel neu aufgebaut, nicht in jedem Frame.

## CPU- und GPU-Grenze

| Arbeit | CPU | GPU |
|---|:---:|:---:|
| URL-Validierung, Seeds und Feature-Entscheidung | ✓ | |
| Höhen-, Feuchtigkeits- und Habitat-Noise | ✓ | |
| Kandidatenauswahl, Chunk-Caches und LOD-Zuordnung | ✓ | |
| Instanzmatrizen und belegte Buffer-Präfixe schreiben | ✓ | Upload |
| Terrain-, Baum-, Gras-, Blumen-, Stein- und See-Instancing | Vorbereitung | ✓ |
| Gras-, Blatt- und Blumenwind | Uniform-Update | Vertex-Shader |
| Terrain-Texturblend, Beleuchtung, Fog und Transparenz | | Fragment-Shader |
| FPS, Counts und `renderer.info` | ✓ | keine echte GPU-Zeit |

Der See-Pfad verwendet eine wiederverwendete 28-Segment-Kreisgeometrie, ein günstiges
`MeshStandardMaterial` und maximal acht Instanzen in einem Draw Call. Es gibt keine Reflection Map,
kein Render Target und kein Three.js-`Water`-Addon.

## Abhängigkeitsrichtung

```text
config + core
  -> ecology + terrain fields
    -> placement/distribution
      -> geometry/material/render systems
        -> world runtime
          -> main
```

Regeln:

- `config`, `core`, `ecology` und Terrain-Felder importieren keinen Renderer.
- Distributionen liefern Daten und besitzen keine Scene-Objekte.
- Render-Systeme dürfen Felder und Distributionen konsumieren, aber nicht den `WorldRuntime`.
- Nur der Composition Root kennt alle Systeme und deren Aufrufreihenfolge.
- Gemeinsame Shaderlogik bleibt in kleinen Shader-Chunks; es gibt kein generisches Shader-Framework.

## Ein Landschaftselement ergänzen

1. **Notwendigkeit prüfen:** Lässt sich der gewünschte Eindruck mit einem vorhandenen Asset, Habitat
   oder Material erreichen?
2. **Konfiguration definieren:** Nur einen öffentlichen Parameter oder Toggle ergänzen, wenn Nutzer
   ihn wirklich verändern sollen. Renderbudgets getrennt von visueller Dichte halten.
3. **Ökologische Bedeutung festlegen:** Eine gemeinsame Habitat- oder Makromaske verwenden, damit
   andere Layer Vegetation am selben Ort fördern oder unterdrücken können.
4. **Daten vor Rendering:** Deterministische Position, Rotation, Variation und stabilen Rang erzeugen.
   Keine `Math.random()`-Sonderlösung im Renderer.
5. **Begrenzten Renderer bauen:** Feste Kapazität, Instancing, wiederverwendete Geometrie und einen
   klaren `dispose()`-Pfad bevorzugen.
6. **Im Root aktivieren:** Flag prüfen, Scene-Objekt hinzufügen, Update-Stelle und Dispose-Stelle
   sichtbar verdrahten.
7. **Diagnostics und Tests ergänzen:** Count, deterministische Wiederholung, Dichte-Monotonie und
   Chunk-Rückkehr prüfen.
8. **Visuell und performant abnehmen:** Fester Seed und Kamerapunkt, Grenzflug, Console-/Shaderfehler,
   Draw Calls und Frame-Peaks vergleichen.

Neue GLB-Assets benötigen Herkunft, Lizenz und Attribution in `public/assets/ATTRIBUTION.md`. Vor
zusätzlichen Libraries sind Three.js, vorhandene Addons und bestehende Projektbausteine zu prüfen.

## Validierung

```bash
bun run check
bun test
bun run build
git diff --check
```

Danach folgt ein Browser-Smoke-Test mit festem Seed. Für Verteilungsänderungen gehören mindestens ein
fester Kamerapunkt, ein Flug über mehrere Chunk-Grenzen, ein Screenshot und die Werte aus
`window.__LANDSCAPE_DIAGNOSTICS__` zur Abnahme. Desktop-RAF-Werte ersetzen keine spätere
WebXR-/Headset-Messung.

Gemessene Budgets und bekannte Eskalationsstufen stehen in [`PERFORMANCE.md`](PERFORMANCE.md).
