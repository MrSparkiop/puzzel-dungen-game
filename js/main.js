alert("The LATEST main.js file is running!");


import { levels, tileSize } from './config.js';
import { mat4 } from './mat4.js';
import { initShaderProgram, initBuffers } from './webgl_setup.js';
import { createAssetTexture, createCoinTexture, drawObject } from './drawing.js';

document.addEventListener('DOMContentLoaded', () => {
    // Get references to all UI elements
    const mainMenu = document.getElementById('main-menu');
    const startButton = document.getElementById('start-button');
    const gameCanvas = document.getElementById('gameCanvas');

    // --- FIX START: Set Canvas Size ---
    // Set the canvas drawing buffer size based on the level layout and tile size.
    const mapWidthInTiles = levels[0][0].length;
    const mapHeightInTiles = levels[0].length;
    gameCanvas.width = mapWidthInTiles * tileSize;
    gameCanvas.height = mapHeightInTiles * tileSize;
    // --- FIX END ---

    const gameInfo = document.getElementById('info');
    const coinsRemainingSpan = document.getElementById('coins-remaining');
    const levelSpan = document.getElementById('level');

    // Game state manager
    let gameState = 'MENU'; // Can be 'MENU' or 'PLAYING'

    const gl = gameCanvas.getContext('webgl');
    if (!gl) {
        alert('WebGL not supported!');
        return;
    }

    // Game State variables
    let currentLevel = 0;
    let player = { x: 1, y: 1 };
    let coins = [];
    let exit = { x: 0, y: 0 };
    let walls = [];
    let coinsToCollect = 0;

    // Shader sources (unchanged)
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

    const playerTexture = createAssetTexture(gl, 'blue');
    const wallTexture = createAssetTexture(gl, 'darkgrey');
    const coinTexture = createCoinTexture(gl);
    const exitTexture = createAssetTexture(gl, 'purple');

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

    function updateCoinCounter() {
        coinsRemainingSpan.textContent = coinsToCollect;
    }

    function loadLevel(levelIndex) {
        const level = levels[levelIndex];
        walls = [];
        coins = [];
        coinsToCollect = 0;
        levelSpan.textContent = levelIndex + 1;

        for (let y = 0; y < level.length; y++) {
            for (let x = 0; x < level[y].length; x++) {
                const tile = level[y][x];
                if (tile === '#') { walls.push({ x, y }); }
                else if (tile === 'P') { player.x = x; player.y = y; }
                else if (tile === 'C') { coins.push({ x, y }); coinsToCollect++; }
                else if (tile === 'E') { exit.x = x; exit.y = y; } // --- FIX: Read Exit from map
            }
        }
        updateCoinCounter();
    }

    window.addEventListener('keydown', (e) => {
        if (gameState !== 'PLAYING') return;

        let newX = player.x;
        let newY = player.y;

        if (e.key === 'ArrowUp') newY -= 1;
        if (e.key === 'ArrowDown') newY += 1;
        if (e.key === 'ArrowLeft') newX -= 1;
        if (e.key === 'ArrowRight') newX += 1;

        if (!walls.some(wall => wall.x === newX && wall.y === newY)) {
            player.x = newX;
            player.y = newY;
        }

        const coinIndex = coins.findIndex(coin => coin.x === player.x && coin.y === player.y);
        if (coinIndex > -1) {
            coins.splice(coinIndex, 1);
            coinsToCollect--;
            updateCoinCounter();
        }

        if (coinsToCollect === 0 && player.x === exit.x && player.y === exit.y) {
            currentLevel++;
            if (currentLevel < levels.length) {
                loadLevel(currentLevel);
            } else {
                alert('You win!');
                showMainMenu(); // Go back to menu after winning
            }
        }

        // Only redraw the scene when the player makes a move
        requestAnimationFrame(drawScene);
    });

    // Functions to control game state
    function showMainMenu() {
        gameState = 'MENU';
        mainMenu.style.display = 'block';
        gameCanvas.style.display = 'none';
        gameInfo.style.display = 'none';
    }

    function startGame() {
        gameState = 'PLAYING';
        mainMenu.style.display = 'none';
        gameCanvas.style.display = 'block';
        gameInfo.style.display = 'block';

        // Start the game by loading the first level and drawing the scene
        currentLevel = 0; // Reset to level 1
        loadLevel(currentLevel);
        requestAnimationFrame(drawScene);
    }

    // Event listener for the start button
    startButton.addEventListener('click', startGame);

    // Initial action when the page loads
    showMainMenu();
});