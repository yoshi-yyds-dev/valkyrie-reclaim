/**
 * ============================================================================
 * VOID VANGUARD - タイトル画面オーバーレイ (TitleOverlay.tsx)
 * ============================================================================
 * 
 * 【開発者向けナレッジ：この画面の重要な役割】
 * 1. Stitch のサイバーパンク世界観（面取りパネル、ネオン発光）を提示。
 * 2. 操作方法（スマホのスワイプ、PCのキーボード）を案内。
 * 3. ★最重要技術機能：
 *    「TOUCH TO SORTIE」ボタンを押す【最初の1回のユーザー操作】をフックにし、
 *    スマホブラウザでブロックされている Web Audio API をアンロックします。
 */

import React from "react";
import type { Difficulty, WeaponType } from "../game/types";
import { DevTestPanel } from "./DevTestPanel";

interface TitleOverlayProps {
  difficulty: Difficulty;
  onSelectDifficulty: (diff: Difficulty) => void;
  onStart: () => void;
  isDevMode?: boolean;
  onLaunchDebug: (
    stage: number,
    directBoss: boolean,
    weapon: WeaponType,
    weaponLevel: number
  ) => void;
  onLaunchScene: (scene: "BRIEFING" | "EPILOGUE") => void;
  onOpenShortcuts: () => void;
  onInstallApp: () => void;
}

const DIFFICULTY_INFO: Record<Difficulty, { label: string; desc: string; activeClass: string }> = {
  EASY: {
    label: "EASY",
    desc: "敵弾遅め・ダメージ軽減（初心者向け）",
    activeClass: "border-emerald-400 bg-emerald-400/20 text-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.3)]",
  },
  NORMAL: {
    label: "NORMAL",
    desc: "標準バランス（おすすめの標準難易度）",
    activeClass: "border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan shadow-[0_0_10px_rgba(0,243,255,0.3)]",
  },
  HARD: {
    label: "HARD",
    desc: "弾速上昇＋撃破時の撃ち返し弾あり",
    activeClass: "border-rose-500 bg-rose-500/20 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.3)]",
  },
};

export const TitleOverlay: React.FC<TitleOverlayProps> = ({
  difficulty,
  onSelectDifficulty,
  onStart,
  isDevMode = false,
  onLaunchDebug,
  onLaunchScene,
  onOpenShortcuts,
  onInstallApp,
}) => {
  return (
    <div className="absolute inset-0 bg-void/85 backdrop-blur-md flex items-center justify-center p-5 z-20">
      {/* 45度面取りサイバーパネル（Tailwind の clip-chamfer クラス適用） */}
      <div className="w-full max-w-[310px] max-h-[92%] overflow-y-auto bg-void-panel border border-cyber-cyan p-6 text-center shadow-[0_0_24px_rgba(0,243,255,0.25)] clip-chamfer">
        
        {/* システムバージョン表示 */}
        <div className="text-[11px] font-mono tracking-widest text-cyber-cyan mb-2">
          SYS_VER 4.09.2 // PROTOTYPE
        </div>

        {/* ゲームタイトルロゴ */}
        <h1 className="text-2xl font-extrabold tracking-wider text-white drop-shadow-[0_0_10px_rgba(0,243,255,0.8)] mb-1">
          VALKYRIE RECLAIM
        </h1>

        {/* サブタイトル */}
        <p className="text-[11px] font-mono text-text-dim tracking-wider mb-5">
          SEIZE PEACE // TACTICAL INTERCEPT
        </p>

        {/* 操作方法ガイド ＋ ショートカット一覧ボタン */}
        <div className="bg-cyber-cyan/5 border border-cyber-cyan/20 p-3 mb-4 text-[11px] leading-relaxed text-left text-text-primary rounded-sm">
          <div className="flex items-center justify-between mb-1">
            <p className="font-semibold text-cyber-cyan">🎮 CONTROLS</p>
            <button
              type="button"
              onClick={onOpenShortcuts}
              className="px-1.5 py-0.5 rounded-sm border border-cyber-cyan/40 bg-cyber-cyan/10 text-[10px] font-mono text-cyber-cyan hover:bg-cyber-cyan/20 transition-colors"
            >
              ⌨ KEYS [H]
            </button>
          </div>
          <p>📱 スマホ：画面スワイプ移動（オートショット）</p>
          <p>💻 PC：マウス移動 / 矢印・WASD / Space:ボム</p>
        </div>

        {/* 難易度選択（Easy / Normal / Hard） */}
        <div className="mb-5">
          <div className="text-[10px] font-mono tracking-widest text-text-dim mb-1.5 text-left">
            DIFFICULTY SELECT
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-1.5">
            {(["EASY", "NORMAL", "HARD"] as Difficulty[]).map((diff) => (
              <button
                key={diff}
                onClick={() => onSelectDifficulty(diff)}
                className={`py-1.5 rounded-sm border font-mono text-[11px] font-bold transition-all ${
                  difficulty === diff
                    ? DIFFICULTY_INFO[diff].activeClass
                    : "border-void-border bg-void-surface/60 text-text-dim hover:text-text-primary"
                }`}
              >
                {DIFFICULTY_INFO[diff].label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-dim text-left">
            {DIFFICULTY_INFO[difficulty].desc}
          </p>
        </div>

        {/* 出撃開始ボタン（音声アンロック兼用） */}
        <button
          onClick={onStart}
          className="w-full py-3.5 font-mono text-xs font-bold tracking-widest text-void bg-cyber-cyan border border-cyber-cyan shadow-[0_0_16px_rgba(0,243,255,0.6)] hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm"
        >
          TOUCH TO SORTIE // 出撃開始
        </button>

        {/* PWA アプリインストールボタン */}
        <button
          type="button"
          onClick={onInstallApp}
          className="w-full mt-2.5 py-2 font-mono text-[11px] font-bold tracking-wider text-emerald-300 bg-emerald-500/15 border border-emerald-400/50 hover:bg-emerald-500/25 active:scale-95 transition-all rounded-sm flex items-center justify-center gap-1.5 shadow-[0_0_12px_rgba(52,211,153,0.2)]"
        >
          <span>📲 アプリをインストール (全画面PWA)</span>
        </button>

        {/* 開発用検証モード（URL に ?dev=1 がある時だけ表示） */}
        {isDevMode && (
          <DevTestPanel onLaunchDebug={onLaunchDebug} onLaunchScene={onLaunchScene} />
        )}
      </div>
    </div>
  );
};
