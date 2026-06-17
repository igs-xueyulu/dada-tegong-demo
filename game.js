/* ============================================================
   鍣犲櫊鐗规敾 姗熷埗寰╁埢 Demo锛堥潪瀹樻柟锛岀編琛撶殕鐐虹▼寮忓師鍓电躬瑁斤級
   鐜╂硶锛氭悥妗跨Щ鍕曘€佽嚜鍕曟敾鎿娿€佹捒缍撻鍗囩礆涓夐伕涓€銆佹檪闁撳埌鎵?BOSS
   ============================================================ */
'use strict';

/* ---------------- 灏忓伐鍏?---------------- */
const $ = id => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const irand = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };
const fmtT = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
function hash2(cx, cy) { let h = cx * 374761393 + cy * 668265263; h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16); return Math.abs(h); }
function pickWeighted(w) { let tot = 0; for (const k in w) tot += w[k]; let r = Math.random() * tot; for (const k in w) { r -= w[k]; if (r <= 0) return k; } return Object.keys(w)[0]; }

/* ---------------- 闊虫晥锛圵ebAudio 鍚堟垚锛岀劇绱犳潗锛?---------------- */
let AC = null, soundOn = localStorage.getItem('ddtg_sound') !== '0';
const sfxLast = {};
function sfx(name) {
  if (!soundOn) return;
  const now = performance.now();
  if (sfxLast[name] && now - sfxLast[name] < 70) return;
  sfxLast[name] = now;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime;
    const P = {
      shoot: [760, .045, 'square', .025], hit: [170, .05, 'sawtooth', .04],
      pick: [900, .06, 'sine', .05], lvl: [523, .32, 'triangle', .12],
      boom: [85, .3, 'sawtooth', .16], hurt: [130, .16, 'square', .12],
      chest: [660, .28, 'triangle', .1], boss: [58, .9, 'sawtooth', .2],
      win: [784, .55, 'triangle', .14], lose: [220, .7, 'sawtooth', .12],
      zap: [1200, .08, 'square', .05]
    }[name] || [440, .1, 'sine', .05];
    const o = AC.createOscillator(), g = AC.createGain();
    o.connect(g); g.connect(AC.destination);
    o.type = P[2]; o.frequency.setValueAtTime(P[0], t);
    if (name === 'lvl' || name === 'win' || name === 'chest' || name === 'pick') o.frequency.exponentialRampToValueAtTime(P[0] * 2, t + P[1]);
    if (name === 'boss' || name === 'lose' || name === 'boom') o.frequency.exponentialRampToValueAtTime(Math.max(30, P[0] * .4), t + P[1]);
    g.gain.setValueAtTime(P[3], t); g.gain.exponentialRampToValueAtTime(.0001, t + P[1]);
    o.start(t); o.stop(t + P[1] + .02);
  } catch (e) { /* 鐒￠煶鏁堢挵澧冨拷鐣?*/ }
}

/* ---------------- Skills ---------------- */
const SPLASH_PROC_CHANCE = .18;
const SPLASH_PROC_RADIUS = 72;
const SPLASH_PROC_DMG_RATIO = .45;
function effectBonus() { return player && player.skills && player.skills.p_multi ? 1 : 0; }
function effectCount(n) { return Math.max(1, Math.round((n || 1) + effectBonus())); }
function splashProcChance() { return player && player.skills && player.skills.p_splash ? SPLASH_PROC_CHANCE : 0; }
const SKILLS = {
  knife: { name: '高速子彈', icon: 'knife', max: 5,
    lv: [{ cnt: 1, dmg: 12, cd: .5 }, { cnt: 2, dmg: 13, cd: .5 }, { cnt: 2, dmg: 17, cd: .44 }, { cnt: 3, dmg: 20, cd: .42 }, { cnt: 4, dmg: 24, cd: .36 }],
    desc: l => `向最近敵人連射 ${effectCount(l.cnt)} 發高速子彈，每發 ${l.dmg} 傷害` },
  guard: { name: '守護光球', icon: 'guard', max: 5,
    lv: [{ n: 2, dmg: 10, r: 70, sp: 2.6 }, { n: 3, dmg: 12, r: 74, sp: 2.8 }, { n: 3, dmg: 16, r: 84, sp: 3.0 }, { n: 4, dmg: 20, r: 92, sp: 3.2 }, { n: 5, dmg: 26, r: 102, sp: 3.5 }],
    desc: l => `${effectCount(l.n)} 顆光球繞身旋轉，碰觸造成 ${l.dmg} 傷害` },
  drill: { name: '穿甲鑽頭', icon: 'drill', max: 5,
    lv: [{ cnt: 1, dmg: 16, cd: 4 }, { cnt: 1, dmg: 22, cd: 3.6 }, { cnt: 2, dmg: 22, cd: 3.6 }, { cnt: 2, dmg: 30, cd: 3.2 }, { cnt: 3, dmg: 38, cd: 2.8 }],
    desc: l => `發射 ${effectCount(l.cnt)} 枚會反彈的穿透鑽頭（${l.dmg} 傷害）` },
  molotov: { name: '燃燒瓶', icon: 'molotov', max: 5,
    lv: [{ cnt: 1, dmg: 7, r: 56, cd: 3.6 }, { cnt: 2, dmg: 8, r: 56, cd: 3.4 }, { cnt: 2, dmg: 10, r: 66, cd: 3.2 }, { cnt: 3, dmg: 12, r: 72, cd: 3.0 }, { cnt: 4, dmg: 15, r: 82, cd: 2.8 }],
    desc: l => `丟出 ${effectCount(l.cnt)} 個燃燒瓶，留下火海持續灼燒（每跳 ${l.dmg}）` },
  thunder: { name: '落雷裝置', icon: 'thunder', max: 5,
    lv: [{ n: 2, dmg: 30, cd: 3.2 }, { n: 3, dmg: 38, cd: 3.0 }, { n: 4, dmg: 46, cd: 2.8 }, { n: 5, dmg: 60, cd: 2.6 }, { n: 7, dmg: 80, cd: 2.2 }],
    desc: l => `召喚閃電隨機打擊 ${effectCount(l.n)} 個敵人（${l.dmg} 傷害並短暫麻痺）` },
  drone: { name: '攻擊無人機', icon: 'drone', max: 5,
    lv: [{ n: 1, dmg: 14 }, { n: 1, dmg: 20 }, { n: 2, dmg: 20 }, { n: 2, dmg: 28 }, { n: 3, dmg: 34 }],
    desc: l => `${effectCount(l.n)} 台無人機伴飛，自動射擊最近敵人（${l.dmg} 傷害）` },
  field: { name: '防護力場', icon: 'field', max: 5,
    lv: [{ r: 80, dmg: 5 }, { r: 88, dmg: 7 }, { r: 96, dmg: 9 }, { r: 108, dmg: 11 }, { r: 124, dmg: 14 }],
    desc: l => `展開半徑 ${l.r} 的力場，持續灼傷並擊退範圍內敵人` },
  boomer: { name: '迴旋鏢', icon: 'boomer', max: 5,
    lv: [{ cnt: 1, dmg: 18, cd: 2.8 }, { cnt: 1, dmg: 24, cd: 2.6 }, { cnt: 2, dmg: 28, cd: 2.6 }, { cnt: 2, dmg: 34, cd: 2.4 }, { cnt: 3, dmg: 40, cd: 2.2 }],
    desc: l => `擲出 ${effectCount(l.cnt)} 個穿透迴旋鏢，去程回程皆造成 ${l.dmg} 傷害` },
  laser: { name: '貫穿雷射', icon: 'laser', max: 5,
    lv: [{ n: 1, dmg: 20, cd: 2.6 }, { n: 1, dmg: 28, cd: 2.4 }, { n: 2, dmg: 30, cd: 2.2 }, { n: 2, dmg: 38, cd: 2.0 }, { n: 3, dmg: 46, cd: 1.8 }],
    desc: l => `向最近敵人發射 ${effectCount(l.n)} 道貫穿光束，沿途所有敵人受 ${l.dmg} 傷害` },
  missile: { name: '追蹤飛彈', icon: 'missile', max: 5,
    lv: [{ cnt: 1, dmg: 22, cd: 2.6, r: 48 }, { cnt: 2, dmg: 24, cd: 2.6, r: 48 }, { cnt: 2, dmg: 30, cd: 2.4, r: 54 }, { cnt: 3, dmg: 34, cd: 2.2, r: 58 }, { cnt: 4, dmg: 40, cd: 2.0, r: 64 }],
    desc: l => `升空 ${effectCount(l.cnt)} 枚追蹤飛彈鎖定敵人，命中爆炸造成 ${l.dmg} 範圍傷害` },
  mine: { name: '感應地雷', icon: 'mine', max: 5,
    lv: [{ cnt: 1, dmg: 34, cd: 3.2, r: 78, cap: 4 }, { cnt: 1, dmg: 44, cd: 3.0, r: 84, cap: 5 }, { cnt: 2, dmg: 48, cd: 3.0, r: 88, cap: 6 }, { cnt: 2, dmg: 58, cd: 2.8, r: 94, cap: 7 }, { cnt: 3, dmg: 70, cd: 2.6, r: 102, cap: 8 }],
    desc: l => `佈下 ${effectCount(l.cnt)} 顆地雷（場上最多 ${effectCount(l.cap)} 顆），敵人靠近即引爆（${l.dmg} 範圍傷害）` },
  nova: { name: '冰霜新星', icon: 'nova', max: 5,
    lv: [{ dmg: 12, cd: 4.4, r: 130, slow: 1.4 }, { dmg: 16, cd: 4.0, r: 150, slow: 1.7 }, { dmg: 20, cd: 3.6, r: 170, slow: 2.0 }, { dmg: 26, cd: 3.2, r: 195, slow: 2.3 }, { dmg: 34, cd: 2.8, r: 225, slow: 2.6 }],
    desc: l => `釋放 ${effectCount(1)} 道寒冰衝擊波，半徑 ${l.r}，造成 ${l.dmg} 傷害並減速 ${l.slow} 秒` },
  turret: { name: '自動砲塔', icon: 'turret', max: 5,
    lv: [{ n: 1, dmg: 16, fr: .6, dur: 8, cd: 10 }, { n: 1, dmg: 22, fr: .52, dur: 9, cd: 9.5 }, { n: 2, dmg: 24, fr: .5, dur: 9, cd: 9 }, { n: 2, dmg: 30, fr: .44, dur: 10, cd: 8.5 }, { n: 3, dmg: 36, fr: .38, dur: 11, cd: 8 }],
    desc: l => `部署自動砲塔（最多 ${effectCount(l.n)} 座、存活 ${l.dur} 秒），快速射擊最近敵人（${l.dmg} 傷害）` },
};
const PASSIVES = {
  p_atk:   { name: '能量核心', icon: 'p_atk', max: 5, desc: lv => `全體攻擊力 +${lv * 10}%` },
  p_hp:    { name: '強化裝甲', icon: 'p_hp', max: 5, desc: lv => `生命上限 +${lv * 15}%` },
  p_spd:   { name: '動力長靴', icon: 'p_spd', max: 5, desc: lv => `移動速度 +${lv * 8}%` },
  p_mag:   { name: '磁力線圈', icon: 'p_mag', max: 5, desc: lv => `拾取範圍 +${lv * 25}%` },
  p_regen: { name: '奈米修復', icon: 'p_regen', max: 5, desc: lv => `每秒回復 ${(lv * 0.8).toFixed(1)} 點生命` },
  p_cd:    { name: '超頻晶片', icon: 'p_cd', max: 5, desc: lv => `技能冷卻 -${lv * 6}%` },
  p_multi: { name: '多重模組', max: 1, desc: () => '所有主動技能效果數量 +1' },
  p_splash:{ name: '擴散彈芯', max: 1, desc: () => `所有技能命中時有 ${Math.round(SPLASH_PROC_CHANCE * 100)}% 機率造成範圍傷害` },
};
const MAX_ACTIVE = 5, MAX_PASSIVE = 4;

const TALENTS = {
  t_atk:  { name: '火力核心', icon: 'atk', max: 5, costs: [80, 160, 300, 520, 820], desc: lv => `全武器傷害 +${lv * 6}%` },
  t_hp:   { name: '合金護甲', icon: 'hp', max: 5, costs: [70, 150, 280, 480, 760], desc: lv => `生命上限 +${lv * 10}%` },
  t_spd:  { name: '推進長靴', icon: 'spd', max: 5, costs: [60, 130, 250, 420, 680], desc: lv => `移動速度 +${lv * 5}%` },
  t_mag:  { name: '磁吸線圈', icon: 'mag', max: 5, costs: [50, 110, 220, 380, 620], desc: lv => `拾取範圍 +${lv * 15}%` },
  t_cd:   { name: '超頻晶片', icon: 'cd', max: 5, costs: [90, 190, 360, 600, 920], desc: lv => `技能冷卻 -${lv * 4}%` },
  t_coin: { name: '賞金勳章', icon: 'coin', max: 5, costs: [60, 140, 260, 460, 720], desc: lv => `戰鬥金幣 +${lv * 10}%` },
};
const TALENT_ORDER = ['t_atk', 't_hp', 't_spd', 't_mag', 't_cd', 't_coin'];

/* ---------------- 鏁典汉璩囨枡 ---------------- */
const ETYPES = {
  walker:   { hp: 18, spd: [52, 76],   dmg: 8,  r: 13, exp: 1, coin: .07 },
  fast:     { hp: 13, spd: [104, 126], dmg: 6,  r: 11, exp: 1, coin: .07 },
  spitter:  { hp: 26, spd: [46, 60],   dmg: 7,  r: 13, exp: 2, coin: .10, ranged: true },
  tank:     { hp: 95, spd: [36, 46],   dmg: 14, r: 21, exp: 3, coin: .15 },
  exploder: { hp: 16, spd: [82, 102],  dmg: 5,  r: 12, exp: 2, coin: .10, boom: true },
  leaper:   { hp: 28, spd: [76, 96],   dmg: 12, r: 12, exp: 2, coin: .12, leap: true, sprite: 'fast' },
  shielder: { hp: 128, spd: [34, 44],  dmg: 13, r: 22, exp: 4, coin: .18, shield: true, sprite: 'tank' },
  splitter: { hp: 42, spd: [56, 74],   dmg: 9,  r: 14, exp: 2, coin: .12, split: true, sprite: 'exploder' },
  phantom:  { hp: 34, spd: [96, 122],  dmg: 11, r: 12, exp: 3, coin: .14, phase: true, sprite: 'fast' },
};

/* ---------------- Chapters ---------------- */
const CHAPTERS = [
  { name: '第 1 章 · 黎明街區', emoji: '🌆', dur: 180, cap: 230, hpMul: 1, dmgMul: 1, hpRamp: 1.4,
    rate: [0.9, 5.0],
    mix: [{ t: 0, w: { walker: 1 } }, { t: 50, w: { walker: .75, fast: .25 } }, { t: 120, w: { walker: .6, fast: .4 } }],
    events: [{ t: 40, type: 'ring', n: 22 }, { t: 75, type: 'elite' }, { t: 110, type: 'ring', n: 28 }, { t: 140, type: 'elite' }],
    boss: { name: '巨錘殭屍', hp: 3600, spd: 62, dmg: 24, r: 40, col: '#79c14e', patterns: ['charge', 'radial'] },
    gfx: { base: '#494e58', alt: '#444954', deco: 'city', tint: null },
    desc: '殭屍潮初現，適合熟悉操作。\nBOSS：巨錘殭屍' },
  { name: '第 2 章 · 午夜下水道', emoji: '🌙', dur: 210, cap: 270, hpMul: 1.6, dmgMul: 1.25, hpRamp: 1.8,
    rate: [1.1, 6.0],
    mix: [{ t: 0, w: { walker: .7, fast: .3 } }, { t: 45, w: { walker: .55, fast: .25, spitter: .2 } }, { t: 130, w: { walker: .45, fast: .3, spitter: .25 } }],
    events: [{ t: 35, type: 'ring', n: 24 }, { t: 65, type: 'elite' }, { t: 100, type: 'ring', n: 30 }, { t: 130, type: 'elite' }, { t: 170, type: 'ring', n: 34 }],
    boss: { name: '毒液女王', hp: 6400, spd: 72, dmg: 26, r: 38, col: '#a05ad6', patterns: ['radial', 'summon', 'charge'] },
    gfx: { base: '#2e2a45', alt: '#2a2640', deco: 'sewer', tint: 'rgba(40,20,90,.14)' },
    desc: '速度型殭屍與遠程毒液手登場。\nBOSS：毒液女王' },
  { name: '第 3 章 · 鋼鐵工廠', emoji: '🏭', dur: 240, cap: 310, hpMul: 2.4, dmgMul: 1.5, hpRamp: 2.2,
    rate: [1.3, 7.0],
    mix: [{ t: 0, w: { walker: .55, fast: .25, spitter: .2 } }, { t: 60, w: { walker: .4, fast: .2, spitter: .15, tank: .15, exploder: .1 } }, { t: 150, w: { walker: .3, fast: .2, spitter: .15, tank: .2, exploder: .15 } }],
    events: [{ t: 30, type: 'ring', n: 26 }, { t: 60, type: 'elite' }, { t: 95, type: 'ring', n: 32 }, { t: 125, type: 'elite' }, { t: 160, type: 'ring', n: 38 }, { t: 195, type: 'elite' }],
    boss: { name: '裝甲巨像', hp: 9800, spd: 58, dmg: 30, r: 46, col: '#9aa3ad', patterns: ['charge', 'shock', 'summon', 'radial'] },
    gfx: { base: '#4f3b34', alt: '#48362f', deco: 'factory', tint: 'rgba(120,40,10,.08)' },
    desc: '重甲坦克與自爆殭屍的鋼鐵戰場。\nBOSS：裝甲巨像' },
  { name: '第 4 章 · 生化隔離區', emoji: '🧪', dur: 270, cap: 345, hpMul: 3.05, dmgMul: 1.78, hpRamp: 2.65,
    rate: [1.5, 7.8],
    mix: [{ t: 0, w: { walker: .38, splitter: .22, spitter: .18, leaper: .12, tank: .10 } }, { t: 70, w: { walker: .25, splitter: .26, spitter: .2, leaper: .17, shielder: .12 } }, { t: 170, w: { splitter: .28, spitter: .22, leaper: .2, shielder: .16, tank: .14 } }],
    events: [{ t: 32, type: 'ring', n: 30 }, { t: 62, type: 'elite' }, { t: 105, type: 'ring', n: 38 }, { t: 145, type: 'elite' }, { t: 190, type: 'ring', n: 44 }, { t: 230, type: 'elite' }],
    boss: { name: '培養艙暴君', hp: 13400, spd: 68, dmg: 34, r: 44, col: '#78e160', patterns: ['toxic', 'split', 'charge', 'summon', 'shock'] },
    gfx: { base: '#263c37', alt: '#213531', deco: 'lab', tint: 'rgba(28,120,70,.12)' },
    desc: '分裂感染體與護盾怪壓縮走位空間。\nBOSS：培養艙暴君' },
  { name: '第 5 章 · 軌道裂隙站', emoji: '🛰️', dur: 300, cap: 380, hpMul: 3.75, dmgMul: 2.05, hpRamp: 3.0,
    rate: [1.7, 8.6],
    mix: [{ t: 0, w: { phantom: .28, leaper: .2, spitter: .2, shielder: .12, tank: .1, exploder: .1 } }, { t: 80, w: { phantom: .32, leaper: .22, spitter: .16, shielder: .15, tank: .1, exploder: .05 } }, { t: 190, w: { phantom: .34, leaper: .22, shielder: .18, spitter: .16, tank: .1 } }],
    events: [{ t: 35, type: 'ring', n: 34 }, { t: 70, type: 'elite' }, { t: 120, type: 'ring', n: 42 }, { t: 165, type: 'elite' }, { t: 215, type: 'ring', n: 50 }, { t: 260, type: 'elite' }],
    boss: { name: '時空毀滅者', hp: 17800, spd: 76, dmg: 38, r: 48, col: '#b779ff', patterns: ['blink', 'spiral', 'rift', 'charge', 'meteor'] },
    gfx: { base: '#2b2850', alt: '#242243', deco: 'rift', tint: 'rgba(86,42,160,.16)' },
    desc: '相位殭屍會漂移突進，裂隙會拉開戰線。\nBOSS：時空毀滅者' },
];
const MAX_CHAPTERS = CHAPTERS.length;

/* ---------------- 鍏ㄥ煙鐙€鎱?---------------- */
let cv, ctx, W = 0, H = 0, DPR = 1, VS = 1;
let state = 'menu';            // menu | select | talents | play | levelup | pause | win | lose
let chapter = null, chIdx = 0;
let gtime = 0, spawnAcc = 0, eventIdx = 0, bossSpawned = false, bossActive = null, winT = -1;
let kills = 0, coinGain = 0, bankedAmt = 0, pendingLv = 0, reviveUsed = false;
let shake = 0, hudT = 0, crateT = 0, hurtFlash = 0;
let camX = 0, camY = 0, uid = 1;
let player = null;
let enemies = [], bullets = [], ebullets = [], zones = [], waves = [], gems = [], coinsArr = [], pickups = [], crates = [], parts = [], texts = [];
let beams = [], novas = [], turrets = [], bursts = [];
let unlocked = clamp(parseInt(localStorage.getItem('ddtg_unlock') || '1', 10) || 1, 1, MAX_CHAPTERS);
let totalCoins = parseInt(localStorage.getItem('ddtg_coins') || '0', 10) || 0;
let talents = loadTalents();
let talentBonus = calcTalentBonus();
let runCoinRemainder = 0;

const SPRITE_COLS = 4;
const SPRITE_ROWS = 8;
function loadSprite(src) {
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
  return img;
}
const SPRITES = {
  hero: loadSprite('assets/characters/hero-agent.png?v=ui-vfx-7'),
  heroUpper: loadSprite('assets/characters/hero-agent-upper.png?v=ui-vfx-2'),
  heroLower: loadSprite('assets/characters/hero-agent-lower.png?v=ui-vfx-2'),
  enemies: {
    walker: loadSprite('assets/characters/monster-walker.png?v=ui-vfx-5'),
    fast: loadSprite('assets/characters/monster-fast.png?v=ui-vfx-4'),
    spitter: loadSprite('assets/characters/monster-spitter.png?v=ui-vfx-4'),
    tank: loadSprite('assets/characters/monster-tank.png?v=ui-vfx-4'),
    exploder: loadSprite('assets/characters/monster-exploder.png?v=ui-vfx-4'),
  },
  bosses: [
    loadSprite('assets/characters/boss-brute.png?v=ui-vfx-4'),
    loadSprite('assets/characters/boss-poison-queen.png?v=ui-vfx-4'),
    loadSprite('assets/characters/boss-colossus.png?v=ui-vfx-4'),
    loadSprite('assets/characters/boss-poison-queen.png?v=ui-vfx-4'),
    loadSprite('assets/characters/boss-colossus.png?v=ui-vfx-4'),
  ],
  ui: {
    items: loadSprite('assets/ui/items.png?v=ui-vfx-3'),
  },
  effects: loadSprite('assets/effects/skill-vfx.png?v=imagegen-vfx-1'),
  effectSequences: loadSprite('assets/effects/effect-sequences.png?v=seq-vfx-1'),
  splashProc: loadSprite('assets/effects/splash-proc.png?v=chapters-aoe-1'),
  statusBurn: loadSprite('assets/effects/status-burn.png?v=status-vfx-1'),
  statusFreeze: loadSprite('assets/effects/status-freeze.png?v=status-vfx-1'),
  turret8: loadSprite('assets/effects/guardian-gun-8dir.png?v=imagegen-vfx-1'),
  drone8: loadSprite('assets/effects/drone-8dir.png?v=drone-lightning-1'),
  lightningStrike: loadSprite('assets/effects/lightning-strike.png?v=drone-lightning-1'),
};
const FX_COLS = 4, FX_ROWS = 4;
const FX = {
  knife: 0, drill: 1, boomer: 2, molotov: 3,
  missile: 4, mine: 5, turret: 6, bolt: 7,
  fireZone: 8, field: 9, guardOrb: 10, drone: 11,
  nova: 12, explosion: 13, laser: 14, shockwave: 15,
};
const FX_ROT_OFFSET = {
  bolt: Math.PI,
};
const SEQ_COLS = 8, SEQ_ROWS = 4;
const SEQ_FX = {
  field: 0, statusBurn: 1, statusFreeze: 2, fireZone: 3,
};
const DIR_SHEET_COLS = 4, DIR_SHEET_ROWS = 2;
const LIGHTNING_IMPACT_Y = .84;
const FIELD_VISUAL_Y_OFFSET = -22;
function spriteReady(img) {
  return img && img.complete && img.naturalWidth > 0 && img.naturalHeight > 0;
}
function spriteAlphaBoxes(img, cols, rows) {
  if (!spriteReady(img)) return null;
  const key = `${img.naturalWidth}x${img.naturalHeight}:${cols}x${rows}`;
  if (img._alphaBoxKey === key) return img._alphaBoxes;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const cctx = canvas.getContext('2d', { willReadFrequently: true });
  cctx.drawImage(img, 0, 0);
  let data;
  try {
    data = cctx.getImageData(0, 0, canvas.width, canvas.height).data;
  } catch (_) {
    img._alphaBoxKey = key;
    img._alphaBoxes = null;
    return null;
  }
  const cw = img.naturalWidth / cols;
  const ch = img.naturalHeight / rows;
  const boxes = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let minX = cw, minY = ch, maxX = -1, maxY = -1;
      let lminX = cw, lmaxX = -1; // 腰線以下（下半身區）的水平範圍
      const lowY = ch * 0.65;
      const x0 = Math.floor(col * cw), y0 = Math.floor(row * ch);
      const x1 = Math.floor((col + 1) * cw), y1 = Math.floor((row + 1) * ch);
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const a = data[(py * canvas.width + px) * 4 + 3];
          if (a <= 8) continue;
          const lx = px - x0, ly = py - y0;
          if (lx < minX) minX = lx;
          if (ly < minY) minY = ly;
          if (lx > maxX) maxX = lx;
          if (ly > maxY) maxY = ly;
          if (ly >= lowY) {
            if (lx < lminX) lminX = lx;
            if (lx > lmaxX) lmaxX = lx;
          }
        }
      }
      boxes.push(maxX >= 0 ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1, lx0: lminX, lx1: lmaxX } : { x: 0, y: 0, w: cw, h: ch, lx0: 0, lx1: -1 });
    }
  }
  img._alphaBoxKey = key;
  img._alphaBoxes = boxes;
  return boxes;
}
function dirFromVector(dx, dy) {
  if (Math.abs(dx) + Math.abs(dy) < 0.001) return 0;
  return (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + SPRITE_ROWS) % SPRITE_ROWS;
}
function animFrame(anim, moving, fps) {
  return moving ? Math.floor(anim * fps) % SPRITE_COLS : 0;
}
function drawAtlasCell(img, dir, frame, x, y, drawH, anchorY, alpha) {
  if (!spriteReady(img)) return false;
  const cw = img.naturalWidth / SPRITE_COLS;
  const ch = img.naturalHeight / SPRITE_ROWS;
  const boxes = spriteAlphaBoxes(img, SPRITE_COLS, SPRITE_ROWS);
  const box = boxes ? boxes[dir * SPRITE_COLS + frame] : { x: 0, y: 0, w: cw, h: ch };
  const scale = drawH / ch;
  const drawW = box.w * scale;
  const drawBoxH = box.h * scale;
  const cellLeft = x - (cw * scale) / 2;
  const groundY = y + drawH * (1 - anchorY);
  ctx.save();
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    img,
    frame * cw + box.x, dir * ch + box.y, box.w, box.h,
    cellLeft + box.x * scale, groundY - drawBoxH, drawW, drawBoxH
  );
  ctx.restore();
  return true;
}
const HERO_CUT = 0.65; // 上下半身切線（格高比例，約在腰部）
function drawAtlasCellSlice(img, dir, frame, x, y, drawH, anchorY, cellY0, cellY1, alpha) {
  if (!spriteReady(img)) return false;
  const cw = img.naturalWidth / SPRITE_COLS;
  const ch = img.naturalHeight / SPRITE_ROWS;
  const boxes = spriteAlphaBoxes(img, SPRITE_COLS, SPRITE_ROWS);
  const box = boxes ? boxes[dir * SPRITE_COLS + frame] : { x: 0, y: 0, w: cw, h: ch };
  const sy0 = Math.max(box.y, Math.round(ch * cellY0));
  const sy1 = Math.min(box.y + box.h, Math.round(ch * cellY1));
  if (sy1 <= sy0) return true;
  const scale = drawH / ch;
  const cellLeft = x - (cw * scale) / 2;
  const groundY = y + drawH * (1 - anchorY);
  const cellBottom = box.y + box.h;
  ctx.save();
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    img,
    frame * cw + box.x, dir * ch + sy0, box.w, sy1 - sy0,
    cellLeft + box.x * scale, groundY - (cellBottom - sy0) * scale, box.w * scale, (sy1 - sy0) * scale
  );
  ctx.restore();
  return true;
}
let seamCv = null, seamCtx = null;
// 上半身羽化繪製：腰線以下「雙腿區」漸層淡出讓下半身接手，
// 超出雙腿水平範圍的部分（側伸的槍械）完整保留，不會被腰線切斷
function drawTorsoFaded(img, torsoDir, frame, legsDir, x, y, drawH, anchorY) {
  if (!spriteReady(img)) return false;
  const cw = img.naturalWidth / SPRITE_COLS;
  const ch = img.naturalHeight / SPRITE_ROWS;
  const boxes = spriteAlphaBoxes(img, SPRITE_COLS, SPRITE_ROWS);
  if (!boxes) return drawAtlasCellSlice(img, torsoDir, frame, x, y, drawH, anchorY, 0, HERO_CUT + 6 / 228);
  const box = boxes[torsoDir * SPRITE_COLS + frame];
  const legsBox = boxes[legsDir * SPRITE_COLS + frame];
  if (!seamCv) { seamCv = document.createElement('canvas'); seamCtx = seamCv.getContext('2d'); }
  const icw = Math.ceil(cw), ich = Math.ceil(ch);
  if (seamCv.width !== icw || seamCv.height !== ich) { seamCv.width = icw; seamCv.height = ich; }
  seamCtx.clearRect(0, 0, icw, ich);
  seamCtx.drawImage(img, frame * cw, torsoDir * ch, cw, ch, 0, 0, cw, ch);
  // 淡出遮罩只蓋「兩排雙腿的水平聯集」，槍械伸出範圍外不受影響
  const cutY = ch * HERO_CUT, fadeEnd = ch * (HERO_CUT + 0.17);
  let mx0 = Math.min(legsBox.lx1 >= 0 ? legsBox.lx0 : cw, box.lx1 >= 0 ? box.lx0 : cw) - 5;
  let mx1 = Math.max(legsBox.lx1 >= 0 ? legsBox.lx1 : -1, box.lx1 >= 0 ? box.lx1 : -1) + 5;
  if (mx1 < mx0) { mx0 = 0; mx1 = cw; }
  const g = seamCtx.createLinearGradient(0, cutY, 0, fadeEnd);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  seamCtx.save();
  seamCtx.globalCompositeOperation = 'destination-out';
  seamCtx.fillStyle = g;
  seamCtx.fillRect(mx0, cutY, mx1 - mx0, ch - cutY);
  seamCtx.restore();
  const scale = drawH / ch;
  const groundY = y + drawH * (1 - anchorY);
  const cellBottom = box.y + box.h;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    seamCv, 0, 0, icw, ich,
    x - (cw * scale) / 2, groundY - cellBottom * scale, cw * scale, ch * scale * (ich / ch)
  );
  ctx.restore();
  return true;
}
function drawAtlasCellLayer(img, refImg, dir, frame, x, y, drawH, anchorY, alpha) {
  if (!spriteReady(img) || !spriteReady(refImg)) return false;
  const cw = img.naturalWidth / SPRITE_COLS;
  const ch = img.naturalHeight / SPRITE_ROWS;
  const refBoxes = spriteAlphaBoxes(refImg, SPRITE_COLS, SPRITE_ROWS);
  const refBox = refBoxes ? refBoxes[dir * SPRITE_COLS + frame] : { x: 0, y: 0, w: cw, h: ch };
  const scale = drawH / ch;
  const cellLeft = x - (cw * scale) / 2;
  const groundY = y + drawH * (1 - anchorY);
  ctx.save();
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    img,
    frame * cw, dir * ch, cw, ch,
    cellLeft, groundY - (refBox.y + refBox.h) * scale, cw * scale, ch * scale
  );
  ctx.restore();
  return true;
}
function drawSheetCell(img, cols, rows, col, row, x, y, drawW, drawH, alpha) {
  if (!spriteReady(img)) return false;
  const cw = img.naturalWidth / cols;
  const ch = img.naturalHeight / rows;
  const padX = 0;
  const padY = 0;
  const sw = cw - padX * 2;
  const sh = ch - padY * 2;
  ctx.save();
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    img,
    col * cw + padX, row * ch + padY, sw, sh,
    x - drawW / 2, y - drawH / 2, drawW, drawH
  );
  ctx.restore();
  return true;
}
function drawItemSprite(col, x, y, size, alpha) {
  return drawSheetCell(SPRITES.ui.items, 8, 1, col, 0, x, y, size, size, alpha);
}
function drawFxSprite(id, x, y, w, h, rot, alpha, blend) {
  const idx = FX[id];
  if (idx == null || !spriteReady(SPRITES.effects)) return false;
  const cw = SPRITES.effects.naturalWidth / FX_COLS;
  const ch = SPRITES.effects.naturalHeight / FX_ROWS;
  const col = idx % FX_COLS, row = Math.floor(idx / FX_COLS);
  ctx.save();
  if (blend) ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    SPRITES.effects,
    col * cw, row * ch, cw, ch,
    -w / 2, -h / 2, w, h
  );
  ctx.restore();
  return true;
}
function drawFxRot(id, x, y, size, rot, alpha, blend) {
  return drawFxSprite(id, x, y, size, size, rot, alpha, blend);
}
function drawSeqSprite(id, x, y, w, h, rot, alpha, blend, fps, phase) {
  const row = SEQ_FX[id];
  if (row == null || !spriteReady(SPRITES.effectSequences)) return false;
  const cw = SPRITES.effectSequences.naturalWidth / SEQ_COLS;
  const ch = SPRITES.effectSequences.naturalHeight / SEQ_ROWS;
  const frame = ((Math.floor(gtime * (fps || 10) + (phase || 0)) % SEQ_COLS) + SEQ_COLS) % SEQ_COLS;
  ctx.save();
  if (blend) ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    SPRITES.effectSequences,
    frame * cw, row * ch, cw, ch,
    -w / 2, -h / 2, w, h
  );
  ctx.restore();
  return true;
}
function drawStatusSprite(img, x, y, size, alpha, blend) {
  if (!spriteReady(img)) return false;
  ctx.save();
  if (blend) ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  ctx.restore();
  return true;
}
function octantFromAngle(a) {
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}
function drawTurret8Sprite(x, y, ang, size, alpha) {
  if (!spriteReady(SPRITES.turret8)) return false;
  const idx = octantFromAngle(ang || 0);
  return drawSheetCell(SPRITES.turret8, 4, 2, idx % 4, Math.floor(idx / 4), x, y - 8, size, size, alpha);
}
function drawDrone8Sprite(x, y, ang, size, alpha) {
  if (!spriteReady(SPRITES.drone8)) return false;
  const idx = octantFromAngle(ang || 0);
  return drawSheetCell(SPRITES.drone8, DIR_SHEET_COLS, DIR_SHEET_ROWS, idx % DIR_SHEET_COLS, Math.floor(idx / DIR_SHEET_COLS), x, y, size, size, alpha);
}
function drawLightningStrikeSprite(x, y, size, progress, alpha) {
  if (!spriteReady(SPRITES.lightningStrike)) return false;
  const cols = DIR_SHEET_COLS, rows = DIR_SHEET_ROWS;
  const frame = clamp(Math.floor(clamp(progress, 0, .999) * cols * rows), 0, cols * rows - 1);
  const cw = SPRITES.lightningStrike.naturalWidth / cols;
  const ch = SPRITES.lightningStrike.naturalHeight / rows;
  const col = frame % cols, row = Math.floor(frame / cols);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    SPRITES.lightningStrike,
    col * cw, row * ch, cw, ch,
    x - size / 2, y - size * LIGHTNING_IMPACT_Y, size, size
  );
  ctx.restore();
  return true;
}
function drawSplashProcSprite(x, y, size, progress, alpha) {
  if (!spriteReady(SPRITES.splashProc)) return false;
  const cols = 4, rows = 2;
  const frame = clamp(Math.floor(clamp(progress, 0, .999) * cols * rows), 0, cols * rows - 1);
  const cw = SPRITES.splashProc.naturalWidth / cols;
  const ch = SPRITES.splashProc.naturalHeight / rows;
  const col = frame % cols, row = Math.floor(frame / cols);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    SPRITES.splashProc,
    col * cw, row * ch, cw, ch,
    x - size / 2, y - size / 2, size, size
  );
  ctx.restore();
  return true;
}
function glowCircle(x, y, r, inner, outer, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.save();
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
}
function strokeRing(x, y, r, color, width, alpha) {
  ctx.save();
  ctx.globalAlpha *= alpha == null ? 1 : alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.restore();
}
function drawForceFieldBack(x, y, r, pulse) {
  const rr = r + pulse * 3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  const g = ctx.createRadialGradient(x - rr * .26, y - rr * .34, rr * .08, x, y, rr);
  g.addColorStop(0, 'rgba(205,255,255,.22)');
  g.addColorStop(.48, 'rgba(92,210,255,.13)');
  g.addColorStop(.78, 'rgba(82,142,255,.08)');
  g.addColorStop(1, 'rgba(44,98,255,.02)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function drawForceFieldFront(x, y, r, pulse) {
  const rr = r + pulse * 3;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const rim = ctx.createRadialGradient(x, y - rr * .2, rr * .42, x, y, rr * .98);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(.62, 'rgba(130,225,255,.03)');
  rim.addColorStop(.86, 'rgba(170,246,255,.12)');
  rim.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalAlpha *= .72;
  ctx.fillStyle = rim;
  ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function skillIconHtml(id, extra) {
  const def = SKILLS[id] || PASSIVES[id];
  if (def && def.em) return `<span class="sprite-icon emoji-ico${extra ? ' ' + extra : ''}">${def.em}</span>`;
  return `<span class="sprite-icon skill-icon-img icon-${id}${extra ? ' ' + extra : ''}"></span>`;
}
function itemIconHtml(id, extra) {
  return `<span class="sprite-icon item-icon-img item-${id}${extra ? ' ' + extra : ''}"></span>`;
}
function coinCounterHtml(amount, extra) {
  return `${itemIconHtml('coin', `coin-icon${extra ? ' ' + extra : ''}`)}<span class="coin-num">${amount}</span>`;
}
function talentIconHtml(id) {
  const t = TALENTS[id];
  return `<span class="sprite-icon talent-icon-img talent-${t.icon}"></span>`;
}
function loadTalents() {
  let raw = {};
  try { raw = JSON.parse(localStorage.getItem('ddtg_talents') || '{}') || {}; } catch (_) { raw = {}; }
  const out = {};
  for (const id of TALENT_ORDER) out[id] = clamp(parseInt(raw[id] || '0', 10) || 0, 0, TALENTS[id].max);
  return out;
}
function saveTalents() {
  localStorage.setItem('ddtg_talents', JSON.stringify(talents));
}
function talentLv(id) { return talents[id] || 0; }
function talentCost(id) {
  const t = TALENTS[id], lv = talentLv(id);
  return lv >= t.max ? 0 : t.costs[lv];
}
function calcTalentBonus() {
  const lv = id => talents && talents[id] ? talents[id] : 0;
  return {
    atk: 1 + lv('t_atk') * 0.06,
    hp: 1 + lv('t_hp') * 0.10,
    spd: 1 + lv('t_spd') * 0.05,
    mag: 1 + lv('t_mag') * 0.15,
    cd: Math.max(0.72, 1 - lv('t_cd') * 0.04),
    coin: 1 + lv('t_coin') * 0.10,
  };
}
function refreshTalentBonus() {
  talentBonus = calcTalentBonus();
}
function addRunCoins(amount, useTalent) {
  const mul = useTalent === false ? 1 : ((player && player.coinMul) || talentBonus.coin || 1);
  runCoinRemainder += amount * mul;
  const add = Math.floor(runCoinRemainder + 1e-6);
  if (add > 0) {
    coinGain += add;
    runCoinRemainder -= add;
  }
}

/* ---------------- 绌洪枔缍叉牸锛堢鎾炲姞閫燂級 ---------------- */
const CELL = 96;
const grid = new Map();
function rebuildGrid() {
  grid.clear();
  for (const e of enemies) {
    if (e.dead) continue;
    const k = Math.floor(e.x / CELL) + ',' + Math.floor(e.y / CELL);
    let a = grid.get(k); if (!a) { a = []; grid.set(k, a); } a.push(e);
  }
}
function separateEnemies() {
  const cells = Array.from(grid.entries());
  for (const [key, a] of cells) {
    const [cx, cy] = key.split(',').map(Number);
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
      const b = grid.get((cx + ox) + ',' + (cy + oy));
      if (!b) continue;
      for (const e1 of a) for (const e2 of b) {
        if (e1.id >= e2.id || e1.dead || e2.dead || e1.boss || e2.boss) continue;
        let dx = e2.x - e1.x, dy = e2.y - e1.y;
        let d = Math.hypot(dx, dy);
        if (d < 0.01) {
          const ang = ((e1.id * 17.13 + e2.id * 5.71) % 628) / 100;
          dx = Math.cos(ang); dy = Math.sin(ang); d = 1;
        }
        const min = (e1.r + e2.r) * (e1.elite || e2.elite ? 1.12 : 1.32);
        if (d < min) {
          const push = (min - d) * .5 / d;
          e1.x -= dx * push; e1.y -= dy * push;
          e2.x += dx * push; e2.y += dy * push;
        }
      }
    }
  }
}
function forEnem(x, y, r, fn) {
  const x0 = Math.floor((x - r - 32) / CELL), x1 = Math.floor((x + r + 32) / CELL);
  const y0 = Math.floor((y - r - 32) / CELL), y1 = Math.floor((y + r + 32) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = grid.get(cx + ',' + cy); if (!a) continue;
    for (const e of a) {
      if (e.dead) continue;
      const rr = r + e.r;
      if (dist2(x, y, e.x, e.y) <= rr * rr) fn(e);
    }
  }
}
function nearestEnemy(x, y, maxR) {
  let best = null, bd = maxR * maxR;
  for (const e of enemies) { if (e.dead) continue; const d = dist2(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  return best;
}

/* ---------------- 杓稿叆 ---------------- */
const keys = {};
const joy = { active: false, pid: -1, ox: 0, oy: 0, dx: 0, dy: 0 };
function canvasPoint(e) {
  const r = cv.getBoundingClientRect();
  const sx = r.width ? W / r.width : 1;
  const sy = r.height ? H / r.height : 1;
  return { x: (e.clientX - r.left) * sx, y: (e.clientY - r.top) * sy };
}
function initInput() {
  addEventListener('keydown', e => {
    keys[e.key.toLowerCase()] = true;
    if (e.key === 'Escape' || e.key.toLowerCase() === 'p') {
      if (state === 'play') doPause(); else if (state === 'pause') doResume();
    }
  });
  addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  cv.addEventListener('pointerdown', e => {
    const p = canvasPoint(e);
    joy.active = true; joy.pid = e.pointerId;
    joy.ox = p.x; joy.oy = p.y; joy.dx = 0; joy.dy = 0;
    cv.setPointerCapture(e.pointerId);
  });
  cv.addEventListener('pointermove', e => {
    if (!joy.active || e.pointerId !== joy.pid) return;
    const p = canvasPoint(e);
    let dx = p.x - joy.ox, dy = p.y - joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > 56) { dx = dx / len * 56; dy = dy / len * 56; }
    joy.dx = dx; joy.dy = dy;
  });
  const end = e => { if (e.pointerId === joy.pid) { joy.active = false; joy.dx = joy.dy = 0; } };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  addEventListener('blur', () => { if (state === 'play') doPause(); });
}
function moveVec() {
  let x = 0, y = 0;
  if (keys['a'] || keys['arrowleft']) x -= 1;
  if (keys['d'] || keys['arrowright']) x += 1;
  if (keys['w'] || keys['arrowup']) y -= 1;
  if (keys['s'] || keys['arrowdown']) y += 1;
  if (joy.active) { x += joy.dx / 56; y += joy.dy / 56; }
  const len = Math.hypot(x, y);
  if (len > 1) { x /= len; y /= len; }
  return { x, y, len: Math.min(1, len) };
}

/* ---------------- 鐜╁ ---------------- */
function newPlayer() {
  return {
    x: 0, y: 0, r: 14, hp: 100, maxhp: 100, baseSpd: 175,
    face: 1, dir: 0, anim: 0, moving: false, invuln: 1.5,
    aimDir: 0, aimT: 0,
    lvl: 1, exp: 0, skills: {}, cds: {},
    guardAng: 0, droneShoot: 0, droneAng: 0, droneAims: [],
    atkMul: 1, spdMul: 1, magR: 70, regen: 0, cdMul: 1, coinMul: 1,
  };
}
function expNeed() { return 5 + player.lvl * 4; }
function skLv(id) { return player.skills[id] || 0; }
function skSt(id) { return SKILLS[id].lv[skLv(id) - 1]; }
function recalc() {
  const oldMax = player.maxhp;
  refreshTalentBonus();
  player.atkMul = talentBonus.atk * (1 + 0.10 * skLv('p_atk'));
  player.spdMul = talentBonus.spd * (1 + 0.08 * skLv('p_spd'));
  player.magR = 70 * talentBonus.mag * (1 + 0.25 * skLv('p_mag'));
  player.regen = 0.8 * skLv('p_regen');
  player.cdMul = Math.max(0.52, talentBonus.cd * (1 - 0.06 * skLv('p_cd')));
  player.coinMul = talentBonus.coin;
  player.maxhp = Math.round(100 * talentBonus.hp * (1 + 0.15 * skLv('p_hp')));
  if (player.maxhp !== oldMax && oldMax > 0) player.hp = clamp(player.hp * player.maxhp / oldMax, 1, player.maxhp);
}
function acquireOrLevel(id) {
  const isNew = !player.skills[id];
  player.skills[id] = (player.skills[id] || 0) + 1;
  if (SKILLS[id] && isNew) player.cds[id] = 0.3;
  recalc(); rebuildSkillbar();
  return isNew;
}
function ownedCount(table) { let n = 0; for (const id in table) if (player.skills[id]) n++; return n; }

/* ---------------- 鍗囩礆涓夐伕涓€ ---------------- */
function buildChoicePool() {
  const pool = [];
  const nA = ownedCount(SKILLS), nP = ownedCount(PASSIVES);
  for (const id in SKILLS) {
    const lv = skLv(id);
    if (lv > 0 && lv < SKILLS[id].max) pool.push(id);
    else if (lv === 0 && nA < MAX_ACTIVE) pool.push(id);
  }
  for (const id in PASSIVES) {
    const lv = skLv(id);
    if (lv > 0 && lv < PASSIVES[id].max) pool.push(id);
    else if (lv === 0 && nP < MAX_PASSIVE) pool.push(id);
  }
  return pool;
}
function openLevelUp() {
  const pool = buildChoicePool();
  const opts = [];
  if (pool.length === 0) {
    opts.push({ kind: 'heal' }, { kind: 'coin' });
  } else {
    for (let i = pool.length - 1; i > 0; i--) { const j = irand(0, i); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    for (const id of pool.slice(0, 3)) opts.push({ kind: 'skill', id });
  }
  const wrap = $('lu-cards'); wrap.innerHTML = '';
  for (const opt of opts) {
    const card = document.createElement('div');
    let html = '';
    if (opt.kind === 'skill') {
      const def = SKILLS[opt.id] || PASSIVES[opt.id];
      const isPassive = !SKILLS[opt.id];
      const lv = skLv(opt.id), nlv = lv + 1;
      const pips = '●'.repeat(nlv) + '○'.repeat(def.max - nlv);
      const desc = SKILLS[opt.id] ? def.desc(def.lv[nlv - 1]) : def.desc(nlv);
      card.className = 'lu-card' + (isPassive ? ' passive-card' : '');
      html = `<div class="lu-ico">${skillIconHtml(opt.id, isPassive ? 'passive-icon' : '')}</div><div class="lu-name">${def.name}</div>
        <div class="lu-tag ${lv === 0 ? 'new' : ''}">${lv === 0 ? '新技能！' : 'Lv.' + lv + ' → Lv.' + nlv}</div>
        <div class="lu-pips">${pips}</div><div class="lu-desc">${desc}</div>`;
    } else if (opt.kind === 'heal') {
      card.className = 'lu-card';
      html = `<div class="lu-ico">${itemIconHtml('meat')}</div><div class="lu-name">緊急補給</div><div class="lu-tag">回血</div><div class="lu-pips">-</div><div class="lu-desc">立即回復 30% 生命</div>`;
    } else {
      card.className = 'lu-card';
      html = `<div class="lu-ico">${itemIconHtml('coin')}</div><div class="lu-name">賞金</div><div class="lu-tag">金幣</div><div class="lu-pips">-</div><div class="lu-desc">立即獲得 40 金幣</div>`;
    }
    card.innerHTML = html;
    card.onclick = () => applyChoice(opt);
    wrap.appendChild(card);
  }
  state = 'levelup';
  showScreen('levelup', true);
}
function applyChoice(opt) {
  if (opt.kind === 'skill') acquireOrLevel(opt.id);
  else if (opt.kind === 'heal') { player.hp = clamp(player.hp + player.maxhp * .3, 0, player.maxhp); addText(player.x, player.y - 26, '+' + Math.round(player.maxhp * .3), '#7dff8a'); }
  else { addRunCoins(40); }
  sfx('pick');
  pendingLv--;
  if (pendingLv > 0) { openLevelUp(); return; }
  showScreen('hud', true);
  state = 'play';
}
function grantRandomUpgrade() {
  const pool = buildChoicePool();
  if (pool.length === 0) { addRunCoins(30); toast('寶箱：+30 金幣'); return; }
  const id = pool[irand(0, pool.length - 1)];
  const def = SKILLS[id] || PASSIVES[id];
  const isNew = acquireOrLevel(id);
  toast(`${isNew ? '獲得新技能' : '技能強化'}：${def.name} Lv.${skLv(id)}`);
  sfx('chest');
}

/* ---------------- 鐢熸垚 ---------------- */
function viewW() { return W / VS; }
function viewH() { return H / VS; }
function ringPos(extra) {
  const a = rand(0, Math.PI * 2);
  const R = Math.hypot(viewW(), viewH()) / 2 + rand(40, 120) + (extra || 0);
  return { x: player.x + Math.cos(a) * R, y: player.y + Math.sin(a) * R };
}
function hpScaleNow() { return chapter.hpMul * (1 + chapter.hpRamp * (gtime / chapter.dur)); }
function spawnEnemy(type, x, y) {
  const d = ETYPES[type];
  const e = {
    id: uid++, type, x, y, r: d.r,
    hp: Math.round(d.hp * hpScaleNow()), spd: rand(d.spd[0], d.spd[1]),
    dmg: Math.round(d.dmg * chapter.dmgMul), exp: d.exp, coinCh: d.coin,
    ranged: !!d.ranged, boom: !!d.boom, leap: !!d.leap, shield: !!d.shield, split: !!d.split, phase: !!d.phase, sprite: d.sprite || type,
    atkT: rand(0, .4), shootT: rand(1, 2.5), hitCD: {}, flash: 0, anim: rand(0, 9), dir: 0,
    stunT: 0, slowT: 0, burnT: 0, dead: false, elite: false, boss: false,
    leapT: rand(.5, 1.8), leapDashT: 0, leapVx: 0, leapVy: 0, shieldT: 0, shieldCD: rand(.4, 1.8), phaseT: rand(0, 6),
  };
  e.maxhp = e.hp;
  enemies.push(e);
  return e;
}
function spawnElite() {
  const p = ringPos(0);
  const e = spawnEnemy('walker', p.x, p.y);
  e.elite = true; e.r = 27; e.spd = 48;
  e.hp = e.maxhp = Math.round(450 * hpScaleNow() * (1 + chIdx * 0.6));
  e.dmg = Math.round(20 * chapter.dmgMul); e.exp = 0;
  toast('精英怪出現！'); sfx('boss');
}
function spawnBoss() {
  const b = chapter.boss, p = ringPos(-40);
  const e = {
    id: uid++, type: 'boss', x: p.x, y: p.y, r: b.r,
    hp: b.hp, maxhp: b.hp, spd: b.spd, dmg: b.dmg, exp: 0, coinCh: 0,
    atkT: 0, hitCD: {}, flash: 0, anim: 0, dir: 0, stunT: 0, slowT: 0, burnT: 0, dead: false, elite: false, boss: true,
    bphase: 'chase', bt: 2.2, pati: 0, dashX: 0, dashY: 0,
  };
  enemies.push(e);
  bossActive = e; bossSpawned = true;
  $('bosswrap').style.display = 'block';
  $('bossname').textContent = 'BOSS ' + b.name;
  layoutBossHud();
  warn('BOSS 來襲！'); sfx('boss');
}
function dropGem(x, y, val) {
  if (gems.length > 260) { const g0 = gems.shift(); val += g0.val; }
  gems.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), val, att: false, sp: 0 });
}
function dropCoin(x, y) { coinsArr.push({ x: x + rand(-10, 10), y: y + rand(-10, 10), sp: 0 }); }
function dropPickup(x, y, kind) { pickups.push({ x, y, kind, bob: rand(0, 6) }); }
function spawnCrate() {
  const a = rand(0, Math.PI * 2), R = rand(420, 820);
  crates.push({ x: player.x + Math.cos(a) * R, y: player.y + Math.sin(a) * R, hp: 3 });
}

/* ---------------- 鍌峰鑸囨搳娈?---------------- */
function maybeSplashDamage(origin, dmg, src) {
  const chance = splashProcChance();
  if (chance <= 0 || src === 'splash' || !origin || origin.dead || winT >= 0 || Math.random() > chance) return;
  splashProcFx(origin.x, origin.y);
  const sdmg = Math.max(1, Math.round(dmg * SPLASH_PROC_DMG_RATIO));
  forEnem(origin.x, origin.y, SPLASH_PROC_RADIUS, other => {
    if (other === origin || other.dead) return;
    damageEnemy(other, sdmg, 8, 'splash');
  });
}
function damageEnemy(e, dmg, kb, src) {
  if (e.dead || winT >= 0 && e.boss) return;
  if (e.shieldT > 0) dmg *= .55;
  dmg = Math.max(1, Math.round(dmg));
  e.hp -= dmg; e.flash = .09;
  if (texts.length < 130) addText(e.x + rand(-6, 6), e.y - e.r - 6, dmg, e.boss ? '#ffd83d' : '#fff');
  if (kb && !e.boss && !e.elite) {
    const d = Math.max(1, Math.hypot(e.x - player.x, e.y - player.y));
    e.x += (e.x - player.x) / d * kb; e.y += (e.y - player.y) / d * kb;
  }
  sfx('hit');
  maybeSplashDamage(e, dmg, src);
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dead) return;
  e.dead = true; kills++;
  poof(e.x, e.y, e.boss ? 26 : e.elite ? 14 : 6, '#9be07a');
  if (e.boom) {
    boomFx(e.x, e.y, 64);
    if (dist2(e.x, e.y, player.x, player.y) < 70 * 70) damagePlayer(Math.round(16 * chapter.dmgMul));
  }
  if (e.boss) {
    bossActive = null;
    $('bosswrap').style.display = 'none';
    for (let i = 0; i < 12; i++) dropGem(e.x + rand(-40, 40), e.y + rand(-40, 40), 8);
    for (let i = 0; i < 25; i++) dropCoin(e.x + rand(-50, 50), e.y + rand(-50, 50));
    for (const g of gems) g.att = true;
    for (const en of enemies) if (!en.dead && !en.boss) killEnemy(en);
    warn('章節通關'); sfx('win');
    winT = 1.4;
    return;
  }
  if (e.elite) {
    dropPickup(e.x, e.y, 'chest');
    for (let i = 0; i < 6; i++) dropGem(e.x + rand(-30, 30), e.y + rand(-30, 30), 8);
    for (let i = 0; i < 5; i++) dropCoin(e.x + rand(-30, 30), e.y + rand(-30, 30));
    return;
  }
  if (e.split) {
    for (let i = 0; i < 2; i++) {
      const a = rand(0, Math.PI * 2);
      const child = spawnEnemy(i % 2 ? 'fast' : 'walker', e.x + Math.cos(a) * 20, e.y + Math.sin(a) * 20);
      child.hp = child.maxhp = Math.max(8, Math.round(child.maxhp * .55));
      child.exp = 0;
      child.coinCh = 0;
    }
  }
  dropGem(e.x, e.y, e.exp);
  if (Math.random() < e.coinCh) dropCoin(e.x, e.y);
}
function damagePlayer(d) {
  if (player.invuln > 0 || state !== 'play' || winT >= 0) return;
  player.hp -= d; hurtFlash = .25; shake = Math.max(shake, 5);
  sfx('hurt');
  if (player.hp <= 0) { player.hp = 0; endRun(false); }
}
function gainExp(v) {
  player.exp += v;
  while (player.exp >= expNeed()) { player.exp -= expNeed(); player.lvl++; pendingLv++; }
}

/* ---------------- 鎶€鑳介亱浣?---------------- */
function fireKnife() {
  const st = skSt('knife');
  const cnt = effectCount(st.cnt);
  const t = nearestEnemy(player.x, player.y, 640);
  let ang;
  if (t) {
    ang = Math.atan2(t.y - player.y, t.x - player.x);
    player.aimDir = dirFromVector(t.x - player.x, t.y - player.y);
    player.aimT = .6;
  }
  else ang = player.face > 0 ? 0 : Math.PI;
  for (let i = 0; i < cnt; i++) {
    const a = ang + (i - (cnt - 1) / 2) * 0.13;
    bullets.push({ id: uid++, kind: 'knife', x: player.x, y: player.y - 6, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, r: 7, dmg: st.dmg * player.atkMul, life: 1.4, dead: false });
  }
  sfx('shoot');
}
function fireDrill() {
  const st = skSt('drill');
  const cnt = effectCount(st.cnt);
  for (let i = 0; i < cnt; i++) {
    const a = rand(0, Math.PI * 2);
    bullets.push({ id: uid++, kind: 'drill', x: player.x, y: player.y, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, r: 11, dmg: st.dmg * player.atkMul, life: 3.6, dead: false, spin: 0 });
  }
  sfx('shoot');
}
function fireMolotov() {
  const st = skSt('molotov');
  const cnt = effectCount(st.cnt);
  for (let i = 0; i < cnt; i++) {
    const t = nearestEnemy(player.x + rand(-200, 200), player.y + rand(-200, 200), 520);
    const tx = t ? t.x + rand(-30, 30) : player.x + rand(-260, 260);
    const ty = t ? t.y + rand(-30, 30) : player.y + rand(-260, 260);
    bullets.push({ id: uid++, kind: 'molotov', x: player.x, y: player.y, tx, ty, t: 0, dur: .55, sx: player.x, sy: player.y, r: 8, dmg: st.dmg * player.atkMul, zr: st.r, life: 5, dead: false });
  }
  sfx('shoot');
}
function fireThunder() {
  const st = skSt('thunder');
  const cnt = effectCount(st.n);
  const vw = viewW() / 2 + 40, vh = viewH() / 2 + 40;
  const cand = enemies.filter(e => !e.dead && Math.abs(e.x - camX) < vw && Math.abs(e.y - camY) < vh);
  if (cand.length === 0) return;
  const pool = cand.slice();
  for (let i = 0; i < cnt && pool.length > 0; i++) {
    const pick = irand(0, pool.length - 1);
    const e = pool.splice(pick, 1)[0];
    if (e.dead) continue;
    e.stunT = Math.max(e.stunT, .5);
    lightningFx(e.x, e.y);
    damageEnemy(e, st.dmg * player.atkMul);
  }
  sfx('zap');
}
function fireBoomer() {
  const st = skSt('boomer');
  const cnt = effectCount(st.cnt);
  for (let i = 0; i < cnt; i++) {
    const t = nearestEnemy(player.x, player.y, 600);
    const ang = t ? Math.atan2(t.y - player.y, t.x - player.x) + rand(-.3, .3) : rand(0, Math.PI * 2);
    if (t) { player.aimDir = dirFromVector(t.x - player.x, t.y - player.y); player.aimT = .6; }
    bullets.push({ id: uid++, kind: 'boomer', x: player.x, y: player.y, vx: Math.cos(ang) * 430, vy: Math.sin(ang) * 430, r: 12, dmg: st.dmg * player.atkMul, life: 6, phase: 0, spd: 430, dead: false, spin: 0 });
  }
  sfx('shoot');
}
function fireLaser() {
  const st = skSt('laser');
  const cnt = effectCount(st.n);
  const t = nearestEnemy(player.x, player.y, 700);
  if (!t) { player.cds.laser = .4; return; }
  const base = Math.atan2(t.y - player.y, t.x - player.x);
  player.aimDir = dirFromVector(t.x - player.x, t.y - player.y);
  player.aimT = .6;
  const len = 560;
  for (let i = 0; i < cnt; i++) {
    const a = base + (i - (cnt - 1) / 2) * .42;
    const ca = Math.cos(a), sa = Math.sin(a);
    beams.push({ x: player.x, y: player.y - 14, ang: a, len, life: .18, max: .18 });
    for (const e of enemies) {
      if (e.dead) continue;
      const rx = e.x - player.x, ry = e.y - (player.y - 14);
      const proj = rx * ca + ry * sa;
      if (proj < 0 || proj > len) continue;
      if (Math.abs(-rx * sa + ry * ca) < e.r + 9) damageEnemy(e, st.dmg * player.atkMul, 4);
    }
    for (let dl = 30; dl < len; dl += 44) for (const c of crates) hitCrate(c, player.x + ca * dl, player.y - 14 + sa * dl, 8, 'lz');
  }
  sfx('zap');
}
function fireMissile() {
  const st = skSt('missile');
  const cnt = effectCount(st.cnt);
  for (let i = 0; i < cnt; i++) {
    const a = -Math.PI / 2 + rand(-.9, .9);
    bullets.push({ id: uid++, kind: 'missile', x: player.x, y: player.y - 10, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 10, dmg: st.dmg * player.atkMul, zr: st.r, life: 4, spd: 260, dead: false });
  }
  sfx('shoot');
}
function fireMine() {
  const st = skSt('mine');
  let alive = bullets.reduce((n, b) => n + (b.kind === 'mine' && !b.dead ? 1 : 0), 0);
  const cnt = effectCount(st.cnt);
  const cap = effectCount(st.cap);
  for (let i = 0; i < cnt; i++) {
    if (alive >= cap) break;
    alive++;
    const a = rand(0, Math.PI * 2), d = rand(36, 90);
    bullets.push({ id: uid++, kind: 'mine', x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d, vx: 0, vy: 0, r: 0, trigR: 34, zr: st.r, dmg: st.dmg * player.atkMul, life: 25, armT: .7, dead: false });
  }
}
function fireNova() {
  const st = skSt('nova');
  const cnt = effectCount(1);
  for (let i = 0; i < cnt; i++) {
    const a = i / cnt * Math.PI * 2 + Math.PI / 2;
    const off = cnt > 1 ? 18 : 0;
    novas.push({ x: player.x + Math.cos(a) * off, y: player.y + Math.sin(a) * off, r: 12, maxr: st.r, spd: 330, dmg: st.dmg * player.atkMul, slow: st.slow, id: uid++ });
  }
  sfx('zap');
}
function fireTurret() {
  const st = skSt('turret');
  const maxTurrets = effectCount(st.n);
  const spawnN = effectCount(1);
  while (turrets.length >= maxTurrets) turrets.shift();
  for (let i = 0; i < spawnN; i++) {
    while (turrets.length >= maxTurrets) turrets.shift();
    turrets.push({ x: player.x + rand(-54, 54), y: player.y + rand(-54, 54), life: st.dur, shootT: .2 + i * .08, ang: 0, dmg: st.dmg * player.atkMul, fr: st.fr });
  }
  sfx('pick');
}
function updateSkills(dt) {
  for (const id of ['knife', 'drill', 'molotov', 'thunder', 'boomer', 'laser', 'missile', 'mine', 'nova', 'turret']) {
    if (!skLv(id)) continue;
    player.cds[id] -= dt;
    if (player.cds[id] <= 0) {
      const st = skSt(id);
      player.cds[id] = st.cd * player.cdMul;
      if (id === 'knife') fireKnife();
      else if (id === 'drill') fireDrill();
      else if (id === 'molotov') fireMolotov();
      else if (id === 'thunder') fireThunder();
      else if (id === 'boomer') fireBoomer();
      else if (id === 'laser') fireLaser();
      else if (id === 'missile') fireMissile();
      else if (id === 'mine') fireMine();
      else if (id === 'nova') fireNova();
      else if (id === 'turret') fireTurret();
    }
  }
  // 瀹堣鍏夌悆
  if (skLv('guard')) {
    const st = skSt('guard');
    const cnt = effectCount(st.n);
    player.guardAng += st.sp * dt;
    for (let i = 0; i < cnt; i++) {
      const a = player.guardAng + i * Math.PI * 2 / cnt;
      const bx = player.x + Math.cos(a) * st.r, by = player.y + Math.sin(a) * st.r;
      forEnem(bx, by, 14, e => {
        if ((e.hitCD.g || 0) > gtime) return;
        e.hitCD.g = gtime + .38;
        damageEnemy(e, st.dmg * player.atkMul, 8);
      });
      for (const c of crates) hitCrate(c, bx, by, 16, 'g');
    }
  }
  // 闃茶鍔涘牬
  if (skLv('field')) {
    const st = skSt('field');
    forEnem(player.x, player.y, st.r - 10, e => {
      if ((e.hitCD.f || 0) > gtime) return;
      e.hitCD.f = gtime + .42;
      damageEnemy(e, st.dmg * player.atkMul, 26);
    });
  }
  // Drone
  if (skLv('drone')) {
    const st = skSt('drone');
    const cnt = effectCount(st.n);
    player.droneAng += dt * 1.8;
    player.droneShoot -= dt;
    player.droneAims = player.droneAims || [];
    if (player.droneShoot <= 0) {
      player.droneShoot = 1.05 * player.cdMul;
      for (let i = 0; i < cnt; i++) {
        const a = player.droneAng + i * Math.PI * 2 / cnt;
        const dx = player.x + Math.cos(a) * 52, dy = player.y + Math.sin(a) * 52 - 26;
        const t = nearestEnemy(dx, dy, 460);
        if (!t) {
          if (!Number.isFinite(player.droneAims[i])) player.droneAims[i] = a;
          continue;
        }
        const ang = Math.atan2(t.y - dy, t.x - dx);
        player.droneAims[i] = ang;
        bullets.push({ id: uid++, kind: 'bolt', x: dx, y: dy, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, r: 5, dmg: st.dmg * player.atkMul, life: 1, dead: false });
      }
      sfx('shoot');
    }
  }
}

/* ---------------- 鏈ㄧ ---------------- */
function hitCrate(c, x, y, r, srcKey) {
  if (c.hp <= 0) return false;
  const rr = r + 20;
  if (dist2(x, y, c.x, c.y) > rr * rr) return false;
  if (srcKey) {
    c.cd = c.cd || {};
    if ((c.cd[srcKey] || 0) > gtime) return false;
    c.cd[srcKey] = gtime + .5;
  }
  c.hp--;
  poof(c.x, c.y, 3, '#c9a063');
  if (c.hp <= 0) {
    poof(c.x, c.y, 8, '#c9a063'); sfx('boom');
    const r2 = Math.random();
    if (r2 < .5) { for (let i = 0; i < irand(1, 3); i++) dropCoin(c.x, c.y); }
    else if (r2 < .68) dropPickup(c.x, c.y, 'meat');
    else if (r2 < .82) dropPickup(c.x, c.y, 'magnet');
    else if (r2 < .94) dropPickup(c.x, c.y, 'bomb');
    else dropPickup(c.x, c.y, 'chest');
  }
  return true;
}

/* ---------------- BOSS 琛岀偤 ---------------- */
function bossMinionType() {
  if (chIdx >= 4) return Math.random() < .55 ? 'phantom' : 'leaper';
  if (chIdx >= 3) return Math.random() < .5 ? 'splitter' : 'shielder';
  return chIdx === 2 ? 'fast' : 'walker';
}
function bossLogic(e, dt) {
  const b = chapter.boss;
  e.bt -= dt;
  if (e.bphase === 'chase') {
    const d = Math.max(1, Math.hypot(player.x - e.x, player.y - e.y));
    e.dir = dirFromVector(player.x - e.x, player.y - e.y);
    e.x += (player.x - e.x) / d * e.spd * dt;
    e.y += (player.y - e.y) / d * e.spd * dt;
    if (e.bt <= 0) {
      const pat = b.patterns[e.pati % b.patterns.length]; e.pati++;
      if (pat === 'charge') { e.bphase = 'tele'; e.bt = .8; const a = Math.atan2(player.y - e.y, player.x - e.x); e.dashX = Math.cos(a); e.dashY = Math.sin(a); }
      else if (pat === 'radial') {
        for (let i = 0; i < 14; i++) {
          const a = i / 14 * Math.PI * 2;
          ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 185, vy: Math.sin(a) * 185, r: 7, dmg: Math.round(e.dmg * .55), life: 3.2 });
        }
        sfx('boom'); e.bphase = 'chase'; e.bt = 2.4;
      }
      else if (pat === 'summon') {
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          if (enemies.length < chapter.cap + 20) spawnEnemy(bossMinionType(), e.x + Math.cos(a) * 110, e.y + Math.sin(a) * 110);
        }
        sfx('boss'); e.bphase = 'chase'; e.bt = 2.6;
      }
      else if (pat === 'shock') {
        waves.push({ x: e.x, y: e.y, r: 30, maxr: 360, spd: 300, dmg: Math.round(e.dmg * .6), hit: false });
        sfx('boom'); e.bphase = 'chase'; e.bt = 2.6;
      }
      else if (pat === 'toxic') {
        const base = Math.atan2(player.y - e.y, player.x - e.x);
        for (let i = 0; i < 13; i++) {
          const a = base + (i - 6) * .16;
          ebullets.push({ x: e.x, y: e.y - 8, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 7, dmg: Math.round(e.dmg * .62), life: 3.4, col: '#7dff63' });
        }
        zones.push({ x: player.x + rand(-70, 70), y: player.y + rand(-70, 70), r: 58, life: 2.8, dmg: Math.round(e.dmg * .16), tickT: .2 });
        sfx('boom'); e.bphase = 'chase'; e.bt = 2.2;
      }
      else if (pat === 'split') {
        const types = ['splitter', 'leaper', 'shielder', 'splitter'];
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2;
          if (enemies.length < chapter.cap + 24) spawnEnemy(types[i % types.length], e.x + Math.cos(a) * 120, e.y + Math.sin(a) * 120);
        }
        sfx('boss'); e.bphase = 'chase'; e.bt = 2.7;
      }
      else if (pat === 'spiral') {
        const base = gtime * 2.3;
        for (let i = 0; i < 18; i++) {
          const a = base + i / 18 * Math.PI * 2;
          ebullets.push({ x: e.x, y: e.y - 6, vx: Math.cos(a) * 205, vy: Math.sin(a) * 205, r: 6.5, dmg: Math.round(e.dmg * .58), life: 3.6, col: '#b873ff' });
        }
        sfx('zap'); e.bphase = 'chase'; e.bt = 1.9;
      }
      else if (pat === 'rift') {
        for (let i = 0; i < 6; i++) {
          const a = rand(0, Math.PI * 2);
          const d = rand(150, 290);
          if (enemies.length < chapter.cap + 28) spawnEnemy(bossMinionType(), player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
          addBurst(player.x + Math.cos(a) * d, player.y + Math.sin(a) * d, 'bolt', 72, .24, .72);
        }
        sfx('boss'); e.bphase = 'chase'; e.bt = 2.5;
      }
      else if (pat === 'blink') {
        const a = Math.atan2(e.y - player.y, e.x - player.x) + rand(-.65, .65);
        const d = rand(150, 220);
        addBurst(e.x, e.y, 'bolt', 92, .26, .76);
        e.x = player.x + Math.cos(a) * d;
        e.y = player.y + Math.sin(a) * d;
        addBurst(e.x, e.y, 'bolt', 104, .28, .86);
        waves.push({ x: e.x, y: e.y, r: 24, maxr: 250, spd: 340, dmg: Math.round(e.dmg * .45), hit: false });
        sfx('zap'); e.bphase = 'chase'; e.bt = 1.6;
      }
      else if (pat === 'meteor') {
        for (let i = 0; i < 4; i++) {
          const x = player.x + rand(-150, 150), y = player.y + rand(-180, 120);
          waves.push({ x, y, r: 16, maxr: 150, spd: 260, dmg: Math.round(e.dmg * .5), hit: false });
          addBurst(x, y, 'explosion', 76, .32, .78);
        }
        sfx('boom'); e.bphase = 'chase'; e.bt = 2.2;
      }
    }
  } else if (e.bphase === 'tele') {
    e.dir = dirFromVector(e.dashX, e.dashY);
    if (e.bt <= 0) { e.bphase = 'dash'; e.bt = .5; sfx('boss'); }
  } else if (e.bphase === 'dash') {
    e.dir = dirFromVector(e.dashX, e.dashY);
    e.x += e.dashX * 760 * dt; e.y += e.dashY * 760 * dt;
    if (e.bt <= 0) { e.bphase = 'chase'; e.bt = rand(1.6, 2.4); }
  }
}

/* ---------------- 鐗规晥 ---------------- */
function addBurst(x, y, fx, size, life, alpha) {
  if (bursts.length > 80) bursts.shift();
  bursts.push({
    x, y, fx: fx || 'explosion',
    size: size || 72,
    life: life || .34,
    max: life || .34,
    rot: rand(0, Math.PI * 2),
    alpha: alpha == null ? 1 : alpha,
  });
}
function poof(x, y, n, col) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, Math.PI * 2), s = rand(30, 130);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.25, .5), max: .5, size: rand(2.5, 6), col });
  }
}
function boomFx(x, y, r) {
  shake = Math.max(shake, 7); sfx('boom');
  addBurst(x, y, 'explosion', r * 1.55, .38, 1);
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2), s = rand(60, 260);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(.3, .6), max: .6, size: rand(3, 8), col: i % 2 ? '#ffb24a' : '#ff6b3d' });
  }
}
function boltFx(x, y) {
  addBurst(x, y, 'bolt', 54, .2, .88);
  for (let i = 0; i < 6; i++) parts.push({ x: x + rand(-8, 8), y: y - i * 14, vx: rand(-30, 30), vy: rand(-20, 20), life: .18, max: .18, size: rand(2, 5), col: '#ffe75c' });
  parts.push({ x, y, vx: 0, vy: 0, life: .15, max: .15, size: 22, col: 'rgba(255,240,140,.7)' });
}
function lightningFx(x, y) {
  if (bursts.length > 80) bursts.shift();
  bursts.push({
    x, y, fx: 'lightningStrike',
    seq: 'lightningStrike',
    size: 168,
    life: .42,
    max: .42,
    rot: 0,
    alpha: .96,
  });
  shake = Math.max(shake, 3.5);
  for (let i = 0; i < 10; i++) {
    parts.push({
      x: x + rand(-18, 18),
      y: y + rand(-12, 8),
      vx: rand(-55, 55),
      vy: rand(-70, 10),
      life: rand(.16, .32),
      max: .32,
      size: rand(2, 5),
      col: i % 2 ? '#dff8ff' : '#72e7ff',
    });
  }
}
function splashProcFx(x, y) {
  if (bursts.length > 90) bursts.shift();
  bursts.push({
    x, y: y - 10, fx: 'splashProc',
    seq: 'splashProc',
    size: 138,
    life: .38,
    max: .38,
    rot: 0,
    alpha: .9,
  });
  shake = Math.max(shake, 2.4);
}
function addText(x, y, txt, col) {
  texts.push({ x, y, txt: String(txt), col: col || '#fff', life: .7 });
}

/* ---------------- 涓绘洿鏂?---------------- */
function update(dt) {
  gtime += dt;
  if (winT >= 0) { winT -= dt; if (winT <= 0) { endRun(true); return; } }

  // 鐜╁绉诲嫊
  const mv = moveVec();
  player.moving = mv.len > .05;
  if (player.moving) {
    player.x += mv.x * player.baseSpd * player.spdMul * dt;
    player.y += mv.y * player.baseSpd * player.spdMul * dt;
    if (Math.abs(mv.x) > .05) player.face = mv.x > 0 ? 1 : -1;
    player.dir = dirFromVector(mv.x, mv.y);
  }
  player.anim += dt * (player.moving ? 9 : 2);
  player.invuln -= dt;
  player.aimT = Math.max(0, player.aimT - dt);
  if (player.regen > 0) player.hp = clamp(player.hp + player.regen * dt, 0, player.maxhp);
  hurtFlash = Math.max(0, hurtFlash - dt);
  shake = Math.max(0, shake - 22 * dt);
  camX = player.x; camY = player.y;

  // Spawn enemies until the boss phase starts.
  if (!bossSpawned) {
    const rt = lerp(chapter.rate[0], chapter.rate[1], gtime / chapter.dur);
    spawnAcc += dt * rt;
    while (spawnAcc >= 1) {
      spawnAcc--;
      if (enemies.length < chapter.cap) {
        let mw = chapter.mix[0].w;
        for (const m of chapter.mix) if (gtime >= m.t) mw = m.w;
        const p = ringPos(0);
        spawnEnemy(pickWeighted(mw), p.x, p.y);
      }
    }
    const evs = chapter.events;
    while (eventIdx < evs.length && gtime >= evs[eventIdx].t) {
      const ev = evs[eventIdx]; eventIdx++;
      if (ev.type === 'ring') {
        const R = Math.hypot(viewW(), viewH()) / 2 + 60;
        for (let i = 0; i < ev.n; i++) {
          const a = i / ev.n * Math.PI * 2;
          if (enemies.length < chapter.cap + 40) spawnEnemy(chIdx >= 3 ? bossMinionType() : 'walker', player.x + Math.cos(a) * R, player.y + Math.sin(a) * R);
        }
        toast('怪物包圍！');
      } else if (ev.type === 'elite') spawnElite();
    }
    if (gtime >= chapter.dur) spawnBoss();
  } else if (bossActive) {
    spawnAcc += dt * chapter.rate[1] * 0.18;
    while (spawnAcc >= 1) {
      spawnAcc--;
      if (enemies.length < chapter.cap * .5) { const p = ringPos(0); spawnEnemy(chIdx >= 3 ? bossMinionType() : 'walker', p.x, p.y); }
    }
  }

  // 鏈ㄧ缍
  crateT -= dt;
  if (crateT <= 0) {
    crateT = 2;
    let near = 0;
    for (const c of crates) if (c.hp > 0 && dist2(c.x, c.y, player.x, player.y) < 1100 * 1100) near++;
    if (near < 7) spawnCrate();
    crates = crates.filter(c => c.hp > 0 && dist2(c.x, c.y, player.x, player.y) < 1600 * 1600);
  }

  // 鏁典汉
  rebuildGrid();
  for (const e of enemies) {
    if (e.dead) continue;
    e.flash -= dt; e.atkT -= dt; e.anim += dt * e.spd / 14; e.burnT = Math.max(0, (e.burnT || 0) - dt);
    e.phaseT = (e.phaseT || 0) + dt;
    if (e.shield) {
      e.shieldT = Math.max(0, (e.shieldT || 0) - dt);
      e.shieldCD = (e.shieldCD || 0) - dt;
      if (e.shieldCD <= 0) {
        e.shieldT = 1.35;
        e.shieldCD = rand(4.0, 5.2);
      }
    }
    if (e.stunT > 0) { e.stunT -= dt; continue; }
    let emul = 1;
    if (e.slowT > 0) { e.slowT -= dt; emul = .45; }
    if (e.phase) emul *= .86 + Math.sin(e.phaseT * 3.1) * .18;
    if (e.boss) { bossLogic(e, dt); }
    else {
      const dx = player.x - e.x, dy = player.y - e.y;
      const d = Math.max(1, Math.hypot(dx, dy));
      e.dir = dirFromVector(dx, dy);
      if (e.leap) {
        e.leapT -= dt;
        if (e.leapDashT > 0) {
          e.x += e.leapVx * dt;
          e.y += e.leapVy * dt;
          e.leapDashT -= dt;
        } else if (e.leapT <= 0 && d < 360) {
          e.leapVx = dx / d * e.spd * 4.4;
          e.leapVy = dy / d * e.spd * 4.4;
          e.leapDashT = .26;
          e.leapT = rand(1.7, 2.5);
          addBurst(e.x, e.y, 'bolt', 42, .18, .42);
        } else if (e.ranged && d < 270) {
          e.x += -dy / d * e.spd * emul * .35 * dt; e.y += dx / d * e.spd * emul * .35 * dt;
        } else {
          e.x += dx / d * e.spd * emul * dt; e.y += dy / d * e.spd * emul * dt;
        }
      } else if (e.ranged && d < 270) {
        e.x += -dy / d * e.spd * emul * .35 * dt; e.y += dx / d * e.spd * emul * .35 * dt;
        e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = 2.6;
          ebullets.push({ x: e.x, y: e.y, vx: dx / d * 155, vy: dy / d * 155, r: 6, dmg: Math.round(e.dmg * 1.3), life: 3.5 });
        }
      } else {
        if (e.phase) { e.x += -dy / d * e.spd * emul * .28 * Math.sin(e.phaseT * 2.2) * dt; e.y += dx / d * e.spd * emul * .28 * Math.sin(e.phaseT * 2.2) * dt; }
        e.x += dx / d * e.spd * emul * dt; e.y += dy / d * e.spd * emul * dt;
      }
    }
    // 鎺ヨЦ鍌峰
    const rr = e.r + player.r + 2;
    if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
      if (e.boom) { killEnemy(e); continue; }
      if (e.atkT <= 0) { e.atkT = .9; damagePlayer(e.dmg); }
    }
  }
  rebuildGrid();
  separateEnemies();
  separateEnemies();
  rebuildGrid();

  // Skills
  updateSkills(dt);
  rebuildGrid();

  // 鎴戞柟瀛愬綀
  const vw2 = viewW() / 2, vh2 = viewH() / 2;
  for (const b of bullets) {
    if (b.dead) continue;
    b.life -= dt;
    if (b.life <= 0) { b.dead = true; continue; }
    if (b.kind === 'molotov') {
      b.t += dt;
      const k = clamp(b.t / b.dur, 0, 1);
      b.x = lerp(b.sx, b.tx, k); b.y = lerp(b.sy, b.ty, k) - Math.sin(k * Math.PI) * 60;
      if (k >= 1) {
        b.dead = true;
        zones.push({ x: b.tx, y: b.ty, r: b.zr, life: 3, dmg: b.dmg, tickT: 0 });
        addBurst(b.tx, b.ty, 'explosion', Math.max(64, b.zr * 1.1), .34, .9);
        poof(b.tx, b.ty, 6, '#ff9b3d'); sfx('boom');
      }
      continue;
    }
    if (b.kind === 'boomer') {
      b.spin += dt * 14;
      if (b.phase === 0) {
        b.spd -= 620 * dt;
        if (b.spd <= 0) b.phase = 1;
        const a = Math.atan2(b.vy, b.vx);
        b.vx = Math.cos(a) * Math.max(0, b.spd); b.vy = Math.sin(a) * Math.max(0, b.spd);
      } else {
        const dx = player.x - b.x, dy = player.y - b.y, d = Math.max(1, Math.hypot(dx, dy));
        b.spd = Math.min(560, b.spd + 900 * dt);
        b.vx = dx / d * b.spd; b.vy = dy / d * b.spd;
        if (d < 26) { b.dead = true; continue; }
      }
    }
    if (b.kind === 'missile') {
      const t = nearestEnemy(b.x, b.y, 560);
      if (t) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        let cur = Math.atan2(b.vy, b.vx);
        let dA = want - cur;
        while (dA > Math.PI) dA -= Math.PI * 2;
        while (dA < -Math.PI) dA += Math.PI * 2;
        cur += clamp(dA, -7 * dt, 7 * dt);
        b.spd = Math.min(520, b.spd + 820 * dt);
        b.vx = Math.cos(cur) * b.spd; b.vy = Math.sin(cur) * b.spd;
      }
      if (Math.random() < .5) parts.push({ x: b.x, y: b.y, vx: -b.vx * .12, vy: -b.vy * .12, life: .3, max: .3, size: rand(3, 6), col: '#ffb46b' });
      b.x += b.vx * dt; b.y += b.vy * dt;
      let hit = false;
      forEnem(b.x, b.y, b.r + 6, () => { hit = true; });
      if (hit) {
        b.dead = true;
        forEnem(b.x, b.y, b.zr, e => damageEnemy(e, b.dmg, 14));
        for (const c of crates) hitCrate(c, b.x, b.y, b.zr, null);
        addBurst(b.x, b.y, 'explosion', b.zr * 1.45, .36, 1);
        poof(b.x, b.y, 7, '#ff9b3d'); sfx('boom');
      }
      continue;
    }
    if (b.kind === 'mine') {
      if (b.armT > 0) { b.armT -= dt; continue; }
      let trig = false;
      forEnem(b.x, b.y, b.trigR, () => { trig = true; });
      if (trig) {
        b.dead = true;
        forEnem(b.x, b.y, b.zr, e => damageEnemy(e, b.dmg, 16));
        for (const c of crates) hitCrate(c, b.x, b.y, b.zr, null);
        addBurst(b.x, b.y, 'explosion', b.zr * 1.38, .35, 1);
        poof(b.x, b.y, 8, '#ffd35c'); sfx('boom');
      }
      continue;
    }
    if (b.kind === 'drill') {
      b.spin += dt * 10;
      if (b.x < camX - vw2) { b.x = camX - vw2; b.vx = Math.abs(b.vx); }
      if (b.x > camX + vw2) { b.x = camX + vw2; b.vx = -Math.abs(b.vx); }
      if (b.y < camY - vh2) { b.y = camY - vh2; b.vy = Math.abs(b.vy); }
      if (b.y > camY + vh2) { b.y = camY + vh2; b.vy = -Math.abs(b.vy); }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    const pierce = b.kind === 'drill' || b.kind === 'boomer';
    forEnem(b.x, b.y, b.r, e => {
      if (b.dead) return;
      if (pierce) {
        const key = 'b' + b.id;
        if ((e.hitCD[key] || 0) > gtime) return;
        e.hitCD[key] = gtime + .45;
        damageEnemy(e, b.dmg, 6);
      } else {
        damageEnemy(e, b.dmg, 10);
        b.dead = true;
      }
    });
    if (!b.dead) for (const c of crates) {
      if (hitCrate(c, b.x, b.y, b.r, pierce ? 'b' + b.id : null)) { if (!pierce) { b.dead = true; break; } }
    }
  }
  bullets = bullets.filter(b => !b.dead);

  // 鏁垫柟瀛愬綀
  for (const b of ebullets) {
    b.life -= dt; b.x += b.vx * dt; b.y += b.vy * dt;
    const rr = b.r + player.r;
    if (dist2(b.x, b.y, player.x, player.y) < rr * rr) { damagePlayer(b.dmg); b.life = 0; }
  }
  ebullets = ebullets.filter(b => b.life > 0);

  // 鐏捣
  for (const z of zones) {
    z.life -= dt; z.tickT -= dt;
    if (z.tickT <= 0) {
      z.tickT = .5;
      forEnem(z.x, z.y, z.r, e => {
        e.burnT = Math.max(e.burnT || 0, .72);
        damageEnemy(e, z.dmg);
      });
      for (const c of crates) hitCrate(c, z.x, z.y, z.r, 'z');
      if (Math.random() < .8) parts.push({ x: z.x + rand(-z.r, z.r) * .7, y: z.y + rand(-z.r, z.r) * .7, vx: 0, vy: -40, life: .4, max: .4, size: rand(4, 9), col: '#ff9b3d' });
    }
  }
  zones = zones.filter(z => z.life > 0);

  // Shockwaves
  for (const wv of waves) {
    wv.r += wv.spd * dt;
    const d = Math.hypot(player.x - wv.x, player.y - wv.y);
    if (!wv.hit && Math.abs(d - wv.r) < 24) { wv.hit = true; damagePlayer(wv.dmg); }
  }
  waves = waves.filter(w => w.r < w.maxr);

  // 冰霜新星（擴張環，命中減速）
  for (const nv of novas) {
    nv.r += nv.spd * dt;
    forEnem(nv.x, nv.y, nv.r + 26, e => {
      const d = Math.hypot(e.x - nv.x, e.y - nv.y);
      if (Math.abs(d - nv.r) > 26) return;
      const key = 'n' + nv.id;
      if (e.hitCD[key]) return;
      e.hitCD[key] = 1;
      damageEnemy(e, nv.dmg, 10);
      e.slowT = Math.max(e.slowT || 0, nv.slow);
    });
  }
  novas = novas.filter(n => n.r < n.maxr);

  // 自動砲塔
  for (const tr of turrets) {
    tr.life -= dt; tr.shootT -= dt;
    if (tr.shootT <= 0) {
      const t = nearestEnemy(tr.x, tr.y, 480);
      if (t) {
        tr.ang = Math.atan2(t.y - tr.y, t.x - tr.x);
        bullets.push({ id: uid++, kind: 'bolt', x: tr.x, y: tr.y - 16, vx: Math.cos(tr.ang) * 620, vy: Math.sin(tr.ang) * 620, r: 5, dmg: tr.dmg, life: 1, dead: false });
        sfx('shoot');
      }
      tr.shootT = tr.fr * player.cdMul;
    }
  }
  turrets = turrets.filter(t => t.life > 0);

  // 雷射光束殘影
  for (const bm of beams) bm.life -= dt;
  beams = beams.filter(b => b.life > 0);
  for (const bu of bursts) bu.life -= dt;
  bursts = bursts.filter(b => b.life > 0);

  // 瀵剁煶 / 閲戝梗 / 閬撳叿
  for (const g of gems) {
    const d = Math.hypot(player.x - g.x, player.y - g.y);
    if (g.att || d < player.magR) {
      g.sp = Math.min(720, g.sp + 1500 * dt);
      const k = Math.min(1, g.sp * dt / Math.max(1, d));
      g.x += (player.x - g.x) * k; g.y += (player.y - g.y) * k;
    }
    if (d < 22) { g.got = true; gainExp(g.val); sfx('pick'); }
  }
  gems = gems.filter(g => !g.got);
  for (const c of coinsArr) {
    const d = Math.hypot(player.x - c.x, player.y - c.y);
    if (d < player.magR) {
      c.sp = Math.min(720, c.sp + 1500 * dt);
      const k = Math.min(1, c.sp * dt / Math.max(1, d));
      c.x += (player.x - c.x) * k; c.y += (player.y - c.y) * k;
    }
    if (d < 22) { c.got = true; addRunCoins(1); sfx('pick'); }
  }
  coinsArr = coinsArr.filter(c => !c.got);
  for (const p of pickups) {
    p.bob += dt * 4;
    if (dist2(p.x, p.y, player.x, player.y) < 30 * 30) {
      p.got = true;
      if (p.kind === 'meat') { player.hp = clamp(player.hp + player.maxhp * .3, 0, player.maxhp); addText(player.x, player.y - 28, '補血 +' + Math.round(player.maxhp * .3), '#7dff8a'); sfx('pick'); }
      else if (p.kind === 'magnet') { for (const g of gems) g.att = true; toast('磁鐵：吸取全場經驗'); sfx('chest'); }
      else if (p.kind === 'bomb') {
        boomFx(player.x, player.y, 100); shake = 10;
        const list = enemies.slice();
        for (const e of list) if (!e.dead && Math.abs(e.x - camX) < vw2 + 60 && Math.abs(e.y - camY) < vh2 + 60) damageEnemy(e, 250);
        toast('炸彈：全畫面轟炸');
      }
      else if (p.kind === 'chest') grantRandomUpgrade();
    }
  }
  pickups = pickups.filter(p => !p.got);

  // 绮掑瓙 / 鏂囧瓧
  for (const p of parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  parts = parts.filter(p => p.life > 0);
  for (const t of texts) { t.life -= dt; t.y -= 46 * dt; }
  texts = texts.filter(t => t.life > 0);

  // 娓呮帀姝讳骸鏁典汉
  enemies = enemies.filter(e => !e.dead);

  // HUD
  hudT -= dt;
  if (hudT <= 0) { hudT = .12; syncHud(); }

  // 鍗囩礆
  if (pendingLv > 0 && state === 'play' && winT < 0) { sfx('lvl'); openLevelUp(); }
}

/* ---------------- HUD ---------------- */
function syncHud() {
  $('kills').textContent = '擊殺 ' + kills;
  $('timer').textContent = fmtT(gtime);
  $('coins').innerHTML = coinCounterHtml(coinGain, 'hud-coin');
  $('lvbadge').textContent = 'Lv.' + player.lvl;
  $('expfill').style.width = clamp(player.exp / expNeed() * 100, 0, 100) + '%';
  if (bossActive) $('bossbar').style.width = clamp(bossActive.hp / bossActive.maxhp * 100, 0, 100) + '%';
  layoutBossHud();
}
function rebuildSkillbar() {
  const bar = $('skillbar'); bar.innerHTML = '';
  for (const table of [SKILLS, PASSIVES]) {
    for (const id in table) {
      const lv = skLv(id); if (!lv) continue;
      const d = document.createElement('div');
      d.className = 'skill-ico' + (table === PASSIVES ? ' passive' : '');
      d.innerHTML = `${skillIconHtml(id)}<span class="slv">${lv}</span>`;
      bar.appendChild(d);
    }
  }
  layoutBossHud();
}
function layoutBossHud() {
  const boss = $('bosswrap');
  if (!boss || boss.style.display === 'none') return;
  const root = $('game-root'), topbar = $('topbar');
  if (!root || !topbar) return;
  const rootBox = root.getBoundingClientRect();
  const topbarBox = topbar.getBoundingClientRect();
  const safeTop = Math.ceil(topbarBox.bottom - rootBox.top + 8);
  boss.style.top = safeTop + 'px';
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  $('toasts').appendChild(t);
  setTimeout(() => t.remove(), 2300);
}
function warn(msg) {
  const w = $('warn');
  w.textContent = msg;
  w.classList.remove('flash');
  void w.offsetWidth;
  w.classList.add('flash');
}

/* ---------------- 鐣潰 ---------------- */
function showScreen(name, keepHud) {
  for (const id of ['menu', 'select', 'talents', 'hud', 'levelup', 'pausemenu', 'result']) {
    $(id).classList.toggle('show', !!(id === name || (keepHud && id === 'hud')));
  }
}
function buildSelect() {
  const list = $('ch-list'); list.innerHTML = '';
  CHAPTERS.forEach((c, i) => {
    const lock = (i + 1) > unlocked;
    const cleared = unlocked > i + 1;
    const card = document.createElement('div');
    card.className = `ch-card ch-${i + 1}` + (lock ? ' locked' : '');
    card.tabIndex = lock ? -1 : 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-disabled', lock ? 'true' : 'false');
    card.setAttribute('aria-label', c.name);
    card.innerHTML = `
      <div class="ch-art">
        <img src="assets/ui/chapter-${i + 1}.png?v=chapters-5-1" alt="">
        <div class="ch-art-shade"></div>
        <div class="ch-badge">${lock ? '未解鎖' : cleared ? '已通關' : '可挑戰'}</div>
      </div>
      <div class="ch-body">
        <h3>${c.name}</h3>
        <div class="ch-desc">${c.desc.replace('\n', '<br>')}</div>
        <div class="ch-meta">
          <span>${Math.round(c.dur / 60 * 10) / 10} 分鐘</span>
          <span>BOSS 戰</span>
        </div>
      </div>`;
    if (!lock) {
      card.onclick = () => startChapter(i);
      card.onkeydown = e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startChapter(i);
        }
      };
    }
    list.appendChild(card);
  });
}
function buildTalents() {
  $('talent-coins').innerHTML = coinCounterHtml(totalCoins, 'menu-coin');
  const list = $('talent-list');
  list.innerHTML = '';
  for (const id of TALENT_ORDER) {
    const t = TALENTS[id];
    const lv = talentLv(id);
    const cost = talentCost(id);
    const maxed = lv >= t.max;
    const canBuy = !maxed && totalCoins >= cost;
    const card = document.createElement('div');
    card.className = 'talent-card' + (maxed ? ' maxed' : '') + (!canBuy && !maxed ? ' locked' : '');
    const dots = Array.from({ length: t.max }, (_, i) => `<span class="${i < lv ? 'on' : ''}"></span>`).join('');
    const current = lv ? t.desc(lv) : '尚未強化';
    const next = maxed ? '已達最高等級' : `下一級：${t.desc(lv + 1)}`;
    card.innerHTML = `
      <div class="talent-icon">${talentIconHtml(id)}</div>
      <div class="talent-main">
        <div class="talent-head">
          <h3>${t.name}</h3>
          <b>Lv.${lv}/${t.max}</b>
        </div>
        <div class="talent-dots">${dots}</div>
        <p>${current}</p>
        <small>${next}</small>
      </div>
      <button class="talent-buy" ${canBuy ? '' : 'disabled'}>${maxed ? '<span class="talent-buy-label">已滿級</span>' : `${coinCounterHtml(cost, 'talent-cost')} <span class="talent-buy-label">升級</span>`}</button>`;
    const btn = card.querySelector('.talent-buy');
    if (canBuy) btn.onclick = () => buyTalent(id);
    list.appendChild(card);
  }
}
function buyTalent(id) {
  const t = TALENTS[id];
  const lv = talentLv(id);
  if (!t || lv >= t.max) return;
  const cost = talentCost(id);
  if (totalCoins < cost) { toast('金幣不足'); return; }
  totalCoins -= cost;
  talents[id] = lv + 1;
  saveTalents();
  localStorage.setItem('ddtg_coins', String(totalCoins));
  refreshTalentBonus();
  if (player) recalc();
  $('menu-coins').innerHTML = coinCounterHtml(totalCoins, 'menu-coin');
  buildTalents();
  toast(`${t.name} Lv.${talents[id]}`);
  sfx('pick');
}

/* ---------------- 娴佺▼ ---------------- */
function startChapter(i) {
  i = clamp(i || 0, 0, MAX_CHAPTERS - 1);
  chIdx = i; chapter = CHAPTERS[i];
  gtime = 0; spawnAcc = 0; eventIdx = 0; bossSpawned = false; bossActive = null; winT = -1;
  kills = 0; coinGain = 0; bankedAmt = 0; runCoinRemainder = 0; pendingLv = 0; reviveUsed = false;
  shake = 0; hurtFlash = 0; crateT = 0;
  enemies = []; bullets = []; ebullets = []; zones = []; waves = [];
  gems = []; coinsArr = []; pickups = []; crates = []; parts = []; texts = [];
  beams = []; novas = []; turrets = []; bursts = [];
  player = newPlayer();
  player.skills = {}; player.cds = {};
  acquireOrLevel('knife');
  camX = player.x; camY = player.y;
  for (let k = 0; k < 5; k++) spawnCrate();
  $('bosswrap').style.display = 'none';
  syncHud();
  showScreen('hud');
  toast(chapter.name + ' 開始');
  state = 'play';
}
function endRun(win) {
  totalCoins += (coinGain - bankedAmt);
  bankedAmt = coinGain;
  localStorage.setItem('ddtg_coins', String(totalCoins));
  if (win) {
    unlocked = Math.max(unlocked, Math.min(MAX_CHAPTERS, chIdx + 2));
    localStorage.setItem('ddtg_unlock', String(unlocked));
  }
  state = win ? 'win' : 'lose';
  sfx(win ? 'win' : 'lose');
  const tt = $('result-title');
  tt.textContent = win ? '章節通關' : '任務失敗';
  tt.className = win ? 'win' : 'lose';
  $('result-stats').innerHTML =
    `<div class="result-row"><span class="result-label">生存時間</span><b class="result-value">${fmtT(gtime)}</b></div>` +
    `<div class="result-row"><span class="result-label">擊殺數</span><b class="result-value">${kills}</b></div>` +
    `<div class="result-row"><span class="result-label">等級</span><b class="result-value">Lv.${player.lvl}</b></div>` +
    `<div class="result-row"><span class="result-label coin-result-label">${itemIconHtml('coin', 'coin-icon result-coin')}<span>金幣</span></span><b class="result-value">+${coinGain}</b></div>`;
  $('btn-next').style.display = (win && chIdx < MAX_CHAPTERS - 1) ? '' : 'none';
  $('btn-revive').style.display = (!win && !reviveUsed) ? '' : 'none';
  showScreen('result', true);
}
function revive() {
  reviveUsed = true;
  player.hp = player.maxhp;
  player.invuln = 2.5;
  const list = enemies.slice();
  for (const e of list) if (!e.dead && !e.boss && dist2(e.x, e.y, player.x, player.y) < 300 * 300) killEnemy(e);
  boomFx(player.x, player.y, 120);
  showScreen('hud');
  state = 'play';
  toast('復活：短暫無敵');
}
function doPause() { if (state !== 'play') return; state = 'pause'; showScreen('pausemenu', true); }
function doResume() { if (state !== 'pause') return; state = 'play'; showScreen('hud'); }
function toMenu() { chapter = null; state = 'menu'; $('menu-coins').innerHTML = coinCounterHtml(totalCoins, 'menu-coin'); showScreen('menu'); }
function toSelect() { chapter = null; state = 'select'; buildSelect(); showScreen('select'); }
function toTalents() { chapter = null; state = 'talents'; buildTalents(); showScreen('talents'); }
function syncSoundBtns() {
  const label = soundOn ? '音效：開' : '音效：關';
  $('btn-sound').textContent = label; $('btn-sound2').textContent = label;
}
function toggleSound() {
  soundOn = !soundOn;
  localStorage.setItem('ddtg_sound', soundOn ? '1' : '0');
  syncSoundBtns();
}

/* ============================================================
   绻?瑁斤紙鍏ㄩ儴鍘熷壍鍚戦噺缇庤锛?   ============================================================ */
function drawGround() {
  const g = chapter.gfx;
  const vw = viewW(), vh = viewH();
  const x0 = camX - vw / 2, y0 = camY - vh / 2;
  ctx.fillStyle = g.base;
  ctx.fillRect(x0, y0, vw, vh);
  const T = 120;
  const cx0 = Math.floor(x0 / T), cx1 = Math.floor((x0 + vw) / T);
  const cy0 = Math.floor(y0 / T), cy1 = Math.floor((y0 + vh) / T);
  for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
    const px = cx * T, py = cy * T;
    if ((cx + cy) % 2 === 0) { ctx.fillStyle = g.alt; ctx.fillRect(px, py, T, T); }
    const h = hash2(cx, cy);
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1;
    ctx.strokeRect(px, py, T, T);
    if (g.deco === 'city') {
      if (h % 23 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.arc(px + 60, py + 60, 20, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,.08)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(px + 60, py + 60, 14, 0, 7); ctx.stroke();
      } else if (h % 17 === 3) {
        ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 20, py + 30); ctx.lineTo(px + 55, py + 60); ctx.lineTo(px + 45, py + 95); ctx.stroke();
      } else if (h % 29 === 5) {
        ctx.fillStyle = 'rgba(255,255,255,.10)';
        ctx.fillRect(px + 52, py + 10, 16, 40); ctx.fillRect(px + 52, py + 70, 16, 40);
      }
    } else if (g.deco === 'sewer') {
      if (h % 19 === 0) {
        ctx.fillStyle = 'rgba(80,220,190,.10)';
        ctx.beginPath(); ctx.ellipse(px + 60, py + 64, 36, 22, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(80,220,190,.16)';
        ctx.beginPath(); ctx.ellipse(px + 60, py + 64, 20, 11, 0, 0, 7); ctx.fill();
      } else if (h % 23 === 4) {
        ctx.fillStyle = 'rgba(0,0,0,.22)';
        for (let i = 0; i < 4; i++) ctx.fillRect(px + 18 + i * 24, py + 54, 12, 12);
      }
    } else if (g.deco === 'factory') {
      if (h % 13 === 0) {
        ctx.fillStyle = 'rgba(0,0,0,.25)';
        ctx.beginPath(); ctx.arc(px + 16, py + 16, 4, 0, 7); ctx.arc(px + 104, py + 16, 4, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.arc(px + 16, py + 104, 4, 0, 7); ctx.arc(px + 104, py + 104, 4, 0, 7); ctx.fill();
      } else if (h % 31 === 6) {
        ctx.save(); ctx.translate(px + 60, py + 60); ctx.rotate(-.5);
        for (let i = -2; i <= 2; i++) { ctx.fillStyle = i % 2 ? 'rgba(255,200,40,.16)' : 'rgba(20,20,20,.2)'; ctx.fillRect(i * 14 - 7, -34, 14, 68); }
        ctx.restore();
      }
    } else if (g.deco === 'lab') {
      if (h % 17 === 0) {
        ctx.fillStyle = 'rgba(70,255,130,.12)';
        ctx.beginPath(); ctx.ellipse(px + 60, py + 64, 34, 19, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(80,255,150,.18)';
        ctx.beginPath(); ctx.arc(px + 60, py + 64, 8, 0, 7); ctx.fill();
      } else if (h % 29 === 7) {
        ctx.strokeStyle = 'rgba(120,255,180,.12)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(px + 18, py + 24); ctx.lineTo(px + 50, py + 56); ctx.lineTo(px + 96, py + 42); ctx.stroke();
      }
    } else if (g.deco === 'rift') {
      if (h % 19 === 0) {
        ctx.save(); ctx.translate(px + 60, py + 60); ctx.rotate((h % 628) / 100);
        ctx.strokeStyle = 'rgba(178,111,255,.18)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(0, 0, 24, -.8, 2.4); ctx.stroke();
        ctx.strokeStyle = 'rgba(95,220,255,.12)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 13, 2.4, 5.5); ctx.stroke();
        ctx.restore();
      } else if (h % 31 === 8) {
        ctx.fillStyle = 'rgba(180,120,255,.08)';
        ctx.beginPath(); ctx.moveTo(px + 35, py + 20); ctx.lineTo(px + 72, py + 44); ctx.lineTo(px + 54, py + 93); ctx.closePath(); ctx.fill();
      }
    }
  }
  if (g.tint) { ctx.fillStyle = g.tint; ctx.fillRect(x0, y0, vw, vh); }
}
function shadow(x, y, r) {
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  ctx.beginPath(); ctx.ellipse(x, y + r * .82, r * .95, r * .42, 0, 0, 7); ctx.fill();
}
function enemySprite(e) {
  if (e.boss) return SPRITES.bosses[chIdx] || SPRITES.bosses[0];
  return SPRITES.enemies[e.sprite || e.type] || SPRITES.enemies.walker;
}
function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0 && p.invuln < 1.4) return;
  const bob = p.moving ? Math.sin(p.anim * 1.8) * 1.4 : Math.sin(p.anim * 2) * .7;
  const frame = animFrame(p.anim, p.moving, .9);
  shadow(p.x, p.y, 16);

  const torsoDir = p.aimT > 0 ? p.aimDir : p.dir;
  let drawn = false;
  if (spriteReady(SPRITES.heroUpper) && spriteReady(SPRITES.heroLower) && spriteReady(SPRITES.hero)) {
    const lowerDrawn = drawAtlasCellLayer(SPRITES.heroLower, SPRITES.hero, p.dir, frame, p.x, p.y + bob, 104, .69);
    const upperDrawn = drawAtlasCellLayer(SPRITES.heroUpper, SPRITES.hero, torsoDir, frame, p.x, p.y + bob, 104, .69);
    drawn = lowerDrawn && upperDrawn;
  } else if (torsoDir === p.dir) {
    drawn = drawAtlasCell(SPRITES.hero, p.dir, frame, p.x, p.y + bob, 104, .69);
  } else {
    // 下半身跟移動方向、上半身轉向射擊方向；上半身多畫 6px 蓋住接縫
    drawn = drawAtlasCellSlice(SPRITES.hero, p.dir, frame, p.x, p.y + bob, 104, .69, HERO_CUT, 1);
    if (drawn) drawTorsoFaded(SPRITES.hero, torsoDir, frame, p.dir, p.x, p.y + bob, 104, .69);
  }
  if (!drawn) {
    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.fillStyle = '#3a7bd5';
    ctx.strokeStyle = '#23262e';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-11, -23, 22, 34, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffcf3d';
    ctx.beginPath(); ctx.arc(0, -25, 12, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  const w = 42, hpw = clamp(p.hp / p.maxhp, 0, 1) * w;
  const hpY = p.y - 82;
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(p.x - w / 2 - 1, hpY, w + 2, 6);
  ctx.fillStyle = p.hp / p.maxhp > .35 ? '#52e06b' : '#ff5c5c';
  ctx.fillRect(p.x - w / 2, hpY + 1, hpw, 4);
}
function drawEnemy(e) {
  const isBoss = !!e.boss;
  const dir = e.dir == null ? dirFromVector(player.x - e.x, player.y - e.y) : e.dir;
  const frame = animFrame(e.anim, e.stunT <= 0, isBoss ? .55 : .85);
  const bob = Math.sin(e.anim * (isBoss ? 1.2 : 1.8)) * (isBoss ? 1.4 : 1.1);
  const drawH = isBoss ? e.r * 4.9 : e.elite ? e.r * 4.1 : e.r * 4.8;
  const statusSize = drawH * (isBoss ? 1.02 : 1.08);
  const statusY = e.y + bob - drawH * .22;

  shadow(e.x, e.y, e.r * (isBoss ? 1.25 : 1));
  if (e.slowT > 0) glowCircle(e.x, e.y - e.r * .5, e.r * 1.6, 'rgba(130,210,255,.30)', 'rgba(130,210,255,0)', 1);
  if (e.shieldT > 0) glowCircle(e.x, e.y - e.r * .4, e.r * 1.9, 'rgba(120,230,255,.28)', 'rgba(60,160,255,0)', 1);
  if (e.elite) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,216,61,.85)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(e.x, e.y - e.r * .55, e.r * 1.25, 0, 7); ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  if (e.phase) ctx.globalAlpha *= .56 + Math.sin(e.phaseT * 5) * .16;
  if (e.flash > 0) ctx.filter = 'brightness(2.2) saturate(.45)';
  else if (e.shieldT > 0) ctx.filter = 'brightness(1.35) saturate(1.18)';
  const drawn = drawAtlasCell(enemySprite(e), dir, frame, e.x, e.y + bob, drawH, .69);
  ctx.restore();
  if (!drawn) {
    ctx.save();
    ctx.translate(e.x, e.y + bob);
    ctx.scale(isBoss ? e.r / 16 : e.r / 13, isBoss ? e.r / 16 : e.r / 13);
    ctx.fillStyle = isBoss ? chapter.boss.col : e.elite ? '#d8b54a' : '#8fcf5e';
    ctx.strokeStyle = '#1d2418';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(-12, -24, 24, 34, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(-4, -15, 3, 0, 7); ctx.arc(5, -15, 3, 0, 7); ctx.fill();
    ctx.restore();
  }

  if (e.burnT > 0) {
    const a = clamp(e.burnT / .72, .2, 1);
    if (!drawSeqSprite('statusBurn', e.x, statusY, statusSize * 1.1, statusSize * 1.1, 0, .46 + a * .24, 'lighter', 12, e.id || 0) &&
        !drawStatusSprite(SPRITES.statusBurn, e.x, statusY, statusSize, .52 + a * .25, 'lighter')) {
      glowCircle(e.x, e.y - e.r * .35, e.r * 1.55, 'rgba(255,126,38,.26)', 'rgba(255,70,20,0)', 1);
    }
  }
  if (e.slowT > 0) {
    const a = clamp(e.slowT / 1.4, .22, 1);
    if (!drawSeqSprite('statusFreeze', e.x, statusY, statusSize * 1.12, statusSize * 1.12, 0, .42 + a * .2, 'lighter', 10, (e.id || 0) + 3) &&
        !drawStatusSprite(SPRITES.statusFreeze, e.x, statusY, statusSize * 1.04, .46 + a * .2, 'source-over')) {
      glowCircle(e.x, e.y - e.r * .35, e.r * 1.55, 'rgba(135,225,255,.22)', 'rgba(135,225,255,0)', 1);
    }
  }

  if (e.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath(); ctx.arc(e.x, e.y - e.r * .6, e.r * 1.35, 0, 7); ctx.fill();
  }

  if (e.elite || (e.type === 'tank' && e.hp < e.maxhp)) {
    const w = e.r * 2.4, hw = clamp(e.hp / e.maxhp, 0, 1) * w;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(e.x - w / 2, e.y - e.r - 24, w, 5);
    ctx.fillStyle = '#ffb627'; ctx.fillRect(e.x - w / 2, e.y - e.r - 24, hw, 5);
  }

  if (e.boss && e.bphase === 'tele') {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(Math.atan2(e.dashY, e.dashX));
    ctx.fillStyle = `rgba(255,60,60,${.18 + Math.sin(gtime * 20) * .08})`;
    ctx.fillRect(0, -e.r * .9, 480, e.r * 1.8);
    ctx.restore();
  }
}
function drawCrate(c) {
  shadow(c.x, c.y, 15);
  const ok = drawItemSprite(7, c.x, c.y - 2, 42, c.hp <= 1 ? .76 : 1);
  if (!ok) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.lineWidth = 2; ctx.strokeStyle = '#4a3318';
    ctx.fillStyle = '#a8773f';
    ctx.beginPath(); ctx.roundRect(-14, -16, 28, 28, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(74,51,24,.6)';
    ctx.beginPath(); ctx.moveTo(-14, -7); ctx.lineTo(14, -7); ctx.moveTo(-14, 3); ctx.lineTo(14, 3); ctx.stroke();
    ctx.restore();
  }
  if (c.hp < 3) {
    ctx.strokeStyle = 'rgba(85,45,18,.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x - 9, c.y - 13); ctx.lineTo(c.x - 2, c.y - 3); ctx.lineTo(c.x - 10, c.y + 6); ctx.stroke();
  }
  if (c.hp < 2) {
    ctx.strokeStyle = 'rgba(85,45,18,.85)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c.x + 10, c.y - 12); ctx.lineTo(c.x + 3, c.y - 1); ctx.lineTo(c.x + 11, c.y + 9); ctx.stroke();
  }
}
function drawMineBullet(b) {
  const armed = b.armT <= 0;
  if (drawFxRot('mine', b.x, b.y, 36, 0, armed ? .95 : .62)) {
    if (armed) strokeRing(b.x, b.y, 18 + Math.sin(gtime * 6) * 2, 'rgba(255,90,90,.46)', 2, 1);
    return;
  }
  ctx.save(); ctx.translate(b.x, b.y);
  ctx.fillStyle = '#39424f'; ctx.strokeStyle = '#171c24'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 2, 11, 7.5, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#566375';
  ctx.beginPath(); ctx.ellipse(0, -1, 8, 5.5, 0, 0, 7); ctx.fill();
  ctx.fillStyle = armed && Math.floor(gtime * 6) % 2 === 0 ? '#ff5c5c' : '#7d2a2a';
  ctx.beginPath(); ctx.arc(0, -2, 2.6, 0, 7); ctx.fill();
  ctx.restore();
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  if (!chapter || !player) return;
  const shx = shake > 0 ? rand(-shake, shake) : 0;
  const shy = shake > 0 ? rand(-shake, shake) : 0;
  ctx.setTransform(DPR * VS, 0, 0, DPR * VS, cv.width / 2 - (camX + shx) * DPR * VS, cv.height / 2 - (camY + shy) * DPR * VS);

  drawGround();

  // 鐏捣
  for (const z of zones) {
    const pulse = .5 + Math.sin(gtime * 10 + z.x * .01) * .5;
    if (!drawSeqSprite('fireZone', z.x, z.y, z.r * 2.18, z.r * 2.0, 0, .58 + pulse * .16, 'lighter', 11, z.x * .01) &&
        !drawFxSprite('fireZone', z.x, z.y, z.r * 2.22, z.r * 2.0, 0, .68 + pulse * .18, 'lighter')) {
      glowCircle(z.x, z.y, z.r, `rgba(255,185,58,${.22 + pulse * .08})`, 'rgba(255,70,20,0)', 1);
    }
  }
  // 闃茶鍔涘牬
  if (skLv('field')) {
    const st = skSt('field');
    const pulse = .5 + Math.sin(gtime * 5) * .5;
    const fy = player.y + FIELD_VISUAL_Y_OFFSET;
    if (!drawSeqSprite('field', player.x, fy, st.r * 2.14 + pulse * 4, st.r * 2.14 + pulse * 4, 0, .42, 'lighter', 9)) {
      drawForceFieldBack(player.x, fy, st.r, pulse);
    }
  }
  // 瀵剁煶 / 閲戝梗
  for (const g of gems) {
    const big = g.val >= 8;
    const size = big ? 25 : 18;
    glowCircle(g.x, g.y, size * .8, big ? 'rgba(84,207,255,.20)' : 'rgba(93,255,125,.18)', 'rgba(255,255,255,0)', 1);
    if (!drawItemSprite(big ? 2 : 1, g.x, g.y + Math.sin(gtime * 4 + g.x) * 1.4, size)) {
      const sz = big ? 8 : 5.5;
      ctx.save(); ctx.translate(g.x, g.y); ctx.rotate(gtime * 2 + g.x * .01);
      ctx.fillStyle = big ? '#5cc9ff' : '#5cff7d';
      ctx.beginPath(); ctx.moveTo(0, -sz); ctx.lineTo(sz * .8, 0); ctx.lineTo(0, sz); ctx.lineTo(-sz * .8, 0); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
  for (const c of coinsArr) {
    glowCircle(c.x, c.y, 14, 'rgba(255,218,55,.18)', 'rgba(255,218,55,0)', 1);
    if (!drawItemSprite(0, c.x, c.y + Math.sin(gtime * 5 + c.x) * 1.2, 22)) {
      ctx.fillStyle = '#ffd23d'; ctx.strokeStyle = '#a36f00'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(c.x, c.y, 6, 0, 7); ctx.fill(); ctx.stroke();
    }
  }
  // Pickups
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of pickups) {
    const bob = Math.sin(gtime * 4 + p.bob) * 4;
    const col = { meat: 3, magnet: 4, bomb: 5, chest: 6 }[p.kind];
    glowCircle(p.x, p.y + bob, p.kind === 'chest' ? 28 : 22, 'rgba(255,232,130,.18)', 'rgba(255,232,130,0)', 1);
    if (!drawItemSprite(col, p.x, p.y + bob, p.kind === 'chest' ? 36 : 32)) {
      const em = { meat: '🍖', magnet: '🧲', bomb: '💣', chest: '🎁' }[p.kind];
      ctx.font = '26px sans-serif';
      ctx.fillText(em, p.x, p.y + bob);
    }
  }
  // Crates
  for (const c of crates) if (c.hp > 0) drawCrate(c);
  // 自動砲塔
  for (const tr of turrets) {
    shadow(tr.x, tr.y, 13);
    const fade = tr.life < 2 ? .55 + Math.sin(gtime * 12) * .25 : 1;
    if (!drawTurret8Sprite(tr.x, tr.y, tr.ang, 64, fade) && !drawFxRot('turret', tr.x, tr.y - 7, 54, tr.ang, fade)) {
      ctx.save(); ctx.translate(tr.x, tr.y);
      ctx.globalAlpha *= fade;
      ctx.fillStyle = '#4a5566'; ctx.strokeStyle = '#1d242e'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 0, 13, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5d7494';
      ctx.beginPath(); ctx.roundRect(-6, -17, 12, 13, 3); ctx.fill(); ctx.stroke();
      ctx.save(); ctx.translate(0, -11); ctx.rotate(tr.ang);
      ctx.fillStyle = '#2f9bff'; ctx.strokeStyle = '#173a5c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(3, -2.5, 15, 5, 2); ctx.fill(); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = '#ffe25c';
      ctx.beginPath(); ctx.arc(0, -11, 2.4, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  // Grounded player objects must stay below characters.
  for (const b of bullets) if (b.kind === 'mine') drawMineBullet(b);
  // 鏁典汉
  const vw2 = viewW() / 2 + 60, vh2 = viewH() / 2 + 60;
  const visibleEnemies = enemies
    .filter(e => !e.dead && Math.abs(e.x - camX) <= vw2 && Math.abs(e.y - camY) <= vh2)
    .sort((a, b) => (a.y - b.y) || (a.x - b.x));
  for (const e of visibleEnemies) {
    if (e.dead) continue;
    drawEnemy(e);
  }
  // 鐜╁
  drawPlayer();
  if (skLv('field')) {
    const st = skSt('field');
    const pulse = .5 + Math.sin(gtime * 5) * .5;
    const fy = player.y + FIELD_VISUAL_Y_OFFSET;
    drawSeqSprite('field', player.x, fy, st.r * 2.14 + pulse * 4, st.r * 2.14 + pulse * 4, 0, .18, 'lighter', 9, 4);
    drawForceFieldFront(player.x, fy, st.r, pulse);
  }
  // 瀹堣鍏夌悆
  if (skLv('guard')) {
    const st = skSt('guard');
    const cnt = effectCount(st.n);
    for (let i = 0; i < cnt; i++) {
      const a = player.guardAng + i * Math.PI * 2 / cnt;
      const bx = player.x + Math.cos(a) * st.r, by = player.y + Math.sin(a) * st.r;
      if (!drawFxRot('guardOrb', bx, by, 34 + Math.sin(gtime * 7 + i) * 2, -player.guardAng * .7, .88, 'lighter')) {
        glowCircle(bx, by, 20, 'rgba(204,154,255,.34)', 'rgba(120,70,255,0)', 1);
        strokeRing(bx, by, 10 + Math.sin(gtime * 7 + i) * 1.5, 'rgba(225,204,255,.85)', 2, 1);
        ctx.fillStyle = '#b48cff'; ctx.strokeStyle = '#5a3a99'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(bx, by, 8, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.78)';
        ctx.beginPath(); ctx.arc(bx - 2.5, by - 2.5, 2.4, 0, 7); ctx.fill();
      }
    }
  }
  // Drone
  if (skLv('drone')) {
    const st = skSt('drone');
    const cnt = effectCount(st.n);
    for (let i = 0; i < cnt; i++) {
      const a = player.droneAng + i * Math.PI * 2 / cnt;
      const dx = player.x + Math.cos(a) * 52, dy = player.y + Math.sin(a) * 52 - 26;
      const bob = Math.sin(gtime * 4 + i) * 3;
      const t = nearestEnemy(dx, dy, 460);
      const aim = t ? Math.atan2(t.y - dy, t.x - dx) : (Number.isFinite(player.droneAims?.[i]) ? player.droneAims[i] : a);
      if (!drawDrone8Sprite(dx, dy + bob, aim, 48, .96) &&
          !drawFxRot('drone', dx, dy + bob, 42, Math.sin(gtime * 2 + i) * .12, .95)) {
        glowCircle(dx, dy + bob, 18, 'rgba(92,201,255,.24)', 'rgba(92,201,255,0)', 1);
        ctx.fillStyle = '#d7e5f5'; ctx.strokeStyle = '#2b3442'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(dx, dy + bob, 11, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#4fd0ff';
        ctx.beginPath(); ctx.arc(dx, dy + bob, 3, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(79,208,255,.55)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(dx - 10, dy + bob, 4, 0, 7); ctx.arc(dx + 10, dy + bob, 4, 0, 7); ctx.stroke();
      }
    }
  }
  // 鎴戞柟瀛愬綀
  for (const b of bullets) {
    if (b.kind === 'mine') continue;
    if (b.kind === 'knife') {
      const a = Math.atan2(b.vy, b.vx);
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,218,92,.32)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 0); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = '#ffe77a'; ctx.strokeStyle = '#8a5a10'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.roundRect(-3, -2.4, 13, 4.8, 2.4); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff7c8';
      ctx.beginPath(); ctx.arc(9, -1, 1.6, 0, 7); ctx.fill();
      ctx.restore();
    } else if (b.kind === 'drill') {
      const a = Math.atan2(b.vy, b.vx);
      if (!drawFxRot('drill', b.x, b.y, 44, a + Math.sin(b.spin) * .16, .95, 'lighter')) {
        glowCircle(b.x, b.y, 20, 'rgba(92,201,255,.24)', 'rgba(92,201,255,0)', 1);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
        ctx.fillStyle = '#5cc9ff'; ctx.strokeStyle = '#1d4e66'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(220,250,255,.8)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(-4, -5); ctx.lineTo(7, 0); ctx.lineTo(-4, 5); ctx.stroke();
        ctx.restore();
      }
    } else if (b.kind === 'boomer') {
      if (!drawFxRot('boomer', b.x, b.y, 48, b.spin, .92, 'lighter')) {
        glowCircle(b.x, b.y, 24, 'rgba(255,182,39,.20)', 'rgba(255,182,39,0)', 1);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.spin);
        ctx.fillStyle = '#ffb627'; ctx.strokeStyle = '#7a4d00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-3, -12, 6, 24, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(-12, -3, 24, 6, 3); ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    } else if (b.kind === 'molotov') {
      if (!drawFxRot('molotov', b.x, b.y, 42, b.t * 12, .94, 'lighter')) {
        glowCircle(b.x, b.y, 18, 'rgba(255,129,41,.23)', 'rgba(255,129,41,0)', 1);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.t * 12);
        ctx.fillStyle = '#7db84a'; ctx.strokeStyle = '#2b3a1a'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(-4, -7, 8, 14, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff9b3d'; ctx.beginPath(); ctx.arc(0, -9, 3, 0, 7); ctx.fill();
        ctx.restore();
      }
    } else if (b.kind === 'missile') {
      const a = Math.atan2(b.vy, b.vx);
      if (!drawFxSprite('missile', b.x, b.y, 52, 36, a, .96, 'lighter')) {
        glowCircle(b.x, b.y, 16, 'rgba(255,170,80,.25)', 'rgba(255,170,80,0)', 1);
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
        ctx.strokeStyle = '#ffb46b'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-16, 0); ctx.stroke();
        ctx.fillStyle = '#e8eef5'; ctx.strokeStyle = '#2b3442'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(-9, -3.5, 16, 7, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ff6b4a';
        ctx.beginPath(); ctx.moveTo(7, -3.5); ctx.lineTo(13, 0); ctx.lineTo(7, 3.5); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    } else { // bolt
      const a = Math.atan2(b.vy, b.vx);
      if (!drawFxSprite('bolt', b.x, b.y, 38, 26, a - FX_ROT_OFFSET.bolt, .9, 'lighter')) {
        ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a);
        ctx.strokeStyle = 'rgba(255,231,92,.75)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#fff3a7';
        ctx.beginPath(); ctx.arc(7, 0, 4, 0, 7); ctx.fill();
        ctx.restore();
      }
    }
  }
  // 鏁垫柟瀛愬綀
  for (const b of ebullets) {
    const col = b.col || '#9fe34a';
    const glow = col === '#b873ff' ? 'rgba(184,115,255,.24)' : 'rgba(159,227,74,.22)';
    glowCircle(b.x, b.y, b.r * 2.4, glow, 'rgba(159,227,74,0)', 1);
    ctx.fillStyle = col; ctx.strokeStyle = col === '#b873ff' ? '#58318d' : '#3e5c14'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.beginPath(); ctx.arc(b.x - b.r * .25, b.y - b.r * .3, b.r * .25, 0, 7); ctx.fill();
  }
  // 冰霜新星
  for (const nv of novas) {
    const k = 1 - nv.r / nv.maxr;
    if (!drawFxSprite('nova', nv.x, nv.y, nv.r * 2.05, nv.r * 1.55, 0, .22 + k * .55, 'lighter')) {
      glowCircle(nv.x, nv.y, nv.r * 1.05, `rgba(170,230,255,${.18 + k * .35})`, 'rgba(170,230,255,0)', 1);
    }
  }
  // 貫穿雷射
  for (const bm of beams) {
    const k = bm.life / bm.max;
    const cx = bm.x + Math.cos(bm.ang) * bm.len * .5;
    const cy = bm.y + Math.sin(bm.ang) * bm.len * .5;
    if (!drawFxSprite('laser', cx, cy, bm.len, 48, bm.ang, k, 'lighter')) {
      ctx.save(); ctx.translate(bm.x, bm.y); ctx.rotate(bm.ang); ctx.globalAlpha *= k;
      ctx.strokeStyle = 'rgba(120,220,255,.35)'; ctx.lineWidth = 16;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bm.len, 0); ctx.stroke();
      ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(bm.len, 0); ctx.stroke();
      ctx.fillStyle = '#eaffff';
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, 7); ctx.fill();
      ctx.restore();
    }
  }
  // Shockwaves
  for (const wv of waves) {
    const a = clamp(1 - wv.r / wv.maxr, 0, 1);
    if (!drawFxSprite('shockwave', wv.x, wv.y, wv.r * 2.05, wv.r * 1.42, 0, a * .85, 'lighter')) {
      strokeRing(wv.x, wv.y, wv.r, `rgba(255,162,78,${a * .85})`, 7, 1);
      strokeRing(wv.x, wv.y, Math.max(4, wv.r - 16), `rgba(255,232,130,${a * .42})`, 2.5, 1);
    }
  }
  // Imagegen impact bursts
  for (const bu of bursts) {
    const k = clamp(bu.life / bu.max, 0, 1);
    if (bu.seq === 'lightningStrike') {
      const progress = 1 - k;
      if (!drawLightningStrikeSprite(bu.x, bu.y, bu.size, progress, bu.alpha * (.48 + k * .52))) {
        glowCircle(bu.x, bu.y, bu.size * .24, `rgba(116,231,255,${k * .34})`, 'rgba(116,231,255,0)', 1);
      }
      continue;
    }
    if (bu.seq === 'splashProc') {
      const progress = 1 - k;
      if (!drawSplashProcSprite(bu.x, bu.y, bu.size * (.9 + progress * .18), progress, bu.alpha * (.36 + k * .64))) {
        glowCircle(bu.x, bu.y, bu.size * .36, `rgba(118,226,255,${k * .28})`, 'rgba(255,120,50,0)', 1);
      }
      continue;
    }
    const s = bu.size * (.78 + (1 - k) * .55);
    if (!drawFxRot(bu.fx, bu.x, bu.y, s, bu.rot + (1 - k) * .35, bu.alpha * k, 'lighter')) {
      glowCircle(bu.x, bu.y, s * .45, `rgba(255,190,80,${k * .25})`, 'rgba(255,80,30,0)', 1);
    }
  }
  // 绮掑瓙
  for (const p of parts) {
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // 鍌峰鏁稿瓧
  ctx.font = '900 15px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
  for (const t of texts) {
    ctx.globalAlpha = clamp(t.life / .7, 0, 1);
    ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
    ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.col;
    ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  // 铻㈠箷绌洪枔锛氬彈鍌风磪闁?+ 鎼栨】
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (hurtFlash > 0) {
    ctx.fillStyle = `rgba(255,30,30,${hurtFlash * .55})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (joy.active) {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 52, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(joy.ox + joy.dx, joy.oy + joy.dy, 22, 0, 7); ctx.fill();
  }
}

/* ---------------- 涓昏看鍦?---------------- */
let lastT = 0;
function loop(ts) {
  requestAnimationFrame(loop);
  const dt = Math.min(.05, (ts - lastT) / 1000 || 0);
  lastT = ts;
  if (state === 'play') update(dt);
  render();
}

/* ---------------- 鍒濆鍖?---------------- */
function resize() {
  const root = $('game-root');
  const r = root ? root.getBoundingClientRect() : { width: innerWidth, height: innerHeight };
  W = Math.max(1, Math.round(r.width));
  H = Math.max(1, Math.round(r.height));
  DPR = Math.min(devicePixelRatio || 1, 2);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  VS = clamp(Math.min(W / 390, H / 693), .78, 1.18);
  requestAnimationFrame(layoutBossHud);
}
function init() {
  cv = $('cv'); ctx = cv.getContext('2d');
  resize();
  addEventListener('resize', resize);
  if (window.visualViewport) visualViewport.addEventListener('resize', resize);
  initInput();
  $('menu-coins').innerHTML = coinCounterHtml(totalCoins, 'menu-coin');
  syncSoundBtns();
  $('btn-start').onclick = () => { sfx('pick'); toSelect(); };
  $('btn-talents').onclick = () => { sfx('pick'); toTalents(); };
  $('btn-back-menu').onclick = () => toMenu();
  $('btn-back-talents').onclick = () => toMenu();
  $('btn-pause').onclick = () => doPause();
  $('btn-resume').onclick = () => doResume();
  $('btn-retry-p').onclick = () => startChapter(chIdx);
  $('btn-quit-p').onclick = () => toMenu();
  $('btn-retry').onclick = () => startChapter(chIdx);
  $('btn-select').onclick = () => toSelect();
  $('btn-next').onclick = () => startChapter(chIdx + 1);
  $('btn-revive').onclick = () => revive();
  $('btn-sound').onclick = () => toggleSound();
  $('btn-sound2').onclick = () => toggleSound();
  if (new URLSearchParams(location.search).has('visualTest')) {
    setTimeout(() => visualTestScene(), 120);
  }
  requestAnimationFrame(loop);
}
document.readyState === 'loading' ? addEventListener('DOMContentLoaded', init) : init();

/* ---------------- 闄ら尟鎺涘嬀锛堣嚜鍕曞寲娓│鐢級 ---------------- */
window.__errs = [];
window.addEventListener('error', e => window.__errs.push(String(e.message) + ' @ ' + e.filename + ':' + e.lineno));
function renderGameToText() {
  const sampleEnemies = enemies.filter(e => !e.dead).slice(0, 16).map(e => ({
    type: e.type, boss: !!e.boss, x: Math.round(e.x), y: Math.round(e.y), r: e.r,
    dir: e.dir, frame: animFrame(e.anim, e.stunT <= 0, e.boss ? .55 : .85),
    burnT: Math.round((e.burnT || 0) * 100) / 100,
    slowT: Math.round((e.slowT || 0) * 100) / 100,
  }));
  const sampleBullets = bullets.slice(0, 16).map(b => ({
    kind: b.kind, x: Math.round(b.x), y: Math.round(b.y), r: b.r,
    vx: Math.round(b.vx || 0), vy: Math.round(b.vy || 0),
  }));
  const sampleBursts = bursts.slice(0, 12).map(b => ({
    fx: b.fx, seq: b.seq || null, x: Math.round(b.x), y: Math.round(b.y),
    life: Math.round((b.life || 0) * 100) / 100,
  }));
  return JSON.stringify({
    coordinateSystem: 'world origin at start position, x right, y down; draw coordinates are centered on entity collision points',
    state, chapter: chIdx, time: Math.round(gtime * 10) / 10,
    wallet: { totalCoins, runCoins: coinGain },
    talents,
    talentBonus,
    player: player ? {
      x: Math.round(player.x), y: Math.round(player.y), r: player.r, dir: player.dir,
      moving: player.moving, frame: animFrame(player.anim, player.moving, .9),
      sprite: { h: 104, anchorY: .69, bottomOffset: Math.round(104 * (1 - .69)) },
      hp: Math.round(player.hp), maxhp: player.maxhp,
    } : null,
    counts: { enemies: enemies.filter(e => !e.dead).length, bullets: bullets.length, ebullets: ebullets.length, gems: gems.length, coins: coinsArr.length, pickups: pickups.length, crates: crates.filter(c => c.hp > 0).length, zones: zones.length, waves: waves.length, novas: novas.length, beams: beams.length, turrets: turrets.length, bursts: bursts.length },
    enemies: sampleEnemies,
    bullets: sampleBullets,
    bursts: sampleBursts,
    pickups: pickups.slice(0, 8).map(p => ({ kind: p.kind, x: Math.round(p.x), y: Math.round(p.y) })),
    crates: crates.filter(c => c.hp > 0).slice(0, 8).map(c => ({ x: Math.round(c.x), y: Math.round(c.y), hp: c.hp })),
    errors: window.__errs,
  });
}
function visualTestScene() {
  startChapter(0);
  for (const id in SKILLS) {
    player.skills[id] = Math.min(2, SKILLS[id].max);
    player.cds[id] = .05;
  }
  for (const id in PASSIVES) player.skills[id] = Math.min(2, PASSIVES[id].max);
  recalc(); rebuildSkillbar();
  enemies = [];
  const types = ['walker', 'fast', 'spitter', 'tank', 'exploder'];
  for (let i = 0; i < types.length; i++) {
    const e = spawnEnemy(types[i], player.x + 150 + i * 58, player.y - 90 + (i % 2) * 52);
    e.dir = dirFromVector(player.x - e.x, player.y - e.y);
    if (i === 0) e.burnT = .72;
    if (i === 1) e.slowT = 1.4;
    if (i === 2) { e.burnT = .72; e.slowT = 1.4; }
  }
  spawnElite();
  if (enemies[enemies.length - 1]) { enemies[enemies.length - 1].x = player.x - 170; enemies[enemies.length - 1].y = player.y - 70; }
  gems = [{ x: player.x - 90, y: player.y + 82, val: 1, att: false, sp: 0 }, { x: player.x - 58, y: player.y + 82, val: 8, att: false, sp: 0 }];
  coinsArr = [{ x: player.x - 25, y: player.y + 82, sp: 0 }];
  pickups = [
    { x: player.x + 12, y: player.y + 82, kind: 'meat', bob: 0 },
    { x: player.x + 48, y: player.y + 82, kind: 'magnet', bob: 1 },
    { x: player.x + 84, y: player.y + 82, kind: 'bomb', bob: 2 },
    { x: player.x + 123, y: player.y + 82, kind: 'chest', bob: 3 },
  ];
  crates = [{ x: player.x - 128, y: player.y + 82, hp: 3 }, { x: player.x + 168, y: player.y + 82, hp: 1 }];
  bullets = [
    { id: uid++, kind: 'knife', x: player.x + 44, y: player.y - 6, vx: 540, vy: 0, r: 7, dmg: 1, life: 9, dead: false },
    { id: uid++, kind: 'drill', x: player.x + 80, y: player.y - 28, vx: 0, vy: 0, r: 11, dmg: 1, life: 9, dead: false, spin: gtime },
    { id: uid++, kind: 'boomer', x: player.x + 112, y: player.y + 8, vx: 0, vy: 0, r: 12, dmg: 1, life: 9, phase: 0, spd: 0, dead: false, spin: gtime },
    { id: uid++, kind: 'molotov', x: player.x + 145, y: player.y + 18, tx: player.x + 145, ty: player.y + 18, t: .25, dur: .55, sx: player.x + 145, sy: player.y + 18, r: 8, dmg: 1, zr: 56, life: 9, dead: false },
    { id: uid++, kind: 'bolt', x: player.x + 176, y: player.y - 22, vx: 620, vy: 0, r: 5, dmg: 1, life: 9, dead: false },
    { id: uid++, kind: 'missile', x: player.x + 214, y: player.y - 34, vx: 470, vy: -90, r: 10, dmg: 1, zr: 64, life: 9, spd: 520, dead: false },
    { id: uid++, kind: 'mine', x: player.x + 214, y: player.y + 42, vx: 0, vy: 0, r: 0, trigR: 34, zr: 88, dmg: 1, life: 9, armT: 0, dead: false },
  ];
  ebullets = [{ x: player.x - 150, y: player.y + 28, vx: 0, vy: 0, r: 7, dmg: 1, life: 9 }];
  zones = [{ x: player.x + 240, y: player.y + 26, r: 56, life: 9, dmg: 1, tickT: 9 }];
  waves = [{ x: player.x - 230, y: player.y + 10, r: 70, maxr: 360, spd: 0, dmg: 1, hit: false }];
  novas = [{ x: player.x - 295, y: player.y + 48, r: 82, maxr: 225, spd: 0, dmg: 1, slow: 1, id: uid++ }];
  beams = [{ x: player.x - 28, y: player.y - 46, ang: -.16, len: 325, life: .16, max: .18 }];
  turrets = [];
  for (let i = 0; i < 8; i++) {
    turrets.push({
      x: player.x + 286 + (i % 4) * 54,
      y: player.y + 42 + Math.floor(i / 4) * 58,
      life: 9,
      shootT: 9,
      ang: i * Math.PI / 4,
      dmg: 1,
      fr: .5,
    });
  }
  bursts = [
    { x: player.x + 300, y: player.y - 54, fx: 'explosion', size: 92, life: .26, max: .34, rot: .2, alpha: 1 },
    { x: player.x - 48, y: player.y - 104, fx: 'bolt', size: 58, life: .14, max: .2, rot: -.2, alpha: .9 },
    { x: player.x + 92, y: player.y - 120, fx: 'lightningStrike', seq: 'lightningStrike', size: 168, life: .34, max: .42, rot: 0, alpha: .96 },
  ];
  player.droneAims = Array.from({ length: 8 }, (_, i) => i * Math.PI / 4);
  parts = []; texts = [];
  const params = new URLSearchParams(location.search);
  if (params.has('heroDir')) {
    const dir = parseInt(params.get('heroDir'), 10);
    player.dir = Number.isFinite(dir) ? clamp(dir, 0, SPRITE_ROWS - 1) : player.dir;
    player.moving = params.get('heroMoving') !== '0';
    player.anim = Number(params.get('heroAnim') || '2.4') || 2.4;
  }
  $('toasts').innerHTML = '';
  camX = player.x; camY = player.y; pendingLv = 0; state = 'test'; showScreen('hud');
  render();
  document.body.dataset.debug = renderGameToText();
}
function monsterHeadTestScene() {
  startChapter(0);
  player.skills = {};
  player.cds = {};
  recalc(); rebuildSkillbar();
  enemies = [];
  const pack = [
    ['walker', -16, -22], ['fast', 14, -20], ['splitter', 0, 0],
    ['walker', -28, 16], ['fast', 24, 18], ['leaper', 2, 35],
    ['walker', 41, 0], ['splitter', -42, 0],
  ];
  for (const [type, ox, oy] of pack) {
    const e = spawnEnemy(type, player.x + ox, player.y - 72 + oy);
    e.dir = dirFromVector(player.x - e.x, player.y - e.y);
    e.anim = 2.2 + (ox + oy) * .01;
    e.stunT = 999;
  }
  rebuildGrid();
  for (let i = 0; i < 4; i++) separateEnemies();
  gems = []; coinsArr = []; pickups = []; crates = []; bullets = []; ebullets = [];
  zones = []; waves = []; novas = []; beams = []; turrets = []; bursts = []; parts = []; texts = [];
  $('toasts').innerHTML = '';
  camX = player.x; camY = player.y; pendingLv = 0; state = 'test'; showScreen('hud');
  render();
  document.body.dataset.debug = renderGameToText();
}
function thunderDroneTestScene() {
  startChapter(0);
  player.skills = { thunder: 5, drone: 5 };
  player.cds = { thunder: 0 };
  player.droneShoot = 0;
  recalc(); rebuildSkillbar();
  enemies = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI * .65 + i * Math.PI * .18;
    const e = spawnEnemy('walker', player.x + Math.cos(a) * 170, player.y + Math.sin(a) * 150 - 40);
    e.hp = 240;
    e.maxhp = 240;
    e.dir = dirFromVector(player.x - e.x, player.y - e.y);
  }
  gems = []; coinsArr = []; pickups = []; crates = []; bullets = []; ebullets = [];
  zones = []; waves = []; novas = []; beams = []; turrets = []; bursts = []; parts = []; texts = [];
  fireThunder();
  for (const b of bursts) if (b.seq === 'lightningStrike') b.life = b.max * .48;
  player.cds.thunder = 999;
  updateSkills(1 / 60);
  $('toasts').innerHTML = '';
  camX = player.x; camY = player.y; pendingLv = 0; state = 'test'; showScreen('hud');
  render();
  document.body.dataset.debug = renderGameToText();
}
function vfxRingTestScene() {
  startChapter(0);
  player.skills = { field: 3 };
  player.cds = {};
  recalc(); rebuildSkillbar();
  enemies = [];
  gems = []; coinsArr = []; pickups = []; crates = []; bullets = []; ebullets = [];
  zones = [{ x: player.x + 116, y: player.y - 42, r: 58, life: 9, dmg: 1, tickT: 9 }];
  novas = [{ x: player.x - 118, y: player.y - 38, r: 78, maxr: 190, spd: 0, dmg: 1, slow: 1.4, id: uid++ }];
  waves = []; beams = []; turrets = []; bursts = []; parts = []; texts = [];
  $('toasts').innerHTML = '';
  camX = player.x; camY = player.y; pendingLv = 0; state = 'test'; showScreen('hud');
  render();
  document.body.dataset.debug = renderGameToText();
}
window.render_game_to_text = renderGameToText;
window.advanceTime = ms => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) {
    if (state === 'play') update(1 / 60);
  }
  render();
};
window.DBG = {
  pending: () => pendingLv,
  state: () => state,
  time: () => gtime,
  start: i => startChapter(i || 0),
  god: () => { player.maxhp = 1e9; player.hp = 1e9; },
  skip: s => { gtime = Math.max(gtime, chapter.dur - (s == null ? 2 : s)); },
  exp: n => { gainExp(n == null ? 60 : n); },
  boss: () => bossActive,
  killBoss: () => { if (bossActive) damageEnemy(bossActive, bossActive.hp + 1); },
  enemies: () => enemies.length,
  player: () => player,
  visualTest: () => visualTestScene(),
  monsterHeadTest: () => monsterHeadTestScene(),
  thunderDroneTest: () => thunderDroneTestScene(),
  vfxRingTest: () => vfxRingTestScene(),
  assets: () => ({
    drone8: { ok: spriteReady(SPRITES.drone8), w: SPRITES.drone8.naturalWidth || 0, h: SPRITES.drone8.naturalHeight || 0 },
    lightningStrike: { ok: spriteReady(SPRITES.lightningStrike), w: SPRITES.lightningStrike.naturalWidth || 0, h: SPRITES.lightningStrike.naturalHeight || 0 },
    splashProc: { ok: spriteReady(SPRITES.splashProc), w: SPRITES.splashProc.naturalWidth || 0, h: SPRITES.splashProc.naturalHeight || 0 },
    walker: { ok: spriteReady(SPRITES.enemies.walker), w: SPRITES.enemies.walker.naturalWidth || 0, h: SPRITES.enemies.walker.naturalHeight || 0 },
  }),
  renderText: () => renderGameToText(),
  pickFirst: () => { const c = document.querySelector('#lu-cards .lu-card'); if (c) c.click(); },
  reset: () => { localStorage.removeItem('ddtg_unlock'); localStorage.removeItem('ddtg_coins'); localStorage.removeItem('ddtg_talents'); location.reload(); },
};
