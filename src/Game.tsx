import { useRef, useEffect, useState } from "react";

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
const TILE_WIDTH = 80;
const TILE_HEIGHT = 15;

type GameState = "idle" | "playing" | "paused" | "over";

interface Tile {
  x: number;
  y: number;
  broken?: boolean;
  touched?: boolean;
  used?: boolean; // For red tiles that have been jumped on once
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<number[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const jumpCount = useRef(0); // Track consecutive jumps
  const baseJumpPower = useRef(-8); // Base jump velocity
  const player = useRef({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
    y: CANVAS_HEIGHT - 150,
    vy: 0,
    vx: 0, // Add horizontal velocity for smoother movement
  });

  // Load high scores from memory on component mount
  useEffect(() => {
    const savedScores = loadHighScores();
    setHighScores(savedScores);
  }, []);

  // High score management functions
  const loadHighScores = (): number[] => {
    // Since localStorage isn't available, we'll use a ref to persist scores during the session
    return highScoresRef.current;
  };

  const saveHighScore = (newScore: number) => {
    const currentScores = [...highScoresRef.current];
    currentScores.push(newScore);
    currentScores.sort((a, b) => b - a); // Sort descending
    const topTen = currentScores.slice(0, 10);
    highScoresRef.current = topTen;
    setHighScores(topTen);
  };

  // Persistent high scores storage (using useRef since localStorage isn't available)
  const highScoresRef = useRef<number[]>([]);

  const scrollSpeed = useRef(0.8);
  const lastTime = useRef(0);
  const cameraY = useRef(0);

  // Initialize tiles with guaranteed starting platform
  const initializeTiles = () => {
    const initialTiles: Tile[] = [];

    // Always start with a green tile at the bottom center
    initialTiles.push({
      x: CANVAS_WIDTH / 2 - TILE_WIDTH / 2,
      y: CANVAS_HEIGHT - 100,
      broken: false,
      touched: false,
    });

    // Generate additional tiles going upward
    for (let i = 1; i < 15; i++) {
      initialTiles.push({
        x: Math.random() * (CANVAS_WIDTH - TILE_WIDTH),
        y: CANVAS_HEIGHT - 100 - i * 80,
        broken: Math.random() < 0.15, // 15% chance broken
        touched: false,
      });
    }
    return initialTiles;
  };

  // Spawn tiles
  useEffect(() => {
    setTiles(initializeTiles());
  }, []);

  // Main game loop
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    let animationFrame: number;

    const loop = (time: number) => {
      const delta = time - lastTime.current;
      lastTime.current = time;

      if (gameState === "playing") {
        update(delta);
        draw(ctx);
      } else if (gameState === "idle") {
        draw(ctx, true);
      } else if (gameState === "over") {
        draw(ctx, false, true);
      }

      animationFrame = requestAnimationFrame(loop);
    };

    animationFrame = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animationFrame);
  }, [gameState, tiles, score]);

  function update(delta: number) {
    // Camera follows player when going up
    if (player.current.y < CANVAS_HEIGHT / 2) {
      cameraY.current = CANVAS_HEIGHT / 2 - player.current.y;
    }

    console.log(delta);
    

    // Move tiles relative to camera
    setTiles((prev) =>
      prev
        .map((tile) => ({ ...tile, y: tile.y + scrollSpeed.current }))
        .filter((tile) => tile.y < CANVAS_HEIGHT + cameraY.current + 100)
    );

    // Spawn new tiles at the top
    if (tiles.length < 15) {
      const highestTile = Math.min(...tiles.map((t) => t.y));
      setTiles((prev) => [
        ...prev,
        {
          x: Math.random() * (CANVAS_WIDTH - TILE_WIDTH),
          y: highestTile - 80,
          broken: Math.random() < 0.15,
          touched: false,
        },
      ]);
    }

    // Physics
    player.current.vy += 0.4; // Gravity
    player.current.y += player.current.vy;

    // Horizontal movement with air resistance
    player.current.x += player.current.vx;
    player.current.vx *= 0.95; // Air resistance

    // Keep player in bounds horizontally
    if (player.current.x < 0) player.current.x = CANVAS_WIDTH - PLAYER_SIZE;
    if (player.current.x > CANVAS_WIDTH - PLAYER_SIZE) player.current.x = 0;

    // Collision detection
    tiles.forEach((tile, index) => {
      if (
        player.current.x < tile.x + TILE_WIDTH &&
        player.current.x + PLAYER_SIZE > tile.x &&
        player.current.y + PLAYER_SIZE > tile.y &&
        player.current.y + PLAYER_SIZE < tile.y + TILE_HEIGHT + 5 &&
        player.current.vy > 0 &&
        !tile.used // Only allow collision if tile hasn't been used up
      ) {
        if (!tile.broken) {
          // Green tile - normal jump
          jumpCount.current += 1;
          const jumpPower = baseJumpPower.current - jumpCount.current * 0.5;
          player.current.vy = Math.max(jumpPower, -15);

          // Score only if tile hasn't been touched before
          if (!tile.touched) {
            setScore((s) => s + 10);
            // Mark tile as touched
            setTiles((prev) =>
              prev.map((t, i) => (i === index ? { ...t, touched: true } : t))
            );
          }
        } else {
          // Red tile - allow one jump then disappear
          if (!tile.touched) {
            // First jump on red tile
            jumpCount.current += 1;
            const jumpPower = baseJumpPower.current - jumpCount.current * 0.5;
            player.current.vy = Math.max(jumpPower, -15);

            setScore((s) => s + 5); // Less points for red tiles

            // Mark as touched and used (will become invisible)
            setTiles((prev) =>
              prev.map((t, i) =>
                i === index ? { ...t, touched: true, used: true } : t
              )
            );
          }
          // If already touched, the tile is used up and collision won't trigger
        }
      }
    });

    // Reset jump count if player is falling for too long
    if (player.current.vy > 5) {
      jumpCount.current = 0;
    }

    // Game over if player falls below screen
    if (player.current.y > CANVAS_HEIGHT + 100) {
      // Save high score before ending game
      if (score > 0) {
        saveHighScore(score);
      }
      setGameState("over");
    }
  }

  function draw(ctx: CanvasRenderingContext2D, idle = false, gameOver = false) {
    // Create gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#E0F6FF");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw screen border to emphasize containment
    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Add clouds for atmosphere
    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let i = 0; i < 3; i++) {
      const cloudY =
        (i * 200 + Math.sin(Date.now() * 0.001 + i) * 10) % CANVAS_HEIGHT;
      drawCloud(ctx, 50 + i * 100, cloudY);
    }

    // Draw tiles with shadows and better styling
    tiles.forEach((tile) => {
      const tileY = tile.y - cameraY.current;

      // Skip tiles outside viewport
      if (tileY > CANVAS_HEIGHT + 50 || tileY < -50) return;

      // Skip used red tiles (make them invisible)
      if (tile.used) return;

      // Tile shadow
      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(tile.x + 2, tileY + 2, TILE_WIDTH, TILE_HEIGHT);

      // Tile body
      if (tile.broken) {
        // Red tile gradient (slightly faded if touched)
        const brokenGradient = ctx.createLinearGradient(
          tile.x,
          tileY,
          tile.x,
          tileY + TILE_HEIGHT
        );
        if (tile.touched) {
          brokenGradient.addColorStop(0, "#FF8A8A");
          brokenGradient.addColorStop(1, "#FF6B6B");
        } else {
          brokenGradient.addColorStop(0, "#FF6B6B");
          brokenGradient.addColorStop(1, "#FF4757");
        }
        ctx.fillStyle = brokenGradient;
      } else {
        // Green tile gradient (slightly faded if touched)
        const tileGradient = ctx.createLinearGradient(
          tile.x,
          tileY,
          tile.x,
          tileY + TILE_HEIGHT
        );
        if (tile.touched) {
          tileGradient.addColorStop(0, "#58D68D");
          tileGradient.addColorStop(1, "#52C874");
        } else {
          tileGradient.addColorStop(0, "#2ECC71");
          tileGradient.addColorStop(1, "#27AE60");
        }
        ctx.fillStyle = tileGradient;
      }

      ctx.fillRect(tile.x, tileY, TILE_WIDTH, TILE_HEIGHT);

      // Tile highlight
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(tile.x, tileY, TILE_WIDTH, 3);
    });

    // Draw player with shadow and better design
    const playerY = player.current.y - cameraY.current;

    // Player shadow
    ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
    ctx.fillRect(player.current.x + 2, playerY + 2, PLAYER_SIZE, PLAYER_SIZE);

    // Player body (doodle character)
    const playerGradient = ctx.createRadialGradient(
      player.current.x + PLAYER_SIZE / 2,
      playerY + PLAYER_SIZE / 2,
      0,
      player.current.x + PLAYER_SIZE / 2,
      playerY + PLAYER_SIZE / 2,
      PLAYER_SIZE / 2
    );
    playerGradient.addColorStop(0, "#FFD93D");
    playerGradient.addColorStop(1, "#F39C12");
    ctx.fillStyle = playerGradient;

    // Draw rounded player
    ctx.beginPath();
    ctx.roundRect(player.current.x, playerY, PLAYER_SIZE, PLAYER_SIZE, 8);
    ctx.fill();

    // Player face
    ctx.fillStyle = "#2C3E50";
    // Eyes
    ctx.fillRect(player.current.x + 8, playerY + 8, 4, 4);
    ctx.fillRect(player.current.x + 18, playerY + 8, 4, 4);
    // Smile
    ctx.beginPath();
    ctx.arc(player.current.x + PLAYER_SIZE / 2, playerY + 18, 6, 0, Math.PI);
    ctx.stroke();

    // UI Elements
    drawUI(ctx, idle, gameOver);
  }

  function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 20, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 40, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 10, 12, 0, Math.PI * 2);
    ctx.arc(x + 30, y - 10, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawUI(
    ctx: CanvasRenderingContext2D,
    idle: boolean,
    gameOver: boolean
  ) {
    // Score with background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10, 10, 120, 40);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px Arial";
    ctx.fillText(`Score: ${score}`, 20, 35);

    // Jump power indicator
    if (jumpCount.current > 0 && gameState === "playing") {
      ctx.fillStyle = "rgba(255, 215, 0, 0.8)";
      ctx.fillRect(CANVAS_WIDTH - 150, 10, 130, 30);
      ctx.fillStyle = "#000";
      ctx.font = "14px Arial";
      ctx.fillText(`Power: x${jumpCount.current + 1}`, CANVAS_WIDTH - 140, 30);
    }

    if (idle) {
      // Welcome screen
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Doodle Jump", CANVAS_WIDTH / 2, 200);

      ctx.font = "18px Arial";
      ctx.fillText("Jump on green tiles!", CANVAS_WIDTH / 2, 250);
      ctx.fillText("Avoid red broken tiles!", CANVAS_WIDTH / 2, 280);
      ctx.fillText("Use arrow keys or mouse/touch", CANVAS_WIDTH / 2, 320);
      ctx.fillText("Click START to begin!", CANVAS_WIDTH / 2, 360);
      ctx.textAlign = "left";
    }

    if (gameOver) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 36px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Game Over!", CANVAS_WIDTH / 2, 200);

      ctx.font = "24px Arial";
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, 240);

      // Show if it's a new high score
      if (
        highScores.length === 0 ||
        score > Math.min(...highScores) ||
        highScores.length < 10
      ) {
        ctx.fillStyle = "#FFD700";
        ctx.font = "18px Arial";
        ctx.fillText("🎉 New High Score! 🎉", CANVAS_WIDTH / 2, 270);
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.font = "16px Arial";
      ctx.fillText("Click START to play again", CANVAS_WIDTH / 2, 320);
      ctx.textAlign = "left";
    }
  }

  // Controls
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;

      if (e.key === "ArrowLeft") {
        player.current.vx = Math.max(player.current.vx - 2, -8);
      }
      if (e.key === "ArrowRight") {
        player.current.vx = Math.min(player.current.vx + 2, 8);
      }
    };

    const handleMouse = (e: MouseEvent) => {
      if (gameState !== "playing") return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const targetX = mouseX - PLAYER_SIZE / 2;
      const diff = targetX - player.current.x;
      player.current.vx = Math.max(-8, Math.min(8, diff * 0.1));
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (gameState !== "playing") return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !e.touches[0]) return;

      const touchX = e.touches[0].clientX - rect.left;
      const targetX = touchX - PLAYER_SIZE / 2;
      const diff = targetX - player.current.x;
      player.current.vx = Math.max(-8, Math.min(8, diff * 0.1));
    };

    window.addEventListener("keydown", handleKey);
    canvasRef.current?.addEventListener("mousemove", handleMouse);
    canvasRef.current?.addEventListener("touchmove", handleTouch);

    return () => {
      window.removeEventListener("keydown", handleKey);
      canvasRef.current?.removeEventListener("mousemove", handleMouse);
      canvasRef.current?.removeEventListener("touchmove", handleTouch);
    };
  }, [gameState]);

  const startGame = () => {
    setGameState("playing");
    setScore(0);
    jumpCount.current = 0;
    cameraY.current = 0;

    // Reset player to start on the first tile
    const startingTile = {
      x: CANVAS_WIDTH / 2 - TILE_WIDTH / 2,
      y: CANVAS_HEIGHT - 100,
    };
    player.current = {
      x: startingTile.x + TILE_WIDTH / 2 - PLAYER_SIZE / 2,
      y: startingTile.y - PLAYER_SIZE,
      vy: 0,
      vx: 0,
    };

    setTiles(initializeTiles());
    scrollSpeed.current = 0.8;
  };

  return (
    <main className="p-6 bg-gradient-to-b from-blue-100 to-blue-200 min-h-screen w-full mx-auto">
      <h1 className="text-black text-3xl font-bold mb-4 text-center">
        Lamumu Jump
      </h1>
      <div className="flex flex-col lg:flex-row items-start justify-center gap-6 max-w-6xl mx-auto">
        {/* High Scores Panel */}
        <div className="bg-white rounded-lg shadow-2xl p-4 w-full lg:w-64">
          <h2 className="text-xl font-bold text-center mb-4 text-gray-800">
            🏆 High Scores
          </h2>
          <div className="space-y-2">
            {highScores.length > 0 ? (
              highScores.map((score, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-2 rounded ${
                    index === 0
                      ? "bg-yellow-100 border-2 border-yellow-400"
                      : index === 1
                      ? "bg-gray-100 border-2 border-gray-400"
                      : index === 2
                      ? "bg-orange-100 border-2 border-orange-400"
                      : "bg-blue-50"
                  }`}
                >
                  <span className="font-semibold">
                    {index === 0
                      ? "🥇"
                      : index === 1
                      ? "🥈"
                      : index === 2
                      ? "🥉"
                      : `${index + 1}.`}
                  </span>
                  <span className="font-mono text-lg">{score}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 italic">
                No scores yet!
                <br />
                Play to set records!
              </div>
            )}
          </div>
        </div>

        {/* Game Canvas */}
        <div className="bg-white rounded-lg shadow-2xl p-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="border-2 border-gray-300 rounded-lg cursor-pointer"
          />
        </div>

        <div className="mt-6 space-x-3 flex justify-center">
          <button
            onClick={startGame}
            className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105"
          >
            {gameState === "over" ? "Play Again" : "Start Game"}
          </button>

          <button
            onClick={() =>
              setGameState(gameState === "paused" ? "playing" : "paused")
            }
            disabled={gameState === "idle" || gameState === "over"}
            className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            {gameState === "paused" ? "Resume" : "Pause"}
          </button>

          <button
            onClick={() => setGameState("over")}
            disabled={gameState === "idle" || gameState === "over"}
            className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            Stop
          </button>
        </div>

        <div className="mt-4 text-center text-gray-600 max-w-md">
          <p className="text-sm">
            🎮 Use arrow keys, mouse, or touch to move • Green tiles: 10 pts •
            Red tiles: 5 pts (one use only)
          </p>
          <p className="text-xs mt-2">
            💪 Consecutive jumps increase your power! • Red tiles disappear
            after one jump!
          </p>
        </div>
      </div>
    </main>
  );
}
