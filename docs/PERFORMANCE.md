# Performance-Strategie

Die Landschaft priorisiert stabile Framezeiten vor maximaler Objektdichte. Die Messwerte stammen aus einem automatisierten Desktop-Chromium-Flug und sind kein Ersatz für ein späteres WebXR-Profil auf dem Zielgerät.

## Aktueller Stand

- Terrain: 49 recycelte Chunks bei der Standardsichtweite
- Vegetationsdetail: 31 blickrichtungsgewichtete Chunks mit vollem 3×3-Sicherheitskern
- Rendering: globale Instancing-Batches, drei Baum-LODs, ein Gras-Batch und sechs Ground-Cover-Batches
- Streaming: Baum-Rebuild, Ground-Cover-Rebuild und Terrain-Resample werden auf getrennte Frames verteilt
- Sichtkanten: GPU-Distanzfade für Bäume, Gras und Blumen; Alpha-Hash-Kreuzblende für Baum-LODs

Ein 1,6-km-Testflug erreichte 117 FPS Minimum und 12,9 ms als höchsten beobachteten Frame-Peak. Vor dem gestaffelten Streaming lag derselbe Chunk-Grenzfall bei 18,7 ms.

## Nächste sinnvolle Eskalationsstufen

1. **Terrain zeilenweise resamplen:** Nur erforderlich, wenn einzelne Terrain-Updates auf XR- oder schwächerer Hardware wieder über das Framebudget steigen. Ein Chunk kann unsichtbar in kleinen Vertex-Budgets vorbereitet und erst danach eingeblendet werden.
2. **Geräteprofile statt dynamischer Heuristik:** Sichtweite, Pixel Ratio, Schattenauflösung und Grasradius als kleine Desktop-/XR-Profile bündeln. Das ist vorhersehbarer als ein ständig schwankender Auto-Quality-Regler.
3. **KTX2/Basis für Texturen:** Reduziert Download und GPU-Speicher der eingebetteten Bark-, Leaf- und Ground-Texturen. Vorher muss geprüft werden, ob die EZ-Tree-Paketversion externe komprimierte Texturen sauber zulässt.
4. **Regionale Baum-Batches:** Vier bis neun räumliche Batches würden Frustum-Culling verbessern, erhöhen aber Draw Calls. Erst einsetzen, wenn GPU-Messungen zeigen, dass unsichtbare Instanzen teurer sind als zusätzliche Batches.
5. **Far-Impostors:** Nur für Sichtweiten deutlich über dem aktuellen Fog-Bereich. Unter den aktuellen 1050 m sind vereinfachte Geometrien robuster und benötigen keine Atlas-Pipeline.
6. **Offizielle EZ-Tree-LOD-API übernehmen:** Die Upstream-Dokumentation beschreibt silhouette-stabile `createGeometry()`-/`generateLODs()`-Pfade. Die installierte npm-Version `1.1.0` stellt diese APIs noch nicht bereit; erst nach einer veröffentlichten Paketversion migrieren.
7. **GPU-Zeit messen:** Vor WebXR-Freigabe CPU-Framezeit um `EXT_disjoint_timer_query_webgl2` und reale Headset-Messungen ergänzen. Desktop-RAF allein zeigt keine GPU- oder thermischen Grenzen.

Ein selektiver Blur außerhalb des Blickfelds ist bewusst nicht vorgesehen: Der zusätzliche Fullscreen-Pass kostet GPU-Zeit, löst keine Geometriearbeit und ist für Stereo-WebXR doppelt teuer. Reduzierte Detaildichte, Fog und LOD erzeugen denselben Wahrnehmungseffekt günstiger.
