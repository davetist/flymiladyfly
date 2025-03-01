import { image as birdImageSrc } from './milady.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;  // This helps with GIF animation

// Initialize screens and audio
const gameMusic = document.querySelector('audio');
const loadingScreen = document.getElementById('loading-screen');
const startScreen = document.getElementById('start-screen');
const startButton = document.querySelector('.start-button');
gameMusic.volume = 0.75; // Set initial volume

// Wait for both audio and image to load before starting
const birdImage = new Image();
let imageLoaded = false;
let gameStarted = false;

function showStartScreen() {
    loadingScreen.style.display = 'none';
    startScreen.style.display = 'flex';
}

function startGame() {
    startScreen.style.display = 'none';
    gameStarted = true;
    gameMusic.play().catch(e => console.log('Audio play failed:', e));
    requestAnimationFrame(update);
}

function checkAllLoaded() {
    if (imageLoaded) {
        showStartScreen();
    }
}

// Image loading
birdImage.onload = () => {
    imageLoaded = true;
    checkAllLoaded();
};
birdImage.src = birdImageSrc;

// Start button click handler
startButton.addEventListener('click', startGame);

const bird = {
    x: 50,
    y: canvas.height / 2,
    velocity: 0,
    gravity: 0.5,
    jump: -8,
    width: 35,  // Scaled down but maintaining ratio
    height: 50  // height ≈ width * (282/200)
};

const pipes = [];
const pipeWidth = 50;
const pipeGap = 150;
const pipeSpawnInterval = 1500;
let lastPipeSpawn = 0;
let score = 0;
let gameOver = false;

// Stars setup
const stars = Array(100).fill().map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1,
    brightness: Math.random()
}));

function spawnPipe() {
    const minHeight = 50;
    const maxHeight = canvas.height - pipeGap - minHeight;
    const height = Math.random() * (maxHeight - minHeight) + minHeight;
    
    pipes.push({
        x: canvas.width,
        topHeight: height,
        passed: false
    });
}

function update(timestamp) {
    if (gameOver) {
        gameMusic.pause();
        return;
    }

    // Spawn pipes
    if (timestamp - lastPipeSpawn > pipeSpawnInterval) {
        spawnPipe();
        lastPipeSpawn = timestamp;
    }

    // Update bird
    bird.velocity += bird.gravity;
    bird.y += bird.velocity;

    // Update pipes
    pipes.forEach((pipe, index) => {
        pipe.x -= 3;

        // Check collision
        if (bird.x + bird.width > pipe.x && 
            bird.x < pipe.x + pipeWidth && 
            (bird.y < pipe.topHeight || 
             bird.y + bird.height > pipe.topHeight + pipeGap)) {
            gameOver = true;
        }

        // Score point
        if (!pipe.passed && bird.x > pipe.x + pipeWidth) {
            score++;
            pipe.passed = true;
        }
    });

    // Remove off-screen pipes
    if (pipes[0] && pipes[0].x < -pipeWidth) {
        pipes.shift();
    }

    // Check boundaries
    if (bird.y < 0 || bird.y + bird.height > canvas.height) {
        gameOver = true;
    }

    draw();
    requestAnimationFrame(update);
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a3e';  // Purple-blue background
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw stars
    stars.forEach(star => {
        // Make stars twinkle by varying opacity
        star.brightness = Math.sin(Date.now() * 0.01 + star.x) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255, 250, 205, ${star.brightness})`;  // Light yellow stars
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });

    // Reset image smoothing each frame as it can get reset
    ctx.imageSmoothingEnabled = false;

    // Draw bird
    ctx.drawImage(birdImage, bird.x, bird.y, bird.width, bird.height);

    // Draw pipes
    pipes.forEach(pipe => {
        // Create gradient for 3D effect
        const gradient = ctx.createLinearGradient(pipe.x, 0, pipe.x + pipeWidth, 0);
        gradient.addColorStop(0, '#ffe115');
        gradient.addColorStop(0.3, '#fff200');
        gradient.addColorStop(1, '#ffd000');
        
        ctx.fillStyle = gradient;
        
        // Top pipe
        ctx.beginPath();
        ctx.rect(pipe.x, 0, pipeWidth, pipe.topHeight);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Bottom pipe
        ctx.beginPath();
        ctx.rect(pipe.x, pipe.topHeight + pipeGap, pipeWidth, canvas.height - pipe.topHeight - pipeGap);
        ctx.fill();
        ctx.stroke();
    });

    // Draw score
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score}`, 10, 30);

    if (gameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        
        // Game Over text
        ctx.font = '48px Arial';
        const gameOverText = 'Game Over!';
        const gameOverWidth = ctx.measureText(gameOverText).width;
        ctx.fillText(gameOverText, (canvas.width - gameOverWidth) / 2, canvas.height/2);
        
        // Final Score text
        ctx.font = '24px Arial';
        const scoreText = `Final Score: ${score}`;
        const scoreWidth = ctx.measureText(scoreText).width;
        ctx.fillText(scoreText, (canvas.width - scoreWidth) / 2, canvas.height/2 + 40);
        
        // Restart instruction text
        ctx.font = '16px Arial';
        const restartText = 'Press Space to Restart';
        const restartWidth = ctx.measureText(restartText).width;
        ctx.fillText(restartText, (canvas.width - restartWidth) / 2, canvas.height/2 + 80);
    }
}

// Handle jump
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !gameOver) {
        bird.velocity = bird.jump;
    }
    if (e.code === 'Space' && gameOver) {
        // Reset game
        bird.y = canvas.height / 2;
        bird.velocity = 0;
        pipes.length = 0;
        score = 0;
        gameOver = false;
        lastPipeSpawn = 0;
        // Restart music
        gameMusic.currentTime = 0;
        gameMusic.play().catch(e => console.log('Audio play failed:', e));
        requestAnimationFrame(update);
    }
});

// Add touch support
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    if (!gameOver) {
        bird.velocity = bird.jump;
    } else {
        // Reset game on touch when game is over
        bird.y = canvas.height / 2;
        bird.velocity = 0;
        pipes.length = 0;
        score = 0;
        gameOver = false;
        lastPipeSpawn = 0;
        gameMusic.currentTime = 0;
        gameMusic.play().catch(e => console.log('Audio play failed:', e));
        requestAnimationFrame(update);
    }
});

// Draw initial background
function drawBackground() {
    if (!gameStarted) {  // Only draw background before game starts
        ctx.fillStyle = '#1a1a3e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        stars.forEach(star => {
            star.brightness = Math.sin(Date.now() * 0.01 + star.x) * 0.5 + 0.5;
            ctx.fillStyle = `rgba(255, 250, 205, ${star.brightness})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}

// Start animating background even before game starts
function animateBackground() {
    if (!gameStarted) {
        drawBackground();
        requestAnimationFrame(animateBackground);
    }
}
animateBackground();
