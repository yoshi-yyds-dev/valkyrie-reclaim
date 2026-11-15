/**
 * ============================================================================
 * VOID VANGUARD - プロローグ（フルスクリーン・ストーリー画面）コンポーネント
 * ============================================================================
 * 画面全体を使った世界観イラスト（prologue_bg.jpg）を背景に表示し、
 * バックグラウンドシナリオをフェードインで提示した上で「START MISSION // 出撃する」ボタンで戦闘を開始します。
 */

import React, { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import prologueBg from "../assets/prologue_bg.jpg";

interface BriefingOverlayProps {
  onComplete: () => void;
  onTypeTick?: () => void;
}

const PROLOGUE_TEXT =
  "時は近未来――西暦2184年。\n" +
  "多くの人類が地球外の入植惑星へ移住し、新たな生活圏を築いていた。\n" +
  "しかしある日、謎の地球外生命体機甲師団が突然侵入を開始する。\n" +
  "防衛線は次々と突破され、人類はかつてない存亡の危機に瀕した。\n\n" +
  "研究者たちは科学の粋を結集し、最新鋭迎撃機『VF-01 VALKYRIE』を開発。\n" +
  "だがその超機動は、誰にでも操れるものではなかった。\n" +
  "一人の戦士が立ち上がり、機体へと乗り込む――今、反撃の翼が飛び立つ。";

export const BriefingOverlay: React.FC<BriefingOverlayProps> = ({
  onComplete,
}) => {
  const [visible, setVisible] = useState<boolean>(false);

  // マウント直後にフェードインを開始
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Space / Enter キーで即座に出撃開始
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        onComplete();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onComplete]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between bg-[#04060e] select-none overflow-hidden">
      {/* フルスクリーン背景イラスト */}
      <img
        src={prologueBg}
        alt="VOID VANGUARD Prologue"
        className={`absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-700 ease-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* 上下グラデーション（イラストを見せつつ文字の視認性を確保） */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#04060e]/70 via-transparent to-[#04060e] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-[#04060e] via-[#04060e]/90 to-transparent pointer-events-none" />

      {/* 上部：PROLOGUE ヘッダー */}
      <div
        className={`relative z-10 p-4 flex items-center justify-between transition-all duration-700 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
        }`}
      >
        <div className="px-2.5 py-1 rounded-sm border border-cyber-cyan/60 bg-[#04060e]/75 backdrop-blur-sm">
          <span className="font-mono text-[10px] font-bold tracking-[0.22em] text-cyber-cyan">
            PROLOGUE // A.D. 2184
          </span>
        </div>
      </div>

      {/* 下部：物語テキスト（一気にフェードイン） ＋ 出撃開始ボタン */}
      <div
        className={`relative z-10 p-5 flex flex-col gap-4 transition-all duration-1000 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="border-l-2 border-cyber-cyan pl-3">
          <div className="font-mono text-[10px] tracking-widest text-rose-400 mb-1.5">
            EMERGENCY INTERCEPT // VF-01 VALKYRIE
          </div>
          <p className="text-[12px] leading-[1.65] font-sans text-slate-100 whitespace-pre-line drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
            {PROLOGUE_TEXT}
          </p>
        </div>

        <button
          type="button"
          onClick={onComplete}
          className="w-full py-3.5 font-mono text-xs font-bold tracking-[0.18em] text-void bg-cyber-cyan border border-cyber-cyan shadow-[0_0_20px_rgba(0,243,255,0.55)] hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm flex items-center justify-center gap-2"
        >
          <Rocket size={15} />
          <span>START MISSION // 出撃する</span>
        </button>
      </div>
    </div>
  );
};
