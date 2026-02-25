/**
 * Deterministic Explanation Engine for Chess Reviews
 * Generates instructional feedback based on structured data and heuristics.
 */
class ExplanationGenerator {
    static TEMPLATES = {
        brilliant: [
            "A brilliant move that finds a critical and difficult-to-see continuation!",
            "Absolutely brilliant! You found a stunning resource.",
            "Brilliant! This is a move that completely turns the tables.",
            "A spectacular find that I absolutely love.",
            "Brilliant sacrifice or continuation!"
        ],
        great: [
            "A great move that finds the only good continuation.",
            "Great find! You spotted a very strong idea.",
            "This is a great move that puts immense pressure on your opponent.",
            "Excellent vision! This is the only move that works here.",
            "A great move in a critical position."
        ],
        best: [
            "This is the best move in the position. You found the optimal continuation.",
            "You played the most accurate move, fighting for the 'center' (the middle of the board).",
            "I completely agree with this move. It improves your position and piece activity.",
            "This is the strongest way to play it. A great prophylactic move (preventing your opponent's ideas).",
            "A perfect move that maximizes your advantage or solidifies your position."
        ],
        good: [
            "A solid, developing move (bringing a piece into the action), though there were slightly better options.",
            "This move is quite good. It sensibly improves your position.",
            "A perfectly fine move that maintains the balance of the position.",
            "A sensible choice that keeps you in the game without unnecessary risks."
        ],
        book: [
            "A standard opening book move.",
            "You are following established opening theory.",
            "This is a well-known theoretical move.",
            "A textbook opening move."
        ],
        bad_move: [
            "This move is {cls}.",
            "{move} is {cls}.",
            "Playing {move} is considered {cls} in this position.",
            "Unfortunately, {move} is {cls}.",
            "This decision turns out to be {cls}.",
            "That move is evaluated as {cls}.",
            "This is {cls} because it doesn't challenge the opponent enough.",
            "While tempting, {move} is actually {cls}."
        ],
        missed_tactic: [
            "You missed a tactical opportunity here.",
            "There was a concrete tactic available in this position that you overlooked.",
            "This overlooks a forcing tactical sequence.",
            "You had a chance to play a forcing combination but missed it.",
            "This move ignores a critical tactical sequence that was available.",
            "A sharp tactical opportunity was present, but this move lets it slip."
        ],
        lost_material: [
            "This move drops material unnecessarily.",
            "You allow your opponent to win material.",
            "This loses material without enough compensation.",
            "This gives away material for free.",
            "Your opponent can now win material by force.",
            "This blunders material."
        ],
        allowed_trade: [
            "This allows your opponent to easily simplify the position.",
            "This permits an equal trade that doesn't improve your situation.",
            "You give your opponent the chance to trade pieces and ease the pressure.",
            "This allows a simplification that benefits the opponent.",
            "Exchanging pieces here does not favor your position."
        ],
        bad_trade: [
            "Trading pieces when you are losing is exactly what your opponent wants.",
            "This simplification makes your opponent's life much easier.",
            "You should be complicating the position, not trading pieces.",
            "Exchanging material here only brings your opponent closer to victory."
        ],
        hanging_piece: [
            "This completely hangs a piece!",
            "You just gave away material for absolutely nothing.",
            "This blunder drops a piece entirely.",
            "A disastrous move that leaves a piece completely undefended.",
            "This gives your opponent a free piece."
        ],
        missed_mate: [
            "You completely missed a forced checkmate!",
            "There was a forced mate on the board, but this lets the king escape.",
            "You had the game won with a checkmate here, but you missed it.",
            "This lets a historic checkmate opportunity slip away."
        ],
        ignored_threat: [
            "This completely ignores your opponent's devastating threat.",
            "You had to deal with the immediate threat here, but you looked the other way.",
            "This move is oblivious to what your opponent is trying to do.",
            "You missed the danger your opponent was creating.",
            "An oblivious move that allows your opponent to execute their plan."
        ],
        missed_fork: [
            "You missed a brilliant knight fork here!",
            "There was a devastating fork available that you completely overlooked.",
            "You could have won material with a beautiful fork, but you missed it.",
            "This lets a golden opportunity for a royal fork slip by."
        ],
        is_check: [
            "Giving a check here doesn't actually accomplish much.",
            "This checks the king unnecessarily.",
            "Throwing in a check here actually helps your opponent develop.",
            "This is a completely misguided check."
        ],
        early_queen: [
            "Bringing the queen out this early is usually a bad idea. She will just get chased around, giving your opponent 'tempos' (free moves) to develop.",
            "This early queen sortie violates opening principles. Develop your minor pieces (knights and bishops) first!",
            "You are developing the queen too early. This lets your opponent gain time by attacking her.",
            "This is a reckless queen move in the opening. It's better to secure the center and castle your king."
        ],
        knight_on_rim: [
            "A knight on the rim is dim! Knights need to be centralized to control more squares and be effective.",
            "Moving your knight to the edge of the board severely limits its mobility.",
            "Knights are short-range pieces, so putting one on the edge drastically reduces its influence.",
            "It's rarely a good idea to push a knight to the a or h file voluntarily."
        ],
        missed_castling: [
            "You just manually moved your king instead of castling! Now you lose the right to castle.",
            "Moving the king here permanently forfeits your castling rights. A terrible long-term decision.",
            "You should have castled to safety. Manually moving the king leaves it stranded in the center."
        ],
        edge_pawn_push: [
            "Pushing edge pawns this early in the game is usually a waste of time.",
            "This flank pawn push ignores the fight for the center.",
            "You are wasting a valuable developing tempo pushing a pawn on the edge of the board.",
            "This is a very suspicious opening choice. You need to control the center first!"
        ],
        redundant_move: [
            "You just moved a piece you had already developed! Why waste time?",
            "Moving the same piece twice in the opening violates basic principles.",
            "You are wasting valuable tempos jumping around with the same piece.",
            "Instead of moving this piece again, you should be developing your other minor pieces!"
        ],
        weakened_king: [
            "This unnecessarily exposes your king.",
            "Your king becomes more vulnerable as a result.",
            "This creates weaknesses around your king.",
            "King safety should be a priority, but this move weakens your defenses.",
            "This pawn push creates holes near your king that can be exploited.",
            "You compromise your king's safety with this move."
        ],
        generic_mistake: [
            "This completely gives away your advantage.",
            "This move is too slow for the demands of the position. You need to 'develop' (bring your pieces into play) faster.",
            "This lacks the necessary urgency.",
            "This allows your opponent to easily equalize the central tension.",
            "You played a somewhat passive move. Look for 'forcing moves' (checks, captures, or immediate threats) instead.",
            "This decision just hands the 'initiative' (the ability to make threats and dictate the game) back to your opponent.",
            "This doesn't pose nearly enough problems for your opponent.",
            "This fundamentally misunderstands the needs of the position.",
            "You miss a crucial chance to improve your position here."
        ]
    };

    static SUGGESTIONS = [
        "Instead, {best} would have been devastatingly strong.",
        "A much better idea was {best}.",
        "Playing {best} would have kept a stranglehold on the position.",
        "You desperately needed to play {best} instead.",
        "I strongly prefer {best} here to maintain the tension.",
        "{best} was the critical test of the position that you avoided.",
        "You should have played {best} to keep the pressure mounting.",
        "The optimal continuation was {best}.",
        "Focusing on {best} would have yielded a better result."
    ];

    static getRandom(arr) {
        // Deterministic pseudo-random based on array length to avoid pure randomness if desired,
        // but simple random is fine for variety as long as the logic is deterministic.
        return arr[Math.floor(Math.random() * arr.length)];
    }

    static getPieceName(pieceChar) {
        if (!pieceChar) return "piece";
        switch (pieceChar.toLowerCase()) {
            case 'p': return "pawn";
            case 'n': return "knight";
            case 'b': return "bishop";
            case 'r': return "rook";
            case 'q': return "queen";
            case 'k': return "king";
            default: return "piece";
        }
    }

    /**
     * Generate an explanation based on a move's classification data.
     */
    static generateExplanation(moveSan, classification) {
        if (!classification) return "";

        const key = classification.key;
        const pieceName = this.getPieceName(classification.piece);

        // Format the title part: e.g. "<strong><img src='...' style='height:1em; vertical-align:middle;'/> Nxb5 is best</strong><br>"
        let titleHtml = "";
        if (key) {
            // we can just stick to text for now or add the icon class in the UI layer.
            // Let's just output text that the UI can style, but the generator can provide the main string.
            // "Nxb5 is best"
            let keyStr = key;
            if (key === 'inaccuracy') keyStr = 'an inaccuracy';
            else if (key === 'mistake') keyStr = 'a mistake';
            else if (key === 'blunder') keyStr = 'a blunder';

            titleHtml = `<div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px;">
                            ${moveSan} is ${keyStr}
                         </div>`;
        }

        // Special checkmate override
        if (moveSan.includes('#')) {
            const matePhrases = [
                "Boom! That's checkmate! Beautifully played.",
                "And that's the end of the game! Nice checkmate.",
                "Checkmate! Your opponent's king has no escape.",
                "A satisfying conclusion to the game. Great checkmate!",
                "Game over! Perfectly executed checkmate."
            ];
            return `<div style="font-size: 1.1rem; font-weight: 700; margin-bottom: 6px; color: var(--accent);">Checkmate!</div>` + this.getRandom(matePhrases);
        }

        let explanation = [];

        // Handle positive moves
        if (['best', 'great', 'brilliant', 'book', 'good'].includes(key)) {
            if (key === 'book' && classification.opening) {
                // Use opening theory
                explanation.push(`This is ${classification.opening.name}, ${classification.opening.desc}`);
                return titleHtml + explanation.join(" ");
            }

            let text = "";
            const isCapture = moveSan.includes('x');
            const isCastling = (moveSan === 'O-O' || moveSan === 'O-O-O');
            const tags = classification.tags || [];

            if (tags.includes('kicks_piece')) {
                text = "Good move! This pushes your pawn and actively kicks the opponent's piece away.";
            } else if (key === 'brilliant' || key === 'great') {
                const tacticsPhrases = [
                    "What a phenomenal tactical sequence!",
                    `A devastating ${pieceName} move.`,
                    "Setting up a beautiful fork or attack with this!",
                    "This creates massive problems for your opponent.",
                    "An incredibly sharp continuation."
                ];
                text = this.getRandom(tacticsPhrases);
            } else if (isCastling) {
                text = "Castling here is an excellent decision to secure your king and connect the rooks.";
            } else if (isCapture) {
                text = `Taking with the ${pieceName} is the best way to handle this position.`;
            } else {
                const arr = this.TEMPLATES[key];
                if (arr) {
                    text = this.getRandom(arr).replace('{piece}', pieceName);
                }
            }

            if (text) explanation.push(text);

            if (tags.includes('is_check')) {
                explanation.push("This move also puts the opponent's king in check!");
            }

            return titleHtml + explanation.join(" ");
        }

        // It's an inaccuracy, mistake, or blunder
        const clsStr = (key === 'inaccuracy' || key === 'mistake' || key === 'blunder')
            ? `an ${key}`
            : `a ${key}`;

        // Special check for castling
        const isCastling = (moveSan === 'O-O' || moveSan === 'O-O-O');

        // 1. State what happened
        let stateTemplates = [];

        if (isCastling) {
            stateTemplates = [
                `Deciding to castle here is ${clsStr}.`,
                `Tucking your king away right now is ${clsStr}.`,
                `Castling in this position evaluates as ${clsStr}.`,
                `This castling choice is actually ${clsStr}.`
            ];
        } else {
            stateTemplates = [
                `Moving the ${pieceName} here is ${clsStr}.`,
                `This ${pieceName} move turns out to be ${clsStr}.`,
                `Deciding to move your ${pieceName} here evaluates as ${clsStr}.`,
                `While tempting, moving the ${pieceName} there is actually ${clsStr}.`
            ];
        }

        let stateStr = this.getRandom(stateTemplates);
        stateStr = stateStr.charAt(0).toUpperCase() + stateStr.slice(1);
        explanation.push(stateStr);

        // Add precision! Explain exactly how bad it was
        if (classification.cpLoss && Math.abs(classification.cpLoss) >= 1.0) {
            if (classification.cpLoss < 90) {
                // To avoid being repetitive, only mention the exact math 50% of the time
                // and use varied phrasing.
                if (Math.random() > 0.5) {
                    const mathPhrases = [
                        `This move drops your positional evaluation by ${classification.cpLoss.toFixed(1)} points.`,
                        `This inaccuracy costs you about ${classification.cpLoss.toFixed(1)} points in evaluation.`,
                        `The engine evaluates this drop as a severe ${classification.cpLoss.toFixed(1)} point mistake.`,
                        `You forfeit ${classification.cpLoss.toFixed(1)} points of evaluation with this decision.`
                    ];
                    explanation.push(this.getRandom(mathPhrases));
                }
            } else {
                explanation.push("This effectively gave away the game by allowing a forced checkmate.");
            }
        }

        // 2. Explain what was missed or consequence
        const tags = classification.tags || [];

        if (classification.hungPiece) {
            const pName = this.getPieceName(classification.hungPiece);
            explanation.push(`By doing this, you are losing a ${pName}!`);
        }

        if (tags.length > 0) {
            tags.forEach(tag => {
                if (this.TEMPLATES[tag]) {
                    explanation.push(this.getRandom(this.TEMPLATES[tag]).replace('{piece}', pieceName));
                }
            });
        } else {
            // Contextual general mistakes
            if (classification.phase === 'opening') {
                const openingPhases = [
                    "In the opening, you should focus on developing your minor pieces and fighting for the center rather than slow moves like this.",
                    "This move ignores the fundamental opening principles of rapid development and king safety.",
                    "At this stage of the game, every tempo counts towards piece activity. This move is too passive.",
                    "You should prioritize getting your pieces off the back rank and into active positions early on.",
                    "This is a bit too slow for the opening. You want to establish a strong central presence.",
                    "Instead of this, focus on developing your knights and bishops to control the board."
                ];
                explanation.push(this.getRandom(openingPhases));
            } else if (classification.phase === 'endgame') {
                const endgamePhases = [
                    "In the endgame, every tempo counts. This move gives away critical time or positioning.",
                    "This endgame decision is too passive. You need to activate your king and push passed pawns.",
                    "Endgames require maximum piece activity and calculation. This move falls short of that.",
                    "You are losing the battle for key squares in this endgame phase.",
                    "This move wastes valuable time in a position where concrete calculation is needed."
                ];
                explanation.push(this.getRandom(endgamePhases));
            } else {
                explanation.push(this.getRandom(this.TEMPLATES.generic_mistake));
            }
        }

        // 3. Suggest better idea
        if (classification.engineBestSan) {
            let bestName = classification.engineBestSan;
            explanation.push(this.getRandom(this.SUGGESTIONS).replace('{best}', bestName));
        }

        return titleHtml + explanation.join(" ");
    }
}
