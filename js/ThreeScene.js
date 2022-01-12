import * as THREE from './three/build/three.module.js';
import { PointerLockControls } from './three/examples/jsm/controls/PointerLockControls.js';
import {DDSLoader} from "./three/examples/jsm/loaders/DDSLoader.js";
import {MTLLoader} from "./three/examples/jsm/loaders/MTLLoader.js";
import {OBJLoader} from "./three/examples/jsm/loaders/OBJLoader.js";
import {GLTFLoader} from "./three/examples/jsm/loaders/GLTFLoader.js";

let camera, scene, renderer, manager, controls, mixer, animationMap, timer, taskTimer, dir, activeAction, rotateAngle, animalRaycast;
let animal, result, foodObj, waterObj, animalObj, clock, previous, choice, cursorIntersection, INTERSECTED, prev, delta, animClock;
let objectLoaded = false, saving = false, saved = false, saveMode = null, config, listener, radioState = false, sound
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false, crouch = false, slide = false, comeEat = false, comeDrink = false, rotatedX = false, rotatedZ = false, dead = false;
let objects = [], raycaster = [], animals = [], savedData = [], food = [], poops = [];
let loading = 0, type = "", speed = 1000, saveName = "", camPosY = 0, task = 6, animlength = 1,
    chosenState = -1, duration = 2, animSpeed = 10, prevState, prevPos, finishX, finishZ;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const mouse = new THREE.Vector2();

window.onload = main
function main(){
    $('.overlay').hide()
    $('#menu').hide()
    $('#saves').hide()
    $('.deadMessage').hide()

    $('#playButton').on( 'click', function () {
        $('#instructions').hide()
        $('#menu').show()
    });

    $('#startButton').on( 'click', function () {
        if(type !== "") {
            newGame();
            controls.lock();
        } else {
            printError("Empty choice")
        }
    });

    $('#loadButton').on( 'click', function () {
        saveMode = false;
        showScores();
    });

    $('#resumeButton')
        .on( 'click', function () {
            controls.lock();
    }).css("display", "none");

    $('#saveButton').on( 'click', function () {
        saveMode = true;
        showScores()
    }).css("display", "none");

    $('.backButton').on( 'click', function () {
        $('#saves').hide()
        $('#menu').hide()
        $('#instructions').show()
        saving = false;
        saveMode = null;
        if(objectLoaded)
            $('#resumeButton').css("display", "flex");

    });

    $('.animalOption').on('click', function () {
        $('.animalOption').css("color", "#858585")
        $('.animalOption:hover').css("color", "#ffffff")
        $(this).css("color", "#80be1b");
        type = this.id;
    })
    init()
}

function newGame() {
    animal = {
        type: type,
        foodType: null,
        food: 100,
        health: 100,
        age: 0,
        happiness: 100,
        cleanliness: 100,
        foodObj: false,
        waterObj: false,
        object: {
            position: {x: 0, y: 0, z: 0},
            rotation: {x: 0, y: 0, z: 0},
            scale: {x: 0, y: 0, z: 0},
        }
    }
    writetats("")
    camera.position.set(10, 14, -10)
    camera.rotation.set(0, 3, 0)
    camPosY = camera.position.y
    clock = new THREE.Clock()
    clock.start()

    animClock = new THREE.Clock()
    animClock.start()

    timer = new THREE.Clock()
    timer.start()

    taskTimer = new THREE.Clock()
    taskTimer.start()

    chosenState = -1
    task = 6
    animlength = 1
    duration = 2;
    dead = false
    mouse.x = 0
    mouse.y = 0
    addObjects();
}

function loadGame(index) {
    result = localStorage.getItem("save" + index);
    if (result === null) {
        printError("Nothing to be loaded")
        return
    }
    result = JSON.parse(result)
    if (!objectLoaded) {
        type = result.animal.type
        newGame()
    }
    if(objectLoaded){
        continueLoad()
    }
}

function continueLoad() {
    scene.remove(animalObj)
    poops.forEach(p => scene.remove(p))
    poops = []
    objects = objects.filter(function(ele){
        return ele !== animalObj;
    });
    for(let animal of animals){
        if(animal.type === result.animal.type){
            choice = animal
        }
    }
    if(choice === undefined){
        choice = animals[0]
    }
    animal.type = choice.type;

    new GLTFLoader().load(choice.pathObj, function (gltf){
        animalObj = gltf.scene;
        animalObj.traverse(function (object){
            if(object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true
                object.frustumCulled = false;
                object.outputEncoding = THREE.sRGBEncoding;
            }
        })

        if(animal.type === "cat"){
            animalObj.children.forEach(a => {
                a.rotation.z = 3.2
            })
        }

        animalObj.receiveShadow = true;
        animalObj.castShadow = true;
        animalObj.name = "animal";
        animalObj.scale.set(result.animal.object.scale.x, result.animal.object.scale.y, result.animal.object.scale.z)
        animalObj.position.set(result.animal.object.position.x, result.animal.object.position.y, result.animal.object.position.z)
        animalObj.rotation.set(result.animal.object.rotation.x, result.animal.object.rotation.y, result.animal.object.rotation.z)
        scene.add(animalObj)
        objects.push(animalObj)
        objectLoaded = true;


        let animations = gltf.animations;
        mixer = new THREE.AnimationMixer(animalObj);
        animationMap = new Map()
        animations.forEach(a => {
            let name, action, cycle
            for (let i = 0; i < choice.animations.length; i++){
                if(choice.animations[i].name === a.name){
                    name = choice.animations[i].type
                    cycle = choice.animations[i].cycle
                    break;
                }
            }
            action = mixer.clipAction(a)
            action.name = name
            if(!cycle){
                action.clampWhenFinished = true;
                action.loop = THREE.LoopOnce;
            }
            animationMap.set(name, action)
        })

        if(animationMap.get("walk") !== undefined){
            animlength +=1
        }
        if(animationMap.get("idleSit") !== undefined){
            animlength +=1
        }
        if(animationMap.get("idleLie") !== undefined){
            animlength +=1
        }
        activeAction = animationMap.get("idle")
        activeAction.play();
    })

    result.poopData.forEach(p => {
        dropPoop(p.position.x, p.position.z)

    })

    animal.foodObj = result.animal.foodObj
    animal.waterObj = result.animal.waterObj
    if(animal.foodObj)
        feed()
    if(animal.waterObj)
        giveWater()

    renderer.render( scene, camera );
    animal.age = result.animal.age;
    animal.health = result.animal.health;
    animal.foodType = choice.foodType;
    animal.food = result.animal.food
    animal.happiness = result.animal.happiness;
    animal.cleanliness = result.animal.cleanliness
    writetats("")
    camera.position.set(result.camera.x, result.camera.y, result.camera.z);
    camera.rotation.set(result.camera.rx, result.camera.ry, result.camera.rz)
    let stage = animal.age > 5 ? 5 : animal.age
    animSpeed = choice.stages[stage].speed

    $('#resumeButton').css("display", "flex")
}

function saveGame(index) {
    saved=false;
    if(animal === undefined){
        console.log("animal not exists")
        return
    }

    if(index === undefined){
        console.log("index not exists")
        return
    }

    animal.object = {
        position: {x: animalObj.position.x, y: animalObj.position.y, z: animalObj.position.z},
        rotation: {x: animalObj.rotation.x, y: animalObj.rotation.y, z: animalObj.rotation.z},
        scale: {x: animalObj.scale.x, y: animalObj.scale.y, z: animalObj.scale.z},
    }

    let poopData = []
    poops.forEach(p => {
        poopData.push({
            position: {x: p.position.x, z: p.position.z},
        })
    })

    savedData = {
        name: saveName,
        animal: animal,
        poopData: poopData,
        camera: {x: camera.position.x, y: camera.position.y, z: camera.position.z,
                rx: camera.rotation.x, ry: camera.rotation.y, rz: camera.rotation.z},
        savedAt: +new Date().getDay() + ". "+new Date().getDate()+ ". "+new Date().getFullYear()
    }
    let jsonContent = JSON.stringify(savedData);
    localStorage.setItem("save"+index, jsonContent)
    saved = true;
    showScores();
}

function showScores() {
    let stringBuilder =
        "<tr class='tableTitle'>" +
        "<th>Slot</th>"+"<th>Name</th>"+"<th>Animal</th>"+"<th>Last saved</th></tr>"

    for(let i = 0; i < 5; i++){
        let data = localStorage.getItem("save"+i)
        data = JSON.parse(data)
        stringBuilder += "<tr class='row' id='row"+ i +"'><td>"+ i +"</td>";
        if(data === null){
            stringBuilder +=
                "<td class='saveTitle"+ i +"'>No saved data</td>"+
                "<td></td>"+
                "<td></td>"
        }else {
            stringBuilder +=
                "<td>"+ data.name +"</td>"+
                "<td>"+ data.animal.type +"</td>"+
                "<td>"+ data.savedAt +"</td>" +
                "<td class='deleteIcon'><i class='fas fa-trash-alt delete' id='delete"+ i +"'></i></td>"
        }
        stringBuilder += "</tr>";
    }
    $('.savesTable').html(stringBuilder)
    $('#saves').show()
    $('#instructions').hide()
    $('#menu').hide()
    $('.delete').hide()
}



$("body")
    .delegate('.row','click',function (){
        let index = this.id.slice(-1)
        if(saveMode){
            let isIn = localStorage.getItem("save"+index)
            if(!saving && isIn=== null){
                $('.saveTitle' + index).html("<input type='text' class='titleForm' id='form"+ index +"'><button id='save'>Save</button>")
                saving = true;
            } else if(!saving && !saved && isIn !== null){
                printError("Slot already taken")
            } else {
                saved = false
            }
        } else {
            loadGame(index)
        }
    })
    .delegate('#save','click',function (){
        let form = $('.titleForm');
        let temp = form.val()
        let index = form.attr("id").slice(-1)
        if(temp !== undefined && temp !== ""){
            saveName = temp;
            saving = false
            saveGame(index);
        } else {
            printError("Name is required!")
        }
    })
    .delegate('.row','mouseenter',function (){
        let index = this.id.slice(-1)
        $('#delete'+index).show()
            .on("click", function (){
                localStorage.removeItem("save"+index)
                showScores()
            })
    })
    .delegate('.row','mouseleave',function (){
        let index = this.id.slice(-1)
        $('#delete'+index).hide()
    })

function printError(error) {
    $('#alertBox').css("opacity", "1")
    $('#errorMessage') .html(error)
    setTimeout(() => {$('#alertBox').css("opacity", "0")}, 2000);
}

function init() {

    config = {
        speedMultiplier: 1,
        growSpeed: 5,
        poopSpeed: 10,
        hungerSpeed: 3,
        maxStateLength: 10,
        maxTaskLength: 10
    }

    animals= [{
            type: "dog",
            foodType: "meat",
            pathObj: 'models/shepherd_animated/scene.gltf',
            baseRotation: {x: 0, y: 5, z: 0},
            stages: [
                {scale: 0.09, position: 1.2, speed: 0.8},
                {scale: 0.18, position: 1.2, speed: 1.2},
                {scale: 0.3, position: 1.2, speed: 1.9},
                {scale: 0.35, position: 1.2, speed: 2.3},
                {scale: 0.4, position: 1.2, speed: 2.9},
                {scale: 0.45, position: 1.2, speed: 3.4}
            ],
            animations: [
                {type: "idle", name: "Idle1", cycle: true},
                {type: "idleExtra", name: "IdleEarTwitch", cycle: false},
                {type: "walk", name: "WalkCycle", cycle: true},
                {type: "walkExtra", name: "WalkSniff", cycle: true},
                {type: "sitDown", name: "SitDown", cycle: false},
                {type: "sitUp", name: "StandUp", cycle: false},
                {type: "idleSit", name: "IdleSit", cycle: true},
                {type: "idleSitExtra", name: "SitScratchEar", cycle: false},
                {type: "standUp", name: "SitUp", cycle: false},
                {type: "layDown", name: "LayDown", cycle: false},
                {type: "idleLie", name: "IdleLieDown", cycle: true},
                {type: "jump", name: "Jump", cycle: false},
                {type: "run", name: "RunCycle", cycle: true}
            ]
        },{
            type: "rabbit",
            foodType: "grass",
            pathObj: '../models/rabbit_animated/scene.gltf',
            baseRotation: {x: 0, y: 5, z: 0},
            stages: [
                {scale: 4, position: 1.1, speed: 0.8},
                {scale: 6, position: 1.1, speed: 1.2},
                {scale: 8, position: 1.1, speed: 1.9},
                {scale: 10, position: 1.1, speed: 2.3},
                {scale: 12, position: 1.1, speed: 2.9},
                {scale: 15, position: 1.1, speed: 3.4}
            ],
            animations: [
                {type: "idle", name: "metarig|Idle", cycle: true},
                {type: "idleExtra", name: "metarig|Idle2", cycle: false},
                {type: "walk", name: "metarig|walk", cycle: true},
                {type: "run", name: "metarig|run", cycle: true},
                {type: "eat", name: "metarig|eat", cycle: false}
            ]
        },{
            type: "cat",
            foodType: "meat",
            pathObj: '../models/cat_animated/scene.gltf',
            baseRotation: {x: 0, y: 4.5, z: 0},
            stages: [
                {scale: 0.4, position: 1.65, speed: 0.8},
                {scale: 0.6, position: 2, speed: 0.9},
                {scale: 0.8, position: 2.35, speed: 1.1},
                {scale: 1, position: 2.7, speed: 1.3},
                {scale: 1.2, position: 3.05, speed: 1.5},
                {scale: 1.4, position: 3.4, speed: 1.7}
            ],
            animations: [
                {type: "idle", name: "Idle", cycle: true},
                {type: "walk", name: "Walk", cycle: true},
                {type: "sitDown", name: "SitDown", cycle: false},
                {type: "idleSit", name: "SittingIdle", cycle: true},
                {type: "sitUp", name: "StandUp", cycle: false},
            ]
        },
        {
            type: "chicken",
            foodType: "grain",
            pathObj: '../models/chicken_animated/scene.gltf',
            baseRotation: {x: 0, y: 5, z: 0},
            stages: [
                {scale: 0.01, position: 1.1, speed: 0.8},
                {scale: 0.015, position: 1.1, speed: 0.9},
                {scale: 0.02, position: 1, speed: 1},
                {scale: 0.025, position: 1, speed: 1.2},
                {scale: 0.03, position: 1, speed: 1.3},
                {scale: 0.04, position: 1, speed: 1.4}
            ],
            animations: [
                {type: "idle", name: "idle", cycle: true},
                {type: "eat", name: "Esqueleto|picotear", cycle: false},
                {type: "walk", name: "EsqueletoAction", cycle: true}
            ]
        },{
            type: "trex",
            foodType: "meat",
            pathObj: '../models/trex_animated/scene.gltf',
            baseRotation: {x: 0, y: 5, z: 0},
            stages: [
                {scale: 0.4, position: 1, speed: 0.8},
                {scale: 0.5, position: 1, speed: 1.2},
                {scale: 0.7, position: 1, speed: 1.9},
                {scale: 1.1, position: 1, speed: 2.3},
                {scale: 1.3, position: 1, speed: 2.9},
                {scale: 1.5, position: 1, speed: 3.4}
            ],
            animations:  [
                {type: "idle", name: "idle", cycle: true},
                {type: "idleExtra", name: "roar", cycle: false},
                {type: "walk", name: "run", cycle: true},
                {type: "eat", name: "bite", cycle: false}
            ]
    }]

    food = [{
            type: "meat",
            pathObj: 'models/beaf-steak/BeafSteak.obj',
            pathMtl: 'models/beaf-steak/material.lib',
            scale: {x: 0.008, y: 0.008, z: 0.008},
            position: {x: -30, y: 1.5, z: 31},
            rotation: {x: 0, y: 2, z: 0}
        },{
            type: "grass",
            pathObj: 'models/cabbage/cabbage/cabbage.obj',
            pathMtl: 'models/cabbage/cabbage/bapcai2_giam_diem.mtl',
            scale: {x: 0.02, y: 0.02, z: 0.02},
            position: {x: -30, y: 1.5, z: 31},
            rotation: {x: 5.2, y: 0, z: 0}
        },{
            type: "grain",
            pathObj: 'models/grain/height.obj',
            pathMtl: 'models/grain/material.mtl',
            scale: {x: 1.35, y: 1.35, z: 1.35},
            position: {x: -30, y: 0, z: 31},
            rotation: {x: 0, y: 0, z: 0}
        },{
            type: "water",
            pathObj: 'models/water-animation/source/Water_Animation.obj',
            pathMtl: 'models/water-animation/source/material.mtl',
            scale: {x: 0.027, y: 0.027, z: 0.027},
            position: {x: -36.2, y: 2.1, z: 31.3},
            rotation: {x: 0, y: 2.3, z: 0}
    }]

    camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 0.01, 1000 );
    camera.position.set(10, 10, -10);
    camera.rotation.set(0, 3, 0);
    camPosY = camera.position.y
    controls = new PointerLockControls( camera, document.body );

    $('#resumeButton')
        .on( 'click', function () {
            controls.lock();
        }).css("display", "none");

    controls.addEventListener( 'lock', function () {
        $('#instructions').css("display", "none")
        $('#blocker').css("display", "none")
        $('.overlay').show()
    });

    controls.addEventListener( 'unlock', function () {
        $('#instructions').css("display", "")
        let blocker = $('#blocker')
        blocker.css("display", "flex")
        $('.overlay').hide()
        $('#menu').hide()
        if(objectLoaded){
            let saveButton = $('#saveButton')
            let resumeButton = $('#resumeButton')
                saveButton.css("display", "flex")
                resumeButton.css("display", "flex")
            if(dead){
                resumeButton.hide()
                saveButton.hide()
                $('.deadMessage').show()
                blocker.css('backgroundColor', `rgba(0, 0, 0, 0.98)`)
                $('#deadStats').html(
                    `<span class="dstat"><i class="fa fa-arrows-alt-v blue"></i>Age: ${animal.age}</span>
                    <span class="dstat"><i class="fa fa-heartbeat red"></i>Health: ${animal.health}</span>
                    <span class="dstat"><i class="fa fa-drumstick-bite brown"></i>Food: ${animal.food}</span>
                    <span class="dstat"><i class="fa fa-grin-beam yellow"></i>Happiness: ${animal.happiness}</span>
                    <span class="dstat"><i class="fa fa-poop brown1"></i>Cleanliness: ${animal.cleanliness}</span>`)
            }
        }
    });
    document.addEventListener("click", function (){
        if(!INTERSECTED)
            return
        if(INTERSECTED.parent.name === "poop"){
            cleanPoop(INTERSECTED.parent)
        }
        else if(INTERSECTED.parent.name === "bowl"){
            feed()
        }
        else if(INTERSECTED.parent.name === "waterbowl"){
            giveWater()
        }else if(INTERSECTED.name === "radio"){
            if(!radioState){
                sound.play();
                radioState = true
            }
            else{
                sound.stop()
                radioState = false
            }
            let tooltipMsg = !radioState ? INTERSECTED.userData.tooltip : "Stop music"
            $('#tooltip')
                .html(tooltipMsg)
                .show()
        }
    })

    manager = new THREE.LoadingManager();
    manager.addHandler(/\.dds$/i, new DDSLoader());
    scene = new THREE.Scene();

    let light = new THREE.AmbientLight( 0xffffff, 0.5 );
    scene.add( light );
    light = new THREE.SpotLight( 0xeeeeff, 2, 250);
    light.position.set( 0, 70, 0 );
    light.castShadow = true;
    light.shadow.mapSize.width = 512;
    light.shadow.mapSize.height = 512;
    light.shadow.camera.near = 40;
    light.shadow.camera.far = 100;
    light.shadow.focus = 1;
    scene.add( light );

    light = new THREE.PointLight( 0xeeeeff, 1, 20)
    light.position.set( 0, 30, 0 );
    light.castShadow = true;
    scene.add( light );

    renderer = new THREE.WebGLRenderer( { antialias: true, alpha: true , powerPreference: "high-performance",} );
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio( window.devicePixelRatio );
    renderer.setSize( window.innerWidth, window.innerHeight );
    document.body.appendChild( renderer.domElement );
    window.addEventListener( 'resize', function (){
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize( window.innerWidth, window.innerHeight );
    } );

    initMovement()
    render();
}

async function render() {
    requestAnimationFrame( render );

    if(loading > 13 && !dead){
        await Promise.allSettled([
            handleTime(),
            handleMovement(),
            moveAnimal(),
            updateStats()
        ])
    }else if(dead){
        controls.unlock()
    }
    renderer.render( scene, camera );
}

async function handleTime(){
    const delta1 = clock.getDelta()
    if(mixer) mixer.update(delta1)
}

function writetats(id){
    switch (id){
        case "health": $("#health").html(`Health: ${ animal.health }`) ;break
        case "food": $("#food").html(`Food: ${ animal.food }`) ;break
        case "age": $("#age").html(`Age: ${ animal.age }`);break
        case "happiness":
            animal.happiness = Math.round((animal.cleanliness*2.5 + animal.food + animal.health*3.5)/7);
            $("#happiness").html(`Happiness: ${ animal.happiness }`) ;break
        case "cleanliness": $("#cleanliness").html(`Cleanliness: ${ animal.cleanliness }`) ;break
        default:
            $("#health").html(`Health: ${ animal.health }`)
            animal.happiness = Math.round((animal.cleanliness*2.5 + animal.food + animal.health*3.5)/7);
            $("#happiness").html(`Happiness: ${ animal.happiness }`)
            $("#food").html(`Food: ${ animal.food }`)
            $("#age").html(`Age: ${ animal.age }`)
            $("#cleanliness").html(`Cleanliness: ${ animal.cleanliness }`)
    }
}

async function updateStats(){
    let time = Math.round(clock.getElapsedTime())
    if(time === previous || time === 0) {
        return
    }
    if(time%(config.growSpeed*config.speedMultiplier) === 0){
        await grow()
    }
    if(time%(config.poopSpeed*config.speedMultiplier) === 0){
        await dropPoop()
    }
    if(time%(config.hungerSpeed*config.speedMultiplier) === 0){
        await hunger()
    }

    previous = time;
}

function initMovement() {
    const onKeyDown = function ( event ) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'ShiftLeft':
                speed = 2000;
                crouch = true
                break;
            case 'ControlLeft':
                slide =  !slide;
                speed = slide ? 3000 : 1000;
                break;
        }
    };

    const onKeyUp = function ( event ) {
        switch ( event.code ) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
            case 'ShiftLeft':
                speed = slide ? 3000 : 1000;
                crouch = false
                break;
        }
    };
    document.addEventListener( 'keydown', onKeyDown );
    document.addEventListener( 'keyup', onKeyUp );

    raycaster.cursor = new THREE.Raycaster()
    raycaster.front = new THREE.Raycaster(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z), new THREE.Vector3(1, 0, 0), 0, 2);
    raycaster.back = new THREE.Raycaster(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z), new THREE.Vector3(-1, 0, 0), 0, 2);
    raycaster.left = new THREE.Raycaster(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z), new THREE.Vector3(0, 0, -1), 0, 2);
    raycaster.right = new THREE.Raycaster(new THREE.Vector3(camera.position.x, camera.position.y, camera.position.z), new THREE.Vector3(0, 0, 1), 0, 2);
}

async function handleMovement(){
    const time = performance.now();
    if ( controls.isLocked === true) {

        raycaster.cursor.setFromCamera( mouse, camera );
        raycaster.front.ray.origin = new THREE.Vector3(camera.position.x, camera.position.y-7, camera.position.z)
        raycaster.back.ray.origin = new THREE.Vector3(camera.position.x, camera.position.y-7, camera.position.z)
        raycaster.right.ray.origin = new THREE.Vector3(camera.position.x, camera.position.y-7, camera.position.z)
        raycaster.left.ray.origin = new THREE.Vector3(camera.position.x, camera.position.y-7, camera.position.z)

        raycaster.front.ray.direction = new THREE.Vector3(1, 0, 0)
        raycaster.back.ray.direction = new THREE.Vector3(-1, 0, 0)
        raycaster.right.ray.direction = new THREE.Vector3(0, 0, 1)
        raycaster.left.ray.direction = new THREE.Vector3(0, 0, -1)

        raycaster.cursor.far = 9
        //scene.add(new THREE.ArrowHelper( raycaster.cursor.ray.direction, raycaster.cursor.ray.origin, raycaster.cursor.far, Math.random() * 0xffffff, 1, 0.1 ));

        // console.log(raycaster.front.ray.direction, raycaster.front.ray.origin)
        // scene.add(new THREE.ArrowHelper( raycaster.front.ray.direction, raycaster.front.ray.origin, 5, Math.random() * 0xffffff, 1, 2 ));
        // scene.add(new THREE.ArrowHelper( raycaster.right.ray.direction, raycaster.right.ray.origin, 5, Math.random() * 0xffffff, 1, 2 ));
        // scene.add(new THREE.ArrowHelper( raycaster.left.ray.direction, raycaster.left.ray.origin, 5, Math.random() * 0xffffff, 1, 2 ));
        // scene.add(new THREE.ArrowHelper( raycaster.back.ray.direction, raycaster.back.ray.origin, 5, Math.random() * 0xffffff, 1, 2 ));
        if(crouch){
            camera.position.y = camPosY
            camPosY--;
            if(camPosY < 8){
                camPosY = 8;
            }
        }
        if(slide){
            camera.position.y = camPosY
            camPosY--;
            if(camPosY < 4){
                camPosY = 4;
            }
        }

        if(!crouch && !slide && camPosY < 14){
            camera.position.y = camPosY
            camPosY++;
            if(camPosY > 14){
                camPosY = 14;
            }
        }

        let delta1 = ( time - prevTime ) / speed;

        velocity.x -= velocity.x * 10.0 * delta1;
        velocity.z -= velocity.z * 10.0 * delta1;

        direction.z = Number( moveForward ) - Number( moveBackward );
        direction.x = Number( moveRight ) - Number( moveLeft );
        direction.normalize(); // this ensures consistent movements in all directions

        if ( moveForward || moveBackward ) velocity.z -= direction.z * 400.0 * delta1;
        if ( moveLeft || moveRight ) velocity.x -= direction.x * 400.0 * delta1;
        const interFront = raycaster.front.intersectObjects( objects, false );
        const interBack = raycaster.back.intersectObjects( objects, false );
        const interRight = raycaster.right.intersectObjects( objects, false );
        const interLeft = raycaster.left.intersectObjects( objects, false );
        cursorIntersection = raycaster.cursor.intersectObjects( [...objects, ...poops], true );

        if ( cursorIntersection.length > 0
            &&(cursorIntersection[0].object.parent.name ==="bowl"
            || cursorIntersection[0].object.parent.name === "waterbowl"
            || cursorIntersection[0].object.parent.name === "poop"
            || cursorIntersection[0].object.name === "radio")){

            if ( cursorIntersection[0].object !== INTERSECTED){
                if ( INTERSECTED && INTERSECTED.material.color !== undefined ) {
                    INTERSECTED.children.forEach(c => {
                        c.material.color.setHex(INTERSECTED.currentHex);
                    })
                    INTERSECTED.material.color.setHex(INTERSECTED.currentHex);
                }
                INTERSECTED = cursorIntersection[0].object;
                INTERSECTED.children.forEach(c => {
                    c.currentHex = INTERSECTED.material.color.getHex();
                    c.material.color.setHex(0x6dfd30);
                })
                INTERSECTED.currentHex = INTERSECTED.material.color.getHex();
                INTERSECTED.material.color.setHex(0x6dfd30);
                let tooltipMsg = radioState && cursorIntersection[0].object.name === "radio" ? "Stop music" : INTERSECTED.userData.tooltip
                $('#tooltip')
                    .html(tooltipMsg)
                    .show()
            }
        }
        else {
            if ( INTERSECTED && INTERSECTED.material.color !== undefined )
                INTERSECTED.material.color.setHex( INTERSECTED.currentHex );
            INTERSECTED = null;
            $('#tooltip').hide()
        }

        let dir = controls.getDirection(new THREE.Vector3(0, 0, 0))

            if(interFront.length > 0)
                await handleIntersection(interFront, "front", dir)
            if(interBack.length > 0)
                await handleIntersection(interBack, "back", dir)
            if(interLeft.length > 0)
                await handleIntersection(interLeft, "left", dir)
            if(interRight.length > 0)
                await handleIntersection(interRight, "right", dir)

        controls.moveForward(-velocity.z * delta1);
        controls.moveRight(-velocity.x * delta1);
    }
    prevTime = time;
}

async function handleIntersection(intersect, direction, dir){
    let dirX = Math.round(dir.x)
    let dirZ = Math.round(dir.z)
    let moveIndex
    if( direction === "front" || direction === "back") {
        moveIndex = direction === "front" ? 1 : -1
            if (intersect[0].object.name === "box") {
                if (dirX === 1 && dirZ === 1) {
                    controls.moveForward(-1 * moveIndex);
                    controls.moveRight(1 * moveIndex);
                } else if (dirX === -1 && dirZ === -1) {
                    controls.moveForward(1 * moveIndex);
                    controls.moveRight(-1 * moveIndex);
                } else if (dirX === 1 && dirZ === -1) {
                    controls.moveForward(-1 * moveIndex);
                    controls.moveRight(-1 * moveIndex);
                } else if (dirX === -1 && dirZ === 1) {
                    controls.moveForward(1 * moveIndex);
                    controls.moveRight(1 * moveIndex);
                } else if (dir.x > 0 && dir.z < 0.05 && dir.y < -0.8) {
                    controls.moveForward(-1 * moveIndex);
                } else if (dir.x < 0 && dir.z < 0.05 && dir.y < -0.8) {
                    controls.moveForward(1 * moveIndex);
                }

                if (dirX === 1 && dirZ === 0) {
                    controls.moveForward(-1 * moveIndex);
                } else if (dirX === -1 && dirZ === 0) {
                    controls.moveForward(1 * moveIndex);
                }
                if (dirX === 0 && dirZ === -1) {
                    controls.moveRight(-1 * moveIndex);
                } else if (dirX === 0 && dirZ === 1) {
                    controls.moveRight(1 * moveIndex);
                }
            }
    }else {
        moveIndex = direction === "left" ? 1 : -1
            if (intersect[0].object.name === "box") {
                if (dirX === 1 && dirZ === 1) {
                    controls.moveForward(1 * moveIndex);
                    controls.moveRight(1 * moveIndex);
                } else if (dirX === -1 && dirZ === -1) {
                    controls.moveForward(-1 * moveIndex);
                    controls.moveRight(-1 * moveIndex);
                } else if (dirX === 1 && dirZ === -1) {
                    controls.moveForward(-1 * moveIndex);
                    controls.moveRight(1 * moveIndex);
                } else if (dirX === -1 && dirZ === 1) {
                    controls.moveForward(1 * moveIndex);
                    controls.moveRight(-1 * moveIndex);
                } else if (dir.x > 0 && dir.z < 0.05 && dir.y < -0.8) {
                    controls.moveForward(1 * moveIndex);
                } else if (dir.x < 0 && dir.z < 0.05 && dir.y < -0.8) {
                    controls.moveForward(-1 * moveIndex);
                }

                if (dirX === 1 && dirZ === 0) {
                    controls.moveRight(1 * moveIndex);
                } else if (dirX === -1 && dirZ === 0) {
                    controls.moveRight(-1 * moveIndex);
                }
                if (dirX === 0 && dirZ === -1) {
                    controls.moveForward(-1 * moveIndex);
                } else if (dirX === 0 && dirZ === 1) {
                    controls.moveForward(1 * moveIndex);
                }
            }
    }
}

function onProgress(xhr) {
    // console.log("loading..."+ Math.round((xhr.loaded / xhr.total * 100)) + "%")
}

function onError(e){
    console.log(e)
}

function addObjects(){
    scene.remove(animalObj);
    poops.forEach(p => scene.remove(p))
    foodObj = undefined
    waterObj = undefined
    poops = []
    animationMap = []

    let floorGeometry = new THREE.PlaneGeometry( 2000, 2000, 100, 100 );
    floorGeometry.rotateX( - Math.PI / 2 );
    const floorMaterial = new THREE.MeshBasicMaterial( {color: '#1f8f94'} );
    const floor = new THREE.Mesh( floorGeometry, floorMaterial );
    floor.name = "floor";
    scene.add( floor );

    if(animalObj === undefined) {
        let livingroom;
        new MTLLoader(manager)
            .setPath('../models/apartment-living-room-obj/')
            .load('apartment-living-room.mtl', function (materials) {
                materials.preload();
                new OBJLoader(manager)
                    .setMaterials(materials)
                    .setPath('models/apartment-living-room-obj/')
                    .load('apartment-living-room.obj', function (obj) {
                        livingroom = obj;
                        livingroom.scale.set(10.53, 10.53, 10.53);
                        livingroom.position.set(-0.1, 1, 0.8);
                        livingroom.castShadow = true
                        livingroom.receiveShadow = true;
                        livingroom.name = "livingroom"
                        livingroom.children.forEach(a => {
                            if (a.name !== "Plane") {
                                a.receiveShadow = true;
                                a.castShadow = true
                            }
                            if (a.name === "Object004" || a.name === "Object006" || a.name === "Object005"
                                || a.name === "Box004" || a.name === "Box006.002" || a.name === "Box007.002") {
                                a.position.z = -0.01
                            }
                            a.name = "room"
                        });
                        scene.add(livingroom)
                        objectLoaded = true;
                        loading++;
                    }, onProgress, onError)
            });

        /*let radio;
        new GLTFLoader(manager).load("models/vintage_radio/scene.gltf", function (gltf){
            radio = gltf.scene;
            radio.position.set(-17, 8.5, 30)
            radio.rotation.set(0, 2, 0)
            radio.scale.set(5, 5, 5)
            radio.receiveShadow = true;
            radio.castShadow = true;
            radio.children.forEach(a => {
                a.receiveShadow = true;
                a.castShadow = true;
            })

            const boxGeometry = new THREE.BoxGeometry( 1.6, 2.7, 2.3)
            const boxMaterial = new THREE.MeshBasicMaterial(
                {color: '#2c52b2', transparent: true, opacity: 0 });
            const box = new THREE.Mesh( boxGeometry, boxMaterial );
            box.position.set(-17, 8.5, 30)
            box.rotation.set(0, 2, 0)
            box.name = "radio";
            box.userData.tooltip = "Play music"
            listener = new THREE.AudioListener();
            camera.add( listener );
            sound = new THREE.PositionalAudio( listener );
            const audioLoader = new THREE.AudioLoader();
            audioLoader.load( 'sound/radio_music.mp3', function( buffer ) {
                sound.setBuffer(buffer);
                sound.setRefDistance(30);
                sound.setLoop(true);
                sound.setVolume(0.5);
                radio.add(sound)
            })
            objects.push(box)
            scene.add( box );
            loading++
            scene.add(radio)
            })*/


        let bowl;
        new MTLLoader(manager)
            .setPath('../models/dog-bowl/')
            .load('material.lib', function (materials) {
                materials.preload();
                new OBJLoader(manager)
                    .setMaterials(materials)
                    .setPath('models/dog-bowl/')
                    .load('DogBowlFBX.obj', function (obj) {
                        bowl = obj;
                        bowl.scale.set(0.02, 0.02, 0.02);
                        bowl.position.set(-30, 0.7, 31);
                        bowl.receiveShadow = true;
                        bowl.castShadow = true;

                        bowl.children.forEach(a => {
                            a.receiveShadow = true;
                            a.castShadow = true;
                            a.userData.tooltip = "Give food"
                        })
                        bowl.userData.tooltip = "Give food"

                        bowl.name = "bowl";
                        scene.add(bowl)
                        objects.push(bowl)
                        objectLoaded = true;
                        loading++
                    }, onProgress, onError)
            });

        let waterBowl;
        new MTLLoader(manager)
            .load('../models/pet-water-bowl/source/waterbowl.mtl', function (materials) {
                materials.preload();
                new OBJLoader(manager)
                    .setMaterials(materials)
                    .load('../models/pet-water-bowl/source/waterbowl.obj', function (obj) {
                        waterBowl = obj;
                        waterBowl.scale.set(3.01, 3.01, 3.01);
                        waterBowl.rotation.y = 2.3
                        waterBowl.position.set(-42, 0.7, 68);
                        waterBowl.receiveShadow = true;
                        waterBowl.castShadow = true;
                        waterBowl.children.forEach(a => {
                            a.receiveShadow = true;
                            a.castShadow = true;
                            a.userData.tooltip = "Give water"
                        })
                        waterBowl.userData.tooltip = "Give water"
                        waterBowl.name = "waterbowl"
                        scene.add(waterBowl)
                        objects.push(waterBowl)
                        objectLoaded = true;
                        loading++
                    }, onProgress, onError)
            }, onProgress, onError);
    }

    for(let animal of animals){
        if(animal.type === type){
            choice = animal
            break;
        }
    }
    if(choice === undefined){
        choice = animals[0]
    }
    new GLTFLoader(manager).load(choice.pathObj, function (gltf){
        animalObj = gltf.scene;
        animalObj.traverse(function (object){
            if(object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true
                object.frustumCulled = false;
                object.outputEncoding = THREE.sRGBEncoding;
            }
        })
        animal.foodType = choice.foodType
        animal.type = choice.type
        animSpeed = choice.stages[0].speed
        animalObj.scale.set(choice.stages[animal.age].scale, choice.stages[animal.age].scale, choice.stages[animal.age].scale)
        animalObj.position.set(0, choice.stages[animal.age].position, 0)
        animalObj.rotation.set(choice.baseRotation.x, choice.baseRotation.y, choice.baseRotation.z)

        if(animal.type === "cat"){
            animalObj.children.forEach(a => {
                a.rotation.z = 3.2
            })
        }
        animalObj.receiveShadow = true;
        animalObj.castShadow = true;
        animalObj.name = "animal";

        scene.add(animalObj)
        objects.push(animalObj)
        objectLoaded = true;
        loading++

        let foodChoice;
        for(let foodTemp of food){
            if(foodTemp.type === animal.foodType){
                foodChoice = foodTemp
                break;
            }
        }
        if(foodChoice === undefined){
            foodChoice = food[0]
        }
        new MTLLoader(manager)
            .load(foodChoice.pathMtl, function (materials) {
                materials.preload();
                new OBJLoader(manager)
                    .setMaterials(materials)
                    .load(foodChoice.pathObj, function (obj) {
                        foodObj = obj;
                        foodObj.scale.set(foodChoice.scale.x, foodChoice.scale.y, foodChoice.scale.z);
                        foodObj.rotation.set(foodChoice.rotation.x, foodChoice.rotation.y, foodChoice.rotation.z);
                        foodObj.position.set(foodChoice.position.x, foodChoice.position.y, foodChoice.position.z);
                        foodObj.name = "food";
                        foodObj.type = animal.foodType
                        foodObj.visible = false
                        foodObj.receiveShadow = true;
                        foodObj.castShadow = true;
                        foodObj.children.forEach(a => {
                            a.receiveShadow = true;
                            a.castShadow = true;
                        })
                        scene.add(foodObj)
                        objects.push(foodObj)
                        objectLoaded = true;
                        loading++
                    }, onProgress, onError)
            }, onProgress, onError);

        new MTLLoader(manager)
            .load(food[3].pathMtl, function (materials) {
                materials.preload();
                new OBJLoader(manager)
                    .setMaterials(materials)
                    .load(food[3].pathObj, function (obj) {
                        waterObj = obj;
                        waterObj.scale.set(food[3].scale.x, food[3].scale.y, food[3].scale.z);
                        waterObj.position.set(food[3].position.x, food[3].position.y, food[3].position.z);
                        waterObj.rotation.set(food[3].rotation.x, food[3].rotation.y, food[3].rotation.z);
                        waterObj.name = "water";
                        waterObj.visible = false
                        scene.add(waterObj)
                        objects.push(waterObj)
                        objectLoaded = true;
                    }, onProgress, onError)
            }, onProgress, onError);

        let animations = gltf.animations;
        mixer = new THREE.AnimationMixer(animalObj);
        animationMap = new Map()
        animations.forEach(a => {
            let name, action, cycle
            for (let i = 0; i < choice.animations.length; i++){
                if(choice.animations[i].name === a.name){
                    name = choice.animations[i].type
                    cycle = choice.animations[i].cycle
                    break;
                }
            }
            action = mixer.clipAction(a)
            action.name = name
            if(!cycle){
                action.clampWhenFinished = true;
                action.loop = THREE.LoopOnce;
            }
            animationMap.set(name, action)
        })
        animlength = 0

        if(animationMap.get("walk") !== undefined){
            animlength +=1
        }
        if(animationMap.get("idleSit") !== undefined){
            animlength +=1
        }
        if(animationMap.get("idleLie") !== undefined){
            animlength +=1
        }
        // console.log("len", animlength)
        activeAction = animationMap.get("idle")
        activeAction.play();

        animalRaycast = new THREE.Raycaster(
            new THREE.Vector3(animalObj.position.x, animalObj.position.y+2, animalObj.position.z),
            animalObj.getWorldDirection(new THREE.Vector3(0, 0, 0)), 0, 8);

        if(saveMode === false){
            continueLoad()
        }
    })


    generateObject(34, 2, -2, 1, 20, 75) //wall front
    generateObject(-40, 2, -2, 1, 20, 75) //wall back
    generateObject(-3, 2, -39, 74, 20, 1) //wall left
    generateObject(-3, 2, 35, 74, 20, 1) //wall right
    generateObject(0, 2, 18.5, 24, 20, 9.5) //couch
    generateObject(-19, 2, 32, 14, 13, 6) //drawer
    generateObject(22, 2, -3, 8, 20, 8) //chair-black
    generateObject(21, 2, 8, 8, 20, 8) //chair-red
    generateObject(1.5, 2, 6.5, 4, 20, 4) //chair-red

    function generateObject( x, y, z, w, h, d) {
        const boxGeometry = new THREE.BoxGeometry( w, h, d )
        const boxMaterial = new THREE.MeshBasicMaterial( {color: '#2c52b2', transparent: true, opacity: 0 });
        const box = new THREE.Mesh( boxGeometry, boxMaterial );
        box.position.set(x, y, z)
        box.name = "box";
        loading++
        objects.push(box)
        scene.add( box );
    }

    let geometrySphere = new THREE.SphereGeometry( 100, 100, 100 );
    let cubeTexture = new THREE.TextureLoader().load(
        '../texture/sky.jpg' );
    let materialSphere = new THREE.MeshBasicMaterial( {
        map: cubeTexture,
        transparent: true,
        color: '#1f8f94',
        side: THREE.DoubleSide} );
    let sphere = new THREE.Mesh( geometrySphere, materialSphere );
    sphere.position.set(0, 0, 0);
    scene.add( sphere );
}

function moveState(goEat=false, goDrink=false){
    let time = Math.round(timer.getElapsedTime())
    animalRaycast.ray.origin = new THREE.Vector3(animalObj.position.x, animalObj.position.y+2, animalObj.position.z)
    animalRaycast.ray.direction = animalObj.getWorldDirection(new THREE.Vector3(0, 0, 0))
    const intersections = animalRaycast.intersectObjects( objects, false);

    delta = animClock.getDelta();
    rotateAngle = Math.PI / 2 * delta;
    if(time >= duration) {
            do {
                dir = getRandomInt(0, 4)
            } while (prev === dir);
            duration = getRandomInt(2, config.maxTaskLength)
        handleAnimation("walk");
        if(duration === 6){
            handleExtras("walk")
        }
        prevPos = {x: animalObj.position.x, z: animalObj.position.z}
        prev = dir;
        timer.start()
    } else {
        if(animalObj.position.x > 34 || animalObj.position.x < -40
            || animalObj.position.z > 35 || animalObj.position.z < -39){
            if(prevPos.x > 34 || prevPos.x < -40
                || prevPos.z > 35 || prevPos.z < -39){
                animalObj.position.x = 0
                animalObj.position.z = 0
            }else {
                animalObj.position.x = prevPos.x
                animalObj.position.z = prevPos.z
            }
        }
        if(intersections.length > 0) {
            animalObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), -rotateAngle * (animSpeed*3));
            return
        }

        if(comeEat && goEat) {
            goTo(-31, -30, 26, 28, true)
            return
        } else if(comeDrink && goDrink) {
            goTo(-35, -34, 26, 28, false)
            return
        }

        if (dir === 0 || dir === 3) {
            animalObj.translateZ(animSpeed * delta*2);
        }
        else if (dir === 1) {
            animalObj.translateZ(animSpeed * delta);
            animalObj.translateX(-animSpeed * delta*0.5);
            animalObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), rotateAngle * (animSpeed / 5));
        }
        else if (dir === 2 || dir === 4) {
            animalObj.translateZ(animSpeed * delta);
            animalObj.translateX(animSpeed * delta*0.5);
            animalObj.rotateOnAxis(new THREE.Vector3(0, 1, 0), -rotateAngle * (animSpeed / 5));
        }
    }
}

function goTo(x, x1, z, z1, bowl){
    if(!finishX && animalObj.position.x < x){
        if(!rotatedX){
            animalObj.rotation.set(0, 1, 0)
            rotatedX = true;
        }
        animalObj.translateZ(animSpeed * delta*2);
    }
    else if(!finishX && animalObj.position.x > x1){
        if(!rotatedX){
            animalObj.rotation.set(0, -1, 0)
            rotatedX = true;
        }
        animalObj.translateZ(animSpeed * delta*2);
    }
    else{
        finishX = true;
        rotatedX = false
    }

    if(finishX && !finishZ && animalObj.position.z < z){
        if(!rotatedZ){
            animalObj.rotation.set(0, 0, 0)
            rotatedZ = true;
        }
        animalObj.translateZ(animSpeed * delta*2);
    }
    else if(finishX && !finishZ && animalObj.position.z > z1){
        if(!rotatedZ){
            animalObj.rotation.set(0, -0, 0)
            rotatedZ = true;
        }
        animalObj.translateZ(animSpeed * delta*2);
    }
    else if(finishX){
        finishZ = true;
        rotatedZ = false
    }

    if(finishX && finishZ){
        duration += 2;
        task = 1;
        if(bowl) feed(true)
        else giveWater(true)
        finishX = false;
        finishZ = false;
    }
}
function sitState(){
    let time = Math.round(timer.getElapsedTime())
    if(time >= duration) {
        duration = getRandomInt(2, config.maxTaskLength)
        handleAnimation("idleSit")
        if(duration === 3){
            handleExtras("idleSit")
        }
        timer.start()
    }
}

function layState(){
    let time = Math.round(timer.getElapsedTime())
    if(time >= duration) {
        duration = getRandomInt(2, config.maxTaskLength)
        handleAnimation("idleLie")
        timer.start()
    }
}

function idleState(){
    let time = Math.round(timer.getElapsedTime())
    if(time >= duration) {
        duration = getRandomInt(2, config.maxTaskLength)
        handleAnimation("idle")
        if(duration === 1){
            handleExtras("idle")
        }
        timer.start()
    }
}

function handleAnimation(animation){
    let anim = animationMap.get(animation)
    if(anim !== undefined && activeAction !== anim) {
        anim.reset()
        activeAction.crossFadeTo(anim, 0.5, true).play()
        activeAction = anim
    }
}

function handleExtras(animation){
    let anim
    if(animation === "eat"){
        if(animal.type === "dog")
            animation = "walkExtra"
        anim = animationMap.get(animation)
    } else {
        anim = animationMap.get(animation + "Extra")
    }
    if(anim === undefined) return
    if(activeAction !== anim) {
        anim.reset()
        activeAction.crossFadeTo(anim, 0.5, true).play()
        activeAction = anim
    }
}

async function moveAnimal(){
    let taskTime = Math.round(taskTimer.getElapsedTime())
    // scene.add(new THREE.ArrowHelper(
    //     animalRaycast.ray.direction, animalRaycast.ray.origin, animalRaycast.far,
    //     Math.random() * 0xffffff, 1, 0.1 ));

    if(taskTime >= task) {
        task = getRandomInt(3, config.maxStateLength)

        if(comeEat){
            chosenState = -2
        }else if(comeDrink){
            chosenState = -3
        }else{
            chosenState = getRandomInt(0, animlength);
        }

        duration = 2
        taskTimer.start()
        prevState = chosenState
    } else if (chosenState === 0) {
        idleState()
    } else if (chosenState === 1) {
        moveState()
    } else if (chosenState === 2) {
        sitState()
    } else if (chosenState === 3) {
        layState()
    } else if (chosenState === -2) {
        moveState(true, false)
    } else if (chosenState === -3) {
        moveState(false, true)
    }
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max + 1);
    return Math.floor(Math.random() * (max - min) + min);
}

async function dropPoop(x=null, z=null){
    if(animal.cleanliness <= 0){
        animal.cleanliness = 0

        writetats("cleanliness")
        writetats("happiness")
        return;
    }
    if(x === null || z === null) {
        x = animalObj.position.x;
        z = animalObj.position.z;
    }
    new MTLLoader(manager)
        .load('../models/poop/material.mtl', function (materials) {
            materials.preload();
            new OBJLoader(manager)
                .setMaterials(materials)
                .load('models/poop/model.obj', function (obj) {
                    obj.scale.set(0.55, 0.55, 0.55);
                    obj.position.set(x, 1.5, z);
                    obj.rotation.y = Math.random()*6
                    obj.receiveShadow = true;
                    obj.castShadow = true;
                    obj.children.forEach(a => {
                        a.receiveShadow = true;
                        a.castShadow = true;
                        a.userData.tooltip = "Clean"
                    })
                    obj.userData.tooltip = "Clean"
                    obj.name= "poop"
                    scene.add(obj)
                    poops.push(obj)
                    objectLoaded = true;
                    animal.cleanliness = (100-(poops.length*2))
                    if(animal.cleanliness < 0) {
                        animal.cleanliness = 0
                    }
                    writetats("cleanliness")
                    writetats("happiness")
                }, onProgress, onError)
        }, onProgress, onError);
}

function cleanPoop(poop){
    scene.remove(poop)
    poops.remove(poop)
    animal.cleanliness = (100-(poops.length*2))
    if(animal.cleanliness < 0) {
        animal.cleanliness = 0
    }
    writetats("cleanliness")
    writetats("happiness")
}

function feed(remove=false){
    foodObj.visible = !remove
    animal.foodObj = !remove
    if( !remove && animal.food < 100){
        comeEat = true
        task = 1
    }
    if(remove){
        comeEat = false
        handleExtras("eat")
        animal.food = 100;
        writetats("food")
        writetats("happiness")
    }
}

function giveWater(remove=false){
    waterObj.visible = !remove
    animal.waterObj = !remove
    if( !remove && (animal.health < 100 || animal.food < 100)){
        comeDrink = true
        task = 1
    }
    if(remove){
        comeDrink = false
        handleExtras("eat")
        animal.food += 20;
        if(animal.food > 100)
            animal.food = 100
        writetats("food")

        animal.health += 20;
        if(animal.health > 100)
            animal.health = 100
        writetats("health")
        writetats("happiness")
    }
}

async function grow(){
    animal.age++;
    writetats("age")
    if(animal.age > 5)
        return;
    let newScale = choice.stages[animal.age].scale
    animalObj.scale.set(newScale, newScale, newScale)
    animalObj.position.y = choice.stages[animal.age].position
    animal.food-=10
    animSpeed = choice.stages[animal.age].speed
    writetats("food")
    writetats("happiness")
}

async function hunger() {
    if (animal.food > 0) {
        animal.food -= 1
        writetats("food")
        writetats("happiness")
    } else {
        animal.health -= 10
        if (animal.health < 0) {
            animal.health = 0
            die()
        }
        writetats("health")
    }
}

function die(){
    dead = true
    controls.unlock()
}

Array.prototype.remove = function(obj){
    const index = this.indexOf(obj);
    if (index > -1) {
        this.splice(index, 1);
    }
}


