import { image as birdImageSrc } from './milady.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-app.js';
import { getDatabase, ref, push, query, orderByChild, limitToLast, get, onValue, set, startAt } from 'https://www.gstatic.com/firebasejs/11.4.0/firebase-database.js';

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyAq-UYNdeX3YY59HoVUbV5lq2QhI3zNNKQ",
    authDomain: "flymiladyfly.firebaseapp.com",
    projectId: "flymiladyfly",
    storageBucket: "flymiladyfly.firebasestorage.app",
    messagingSenderId: "699848211597",
    appId: "1:699848211597:web:ef5599ba82dbc6ec51b6c4",
    databaseURL: "https://flymiladyfly-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;  // This helps with GIF animation

// Game state
let gameStarted = false;
let gameOver = false;
let canRestart = true;
let score = 0;
let highestScore = parseInt(getCookie('highScore')) || 0;
let lastPipeSpawn = 0;
let playerName = localStorage.getItem('playerName') || '';

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
    gravity: 0.32,    // Increased from 0.28 for faster falling
    jump: -7.4,       // Increased from -7.2 for higher jumps
    maxVelocity: 6.5, // Increased from 6 for faster falling
    width: 35,
    height: 50,
    jumpCooldown: 0,
    minJumpInterval: 150
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

// Add global variable for current scores at the top with other game state
let currentLeaderboardScores = [];

function sanitizeName(name) {
    if (!name) return '';
    return name
        .replace(/[<>]/g, '') // Remove < and >
        .replace(/[&'"]/g, '') // Remove quotes and ampersands
        .replace(/[^\w\s-]/g, '') // Only allow letters, numbers, spaces, and hyphens
        .replace(/javascript/gi, '') // Remove 'javascript' keyword
        .replace(/script/gi, '') // Remove 'script' keyword
        .replace(/on\w+=/gi, '') // Remove event handlers
        .replace(/data:/gi, '') // Remove data URLs
        .trim()
        .slice(0, 20); // Limit length to 20 characters
}

// Initialize real-time leaderboard listener
function initLeaderboard() {
    const scoresRef = ref(db, 'scores');
    const scoresQuery = query(scoresRef, 
        orderByChild('score'),
        limitToLast(10)
    );
    
    onValue(scoresQuery, (snapshot) => {
        const scores = [];
        snapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            scores.unshift({
                ...data,
                name: sanitizeName(data.name)
            });
        });
        
        currentLeaderboardScores = scores;
        
        // Only update UI elements if we're not in an active game
        if (!gameStarted || gameOver) {
            const leaderboardList = document.getElementById('leaderboard-list');
            if (leaderboardList) {
                leaderboardList.innerHTML = scores.map((score, index) => 
                    `<div>${index + 1}. ${sanitizeName(score.name)}: ${score.score}</div>`
                ).join('');
            }
            
            // Only draw game over screen if the game is actually over
            if (gameOver) {
                drawGameOver(scores);
            }
        }
    });
}

function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    // Initialize real-time leaderboard
    initLeaderboard();
    
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
        if (bird.jumpCooldown === 0) {
            bird.velocity = bird.jump;
            bird.jumpCooldown = bird.minJumpInterval;
        }
    } else if (e.code === 'Space' && gameOver && canRestart) {
        startGame(birdImage);
    }
}

function handleTouch(e, birdImage) {
    e.preventDefault();
    if (!gameStarted) {
        startGame(birdImage);
    } else if (!gameOver) {
        if (bird.jumpCooldown === 0) {
            bird.velocity = bird.jump;
            bird.jumpCooldown = bird.minJumpInterval;
        }
    } else if (canRestart) {
        startGame(birdImage);
    }
}

function update(timestamp, birdImage) {
    if (gameOver) {
        return;
    }

    // Update bird physics
    bird.velocity += bird.gravity;
    
    // Cap fall speed
    bird.velocity = Math.min(bird.velocity, bird.maxVelocity);
    
    // Add slight upward boost when moving upward to maintain momentum
    if (bird.velocity < 0) {
        bird.velocity *= 0.98; // Increased from 0.97 for even better upward momentum
    }
    
    bird.y += bird.velocity;
    
    // Update jump cooldown
    if (bird.jumpCooldown > 0) {
        bird.jumpCooldown = Math.max(0, bird.jumpCooldown - 16); // Assuming 60fps, 16ms per frame
    }

    // Spawn pipes
    if (timestamp - lastPipeSpawn > pipeSpawnInterval) {
        spawnPipe();
        lastPipeSpawn = timestamp;
    }

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

    if (!gameOver) {
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
    }

    if (gameOver) {
        drawGameOver(currentLeaderboardScores);
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
        setCookie('highScore', highestScore, 365);
        
        // Only submit to leaderboard if it's a new personal best
        submitScore(score);
    }
    
    setTimeout(() => {
        canRestart = true;
    }, 750);
}

async function submitScore(score) {
    // Validate score
    if (score < 0 || score > 1000) {
        console.log('Invalid score');
        return;
    }

    // Ask for name if first time
    if (!playerName) {
        let inputName = prompt('New high score! Enter your name (2-20 characters):');
        if (inputName) {
            inputName = sanitizeName(inputName);
            if (inputName && inputName.length >= 2) {
                playerName = inputName;
                localStorage.setItem('playerName', playerName);
            } else {
                alert('Name must be 2-20 characters long and contain only letters, numbers, spaces, or hyphens');
                return;
            }
        } else {
            return; // User cancelled
        }
    }

    try {
        const scoresRef = ref(db, 'scores');
        
        // Find existing score for this player
        const nameQuery = query(scoresRef, 
            orderByChild('name'),
            limitToLast(1)
        );
        
        const snapshot = await get(nameQuery);
        let existingScore = null;
        
        snapshot.forEach(childSnapshot => {
            const data = childSnapshot.val();
            if (data.name === playerName) {
                existingScore = {
                    key: childSnapshot.key,
                    ...data
                };
            }
        });

        const scoreData = {
            name: playerName,
            score: score,
            timestamp: Date.now()
        };

        if (existingScore) {
            // Only update if new score is higher
            if (score > existingScore.score) {
                const updateRef = ref(db, `scores/${existingScore.key}`);
                await set(updateRef, scoreData);
                console.log('Score updated successfully');
            }
        } else {
            // Create new score
            await push(scoresRef, scoreData);
            console.log('New score created successfully');
        }
    } catch (error) {
        console.error('Error submitting score:', error);
        alert('Error submitting score. Please try again.');
    }
}

async function showLeaderboard() {
    const scoresRef = ref(db, 'scores');
    const scoresQuery = query(scoresRef, 
        orderByChild('score'),
        limitToLast(10)
    );
    
    const snapshot = await get(scoresQuery);
    const scores = [];
    
    snapshot.forEach(childSnapshot => {
        scores.unshift(childSnapshot.val());
    });
    
    return scores;
}

// Cookie helper functions
function setCookie(name, value, days) {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/';
}

function getCookie(name) {
    const nameEQ = name + '=';
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function drawGameOver(scores) {
    // Clear the entire screen first
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    
    // Calculate responsive vertical spacing
    const screenHeight = canvas.height;
    const topMargin = screenHeight * 0.15; // Start at 15% from top
    const lineSpacing = Math.min(25, screenHeight * 0.04); // Responsive line spacing
    
    let currentY = topMargin;
    
    // Game Over text
    const fontSize = Math.min(48, screenHeight * 0.07); // Responsive font size
    ctx.font = `${fontSize}px Arial`;
    const gameOverText = 'Game Over!';
    const gameOverWidth = ctx.measureText(gameOverText).width;
    ctx.fillText(gameOverText, (canvas.width - gameOverWidth) / 2, currentY);
    
    // Final Score text
    currentY += fontSize;
    const scoreFontSize = Math.min(24, screenHeight * 0.04);
    ctx.font = `${scoreFontSize}px Arial`;
    const scoreText = `Final Score: ${score}`;
    const scoreWidth = ctx.measureText(scoreText).width;
    ctx.fillText(scoreText, (canvas.width - scoreWidth) / 2, currentY);
    
    if (scores && scores.length > 0) {
        // Draw leaderboard header
        currentY += lineSpacing * 1.5;
        const leaderboardFontSize = Math.min(20, screenHeight * 0.035);
        ctx.font = `${leaderboardFontSize}px Arial`;
        ctx.fillText('Global Top 10:', (canvas.width - 100) / 2, currentY);
        
        // Draw scores
        currentY += lineSpacing;
        const scoreFontSize = Math.min(16, screenHeight * 0.03);
        ctx.font = `${scoreFontSize}px Arial`;
        scores.forEach((score, index) => {
            const text = `${index + 1}. ${sanitizeName(score.name)}: ${score.score}`; // Sanitize when displaying
            const textWidth = ctx.measureText(text).width;
            ctx.fillText(text, (canvas.width - textWidth) / 2, currentY);
            currentY += lineSpacing;
        });
    }
    
    // Restart text at bottom
    const restartFontSize = Math.min(16, screenHeight * 0.03);
    ctx.font = `${restartFontSize}px Arial`;
    const restartText = 'Press Space or Tap to Restart';
    const restartWidth = ctx.measureText(restartText).width;
    ctx.fillText(restartText, (canvas.width - restartWidth) / 2, screenHeight - lineSpacing * 2);
}

// Start the game
init();
