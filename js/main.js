import { tileSize } from './config.js';
import { mat4 } from './mat4.js';
import { initShaderProgram, initBuffers } from './webgl_setup.js';
import { createAssetTexture, loadTexture, drawObject } from './drawing.js';
import { generateLevel } from './level_generator.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Audio Setup ---
    const backgroundMusic = new Audio('assets/ES_Shut the World Out - Rasure.mp3');
    backgroundMusic.loop = true;

    // --- UI Elements ---
    const mainMenu = document.getElementById('main-menu');
    const startButton = document.getElementById('start-button');
    const characterSelectMenu = document.getElementById('character-select-menu');
    const characterChoices = document.querySelector('.character-choices');
    const winScreen = document.getElementById('win-screen');
    const playAgainButton = document.getElementById('play-again-button');
    const gameWrapper = document.getElementById('game-wrapper');
    const gameCanvas = document.getElementById('gameCanvas');
    const coinsRemainingSpan = document.getElementById('coins-remaining');
    const levelSpan = document.getElementById('level');
    const volumeSlider = document.getElementById('volume-slider');

    let selectedSpritePath = 'assets/player-sprite.png'; // Default character
    let playerTexture; // Will be initialized in startGame

    volumeSlider.addEventListener('input', (e) => {
        backgroundMusic.volume = e.target.value;
    });

    const LEVEL_WIDTH = 11;
    const LEVEL_HEIGHT = 11;
    gameCanvas.width = LEVEL_WIDTH * tileSize;
    gameCanvas.height = LEVEL_HEIGHT * tileSize;
    
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
    const programInfo = { program: shaderProgram, attribLocations: { /*...*/ }, uniformLocations: { /*...*/ } };
    // ... (shader info setup is unchanged)
    programInfo.attribLocations.vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    programInfo.attribLocations.textureCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    programInfo.uniformLocations.projectionMatrix = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
    programInfo.uniformLocations.modelViewMatrix = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
    programInfo.uniformLocations.uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');

    const buffers = initBuffers(gl);

    const coinTexture = loadTexture(gl, 'assets/coin-sprite.png');
    const wallTexture = createAssetTexture(gl, 'darkgrey');
    const exitTexture = createAssetTexture(gl, 'purple');

    let currentLevel = 0;
    const MAX_LEVELS = 10;
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
        const levelLayout = generateLevel(LEVEL_WIDTH, LEVEL_HEIGHT);
        walls = []; coins = []; coinsToCollect = 0;
        levelSpan.textContent = levelIndex + 1;
        for (let y = 0; y < levelLayout.length; y++) {
            for (let x = 0; x < levelLayout[y].length; x++) {
                const tile = levelLayout[y][x];
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
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
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
                if (currentLevel < MAX_LEVELS) {
                    loadLevel(currentLevel);
                } else {
                    showWinScreen();
                }
            }
            requestAnimationFrame(drawScene);
        }
    });

    // --- Game State Flow ---
    function showMainMenu() {
        gameState = 'MENU';
        mainMenu.style.display = 'block';
        characterSelectMenu.style.display = 'none';
        gameWrapper.style.display = 'none';
        winScreen.style.display = 'none';
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }

    function showCharacterSelect() {
        gameState = 'CHARACTER_SELECT';
        mainMenu.style.display = 'none';
        characterSelectMenu.style.display = 'block';
    }

    function showWinScreen() {
        gameState = 'WIN';
        winScreen.style.display = 'block';
        gameWrapper.style.display = 'none';
        backgroundMusic.pause();
    }

    function startGame() {
        // Load the chosen character's texture
        playerTexture = loadTexture(gl, selectedSpritePath);
        
        gameState = 'PLAYING';
        characterSelectMenu.style.display = 'none';
        gameWrapper.style.display = 'flex';
        
        const playPromise = backgroundMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(_ => {
                currentLevel = 0;
                loadLevel(currentLevel);
                requestAnimationFrame(drawScene);
            }).catch(error => {
                console.error("Music playback failed:", error);
                currentLevel = 0;
                loadLevel(currentLevel);
                requestAnimationFrame(drawScene);
            });
        }
    }

    // --- Event Listeners ---
    startButton.addEventListener('click', showCharacterSelect); // Changed
    playAgainButton.addEventListener('click', showMainMenu);

    characterChoices.addEventListener('click', (e) => {
        const choice = e.target.closest('.character-option');
        if (choice) {
            selectedSpritePath = choice.dataset.sprite;
            startGame(); // Start the game after character is chosen
        }
    });

    // --- Initial Call ---
    showMainMenu();
})();