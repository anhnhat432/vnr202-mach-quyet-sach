"use client";

import { useEffect, useRef, useState } from "react";
import { AmbientLight, CanvasTexture, Color, DirectionalLight, Mesh, MeshBasicMaterial, MeshPhongMaterial, PerspectiveCamera, Scene, SphereGeometry, SRGBColorSpace, Vector3, WebGLRenderer } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { HistoricalLocation } from "./museum-data";
import { globePoint, validCoordinates } from "./museum-domain";

type Props = { locations: HistoricalLocation[]; targetId: string | null; onPick: (id: string) => void; onFailure: () => void };
type Controller = { focus: (id: string) => void; zoom: (factor: number) => void; reset: () => void; rotate: (dx: number, dy: number) => void; auto: (enabled: boolean) => void };
type Land = { features: { geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };

export default function HistoryGlobe({ locations, targetId, onPick, onFailure }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const actions = useRef<Controller | null>(null);
  const latest = useRef({ locations, onPick, onFailure });
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const [status, setStatus] = useState("Đang dựng địa cầu…");
  const [rotating, setRotating] = useState(false);
  useEffect(() => { latest.current = { locations, onPick, onFailure }; });

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: WebGLRenderer;
    try { renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { latest.current.onFailure(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 760 ? 1.25 : 1.75));
    renderer.setClearColor(0x101b22, 0);
    renderer.domElement.setAttribute("aria-hidden", "true");
    container.prepend(renderer.domElement);
    const scene = new Scene();
    const camera = new PerspectiveCamera(38, 1, .1, 30);
    const initial = new Vector3(...globePoint(23, 104)).multiplyScalar(3.5);
    camera.position.copy(initial);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false; controls.minDistance = 1.65; controls.maxDistance = 5;
    controls.enableDamping = false; controls.rotateSpeed = .55;
    // Scroll remains page navigation; zoom is an explicit accessible control.
    controls.enableZoom = false;
    const geometry = new SphereGeometry(1, 64, 40);
    const material = new MeshPhongMaterial({ color: 0x315665, shininess: 12, specular: new Color(0x516d6c) });
    scene.add(new Mesh(geometry, material));
    scene.add(new AmbientLight(0xffffff, 2.3));
    const light = new DirectionalLight(0xffe5be, 2.2); light.position.set(2, 3, 4); scene.add(light);
    const haloGeometry = new SphereGeometry(1.018, 32, 24);
    const haloMaterial = new MeshBasicMaterial({ color: 0x75b7bb, transparent: true, opacity: .065, wireframe: true });
    scene.add(new Mesh(haloGeometry, haloMaterial));
    let texture: CanvasTexture | undefined;
    let disposed = false, visible = true, frame = 0, spinning = false, lastTime = 0;
    let flight: { start: Vector3; end: Vector3; time: number } | null = null;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const project = new Vector3();
    function draw(time: number) {
      frame = 0;
      if (disposed || !visible || document.hidden) return;
      if (spinning && !reduceMotion.matches && !flight) {
        camera.position.applyAxisAngle(new Vector3(0, 1, 0), Math.min(40, time - lastTime) * .000035); controls.update();
      }
      lastTime = time;
      if (flight) {
        const t = reduceMotion.matches ? 1 : Math.min(1, (time - flight.time) / 950);
        const eased = t * t * (3 - 2 * t);
        // Spherical interpolation around Earth avoids flying through its surface.
        const a = flight.start.clone().normalize(), b = flight.end.clone().normalize();
        const angle = a.angleTo(b);
        if (angle > .00001 && angle < Math.PI - .001) project.copy(a).multiplyScalar(Math.sin((1 - eased) * angle)).addScaledVector(b, Math.sin(eased * angle)).divideScalar(Math.sin(angle));
        else project.copy(a).lerp(b, eased).normalize();
        camera.position.copy(project).multiplyScalar(flight.start.length() + (flight.end.length() - flight.start.length()) * eased);
        controls.update();
        if (t === 1) flight = null;
      }
      camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
      for (const location of latest.current.locations) {
        const button = buttons.current.get(location.id);
        if (!button || !validCoordinates(location.latitude, location.longitude)) continue;
        const point = new Vector3(...globePoint(location.latitude, location.longitude)).multiplyScalar(1.015);
        const front = point.dot(camera.position.clone().sub(point)) > 0;
        project.copy(point).project(camera);
        button.style.visibility = front && Math.abs(project.x) <= 1 && Math.abs(project.y) <= 1 ? "visible" : "hidden";
        button.style.left = `${(project.x + 1) * .5 * container!.clientWidth}px`;
        button.style.top = `${(1 - project.y) * .5 * container!.clientHeight}px`;
      }
      renderer.render(scene, camera);
      if (flight || (spinning && !reduceMotion.matches)) schedule();
    }
    function schedule() { if (!frame && !disposed && visible) frame = requestAnimationFrame(draw); }
    function focus(id: string) {
      const location = latest.current.locations.find(l => l.id === id);
      if (!location || !validCoordinates(location.latitude, location.longitude)) return;
      spinning = false; setRotating(false);
      flight = { start: camera.position.clone(), end: new Vector3(...globePoint(location.latitude, location.longitude)).multiplyScalar(2.8), time: performance.now() };
      schedule();
    }
    actions.current = {
      focus,
      auto(enabled) { spinning = enabled; schedule(); },
      zoom(factor) { flight = null; camera.position.setLength(Math.max(1.65, Math.min(5, camera.position.length() * factor))); controls.update(); schedule(); },
      reset() { flight = null; camera.position.copy(initial); controls.update(); schedule(); },
      rotate(dx, dy) { flight = null; const v = camera.position; const length = v.length(); const lat = Math.asin(v.y / length) + dy; const lon = Math.atan2(v.z, v.x) + dx; v.set(Math.cos(lat) * Math.cos(lon), Math.sin(Math.max(-1.4, Math.min(1.4, lat))), Math.cos(lat) * Math.sin(lon)).setLength(length); controls.update(); schedule(); },
    };
    const cancelFlight = () => { flight = null; spinning = false; setRotating(false); };
    controls.addEventListener("start", cancelFlight);
    controls.addEventListener("change", schedule);
    const resize = new ResizeObserver(() => {
      camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight); schedule();
    });
    resize.observe(container);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) schedule(); else { cancelAnimationFrame(frame); frame = 0; } });
    intersection.observe(container);
    const visibility = () => { if (!document.hidden) schedule(); };
    document.addEventListener("visibilitychange", visibility);
    reduceMotion.addEventListener("change", schedule);
    const lost = (event: Event) => { event.preventDefault(); latest.current.onFailure(); };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    const abort = new AbortController();
    fetch("/history/land-110m.json", { signal: abort.signal }).then(response => {
      if (!response.ok) throw new Error("land unavailable");
      return response.json() as Promise<Land>;
    }).then(land => {
      if (disposed) return;
      const canvas = document.createElement("canvas"); canvas.width = 1024; canvas.height = 512;
      const context = canvas.getContext("2d"); if (!context) throw new Error("texture unavailable");
      context.fillStyle = "#163846"; context.fillRect(0, 0, 1024, 512);
      context.strokeStyle = "#315762"; context.lineWidth = .6;
      for (let x = 0; x <= 1024; x += 1024 / 24) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, 512); context.stroke(); }
      for (let y = 0; y <= 512; y += 512 / 12) { context.beginPath(); context.moveTo(0, y); context.lineTo(1024, y); context.stroke(); }
      context.fillStyle = "#bda875"; context.strokeStyle = "#d9c69b";
      for (const feature of land.features) {
        const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as number[][][]] : feature.geometry.coordinates as number[][][][];
        for (const polygon of polygons) {
          context.beginPath();
          for (const ring of polygon) ring.forEach(([lon, lat], index) => {
            const x = (lon + 180) / 360 * 1024, y = (90 - lat) / 180 * 512;
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
          });
          context.closePath(); context.fill("evenodd"); context.stroke();
        }
      }
      texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
      material.map = texture; material.color.set(0xffffff); material.needsUpdate = true;
      setStatus("Địa cầu sẵn sàng"); schedule();
    }).catch(error => { if (!disposed && error.name !== "AbortError") latest.current.onFailure(); });
    schedule();
    return () => {
      disposed = true; abort.abort(); cancelAnimationFrame(frame); actions.current = null;
      resize.disconnect(); intersection.disconnect(); document.removeEventListener("visibilitychange", visibility);
      reduceMotion.removeEventListener("change", schedule);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      controls.removeEventListener("start", cancelFlight); controls.removeEventListener("change", schedule); controls.dispose();
      geometry.dispose(); material.dispose(); haloGeometry.dispose(); haloMaterial.dispose(); texture?.dispose(); renderer.dispose(); renderer.domElement.remove();
    };
  }, []);
  useEffect(() => { if (targetId) actions.current?.focus(targetId); }, [targetId]);
  // Re-project new/filter-changed markers without recreating the renderer.
  useEffect(() => { const resize = new Event("resize"); window.dispatchEvent(resize); if (targetId) actions.current?.focus(targetId); else actions.current?.rotate(0, 0); }, [locations, targetId]);
  return <div className="museum-globe-shell">
    <div ref={host} className="museum-globe" role="group" aria-label="Địa cầu 3D tương tác" tabIndex={0} onKeyDown={event => {
      const moves: Record<string, [number, number]> = { ArrowLeft: [-.12, 0], ArrowRight: [.12, 0], ArrowUp: [0, .1], ArrowDown: [0, -.1] };
      if (moves[event.key]) { event.preventDefault(); actions.current?.rotate(...moves[event.key]); }
      if (["+", "=", "-"].includes(event.key)) { event.preventDefault(); actions.current?.zoom(event.key === "-" ? 1.15 : .85); }
    }}>
      {locations.filter(l => validCoordinates(l.latitude, l.longitude)).map(location => <button key={location.id} ref={el => { if (el) buttons.current.set(location.id, el); else buttons.current.delete(location.id); }} type="button" className="museum-marker" data-selected={targetId === location.id} aria-label={`Chọn địa điểm ${location.name}`} title={location.name} onClick={() => latest.current.onPick(location.id)}><span /><b>{location.name.split(" · ")[0]}</b></button>)}
    </div>
    <div className="museum-globe-tools"><button type="button" onClick={() => actions.current?.zoom(.8)} aria-label="Phóng to địa cầu">+</button><button type="button" onClick={() => actions.current?.zoom(1.2)} aria-label="Thu nhỏ địa cầu">−</button><button type="button" onClick={() => actions.current?.reset()}>Góc nhìn ban đầu</button><button type="button" aria-pressed={rotating} onClick={() => { actions.current?.auto(!rotating); setRotating(!rotating); }}>{rotating ? "Dừng tự xoay" : "Bật tự xoay"}</button></div>
    <p className="museum-globe-status" role="status">{status} · Kéo để xoay · Phím mũi tên / + −</p>
  </div>;
}
