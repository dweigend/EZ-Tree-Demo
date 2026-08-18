# Performance-Strategie

Die Landschaft priorisiert stabile Framezeiten vor maximaler Objektdichte. Die Messwerte stammen aus einem automatisierten Desktop-Chromium-Flug und sind kein Ersatz für ein späteres WebXR-Profil auf dem Zielgerät.

## Aktueller Stand

- Terrain: 49 recycelte Chunks bei der Standardsichtweite
- Vegetationsdetail: 31 blickrichtungsgewichtete Chunks mit vollem 3×3-Sicherheitskern
- Rendering: globale Instancing-Batches, drei einmalig erzeugte EZ-Tree-Templates, drei harte Baum-LOD-Bänder, ein Gras-Batch und sechs Ground-Cover-Batches
- Streaming: Baum-Rebuild, Ground-Cover-Rebuild und Terrain-Resample werden auf getrennte Frames verteilt
- Buffer: dynamische Instanzattribute laden nur den tatsächlich belegten Präfix über die Three.js-Update-Ranges hoch
- Sichtkanten: Distanz-Ausdünnung, harte LOD-Bänder und abgestimmter Fog statt doppelter Instanzen in Kreuzblenden

Ein reproduzierter 12-Sekunden-Testflug mit 220 m/s in Headless Chrome bei 1280×720 sank gegenüber `ec713e2` von 20,2 auf 8,17 ms mittlere Framezeit. p99 sank von 40,6 auf 10,1 ms, der höchste beobachtete Frame von 58,1 auf 17,5 ms. Im vereinfachten Lauf trat kein Frame über 20 ms auf. Die Startzeit bis zur ersten Laufzeitdiagnose sank von rund 2,27 auf 1,18 Sekunden.

Die größten entfernten Kosten waren doppelte EZ-Tree-Generierung, große Presets, LOD-Kreuzblenden mit doppelten Instanzen, vollständig hochgeladene Kapazitätsbuffer und eine transparente Fullscreen-Wolkenschicht. Der Wolkenpass war im bestehenden Look kaum sichtbar, führte aber pro Pixel mehrere Noise-Berechnungen aus. Eine neue Wolkenlösung bleibt deshalb außerhalb des Kernpfads, bis ihr visueller Nutzen gegen eine GPU-Messung belegt ist.

## Nächste sinnvolle Eskalationsstufen

1. **Terrain zeilenweise resamplen:** Nur erforderlich, wenn einzelne Terrain-Updates auf XR- oder schwächerer Hardware wieder über das Framebudget steigen. Ein Chunk kann unsichtbar in kleinen Vertex-Budgets vorbereitet und erst danach eingeblendet werden.
2. **Geräteprofile statt dynamischer Heuristik:** Sichtweite, Pixel Ratio, Schattenauflösung und Grasradius als kleine Desktop-/XR-Profile bündeln. Das ist vorhersehbarer als ein ständig schwankender Auto-Quality-Regler.
3. **KTX2/Basis für Texturen:** Reduziert Download und GPU-Speicher der eingebetteten Bark-, Leaf- und Ground-Texturen. Vorher muss geprüft werden, ob die EZ-Tree-Paketversion externe komprimierte Texturen sauber zulässt. Der aktuelle JavaScript-Build ist wegen eingebetteter EZ-Tree-Texturen weiterhin ungewöhnlich groß.
4. **Regionale Baum-Batches:** Vier bis neun räumliche Batches würden Frustum-Culling verbessern, erhöhen aber Draw Calls. Erst einsetzen, wenn GPU-Messungen zeigen, dass unsichtbare Instanzen teurer sind als zusätzliche Batches.
5. **Far-Impostors:** Nur für Sichtweiten deutlich über dem aktuellen Fog-Bereich. Unter den aktuellen 1050 m sind vereinfachte Geometrien robuster und benötigen keine Atlas-Pipeline.
6. **Offizielle EZ-Tree-LOD-API übernehmen:** Die Upstream-Dokumentation beschreibt silhouette-stabile `createGeometry()`-/`generateLODs()`-Pfade. Die installierte npm-Version `1.1.0` stellt diese APIs noch nicht bereit; erst nach einer veröffentlichten Paketversion migrieren.
7. **GPU-Zeit messen:** Vor WebXR-Freigabe CPU-Framezeit um `EXT_disjoint_timer_query_webgl2` und reale Headset-Messungen ergänzen. Desktop-RAF allein zeigt keine GPU- oder thermischen Grenzen.

Ein selektiver Blur außerhalb des Blickfelds ist bewusst nicht vorgesehen: Der zusätzliche Fullscreen-Pass kostet GPU-Zeit, löst keine Geometriearbeit und ist für Stereo-WebXR doppelt teuer. Reduzierte Detaildichte, Fog und LOD erzeugen denselben Wahrnehmungseffekt günstiger.

## Verifizierter Stand vom 18. August 2026

Desktop Chromium, 1280×720, Profil `desktop`, deterministischer Flug mit 220 m/s nach Reset des
Frame-Recorders:

| Metric | Ergebnis |
|---|---:|
| Samples | 1.414 |
| p50 | 8,3 ms |
| p95 | 10,3 ms |
| p99 | 12,7 ms |
| Maximum | 18,7 ms |
| Frames über 16,7 ms | 1 von 1.414 (0,071 %) |
| Draw Calls am Routenende | 44 |
| Dreiecke am Routenende | 1,70 M |
| Sichtbare Bäume am Routenende | 495 |
| Gras / Blumen / Steine am Routenende | 45.659 / 576 / 576 |

Der statische Startbereich enthält nach Warm-up 513 Bäume, 41.691 Grashalme, 1.511 Blumen und
586 Steine bei 53 Draw Calls und 3,53 M Dreiecken. Gegenüber dem vorherigen dichten Checkpoint sind das
etwa 15 % mehr Bäume, 174 % mehr Gras, 472 % mehr Blumen und 186 % mehr Steine.

Das PICO-Profil rendert im Desktop-Browser denselben Startbereich mit 25 Terrain-Chunks, 182 Bäumen,
14.284 Grashalmen, 841 Blumen und 203 Steinen bei 44 Calls und 1,45 M Dreiecken. Diese Werte prüfen
Profilbudgets, sind aber kein Ersatz für eine XR-Session auf dem Headset.

### Ermittelte Dichteobergrenze

Die finale Konfiguration nutzt ein 18-m-Baumraster, den Waldwahrscheinlichkeitsfaktor 1,5 und Äste nur
im Nah-LOD. Drei automatisierte Wiederholungsläufe blieben innerhalb des Browserbudgets. Das dichtere
17-m-Raster erreichte dagegen p99 bis 13,7 ms und zwei Frames über 16,7 ms; die extreme Stressstufe mit
14-m-Raster erreichte entlang der Route 1.350 Bäume, kippte aber auf p99 17,3 ms, 1,41 % Frames über
16,7 ms und 18 aufeinanderfolgende Misses. Beide wurden deshalb verworfen. Die Ground-Cover-Erhöhung
allein blieb bei p99 10,4 ms und war nicht die Ursache der Streaming-Spikes.

### Physische PICO-4-Freigabe

1. Über HTTPS mit `?profile=pico90&benchmark=xr-flight` öffnen und VR starten.
2. In `window.__LANDSCAPE_BENCHMARK__.snapshot()` müssen `xr.frameRate === 90` und
   `xr.targetRequestSucceeded === true` stehen.
3. Nach 60 Sekunden Warm-up den Recorder zurücksetzen und zehn Minuten mit Kopfbewegungen laufen lassen.
4. Akzeptanz: p99 höchstens 12 ms, höchstens 0,1 % Frames über 16,7 ms, keine drei Misses in Folge,
   höchstens 55 Calls, höchstens 1,6 M Dreiecke und bis zum Ende bestätigte 90 Hz. Der Dreiecksdeckel
   ist ein Profilbudget; die 90-Hz- und Framezeit-Grenzen entscheiden auf dem Headset.
5. Parallel einen Perfetto-Trace für einen Waldkern und mehrere schnelle Chunk-Wechsel aufzeichnen.
6. Zehnmal VR betreten und verlassen; es dürfen keine Shader-, Naht-, Atlas- oder Lifecycle-Fehler auftreten.

Wenn 90 Hz nicht gehalten werden, wird ohne Auto-Scaler zuerst der XR-Framebuffer auf 0,65 reduziert,
dann Gras auf 100 m/14.000 Instanzen, anschließend Tree-Dichte auf 0,55 mit 400 m Far-LOD und zuletzt
Schatten auf 60 m/512 px. Jeder Schritt wird isoliert erneut gemessen.
