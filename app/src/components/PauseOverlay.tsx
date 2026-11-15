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
import { Play, RotateCcw, Volume2, VolumeX, Home, Power, HelpCircle } from "lucide-react";
import type { WeaponType } from "../game/types";
import { DevTestPanel } from "./DevTestPanel";

interface PauseOverlayProps {
  stage: number;
  score: number;
  onResume: () => void;
  onRetry: () => void;
  onQuitToTitle: () => void;
  onExitGame: () => void;
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
  stage,
  score,
  onResume,
  onRetry,
  onQuitToTitle,
  onExitGame,
  onToggleMute,
  isMuted,
  isDevMode = false,
  onLaunchDebug,
  onLaunchScene,
  onOpenShortcuts,
}) => {
  return (
    <div className="absolute inset-0 bg-void/85 backdrop-blur-md flex items-center justify-center p-5 z-20">
      <div className="w-full max-w-[320px] max-h-[94%] overflow-y-auto bg-void-panel border border-cyber-cyan/70 p-6 text-center shadow-[0_0_24px_rgba(0,243,255,0.25)] clip-chamfer">
        {/* ① 正式アプリタイトル明記 */}
        <div className="text-[10px] font-mono tracking-widest text-cyber-cyan mb-1">
          VALKYRIE RECLAIM // TACTICAL INTERCEPT
        </div>
        <h2 className="text-xl font-black tracking-wider text-white mb-2">
          MISSION PAUSED
        </h2>

        {/* ② 現在ステージ ＆ 現在スコアの明示 */}
        <div className="border border-cyber-cyan/30 bg-[#070c18]/80 rounded p-2.5 mb-4 flex items-center justify-between font-mono">
          <div className="text-left">
            <div className="text-[9px] text-text-dim tracking-wider">CURRENT SECTOR</div>
            <div className="text-sm font-bold text-cyber-cyan">
              STAGE {String(stage).padStart(2, "0")} / 10
            </div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-text-dim tracking-wider">SCORE</div>
            <div className="text-sm font-bold text-white">
              {String(score).padStart(7, "0")}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          {/* ① 再開ボタン */}
          <button
            type="button"
            onClick={onResume}
            className="w-full py-3 font-mono text-xs font-bold tracking-widest text-void bg-cyber-cyan shadow-[0_0_14px_rgba(0,243,255,0.55)] hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-1.5"
          >
            <Play size={14} className="fill-void" />
            <span>RESUME // 再開する [P]</span>
          </button>

          {/* ② クイックリトライボタン */}
          <button
            type="button"
            onClick={onRetry}
            className="w-full py-2.5 font-mono text-xs font-semibold tracking-wider text-text-primary bg-void-surface border border-void-border hover:border-amber-400 hover:text-amber-300 transition-all clip-chamfer-sm active:scale-95 flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} />
            <span>RETRY // 最初からやり直す [R]</span>
          </button>

          {/* ③ タイトル画面へ戻る（戦闘中断） */}
          <button
            type="button"
            onClick={onQuitToTitle}
            className="w-full py-2.5 font-mono text-xs font-semibold tracking-wider text-text-primary bg-void-surface border border-void-border hover:border-rose-400 hover:text-rose-300 transition-all clip-chamfer-sm active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Home size={14} />
            <span>TITLE // タイトルへ戻る [Q]</span>
          </button>

          {/* ④ 音声ミュートトグル ＆ ヘルプ（2列） */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onToggleMute}
              className="py-2 px-2 font-mono text-[11px] font-semibold tracking-wider text-text-primary bg-void-surface border border-void-border hover:border-cyber-cyan hover:text-cyber-cyan transition-all clip-chamfer-sm active:scale-95 flex items-center justify-center gap-1"
            >
              {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
              <span>{isMuted ? "MUTE: ON" : "AUDIO: ON"}</span>
            </button>

            <button
              type="button"
              onClick={onOpenShortcuts}
              className="py-2 px-2 font-mono text-[11px] font-semibold tracking-wider text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/40 hover:bg-cyber-cyan/20 transition-all clip-chamfer-sm active:scale-95 flex items-center justify-center gap-1"
            >
              <HelpCircle size={13} />
              <span>HELP [H]</span>
            </button>
          </div>

          {/* ⑤ ゲーム自体を終了するボタン */}
          <button
            type="button"
            onClick={onExitGame}
            className="w-full mt-1 py-2 font-mono text-[11px] font-semibold tracking-wider text-rose-300 bg-rose-500/10 border border-rose-500/40 hover:bg-rose-500/20 active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-1.5"
          >
            <Power size={13} />
            <span>EXIT // ゲームを終了する [Esc×2]</span>
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
