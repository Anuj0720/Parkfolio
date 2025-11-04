import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { gsap } from "gsap";
import { Octree } from 'three/addons/math/Octree.js'
import { Capsule } from 'three/addons/math/Capsule.js'

/**
 * Base setup
 */
const canvas = document.querySelector('canvas.webgl')
const scene = new THREE.Scene()
// const gui = new GUI()

/**
 * Loaders
 */
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('/draco')

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(dracoLoader)

/**
 * Physics constants
 */
const GRAVITY = 30
const CAPSULE_RADIUS = 0.35
const CAPSULE_HEIGHT = 1
const JUMP_HEIGHT = 10
const MOVE_SPEED = 5

/**
 * Character + collider setup
 */
let character = {
  instance: null,
  isMoving: false,
  spawnPosition : new THREE.Vector3()
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

  // gltf.scene.scale.set(0.25, 0.25, 0.25)
  scene.add(gltf.scene)
})

/**
 * Lights
 */
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
scene.add(ambientLight)

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.8)
directionalLight.castShadow = true
directionalLight.position.set(-5, 20, 5)
directionalLight.shadow.mapSize.set(4096, 4096)
directionalLight.shadow.camera.near = 0.5
directionalLight.shadow.camera.far = 100
scene.add(directionalLight)

// scene.add(new THREE.CameraHelper(directionalLight.shadow.camera))

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
  const viewSize = 0.5

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
  board: { title: "Project One", content: "This is project One", link: "https://example.com/" },
  board001: { title: "Project Two", content: "This is project Two", link: "https://example.com/" },
  board002: { title: "Project Three", content: "This is project Three", link: "https://example.com/" },
  board003: { title: "Project Four", content: "This is project Four", link: "https://example.com/" },
  name: { title: "This is name", content: "shree" },
}

const modal = document.querySelector(".modal")
const modalTitle = document.querySelector(".modal-title")
const modalDesc = document.querySelector(".modal-project-description")
const modalExitButton = document.querySelector(".modal-exit-button")
const modalVisitProjectButton = document.querySelector(".modal-visit-button")

function showModal(id) {
  const content = modalContent[id]
  if (content) {
    modalTitle.textContent = content.title
    modalDesc.textContent = content.content
    modal.classList.toggle("hidden")

    if (content.link) {
      modalVisitProjectButton.href = content.link
      modalVisitProjectButton.classList.remove("hidden")
    } else {
      modalVisitProjectButton.classList.add("hidden")
    }
  }
}

function hideModal() {
  modal.classList.toggle("hidden")
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
    .to(mesh.scale, { x: 0.8, y: 1.3, z: 0.8, duration: jumpDuration * 0.3 })
    .to(mesh.position, { y: mesh.position.y + jumpHeight, duration: jumpDuration * 0.5, ease: "power2.out" }, "<")
    .to(mesh.scale, { x: 1.5, y: 1.5, z: 1.5, duration: jumpDuration * 0.3 })
    .to(mesh.position, { y: mesh.position.y, duration: jumpDuration * 0.5, ease: "bounce.out" }, ">")
}

function onClick() {
  if (intersectObject) {
    if (["tuttle", "Snorlax"].includes(intersectObject)) {
      jumpCharacter(intersectObject)
    } else {
      showModal(intersectObject)
    }
  }
}

window.addEventListener('click', onClick)
modalExitButton.addEventListener("click", hideModal)

/**
 * Player Update + Controls
 */

function respawnCharacter (){
  character.instance.position.copy(character.spawnPosition)

  playerCollider.start.copy(character.spawnPosition).add(new THREE.Vector3(0, CAPSULE_RADIUS, 0))
  playerCollider.end.copy(character.spawnPosition).add(new THREE.Vector3(0, CAPSULE_HEIGHT, 0))

//character will not move once respawned
  playerVelocity.set (0,0,0)
  character.isMoving= false 
}

function playerCollisions (){
  const result = colliderOctree.capsuleIntersect(playerCollider);
  playerOnFloor= false;

  if (result){
    playerOnFloor =result.normal.y > 0
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

  if (character.instance.y <-0.1){
    respawnCharacter();
    return;
  }

  // Apply gravity
  if (!playerOnFloor) {
    playerVelocity.y -= GRAVITY * 0.035
  }

  // Move player
  const delta = playerVelocity.clone().multiplyScalar(0.035)
  playerCollider.translate(delta)
  playerCollisions()

  // Update character position and rotation
  character.instance.position.copy(playerCollider.start)
  character.instance.position.y -= CAPSULE_RADIUS


  character.instance.rotation.y = THREE.MathUtils.lerp(character.instance.rotation.y, targetRotation, 0.1)
}


function onKeyDown(event) {

  if (event.key.toLowerCase()=== "r"){  //debug_ui
    respawnCharacter()
    return
  }
  if (!character.instance || character.isMoving) return

  switch (event.key.toLowerCase()) {
    case "w":
    case "arrowup":
      playerVelocity.x -= MOVE_SPEED
      targetRotation = 0
      break
    case "s":
    case "arrowdown":
      playerVelocity.x += MOVE_SPEED
      targetRotation = Math.PI
      break
    case "a":
    case "arrowleft":
      playerVelocity.z += MOVE_SPEED
      targetRotation = -Math.PI / 2
      break
    case "d":
    case "arrowright":
      playerVelocity.z -= MOVE_SPEED
      targetRotation = Math.PI / 2
      break
    default:
      return
  }

  playerVelocity.y = JUMP_HEIGHT
  character.isMoving = true
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
// scene.add(new THREE.CameraHelper(camera))

/**
 * Controls
 */


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
    camera.lookAt(character.instance.position)
    const targetCameraPosition = new THREE.Vector3(
      character.instance.position.x + cameraOffset.x , 
      cameraOffset.y ,
      character.instance.position.z + cameraOffset.z );
    camera.position.copy(targetCameraPosition)

    camera.lookAt(character.instance.position.x,camera.position.y -30 ,character.instance.position.z)

  }
  
  // controls.update()

  raycaster.setFromCamera(pointer, camera)
  const intersects = raycaster.intersectObjects(intersectObjects, true)

  if (intersects.length > 0) {
    document.body.style.cursor = "pointer"
    intersectObject = intersects[0].object.parent.name
  } else {
    document.body.style.cursor = "default"
    intersectObject = ""
  }


  renderer.render(scene, camera)
  window.requestAnimationFrame(animate)
}

animate()
