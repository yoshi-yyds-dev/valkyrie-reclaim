/**
 * ============================================================================
 * VOID VANGUARD - 上部 HUD 表示コンポーネント (HUD.tsx)
 * ============================================================================
 * 
 * 【全体構成におけるこのコンポーネントの位置づけ】
 * 戦闘中（PLAYING）およびポーズ中（PAUSED）に、Canvas 描画層の手前（z-10）に常時オーバーレイ表示される
 * 計器パネル（Heads-Up Display）です。
 * プレイヤーはここを見ることで、現在のスコア、残機（残り機体数）、武器種別・Lv、シールド残量（HP）を瞬時に把握できます。
 * 
 * 【プログラミング初心者がつまずきやすいポイントと工夫】
 * 1. なぜ `padStart(7, "0")` を使うのか？
 *    ➔ 数字が増減した際に文字の桁数が変わると、文字全体の横幅が変わり、周囲のレイアウトがガタガタと揺れてしまいます。
 *       常に「0001200」のように7桁固定（ゼロ埋め）にし、さらに等幅フォント（font-mono）を適用することで、
 *       激しくスコアが加算されてもレイアウトがピクリとも動かないプロ仕様のUIになります。
 * 
 * 2. なぜ画像ではなくインライン SVG で残機アイコンを描いているのか？
 *    ➔ 画像ファイル（PNG等）の読み込み遅延や解像度ボケを防ぎ、CSS の Tailwind クラス（fill-cyber-cyan や drop-shadow）で
 *       ネオン発光や生存/撃墜時のグレースケール切り替えをリアルタイムに制御できるためです。
 */

import React from "react";
import { Pause, Volume2, VolumeX } from "lucide-react";
import type { WeaponType } from "../game/types";

interface HUDProps {
  score: number;
  hp: number;
  maxHp: number;
  lives: number;
  weapon: WeaponType;
  weaponLevel: number;
  isMuted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  hp,
  maxHp,
  lives,
  weapon,
  weaponLevel,
  isMuted,
  onPause,
  onToggleMute,
}) => {
  // HP を 5つのセグメントブロックに換算
  const hpSegments = 5;
  const filledSegments = Math.ceil((hp / maxHp) * hpSegments);

  // 武器ごとのアクセントカラー
  const weaponColorClass =
    weapon === "MISSILE"
      ? "text-orange-400"
      : weapon === "HOMING"
        ? "text-fuchsia-400"
        : "text-cyber-cyan";

  return (
    <div className="absolute top-0 left-0 w-full h-[50px] bg-void-panel/90 border-b border-cyber-cyan/30 flex items-center justify-between px-3 z-10 pointer-events-auto">
      {/* 
        ① スコア表示
        padStart(7, "0") で常に7桁のゼロ埋め（例: 0001200）にして、
        数字が変わっても文字の横幅がガタガタ揺れないようにする。
      */}
      <div className="flex flex-col">
        <span className="text-[9px] font-mono tracking-widest text-text-dim">SCORE</span>
        <span className="text-[16px] font-mono font-bold text-cyber-cyan">
          {String(score).padStart(7, "0")}
        </span>
      </div>

      {/* 残機数（自機アイコン3機並び）・武器レベル ＆ シールド（HP）セグメントバー */}
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 text-[9px] font-mono tracking-wider">
          <div className="flex items-center gap-1" title={`Remaining Ships: ${lives}`}>
            {[0, 1, 2].map((idx) => (
              <svg
                key={idx}
                viewBox="0 0 16 18"
                className={`w-3 h-3.5 transition-all ${
                  idx < lives
                    ? "fill-cyber-cyan drop-shadow-[0_0_4px_rgba(0,243,255,0.8)]"
                    : "fill-void-border opacity-35"
                }`}
              >
                <polygon points="8,1 14,14 8,11 2,14" />
              </svg>
            ))}
          </div>
          <span className={`font-bold ${weaponColorClass}`}>
            {weapon} LV.{weaponLevel}
          </span>
        </div>
        <div className="flex gap-1 mt-0.5">
          {Array.from({ length: hpSegments }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-2.5 rounded-[1px] transition-colors ${
                i < filledSegments
                  ? "bg-cyber-cyan shadow-[0_0_6px_rgba(0,243,255,0.6)]" // 残りHP（シアンに発光）
                  : "bg-void-border"                                      // 減ったHP（暗い枠線のみ）
              }`}
            />
          ))}
        </div>
      </div>

      {/* ③ 右上コントロールボタン群（音量・ポーズ） */}
      <div className="flex items-center gap-1.5">
        {/* ミュート切り替えボタン */}
        <button
          onClick={onToggleMute}
          className="w-8 h-8 rounded border border-void-border bg-void-surface text-text-dim hover:text-text-primary flex items-center justify-center transition-colors active:scale-90"
          title="Mute Toggle"
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        {/* ポーズボタン（一時停止） */}
        <button
          onClick={onPause}
          className="w-8 h-8 rounded border border-cyber-cyan/50 bg-cyber-cyan/10 text-cyber-cyan hover:bg-cyber-cyan/20 flex items-center justify-center transition-colors active:scale-90"
          title="Pause Game (P / Esc)"
        >
          <Pause size={15} />
        </button>
      </div>
    </div>
  );
};
