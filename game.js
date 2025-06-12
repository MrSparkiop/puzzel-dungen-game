document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const gl = canvas.getContext('webgl');

    if (!gl) {
        alert('WebGL not supported!');
        return;
    }

    const coinsRemainingSpan = document.getElementById('coins-remaining');
    const levelSpan = document.getElementById('level');

    const tileSize = 64;
    const mapSize = canvas.width / tileSize;

    let currentLevel = 0;
    let player = { x: 1, y: 1 };
    let coins = [];
    let exit = { x: 0, y: 0 };
    let walls = [];
    let coinsToCollect = 0;

    const levels = [
        [ // New Level 1
            "##########",
            "#P       #",
            "#C###### #",
            "#      # #",
            "###### # #",
            "# C    # #",
            "# ###### #",
            "#   C    #",
            "# C    C #",
            "##########"
        ],
        [ // Level 2
            "##########",
            "#P       #",
            "# C#C#C# #",
            "#  # # # #",
            "#C#C#C#C #",
            "# # # #  #",
            "#C#C#C#C #",
            "# # # #  #",
            "#   C    #",
            "##########"
        ],
        [ // Level 3
            "##########",
            "#P  #    #",
            "# C # C  #",
            "# # #### #",
            "#   #  C #",
            "# ### ## #",
            "# # C  # #",
            "# #  C # #",
            "#   ##   #",
            "##########"
        ]
    ];

    function loadLevel(levelIndex) {
        const level = levels[levelIndex];
        walls = [];
        coins = [];
        coinsToCollect = 0;
        levelSpan.textContent = levelIndex + 1;

        for (let y = 0; y < level.length; y++) {
            for (let x = 0; x < level[y].length; x++) {
                const tile = level[y][x];
                if (tile === '#') {
                    walls.push({ x, y });
                } else if (tile === 'P') {
                    player.x = x;
                    player.y = y;
                } else if (tile === 'C') {
                    coins.push({ x, y });
                    coinsToCollect++;
                }
            }
        }
        exit.x = mapSize - 2; // Fixed exit position for simplicity
        exit.y = mapSize - 2;
        updateCoinCounter();
    }

    function updateCoinCounter() {
        coinsRemainingSpan.textContent = coinsToCollect;
    }

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

    function initShaderProgram(gl, vsSource, fsSource) {
        const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
        const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const shaderProgram = gl.createProgram();
        gl.attachShader(shaderProgram, vertexShader);
        gl.attachShader(shaderProgram, fragmentShader);
        gl.linkProgram(shaderProgram);
        if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
            alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
            return null;
        }
        return shaderProgram;
    }

    function loadShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

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

    function initBuffers(gl) {
        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        const positions = [
             1.0,  1.0,
            -1.0,  1.0,
             1.0, -1.0,
            -1.0, -1.0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

        const textureCoordBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
        const textureCoordinates = [
            1.0, 1.0,
            0.0, 1.0,
            1.0, 0.0,
            0.0, 0.0,
        ];
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(textureCoordinates), gl.STATIC_DRAW);

        return {
            position: positionBuffer,
            textureCoord: textureCoordBuffer,
        };
    }

    const buffers = initBuffers(gl);

    function createAssetTexture(color) {
        const textureCanvas = document.createElement('canvas');
        const ctx = textureCanvas.getContext('2d');
        textureCanvas.width = tileSize;
        textureCanvas.height = tileSize;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, tileSize, tileSize);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        return texture;
    }
    
    function createCoinTexture() {
        const textureCanvas = document.createElement('canvas');
        const ctx = textureCanvas.getContext('2d');
        textureCanvas.width = tileSize;
        textureCanvas.height = tileSize;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, tileSize, tileSize);
        ctx.beginPath();
        ctx.arc(tileSize / 2, tileSize / 2, tileSize * 0.4, 0, 2 * Math.PI);
        ctx.fillStyle = 'gold';
        ctx.fill();

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        return texture;
    }


    const playerTexture = createAssetTexture('blue');
    const wallTexture = createAssetTexture('darkgrey');
    const coinTexture = createCoinTexture();
    const exitTexture = createAssetTexture('purple');

    function drawScene() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        const projectionMatrix = mat4.create();
        mat4.ortho(projectionMatrix, 0, canvas.width, canvas.height, 0, -1, 1);

        gl.useProgram(programInfo.program);
        gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);

        walls.forEach(wall => drawObject(wall, wallTexture));
        coins.forEach(coin => drawObject(coin, coinTexture));
        if (coinsToCollect === 0) {
            drawObject(exit, exitTexture);
        }
        drawObject(player, playerTexture);
    }

    function drawObject(obj, texture) {
        const modelViewMatrix = mat4.create();
        mat4.translate(modelViewMatrix, modelViewMatrix, [obj.x * tileSize + tileSize / 2, obj.y * tileSize + tileSize / 2, 0]);
        mat4.scale(modelViewMatrix, modelViewMatrix, [tileSize / 2, tileSize / 2, 1]);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
        gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

        gl.bindBuffer(gl.ARRAY_BUFFER, buffers.textureCoord);
        gl.vertexAttribPointer(programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(programInfo.attribLocations.textureCoord);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.uniform1i(programInfo.uniformLocations.uSampler, 0);

        gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    window.addEventListener('keydown', (e) => {
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
            }
        }
        
        requestAnimationFrame(drawScene);
    });
    
    // Minimal matrix library
    const mat4 = {
        create: () => {
            const out = new Float32Array(16);
            out[0] = 1;
            out[5] = 1;
            out[10] = 1;
            out[15] = 1;
            return out;
        },
        ortho: (out, left, right, bottom, top, near, far) => {
            const lr = 1 / (left - right);
            const bt = 1 / (bottom - top);
            const nf = 1 / (near - far);
            out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
            out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
            out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
            out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
            return out;
        },
        translate: (out, a, v) => {
            let x = v[0], y = v[1], z = v[2];
            let a00, a01, a02, a03;
            let a10, a11, a12, a13;
            let a20, a21, a22, a23;
            if (a === out) {
                out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
                out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
                out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
                out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
            } else {
                a00 = a[0]; a01 = a[1]; a02 = a[2]; a03 = a[3];
                a10 = a[4]; a11 = a[5]; a12 = a[6]; a13 = a[7];
                a20 = a[8]; a21 = a[9]; a22 = a[10]; a23 = a[11];
                out[0] = a00; out[1] = a01; out[2] = a02; out[3] = a03;
                out[4] = a10; out[5] = a11; out[6] = a12; out[7] = a13;
                out[8] = a20; out[9] = a21; out[10] = a22; out[11] = a23;
                out[12] = a00 * x + a10 * y + a20 * z + a[12];
                out[13] = a01 * x + a11 * y + a21 * z + a[13];
                out[14] = a02 * x + a12 * y + a22 * z + a[14];
                out[15] = a03 * x + a13 * y + a23 * z + a[15];
            }
            return out;
        },
        scale: (out, a, v) => {
            let x = v[0], y = v[1], z = v[2];
            out[0] = a[0] * x;
            out[1] = a[1] * x;
            out[2] = a[2] * x;
            out[3] = a[3] * x;
            out[4] = a[4] * y;
            out[5] = a[5] * y;
            out[6] = a[6] * y;
            out[7] = a[7] * y;
            out[8] = a[8] * z;
            out[9] = a[9] * z;
            out[10] = a[10] * z;
            out[11] = a[11] * z;
            out[12] = a[12];
            out[13] = a[13];
            out[14] = a[14];
            out[15] = a[15];
            return out;
        }
    };

    loadLevel(currentLevel);
    requestAnimationFrame(drawScene);
});