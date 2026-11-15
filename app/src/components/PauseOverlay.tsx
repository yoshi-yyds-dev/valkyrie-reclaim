/**
 * ============================================================================
 * VOID VANGUARD - ポーズ画面オーバーレイ (PauseOverlay.tsx)
 * ============================================================================
 * 
 * 【開発者向けナレッジ：ポーズ機能の設計】
 * 1. ポーズ中は Canvas 側の update() 計算が一時停止するため、
 *    敵や弾丸、星空がその場でピタッとフリーズします。
 * 2. 画面全体に backdrop-blur-md（すりガラス効果）をかけ、
 *    戦闘の臨場感を残したままメニューを浮き上がらせます。
 * 3. 「再開」「やり直し（リトライ）」「音量設定」を1タップで切り替え可能です。
 */

import React from "react";
import type { WeaponType } from "../game/types";
import { DevTestPanel } from "./DevTestPanel";

interface PauseOverlayProps {
  onResume: () => void;
  onRetry: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  isDevMode?: boolean;
  onLaunchDebug: (
    stage: number,
    directBoss: boolean,
    weapon: WeaponType,
    weaponLevel: number
  ) => void;
  onLaunchScene: (scene: "BRIEFING" | "EPILOGUE") => void;
  onOpenShortcuts: () => void;
}

export const PauseOverlay: React.FC<PauseOverlayProps> = ({
  onResume,
  onRetry,
  onToggleMute,
  isMuted,
  isDevMode = false,
  onLaunchDebug,
  onLaunchScene,
  onOpenShortcuts,
}) => {
  return (
    <div className="absolute inset-0 bg-void/85 backdrop-blur-md flex items-center justify-center p-5 z-20">
      <div className="w-full max-w-[300px] max-h-[92%] overflow-y-auto bg-void-panel border border-cyber-cyan/60 p-6 text-center shadow-[0_0_20px_rgba(0,243,255,0.2)] clip-chamfer">
        <div className="text-[10px] font-mono tracking-widest text-cyber-cyan mb-2">
          SYSTEM PAUSED
        </div>
        <h2 className="text-xl font-bold tracking-wider text-white mb-5">
          MISSION PAUSED
        </h2>

        <div className="flex flex-col gap-3">
          {/* ① 再開ボタン */}
          <button
            onClick={onResume}
            className="w-full py-3 font-mono text-xs font-bold tracking-widest text-void bg-cyber-cyan shadow-[0_0_12px_rgba(0,243,255,0.5)] hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm"
          >
            RESUME // 再開
          </button>

          {/* ② クイックリトライボタン */}
          <button
            onClick={onRetry}
            className="w-full py-2.5 font-mono text-xs font-semibold tracking-wider text-text-primary bg-void-surface border border-void-border hover:border-cyber-violet hover:text-cyber-violet transition-all clip-chamfer-sm active:scale-95"
          >
            RETRY // 最初から
          </button>

          {/* ③ 音声ミュートトグルボタン */}
          <button
            onClick={onToggleMute}
            className="w-full py-2.5 font-mono text-xs font-semibold tracking-wider text-text-primary bg-void-surface border border-void-border hover:border-cyber-cyan hover:text-cyber-cyan transition-all clip-chamfer-sm active:scale-95"
          >
            {isMuted ? "AUDIO: OFF (MUTED)" : "AUDIO: ON"}
          </button>

          {/* ④ ショートカットヘルプボタン */}
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="w-full py-2 font-mono text-[11px] font-semibold tracking-wider text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/40 hover:bg-cyber-cyan/20 transition-all clip-chamfer-sm active:scale-95"
          >
            ⌨ KEY SHORTCUTS [H]
          </button>
        </div>

        {/* 開発用検証モード（URL に ?dev=1 がある時だけ表示） */}
        {isDevMode && (
          <DevTestPanel onLaunchDebug={onLaunchDebug} onLaunchScene={onLaunchScene} />
        )}
      </div>
    </div>
  );
};
