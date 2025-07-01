import { tileSize } from './config.js';
import { mat4 } from './mat4.js';
import { initShaderProgram, initBuffers } from './webgl_setup.js';
import { loadTexture, drawObject } from './drawing.js';
import { levels } from './levels.js';

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
    const helpButton = document.getElementById('help-button');
    const helpMenu = document.getElementById('help-menu');
    const closeHelpButton = document.getElementById('close-help-button');
    const settingsButton = document.getElementById('settings-button');
    const settingsMenu = document.getElementById('settings-menu');
    const closeSettingsButton = document.getElementById('close-settings-button');
    const healthDisplay = document.getElementById('health-display');
    const gameOverMenu = document.getElementById('game-over-menu');
    const restartButton = document.getElementById('restart-button');
    const gameOverToMainMenuButton = document.getElementById('game-over-to-main-menu-button');

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
    let selectedDifficulty = 'medium'; 
    let activeLevelSet = [];
    
    volumeSlider.addEventListener('input', (e) => { backgroundMusic.volume = e.target.value; });
    
    let gameState = 'MENU';
    const gl = gameCanvas.getContext('webgl');
    if (!gl) { alert('WebGL not supported!'); return; }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);


    // --- WebGL Shader Setup ---
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

    // --- Asset and Buffer Loading ---
    const buffers = initBuffers(gl);
    const coinTexture = loadTexture(gl, 'assets/coin-sprite.png');
    const wallTexture = loadTexture(gl, 'assets/wall-sprite.png');
    const doorTexture = loadTexture(gl, 'assets/door-sprite.png');
    const floorTexture = loadTexture(gl, 'assets/floor-sprite.png');
    const spikeTrapTexture = loadTexture(gl, 'assets/spike-trap.png');

    // --- Game State Variables ---
    let currentLevel = 0;
    let player = { x: 1, y: 1 };
    let startPosition = { x: 1, y: 1 };
    let coins = [];
    let exit = { x: 0, y: 0 };
    let walls = [];
    let floorTiles = [];
    let traps = [];
    let coinsToCollect = 0;
    let playerHealth;
    const MAX_HEALTH = 3;
    
    // ADDED: Variables for continuous touch movement
    let touchMoveDirection = null;
    const moveInterval = 150; // Time in ms between each move when holding
    let lastMoveTime = 0;


    function drawScene() {
        if(gameState !== 'PLAYING') return;

        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        
        gl.clearColor(0.82, 0.71, 0.55, 1.0); 

        gl.clear(gl.COLOR_BUFFER_BIT);

        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, gl.canvas.width, gl.canvas.height, 0, -1, 1);
        gl.useProgram(programInfo.program);
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
        
        floorTiles.forEach(tile => drawObject(gl, programInfo, buffers, tile, floorTexture));
        traps.forEach(trap => drawObject(gl, programInfo, buffers, trap, spikeTrapTexture, 16));
        walls.forEach(wall => drawObject(gl, programInfo, buffers, wall, wallTexture));
        coins.forEach(coin => drawObject(gl, programInfo, buffers, coin, coinTexture));
        if (coinsToCollect === 0) drawObject(gl, programInfo, buffers, exit, doorTexture);
        drawObject(gl, programInfo, buffers, player, playerTexture);
    }

    /**
     * MODIFIED: The game loop now handles continuous movement based on time.
     * @param {DOMHighResTimeStamp} timestamp - The current time provided by requestAnimationFrame.
     */
    function gameLoop(timestamp) {
        // Handle continuous movement for touch controls
        if (gameState === 'PLAYING' && touchMoveDirection) {
            if (timestamp - lastMoveTime > moveInterval) {
                movePlayer(touchMoveDirection);
                lastMoveTime = timestamp;
            }
        }

        drawScene();
        requestAnimationFrame(gameLoop);
    }

    function updateCoinCounter() { coinsRemainingSpan.textContent = coinsToCollect; }

    function updateHealthDisplay() {
        healthDisplay.innerHTML = '';
        for (let i = 0; i < playerHealth; i++) {
            const heartImg = document.createElement('img');
            heartImg.src = 'assets/heart.png';
            heartImg.alt = 'Health';
            healthDisplay.appendChild(heartImg);
        }
    }
    
    function loadLevel(levelIndex) {
        playerHealth = MAX_HEALTH;
        updateHealthDisplay();

        walls = []; coins = []; floorTiles = []; traps = [];
        coinsToCollect = 0;
        
        if (levelIndex >= activeLevelSet.length) {
            showWinScreen();
            return;
        }

        const levelLayout = activeLevelSet[levelIndex].layout;
        levelSpan.textContent = `${levelIndex + 1} / ${activeLevelSet.length}`;

        const levelWidth = levelLayout[0].length;
        const levelHeight = levelLayout.length;

        gameCanvas.width = levelWidth * tileSize;
        gameCanvas.height = levelHeight * tileSize;

        for (let y = 0; y < levelHeight; y++) {
            for (let x = 0; x < levelWidth; x++) {
                const tile = levelLayout[y][x];
                
                const worldX = x;
                const worldY = y;

                if (tile === '#') {
                    walls.push({ x: worldX, y: worldY });
                } else {
                    floorTiles.push({ x: worldX, y: worldY });
                    if (tile === 'P') {
                        player.x = worldX;
                        player.y = worldY;
                        startPosition = { x: worldX, y: worldY };
                    } else if (tile === 'C') {
                        coins.push({ x: worldX, y: worldY });
                        coinsToCollect++;
                    } else if (tile === 'E') {
                        exit.x = worldX;
                        exit.y = worldY;
                    } else if (tile === 'S') {
                        traps.push({ x: worldX, y: worldY });
                    }
                }
            }
        }
        updateCoinCounter();
        resizeCanvas();
    }
    
    function movePlayer(direction) {
        if (gameState !== 'PLAYING') return;

        let newX = player.x;
        let newY = player.y;

        if (direction === 'up') newY -= 1;
        if (direction === 'down') newY += 1;
        if (direction === 'left') newX -= 1;
        if (direction === 'right') newX += 1;

        if (!walls.some(wall => wall.x === newX && wall.y === newY)) {
            player.x = newX;
            player.y = newY;
        }
        
        const coinIndex = coins.findIndex(c => c.x === player.x && c.y === player.y);
        if (coinIndex > -1) {
            coins.splice(coinIndex, 1);
            coinsToCollect--;
            updateCoinCounter();
        }

        if (traps.some(trap => trap.x === player.x && trap.y === player.y)) {
            playerHealth--;
            updateHealthDisplay();

            if (playerHealth <= 0) {
                showGameOverMenu();
            } else {
                player.x = startPosition.x;
                player.y = startPosition.y;
            }
        }

        if (coinsToCollect === 0 && player.x === exit.x && player.y === exit.y) {
            currentLevel++;
            loadLevel(currentLevel);
        }
    }
    
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (settingsMenu.style.display === 'block') {
                resumeGame();
            } else if (gameState === 'PLAYING') {
                pauseGame();
            } else if (gameState === 'PAUSED') {
                resumeGame();
            }
            return;
        }
        
        const keyMap = {
            'ArrowUp': 'up',
            'ArrowDown': 'down',
            'ArrowLeft': 'left',
            'ArrowRight': 'right'
        };

        if (keyMap[e.key]) {
            e.preventDefault();
            movePlayer(keyMap[e.key]);
        }
    });

    // --- UI State Management Functions ---
    function showMainMenu() {
        gameState = 'MENU';
        mainMenu.style.display = 'block';
        characterSelectMenu.style.display = 'none';
        pauseMenu.style.display = 'none';
        gameWrapper.style.display = 'none';
        gameWrapper.style.filter = 'none';
        winScreen.style.display = 'none';
        helpMenu.style.display = 'none';
        settingsMenu.style.display = 'none';
        gameOverMenu.style.display = 'none';
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

    function showSettingsMenu() {
        gameState = 'PAUSED';
        backgroundMusic.pause();
        settingsMenu.style.display = 'block';
        gameWrapper.style.filter = 'blur(5px)';
    }

    function showGameOverMenu() {
        gameState = 'GAMEOVER';
        backgroundMusic.pause();
        gameOverMenu.style.display = 'block';
        gameWrapper.style.filter = 'blur(5px)';
    }

    function restartDifficulty() {
        gameOverMenu.style.display = 'none';
        gameWrapper.style.filter = 'none';
        
        gameState = 'PLAYING';
        backgroundMusic.currentTime = 0;
        backgroundMusic.play().catch(e => console.error("Music playback failed:", e));
        
        currentLevel = 0;
        loadLevel(currentLevel);
    }

    function resumeGame() {
        gameState = 'PLAYING';
        backgroundMusic.play();
        pauseMenu.style.display = 'none';
        settingsMenu.style.display = 'none';
        gameWrapper.style.filter = 'none';
    }

    function showWinScreen() {
        gameState = 'WIN';
        winScreen.style.display = 'block';
        gameWrapper.style.display = 'none';
        backgroundMusic.pause();

        if (characters[characters[selectedDifficulty].unlocksOn]) {
            characters[characters[selectedDifficulty].unlocksOn].unlocked = true;
        }
        saveUnlocks();
    }

    function startGame() {
        playerTexture = loadTexture(gl, selectedSpritePath);
        activeLevelSet = levels[selectedDifficulty];
        gameState = 'PLAYING';
        characterSelectMenu.style.display = 'none';
        gameWrapper.style.display = 'flex';

        backgroundMusic.play().catch(e => console.error("Music playback failed:", e));
        currentLevel = 0;
        loadLevel(currentLevel);
    }

    function resizeCanvas() {
        const gameContainer = gameWrapper;
        const containerWidth = gameContainer.clientWidth;
        const containerHeight = gameContainer.clientHeight;
        
        const mobileBreakpoint = 768;
        let scaleFactor;

        if (window.innerWidth < mobileBreakpoint) {
            scaleFactor = 0.85; 
        } else {
            scaleFactor = 0.4;
        }

        const canvasAspectRatio = gameCanvas.width / gameCanvas.height;
        let newWidth, newHeight;
    
        if (containerWidth / containerHeight > canvasAspectRatio) {
            newHeight = containerHeight * scaleFactor;
            newWidth = newHeight * canvasAspectRatio;
        } else {
            newWidth = containerWidth * scaleFactor;
            newHeight = newWidth / canvasAspectRatio;
        }
    
        gameCanvas.style.width = `${newWidth}px`;
        gameCanvas.style.height = `${newHeight}px`;
    }
    
    /**
     * MODIFIED: Sets up continuous movement for touch controls.
     */
    function setupTouchControls() {
        const controls = {
            'control-up': 'up',
            'control-down': 'down',
            'control-left': 'left',
            'control-right': 'right'
        };

        for (const [id, direction] of Object.entries(controls)) {
            const button = document.getElementById(id);
            if(button){
                // Use pointer events to handle both touch and mouse consistently
                button.addEventListener('pointerdown', (e) => {
                    e.preventDefault();
                    // Move once immediately for better responsiveness
                    movePlayer(direction); 
                    // Set direction for continuous movement in the game loop
                    touchMoveDirection = direction;
                    // Set the time of the first move
                    lastMoveTime = performance.now();
                }, { passive: false });

                // Stop movement when the button is released
                button.addEventListener('pointerup', (e) => {
                    e.preventDefault();
                    touchMoveDirection = null;
                });

                // Also stop movement if the pointer leaves the button area
                button.addEventListener('pointerleave', (e) => {
                    e.preventDefault();
                    touchMoveDirection = null;
                });
            }
        }
    }


    // --- UI Event Listeners ---
    startButton.addEventListener('click', showCharacterSelect);
    playButton.addEventListener('click', startGame);
    playAgainButton.addEventListener('click', showMainMenu);
    resumeButton.addEventListener('click', resumeGame);
    pauseToMainMenuButton.addEventListener('click', showMainMenu);
    window.addEventListener('resize', resizeCanvas);
    
    helpButton.addEventListener('click', () => {
        helpMenu.style.display = 'block';
    });
    closeHelpButton.addEventListener('click', () => {
        helpMenu.style.display = 'none';
    });

    settingsButton.addEventListener('click', showSettingsMenu);
    closeSettingsButton.addEventListener('click', resumeGame);

    restartButton.addEventListener('click', restartDifficulty);
    gameOverToMainMenuButton.addEventListener('click', showMainMenu);


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
            selectedDifficulty = e.target.dataset.difficulty;
        }
    });

    // --- Initial Call ---
    loadUnlocks();
    showMainMenu();
    setupTouchControls();
    requestAnimationFrame(gameLoop);
})();
