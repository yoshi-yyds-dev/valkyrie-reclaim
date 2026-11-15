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
import { Pause, Volume2, VolumeX, RotateCcw, Home } from "lucide-react";
import type { WeaponType } from "../game/types";

interface HUDProps {
  score: number;
  stage: number;
  hp: number;
  maxHp: number;
  lives: number;
  weapon: WeaponType;
  weaponLevel: number;
  isMuted: boolean;
  onPause: () => void;
  onToggleMute: () => void;
  onRetry: () => void;
  onQuitToTitle: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  stage,
  hp,
  maxHp,
  lives,
  weapon,
  weaponLevel,
  isMuted,
  onPause,
  onToggleMute,
  onRetry,
  onQuitToTitle,
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
    <div className="absolute top-0 left-0 w-full h-[52px] bg-void-panel/95 border-b border-cyber-cyan/40 flex items-center justify-between px-2.5 z-10 pointer-events-auto shadow-[0_2px_12px_rgba(0,0,0,0.6)]">
      {/* 
        ① アプリ名・現在ステージ・スコア表示
      */}
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none mb-0.5">
          <span className="text-[9px] font-mono font-bold tracking-widest text-cyber-cyan">
            STAGE {String(stage).padStart(2, "0")}
          </span>
          <span className="text-[8px] font-mono text-text-dim/70">
            VALKYRIE
          </span>
        </div>
        <span className="text-[15px] font-mono font-bold text-white tracking-wider leading-none">
          {String(score).padStart(7, "0")}
        </span>
      </div>

      {/* ② 残機数・武器種別Lv ＆ シールド（HP）セグメントバー */}
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
              className={`w-3.5 h-2 rounded-[1px] transition-colors ${
                i < filledSegments
                  ? "bg-cyber-cyan shadow-[0_0_6px_rgba(0,243,255,0.6)]" // 残りHP（シアンに発光）
                  : "bg-void-border"                                      // 減ったHP（暗い枠線のみ）
              }`}
            />
          ))}
        </div>
      </div>

      {/* ③ 右側コントロールボタン群（スマホでもワンタップ操作可能：リトライ・タイトル・音量・ポーズ） */}
      <div className="flex items-center gap-1">
        {/* クイックリトライボタン */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("現在のステージをやり直しますか？")) {
              onRetry();
            }
          }}
          className="w-7 h-7 rounded border border-void-border bg-void-surface text-text-dim hover:text-amber-300 hover:border-amber-400/60 flex items-center justify-center transition-all active:scale-90"
          title="Quick Retry [R]"
        >
          <RotateCcw size={13} />
        </button>

        {/* タイトルへ戻る（中断）ボタン */}
        <button
          type="button"
          onClick={() => {
            if (window.confirm("ゲームを中断してタイトルへ戻りますか？")) {
              onQuitToTitle();
            }
          }}
          className="w-7 h-7 rounded border border-void-border bg-void-surface text-text-dim hover:text-rose-300 hover:border-rose-400/60 flex items-center justify-center transition-all active:scale-90"
          title="Quit to Title [Q]"
        >
          <Home size={13} />
        </button>

        {/* ミュート切り替えボタン */}
        <button
          type="button"
          onClick={onToggleMute}
          className="w-7 h-7 rounded border border-void-border bg-void-surface text-text-dim hover:text-text-primary flex items-center justify-center transition-all active:scale-90"
          title="Mute Toggle [M]"
        >
          {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
        </button>

        {/* ポーズボタン（一時停止） */}
        <button
          type="button"
          onClick={onPause}
          className="w-7 h-7 rounded border border-cyber-cyan/60 bg-cyber-cyan/15 text-cyber-cyan hover:bg-cyber-cyan/25 flex items-center justify-center transition-all active:scale-90"
          title="Pause Game [P / Esc]"
        >
          <Pause size={13} />
        </button>
      </div>
    </div>
  );
};
