<!--
Purpose: Records reproducible browser performance evidence and the remaining physical-headset gate.
Context: The landscape streams terrain at 320 m/s while vegetation and tree variants update in bounded work.
Boundary: Desktop Chrome evidence is not a physical PICO 4 performance claim.
-->

# Performance-Strategie

Die Landschaft priorisiert stabile Framezeiten vor maximalem Detail. Qualitätsprofile bleiben beim Start
unveränderlich; es gibt keinen Auto-Scaler. Wiederholte Modelle sind instanziert, Terrain-Chunks werden
recycelt und optionale CPU-Arbeit wird über Folgeframes verteilt.

## Aktueller Renderpfad

- Desktop: 49 Terrain-Chunks, 31 blickrichtungsgewichtete Vegetations-Chunks und 1.050 m Sichtweite.
- Bäume: vier Arten-Slots, ein gemeinsamer Nahstamm-Batch und gemeinsame Mittel-/Fernsilhouetten.
- Hecken: zwei belaubte LOD-Batches; unsichtbare Ast-Batches sparen Draw Calls und Dreiecke.
- Boden: ein gemeinsamer 1536²-Atlas mit acht Flächen, sechs kontinuierliche Zonen, ein Albedo- und ein gepackter Surface-Sample.
- Worker: genau ein Variantenjob; 30 s Desktop, 60 s PICO, 2 s nur mit `variantStress=1`.
- Streaming: Vegetations-Rebuild, Ground-Cover-Rebuild und Terrain-Resample werden nicht gestapelt.

## Verifizierter Stand vom 19. August 2026

Headless Chrome, 1280×720, Profil `desktop`, deterministischer Flug mit 320 m/s. Drei getrennte
30-Sekunden-Fenster mit jeweils zurückgesetztem Histogramm lieferten:

| Lauf | FPS | p50 | p95 | p99 | >10,5 ms | >16,7 ms | längste Miss-Serie |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 8,3 ms | 9,1 ms | 10,3 ms | 0,808 % | 0 | 0 |
| 2 | 120 | 8,3 ms | 9,1 ms | 9,3 ms | 0,389 % | 0 | 0 |
| 3 | 120 | 8,3 ms | 9,1 ms | 9,4 ms | 0,306 % | 0 | 0 |

Die reguläre 30-Sekunden-Erzeugung lief dabei parallel. Bis Lauf 3 waren Ash, Aspen und Oak bereits
von Medium auf neue Small-Geometrien rotiert. Die letzten Worker-Jobs benötigten 25,7 ms, 9,1 ms und
12,4 ms auf dem Worker; der Main Thread erhielt nur Transferables.

Ein zusätzlicher 1440×900-Lauf zeigte 2,436 % Frames über 10,5 ms und vier Einzelbilder über 16,7 ms.
Er ist deshalb ausdrücklich keine bestandene 120-FPS-Konfiguration. Reproduzierbare Desktop-Akzeptanz
bezieht sich auf die im Playwright-Profil festgelegten 1280×720.

## Automatisierte Gates

```bash
bun run test
bun run check
bun run build
bun run test:browser
```

Der Browserlauf prüft statische Dichte, 320-m/s-Streaming, Worker-Stress und das nicht immersive
PICO-Geometrieprofil. Desktop-Akzeptanz: mindestens 118 angezeigte FPS, p50 höchstens 8,4 ms, p95
höchstens 9,3 ms, p99 höchstens 10,5 ms, höchstens 1 % über 10,5 ms und keine zwei Misses in Folge.

## Physische PICO-4-Freigabe

1. Über HTTPS mit `?profile=pico90&benchmark=xr-flight` öffnen und VR starten.
2. `xr.frameRate === 90` und `xr.targetRequestSucceeded === true` bestätigen.
3. Nach 60 Sekunden Warm-up das Histogramm zurücksetzen und zehn Minuten mit Kopfbewegung messen.
4. Akzeptanz: p99 höchstens 12 ms, höchstens 0,1 % über 16,7 ms, keine drei Misses in Folge,
   höchstens 32 Calls und höchstens 0,8 M Dreiecke.
5. Zehn XR-Ein-/Ausstiege ohne Shader-, Worker-, Naht- oder Lifecycle-Fehler durchführen.

Desktop-RAF ersetzt weder Stereo-, Thermal-, Komfort- noch Passthrough-Prüfung auf dem Headset.

## Nächste Eskalationsstufen

Nur bei gemessenem Engpass: Terrain zeilenweise vorbereiten, KTX2/Basis testen, GPU-Timer ergänzen oder
regionale Batches abwägen. Regionale Manager, LOD-Crossfades, zusätzliche Render-Pässe und dynamische
Qualitätsregler bleiben außerhalb des Kernpfads.
