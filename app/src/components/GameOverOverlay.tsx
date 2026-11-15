/**
 * ============================================================================
 * VOID VANGUARD / VALKYRIE RECLAIM - ゲームオーバー専用画面 (GameOverOverlay.tsx)
 * ============================================================================
 * 
 * 【全体構成におけるこのコンポーネントの位置づけ】
 * プレイヤーが全3機の残機をすべて失った瞬間、GameEngine から status = "GAMEOVER" が通知され、
 * App.tsx の条件付きレンダリングによってフルスクリーン最前面（z-20）に表示されるリザルト画面です。
 * 本作はアーケードライクな緊張感を重視しているため、コンティニュー機能は意図的に設けず、
 * 「最初からやり直す（STAGE 01から）」または「タイトルへ戻る」のみを選択できる硬派な仕様としています。
 * 
 * 【初心者がつまずきやすいポイント：なぜ useEffect 内で requestAnimationFrame を使うのか？】
 * ➔ コンポーネントがマウントされた瞬間に `opacity-100` だと、パッと一瞬で画面が切り替わってしまい味気ありません。
 *    初期状態を `visible = false`（opacity-0）にしておき、ブラウザが最初のフレームを描画し終えた直後（requestAnimationFrame）に
 *    `visible = true` へ切り替えることで、CSS の `transition-opacity duration-700` が自然に発火し、
 *    映画のような滑らかなフェードイン演出が実現します。
 */

import React, { useEffect, useState } from "react";
import { RotateCcw, Home, ShieldOff } from "lucide-react";

interface GameOverOverlayProps {
  score: number;
  stage: number;
  onRetry: () => void;
  onQuitToTitle: () => void;
}

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({
  score,
  stage,
  onRetry,
  onQuitToTitle,
}) => {
  // 1. マウント直後にフェードインを発火させるための表示フラグ
  const [visible, setVisible] = useState(false);

  // 2. 次のアニメーションフレームで visible=true にし、CSS transition を滑らかに開始
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-20 flex flex-col justify-between p-6 bg-gradient-to-b from-[#130409] via-[#090308]/95 to-[#030408] backdrop-blur-md transition-opacity duration-700 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* 上部：作戦失敗アラート */}
      <div className="mt-6 border border-rose-500/60 bg-rose-950/40 px-3 py-2 rounded-sm flex items-center justify-center gap-2">
        <ShieldOff size={15} className="text-rose-400" />
        <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-rose-300">
          ALL 3 UNITS LOST // SIGNAL TERMINATED
        </span>
      </div>

      {/* 中央：GAME OVER ロゴ ＋ 戦績表示 */}
      <div
        className={`flex flex-col items-center text-center transition-all duration-700 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
        }`}
      >
        <div className="font-mono text-[11px] tracking-[0.3em] text-rose-400/80 mb-2">
          MISSION FAILED
        </div>
        <h2 className="text-4xl font-black tracking-[0.15em] text-white drop-shadow-[0_0_18px_rgba(255,0,85,0.85)] mb-2">
          GAME OVER
        </h2>
        <p className="text-xs text-slate-400 mb-6">
          防衛機はすべて撃墜された――。
        </p>

        <div className="w-full max-w-[280px] border border-rose-500/40 bg-[#12070d]/90 rounded p-4 space-y-3 shadow-[0_0_24px_rgba(255,0,85,0.18)]">
          <div>
            <div className="text-[10px] font-mono tracking-widest text-text-dim">
              FINAL SCORE
            </div>
            <div className="text-2xl font-mono font-extrabold text-cyber-cyan tracking-wider">
              {String(score).padStart(7, "0")}
            </div>
          </div>
          <div className="pt-2 border-t border-rose-500/20 flex justify-between text-[11px] font-mono">
            <span className="text-text-dim">REACHED SECTOR</span>
            <span className="text-rose-300 font-bold">
              STAGE {String(stage).padStart(2, "0")}
            </span>
          </div>
          <div className="text-[10px] font-mono text-rose-400/80">
            ※ コンティニュー不可（最初から再挑戦）
          </div>
        </div>
      </div>

      {/* 下部：最初からやり直す / タイトルへ戻る */}
      <div className="mb-4 flex flex-col gap-2.5 max-w-[280px] w-full mx-auto">
        <button
          type="button"
          onClick={onRetry}
          className="w-full py-3.5 font-mono text-xs font-bold tracking-widest text-white bg-cyber-crimson border border-cyber-crimson shadow-[0_0_18px_rgba(255,0,85,0.5)] hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-2"
        >
          <RotateCcw size={15} />
          <span>最初からやり直す (STAGE 01)</span>
        </button>
        <button
          type="button"
          onClick={onQuitToTitle}
          className="w-full py-2.5 font-mono text-xs font-semibold tracking-wider text-text-primary bg-void-surface border border-void-border hover:border-cyber-cyan hover:text-cyber-cyan active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-1.5"
        >
          <Home size={14} />
          <span>TITLE // タイトルへ戻る</span>
        </button>
      </div>
    </div>
  );
};
