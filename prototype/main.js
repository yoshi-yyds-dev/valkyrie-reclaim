/**
 * ============================================================================
 * VOID VANGUARD - Prototype Phase 1
 * 企画方針書 (game-design.md) 準拠の最小動作プロトタイプ
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. 基本定数・仮想解像度設定（docs/04_screen-and-character-sizing.md 準拠）
// ----------------------------------------------------------------------------
const LOGICAL_WIDTH = 360;
const LOGICAL_HEIGHT = 640;
const HUD_HEIGHT = 50;          // 上部HUDエリアの高さ
const TOUCH_OFFSET_Y = 50;      // 指隠れ防止：指の位置より50px上に自機を配置

const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

// UIオーバーレイ要素
const titleOverlay = document.getElementById("title-overlay");
const pauseOverlay = document.getElementById("pause-overlay");
const startBtn = document.getElementById("start-btn");
const resumeBtn = document.getElementById("resume-btn");
const retryBtn = document.getElementById("retry-btn");
const muteBtn = document.getElementById("mute-btn");

// ----------------------------------------------------------------------------
// 2. サウンドエンジン（Web Audio API によるSE合成：容量0KB・遅延ゼロ）
// ----------------------------------------------------------------------------
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  // スマホの自動再生制限（Autoplay Policy）を解除
  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  // 自機通常ショット音（サイン波の高速下降）
  playShot() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // 敵撃破・爆発音（ホワイトノイズ＋ローパスフィルター）
  playExplosion() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.22;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    noise.start(now);
  }

  // 出撃起動音
  playStart() {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }
}

const sound = new SoundEngine();

// ----------------------------------------------------------------------------
// 3. ゲーム状態管理
// ----------------------------------------------------------------------------
const STATE = {
  TITLE: "TITLE",
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
};

let currentState = STATE.TITLE;
let score = 0;
let lastTime = 0;

// 入力状態（タッチ・マウス・キーボード統合）
const input = {
  isPointerDown: false,
  targetX: LOGICAL_WIDTH / 2,
  targetY: LOGICAL_HEIGHT - 120,
  keys: {},
};

// ----------------------------------------------------------------------------
// 4. パララックス星空背景（遠近2層）
// ----------------------------------------------------------------------------
const stars = Array.from({ length: 65 }, () => {
  const layer = Math.random() < 0.7 ? 1 : 2;
  return {
    x: Math.random() * LOGICAL_WIDTH,
    y: Math.random() * LOGICAL_HEIGHT,
    size: layer === 1 ? 1.2 : 2.2,
    speed: layer === 1 ? 45 : 110,
    alpha: layer === 1 ? 0.35 : 0.85,
  };
});

function updateAndDrawStars(dt) {
  for (const s of stars) {
    if (currentState === STATE.PLAYING) {
      s.y += s.speed * dt;
      if (s.y > LOGICAL_HEIGHT) {
        s.y = 0;
        s.x = Math.random() * LOGICAL_WIDTH;
      }
    }
    ctx.fillStyle = `rgba(225, 225, 241, ${s.alpha})`;
    ctx.fillRect(s.x, s.y, s.size, s.size);
  }
}

// ----------------------------------------------------------------------------
// 5. 自機（VF-01 VALKYRIE：見た目 38x44px、コア当たり判定 半径 2.5px）
// ----------------------------------------------------------------------------
const player = {
  x: LOGICAL_WIDTH / 2,
  y: LOGICAL_HEIGHT - 120,
  width: 38,
  height: 44,
  hitboxRadius: 2.5,
  lives: 3,
  hp: 100,
  maxHp: 100,
  speed: 260,          // キーボード移動時の速度 (px/秒)
  shotCooldown: 0,
  shotInterval: 0.11,  // オートショット発射間隔（秒）
  thrusterPhase: 0,
};

function resetPlayer() {
  player.x = LOGICAL_WIDTH / 2;
  player.y = LOGICAL_HEIGHT - 120;
  player.lives = 3;
  player.hp = 100;
  player.shotCooldown = 0;
  input.targetX = player.x;
  input.targetY = player.y;
}

function updatePlayer(dt) {
  // ① キーボード操作（PCデバッグ・プレイ用）
  let moveX = 0;
  let moveY = 0;
  if (input.keys["ArrowLeft"] || input.keys["KeyA"]) moveX -= 1;
  if (input.keys["ArrowRight"] || input.keys["KeyD"]) moveX += 1;
  if (input.keys["ArrowUp"] || input.keys["KeyW"]) moveY -= 1;
  if (input.keys["ArrowDown"] || input.keys["KeyS"]) moveY += 1;

  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    player.x += (moveX / len) * player.speed * dt;
    player.y += (moveY / len) * player.speed * dt;
    input.targetX = player.x;
    input.targetY = player.y;
  } else if (input.isPointerDown) {
    // ② タッチ・マウス操作（Lerpによる滑らかな追従）
    const followRate = 1 - Math.pow(0.0005, dt);
    player.x += (input.targetX - player.x) * followRate;
    player.y += (input.targetY - player.y) * followRate;
  }

  // 画面端クランプ（自機がHUDや画面外へ飛び出さないように制限）
  const halfW = player.width / 2;
  const halfH = player.height / 2;
  player.x = Math.max(halfW, Math.min(LOGICAL_WIDTH - halfW, player.x));
  player.y = Math.max(HUD_HEIGHT + halfH, Math.min(LOGICAL_HEIGHT - halfH, player.y));

  // スラスター炎アニメーション
  player.thrusterPhase += dt * 25;

  // ③ オートショット（一定間隔で自動発射）
  player.shotCooldown -= dt;
  if (player.shotCooldown <= 0) {
    spawnPlayerBullet(player.x - 7, player.y - 18);
    spawnPlayerBullet(player.x + 7, player.y - 18);
    sound.playShot();
    player.shotCooldown = player.shotInterval;
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  // スラスターの炎
  const flameLen = 10 + Math.sin(player.thrusterPhase) * 4;
  ctx.fillStyle = "rgba(0, 243, 255, 0.7)";
  ctx.beginPath();
  ctx.moveTo(-4, 16);
  ctx.lineTo(0, 16 + flameLen);
  ctx.lineTo(4, 16);
  ctx.closePath();
  ctx.fill();

  // 主翼（Stitch VF-01 デザイン準拠）
  ctx.fillStyle = "rgba(0, 243, 255, 0.16)";
  ctx.strokeStyle = "#00f3ff";
  ctx.lineWidth = 1.6;

  // 左翼
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.lineTo(-19, 10);
  ctx.lineTo(-19, 15);
  ctx.lineTo(-5, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 右翼
  ctx.beginPath();
  ctx.moveTo(5, 0);
  ctx.lineTo(19, 10);
  ctx.lineTo(19, 15);
  ctx.lineTo(5, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 機体胴体
  ctx.fillStyle = "rgba(0, 243, 255, 0.25)";
  ctx.beginPath();
  ctx.moveTo(0, -22);
  ctx.lineTo(5, -6);
  ctx.lineTo(6, 15);
  ctx.lineTo(-6, 15);
  ctx.lineTo(-5, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 前方ツインキャノン
  ctx.beginPath();
  ctx.moveTo(-7, -6);
  ctx.lineTo(-7, -18);
  ctx.moveTo(7, -6);
  ctx.lineTo(7, -18);
  ctx.stroke();

  // コア当たり判定の目印（半径 2.5px が明確に光る）
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "#00f3ff";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.arc(0, 0, player.hitboxRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ----------------------------------------------------------------------------
// 6. 自機弾・敵機・爆発パーティクル
// ----------------------------------------------------------------------------
let bullets = [];
let enemies = [];
let particles = [];
let enemySpawnTimer = 0;

function spawnPlayerBullet(x, y) {
  bullets.push({
    x,
    y,
    vy: -560,
    width: 4,
    height: 16,
  });
}

function spawnEnemy() {
  // Stitch _1 準拠：偵察小型ドローン（22x26px）
  const margin = 24;
  enemies.push({
    x: margin + Math.random() * (LOGICAL_WIDTH - margin * 2),
    y: HUD_HEIGHT - 20,
    vy: 95 + Math.random() * 55,
    vx: (Math.random() - 0.5) * 40,
    radius: 11,
    hp: 2,
  });
}

function spawnExplosion(x, y, color = "#00f3ff") {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 50 + Math.random() * 140;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.35 + Math.random() * 0.2,
      maxLife: 0.55,
      size: 1.5 + Math.random() * 2.5,
      color,
    });
  }
}

function updateCombatObjects(dt) {
  // 1. 自機弾の更新
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.y += b.vy * dt;
    if (b.y < HUD_HEIGHT - 20) {
      bullets.splice(i, 1);
    }
  }

  // 2. 敵の出現管理
  enemySpawnTimer -= dt;
  if (enemySpawnTimer <= 0) {
    spawnEnemy();
    enemySpawnTimer = 0.75;
  }

  // 3. 敵の更新 ＆ 弾との当たり判定
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // 左右の壁で跳ね返る
    if (e.x < 16 || e.x > LOGICAL_WIDTH - 16) e.vx *= -1;

    // 画面下に出たら削除
    if (e.y > LOGICAL_HEIGHT + 30) {
      enemies.splice(i, 1);
      continue;
    }

    // 自機弾とのヒット判定
    let destroyed = false;
    for (let j = bullets.length - 1; j >= 0; j--) {
      const b = bullets[j];
      const dist = Math.hypot(b.x - e.x, b.y - e.y);
      if (dist < e.radius + 6) {
        bullets.splice(j, 1);
        e.hp -= 1;
        spawnExplosion(b.x, b.y, "#ffffff");
        if (e.hp <= 0) {
          score += 1200;
          sound.playExplosion();
          spawnExplosion(e.x, e.y, "#ffb4ab");
          enemies.splice(i, 1);
          destroyed = true;
          break;
        }
      }
    }
    if (destroyed) continue;
  }

  // 4. 爆発パーティクルの更新
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function drawCombatObjects() {
  // 自機弾の描画（ネオンシアン・ビーム）
  ctx.save();
  ctx.fillStyle = "#e3fdff";
  ctx.shadowColor = "#00f3ff";
  ctx.shadowBlur = 8;
  for (const b of bullets) {
    ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
  }
  ctx.restore();

  // 敵機の描画（Stitch 偵察小型ドローン風）
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.strokeStyle = "#ffb4ab";
    ctx.fillStyle = "rgba(255, 0, 85, 0.2)";
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(10, -4);
    ctx.lineTo(4, -10);
    ctx.lineTo(-4, -10);
    ctx.lineTo(-10, -4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // コア
    ctx.fillStyle = "#ff0055";
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // パーティクルの描画
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

// ----------------------------------------------------------------------------
// 7. 上部 HUD エリアの描画（0 〜 50px）
// ----------------------------------------------------------------------------
const PAUSE_BTN_RECT = { x: LOGICAL_WIDTH - 42, y: 8, w: 34, h: 34 };

function drawHUD() {
  // HUD背景帯
  ctx.fillStyle = "rgba(13, 18, 36, 0.88)";
  ctx.fillRect(0, 0, LOGICAL_WIDTH, HUD_HEIGHT);
  ctx.strokeStyle = "rgba(0, 243, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HUD_HEIGHT);
  ctx.lineTo(LOGICAL_WIDTH, HUD_HEIGHT);
  ctx.stroke();

  // スコア表示
  ctx.fillStyle = "#5d729a";
  ctx.font = "bold 9px monospace";
  ctx.fillText("SCORE", 12, 16);
  ctx.fillStyle = "#00f3ff";
  ctx.font = "bold 16px monospace";
  ctx.fillText(String(score).padStart(7, "0"), 12, 35);

  // 残機＆HPゲージ
  ctx.fillStyle = "#5d729a";
  ctx.font = "bold 9px monospace";
  ctx.fillText(`SHIPS: ${player.lives}  SHIELD`, 125, 16);

  // セグメントHPバー（5ブロック）
  const blocks = 5;
  for (let i = 0; i < blocks; i++) {
    ctx.fillStyle = i < Math.ceil((player.hp / player.maxHp) * blocks) ? "#00f3ff" : "#161f38";
    ctx.fillRect(125 + i * 24, 24, 20, 10);
  }

  // 右上のポーズボタン（⏸）
  const { x, y, w, h } = PAUSE_BTN_RECT;
  ctx.strokeStyle = "#00f3ff";
  ctx.fillStyle = "rgba(0, 243, 255, 0.12)";
  ctx.fillRect(x, y, w, h);
  ctx.strokeRect(x, y, w, h);

  ctx.fillStyle = "#e2f1ff";
  ctx.fillRect(x + 11, y + 9, 4, 16);
  ctx.fillRect(x + 19, y + 9, 4, 16);
}

// ----------------------------------------------------------------------------
// 8. 座標変換＆入力イベント処理（スマホ・PC両対応）
// ----------------------------------------------------------------------------
function getLogicalPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
    y: ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT,
  };
}

function isInsidePauseBtn(pos) {
  const { x, y, w, h } = PAUSE_BTN_RECT;
  return pos.x >= x && pos.x <= x + w && pos.y >= y && pos.y <= y + h;
}

// タッチ操作（スマホ用：50px上方オフセット付き）
canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (currentState !== STATE.PLAYING) return;
  const pos = getLogicalPos(e.touches[0].clientX, e.touches[0].clientY);

  if (isInsidePauseBtn(pos)) {
    pauseGame();
    return;
  }

  input.isPointerDown = true;
  input.targetX = pos.x;
  input.targetY = pos.y - TOUCH_OFFSET_Y;
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (currentState !== STATE.PLAYING || !input.isPointerDown) return;
  const pos = getLogicalPos(e.touches[0].clientX, e.touches[0].clientY);
  input.targetX = pos.x;
  input.targetY = pos.y - TOUCH_OFFSET_Y;
}, { passive: false });

canvas.addEventListener("touchend", () => {
  input.isPointerDown = false;
});

// マウス操作（PCテスト用）
canvas.addEventListener("mousedown", (e) => {
  if (currentState !== STATE.PLAYING) return;
  const pos = getLogicalPos(e.clientX, e.clientY);

  if (isInsidePauseBtn(pos)) {
    pauseGame();
    return;
  }

  input.isPointerDown = true;
  input.targetX = pos.x;
  input.targetY = pos.y;
});

canvas.addEventListener("mousemove", (e) => {
  if (currentState !== STATE.PLAYING || !input.isPointerDown) return;
  const pos = getLogicalPos(e.clientX, e.clientY);
  input.targetX = pos.x;
  input.targetY = pos.y;
});

window.addEventListener("mouseup", () => {
  input.isPointerDown = false;
});

// キーボード操作・ショートカット
window.addEventListener("keydown", (e) => {
  input.keys[e.code] = true;

  if (e.code === "KeyP" || e.code === "Escape") {
    if (currentState === STATE.PLAYING) pauseGame();
    else if (currentState === STATE.PAUSED) resumeGame();
  } else if (e.code === "KeyR" && currentState !== STATE.TITLE) {
    retryGame();
  } else if (e.code === "KeyM") {
    toggleMuteState();
  } else if ((e.code === "Space" || e.code === "Enter") && currentState === STATE.TITLE) {
    startGame();
  }
});

window.addEventListener("keyup", (e) => {
  input.keys[e.code] = false;
});

// ----------------------------------------------------------------------------
// 9. ゲーム状態遷移・UIボタン制御
// ----------------------------------------------------------------------------
function startGame() {
  sound.unlock();
  sound.playStart();
  score = 0;
  bullets = [];
  enemies = [];
  particles = [];
  resetPlayer();
  currentState = STATE.PLAYING;
  titleOverlay.classList.remove("active");
  pauseOverlay.classList.remove("active");
}

function pauseGame() {
  if (currentState !== STATE.PLAYING) return;
  currentState = STATE.PAUSED;
  input.isPointerDown = false;
  pauseOverlay.classList.add("active");
}

function resumeGame() {
  if (currentState !== STATE.PAUSED) return;
  currentState = STATE.PLAYING;
  pauseOverlay.classList.remove("active");
}

function retryGame() {
  startGame();
}

function toggleMuteState() {
  const isMuted = sound.toggleMute();
  muteBtn.textContent = isMuted ? "AUDIO: OFF" : "AUDIO: ON";
}

// ボタンイベント紐付け
startBtn.addEventListener("click", startGame);
resumeBtn.addEventListener("click", resumeGame);
retryBtn.addEventListener("click", retryGame);
muteBtn.addEventListener("click", toggleMuteState);

// バックグラウンド遷移時の自動ポーズ
document.addEventListener("visibilitychange", () => {
  if (document.hidden && currentState === STATE.PLAYING) {
    pauseGame();
  }
});

// ----------------------------------------------------------------------------
// 10. メインゲームループ（60fps デルタタイム制御）
// ----------------------------------------------------------------------------
function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // 最大50msでクランプ
  lastTime = timestamp;

  // 背景クリア
  ctx.fillStyle = "#070913";
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

  // 星空描画
  updateAndDrawStars(dt);

  if (currentState === STATE.PLAYING) {
    updatePlayer(dt);
    updateCombatObjects(dt);
  }

  if (currentState !== STATE.TITLE) {
    drawCombatObjects();
    drawPlayer();
    drawHUD();
  }

  requestAnimationFrame(gameLoop);
}

// ループ起動
requestAnimationFrame(gameLoop);
