import { useEffect, useRef } from 'react'
import * as THREE from 'three'

export const COLORS = {
  cream: '#fff6e8',
  mint: '#9eecda',
  white: '#fffaf3',
  dark: '#3b2f2d',
  pink: '#ffab9f',
  tongue: '#ff8e9e',
}

// Pose each market state settles into. Everything is eased toward these values,
// so switching states blends instead of snapping.
export const POSES = {
  rise: { arm: 1.15, headPitch: -0.06, headRoll: 0, headDrop: 0, brow: 0.05, browTilt: 0, mouth: 1.15, tail: 0.35, squash: 0, sleep: 0 },
  flat: { arm: 0.85, headPitch: 0, headRoll: 0, headDrop: 0, brow: 0, browTilt: 0, mouth: 1, tail: 0, squash: 0, sleep: 0 },
  fall: { arm: 0.42, headPitch: 0.2, headRoll: 0.04, headDrop: 0.05, brow: -0.015, browTilt: 0.42, mouth: -0.9, tail: -0.5, squash: 0.035, sleep: 0 },
  closed: { arm: 0.5, headPitch: 0.15, headRoll: 0.2, headDrop: 0.04, brow: -0.012, browTilt: 0, mouth: 0.45, tail: -0.45, squash: 0.03, sleep: 1 },
  loading: { arm: 0.8, headPitch: -0.04, headRoll: 0, headDrop: 0, brow: 0.03, browTilt: 0, mouth: 0.55, tail: 0.1, squash: 0, sleep: 0 },
  error: { arm: 0.7, headPitch: 0, headRoll: 0.17, headDrop: 0, brow: 0.06, browTilt: 0.12, mouth: 0.3, tail: -0.2, squash: 0, sleep: 0 },
}

const HEAD_RADII = new THREE.Vector3(0.98, 0.84, 0.86)
const HEAD_CENTER_Y = 0.62

const damp = (current, target, lambda, dt) => THREE.MathUtils.damp(current, target, lambda, dt)

function ellipsoid(material, sx, sy, sz, segments = 48) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, segments, Math.round(segments * 0.75)), material)
  mesh.scale.set(sx, sy, sz)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// An anchor sitting on the head's surface at (x, y), facing along the surface normal,
// so face parts follow the curve of the head instead of floating in front of it.
function headAnchor(x, y, lift = 0) {
  const dy = y - HEAD_CENTER_Y
  const inside = 1 - (x / HEAD_RADII.x) ** 2 - (dy / HEAD_RADII.y) ** 2
  const z = HEAD_RADII.z * Math.sqrt(Math.max(inside, 0.01))
  const normal = new THREE.Vector3(x / HEAD_RADII.x ** 2, dy / HEAD_RADII.y ** 2, z / HEAD_RADII.z ** 2).normalize()
  const anchor = new THREE.Group()
  anchor.position.set(x, y, z).addScaledVector(normal, lift)
  anchor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)
  return anchor
}

function arc(material, radius, tube, angle) {
  const mesh = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 10, 28, angle), material)
  mesh.rotation.z = (Math.PI - angle) / 2
  mesh.position.y = -radius
  return mesh
}

export function buildPori() {
  const mat = {
    cream: new THREE.MeshStandardMaterial({ color: COLORS.cream, roughness: 0.82 }),
    mint: new THREE.MeshStandardMaterial({ color: COLORS.mint, roughness: 0.8 }),
    white: new THREE.MeshStandardMaterial({ color: COLORS.white, roughness: 0.85 }),
    dark: new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.28 }),
    pink: new THREE.MeshStandardMaterial({ color: COLORS.pink, roughness: 0.9 }),
    tongue: new THREE.MeshStandardMaterial({ color: COLORS.tongue, roughness: 0.6 }),
    shine: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
  }

  const root = new THREE.Group()

  // --- body ---
  const torso = new THREE.Group()
  torso.position.y = 0.95
  torso.add(ellipsoid(mat.cream, 0.62, 0.7, 0.56))
  const belly = ellipsoid(mat.mint, 0.4, 0.45, 0.2)
  belly.position.set(0, -0.06, 0.4)
  belly.castShadow = false
  torso.add(belly)
  root.add(torso)

  const feet = [-1, 1].map((side) => {
    const foot = ellipsoid(mat.cream, 0.23, 0.15, 0.3)
    foot.position.set(side * 0.3, 0.15, 0.14)
    foot.rotation.y = side * 0.18
    root.add(foot)
    return foot
  })

  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group()
    pivot.position.set(side * 0.5, 1.22, 0.06)
    const arm = ellipsoid(mat.cream, 0.15, 0.3, 0.15)
    arm.position.y = -0.22
    pivot.add(arm)
    root.add(pivot)
    return pivot
  })

  const tail = new THREE.Group()
  tail.position.set(0.3, 0.52, -0.3)
  const tailBase = new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.62, 12, 28), mat.cream)
  tailBase.position.y = 0.4
  const tailTip = new THREE.Mesh(new THREE.CapsuleGeometry(0.156, 0.14, 12, 28), mat.mint)
  tailTip.position.y = 0.66
  for (const part of [tailBase, tailTip]) {
    part.castShadow = true
    part.receiveShadow = true
    tail.add(part)
  }
  tail.rotation.set(-0.45, 0, -1.05)
  root.add(tail)

  // --- head ---
  const head = new THREE.Group()
  head.position.y = 1.5
  const skull = ellipsoid(mat.cream, HEAD_RADII.x, HEAD_RADII.y, HEAD_RADII.z, 64)
  skull.position.y = HEAD_CENTER_Y
  head.add(skull)

  const ears = [-1, 1].map((side) => {
    const ear = new THREE.Group()
    ear.position.set(side * 0.72, 1.24, -0.02)
    ear.rotation.z = -side * 0.3
    ear.add(ellipsoid(mat.cream, 0.27, 0.27, 0.17))
    const inner = ellipsoid(mat.mint, 0.15, 0.15, 0.07)
    inner.position.set(-side * 0.02, -0.02, 0.12)
    inner.castShadow = false
    ear.add(inner)
    head.add(ear)
    return ear
  })

  const muzzle = ellipsoid(mat.white, 0.37, 0.26, 0.22)
  muzzle.position.set(0, 0.46, 0.7)
  muzzle.castShadow = false
  head.add(muzzle)

  const nose = ellipsoid(mat.dark, 0.11, 0.075, 0.07)
  nose.position.set(0, 0.555, 0.915)
  nose.castShadow = false
  head.add(nose)

  // smile: a tube along a shallow curve; flipping scale.y turns it into a frown
  const mouth = new THREE.Group()
  mouth.position.set(0, 0.4, 0.945)
  const smileCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.125, 0.034, -0.03),
    new THREE.Vector3(-0.065, -0.026, -0.006),
    new THREE.Vector3(0, -0.046, 0.002),
    new THREE.Vector3(0.065, -0.026, -0.006),
    new THREE.Vector3(0.125, 0.034, -0.03),
  ])
  const smile = new THREE.Mesh(new THREE.TubeGeometry(smileCurve, 32, 0.024, 10), mat.dark)
  for (const end of [smileCurve.getPoint(0), smileCurve.getPoint(1)]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.024, 12, 10), mat.dark)
    cap.position.copy(end)
    smile.add(cap)
  }
  mouth.add(smile)
  head.add(mouth)

  const openMouth = new THREE.Group()
  openMouth.position.set(0, 0.385, 0.925)
  openMouth.add(ellipsoid(mat.dark, 0.11, 0.115, 0.035))
  const tongue = ellipsoid(mat.tongue, 0.065, 0.05, 0.025)
  tongue.position.set(0, -0.05, 0.022)
  openMouth.add(tongue)
  openMouth.traverse((node) => { node.castShadow = false })
  openMouth.scale.setScalar(0.001)
  head.add(openMouth)

  const eyes = []
  const happyEyes = []
  const brows = []
  const cheeks = []
  for (const side of [-1, 1]) {
    const eye = headAnchor(side * 0.37, 0.69, 0.004)
    const pupil = ellipsoid(mat.dark, 0.098, 0.128, 0.045)
    pupil.castShadow = false
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), mat.shine)
    shine.position.set(-0.03, 0.045, 0.04)
    const shineSmall = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), mat.shine)
    shineSmall.position.set(0.035, -0.04, 0.04)
    eye.add(pupil, shine, shineSmall)
    head.add(eye)
    eyes.push(eye)

    const happy = headAnchor(side * 0.37, 0.69, 0.012)
    happy.add(arc(mat.dark, 0.1, 0.02, 2.1))
    happy.children[0].position.y = -0.06
    happy.scale.setScalar(0.001)
    happy.userData.baseY = happy.position.y
    head.add(happy)
    happyEyes.push(happy)

    const brow = headAnchor(side * 0.38, 0.96, 0.01)
    const browPivot = new THREE.Group()
    browPivot.add(arc(mat.dark, 0.14, 0.021, 0.95))
    browPivot.children[0].position.y = -0.14
    brow.add(browPivot)
    head.add(brow)
    brows.push(browPivot)

    const cheek = headAnchor(side * 0.63, 0.49, -0.012)
    const blush = ellipsoid(mat.pink, 0.135, 0.078, 0.02)
    blush.castShadow = false
    cheek.add(blush)
    head.add(cheek)
    cheeks.push(cheek)
  }

  root.add(head)

  return { root, torso, feet, arms, tail, head, ears, mouth, openMouth, eyes, happyEyes, brows, cheeks, materials: mat }
}

// Weather pieces and cloud tint. rise/flat/fall are picked by the overnight US market when known
// (sunny / partly cloudy / rain); otherwise, and for closed/loading/error, by the market state.
export const WEATHER = {
  rise: { sun: 1, cloud: 0, rain: 0, dots: 0, bang: 0, sunBehind: 0, moon: 0, cloudColor: '#ffffff' },
  flat: { sun: 1, cloud: 1, rain: 0, dots: 0, bang: 0, sunBehind: 1, moon: 0, cloudColor: '#ffffff' },
  fall: { sun: 0, cloud: 1, rain: 1, dots: 0, bang: 0, sunBehind: 0, moon: 0, cloudColor: '#d3dff0' },
  closed: { sun: 0, cloud: 0, rain: 0, dots: 0, bang: 0, sunBehind: 0, moon: 1, cloudColor: '#ffffff' },
  loading: { sun: 0, cloud: 0, rain: 0, dots: 1, bang: 0, sunBehind: 0, moon: 0, cloudColor: '#ffffff' },
  error: { sun: 0, cloud: 1, rain: 0, dots: 0, bang: 1, sunBehind: 0, moon: 0, cloudColor: '#e3e1e6' },
}

export function buildWeather() {
  const mat = {
    sun: new THREE.MeshStandardMaterial({ color: '#ffd35a', roughness: 0.7, emissive: '#ff9d00', emissiveIntensity: 0.28 }),
    ray: new THREE.MeshStandardMaterial({ color: '#ffb648', roughness: 0.7, emissive: '#ff8a00', emissiveIntensity: 0.22 }),
    cloud: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92 }),
    drop: new THREE.MeshStandardMaterial({ color: '#6db8f2', roughness: 0.35 }),
    dot: new THREE.MeshStandardMaterial({ color: COLORS.mint, roughness: 0.8 }),
    bang: new THREE.MeshStandardMaterial({ color: '#ff8a7a', roughness: 0.7 }),
  }
  const plain = (geometry, material) => new THREE.Mesh(geometry, material)
  const root = new THREE.Group()

  const sun = new THREE.Group()
  sun.add(plain(new THREE.SphereGeometry(0.3, 40, 30), mat.sun))
  const rays = new THREE.Group()
  for (let i = 0; i < 8; i += 1) {
    const ray = plain(new THREE.CapsuleGeometry(0.045, 0.1, 8, 16), mat.ray)
    const angle = (i / 8) * Math.PI * 2
    ray.position.set(Math.cos(angle) * 0.46, Math.sin(angle) * 0.46, 0)
    ray.rotation.z = angle - Math.PI / 2
    rays.add(ray)
  }
  sun.add(rays)
  root.add(sun)

  const cloud = new THREE.Group()
  const puffs = [
    [0, 0, 0, 0.3], [-0.3, -0.06, 0.02, 0.22], [0.31, -0.07, 0, 0.23],
    [0.12, 0.15, -0.02, 0.24], [-0.13, 0.12, 0.03, 0.2], [0, -0.1, 0.1, 0.22],
  ]
  for (const [x, y, z, r] of puffs) {
    const puff = plain(new THREE.SphereGeometry(r, 32, 24), mat.cloud)
    puff.position.set(x, y, z)
    cloud.add(puff)
  }
  root.add(cloud)

  const rain = new THREE.Group()
  const drops = [-0.3, -0.1, 0.1, 0.3, 0].map((x, index) => {
    const drop = plain(new THREE.SphereGeometry(1, 16, 12), mat.drop)
    drop.userData = { x, phase: index * 0.37 }
    rain.add(drop)
    return drop
  })
  root.add(rain)

  const dots = new THREE.Group()
  const dotMeshes = [-0.27, 0, 0.27].map((x) => {
    const dot = plain(new THREE.SphereGeometry(0.105, 24, 18), mat.dot)
    dot.position.x = x
    dots.add(dot)
    return dot
  })
  root.add(dots)

  const bang = new THREE.Group()
  const bar = plain(new THREE.CapsuleGeometry(0.06, 0.2, 8, 20), mat.bang)
  bar.position.y = 0.09
  const point = plain(new THREE.SphereGeometry(0.068, 20, 16), mat.bang)
  point.position.y = -0.2
  bang.add(bar, point)
  bang.position.set(0.02, 0, 0.36)
  root.add(bang)

  mat.moon = new THREE.MeshStandardMaterial({ color: '#ffe9a6', roughness: 0.75, emissive: '#ffcf5c', emissiveIntensity: 0.38 })
  mat.crater = new THREE.MeshStandardMaterial({ color: '#f3d27c', roughness: 0.8, emissive: '#e0a93c', emissiveIntensity: 0.25 })
  mat.star = new THREE.MeshStandardMaterial({ color: '#fff4c4', roughness: 0.6, emissive: '#ffe27a', emissiveIntensity: 0.7 })
  const moon = new THREE.Group()
  moon.add(plain(new THREE.SphereGeometry(0.29, 40, 30), mat.moon))
  for (const [x, y, r] of [[-0.09, 0.08, 0.07], [0.1, -0.05, 0.05], [-0.03, -0.13, 0.035]]) {
    const crater = plain(new THREE.SphereGeometry(r, 20, 14), mat.crater)
    crater.scale.z = 0.25
    crater.position.set(x, y, Math.sqrt(0.29 ** 2 - x * x - y * y) - 0.005)
    crater.lookAt(x * 2, y * 2, crater.position.z * 2)
    moon.add(crater)
  }
  const stars = [[-0.52, 0.2, 0.07], [0.45, 0.3, 0.05], [-0.36, -0.36, 0.045]].map(([x, y, r]) => {
    const star = plain(new THREE.OctahedronGeometry(r), mat.star)
    star.position.set(x, y, 0)
    star.scale.y = 1.5
    moon.add(star)
    return star
  })
  root.add(moon)

  return { root, sun, rays, cloud, rain, drops, dots, dotMeshes, bang, moon, stars, materials: mat }
}

// A little clay sailboat. One per investor group; the sail colour tells them apart.
export function buildBoat(sailColor) {
  const materials = {
    hull: new THREE.MeshStandardMaterial({ color: '#f1c9a0', roughness: 0.75 }),
    deck: new THREE.MeshStandardMaterial({ color: '#fff3e2', roughness: 0.8 }),
    sail: new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.7, side: THREE.DoubleSide }),
    crate: new THREE.MeshStandardMaterial({ color: '#d9a066', roughness: 0.8 }),
  }
  const shadowed = (mesh) => {
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }
  const outer = new THREE.Group() // position + heading
  const tilt = new THREE.Group() // rocking on the waves
  outer.add(tilt)

  const hull = shadowed(new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), materials.hull))
  hull.scale.set(0.48, 0.21, 0.25)
  const deck = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), materials.deck))
  deck.scale.set(0.38, 0.04, 0.19)
  deck.position.y = 0.11
  const mast = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.66, 10), materials.deck))
  mast.position.set(0.06, 0.45, 0)
  const sail = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.5, 3), materials.sail))
  sail.scale.z = 0.16
  sail.position.set(0.06, 0.5, 0)
  const flag = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.04, 14, 10), materials.sail))
  flag.position.set(0.06, 0.8, 0)
  // pennant at the mast top: streams with the wind (exchange rate), hangs limp when calm
  const pennant = new THREE.Group()
  pennant.position.set(0.06, 0.79, 0)
  const cloth = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 3), materials.sail))
  cloth.rotation.z = -Math.PI / 2
  cloth.scale.z = 0.12
  cloth.position.x = 0.11
  pennant.add(cloth)
  tilt.add(hull, deck, mast, sail, flag, pennant)

  // cargo appears as the group buys more
  const crates = [[-0.27, 0.19], [-0.13, 0.19], [-0.2, 0.32]].map(([x, y]) => {
    const crate = shadowed(new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.125, 0.125), materials.crate))
    crate.position.set(x, y, 0)
    crate.scale.setScalar(0.001)
    tilt.add(crate)
    return crate
  })

  return { outer, tilt, crates, pennant, materials: Object.values(materials), flow: 0, heading: 0, x: null }
}

// Small name tag that always faces the camera.
export function buildLabel(text) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const context = canvas.getContext('2d')
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite = new THREE.Sprite(material)
  sprite.scale.set(0.5, 0.19, 1)
  sprite.renderOrder = 5
  const label = { sprite, material, texture, text: null }
  label.setText = (next) => {
    if (next === label.text) return
    label.text = next
    context.clearRect(0, 0, 256, 96)
    context.fillStyle = 'rgba(255,255,255,0.94)'
    context.beginPath()
    context.roundRect(6, 8, 244, 80, 40)
    context.fill()
    context.fillStyle = '#2c3440'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    // long names shrink to fit the tag
    let size = 42
    do {
      context.font = `800 ${size}px Pretendard, system-ui, sans-serif`
      size -= 2
    } while (context.measureText(next).width > 216 && size > 22)
    context.fillText(next, 128, 50)
    texture.needsUpdate = true
  }
  label.setText(text)
  return label
}

// A small clay fish for one of today's most-moved stocks. All fish look alike; only the name tag changes.
export function buildFish(color) {
  const materials = {
    body: new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
    eye: new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.4 }),
  }
  const part = (material, sx, sy, sz, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), material)
    mesh.scale.set(sx, sy, sz)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
  }
  const outer = new THREE.Group()
  const tilt = new THREE.Group() // head is +x
  outer.add(tilt)
  const tail = new THREE.Group()
  tail.position.x = -0.15
  tail.add(part(materials.body, 0.07, 0.035, 0.02, -0.06, 0.05, 0), part(materials.body, 0.07, 0.035, 0.02, -0.06, -0.05, 0))
  tail.children[0].rotation.z = -0.6
  tail.children[1].rotation.z = 0.6
  tilt.add(
    part(materials.body, 0.18, 0.115, 0.075, 0, 0, 0),
    part(materials.body, 0.06, 0.03, 0.02, -0.01, 0.12, 0),
    tail,
    part(materials.eye, 0.02, 0.02, 0.02, 0.1, 0.025, 0.062),
    part(materials.eye, 0.02, 0.02, 0.02, 0.1, 0.025, -0.062),
  )
  const label = buildLabel('')
  label.sprite.scale.set(0.44, 0.165, 1)
  label.sprite.position.set(0, 0.3, 0)
  outer.add(label.sprite)
  return {
    outer, tilt, tail, label,
    materials: [...Object.values(materials), label.material],
    level: 0, shown: 0, hop: 0, pitch: 0,
  }
}

// A clay whale for one heavyweight stock: leaps when the stock is up, sinks nose-down when it falls.
export function buildWhale(color, name) {
  const materials = {
    body: new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
    belly: new THREE.MeshStandardMaterial({ color: '#fdf6ec', roughness: 0.8 }),
    eye: new THREE.MeshStandardMaterial({ color: COLORS.dark, roughness: 0.4 }),
    spout: new THREE.MeshStandardMaterial({ color: '#e4f6ff', roughness: 0.4 }),
  }
  const part = (material, sx, sy, sz, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), material)
    mesh.scale.set(sx, sy, sz)
    mesh.position.set(x, y, z)
    mesh.castShadow = true
    return mesh
  }
  const outer = new THREE.Group() // position + facing
  const tilt = new THREE.Group() // pitch while leaping or sinking; head is +x
  outer.add(tilt)
  tilt.add(
    part(materials.body, 0.36, 0.23, 0.24, 0, 0, 0),
    part(materials.belly, 0.3, 0.15, 0.2, 0.04, -0.09, 0),
    part(materials.body, 0.17, 0.07, 0.08, -0.36, 0.03, 0),
    part(materials.body, 0.1, 0.03, 0.09, -0.52, 0.09, 0.09),
    part(materials.body, 0.1, 0.03, 0.09, -0.52, 0.09, -0.09),
    part(materials.body, 0.09, 0.03, 0.06, 0.08, -0.12, 0.21),
    part(materials.body, 0.09, 0.03, 0.06, 0.08, -0.12, -0.21),
    part(materials.eye, 0.026, 0.026, 0.026, 0.22, 0.03, 0.2),
    part(materials.eye, 0.026, 0.026, 0.026, 0.22, 0.03, -0.2),
  )
  const drops = [0, 1, 2].map(() => {
    const drop = part(materials.spout, 0.04, 0.04, 0.04, 0.12, 0.24, 0)
    drop.castShadow = false
    tilt.add(drop)
    return drop
  })
  const label = buildLabel(name)
  label.sprite.position.set(0, 0.52, 0)
  outer.add(label.sprite)
  return {
    outer, tilt, drops, label,
    materials: [...Object.values(materials), label.material],
    level: 0, shown: 0, hop: 0, pitch: 0, spout: 0,
  }
}

// Streaks drifting across the sky: the wind (exchange rate).
function buildWind() {
  const root = new THREE.Group()
  const streaks = [[2.75, 0.34, 0], [3.2, 0.5, 0.37], [3.62, 0.3, 0.71], [4.02, 0.42, 0.18]].map(([y, length, phase]) => {
    const material = new THREE.MeshBasicMaterial({ color: '#7cc3cf', transparent: true, opacity: 0, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, length, 6, 12), material)
    mesh.rotation.z = Math.PI / 2
    root.add(mesh)
    return { mesh, material, y, phase }
  })
  return { root, streaks }
}

// A striped swim ring Pori wears when the water gets rough.
function buildSwimRing() {
  const materials = [
    new THREE.MeshStandardMaterial({ color: '#ff8f7d', roughness: 0.55 }),
    new THREE.MeshStandardMaterial({ color: '#fffaf3', roughness: 0.55 }),
  ]
  const ring = new THREE.Group()
  const hoop = new THREE.Group()
  const segments = 8
  for (let i = 0; i < segments; i += 1) {
    const piece = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.17, 22, 14, (Math.PI * 2) / segments + 0.01), materials[i % 2])
    piece.rotation.z = (i / segments) * Math.PI * 2
    piece.castShadow = true
    piece.receiveShadow = true
    hoop.add(piece)
  }
  hoop.rotation.x = Math.PI / 2
  ring.add(hoop)
  ring.position.y = 1.0
  ring.scale.setScalar(0.001)
  return { ring, materials }
}

// Three clay "Z"s that drift up from a sleeping Pori.
export function buildZzz() {
  const root = new THREE.Group()
  const letters = [0, 1, 2].map(() => {
    const material = new THREE.MeshStandardMaterial({
      color: '#f3f1ff', roughness: 0.7, emissive: '#a9afff', emissiveIntensity: 0.55, transparent: true, opacity: 0,
    })
    const letter = new THREE.Group()
    const bar = (length, x, y, angle) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.034, length, 8, 14), material)
      mesh.position.set(x, y, 0)
      mesh.rotation.z = angle
      letter.add(mesh)
    }
    bar(0.2, 0, 0.12, Math.PI / 2)
    bar(0.3, 0, 0, -0.69)
    bar(0.2, 0, -0.12, Math.PI / 2)
    letter.userData.material = material
    root.add(letter)
    return letter
  })
  return { root, letters }
}

const WATER_FRONT_Z = 1.7
const WATER_DEPTH = 3.4 // front to back; kept shallow so the waterline reads as a level
const WATER_MIN = 0.1
const WATER_MAX = 2.0
const FLOAT_DEPTH = 1.0 // water this deep lifts Pori off the floor

// `rough` (0..1) is the day's volatility: taller swell plus short, fast chop on top.
export const waveHeight = (x, z, t, rough = 0) =>
  (0.034 * Math.sin(x * 1.5 + t * 1.3)
    + 0.02 * Math.sin(x * 3.1 - t * 1.8 + z * 1.2)
    + 0.014 * Math.sin(z * 2.3 + t * 1.1)) * (0.55 + rough * 1.3)
  + rough * (0.075 * Math.sin(x * 4.1 + t * 2.9) + 0.05 * Math.sin(x * 6.7 - t * 3.6 + z * 2) + 0.03 * Math.sin(x * 9.4 + t * 4.4 - z * 1.5))

// A tank seen in cross-section: a tinted front wall whose top edge is the waterline,
// plus the surface stretching back from it. Pori is tinted wherever it is submerged.
function buildWater() {
  const columns = 110
  const width = 44
  const surfaceGeometry = new THREE.PlaneGeometry(width, WATER_DEPTH, columns, 8)
  surfaceGeometry.rotateX(-Math.PI / 2)
  surfaceGeometry.translate(0, 0, WATER_FRONT_Z - WATER_DEPTH / 2)
  const surfaceMaterial = new THREE.MeshStandardMaterial({
    color: '#b9f3f5', transparent: true, opacity: 0.72, roughness: 0.22, depthWrite: false, side: THREE.DoubleSide,
  })
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial)
  surface.receiveShadow = true
  surface.renderOrder = 2

  const frontGeometry = new THREE.PlaneGeometry(width, 1, columns, 1)
  const colors = new Float32Array(frontGeometry.attributes.position.count * 3)
  const top = new THREE.Color('#6fd8e6')
  const deep = new THREE.Color('#2b9bd0')
  for (let i = 0; i < frontGeometry.attributes.position.count; i += 1) {
    const color = i <= columns ? top : deep
    colors.set([color.r, color.g, color.b], i * 3)
  }
  frontGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const frontMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.56, depthWrite: false })
  const front = new THREE.Mesh(frontGeometry, frontMaterial)
  front.position.z = WATER_FRONT_Z
  front.renderOrder = 3

  const rippleMaterials = []
  const ripples = [0, 1].map(() => {
    const material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })
    rippleMaterials.push(material)
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.78, 0.84, 64), material)
    ring.rotation.x = -Math.PI / 2
    ring.renderOrder = 1
    return ring
  })

  const root = new THREE.Group()
  root.add(surface, front, ...ripples)

  const update = (level, t, rough) => {
    const surfacePositions = surfaceGeometry.attributes.position
    for (let i = 0; i < surfacePositions.count; i += 1) {
      surfacePositions.setY(i, level + waveHeight(surfacePositions.getX(i), surfacePositions.getZ(i), t, rough))
    }
    surfacePositions.needsUpdate = true
    surfaceGeometry.computeVertexNormals()

    const frontPositions = frontGeometry.attributes.position
    for (let i = 0; i < frontPositions.count; i += 1) {
      frontPositions.setY(i, i <= columns ? level + waveHeight(frontPositions.getX(i), WATER_FRONT_Z, t, rough) : -4)
    }
    frontPositions.needsUpdate = true
  }

  return { root, ripples, update, materials: [surfaceMaterial, frontMaterial, ...rippleMaterials] }
}

// Things in the scene the user can tap for an explanation. Buttons are laid over the canvas
// and follow their object every frame.
const FISH_COUNT = 3
const HOTSPOTS = [
  { key: 'weather', label: '날씨: 간밤 미국 증시 보기', size: 92 },
  { key: 'foreign', label: '왼쪽 배: 외국인 수급 보기', size: 84 },
  { key: 'institution', label: '오른쪽 배: 기관 수급 보기', size: 84 },
  { key: 'samsung', label: '파란 고래: 삼성전자 보기', size: 76 },
  { key: 'hynix', label: '주황 고래: SK하이닉스 보기', size: 76 },
  ...Array.from({ length: FISH_COUNT }, (_, index) => ({ key: `fish${index}`, label: `물고기 ${index + 1}: 오늘의 화제 종목 보기`, size: 64 })),
]

export default function Pori3D({
  marketState, touchSignal, waterLevel = 0.5, volatility = 0.2, foreignFlow = 0, institutionFlow = 0,
  // causes shown around Pori; each is a -1..1 level, or null when unknown
  overnight = null, wind = 0, samsung = null, hynix = null,
  // today's most-moved stocks: up to three { name, level }
  fish = null,
  solo = false,
  onPick = null,
}) {
  const hotspotRefs = useRef({})
  const hostRef = useRef(null)
  const stateRef = useRef(marketState)
  const touchRef = useRef({ signal: touchSignal, at: -10 })
  const waterRef = useRef(waterLevel)

  const volatilityRef = useRef(volatility)

  useEffect(() => {
    waterRef.current = waterLevel
  }, [waterLevel])

  const flowRef = useRef({ foreign: foreignFlow, institution: institutionFlow })

  useEffect(() => {
    volatilityRef.current = volatility
  }, [volatility])

  useEffect(() => {
    flowRef.current = { foreign: foreignFlow, institution: institutionFlow }
  }, [foreignFlow, institutionFlow])

  useEffect(() => {
    stateRef.current = marketState
  }, [marketState])

  const causeRef = useRef({ overnight, wind, samsung, hynix, fish })

  useEffect(() => {
    causeRef.current = { overnight, wind, samsung, hynix, fish }
  }, [overnight, wind, samsung, hynix, fish])

  useEffect(() => {
    if (touchSignal > 0 && touchSignal !== touchRef.current.signal) {
      touchRef.current = { signal: touchSignal, at: performance.now() / 1000 }
    }
  }, [touchSignal])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.NoToneMapping
    renderer.domElement.className = 'pori-3d-canvas'
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 50)
    // solo = character portrait (market select): no water, boats or weather
    const lookAt = new THREE.Vector3(0, solo ? 1.6 : 2.0, 0)

    // soft sky light keeps the shadow side warm instead of grey
    const hemi = new THREE.HemisphereLight('#ffffff', '#ffe2cc', 1.75)
    scene.add(hemi)
    const daySky = new THREE.Color('#ffffff')
    const nightSky = new THREE.Color('#aebbff')
    const fill = new THREE.DirectionalLight('#ffffff', 0.5)
    fill.position.set(1.5, 2, 8)
    scene.add(fill)
    const key = new THREE.DirectionalLight('#ffffff', 1.6)
    key.position.set(-3, 5.2, 6.5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -2.6
    key.shadow.camera.right = 2.6
    key.shadow.camera.top = 5.8
    key.shadow.camera.bottom = -1
    key.shadow.camera.near = 1
    key.shadow.camera.far = 20
    key.shadow.radius = 9
    key.shadow.blurSamples = 16
    key.shadow.bias = -0.0004
    key.shadow.normalBias = 0.03
    scene.add(key)
    const rim = new THREE.DirectionalLight('#c9fff1', 0.6)
    rim.position.set(4, 3, -4)
    scene.add(rim)

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(4, 48),
      new THREE.ShadowMaterial({ color: '#1f6f5c', opacity: 0.2 }),
    )
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    scene.add(ground)

    const pori = buildPori()
    scene.add(pori.root)

    const water = buildWater()
    if (!solo) scene.add(water.root)
    let level = WATER_MIN
    let floatY = 0
    let rough = 0
    let waveTime = 0
    let ringShown = 0
    // left boat = foreign investors, right boat = institutions
    const boats = [
      { ...buildBoat('#ff8f7d'), side: -1, key: 'foreign' },
      { ...buildBoat('#6fa8f5'), side: 1, key: 'institution' },
    ]
    if (!solo) boats.forEach((boat) => scene.add(boat.outer))
    // heavyweight stocks swim in front of Pori, on the side the speech bubble leaves free
    const whales = [
      { ...buildWhale('#6f9cf0', '삼성전자'), key: 'samsung', x: 1.0, z: 0.95, size: 1.12 },
      { ...buildWhale('#f29a6b', '하이닉스'), key: 'hynix', x: 1.8, z: 0.5, size: 0.96 },
    ]
    whales.forEach((whale) => {
      whale.outer.rotation.y = Math.PI + 0.5
      if (!solo) scene.add(whale.outer)
    })
    // today's movers swim on the left, facing Pori
    const school = [
      { ...buildFish('#ffcf5c'), x: -1.85, z: 0.75 },
      { ...buildFish('#ff9fb2'), x: -1.25, z: 1.1 },
      { ...buildFish('#8fdcc6'), x: -0.68, z: 0.82 },
    ]
    school.forEach((fishItem) => {
      fishItem.outer.rotation.y = -0.45
      if (!solo) scene.add(fishItem.outer)
    })
    const windFx = buildWind()
    if (!solo) scene.add(windFx.root)
    let windLevel = 0
    const swimRing = buildSwimRing()
    pori.root.add(swimRing.ring)

    const weather = buildWeather()
    weather.root.scale.setScalar(0.82)
    if (!solo) scene.add(weather.root)
    const sky = { sun: 0, cloud: 0, rain: 0, dots: 0, bang: 0, sunBehind: 0, moon: 0 }
    const zzz = buildZzz()
    scene.add(zzz.root)
    const cloudColor = new THREE.Color('#ffffff')
    const cloudTarget = new THREE.Color()

    const weatherAnchor = new THREE.Vector3(1.2, 3.72, -0.7)
    const view = { width: 1, height: 1 }
    const projected = new THREE.Vector3()
    // move a hotspot button over a point in the scene, or hide it when its object isn't on screen
    const placeHotspot = (key, position, lift, visible) => {
      const button = hotspotRefs.current[key]
      if (!button) return
      projected.copy(position)
      projected.y += lift
      projected.project(camera)
      const onScreen = visible && Math.abs(projected.x) < 0.98 && Math.abs(projected.y) < 0.98
      button.style.display = onScreen ? '' : 'none'
      if (!onScreen) return
      const x = (projected.x * 0.5 + 0.5) * view.width
      const y = (-projected.y * 0.5 + 0.5) * view.height
      button.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`
    }
    let frameHalfWidth = 2.4
    const resize = () => {
      const width = host.clientWidth || 1
      const height = host.clientHeight || 1
      renderer.setSize(width, height, false)
      view.width = width
      view.height = height
      camera.aspect = width / height
      const halfFov = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const distance = Math.max((solo ? 3.9 : 5.0) / 2 / halfFov, 3.2 / 2 / (halfFov * camera.aspect))
      camera.position.set(0, solo ? 2.1 : 2.75, distance)
      camera.lookAt(lookAt)
      camera.updateProjectionMatrix()
      // keep the weather in the top-right corner whatever the canvas shape
      const depth = distance - weatherAnchor.z
      const halfWidth = depth * halfFov * camera.aspect
      weatherAnchor.x = Math.min(1.75, halfWidth - 0.62)
      frameHalfWidth = distance * halfFov * camera.aspect
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(host)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pointer = { x: 0, y: 0, at: -10 }
    const onPointerMove = (event) => {
      const rect = host.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height * 0.4
      pointer.x = THREE.MathUtils.clamp((event.clientX - cx) / (window.innerWidth * 0.45), -1, 1)
      pointer.y = THREE.MathUtils.clamp((event.clientY - cy) / (window.innerHeight * 0.5), -1, 1)
      pointer.at = performance.now() / 1000
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })

    const pose = { ...POSES.loading }
    const live = { yaw: 0, pitch: 0, happy: 0, blink: 0, jumpY: 0, stretch: 1, armLift: 0, lookX: 0 }
    let nextBlink = 2
    let blinkStart = -1
    let stateSince = 0
    let lastState = stateRef.current
    let last = performance.now() / 1000
    let frame = 0

    const tick = () => {
      frame = requestAnimationFrame(tick)
      const now = performance.now() / 1000
      const dt = Math.min(now - last, 0.05)
      last = now
      const motion = reducedMotion.matches ? 0 : 1
      const state = POSES[stateRef.current] ? stateRef.current : 'flat'
      if (state !== lastState) {
        lastState = state
        stateSince = now
      }
      const target = POSES[state]
      for (const key of Object.keys(pose)) pose[key] = damp(pose[key], target[key], 7, dt)

      // --- water: trading activity sets the level; deep water floats Pori ---
      const activity = THREE.MathUtils.clamp((waterRef.current - 0.08) / 0.92, 0, 1)
      level = damp(level, WATER_MIN + activity * (WATER_MAX - WATER_MIN), 2.2, dt)
      const afloat = THREE.MathUtils.smoothstep(level, FLOAT_DEPTH - 0.15, FLOAT_DEPTH + 0.25)
      rough = damp(rough, THREE.MathUtils.clamp(volatilityRef.current, 0, 1), 1.6, dt)
      waveTime += dt * (1 + rough * 0.9) * motion
      const bob = (Math.sin(now * (1.7 + rough * 1.2)) * 0.045 * (1 + rough * 1.6) + waveHeight(0, 0, waveTime, rough) * 0.6) * afloat * motion
      // the ring adds buoyancy, so Pori rides a little higher and the ring sits on the surface
      floatY = damp(floatY, Math.max(0, level - FLOAT_DEPTH + ringShown * 0.14), 3, dt)
      water.update(level, waveTime, rough)
      ringShown = damp(ringShown, rough > 0.55 ? 1 : 0, 6, dt)
      water.ripples.forEach((ring, index) => {
        const phase = (now * 0.45 + index * 0.5) % 1
        const wet = THREE.MathUtils.smoothstep(level, 0.2, 0.5)
        ring.position.set(pori.root.position.x, level + 0.012, 0)
        ring.scale.setScalar(1 + phase * 0.9)
        ring.material.opacity = (1 - phase) * Math.min(0.9, 0.5 + rough * 0.4) * wet * motion
      })

      // --- fish: today's most-moved stocks leap or dive; only the name tag differs ---
      school.forEach((fishItem, index) => {
        const data = causeRef.current.fish?.[index]
        if (data?.name) fishItem.label.setText(data.name)
        fishItem.shown = damp(fishItem.shown, data?.name && Number.isFinite(data.level) ? 1 : 0, 4, dt)
        fishItem.level = damp(fishItem.level, THREE.MathUtils.clamp(data?.level ?? 0, -1, 1), 1.6, dt)
        const mood = fishItem.level
        const x = Math.max(fishItem.x, -(frameHalfWidth - 0.32))
        const surface = level + waveHeight(x, fishItem.z, waveTime, rough)
        let hop = 0
        let pitch = mood < 0 ? mood * 0.55 : 0
        if (mood > 0.2 && motion) {
          const u = ((now * 1.15 + index * 0.9) % 2.6) / 0.8
          if (u < 1) {
            hop = Math.sin(u * Math.PI) * (0.14 + 0.3 * mood)
            pitch = Math.cos(u * Math.PI) * 0.8 * mood
          }
        }
        fishItem.hop = damp(fishItem.hop, hop, 18, dt)
        fishItem.pitch = damp(fishItem.pitch, pitch, 10, dt)
        const depth = mood < 0 ? mood * 0.38 : 0
        fishItem.outer.position.set(
          x + Math.sin(now * 0.8 + index * 2) * 0.05 * motion,
          Math.max(0.12, surface - 0.1 + depth) + fishItem.hop,
          fishItem.z,
        )
        fishItem.outer.visible = fishItem.shown > 0.02
        fishItem.outer.scale.setScalar(Math.max(fishItem.shown, 0.001))
        fishItem.tilt.rotation.z = fishItem.pitch
        fishItem.tail.rotation.y = Math.sin(now * 7 + index) * 0.45 * motion
      })

      windLevel = damp(windLevel, THREE.MathUtils.clamp(causeRef.current.wind ?? 0, -1, 1), 1.5, dt)
      const windStrength = Math.abs(windLevel)
      const windDirection = windLevel > 0 ? -1 : 1

      // --- boats: buyers sail in loaded with cargo, sellers turn and head out of frame ---
      boats.forEach((boat) => {
        boat.flow = damp(boat.flow, THREE.MathUtils.clamp(flowRef.current[boat.key] ?? 0, -1, 1), 1.1, dt)
        const arrive = THREE.MathUtils.smoothstep(boat.flow, -1, 1) // 0 = gone, 1 = alongside Pori
        const nearX = Math.min(1.45, frameHalfWidth - 0.65)
        const farX = frameHalfWidth + 0.15
        const x = boat.side * THREE.MathUtils.lerp(farX, nearX, arrive)
        const z = THREE.MathUtils.lerp(-1.25, -0.35, arrive)
        const y = level + waveHeight(x, z, waveTime, rough) - 0.02
        const slope = (waveHeight(x + 0.3, z, waveTime, rough) - waveHeight(x - 0.3, z, waveTime, rough)) / 0.6
        // bow is +x: inbound boats face Pori, outbound boats face away, both angled slightly for a 3/4 view
        const inbound = boat.flow >= -0.08
        const headingTarget = boat.side < 0
          ? (inbound ? -0.4 : Math.PI - 0.4)
          : (inbound ? Math.PI + 0.4 : 0.4)
        boat.heading = damp(boat.heading, headingTarget, 2.2, dt)
        boat.outer.position.set(x, y, z)
        boat.outer.rotation.y = boat.heading
        boat.outer.scale.setScalar(THREE.MathUtils.lerp(0.8, 1.2, arrive))
        boat.tilt.rotation.z = Math.atan(slope) * Math.cos(boat.heading) + Math.sin(now * 1.9 + boat.side) * 0.035 * motion
        boat.tilt.rotation.x = Math.sin(now * 1.4 + boat.side * 2) * (0.04 + rough * 0.1) * motion
        boat.crates.forEach((crate, index) => {
          const shown = boat.flow > 0.18 + index * 0.28 ? 1 : 0
          crate.scale.setScalar(Math.max(damp(crate.scale.x, shown, 6, dt), 0.001))
        })
        // pennant points downwind in world space whatever way the boat faces
        boat.pennant.rotation.y = (windDirection < 0 ? Math.PI : 0) - boat.heading
        boat.pennant.rotation.z = -(1 - windStrength) * 1.25 + Math.sin(now * 9 + boat.side) * 0.14 * windStrength * motion
      })

      // --- wind: a rising exchange rate blows toward the left, the way the foreign boat leaves ---
      windFx.root.visible = windStrength > 0.06
      windFx.streaks.forEach((streak, index) => {
        streak.phase = (streak.phase + dt * (0.1 + windStrength * 0.45) * motion) % 1
        const span = frameHalfWidth + 0.7
        streak.mesh.position.set(
          windDirection * (-span + streak.phase * 2 * span),
          streak.y + Math.sin(now * 1.3 + index) * 0.04 * motion,
          -1.1,
        )
        streak.material.opacity = windStrength * 0.85 * Math.sin(streak.phase * Math.PI)
      })

      // --- whales: heavyweight stocks leap when up, sink nose-down when down ---
      whales.forEach((whale, index) => {
        const raw = causeRef.current[whale.key]
        whale.shown = damp(whale.shown, Number.isFinite(raw) ? 1 : 0, 4, dt)
        whale.level = damp(whale.level, THREE.MathUtils.clamp(raw ?? 0, -1, 1), 1.4, dt)
        const mood = whale.level
        const x = Math.min(whale.x, frameHalfWidth - 0.4)
        const surface = level + waveHeight(x, whale.z, waveTime, rough)
        let hop = 0
        let pitch = mood < 0 ? mood * 0.5 : 0
        if (mood > 0.2 && motion) {
          const u = ((now + index * 1.5) % 3.2) / 1.05
          if (u < 1) {
            hop = Math.sin(u * Math.PI) * (0.2 + 0.42 * mood)
            pitch = Math.cos(u * Math.PI) * 0.75 * mood
          }
        }
        whale.hop = damp(whale.hop, hop, 16, dt)
        whale.pitch = damp(whale.pitch, pitch, 9, dt)
        const depth = mood < 0 ? mood * 0.55 : mood * 0.05
        whale.outer.position.set(x, Math.max(0.17, surface - 0.05 + depth) + whale.hop, whale.z)
        whale.outer.visible = whale.shown > 0.02
        whale.outer.scale.setScalar(whale.size * Math.max(whale.shown, 0.001))
        whale.tilt.rotation.z = whale.pitch + Math.sin(now * 1.6 + index) * 0.05 * motion
        whale.spout = damp(whale.spout, mood > 0.2 ? 1 : 0, 5, dt)
        whale.drops.forEach((drop, dropIndex) => {
          const phase = motion ? (now * 0.9 + dropIndex / 3) % 1 : dropIndex / 3
          drop.position.set(0.12 + (dropIndex - 1) * 0.07 * phase, 0.24 + phase * 0.3, 0)
          drop.scale.setScalar(Math.max((1 - phase) * 0.05 * whale.spout, 0.001))
        })
      })

      // --- jump loop while the market is up ---
      let jumpY = 0
      let stretch = 1
      let armLift = 0
      if (state === 'rise' && motion) {
        const u = (now - stateSince + 0.2) % 2.7
        if (u < 0.2) {
          stretch = 1 - 0.1 * Math.sin((u / 0.2) * Math.PI * 0.5)
        } else if (u < 0.82) {
          const a = (u - 0.2) / 0.62
          jumpY = (0.5 - afloat * 0.22) * 4 * a * (1 - a)
          stretch = 1 + 0.07 * Math.abs(Math.cos(a * Math.PI))
          armLift = Math.sin(a * Math.PI) * 1.25
        } else if (u < 1.3) {
          const b = (u - 0.82) / 0.48
          stretch = 1 - 0.11 * Math.sin(b * Math.PI * 2.5) * (1 - b) ** 2
        }
      }
      live.jumpY = damp(live.jumpY, jumpY, 30, dt)
      live.stretch = damp(live.stretch, stretch, 26, dt)
      live.armLift = damp(live.armLift, armLift, 14, dt)

      // --- touch reaction: happy face and a soft bounce ---
      const sinceTouch = now - touchRef.current.at
      const happyTarget = sinceTouch < 1.5 && state !== 'closed' ? 1 : 0
      live.happy = damp(live.happy, happyTarget, 14, dt)
      const touchBounce = sinceTouch < 0.9 ? Math.sin(sinceTouch * 16) * Math.exp(-sinceTouch * 5) * 0.09 * motion : 0

      // --- where the head looks: the pointer, or side to side while loading ---
      const pointerFresh = now - pointer.at < 4
      let yawTarget = pointerFresh ? pointer.x * 0.36 : 0
      let pitchTarget = pointerFresh ? pointer.y * 0.22 : 0
      let lookTarget = 0
      if (state === 'loading') {
        yawTarget = Math.sin(now * 1.6) * 0.32 * motion
        lookTarget = Math.sin(now * 1.6) * 0.035 * motion
        pitchTarget = 0
      }
      const asleep = pose.sleep * (1 - live.happy)
      yawTarget *= 1 - pose.sleep
      pitchTarget *= 1 - pose.sleep
      live.yaw = damp(live.yaw, yawTarget, 5, dt)
      live.pitch = damp(live.pitch, pitchTarget, 5, dt)
      live.lookX = damp(live.lookX, lookTarget, 8, dt)

      // --- blink ---
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
      const sway = Math.sin(now * 1.15) * motion

      // root: jump, squash and stretch (volume-preserving)
      const sy = live.stretch * (1 - pose.squash) * (1 + touchBounce)
      const sxz = 1 / Math.sqrt(sy)
      pori.root.position.y = live.jumpY + floatY + bob
      pori.root.scale.set(sxz, sy, sxz)
      pori.root.rotation.y = live.yaw * 0.3
      pori.root.rotation.z = (state === 'flat' ? sway * 0.025 : 0)
        + Math.sin(now * (1.25 + rough * 0.9)) * (0.03 + rough * 0.075) * afloat * motion
        + Math.sin(now * 1.6) * 0.018 * rough * (1 - afloat) * motion
      pori.root.rotation.x = Math.sin(now * (1.5 + rough)) * 0.05 * rough * afloat * motion

      pori.torso.scale.y = 1 + breathe * 0.014
      pori.torso.scale.x = 1 - breathe * 0.006

      pori.head.position.y = 1.5 - pose.headDrop + breathe * 0.012
      pori.head.rotation.set(
        pose.headPitch + live.pitch + breathe * 0.012 * pose.sleep,
        live.yaw * 0.7,
        pose.headRoll + (state === 'flat' ? -sway * 0.03 : 0),
      )

      // with the ring on, arms rest on top of it instead of hanging through it
      const restArm = THREE.MathUtils.lerp(pose.arm, Math.max(pose.arm, 1.08), ringShown)
      const armAngle = restArm + live.armLift + live.happy * 0.5 + breathe * 0.03
      swimRing.ring.scale.setScalar(Math.max(ringShown, 0.001))
      swimRing.ring.visible = ringShown > 0.02
      swimRing.ring.rotation.z = Math.sin(now * 2.1) * 0.05 * rough * motion
      pori.arms[0].rotation.z = -armAngle
      pori.arms[1].rotation.z = armAngle
      pori.arms[0].rotation.x = pori.arms[1].rotation.x = -0.15 - live.armLift * 0.2

      pori.tail.rotation.z = -1.05 - pose.tail * 0.5 - live.armLift * 0.25 + Math.sin(now * 2.4) * 0.09 * motion
      pori.tail.rotation.y = Math.sin(now * 1.2) * 0.12 * motion

      const earWiggle = Math.max(0, Math.sin(now * 0.9 + 1)) ** 12 * 0.12 * motion
      pori.ears[0].rotation.z = 0.3 + earWiggle
      pori.ears[1].rotation.z = -0.3 - earWiggle

      // face
      const open = 1 - live.happy
      const eyeOpen = Math.max(0, 1 - live.happy - asleep)
      pori.eyes.forEach((eye, index) => {
        const side = index === 0 ? -1 : 1
        eye.scale.set(Math.max(eyeOpen, 0.001), Math.max(eyeOpen * (1 - blink * 0.92), 0.001), Math.max(eyeOpen, 0.001))
        eye.position.x = side * 0.37 + live.lookX
      })
      // the same arcs serve as happy eyes (∩) and, flipped, as sleeping eyes (∪)
      const lidded = Math.max(live.happy, asleep, 0.001)
      pori.happyEyes.forEach((eye) => {
        eye.scale.set(lidded, lidded * (1 - 2 * asleep), lidded)
        eye.position.y = eye.userData.baseY - 0.05 * asleep
      })
      pori.brows.forEach((brow, index) => {
        const side = index === 0 ? -1 : 1
        brow.position.y = pose.brow + live.happy * 0.03
        brow.rotation.z = -side * pose.browTilt
      })
      pori.mouth.scale.set(
        (0.85 + Math.abs(pose.mouth) * 0.15) * Math.max(open, 0.001),
        pose.mouth * Math.max(open, 0.001),
        1,
      )
      pori.openMouth.scale.setScalar(Math.max(live.happy, 0.001))
      pori.cheeks.forEach((cheek) => cheek.scale.setScalar(1 + live.happy * 0.18))

      // --- weather: pieces pop in and out as the state changes ---
      // on a trading day the sky is last night's US market, not our own index:
      // sunny sky with a sad Pori means "it wasn't the US this time"
      const usLevel = causeRef.current.overnight
      const skyKey = ['rise', 'flat', 'fall'].includes(state) && Number.isFinite(usLevel)
        ? (usLevel > 0.33 ? 'rise' : usLevel < -0.33 ? 'fall' : 'flat')
        : state
      const forecast = WEATHER[skyKey]
      for (const key of Object.keys(sky)) sky[key] = damp(sky[key], forecast[key], 6, dt)
      cloudColor.lerp(cloudTarget.set(forecast.cloudColor), 1 - Math.exp(-5 * dt))
      weather.materials.cloud.color.copy(cloudColor)
      const show = (group, amount) => {
        group.visible = amount > 0.02
        group.scale.setScalar(Math.max(amount, 0.001))
      }
      weather.root.position.set(weatherAnchor.x, weatherAnchor.y + Math.sin(now * 1.3) * 0.035 * motion, weatherAnchor.z)
      show(weather.sun, sky.sun * (1 - sky.sunBehind * 0.18))
      weather.sun.position.set(-0.24 * sky.sunBehind, 0.2 * sky.sunBehind, -0.3 * sky.sunBehind)
      weather.rays.rotation.z = now * 0.35 * motion
      weather.rays.scale.setScalar(1 + Math.sin(now * 2.2) * 0.05 * motion)
      show(weather.cloud, sky.cloud)
      weather.cloud.position.x = Math.sin(now * 0.7) * 0.03 * motion
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
      weather.bang.rotation.z = Math.sin(now * 5) * 0.14 * motion

      show(weather.moon, sky.moon)
      weather.moon.rotation.z = Math.sin(now * 0.6) * 0.06 * motion
      weather.stars.forEach((star, index) => {
        star.scale.setScalar(0.75 + Math.sin(now * 2.6 + index * 2.1) * 0.25 * motion)
        star.scale.y *= 1.5
      })

      // --- night: dim, cooler light while asleep ---
      hemi.color.lerpColors(daySky, nightSky, pose.sleep)
      hemi.intensity = 1.75 - pose.sleep * 0.45
      key.intensity = 1.6 - pose.sleep * 0.65

      // --- Zzz: letters rise from the head toward the sky, growing and fading ---
      zzz.root.visible = pose.sleep > 0.02
      zzz.letters.forEach((letter, index) => {
        const phase = (now * 0.3 * motion + index / 3) % 1
        const envelope = Math.sin(Math.min(phase * 5, 1) * Math.PI * 0.5) * (1 - THREE.MathUtils.smoothstep(phase, 0.72, 1))
        letter.position.set(
          pori.root.position.x - 0.12 - phase * 0.3 + Math.sin(phase * 7 + index) * 0.08,
          pori.root.position.y + 3.12 + phase * 1.9,
          0.45,
        )
        letter.rotation.z = 0.12 + Math.sin(now * 1.4 + index * 1.7) * 0.14 * motion
        letter.scale.setScalar((0.8 + phase * 1.1) * Math.max(pose.sleep, 0.001))
        letter.userData.material.opacity = envelope * pose.sleep
      })

      boats.forEach((boat) => placeHotspot(boat.key, boat.outer.position, 0.3, true))
      whales.forEach((whale) => placeHotspot(whale.key, whale.outer.position, 0.1, whale.shown > 0.5))
      school.forEach((fishItem, index) => placeHotspot(`fish${index}`, fishItem.outer.position, 0.08, fishItem.shown > 0.5))
      // the sky only stands for the US market on a trading day
      placeHotspot('weather', weather.root.position, 0, Number.isFinite(usLevel) && ['rise', 'flat', 'fall'].includes(state))

      renderer.render(scene, camera)
    }
    tick()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      scene.traverse((node) => {
        if (node.geometry) node.geometry.dispose()
      })
      Object.values(pori.materials).forEach((material) => material.dispose())
      Object.values(weather.materials).forEach((material) => material.dispose())
      water.materials.forEach((material) => material.dispose())
      swimRing.materials.forEach((material) => material.dispose())
      boats.forEach((boat) => boat.materials.forEach((material) => material.dispose()))
      whales.forEach((whale) => {
        whale.materials.forEach((material) => material.dispose())
        whale.label.texture.dispose()
      })
      windFx.streaks.forEach((streak) => streak.material.dispose())
      school.forEach((fishItem) => {
        fishItem.materials.forEach((material) => material.dispose())
        fishItem.label.texture.dispose()
      })
      zzz.letters.forEach((letter) => letter.userData.material.dispose())
      ground.material.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [solo])

  return (
    <>
      <div
        ref={hostRef}
        className="pori-3d"
        role="img"
        aria-label={`금융 펫 포리의 현재 상태: ${marketState}`}
      />
      {!solo && onPick && (
        <div className="scene-hotspots">
          {HOTSPOTS.map(({ key, label, size }) => (
            <button
              key={key}
              ref={(element) => { hotspotRefs.current[key] = element }}
              type="button"
              className="scene-hotspot"
              style={{ width: size, height: size, display: 'none' }}
              aria-label={label}
              onClick={() => onPick(key)}
            />
          ))}
        </div>
      )}
    </>
  )
}
