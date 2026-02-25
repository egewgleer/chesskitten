/**
 * ChessLogic — wraps chess.js for PGN parsing, move history & FEN navigation.
 * Also stores source/target squares for each move (for board overlays).
 */
class ChessLogic {
    constructor() {
        this.game = new Chess();
        this.fens = [];       // FEN at every half-move (index 0 = start position)
        this.sans = [];       // SAN strings for each half-move
        this.squares = [];    // [{from, to}, ...] for each half-move
        this.idx = 0;         // current position index into fens[]
        this.classifications = []; // will be filled by analyzer
        this._snapshot();
    }

    reset() {
        this.game.reset();
        this.fens = [];
        this.sans = [];
        this.squares = [];
        this.idx = 0;
        this.classifications = [];
        this._snapshot();
    }

    _snapshot() {
        this.fens.push(this.game.fen());
    }

    loadPGN(pgn) {
        this.reset();
        const ok = this.game.load_pgn(pgn, { sloppy: true });
        if (!ok) return false;

        const moves = this.game.history({ verbose: true });
        this.reset();

        for (const m of moves) {
            this.game.move(m.san);
            this.sans.push(m.san);
            this.squares.push({ from: m.from, to: m.to, color: m.color, piece: m.piece });
            this._snapshot();
        }

        this.idx = this.fens.length - 1;
        return true;
    }

    fen() { return this.fens[this.idx]; }
    moves() { return this.sans; }

    /** Get the from/to squares of the move that PRODUCED the current position */
    currentMoveSquares() {
        if (this.idx === 0) return null;
        return this.squares[this.idx - 1]; // move i-1 produced fen[i]
    }

    /** Get classification for the move that produced the current position */
    currentClassification() {
        if (this.idx === 0 || this.classifications.length === 0) return null;
        return this.classifications[this.idx - 1] || null;
    }

    /** Get classification for move at index i (0-based into sans[]) */
    getMoveClassification(moveIdx) {
        if (this.classifications.length === 0) return null;
        return this.classifications[moveIdx] || null;
    }

    goStart() { this.idx = 0; return this.fen(); }
    goEnd() { this.idx = this.fens.length - 1; return this.fen(); }
    goNext() { if (this.idx < this.fens.length - 1) this.idx++; return this.fen(); }
    goPrev() { if (this.idx > 0) this.idx--; return this.fen(); }
    goTo(i) { if (i >= 0 && i < this.fens.length) this.idx = i; return this.fen(); }

    turn() {
        return this.idx % 2 === 0 ? 'w' : 'b';
    }

    /**
     * Tries to identify the opening played in the current game.
     */
    getGameOpening() {
        if (this.sans.length === 0) return null;
        return getOpening(this.sans);
    }
}

// ========================
// Move Classification
// ========================
const CLASSIFICATION = {
    BRILLIANT: { key: 'brilliant', label: '!!', color: '#1baaa7', icon: '💎' },
    GREAT: { key: 'great', label: '!', color: '#5c8bb0', icon: '⭐' },
    BEST: { key: 'best', label: '✓', color: '#96bc4b', icon: '✅' },
    GOOD: { key: 'good', label: '', color: '#96bc4b', icon: '' },
    BOOK: { key: 'book', label: '📖', color: '#a88764', icon: '📖' },
    INACCURACY: { key: 'inaccuracy', label: '?!', color: '#e6a835', icon: '⚠️' },
    MISTAKE: { key: 'mistake', label: '?', color: '#e68a35', icon: '❌' },
    BLUNDER: { key: 'blunder', label: '??', color: '#ca3431', icon: '🔴' },
};

function getMaterialBalance(fen) {
    const pieces = fen.split(' ')[0];
    const vals = { 'P': 1, 'N': 3, 'B': 3, 'R': 5, 'Q': 9, 'p': -1, 'n': -3, 'b': -3, 'r': -5, 'q': -9 };
    let bal = 0;
    for (let c of pieces) {
        if (vals[c]) bal += vals[c];
    }
    return bal;
}

function getGamePhase(fen, moveIndex = 0) {
    const pieces = fen.split(' ')[0];
    let majorMinorCount = 0;
    for (let c of pieces) {
        if ('NBRQnbrq'.includes(c)) majorMinorCount++;
    }

    // Opening: First 10-12 full moves (20-25 ply) OR very few pieces traded
    if (moveIndex < 24 && majorMinorCount >= 10) return 'opening';

    // Endgame: Few major/minor pieces left
    if (majorMinorCount <= 6) return 'endgame';

    // Otherwise, Middlegame
    return 'middlegame';
}

const COMMON_OPENINGS = [
    { prefix: "e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6", name: "the Sicilian Najdorf", desc: "one of the sharpest, most respected, and deeply analyzed lines in chess." },
    { prefix: "e4 c5 Nf3 Nc6 d4 cxd4 Nxd4", name: "the Open Sicilian", desc: "a highly dynamic battleground where White plays for an attack while Black relies on a strong center." },
    { prefix: "e4 c5 c3", name: "the Alapin Sicilian", desc: "an anti-Sicilian setup aiming to build a strong classical pawn center." },
    { prefix: "e4 c5", name: "the Sicilian Defense", desc: "a sharp, asymmetrical opening that immediately fights for the center." },
    { prefix: "e4 e5 Nf3 Nc6 Bb5 a6", name: "the Ruy Lopez, Morphy Defense", desc: "challenging the Spanish bishop early to solidify Black's position." },
    { prefix: "e4 e5 Nf3 Nc6 Bb5", name: "the Ruy Lopez", desc: "the Spanish Game, a highly classical opening focusing on rapid development." },
    { prefix: "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4", name: "the Giuoco Piano, Main Line", desc: "a classical Italian setup fighting for full central control." },
    { prefix: "e4 e5 Nf3 Nc6 Bc4 Bc5", name: "the Giuoco Piano", desc: "the 'Quiet Game', maneuvering pieces to ideal squares before striking." },
    { prefix: "e4 e5 Nf3 Nc6 Bc4 Nf6", name: "the Two Knights Defense", desc: "a highly aggressive counterattack against the Italian Game." },
    { prefix: "e4 e5 Nf3 Nc6 Bc4", name: "the Italian Game", desc: "aiming for rapid development and attacking the vulnerable f7 square." },
    { prefix: "e4 e5 Nf3 Nc6 d4", name: "the Scotch Game", desc: "an immediate central break aiming for open, tactical play." },
    { prefix: "e4 e6 d4 d5 Nd2", name: "the French Defense, Tarrasch Variation", desc: "a solid choice for White avoiding the pin on b4." },
    { prefix: "e4 e6 d4 d5", name: "the French Defense", desc: "a resilient counter-attacking opening relying on central pawn tension." },
    { prefix: "e4 c6 d4 d5", name: "the Caro-Kann Defense", desc: "an incredibly solid setup supporting a central break without blocking the light-squared bishop." },
    { prefix: "d4 d5 c4 e6", name: "the Queen's Gambit Declined", desc: "a sturdy classical approach that declines the wing pawn sacrifice." },
    { prefix: "d4 d5 c4 c6", name: "the Slav Defense", desc: "a highly respected defense to the Queen's Gambit securing the d5 outpost." },
    { prefix: "d4 d5 c4 dxc4", name: "the Queen's Gambit Accepted", desc: "accepting the gambit pawn to challenge White's center later." },
    { prefix: "d4 d5 c4", name: "the Queen's Gambit", desc: "the most classical 1. d4 opening offering a flank pawn for central dominance." },
    { prefix: "d4 Nf6 c4 e6 Nc3 Bb4", name: "the Nimzo-Indian Defense", desc: "a premier hypermodern opening allowing a doubled pawn for rapid development." },
    { prefix: "d4 Nf6 c4 g6 Nc3 Bg7 e4", name: "the King's Indian Defense", desc: "a hyper-dynamic, attacking opening leading to complex tactical imbalances." },
    { prefix: "d4 Nf6 c4 g6 Nc3 d5", name: "the Grünfeld Defense", desc: "an aggressive hypermodern choice striking back at White's center immediately with pawns." },
    { prefix: "d4 f5", name: "the Dutch Defense", desc: "an uncompromising, asymmetrical fight for the e4 square." },
    { prefix: "e4 d6 d4 Nf6 Nc3 g6", name: "the Pirc Defense", desc: "a hypermodern defense fighting for the center from the flanks." },
    { prefix: "e4 g6", name: "the Modern Defense", desc: "a flexible and provocative hypermodern opening." },
    { prefix: "c4 e5 Nc3", name: "the English Opening, Reversed Sicilian", desc: "a rich strategical system playing the Sicilian up a tempo." },
    { prefix: "c4", name: "the English Opening", desc: "a flexible flank opening that fights for the center from the side." },
    { prefix: "Nf3 d5 g3", name: "the Réti Opening", desc: "a hypermodern system exerting pressure on the center from afar." },
    { prefix: "Nf3", name: "the Zukertort Opening", desc: "a highly flexible first move frequently transposing into other classical setups." },
    { prefix: "b3", name: "Larsen's Opening", desc: "a hypermodern flank opening preparing an immediate fianchetto." },
    { prefix: "f4", name: "Bird's Opening", desc: "an aggressive flank attack seizing control of the e5 square early." },
    { prefix: "e4 d5 exd5 Qxd5", name: "the Scandinavian Defense", desc: "an early central challenge that forces immediate decisions from White." },
    { prefix: "e4 e5 f4", name: "the King's Gambit", desc: "the ultimate romantic chess opening, sacrificing a pawn for an open f-file and rapid attack." },
    { prefix: "e4 e5 Nf3 d6", name: "the Philidor Defense", desc: "a solid, if somewhat passive, opening approach for Black." },
    { prefix: "e4 e5", name: "the Double King's Pawn Opening", desc: "a classical and principled way to start the game." },
    { prefix: "d4 d5", name: "the Closed Game", desc: "a strategic, positional battle from move one." }
];

function getOpening(sansPrefix) {
    const moveStr = sansPrefix.join(" ");
    // Find longest matching prefix
    let bestMatch = null;
    let longest = 0;
    for (const op of COMMON_OPENINGS) {
        if (moveStr.startsWith(op.prefix) && op.prefix.length > longest) {
            bestMatch = op;
            longest = op.prefix.length;
        }
    }
    return bestMatch;
}

/**
 * Analyze all positions in a game and classify each move.
 * @param {Engine} engine
 * @param {ChessLogic} logic
 * @param {Function} onProgress - called with (moveIndex, total)
 * @returns {Promise<Array>} classifications array
 */
async function analyzeFullGame(engine, logic, targetDepth, onProgress) {
    const fens = logic.fens;
    const numMoves = logic.sans.length;
    const evals = []; // eval for each FEN position (from White's perspective)
    const bestMoves = []; // engine best move for each position

    // Evaluate every position
    for (let i = 0; i < fens.length; i++) {
        // Check for terminal positions (checkmate/stalemate) — engine can't eval these
        const tempGame = new Chess(fens[i]);
        const isWhiteTurn = tempGame.turn() === 'w';

        if (tempGame.game_over()) {
            let score = 0;
            let isMate = false;
            if (tempGame.in_checkmate()) {
                // Side to move is mated — they lost
                score = isWhiteTurn ? -100 : 100; // from White's perspective
                isMate = true;
            }
            evals.push({ score, isMate, raw: 0 });
            bestMoves.push(null);
            if (onProgress) onProgress(i, fens.length);
            continue;
        }

        const result = await engine.evalAsync(fens[i], targetDepth);

        // Score from Stockfish is from side-to-move perspective
        // Normalize to White's perspective
        const whiteScore = isWhiteTurn ? result.score : -result.score;
        const whiteIsMate = result.isMate;

        evals.push({
            score: whiteScore,
            isMate: whiteIsMate,
            raw: result.score,
            pv: result.pv || ''
        });
        bestMoves.push(result.bestMove);

        if (onProgress) onProgress(i, fens.length);
    }

    // Classify each move based on eval swing
    const classifications = [];
    const BOOK_MOVES = 6; // first N half-moves considered book

    for (let m = 0; m < numMoves; m++) {
        const evalBefore = evals[m];
        const evalAfter = evals[m + 1];
        const engineBest = bestMoves[m]; // what engine recommended at this position

        // The actual SAN move played
        const playedMove = logic.squares[m];

        // Handle mate scores
        let scoreBefore = evalBefore.isMate ? (evalBefore.score > 0 ? 100 : -100) : evalBefore.score;
        let scoreAfter = evalAfter.isMate ? (evalAfter.score > 0 ? 100 : -100) : evalAfter.score;

        // Who moved? Rely on the parsed move color, not index parity
        const isWhiteMove = playedMove.color === 'w';

        // Centipawn loss from the mover's perspective
        // If White moved: loss = scoreBefore - scoreAfter (white advantage should stay or increase)
        // If Black moved: loss = scoreAfter - scoreBefore (white advantage should decrease or stay)
        let cpLoss;
        if (isWhiteMove) {
            cpLoss = scoreBefore - scoreAfter;
        } else {
            cpLoss = scoreAfter - scoreBefore;
        }

        let cls;

        // Book moves (first few moves of the game)
        if (m < BOOK_MOVES && Math.abs(cpLoss) < 0.5) {
            cls = CLASSIFICATION.BOOK;
        }
        // If the move played IS the engine's best move, it can never be a mistake/blunder.
        // (Sometimes CP drops on the next ply due to horizon effect, hiding the truth).
        else if (engineBest && (playedMove.from + playedMove.to) === engineBest) {
            // It could be Brilliant/Great if it also had a massive negative CP loss, 
            // but at minimum, it is the Best move.
            if (cpLoss <= -2.0) cls = CLASSIFICATION.BRILLIANT;
            else if (cpLoss <= -1.0) cls = CLASSIFICATION.GREAT;
            else cls = CLASSIFICATION.BEST;
        }
        // Classify by centipawn loss (chess.com-aligned thresholds)
        else if (cpLoss <= -2.0) {
            cls = CLASSIFICATION.BRILLIANT;
        } else if (cpLoss <= -1.0) {
            cls = CLASSIFICATION.GREAT;
        } else if (cpLoss <= 0.4) {
            cls = CLASSIFICATION.BEST;
        } else if (cpLoss <= 1.2) {
            cls = CLASSIFICATION.GOOD;
        } else if (cpLoss <= 2.5) {
            cls = CLASSIFICATION.INACCURACY;
        } else if (cpLoss <= 5.0) {
            cls = CLASSIFICATION.MISTAKE;
        } else {
            cls = CLASSIFICATION.BLUNDER;
        }

        const phase = getGamePhase(fens[m], m);
        const matBefore = getMaterialBalance(fens[m]);
        const matAfter = getMaterialBalance(fens[m + 1]);
        const matDiff = isWhiteMove ? (matAfter - matBefore) : -(matAfter - matBefore); // positive if mover won material

        let engineBestSan = engineBest;
        if (engineBest) {
            try {
                // Use a temporary chess instance to convert LAN to SAN
                const tempGame = new Chess(fens[m]);
                const moveObj = tempGame.move({
                    from: engineBest.substring(0, 2),
                    to: engineBest.substring(2, 4),
                    promotion: engineBest.length > 4 ? engineBest.substring(4) : undefined
                });
                if (moveObj && moveObj.san) {
                    engineBestSan = moveObj.san;
                }
            } catch (e) {
                // Keep LAN fallback if conversion fails
            }
        }

        // --- Reason Tags ---
        const san = logic.sans[m];

        const tags = [];
        let hungPiece = null;

        // Contextual Tags (applied to all moves)
        if (san.includes('+')) tags.push('is_check');
        if (san.includes('x')) tags.push('is_capture');
        if (san.includes('O-O')) tags.push('is_castling');

        // Did they miss a forced mate?
        if (isWhiteMove ? (evalBefore.isMate && evalBefore.score > 0 && !evalAfter.isMate) : (evalBefore.isMate && evalBefore.score < 0 && !evalAfter.isMate)) {
            tags.push('missed_mate');
        }

        if (cpLoss > 1.2) {
            // It's an inaccuracy or worse
            if (matDiff <= -3) {
                tags.push('hanging_piece');
            } else if (matDiff < 0) {
                tags.push('lost_material');
            }
            if (evalBefore.pv && (evalBefore.pv.includes('x') || evalBefore.pv.includes('+'))) {
                tags.push('missed_tactic');
            }
            if (san.includes('K')) {
                tags.push('weakened_king');
            }

            // Ignored Threat: Did the opponent immediately capture something valuable on the next turn because we didn't address it?
            if (evalAfter.pv && evalAfter.pv.includes('x')) {
                tags.push('ignored_threat');
            }

            // Did we just hang a piece? Let's check the opponent's best response
            const nextBest = evalAfter.pv ? evalAfter.pv.split(' ')[0] : null; // e.g., "e4d5"
            if (nextBest && nextBest.length >= 4) {
                const toSquare = nextBest.substring(2, 4);
                try {
                    const tempGame2 = new Chess(fens[m + 1]);
                    const pieceAtTarget = tempGame2.get(toSquare);
                    // If the opponent's best move captures our piece
                    if (pieceAtTarget && pieceAtTarget.color === playedMove.color) {
                        hungPiece = pieceAtTarget.type;
                    }
                } catch (e) { }
            }

            // Missed Fork/Tactic: If engine wanted a Knight move that resulted in a huge swing, it was likely a fork.
            if (engineBestSan && engineBestSan.startsWith('N') && (scoreBefore - scoreAfter > 2.0)) {
                tags.push('missed_fork');
            }

            // Positional: Moving the king manually instead of castling
            if (san.startsWith('K') && !san.includes('O-O') && phase === 'opening') {
                tags.push('missed_castling');
            }

            // Positional: Moving the Queen out too early
            if (san.startsWith('Q') && phase === 'opening' && m < 10) {
                tags.push('early_queen');
            }

            // Positional: Knights on the rim are dim
            if (san.startsWith('N') && (san.includes('a') || san.includes('h'))) {
                tags.push('knight_on_rim');
            }

            // Positional: Edge pawn pushes in the opening
            if (san.match(/^[ah][3456]/) && phase === 'opening') {
                tags.push('edge_pawn_push');
            }

            // Positional: Moving the same piece twice in the opening instead of developing
            if (m >= 2 && phase === 'opening') {
                const lastMyMove = logic.squares[m - 2];
                if (lastMyMove && playedMove.piece === lastMyMove.piece && playedMove.from === lastMyMove.to) {
                    tags.push('redundant_move');
                }
            }

            // Trading evaluation
            if (Math.abs(matDiff) === 0 && san.includes('x')) {
                // If they are losing heavily (e.g. down -3 eval) and they traded, it's a "bad trade"
                if ((isWhiteMove && scoreBefore < -300) || (!isWhiteMove && scoreBefore > 300)) {
                    tags.push('bad_trade');
                } else {
                    tags.push('allowed_trade');
                }
            }
        } else if (playedMove.piece === 'p') {
            // Good/Best move: Is it a pawn kicking a piece?
            const nextBest = evalAfter.pv ? evalAfter.pv.split(' ')[0] : null;
            if (nextBest && nextBest.length >= 4) {
                const fromSquare = nextBest.substring(0, 2);
                try {
                    const tempGame2 = new Chess(fens[m + 1]);
                    const pieceMoving = tempGame2.get(fromSquare);
                    if (pieceMoving && ['n', 'b', 'r', 'q'].includes(pieceMoving.type) && pieceMoving.color !== playedMove.color) {
                        tags.push('kicks_piece');
                    }
                } catch (e) { }
            }
        }

        let openingInfo = null;
        if (cls.key === 'book') {
            openingInfo = getOpening(logic.sans.slice(0, m + 1));
        }

        classifications.push({
            ...cls,
            cpLoss: cpLoss,
            evalBefore: scoreBefore,
            evalAfter: scoreAfter,
            engineBest: engineBest,           // Keep LAN for the UI arrows (e2e4)
            engineBestSan: engineBestSan,     // New SAN for Cheshire (e4)
            enginePv: evalBefore.pv,
            from: playedMove.from,
            to: playedMove.to,
            piece: playedMove.piece,
            tags: tags,
            phase: phase,
            matBefore: matBefore,
            matAfter: matAfter,
            opening: openingInfo,
            hungPiece: hungPiece
        });
    }

    return classifications;
}
