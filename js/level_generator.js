// dungeon-puzzle/js/level_generator.js

export function generateLevel(width, height, difficulty) {
    const level = Array(height).fill(null).map(() => Array(width).fill('#'));
    const stack = [];
    const startX = 1;
    const startY = 1;

    const isValid = (x, y) => {
        return y >= 1 && y < height - 1 && x >= 1 && x < width - 1 && level[y][x] === '#';
    };

    level[startY][startX] = ' ';
    stack.push([startX, startY]);
    let lastCell = [startX, startY];

    while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const neighbors = [];
        if (isValid(cx, cy - 2)) neighbors.push([cx, cy - 2, cx, cy - 1]);
        if (isValid(cx, cy + 2)) neighbors.push([cx, cy + 2, cx, cy + 1]);
        if (isValid(cx - 2, cy)) neighbors.push([cx - 2, cy, cx - 1, cy]);
        if (isValid(cx + 2, cy)) neighbors.push([cx + 2, cy, cx + 1, cy]);

        if (neighbors.length > 0) {
            const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            level[ny][nx] = ' ';
            level[wy][wx] = ' ';
            stack.push([nx, ny]);
            lastCell = [nx, ny];
        } else {
            stack.pop();
        }
    }

    level[startY][startX] = 'P';
    level[lastCell[1]][lastCell[0]] = 'E';

    // --- Adjust number of coins based on difficulty ---
    let numCoins;
    if (difficulty === 'easy') {
        numCoins = 3 + Math.floor(Math.random() * 3); // 3-5 coins
    } else if (difficulty === 'medium') {
        numCoins = 6 + Math.floor(Math.random() * 4); // 6-9 coins
    } else { // hard
        numCoins = 10 + Math.floor(Math.random() * 5); // 10-14 coins
    }
    
    let coinsPlaced = 0;
    while (coinsPlaced < numCoins) {
        const randX = Math.floor(Math.random() * (width - 2)) + 1;
        const randY = Math.floor(Math.random() * (height - 2)) + 1;
        if (level[randY][randX] === ' ') {
            level[randY][randX] = 'C';
            coinsPlaced++;
        }
    }

    return level.map(row => row.join(''));
}