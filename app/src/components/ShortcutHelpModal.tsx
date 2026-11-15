/**
 * ============================================================================
 * VOID VANGUARD - ショートカットヘルプモーダル (ShortcutHelpModal.tsx)
 * ============================================================================
 * 
 * 【全体構成におけるこのコンポーネントの位置づけ】
 * タイトル画面やポーズ画面の「?」ボタン、または戦闘中いつでもキーボードの [H] や [?] を押すことで、
 * ゲーム画面の最前面（z-40）にポップアップ表示される操作ガイドです。
 * 戦闘中に開いた場合は、プレイヤーが被弾しないよう自動的にポーズ（一時停止）がかかる設計になっています。
 * 
 * 【初心者がつまずきやすいポイント：なぜ e.stopPropagation() が必要なのか？】
 * ➔ モーダルの「黒い半透明の背景（バックドロップ）」をクリックした時にモーダルを閉じたい場合、
 *    背景要素に `onClick={onClose}` を付けます。
 *    しかし、JavaScript のイベントは「子の要素をクリックしても、親要素へと上向きに伝播する（イベントバブリング）」
 *    という性質があるため、モーダル内の文字やカードをクリックした時まで背景の `onClose` が発火して勝手に閉じてしまいます。
 *    内側のコンテナに `onClick={(e) => e.stopPropagation()}` を書くことで、
 *    「モーダル内部のクリックイベントは親の背景へ伝えない」という遮断壁を作り、誤閉じを防いでいます。
 */

import React from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutHelpModalProps {
  onClose: () => void;
}

// 1. モーダル内に一覧表示するキーボードショートカット定義テーブル
const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: "↑ ↓ ← → / WASD", desc: "自機の移動（PC）" },
  { keys: "Space / B / X", desc: "緊急回避ボム発動" },
  { keys: "Space / Enter", desc: "ゲーム開始・出撃" },
  { keys: "P / Esc", desc: "ポーズ / 再開" },
  { keys: "R", desc: "クイックリトライ" },
  { keys: "Q / Backspace", desc: "タイトルへ戻る（戦闘中断）" },
  { keys: "Esc × 2回", desc: "ゲーム自体を終了する" },
  { keys: "M", desc: "音声ミュート切替" },
  { keys: "H / ?", desc: "このヘルプを開閉" },
];

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ onClose }) => {
  return (
    /* 2. 背景オーバーレイ（クリックでモーダルを閉じる） */
    <div
      onClick={onClose}
      className="absolute inset-0 z-40 bg-[#03050c]/85 backdrop-blur-md flex items-center justify-center p-5"
    >
      {/* 3. モーダル本体（内部クリックのバブリングを止めて誤閉じを防止） */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[310px] bg-void-panel border border-cyber-cyan p-5 shadow-[0_0_24px_rgba(0,243,255,0.28)] clip-chamfer"
      >
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-void-border">
          <div className="flex items-center gap-2 text-cyber-cyan font-mono text-xs font-bold tracking-widest">
            <Keyboard size={15} />
            <span>KEY SHORTCUTS</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-text-dim hover:text-white transition-colors"
            title="Close (H / Esc)"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-2 text-[11px]">
          {SHORTCUTS.map((item) => (
            <div
              key={item.keys}
              className="flex items-center justify-between gap-2 py-1 border-b border-void-border/40 last:border-b-0"
            >
              <kbd className="px-1.5 py-0.5 rounded-sm bg-void-surface border border-cyber-cyan/40 text-cyber-cyan font-mono text-[10px] font-bold whitespace-nowrap">
                {item.keys}
              </kbd>
              <span className="text-text-primary text-right">{item.desc}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full py-2 font-mono text-xs font-bold tracking-widest text-void bg-cyber-cyan hover:brightness-110 active:scale-95 transition-all clip-chamfer-sm"
        >
          CLOSE // 閉じる
        </button>
      </div>
    </div>
  );
};
