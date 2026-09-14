/**
 * Russian shashki (draughts) rules — the single source of truth for legality.
 * Used by the page for human moves and by engine.ts for search.
 *
 * Strict rule set implemented here:
 *  - Men move 1 diagonally forward; capture by jumping in ALL 4 diagonals.
 *  - Kings "fly": move any distance diagonally; capture a single enemy piece
 *    anywhere on the diagonal and land on any empty square beyond it.
 *  - Captures are mandatory. A capture chain MUST be completed: while the
 *    moved piece can keep capturing, the same piece must continue.
 *    (Russian rules do NOT require choosing the maximum chain.)
 *  - "Turkish stroke": pieces captured mid-chain stay on the board as dead
 *    blockers until the chain COMPLETES — they cannot be jumped twice and
 *    they block a flying king's path. Removed only when the chain ends.
 *  - A man that reaches the crowning row DURING a capture chain is promoted
 *    immediately and continues the same chain as a king.
 */

export type Player = 'red' | 'black';
export type Piece = { id: string; player: Player; isKing: boolean };
export type BoardState = (Piece | null)[][];
export type Position = { r: number; c: number };
/** One step: destination plus the square of the piece it captures (if any). */
export type Move = Position & { capture?: Position };

export const ROWS = 8;
export const COLS = 8;

const DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;

export const initializeBoard = (): BoardState => {
  const board: BoardState = Array(ROWS).fill(null).map(() => Array(COLS).fill(null));
  let id = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r + c) % 2 === 1) {
        if (r < 3) board[r][c] = { id: `p-${id++}`, player: 'black', isKing: false };
        else if (r > 4) board[r][c] = { id: `p-${id++}`, player: 'red', isKing: false };
      }
    }
  }
  return board;
};

const inside = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const isGhost = (ghosts: Position[], r: number, c: number) =>
  ghosts.some(g => g.r === r && g.c === c);

export const crowningRow = (player: Player) => (player === 'red' ? 0 : ROWS - 1);

/** True when the piece at (r,c) has at least one capture step available. */
const hasCaptureFrom = (
  board: BoardState, r: number, c: number, piece: Piece, ghosts: Position[],
): boolean => stepMovesForPiece(board, r, c, piece, ghosts, true, true).length > 0;

/**
 * All single steps a piece can make. `ghosts` = squares of pieces already
 * captured in the current chain (dead blockers: not capturable, not passable).
 * When `capturesOnly`, quiet moves are skipped (mid-chain continuation).
 *
 * King landing rule (strict shashki): after jumping a piece, if some landing
 * square lets the capture continue, the king MUST land on one of those —
 * dead-end landings are filtered out. `existenceOnly` skips that filtering
 * (used by the probes themselves; it never changes whether a capture exists).
 */
export const stepMovesForPiece = (
  board: BoardState,
  r: number,
  c: number,
  piece: Piece,
  ghosts: Position[] = [],
  capturesOnly = false,
  existenceOnly = false,
): Move[] => {
  const moves: Move[] = [];
  if (piece.isKing) {
    for (const [dr, dc] of DIAGONALS) {
      let victim: Position | null = null;
      const landings: Position[] = [];
      let step = 1;
      while (true) {
        const nr = r + step * dr; const nc = c + step * dc;
        if (!inside(nr, nc)) break;
        const target = board[nr][nc];
        if (!victim) {
          if (target === null) {
            if (!capturesOnly) moves.push({ r: nr, c: nc });
          } else if (isGhost(ghosts, nr, nc)) break; // dead piece blocks the ray
          else if (target.player !== piece.player) victim = { r: nr, c: nc };
          else break;
        } else {
          if (target === null) landings.push({ r: nr, c: nc });
          else break; // second piece behind the victim blocks landing
        }
        step++;
      }
      if (!victim || landings.length === 0) continue;
      let targets = landings;
      if (!existenceOnly) {
        const nextGhosts = [...ghosts, victim];
        const continuing = landings.filter(l => {
          const probe = board.map(row => [...row]);
          probe[r][c] = null;
          probe[l.r][l.c] = piece;
          return hasCaptureFrom(probe, l.r, l.c, piece, nextGhosts);
        });
        if (continuing.length > 0) targets = continuing;
      }
      for (const l of targets) moves.push({ r: l.r, c: l.c, capture: victim });
    }
  } else {
    if (!capturesOnly) {
      const forward = piece.player === 'red' ? -1 : 1;
      for (const dc of [-1, 1]) {
        const nr = r + forward; const nc = c + dc;
        if (inside(nr, nc) && board[nr][nc] === null) moves.push({ r: nr, c: nc });
      }
    }
    for (const [dr, dc] of DIAGONALS) {
      const vr = r + dr; const vc = c + dc;
      const lr = r + 2 * dr; const lc = c + 2 * dc;
      if (!inside(lr, lc) || board[lr][lc] !== null) continue;
      const victim = board[vr][vc];
      if (victim && victim.player !== piece.player && !isGhost(ghosts, vr, vc)) {
        moves.push({ r: lr, c: lc, capture: { r: vr, c: vc } });
      }
    }
  }
  return moves;
};

export type ChainState = { pos: Position; ghosts: Position[] };

/**
 * Every legal (start, step) for `player`. Mid-chain (`chain` non-null) only the
 * chain piece may move and only by capturing. Otherwise the mandatory-capture
 * rule filters quiet moves out whenever any capture exists.
 */
export const legalMoves = (
  board: BoardState,
  player: Player,
  chain: ChainState | null = null,
): { start: Position; move: Move }[] => {
  if (chain) {
    const piece = board[chain.pos.r][chain.pos.c];
    if (!piece) return [];
    return stepMovesForPiece(board, chain.pos.r, chain.pos.c, piece, chain.ghosts, true)
      .map(move => ({ start: chain.pos, move }));
  }
  const all: { start: Position; move: Move }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const piece = board[r][c];
      if (!piece || piece.player !== player) continue;
      for (const move of stepMovesForPiece(board, r, c, piece)) {
        all.push({ start: { r, c }, move });
      }
    }
  }
  const hasCapture = all.some(m => m.move.capture);
  return hasCapture ? all.filter(m => m.move.capture) : all;
};

export type StepResult = {
  board: BoardState;
  /** Non-null while the same piece must keep capturing. */
  chain: ChainState | null;
  crowned: boolean;
  captured: boolean;
};

/**
 * Applies one step. Captured pieces stay on the board (as ghosts) until the
 * chain completes; crowning mid-chain continues the chain as a king.
 * Returns a NEW board; never mutates the input.
 */
export const applyStep = (
  board: BoardState,
  start: Position,
  move: Move,
  chain: ChainState | null = null,
): StepResult => {
  const next = board.map(row => [...row]);
  const moving = { ...next[start.r][start.c]! };
  next[start.r][start.c] = null;

  let crowned = false;
  if (!moving.isKing && move.r === crowningRow(moving.player)) {
    moving.isKing = true;
    crowned = true;
  }
  next[move.r][move.c] = moving;

  if (!move.capture) return { board: next, chain: null, crowned, captured: false };

  const ghosts = [...(chain?.ghosts ?? []), move.capture];
  const continuation = stepMovesForPiece(next, move.r, move.c, moving, ghosts, true);
  if (continuation.length > 0) {
    return { board: next, chain: { pos: { r: move.r, c: move.c }, ghosts }, crowned, captured: true };
  }
  // Chain complete — now the dead pieces leave the board.
  for (const g of ghosts) next[g.r][g.c] = null;
  return { board: next, chain: null, crowned, captured: true };
};

/** Position key for repetition detection (includes side to move). */
export const boardKey = (board: BoardState, turn: Player): string => {
  let s = turn === 'red' ? 'r' : 'b';
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if ((r + c) % 2 !== 1) continue;
      const p = board[r][c];
      s += p ? (p.player === 'red' ? (p.isKing ? 'R' : 'r') : (p.isKing ? 'B' : 'b')) : '.';
    }
  }
  return s;
};

export const countPieces = (board: BoardState) => {
  let red = 0, black = 0;
  for (const row of board) {
    for (const p of row) {
      if (p?.player === 'red') red++;
      else if (p?.player === 'black') black++;
    }
  }
  return { red, black };
};
