/**
 * ============================================================================
 * VOID VANGUARD - 開発用検証モードパネル (DevTestPanel.tsx)
 * ============================================================================
 * 任意のステージ（ST.01〜ST.10）・ボス直行・武器種別/レベルを指定して即座に検証開始できます。
 */

import React, { useState } from "react";
import type { WeaponType } from "../game/types";

interface DevTestPanelProps {
  onLaunchDebug: (
    stage: number,
    directBoss: boolean,
    weapon: WeaponType,
    weaponLevel: number
  ) => void;
  onLaunchScene: (scene: "BRIEFING" | "EPILOGUE") => void;
}

export const DevTestPanel: React.FC<DevTestPanelProps> = ({
  onLaunchDebug,
  onLaunchScene,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedStage, setSelectedStage] = useState<number>(1);
  const [directBoss, setDirectBoss] = useState<boolean>(true);
  const [weapon, setWeapon] = useState<WeaponType>("VULCAN");
  const [weaponLevel, setWeaponLevel] = useState<number>(3);

  return (
    <div className="mt-3 text-left">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full py-1.5 px-2 font-mono text-[10px] tracking-wider text-amber-300 bg-amber-500/10 border border-amber-400/40 hover:bg-amber-500/20 rounded-sm transition-all flex items-center justify-between"
      >
        <span>🛠 DEV TEST // 検証モード</span>
        <span>{isOpen ? "▲ CLOSE" : "▼ OPEN"}</span>
      </button>

      {isOpen && (
        <div className="mt-2 p-2.5 bg-void-surface/90 border border-amber-400/40 rounded-sm space-y-2.5 text-[10px] font-mono">
          {/* ステージ選択 (1〜10) */}
          <div>
            <div className="text-text-dim mb-1">STAGE SELECT (ST.01 - ST.10)</div>
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 10 }, (_, idx) => idx + 1).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStage(st)}
                  className={`py-1 rounded-sm border font-bold transition-all ${
                    selectedStage === st
                      ? "border-amber-400 bg-amber-400/25 text-amber-200"
                      : "border-void-border bg-void text-text-dim hover:text-white"
                  }`}
                >
                  {String(st).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          {/* 開始位置（道中 / ボス直行） */}
          <div>
            <div className="text-text-dim mb-1">START POINT</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setDirectBoss(false)}
                className={`py-1 rounded-sm border font-bold ${
                  !directBoss
                    ? "border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan"
                    : "border-void-border bg-void text-text-dim"
                }`}
              >
                道中から
              </button>
              <button
                type="button"
                onClick={() => setDirectBoss(true)}
                className={`py-1 rounded-sm border font-bold ${
                  directBoss
                    ? "border-rose-500 bg-rose-500/20 text-rose-300"
                    : "border-void-border bg-void text-text-dim"
                }`}
              >
                ボス戦直行
              </button>
            </div>
          </div>

          {/* 武器種別 & レベル */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-text-dim mb-1">WEAPON</div>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { id: "VULCAN", label: "V" },
                    { id: "MISSILE", label: "M" },
                    { id: "HOMING", label: "H" },
                  ] as const
                ).map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => setWeapon(w.id)}
                    className={`py-1 rounded-sm border font-bold ${
                      weapon === w.id
                        ? "border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan"
                        : "border-void-border bg-void text-text-dim"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-text-dim mb-1">LEVEL</div>
              <div className="grid grid-cols-5 gap-0.5">
                {[1, 2, 3, 4, 5].map((lv) => (
                  <button
                    key={lv}
                    type="button"
                    onClick={() => setWeaponLevel(lv)}
                    className={`py-1 rounded-sm border font-bold ${
                      weaponLevel === lv
                        ? "border-cyber-cyan bg-cyber-cyan/20 text-cyber-cyan"
                        : "border-void-border bg-void text-text-dim"
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onLaunchDebug(selectedStage, directBoss, weapon, weaponLevel)}
            className="w-full py-2 font-bold tracking-widest text-void bg-amber-400 hover:brightness-110 active:scale-95 transition-all rounded-sm"
          >
            TEST LAUNCH // 検証出撃
          </button>

          {/* ストーリー演出プレビュー（プロローグ / エピローグ） */}
          <div className="pt-1.5 border-t border-void-border">
            <div className="text-text-dim mb-1">STORY PREVIEW</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onLaunchScene("BRIEFING")}
                className="py-1.5 rounded-sm border border-cyber-cyan/50 bg-cyber-cyan/10 text-cyber-cyan font-bold hover:bg-cyber-cyan/20 active:scale-95 transition-all"
              >
                プロローグ確認
              </button>
              <button
                type="button"
                onClick={() => onLaunchScene("EPILOGUE")}
                className="py-1.5 rounded-sm border border-amber-400/50 bg-amber-400/10 text-amber-300 font-bold hover:bg-amber-400/20 active:scale-95 transition-all"
              >
                エピローグ確認
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
