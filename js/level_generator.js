// dungeon-puzzle/js/level_generator.js

// This function generates a random maze using a Randomized Depth-First Search algorithm.
export function generateLevel(width, height) {
    // Initialize grid with all walls
    const level = Array(height).fill(null).map(() => Array(width).fill('#'));
    const stack = [];
    const startX = 1;
    const startY = 1;

    // Helper to check if a cell is valid to move to
    const isValid = (x, y) => {
        return y >= 1 && y < height - 1 && x >= 1 && x < width - 1 && level[y][x] === '#';
    };

    // Start carving the maze from the top-left corner
    level[startY][startX] = ' ';
    stack.push([startX, startY]);

    let lastCell = [startX, startY];

    while (stack.length > 0) {
        const [cx, cy] = stack[stack.length - 1];
        const neighbors = [];

        // Check potential neighbors (2 cells away)
        if (isValid(cx, cy - 2)) neighbors.push([cx, cy - 2, cx, cy - 1]); // Up
        if (isValid(cx, cy + 2)) neighbors.push([cx, cy + 2, cx, cy + 1]); // Down
        if (isValid(cx - 2, cy)) neighbors.push([cx - 2, cy, cx - 1, cy]); // Left
        if (isValid(cx + 2, cy)) neighbors.push([cx + 2, cy, cx + 1, cy]); // Right

        if (neighbors.length > 0) {
            // Choose a random neighbor
            const [nx, ny, wx, wy] = neighbors[Math.floor(Math.random() * neighbors.length)];
            
            // Carve path to neighbor
            level[ny][nx] = ' '; // New cell
            level[wy][wx] = ' '; // Wall between cells
            
            stack.push([nx, ny]);
            lastCell = [nx, ny]; // Keep track of the last cell for the exit
        } else {
            // Backtrack
            stack.pop();
        }
    }

    // --- Place Player, Exit, and Coins ---

    // Player starts at the beginning of the maze
    level[startY][startX] = 'P';

    // Exit is at the last cell carved by the algorithm
    level[lastCell[1]][lastCell[0]] = 'E';

    // Place some coins randomly on floor spaces
    let coinsPlaced = 0;
    const numCoins = 5 + Math.floor(Math.random() * 5); // 5 to 9 coins per level
    while (coinsPlaced < numCoins) {
        const randX = Math.floor(Math.random() * (width - 2)) + 1;
        const randY = Math.floor(Math.random() * (height - 2)) + 1;

        if (level[randY][randX] === ' ') {
            level[randY][randX] = 'C';
            coinsPlaced++;
        }
    }

    // Convert the array of arrays of characters into an array of strings
    return level.map(row => row.join(''));
}