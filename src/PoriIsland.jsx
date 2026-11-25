import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import {
  COLORS, POSES, WEATHER, waveHeight,
  buildBoat, buildFish, buildPori, buildWeather, buildWhale, buildZzz,
} from './Pori3D'

// Pori's island: a small diorama floating in the market sea, seen from above at an angle.
// The same signals as the side-view scene, but every feature has a place on the island,
// and Pori walks to the place where today's story is.

const damp = (current, target, lambda, dt) => THREE.MathUtils.damp(current, target, lambda, dt)
const dampAngle = (current, target, lambda, dt) => {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + diff * (1 - Math.exp(-lambda * dt))
}

const GROUND_Y = 0.42 // top of the grass
const PORI_SCALE = 0.42
const WALK_SPEED = 1.1
const SEA_LOW = -0.1 // quiet day: the beach is dry
const SEA_HIGH = 0.3 // busy day: the tide covers the beach
// height of the big swell (volatility still scales it through waveHeight); halved from 1.7 for a calmer toy sea
const SWELL = 0.85

// Where Pori stands for each story. face = which way Pori looks once there (0 = toward the front).
const SPOTS = {
  shore: { x: 0.35, z: 2.1, face: 0.15, name: '물가' },
  dock: { x: 2.7, z: 0.95, face: Math.PI / 2, name: '선착장' },
  lighthouse: { x: -0.95, z: 0.45, face: -0.35, name: '등대' },
  home: { x: 1.3, z: -0.45, face: 0.1, name: '포리 집' },
  chest: { x: 1.75, z: -0.85, face: 0.5, name: '보물상자' },
  fishing: { x: 4.4, z: 0.95, face: Math.PI / 2, name: '선착장 끝' },
}

const PALETTE = {
  grass: '#b4e39a',
  hill: '#9fd68a',
  rock: '#9c929b',
  sand: '#f4e0b5',
  path: '#fbf0d9',
  wood: '#cf9f6e',
  post: '#9b7350',
  stripe: '#ff9b85',
  roof: '#7fd6c0',
  leaf: '#7fcf8e',
  trunk: '#a9805a',
  daySky: '#cfe8ee',
  nightSky: '#27325e',
  deepSea: '#4eaebb',
  shallowSea: '#93d8cc',
  foam: '#ffffff',
  // the sea's own colours come from vertex colours; this tint darkens them at night
  dayTint: '#ffffff',
  nightTint: '#6f82b8',
}

// Trees, rocks and bushes from Kenney's Nature Kit (CC0, see public/models/island/CREDITS.txt).
// The simple shapes below stand in until a model loads, and stay if loading fails.
const MODEL_DIR = `${import.meta.env.BASE_URL}models/island/`
// the kit's materials, by name, repainted in the island's pastel palette
const MODEL_COLORS = {
  leafsGreen: '#86d394',
  grass: '#a6dc8f',
  woodBark: '#c08c64',
  dirt: '#b7abb2',
  _defaultMat: '#b7abb2',
}
// Kenney Pirate Kit ship for the investor boats. Only its sail is repainted, so the sail colour
// still tells foreign (coral) from institutional (blue) money. Its own flags are hidden; the
// app's pennant (wind) and crates (buying) are moved onto the ship.
const SHIP = {
  model: 'ship-small',
  scale: 0.105,
  sink: -0.1, // the model's keel sits at y 0; lower it to the waterline
  pennant: [-0.07, 1.08, 0],
  crates: [[0.1, 0.32, 0.06], [0.1, 0.32, -0.09], [0.1, 0.44, -0.01]],
  crew: [-0.3, 0.27, 0], // where the crew stands on the ship's deck (stern side)
  crewScale: 1.6, // the crew is drawn about 0.36 tall; this makes them readable from the island view
}

const PROPS = [
  { model: 'tree-palmbend', x: -2.55, z: 0.35, scale: 1.3, yaw: 0.6, fallback: () => buildTree(1) },
  { model: 'tree-oak', x: -0.2, z: -2.1, scale: 1.5, yaw: 0.2, fallback: () => buildTree(1.15) },
  { model: 'tree-fat', x: 2.45, z: -1.95, scale: 1.25, yaw: 1.1, fallback: () => buildTree(0.9) },
  { model: 'tree-fat', x: -2.6, z: -0.6, scale: 1.05, yaw: 2.3, fallback: () => buildTree(0.8) },
  { model: 'tree-oak', x: 0.55, z: -2.55, scale: 1.2, yaw: 3.1, fallback: () => buildTree(0.85) },
  { model: 'tree-fat', x: -2.15, y: 1.05, z: -1.9, scale: 0.95, yaw: 0.4 },
  { model: 'tree-palmbend', x: 2.95, z: 1.75, scale: 1.05, yaw: 2.4 },
  { model: 'rock-largea', x: -3.3, y: 0.12, z: 1.8, scale: 0.95, yaw: 0.5, fallback: () => buildRock(0.28) },
  { model: 'rock-largeb', x: 3.5, y: 0.12, z: -1.3, scale: 1.05, yaw: 2.0, fallback: () => buildRock(0.34) },
  { model: 'rock-largea', x: -1.2, y: 0.12, z: 3.55, scale: 0.7, yaw: 1.2, fallback: () => buildRock(0.22) },
  { model: 'rock-largeb', x: 2.2, y: 0.12, z: 3.1, scale: 0.65, yaw: 2.6, fallback: () => buildRock(0.2) },
  { model: 'rock-largea', x: -3.75, y: 0.12, z: -0.6, scale: 0.9, yaw: 4.0, fallback: () => buildRock(0.3) },
  { model: 'plant-bush', x: 0.2, z: -1.4, scale: 1.3, yaw: 0.3 },
  { model: 'plant-bush', x: 2.2, z: -0.1, scale: 1.1, yaw: 1.9 },
  { model: 'plant-bush', x: -0.65, z: 1.75, scale: 1.2, yaw: 3.3 },
  { model: 'plant-bush', x: 1.95, z: -2.05, scale: 1.0, yaw: 5.0 },
]

const HOTSPOTS = [
  { key: 'pori', label: '포리 쓰다듬기 (끌어서 옮기기)', size: 72 },
  { key: 'lighthouse', label: '등대: 외해(간밤 미국 증시)와 바람 보기', size: 84 },
  { key: 'home', label: '포리 집 보기', size: 84 },
  { key: 'chest', label: '보물상자: 모은 조개 보기', size: 70 },
  { key: 'bottles', label: '수평선 병편지: 다가오는 일정 보기', size: 64 },
  { key: 'fishing', label: '낚시하기: 오늘의 화제 종목 낚아 올리기', size: 46, action: '🎣' },
  { key: 'weather', label: '날씨: 간밤 미국 증시 보기', size: 88 },
  { key: 'foreign', label: '외국인 배 보기', size: 70 },
  { key: 'institution', label: '기관 배 보기', size: 70 },
  { key: 'samsung', label: '파란 고래: 삼성전자 보기', size: 66 },
  { key: 'hynix', label: '주황 고래: SK하이닉스 보기', size: 66 },
  { key: 'fish0', label: '물고기 1: 오늘의 화제 종목 보기', size: 54 },
  { key: 'fish1', label: '물고기 2: 오늘의 화제 종목 보기', size: 54 },
  { key: 'fish2', label: '물고기 3: 오늘의 화제 종목 보기', size: 54 },
]

const standard = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })
const shadowed = (mesh, cast = true) => {
  mesh.castShadow = cast
  mesh.receiveShadow = true
  return mesh
}

// A soft, irregular outline (x, z points) for one terrace of the island.
function outline(radius, wobble, seed, cx = 0, cz = 0, count = 14) {
  const points = []
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2
    const r = radius * (1 + wobble * (Math.sin(angle * 3 + seed) * 0.55 + Math.sin(angle * 5 + seed * 2.3) * 0.3))
    points.push(new THREE.Vector3(cx + Math.cos(angle) * r, 0, cz + Math.sin(angle) * r))
  }
  return new THREE.CatmullRomCurve3(points, true).getPoints(120).map((p) => new THREE.Vector2(p.x, p.z))
}

// shape coordinates are (x, -z) so that after rotating the extrusion upright, z lands where we want it
const toShape = (points, scale = 1) => new THREE.Shape(points.map((p) => new THREE.Vector2(p.x * scale, -p.y * scale)))

// is (x, z) inside a closed outline of Vector2(x, z) points
function insidePolygon(points, x, z) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i]
    const b = points[j]
    if ((a.y > z) !== (b.y > z) && x < ((b.x - a.x) * (z - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

// One rounded terrace: flat top (top material) with rocky sides (side material).
function terrace(points, top, height, topMaterial, sideMaterial) {
  const bevel = 0.12
  const geometry = new THREE.ExtrudeGeometry(toShape(points), {
    depth: height, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 1,
  })
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, top - height - bevel, 0)
  return shadowed(new THREE.Mesh(geometry, [topMaterial, sideMaterial]), false)
}

// Shore foam: short, uneven patches that wash up and fade away along the waterline,
// instead of one white line around the whole island. Alpha lives in the vertex colours.
function buildFoam(points) {
  const count = points.length
  const positions = new Float32Array(count * 2 * 3)
  const colors = new Float32Array(count * 2 * 4)
  const angles = points.map((p) => Math.atan2(p.y, p.x))
  const foam = new THREE.Color(PALETTE.foam)
  for (let i = 0; i < count * 2; i += 1) colors.set([foam.r, foam.g, foam.b, 0], i * 4)
  const indices = []
  for (let i = 0; i < count; i += 1) {
    const a = i * 2
    const b = ((i + 1) % count) * 2
    indices.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  geometry.setIndex(indices)
  const material = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.renderOrder = 1
  mesh.frustumCulled = false // vertices move every frame, so the initial bounds are meaningless
  // t: time; strength: 0..1 (how much foam overall); rough: volatility
  const update = (t, strength, rough) => {
    for (let i = 0; i < count; i += 1) {
      const angle = angles[i]
      // a few patches drift slowly around the shore; each one swells in and out on its own beat
      const patch = Math.sin(angle * 3 + t * 0.22 + Math.sin(angle * 5 - t * 0.13) * 1.4)
      const visible = THREE.MathUtils.smoothstep(patch, 0.05 + (1 - rough) * 0.25, 0.8)
      const wash = 0.5 + 0.5 * Math.sin(t * 0.9 + angle * 7)
      const alpha = visible * (0.7 + wash * 0.3) * strength
      // start just outside the terrace's rounded rim and reach a little further out as the wave washes in
      const p = points[i]
      const length = Math.hypot(p.x, p.y) || 1
      const inner = 0.13 // the terrace wall stands 0.12 outside its outline
      const outer = inner + 0.09 + wash * (0.16 + rough * 0.12) * visible
      positions.set([
        p.x + (p.x / length) * inner, 0, p.y + (p.y / length) * inner,
        p.x + (p.x / length) * outer, 0, p.y + (p.y / length) * outer,
      ], i * 6)
      colors[i * 8 + 3] = alpha
      colors[i * 8 + 7] = alpha * 0.45
    }
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  }
  return { mesh, material, update }
}

// A flat ribbon that follows a curve just above the grass.
function pathRibbon(points, width, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, GROUND_Y + 0.006, z)))
  const samples = curve.getPoints(60)
  const positions = []
  const indices = []
  samples.forEach((point, index) => {
    const tangent = curve.getTangent(index / (samples.length - 1))
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(width / 2)
    positions.push(point.x + side.x, point.y, point.z + side.z, point.x - side.x, point.y, point.z - side.z)
    if (index > 0) {
      const a = (index - 1) * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  })
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  return mesh
}

function buildTree(scale = 1) {
  const tree = new THREE.Group()
  const trunk = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.45, 10), standard(PALETTE.trunk)))
  trunk.position.y = 0.22
  tree.add(trunk)
  const leaf = standard(PALETTE.leaf)
  for (const [x, y, z, r] of [[0, 0.62, 0, 0.3], [0.13, 0.5, 0.08, 0.22], [-0.12, 0.52, -0.05, 0.22], [0, 0.86, 0, 0.2]]) {
    const puff = shadowed(new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), leaf))
    puff.position.set(x, y, z)
    tree.add(puff)
  }
  tree.scale.setScalar(scale)
  return tree
}

function buildRock(size) {
  const geometry = new THREE.IcosahedronGeometry(size, 0)
  geometry.scale(1, 0.62, 0.9)
  return shadowed(new THREE.Mesh(geometry, standard('#a59ba5', { flatShading: true })))
}

function buildLighthouse() {
  const group = new THREE.Group()
  const white = standard(COLORS.white)
  const stripe = standard(PALETTE.stripe)
  const dark = standard('#5f5763')
  const stripes = 5
  const height = 1.5
  for (let i = 0; i < stripes; i += 1) {
    const r0 = THREE.MathUtils.lerp(0.4, 0.29, i / stripes)
    const r1 = THREE.MathUtils.lerp(0.4, 0.29, (i + 1) / stripes)
    const band = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, height / stripes, 28), i % 2 ? stripe : white))
    band.position.y = (i + 0.5) * (height / stripes)
    group.add(band)
  }
  const gallery = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.07, 28), dark))
  gallery.position.y = height + 0.035
  const glass = new THREE.MeshStandardMaterial({ color: '#fff4c9', roughness: 0.3, emissive: '#ffd66b', emissiveIntensity: 0.25 })
  const lamp = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.32, 24), glass))
  lamp.position.y = height + 0.23
  const cap = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.32, 28), stripe))
  cap.position.y = height + 0.55
  const knob = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), dark))
  knob.position.y = height + 0.74
  const door = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.32, 0.06), standard('#8a6146')))
  door.position.set(0, 0.16, 0.39)
  group.add(gallery, lamp, cap, knob, door)

  // flag on the cap: streams with the wind (exchange rate)
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), dark))
  pole.position.y = height + 0.95
  const pennant = new THREE.Group()
  pennant.position.y = height + 1.08
  const cloth = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.26, 3), standard(PALETTE.stripe, { side: THREE.DoubleSide })))
  cloth.rotation.z = -Math.PI / 2
  cloth.scale.z = 0.14
  cloth.position.x = 0.14
  pennant.add(cloth)
  group.add(pole, pennant)

  // warm glow around the lamp at night
  const haloMaterial = new THREE.MeshBasicMaterial({ color: '#ffe59a', transparent: true, opacity: 0, depthWrite: false })
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), haloMaterial)
  halo.position.y = height + 0.23
  group.add(halo)
  return { group, glass, pennant, haloMaterial }
}

function buildHouse() {
  const group = new THREE.Group()
  const body = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.68, 0.78), standard(COLORS.cream)))
  body.position.y = 0.34
  const roof = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.78, 0.52, 4), standard(PALETTE.roof)))
  roof.rotation.y = Math.PI / 4
  roof.scale.set(1, 1, 0.86)
  roof.position.y = 0.94
  const chimney = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.3, 0.13), standard('#d9a48a')))
  chimney.position.set(0.26, 1.05, -0.12)
  const door = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.04), standard('#8a6146')))
  door.position.set(-0.16, 0.19, 0.4)
  const windowMaterial = new THREE.MeshStandardMaterial({ color: '#cfe9f5', roughness: 0.4, emissive: '#ffcf6b', emissiveIntensity: 0 })
  const pane = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.04), windowMaterial))
  pane.position.set(0.2, 0.42, 0.4)
  group.add(body, roof, chimney, door, pane)
  return { group, windowMaterial }
}

// --- Crew: a neighbour on each boat, in the same soft clay as Pori ---
// Built facing +z, about 0.36 tall. `arm` is the waving arm, `hold` the other one.
function blob(material, sx, sy, sz, x, y, z) {
  const mesh = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material))
  mesh.scale.set(sx, sy, sz)
  mesh.position.set(x, y, z)
  return mesh
}
function flipper(material, side, shoulderY, length) {
  const pivot = new THREE.Group()
  pivot.position.set(side * 0.085, shoulderY, 0.01)
  const limb = blob(material, 0.026, length, 0.03, 0, -length * 0.8, 0)
  pivot.add(limb)
  pivot.rotation.z = side * 0.35
  return pivot
}

// Foreign money: an old sea lion captain who has crossed the ocean. Bushy beard, captain's hat, spyglass.
function buildSeaLion() {
  const root = new THREE.Group()
  const fur = standard('#9a7560')
  const light = standard('#d4b59c')
  const beard = standard('#f1ebe3')
  const dark = standard(COLORS.dark)
  const navy = standard('#33457a')
  const gold = standard('#f2c45a')
  root.add(
    blob(fur, 0.1, 0.13, 0.09, 0, 0.13, 0),
    blob(light, 0.065, 0.09, 0.04, 0, 0.12, 0.055),
    blob(fur, 0.075, 0.072, 0.072, 0, 0.29, 0.005),
    blob(light, 0.045, 0.033, 0.035, 0, 0.275, 0.06),
    blob(dark, 0.014, 0.011, 0.01, 0, 0.29, 0.095),
    blob(dark, 0.011, 0.011, 0.008, -0.03, 0.315, 0.06),
    blob(dark, 0.011, 0.011, 0.008, 0.03, 0.315, 0.06),
  )
  // the beard: a bushy cluster under the muzzle
  for (const [x, y, z, r] of [[-0.035, 0.245, 0.055, 0.032], [0.035, 0.245, 0.055, 0.032], [0, 0.23, 0.07, 0.036], [-0.018, 0.21, 0.06, 0.028], [0.018, 0.21, 0.06, 0.028], [0, 0.255, 0.08, 0.026]]) {
    root.add(blob(beard, r, r, r * 0.9, x, y, z))
  }
  const crown = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.066, 0.045, 20), navy))
  crown.position.y = 0.36
  const brim = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.01, 20), navy))
  brim.position.set(0, 0.338, 0.012)
  const badge = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.01), gold))
  badge.position.set(0, 0.362, 0.064)
  root.add(crown, brim, badge)
  const arm = flipper(fur, 1, 0.2, 0.065)
  const hold = flipper(fur, -1, 0.2, 0.065)
  const spyglass = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, 0.11, 12), gold))
  spyglass.rotation.x = Math.PI / 2
  spyglass.position.set(0, -0.1, 0.04)
  hold.add(spyglass)
  root.add(arm, hold)
  return { root, arm, hold }
}

// Institutional money: a penguin in a suit. Glasses, tie and a briefcase.
function buildPenguin() {
  const root = new THREE.Group()
  const black = standard('#2f3440')
  const white = standard('#fbf8f2')
  const orange = standard('#ffa24c')
  const tie = standard('#5b7fd6')
  const frame = standard('#3b2f2d')
  const leather = standard('#9a6a43')
  root.add(
    blob(black, 0.1, 0.14, 0.09, 0, 0.14, 0),
    blob(white, 0.072, 0.11, 0.04, 0, 0.13, 0.058),
    blob(black, 0.068, 0.066, 0.066, 0, 0.3, 0),
    blob(white, 0.048, 0.04, 0.025, 0, 0.3, 0.05),
    blob(frame, 0.01, 0.01, 0.008, -0.022, 0.31, 0.072),
    blob(frame, 0.01, 0.01, 0.008, 0.022, 0.31, 0.072),
    blob(orange, 0.028, 0.012, 0.018, -0.03, 0.006, 0.04),
    blob(orange, 0.028, 0.012, 0.018, 0.03, 0.006, 0.04),
  )
  const beak = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 12), orange))
  beak.rotation.x = Math.PI / 2
  beak.position.set(0, 0.29, 0.09)
  root.add(beak)
  for (const side of [-1, 1]) {
    const lens = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.004, 8, 20), frame))
    lens.position.set(side * 0.022, 0.31, 0.078)
    root.add(lens)
  }
  const knot = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.018, 0.012), tie))
  knot.position.set(0, 0.215, 0.095)
  const blade = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.07, 4), tie))
  blade.rotation.set(Math.PI, Math.PI / 4, 0)
  blade.scale.z = 0.4
  blade.position.set(0, 0.17, 0.097)
  root.add(knot, blade)
  const arm = flipper(black, 1, 0.21, 0.07)
  const hold = flipper(black, -1, 0.21, 0.07)
  const briefcase = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.055, 0.022), leather))
  briefcase.position.set(0, -0.14, 0.02)
  const handle = shadowed(new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 6, 12, Math.PI), frame))
  handle.position.set(0, -0.11, 0.02)
  hold.add(briefcase, handle)
  root.add(arm, hold)
  return { root, arm, hold }
}

// Pori's treasure chest by the house: the lid opens when tapped, and a star twinkles over it
// when a new shell is waiting.
const CHEST_SPOT = { x: 2.3, z: -1.2 }
function buildChest() {
  const group = new THREE.Group()
  const wood = standard('#c98f5a')
  const gold = standard('#ffd36b', { emissive: '#ffb020', emissiveIntensity: 0.15 })
  const base = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.26, 0.32), wood))
  base.position.y = 0.13
  group.add(base)
  for (const x of [-0.16, 0.16]) {
    const band = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.27, 0.33), gold))
    band.position.set(x, 0.135, 0)
    group.add(band)
  }
  // the lid hinges along the back edge
  const lid = new THREE.Group()
  lid.position.set(0, 0.26, -0.16)
  const dome = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.46, 20, 1, false, 0, Math.PI), wood))
  dome.rotation.set(0, 0, Math.PI / 2)
  dome.scale.set(1, 1, 1)
  dome.position.set(0, 0, 0.16)
  lid.add(dome)
  for (const x of [-0.16, 0.16]) {
    const band = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.05, 20, 1, false, 0, Math.PI), gold))
    band.rotation.set(0, 0, Math.PI / 2)
    band.position.set(x, 0, 0.16)
    lid.add(band)
  }
  const lock = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.09, 0.03), gold))
  lock.position.set(0, -0.02, 0.33)
  lid.add(lock)
  group.add(lid)
  // pearls inside, seen when the lid is open
  const pearl = standard('#fff3f6', { emissive: '#ffd6e4', emissiveIntensity: 0.25 })
  for (const [x, z] of [[-0.1, 0.02], [0.05, -0.05], [0.12, 0.06], [-0.02, 0.08]]) {
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), pearl)
    bead.position.set(x, 0.27, z)
    group.add(bead)
  }
  const sparkle = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.07),
    new THREE.MeshStandardMaterial({ color: '#fff4c4', emissive: '#ffd24a', emissiveIntensity: 0.9 }),
  )
  sparkle.position.y = 0.72
  group.add(sparkle)
  return { group, lid, sparkle, open: 0 }
}

// a message in a bottle: an upcoming market event drifting in from the horizon
function buildBottle() {
  const outer = new THREE.Group()
  const bottle = new THREE.Group()
  const glass = new THREE.MeshStandardMaterial({ color: '#7fd8cb', roughness: 0.2, metalness: 0, transparent: true, opacity: 0.82, emissive: '#3fb7a8', emissiveIntensity: 0.18 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.26, 16), glass)
  const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass)
  shoulder.position.y = 0.13
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.09, 12), glass)
  neck.position.y = 0.24
  const cork = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.05, 12), standard('#b98552')))
  cork.position.y = 0.3
  // the rolled letter inside, tied with a ribbon
  const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12), standard('#fff4dc'))
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.03, 12), standard('#ff8f7d'))
  bottle.add(body, shoulder, neck, cork, paper, ribbon)
  // floats lying down, cork up a little
  bottle.rotation.z = Math.PI / 2 - 0.35
  outer.add(bottle)
  // a ring of ripples on the water so the bottle is easy to spot
  const ripple = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.25, 32),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
  )
  ripple.rotation.x = -Math.PI / 2
  ripple.position.y = -0.02
  outer.add(ripple)
  outer.visible = false
  return { outer, bottle, ripple, shown: 0, x: 4, z: -3 }
}

function buildDock() {
  const group = new THREE.Group()
  const wood = standard(PALETTE.wood)
  const post = standard(PALETTE.post)
  for (let i = 0; i < 7; i += 1) {
    const plank = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.62), wood))
    plank.position.set(i * 0.27, 0, 0)
    plank.rotation.y = (i % 2 ? 1 : -1) * 0.02
    group.add(plank)
  }
  for (const x of [0.15, 0.95, 1.65]) {
    for (const z of [-0.32, 0.32]) {
      const pile = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.3, 10), post))
      pile.position.set(x, -0.6, z)
      group.add(pile)
    }
  }
  return group
}

// Small, slow ripples as a tiling normal map: every term has whole cycles across the tile, so it repeats seamlessly.
function rippleNormalMap(size = 256) {
  const waves = [
    [3, 1, 0.5, 0.2], [-2, 3, 0.5, 1.7], [1, -4, 0.45, 2.9], [-4, -2, 0.4, 4.1], [5, 3, 0.3, 0.7],
    [-3, 5, 0.3, 5.3], [6, -1, 0.25, 3.3], [-1, -6, 0.25, 1.1], [4, -5, 0.2, 2.2], [-6, 4, 0.2, 4.8],
    [7, 5, 0.15, 0.4], [-5, -7, 0.15, 3.9],
  ]
  const image = new ImageData(size, size)
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      const u = px / size
      const v = py / size
      let du = 0
      let dv = 0
      for (const [kx, ky, amp, phase] of waves) {
        const c = Math.cos(Math.PI * 2 * (kx * u + ky * v) + phase) * amp * Math.PI * 2
        du += c * kx
        dv += c * ky
      }
      const n = new THREE.Vector3(-du * 0.02, -dv * 0.02, 1).normalize()
      const index = (py * size + px) * 4
      image.data[index] = (n.x * 0.5 + 0.5) * 255
      image.data[index + 1] = (n.y * 0.5 + 0.5) * 255
      image.data[index + 2] = (n.z * 0.5 + 0.5) * 255
      image.data[index + 3] = 255
    }
  }
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  canvas.getContext('2d').putImageData(image, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(9, 9)
  return texture
}

// An opaque teal sea: mint where it is shallow by the island, deeper teal further out,
// with fine moving ripples. Opaque so the island's underwater sides no longer show through.
function buildSea() {
  const geometry = new THREE.PlaneGeometry(60, 60, 110, 110)
  geometry.rotateX(-Math.PI / 2)
  const base = geometry.attributes.position.array.slice()
  const count = geometry.attributes.position.count
  const shelter = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const deep = new THREE.Color(PALETTE.deepSea)
  const shallow = new THREE.Color(PALETTE.shallowSea)
  const mixed = new THREE.Color()
  for (let i = 0; i < count; i += 1) {
    const r = Math.hypot(base[i * 3], base[i * 3 + 2])
    // the island shelters the water right around it, so waves never wash over the grass
    shelter[i] = THREE.MathUtils.smoothstep(r, 3.0, 5.5)
    mixed.lerpColors(shallow, deep, THREE.MathUtils.smoothstep(r, 3.9, 6.4))
    colors.set([mixed.r, mixed.g, mixed.b], i * 3)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  const normalMap = rippleNormalMap()
  const material = new THREE.MeshStandardMaterial({
    color: PALETTE.dayTint, vertexColors: true, roughness: 0.62, metalness: 0,
    normalMap, normalScale: new THREE.Vector2(0.2, 0.2),
  })
  const mesh = new THREE.Mesh(geometry, material)
  mesh.receiveShadow = true
  const update = (level, t, rough) => {
    const position = geometry.attributes.position
    for (let i = 0; i < position.count; i += 1) {
      const x = base[i * 3]
      const z = base[i * 3 + 2]
      position.array[i * 3 + 1] = level + waveHeight(x * 0.75, z * 0.75, t, rough) * SWELL * (0.15 + shelter[i] * 0.85)
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    // ripples drift slowly, a little faster on a choppy day
    normalMap.offset.set(t * 0.006, t * 0.004)
    material.normalScale.setScalar(0.18 + rough * 0.17)
  }
  return { mesh, material, update }
}

export default function PoriIsland({
  marketState, touchSignal, waterLevel = 0.5, volatility = 0.2, foreignFlow = 0, institutionFlow = 0,
  overnight = null, wind = 0, samsung = null, hynix = null, fish = null,
  focus = 'shore', onPick = null,
  // what the user tapped: the camera moves in on it
  selected = null,
  // a new shell is waiting in the treasure chest
  chestNew = false,
  // fishing at the end of the dock: { phase: 'cast' | 'caught', name, level, color } or null
  fishing = null,
  // called when the fish bites, so the screen can show the catch in time with the scene
  onFishingCaught = null,
  // no clear culprit today: the sea is wrapped in fog
  foggy = false,
  // upcoming events as bottles on the horizon: [{ dday }], nearest first (up to 3)
  letters = null,
  // arrive from the sky: the camera starts high above (in the clouds) and circles down onto the island
  descendOnMount = false,
  // free to stroll: after visiting today's spot, Pori wanders the grass (never into the water)
  wander = false,
}) {
  const hostRef = useRef(null)
  const hotspotRefs = useRef({})
  const dataRef = useRef(null)
  const touchRef = useRef({ signal: touchSignal, at: -10 })
  const descendRef = useRef(descendOnMount)
  // drag-to-lift handlers live inside the scene effect; the Pori button calls them through this
  const liftApi = useRef(null)

  useEffect(() => {
    dataRef.current = {
      marketState, waterLevel, volatility, foreign: foreignFlow, institution: institutionFlow,
      overnight, wind, samsung, hynix, fish, focus, selected, chestNew, fishing, onFishingCaught, foggy, letters, wander,
    }
  })

  useEffect(() => {
    if (touchSignal > 0 && touchSignal !== touchRef.current.signal) {
      touchRef.current = { signal: touchSignal, at: performance.now() / 1000 }
    }
  }, [touchSignal])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const data = () => dataRef.current ?? { marketState: 'loading', waterLevel: 0.5, volatility: 0.2, focus: 'shore' }

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.NoToneMapping
    renderer.domElement.className = 'pori-3d-canvas'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const daySky = new THREE.Color(PALETTE.daySky)
    const nightSky = new THREE.Color(PALETTE.nightSky)
    const skyColor = daySky.clone()
    const fogTint = new THREE.Color('#c9d3d8')
    let fogAmount = 0
    scene.background = skyColor
    scene.fog = new THREE.Fog(skyColor, 13, 27)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80)
    const target = new THREE.Vector3(0.4, 0.7, 1.3)

    const hemi = new THREE.HemisphereLight('#ffffff', '#ffe2cc', 1.6)
    const key = new THREE.DirectionalLight('#ffffff', 1.55)
    key.position.set(-4, 10, 7)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 30 })
    key.shadow.radius = 6
    key.shadow.bias = -0.0005
    key.shadow.normalBias = 0.02
    const fill = new THREE.DirectionalLight('#ffffff', 0.45)
    fill.position.set(6, 4, 8)
    const rim = new THREE.DirectionalLight('#c9fff1', 0.5)
    rim.position.set(3, 4, -8)
    scene.add(hemi, key, fill, rim)

    // --- the island ---
    const grass = standard(PALETTE.grass)
    const hillGrass = standard(PALETTE.hill)
    const rock = standard(PALETTE.rock)
    const sand = standard(PALETTE.sand)
    const beachOutline = outline(3.95, 0.07, 1.3)
    const grassOutline = outline(3.25, 0.09, 2.1)
    const hillOutline = outline(1.3, 0.1, 4, -1.55, -1.35, 12)
    scene.add(
      terrace(beachOutline, 0.12, 2.2, sand, rock),
      terrace(grassOutline, GROUND_Y, 1.2, grass, rock),
      terrace(hillOutline, 1.05, 1.0, hillGrass, rock),
    )
    // --- where Pori may stand: on the grass, off the hill, clear of the house, chest, trees and bushes ---
    const HILL_CENTER = { x: -1.55, z: -1.35 }
    const OBSTACLES = [
      { x: 1.45, z: -1.35, r: 0.8 },
      { x: CHEST_SPOT.x, z: CHEST_SPOT.z, r: 0.42 },
      ...PROPS.filter((prop) => prop.y === undefined && prop.model.startsWith('tree')).map((prop) => ({ x: prop.x, z: prop.z, r: 0.4 })),
      ...PROPS.filter((prop) => prop.model === 'plant-bush').map((prop) => ({ x: prop.x, z: prop.z, r: 0.28 })),
    ]
    const onGrass = (x, z) => insidePolygon(grassOutline, x * 1.14, z * 1.14)
      && !insidePolygon(hillOutline, HILL_CENTER.x + (x - HILL_CENTER.x) / 1.22, HILL_CENTER.z + (z - HILL_CENTER.z) / 1.22)
    const standable = (x, z) => onGrass(x, z) && OBSTACLES.every((item) => Math.hypot(x - item.x, z - item.z) > item.r)
    const pathClear = (x0, z0, x1, z1) => {
      for (let i = 1; i <= 10; i += 1) {
        const t = i / 10
        if (!standable(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t)) return false
      }
      return true
    }
    const pathMaterial = standard(PALETTE.path)
    scene.add(
      pathRibbon([[SPOTS.lighthouse.x, SPOTS.lighthouse.z], [0.2, 0.7], [1.4, 0.85], [SPOTS.dock.x + 0.2, SPOTS.dock.z]], 0.3, pathMaterial),
      pathRibbon([[SPOTS.home.x, SPOTS.home.z], [0.9, 0.5], [0.4, 1.3], [SPOTS.shore.x, SPOTS.shore.z + 0.4]], 0.3, pathMaterial),
    )
    // little steps up the hill to the lighthouse
    for (let i = 0; i < 3; i += 1) {
      const step = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.18), standard('#d8cfc8')))
      step.position.set(-1.05 - i * 0.04, GROUND_Y + 0.1 + i * 0.2, 0.05 - i * 0.18)
      scene.add(step)
    }
    const lighthouse = buildLighthouse()
    lighthouse.group.position.set(-1.6, 1.05, -1.4)
    const house = buildHouse()
    house.group.position.set(1.45, GROUND_Y, -1.35)
    house.group.rotation.y = -0.25
    const dock = buildDock()
    dock.position.set(2.85, GROUND_Y + 0.02, SPOTS.dock.z)
    const chest = buildChest()
    chest.group.position.set(CHEST_SPOT.x, GROUND_Y, CHEST_SPOT.z)
    chest.group.rotation.y = -0.35
    scene.add(lighthouse.group, house.group, dock, chest.group)
    // trees, rocks and bushes: simple shapes first, swapped for the kit's models once they load
    const propSlots = PROPS.map((prop) => {
      const slot = new THREE.Group()
      slot.position.set(prop.x, prop.y ?? GROUND_Y, prop.z)
      slot.rotation.y = prop.yaw
      const fallback = prop.fallback?.() ?? null
      if (fallback) slot.add(fallback)
      scene.add(slot)
      return { prop, slot, fallback }
    })
    let unmounted = false
    const modelLoader = new GLTFLoader()
    const modelNames = [...new Set(PROPS.map((prop) => prop.model))]
    Promise.all(modelNames.map((name) => modelLoader.loadAsync(`${MODEL_DIR}${name}.glb`)
      .then((gltf) => [name, gltf.scene], () => [name, null])))
      .then((entries) => {
        const models = Object.fromEntries(entries)
        const painted = {}
        const repaint = (material) => {
          painted[material.name] ??= new THREE.MeshStandardMaterial({
            color: MODEL_COLORS[material.name] ?? material.color, roughness: 0.9, flatShading: true,
          })
          return painted[material.name]
        }
        Object.values(models).forEach((root) => root?.traverse((node) => {
          if (!node.isMesh) return
          const original = Array.isArray(node.material) ? node.material : [node.material]
          node.material = Array.isArray(node.material) ? original.map(repaint) : repaint(node.material)
          original.forEach((material) => material.dispose())
          node.castShadow = true
          node.receiveShadow = true
        }))
        if (unmounted) {
          Object.values(models).forEach((root) => root?.traverse((node) => node.geometry?.dispose()))
          Object.values(painted).forEach((material) => material.dispose())
          return
        }
        propSlots.forEach(({ prop, slot, fallback }) => {
          const model = models[prop.model]
          if (!model) return
          if (fallback) {
            slot.remove(fallback)
            fallback.traverse((node) => {
              node.geometry?.dispose()
              node.material?.dispose?.()
            })
          }
          const copy = model.clone(true)
          copy.scale.setScalar(prop.scale)
          slot.add(copy)
        })
      })
    const flowerColors = ['#ff9fb2', '#ffd36b', '#ffffff']
    for (let i = 0; i < 9; i += 1) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), standard(flowerColors[i % 3]))
      flower.position.set(0.55 + Math.cos(i * 2.4) * 0.45, GROUND_Y + 0.04, -1.0 + Math.sin(i * 2.4) * 0.3)
      scene.add(flower)
    }

    // --- the sea ---
    const sea = buildSea()
    scene.add(sea.mesh)
    // thin foam lines where the water meets the beach (low tide) or the grass (high tide)
    // shore foam sits on the beach edge at low tide and on the grass edge at high tide
    const beachFoam = buildFoam(beachOutline)
    const grassFoam = buildFoam(grassOutline)
    scene.add(beachFoam.mesh, grassFoam.mesh)
    const dayTint = new THREE.Color(PALETTE.dayTint)
    const nightTint = new THREE.Color(PALETTE.nightTint)

    // --- Pori ---
    const pori = buildPori()
    scene.add(pori.root)
    // fishing gear: a rod held in Pori's right hand, a line, a bobber, and the fish that gets caught
    const rod = new THREE.Group()
    rod.position.set(0.55, 0.75, 0.3)
    rod.rotation.x = 1.0
    const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 2.0, 10), standard('#b07a4c')))
    pole.position.y = 1.0
    const rodTip = new THREE.Object3D()
    rodTip.position.y = 2.0
    rod.add(pole, rodTip)
    rod.visible = false
    pori.root.add(rod)
    const lineGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()])
    const fishingLine = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85 }))
    fishingLine.frustumCulled = false
    fishingLine.visible = false
    const bobber = new THREE.Group()
    bobber.add(
      new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), standard('#ff6f61')),
      new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), standard('#ffffff')),
    )
    bobber.visible = false
    const catchFish = buildFish('#ffcf5c')
    catchFish.outer.visible = false
    catchFish.outer.scale.setScalar(1.6)
    scene.add(fishingLine, bobber, catchFish.outer)
    const fishingState = { phase: null, caughtAt: 0, name: null, arrivedAt: null, biteSent: false }
    const splashMaterial = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
    const splash = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 32), splashMaterial)
    splash.rotation.x = -Math.PI / 2
    scene.add(splash)
    const castFrom = new THREE.Vector3()

    // a word bubble that pops over Pori's head ("!" on a bite, "낚았다!" on the catch)
    const makeBadge = (text, fg, bg, width = 256) => {
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = 128
      const context = canvas.getContext('2d')
      context.fillStyle = bg
      context.beginPath()
      context.roundRect(8, 10, width - 16, 108, 54)
      context.fill()
      context.fillStyle = fg
      context.font = '900 72px Pretendard, system-ui, sans-serif'
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, width / 2, 68)
      const texture = new THREE.CanvasTexture(canvas)
      texture.colorSpace = THREE.SRGBColorSpace
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }))
      sprite.renderOrder = 6
      sprite.userData.aspect = width / 128
      sprite.visible = false
      scene.add(sprite)
      return sprite
    }
    const biteBadge = makeBadge('!', '#ffffff', '#ff6f61', 128)
    const catchBadge = makeBadge('낚았다!', '#ffffff', '#2fae90', 360)

    // confetti around Pori and droplets at the hook: a small pool of particles reused each catch
    const particleColors = ['#ffd36b', '#ff9fb2', '#8fdcc6', '#9fc4ff', '#ffffff']
    const particleMaterials = particleColors.map((color) => new THREE.MeshStandardMaterial({
      color, roughness: 0.5, emissive: color, emissiveIntensity: 0.35,
    }))
    const dropMaterial = new THREE.MeshStandardMaterial({ color: '#e8fbff', roughness: 0.3, transparent: true, opacity: 0.9 })
    const starGeometry = new THREE.OctahedronGeometry(0.06)
    const dotGeometry = new THREE.SphereGeometry(0.04, 10, 8)
    const makeParticles = (count, pick) => Array.from({ length: count }, (_, index) => {
      const { geometry, material } = pick(index)
      const mesh = new THREE.Mesh(geometry, material)
      mesh.visible = false
      scene.add(mesh)
      return { mesh, velocity: new THREE.Vector3(), life: 1, spin: 0, size: 1 }
    })
    const confetti = makeParticles(26, (index) => ({
      geometry: index % 2 ? starGeometry : dotGeometry,
      material: particleMaterials[index % particleMaterials.length],
    }))
    const droplets = makeParticles(14, () => ({ geometry: dotGeometry, material: dropMaterial }))
    const burst = (pool, origin, { speed, up, spread, size }) => {
      pool.forEach((particle) => {
        const angle = Math.random() * Math.PI * 2
        const out = spread * (0.5 + Math.random() * 0.5)
        particle.mesh.position.copy(origin)
        particle.velocity.set(Math.cos(angle) * out, up * (0.6 + Math.random() * 0.6), Math.sin(angle) * out).multiplyScalar(speed)
        particle.life = 0
        particle.spin = (Math.random() - 0.5) * 12
        particle.size = size * (0.7 + Math.random() * 0.6)
        particle.mesh.visible = true
      })
    }
    const stepParticles = (pool, dt, gravity, lifetime) => {
      pool.forEach((particle) => {
        if (particle.life >= 1) return
        particle.life += dt / lifetime
        particle.velocity.y -= gravity * dt
        particle.mesh.position.addScaledVector(particle.velocity, dt)
        particle.mesh.rotation.x += particle.spin * dt
        particle.mesh.rotation.y += particle.spin * dt
        particle.mesh.scale.setScalar(Math.max(particle.size * (1 - particle.life), 0.001))
        if (particle.life >= 1) particle.mesh.visible = false
      })
    }
    const burstOrigin = new THREE.Vector3()
    // fishing timeline (seconds after Pori reaches the end of the dock)
    const CAST_END = 1.1
    const BITE_AT = CAST_END + 4.2
    const BITE_LEN = 1.1
    const easeInOut = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2)
    const tipWorld = new THREE.Vector3()
    const BOBBER = { x: SPOTS.fishing.x + 1.05, z: SPOTS.fishing.z }

    const startSpot = SPOTS[data().focus] ?? SPOTS.shore
    const walker = { x: startSpot.x, z: startSpot.z, heading: startSpot.face, phase: 0 }
    // wandering: first stay at today's spot a while, then stroll to random places on the front of the island
    const strolling = { target: null, idleUntil: 7, arrivedAtSpot: false }
    const pickStroll = () => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const x = -2.7 + Math.random() * 5.5
        const z = -0.8 + Math.random() * 3.4
        const far = Math.hypot(x - walker.x, z - walker.z)
        if (far < 0.7 || far > 2.6) continue
        if (standable(x, z) && pathClear(walker.x, walker.z, x, z)) return { x, z }
      }
      return null
    }
    // where Pori would land while held: a soft ring on the ground (red over water)
    const landRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.27, 32),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
    )
    landRing.rotation.x = -Math.PI / 2
    landRing.renderOrder = 2
    scene.add(landRing)
    // lifting Pori by dragging: held in the air, set down on land, refused over water
    const lift = {
      pointerId: null, sx: 0, sy: 0, moved: false, active: false, liftedAt: 0,
      x: 0, z: 0, valid: true, lastValid: { x: 0, z: 0 }, height: 0,
      drop: null, landedAt: -10, refusedAt: -10, suppressClick: false,
    }

    // --- boats: berths on either side of the dock; sellers sail out into the fog ---
    const boats = [
      { ...buildBoat('#ff8f7d'), sailColor: '#ff8f7d', key: 'foreign', berth: { x: 4.15, z: SPOTS.dock.z - 0.72 }, away: { x: 12, z: -4 } },
      { ...buildBoat('#6fa8f5'), sailColor: '#6fa8f5', key: 'institution', berth: { x: 4.15, z: SPOTS.dock.z + 0.72 }, away: { x: 11, z: 7 } },
    ]
    boats.forEach((boat) => {
      boat.heading = Math.PI
      boat.crew = boat.key === 'foreign' ? buildSeaLion() : buildPenguin()
      boat.crew.root.position.set(-0.12, 0.13, 0) // on the clay boat's deck until the ship loads
      boat.crew.turn = 2.0
      boat.crew.baseY = 0.13
      boat.crew.root.scale.setScalar(SHIP.crewScale)
      boat.tilt.add(boat.crew.root)
      scene.add(boat.outer)
    })
    // swap the clay hull and sail for the ship model once it loads (the clay boat stays if it fails)
    new GLTFLoader().loadAsync(`${MODEL_DIR}${SHIP.model}.glb`).then((gltf) => {
      if (unmounted) {
        gltf.scene.traverse((node) => {
          node.geometry?.dispose()
          node.material?.map?.dispose()
          node.material?.dispose?.()
        })
        return
      }
      boats.forEach((boat) => {
        const ship = gltf.scene.clone(true)
        ship.traverse((node) => {
          if (!node.isMesh) return
          node.castShadow = true
          node.receiveShadow = true
          if (node.name.startsWith('flag')) node.visible = false
          if (node.name.startsWith('sail')) {
            node.material = node.material.clone()
            node.material.color.set(boat.sailColor)
          }
        })
        ship.rotation.y = Math.PI / 2 // the model's bow is +z; the boat's is +x
        ship.scale.setScalar(SHIP.scale)
        ship.position.y = SHIP.sink
        boat.tilt.children.forEach((child) => {
          if (child !== boat.pennant && child !== boat.crew.root && !boat.crates.includes(child)) child.visible = false
        })
        boat.tilt.add(ship)
        boat.pennant.position.set(...SHIP.pennant)
        boat.pennant.scale.setScalar(1.8)
        boat.crates.forEach((crate, index) => crate.position.set(...SHIP.crates[index]))
        boat.crew.root.position.set(...SHIP.crew)
        boat.crew.baseY = SHIP.crew[1]
      })
    }, () => {})

    // --- whales (heavyweight stocks) and fish (today's movers) in the water in front ---
    const whales = [
      { ...buildWhale('#6f9cf0', '삼성전자'), key: 'samsung', x: -3.0, z: 4.1, size: 2.0 },
      { ...buildWhale('#f29a6b', '하이닉스'), key: 'hynix', x: -1.2, z: 4.8, size: 1.8 },
    ]
    whales.forEach((whale) => {
      whale.outer.rotation.y = 2.75
      scene.add(whale.outer)
    })
    const school = [
      { ...buildFish('#ffcf5c'), x: 0.0, z: 4.35 },
      { ...buildFish('#ff9fb2'), x: 1.25, z: 4.3 },
      { ...buildFish('#8fdcc6'), x: 2.45, z: 3.85 },
    ]
    school.forEach((item) => {
      item.outer.rotation.y = -0.45
      scene.add(item.outer)
    })
    // bottles drift in from the open sea (north-east, under the weather); nearer dates float closer
    const bottles = [buildBottle(), buildBottle(), buildBottle()]
    bottles.forEach((item) => scene.add(item.outer))
    const BOTTLE_NEAR = { x: 4.05, z: -2.6 }
    const BOTTLE_FAR = { x: 4.3, z: -4.6 }

    // --- sky: weather over the open sea (last night's US market), wind streaks, Zzz ---
    const weather = buildWeather()
    weather.root.scale.setScalar(1.25)
    weather.root.position.set(2.9, 3.0, -1.6)
    scene.add(weather.root)
    const sky = { sun: 0, cloud: 0, rain: 0, dots: 0, bang: 0, sunBehind: 0, moon: 0 }
    const cloudColor = new THREE.Color('#ffffff')
    const cloudTarget = new THREE.Color()
    const streaks = [[2.7, 0.5, 0], [3.3, 0.7, 0.4], [3.9, 0.45, 0.7], [2.3, 0.6, 0.2]].map(([y, length, phase], index) => {
      const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, length, 6, 12), material)
      mesh.rotation.z = Math.PI / 2
      scene.add(mesh)
      return { mesh, material, y, phase, z: -2.6 + index * 0.9 }
    })
    const zzz = buildZzz()
    scene.add(zzz.root)

    // --- camera: drag sideways to walk around the island, up/down to tilt ---
    const view = { width: 1, height: 1, yaw: 0.5, pitch: 0.55, yawTarget: 0.5, pitchTarget: 0.55, distance: 13, zoom: 0 }
    const homeTarget = target.clone()
    const lookPoint = target.clone()
    const zoomPoint = new THREE.Vector3()
    // 1 = still high in the clouds, eases to 0 as the camera comes down
    let descend = descendRef.current ? 1 : 0
    const placeCamera = () => {
      // coming down from the sky: steeper, farther, and turning a little as it lands
      const pitch = Math.min(1.48, view.pitch + descend * 0.95)
      const yaw = view.yaw + descend * 0.7
      const cosPitch = Math.cos(pitch)
      const distance = view.distance * (1 - view.zoom * 0.5) * (1 + descend * 1.5)
      camera.position.set(
        lookPoint.x + distance * cosPitch * Math.sin(yaw),
        lookPoint.y + distance * Math.sin(pitch),
        lookPoint.z + distance * cosPitch * Math.cos(yaw),
      )
      camera.lookAt(lookPoint)
    }
    // where the camera looks when something is tapped (null = stay on the whole island)
    const selectionPoint = (name) => {
      if (name === 'pori') return zoomPoint.set(walker.x, GROUND_Y + 0.5, walker.z)
      if (name === 'lighthouse' || name === 'weather') return zoomPoint.set(-0.6, 2.0, -1.4)
      if (name === 'home') return zoomPoint.set(1.45, GROUND_Y + 0.4, -1.35)
      if (name === 'fishing') return zoomPoint.set(SPOTS.fishing.x + 0.45, GROUND_Y + 0.3, SPOTS.fishing.z)
      if (name === 'chest') {
        // the shell list covers the right side (or the bottom on a phone), so frame the chest off-centre
        if (camera.aspect < 1) return zoomPoint.set(CHEST_SPOT.x - 0.2, GROUND_Y - 0.5, CHEST_SPOT.z)
        return zoomPoint.set(
          CHEST_SPOT.x - 0.2 + Math.cos(view.yaw) * 0.9,
          GROUND_Y + 0.3,
          CHEST_SPOT.z - Math.sin(view.yaw) * 0.9,
        )
      }
      if (name === 'bottles') {
        // the letter list covers the right side, so frame the bottles a little to the right of centre
        const near = bottles[0].outer.position
        if (camera.aspect < 1) return zoomPoint.set(near.x, seaLevel - 0.6, near.z)
        return zoomPoint.set(near.x + Math.cos(view.yaw) * 1.2, seaLevel + 0.3, near.z - Math.sin(view.yaw) * 1.2)
      }
      const boat = boats.find((item) => item.key === name)
      if (boat) return zoomPoint.copy(boat.outer.position).setY(seaLevel + 0.3)
      const whale = whales.find((item) => item.key === name)
      if (whale) return zoomPoint.set(whale.x, seaLevel + 0.2, whale.z)
      if (name?.startsWith('fish')) {
        const item = school[Number(name.slice(4))]
        if (item) return zoomPoint.set(item.x, seaLevel + 0.15, item.z)
      }
      return null
    }
    const resize = () => {
      view.width = host.clientWidth || 1
      view.height = host.clientHeight || 1
      renderer.setSize(view.width, view.height, false)
      camera.aspect = view.width / view.height
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      // keep the whole island (about 11 wide, 7 tall on screen) in frame
      // narrow screens may crop the far water a little rather than shrink the island too much
      view.distance = Math.max(8.6 / 2 / halfFov, (camera.aspect < 1 ? 10.5 : 13.5) / 2 / (halfFov * camera.aspect))
      // the horizon fades a fixed way past the island, however far the camera sits
      // the loop pulls these in further on foggy days
      camera.updateProjectionMatrix()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    const drag = { id: null, x: 0, y: 0 }
    const onPointerDown = (event) => {
      drag.id = event.pointerId
      drag.x = event.clientX
      drag.y = event.clientY
      host.setPointerCapture(event.pointerId)
      host.classList.add('dragging')
    }
    const onPointerMove = (event) => {
      if (drag.id !== event.pointerId) return
      view.yawTarget = THREE.MathUtils.clamp(view.yawTarget - (event.clientX - drag.x) * 0.006, -1.3, 2.0)
      if (event.pointerType === 'mouse') {
        view.pitchTarget = THREE.MathUtils.clamp(view.pitchTarget + (event.clientY - drag.y) * 0.004, 0.32, 1.05)
      }
      drag.x = event.clientX
      drag.y = event.clientY
    }
    const onPointerUp = (event) => {
      if (drag.id !== event.pointerId) return
      drag.id = null
      host.classList.remove('dragging')
    }
    // --- lifting Pori: press on Pori and drag. A tap without moving stays a tap (pet). ---
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    const holdPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -GROUND_Y)
    const holdPoint = new THREE.Vector3()
    const groundUnder = (event) => {
      const rect = host.getBoundingClientRect()
      pointerNdc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(pointerNdc, camera)
      return raycaster.ray.intersectPlane(holdPlane, holdPoint)
    }
    const liftDown = (event) => {
      if (lift.drop || data().fishing) return
      lift.pointerId = event.pointerId
      lift.sx = event.clientX
      lift.sy = event.clientY
      lift.moved = false
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* keeps working without capture */ }
    }
    const liftMove = (event) => {
      if (lift.pointerId !== event.pointerId) return
      if (!lift.moved && Math.hypot(event.clientX - lift.sx, event.clientY - lift.sy) > 6) {
        lift.moved = true
        lift.active = true
        lift.liftedAt = performance.now() / 1000
        lift.lastValid = { x: walker.x, z: walker.z }
        host.classList.add('holding')
      }
      if (!lift.active) return
      const point = groundUnder(event)
      if (!point) return
      // can't carry Pori off into the distance
      const reach = Math.hypot(point.x, point.z)
      const scale = reach > 5 ? 5 / reach : 1
      lift.x = point.x * scale
      lift.z = point.z * scale
      lift.valid = standable(lift.x, lift.z)
      if (lift.valid) lift.lastValid = { x: lift.x, z: lift.z }
    }
    const liftUp = (event) => {
      if (lift.pointerId !== event.pointerId) return
      lift.pointerId = null
      host.classList.remove('holding')
      if (!lift.active) return
      lift.active = false
      lift.suppressClick = true
      window.setTimeout(() => { lift.suppressClick = false }, 0)
      const now = performance.now() / 1000
      const refused = !lift.valid
      const to = refused ? lift.lastValid : { x: lift.x, z: lift.z }
      lift.drop = {
        start: now, duration: refused ? 0.7 : 0.32, refused,
        fromX: walker.x, fromZ: walker.z, toX: to.x, toZ: to.z, fromHeight: lift.height,
      }
      if (refused) lift.refusedAt = now + 0.7
    }
    liftApi.current = { down: liftDown, move: liftMove, up: liftUp, clickAllowed: () => !lift.suppressClick }

    host.addEventListener('pointerdown', onPointerDown)
    host.addEventListener('pointermove', onPointerMove)
    host.addEventListener('pointerup', onPointerUp)
    host.addEventListener('pointercancel', onPointerUp)

    const projected = new THREE.Vector3()
    const placeHotspot = (keyName, x, y, z, visible) => {
      const button = hotspotRefs.current[keyName]
      if (!button) return
      projected.set(x, y, z).project(camera)
      const onScreen = visible && projected.z < 1 && Math.abs(projected.x) < 0.98 && Math.abs(projected.y) < 0.98
      button.style.display = onScreen ? '' : 'none'
      if (!onScreen) return
      const sx = (projected.x * 0.5 + 0.5) * view.width
      const sy = (-projected.y * 0.5 + 0.5) * view.height
      button.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pose = { ...POSES.loading }
    const live = { happy: 0, jumpY: 0, stretch: 1, armLift: 0, walk: 0, yaw: 0, focus: 0, surprise: 0, headYaw: 0 }
    let seaLevel = THREE.MathUtils.lerp(SEA_LOW, SEA_HIGH, 0.5)
    let rough = 0
    let waveTime = 0
    let windLevel = 0
    let nextBlink = 2
    let blinkStart = -1
    let stateSince = 0
    let lastState = data().marketState
    let last = performance.now() / 1000
    let frame = 0

    const tick = () => {
      frame = requestAnimationFrame(tick)
      const now = performance.now() / 1000
      const dt = Math.min(now - last, 0.05)
      last = now
      const motion = reducedMotion.matches ? 0 : 1
      const input = data()
      const state = POSES[input.marketState] ? input.marketState : 'flat'
      if (state !== lastState) {
        lastState = state
        stateSince = now
      }
      for (const name of Object.keys(pose)) pose[name] = damp(pose[name], POSES[state][name], 6, dt)
      const night = pose.sleep

      // --- sea: trading value is the tide, volatility is the chop ---
      const activity = THREE.MathUtils.clamp((input.waterLevel - 0.08) / 0.92, 0, 1)
      seaLevel = damp(seaLevel, THREE.MathUtils.lerp(SEA_LOW, SEA_HIGH, activity), 1.8, dt)
      rough = damp(rough, THREE.MathUtils.clamp(input.volatility ?? 0, 0, 1), 1.6, dt)
      waveTime += dt * (1 + rough * 0.9) * motion
      sea.update(seaLevel, waveTime, rough)
      const beachWet = THREE.MathUtils.smoothstep(seaLevel, 0.08, 0.2)
      beachFoam.mesh.position.y = seaLevel + 0.03
      grassFoam.mesh.position.y = seaLevel + 0.03
      const foamTime = motion ? now : 0
      beachFoam.update(foamTime, (1 - beachWet) * (0.75 + rough * 0.25), rough)
      grassFoam.update(foamTime, beachWet * (0.75 + rough * 0.25), rough)

      windLevel = damp(windLevel, THREE.MathUtils.clamp(input.wind ?? 0, -1, 1), 1.5, dt)
      const windStrength = Math.abs(windLevel)
      const windDirection = windLevel > 0 ? -1 : 1

      // --- Pori walks to today's spot, then (when free) strolls around; or is held / being set down ---
      const held = lift.active || lift.drop !== null
      let spot = SPOTS[input.focus] ?? SPOTS.shore
      if (input.wander && motion && !held) {
        if (!strolling.arrivedAtSpot) {
          if (Math.hypot(spot.x - walker.x, spot.z - walker.z) < 0.05) {
            strolling.arrivedAtSpot = true
            strolling.idleUntil = now + 6
          }
        } else {
          if (!strolling.target && now > strolling.idleUntil) strolling.target = pickStroll()
          // standing still: face the viewer a little so the face shows
          spot = strolling.target
            ? { x: strolling.target.x, z: strolling.target.z, face: walker.heading }
            : { x: walker.x, z: walker.z, face: view.yaw * 0.6 + Math.sin(now * 0.3) * 0.5 }
        }
      } else if (!input.wander) {
        // sent somewhere (fishing, chest, letters): go there, then wander again from that spot
        strolling.arrivedAtSpot = false
        strolling.target = null
      }
      const dx = spot.x - walker.x
      const dz = spot.z - walker.z
      const distance = Math.hypot(dx, dz)
      const moving = !held && distance > 0.03 && motion > 0
      if (held) {
        // position is set by the hand (below)
      } else if (!motion) {
        walker.x = spot.x
        walker.z = spot.z
      } else if (moving) {
        const step = Math.min(distance, WALK_SPEED * (strolling.target ? 0.55 : 1) * dt)
        walker.x += (dx / distance) * step
        walker.z += (dz / distance) * step
      } else if (strolling.target) {
        strolling.target = null
        strolling.idleUntil = now + 2.5 + Math.random() * 4.5
      }
      if (!held) walker.heading = dampAngle(walker.heading, moving ? Math.atan2(dx, dz) : spot.face, moving ? 9 : 4, dt)

      // held in the hand: follow the pointer in the air, turned toward the viewer
      if (lift.active) {
        walker.x = damp(walker.x, lift.x, 14, dt)
        walker.z = damp(walker.z, lift.z, 14, dt)
        walker.heading = dampAngle(walker.heading, view.yaw, 6, dt)
        lift.height = damp(lift.height, 1, 12, dt)
      } else if (lift.drop) {
        // set down (or, over water, flown back to land in an arc)
        const t = Math.min(1, (now - lift.drop.start) / lift.drop.duration)
        const e = easeInOut(t)
        walker.x = THREE.MathUtils.lerp(lift.drop.fromX, lift.drop.toX, e)
        walker.z = THREE.MathUtils.lerp(lift.drop.fromZ, lift.drop.toZ, e)
        lift.height = lift.drop.fromHeight * (1 - e) + Math.sin(t * Math.PI) * (lift.drop.refused ? 0.6 : 0.1)
        if (t >= 1) {
          lift.drop = null
          lift.height = 0
          lift.landedAt = now
          strolling.target = null
          strolling.idleUntil = now + 3
        }
      } else {
        lift.height = 0
      }
      landRing.material.opacity = damp(landRing.material.opacity, lift.active ? 0.75 : 0, 10, dt)
      landRing.visible = landRing.material.opacity > 0.02
      if (landRing.visible) {
        const over = lift.active ? { x: lift.x, z: lift.z } : { x: walker.x, z: walker.z }
        const overLand = lift.active ? lift.valid : true
        landRing.position.set(over.x, (overLand ? GROUND_Y : seaLevel) + 0.02, over.z)
        landRing.material.color.set(overLand ? '#ffffff' : '#ff6b6b')
        landRing.scale.setScalar(1 + Math.sin(now * 6) * 0.08 * motion)
      }
      live.walk = damp(live.walk, moving ? 1 : 0, 10, dt)
      walker.phase += dt * 10 * live.walk

      // --- fishing timeline: wind up, cast, wait, bite, yank, celebrate ---
      const fishingInput = input.fishing
      if ((fishingInput?.phase ?? null) !== fishingState.phase) {
        fishingState.phase = fishingInput?.phase ?? null
        if (fishingState.phase === 'caught') {
          fishingState.caughtAt = now
          fishingState.dropsSent = false
          fishingState.confettiSent = 0
        }
        if (fishingState.phase === 'cast') {
          // a fresh cast replays the whole routine, even if Pori is already standing on the dock
          fishingState.biteSent = false
          fishingState.arrivedAt = null
        }
      }
      const atDock = Boolean(fishingInput) && Math.hypot(walker.x - SPOTS.fishing.x, walker.z - SPOTS.fishing.z) < 0.08
      if (!atDock) fishingState.arrivedAt = null
      else if (fishingState.arrivedAt === null) fishingState.arrivedAt = now
      const fx = {
        active: atDock, rod: 1.0, lean: 0, head: 0, headYaw: 0, leftArm: null, hop: 0, cheer: false,
        flight: 0, bite: 0, hook: -1, focus: 0, surprise: 0, tail: 0,
      }
      if (atDock) {
        const t = now - fishingState.arrivedAt
        if (fishingState.phase === 'cast') {
          if (t < 0.35) {
            fx.rod = THREE.MathUtils.lerp(1.0, -0.4, easeInOut(t / 0.35)) // wind up over the shoulder
            fx.lean = -0.12 * (t / 0.35)
          } else if (t < 0.6) {
            const a = (t - 0.35) / 0.25
            fx.rod = THREE.MathUtils.lerp(-0.4, 1.4, a) // whip forward
            fx.lean = THREE.MathUtils.lerp(-0.12, 0.16, a)
          } else if (t < CAST_END) {
            const a = (t - 0.6) / (CAST_END - 0.6)
            fx.rod = THREE.MathUtils.lerp(1.4, 1.0, easeInOut(a))
            fx.lean = THREE.MathUtils.lerp(0.16, 0.04, a)
          } else {
            // waiting: a little routine so Pori never just stands there, with a focused face throughout
            const w = t - CAST_END
            fx.focus = 1
            fx.rod = 1.0 + Math.sin(now * 1.7) * 0.05 * motion
            fx.lean = 0.06 + Math.sin(now * 1.1) * 0.02 * motion
            fx.head = 0.22
            if (w < 1.0) {
              // settle in: a slow sway, eyes on the bobber
              fx.lean += Math.sin(w * 3) * 0.03
            } else if (w < 1.9) {
              // lean right out over the water to peer at the bobber
              const a = Math.sin(((w - 1.0) / 0.9) * Math.PI)
              fx.lean += 0.14 * a
              fx.head += 0.12 * a
            } else if (w < 2.7) {
              // tap the rod twice to tease the fish
              const a = (w - 1.9) / 0.8
              fx.rod += Math.max(0, Math.sin(a * Math.PI * 4)) * 0.16
              fx.tail = Math.sin(a * Math.PI * 4) * 0.5
            } else if (w < 3.5) {
              // a quick glance over the shoulder at you: "shh, nearly there"
              const a = Math.sin(((w - 2.7) / 0.8) * Math.PI)
              fx.headYaw = -0.7 * a
              fx.focus = 1 - a * 0.6
            } else {
              // reel in a touch with the other paw
              fx.leftArm = 0.7 + Math.sin(now * 12) * 0.25 * motion
            }
          }
          fx.flight = THREE.MathUtils.clamp((t - 0.45) / (CAST_END - 0.45), 0, 1)
          if (t > BITE_AT) {
            fx.bite = 1
            fx.rod += Math.sin(now * 24) * 0.07 * motion // the rod jiggles as something nibbles
            fx.lean = 0.14
            fx.head = 0.3
            fx.headYaw = 0
            fx.focus = 0
            fx.surprise = 1 // eyes wide: something's biting!
            fx.leftArm = 0.9
          }
          if (t > BITE_AT + BITE_LEN && !fishingState.biteSent) {
            fishingState.biteSent = true
            input.onFishingCaught?.()
          }
        } else if (fishingState.phase === 'caught') {
          const k = now - fishingState.caughtAt
          fx.hook = k
          if (k < 0.25) {
            fx.rod = THREE.MathUtils.lerp(1.0, -0.1, easeInOut(k / 0.25)) // yank!
            fx.lean = THREE.MathUtils.lerp(0.14, -0.2, k / 0.25)
          } else {
            // then hold the catch out over the water, in front of Pori rather than in its face
            fx.rod = THREE.MathUtils.lerp(-0.1, 0.75, Math.min((k - 0.25) / 0.8, 1)) + Math.sin(now * 2) * 0.04 * motion
            fx.lean = THREE.MathUtils.lerp(-0.2, -0.05, Math.min((k - 0.25) / 0.8, 1))
          }
          fx.leftArm = 1.0 // both paws up on the rod
          fx.head = -0.12
          if (k > 0.9 && k < 3.0) {
            fx.cheer = true
            fx.hop = Math.abs(Math.sin((k - 0.9) * Math.PI * 1.8)) * 0.45 * motion
            fx.leftArm = 2.2 + Math.sin(now * 10) * 0.3 * motion // paw up in triumph
            fx.tail = Math.sin(now * 14) * 0.7
          }
        }
      }

      // jump while the market is up (only once Pori has arrived)
      let jumpY = 0
      let stretch = 1
      let armLift = 0
      if (state === 'rise' && motion && !moving) {
        const u = (now - stateSince + 0.2) % 2.7
        if (u < 0.2) {
          stretch = 1 - 0.1 * Math.sin((u / 0.2) * Math.PI * 0.5)
        } else if (u < 0.82) {
          const a = (u - 0.2) / 0.62
          jumpY = 0.5 * 4 * a * (1 - a)
          stretch = 1 + 0.07 * Math.abs(Math.cos(a * Math.PI))
          armLift = Math.sin(a * Math.PI) * 1.25
        } else if (u < 1.3) {
          const b = (u - 0.82) / 0.48
          stretch = 1 - 0.11 * Math.sin(b * Math.PI * 2.5) * (1 - b) ** 2
        }
      }
      live.jumpY = damp(live.jumpY, jumpY, 30, dt)
      live.stretch = damp(live.stretch, stretch, 26, dt)
      // held: surprised first ("어?"), then delighted. Refused over water: shakes head with a frown.
      const heldFor = lift.active ? now - lift.liftedAt : -1
      const refusing = now < lift.refusedAt + 1.0 && now > lift.refusedAt - 0.7
      live.armLift = damp(live.armLift, lift.active ? 1.3 + Math.sin(now * 9) * 0.15 * motion : armLift, 14, dt)

      const sinceTouch = now - touchRef.current.at
      const happyTarget = lift.active ? (heldFor >= 0.55 ? 1 : 0) : (sinceTouch < 1.5 || fx.cheer) && state !== 'closed' ? 1 : 0
      live.happy = damp(live.happy, happyTarget, lift.active ? 10 : 14, dt)
      live.focus = damp(live.focus, refusing ? 1 : fx.focus, refusing ? 12 : 8, dt)
      live.surprise = damp(live.surprise, lift.active ? (heldFor < 0.55 ? 1 : 0) : fx.surprise, 14, dt)
      live.headYaw = damp(live.headYaw, fx.headYaw + (refusing ? Math.sin(now * 20) * 0.55 : 0), refusing ? 30 : 7, dt)
      const touchBounce = sinceTouch < 0.9 ? Math.sin(sinceTouch * 16) * Math.exp(-sinceTouch * 5) * 0.09 * motion : 0
      live.yaw = damp(live.yaw, state === 'loading' ? Math.sin(now * 1.6) * 0.4 * motion : 0, 5, dt)

      if (blinkStart < 0 && now > nextBlink) blinkStart = now
      let blink = 0
      if (blinkStart >= 0) {
        const b = (now - blinkStart) / 0.16
        blink = b >= 1 ? 0 : Math.sin(b * Math.PI)
        if (b >= 1) {
          blinkStart = -1
          nextBlink = now + 2.2 + Math.random() * 2.6
        }
      }
      const breathe = Math.sin(now * (state === 'closed' ? 1.15 : state === 'fall' ? 1.5 : 2.1)) * (1 + pose.sleep * 1.4) * motion
      const stride = Math.sin(walker.phase)

      const sy = live.stretch * (1 - pose.squash) * (1 + touchBounce)
      const sxz = 1 / Math.sqrt(sy)
      // just set down: a little squash-and-bounce
      const sinceLand = now - lift.landedAt
      const landBounce = sinceLand < 0.6 ? Math.sin(sinceLand * 18) * Math.exp(-sinceLand * 7) * 0.16 * motion : 0
      const liftY = lift.height * 0.85
      // dangling in the hand: swings a little side to side
      const dangle = lift.height * Math.sin(now * 4.2) * 0.14 * motion
      pori.root.position.set(
        walker.x,
        GROUND_Y + liftY + (live.jumpY + fx.hop + Math.abs(stride) * 0.12 * live.walk) * PORI_SCALE,
        walker.z,
      )
      pori.root.scale.set(sxz * PORI_SCALE * (1 + landBounce * 0.5), sy * PORI_SCALE * (1 - landBounce), sxz * PORI_SCALE * (1 + landBounce * 0.5))
      pori.root.rotation.set(fx.lean + lift.height * 0.08, walker.heading, stride * 0.07 * live.walk + dangle)
      pori.torso.scale.y = 1 + breathe * 0.014
      pori.torso.scale.x = 1 - breathe * 0.006
      pori.head.position.y = 1.5 - pose.headDrop + breathe * 0.012
      pori.head.rotation.set(pose.headPitch + fx.head + breathe * 0.012 * pose.sleep, live.yaw + live.headYaw, pose.headRoll + (fx.bite ? 0.12 : 0))
      const armAngle = pose.arm * (1 - live.walk * 0.45) + live.armLift + live.happy * 0.5 + breathe * 0.03
      rod.visible = fx.active
      rod.rotation.x = fx.rod
      pori.arms.forEach((arm, index) => {
        const side = index === 0 ? -1 : 1
        let angle = side * armAngle
        // the rod hand rises as the rod swings back; the other paw joins in when reeling
        if (fx.active && index === 1) angle = 1.15 + (1.0 - fx.rod) * 0.45
        if (fx.active && index === 0 && fx.leftArm !== null) angle = -fx.leftArm
        arm.rotation.z = angle
        arm.rotation.x = -0.15 - live.armLift * 0.2 + Math.sin(walker.phase + index * Math.PI) * 0.7 * live.walk
      })
      pori.feet.forEach((foot, index) => {
        const swing = Math.sin(walker.phase + index * Math.PI)
        // held: little legs kick in the air
        const kick = lift.height * Math.sin(now * 11 + index * Math.PI) * 0.1 * motion
        foot.position.y = 0.15 + Math.max(0, swing) * 0.16 * live.walk - lift.height * 0.06 + kick
        foot.position.z = 0.14 + swing * 0.14 * live.walk + kick * 0.6
      })
      pori.tail.rotation.z = -1.05 - pose.tail * 0.5 - live.armLift * 0.25 + Math.sin(now * 2.4) * 0.09 * motion + fx.tail * 0.4 * motion
      pori.tail.rotation.y = Math.sin(now * 1.2 + walker.phase) * 0.15 * motion
      const earWiggle = Math.max(0, Math.sin(now * 0.9 + 1)) ** 12 * 0.12 * motion
      pori.ears[0].rotation.z = 0.3 + earWiggle
      pori.ears[1].rotation.z = -0.3 - earWiggle

      const asleep = pose.sleep * (1 - live.happy)
      const open = 1 - live.happy
      const eyeOpen = Math.max(0, 1 - live.happy - asleep)
      const eyeWide = 1 + live.surprise * 0.25
      const squint = 1 - live.focus * 0.5
      pori.eyes.forEach((eye) => {
        eye.scale.set(
          Math.max(eyeOpen * eyeWide, 0.001),
          Math.max(eyeOpen * eyeWide * squint * (1 - blink * 0.92), 0.001),
          Math.max(eyeOpen, 0.001),
        )
      })
      const lidded = Math.max(live.happy, asleep, 0.001)
      pori.happyEyes.forEach((eye) => {
        eye.scale.set(lidded, lidded * (1 - 2 * asleep), lidded)
        eye.position.y = eye.userData.baseY - 0.05 * asleep
      })
      pori.brows.forEach((brow, index) => {
        const side = index === 0 ? -1 : 1
        brow.position.y = pose.brow + live.happy * 0.03 - live.focus * 0.025 + live.surprise * 0.05
        brow.rotation.z = -side * (pose.browTilt * (1 - live.focus) - 0.38 * live.focus)
      })
      const pursed = Math.max(live.focus, live.surprise)
      pori.mouth.scale.set(
        (0.85 + Math.abs(pose.mouth) * 0.15) * Math.max(open, 0.001) * (1 - pursed * 0.45),
        pose.mouth * Math.max(open, 0.001) * (1 - pursed * 0.8),
        1,
      )
      pori.openMouth.scale.setScalar(Math.max(live.happy, 0.001))
      pori.cheeks.forEach((cheek) => cheek.scale.setScalar(1 + live.happy * 0.18))

      // --- boats ---
      boats.forEach((boat) => {
        // null = this part of the island isn't open yet: the boat stays out of sight
        boat.present = damp(boat.present ?? 0, input[boat.key] === null ? 0 : 1, 1.5, dt)
        boat.outer.visible = boat.present > 0.02
        boat.flow = damp(boat.flow, THREE.MathUtils.clamp(input[boat.key] ?? 0, -1, 1), 1.1, dt)
        const arrive = THREE.MathUtils.smoothstep(boat.flow, -1, 1)
        const x = THREE.MathUtils.lerp(boat.away.x, boat.berth.x, arrive)
        const z = THREE.MathUtils.lerp(boat.away.z, boat.berth.z, arrive)
        const inward = Math.atan2(-(boat.berth.z - boat.away.z), boat.berth.x - boat.away.x)
        const headingTarget = boat.flow >= -0.08 ? (arrive > 0.9 ? Math.PI : inward) : inward + Math.PI
        boat.heading = dampAngle(boat.heading, headingTarget, 2, dt)
        const slope = (waveHeight(x * 0.75 + 0.3, z * 0.75, waveTime, rough) - waveHeight(x * 0.75 - 0.3, z * 0.75, waveTime, rough)) * SWELL / 0.6
        boat.outer.position.set(x, seaLevel + waveHeight(x * 0.75, z * 0.75, waveTime, rough) * SWELL - 0.02, z)
        boat.outer.rotation.y = boat.heading
        boat.outer.scale.setScalar(1.25 * Math.max(boat.present, 0.001))
        boat.tilt.rotation.z = Math.atan(slope) * 0.6 + Math.sin(now * 1.9 + boat.berth.z) * 0.035 * motion
        boat.tilt.rotation.x = Math.sin(now * 1.4 + boat.berth.z * 2) * (0.04 + rough * 0.12) * motion
        boat.crates.forEach((crate, index) => {
          const shown = boat.flow > 0.18 + index * 0.28 ? 1 : 0
          crate.scale.setScalar(Math.max(damp(crate.scale.x, shown, 6, dt), 0.001))
        })
        boat.pennant.rotation.y = (windDirection < 0 ? Math.PI : 0) - boat.heading
        boat.pennant.rotation.z = -(1 - windStrength) * 1.25 + Math.sin(now * 9 + boat.berth.z) * 0.14 * windStrength * motion

        // crew: buyers turn toward the island and the viewer and wave; sellers face the bow as the
        // ship heads out to sea, showing their backs. (Boat-local +x is the bow; the camera is off
        // the moored boats' -z side, so 3π/4 is "bow-ward, turned to the viewer".)
        const crew = boat.crew
        const buying = boat.flow > 0.15
        const selling = boat.flow < -0.15
        crew.turn = dampAngle(crew.turn, buying ? 2.35 : selling ? Math.PI / 2 : 2.0, 3, dt)
        crew.root.rotation.y = crew.turn
        crew.root.rotation.x = selling ? 0.18 : 0
        crew.root.position.y = crew.baseY
          + (buying ? Math.abs(Math.sin(now * 3.2 + boat.berth.z)) * 0.025 * motion : 0)
        crew.arm.rotation.z = buying ? 2.3 + Math.sin(now * 7 + boat.berth.z) * 0.45 * motion : selling ? 0.15 : 0.35
        // the other arm: spyglass raised / briefcase held up on a good day, hugged close on a bad one
        crew.hold.rotation.z = buying ? -0.9 : selling ? -0.05 : -0.35
        crew.hold.rotation.x = selling ? -0.5 : 0
      })

      // --- whales and fish ---
      const swimmer = (item, raw, index, { hopSize, depthSize, floor }) => {
        item.shown = damp(item.shown, Number.isFinite(raw) ? 1 : 0, 4, dt)
        item.level = damp(item.level, THREE.MathUtils.clamp(raw ?? 0, -1, 1), 1.4, dt)
        const mood = item.level
        const surface = seaLevel + waveHeight(item.x * 0.75, item.z * 0.75, waveTime, rough) * SWELL
        let hop = 0
        let pitch = mood < 0 ? mood * 0.5 : 0
        if (mood > 0.2 && motion) {
          const u = ((now + index * 1.3) % 3.2) / 1.05
          if (u < 1) {
            hop = Math.sin(u * Math.PI) * hopSize * (0.35 + 0.65 * mood)
            pitch = Math.cos(u * Math.PI) * 0.75 * mood
          }
        }
        item.hop = damp(item.hop, hop, 16, dt)
        item.pitch = damp(item.pitch, pitch, 9, dt)
        item.outer.position.set(
          item.x + Math.sin(now * 0.6 + index * 2) * 0.08 * motion,
          Math.max(floor, surface + 0.02 + (mood < 0 ? mood * depthSize : 0)) + item.hop,
          item.z,
        )
        item.outer.visible = item.shown > 0.02
        item.outer.scale.setScalar((item.size ?? 1.5) * Math.max(item.shown, 0.001))
        item.tilt.rotation.z = item.pitch + Math.sin(now * 1.6 + index) * 0.05 * motion
        return mood
      }
      whales.forEach((whale, index) => {
        const mood = swimmer(whale, input[whale.key], index, { hopSize: 0.9, depthSize: 0.32, floor: -0.9 })
        whale.spout = damp(whale.spout, mood > 0.2 ? 1 : 0, 5, dt)
        whale.drops.forEach((drop, dropIndex) => {
          const phase = motion ? (now * 0.9 + dropIndex / 3) % 1 : dropIndex / 3
          drop.position.set(0.12 + (dropIndex - 1) * 0.07 * phase, 0.24 + phase * 0.3, 0)
          drop.scale.setScalar(Math.max((1 - phase) * 0.05 * whale.spout, 0.001))
        })
      })
      school.forEach((item, index) => {
        const entry = input.fish?.[index]
        if (entry?.name) item.label.setText(entry.name)
        item.size = 2.0
        swimmer(item, entry?.name ? entry.level : null, index + 2, { hopSize: 0.6, depthSize: 0.18, floor: -0.7 })
        item.tail.rotation.y = Math.sin(now * 7 + index) * 0.45 * motion
      })

      // --- bottles: one per upcoming event, closer as the day nears ---
      bottles.forEach((item, index) => {
        const letter = input.letters?.[index]
        item.shown = damp(item.shown, letter ? 1 : 0, 2, dt)
        item.outer.visible = item.shown > 0.02
        if (!letter) return
        const far = THREE.MathUtils.clamp(letter.dday / 10, 0, 1)
        const targetX = THREE.MathUtils.lerp(BOTTLE_NEAR.x, BOTTLE_FAR.x, far) + index * 0.55
        const targetZ = THREE.MathUtils.lerp(BOTTLE_NEAR.z, BOTTLE_FAR.z, far) - index * 0.25
        item.x = damp(item.x, targetX, 0.8, dt)
        item.z = damp(item.z, targetZ, 0.8, dt)
        const drift = Math.sin(now * 0.5 + index * 2) * 0.12 * motion
        item.outer.position.set(item.x + drift, seaLevel + 0.02 + Math.sin(now * 1.8 + index) * 0.035 * motion, item.z)
        item.outer.scale.setScalar(2.4 * item.shown * (1.1 - far * 0.3))
        const pulse = (now * 0.6 + index * 0.33) % 1
        item.ripple.scale.setScalar(1 + pulse * 1.6)
        item.ripple.material.opacity = 0.65 * (1 - pulse)
        item.bottle.rotation.x = Math.sin(now * 1.3 + index) * 0.18 * motion
        item.outer.rotation.y = 0.6 + Math.sin(now * 0.4 + index) * 0.4
      })

      // --- fishing gear: bobber flies out on the cast, dunks on a bite; the catch leaps out on the line ---
      rodTip.getWorldPosition(tipWorld)
      const castPhase = fx.active && fishingState.phase === 'cast'
      bobber.visible = castPhase && fx.flight > 0
      if (bobber.visible) {
        if (fx.flight < 1) {
          // arc from the rod tip to where it lands
          if (fx.flight < 0.05) castFrom.copy(tipWorld)
          const f = fx.flight
          bobber.position.set(
            THREE.MathUtils.lerp(castFrom.x, BOBBER.x, f),
            THREE.MathUtils.lerp(castFrom.y, seaLevel + 0.02, f) + Math.sin(f * Math.PI) * 0.5,
            THREE.MathUtils.lerp(castFrom.z, BOBBER.z, f),
          )
        } else {
          const dunk = fx.bite ? Math.abs(Math.sin(now * 13)) * 0.08 : 0
          bobber.position.set(BOBBER.x, seaLevel + 0.02 + Math.sin(now * 2.4) * 0.02 * motion - dunk * motion, BOBBER.z)
        }
      }
      // splash when the bobber lands, and again when the fish is hooked
      const landing = castPhase && fx.flight >= 1 ? (now - fishingState.arrivedAt - CAST_END) : -1
      const splashAge = fx.hook >= 0 ? fx.hook : landing >= 0 && landing < 0.8 ? landing : -1
      splash.visible = splashAge >= 0 && splashAge < 0.8
      if (splash.visible) {
        splash.position.set(BOBBER.x, seaLevel + 0.03, BOBBER.z)
        splash.scale.setScalar(1 + splashAge * (fx.hook >= 0 ? 5 : 3))
        splashMaterial.opacity = (1 - splashAge / 0.8) * 0.8
      }
      catchFish.outer.visible = fx.active && fishingState.phase === 'caught'
      if (catchFish.outer.visible) {
        if (fishingInput.name && fishingInput.name !== fishingState.name) {
          fishingState.name = fishingInput.name
          catchFish.label.setText(fishingInput.name)
          catchFish.materials[0].color.set(fishingInput.color ?? '#ffcf5c')
        }
        // leaps out of the water in an arc, then dangles and swings under the rod tip
        const k = Math.min(fx.hook / 1.1, 1)
        const swing = k >= 1 ? Math.sin(now * 3) * 0.12 * motion : 0
        catchFish.outer.position.set(
          THREE.MathUtils.lerp(BOBBER.x, tipWorld.x, easeInOut(k)) + swing,
          THREE.MathUtils.lerp(seaLevel - 0.1, tipWorld.y - 0.45, k) + Math.sin(k * Math.PI) * 0.6,
          THREE.MathUtils.lerp(BOBBER.z, tipWorld.z, easeInOut(k)),
        )
        catchFish.tilt.rotation.z = Math.PI / 2 + Math.sin(now * (k < 1 ? 20 : 9)) * (k < 1 ? 0.5 : 0.25) * motion
        catchFish.tail.rotation.y = Math.sin(now * 18) * 0.6 * motion
      }
      // bite "!", catch "낚았다!", droplets at the hook, confetti around Pori
      const badgeY = GROUND_Y + 1.25 + fx.hop * PORI_SCALE
      biteBadge.visible = fx.active && fx.bite > 0 && fishingState.phase === 'cast'
      if (biteBadge.visible) {
        const pop = 0.32 + Math.abs(Math.sin(now * 10)) * 0.05
        biteBadge.position.set(walker.x, badgeY, walker.z)
        biteBadge.scale.set(pop, pop, 1)
      }
      const cheerAge = fx.hook - 0.9
      catchBadge.visible = fx.active && cheerAge >= 0 && cheerAge < 2.6
      if (catchBadge.visible) {
        const pop = Math.min(cheerAge / 0.18, 1) * (1 + Math.sin(Math.min(cheerAge / 0.35, 1) * Math.PI) * 0.25)
        catchBadge.position.set(walker.x, badgeY + 0.1 + cheerAge * 0.08, walker.z)
        catchBadge.scale.set(0.3 * catchBadge.userData.aspect * pop, 0.3 * pop, 1)
        catchBadge.material.opacity = cheerAge > 2.1 ? 1 - (cheerAge - 2.1) / 0.5 : 1
      }
      if (fx.active && fx.hook >= 0 && !fishingState.dropsSent) {
        fishingState.dropsSent = true
        burst(droplets, burstOrigin.set(BOBBER.x, seaLevel + 0.05, BOBBER.z), { speed: 1, up: 2.6, spread: 1.0, size: 1 })
      }
      if (fx.active && cheerAge >= 0 && fishingState.confettiSent < 1) {
        fishingState.confettiSent = 1
        burst(confetti, burstOrigin.set(walker.x, GROUND_Y + 0.75, walker.z), { speed: 1, up: 3.2, spread: 1.6, size: 1 })
      }
      if (fx.active && cheerAge >= 0.7 && fishingState.confettiSent < 2) {
        fishingState.confettiSent = 2
        burst(confetti, burstOrigin.set(walker.x, GROUND_Y + 0.75, walker.z), { speed: 0.8, up: 3.0, spread: 1.2, size: 0.8 })
      }
      stepParticles(confetti, dt, 5, 1.4)
      stepParticles(droplets, dt, 7, 0.9)

      fishingLine.visible = fx.active && (bobber.visible || catchFish.outer.visible)
      if (fishingLine.visible) {
        const end = catchFish.outer.visible ? catchFish.outer.position : bobber.position
        const positions = lineGeometry.attributes.position
        positions.setXYZ(0, tipWorld.x, tipWorld.y, tipWorld.z)
        positions.setXYZ(1, end.x, end.y + (catchFish.outer.visible ? 0.2 : 0.05), end.z)
        positions.needsUpdate = true
      }

      // --- lighthouse: flag in the wind, lamp and beam at night ---
      lighthouse.pennant.rotation.y = windDirection < 0 ? Math.PI : 0
      lighthouse.pennant.rotation.z = -(1 - windStrength) * 1.2 + Math.sin(now * 9) * 0.16 * windStrength * motion
      lighthouse.glass.emissiveIntensity = 0.25 + night * 1.6
      lighthouse.haloMaterial.opacity = night * (0.22 + Math.sin(now * 1.8) * 0.06 * motion)
      house.windowMaterial.emissiveIntensity = night * 1.2
      chest.open = damp(chest.open, input.selected === 'chest' ? 1 : 0, 6, dt)
      chest.lid.rotation.x = -chest.open * 1.9
      chest.sparkle.visible = Boolean(input.chestNew) && chest.open < 0.5
      chest.sparkle.rotation.y = now * 2 * motion
      chest.sparkle.position.y = 0.72 + Math.sin(now * 2.6) * 0.05 * motion

      streaks.forEach((streak, index) => {
        streak.phase = (streak.phase + dt * (0.08 + windStrength * 0.35) * motion) % 1
        streak.mesh.position.set(windDirection * (-8 + streak.phase * 16), streak.y + Math.sin(now * 1.3 + index) * 0.05 * motion, streak.z)
        streak.material.opacity = windStrength * 0.8 * Math.sin(streak.phase * Math.PI)
        streak.mesh.visible = windStrength > 0.06
      })

      // --- weather over the open sea ---
      const usLevel = input.overnight
      const skyKey = ['rise', 'flat', 'fall'].includes(state) && Number.isFinite(usLevel)
        ? (usLevel > 0.33 ? 'rise' : usLevel < -0.33 ? 'fall' : 'flat')
        : state
      const forecast = WEATHER[skyKey]
      for (const name of Object.keys(sky)) sky[name] = damp(sky[name], forecast[name], 6, dt)
      cloudColor.lerp(cloudTarget.set(forecast.cloudColor), 1 - Math.exp(-5 * dt))
      weather.materials.cloud.color.copy(cloudColor)
      const show = (group, amount) => {
        group.visible = amount > 0.02
        group.scale.setScalar(Math.max(amount, 0.001))
      }
      weather.root.position.y = 3.0 + Math.sin(now * 1.3) * 0.05 * motion
      show(weather.sun, sky.sun * (1 - sky.sunBehind * 0.18))
      weather.sun.position.set(-0.24 * sky.sunBehind, 0.2 * sky.sunBehind, -0.3 * sky.sunBehind)
      weather.rays.rotation.z = now * 0.35 * motion
      show(weather.cloud, sky.cloud)
      show(weather.rain, sky.rain)
      weather.drops.forEach((drop) => {
        const fallen = motion ? (now * 0.85 + drop.userData.phase) % 1 : drop.userData.phase
        const size = Math.sin(Math.min(fallen * 4, 1) * Math.PI * 0.5) * (1 - Math.max(0, fallen - 0.75) * 4)
        drop.position.set(drop.userData.x, -0.3 - fallen * 0.62, 0.02)
        drop.scale.set(0.042 * size, 0.07 * size, 0.042 * size)
      })
      show(weather.dots, sky.dots)
      weather.dotMeshes.forEach((dot, index) => {
        dot.position.y = Math.max(0, Math.sin(now * 4.2 - index * 0.75)) * 0.2 * motion
      })
      show(weather.bang, sky.bang)
      show(weather.moon, sky.moon)
      weather.stars.forEach((star, index) => {
        star.scale.setScalar(0.75 + Math.sin(now * 2.6 + index * 2.1) * 0.25 * motion)
        star.scale.y *= 1.5
      })

      // --- night ---
      skyColor.lerpColors(daySky, nightSky, night)
      // fog: no clear culprit today. The horizon closes in and the sky greys a little.
      fogAmount = damp(fogAmount, input.foggy ? 1 : 0, 1.2, dt)
      skyColor.lerp(fogTint, fogAmount * 0.4 * (1 - night * 0.6))
      scene.fog.color.copy(skyColor)
      scene.fog.near = view.distance - 3 + fogAmount * 1.5
      scene.fog.far = view.distance + 11 - fogAmount * 6
      sea.material.color.lerpColors(dayTint, nightTint, night)
      hemi.intensity = 1.6 - night * 0.7
      key.intensity = 1.55 - night * 0.9
      zzz.root.visible = night > 0.02
      zzz.letters.forEach((letter, index) => {
        const phase = (now * 0.3 * motion + index / 3) % 1
        const envelope = Math.sin(Math.min(phase * 5, 1) * Math.PI * 0.5) * (1 - THREE.MathUtils.smoothstep(phase, 0.72, 1))
        letter.position.set(
          walker.x + 0.1 + phase * 0.25 + Math.sin(phase * 7 + index) * 0.05,
          GROUND_Y + 1.05 + phase * 1.0,
          walker.z,
        )
        letter.rotation.z = 0.12 + Math.sin(now * 1.4 + index * 1.7) * 0.14 * motion
        letter.scale.setScalar((0.8 + phase * 1.1) * 0.5 * Math.max(night, 0.001))
        letter.userData.material.opacity = envelope * night
      })

      // --- camera ---
      // ease-out descent; snap to 0 once it's close so it doesn't creep forever
      if (descend > 0) descend = descend < 0.002 ? 0 : damp(descend, 0, 1.4, Math.min(dt, 0.05))
      view.yaw = damp(view.yaw, view.yawTarget, 6, dt)
      view.pitch = damp(view.pitch, view.pitchTarget, 6, dt)
      const point = selectionPoint(input.selected)
      view.zoom = damp(view.zoom, point ? 1 : 0, 3, dt)
      const goal = point ?? homeTarget
      lookPoint.x = damp(lookPoint.x, goal.x, 3, dt)
      lookPoint.y = damp(lookPoint.y, goal.y, 3, dt)
      lookPoint.z = damp(lookPoint.z, goal.z, 3, dt)
      placeCamera()

      // --- tap targets follow their objects ---
      placeHotspot('pori', walker.x, GROUND_Y + 0.45 + lift.height * 0.85, walker.z, true)
      placeHotspot('lighthouse', -1.6, 1.85, -1.4, true)
      placeHotspot('home', 1.45, GROUND_Y + 0.5, -1.35, true)
      placeHotspot('chest', CHEST_SPOT.x, GROUND_Y + 0.2, CHEST_SPOT.z, true)
      placeHotspot('bottles', bottles[0].outer.position.x, bottles[0].outer.position.y + 0.15, bottles[0].outer.position.z, bottles[0].shown > 0.5)
      placeHotspot('fishing', 4.6, GROUND_Y + 0.25, SPOTS.dock.z, !input.fishing && ['rise', 'flat', 'fall'].includes(state) && input.fish?.length > 0)
      placeHotspot('weather', weather.root.position.x, weather.root.position.y, weather.root.position.z, Number.isFinite(usLevel) && ['rise', 'flat', 'fall'].includes(state))
      boats.forEach((boat) => placeHotspot(boat.key, boat.outer.position.x, boat.outer.position.y + 0.4, boat.outer.position.z, boat.present > 0.5))
      whales.forEach((whale) => placeHotspot(whale.key, whale.outer.position.x, whale.outer.position.y + 0.15, whale.outer.position.z, whale.shown > 0.5))
      school.forEach((item, index) => placeHotspot(`fish${index}`, item.outer.position.x, item.outer.position.y + 0.1, item.outer.position.z, item.shown > 0.5))

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      unmounted = true
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      host.removeEventListener('pointerdown', onPointerDown)
      host.removeEventListener('pointermove', onPointerMove)
      host.removeEventListener('pointerup', onPointerUp)
      host.removeEventListener('pointercancel', onPointerUp)
      const disposed = new Set()
      scene.traverse((node) => {
        node.geometry?.dispose()
        const materials = Array.isArray(node.material) ? node.material : node.material ? [node.material] : []
        materials.forEach((material) => {
          if (disposed.has(material)) return
          disposed.add(material)
          material.map?.dispose()
          material.dispose()
        })
      })
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <>
      <div ref={hostRef} className="pori-island" role="img" aria-label={`포리의 섬. 포리는 지금 ${SPOTS[focus]?.name ?? '섬'}에 있어요`} />
      {onPick && (
        <div className="scene-hotspots">
          {HOTSPOTS.map(({ key: name, label, size, action }) => (
            <button
              key={name}
              ref={(element) => { hotspotRefs.current[name] = element }}
              type="button"
              className={`scene-hotspot ${action ? 'action' : ''}`}
              style={{ width: size, height: size, display: 'none' }}
              aria-label={label}
              title={action ? label : undefined}
              onClick={() => { if (liftApi.current?.clickAllowed?.() !== false) onPick(name) }}
              {...(name === 'pori' ? {
                onPointerDown: (event) => liftApi.current?.down(event),
                onPointerMove: (event) => liftApi.current?.move(event),
                onPointerUp: (event) => liftApi.current?.up(event),
                onPointerCancel: (event) => liftApi.current?.up(event),
              } : {})}
            >
              {action && <span aria-hidden="true">{action}</span>}
            </button>
          ))}
        </div>
      )}
    </>
  )
}
