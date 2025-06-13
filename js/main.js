import { levels, tileSize } from './config.js';
import { mat4 } from './mat4.js';
import { initShaderProgram, initBuffers } from './webgl_setup.js';
import { createAssetTexture, loadTexture, drawObject } from './drawing.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Audio Setup ---
    const backgroundMusic = new Audio('assets/ES_Shut the World Out - Rasure.mp3');
    backgroundMusic.loop = true;

    // --- UI Elements ---
    const mainMenu = document.getElementById('main-menu');
    const startButton = document.getElementById('start-button');
    const gameCanvas = document.getElementById('gameCanvas');
    const gameInfo = document.getElementById('info');
    const coinsRemainingSpan = document.getElementById('coins-remaining');
    const levelSpan = document.getElementById('level');
    const winScreen = document.getElementById('win-screen');
    const playAgainButton = document.getElementById('play-again-button');
    // Get the new volume slider element
    const volumeSlider = document.getElementById('volume-slider');

    // --- Volume Control Event Listener ---
    volumeSlider.addEventListener('input', (e) => {
        backgroundMusic.volume = e.target.value;
    });


    const mapWidthInTiles = levels[0][0].length;
    const mapHeightInTiles = levels[0].length;
    gameCanvas.width = mapWidthInTiles * tileSize;
    gameCanvas.height = mapHeightInTiles * tileSize;
    
    let gameState = 'MENU';

    const gl = gameCanvas.getContext('webgl');
    if (!gl) { alert('WebGL not supported!'); return; }

    const vsSource = `
        attribute vec4 aVertexPosition;
        attribute vec2 aTextureCoord;
        uniform mat4 uModelViewMatrix;
        uniform mat4 uProjectionMatrix;
        varying highp vec2 vTextureCoord;
        void main(void) {
            gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;
            vTextureCoord = aTextureCoord;
        }
    `;
    const fsSource = `
        varying highp vec2 vTextureCoord;
        uniform sampler2D uSampler;
        void main(void) {
            gl_FragColor = texture2D(uSampler, vTextureCoord);
        }
    `;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
        program: shaderProgram,
        attribLocations: {
            vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
            textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord'),
        },
        uniformLocations: {
            projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
            modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
            uSampler: gl.getUniformLocation(shaderProgram, 'uSampler'),
        },
    };

    const buffers = initBuffers(gl);

    const playerTexture = loadTexture(gl, 'assets/player-sprite.png');
    const coinTexture = loadTexture(gl, 'assets/coin-sprite.png');
    const wallTexture = createAssetTexture(gl, 'darkgrey');
    const exitTexture = createAssetTexture(gl, 'purple');

    let currentLevel = 0;
    let player = { x: 1, y: 1 };
    let coins = [];
    let exit = { x: 0, y: 0 };
    let walls = [];
    let coinsToCollect = 0;

    function drawScene() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, gameCanvas.width, gameCanvas.height, 0, -1, 1);
        gl.useProgram(programInfo.program);
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        walls.forEach(wall => drawObject(gl, programInfo, buffers, wall, wallTexture));
        coins.forEach(coin => drawObject(gl, programInfo, buffers, coin, coinTexture));
        if (coinsToCollect === 0) {
            drawObject(gl, programInfo, buffers, exit, exitTexture);
        }
        drawObject(gl, programInfo, buffers, player, playerTexture);
    }

    function updateCoinCounter() { coinsRemainingSpan.textContent = coinsToCollect; }

    function loadLevel(levelIndex) {
        const level = levels[levelIndex];
        walls = []; coins = []; coinsToCollect = 0;
        levelSpan.textContent = levelIndex + 1;
        for (let y = 0; y < level.length; y++) {
            for (let x = 0; x < level[y].length; x++) {
                const tile = level[y][x];
                if (tile === '#') { walls.push({ x, y }); }
                else if (tile === 'P') { player.x = x; player.y = y; }
                else if (tile === 'C') { coins.push({ x, y }); coinsToCollect++; }
                else if (tile === 'E') { exit.x = x; exit.y = y; }
            }
        }
        updateCoinCounter();
    }
    
    window.addEventListener('keydown', (e) => {
        if (gameState !== 'PLAYING') return;
        let newX = player.x; let newY = player.y;
        if (e.key === 'ArrowUp') newY -= 1;
        if (e.key === 'ArrowDown') newY += 1;
        if (e.key === 'ArrowLeft') newX -= 1;
        if (e.key === 'ArrowRight') newX += 1;

        if (!walls.some(wall => wall.x === newX && wall.y === newY)) {
            player.x = newX; player.y = newY;
        }

        const coinIndex = coins.findIndex(coin => coin.x === player.x && coin.y === player.y);
        if (coinIndex > -1) {
            coins.splice(coinIndex, 1);
            coinsToCollect--;
            updateCoinCounter();
        }

        if (coinsToCollect === 0 && player.x === exit.x && player.y === exit.y) {
            currentLevel++;
            if (currentLevel < levels.length) { loadLevel(currentLevel); } 
            else { showWinScreen(); }
        }
        requestAnimationFrame(drawScene);
    });

    function showMainMenu() {
        gameState = 'MENU';
        mainMenu.style.display = 'block';
        gameCanvas.style.display = 'none';
        gameInfo.style.display = 'none';
        winScreen.style.display = 'none';
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }

    function showWinScreen() {
        gameState = 'WIN';
        winScreen.style.display = 'block';
        gameCanvas.style.display = 'none';
        gameInfo.style.display = 'none';
        backgroundMusic.pause();
    }

    function startGame() {
        gameState = 'PLAYING';
        mainMenu.style.display = 'none';
        winScreen.style.display = 'none';
        
        const playPromise = backgroundMusic.play();

        if (playPromise !== undefined) {
            playPromise.then(_ => {
                console.log("Music started!");
                gameCanvas.style.display = 'block';
                gameInfo.style.display = 'block';
                currentLevel = 0;
                loadLevel(currentLevel);
                requestAnimationFrame(drawScene);
            }).catch(error => {
                console.error("Music playback failed:", error);
                gameCanvas.style.display = 'block';
                gameInfo.style.display = 'block';
                currentLevel = 0;
                loadLevel(currentLevel);
                requestAnimationFrame(drawScene);
            });
        }
    }

    startButton.addEventListener('click', startGame);
    playAgainButton.addEventListener('click', showMainMenu);

    showMainMenu();
    mainMenu.style.display = 'block'; 
});