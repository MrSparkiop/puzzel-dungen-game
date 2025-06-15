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
    const characterChoiceElements = document.querySelectorAll('.character-option');
    const difficultySelector = document.querySelector('.difficulty-selector');
    const playButton = document.getElementById('play-button');
    const pauseMenu = document.getElementById('pause-menu');
    const resumeButton = document.getElementById('resume-button');
    const pauseToMainMenuButton = document.getElementById('pause-to-main-menu-button');
    const winScreen = document.getElementById('win-screen');
    const playAgainButton = document.getElementById('play-again-button');
    const gameWrapper = document.getElementById('game-wrapper');
    const gameCanvas = document.getElementById('gameCanvas');
    const coinsRemainingSpan = document.getElementById('coins-remaining');
    const levelSpan = document.getElementById('level');
    const volumeSlider = document.getElementById('volume-slider');

    // --- Character Unlock Logic ---
    const characters = {
        'assets/player-sprite.png': { unlocked: true, unlocksOn: null },
        'assets/player-sprite-3.png': { unlocked: false, unlocksOn: 'medium' },
        'assets/player-sprite-2.png': { unlocked: false, unlocksOn: 'hard' }
    };

    function saveUnlocks() {
        const unlockedChars = {};
        for (const sprite in characters) {
            if (characters[sprite].unlocked) {
                unlockedChars[sprite] = true;
            }
        }
        localStorage.setItem('dungeonUnlocks', JSON.stringify(unlockedChars));
    }

    function loadUnlocks() {
        const unlockedChars = JSON.parse(localStorage.getItem('dungeonUnlocks'));
        if (unlockedChars) {
            for (const sprite in unlockedChars) {
                if (characters[sprite]) {
                    characters[sprite].unlocked = true;
                }
            }
        }
    }


    // --- Game Settings ---
    let selectedSpritePath = 'assets/player-sprite.png';
    let playerTexture;
    let selectedDifficulty = { name: 'medium', width: 13, height: 13 };

    const difficultySettings = {
        easy: { name: 'easy', width: 9, height: 9 },
        medium: { name: 'medium', width: 13, height: 13 },
        hard: { name: 'hard', width: 19, height: 19 },
    };

    volumeSlider.addEventListener('input', (e) => { backgroundMusic.volume = e.target.value; });
    
    let gameState = 'MENU';
    const gl = gameCanvas.getContext('webgl');
    if (!gl) { alert('WebGL not supported!'); return; }

    // --- THIS IS THE FIX ---
    // Enable transparency blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


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
    const programInfo = { program: shaderProgram, attribLocations: {}, uniformLocations: {} };
    programInfo.attribLocations.vertexPosition = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    programInfo.attribLocations.textureCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    programInfo.uniformLocations.projectionMatrix = gl.getUniformLocation(shaderProgram, 'uProjectionMatrix');
    programInfo.uniformLocations.modelViewMatrix = gl.getUniformLocation(shaderProgram, 'uModelViewMatrix');
    programInfo.uniformLocations.uSampler = gl.getUniformLocation(shaderProgram, 'uSampler');

    const buffers = initBuffers(gl);
    const coinTexture = loadTexture(gl, 'assets/coin-sprite.png');
    const wallTexture = loadTexture(gl, 'assets/wall-sprite.png');
    const doorTexture = loadTexture(gl, 'assets/door-sprite.png');
    const floorTexture = loadTexture(gl, 'assets/floor-sprite.png');

    let currentLevel = 0;
    const MAX_LEVELS = 10;
    let player = { x: 1, y: 1 };
    let coins = [];
    let exit = { x: 0, y: 0 };
    let walls = [];
    let floorTiles = [];
    let coinsToCollect = 0;

    function drawScene() {
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1);
        gl.useProgram(programInfo.program);
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        
        floorTiles.forEach(tile => drawObject(gl, programInfo, buffers, tile, floorTexture));
        walls.forEach(wall => drawObject(gl, programInfo, buffers, wall, wallTexture));
        coins.forEach(coin => drawObject(gl, programInfo, buffers, coin, coinTexture));
        if (coinsToCollect === 0) drawObject(gl, programInfo, buffers, exit, doorTexture);
        drawObject(gl, programInfo, buffers, player, playerTexture);
    }

    function gameLoop() {
        if (gameState === 'PLAYING') drawScene();
        requestAnimationFrame(gameLoop);
    }

    function updateCoinCounter() { coinsRemainingSpan.textContent = coinsToCollect; }

    function loadLevel(levelIndex) {
        const { width, height, name } = selectedDifficulty;
        gameCanvas.width = width * tileSize;
        gameCanvas.height = height * tileSize;
        const levelLayout = generateLevel(width, height, name);
        
        walls = []; coins = []; floorTiles = []; coinsToCollect = 0;
        levelSpan.textContent = levelIndex + 1;

        for (let y = 0; y < levelLayout.length; y++) {
            for (let x = 0; x < levelLayout[y].length; x++) {
                const tile = levelLayout[y][x];
                if (tile === '#') {
                    walls.push({ x, y });
                } else {
                    floorTiles.push({ x, y });
                    if (tile === 'P') { player.x = x; player.y = y; }
                    else if (tile === 'C') { coins.push({ x, y }); coinsToCollect++; }
                    else if (tile === 'E') { exit.x = x; exit.y = y; }
                }
            }
        }
        updateCoinCounter();
    }
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (gameState === 'PLAYING') pauseGame();
            else if (gameState === 'PAUSED') resumeGame();
            return;
        }
        if (gameState !== 'PLAYING') return;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
            let newX = player.x; let newY = player.y;
            if (e.key === 'ArrowUp') newY -= 1;
            if (e.key === 'ArrowDown') newY += 1;
            if (e.key === 'ArrowLeft') newX -= 1;
            if (e.key === 'ArrowRight') newX += 1;
            if (!walls.some(wall => wall.x === newX && wall.y === newY)) { player.x = newX; player.y = newY; }
            const coinIndex = coins.findIndex(c => c.x === player.x && c.y === player.y);
            if (coinIndex > -1) {
                coins.splice(coinIndex, 1);
                coinsToCollect--;
                updateCoinCounter();
            }
            if (coinsToCollect === 0 && player.x === exit.x && player.y === exit.y) {
                currentLevel++;
                if (currentLevel < MAX_LEVELS) loadLevel(currentLevel);
                else showWinScreen();
            }
        }
    });

    function showMainMenu() {
        gameState = 'MENU';
        mainMenu.style.display = 'block';
        characterSelectMenu.style.display = 'none';
        pauseMenu.style.display = 'none';
        gameWrapper.style.display = 'none';
        gameWrapper.style.filter = 'none';
        winScreen.style.display = 'none';
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }

    function showCharacterSelect() {
        gameState = 'CHARACTER_SELECT';
        mainMenu.style.display = 'none';
        
        characterChoiceElements.forEach(choiceEl => {
            const spritePath = choiceEl.dataset.sprite;
            if (characters[spritePath] && !characters[spritePath].unlocked) {
                choiceEl.classList.add('locked');
            } else {
                choiceEl.classList.remove('locked');
            }
        });
        
        characterSelectMenu.style.display = 'block';
        
        document.querySelector('.character-option[data-sprite="assets/player-sprite.png"]').classList.add('selected');
        document.querySelector('.difficulty-option[data-difficulty="medium"]').classList.add('selected');
    }

    function pauseGame() {
        gameState = 'PAUSED';
        backgroundMusic.pause();
        pauseMenu.style.display = 'block';
        gameWrapper.style.filter = 'blur(5px)';
    }

    function resumeGame() {
        gameState = 'PLAYING';
        backgroundMusic.play();
        pauseMenu.style.display = 'none';
        gameWrapper.style.filter = 'none';
    }

    function showWinScreen() {
        gameState = 'WIN';
        winScreen.style.display = 'block';
        gameWrapper.style.display = 'none';
        backgroundMusic.pause();

        const difficulty = selectedDifficulty.name;
        for (const sprite in characters) {
            if (characters[sprite].unlocksOn === difficulty) {
                characters[sprite].unlocked = true;
            }
        }
        saveUnlocks();
    }

    function startGame() {
        playerTexture = loadTexture(gl, selectedSpritePath);
        gameState = 'PLAYING';
        characterSelectMenu.style.display = 'none';
        gameWrapper.style.display = 'flex';
        backgroundMusic.play().catch(e => console.error("Music playback failed:", e));
        currentLevel = 0;
        loadLevel(currentLevel);
    }

    startButton.addEventListener('click', showCharacterSelect);
    playButton.addEventListener('click', startGame);
    playAgainButton.addEventListener('click', showMainMenu);
    resumeButton.addEventListener('click', resumeGame);
    pauseToMainMenuButton.addEventListener('click', showMainMenu);

    characterChoiceElements.forEach(choice => {
        choice.addEventListener('click', () => {
            const spritePath = choice.dataset.sprite;
            if (characters[spritePath] && characters[spritePath].unlocked) {
                characterChoiceElements.forEach(el => el.classList.remove('selected'));
                choice.classList.add('selected');
                selectedSpritePath = spritePath;
            }
        });
    });

    difficultySelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('difficulty-option')) {
            document.querySelectorAll('.difficulty-option').forEach(el => el.classList.remove('selected'));
            e.target.classList.add('selected');
            const difficulty = e.target.dataset.difficulty;
            selectedDifficulty = difficultySettings[difficulty];
        }
    });

    // --- Initial Call ---
    loadUnlocks();
    showMainMenu();
    requestAnimationFrame(gameLoop);
})();