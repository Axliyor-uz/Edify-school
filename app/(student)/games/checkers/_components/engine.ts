/**
 * Checkers engine — negamax with alpha-beta, iterative deepening under a time
 * budget, quiescence on captures, and a transposition table. Searches FULL
 * capture chains as single moves (with dead-piece "Turkish stroke" blocking
 * and mid-chain crowning), so it models strict Russian shashki exactly.
 *
 * Runs inside aiWorker.ts — never on the UI thread. Difficulty 5 gets ~2.6s
 * of thinking (depth ~14–20) with zero randomness: effectively unbeatable.
 * Lower levels use shallow fixed depths plus deliberate near-best mistakes.
 */
import {
  BoardState, Player, Position, Move, ROWS, COLS,
} from './rules';

// Compact board: index r*8+c → 0 empty, 1 red man, 2 red king, 3 black man, 4 black king.
const E = 0, RM = 1, RK = 2, BM = 3, BK = 4;
type Bd = Int8Array;

const isRed = (v: number) => v === RM || v === RK;
const isBlack = (v: number) => v === BM || v === BK;
const isKing = (v: number) => v === RK || v === BK;

export const toCompact = (board: BoardState): Bd => {
  const bd = new Int8Array(64);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      bd[r * 8 + c] = !p ? E : p.player === 'red' ? (p.isKing ? RK : RM) : (p.isKing ? BK : BM);
    }
  }
  return bd;
};

/** A full move: quiet step, or a complete capture chain. */
export type ChainMove = {
  from: Position;
  /** Every landing square in order (one entry for a quiet move). */
  path: Position[];
  /** Squares of captured pieces, in capture order. */
  captures: Position[];
};

const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const inside = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const mine = (v: number, red: boolean) => (red ? isRed(v) : isBlack(v));
const enemy = (v: number, red: boolean) => (red ? isBlack(v) : isRed(v));

/** Existence check: can the piece `v` standing at (r,c) capture anything? */
const hasCaptureAt = (bd: Bd, r: number, c: number, v: number, red: boolean, dead: boolean[]): boolean => {
  const king = isKing(v);
  for (const [dr, dc] of DIAG) {
    if (king) {
      let victimSeen = false;
      let step = 1;
      while (true) {
        const nr = r + step * dr, nc = c + step * dc;
        if (!inside(nr, nc)) break;
        const idx = nr * 8 + nc;
        const t = bd[idx];
        if (!victimSeen) {
          if (t !== E) {
            if (dead[idx] || mine(t, red)) break;
            victimSeen = true;
          }
        } else {
          if (t === E) return true;
          break;
        }
        step++;
      }
    } else {
      const vIdx = (r + dr) * 8 + (c + dc);
      const lr = r + 2 * dr, lc = c + 2 * dc;
      if (inside(lr, lc) && bd[lr * 8 + lc] === E && !dead[vIdx] && enemy(bd[vIdx], red)) return true;
    }
  }
  return false;
};

/** Enumerates complete capture chains from (r,c). `dead` marks already-jumped squares. */
const chainsFrom = (
  bd: Bd, r: number, c: number, v: number, red: boolean,
  dead: boolean[], path: Position[], caps: Position[], out: ChainMove[],
  from: Position,
): void => {
  let extended = false;
  const king = isKing(v);
  for (const [dr, dc] of DIAG) {
    if (king) {
      let vr = -1, vc = -1;
      const landings: number[] = [];
      let step = 1;
      while (true) {
        const nr = r + step * dr, nc = c + step * dc;
        if (!inside(nr, nc)) break;
        const idx = nr * 8 + nc;
        const t = bd[idx];
        if (vr < 0) {
          if (t !== E) {
            if (dead[idx] || mine(t, red)) break;
            vr = nr; vc = nc;
          }
        } else {
          if (t !== E) break;
          landings.push(idx);
        }
        step++;
      }
      if (vr < 0 || landings.length === 0) continue;
      const vIdx = vr * 8 + vc;
      // Strict landing rule: if some landing square allows the capture to
      // continue, the king must land on one of those.
      dead[vIdx] = true;
      bd[r * 8 + c] = E;
      const continuing = landings.filter(idx => {
        bd[idx] = v;
        const can = hasCaptureAt(bd, idx >> 3, idx & 7, v, red, dead);
        bd[idx] = E;
        return can;
      });
      const targets = continuing.length > 0 ? continuing : landings;
      for (const idx of targets) {
        extended = true;
        bd[idx] = v;
        path.push({ r: idx >> 3, c: idx & 7 }); caps.push({ r: vr, c: vc });
        chainsFrom(bd, idx >> 3, idx & 7, v, red, dead, path, caps, out, from);
        path.pop(); caps.pop();
        bd[idx] = E;
      }
      bd[r * 8 + c] = v;
      dead[vIdx] = false;
    } else {
      const vr = r + dr, vc = c + dc, lr = r + 2 * dr, lc = c + 2 * dc;
      if (!inside(lr, lc)) continue;
      const vIdx = vr * 8 + vc, lIdx = lr * 8 + lc;
      if (bd[lIdx] !== E || dead[vIdx] || !enemy(bd[vIdx], red)) continue;
      extended = true;
      const crowning = lr === (red ? 0 : ROWS - 1);
      const nv = crowning ? (red ? RK : BK) : v; // mid-chain crowning continues as king
      dead[vIdx] = true;
      const savedV = bd[vIdx];
      bd[r * 8 + c] = E; bd[lIdx] = nv;
      path.push({ r: lr, c: lc }); caps.push({ r: vr, c: vc });
      chainsFrom(bd, lr, lc, nv, red, dead, path, caps, out, from);
      path.pop(); caps.pop();
      bd[lIdx] = E; bd[r * 8 + c] = v; bd[vIdx] = savedV;
      dead[vIdx] = false;
    }
  }
  if (!extended && caps.length > 0) {
    out.push({ from, path: [...path], captures: [...caps] });
  }
};

export const generateMoves = (bd: Bd, red: boolean): ChainMove[] => {
  const captures: ChainMove[] = [];
  const dead = new Array<boolean>(64).fill(false);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = bd[r * 8 + c];
      if (v === E || !mine(v, red)) continue;
      chainsFrom(bd, r, c, v, red, dead, [], [], captures, { r, c });
    }
  }
  if (captures.length > 0) return captures;

  const quiet: ChainMove[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = bd[r * 8 + c];
      if (v === E || !mine(v, red)) continue;
      if (isKing(v)) {
        for (const [dr, dc] of DIAG) {
          let step = 1;
          while (true) {
            const nr = r + step * dr, nc = c + step * dc;
            if (!inside(nr, nc) || bd[nr * 8 + nc] !== E) break;
            quiet.push({ from: { r, c }, path: [{ r: nr, c: nc }], captures: [] });
            step++;
          }
        }
      } else {
        const dr = red ? -1 : 1;
        for (const dc of [-1, 1]) {
          const nr = r + dr, nc = c + dc;
          if (inside(nr, nc) && bd[nr * 8 + nc] === E) {
            quiet.push({ from: { r, c }, path: [{ r: nr, c: nc }], captures: [] });
          }
        }
      }
    }
  }
  return quiet;
};

export const applyChain = (bd: Bd, m: ChainMove): Bd => {
  const next = bd.slice();
  const red = isRed(next[m.from.r * 8 + m.from.c]);
  let v = next[m.from.r * 8 + m.from.c];
  next[m.from.r * 8 + m.from.c] = E;
  for (const p of m.path) {
    if (!isKing(v) && p.r === (red ? 0 : ROWS - 1)) v = red ? RK : BK;
  }
  const last = m.path[m.path.length - 1];
  next[last.r * 8 + last.c] = v;
  for (const cap of m.captures) next[cap.r * 8 + cap.c] = E;
  return next;
};

const keyOf = (bd: Bd, red: boolean): string => {
  let s = red ? 'r' : 'b';
  for (let i = 0; i < 64; i++) {
    const r = i >> 3, c = i & 7;
    if (((r + c) & 1) === 1) s += bd[i];
  }
  return s;
};

// ── Evaluation (positive = good for RED) ────────────────────────────────────
const MAN = 100, KING = 300;

const evaluate = (bd: Bd): number => {
  let score = 0;
  let redMen = 0, redKings = 0, blackMen = 0, blackKings = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const v = bd[r * 8 + c];
      if (v === E) continue;
      let val = isKing(v) ? KING : MAN;
      const red = isRed(v);
      if (red) { if (isKing(v)) redKings++; else redMen++; } else if (isKing(v)) blackKings++; else blackMen++;

      if (!isKing(v)) {
        // advancement + near-crowning pull
        const adv = red ? 7 - r : r;
        val += adv * 4;
        if (adv >= 5) val += 10;
        // back-row shield keeps the crowning row defended
        if ((red && r === 7) || (!red && r === 0)) val += 12;
      } else {
        // centralized kings dominate; rim kings get pushed around
        const centDist = Math.max(Math.abs(3.5 - r), Math.abs(3.5 - c));
        val += Math.round((3.5 - centDist) * 8);
      }
      // central squares
      if (r >= 2 && r <= 5 && c >= 2 && c <= 5) val += 6;

      score += red ? val : -val;
    }
  }

  // Trading down when ahead converts a material edge into a win.
  const material = (redMen - blackMen) * MAN + (redKings - blackKings) * KING;
  const total = redMen + redKings + blackMen + blackKings;
  if (material > 60) score += (24 - total) * 3;
  else if (material < -60) score -= (24 - total) * 3;

  return score;
};

const WIN = 100000;

// ── Search ──────────────────────────────────────────────────────────────────
type TTEntry = { depth: number; score: number; flag: 0 | 1 | 2 }; // exact / lower / upper

let tt = new Map<string, TTEntry>();
let nodes = 0;
let deadline = Infinity;

class TimeUp extends Error {}

const orderMoves = (moves: ChainMove[]): ChainMove[] =>
  moves.sort((a, b) => b.captures.length - a.captures.length);

const quiesce = (bd: Bd, red: boolean, alpha: number, beta: number, qDepth: number): number => {
  if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new TimeUp();
  const moves = generateMoves(bd, red);
  if (moves.length === 0) return red ? -WIN : WIN;
  const capturing = moves[0].captures.length > 0;
  if (!capturing || qDepth <= 0) {
    return evaluate(bd);
  }
  // Forced captures: the position is not quiet — must resolve the exchange.
  if (red) {
    let best = -Infinity;
    for (const m of orderMoves(moves)) {
      best = Math.max(best, quiesce(applyChain(bd, m), false, alpha, beta, qDepth - 1));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of orderMoves(moves)) {
    best = Math.min(best, quiesce(applyChain(bd, m), true, alpha, beta, qDepth - 1));
    beta = Math.min(beta, best);
    if (beta <= alpha) break;
  }
  return best;
};

const search = (bd: Bd, red: boolean, depth: number, alpha: number, beta: number): number => {
  if ((++nodes & 1023) === 0 && Date.now() > deadline) throw new TimeUp();

  const key = keyOf(bd, red);
  const cached = tt.get(key);
  if (cached && cached.depth >= depth) {
    if (cached.flag === 0) return cached.score;
    if (cached.flag === 1 && cached.score >= beta) return cached.score;
    if (cached.flag === 2 && cached.score <= alpha) return cached.score;
  }

  if (depth <= 0) return quiesce(bd, red, alpha, beta, 16);

  const moves = generateMoves(bd, red);
  if (moves.length === 0) return red ? -WIN - depth : WIN + depth;

  const a0 = alpha, b0 = beta;
  let best: number;
  if (red) {
    best = -Infinity;
    for (const m of orderMoves(moves)) {
      // Capture chains keep the position sharp — extend them one ply.
      const ext = m.captures.length > 1 ? 1 : 0;
      best = Math.max(best, search(applyChain(bd, m), false, depth - 1 + ext, alpha, beta));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
  } else {
    best = Infinity;
    for (const m of orderMoves(moves)) {
      const ext = m.captures.length > 1 ? 1 : 0;
      best = Math.min(best, search(applyChain(bd, m), true, depth - 1 + ext, alpha, beta));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
  }
  const flag: 0 | 1 | 2 = best <= a0 ? 2 : best >= b0 ? 1 : 0;
  tt.set(key, { depth, score: best, flag });
  return best;
};

// ── Public API ──────────────────────────────────────────────────────────────
export type SearchRequest = {
  board: BoardState;
  /** Side the engine plays. */
  player: Player;
  level: 1 | 2 | 3 | 4 | 5;
  /** Position keys already seen twice — avoided at the root to dodge draws. */
  repeatKeys?: string[];
};

export type SearchResult = {
  /** The chosen full move; null when the side has no moves (it lost). */
  move: ChainMove | null;
  score: number;
  depth: number;
};

const LEVELS = {
  1: { fixedDepth: 2, timeMs: 0, blunderRate: 0.65, threshold: Infinity },
  2: { fixedDepth: 4, timeMs: 0, blunderRate: 0.35, threshold: 60 },
  3: { fixedDepth: 0, timeMs: 250, blunderRate: 0.12, threshold: 30 },
  4: { fixedDepth: 0, timeMs: 700, blunderRate: 0.04, threshold: 25 },
  5: { fixedDepth: 0, timeMs: 2600, blunderRate: 0, threshold: 0 },
} as const;

export const findBestMove = (req: SearchRequest): SearchResult => {
  const bd = toCompact(req.board);
  const red = req.player === 'red';
  const cfg = LEVELS[req.level];
  const repeats = new Set(req.repeatKeys ?? []);

  const rootMoves = generateMoves(bd, red);
  if (rootMoves.length === 0) return { move: null, score: red ? -WIN : WIN, depth: 0 };
  if (rootMoves.length === 1) return { move: rootMoves[0], score: 0, depth: 0 };

  tt = new Map();
  nodes = 0;
  deadline = cfg.timeMs > 0 ? Date.now() + cfg.timeMs : Infinity;
  const maxDepth = cfg.fixedDepth > 0 ? cfg.fixedDepth : 40;

  let scored: { move: ChainMove; score: number }[] = [];
  let completedDepth = 0;

  try {
    for (let depth = 2; depth <= maxDepth; depth++) {
      const iter: { move: ChainMove; score: number }[] = [];
      // Search previous-best first for maximum alpha-beta cutoffs.
      const ordered = scored.length > 0
        ? scored.map(s => s.move)
        : orderMoves(rootMoves.slice());
      let alpha = -Infinity, beta = Infinity;
      for (const m of ordered) {
        const child = applyChain(bd, m);
        let s = search(child, !red, depth - 1, alpha, beta);
        // Steer away from repetition draws when we are not losing.
        if (repeats.has(keyOf(child, !red))) s += red ? -80 : 80;
        iter.push({ move: m, score: s });
        if (red) alpha = Math.max(alpha, s); else beta = Math.min(beta, s);
      }
      iter.sort((a, b) => (red ? b.score - a.score : a.score - b.score));
      scored = iter;
      completedDepth = depth;
      if (cfg.fixedDepth > 0 && depth >= cfg.fixedDepth) break;
      // A found forced win needs no deeper search.
      if (Math.abs(scored[0].score) > WIN - 100) break;
    }
  } catch (e) {
    if (!(e instanceof TimeUp)) throw e;
  }

  if (scored.length === 0) {
    return { move: rootMoves[0], score: 0, depth: 0 };
  }

  const bestScore = scored[0].score;
  let pool = scored.filter(s => s.score === bestScore);
  if (cfg.blunderRate > 0 && Math.random() < cfg.blunderRate) {
    const within = scored.filter(s => Math.abs(bestScore - s.score) <= cfg.threshold);
    if (within.length > 0) pool = within;
  }
  const pick = pool[Math.floor(Math.random() * pool.length)];
  return { move: pick.move, score: pick.score, depth: completedDepth };
};
