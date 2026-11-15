/**
 * ============================================================================
 * VOID VANGUARD - 型定義 ＆ ゲーム基本定数 (types.ts)
 * ============================================================================
 * 
 * 【全体構成におけるこのファイルの位置づけ】
 * 本ファイルは、React（UI表示層）と GameEngine（60fpsゲームエンジン層）の間で共有される
 * 「データ構造の設計図（共通プロトコル / 契約書）」です。
 * 
 * 【プログラミング初心者が型定義ファイルを読むメリット】
 * 1. システムの全体像が一目でわかる：
 *    「ゲームにはどんな敵がいるのか？」「自機はどんな能力パラメータを持っているのか？」
 *    「ゲーム進行にはどんな状態（TITLE, BRIEFING, PLAYING, etc.）があるのか？」がコードを読む前に俯瞰できます。
 * 2. バグの撲滅（タイプセーフ）：
 *    「存在しないプロパティ名をタイプミスした」「本来 number のはずの HP に string を渡してしまった」といった
 *    初心者が何時間もハマりがちなバグを、プログラムを実行する前にエディタ（VSCode等）や TypeScript コンパイラが
 *    赤波線で瞬時に教えてくれます。
 * ============================================================================
 */

// ----------------------------------------------------------------------------
// 1. 画面設計・座標系の基本定数（docs/04_screen-and-character-sizing.md 準拠）
// ----------------------------------------------------------------------------

/** ゲームタイトル正式名称 */
export const GAME_TITLE = "VALKYRIE RECLAIM";

/**
 * 【仮想基準解像度 (Logical Resolution)】
 * スマホは機種ごとに物理解像度（ピクセル数）がバラバラです。
 * ゲーム内部では「横360 × 縦640（比率 9:16）」という固定の仮想世界を作り、
 * Canvas 側で画面に合わせて拡大・縮小させることで、どのスマホでも同じゲーム体験を保証します。
 */
export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;

/**
 * 【画面上部 HUD エリアの高さ】
 * スコアやHPバーを表示する領域。自機がここに入り込んで文字を隠さないよう、
 * 自機の移動範囲の上限（Y座標の最小値）としても利用します。
 */
export const HUD_HEIGHT = 50;

/**
 * 【タッチオフセット（指隠れ防止機能）】
 * スマホSTG特有の最重要パラメータ！
 * 指の真下に自機を置くと、自分の指で自機や敵の弾が隠れて死んでしまいます。
 * そのため、「タッチしている指の位置より 50px 上」に自機を浮かせて追従させます。
 */
export const TOUCH_OFFSET_Y = 50;

// ----------------------------------------------------------------------------
// 2. ゲーム進行状態（ステートマシン）の型
// ----------------------------------------------------------------------------
/**
 * ゲームの現在のフェーズを表す型：
 * - TITLE    : タイトル画面（出撃待ち、AudioContext 未解除）
 * - BRIEFING : 出撃前ブリーフィング演出（プロローグ通信）
 * - PLAYING  : 戦闘中（毎フレームの移動・弾幕・当たり判定を更新）
 * - PAUSED   : 一時停止中（画面更新は止め、メニューを表示）
 * - GAMEOVER : 全滅時（リザルト画面へ）
 * - EPILOGUE : 全10ステージクリア時（凱旋エンディング演出）
 */
export type GameStatus = "TITLE" | "BRIEFING" | "PLAYING" | "PAUSED" | "GAMEOVER" | "EPILOGUE";

/** 難易度設定（Easy / Normal / Hard） */
export type Difficulty = "EASY" | "NORMAL" | "HARD";

// ----------------------------------------------------------------------------
// 3. 各オブジェクトのデータ構造（インターフェース）
// ----------------------------------------------------------------------------

/** パララックス（視差効果）星空背景の1粒のデータ */
export interface Star {
  x: number;
  y: number;
  size: number;   // 遠い星は小さく(1px)、手前の星は大きく(2px)
  speed: number;  // 遠い星は遅く、手前の星は速く流すことで立体感を出す
  alpha: number;  // 透明度（0.0 〜 1.0）
}

/**
 * 【複合円当たり判定（マルチサークル・ヒットボックス）】
 * 1つの大きな円で機体を囲むと「機体の斜め前の何もない空間」でも被弾してしまいます。
 * 機首・胴体・左右の翼など、パーツごとに小さな円を複数配置することで、
 * 計算が軽いまま機体のシルエットに忠実な当たり判定を実現します。
 */
export interface HitboxCircle {
  offsetX: number; // 自機の中心 (player.x) からの横方向のズレ
  offsetY: number; // 自機の中心 (player.y) からの縦方向のズレ
  radius: number;  // このパーツ円の半径 (px)
}

/**
 * 【メイン武器の3系統】
 * - VULCAN  : 通常弾（直線〜多方向扇状連射）
 * - MISSILE : ミサイル（着弾時に爆風で周囲の敵も巻き込む範囲攻撃）
 * - HOMING  : ホーミングレーザー（最も近い敵を自動索敵して追尾する誘導弾）
 */
export type WeaponType = "VULCAN" | "MISSILE" | "HOMING";

/** パワーアップカプセルの種類（3種の武器 ＋ シールド回復 ＋ ボム補給 ＋ スピードアップ） */
export type PowerUpType = WeaponType | "SHIELD" | "BOMB" | "SPEED_UP";

/** プレイヤー自機（VF-01 VALKYRIE）の全ステータス */
export interface Player {
  x: number;
  y: number;
  width: number;           // 見た目の横幅 (38px)
  height: number;          // 見た目の縦幅 (44px)
  hitboxes: HitboxCircle[]; // ★複合円判定：機首・胴体・左翼・右翼の4つの円で機体形状を表現
  weapon: WeaponType;      // 現在装備中のメイン武器
  weaponLevel: number;     // 現在の武器レベル（1 〜 5）
  bombs: number;           // 緊急回避ボムの残弾数（初期値 3、最大 5）
  speedLevel: number;      // 移動速度段階（1:低速 / 2:標準 / 3:高速）
  lives: number;           // 残機数（初期値 3）
  hp: number;              // 現在のシールド耐久値
  maxHp: number;           // 最大シールド耐久値 (100)
  speed: number;           // PCキーボード操作時の移動速度 (px/秒)
  shotCooldown: number;    // 次の弾を発射できるまでの残り時間（秒）
  shotInterval: number;    // オートショットの発射間隔（例: 0.11秒 = 秒間約9発）
  thrusterPhase: number;   // スラスター炎のアニメーション計算用変数
  invincibleTimer: number; // ★無敵時間（秒）：被弾直後に連続ヒットして即死するのを防ぐ
}

/** 自機が発射した弾丸（バルカン・ミサイル・ホーミング共通） */
export interface Bullet {
  x: number;
  y: number;
  vx: number;             // X方向の速度（斜め発射やホーミング追尾で使用）
  vy: number;             // Y方向の速度（マイナスの値で上方向へ飛ぶ）
  width: number;
  height: number;
  kind: WeaponType;       // どの武器から撃たれた弾か（見た目・挙動・色分けに使用）
  damage: number;         // 敵に与えるダメージ量
  splashRadius?: number;  // ミサイル専用：着弾時の爆風ダメージ半径 (px)
}

/** 敵撃破時にドロップするパワーアップアイテム */
export interface PowerUpItem {
  x: number;
  y: number;
  vy: number;             // 落下速度
  radius: number;         // 取得判定の半径
  type: PowerUpType;      // VULCAN / MISSILE / HOMING / SHIELD
  phase: number;          // ふわふわ揺れる・点滅させるアニメーション用位相
}

/** 敵が発射したエネルギー弾 */
export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;             // X方向の速度成分（Math.cos(角度) * 速度）
  vy: number;             // Y方向の速度成分（Math.sin(角度) * 速度）
  radius: number;         // 判定半径（4px、見た目はグローで少し大きめに光らせる）
  color?: string;         // 敵タイプ・ボス別の弾カラー（省略時は赤 #ff0055）
  behavior?: "NORMAL" | "CLUSTER" | "WAVE" | "TIME_TRAP" | "CURVE";
  age?: number;           // 発射からの経過時間（秒）
  splitAfter?: number;    // CLUSTER: この秒数経過後に子弾へ分裂
  splitCount?: number;    // CLUSTER: 分裂する子弾数
  waveAmp?: number;       // WAVE: 横揺れ振幅速度
  waveFreq?: number;      // WAVE: 横揺れ周波数
  curveRate?: number;     // CURVE: 角速度（rad/秒）
  baseVx?: number;        // TIME_TRAP: 元のX速度
  baseVy?: number;        // TIME_TRAP: 元のY速度
}

/**
 * 【通常敵の4タイプ（game-design.md 5.5 準拠）】
 * - SCOUT       : 偵察ドローン（自機狙い単発）
 * - INTERCEPTOR : 突進インターセプター（弾は撃たず急降下突進）
 * - SPREADER    : 拡散スプレッダー（上部ホバリング＋3-way扇状弾）
 * - GUNSHIP     : 重装甲中型ガンシップ（高耐久・連続弾幕・確定2ドロップ）
 */
export type EnemyType = "SCOUT" | "INTERCEPTOR" | "SPREADER" | "GUNSHIP";

/** 敵機（ザコ・中型敵共通データ構造） */
export interface Enemy {
  kind: EnemyType;        // 敵の種類
  x: number;
  y: number;
  vx: number;             // 横方向の移動速度（壁で反転する）
  vy: number;             // 下方向への前進速度
  radius: number;         // 当たり判定の半径
  hp: number;             // 耐久値
  shootCooldown: number;  // 次の敵弾を撃つまでの残り時間（秒）
  age: number;            // 出現してからの経過時間（秒：急降下タイミング等に使用）
  charged: boolean;       // 突進ロックオン済みフラグ / 攻撃位相フラグ
  scoreValue: number;     // 撃破時の獲得スコア
}

/** ステージボス（ST.01〜ST.10） */
export interface Boss {
  stage: number;          // 対象ステージ番号 (1〜10)
  name: string;           // ボス名称（GOLIATH, CRIMSON MANTA X-2 等）
  color: string;          // ボス固有のネオン・弾幕カラー
  x: number;
  y: number;
  targetY: number;        // 登場後に静止するY座標
  vx: number;             // 左右移動速度
  width: number;          // ボスの横幅 (180px〜)
  height: number;         // ボスの縦幅 (96px〜)
  hp: number;
  maxHp: number;
  attackCooldown: number; // 次の弾幕攻撃までの残り時間
  attackPhase: number;    // 攻撃パターンの交互切り替え用カウンタ
  hitFlashTimer: number;  // 被弾時に一瞬白く光らせる演出タイマー
  age: number;            // 登場後経過時間（うねりや回転計算用）
  spiralAngle: number;    // スパイラル弾幕の回転位相
  // --- ステージ固有ギミック用タイマー・状態 ---
  warpTimer?: number;          // ST.07: 次ワープまでのタイマー
  warpWarningTimer?: number;   // ST.07: ワープ直前の予告時間
  warpTargetX?: number;        // ST.07: ワープ先X座標
  beamWarningTimer?: number;   // ST.05/08: レーザー/熱波の予告時間
  beamActiveTimer?: number;    // ST.05/08: レーザー/熱波の照射時間
  beamX?: number;              // ST.05/08: レーザー中心X座標
  beamWidth?: number;          // ST.05/08: レーザー幅
  regenerated?: boolean;       // ST.06: 自己再生発動済みフラグ
  shieldAngle?: number;        // ST.04: 回転シールドオーブ角度
}

/** 敵を撃破した時の飛び散る火花（パーティクル） */
export interface Particle {
  x: number;
  y: number;
  vx: number;             // 飛び散るX方向の初速
  vy: number;             // 飛び散るY方向の初速
  life: number;           // 残り生存時間（秒）
  maxLife: number;        // 最大生存時間（アルファ値の計算に使用）
  size: number;           // 粒の大きさ
  color: string;          // パーティクルの色
}

// ----------------------------------------------------------------------------
// 4. React への通知用コールバック
// ----------------------------------------------------------------------------
/**
 * 【パフォーマンス最適化の肝】
 * 毎秒60回の計算すべてを React に伝えると画面がカクカクになるため、
 * 「スコアが増えた」「HPが減った」「状態が変わった」という【重要な瞬間だけ】
 * React に通知するための連絡口（コールバック関数群）です。
 */
export interface GameCallbacks {
  onScoreChange: (score: number) => void;
  onHpChange: (hp: number, maxHp: number) => void;
  onLivesChange: (lives: number) => void;
  onStatusChange: (status: GameStatus) => void;
  onWeaponChange: (weapon: WeaponType, level: number) => void;
  onBombsChange: (bombs: number) => void;
  onStageChange: (stage: number) => void;
  onBossChange: (boss: { name: string; hp: number; maxHp: number } | null) => void;
  onBannerChange: (banner: string | null) => void;
}
