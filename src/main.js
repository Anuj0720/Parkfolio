// main.js
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { Octree } from 'three/addons/math/Octree.js'
import { Capsule } from 'three/addons/math/Capsule.js'
import { gsap } from 'gsap'
import { Howl } from 'howler'

// ---------------------- DOM refs ----------------------
const canvas = document.getElementById('webglCanvas')
const loadingScreen = document.getElementById('loadingScreen')
const loadingText   = document.querySelector('.loading-text')
const enterButton   = document.getElementById('enterButton')
const instructions  = document.querySelector('.instructions')
const mobileControlsContainer = document.getElementById('mobileControlsContainer')
const modal = document.getElementById('modal')
const modalBg = document.querySelector('.modal-bg-overlay')
const modalTitle = document.querySelector('.modal-title')
const modalDesc = document.getElementById('modalDesc')
const modalExitButton = document.getElementById('modalExit')
const modalVisitProjectButton = document.getElementById('modalVisit')
const modalImg = document.getElementById('modalImg')
const audioToggle = document.getElementById('audioToggle')
const audioOnSpan = audioToggle.querySelector('.audio-on')
const audioOffSpan = audioToggle.querySelector('.audio-off')
const themeToggle = document.getElementById('themeToggle')

// ---------------------- Sounds ----------------------
const sounds = {
  backgroundMusic: new Howl({ src: ['/sfx/sfx_music.ogg'], loop: true, volume: 0.3, preload: true }),
  projectsSFX: new Howl({ src: ['/sfx/sfx_projects.ogg'], volume: 0.5, preload: true }),
  pokemonSFX: new Howl({ src: ['/sfx/sfx_pokemon.ogg'], volume: 0.5, preload: true }),
  jumpSFX: new Howl({ src: ['/sfx/sfx_jumpsfx.ogg'], volume: 1.0, preload: true }),
}

let isMuted = false
let bgmStarted = false
function playSound(id){ if (!isMuted && sounds[id]) sounds[id].play() }
function stopSound(id){ if (sounds[id]) sounds[id].stop() }
function startBgmOnce(){ if (bgmStarted || isMuted) return; bgmStarted = true; sounds.backgroundMusic.play() }

// ---------------------- Scene / renderer / camera ----------------------
const scene = new THREE.Scene()
scene.background = new THREE.Color(0x97e460)

const sizes = { width: window.innerWidth, height: window.innerHeight }
const aspect = sizes.width / sizes.height
const viewSize = 25

const camera = new THREE.OrthographicCamera(
  -aspect * viewSize,
  aspect * viewSize,
  viewSize,
  -viewSize,
  0.1,
  1000
)
camera.position.set(30, 30, 30)

const cameraOffset = new THREE.Vector3(30, 30, 30)

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.5
renderer.setClearColor(0x97e460)

// ---------------------- Lights ----------------------
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
directionalLight.castShadow = true
directionalLight.position.set(-50, 80, 30)
directionalLight.shadow.mapSize.set(2048, 2048)
const shadowCam = directionalLight.shadow.camera
shadowCam.near = 1; shadowCam.far = 300
shadowCam.left = -150; shadowCam.right = 150; shadowCam.top = 150; shadowCam.bottom = -150
shadowCam.updateProjectionMatrix()
directionalLight.shadow.bias = -0.0005
directionalLight.shadow.normalBias = 0.05
scene.add(directionalLight)

// ---------------------- Physics / player ----------------------
const GRAVITY = 30
const CAPSULE_RADIUS = 0.35
const CAPSULE_HEIGHT = 1
const JUMP_HEIGHT = 10
const MOVE_SPEED = 10

let character = { instance: null, isMoving: false, spawnPosition: new THREE.Vector3(), baseScale: new THREE.Vector3(1,1,1) }
let targetRotation = 0

const colliderOctree = new Octree()
const playerCollider = new Capsule(new THREE.Vector3(0, CAPSULE_RADIUS, 0), new THREE.Vector3(0, CAPSULE_HEIGHT, 0), CAPSULE_RADIUS)

let playerVelocity = new THREE.Vector3()
let playerOnFloor = false

const intersectObjects = []
const intersectObjectsNames = ["board", "board001", "board002", "board003", "character", "tuttle", "Snorlax", "name"]

// ---------------------- Loaders & manager ----------------------
const manager = new THREE.LoadingManager()
manager.onLoad = () => {
  gsap.to(loadingText, { opacity: 0, duration: 0.3 })
  enterButton.classList.add('visible')
}

const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco') // ensure this path exists if using Draco

const gltfLoader = new GLTFLoader(manager)
gltfLoader.setDRACOLoader(dracoLoader)

// GLTF load: traverse and push logical ancestor nodes (avoid duplicates)
gltfLoader.load('./models/shreeGarden/shree_man3.glb', (gltf) => {
  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }

    // if this node or any ancestor matches an interactable name, add the ancestor object to intersectObjects
    let n = child
    while (n) {
      if (intersectObjectsNames.includes(n.name)) {
        if (!intersectObjects.includes(n)) intersectObjects.push(n)
        break
      }
      n = n.parent
    }

    if (child.name === "character" || child.name === "Character") {
      character.spawnPosition.copy(child.position)
      character.instance = child
      character.baseScale.copy(child.scale)
      // keep your preferred initial position if you set it earlier
      child.position.set(32.22153310156273,-0.3860074122666504,-88.23170146943266)
      playerCollider.start.copy(child.position).add(new THREE.Vector3(0, CAPSULE_RADIUS, 0))
      playerCollider.end.copy(child.position).add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0))
      targetRotation = child.rotation.y
    }

    if (child.name === "ground_collider" || child.name === "Ground_Collider") {
      colliderOctree.fromGraphNode(child)
      child.visible = false
    }
  })

  scene.add(gltf.scene)
}, undefined, (err) => {
  console.warn('GLTF load error', err)
})

// ---------------------- Raycaster & pointer (canvas-aware) ----------------------
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect()
  const x = ('clientX' in event) ? event.clientX : (event.touches && event.touches[0] && event.touches[0].clientX)
  const y = ('clientY' in event) ? event.clientY : (event.touches && event.touches[0] && event.touches[0].clientY)
  if (x == null || y == null) return
  pointer.x = ((x - rect.left) / rect.width) * 2 - 1
  pointer.y = -((y - rect.top) / rect.height) * 2 + 1
}

window.addEventListener('pointermove', (e) => updatePointerFromEvent(e), { passive: true })
window.addEventListener('touchmove', (e) => updatePointerFromEvent(e), { passive: true })
window.addEventListener('touchend', (e) => updatePointerFromEvent(e), { passive: false })
window.addEventListener('click', (e) => {
  // ensure pointer updated if needed (desktop)
  updatePointerFromEvent(e)
  startBgmOnInteraction()
  handleInteraction()
}, { passive: false })

// ---------------------- Modal content mapping ----------------------
const modalContent = {
  board: {
    title: "Web Dev",
    content: "A lightweight POS and inventory system for two-wheeler garages, built with Flask, HTML, Tailwind CSS, and JSON storage.",
    link: "https://github.com/ULTRASIRI/POS-system-for-Gargi-Garage/?tab=readme-ov-file",
    image: "/images/garagePOS.webp"
  },
  board001: {
    title: "Unity",
    content: "A 2D space-shooter game made in Unity.",
    link: "https://play.unity.com/en/games/d4a805ab-478b-4d53-bb5e-462388b13f9a/asteroid-shooter",
    image: "/images/asteroidShooter.webp"
  },
  board002: {
    title: "threejs",
    content: "ParkFolio",
    link: "https://github.com/ULTRASIRI/Parkfolio",
    image: "/images/portf.webp"
  },
  board003: {
    title: "TalkFlow",
    content: "This project is under development.",
    link: "https://example.com/",
    image: "/images/talkFlow.webp"
  },
  name: {
    title: "Shrinath Hinge",
    content: "Aspiring Software Developer (2026 Batch).",
    link: "https://github.com/SUPERSIRI9/Resume/blob/main/reumeShri.pdf/",
    image: "/images/me.webp"
  },
}

// ---------------------- Modal show/hide ----------------------
let isModalOpen = false
let intersectObject = ""

function showModal(id){
  const content = modalContent[id]
  if (!content) return
  if (!isMuted) playSound('projectsSFX')
  modalTitle.textContent = content.title
  modalDesc.textContent = content.content
  modalImg.src = content.image || "/images/default.jpeg"
  if (content.link) {
    modalVisitProjectButton.href = content.link
    modalVisitProjectButton.classList.remove('hidden')
  } else {
    modalVisitProjectButton.classList.add('hidden')
  }
  modal.classList.remove('hidden')
  modalBg.classList.remove('hidden')
  modal.setAttribute('aria-hidden', 'false')
  isModalOpen = true
  modalExitButton.focus()
}

function hideModal(){
  if (!isModalOpen) return
  if (!isMuted) playSound('projectsSFX')
  modal.classList.add('hidden')
  modalBg.classList.add('hidden')
  modal.setAttribute('aria-hidden', 'true')
  isModalOpen = false
  const elToFocus = document.querySelector('.enter-button') || canvas
  if (elToFocus) elToFocus.focus()
}

modalExitButton.addEventListener('click', hideModal)
modalBg.addEventListener('click', hideModal)
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && isModalOpen) hideModal() })

// ---------------------- Interaction / robust ray selection ----------------------
function startBgmOnInteraction(){
  if (!bgmStarted && !isMuted) {
    sounds.backgroundMusic.play()
    bgmStarted = true
  }
}

function handleInteraction(){
  if (isModalOpen) return;

  raycaster.setFromCamera(pointer, camera);

  // raycast against the list of interactable group nodes we collected earlier
  const intersects = raycaster.intersectObjects(intersectObjects, true);

  if (intersects.length === 0) {
    intersectObject = "";
    return;
  }

  // loop in order and pick the first intersect whose ancestor name is in intersectObjectsNames
  let chosenName = "";
  for (let i = 0; i < intersects.length; i++) {
    let node = intersects[i].object;
    while (node) {
      if (intersectObjectsNames.includes(node.name)) {
        chosenName = node.name;
        break;
      }
      node = node.parent;
    }
    if (chosenName) break;
  }

  intersectObject = chosenName || "";

  if (!intersectObject) return;

  if (["tuttle","Snorlax"].includes(intersectObject)) {
    if (!isMuted) playSound('pokemonSFX');
    jumpCharacter(intersectObject);
  } else {
    showModal(intersectObject);
    if (!isMuted) playSound('projectsSFX');
  }
}

// ---------------------- Jump animation for interactables ----------------------
let isCharacterReady = true
function jumpCharacter(meshID){
  if (!isCharacterReady) return
  const mesh = scene.getObjectByName(meshID)
  if (!mesh) return
  isCharacterReady = false

  const jumpHeight = 2
  const jumpDuration = 0.5
  const isSnorlax = meshID === 'Snorlax'
  const cur = { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z }
  const t1 = gsap.timeline()
  t1.to(mesh.scale, { x: isSnorlax ? cur.x*1.2 : 1.2, y: isSnorlax ? cur.y*0.8 : 0.8, z: isSnorlax ? cur.z*1.2 : 1.2, duration: jumpDuration*0.2 })
    .to(mesh.scale, { x: isSnorlax ? cur.x*0.8 : 0.8, y: isSnorlax ? cur.y*1.3 : 1.3, z: isSnorlax ? cur.z*0.8 : 0.8, duration: jumpDuration*0.3 })
    .to(mesh.position, { y: mesh.position.y + jumpHeight, duration: jumpDuration*0.5, ease: 'power2.out' }, '<')
    .to(mesh.scale, { x: isSnorlax ? cur.x*1.2 : 1, y: isSnorlax ? cur.y*1.2 : 1, z: isSnorlax ? cur.z*1.2 : 1, duration: jumpDuration*0.3 }, '>')
    .to(mesh.position, { y: mesh.position.y, duration: jumpDuration*0.5, ease: 'bounce.out', onComplete: () => { isCharacterReady = true } }, '>')
}

// ---------------------- Movement (pressedButtons) ----------------------
const pressedButtons = { up: false, left: false, right: false, down: false }

function bindMobileControl(el, dir){
  if (!el) return
  el.addEventListener('touchstart', (e) => { e.preventDefault(); pressedButtons[dir] = true }, { passive: false })
  el.addEventListener('touchend', (e) => { e.preventDefault(); pressedButtons[dir] = false }, { passive: false })
  el.addEventListener('touchcancel', (e) => { pressedButtons[dir] = false }, { passive: false })
  el.addEventListener('mousedown', (e) => { e.preventDefault(); pressedButtons[dir] = true })
  el.addEventListener('mouseup', (e) => { e.preventDefault(); pressedButtons[dir] = false })
  el.addEventListener('mouseleave', () => { pressedButtons[dir] = false })
}

const mobileControls = {
  up: document.querySelector('.mobile-control.up-arrow'),
  left: document.querySelector('.mobile-control.left-arrow'),
  right: document.querySelector('.mobile-control.right-arrow'),
  down: document.querySelector('.mobile-control.down-arrow'),
}

bindMobileControl(mobileControls.up, 'up')
bindMobileControl(mobileControls.left, 'left')
bindMobileControl(mobileControls.right, 'right')
bindMobileControl(mobileControls.down, 'down')

function onKeyDown(event){
  const code = event.code.toLowerCase()
  if (code === 'keyr') { respawnCharacter(); return }
  switch (code) {
    case 'keyw': case 'arrowup': pressedButtons.up = true; break
    case 'keys': case 'arrowdown': pressedButtons.down = true; break
    case 'keya': case 'arrowleft': pressedButtons.left = true; break
    case 'keyd': case 'arrowright': pressedButtons.right = true; break
    case 'space':
      if (playerOnFloor) {
        playerVelocity.y = JUMP_HEIGHT
        playerOnFloor = false
        character.isMoving = true
        if (!isMuted) playSound('jumpSFX')
        handleJumpAnimation()
      }
      break
  }
}
function onKeyUp(event){
  const code = event.code.toLowerCase()
  switch (code) {
    case 'keyw': case 'arrowup': pressedButtons.up = false; break
    case 'keys': case 'arrowdown': pressedButtons.down = false; break
    case 'keya': case 'arrowleft': pressedButtons.left = false; break
    case 'keyd': case 'arrowright': pressedButtons.right = false; break
  }
}
window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)

// player jump visual animation
function handleJumpAnimation(){
  if (!character.instance || !character.isMoving) return
  const jumpDuration = 0.3
  const base = character.baseScale
  const t1 = gsap.timeline()
  t1.to(character.instance.scale, { x: base.x*1.08, y: base.y*0.93, z: base.z*1.08, duration: jumpDuration*0.2 })
    .to(character.instance.scale, { x: base.x*0.92, y: base.y*1.07, z: base.z*0.92, duration: jumpDuration*0.3 })
    .to(character.instance.scale, { x: base.x, y: base.y, z: base.z, duration: jumpDuration*0.3 })
}

// movement behavior (original axis mapping restored)
function handleContinuousMovement(){
  if (!character.instance) return;
  if (Object.values(pressedButtons).some(Boolean) && !character.isMoving) {
    if (!isMuted) playSound('jumpSFX');
    if (pressedButtons.up)    { playerVelocity.x -= MOVE_SPEED; targetRotation = 0; }
    if (pressedButtons.down)  { playerVelocity.x += MOVE_SPEED; targetRotation = Math.PI; }
    if (pressedButtons.left)  { playerVelocity.z += MOVE_SPEED; targetRotation = -Math.PI/2; }
    if (pressedButtons.right) { playerVelocity.z -= MOVE_SPEED; targetRotation = Math.PI/2; }
    playerVelocity.y = JUMP_HEIGHT
    character.isMoving = true
    handleJumpAnimation()
  }
}

// ---------------------- Physics / collisions ----------------------
function respawnCharacter (){
  if (!character.instance) return
  character.instance.position.copy(character.spawnPosition)
  playerCollider.start.copy(character.spawnPosition).add(new THREE.Vector3(0, CAPSULE_RADIUS, 0))
  playerCollider.end.copy(character.spawnPosition).add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0))
  playerVelocity.set(0,0,0)
  character.isMoving = false
}

function playerCollisions (){
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor = false;
  if (result){
    playerOnFloor = result.normal.y > 0;
    playerCollider.translate(result.normal.multiplyScalar(result.depth));
    if (playerOnFloor){
      character.isMoving = false;
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

function updatePlayer(){
  if (!character.instance) return
  if (character.instance.position.y < -35){ respawnCharacter(); return }
  if (!playerOnFloor) { playerVelocity.y -= GRAVITY * 0.035 }
  const delta = playerVelocity.clone().multiplyScalar(0.035)
  playerCollider.translate(delta)
  playerCollisions()
  character.instance.position.copy(playerCollider.start)
  character.instance.position.y -= CAPSULE_RADIUS
  let rotationDiff = ((((targetRotation - character.instance.rotation.y) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
  let finalRotation = character.instance.rotation.y + rotationDiff
  character.instance.rotation.y = THREE.MathUtils.lerp(character.instance.rotation.y, finalRotation, 0.4)
}

// camera: restore original exact behaviour (no lerp)
function updateCameraFollowing(){
  if (!character.instance) return
  const targetCameraPosition = new THREE.Vector3(
    character.instance.position.x + cameraOffset.x,
    cameraOffset.y + 10,
    character.instance.position.z + cameraOffset.z
  )
  camera.position.copy(targetCameraPosition)
  camera.lookAt(character.instance.position.x, camera.position.y - 30, character.instance.position.z)
}

// ---------------------- Raycast hover cursor ----------------------
function updateRaycastHover(){
  if (isModalOpen) { document.body.style.cursor = 'default'; return }
  raycaster.setFromCamera(pointer, camera)
  const intersects = raycaster.intersectObjects(intersectObjects, true)
  if (intersects.length > 0) document.body.style.cursor = 'pointer'
  else document.body.style.cursor = 'default'
}

// ---------------------- animation loop ----------------------
function animate(){
  updatePlayer()
  handleContinuousMovement()
  updateCameraFollowing()
  updateRaycastHover()

  // update intersectObject for clicks (keeps last known)
  const intersects = raycaster.intersectObjects(intersectObjects, true)
  if (intersects.length > 0) {
    let node = intersects[0].object
    while (node && !intersectObjectsNames.includes(node.name)) node = node.parent
    intersectObject = node ? node.name : ""
  } else {
    intersectObject = ""
  }

  renderer.render(scene, camera)
}

renderer.setAnimationLoop(animate)

// ---------------------- UI interactions ----------------------
enterButton.addEventListener('click', () => {
  gsap.to(loadingScreen, { opacity: 0, duration: 0.3, onComplete: () => loadingScreen.remove() })
  gsap.to(instructions, { opacity: 0, duration: 0.3 })
  if (!isMuted) {
    playSound('projectsSFX')
    sounds.backgroundMusic.play()
    bgmStarted = true
  }
  mobileControlsContainer.classList.remove('hidden')
})

audioToggle.addEventListener('click', () => {
  isMuted = !isMuted
  if (isMuted) {
    audioOnSpan.classList.add('hidden')
    audioOffSpan.classList.remove('hidden')
    // pause background music cleanly
    if (sounds.backgroundMusic && typeof sounds.backgroundMusic.playing === 'function') {
      if (sounds.backgroundMusic.playing()) sounds.backgroundMusic.pause()
    } else if (sounds.backgroundMusic) {
      sounds.backgroundMusic.pause()
    }
  } else {
    audioOnSpan.classList.remove('hidden')
    audioOffSpan.classList.add('hidden')
    // resume background music
    if (sounds.backgroundMusic && typeof sounds.backgroundMusic.playing === 'function') {
      if (!sounds.backgroundMusic.playing()) sounds.backgroundMusic.play()
    } else if (sounds.backgroundMusic) {
      sounds.backgroundMusic.play()
    }
  }
})

themeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-theme')
  document.body.classList.toggle('dark-theme')
  document.body.classList.toggle('light-theme')
  if (!isMuted) playSound('projectsSFX')
})

// ---------------------- resize / focus / accessibility ----------------------
window.addEventListener('resize', () => {
  sizes.width = window.innerWidth; sizes.height = window.innerHeight
  const newAspect = sizes.width / sizes.height
  const viewSizeLocal = viewSize
  camera.top = viewSizeLocal; camera.bottom = -viewSizeLocal
  camera.left = -newAspect * viewSizeLocal; camera.right = newAspect * viewSizeLocal
  camera.updateProjectionMatrix()
  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

window.addEventListener('blur', () => {
  Object.keys(pressedButtons).forEach(k => pressedButtons[k] = false)
})

enterButton.setAttribute('tabindex', '0')
canvas.setAttribute('tabindex', '0')

// touch pointer updates (safe)
window.addEventListener('touchend', (ev) => {
  if (ev.changedTouches && ev.changedTouches[0]) updatePointerFromEvent(ev.changedTouches[0])
}, { passive: false })