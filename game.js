import { image as birdImageSrc } from './milady.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;  // This helps with GIF animation

// Game state
let gameStarted = false;
let gameOver = false;
let canRestart = true;
let score = 0;
let highestScore = 0;
let lastPipeSpawn = 0;

// Initialize screens and audio
const gameMusic = document.querySelector('audio');
const startScreen = document.getElementById('start-screen');
const startButton = document.querySelector('.start-button');
gameMusic.volume = 0.75; // Set initial volume

// Game objects
const bird = {
    x: 0,
    y: 0,
    velocity: 0,
    gravity: 0.5,
    jump: -8,
    width: 35,
    height: 50
};

const pipes = [];
let pipeWidth = 50;
// Smaller gap for larger screens, minimum of 120px, maximum of 20% of height or 180px
let pipeGap = Math.min(Math.max(120, window.innerHeight * 0.2), 180);
// Fixed base spawn interval
let pipeSpawnInterval = 2500;

// Stars setup
const stars = Array(100).fill().map(() => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    size: Math.random() * 2 + 1,
    brightness: Math.random()
}));

// Set canvas size to window size
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    // Adjust pipe dimensions based on screen size
    pipeWidth = Math.min(50, canvas.width * 0.1);
    // Smaller gap for larger screens, minimum of 120px, maximum of 20% of height or 180px
    pipeGap = Math.min(Math.max(120, canvas.height * 0.2), 180);
    // Balanced spawn interval for all screen sizes
    pipeSpawnInterval = Math.max(2000, Math.min(canvas.width, 3000));
    // Adjust bird size based on screen width
    bird.width = Math.min(35, canvas.width * 0.08);
    bird.height = (bird.width * 50) / 35;
    bird.x = canvas.width * 0.1;
    bird.y = canvas.height / 2;
    
    // Reposition stars
    stars.forEach(star => {
        star.x = Math.random() * canvas.width;
        star.y = Math.random() * canvas.height;
    });
}

// Call once at start and add resize listener
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Load image and start immediately
const birdImage = new Image();

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Load bird image
    birdImage.onload = () => {
        console.log('Image loaded');
        startButton.disabled = false;
        startButton.textContent = 'Start Game';
        // Start background animation
        requestAnimationFrame(animateBackground);
    };
    birdImage.src = birdImageSrc;

    // Event listeners
    startButton.addEventListener('click', () => startGame(birdImage));
    document.addEventListener('keydown', (e) => handleKeydown(e, birdImage));
    canvas.addEventListener('touchstart', (e) => handleTouch(e, birdImage));
}

function startGame(birdImage) {
    if (!birdImage.complete) {
        console.log('Image still loading...');
        return;
    }
    console.log('Starting game...');
    startScreen.style.display = 'none';
    gameStarted = true;
    gameOver = false;
    canRestart = true;  // Reset restart flag
    score = 0;
    lastPipeSpawn = 0;
    pipes.length = 0;
    bird.y = canvas.height / 2;
    bird.velocity = 0;
    
    // Only try to play music if it was previously paused
    if (gameMusic.paused) {
        gameMusic.currentTime = 0;
        gameMusic.play().catch(e => console.log('Audio play failed:', e));
    }
    requestAnimationFrame((timestamp) => update(timestamp, birdImage));
}

function handleKeydown(e, birdImage) {
    if ((e.code === 'Space' || e.code === 'Enter') && !gameStarted) {
        startGame(birdImage);
    } else if (e.code === 'Space' && !gameOver) {
        bird.velocity = bird.jump;
    } else if (e.code === 'Space' && gameOver && canRestart) {
        startGame(birdImage);
    }
}

function handleTouch(e, birdImage) {
    e.preventDefault();
    if (!gameStarted) {
        startGame(birdImage);
    } else if (!gameOver) {
        bird.velocity = bird.jump;
    } else if (canRestart) {
        startGame(birdImage);
    }
}

function update(timestamp, birdImage) {
    if (gameOver) {
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

    // Update pipes with fixed speed
    const baseSpeed = 3; // Slower base speed
    const maxSpeedAdjustment = 1; // Maximum additional speed based on screen size
    const speedAdjustment = Math.min(canvas.width / 1920, 1) * maxSpeedAdjustment; // Scale based on typical desktop width
    const pipeSpeed = baseSpeed + speedAdjustment;
    
    pipes.forEach((pipe, index) => {
        pipe.x -= pipeSpeed;

        // Check collision
        if (bird.x + bird.width > pipe.x && 
            bird.x < pipe.x + pipeWidth && 
            (bird.y < pipe.topHeight || 
             bird.y + bird.height > pipe.topHeight + pipeGap)) {
            handleGameOver();
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
        handleGameOver();
    }

    draw(birdImage);
    if (!gameOver) {
        requestAnimationFrame((t) => update(t, birdImage));
    }
}

function draw(birdImage) {
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
    if (highestScore > 0) {
        ctx.fillText(`Highest Score: ${highestScore}`, 10, 60);
    }

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
        const restartText = 'Press Space or Tap to Restart';
        const restartWidth = ctx.measureText(restartText).width;
        ctx.fillText(restartText, (canvas.width - restartWidth) / 2, canvas.height/2 + 80);
    }
}

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
        requestAnimationFrame(drawBackground);
    }
}

function spawnPipe() {
    const minHeight = Math.min(50, canvas.height * 0.1); // Min height is 10% of screen height or 50px
    const maxHeight = canvas.height - pipeGap - minHeight;
    const height = Math.random() * (maxHeight - minHeight) + minHeight;
    
    pipes.push({
        x: canvas.width,
        topHeight: height,
        passed: false
    });
}

function handleGameOver() {
    gameOver = true;
    canRestart = false;
    gameMusic.pause();
    gameMusic.currentTime = 0;
    
    // Update highest score
    if (score > highestScore) {
        highestScore = score;
    }
    
    setTimeout(() => {
        canRestart = true;
    }, 750);
}

// Start the game
init();
