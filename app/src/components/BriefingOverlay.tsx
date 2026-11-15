/**
 * ============================================================================
 * VOID VANGUARD - プロローグ（フルスクリーン・ストーリー画面）コンポーネント (BriefingOverlay.tsx)
 * ============================================================================
 * 
 * 【全体構成におけるこのコンポーネントの位置づけ】
 * タイトル画面で「TOUCH TO SORTIE」または Space/Enter キーを押した直後、status = "BRIEFING" に遷移し、
 * 戦闘開始前の世界観プロローグをプレイヤーに提示する演出レイヤー（z-20）です。
 * 背景には AI 生成した宇宙防衛線の世界観イラスト（prologue_bg.jpg）を敷き、
 * 「START MISSION // 出撃する」ボタンまたは Space / Enter キーで即座に戦闘フェーズ（PLAYING）へ進みます。
 * 
 * 【初心者がつまずきやすいポイント：なぜ window.addEventListener のクリーンアップが必須なのか？】
 * ➔ `useEffect` 内で `window.addEventListener("keydown", ...)` を登録した場合、
 *    コンポーネントが破棄（アンマウント）された時に `removeEventListener` で解除しないと、
 *    戦闘フェーズやタイトル画面に戻った後もリスナーが残り続け、キーを押すたびに二重・三重に
 *    関数が実行されてしまう重大なバグ（イベントリスナーのリーク）が発生します。
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
  "人類は太陽系を超え、数多の地球外入植惑星へと生活圏を広げていた。\n" +
  "蒼い空と豊かな資源に恵まれた新天地で、新たな文明が静かに花開いていたのだ。\n\n" +
  "しかし、その平穏は突如として打ち砕かれる。\n" +
  "外宇宙の深淵より現れた正体不明の地球外生命体機甲師団が、全宙域へ侵攻を開始した。\n" +
  "軌道防衛艦隊は圧倒的な物量と未知のエネルギー兵器の前に次々と沈黙し、\n" +
  "衛星防衛網はわずか数日で崩壊。人類はかつてない存亡の危機に直面する。\n\n" +
  "絶望が迫る中、統合科学局は封印されていた極秘計画を解放する。\n" +
  "科学技術のすべてを結集して生み出された、超機動迎撃機『VF-01 VALKYRIE』。\n" +
  "だが、次元跳躍にも似たその極限の機動性と出力は、常人の身体では到底耐えられないものだった。\n\n" +
  "それでも、守るべき星と人々の未来のために――一人の戦士がコックピットへと乗り込む。\n" +
  "エンジンが蒼い光を放ち、発進カタパルトが静かにロックを解除した。\n" +
  "人類最後の希望を乗せ、今、反撃の翼が大空へと飛び立つ――。";

export const BriefingOverlay: React.FC<BriefingOverlayProps> = ({
  onComplete,
}) => {
  // 1. フェードインアニメーションのトリガー状態
  const [visible, setVisible] = useState<boolean>(false);

  // 2. マウント直後の次フレームで visible=true に切り替え、背景・テキストを滑らかにフェードイン
  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // 3. Space / Enter キー押下でも出撃ボタンと同様に戦闘フェーズへ進めるようリスナー登録
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

      {/* 下部：物語テキスト（下から上へゆっくりスクロール） ＋ 出撃開始ボタン */}
      <div
        className={`relative z-10 p-5 flex flex-col gap-4 transition-all duration-1000 ease-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        <div className="border-l-2 border-cyber-cyan pl-3.5">
          <div className="font-mono text-[11px] font-bold tracking-widest text-rose-400 mb-2">
            EMERGENCY INTERCEPT // VF-01 VALKYRIE
          </div>
          {/* スクロール表示ウィンドウ（上下端をフェードマスクし、中の文章を下から上へ流す） */}
          <div className="h-[235px] overflow-hidden story-scroll-mask relative">
            <p className="animate-story-crawl text-[15px] leading-[1.85] font-medium font-sans text-slate-100 whitespace-pre-line drop-shadow-[0_2px_6px_rgba(0,0,0,0.95)]">
              {PROLOGUE_TEXT}
            </p>
          </div>
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
