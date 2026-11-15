/**
 * ============================================================================
 * VOID VANGUARD - ショートカットヘルプモーダル (ShortcutHelpModal.tsx)
 * ============================================================================
 * タイトル画面・ポーズ画面のボタン、またはキーボード [H] / [?] でいつでも開閉できます。
 */

import React from "react";
import { Keyboard, X } from "lucide-react";

interface ShortcutHelpModalProps {
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; desc: string }> = [
  { keys: "↑ ↓ ← → / WASD", desc: "自機の移動（PC）" },
  { keys: "Space / B / X", desc: "緊急回避ボム発動" },
  { keys: "Space / Enter", desc: "ゲーム開始・出撃" },
  { keys: "P / Esc", desc: "ポーズ / 再開" },
  { keys: "R", desc: "クイックリトライ" },
  { keys: "Q / Backspace", desc: "タイトルへ戻る" },
  { keys: "M", desc: "音声ミュート切替" },
  { keys: "H / ?", desc: "このヘルプを開閉" },
];

export const ShortcutHelpModal: React.FC<ShortcutHelpModalProps> = ({ onClose }) => {
  return (
    <div
      onClick={onClose}
      className="absolute inset-0 z-40 bg-[#03050c]/85 backdrop-blur-md flex items-center justify-center p-5"
    >
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
