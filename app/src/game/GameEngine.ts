/**
 * ============================================================================
 * VOID VANGUARD - 60fps ゲーム戦闘エンジン (GameEngine.ts)
 * ============================================================================
 * 
 * 【全体構成におけるこのクラスの位置づけ】
 * 本アプリケーションは「React（UI管理）」と「GameEngine（ゲームコア）」の2層アーキテクチャで構成されています。
 * - React (App.tsx): タイトル画面、ポーズメニュー、ゲームオーバー画面、HUD（HPバーやスコア）などのDOMを描画・管理。
 * - GameEngine (本ファイル): 毎秒60回（60fps）Canvas 2Dコンテキストを直接操作し、自機・敵機・弾幕・星空の物理計算、
 *   当たり判定、AI行動制御、画面描画を担うゲームの「心臓部」。
 * 
 * ----------------------------------------------------------------------------
 * 【プログラミング初心者がつまずきやすいポイントと設計の理由】
 * 
 * Q1. なぜ React の useState を使わずに、Canvas 2D を直接操作しているのか？
 * ➔ 理由：描画パフォーマンス（処理落ち・カクつき防止）のためです。
 *    React の再レンダリング（仮想DOMの比較）は、毎秒数十〜数百回も座標が激変するゲームオブジェクト
 *    （数千発の弾やパーティクル）を扱うには負荷が高すぎます。
 *    そのため、激しく動く戦闘計算は純粋な TypeScript クラス（GameEngine）で高速に回し、
 *    「スコアが変わった」「HPが減った」という UI更新が必要な瞬間だけ React にコールバック通知する
 *    「ハイブリッド分離設計」を採用しています。
 * 
 * Q2. なぜ画面サイズを固定の「360 × 640（9:16）」としているのか？（論理座標系）
 * ➔ 理由：プレイヤーの端末（PCモニター、iPad、スマートフォン）によって解像度はバラバラです。
 *    もし実ピクセルで計算すると、大画面では弾速が遅く感じ、スマホでは自機が巨大化してしまいます。
 *    ゲーム内部は常に「横360 × 縦640」の仮想空間として計算し、描画時に画面サイズに合わせて
 *    自動で拡大・縮小（レスポンシブスケール）することで、どの端末でも全く同じ公平な難易度を実現しています。
 * 
 * Q3. デルタタイム（dt: Delta Time）とは何か？なぜ移動速度に dt を掛けるのか？
 * ➔ 理由：モニターのリフレッシュレート（60Hz, 120Hz, 144Hz）や処理落ちの影響をなくすためです。
 *    もし `x += speed` のように固定値で足すと、120Hzのゲーミングモニターでは2倍の速度でゲームが進んでしまいます。
 *    「前フレームからの経過秒数（通常約0.016秒）」である dt を掛ける（`x += speed * dt`）ことで、
 *    どんな動作環境でも「1秒間に speed ピクセル進む」という物理的な実時間移動を保証しています。
 * 
 * Q4. なぜ配列の削除ループは末尾からの逆順（`for (let i = arr.length - 1; i >= 0; i--)`）なのか？
 * ➔ 理由：ループ中に要素を削除した際の「インデックスずれバグ（スキップ）」を防ぐためです。
 *    先頭から普通にループして `splice(i, 1)` を実行すると、後ろの要素が1つ手前にズレるため、
 *    「次の要素が判定されずにスキップされてしまう」という重大なバグが発生します。
 *    末尾から逆順にループすれば、削除した要素より手前（まだ調べていない要素）のインデックスは
 *    絶対に変化しないため、安全・確実に全要素を処理できます。
 * ============================================================================
 */

import {
  LOGICAL_WIDTH,
  LOGICAL_HEIGHT,
  HUD_HEIGHT,
  TOUCH_OFFSET_Y,
} from "./types";
import type {
  GameStatus,
  Difficulty,
  Star,
  Player,
  Bullet,
  EnemyBullet,
  Enemy,
  EnemyType,
  Boss,
  Particle,
  PowerUpItem,
  PowerUpType,
  WeaponType,
  GameCallbacks,
} from "./types";
import { SoundEngine } from "./SoundEngine";

export class GameEngine {
  // --- 描画コンテキスト ---
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: GameCallbacks;
  public sound: SoundEngine;

  // --- ゲーム状態 ---
  public status: GameStatus = "TITLE";
  public difficulty: Difficulty = "NORMAL";
  public score: number = 0;

  // --- ゲーム内オブジェクト配列 ---
  private stars: Star[] = [];
  private player: Player;
  private bullets: Bullet[] = [];
  private enemyBullets: EnemyBullet[] = [];
  private enemies: Enemy[] = [];
  private boss: Boss | null = null;
  private particles: Particle[] = [];
  private powerUps: PowerUpItem[] = [];
  private enemySpawnTimer: number = 0;

  // --- ステージ進行 ＆ 演出用タイマー ---
  private stage: number = 1;
  private stageScrollTime: number = 0;         // 現在のステージでのスクロール経過時間（秒）
  private gunshipSpawnsCount: number = 0;      // 現在ステージで出現させた中型ガンシップ数
  private warningTimer: number = 0;
  private stageClearTimer: number = 0;
  private bannerTimer: number = 0;
  private shakeTimer: number = 0;
  private bombEffectTimer: number = 0;
  private respawnTimer: number = 0;
  private respawnDelayTimer: number = 0;       // 撃墜爆発の余韻を見せてから再出撃させる待機タイマー
  private playerDeathEffectTimer: number = 0;  // 自機大爆発（衝撃波・爆炎コア）の再生タイマー
  private playerDeathX: number = LOGICAL_WIDTH / 2;
  private playerDeathY: number = LOGICAL_HEIGHT / 2;
  private playerGameOverDelayTimer: number = 0; // 全機喪失時、大爆発を見せてからGAMEOVERへ移る遅延タイマー
  private bombOriginX: number = LOGICAL_WIDTH / 2;
  private bombOriginY: number = LOGICAL_HEIGHT / 2;

  // --- 入力状態の追跡 ---
  private input = {
    isPointerDown: false,
    targetX: LOGICAL_WIDTH / 2,
    targetY: LOGICAL_HEIGHT - 120,
    keys: {} as Record<string, boolean>,
  };

  // --- ループ制御用変数 ---
  private lastTime: number = 0;
  private animationId: number = 0;

  constructor(canvas: HTMLCanvasElement, callbacks: GameCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas 2D コンテキストの取得に失敗しました");
    this.ctx = context;
    this.callbacks = callbacks;
    this.sound = new SoundEngine();

    // 自機ステータスの初期化（企画方針書 準拠）
    this.player = {
      x: LOGICAL_WIDTH / 2,
      y: LOGICAL_HEIGHT - 120,
      width: 38,
      height: 44,
      // ★複合円判定（マルチサークル）：機体の形（ノーズ・胴体・左右の翼）に沿って4つの円を配置
      hitboxes: [
        { offsetX: 0, offsetY: -13, radius: 5 },  // 機首（デルタノーズ先端）
        { offsetX: 0, offsetY: 3, radius: 7 },    // 胴体中央（コックピット周り）
        { offsetX: -12, offsetY: 10, radius: 6 }, // 左翼
        { offsetX: 12, offsetY: 10, radius: 6 },  // 右翼
      ],
      weapon: "VULCAN",
      weaponLevel: 1,
      bombs: 3,
      speedLevel: 2,
      lives: 3,
      hp: 100,
      maxHp: 100,
      speed: 260,          // キーボード移動時の秒速 (px/秒)
      shotCooldown: 0,
      shotInterval: 0.11,  // オートショット発射間隔 (0.11秒 = 毎秒約9連射)
      thrusterPhase: 0,
      invincibleTimer: 0,
    };

    this.initStars();
    this.bindEvents();
    this.startLoop();
  }

  // --------------------------------------------------------------------------
  // 1. 初期化・ゲーム状態遷移メソッド
  // --------------------------------------------------------------------------

  /** 遠近2層のパララックス（視差）星空の初期配置 */
  private initStars(): void {
    this.stars = Array.from({ length: 65 }, () => {
      // 7割は「遠くの遅い星（小さく薄い）」、3割は「近くの速い星（大きく明るい）」
      const layer = Math.random() < 0.7 ? 1 : 2;
      return {
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * LOGICAL_HEIGHT,
        size: layer === 1 ? 1.2 : 2.2,
        speed: layer === 1 ? 45 : 110,
        alpha: layer === 1 ? 0.35 : 0.85,
      };
    });
  }

  /**
   * 【出撃開始（ゲームスタート / リトライ）】
   * skipBriefing が false の場合は「出撃前ブリーフィング演出（BRIEFING）」へ、
   * リトライ時（true）はブリーフィングをスキップして即座に戦闘へ突入します。
   */
  public startGame(skipBriefing: boolean = false): void {
    this.sound.unlock();     // スマホの音声アンロック
    this.score = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.particles = [];
    this.powerUps = [];
    this.enemySpawnTimer = 0;
    this.stage = 1;
    this.stageScrollTime = 0;
    this.gunshipSpawnsCount = 0;
    this.warningTimer = 0;
    this.stageClearTimer = 0;
    this.bannerTimer = 0;
    this.shakeTimer = 0;
    this.bombEffectTimer = 0;
    this.respawnTimer = 0;
    this.respawnDelayTimer = 0;
    this.playerDeathEffectTimer = 0;
    this.playerGameOverDelayTimer = 0;

    // 自機位置とステータスのリセット
    this.player.x = LOGICAL_WIDTH / 2;
    this.player.y = LOGICAL_HEIGHT - 120;
    this.player.weapon = "VULCAN";
    this.player.weaponLevel = 1;
    this.player.bombs = 3;
    this.player.speedLevel = 2;
    this.player.speed = 260;
    this.player.lives = 3;
    this.player.hp = 100;
    this.player.shotCooldown = 0;
    this.player.invincibleTimer = 1.0; // 出撃直後の1秒間は安全のため無敵
    this.input.targetX = this.player.x;
    this.input.targetY = this.player.y;

    // React 側に初期値を通知
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onHpChange(this.player.hp, this.player.maxHp);
    this.callbacks.onLivesChange(this.player.lives);
    this.callbacks.onWeaponChange(this.player.weapon, this.player.weaponLevel);
    this.callbacks.onBombsChange(this.player.bombs);
    this.callbacks.onStageChange(this.stage);
    this.callbacks.onBossChange(null);

    if (skipBriefing) {
      this.sound.playStart();
      this.sound.playBgm("NORMAL");
      this.status = "PLAYING";
      this.showBanner("STAGE 1 // ENGAGE", 2.0);
    } else {
      // プロローグ専用BGM（出撃前夜の静寂と緊迫感）を再生開始
      this.sound.playBgm("PROLOGUE");
      this.sound.playWarning();
      this.status = "BRIEFING";
      this.callbacks.onBannerChange(null);
    }
    this.callbacks.onStatusChange(this.status);
  }

  /**
   * 【開発用検証モード（DEV TEST MODE）】
   * 任意のステージ（1〜10）・フェーズ（道中 or ボス直行）・武器種別/レベルを指定して即出撃します。
   * ステップ1: 引数を安全な範囲にクランプ（1〜10、Lv1〜5）
   * ステップ2: フィールド上の弾・敵・タイマーをすべて初期化
   * ステップ3: 自機を指定の武器・レベルへ強化し、React HUDへ通知
   * ステップ4: directBoss が true なら即座にボスを召喚、false なら道中最初から開始
   */
  public startDebugStage(
    targetStage: number,
    directBoss: boolean,
    weapon: WeaponType = "VULCAN",
    weaponLevel: number = 3
  ): void {
    // ステップ1: 音声アンロックとパラメータの境界チェック（安全範囲へ丸める）
    this.sound.unlock();
    const clampedStage = Math.max(1, Math.min(10, Math.floor(targetStage)));
    const clampedLevel = Math.max(1, Math.min(5, Math.floor(weaponLevel)));

    // ステップ2: 前回の戦闘データ・タイマーをすべてリセット
    this.score = 0;
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.particles = [];
    this.powerUps = [];
    this.enemySpawnTimer = 0;
    this.stage = clampedStage;
    this.stageScrollTime = directBoss ? this.getBossSpawnTime() : 0; // ボス直行時はスクロール完了扱いにする
    this.gunshipSpawnsCount = 0;
    this.warningTimer = 0;
    this.stageClearTimer = 0;
    this.bannerTimer = 0;
    this.shakeTimer = 0;
    this.bombEffectTimer = 0;
    this.respawnTimer = 0;
    this.respawnDelayTimer = 0;
    this.playerDeathEffectTimer = 0;
    this.playerGameOverDelayTimer = 0;

    // ステップ3: 自機位置と指定された武器・レベルをセット
    this.player.x = LOGICAL_WIDTH / 2;
    this.player.y = LOGICAL_HEIGHT - 120;
    this.player.weapon = weapon;
    this.player.weaponLevel = clampedLevel;
    this.player.bombs = 3;
    this.player.speedLevel = 2;
    this.player.speed = 260;
    this.player.lives = 3;
    this.player.hp = 100;
    this.player.shotCooldown = 0;
    this.player.invincibleTimer = 1.2; // 開始直後の事故防止用無敵
    this.input.targetX = this.player.x;
    this.input.targetY = this.player.y;

    // React 側の HUD（スコア・HP・残機・武器・ステージ）を最新状態に同期
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onHpChange(this.player.hp, this.player.maxHp);
    this.callbacks.onLivesChange(this.player.lives);
    this.callbacks.onWeaponChange(this.player.weapon, this.player.weaponLevel);
    this.callbacks.onBombsChange(this.player.bombs);
    this.callbacks.onStageChange(this.stage);
    this.callbacks.onBossChange(null);

    // ステップ4: 指定フェーズ（ボス戦直行 or 通常道中）へ突入
    this.status = "PLAYING";
    this.sound.playStart();
    if (directBoss) {
      this.spawnBoss();
      this.showBanner(`DEV TEST // ST.${String(clampedStage).padStart(2, "0")} BOSS`, 2.2);
    } else {
      this.sound.playBgm("NORMAL");
      this.showBanner(`DEV TEST // STAGE ${clampedStage}`, 2.0);
    }
    this.callbacks.onStatusChange(this.status);
  }

  /**
   * 【開発用検証モード：ストーリー演出プレビュー】
   * プロローグ（BRIEFING）または最終エピローグ（EPILOGUE）画面を即座に開きます。
   */
  public startDebugScene(scene: "BRIEFING" | "EPILOGUE"): void {
    // 1. ブラウザの音声再生制限を解除
    this.sound.unlock();
    if (scene === "BRIEFING") {
      // プロローグ検証は通常開始フロー（BRIEFING開始）をそのまま呼び出す
      this.startGame(false);
      return;
    }

    // 2. EPILOGUE 検証用：戦闘中のエンティティ・タイマー・入力状態をすべて初期化
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.boss = null;
    this.powerUps = [];
    this.warningTimer = 0;
    this.stageClearTimer = 0;
    this.input.isPointerDown = false;
    // エンディング専用BGM（凱旋バラード）を再生開始
    this.sound.playBgm("EPILOGUE");

    // 3. スコアが 0 の場合はランク評価表示を確認しやすいようダミースコアを補完
    if (this.score <= 0) {
      this.score = 125000;
      this.callbacks.onScoreChange(this.score);
    }

    // 4. HUDのボス情報・バナーを消し、EPILOGUE 状態へ遷移して React 側へ通知
    this.callbacks.onBossChange(null);
    this.callbacks.onBannerChange(null);
    this.status = "EPILOGUE";
    this.callbacks.onStatusChange(this.status);
  }

  /** 難易度を変更（タイトル画面で選択） */
  public setDifficulty(diff: Difficulty): void {
    this.difficulty = diff;
  }

  /** 難易度に応じたゲームバランス倍率を返す */
  private getDifficultyScale() {
    if (this.difficulty === "EASY") {
      return { bulletSpeed: 0.75, damage: 0.65, spawnInterval: 1.25, bossHp: 0.75, revenge: false };
    }
    if (this.difficulty === "HARD") {
      return { bulletSpeed: 1.3, damage: 1.35, spawnInterval: 0.8, bossHp: 1.3, revenge: true };
    }
    return { bulletSpeed: 1.0, damage: 1.0, spawnInterval: 1.0, bossHp: 1.0, revenge: false };
  }

  /** ブリーフィング完了・スキップ時に戦闘フェーズへ移行 */
  public beginCombat(): void {
    if (this.status !== "BRIEFING") return;
    this.sound.playStart();
    this.sound.playBgm("NORMAL");
    this.status = "PLAYING";
    this.showBanner("STAGE 1 // ENGAGE", 2.0);
    this.callbacks.onStatusChange(this.status);
  }

  /** ポーズ（一時停止） */
  public pauseGame(): void {
    if (this.status !== "PLAYING") return;
    this.status = "PAUSED";
    this.sound.stopBgm();
    this.input.isPointerDown = false;
    this.callbacks.onStatusChange(this.status);
  }

  /** 再開（ポーズ解除） */
  public resumeGame(): void {
    if (this.status !== "PAUSED") return;
    this.status = "PLAYING";
    this.sound.playBgm(this.boss ? "BOSS" : "NORMAL");
    this.callbacks.onStatusChange(this.status);
  }

  /** リトライ（ブリーフィングをスキップして即再戦） */
  public retryGame(): void {
    this.startGame(true);
  }

  /** ゲーム中断（タイトル画面へ戻る） */
  public quitToTitle(): void {
    this.sound.stopBgm();
    this.status = "TITLE";
    this.input.isPointerDown = false;
    this.callbacks.onBossChange(null);
    this.callbacks.onBannerChange(null);
    this.callbacks.onStatusChange(this.status);
  }

  // --------------------------------------------------------------------------
  // 2. 座標変換 ＆ イベント監視（スマホタッチ ＆ PC入力）
  // --------------------------------------------------------------------------

  /**
   * 【全体構成における位置づけ：入力層（Input Layer）】
   * ブラウザから送られてくる生のマウス・タッチ座標を、ゲーム内の仮想論理空間（360×640）へ変換します。
   * 
   * 【初心者がつまずきやすいポイント：なぜ生の clientX / clientY をそのまま使えないのか？】
   * 1. `e.clientX / Y` はブラウザの画面左上（0,0）を起点としたピクセル位置です。
   * 2. 一方、ゲームの Canvas は CSS の中央寄せや縦横比キープ（9:16）によって、
   *    画面内で拡大・縮小・余白配置されています。
   * 3. `canvas.getBoundingClientRect()` を使うと「Canvasが画面のどこに何ピクセルの幅・高さで置かれているか」が分かります。
   * 4. 実際の表示幅に対する割合 `(clientX - rect.left) / rect.width` を求め、
   *    それにゲーム内部の幅 `LOGICAL_WIDTH (360)` を掛けることで、どんな端末でもミリ単位で正確な位置が取れます。
   */
  private getLogicalPos(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * LOGICAL_WIDTH,
      y: ((clientY - rect.top) / rect.height) * LOGICAL_HEIGHT,
    };
  }

  /**
   * 【全体構成における位置づけ：イベントバインディング】
   * プレイヤーからの物理入力を検知し、自機操作やショートカット機能へ振り分けます。
   * 
   * 【初心者がつまずきやすいポイント】
   * - `e.preventDefault()`: スマホで指を素早く動かした時に、ブラウザが「ページ全体のスクロール」や
   *   「ピンチズーム」と誤認して画面がガタガタ動くのを防ぐ必須のおまじないです。
   * - `{ passive: false }`: 現代のブラウザはスクロール性能を高めるためデフォルトで `passive: true` になっており、
   *   明示的に `false` を指定しないと `preventDefault()` が無視されてエラーになることがあります。
   * - `TOUCH_OFFSET_Y (50px)`: スマホで自分の指の真下に自機を置くと、指で自機や敵の弾が見えなくなってしまいます。
   *   指の接地点より少し上（50px上）に自機を追従させることで、視界をクリアに保つ親切設計です。
   */
  private bindEvents(): void {
    // --- ① スマホのタッチ操作 ---
    this.canvas.addEventListener("touchstart", (e) => {
      e.preventDefault(); // 画面スクロールやピンチズーム等のブラウザ標準動作を阻止
      if (this.status !== "PLAYING") return;
      const pos = this.getLogicalPos(e.touches[0].clientX, e.touches[0].clientY);
      this.input.isPointerDown = true;
      this.input.targetX = pos.x;
      // ★指隠れ防止：タッチした位置の「50px上」を目標地点にする
      this.input.targetY = pos.y - TOUCH_OFFSET_Y;
    }, { passive: false });

    this.canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (this.status !== "PLAYING" || !this.input.isPointerDown) return;
      const pos = this.getLogicalPos(e.touches[0].clientX, e.touches[0].clientY);
      this.input.targetX = pos.x;
      this.input.targetY = pos.y - TOUCH_OFFSET_Y;
    }, { passive: false });

    window.addEventListener("touchend", () => {
      this.input.isPointerDown = false;
    });

    // --- ② PCのマウス操作（テスト用） ---
    this.canvas.addEventListener("mousedown", (e) => {
      if (this.status !== "PLAYING") return;
      const pos = this.getLogicalPos(e.clientX, e.clientY);
      this.input.isPointerDown = true;
      this.input.targetX = pos.x;
      this.input.targetY = pos.y;
    });

    this.canvas.addEventListener("mousemove", (e) => {
      if (this.status !== "PLAYING" || !this.input.isPointerDown) return;
      const pos = this.getLogicalPos(e.clientX, e.clientY);
      this.input.targetX = pos.x;
      this.input.targetY = pos.y;
    });

    window.addEventListener("mouseup", () => {
      this.input.isPointerDown = false;
    });

    // --- ③ PCのキーボード操作・ショートカット ---
    window.addEventListener("keydown", (e) => {
      this.input.keys[e.code] = true;

      // P または Esc でポーズのトグル
      if (e.code === "KeyP" || e.code === "Escape") {
        if (this.status === "PLAYING") this.pauseGame();
        else if (this.status === "PAUSED") this.resumeGame();
      } else if (e.code === "KeyR" && this.status !== "TITLE") {
        this.retryGame(); // R でクイックリトライ
      } else if ((e.code === "KeyQ" || e.code === "Backspace") && this.status !== "TITLE") {
        e.preventDefault();
        this.quitToTitle(); // Q / Backspace でタイトル画面へ戻る
      } else if (e.code === "KeyM" && !e.repeat) {
        // React 側のミュートボタンがある場合はボタンクリックで状態同期（二重トグル防止）
        const muteBtn = document.querySelector<HTMLButtonElement>('[title="Mute Toggle"]');
        if (muteBtn) muteBtn.click();
        else this.sound.toggleMute();
      } else if ((e.code === "Space" || e.code === "Enter") && this.status === "TITLE") {
        this.startGame(); // タイトルで Space/Enter で出撃
      } else if (
        (e.code === "Space" || e.code === "KeyB" || e.code === "KeyX") &&
        this.status === "PLAYING" &&
        !e.repeat
      ) {
        e.preventDefault();
        this.triggerBomb(); // Space / B / X キーで緊急回避ボム発動
      }
    });

    window.addEventListener("keyup", (e) => {
      this.input.keys[e.code] = false;
    });

    // --- ④ バックグラウンド遷移時（着信やタブ切り替え）の自動ポーズ ---
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.status === "PLAYING") {
        this.pauseGame();
      }
    });
  }

  // --------------------------------------------------------------------------
  // 3. メインゲームループ（requestAnimationFrame ＆ デルタタイム制御）
  // --------------------------------------------------------------------------

  /**
   * 【全体構成における位置づけ：メインループ（Game Loop）】
   * ゲーム内の時間を進め、物理計算（Update）と画面描画（Render）を永久に繰り返す心臓部です。
   * 
   * 【初心者がつまずきやすいポイントと理由】
   * Q1. なぜ setInterval や setTimeout ではダメなのか？
   * ➔ `setInterval` は画面の描画タイミング（垂直同期）を無視して動くため、画面のチラつき（ティアリング）が発生します。
   *    また、ブラウザの別タブを開いていても裏で動き続けて無駄なバッテリーを消費してしまいます。
   *    `requestAnimationFrame` はブラウザが画面を描き換える直前に呼ばれるため、最も滑らかで電池に優しいです。
   * 
   * Q2. なぜ `dt = Math.min(..., 0.05)` で頭打ち（キャップ）にするのか？
   * ➔ タブを切り替えて長時間放置した後にゲームへ戻ると、前回からの経過時間 `timestamp - this.lastTime` が
   *    数秒〜数十秒という巨大な値になります。
   *    もしそのまま計算すると、自機や敵が一瞬で画面外へワープしたり、壁をすり抜けたりする「トンネリング現象」が発生します。
   *    最大でも「0.05秒（20fps相当）」で上限を切ることで、ゲームが壊れるのを防いでいます。
   */
  private startLoop(): void {
    const loop = (timestamp: number) => {
      // 初回フレームのタイムスタンプ記録（起動直後の巨大な dt 発生を防止）
      if (!this.lastTime) this.lastTime = timestamp;

      // 前回のフレームからの経過時間（秒単位）。最大でも 0.05秒(20fps)で頭打ち
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
      this.lastTime = timestamp;

      // 1. 物理演算・状態更新
      this.update(dt);
      // 2. Canvas への描画
      this.render();

      // 次の描画フレームをブラウザに予約（再帰呼び出しによって永久にループが回り続ける）
      this.animationId = requestAnimationFrame(loop);
    };

    // 最初の1フレーム目を起動
    this.animationId = requestAnimationFrame(loop);
  }

  /**
   * 【全体構成における位置づけ：終了クリーンアップ】
   * React のコンポーネントが画面からアンマウント（破棄）された際に呼ばれます。
   * ループアニメーションとWeb Audioの音声を完全に停止し、メモリリーク（裏で動き続けるバグ）を防ぎます。
   */
  public destroy(): void {
    cancelAnimationFrame(this.animationId);
    this.sound.stopBgm();
  }

  // --------------------------------------------------------------------------
  // 4. 計算フェーズ（Update）
  // --------------------------------------------------------------------------

  private update(dt: number): void {
    if (this.status === "BRIEFING") {
      // ブリーフィング演出中は背景の星を高速ワープさせて出撃感を演出
      for (const s of this.stars) {
        s.y += s.speed * 5.5 * dt;
        if (s.y > LOGICAL_HEIGHT) {
          s.y = 0;
          s.x = Math.random() * LOGICAL_WIDTH;
        }
      }
      return;
    }

    if (this.status === "PLAYING") {
      // カメラシェイク（画面揺れ）＆ ボム衝撃波 ＆ 自機爆発演出タイマーの減算
      if (this.shakeTimer > 0) {
        this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      }
      if (this.bombEffectTimer > 0) {
        this.bombEffectTimer = Math.max(0, this.bombEffectTimer - dt);
      }
      if (this.playerDeathEffectTimer > 0) {
        this.playerDeathEffectTimer = Math.max(0, this.playerDeathEffectTimer - dt);
      }
      if (this.bannerTimer > 0) {
        this.bannerTimer = Math.max(0, this.bannerTimer - dt);
        if (this.bannerTimer === 0) {
          this.callbacks.onBannerChange(null);
        }
      }

      // 全機喪失後の爆発余韻タイマー：0になった瞬間に正式な GAMEOVER 画面へ切り替える
      // （即座に暗転させず「自機が大爆発して散った」ことを視覚的に伝えてから結果画面を出すため）
      if (this.playerGameOverDelayTimer > 0) {
        this.playerGameOverDelayTimer = Math.max(0, this.playerGameOverDelayTimer - dt);
        if (this.playerGameOverDelayTimer === 0) {
          this.sound.stopBgm();
          this.sound.playGameOver();
          this.status = "GAMEOVER";
          this.input.isPointerDown = false;
          this.callbacks.onStatusChange("GAMEOVER");
          return;
        }
      }

      // 背景の星を下に流す
      for (const s of this.stars) {
        s.y += s.speed * dt;
        if (s.y > LOGICAL_HEIGHT) {
          s.y = 0;
          s.x = Math.random() * LOGICAL_WIDTH;
        }
      }

      this.updatePlayer(dt);
      this.updateCombat(dt);
    }
  }

  /** 自機の移動制御・画面端クランプ・無敵時間・オートショット */
  private updatePlayer(dt: number): void {
    // 0. 全機喪失して大爆発中の間は、操作・射撃を完全停止
    if (this.playerGameOverDelayTimer > 0) {
      return;
    }

    // 0.2 無敵時間のカウントダウン
    if (this.player.invincibleTimer > 0) {
      this.player.invincibleTimer = Math.max(0, this.player.invincibleTimer - dt);
    }

    // 0.4 撃墜直後の爆発余韻ウェイト（0.45秒間は画面外で待機し、爆発を見せる）
    if (this.respawnDelayTimer > 0) {
      this.respawnDelayTimer = Math.max(0, this.respawnDelayTimer - dt);
      return;
    }

    // 0.5 撃墜後の下からのリスポーン登場演出
    if (this.respawnTimer > 0) {
      this.respawnTimer = Math.max(0, this.respawnTimer - dt);
      const targetY = LOGICAL_HEIGHT - 120;
      this.player.y = Math.max(targetY, this.player.y - 260 * dt);
      if (this.player.y <= targetY) {
        this.respawnTimer = 0;
      }
      return;
    }

    // 1. キーボード移動入力の合成
    let moveX = 0;
    let moveY = 0;
    if (this.input.keys["ArrowLeft"] || this.input.keys["KeyA"]) moveX -= 1;
    if (this.input.keys["ArrowRight"] || this.input.keys["KeyD"]) moveX += 1;
    if (this.input.keys["ArrowUp"] || this.input.keys["KeyW"]) moveY -= 1;
    if (this.input.keys["ArrowDown"] || this.input.keys["KeyS"]) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      // 斜め移動時に速度が √2 倍（1.414倍）にならないよう正規化（normalize）
      const len = Math.hypot(moveX, moveY);
      this.player.x += (moveX / len) * this.player.speed * dt;
      this.player.y += (moveY / len) * this.player.speed * dt;
      this.input.targetX = this.player.x;
      this.input.targetY = this.player.y;
    } else if (this.input.isPointerDown) {
      // 2. タッチ操作時：Lerp（線形補間）による吸い付くような滑らかな追従
      const followRate = 1 - Math.pow(0.0005, dt);
      this.player.x += (this.input.targetX - this.player.x) * followRate;
      this.player.y += (this.input.targetY - this.player.y) * followRate;
    }

    // 3. 画面端クランプ（自機がHUDや画面外へ突き抜けないよう境界で止める）
    const halfW = this.player.width / 2;
    const halfH = this.player.height / 2;
    this.player.x = Math.max(halfW, Math.min(LOGICAL_WIDTH - halfW, this.player.x));
    this.player.y = Math.max(HUD_HEIGHT + halfH, Math.min(LOGICAL_HEIGHT - halfH, this.player.y));

    // 4. スラスターの炎のアニメーション周期を進める
    this.player.thrusterPhase += dt * 25;

    // 5. オートショット（武器種類・レベルに応じた弾丸の生成）
    this.player.shotCooldown -= dt;
    if (this.player.shotCooldown <= 0) {
      this.firePlayerWeapon();
      this.sound.playShot();
    }
  }

  /**
   * 【武器システム：3系統 × 5段階レベルの発射パターン】
   * 現在の武器（VULCAN / MISSILE / HOMING）とレベル（1〜5）に応じて
   * 弾の角度・数・連射間隔を切り替えます。
   */
  private firePlayerWeapon(): void {
    const { x, y, weapon, weaponLevel } = this.player;
    const muzzleY = y - 18;

    if (weapon === "VULCAN") {
      // 連射速度が速い基本武器（レベルに応じて 1way → 5way へ進化）
      this.player.shotCooldown = 0.11;
      const speed = 580;

      if (weaponLevel === 1) {
        this.bullets.push({ x, y: muzzleY, vx: 0, vy: -speed, width: 4, height: 16, kind: "VULCAN", damage: 1 });
      } else if (weaponLevel === 2) {
        this.bullets.push({ x: x - 7, y: muzzleY, vx: 0, vy: -speed, width: 4, height: 16, kind: "VULCAN", damage: 1 });
        this.bullets.push({ x: x + 7, y: muzzleY, vx: 0, vy: -speed, width: 4, height: 16, kind: "VULCAN", damage: 1 });
      } else {
        // Lv.3=3way, Lv.4=4way, Lv.5=5way を角度配列で統一生成
        const anglesDeg =
          weaponLevel === 3
            ? [-12, 0, 12]
            : weaponLevel === 4
              ? [-16, -5, 5, 16]
              : [-20, -10, 0, 10, 20];

        for (const deg of anglesDeg) {
          const rad = ((deg - 90) * Math.PI) / 180;
          this.bullets.push({
            x,
            y: muzzleY,
            vx: Math.cos(rad) * speed,
            vy: Math.sin(rad) * speed,
            width: 4,
            height: 16,
            kind: "VULCAN",
            damage: 1,
          });
        }
      }
      return;
    }

    if (weapon === "MISSILE") {
      // ミサイル：少し間隔が長いが、着弾時の爆風で周囲の敵もまとめて攻撃！
      this.player.shotCooldown = 0.24;
      const speed = 430;
      const splashRadius = 26 + weaponLevel * 4; // Lv1:30px 〜 Lv5:46px
      const count = weaponLevel;

      for (let i = 0; i < count; i++) {
        // 中央を基準に左右へ対称に角度を振る
        const offsetIndex = i - (count - 1) / 2;
        const rad = ((offsetIndex * 11 - 90) * Math.PI) / 180;
        this.bullets.push({
          x: x + offsetIndex * 6,
          y: muzzleY,
          vx: Math.cos(rad) * speed,
          vy: Math.sin(rad) * speed,
          width: 7,
          height: 18,
          kind: "MISSILE",
          damage: 2,
          splashRadius,
        });
      }
      return;
    }

    // HOMING：敵を自動追尾する誘導レーザー（Lvに応じて同時発射数が増加）
    this.player.shotCooldown = 0.17;
    const speed = 470;
    const count = weaponLevel;
    for (let i = 0; i < count; i++) {
      const offsetIndex = i - (count - 1) / 2;
      const rad = ((offsetIndex * 16 - 90) * Math.PI) / 180;
      this.bullets.push({
        x: x + offsetIndex * 8,
        y: muzzleY,
        vx: Math.cos(rad) * speed,
        vy: Math.sin(rad) * speed,
        width: 5,
        height: 14,
        kind: "HOMING",
        damage: 1,
      });
    }
  }

  /**
   * 【全体構成における位置づけ：戦闘物理演算フェーズ（Combat Physics Update）】
   * 毎フレームの update() から呼ばれ、戦闘に関わる全オブジェクト（自機弾、敵機、敵弾、アイテム、爆発）の
   * 移動処理、画面外判定、衝突判定（当たり判定）、およびダメージ・撃破・ステージ進行を計算します。
   * 
   * 【初心者がつまずきやすいポイントと数学の解説】
   * 1. ホーミング弾の誘導計算（なぜ Math.atan2 と角度正規化を使うのか？）：
   *    - 最も近い敵の座標（targetX, targetY）と弾の座標の差から、`Math.atan2(dy, dx)` で「敵がいる方角」を算出します。
   *    - 現在の弾の進行角度と敵の方角の差（diff）を求めますが、角度は +180度（+PI）と -180度（-PI）がつながっているため、
   *      そのまま引き算すると「左回りした方が近いのに右へ大回りしてしまう」問題が起きます。
   *    - 差分を `-Math.PI 〜 +Math.PI` の範囲に丸める（正規化する）ことで、常に最短経路で滑らかに敵へ旋回します。
   * 
   * 2. なぜ `this.bullets.splice(i, 1)` は逆順ループ（length - 1 から 0 へ）で行うのか？：
   *    - 前述の通り、先頭から普通に回すと、要素を削除した瞬間に後ろの要素がインデックスごと手前へズレてしまい、
   *      「次の弾が判定されずにすり抜ける」バグになります。末尾から処理することで未走査のインデックスを保護します。
   */
  private updateCombat(dt: number): void {
    // 1. 自機弾の移動（HOMING は最も近い敵を追尾、画面外に出たら削除）
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];

      // 【ホーミングレーザーの自動追尾ロジック（ザコ敵 ＋ ボス対応）】
      if (b.kind === "HOMING") {
        let targetX: number | null = null;
        let targetY: number | null = null;
        let minDist = Infinity;

        // 全ザコ敵の中で最も直線距離（Math.hypot: 三平方の定理）が近いものを探す
        for (const e of this.enemies) {
          const d = Math.hypot(e.x - b.x, e.y - b.y);
          if (d < minDist) {
            minDist = d;
            targetX = e.x;
            targetY = e.y;
          }
        }
        // ボスが出現している場合はボスも追尾対象に含める
        if (this.boss && this.boss.y >= this.boss.targetY) {
          const dBoss = Math.hypot(this.boss.x - b.x, this.boss.y - b.y);
          if (dBoss < minDist) {
            targetX = this.boss.x;
            targetY = this.boss.y;
          }
        }

        // 標的が見つかった場合、弾の進行角度を徐々に標的の方角へ向ける（急旋回せず自然に曲がる）
        if (targetX !== null && targetY !== null) {
          const speed = Math.hypot(b.vx, b.vy);
          const targetAngle = Math.atan2(targetY - b.y, targetX - b.x);
          const currentAngle = Math.atan2(b.vy, b.vx);
          // 角度差を -PI 〜 +PI に正規化して最短方向へ滑らかに旋回させる
          let diff = targetAngle - currentAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turnRate = 8.5 * dt; // 1秒あたりの最大旋回速度（ラジアン）
          const nextAngle = currentAngle + Math.max(-turnRate, Math.min(turnRate, diff));
          b.vx = Math.cos(nextAngle) * speed;
          b.vy = Math.sin(nextAngle) * speed;
        }
      }

      // 移動計算：速度(px/秒) × 経過時間(dt)
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 画面の上下左右から少しはみ出た（マージン20px）時点で弾丸配列から安全に破棄
      if (
        b.y < HUD_HEIGHT - 20 ||
        b.y > LOGICAL_HEIGHT + 20 ||
        b.x < -20 ||
        b.x > LOGICAL_WIDTH + 20
      ) {
        this.bullets.splice(i, 1);
      }
    }

    // 1.5 ステージ進行（ボス警報・ステージクリア遷移・ボス戦更新）
    if (this.warningTimer > 0) {
      this.warningTimer = Math.max(0, this.warningTimer - dt);
      if (this.warningTimer === 0) {
        this.spawnBoss();
      }
    }
    if (this.stageClearTimer > 0) {
      this.stageClearTimer = Math.max(0, this.stageClearTimer - dt);
      if (this.stageClearTimer === 0) {
        if (this.stage >= 10) {
          // ST.10 撃破後は最終エピローグ（エンディング）へ遷移し、専用BGMを再生
          this.status = "EPILOGUE";
          this.sound.playBgm("EPILOGUE");
          this.input.isPointerDown = false;
          this.callbacks.onBannerChange(null);
          this.callbacks.onStatusChange(this.status);
          return;
        }
        this.stage += 1;
        this.stageScrollTime = 0;
        this.gunshipSpawnsCount = 0;
        this.callbacks.onStageChange(this.stage);
        this.showBanner(`STAGE ${this.stage} // ENGAGE`, 2.0);
      }
    }
    if (this.boss) {
      this.updateBoss(dt);
    }

    // 2. スクロール経過時間のカウント ＆ 4タイプの敵出現管理（game-design.md 5.5 準拠）
    if (!this.boss && this.warningTimer <= 0 && this.stageClearTimer <= 0) {
      this.stageScrollTime += dt;

      // 中型エリート敵「TITAN GUNSHIP」の複数回出現（長くなった後半ステージでは最大4回）
      const bossTime = this.getBossSpawnTime();
      const gunshipTimes =
        this.stage === 1
          ? [18, 33]
          : this.stage <= 3
            ? [12, 26, 40]
            : [12, 26, 40, Math.max(48, bossTime - 10)];
      if (
        this.gunshipSpawnsCount < gunshipTimes.length &&
        this.stageScrollTime >= gunshipTimes[this.gunshipSpawnsCount]
      ) {
        this.gunshipSpawnsCount += 1;
        this.spawnEnemyByType("GUNSHIP");
      }

      if (this.stageScrollTime >= bossTime) {
        this.warningTimer = 2.6;
        this.sound.playWarning();
        this.showBanner("WARNING // BOSS APPROACHING", 2.6);
      }

      this.enemySpawnTimer -= dt;
      if (this.enemySpawnTimer <= 0) {
        this.spawnWaveEnemy();
        this.enemySpawnTimer =
          Math.max(0.45, 0.78 - (this.stage - 1) * 0.04) * this.getDifficultyScale().spawnInterval;
      }
    }

    // 3. 敵の移動 ＆ 敵弾発射 ＆ 当たり判定
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.age += dt;
      this.updateEnemyBehavior(e, dt);

      // 画面下部に通り過ぎたら消滅
      if (e.y > LOGICAL_HEIGHT + 30 || e.x < -40 || e.x > LOGICAL_WIDTH + 40) {
        this.enemies.splice(i, 1);
        continue;
      }

      // 自機本体と敵本体の接触判定（複合円判定で機体シルエットに沿って判定）
      if (
        this.player.invincibleTimer <= 0 &&
        this.isCollidingWithPlayer(e.x, e.y, e.radius)
      ) {
        this.damagePlayer(35);
      }

      // 【初心者がつまずきやすいポイント：当たり判定（コリジョン）の数学】
      // Q. なぜ「円判定（三平方の定理 Math.hypot）」を使うのか？
      // ➔ 四角形同士の判定（AABB）だと、斜めに傾いた弾や敵の角で「見た目では当たっていないのに当たった」という
      //    理不尽な被弾が起きやすくなります。
      //    中心点からの距離 `d = Math.hypot(dx, dy)` を計算し、それが「敵の半径 + 弾の当たり判定半径」以下なら接触とみなす
      //    円判定は、回転しても判定がブレず、最も自然で納得感のある当たり判定になります。
      for (let j = this.bullets.length - 1; j >= 0; j--) {
        const b = this.bullets[j];
        if (Math.hypot(b.x - e.x, b.y - e.y) < e.radius + 6) {
          this.bullets.splice(j, 1); // 命中した弾丸を配列から削除（貫通弾以外）
          e.hp -= b.damage;
          this.spawnExplosion(b.x, b.y, b.kind === "MISSILE" ? "#ff7b00" : "#ffffff");

          // ミサイル着弾時の爆風（範囲攻撃）：周囲の敵の座標も調べて一定範囲内にいれば巻き込みダメージ
          if (b.splashRadius) {
            this.spawnExplosion(b.x, b.y, "#ffae42");
            for (const other of this.enemies) {
              if (other !== e && Math.hypot(other.x - b.x, other.y - b.y) <= b.splashRadius + other.radius) {
                other.hp -= 1;
              }
            }
          }
          // 敵のHPがゼロになったら、これ以上この敵への弾丸判定を行う必要がないので内側ループを抜ける
          if (e.hp <= 0) break;
        }
      }
    }

    // 3.5 HP が 0 以下になった敵を一括で撃破処理（爆風による巻き込み撃破も安全に処理）
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      if (this.enemies[i].hp <= 0) {
        this.destroyEnemy(i);
      }
    }

    // 4. 敵弾の移動 ＆ 特殊弾挙動 ＆ 自機（複合円判定）への被弾判定
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const eb = this.enemyBullets[i];
      eb.age = (eb.age ?? 0) + dt;

      // 特殊弾の挙動処理（ボス固有弾幕の軌道・分裂制御）
      if (eb.behavior === "CLUSTER" && eb.splitAfter !== undefined && eb.age >= eb.splitAfter) {
        // 【CLUSTER（分裂弾）】一定時間飛行後に親弾を消滅させ、放射状に子弾を生成する
        const count = eb.splitCount ?? 4;
        const baseSpd = Math.hypot(eb.vx, eb.vy) * 0.85;
        for (let k = 0; k < count; k++) {
          const ang = (Math.PI * 2 * k) / count + 0.35;
          this.enemyBullets.push({
            x: eb.x,
            y: eb.y,
            vx: Math.cos(ang) * baseSpd,
            vy: Math.sin(ang) * baseSpd,
            radius: 3.8,
            color: eb.color,
          });
        }
        this.spawnExplosion(eb.x, eb.y, eb.color ?? "#ff6600");
        this.enemyBullets.splice(i, 1);
        continue;
      }

      if (eb.behavior === "WAVE") {
        // 【WAVE（蛇行弾）】経過時間に応じたサイン/コサイン波で左右に揺れながら落下する
        const amp = eb.waveAmp ?? 70;
        const freq = eb.waveFreq ?? 6;
        eb.x += Math.cos(eb.age * freq) * amp * dt;
      } else if (eb.behavior === "TIME_TRAP") {
        // 【TIME_TRAP（時空トラップ弾）】発射直後は通常速度 → 一度スロー(0.16倍) → 急に高速化(1.65倍)
        const bvx = eb.baseVx ?? eb.vx;
        const bvy = eb.baseVy ?? eb.vy;
        const scale = eb.age < 0.45 ? 1.0 : eb.age < 0.95 ? 0.16 : 1.65;
        eb.vx = bvx * scale;
        eb.vy = bvy * scale;
      } else if (eb.behavior === "CURVE" && eb.curveRate) {
        // 【CURVE（重力カーブ弾）】毎フレーム進行角度を回転させて弧を描く軌道を作る
        const angle = Math.atan2(eb.vy, eb.vx) + eb.curveRate * dt;
        const spd = Math.hypot(eb.vx, eb.vy);
        eb.vx = Math.cos(angle) * spd;
        eb.vy = Math.sin(angle) * spd;
      }

      eb.x += eb.vx * dt;
      eb.y += eb.vy * dt;

      // 画面外に出た敵弾を削除
      if (
        eb.x < -20 ||
        eb.x > LOGICAL_WIDTH + 20 ||
        eb.y < HUD_HEIGHT - 20 ||
        eb.y > LOGICAL_HEIGHT + 20
      ) {
        this.enemyBullets.splice(i, 1);
        continue;
      }

      // ★複合円判定：機首・胴体・左右の翼のいずれかの円と重なれば被弾！
      if (
        this.player.invincibleTimer <= 0 &&
        this.isCollidingWithPlayer(eb.x, eb.y, eb.radius)
      ) {
        this.enemyBullets.splice(i, 1); // 当たった弾を消す
        this.damagePlayer(25);          // シールドに 25 ダメージ
      }
    }

    // 5. 爆発パーティクルの寿命計算（時間経過で消滅）
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    // 6. パワーアップアイテムの落下移動 ＆ 自機との取得判定
    for (let i = this.powerUps.length - 1; i >= 0; i--) {
      const item = this.powerUps[i];
      item.y += item.vy * dt;
      item.phase += dt * 4;
      // 落下しながらサイン波で左右にゆらゆら揺らす
      item.x += Math.sin(item.phase) * 28 * dt;

      if (item.y > LOGICAL_HEIGHT + 25) {
        this.powerUps.splice(i, 1);
        continue;
      }

      if (this.isCollidingWithPlayer(item.x, item.y, item.radius + 4)) {
        this.collectPowerUp(item.type);
        this.powerUps.splice(i, 1);
      }
    }
  }

  /**
   * 【緊急回避兵器（ボム）の発動】
   * 1. ボム残弾を 1 消費（0発または演出中は無効）
   * 2. 画面上のすべての敵弾を消去（弾消し）＋ 火花エフェクト
   * 3. 画面内のすべての敵に大ダメージ（-5）を与え、撃破判定を実施
   * 4. 自機に 2.0 秒の無敵時間と画面衝撃波・カメラシェイクを発生
   */
  public triggerBomb(): void {
    if (this.status !== "PLAYING" || this.player.bombs <= 0 || this.bombEffectTimer > 0.3) return;

    this.player.bombs -= 1;
    this.callbacks.onBombsChange(this.player.bombs);

    this.bombEffectTimer = 0.65;
    this.bombOriginX = this.player.x;
    this.bombOriginY = this.player.y;
    this.shakeTimer = 0.35;
    this.player.invincibleTimer = Math.max(this.player.invincibleTimer, 2.0);
    this.sound.playBomb();

    // 1. すべての敵弾を消去（弾消し）
    for (const eb of this.enemyBullets) {
      this.spawnExplosion(eb.x, eb.y, "#00f3ff");
    }
    this.enemyBullets = [];

    // 2. 画面内のすべての敵に大ダメージ
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      this.enemies[i].hp -= 5;
      if (this.enemies[i].hp <= 0) {
        this.destroyEnemy(i);
      }
    }

    // 3. ボスがいればボスにも大ダメージ（-35）。登場降下中は無敵ガード
    if (this.boss && this.boss.y >= this.boss.targetY) {
      this.boss.hp -= 35;
      this.boss.hitFlashTimer = 0.12;
      this.callbacks.onBossChange({
        name: this.boss.name,
        hp: Math.max(0, this.boss.hp),
        maxHp: this.boss.maxHp,
      });
      if (this.boss.hp <= 0) {
        this.defeatBoss();
      }
    }
  }

  /** バナー通知（WARNING / STAGE START / STAGE CLEAR）を一定時間表示 */
  private showBanner(text: string, duration: number): void {
    this.bannerTimer = duration;
    this.callbacks.onBannerChange(text);
  }

  /** ステージごとのボス出現処理（ST.01〜ST.10 固有パラメータ定義） */
  /** 現在のステージに対応したボス機体を生成し、ボス戦BGMとHUD表示を開始する */
  private spawnBoss(): void {
    // 1. ステージ1〜10のボス定義テーブル（名称・基礎HP・横移動速度・横幅・テーマカラー）
    // ※後半は弾幕やギミック自体が難しくなるため、自機の最大火力に合わせてHPはなだらかに増加させています（ST.01=320 〜 ST.10=780 / 約2.44倍）
    const bossConfigs: Array<{ name: string; hp: number; vx: number; width: number; color: string }> = [
      { name: "GOLIATH", hp: 320, vx: 55, width: 180, color: "#ff0055" },
      { name: "CRIMSON MANTA X-2", hp: 360, vx: 90, width: 184, color: "#ff6600" },
      { name: "SUB-SPACE CENTIPEDE", hp: 400, vx: 72, width: 176, color: "#b829ff" },
      { name: "IRON AEGIS", hp: 450, vx: 55, width: 184, color: "#00d4ff" },
      { name: "SOLAR FLARE: HELIOS", hp: 500, vx: 52, width: 188, color: "#ffcc00" },
      { name: "VOID LEVIATHAN: ABYSS", hp: 550, vx: 60, width: 190, color: "#00ff88" },
      { name: "OUROBOROS", hp: 600, vx: 68, width: 180, color: "#00ffff" },
      { name: "CRUCIBLE OMEGA", hp: 660, vx: 42, width: 220, color: "#ff2a6d" },
      { name: "SINGULARITY ZERO", hp: 720, vx: 50, width: 186, color: "#8b5cf6" },
      { name: "DEUS EX COSMOS", hp: 780, vx: 64, width: 200, color: "#ffd700" },
    ];

    // 2. ステージ番号を配列インデックス(0〜9)へ丸め、難易度倍率を掛けた最大HPを算出
    const stageIdx = Math.max(0, Math.min(9, this.stage - 1));
    const cfg = bossConfigs[stageIdx];
    const maxHp = Math.round(cfg.hp * this.getDifficultyScale().bossHp);

    // 3. ボス戦専用BGMへ切り替え
    this.sound.playBgm("BOSS");

    // 4. 画面上端外(y=-70)から定位置(targetY=130)へ降下してくるボス実体を生成
    this.boss = {
      stage: this.stage,
      name: `ST.${String(this.stage).padStart(2, "0")} ${cfg.name}`,
      color: cfg.color,
      x: LOGICAL_WIDTH / 2,
      y: -70,
      targetY: 130,
      vx: cfg.vx,
      width: cfg.width,
      height: 96,
      hp: maxHp,
      maxHp,
      attackCooldown: 1.0,
      attackPhase: 0,
      hitFlashTimer: 0,
      age: 0,
      spiralAngle: 0,
      warpTimer: this.stage === 7 ? 3.5 : undefined,
      beamWarningTimer: 0,
      beamActiveTimer: 0,
      regenerated: false,
      shieldAngle: 0,
    };

    // 5. React側のHUDにボス名・HPバーを表示させる
    this.callbacks.onBossChange({
      name: this.boss.name,
      hp: this.boss.hp,
      maxHp: this.boss.maxHp,
    });
  }

  /** ボスの移動・固有弾幕・特殊ギミック・自機弾との当たり判定 */
  private updateBoss(dt: number): void {
    const boss = this.boss;
    if (!boss) return;

    if (boss.hitFlashTimer > 0) {
      boss.hitFlashTimer = Math.max(0, boss.hitFlashTimer - dt);
    }

    // 1. 登場降下（定位置に着くまでは降下のみ・無敵）
    // ※ boss.age === 0 を条件に入れている理由:
    //   ST.03 のように戦闘開始後に上下へうねり移動（y < targetY になる）するボスが、
    //   戦闘中に再び「登場降下中」と誤判定されて固まるのを防ぐためです。
    if (boss.age === 0 && boss.y < boss.targetY) {
      boss.y = Math.min(boss.targetY, boss.y + 75 * dt);
      return;
    }

    boss.age += dt;
    const hpRatio = boss.hp / boss.maxHp;
    const isEnraged = hpRatio <= 0.5;
    const bulletScale = this.getDifficultyScale().bulletSpeed;
    const baseSpeed = (150 + (boss.stage - 1) * 8) * bulletScale;

    // 2. ステージ別の移動・固有ギミック更新
    // ST.03: HP低下に応じてスピードアップ＆上下にうねり飛行
    const speedBoost = boss.stage === 3 ? 1 + (1 - hpRatio) * 0.7 : 1;
    boss.x += boss.vx * speedBoost * dt;
    if (boss.stage === 3) {
      boss.y = boss.targetY + Math.sin(boss.age * 2.4) * 18;
    }

    // 画面左右端の折り返し判定（はみ出さないよう方向を反転）
    const halfW = boss.width / 2 + 10;
    if (boss.x < halfW) {
      boss.x = halfW;
      boss.vx = Math.abs(boss.vx);
    } else if (boss.x > LOGICAL_WIDTH - halfW) {
      boss.x = LOGICAL_WIDTH - halfW;
      boss.vx = -Math.abs(boss.vx);
    }

    // ST.04: 回転シールドオーブの角度を更新（HP半分以下で高速回転）
    if (boss.stage === 4) {
      boss.shieldAngle = (boss.shieldAngle ?? 0) + (isEnraged ? 2.8 : 1.9) * dt;
    }

    // ST.06: HP 40%以下になった際、1度だけ最大HPの15%を自己再生し全方位弾を放つ
    if (boss.stage === 6 && !boss.regenerated && hpRatio <= 0.4) {
      boss.regenerated = true;
      boss.hp = Math.min(boss.maxHp, boss.hp + Math.round(boss.maxHp * 0.15));
      this.showBanner("ABYSS // SELF-REGENERATION!", 1.8);
      this.callbacks.onBossChange({ name: boss.name, hp: boss.hp, maxHp: boss.maxHp });
      for (let k = 0; k < 14; k++) {
        const ang = (Math.PI * 2 * k) / 14;
        this.enemyBullets.push({
          x: boss.x,
          y: boss.y + 10,
          vx: Math.cos(ang) * baseSpeed * 0.9,
          vy: Math.sin(ang) * baseSpeed * 0.9,
          radius: 4.5,
          color: boss.color,
        });
      }
    }

    // ST.07: ワープ予告枠の表示（0.7秒）→ 瞬間移動ギミック
    if (boss.stage === 7 && boss.warpTimer !== undefined) {
      if ((boss.warpWarningTimer ?? 0) > 0) {
        // 予告タイマー消化後にワープを実行（発狂時はワープ元の残像から8方向弾）
        boss.warpWarningTimer! -= dt;
        if (boss.warpWarningTimer! <= 0 && boss.warpTargetX !== undefined) {
          if (isEnraged) {
            for (let k = 0; k < 8; k++) {
              const ang = (Math.PI * 2 * k) / 8;
              this.enemyBullets.push({
                x: boss.x,
                y: boss.y,
                vx: Math.cos(ang) * baseSpeed * 0.85,
                vy: Math.sin(ang) * baseSpeed * 0.85,
                radius: 4,
                color: boss.color,
              });
            }
          }
          this.spawnExplosion(boss.x, boss.y, boss.color);
          boss.x = boss.warpTargetX;
          this.spawnExplosion(boss.x, boss.y, "#ffffff");
          boss.warpTimer = isEnraged ? 2.8 : 4.0;
        }
      } else {
        // 次回ワープまでのクールダウンを計測し、0になったらランダムX座標へ予告枠を出す
        boss.warpTimer -= dt;
        if (boss.warpTimer <= 0) {
          boss.warpTargetX = halfW + Math.random() * (LOGICAL_WIDTH - halfW * 2);
          boss.warpWarningTimer = 0.7;
        }
      }
    }

    // ST.05 / ST.08: 縦レーンプラズマ熱波 / 極太主砲ビーム（予告線 → 照射ダメージ判定）
    if (boss.stage === 5 || boss.stage === 8) {
      if ((boss.beamActiveTimer ?? 0) > 0) {
        // 照射中：ビームの横幅内に自機がいればダメージを与える
        boss.beamActiveTimer! -= dt;
        const bx = boss.beamX ?? boss.x;
        const bw = boss.beamWidth ?? 36;
        if (
          this.player.invincibleTimer <= 0 &&
          Math.abs(this.player.x - bx) < bw * 0.5 + 8 &&
          this.player.y > boss.y
        ) {
          this.damagePlayer(boss.stage === 8 ? 35 : 25);
        }
      } else if ((boss.beamWarningTimer ?? 0) > 0) {
        // 予告中：カウントダウンが 0 になった瞬間にビーム照射へ移行
        boss.beamWarningTimer! -= dt;
        if (boss.beamWarningTimer! <= 0) {
          boss.beamActiveTimer = boss.stage === 8 ? 0.8 : 0.55;
          this.sound.playBomb();
        }
      }
    }

    // ST.09: ブラックホール重力場（自機を画面中央上部へ緩やかに引き寄せる）
    if (boss.stage === 9) {
      const pullStrength = isEnraged ? 46 : 30;
      const dx = LOGICAL_WIDTH / 2 - this.player.x;
      const dy = LOGICAL_HEIGHT * 0.42 - this.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 8) {
        this.player.x += (dx / dist) * pullStrength * dt;
        this.player.y = Math.max(
          HUD_HEIGHT + 24,
          Math.min(LOGICAL_HEIGHT - 24, this.player.y + (dy / dist) * pullStrength * 0.6 * dt)
        );
      }
    }

    // 3. ステージ固有弾幕の生成
    boss.attackCooldown -= dt;
    if (boss.attackCooldown <= 0) {
      boss.attackPhase = (boss.attackPhase + 1) % 3;
      const aimAngle = Math.atan2(this.player.y - boss.y, this.player.x - boss.x);

      switch (boss.stage) {
        case 1: {
          // ST.01 GOLIATH: 左右交差3/5-way + 自機狙い
          if (boss.attackPhase !== 2) {
            const spread = isEnraged ? [-28, -14, 0, 14, 28] : [-18, 0, 18];
            for (const ox of [-52, 52]) {
              for (const deg of spread) {
                const rad = ((deg + 90) * Math.PI) / 180;
                this.enemyBullets.push({
                  x: boss.x + ox, y: boss.y + 26,
                  vx: Math.cos(rad) * baseSpeed, vy: Math.sin(rad) * baseSpeed,
                  radius: 4.5, color: boss.color,
                });
              }
            }
          } else {
            const offsets = isEnraged ? [-0.24, -0.12, 0, 0.12, 0.24] : [-0.16, 0, 0.16];
            for (const off of offsets) {
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 32,
                vx: Math.cos(aimAngle + off) * baseSpeed * 1.15,
                vy: Math.sin(aimAngle + off) * baseSpeed * 1.15,
                radius: 4.5, color: boss.color,
              });
            }
          }
          boss.attackCooldown = isEnraged ? 0.9 : 1.3;
          break;
        }

        case 2: {
          // ST.02 CRIMSON MANTA X-2: 分裂クラスター爆弾 + 高速直進弾
          if (boss.attackPhase === 0) {
            const drops = isEnraged ? [-48, 48] : [0];
            for (const ox of drops) {
              this.enemyBullets.push({
                x: boss.x + ox, y: boss.y + 24,
                vx: (Math.random() - 0.5) * 40, vy: baseSpeed * 0.9,
                radius: 6, color: boss.color,
                behavior: "CLUSTER", splitAfter: 0.55, splitCount: isEnraged ? 6 : 4,
              });
            }
          } else {
            for (const off of [-0.14, 0, 0.14]) {
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 30,
                vx: Math.cos(aimAngle + off) * baseSpeed * 1.25,
                vy: Math.sin(aimAngle + off) * baseSpeed * 1.25,
                radius: 4.2, color: boss.color,
              });
            }
          }
          boss.attackCooldown = isEnraged ? 0.85 : 1.15;
          break;
        }

        case 3: {
          // ST.03 SUB-SPACE CENTIPEDE: 全方位リング + 5列蛇行ウェーブ弾 + 採掘レーザー自機狙い
          if (boss.attackPhase === 0) {
            // 1) 全方位リング弾幕
            const count = isEnraged ? 16 : 12;
            for (let k = 0; k < count; k++) {
              const ang = (Math.PI * 2 * k) / count + boss.age;
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 10,
                vx: Math.cos(ang) * baseSpeed * 0.92, vy: Math.sin(ang) * baseSpeed * 0.92,
                radius: 4.3, color: boss.color,
              });
            }
          } else if (boss.attackPhase === 1) {
            // 2) 横5列の蛇行ウェーブ弾（左右にうねりながら落下）
            for (const ox of [-64, -32, 0, 32, 64]) {
              this.enemyBullets.push({
                x: boss.x + ox, y: boss.y + 24,
                vx: 0, vy: baseSpeed * 0.98,
                radius: 4.5, color: boss.color,
                behavior: "WAVE", waveAmp: 85, waveFreq: 6.5,
              });
            }
          } else {
            // 3) 頭部の採掘レーザー大顎から自機狙い 3-way（発狂時は 5-way）高速レーザー弾
            const offsets = isEnraged ? [-0.28, -0.14, 0, 0.14, 0.28] : [-0.16, 0, 0.16];
            for (const off of offsets) {
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 28,
                vx: Math.cos(aimAngle + off) * baseSpeed * 1.28,
                vy: Math.sin(aimAngle + off) * baseSpeed * 1.28,
                radius: 4.4, color: "#ffb95f",
              });
            }
          }
          // HP低下（speedBoost）に応じて攻撃間隔も短くなり、終盤は怒涛の連射に
          boss.attackCooldown = (isEnraged ? 0.72 : 1.0) / speedBoost;
          break;
        }

        case 4: {
          // ST.04 IRON AEGIS: X字クロス高速弾 + シールド回転放射
          if (boss.attackPhase !== 2) {
            for (const side of [-1, 1]) {
              const ang = Math.PI / 2 + side * 0.35;
              for (const s of [-0.08, 0.08]) {
                this.enemyBullets.push({
                  x: boss.x - side * 56, y: boss.y + 20,
                  vx: Math.cos(ang + s) * baseSpeed * 1.2,
                  vy: Math.sin(ang + s) * baseSpeed * 1.2,
                  radius: 4.2, color: boss.color,
                });
              }
            }
          } else {
            const count = isEnraged ? 8 : 6;
            for (let k = 0; k < count; k++) {
              const ang = (boss.shieldAngle ?? 0) + (Math.PI * 2 * k) / count;
              this.enemyBullets.push({
                x: boss.x + Math.cos(ang) * 44, y: boss.y + Math.sin(ang) * 28,
                vx: Math.cos(ang) * baseSpeed * 0.95, vy: Math.sin(ang) * baseSpeed * 0.95,
                radius: 4.5, color: boss.color,
              });
            }
          }
          boss.attackCooldown = isEnraged ? 0.65 : 0.95;
          break;
        }

        case 5: {
          // ST.05 SOLAR FLARE: HELIOS: スパイラル弾幕 + 縦レーンプラズマ熱波
          const arms = isEnraged ? 4 : 3;
          for (let k = 0; k < arms; k++) {
            const ang = boss.spiralAngle + (Math.PI * 2 * k) / arms;
            this.enemyBullets.push({
              x: boss.x, y: boss.y + 12,
              vx: Math.cos(ang) * baseSpeed * 0.92, vy: Math.sin(ang) * baseSpeed * 0.92,
              radius: 4.4, color: boss.color,
            });
          }
          boss.spiralAngle += 0.38;
          if (boss.attackPhase === 2 && (boss.beamWarningTimer ?? 0) <= 0 && (boss.beamActiveTimer ?? 0) <= 0) {
            boss.beamX = this.player.x;
            boss.beamWidth = 34;
            boss.beamWarningTimer = 0.9;
          }
          boss.attackCooldown = isEnraged ? 0.24 : 0.34;
          break;
        }

        case 6: {
          // ST.06 VOID LEVIATHAN: ABYSS: 低速粘着WAVE弾 + 高速針弾
          if (boss.attackPhase !== 2) {
            for (const ox of [-55, -18, 18, 55]) {
              this.enemyBullets.push({
                x: boss.x + ox, y: boss.y + 26,
                vx: (Math.random() - 0.5) * 30, vy: baseSpeed * 0.72,
                radius: 5.2, color: boss.color,
                behavior: "WAVE", waveAmp: 105, waveFreq: 5.5,
              });
            }
          } else {
            const spread = isEnraged ? [-0.2, -0.1, 0, 0.1, 0.2] : [-0.12, 0, 0.12];
            for (const off of spread) {
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 28,
                vx: Math.cos(aimAngle + off) * baseSpeed * 1.4,
                vy: Math.sin(aimAngle + off) * baseSpeed * 1.4,
                radius: 3.8, color: "#a7f3d0",
              });
            }
          }
          boss.attackCooldown = isEnraged ? 0.72 : 1.05;
          break;
        }

        case 7: {
          // ST.07 OUROBOROS: 時空トラップ弾（減速→急加速）+ 自機狙い
          if (boss.attackPhase !== 2) {
            const spread = isEnraged ? [-0.45, -0.22, 0, 0.22, 0.45] : [-0.3, 0, 0.3];
            for (const off of spread) {
              const vx = Math.cos(aimAngle + off) * baseSpeed * 0.95;
              const vy = Math.sin(aimAngle + off) * baseSpeed * 0.95;
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 24,
                vx, vy, baseVx: vx, baseVy: vy,
                radius: 4.8, color: boss.color, behavior: "TIME_TRAP",
              });
            }
          } else {
            for (let k = 0; k < 10; k++) {
              const ang = (Math.PI * 2 * k) / 10 + boss.age;
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 10,
                vx: Math.cos(ang) * baseSpeed * 0.95, vy: Math.sin(ang) * baseSpeed * 0.95,
                radius: 4.2, color: boss.color,
              });
            }
          }
          boss.attackCooldown = isEnraged ? 0.78 : 1.08;
          break;
        }

        case 8: {
          // ST.08 CRUCIBLE OMEGA: 極太主砲ビーム + 両舷ミサイル弾幕
          for (const ox of [-76, 76]) {
            this.enemyBullets.push({
              x: boss.x + ox, y: boss.y + 26,
              vx: 0, vy: baseSpeed * 0.9,
              radius: 5.5, color: boss.color,
              behavior: "CLUSTER", splitAfter: 0.65, splitCount: 4,
            });
          }
          if (isEnraged) {
            for (const off of [-0.18, 0, 0.18]) {
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 34,
                vx: Math.cos(aimAngle + off) * baseSpeed * 1.15,
                vy: Math.sin(aimAngle + off) * baseSpeed * 1.15,
                radius: 4.5, color: "#fda4af",
              });
            }
          }
          if (boss.attackPhase === 1 && (boss.beamWarningTimer ?? 0) <= 0 && (boss.beamActiveTimer ?? 0) <= 0) {
            boss.beamX = boss.x;
            boss.beamWidth = 48;
            boss.beamWarningTimer = isEnraged ? 0.85 : 1.1;
          }
          boss.attackCooldown = isEnraged ? 0.85 : 1.15;
          break;
        }

        case 9: {
          // ST.09 SINGULARITY ZERO: 電磁リング弾 + カーブ重力弾
          if (boss.attackPhase === 0) {
            const count = isEnraged ? 18 : 14;
            for (let k = 0; k < count; k++) {
              const ang = (Math.PI * 2 * k) / count;
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 10,
                vx: Math.cos(ang) * baseSpeed * 0.88, vy: Math.sin(ang) * baseSpeed * 0.88,
                radius: 4.4, color: boss.color,
              });
            }
          } else {
            for (const side of [-1, 1]) {
              for (const s of [0.25, 0.5]) {
                const ang = Math.PI / 2 + side * s;
                this.enemyBullets.push({
                  x: boss.x, y: boss.y + 20,
                  vx: Math.cos(ang) * baseSpeed, vy: Math.sin(ang) * baseSpeed,
                  radius: 4.6, color: "#c4b5fd",
                  behavior: "CURVE", curveRate: -side * (isEnraged ? 1.1 : 0.75),
                });
              }
            }
          }
          boss.attackCooldown = isEnraged ? 0.72 : 1.0;
          break;
        }

        case 10:
        default: {
          // ST.10 DEUS EX COSMOS: 3形態変化（金環調和 -> 外殻崩壊 -> 暴走星雲）
          if (hpRatio > 0.66) {
            // 第1形態（金環調和）: 規則的な交差カーテン + 自機狙い
            for (let k = -3; k <= 3; k++) {
              const ang = Math.PI / 2 + k * 0.22;
              this.enemyBullets.push({
                x: boss.x + k * 16, y: boss.y + 24,
                vx: Math.cos(ang) * baseSpeed * 0.92, vy: Math.sin(ang) * baseSpeed * 0.92,
                radius: 4.5, color: "#ffd700",
              });
            }
            boss.attackCooldown = 0.82;
          } else if (hpRatio > 0.33) {
            // 第2形態（外殻崩壊）: 2重逆回転スパイラル + 自機狙い
            boss.color = "#ff00aa";
            for (let k = 0; k < 4; k++) {
              const ang1 = boss.spiralAngle + (Math.PI * 2 * k) / 4;
              const ang2 = -boss.spiralAngle + (Math.PI * 2 * k) / 4;
              this.enemyBullets.push(
                { x: boss.x, y: boss.y + 12, vx: Math.cos(ang1) * baseSpeed, vy: Math.sin(ang1) * baseSpeed, radius: 4.2, color: "#ff00aa" },
                { x: boss.x, y: boss.y + 12, vx: Math.cos(ang2) * baseSpeed * 0.8, vy: Math.sin(ang2) * baseSpeed * 0.8, radius: 4.2, color: "#00f3ff" }
              );
            }
            boss.spiralAngle += 0.36;
            boss.attackCooldown = 0.28;
          } else {
            // 第3形態（暴走星雲）: 極彩全画面カーテン + カーブ星屑弾
            const rainbow = ["#ff0055", "#ffcc00", "#00ff88", "#00f3ff", "#b829ff"];
            const col = rainbow[Math.floor(boss.age * 6) % rainbow.length];
            boss.color = col;
            for (let k = 0; k < 6; k++) {
              const ang = boss.spiralAngle + (Math.PI * 2 * k) / 6;
              this.enemyBullets.push({
                x: boss.x, y: boss.y + 12,
                vx: Math.cos(ang) * baseSpeed * 0.96, vy: Math.sin(ang) * baseSpeed * 0.96,
                radius: 4.3, color: col,
                behavior: k % 2 === 0 ? "CURVE" : "NORMAL",
                curveRate: k % 2 === 0 ? 0.55 : undefined,
              });
            }
            boss.spiralAngle += 0.42;
            boss.attackCooldown = 0.24;
          }
          break;
        }
      }
    }

    // 4. 自機との接触判定（巨大なボス本体に突っ込んだ場合）
    if (
      this.player.invincibleTimer <= 0 &&
      Math.abs(this.player.x - boss.x) < boss.width * 0.42 &&
      Math.abs(this.player.y - boss.y) < boss.height * 0.42
    ) {
      this.damagePlayer(35);
    }

    // 5. 自機弾との命中判定
    for (let j = this.bullets.length - 1; j >= 0; j--) {
      const b = this.bullets[j];
      if (
        Math.abs(b.x - boss.x) < boss.width * 0.46 &&
        Math.abs(b.y - boss.y) < boss.height * 0.44
      ) {
        this.bullets.splice(j, 1);
        boss.hp -= b.damage;
        boss.hitFlashTimer = 0.05;
        this.spawnExplosion(b.x, b.y, b.kind === "MISSILE" ? "#ff7b00" : "#ffffff");

        this.callbacks.onBossChange({
          name: boss.name,
          hp: Math.max(0, boss.hp),
          maxHp: boss.maxHp,
        });

        if (boss.hp <= 0) {
          this.defeatBoss();
          break;
        }
      }
    }
  }

  /** ボス撃破演出 ＆ 次ステージ遷移準備 */
  private defeatBoss(): void {
    if (!this.boss) return;
    const { x, y } = this.boss;

    this.score += 10000;
    this.callbacks.onScoreChange(this.score);
    this.callbacks.onBossChange(null);

    // 敵弾をすべて消去してボーナス演出
    this.enemyBullets = [];
    this.shakeTimer = 0.45;
    this.sound.playBomb();

    // 複数箇所で連続大爆発パーティクル
    for (const [ox, oy] of [[0, 0], [-50, -15], [50, -15], [-30, 20], [30, 20]]) {
      this.spawnExplosion(x + ox, y + oy, "#ffb4ab");
      this.spawnExplosion(x + ox, y + oy, "#00f3ff");
    }

    // 撃破報酬としてシールド回復とボムをドロップ
    this.powerUps.push(
      { x: x - 28, y, vy: 65, radius: 11, type: "SHIELD", phase: 0 },
      { x: x + 28, y, vy: 65, radius: 11, type: "BOMB", phase: Math.PI }
    );

    this.boss = null;
    if (this.stage >= 10) {
      this.stageClearTimer = 2.5;
      this.sound.stopBgm();
      this.showBanner("ALL SECTORS LIBERATED!", 2.4);
    } else {
      this.stageClearTimer = 3.0;
      this.sound.playBgm("NORMAL");
      this.showBanner(`STAGE ${this.stage} CLEAR!`, 2.8);
    }
  }

  /**
   * 【ステージ別のスクロール距離（ボス出現までの時間）】
   * Stage 1 は 45秒、以降ステージごとに +5秒ずつ伸び、Stage 10 で最大 90秒になります。
   */
  private getBossSpawnTime(): number {
    return Math.min(90, 45 + (this.stage - 1) * 5);
  }

  /**
   * 【ステージ数 ＆ スクロール時間に応じた敵ウェーブ選出（編隊同時出現対応）】
   * - Stage 1 開始 5秒は SCOUT のみ、5秒以降は強い敵（INTERCEPTOR/SPREADER）が主軸
   * - ステージが上がるほど強い敵の比率が増え、1回のウェーブで2〜3機同時に編隊出現する確率が上昇！
   */
  private spawnWaveEnemy(): void {
    // 1. ステージに応じた同時出現数（編隊数）を決定
    let count = 1;
    const rollCount = Math.random();
    if (this.stage === 1) {
      if (this.stageScrollTime >= 15 && rollCount < 0.2) count = 2;
    } else if (this.stage === 2) {
      if (rollCount < 0.45) count = 2;
    } else {
      if (this.stage >= 4 && rollCount < 0.25) count = 3;
      else if (rollCount < 0.65) count = 2;
    }

    // 2. ステージに応じた敵タイプの比率を決定
    const pickKind = (): EnemyType => {
      if (this.stage === 1 && this.stageScrollTime < 5) return "SCOUT";

      const r = Math.random();
      const scoutRate = this.stage === 1 ? 0.35 : this.stage === 2 ? 0.25 : 0.15;
      const interceptorRate = this.stage === 1 ? 0.35 : this.stage === 2 ? 0.38 : 0.42;

      if (r < scoutRate) return "SCOUT";
      if (r < scoutRate + interceptorRate) return "INTERCEPTOR";
      return "SPREADER";
    };

    // 3. 編隊（1〜3機）が重ならないようにX座標をずらして生成
    const baseX = 36 + Math.random() * (LOGICAL_WIDTH - 72);
    for (let i = 0; i < count; i++) {
      const offsetX = (i - (count - 1) / 2) * 38;
      const clampedX = Math.max(24, Math.min(LOGICAL_WIDTH - 24, baseX + offsetX));
      this.spawnEnemyByType(pickKind(), clampedX);
    }
  }

  /** 指定タイプの敵機を企画書（game-design.md 5.5）のパラメータで生成 */
  private spawnEnemyByType(kind: EnemyType, customX?: number): void {
    const margin = kind === "GUNSHIP" ? 60 : 24;
    const x =
      customX !== undefined
        ? customX
        : kind === "GUNSHIP"
          ? LOGICAL_WIDTH / 2
          : margin + Math.random() * (LOGICAL_WIDTH - margin * 2);
    const stageBonus = this.stage - 1;

    if (kind === "INTERCEPTOR") {
      this.enemies.push({
        kind,
        x,
        y: HUD_HEIGHT - 20,
        vx: 0,
        vy: 85 + stageBonus * 8,
        radius: 10,
        hp: 1 + Math.floor(stageBonus / 3),
        shootCooldown: 99, // 弾は撃たない
        age: 0,
        charged: false,
        scoreValue: 1500,
      });
      return;
    }

    if (kind === "SPREADER") {
      this.enemies.push({
        kind,
        x,
        y: HUD_HEIGHT - 20,
        vx: (Math.random() < 0.5 ? -1 : 1) * (48 + stageBonus * 5),
        vy: 75,
        radius: 13,
        hp: 3 + Math.floor(stageBonus / 2),
        shootCooldown: 1.0,
        age: 0,
        charged: false,
        scoreValue: 1800,
      });
      return;
    }

    if (kind === "GUNSHIP") {
      this.enemies.push({
        kind,
        x,
        y: HUD_HEIGHT - 30,
        vx: 38 + stageBonus * 4,
        vy: 55,
        radius: 24,
        hp: 24 + stageBonus * 6, // テンポよく爽快に破壊できるよう適正化（約2〜3秒の集中射撃で撃破可能）
        shootCooldown: 1.2,
        age: 0,
        charged: false,
        scoreValue: 4000,
      });
      return;
    }

    // デフォルト: SCOUT（偵察ドローン）
    this.enemies.push({
      kind: "SCOUT",
      x,
      y: HUD_HEIGHT - 20,
      vx: (Math.random() - 0.5) * 40,
      vy: 95 + Math.random() * 55 + stageBonus * 10,
      radius: 11,
      hp: 2 + Math.floor(stageBonus / 2),
      shootCooldown: 0.7 + Math.random() * 0.8,
      age: 0,
      charged: false,
      scoreValue: 1200,
    });
  }

  /**
   * 【敵タイプ別の移動 ＆ 弾幕パターン制御】
   */
  private updateEnemyBehavior(e: Enemy, dt: number): void {
    const bulletMult = this.getDifficultyScale().bulletSpeed;

    if (e.kind === "INTERCEPTOR") {
      // 出現0.65秒後に自機方向をロックオンし、猛スピードで急降下突進！
      if (!e.charged && e.age >= 0.65) {
        e.charged = true;
        const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const dashSpeed = 245 + (this.stage - 1) * 12;
        e.vx = Math.cos(angle) * dashSpeed;
        e.vy = Math.sin(angle) * dashSpeed;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      return;
    }

    if (e.kind === "SPREADER") {
      // 画面上部（y=120付近）まで降りたらホバリングして左右往復し、3-way拡散弾を撃つ
      if (e.y < 120) {
        e.y += e.vy * dt;
      } else {
        e.x += e.vx * dt;
        if (e.x < 24 || e.x > LOGICAL_WIDTH - 24) e.vx *= -1;
      }

      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0 && e.y >= 95) {
        const baseAngle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
        const speed = 150 * bulletMult;
        for (const offset of [-0.28, 0, 0.28]) {
          this.enemyBullets.push({
            x: e.x,
            y: e.y + 8,
            vx: Math.cos(baseAngle + offset) * speed,
            vy: Math.sin(baseAngle + offset) * speed,
            radius: 4,
            color: "#c084fc", // バイオレット紫弾
          });
        }
        e.shootCooldown = 2.0 + Math.random() * 0.5;
      }
      return;
    }

    if (e.kind === "GUNSHIP") {
      // 画面上部（y=115付近）に陣取り左右パトロール、交差ガトリング＋自機狙いを交互に連射
      if (e.y < 115) {
        e.y += e.vy * dt;
      } else {
        e.x += e.vx * dt;
        if (e.x < 45 || e.x > LOGICAL_WIDTH - 45) e.vx *= -1;
      }

      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0 && e.y >= 100) {
        e.charged = !e.charged;
        const speed = 165 * bulletMult;
        if (e.charged) {
          // 左右砲台からの交差2連弾
          for (const ox of [-18, 18]) {
            this.enemyBullets.push({
              x: e.x + ox,
              y: e.y + 18,
              vx: ox > 0 ? -25 : 25,
              vy: speed,
              radius: 4.5,
              color: "#fb923c", // オレンジ弾
            });
          }
        } else {
          // 中央からの自機狙い 3-way
          const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
          for (const off of [-0.18, 0, 0.18]) {
            this.enemyBullets.push({
              x: e.x,
              y: e.y + 20,
              vx: Math.cos(angle + off) * speed,
              vy: Math.sin(angle + off) * speed,
              radius: 4.5,
              color: "#fb923c",
            });
          }
        }
        e.shootCooldown = 0.85;
      }
      return;
    }

    // SCOUT（偵察ドローン）：左右揺れ＋自機狙い単発弾
    e.x += e.vx * dt;
    e.y += e.vy * dt;
    if (e.x < 16 || e.x > LOGICAL_WIDTH - 16) e.vx *= -1;

    e.shootCooldown -= dt;
    if (e.shootCooldown <= 0 && e.y > HUD_HEIGHT + 10 && e.y < LOGICAL_HEIGHT * 0.65) {
      const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      const bulletSpeed = 165 * bulletMult;
      this.enemyBullets.push({
        x: e.x,
        y: e.y + 8,
        vx: Math.cos(angle) * bulletSpeed,
        vy: Math.sin(angle) * bulletSpeed,
        radius: 4,
        color: "#ff0055",
      });
      e.shootCooldown = 1.6 + Math.random() * 1.0;
    }
  }

  /**
   * 【敵機の撃破処理 ＆ アイテムドロップ判定】
   * 撃破時のスコア加算・爆発演出に加え、35%の確率でパワーアップカプセルを出現させます。
   */
  private destroyEnemy(index: number): void {
    const e = this.enemies[index];
    this.score += e.scoreValue;
    this.callbacks.onScoreChange(this.score);
    this.sound.playExplosion();
    this.spawnExplosion(e.x, e.y, e.kind === "GUNSHIP" ? "#fb923c" : "#ffb4ab");
    this.enemies.splice(index, 1);

    // 【HARD難易度専用：撃ち返し弾（Revenge Bullet）】
    // 敵を撃破した瞬間に自機へ向かって1発の反撃弾を放つ上級者向け仕様
    if (this.getDifficultyScale().revenge && e.y < LOGICAL_HEIGHT * 0.78) {
      const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
      const speed = 185;
      this.enemyBullets.push({
        x: e.x,
        y: e.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 3.5,
      });
    }

    // 中型ガンシップ撃破時は確定で2個のアイテム（回復/ボム ＋ 武器強化）をドロップ！
    if (e.kind === "GUNSHIP") {
      const supportPool: PowerUpType[] = ["SHIELD", "BOMB"];
      const weaponPool: PowerUpType[] = ["VULCAN", "MISSILE", "HOMING"];
      this.powerUps.push(
        {
          x: e.x - 16,
          y: e.y,
          vy: 70,
          radius: 11,
          type: supportPool[Math.floor(Math.random() * supportPool.length)],
          phase: 0,
        },
        {
          x: e.x + 16,
          y: e.y,
          vy: 70,
          radius: 11,
          type: weaponPool[Math.floor(Math.random() * weaponPool.length)],
          phase: Math.PI,
        }
      );
      return;
    }

    // 通常ザコのドロップ確率を敵の強さ別に差別化（SCOUT: 8% / INTERCEPTOR: 12% / SPREADER: 18%）
    const dropRate =
      e.kind === "SPREADER" ? 0.18 : e.kind === "INTERCEPTOR" ? 0.12 : 0.08;

    if (Math.random() < dropRate) {
      this.powerUps.push({
        x: e.x,
        y: e.y,
        vy: 75,
        radius: 11,
        type: this.pickWeightedPowerUp(),
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  /**
   * 【重み付きパワーアップ抽選】
   * - 武器強化系（V/M/H）が出やすく、貴重品（SHIELD/BOMB）は控えめに設定
   * - スピードが最大（Lv.3）に達している時は SPEED_UP を候補から除外
   */
  private pickWeightedPowerUp(): PowerUpType {
    const candidates: { type: PowerUpType; weight: number }[] = [
      { type: "VULCAN", weight: 22 },
      { type: "MISSILE", weight: 22 },
      { type: "HOMING", weight: 22 },
      { type: "SHIELD", weight: 12 },
      { type: "BOMB", weight: 10 },
    ];
    if (this.player.speedLevel < 3) {
      candidates.push({ type: "SPEED_UP", weight: 12 });
    }

    const total = candidates.reduce((sum, c) => sum + c.weight, 0);
    let r = Math.random() * total;
    for (const c of candidates) {
      r -= c.weight;
      if (r <= 0) return c.type;
    }
    return "VULCAN";
  }

  /**
   * 【パワーアップアイテム取得処理】
   * - SHIELD   : シールド HP を +35 回復（最大 maxHp）
   * - BOMB     : 緊急回避ボムを +1 補給（最大 5、満タンなら +500 ボーナス）
   * - SPEED_UP : キーボード移動速度を 1 段階上昇（最大 Lv.3、満タンなら +500 ボーナス）
   * - 同じ武器  : 武器レベルを +1（最大 Lv.5、満タンなら +500 ボーナス）
   * - 別の武器  : 武器タイプを切り替え（現在のレベルは引き継ぎ）
   */
  private collectPowerUp(type: PowerUpType): void {
    this.sound.playPowerUp();

    if (type === "SHIELD") {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 35);
      this.callbacks.onHpChange(this.player.hp, this.player.maxHp);
      this.spawnExplosion(this.player.x, this.player.y, "#34d399");
      return;
    }

    if (type === "BOMB") {
      if (this.player.bombs < 5) {
        this.player.bombs += 1;
        this.callbacks.onBombsChange(this.player.bombs);
      } else {
        this.score += 500;
        this.callbacks.onScoreChange(this.score);
      }
      this.spawnExplosion(this.player.x, this.player.y, "#facc15");
      return;
    }

    if (type === "SPEED_UP") {
      if (this.player.speedLevel < 3) {
        this.player.speedLevel += 1;
        const speedTable = [190, 260, 340];
        this.player.speed = speedTable[this.player.speedLevel - 1];
      } else {
        this.score += 500;
        this.callbacks.onScoreChange(this.score);
      }
      this.spawnExplosion(this.player.x, this.player.y, "#38bdf8");
      return;
    }

    if (this.player.weapon === type) {
      if (this.player.weaponLevel < 5) {
        this.player.weaponLevel += 1;
      } else {
        this.score += 500;
        this.callbacks.onScoreChange(this.score);
      }
    } else {
      this.player.weapon = type;
    }

    this.callbacks.onWeaponChange(this.player.weapon, this.player.weaponLevel);
    this.spawnExplosion(this.player.x, this.player.y, "#00f3ff");
  }

  /**
   * 【複合円（マルチサークル）の当たり判定ヘルパー】
   * 自機を構成する4つの円（機首・胴体・左翼・右翼）のうち、
   * 1つでも対象（敵弾や敵本体）と重なっていれば true（衝突）を返します。
   */
  private isCollidingWithPlayer(targetX: number, targetY: number, targetRadius: number): boolean {
    for (const part of this.player.hitboxes) {
      const partX = this.player.x + part.offsetX;
      const partY = this.player.y + part.offsetY;
      const dist = Math.hypot(targetX - partX, targetY - partY);
      if (dist < part.radius + targetRadius) {
        return true;
      }
    }
    return false;
  }

  /**
   * 【自機被弾・残機システム】
   * 
   * 1. 無敵時間（invincibleTimer）を設定し、連続ダメージを防止
   * 2. カメラシェイク（shakeTimer）で「当たった衝撃」を視覚的にフィードバック
   * 3. HP が 0 になったら残機を1つ減らし、大爆発アニメーションを再生した後、
   *    残機があれば下から再出撃、残機 0 なら爆発の余韻を見せてから GAMEOVER へ移行
   */
  private damagePlayer(amount: number): void {
    const scaledDamage = Math.round(amount * this.getDifficultyScale().damage);
    this.player.hp = Math.max(0, this.player.hp - scaledDamage);
    this.shakeTimer = 0.22; // 0.22秒間画面を揺らす
    this.spawnExplosion(this.player.x, this.player.y, "#ff0055");

    if (this.player.hp <= 0) {
      // 撃墜された！残機を1機失い、自機専用の大爆発アニメーションを発生させる
      this.player.lives -= 1;
      this.callbacks.onLivesChange(this.player.lives);
      this.spawnPlayerExplosion(this.player.x, this.player.y);

      if (this.player.lives <= 0) {
        // 全機喪失：すぐにGAMEOVER画面へ切り替えると爆発が見えないため、
        // 0.95秒間の大爆発・散華の余韻を見せてから GAMEOVER へ遷移させる
        this.player.hp = 0;
        this.player.invincibleTimer = 2.0; // 爆発中の二重判定を防止
        this.callbacks.onHpChange(0, this.player.maxHp);
        this.playerGameOverDelayTimer = 0.95;
        this.input.isPointerDown = false;
        return;
      }

      // まだ残機がある：0.45秒の爆発余韻（respawnDelayTimer）のあと、画面下から次の機体が再出撃（2.4秒無敵）
      this.player.hp = this.player.maxHp;
      this.player.x = LOGICAL_WIDTH / 2;
      this.player.y = LOGICAL_HEIGHT + 40;
      this.input.targetX = this.player.x;
      this.input.targetY = LOGICAL_HEIGHT - 120;
      this.respawnDelayTimer = 0.45;
      this.respawnTimer = 0.7;
      this.player.invincibleTimer = 2.85; // 待機0.45s + 登場0.7s + 復帰後約1.7sの安全確保
      this.showBanner(`UNIT LOST // REMAINING: ${this.player.lives}`, 1.8);
    } else {
      // まだHPが残っている ➔ 0.8秒の無敵時間（連続ヒット防止と緊張感の両立）
      this.player.invincibleTimer = 0.8;
      this.sound.playHit();
    }

    this.callbacks.onHpChange(this.player.hp, this.player.maxHp);
  }

  /**
   * 【自機撃墜専用・大爆発アニメーション生成】
   * 通常のザコ敵爆発（12粒）とは異なり、プレイヤーが「破壊された」ことを一目で認識できるよう
   * 48粒の多層パーティクル（火花＋装甲破片）、衝撃波リング、強いカメラシェイク、爆発音を同時に発動させます。
   */
  private spawnPlayerExplosion(x: number, y: number): void {
    this.playerDeathX = x;
    this.playerDeathY = y;
    this.playerDeathEffectTimer = 0.75; // 0.75秒間のショックウェーブ＆爆炎演出
    this.shakeTimer = 0.45;             // 強い画面揺れ
    this.sound.playPlayerExplosion();   // 自機撃墜専用の3層大爆発＆システムダウン音

    // 爆炎（白・黄・橙・赤）と自機装甲の破片（シアン）を混ぜたカラー配列
    const colors = ["#ffffff", "#facc15", "#ff7b00", "#ff0055", "#00f3ff"];
    for (let i = 0; i < 48; i++) {
      const angle = Math.random() * Math.PI * 2;
      // 速く飛び散る火花と、ゆっくり漂う大きめの破片を混在させる
      const isDebris = i % 4 === 0;
      const speed = isDebris ? 40 + Math.random() * 110 : 90 + Math.random() * 210;
      const maxLife = isDebris ? 0.85 : 0.6;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife * (0.65 + Math.random() * 0.35),
        maxLife,
        size: isDebris ? 4.5 + Math.random() * 4.5 : 2 + Math.random() * 3,
        color: colors[i % colors.length],
      });
    }
  }

  /** 爆発パーティクル（火花）の生成 */
  private spawnExplosion(x: number, y: number, color: string): void {
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 140;
      this.particles.push({
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

  // --------------------------------------------------------------------------
  // 5. 描画フェーズ（Render）
  // --------------------------------------------------------------------------

  /**
   * 【全体構成における位置づけ：画面描画フェーズ（Screen Render Phase）】
   * update() によるすべての物理計算が終わった後、Canvas 2D API を使って画面を1枚の絵として描き上げます。
   * 
   * 【初心者がつまずきやすいポイント：なぜ至る所で ctx.save() と ctx.restore() を呼ぶのか？】
   * ➔ 理由：Canvas の「コンテキスト（描画状態の副作用）」を安全にカプセル化（隔離）するためです。
   *    Canvas は「色（fillStyle）」「線の太さ（lineWidth）」「影（shadowBlur）」「原点の位置（translate）」「回転（rotate）」
   *    といった設定がグローバルな1つの状態として保持されます。
   *    もし `ctx.translate()` や `ctx.rotate()` をした後にそのまま次のオブジェクトを描画すると、
   *    後から描く星やボス、HPバーまで傾いて描画されてしまいます。
   *    - `ctx.save()`: 現在のすべての描画設定（原点位置や回転角、色など）を一時保存スタックに push する。
   *    - `ctx.restore()`: 直前の `ctx.save()` 時点の状態に pop して完全に戻す。
   *    このペアを必ず使うことで、各オブジェクト（弾や自機）の回転や発光が他の描画に悪影響を与えないようにしています。
   */
  private render(): void {
    this.ctx.save();

    // 【演出：カメラシェイク（画面揺れ）】
    // 被弾時に画面全体をランダムにわずかに揺らすことで、衝撃の「手触り」を演出
    if (this.shakeTimer > 0) {
      const intensity = 5 * (this.shakeTimer / 0.22);
      const shakeX = (Math.random() - 0.5) * intensity * 2;
      const shakeY = (Math.random() - 0.5) * intensity * 2;
      this.ctx.translate(shakeX, shakeY);
    }

    // 宇宙空間（深い闇紺色）で画面全体をクリア
    this.ctx.fillStyle = "#070913";
    this.ctx.fillRect(-10, -10, LOGICAL_WIDTH + 20, LOGICAL_HEIGHT + 20);

    // 星空の描画
    for (const s of this.stars) {
      this.ctx.fillStyle = `rgba(225, 225, 241, ${s.alpha})`;
      this.ctx.fillRect(s.x, s.y, s.size, s.size);
    }

    if (this.status !== "TITLE") {
      // 自機弾の描画（武器の種類ごとに色と向きを変えてネオン発光）
      for (const b of this.bullets) {
        this.ctx.save();
        this.ctx.translate(b.x, b.y);
        // 進行方向（vx, vy）に合わせて弾を回転させる（上向きが基準なので +PI/2）
        const angle = Math.atan2(b.vy, b.vx) + Math.PI / 2;
        this.ctx.rotate(angle);

        if (b.kind === "MISSILE") {
          this.ctx.fillStyle = "#ffedd5";
          this.ctx.shadowColor = "#ff7b00";
          this.ctx.shadowBlur = 10;
        } else if (b.kind === "HOMING") {
          this.ctx.fillStyle = "#fae8ff";
          this.ctx.shadowColor = "#e040fb";
          this.ctx.shadowBlur = 10;
        } else {
          this.ctx.fillStyle = "#e3fdff";
          this.ctx.shadowColor = "#00f3ff";
          this.ctx.shadowBlur = 8;
        }
        this.ctx.fillRect(-b.width / 2, -b.height / 2, b.width, b.height);
        this.ctx.restore();
      }

      // パワーアップアイテムの描画（ネオンカプセル ＋ 種類ラベル）
      for (const item of this.powerUps) {
        this.ctx.save();
        this.ctx.translate(item.x, item.y);
        const color =
          item.type === "VULCAN"
            ? "#00f3ff"
            : item.type === "MISSILE"
              ? "#ff7b00"
              : item.type === "HOMING"
                ? "#e040fb"
                : item.type === "BOMB"
                  ? "#facc15"
                  : item.type === "SPEED_UP"
                    ? "#38bdf8"
                    : "#34d399";
        const label =
          item.type === "VULCAN"
            ? "V"
            : item.type === "MISSILE"
              ? "M"
              : item.type === "HOMING"
                ? "H"
                : item.type === "BOMB"
                  ? "B"
                  : item.type === "SPEED_UP"
                    ? "S"
                    : "+";

        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 10;
        this.ctx.fillStyle = "rgba(7, 9, 19, 0.85)";
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 1.8;

        this.ctx.beginPath();
        this.ctx.roundRect(-10, -10, 20, 20, 4);
        this.ctx.fill();
        this.ctx.stroke();

        this.ctx.fillStyle = color;
        this.ctx.font = "bold 12px monospace";
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(label, 0, 1);
        this.ctx.restore();
      }

      // 敵機の描画（4タイプごとのベクターアート描き分け）
      for (const e of this.enemies) {
        this.drawEnemy(e);
      }

      // ボス艦の描画
      if (this.boss) {
        this.drawBoss(this.boss);
      }

      // 敵弾の描画（敵タイプ別のネオン色 ＋ 中心ホワイトコア）
      for (const eb of this.enemyBullets) {
        const bulletColor = eb.color ?? "#ff0055";
        this.ctx.save();
        this.ctx.shadowColor = bulletColor;
        this.ctx.shadowBlur = 8;
        this.ctx.fillStyle = bulletColor;
        this.ctx.beginPath();
        this.ctx.arc(eb.x, eb.y, eb.radius + 1, 0, Math.PI * 2);
        this.ctx.fill();

        // 中心の白い芯（弾幕の軌道を見分けやすくするSTGの定番表現）
        this.ctx.fillStyle = "#ffffff";
        this.ctx.beginPath();
        this.ctx.arc(eb.x, eb.y, eb.radius * 0.5, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }

      // パーティクルの描画（徐々に透明化）
      for (const p of this.particles) {
        this.ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        this.ctx.fillStyle = p.color;
        this.ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      this.ctx.globalAlpha = 1;

      // 自機の描画（ゲームオーバー時・撃墜爆発中の待機時間中は非表示）
      if (
        this.status !== "GAMEOVER" &&
        this.playerGameOverDelayTimer <= 0 &&
        this.respawnDelayTimer <= 0
      ) {
        this.drawPlayer();
      }

      // 【自機撃墜・大爆発ショックウェーブ＆爆炎コア演出】
      // progress は 0.0（爆発の瞬間）〜 1.0（消滅）へ進む正規化された時間割合
      if (this.playerDeathEffectTimer > 0) {
        const progress = 1 - this.playerDeathEffectTimer / 0.75;
        const alpha = Math.max(0, 1 - progress);

        this.ctx.save();

        // 1. 撃墜直後の画面フラッシュ（赤〜オレンジの危険閃光）
        if (progress < 0.45) {
          const flashAlpha = (1 - progress / 0.45) * 0.35;
          this.ctx.fillStyle = `rgba(255, 30, 80, ${flashAlpha})`;
          this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        }

        // 2. 爆発中心の火球コア（膨張しながら白熱 ➔ オレンジへフェード）
        this.ctx.shadowColor = "#ff7b00";
        this.ctx.shadowBlur = 24 * alpha;
        this.ctx.fillStyle = `rgba(255, 160, 40, ${alpha * 0.75})`;
        this.ctx.beginPath();
        this.ctx.arc(this.playerDeathX, this.playerDeathY, 10 + progress * 46, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
        this.ctx.beginPath();
        this.ctx.arc(this.playerDeathX, this.playerDeathY, (1 - progress * 0.6) * 18, 0, Math.PI * 2);
        this.ctx.fill();

        // 3. 外側へ広がる二重の衝撃波リング（赤橙の外輪 ＋ 白シアンの内輪）
        this.ctx.strokeStyle = `rgba(255, 50, 90, ${alpha})`;
        this.ctx.lineWidth = 5 * alpha + 1;
        this.ctx.beginPath();
        this.ctx.arc(this.playerDeathX, this.playerDeathY, progress * 155, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = `rgba(200, 250, 255, ${alpha * 0.9})`;
        this.ctx.lineWidth = 3 * alpha + 0.5;
        this.ctx.beginPath();
        this.ctx.arc(this.playerDeathX, this.playerDeathY, progress * 95, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.restore();
      }

      // 【ボム衝撃波＆画面フラッシュ演出】
      if (this.bombEffectTimer > 0) {
        const progress = 1 - this.bombEffectTimer / 0.65;
        const alpha = 1 - progress;

        // 画面全体の閃光（フラッシュ）
        this.ctx.save();
        this.ctx.fillStyle = `rgba(0, 243, 255, ${alpha * 0.25})`;
        this.ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

        // 自機中心から広がる衝撃波リング
        this.ctx.strokeStyle = `rgba(227, 253, 255, ${alpha})`;
        this.ctx.lineWidth = 4 * alpha + 1;
        this.ctx.shadowColor = "#00f3ff";
        this.ctx.shadowBlur = 16;
        this.ctx.beginPath();
        this.ctx.arc(this.bombOriginX, this.bombOriginY, progress * 460, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      }
    }

    this.ctx.restore();
  }

  /** 自機（VF-01 VALKYRIE）のベクター描画 */
  private drawPlayer(): void {
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);

    // 無敵時間中は点滅（半透明）にして「今は無敵であること」をプレイヤーに伝える
    if (this.player.invincibleTimer > 0 && Math.floor(this.player.invincibleTimer * 16) % 2 === 0) {
      this.ctx.globalAlpha = 0.3;
    }

    // 1. スラスター噴射炎（サイン波で小刻みに伸び縮み）
    const flameLen = 10 + Math.sin(this.player.thrusterPhase) * 4;
    this.ctx.fillStyle = "rgba(0, 243, 255, 0.7)";
    this.ctx.beginPath();
    this.ctx.moveTo(-4, 16);
    this.ctx.lineTo(0, 16 + flameLen);
    this.ctx.lineTo(4, 16);
    this.ctx.closePath();
    this.ctx.fill();

    // 2. 主翼（左右の後退翼）
    this.ctx.fillStyle = "rgba(0, 243, 255, 0.16)";
    this.ctx.strokeStyle = "#00f3ff";
    this.ctx.lineWidth = 1.6;

    // 左翼
    this.ctx.beginPath();
    this.ctx.moveTo(-5, 0);
    this.ctx.lineTo(-19, 10);
    this.ctx.lineTo(-19, 15);
    this.ctx.lineTo(-5, 11);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // 右翼
    this.ctx.beginPath();
    this.ctx.moveTo(5, 0);
    this.ctx.lineTo(19, 10);
    this.ctx.lineTo(19, 15);
    this.ctx.lineTo(5, 11);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // 3. 胴体（デルタノーズ）
    this.ctx.fillStyle = "rgba(0, 243, 255, 0.25)";
    this.ctx.beginPath();
    this.ctx.moveTo(0, -22);
    this.ctx.lineTo(5, -6);
    this.ctx.lineTo(6, 15);
    this.ctx.lineTo(-6, 15);
    this.ctx.lineTo(-5, -6);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    // 4. 前方キャノン砲身
    this.ctx.beginPath();
    this.ctx.moveTo(-7, -6);
    this.ctx.lineTo(-7, -18);
    this.ctx.moveTo(7, -6);
    this.ctx.lineTo(7, -18);
    this.ctx.stroke();

    // 5. 機体中央のコックピットコア（自機の位置を直感的に視認する目印）
    this.ctx.fillStyle = "#ffffff";
    this.ctx.shadowColor = "#00f3ff";
    this.ctx.shadowBlur = 8;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  /** 大型戦艦ボス（ST.01〜ST.10）のベクターアート ＆ ギミック描画 */
  /** ボス機体とステージ固有ギミック（ビーム予告・照射、ワープ先枠、重力リング、回転オーブ）を描画する */
  private drawBoss(boss: Boss): void {
    // 0. 画面空間でのギミック予告・ビーム・重力リング描画（ボス本体の背面レイヤー）
    if ((boss.beamWarningTimer ?? 0) > 0 && boss.beamX !== undefined) {
      // ビーム照射前の警告レーン（半透明の赤帯＋左右の破線ガイド）
      const bw = boss.beamWidth ?? 36;
      this.ctx.save();
      this.ctx.fillStyle = "rgba(255, 42, 109, 0.16)";
      this.ctx.fillRect(boss.beamX - bw / 2, boss.y, bw, LOGICAL_HEIGHT - boss.y);
      this.ctx.strokeStyle = "#ff2a6d";
      this.ctx.setLineDash([6, 6]);
      this.ctx.beginPath();
      this.ctx.moveTo(boss.beamX - bw / 2, boss.y);
      this.ctx.lineTo(boss.beamX - bw / 2, LOGICAL_HEIGHT);
      this.ctx.moveTo(boss.beamX + bw / 2, boss.y);
      this.ctx.lineTo(boss.beamX + bw / 2, LOGICAL_HEIGHT);
      this.ctx.stroke();
      this.ctx.restore();
    } else if ((boss.beamActiveTimer ?? 0) > 0 && boss.beamX !== undefined) {
      // ビーム照射中（外周の発光体＋中心の高輝度ホワイトコア）
      const bw = boss.beamWidth ?? 36;
      this.ctx.save();
      this.ctx.shadowColor = boss.color;
      this.ctx.shadowBlur = 18;
      this.ctx.fillStyle = boss.color;
      this.ctx.fillRect(boss.beamX - bw / 2, boss.y, bw, LOGICAL_HEIGHT - boss.y);
      this.ctx.fillStyle = "#ffffff";
      this.ctx.fillRect(boss.beamX - bw * 0.25, boss.y, bw * 0.5, LOGICAL_HEIGHT - boss.y);
      this.ctx.restore();
    }

    if ((boss.warpWarningTimer ?? 0) > 0 && boss.warpTargetX !== undefined) {
      // ST.07 ワープ先の出現予告ボックス
      this.ctx.save();
      this.ctx.strokeStyle = "#00ffff";
      this.ctx.setLineDash([4, 4]);
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(boss.warpTargetX - 40, boss.y - 24, 80, 48);
      this.ctx.restore();
    }

    if (boss.stage === 9) {
      // ST.09 ブラックホール重力場を示す収縮/拡散リングエフェクト
      this.ctx.save();
      this.ctx.strokeStyle = "rgba(139, 92, 246, 0.35)";
      this.ctx.lineWidth = 1.5;
      const r = 40 + ((boss.age * 45) % 90);
      this.ctx.beginPath();
      this.ctx.arc(LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.42, r, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
    }

    this.ctx.save();
    this.ctx.translate(boss.x, boss.y);

    const isFlash = boss.hitFlashTimer > 0;
    const isEnraged = boss.hp <= boss.maxHp * 0.5;
    const stroke = isFlash ? "#ffffff" : boss.color;
    const fill = isFlash ? "rgba(255, 255, 255, 0.45)" : "rgba(255, 255, 255, 0.08)";

    this.ctx.strokeStyle = stroke;
    this.ctx.fillStyle = fill;
    this.ctx.lineWidth = 2;
    this.ctx.shadowColor = stroke;
    this.ctx.shadowBlur = isEnraged ? 14 : 8;

    // 1〜3. ステージ番号（1〜10）に応じた Stitch 準拠の固有ボスシルエットを描画
    // ※ ST.01〜ST.10 ごとに異なる形状・コア・可動ギミックを描き分ける専用ヘルパーを呼び出します
    this.drawBossHullByStage(boss, isFlash, isEnraged, fill);

    // 4. ST.04 回転防御オーブ描画
    if (boss.stage === 4) {
      const count = 4;
      for (let k = 0; k < count; k++) {
        const ang = (boss.shieldAngle ?? 0) + (Math.PI * 2 * k) / count;
        const ox = Math.cos(ang) * 58;
        const oy = Math.sin(ang) * 32;
        this.ctx.fillStyle = "#00d4ff";
        this.ctx.beginPath();
        this.ctx.arc(ox, oy, 6, 0, Math.PI * 2);
        this.ctx.fill();
      }
    }

    this.ctx.restore();
  }

  /**
   * ステージ 1〜10（ST.01〜ST.10）のボス機体シルエットを Stitch デザインに忠実に描き分けるヘルパーメソッド。
   *
   * 【この処理の位置づけ】
   * `drawBoss()` の中で `this.ctx.translate(boss.x, boss.y)` によってボスの中心を (0, 0) に移動した状態で呼ばれます。
   * そのため、この関数内ではすべて「ボスの中心からの相対座標（例: 左はマイナス、上はマイナス）」で形を描きます。
   *
   * 【スケーリングの仕組み】
   * 各ボスの基準デザインは横幅 180px × 高さ 96px 前後で設計しています。
   * `ctx.scale(scaleX, scaleY)` をかけることで、ゲーム内の当たり判定サイズ（`boss.width` / `boss.height`）に
   * ぴったりの大きさへ自動的に拡大・縮小して表示できます。
   */
  private drawBossHullByStage(
    boss: Boss,
    isFlash: boolean,
    isEnraged: boolean,
    fill: string
  ): void {
    const ctx = this.ctx;
    // コアの色: 被弾フラッシュ時は白、HP半分以下の発狂時はボス固有色、通常時は高輝度コア色
    const coreColor = isFlash ? "#ffffff" : isEnraged ? boss.color : "#ffb4ab";
    // 基準サイズ（180x96）に対する拡大率を計算し、当たり判定サイズにフィットさせる
    const scaleX = boss.width / 180;
    const scaleY = boss.height / 96;

    ctx.save();
    ctx.scale(scaleX, scaleY);

    switch (boss.stage) {
      case 1: {
        // ST.01: A-01 GOLIATH（軌道監視大型ドローン）
        // 横長の中央装甲ブロック ＋ 左右に張り出した三角ウイングポッド ＋ 2連装バルカン砲身
        ctx.beginPath();
        ctx.roundRect(-80, -20, 160, 40, 4);
        ctx.fill();
        ctx.stroke();

        // 左右の大型ウイングポッド（三角形の砲台ベース）
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(dir * 52, 0);
          ctx.lineTo(dir * 92, 26);
          ctx.lineTo(dir * 28, 26);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // 前面（下向き）のバルカン砲身
          ctx.beginPath();
          ctx.rect(dir * 46 - 3, 22, 6, 16);
          ctx.fill();
          ctx.stroke();
        }

        // 中央エネルギーコア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 2: {
        // ST.02: CRIMSON MANTA: X-2（高機動・双胴ステルス戦闘機）
        // エイ（マンタ）のように大きく左右へ広がる前進翼シルエット
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.lineTo(90, 22);
        ctx.lineTo(58, 42);
        ctx.lineTo(0, 14);
        ctx.lineTo(-58, 42);
        ctx.lineTo(-90, 22);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 左右ウイングのエンジンインテーク＆スリット線
        ctx.beginPath();
        ctx.moveTo(-42, -6);
        ctx.lineTo(-68, 24);
        ctx.moveTo(42, -6);
        ctx.lineTo(68, 24);
        ctx.stroke();

        // 中央コア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 3: {
        // ST.03: SUB-SPACE CENTIPEDE（連結多節・地中掘削型重機）
        // 5つの装甲節が時間経過（boss.age）に合わせてサイン波でくねくねと蛇行する
        const segments = 5;
        for (let i = segments - 1; i >= 0; i--) {
          // 後ろの節ほど少し小さく、位相をずらして左右にうねらせる
          const t = i / (segments - 1);
          const sy = -36 + i * 16;
          const sx = Math.sin(boss.age * 5 + i * 0.9) * (10 + i * 2);
          const rx = 34 - t * 10;
          const ry = 13;

          ctx.fillStyle = fill;
          ctx.beginPath();
          ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // 重機らしいハザードストライプ（警告斜線）ディテール
          ctx.beginPath();
          ctx.moveTo(sx - rx * 0.5, sy - 4);
          ctx.lineTo(sx - rx * 0.25, sy + 4);
          ctx.moveTo(sx + rx * 0.25, sy - 4);
          ctx.lineTo(sx + rx * 0.5, sy + 4);
          ctx.stroke();
        }

        // 先頭（一番下側・自機側）の採掘レーザー大顎（マンディブル）
        const headX = Math.sin(boss.age * 5 + (segments - 1) * 0.9) * 18;
        const headY = -36 + (segments - 1) * 16;
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(headX + dir * 16, headY + 6);
          ctx.lineTo(headX + dir * 28, headY + 26);
          ctx.lineTo(headX + dir * 8, headY + 14);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // 頭部の掘削レーザーコア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(headX, headY, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 4: {
        // ST.04: IRON AEGIS（全方位防壁システム）
        // 重厚な角丸スクエア要塞シャーシ ＋ 左右の太いスタビライザー ＋ 露出大型コア
        // （※周囲を回る4つの防御オーブは呼び出し元の drawBoss() 側で描画されます）
        ctx.beginPath();
        ctx.roundRect(-38, -38, 76, 76, 8);
        ctx.fill();
        ctx.stroke();

        // 左右に張り出した重装甲スタビライザーバー
        for (const dir of [-1, 1]) {
          ctx.beginPath();
          ctx.rect(dir === -1 ? -80 : 38, -7, 42, 14);
          ctx.fill();
          ctx.stroke();
        }

        // 中央の大型エネルギーコア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 5: {
        // ST.05: SOLAR FLARE: HELIOS（恒星エネルギー集束体）
        // 太陽リング外殻 ＋ 上下左右4方位へ鋭く突き出す放熱フィン
        ctx.beginPath();
        ctx.arc(0, 0, 34, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // 上・下・左・右の4方位に伸びるスパイク状の放熱フィン
        const spikes: Array<[number, number, number, number, number, number]> = [
          [0, -64, -10, -34, 10, -34], // 上
          [0, 64, -10, 34, 10, 34],   // 下
          [-84, 0, -34, -10, -34, 10], // 左
          [84, 0, 34, -10, 34, 10],    // 右
        ];
        for (const [tx, ty, bx1, by1, bx2, by2] of spikes) {
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(bx1, by1);
          ctx.lineTo(bx2, by2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }

        // 中心の灼熱ソーラーコア（わずかに脈動）
        const pulse = 15 + Math.sin(boss.age * 8) * 2;
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 6: {
        // ST.06: VOID LEVIATHAN: ABYSS（亜空間生体機械）
        // 有機的なアーモンド／三日月型の生体甲殻 ＋ 左右から波打つ6本の生体触手
        ctx.beginPath();
        ctx.moveTo(-52, 12);
        ctx.quadraticCurveTo(0, -54, 52, 12);
        ctx.quadraticCurveTo(0, 44, -52, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 左右各3本（合計6本）の生体触手ポッド（サイン波でゆらゆら動く）
        for (const dir of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            const baseY = -12 + i * 14;
            const wave = Math.sin(boss.age * 4 + i * 1.3) * 8;
            ctx.beginPath();
            ctx.moveTo(dir * 42, baseY);
            ctx.quadraticCurveTo(dir * 68, baseY + wave * 0.5, dir * 88, baseY + 10 + wave);
            ctx.stroke();

            // 触手先端の発光ノード
            ctx.fillStyle = isFlash ? "#ffffff" : "#00ff88";
            ctx.beginPath();
            ctx.arc(dir * 88, baseY + 10 + wave, 3, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // 中央の生体核（脈動）
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 2, 15 + Math.sin(boss.age * 6) * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 7: {
        // ST.07: CHRONO PHANTOM: OUROBOROS（時空干渉型・高速ワープ機）
        // ホログラフィック残像（本体より少し左右にズラした半透明の破線シルエット）
        const ghostShift = Math.sin(boss.age * 10) * 8;
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ghostShift, -46);
        ctx.lineTo(ghostShift + 66, 0);
        ctx.lineTo(ghostShift + 34, 46);
        ctx.lineTo(ghostShift - 34, 46);
        ctx.lineTo(ghostShift - 66, 0);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();

        // 本体: 鋭角ステルス五角形フレーム
        ctx.beginPath();
        ctx.moveTo(0, -46);
        ctx.lineTo(66, 0);
        ctx.lineTo(34, 46);
        ctx.lineTo(-34, 46);
        ctx.lineTo(-66, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 中央の位相分割破線（縦のセンターライン）
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(0, -46);
        ctx.lineTo(0, 46);
        ctx.stroke();
        ctx.restore();

        // 時空コア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 4, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 8: {
        // ST.08: DREADNOUGHT OMEGA: FORTRESS CRUCIBLE（超弩級・機動要塞）
        // 多層構造の巨大矩形ドレッドノート主装甲 ＋ 極太の波動砲バレル
        ctx.beginPath();
        ctx.rect(-96, -34, 192, 58);
        ctx.fill();
        ctx.stroke();

        // 内側の波動砲エネルギーチャンバー
        ctx.beginPath();
        ctx.rect(-60, -14, 120, 22);
        ctx.fill();
        ctx.stroke();

        // 下向きに突き出す極太の波動砲メインバレル
        ctx.beginPath();
        ctx.rect(-11, -6, 22, 56);
        ctx.fill();
        ctx.stroke();

        // 砲口先端の発光リング
        ctx.beginPath();
        ctx.rect(-16, 44, 32, 6);
        ctx.fill();
        ctx.stroke();

        // 艦橋コア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, -3, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        break;
      }

      case 9: {
        // ST.09: SINGULARITY CORE: ZERO（人工ブラックホール発生装置）
        // 傾いて回転する楕円形の磁気降着リング（奥側と手前側）
        ctx.save();
        ctx.rotate(0.22 + Math.sin(boss.age * 1.5) * 0.08);
        ctx.beginPath();
        ctx.ellipse(0, 0, 86, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 逆向きに傾いた補助磁場リング（破線）
        ctx.save();
        ctx.rotate(-0.22);
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.ellipse(0, 0, 74, 18, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 中心の漆黒ブラックホール球体（濃い宇宙色で塗りつぶし、外周を強く発光させる）
        ctx.fillStyle = isFlash ? "rgba(255,255,255,0.8)" : "#0b0e18";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 28, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.lineWidth = 2;

        // 特異点の脈動コア
        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + Math.sin(boss.age * 9) * 2, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 10:
      default: {
        // ST.10: DEUS EX COSMOS: APOCALYPSE EYE（最終決戦・中枢AIコア）
        // 1) 外周をゆっくり回転する神聖幾何学ハロー（破線リング）
        ctx.save();
        ctx.rotate(boss.age * 0.6);
        ctx.setLineDash([8, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, 48, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // 2) 7頂点の超次元フラクタル翼ポリゴン
        ctx.beginPath();
        ctx.moveTo(0, -48);
        ctx.lineTo(74, -14);
        ctx.lineTo(88, 28);
        ctx.lineTo(42, 44);
        ctx.lineTo(-42, 44);
        ctx.lineTo(-88, 28);
        ctx.lineTo(-74, -14);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // 3) 内側の虚無リング（深い紫）＋ 真紅に脈動する黙示録の瞳
        ctx.fillStyle = isFlash ? "#ffffff" : "#6f00be";
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = coreColor;
        ctx.beginPath();
        ctx.arc(0, 0, 8 + Math.sin(boss.age * 10) * 2, 0, Math.PI * 2);
        ctx.fill();

        // 4) 周囲を公転する6つの調和エネルギーノード
        for (let k = 0; k < 6; k++) {
          const ang = boss.age * 1.4 + (Math.PI * 2 * k) / 6;
          const nx = Math.cos(ang) * 56;
          const ny = Math.sin(ang) * 36;
          ctx.fillStyle = isFlash ? "#ffffff" : "#00f3ff";
          ctx.beginPath();
          ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
    }

    ctx.restore();
  }

  /** 4タイプの通常敵（SCOUT / INTERCEPTOR / SPREADER / GUNSHIP）の描き分け */
  private drawEnemy(e: Enemy): void {
    this.ctx.save();
    this.ctx.translate(e.x, e.y);

    if (e.kind === "INTERCEPTOR") {
      // 警告イエローの細長い高速デルタ機
      this.ctx.strokeStyle = "#fde047";
      this.ctx.fillStyle = "rgba(250, 204, 21, 0.22)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 14);
      this.ctx.lineTo(7, -10);
      this.ctx.lineTo(0, -5);
      this.ctx.lineTo(-7, -10);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.restore();
      return;
    }

    if (e.kind === "SPREADER") {
      // バイオレット紫のワイド菱形（3-way拡散機）
      this.ctx.strokeStyle = "#c084fc";
      this.ctx.fillStyle = "rgba(192, 132, 252, 0.2)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 11);
      this.ctx.lineTo(15, 0);
      this.ctx.lineTo(6, -11);
      this.ctx.lineTo(-6, -11);
      this.ctx.lineTo(-15, 0);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = "#e879f9";
      this.ctx.beginPath();
      this.ctx.arc(0, 0, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    if (e.kind === "GUNSHIP") {
      // ダークオレンジの重装甲中型ガンシップ（大型六角形）
      this.ctx.strokeStyle = "#fb923c";
      this.ctx.fillStyle = "rgba(251, 146, 60, 0.22)";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.moveTo(0, 22);
      this.ctx.lineTo(25, 8);
      this.ctx.lineTo(22, -16);
      this.ctx.lineTo(8, -22);
      this.ctx.lineTo(-8, -22);
      this.ctx.lineTo(-22, -16);
      this.ctx.lineTo(-25, 8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.stroke();
      this.ctx.fillStyle = "#fdba74";
      this.ctx.beginPath();
      this.ctx.arc(0, 2, 6, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
      return;
    }

    // SCOUT（クリムゾン赤の小型V字ドローン）
    this.ctx.strokeStyle = "#ffb4ab";
    this.ctx.fillStyle = "rgba(255, 0, 85, 0.2)";
    this.ctx.lineWidth = 1.5;
    this.ctx.beginPath();
    this.ctx.moveTo(0, 12);
    this.ctx.lineTo(10, -4);
    this.ctx.lineTo(4, -10);
    this.ctx.lineTo(-4, -10);
    this.ctx.lineTo(-10, -4);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "#ff0055";
    this.ctx.beginPath();
    this.ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }
}
