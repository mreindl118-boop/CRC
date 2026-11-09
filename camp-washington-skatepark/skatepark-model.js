import { buildSkatepark, makeBadge } from './skatepark-builder.js?v=nov26b';
const stage = document.querySelector('three-d-stage');
const { THREE } = await stage.ready;
{ const sr = stage.shadowRoot; if (sr) { const note = sr.querySelector('.note'); if (note) note.style.display = 'none'; sr.querySelectorAll('button').forEach(x => { x.style.whiteSpace = 'nowrap'; }); } }   // page hint bar already carries the orbit help; HUD sits in that corner
const { group, features, terrainY, X, Z, PLAN, parkRoot = group } = buildSkatepark(THREE);
stage.setObject(group); group.updateMatrixWorld(true);
// the park sits in the site turned by PLAN.parkTf: views and leaders are worked out from where it actually landed
const Y_UP = new THREE.Vector3(0, 1, 0), parkRot = parkRoot === group ? 0 : parkRoot.rotation.y;
const PC = parkRoot.localToWorld(new THREE.Vector3(X(496.9), 0, Z(640)));                       // park centre in the site
const AXON = new THREE.Vector3(-1.1537, 1.05, -0.9952).normalize().applyAxisAngle(Y_UP, parkRot);  // exploded-axon view direction, turned with the park
const HOME = new THREE.Vector3(-39.06, 30, -33.69).applyAxisAngle(Y_UP, parkRot);                 // default orbit offset, turned with the park
stage._key.shadow.normalBias = 0; stage._key.shadow.bias = -.0005; const sc = stage._key.shadow.camera; { const key = stage._key, dir = key.position.clone().sub(key.target.position).normalize(), c = new THREE.Vector3(-5, 0, -18);
  key.target.position.copy(c); key.target.updateMatrixWorld(); if (!key.target.parent) stage._scene.add(key.target);
  key.position.copy(c).addScaledVector(dir, 160); key.updateMatrixWorld();
  sc.left = sc.bottom = -135; sc.right = sc.top = 135; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
  key.shadow.mapSize.set(4096, 4096); key.shadow.map?.dispose(); key.shadow.map = null;
  group.traverse(o => { if (o.isMesh && /^(ground|dirt_infield|stock_ave|stock_ave_sidewalk|plaza|court_apron|basketball_court|pool_deck|pool_water|mosaic|pool_fence|pool_lane_rope|entry_walk|parking|ctx_flat)/.test(o.name)) o.castShadow = false; }); } sc.updateProjectionMatrix();
const cam = stage._camera, controls = stage._controls, baseFov = cam.fov;
const LAYER_Y = [0, 5, 10, 15, 19];
const ids = Object.keys(features).filter(k => features[k].userData.n).sort((a, b) => features[a].userData.n - features[b].userData.n);
const layerOfN = {}; ids.forEach(k => layerOfN[features[k].userData.n] = features[k].userData.layer);

// numbered callouts (match Sheet L-1) — screen-constant sprites, rescaled whenever the lens changes
const pinsGroup = new THREE.Group(); pinsGroup.name = 'callouts'; parkRoot.add(pinsGroup);
const pins = []; let badgePx = 30;
const badgeScale = () => { const H = stage.clientHeight || 700, f = 1 / Math.tan(cam.fov * Math.PI / 360); return 2 * badgePx / (f * H); };
{ const pinMat = new THREE.MeshBasicMaterial({ color: '#212D62' });
  PLAN.callouts.forEach(c => { const gy = terrainY(c.x, c.y), h = 3.4, sp = makeBadge(THREE, c.n); sp.material.sizeAttenuation = false; sp.material.needsUpdate = true; sp.position.set(X(c.x), gy + h, Z(c.y)); pinsGroup.add(sp);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, h - 1.2, 8), pinMat); pin.position.set(X(c.x), gy + (h - 1.2) / 2, Z(c.y)); pinsGroup.add(pin);
    pins.push({ sp, pin, y0: sp.position.y, py0: pin.position.y, layer: layerOfN[c.n] ?? 0 }); });
  const key = document.getElementById('key'); if (key) key.innerHTML = PLAN.callouts.map(c => `<div style="display:flex;align-items:flex-start;gap:7px"><span style="width:16px;height:16px;border-radius:50%;background:#212D62;color:#fff;font-size:9px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${c.n}</span><span>${c.label}</span></div>`).join(''); }

// leaders: dashed drop lines from each lifted feature to its footprint (exploded view only)
const centres = {}; ids.forEach(id => { const b = new THREE.Box3().setFromObject(features[id]), c = b.getCenter(new THREE.Vector3()); centres[id] = { x: c.x, z: c.z, base: Math.max(0, b.min.y) }; });
{ const c6 = PLAN.callouts.find(c => c.n === 6); if (centres.F6) { const w6 = parkRoot.localToWorld(new THREE.Vector3(X(c6.x), 0, Z(c6.y))); centres.F6.x = w6.x; centres.F6.z = w6.z; } }
const leaders = new THREE.Group(); leaders.visible = false; stage._scene.add(leaders);
const leaderMat = new THREE.LineDashedMaterial({ color: 0x212D62, dashSize: .5, gapSize: .3, transparent: true, opacity: .75 });
const leaderOf = {}; ids.forEach(id => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), leaderMat); leaders.add(l); leaderOf[id] = l; });

// exploded axon: layers lift by category, long lens from the axon direction
let explode = 0, target = 0;
function applyExplode(e) {
  Object.values(features).forEach(f => { f.position.y = LAYER_Y[f.userData.layer] * e; });
  pins.forEach(p => { const dy = LAYER_Y[p.layer] * e; p.sp.position.y = p.y0 + dy; p.pin.position.y = p.py0 + dy; });
  leaders.visible = e > .02;
  ids.forEach(id => { const c = centres[id], pos = leaderOf[id].geometry.attributes.position; pos.setXYZ(0, c.x, .16, c.z); pos.setXYZ(1, c.x, LAYER_Y[features[id].userData.layer] * e + c.base, c.z); pos.needsUpdate = true; leaderOf[id].computeLineDistances(); });
}
function setExploded(on) {
  target = on ? 1 : 0; controls.autoRotate = false; badgePx = on ? 22 : 30;
  const btn = document.getElementById('btn-axon'); if (btn) { btn.dataset.on = on; btn.textContent = on ? 'Assembled view' : 'Exploded axon'; }
  const panel = document.getElementById('blowouts-panel'); if (panel) { panel.style.display = on ? 'flex' : 'none'; if (on) makeBlowouts(); }
  if (on) { cam.fov = 9; controls.target.copy(PC).setY(9); cam.position.copy(controls.target).addScaledVector(AXON, 330); }
  else { cam.fov = baseFov; controls.target.copy(PC); cam.position.copy(PC).add(HOME); }
  cam.near = .5; cam.far = 1200; cam.updateProjectionMatrix(); controls.update();
}

// detail blow-outs: each feature rendered alone from the axon direction into a card
let blowoutsDone = false;
function makeBlowouts() {
  const panel = document.getElementById('blowouts'); if (blowoutsDone || !panel) return; blowoutsDone = true;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setPixelRatio(2); r.setSize(300, 200);
  const cam2 = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400), VIEW = AXON.clone();
  const saved = Object.values(features).map(f => [f, f.visible, f.position.y]); const pv = pinsGroup.visible, lv = leaders.visible; pinsGroup.visible = leaders.visible = false;
  ids.forEach(id => { Object.values(features).forEach(f => { f.visible = f === features[id]; f.position.y = 0; }); features[id].updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(features[id]), c = b.getCenter(new THREE.Vector3()), rad = b.getBoundingSphere(new THREE.Sphere()).radius * 1.05;
    cam2.left = -rad * 1.5; cam2.right = rad * 1.5; cam2.top = rad; cam2.bottom = -rad; cam2.far = rad * 20; cam2.updateProjectionMatrix(); cam2.position.copy(c).add(VIEW.clone().multiplyScalar(rad * 6)); cam2.lookAt(c);
    r.render(stage._scene, cam2); const f = features[id];
    panel.insertAdjacentHTML('beforeend', `<div style="border:1px solid #D5D9DF;background:#FFFFFF"><div style="aspect-ratio:3/2;background:#F3F5F7"><img alt="" src="${r.domElement.toDataURL('image/png')}" style="width:100%;height:100%;object-fit:contain;display:block"></div><div style="display:flex;align-items:flex-start;gap:6px;padding:6px 8px;border-top:1px solid #E1E4E8"><span style="width:16px;height:16px;border-radius:50%;background:#212D62;color:#fff;font:700 9px/16px Arial,Helvetica,sans-serif;text-align:center;flex-shrink:0">${f.userData.n}</span><span style="font:10px/1.3 Arial,Helvetica,sans-serif;color:#2B2F36">${f.userData.label}</span></div></div>`); });
  saved.forEach(([f, v, y]) => { f.visible = v; f.position.y = y; }); pinsGroup.visible = pv; leaders.visible = lv; r.dispose();
}

document.getElementById('btn-axon')?.addEventListener('click', () => setExploded(target === 0));
window.addEventListener('message', e => { if (e.data && e.data.type === 'skatepark-mode') setExploded(!!e.data.exploded); });
window.addEventListener('hashchange', () => setExploded(location.hash === '#exploded'));
const orig = stage._loop; stage._loop = () => {
  if (explode !== target) { explode += (target - explode) * .07; if (Math.abs(target - explode) < .002) explode = target; applyExplode(explode); }
  const s = badgeScale(); pins.forEach(p => p.sp.scale.set(s, s, 1)); orig(); updateHud(); updateRoadLabel(); };
// Stock Ave label: projected HTML so it stays upright and legible from any orbit angle, turned to follow the road on screen
const roadLabel = document.createElement('div'); roadLabel.textContent = 'STOCK AVE.';
roadLabel.style.cssText = 'z-index:2;position:absolute;left:0;top:0;pointer-events:none;font:700 12px/1 Arial,Helvetica,sans-serif;letter-spacing:2.6px;color:#3F4652;text-shadow:0 0 2px #fff,0 0 4px #fff,0 0 8px rgba(255,255,255,.9);white-space:nowrap;display:none';
stage.parentElement.appendChild(roadLabel);
const roadC = PLAN.site && PLAN.site.centre, roadSegs = roadC && roadC.slice(1).map((q, i) => new THREE.Line3(new THREE.Vector3(X(roadC[i][0]), .05, Z(roadC[i][1])), new THREE.Vector3(X(q[0]), .05, Z(q[1])))), _rp = new THREE.Vector3(), _rq = new THREE.Vector3(), _rd = new THREE.Vector3(), _rt = new THREE.Vector3();   // centre is a polyline — Stock Ave bends by the rec building
function updateRoadLabel() { if (!roadSegs) return; const W = stage.clientWidth || 800, H = stage.clientHeight || 600; let roadSeg = roadSegs[0], bd = Infinity; roadSegs.forEach(s => { s.closestPointToPoint(controls.target, true, _rt); const d = _rt.distanceToSquared(controls.target); if (d < bd) { bd = d; roadSeg = s; } });
  roadSeg.closestPointToPoint(controls.target, true, _rp); roadSeg.delta(_rd).normalize(); _rq.copy(_rp).addScaledVector(_rd, 10);
  const a = _rp.clone().project(cam), b = _rq.clone().project(cam);
  if (a.z > 1 || b.z > 1) { roadLabel.style.display = 'none'; return; }
  const ax = (a.x * .5 + .5) * W, ay = (-a.y * .5 + .5) * H, bx = (b.x * .5 + .5) * W, by = (-b.y * .5 + .5) * H;
  if (ax < 40 || ax > W - 40 || ay < 20 || ay > H - 20 || Math.hypot(bx - ax, by - ay) < 14) { roadLabel.style.display = 'none'; return; }
  let ang = Math.atan2(by - ay, bx - ax) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  roadLabel.style.display = 'block'; roadLabel.style.transform = 'translate(' + ax.toFixed(1) + 'px,' + ay.toFixed(1) + 'px) translate(-50%,-50%) rotate(' + ang.toFixed(1) + 'deg)'; }
// corner north arrow + scale bar: true north = +Z (plan +y in the site frame, from the map fit); bar length picked from 5/10/25/50/100 ft to stay ~70–140 px at the orbit target
const hudNeedle = document.getElementById('hud-needle'), hudBar = document.getElementById('hud-bar'), hudLen = document.getElementById('hud-len'), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _r = new THREE.Vector3();
function updateHud() { if (!hudNeedle) return; const W = stage.clientWidth || 800, H = stage.clientHeight || 600, t = controls.target;
  const scr = v => [(v.x * .5 + .5) * W, (-v.y * .5 + .5) * H];
  const p0 = scr(_a.copy(t).project(cam)), pn = scr(_b.copy(t).add(new THREE.Vector3(0, 0, 5)).project(cam));
  hudNeedle.setAttribute('transform', `rotate(${(Math.atan2(pn[0] - p0[0], -(pn[1] - p0[1])) * 180 / Math.PI).toFixed(1)})`);
  _r.setFromMatrixColumn(cam.matrixWorld, 0).setY(0).normalize(); const p1 = scr(_b.copy(t).addScaledVector(_r, 0.3048).project(cam)), pxPerFt = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (!(pxPerFt > 0)) return; const ft = [5, 10, 25, 50, 100, 200].find(v => v * pxPerFt >= 70) || 200;
  hudBar.style.width = Math.min(160, ft * pxPerFt).toFixed(0) + 'px'; hudLen.textContent = ft + ' FT'; }
stage._renderer.setAnimationLoop(stage._loop);   // wrap the stage's own loop so it survives the stage re-arming it

controls.target.copy(PC); cam.position.copy(PC).add(HOME); cam.near = .5; cam.far = 1200; cam.updateProjectionMatrix(); controls.update();
if (location.hash === '#exploded') setExploded(true);
if (window.parent !== window) window.parent.postMessage({ type: 'skatepark-ready' }, '*');
