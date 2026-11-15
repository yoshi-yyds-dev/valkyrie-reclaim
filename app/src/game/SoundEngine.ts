/**
 * ============================================================================
 * VOID VANGUARD - サウンドエンジン (SoundEngine.ts)
 * ============================================================================
 * 
 * 【開発者向けナレッジ：Web Audio API による波形合成】
 * 外部の MP3 や WAV ファイルを使わず、ブラウザ標準の「デジタルシンセサイザー機能」を
 * プログラムで直接制御して効果音（SE）を作り出します。
 * 
 * ★メリット：
 * 1. ファイル容量が完全 0KB（ダウンロード待機ゼロ）
 * 2. 発音遅延（レイテンシ）がゼロ（弾を撃った瞬間に即鳴る）
 * 3. 著作権侵害のリスクが 100% ゼロ
 */

export class SoundEngine {
  /** ブラウザのオーディオ機能の心臓部（音を鳴らすキャンバスのようなもの） */
  private ctx: AudioContext | null = null;
  /** ミュート（消音）状態フラグ */
  public muted: boolean = false;
  /** BGM シーケンサー管理用 */
  private bgmTimer: number | null = null;
  private bgmStep: number = 0;
  private bgmTrack: "NORMAL" | "BOSS" | null = null;
  /** ドラム音（スネア・ハイハット）で再利用するノイズバッファ */
  private drumNoiseBuffer: AudioBuffer | null = null;

  /**
   * 【スマホの「音が出ない制限（Autoplay Policy）」を解除するメソッド】
   * 
   * iPhone (Safari) や Android (Chrome) は、ユーザーが画面を1回タップするまで、
   * 勝手に音を鳴らすことをOSレベルで禁止（AudioContext を suspended に）しています。
   * タイトル画面の「TOUCH TO SORTIE」ボタンを押した瞬間にこのメソッドを呼ぶことで、
   * 音声をアンロックして正常に鳴らせるようにします。
   */
  public unlock(): void {
    if (!this.ctx) {
      // 古い Safari 向けの webkitAudioContext にも互換対応
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    // 一時停止状態なら再開（アンロック）
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  /** 音声のミュートON/OFF切り替え */
  public toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * 【自機通常ショット音】
   * 
   * 仕組み：
   * 1. Oscillator（発振器）で澄んだ「サイン波（sine）」を作る
   * 2. 周波数を「880Hz（高いラ）➔ 220Hz（低いラ）」へわずか 0.06秒で急降下させる
   * 3. GainNode（ボリュームつまみ）で音量を一瞬でゼロにフェードアウト
   * ➔ これにより、レトロゲーム特有の軽快な「ピシュン！」というレーザー音が完成します。
   */
  public playShot(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    // 音の発生源（波形）を作る
    const osc = this.ctx.createOscillator();
    // 音量調節ノードを作る
    const gain = this.ctx.createGain();

    osc.type = "sine";
    // 0.06秒間で周波数を指数関数的に急降下（人間の耳に自然なレーザー感になる）
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.06);

    // 音量のフェードアウト（クリックノイズ＝ブツッという雑音を防ぐ）
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    // 回路の接続：発振器 ➔ 音量調整 ➔ スピーカー(destination)
    osc.connect(gain);
    gain.connect(this.ctx.destination);

    // 再生開始と自動停止
    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * 【敵撃破・爆発音】
   * 
   * 仕組み：
   * 1. 乱数（Math.random）を使って「完全なホワイトノイズ（テレビの砂嵐音）」をメモリ上に生成
   * 2. BiquadFilter（フィルター）の「ローパス（低音通過）」を使い、高いシャカシャカ音をカット
   * 3. 0.22秒かけて音量をスッと下げる
   * ➔ これにより、腹に響くドッシリとした「ドォォン！」という爆発音になります。
   */
  public playExplosion(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.22; // 爆発の長さ（秒）

    // 0.22秒分の音声バッファ（メモリ領域）を確保
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // -1.0 から +1.0 までの乱数を敷き詰めて「ホワイトノイズ」を自作
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // ローパスフィルターで低音だけを響かせる
    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(100, now + duration);

    // 音量フェードアウト
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // 接続：ノイズ音源 ➔ フィルター ➔ 音量調整 ➔ スピーカー
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
  }

  /**
   * 【出撃開始・起動音】
   * 
   * 三角波（triangle）を低い音から高い音へ上昇させることで、
   * 「システムの起動・出撃」を感じさせる近未来的な効果音を作ります。
   */
  public playStart(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    // 330Hz ➔ 660Hz へ周波数を上昇
    osc.frequency.setValueAtTime(330, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.25);
  }

  /**
   * 【自機被弾・シールドダメージ音】
   * 
   * 仕組み：
   * 「ノコギリ波（sawtooth）」という倍音を多く含むザラザラした波形を使い、
   * 160Hz から 60Hz へ急降下させることで、緊急事態を知らせる
   * 「ガシィン！／ブザー！」という危険な手応えのある音を作ります。
   */
  public playHit(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.18);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  /**
   * 【ゲームオーバー・システムシャットダウン音】
   * 
   * 高い音から低い音へ 0.6秒かけてゆっくり落ちていくことで、
   * 「機体の電源が落ちた（敗北）」という雰囲気を演出します。
   */
  public playGameOver(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "triangle";
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.6);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.6);
  }

  /**
   * 【パワーアップ・アイテム取得音】
   * 
   * 正弦波（sine）で「ド・ミ・ソ・ド」のような明るい上昇アルペジオを
   * 素早く鳴らすことで、強化・回復した爽快感を演出します。
   */
  public playPowerUp(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const start = now + idx * 0.045;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.14);
    });
  }

  /**
   * 【緊急回避ボム発動音】
   * 
   * 重低音の衝撃波（sawtooth 180Hz→35Hz）と、広がりのあるノイズ爆発を
   * 0.55秒かけて鳴らし、画面全体を一掃する爽快感と迫力を表現します。
   */
  public playBomb(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;
    const duration = 0.55;

    // 1. 重低音ショックウェーブ
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + duration);
    oscGain.gain.setValueAtTime(0.25, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(oscGain);
    oscGain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);

    // 2. 広がる爆風ノイズ
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(120, now + duration);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.28, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noise.start(now);
  }

  /**
   * 【ボス接近警報サイレン（WARNING）】
   * 
   * 矩形波（square）で緊張感のある高低2音の警戒アラートを2回鳴らし、
   * 強敵ボスの出現をプレイヤーに予告します。
   */
  public playWarning(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    for (let i = 0; i < 2; i++) {
      const start = now + i * 0.45;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(680, start);
      osc.frequency.setValueAtTime(480, start + 0.18);

      gain.gain.setValueAtTime(0.08, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.36);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(start);
      osc.stop(start + 0.36);
    }
  }

  /**
   * 【ブリーフィング・タイピング電子音】
   * 
   * 通信テキストが1文字ずつ表示されるたびに鳴る極小の電子クリック音です。
   * 0.025秒という極めて短い正弦波を使うことで、耳障りにならずSF通信機の臨場感を出します。
   */
  public playTyping(): void {
    if (this.muted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(1100, now);

    gain.gain.setValueAtTime(0.035, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.025);
  }

  // --------------------------------------------------------------------------
  // Web Audio シンセサイザー BGM（4小節・64ステップ・マルチトラック構成）
  // --------------------------------------------------------------------------

  /**
   * 【シンセサイザー BGM の再生開始】
   * 外部 MP3 を使わず、64ステップ（4小節ループ）のコード進行に合わせて
   * 1. ドラム（キック＋スネア＋ハイハット）
   * 2. オクターブ奏法の16ビート・ベース
   * 3. メロディック・リード
   * 4. 空間を埋めるシンセパッド和音
   * をリアルタイム合成し、迫力あるスペースSTGサウンドを奏でます。
   */
  public playBgm(track: "NORMAL" | "BOSS"): void {
    if (this.bgmTrack === track && this.bgmTimer !== null) return;
    this.stopBgm();
    this.bgmTrack = track;
    this.bgmStep = 0;

    // NORMAL: 114ms (BPM約131) / BOSS: 100ms (BPM150) で疾走感と緊張感を両立
    const stepMs = track === "BOSS" ? 100 : 114;
    this.bgmTimer = window.setInterval(() => {
      this.stepBgm();
    }, stepMs);
  }

  /** BGM の停止 */
  public stopBgm(): void {
    if (this.bgmTimer !== null) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    this.bgmTrack = null;
  }

  /** ドラム用ホワイトノイズバッファを1度だけ生成して再利用 */
  private ensureDrumBuffer(): AudioBuffer | null {
    if (!this.ctx) return null;
    if (!this.drumNoiseBuffer) {
      const len = Math.floor(this.ctx.sampleRate * 0.15);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.drumNoiseBuffer = buf;
    }
    return this.drumNoiseBuffer;
  }

  /** 1ステップ（16分音符）分のマルチトラック発音 */
  private stepBgm(): void {
    if (this.muted || !this.ctx || !this.bgmTrack) return;
    if (this.ctx.state === "suspended") return;

    const now = this.ctx.currentTime;
    const step64 = this.bgmStep % 64;     // 4小節（64ステップ）ループ
    const bar = Math.floor(step64 / 16);  // 現在の小節（0 〜 3）
    const step = step64 % 16;             // 小節内の位置（0 〜 15）
    this.bgmStep += 1;

    const isBoss = this.bgmTrack === "BOSS";

    // --- 1. ドラムセクション（キック / スネア / ハイハット） ---
    // キック（4つ打ち ＋ BOSS戦は裏拍アクセント追加）
    if (step % 4 === 0 || (isBoss && step === 14)) {
      const kick = this.ctx.createOscillator();
      const kickGain = this.ctx.createGain();
      kick.type = "sine";
      kick.frequency.setValueAtTime(140, now);
      kick.frequency.exponentialRampToValueAtTime(36, now + 0.1);
      kickGain.gain.setValueAtTime(0.13, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      kick.connect(kickGain);
      kickGain.connect(this.ctx.destination);
      kick.start(now);
      kick.stop(now + 0.11);
    }

    // スネア（小節の2拍目・4拍目：ステップ 4, 12 ＋ 4小節目末にフィルイン）
    const isSnareHit = step === 4 || step === 12 || (bar === 3 && (step === 14 || step === 15));
    if (isSnareHit) {
      const buf = this.ensureDrumBuffer();
      if (buf) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(900, now);
        const sGain = this.ctx.createGain();
        sGain.gain.setValueAtTime(step === 4 || step === 12 ? 0.08 : 0.05, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
        noise.connect(hp);
        hp.connect(sGain);
        sGain.connect(this.ctx.destination);
        noise.start(now);
        noise.stop(now + 0.11);
      }
    }

    // ハイハット（奇数・裏拍を中心に刻んで疾走感を出す）
    if (step % 2 === 1 || isBoss) {
      const buf = this.ensureDrumBuffer();
      if (buf) {
        const hh = this.ctx.createBufferSource();
        hh.buffer = buf;
        const hp = this.ctx.createBiquadFilter();
        hp.type = "highpass";
        hp.frequency.setValueAtTime(6500, now);
        const hhGain = this.ctx.createGain();
        hhGain.gain.setValueAtTime(step % 4 === 2 ? 0.025 : 0.014, now);
        hhGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
        hh.connect(hp);
        hp.connect(hhGain);
        hhGain.connect(this.ctx.destination);
        hh.start(now);
        hh.stop(now + 0.035);
      }
    }

    // --- 2. コード進行ルート音（NORMAL: Am-F-G-Em / BOSS: Cm-Ab-Bb-G） ---
    const normalRoots = [110.0, 87.31, 98.0, 82.41];    // A2, F2, G2, E2
    const bossRoots = [130.81, 103.83, 116.54, 98.0];  // C3, Ab2, Bb2, G2
    const rootFreq = isBoss ? bossRoots[bar] : normalRoots[bar];

    // 4小節の変わり目（小節頭）で空間を広げるシンセパッド和音を鳴らす
    if (step === 0) {
      for (const ratio of [1, 1.5]) {
        const pad = this.ctx.createOscillator();
        const padGain = this.ctx.createGain();
        pad.type = "triangle";
        pad.frequency.setValueAtTime(rootFreq * 2 * ratio, now);
        padGain.gain.setValueAtTime(0.022, now);
        padGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
        pad.connect(padGain);
        padGain.connect(this.ctx.destination);
        pad.start(now);
        pad.stop(now + 1.5);
      }
    }

    // --- 3. 16ビート・オクターブベース（ルートと1オクターブ上を交互にドライブ） ---
    const bassMult = step % 4 === 2 ? 2 : 1;
    const bass = this.ctx.createOscillator();
    const bassFilter = this.ctx.createBiquadFilter();
    const bassGain = this.ctx.createGain();
    bass.type = "sawtooth";
    bass.frequency.setValueAtTime(rootFreq * bassMult, now);
    bassFilter.type = "lowpass";
    bassFilter.frequency.setValueAtTime(isBoss ? 680 : 480, now);
    bassGain.gain.setValueAtTime(0.052, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
    bass.connect(bassFilter);
    bassFilter.connect(bassGain);
    bassGain.connect(this.ctx.destination);
    bass.start(now);
    bass.stop(now + 0.095);

    // --- 4. メロディック・リード（小節ごとに展開する8ステップフレーズ） ---
    if (step % 2 === 0) {
      const normalLeads = [
        [440.0, 523.25, 659.25, 523.25, 587.33, 659.25, 783.99, 659.25], // Am
        [349.23, 440.0, 523.25, 440.0, 523.25, 587.33, 698.46, 587.33],  // F
        [392.0, 493.88, 587.33, 493.88, 587.33, 659.25, 783.99, 659.25], // G
        [329.63, 392.0, 493.88, 392.0, 493.88, 587.33, 659.25, 587.33],  // Em
      ];
      const bossLeads = [
        [523.25, 622.25, 783.99, 622.25, 698.46, 783.99, 932.33, 783.99], // Cm
        [415.30, 523.25, 622.25, 523.25, 622.25, 698.46, 830.61, 698.46], // Ab
        [466.16, 587.33, 698.46, 587.33, 698.46, 783.99, 932.33, 783.99], // Bb
        [392.0, 493.88, 587.33, 698.46, 783.99, 698.46, 587.33, 493.88],  // G7
      ];
      const leadFreq = isBoss ? bossLeads[bar][step / 2] : normalLeads[bar][step / 2];

      const lead = this.ctx.createOscillator();
      const leadGain = this.ctx.createGain();
      lead.type = isBoss ? "square" : "triangle";
      lead.frequency.setValueAtTime(leadFreq, now);
      leadGain.gain.setValueAtTime(isBoss ? 0.024 : 0.036, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      lead.connect(leadGain);
      leadGain.connect(this.ctx.destination);
      lead.start(now);
      lead.stop(now + 0.14);
    }
  }
}
