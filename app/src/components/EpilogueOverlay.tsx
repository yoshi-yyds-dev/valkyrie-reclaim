/**
 * ============================================================================
 * VOID VANGUARD - 最終エピローグ（フルスクリーン・エンディング画面）(EpilogueOverlay.tsx)
 * ============================================================================
 * 
 * 【全体構成におけるこのコンポーネントの位置づけ】
 * 全10ステージを走破し最終中枢ボス『DEUS EX COSMOS』を撃破したプレイヤーにのみ提示される凱旋画面です。
 * 画面全体の世界観イラスト（epilogue_bg.jpg）とともに、ストーリー、最終スコア、クリアランク（SSS / S / A / B）を表示します。
 * 
 * 【初心者がつまずきやすいポイント：スコアロールアップのアニメーション数学】
 * ➔ スコアを単に数字で置くのではなく、「0 から 120,000 まで数字がパラパラパラ…と勢いよくカウントアップ」する演出を行っています。
 *    ここで使われている計算式 `eased = 1 - Math.pow(1 - progress, 3)` は「Cubic Ease-Out（3次減速）」と呼ばれるもので、
 *    「最初は一瞬で高速回転し、目標スコアに近づくにつれてゆっくりピタッと止まる」という
 *    ゲーム業界やUIデザインで最も気持ち良いとされる定番の物理イージング曲線です。
 */

import React, { useEffect, useState } from "react";
import { RotateCcw, Home } from "lucide-react";
import type { Difficulty } from "../game/types";
import epilogueBg from "../assets/epilogue_bg.jpg";

interface EpilogueOverlayProps {
  score: number;
  lives: number;
  difficulty: Difficulty;
  onRetry: () => void;
  onQuitToTitle: () => void;
  onTypeTick?: () => void;
}

const EPILOGUE_TEXT =
  "敵中枢コア『DEUS EX COSMOS』の完全沈黙を確認。\n" +
  "地球外生命体機甲師団は全宙域より撤退し、宇宙に静寂が戻った。\n\n" +
  "たった一機の戦闘機で人類の危機を救った英雄の翼は、\n" +
  "朝日を浴びて輝く入植惑星へと、静かに帰還していく――。";

/** 難易度と残機数に応じて最終クリアランク（SSS / S / A / B）と表示色を判定する */
function computeClearRank(lives: number, difficulty: Difficulty): { rank: string; colorClass: string } {
  if (difficulty === "HARD" && lives >= 2) {
    return { rank: "SSS", colorClass: "text-amber-300 border-amber-300 shadow-[0_0_20px_rgba(252,211,77,0.6)]" };
  }
  if (lives >= 3) {
    return { rank: "S", colorClass: "text-cyber-cyan border-cyber-cyan shadow-[0_0_16px_rgba(0,243,255,0.5)]" };
  }
  if (lives >= 2) {
    return { rank: "A", colorClass: "text-emerald-300 border-emerald-400" };
  }
  return { rank: "B", colorClass: "text-violet-300 border-violet-400" };
}

export const EpilogueOverlay: React.FC<EpilogueOverlayProps> = ({
  score,
  lives,
  difficulty,
  onRetry,
  onQuitToTitle,
}) => {
  // 1. 画面全体のフェードイン状態と、ロールアップ演出用の表示スコア
  const [visible, setVisible] = useState<boolean>(false);
  const [displayScore, setDisplayScore] = useState<number>(0);
  const { rank, colorClass } = computeClearRank(lives, difficulty);

  // 2. マウント直後の次フレームでフェードインを開始
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // 3. スコアの高速ロールアップ演出（3次イージングで約1.2秒かけて0から最終スコアへ到達）
  useEffect(() => {
    let frameId = 0;
    const start = performance.now();
    const duration = 1200;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(score * eased));
      if (progress < 1) {
        frameId = requestAnimationFrame(tick);
      }
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [score]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-[#04060e] select-none overflow-hidden">
      {/* フルスクリーン背景イラスト */}
      <img
        src={epilogueBg}
        alt="VOID VANGUARD Epilogue"
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* 上下グラデーション */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#04060e]/75 via-transparent to-[#04060e] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-[#04060e] via-[#04060e]/90 to-transparent pointer-events-none" />

      {/* 上部：VICTORY ヘッダー */}
      <div
        className={`relative z-10 p-4 flex items-center justify-between transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div className="px-2.5 py-1 rounded-sm border border-amber-400/70 bg-[#04060e]/75 backdrop-blur-sm">
          <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-amber-300">
            EPILOGUE // ALL 10 SECTORS CLEARED
          </span>
        </div>
      </div>

      {/* 下部：凱旋ストーリー（一気にフェードイン） ＋ 戦績リザルト ＋ 操作ボタン */}
      <div
        className={`relative z-10 p-5 flex flex-col gap-3.5 transition-all duration-1000 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="border-l-2 border-amber-300 pl-3">
          <div className="font-mono text-[10px] tracking-widest text-amber-300 mb-1">
            MISSION COMPLETE // THANK YOU FOR PLAYING
          </div>
          <p className="text-[12px] leading-[1.6] text-slate-100 whitespace-pre-line drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            {EPILOGUE_TEXT}
          </p>
        </div>

        {/* 最終戦績 ＆ クリアランク */}
        <div className="border border-void-border bg-[#070b18]/85 backdrop-blur-sm rounded p-3 flex items-center justify-between">
          <div className="text-left space-y-0.5 font-mono">
            <div className="text-[10px] text-text-dim tracking-wider">FINAL SCORE</div>
            <div className="text-xl font-extrabold text-amber-300 tracking-wider">
              {displayScore.toLocaleString()}
            </div>
            <div className="text-[10px] text-text-dim">
              {difficulty} / LIVES: <span className="text-cyber-cyan">{lives}</span>
            </div>
          </div>

          <div
            className={`w-14 h-14 rounded border-2 flex flex-col items-center justify-center font-mono ${colorClass}`}
          >
            <span className="text-[8px] tracking-widest opacity-80">RANK</span>
            <span className="text-xl font-black leading-none">{rank}</span>
          </div>
        </div>

        {/* 操作ボタン */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="py-2.5 px-3 font-mono text-xs font-bold tracking-wider text-void bg-cyber-cyan hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-1.5"
          >
            <RotateCcw size={14} />
            <span>PLAY AGAIN</span>
          </button>
          <button
            type="button"
            onClick={onQuitToTitle}
            className="py-2.5 px-3 font-mono text-xs font-semibold tracking-wider text-text-primary bg-void-surface/90 border border-void-border hover:border-cyber-cyan hover:text-cyber-cyan active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-1.5"
          >
            <Home size={14} />
            <span>TITLE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
