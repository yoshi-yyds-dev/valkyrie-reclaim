/**
 * ============================================================================
 * VOID VANGUARD - ゲームオーバーオーバーレイ (GameOverOverlay.tsx)
 * ============================================================================
 * 
 * 【開発者向けナレッジ：ゲームオーバー画面の役割】
 * 1. 全残機（3機）を失ったタイミングで表示。
 * 2. 今回の最終スコア（SCORE）を明確に提示し、「次はもっと上を目指す」モチベーションを作る。
 * 3. ワンタップで即座にリトライできる導線（RETRY ボタン）を用意。
 */

import React from "react";

interface GameOverOverlayProps {
  score: number;
  onRetry: () => void;
}

export const GameOverOverlay: React.FC<GameOverOverlayProps> = ({ score, onRetry }) => {
  return (
    <div className="absolute inset-0 bg-void/90 backdrop-blur-md flex items-center justify-center p-5 z-20">
      <div className="w-full max-w-[300px] bg-void-panel border border-cyber-crimson p-6 text-center shadow-[0_0_24px_rgba(255,0,85,0.3)] clip-chamfer">
        {/* 警告タグ */}
        <div className="text-[10px] font-mono tracking-widest text-cyber-crimson mb-2 animate-pulse">
          CRITICAL FAILURE // ALL UNITS LOST
        </div>

        {/* GAME OVER タイトル */}
        <h2 className="text-2xl font-extrabold tracking-wider text-white drop-shadow-[0_0_10px_rgba(255,0,85,0.8)] mb-4">
          GAME OVER
        </h2>

        {/* 到達スコア表示ボックス */}
        <div className="bg-void-surface border border-void-border p-3 mb-6">
          <div className="text-[10px] font-mono tracking-widest text-text-dim mb-1">
            FINAL SCORE
          </div>
          <div className="text-2xl font-mono font-bold text-cyber-cyan">
            {String(score).padStart(7, "0")}
          </div>
        </div>

        {/* 再出撃ボタン */}
        <button
          onClick={onRetry}
          className="w-full py-3.5 font-mono text-xs font-bold tracking-widest text-white bg-cyber-crimson border border-cyber-crimson shadow-[0_0_16px_rgba(255,0,85,0.5)] hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm"
        >
          RETRY MISSION // 再出撃
        </button>
      </div>
    </div>
  );
};
