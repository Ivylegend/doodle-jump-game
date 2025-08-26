import { useRef, useEffect, useState } from "react";
import cow from "./assets/cow.png";
import aura1 from "./assets/aura1.png";

// Base canvas dimensions (will be scaled)
const BASE_CANVAS_WIDTH = 400;
const BASE_CANVAS_HEIGHT = 600;
const BASE_PLAYER_SIZE = 30;
const BASE_TILE_WIDTH = 80;
const BASE_TILE_HEIGHT = 15;
const BASE_COIN_SIZE = 20;

type GameState = "idle" | "playing" | "paused" | "over";

interface Tile {
  x: number;
  y: number;
  broken?: boolean;
  touched?: boolean;
  used?: boolean;
  hasCoin?: boolean;
  coinCollected?: boolean;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScores, setHighScores] = useState<number[]>([]);
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [canvasDimensions, setCanvasDimensions] = useState({
    width: BASE_CANVAS_WIDTH,
    height: BASE_CANVAS_HEIGHT,
    scale: 1,
  });

  // Scaled dimensions based on current scale
  const CANVAS_WIDTH = canvasDimensions.width;
  const CANVAS_HEIGHT = canvasDimensions.height;
  const PLAYER_SIZE = BASE_PLAYER_SIZE * canvasDimensions.scale;
  const TILE_WIDTH = BASE_TILE_WIDTH * canvasDimensions.scale;
  const TILE_HEIGHT = BASE_TILE_HEIGHT * canvasDimensions.scale;
  const COIN_SIZE = BASE_COIN_SIZE * canvasDimensions.scale;

  const jumpCount = useRef(0);
  const baseJumpPower = useRef(-8);
  const player = useRef({
    x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
    y: CANVAS_HEIGHT - 150 * canvasDimensions.scale,
    vy: 0,
    vx: 0,
  });

  const playerImage = useRef<HTMLImageElement | null>(null);
  const coinImage = useRef<HTMLImageElement | null>(null);

  // Handle responsive canvas sizing
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const containerWidth = container.clientWidth - 32; // Account for padding
      const containerHeight = window.innerHeight - 200; // Account for UI elements

      // Calculate scale based on available space
      const scaleWidth = containerWidth / BASE_CANVAS_WIDTH;
      const scaleHeight = containerHeight / BASE_CANVAS_HEIGHT;
      const scale = Math.min(scaleWidth, scaleHeight, 1.2); // Cap at 1.2x for larger screens

      // Ensure minimum playable size
      const finalScale = Math.max(scale, 0.6);

      const newWidth = BASE_CANVAS_WIDTH * finalScale;
      const newHeight = BASE_CANVAS_HEIGHT * finalScale;

      setCanvasDimensions({
        width: newWidth,
        height: newHeight,
        scale: finalScale,
      });

      // Update canvas pixel ratio for crisp rendering
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          const dpr = window.devicePixelRatio || 1;
          canvasRef.current.width = newWidth * dpr;
          canvasRef.current.height = newHeight * dpr;
          canvasRef.current.style.width = `${newWidth}px`;
          canvasRef.current.style.height = `${newHeight}px`;
          ctx.scale(dpr, dpr);
        }
      }
    };

    updateCanvasSize();
    window.addEventListener("resize", updateCanvasSize);
    window.addEventListener("orientationchange", () => {
      setTimeout(updateCanvasSize, 100); // Delay for orientation change
    });

    return () => {
      window.removeEventListener("resize", updateCanvasSize);
      window.removeEventListener("orientationchange", updateCanvasSize);
    };
  }, []);

  // Update player position when canvas size changes
  useEffect(() => {
    if (gameState === "idle") {
      player.current.x = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
      player.current.y = CANVAS_HEIGHT - 150 * canvasDimensions.scale;
    }
  }, [canvasDimensions, gameState, CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_SIZE]);

  useEffect(() => {
    // Load cow character image
    const cowImg = new Image();
    cowImg.src = cow;
    cowImg.onload = () => {
      playerImage.current = cowImg;
    };
    cowImg.onerror = () => {
      console.warn("Could not load cow.png, using default character");
    };

    // Load coin image
    const auraImg = new Image();
    auraImg.src = aura1;
    auraImg.onload = () => {
      coinImage.current = auraImg;
    };
    auraImg.onerror = () => {
      console.warn("Could not load aura1.png, using default coins");
    };
  }, []);

  const highScoresRef = useRef<number[]>([]);

  useEffect(() => {
    const savedScores = highScoresRef.current;
    setHighScores(savedScores);
  }, []);

  const saveHighScore = (newScore: number) => {
    const currentScores = [...highScoresRef.current];
    currentScores.push(newScore);
    currentScores.sort((a, b) => b - a);
    const topTen = currentScores.slice(0, 10);
    highScoresRef.current = topTen;
    setHighScores(topTen);
  };

  const scrollSpeed = useRef(0.8 * canvasDimensions.scale);
  const lastTime = useRef(0);
  const cameraY = useRef(0);

  const initializeTiles = () => {
    const initialTiles: Tile[] = [];

    initialTiles.push({
      x: CANVAS_WIDTH / 2 - TILE_WIDTH / 2,
      y: CANVAS_HEIGHT - 100 * canvasDimensions.scale,
      broken: false,
      touched: false,
      hasCoin: true,
      coinCollected: false,
    });

    for (let i = 1; i < 15; i++) {
      initialTiles.push({
        x: Math.random() * (CANVAS_WIDTH - TILE_WIDTH),
        y:
          CANVAS_HEIGHT -
          100 * canvasDimensions.scale -
          i * 80 * canvasDimensions.scale,
        broken: Math.random() < 0.15,
        touched: false,
        hasCoin: Math.random() < 0.8,
        coinCollected: false,
      });
    }
    return initialTiles;
  };

  useEffect(() => {
    setTiles(initializeTiles());
  }, [canvasDimensions]);

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
  }, [gameState, tiles, score, canvasDimensions]);

  function update(delta: number) {
    const deltaMultiplier = delta / 16.67;
    const scale = canvasDimensions.scale;

    const playerScreenY = player.current.y - cameraY.current;
    const maxAllowedHeight = CANVAS_HEIGHT * 0.8;

    if (playerScreenY < maxAllowedHeight) {
      const heightDiff = maxAllowedHeight - playerScreenY;
      const speedMultiplier = 1 + heightDiff / (100 * scale);
      scrollSpeed.current = Math.min(
        0.8 * scale * speedMultiplier,
        3.0 * scale
      );
    } else {
      scrollSpeed.current = Math.max(scrollSpeed.current * 0.98, 0.8 * scale);
    }

    if (player.current.y < CANVAS_HEIGHT / 2) {
      cameraY.current = CANVAS_HEIGHT / 2 - player.current.y;
    }

    setTiles((prev) =>
      prev.map((tile) => ({
        ...tile,
        y: tile.y + scrollSpeed.current * deltaMultiplier,
      }))
    );

    if (tiles.length < 15) {
      const highestTile = Math.min(...tiles.map((t) => t.y));
      setTiles((prev) => [
        ...prev,
        {
          x: Math.random() * (CANVAS_WIDTH - TILE_WIDTH),
          y: highestTile - 80 * scale,
          broken: Math.random() < 0.15,
          touched: false,
          hasCoin: Math.random() < 0.8,
          coinCollected: false,
        },
      ]);
    }

    player.current.vy += 0.4 * scale * deltaMultiplier;
    player.current.y += player.current.vy * deltaMultiplier;

    player.current.x += player.current.vx * deltaMultiplier;
    player.current.vx *= Math.pow(0.95, deltaMultiplier);

    if (player.current.x < 0) {
      player.current.x = 0;
      player.current.vx = 0;
    }
    if (player.current.x > CANVAS_WIDTH - PLAYER_SIZE) {
      player.current.x = CANVAS_WIDTH - PLAYER_SIZE;
      player.current.vx = 0;
    }

    setTiles((prev) =>
      prev.filter(
        (tile) => tile.y < CANVAS_HEIGHT + cameraY.current + 200 * scale
      )
    );

    tiles.forEach((tile, index) => {
      if (
        player.current.x < tile.x + TILE_WIDTH &&
        player.current.x + PLAYER_SIZE > tile.x &&
        player.current.y + PLAYER_SIZE > tile.y &&
        player.current.y + PLAYER_SIZE < tile.y + TILE_HEIGHT + 5 * scale &&
        player.current.vy > 0 &&
        !tile.used
      ) {
        if (!tile.broken) {
          jumpCount.current += 1;
          const jumpPower =
            baseJumpPower.current * scale - jumpCount.current * 0.5 * scale;
          player.current.vy = Math.max(jumpPower, -15 * scale);

          if (!tile.touched) {
            setScore((s) => s + 10);
            setTiles((prev) =>
              prev.map((t, i) => (i === index ? { ...t, touched: true } : t))
            );
          }
        } else {
          if (!tile.touched) {
            jumpCount.current += 1;
            const jumpPower =
              baseJumpPower.current * scale - jumpCount.current * 0.5 * scale;
            player.current.vy = Math.max(jumpPower, -15 * scale);

            setScore((s) => s + 5);
            setTiles((prev) =>
              prev.map((t, i) =>
                i === index ? { ...t, touched: true, used: true } : t
              )
            );
          }
        }
      }

      if (
        tile.hasCoin &&
        !tile.coinCollected &&
        !tile.used &&
        player.current.x < tile.x + TILE_WIDTH &&
        player.current.x + PLAYER_SIZE > tile.x &&
        player.current.y < tile.y + TILE_HEIGHT + COIN_SIZE &&
        player.current.y + PLAYER_SIZE > tile.y - COIN_SIZE
      ) {
        setScore((s) => s + 15);
        setTiles((prev) =>
          prev.map((t, i) => (i === index ? { ...t, coinCollected: true } : t))
        );
      }
    });

    if (player.current.vy > 5 * scale) {
      jumpCount.current = 0;
    }

    if (player.current.y > CANVAS_HEIGHT + 100 * scale) {
      if (score > 0) {
        saveHighScore(score);
      }
      setGameState("over");
    }
  }

  function draw(ctx: CanvasRenderingContext2D, idle = false, gameOver = false) {
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#87CEEB");
    gradient.addColorStop(1, "#E0F6FF");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.strokeStyle = "#2C3E50";
    ctx.lineWidth = 3 * canvasDimensions.scale;
    ctx.strokeRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
    for (let i = 0; i < 3; i++) {
      const cloudY =
        (i * 200 * canvasDimensions.scale +
          Math.sin(Date.now() * 0.001 + i) * 10) %
        CANVAS_HEIGHT;
      drawCloud(
        ctx,
        50 * canvasDimensions.scale + i * 100 * canvasDimensions.scale,
        cloudY
      );
    }

    tiles.forEach((tile) => {
      const tileY = tile.y - cameraY.current;

      if (tileY > CANVAS_HEIGHT + 50 || tileY < -50) return;
      if (tile.used) return;

      ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
      ctx.fillRect(
        tile.x + 2 * canvasDimensions.scale,
        tileY + 2 * canvasDimensions.scale,
        TILE_WIDTH,
        TILE_HEIGHT
      );

      if (tile.broken) {
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

      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.fillRect(tile.x, tileY, TILE_WIDTH, 3 * canvasDimensions.scale);

      if (tile.hasCoin && !tile.coinCollected && !tile.used) {
        const coinX = tile.x + TILE_WIDTH / 2 - COIN_SIZE / 2;
        const coinY = tileY - COIN_SIZE - 5 * canvasDimensions.scale;

        if (coinImage.current && coinImage.current.complete) {
          const bounce =
            Math.sin(Date.now() * 0.005) * 2 * canvasDimensions.scale;
          ctx.drawImage(
            coinImage.current,
            coinX,
            coinY + bounce,
            COIN_SIZE,
            COIN_SIZE
          );
        } else {
          ctx.fillStyle = "#FFD700";
          ctx.strokeStyle = "#FFA500";
          ctx.lineWidth = 2 * canvasDimensions.scale;
          ctx.beginPath();
          const bounce =
            Math.sin(Date.now() * 0.005) * 2 * canvasDimensions.scale;
          ctx.arc(
            coinX + COIN_SIZE / 2,
            coinY + COIN_SIZE / 2 + bounce,
            COIN_SIZE / 2 - 1,
            0,
            Math.PI * 2
          );
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = "#FFFF00";
          ctx.font = `${12 * canvasDimensions.scale}px Arial`;
          ctx.textAlign = "center";
          ctx.fillText(
            "★",
            coinX + COIN_SIZE / 2,
            coinY + COIN_SIZE / 2 + 4 * canvasDimensions.scale + bounce
          );
          ctx.textAlign = "left";
        }
      }
    });

    const playerY = player.current.y - cameraY.current;

    if (playerImage.current && playerImage.current.complete) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(
        playerImage.current,
        player.current.x,
        playerY,
        PLAYER_SIZE,
        PLAYER_SIZE
      );
    } else {
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

      ctx.beginPath();
      ctx.roundRect(
        player.current.x,
        playerY,
        PLAYER_SIZE,
        PLAYER_SIZE,
        8 * canvasDimensions.scale
      );
      ctx.fill();

      ctx.fillStyle = "#2C3E50";
      const eyeSize = 4 * canvasDimensions.scale;
      ctx.fillRect(
        player.current.x + 8 * canvasDimensions.scale,
        playerY + 8 * canvasDimensions.scale,
        eyeSize,
        eyeSize
      );
      ctx.fillRect(
        player.current.x + 18 * canvasDimensions.scale,
        playerY + 8 * canvasDimensions.scale,
        eyeSize,
        eyeSize
      );

      ctx.beginPath();
      ctx.arc(
        player.current.x + PLAYER_SIZE / 2,
        playerY + 18 * canvasDimensions.scale,
        6 * canvasDimensions.scale,
        0,
        Math.PI
      );
      ctx.stroke();
    }

    drawUI(ctx, idle, gameOver);
  }

  function drawCloud(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const scale = canvasDimensions.scale;
    ctx.beginPath();
    ctx.arc(x, y, 15 * scale, 0, Math.PI * 2);
    ctx.arc(x + 20 * scale, y, 20 * scale, 0, Math.PI * 2);
    ctx.arc(x + 40 * scale, y, 15 * scale, 0, Math.PI * 2);
    ctx.arc(x + 10 * scale, y - 10 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.arc(x + 30 * scale, y - 10 * scale, 12 * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawUI(
    ctx: CanvasRenderingContext2D,
    idle: boolean,
    gameOver: boolean
  ) {
    const scale = canvasDimensions.scale;

    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(10 * scale, 10 * scale, 120 * scale, 40 * scale);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = `bold ${20 * scale}px Arial`;
    ctx.fillText(`Score: ${score}`, 20 * scale, 35 * scale);

    if (jumpCount.current > 0 && gameState === "playing") {
      ctx.fillStyle = "rgba(255, 215, 0, 0.8)";
      ctx.fillRect(
        CANVAS_WIDTH - 150 * scale,
        10 * scale,
        130 * scale,
        30 * scale
      );
      ctx.fillStyle = "#000";
      ctx.font = `${14 * scale}px Arial`;
      ctx.fillText(
        `Power: x${jumpCount.current + 1}`,
        CANVAS_WIDTH - 140 * scale,
        30 * scale
      );
    }

    if (idle) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${Math.min(32 * scale, 28)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("Lamumu Jump", CANVAS_WIDTH / 2, 200 * scale);

      ctx.font = `${Math.min(18 * scale, 16)}px Arial`;
      ctx.fillText("Jump on green tiles!", CANVAS_WIDTH / 2, 250 * scale);
      ctx.fillText("Avoid red broken tiles!", CANVAS_WIDTH / 2, 280 * scale);
      ctx.fillText(
        "Collect aura coins for bonus points!",
        CANVAS_WIDTH / 2,
        310 * scale
      );
      ctx.fillText("Use arrow keys or touch", CANVAS_WIDTH / 2, 340 * scale);
      ctx.fillText("Click START to begin!", CANVAS_WIDTH / 2, 370 * scale);
      ctx.textAlign = "left";
    }

    if (gameOver) {
      ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${Math.min(36 * scale, 32)}px Arial`;
      ctx.textAlign = "center";
      ctx.fillText("Game Over!", CANVAS_WIDTH / 2, 200 * scale);

      ctx.font = `${Math.min(24 * scale, 20)}px Arial`;
      ctx.fillText(`Final Score: ${score}`, CANVAS_WIDTH / 2, 240 * scale);

      if (
        highScores.length === 0 ||
        score > Math.min(...highScores) ||
        highScores.length < 10
      ) {
        ctx.fillStyle = "#FFD700";
        ctx.font = `${Math.min(18 * scale, 16)}px Arial`;
        ctx.fillText("🎉 New High Score! 🎉", CANVAS_WIDTH / 2, 270 * scale);
      }

      ctx.fillStyle = "#FFFFFF";
      ctx.font = `${Math.min(16 * scale, 14)}px Arial`;
      ctx.fillText("Click START to play again", CANVAS_WIDTH / 2, 320 * scale);
      ctx.textAlign = "left";
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;

      const moveSpeed = 2 * canvasDimensions.scale;
      const maxSpeed = 8 * canvasDimensions.scale;

      if (e.key === "ArrowLeft") {
        player.current.vx = Math.max(player.current.vx - moveSpeed, -maxSpeed);
      }
      if (e.key === "ArrowRight") {
        player.current.vx = Math.min(player.current.vx + moveSpeed, maxSpeed);
      }
    };

    const handleMouse = (e: MouseEvent) => {
      if (gameState !== "playing") return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = (e.clientX - rect.left) * (CANVAS_WIDTH / rect.width);
      const targetX = mouseX - PLAYER_SIZE / 2;
      const diff = targetX - player.current.x;
      const maxSpeed = 8 * canvasDimensions.scale;
      player.current.vx = Math.max(
        -maxSpeed,
        Math.min(maxSpeed, diff * 0.1 * canvasDimensions.scale)
      );
    };

    const handleTouch = (e: TouchEvent) => {
      e.preventDefault();
      if (gameState !== "playing") return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect || !e.touches[0]) return;

      const touchX =
        (e.touches[0].clientX - rect.left) * (CANVAS_WIDTH / rect.width);
      const targetX = touchX - PLAYER_SIZE / 2;
      const diff = targetX - player.current.x;
      const maxSpeed = 8 * canvasDimensions.scale;
      player.current.vx = Math.max(
        -maxSpeed,
        Math.min(maxSpeed, diff * 0.1 * canvasDimensions.scale)
      );
    };

    window.addEventListener("keydown", handleKey);
    canvasRef.current?.addEventListener("mousemove", handleMouse);
    canvasRef.current?.addEventListener("touchmove", handleTouch, {
      passive: false,
    });

    return () => {
      window.removeEventListener("keydown", handleKey);
      canvasRef.current?.removeEventListener("mousemove", handleMouse);
      canvasRef.current?.removeEventListener("touchmove", handleTouch);
    };
  }, [gameState, canvasDimensions]);

  const startGame = () => {
    setGameState("playing");
    setScore(0);
    jumpCount.current = 0;
    cameraY.current = 0;
    scrollSpeed.current = 0.8 * canvasDimensions.scale;

    const startingTile = {
      x: CANVAS_WIDTH / 2 - TILE_WIDTH / 2,
      y: CANVAS_HEIGHT - 100 * canvasDimensions.scale,
    };

    player.current = {
      x: startingTile.x + TILE_WIDTH / 2 - PLAYER_SIZE / 2,
      y: startingTile.y - PLAYER_SIZE,
      vy: 0,
      vx: 0,
    };

    setTiles(initializeTiles());
  };

  return (
    <main className="p-2 sm:p-6 bg-gradient-to-b from-blue-100 to-blue-200 min-h-screen w-full mx-auto">
      <h1 className="text-black text-2xl sm:text-3xl font-bold mb-4 text-center">
        Lamumu 🐄 Jump
      </h1>
      <div className="flex flex-col lg:flex-row items-start justify-center gap-4 lg:gap-6 max-w-7xl mx-auto">
        {/* High Scores Panel */}
        <div className="bg-white rounded-lg shadow-2xl p-3 sm:p-4 w-full lg:max-w-64 order-2 lg:order-1">
          <h2 className="text-lg sm:text-xl font-bold text-center mb-4 text-gray-800">
            🏆 Aura Scores
          </h2>
          <div className="space-y-2">
            {highScores.length > 0 ? (
              highScores.map((score, index) => (
                <div
                  key={index}
                  className={`flex justify-between items-center p-2 rounded text-sm sm:text-base ${
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
                  <span className="font-mono">{score}</span>
                </div>
              ))
            ) : (
              <div className="text-center text-gray-500 italic text-sm">
                No scores yet!
                <br />
                Play to set records!
              </div>
            )}
          </div>
        </div>

        {/* Game Canvas */}
        <div
          ref={containerRef}
          className="bg-white bg-[url('./assets/common-logo.png')] bg-repeat rounded-lg shadow-2xl p-2 sm:p-4 order-1 lg:order-2 w-full flex justify-center"
        >
          <canvas
            ref={canvasRef}
            className="border-2 border-gray-300 rounded-lg cursor-pointer max-w-full"
            style={{
              touchAction: "none",
              width: `${canvasDimensions.width}px`,
              height: `${canvasDimensions.height}px`,
            }}
          />
        </div>

        {/* Controls and Instructions */}
        <div className="w-full lg:max-w-64 order-3">
          <div className="space-y-3 flex flex-col">
            <button
              onClick={startGame}
              className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
            >
              {gameState === "over" ? "Play Again" : "Start Game"}
            </button>

            <button
              onClick={() =>
                setGameState(gameState === "paused" ? "playing" : "paused")
              }
              disabled={gameState === "idle" || gameState === "over"}
              className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none text-sm sm:text-base"
            >
              {gameState === "paused" ? "Resume" : "Pause"}
            </button>

            <button
              onClick={() => setGameState("over")}
              disabled={gameState === "idle" || gameState === "over"}
              className="bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 sm:py-3 sm:px-6 rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 disabled:transform-none text-sm sm:text-base"
            >
              Stop
            </button>
          </div>

          <div className="mt-4 text-center text-gray-600">
            <p className="text-xs sm:text-sm mb-2">
              🎮{" "}
              <span className="hidden sm:inline">
                Use arrow keys, mouse, or touch to move
              </span>
              <span className="sm:hidden">Touch or tilt to move</span>
            </p>
            <div className="text-xs space-y-1">
              <div>🟢 Green tiles: 10 pts</div>
              <div>🔴 Red tiles: 5 pts (disappear after use)</div>
              <div>⭐ Coins: 15 pts bonus</div>
              <div>💪 Consecutive jumps increase power!</div>
            </div>
          </div>

          {/* Device orientation hint for mobile */}
          <div className="mt-4 p-2 bg-blue-50 rounded-lg text-xs text-blue-700 lg:hidden">
            💡 <strong>Tip:</strong> For the best experience on mobile, try both
            portrait and landscape orientations!
          </div>
        </div>
      </div>
    </main>
  );
}
