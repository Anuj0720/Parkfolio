import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { gsap } from "gsap";
import { Octree } from 'three/addons/math/Octree.js'
import { Capsule } from 'three/addons/math/Capsule.js'
import { Howl, Howler } from 'howler' //audio

//loading screen 
const loadingScreen = document.getElementById('loadingScreen')
const loadingText   = document.querySelector('.loading-text')
const enterButton   = document.querySelector('.enter-button')
const instructions  = document.querySelector('.instructions')
const mobileControlsContainer = document.querySelector('.mobile-controls-container')

// Three.js LoadingManager
const manager = new THREE.LoadingManager()

manager.onLoad = () => {
  // when ALL resources using this manager are loaded
  // fade out "Loading..." and show the button
  gsap.to(loadingText, {
    opacity: 0,
    duration: 0.3,
  })

  gsap.to(enterButton, {
    opacity: 1,
    duration: 0.3,
  })
}

enterButton.addEventListener('click', () => {
  gsap.to(loadingScreen, {
    opacity: 0,
    duration: 0.3,
    onComplete: () => {
      loadingScreen.remove()
    },
  })

  gsap.to(instructions, {
    opacity: 0,
    duration: 0.3,
  })

  // 🔊 start sounds if not muted

  if (!isMuted) {
    playSound('projectsSFX')
    playSound('backgroundMusic')
  }

  // ✅ show mobile controls AFTER entering park
  mobileControlsContainer.classList.remove('hidden')
})

/** moblie controls */



function startMove(direction) {
  if (!character.instance || character.isMoving || isModalOpen) return

  switch (direction) {
    case 'up':
      playerVelocity.x -= MOVE_SPEED
      targetRotation = 0
      break
    case 'down':
      playerVelocity.x += MOVE_SPEED
      targetRotation = Math.PI
      break
    case 'left':
      playerVelocity.z += MOVE_SPEED
      targetRotation = -Math.PI / 2
      break
    case 'right':
      playerVelocity.z -= MOVE_SPEED
      targetRotation = Math.PI / 2
      break
    default:
      return
  }

  playerVelocity.y = JUMP_HEIGHT
  character.isMoving = true
  playSound('jumpSFX')
  handleJumpAnimation()
}



/**
 * Base setup
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
// const gui = new GUI()

const audioToggle = document.querySelector('.audio-toggle')

audioToggle.addEventListener('click', () => {
  isMuted = !isMuted
  if (isMuted) {
    Howler.mute(true)
    audioToggle.textContent = '🔇'
  } else {
    Howler.mute(false)
    audioToggle.textContent = '🔊'
    startBgmOnce()
  }
})

/**
 * Loaders
 */
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco')

const gltfLoader = new GLTFLoader(manager)
gltfLoader.setDRACOLoader(dracoLoader)

/**
 * sounds
 */
const sounds = {
  backgroundMusic: new Howl({
    src: ['/sfx/sfx_music.ogg'],   // from public/sfx
    loop: true,
    volume: 0.3,
    preload: true,
  }),

  projectsSFX: new Howl({
    src: ['/sfx/sfx_projects.ogg'],
    volume: 0.5,
    preload: true,
  }),

  pokemonSFX: new Howl({
    src: ['/sfx/sfx_pokemon.ogg'],
    volume: 0.5,
    preload: true,
  }),

  jumpSFX: new Howl({
    src: ['/sfx/sfx_jumpsfx.ogg'],
    volume: 1.0,
    preload: true,
  }),
}

let isMuted = false
let bgmStarted = false

function playSound(id) {
  if (!isMuted && sounds[id]) {
    sounds[id].play()
  }
}

function stopSound(id) {
  if (sounds[id]) {
    sounds[id].stop()
  }
}

function startBgmOnce() {
  if (bgmStarted || isMuted) return
  bgmStarted = true
  sounds.backgroundMusic.play()
}

/**
 * Physics constants
 */
const GRAVITY = 30
const CAPSULE_RADIUS = 0.35
const CAPSULE_HEIGHT = 1
const JUMP_HEIGHT = 10
const MOVE_SPEED = 10

/**
 * Character + collider setup
 */
let character = {
  instance: null,
  isMoving: false,
  spawnPosition : new THREE.Vector3(),
  baseScale: new THREE.Vector3(1, 1, 1)
}

let targetRotation = 0 // ✅ initialize safely

const colliderOctree = new Octree()
const playerCollider = new Capsule(
  new THREE.Vector3(0, CAPSULE_RADIUS, 0),
  new THREE.Vector3(0, CAPSULE_HEIGHT, 0),
  CAPSULE_RADIUS
)

let playerVelocity = new THREE.Vector3()
let playerOnFloor = false

/**
 * Load GLTF Scene
 */
const intersectObjects = []
const intersectObjectsNames = ["board", "board001", "board002", "board003", "character", "tuttle", "Snorlax", "name"]

gltfLoader.load('./models/shreeGarden/shree_man3.glb', (gltf) => {
  gltf.scene.traverse((child) => {

    if (intersectObjectsNames.includes(child.name)) {
      intersectObjects.push(child)
    }

    if (child.isMesh) {
      child.castShadow = true
      child.receiveShadow = true
    }

    if (child.name === "character") {

      character.spawnPosition.copy(child.position)
      character.instance = child
      character.instance.position.set(32.22153310156273,-0.3860074122666504,-88.23170146943266)
      character.baseScale.copy(child.scale)


      // ✅ Initialize collider + rotation safely
      playerCollider.start.copy(child.position).add(new THREE.Vector3(0, CAPSULE_RADIUS, 0))
      playerCollider.end.copy(child.position).add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0))
      targetRotation = child.rotation.y
    }

    if (child.name === "ground_collider") {
      colliderOctree.fromGraphNode(child);
      child.visible = false
    }
  })

  scene.add(gltf.scene)
})

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambientLight)

// const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
// directionalLight.castShadow = true
// directionalLight.position.set(50, 80, 50)
// directionalLight.shadow.mapSize.set(2048, 2048)
// directionalLight.shadow.camera.near = 0.5
// directionalLight.shadow.camera.far = 300

// directionalLight.shadow.bias = -0.0005
// directionalLight.shadow.normalBias = 0.05
// scene.add(directionalLight)
// const helper = new THREE.CameraHelper(directionalLight.shadow.camera)
// scene.add(helper)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
directionalLight.castShadow = true
directionalLight.position.set(-50, 80, 30)

directionalLight.shadow.mapSize.set(4096, 4096)

const shadowCam = directionalLight.shadow.camera
shadowCam.near = 1
shadowCam.far = 300   // already big enough, just keep it
shadowCam.left   = -150
shadowCam.right  =  150
shadowCam.top    =  150
shadowCam.bottom = -150
shadowCam.updateProjectionMatrix()

directionalLight.shadow.bias = -0.0005
directionalLight.shadow.normalBias = 0.05

scene.add(directionalLight)


/**
 * Sizes + Resize
 */
const sizes = {
  width: window.innerWidth,
  height: window.innerHeight,
  viewSize: 0.5
}

window.addEventListener('resize', () => {
  sizes.width = window.innerWidth
  sizes.height = window.innerHeight

  const newAspectRatio = sizes.width / sizes.height
  const viewSize = 25

  camera.top = viewSize
  camera.bottom = -viewSize
  camera.left = -newAspectRatio * viewSize
  camera.right = newAspectRatio * viewSize
  camera.updateProjectionMatrix()

  renderer.setSize(sizes.width, sizes.height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

/**
 * Raycaster + Mouse
 */
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
})

/**
 * Modal Content + UI
 */
const modalContent = {
  board: { 
    title: "Web Dev", 
    content: "A lightweight POS and inventory system for two-wheeler garages, built with Flask, HTML, Tailwind CSS, and JSON storage.", 
    link: "https://github.com/ULTRASIRI/POS-system-for-Gargi-Garage/?tab=readme-ov-file",
    image: "/images/garagePOS.webp"
  },
  board001: { 
    title: "Unity", 
    content: "This is a simple 2D space-shooter game made in Unity where you control a spaceship and destroy incoming asteroids.", 
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
    content: "This project is under Development", 
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

const modal = document.querySelector(".modal")
const modalTitle = document.querySelector(".modal-title")
const modalDesc = document.querySelector(".modal-project-description")
const modalExitButton = document.querySelector(".modal-exit-button")
const modalVisitProjectButton = document.querySelector(".modal-visit-button")
const modalImg = document.querySelector(".modal-img") 

//mobile controls
const mobileControls = {
  up: document.querySelector('.mobile-control.up-arrow'),
  down: document.querySelector('.mobile-control.down-arrow'),
  left: document.querySelector('.mobile-control.left-arrow'),
  right: document.querySelector('.mobile-control.right-arrow'),
}

// bind mobile controls
function bindMobileControl(el, direction) {
  if (!el) return

  // Touch
  el.addEventListener('touchstart', (e) => {
    e.preventDefault()
    startMove(direction)
  }, { passive: false })

  // Mouse (for testing in dev tools)
  el.addEventListener('mousedown', (e) => {
    e.preventDefault()
    startMove(direction)
  })
}
bindMobileControl(mobileControls.up, 'up')
bindMobileControl(mobileControls.down, 'down')
bindMobileControl(mobileControls.left, 'left')
bindMobileControl(mobileControls.right, 'right')




let isModalOpen = false; // ✅ track modal state

function showModal(id) {
  const content = modalContent[id]
  if (content) {
    playSound('projectsSFX')
    modalTitle.textContent = content.title
    modalDesc.textContent = content.content
    modal.classList.remove("hidden")
    isModalOpen = true

    if (content.link) {
      modalVisitProjectButton.href = content.link
      modalVisitProjectButton.classList.remove("hidden")
    } else {
      modalVisitProjectButton.classList.add("hidden")
    }

    // ✅ Update image dynamically
    if (content.image) {
      modalImg.src = content.image
    } else {
      modalImg.src = "/images/default.jpeg" // fallback
    }
  }
}

function hideModal() {
  playSound('projectsSFX')
  modal.classList.add("hidden")
  isModalOpen = false
}

let intersectObject = ""

/**
 * Interaction + Click
 */
function jumpCharacter(meshID) {
  const mesh = scene.getObjectByName(meshID)
  if (!mesh) return

  const jumpHeight = 2
  const jumpDuration = 0.5
  const t1 = gsap.timeline()

  t1.to(mesh.scale, { x: 1.2, y: 0.8, z: 1.2, duration: jumpDuration * 0.2 })
    .to(mesh.scale, { x: 0.8, y: 1.2, z: 0.8, duration: jumpDuration * 0.3 })
    .to(mesh.position, { y: mesh.position.y + jumpHeight, duration: jumpDuration * 0.5, ease: "power2.out" }, "<")
    .to(mesh.scale, { x: 1.5, y: 1.5, z: 1.5, duration: jumpDuration * 0.3 })
    .to(mesh.position, { y: mesh.position.y, duration: jumpDuration * 0.5, ease: "bounce.out" }, ">")
}


//character jump

function handleJumpAnimation() {
  if (!character.instance || !character.isMoving) return

  const jumpDuration = 0.3
  const base = character.baseScale

  const t1 = gsap.timeline()

  // squash
  t1.to(character.instance.scale, {
    x: base.x * 1.08,
    y: base.y * 0.93,
    z: base.z * 1.08,
    duration: jumpDuration * 0.2,
    ease: "power2.out",
  })
  .to(character.instance.scale, {
    x: base.x * 0.92,
    y: base.y * 1.07,
    z: base.z * 0.92,
    duration: jumpDuration * 0.3,
    ease: "power2.out",
  })
  // back to normal
  .to(character.instance.scale, {
    x: base.x,
    y: base.y,
    z: base.z,
    duration: jumpDuration * 0.3,
    ease: "power1.inOut",
  })
  .to(character.instance.scale, {
    x: base.x,
    y: base.y,
    z: base.z,
    duration: jumpDuration * 0.2,
    
  })
}




function onClick() {
  if (intersectObject && !isModalOpen) {
    if (["tuttle", "Snorlax"].includes(intersectObject)) {
      playSound('pokemonSFX')
      jumpCharacter(intersectObject) 
    } else {
      showModal(intersectObject)
    }
  }
}


window.addEventListener('click', (e) => {
  startBgmOnce()   // start music on first user interaction
  onClick(e)
})
modalExitButton.addEventListener("click", hideModal)

/**
 * Player Update + Controls
 */
function respawnCharacter (){
  character.instance.position.copy(character.spawnPosition)

  playerCollider.start.copy(character.spawnPosition).add(new THREE.Vector3(0, CAPSULE_RADIUS, 0))
  playerCollider.end.copy(character.spawnPosition).add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0))

  playerVelocity.set(0,0,0)
  character.isMoving = false 
}

function playerCollisions (){
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor= false;

  if (result){
    playerOnFloor = result.normal.y > 0
    playerCollider.translate(result.normal.multiplyScalar(result.depth));

    if (playerOnFloor){
      character.isMoving = false;
      playerVelocity.x = 0;
      playerVelocity.z = 0;
    }
  }
}

function updatePlayer() {

  if (!character.instance) return

  if (character.instance.position.y <-35){  //if character falls out of ground then it will respawn
    respawnCharacter();
    return;
  }

  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * 0.035
  }

  const delta = playerVelocity.clone().multiplyScalar(0.035)
  playerCollider.translate(delta)
  playerCollisions()

  character.instance.position.copy(playerCollider.start)
  character.instance.position.y -= CAPSULE_RADIUS

  const currentY = character.instance.rotation.y
  let deltaRot = targetRotation - currentY

  // wrap delta to [-PI, PI]
  deltaRot = (deltaRot + Math.PI) % (Math.PI * 2)
  if (deltaRot < 0) deltaRot += Math.PI * 2
  deltaRot -= Math.PI

  // character.instance.rotation.y = THREE.MathUtils.lerp(character.instance.rotation.y, targetRotation, 0.1)
  character.instance.rotation.y = currentY + deltaRot * 0.1

}



function onKeyDown(event) {

  const key = event.key.toLowerCase()

  if (key === "r") {
    respawnCharacter()
    return
  }

  if (key === 'w' || key === 'arrowup') {
    startMove('up')
  } else if (key === 's' || key === 'arrowdown') {
    startMove('down')
  } else if (key === 'a' || key === 'arrowleft') {
    startMove('left')
  } else if (key === 'd' || key === 'arrowright') {
    startMove('right')
  }
}

window.addEventListener("keydown", onKeyDown)

/**
 * Camera
 */
const aspectRatio = sizes.width / sizes.height
const viewSize = 25

const camera = new THREE.OrthographicCamera(
  -aspectRatio * viewSize,
  aspectRatio * viewSize,
  viewSize,
  -viewSize,
  0.1,
  1000
)
camera.position.set(30, 30, 30)

const cameraOffset = new THREE.Vector3(30,30,30)
scene.add(camera)

/**
 * Renderer
 */
const renderer = new THREE.WebGLRenderer({ canvas })
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(sizes.width, sizes.height)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.5
renderer.setClearColor(0x97e460)

/**
 * Animate
 */
function animate() {
  updatePlayer()

  if (character.instance){
    const targetCameraPosition = new THREE.Vector3(
      character.instance.position.x + cameraOffset.x , 
      cameraOffset.y +10 ,
      character.instance.position.z + cameraOffset.z
    )
    camera.position.copy(targetCameraPosition)

    camera.lookAt(character.instance.position.x, camera.position.y - 30, character.instance.position.z)
  }

  //when modal is open 
  if (!isModalOpen) {
      // Raycasting disabled while modal is open
    raycaster.setFromCamera(pointer, camera);
  
    // Raycast against the whole scene or your pre-collected list.
    const intersects = raycaster.intersectObjects(scene.children, true);
  
    if (intersects.length > 0) {
      // walk intersects in order (closest first) and climb parents until we find a named interactable
      let foundName = "";
      for (let i = 0; i < intersects.length; i++) {
        let o = intersects[i].object;
        while (o) {
          if (intersectObjectsNames.includes(o.name)) {
            foundName = o.name;
            break;
          }
          o = o.parent;
        }
        if (foundName) break;
      }
  
      if (foundName) {
        intersectObject = foundName;
        document.body.style.cursor = "pointer";
      } else {
        intersectObject = "";
        document.body.style.cursor = "default";
      }
  
    } else {
      intersectObject = "";
      document.body.style.cursor = "default";
    }
  } else {
    intersectObject = "";
    document.body.style.cursor = "default";
  }

  renderer.render(scene, camera)
  window.requestAnimationFrame(animate)
}

animate()
