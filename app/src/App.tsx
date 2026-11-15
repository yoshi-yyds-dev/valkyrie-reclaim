/**
 * ============================================================================
 * VOID VANGUARD - メインアプリケーションコンポーネント (App.tsx)
 * ============================================================================
 * 
 * 【開発者向けナレッジ：React と Canvas のハイブリッド分離設計】
 * 
 * ★Webゲーム開発で最もよくある失敗：
 * 「自機や弾のX, Y座標を React の useState で管理してしまい、
 * 毎秒数百回の再レンダリングが走ってスマホが発熱＆カクカクになること」。
 * 
 * ★今回の解決策（プロの設計）：
 * 1. 激しく動く戦闘計算（自機・弾丸・敵・星空）はすべて GameEngine 内の純粋な変数で回す。
 * 2. React は「スコアが増えた」「HPが減った」「ポーズ画面を開いた」という
 *    【画面UIの更新が必要な瞬間だけ】状態（state）を受け取り、静かに画面を描画する。
 * ➔ これにより、秒間60フレームの超高速描画と、Reactの書きやすいUI開発を完璧に両立しています。
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { GameEngine } from "./game/GameEngine";
import { LOGICAL_WIDTH, LOGICAL_HEIGHT } from "./game/types";
import type { Difficulty, GameStatus, WeaponType } from "./game/types";
import { HUD } from "./components/HUD";
import { TitleOverlay } from "./components/TitleOverlay";
import { BriefingOverlay } from "./components/BriefingOverlay";
import { PauseOverlay } from "./components/PauseOverlay";
import { GameOverOverlay } from "./components/GameOverOverlay";
import { EpilogueOverlay } from "./components/EpilogueOverlay";
import { ShortcutHelpModal } from "./components/ShortcutHelpModal";

export const App: React.FC = () => {
  // Canvas 要素への直接アクセス用参照（DOM再取得を避ける）
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // ゲームエンジンインスタンスの保持用参照（再レンダリングされてもエンジンが再生成されないようにする）
  const engineRef = useRef<GameEngine | null>(null);

  // --- React が管理するUI表示用ステート群 ---
  const [status, setStatus] = useState<GameStatus>("TITLE");
  const [difficulty, setDifficulty] = useState<Difficulty>("NORMAL");
  const [score, setScore] = useState<number>(0);
  const [hp, setHp] = useState<number>(100);
  const [maxHp, setMaxHp] = useState<number>(100);
  const [lives, setLives] = useState<number>(3);
  const [bombs, setBombs] = useState<number>(3);
  const [stage, setStage] = useState<number>(1);
  const [bossInfo, setBossInfo] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [weapon, setWeapon] = useState<WeaponType>("VULCAN");
  const [weaponLevel, setWeaponLevel] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [showShortcuts, setShowShortcuts] = useState<boolean>(false);

  /**
   * 【初期化エフェクト】
   * 画面が最初にマウントされた時だけ1回実行され、GameEngine を生成します。
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    // ゲームエンジンを生成し、状態変化の通知先（コールバック）を繋ぐ
    const engine = new GameEngine(canvasRef.current, {
      onScoreChange: (newScore) => setScore(newScore),
      onHpChange: (newHp, newMaxHp) => {
        setHp(newHp);
        setMaxHp(newMaxHp);
      },
      onLivesChange: (newLives) => setLives(newLives),
      onBombsChange: (newBombs) => setBombs(newBombs),
      onStageChange: (newStage) => setStage(newStage),
      onBossChange: (newBoss) => setBossInfo(newBoss),
      onBannerChange: (newBanner) => setBanner(newBanner),
      onWeaponChange: (newWeapon, newLevel) => {
        setWeapon(newWeapon);
        setWeaponLevel(newLevel);
      },
      onStatusChange: (newStatus) => setStatus(newStatus),
    });

    engineRef.current = engine;

    // クリーンアップ関数：画面から去る時にループを安全に停止（メモリリーク防止）
    return () => {
      engine.destroy();
    };
  }, []);

  // --- ユーザー操作（UIボタンタップ時）のイベントハンドラー ---
  const handleSelectDifficulty = (diff: Difficulty) => {
    setDifficulty(diff);
    engineRef.current?.setDifficulty(diff);
  };

  const handleStart = () => {
    engineRef.current?.startGame();
  };

  const handlePause = () => {
    engineRef.current?.pauseGame();
  };

  const handleResume = () => {
    engineRef.current?.resumeGame();
  };

  const handleRetry = () => {
    engineRef.current?.retryGame();
  };

  const handleToggleMute = () => {
    if (engineRef.current) {
      const muted = engineRef.current.sound.toggleMute();
      setIsMuted(muted);
    }
  };

  const handleBomb = () => {
    engineRef.current?.triggerBomb();
  };

  // BriefingOverlay の useEffect 内でタイマーが再生成されないよう useCallback でメモ化
  const handleBeginCombat = useCallback(() => {
    engineRef.current?.beginCombat();
  }, []);

  const handleLaunchDebug = (
    targetStage: number,
    directBoss: boolean,
    targetWeapon: WeaponType,
    targetLevel: number
  ) => {
    engineRef.current?.startDebugStage(targetStage, directBoss, targetWeapon, targetLevel);
  };

  const handleQuitToTitle = () => {
    engineRef.current?.quitToTitle();
  };

  const handleLaunchDebugScene = (scene: "BRIEFING" | "EPILOGUE") => {
    engineRef.current?.startDebugScene(scene);
  };

  // [H] または [?] キーでどこからでもショートカットヘルプを開閉（戦闘中なら自動ポーズ）
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.code === "KeyH" || e.key === "?") {
        e.preventDefault();
        setShowShortcuts((prev) => {
          const next = !prev;
          if (next && status === "PLAYING") {
            engineRef.current?.pauseGame();
          }
          return next;
        });
      } else if (e.code === "Escape" && showShortcuts) {
        setShowShortcuts(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, showShortcuts]);

  const handleTypeTick = useCallback(() => {
    engineRef.current?.sound.playTyping();
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#030408]">
      {/* 
        【レスポンシブ縦画面コンテナ】
        CSS の max-w / max-h 計算を使い、PCでもタブレットでもスマホでも
        常に「縦横比 9:16」を完璧にキープしたまま、画面いっぱいにセンタリング拡大します。
      */}
      <div className="relative w-full h-full max-w-[calc(100vh*9/16)] max-h-[calc(100vw*16/9)] bg-void shadow-[0_0_35px_rgba(0,243,255,0.15)] overflow-hidden">
        {/* 
          【60fps Canvas 描画層】
          ゲーム画面本体。touch-none を指定してスマホのスワイプ時の余計なスクロールを遮断。
        */}
        <canvas
          ref={canvasRef}
          width={LOGICAL_WIDTH}
          height={LOGICAL_HEIGHT}
          className="w-full h-full block touch-none"
        />

        {/* 
          【上部 HUD 層】
          戦闘中（PLAYING）およびポーズ中（PAUSED）に表示。タイトル・ブリーフィング時は非表示。
        */}
        {status !== "TITLE" && status !== "BRIEFING" && status !== "EPILOGUE" && (
          <HUD
            score={score}
            hp={hp}
            maxHp={maxHp}
            lives={lives}
            weapon={weapon}
            weaponLevel={weaponLevel}
            isMuted={isMuted}
            onPause={handlePause}
            onToggleMute={handleToggleMute}
          />
        )}

        {/* 【タイトル画面オーバーレイ】出撃開始ボタンを押すまで表示 */}
        {status === "TITLE" && (
          <TitleOverlay
            difficulty={difficulty}
            onSelectDifficulty={handleSelectDifficulty}
            onStart={handleStart}
            onLaunchDebug={handleLaunchDebug}
            onLaunchScene={handleLaunchDebugScene}
            onOpenShortcuts={() => setShowShortcuts(true)}
          />
        )}

        {/* 【プロローグ演出オーバーレイ】出撃前の HUD ブリーフィング */}
        {status === "BRIEFING" && (
          <BriefingOverlay
            onComplete={handleBeginCombat}
            onTypeTick={handleTypeTick}
          />
        )}

        {/* 【ポーズ画面オーバーレイ】ポーズ中のみ前面に表示 */}
        {status === "PAUSED" && (
          <PauseOverlay
            onResume={handleResume}
            onRetry={handleRetry}
            onToggleMute={handleToggleMute}
            isMuted={isMuted}
            onLaunchDebug={handleLaunchDebug}
            onLaunchScene={handleLaunchDebugScene}
            onOpenShortcuts={() => setShowShortcuts(true)}
          />
        )}

        {/* 【ゲームオーバー画面オーバーレイ】全機喪失時に表示 */}
        {status === "GAMEOVER" && (
          <GameOverOverlay score={score} onRetry={handleRetry} />
        )}

        {/* 【最終エピローグオーバーレイ】全10ステージクリア時に表示 */}
        {status === "EPILOGUE" && (
          <EpilogueOverlay
            score={score}
            lives={lives}
            difficulty={difficulty}
            onRetry={handleRetry}
            onQuitToTitle={handleQuitToTitle}
            onTypeTick={handleTypeTick}
          />
        )}

        {/* 【緊急回避ボムボタン】戦闘中のみ画面右下に親指で押しやすいサイズで表示 */}
        {status === "PLAYING" && (
          <button
            onClick={handleBomb}
            disabled={bombs <= 0}
            className={`absolute bottom-5 right-4 z-10 w-16 h-16 rounded-full border-2 flex flex-col items-center justify-center font-mono transition-all active:scale-90 ${
              bombs > 0
                ? "border-amber-400 bg-amber-400/15 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.35)] hover:bg-amber-400/25"
                : "border-void-border bg-void-surface/60 text-text-dim opacity-40 cursor-not-allowed"
            }`}
            title="Emergency Bomb (Space / B)"
          >
            <span className="text-[10px] font-bold tracking-wider">BOMB</span>
            <span className="text-[15px] font-bold leading-none mt-0.5">×{bombs}</span>
          </button>
        )}

        {/* 【ボス HP ゲージ】ボス戦中のみ HUD の直下に表示 */}
        {status !== "TITLE" && bossInfo && (
          <div className="absolute top-[56px] left-3 right-3 z-10 pointer-events-none">
            <div className="flex justify-between items-center text-[10px] font-mono font-bold tracking-widest text-rose-400 mb-0.5">
              <span>{bossInfo.name}</span>
              <span>
                {bossInfo.hp} / {bossInfo.maxHp}
              </span>
            </div>
            <div className="w-full h-2 bg-void-panel/90 border border-rose-500/40 rounded-sm overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-75"
                style={{ width: `${Math.max(0, (bossInfo.hp / bossInfo.maxHp) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* 【ステージ / ボス警報バナー】 */}
        {status === "PLAYING" && banner && (
          <div className="absolute top-28 left-4 right-4 z-10 pointer-events-none flex justify-center">
            <div
              className={`px-4 py-1.5 rounded border font-mono text-xs font-bold tracking-widest backdrop-blur-sm animate-pulse ${
                banner.startsWith("WARNING")
                  ? "border-rose-500 bg-rose-950/80 text-rose-300 shadow-[0_0_16px_rgba(244,63,94,0.45)]"
                  : "border-cyber-cyan/70 bg-void-panel/85 text-cyber-cyan shadow-[0_0_14px_rgba(0,243,255,0.3)]"
              }`}
            >
              {banner}
            </div>
          </div>
        )}

        {/* 【現在ステージ表示】画面左下に控えめに配置 */}
        {status !== "TITLE" && status !== "BRIEFING" && status !== "EPILOGUE" && (
          <div className="absolute bottom-3 left-3 z-10 pointer-events-none font-mono text-[10px] tracking-widest text-text-dim/80">
            STAGE {String(stage).padStart(2, "0")}
          </div>
        )}

        {/* 【ショートカットヘルプモーダル】H / ? キーまたはボタンからいつでも表示 */}
        {showShortcuts && (
          <ShortcutHelpModal onClose={() => setShowShortcuts(false)} />
        )}
      </div>
    </div>
  );
};

export default App;
