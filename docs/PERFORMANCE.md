# Performance-Strategie

Die Landschaft priorisiert stabile Framezeiten vor maximaler Objektdichte. Die Messwerte stammen aus einem automatisierten Desktop-Chromium-Flug und sind kein Ersatz für ein späteres WebXR-Profil auf dem Zielgerät.

## Aktueller Stand

- Terrain: 49 recycelte Chunks bei der Standardsichtweite
- Vegetationsdetail: 31 blickrichtungsgewichtete Chunks mit vollem 3×3-Sicherheitskern
- Rendering: globale Instancing-Batches, drei einmalig erzeugte EZ-Tree-Templates, gemeinsame Mittel-/Fern-LODs, zwei Gras-Batches und drei Stein-Batches
- Streaming: Baum-Rebuild, Ground-Cover-Rebuild und Terrain-Resample werden auf getrennte Frames verteilt
- Buffer: dynamische Instanzattribute laden nur den tatsächlich belegten Präfix über die Three.js-Update-Ranges hoch
- Sichtkanten: Distanz-Ausdünnung, harte LOD-Bänder und abgestimmter Fog statt doppelter Instanzen in Kreuzblenden
- Boden: sieben Poly-Haven-Zonen in einem Atlas; der Shader wählt pro Fragment nur die zwei stärksten Schichten

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

Desktop Chrome, 1280×720, Profil `desktop`, deterministischer Flug mit 220 m/s. Der finale
12-Sekunden-Kontrolllauf lieferte 120 FPS bei p50 8,3 ms, p95 9,6 ms und p99 10,3 ms. Es gab
keinen Frame über 16,7 ms. Am Routenende lagen 877 Bäume, 60 Wiesen-Cluster und 42 Grasbüschel bei
27 Draw Calls und 2,29 M Dreiecken.

Der statische Startbereich enthält nach Warm-up 655 Bäume, 60 Wiesen-Cluster, 35 größere Grasbüschel
und 682 Steine bei 35 Draw Calls und 2,68 M Dreiecken. Ein Cluster kombiniert drei leicht versetzte
Grass-Patch-Kopien. Die 180 sichtbaren Quell-Patches bilden dadurch kleine zusammenhängende Wiesen,
während große Flächen gemäß Habitatmaske bewusst grasfrei bleiben. Blumen sind vollständig entfernt.

Das PICO-Profil rendert im Desktop-Browser denselben Startbereich mit 214 Bäumen, 16 Wiesen-Clustern,
11 Grasbüscheln und 186 Steinen bei 26 Calls und 0,799 M Dreiecken. Diese Werte prüfen Profilbudgets,
sind aber kein Ersatz für eine XR-Session auf dem Headset.

### Renderstrategie

- Mittel- und Fernbäume teilen pro LOD eine Geometrie und werden nur im vorderen Sicht-Halbraum aufgebaut.
- Jeder Baum rendert einen Stamm. Mittel-/Fernstämme nutzen einen 4- bis 5-seitigen Distanzstamm statt
  des kompletten Astnetzes.
- Steingeometrien werden einmal beim Start auf 22 % der Vertices reduziert. Distribution, Varianten
  und lizenzierte Ausgangsassets bleiben unverändert.
- Gras nutzt zwei feste Instancing-Batches. Drei normalisierte Poly-Pizza-Patches werden einmalig zu
  einem Wiesen-Cluster zusammengefügt; günstige Büschel ergänzen deren Zwischenräume mit variierter Höhe.
- Eine grobe 11,5-m-Weltmatrix wird durch 90 % Jitter und drei überlagerte Habitat-Noise-Felder
  aufgebrochen. Nur geeignete flache, offene Bereiche erhalten Gras. 160 Kandidaten pro Frame begrenzen
  CPU-Spitzen, danach entstehen weder neue Objekte noch Per-Frame-Transformupdates.
- Beide Grasmodelle teilen denselben Vertex-Shader-Wind. Höhenbasierte Bend-Weights fixieren die Wurzeln;
  Phase und Stärke variieren pro Instanz ohne CPU-Animation.
- Vegetation wird nach einer Richtungsänderung von etwa 20 Grad neu aufgebaut. So bleibt die
  richtungsgewichtete Auswahl bei interaktivem Flug korrekt, ohne per-frame Objekt-Culling einzuführen.
- Die Bodenzonen werden nur beim Chunk-Resampling aus Höhe, Hang, Feuchte und Woodland berechnet.
  Der Geröllweg erhält im Fragment-Shader nur eine analytische Kantenmaske. Draw Calls und Anzahl der
  Material-Samples bleiben trotz sieben Zonen unverändert: zwei Albedo- und auf Desktop zwei Normalmaps,
  auf PICO eine Normalmap.
- Die 3x3-Atlanten belegen dekodiert etwa 72 MiB auf Desktop und 18 MiB auf PICO. Die ausgelieferten
  WebP-Dateien umfassen zusammen rund 6,7 MiB. KTX2 bleibt erst dann sinnvoll, wenn reale PICO-Messungen
  Texture-Speicher oder Ladezeit als Engpass bestätigen.

### Kontrolllauf mit sieben Bodenzonen

Der 12-Sekunden-Desktop-Flug hielt nach der Atlas- und Zonenumstellung 120 FPS: p50 8,3 ms,
p95 9,8 ms, p99 10,3 ms, maximal 10,5 ms und kein Frame über 16,7 ms. Am Routenende wurden
774 Bäume, 24 Wiesen-Cluster, 7 Grasbüschel und 1.013 Steine bei 29 Calls und 1,30 M Dreiecken
gerendert. Das belegt den Desktop-Pfad; die physische PICO-Freigabe bleibt separat.

### Physische PICO-4-Freigabe

1. Über HTTPS mit `?profile=pico90&benchmark=xr-flight` öffnen und VR starten.
2. In `window.__LANDSCAPE_BENCHMARK__.snapshot()` müssen `xr.frameRate === 90` und
   `xr.targetRequestSucceeded === true` stehen.
3. Nach 60 Sekunden Warm-up den Recorder zurücksetzen und zehn Minuten mit Kopfbewegungen laufen lassen.
4. Akzeptanz: p99 höchstens 12 ms, höchstens 0,1 % Frames über 16,7 ms, keine drei Misses in Folge,
   höchstens 40 Calls, höchstens 0,8 M Dreiecke und bis zum Ende bestätigte 90 Hz. Der Dreiecksdeckel
   ist ein Profilbudget; die 90-Hz- und Framezeit-Grenzen entscheiden auf dem Headset.
5. Parallel einen Perfetto-Trace für einen Waldkern und mehrere schnelle Chunk-Wechsel aufzeichnen.
6. Zehnmal VR betreten und verlassen; es dürfen keine Shader-, Naht-, Atlas- oder Lifecycle-Fehler auftreten.

Wenn 90 Hz nicht gehalten werden, wird ohne Auto-Scaler zuerst der XR-Framebuffer auf 0,65 reduziert,
dann der Grasradius auf 100 m und die Wiesen-Cluster auf 12 begrenzt, anschließend Tree-Dichte auf 0,55
mit 400 m Far-LOD und zuletzt Schatten auf 60 m/512 px. Jeder Schritt wird isoliert erneut gemessen.
