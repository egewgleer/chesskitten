(function () {
    'use strict';

    const playScreen = document.getElementById('play-screen');
    const startPlayBtn = document.getElementById('start-play-btn');
    const eloSlider = document.getElementById('bot-elo-slider');
    const eloDisplay = document.getElementById('bot-elo-display');
    const colorSelect = document.getElementById('play-color-select');
    const playBackBtn = document.getElementById('btn-play-back');
    const resignBtn = document.getElementById('play-resign-btn');
    const statusMsg = document.getElementById('play-status-msg');
    const playEvalFill = document.getElementById('play-eval-fill');
    const playEvalLabel = document.getElementById('play-eval-label');
    const playMoveBody = document.getElementById('play-move-body');
    const playMovesScroll = document.getElementById('play-moves-scroll');

    const playBlackName = document.getElementById('play-black-name');
    const playWhiteName = document.getElementById('play-white-name');

    let playBoard = null;
    let playLogic = new Chess();
    let playEngine = null;
    let isPlayerTurn = true;
    let playerColor = 'w';
    let playerUsername = "";
    let botElo = 1200;
    let isGameActive = false;
    let evalDebounce = null;

    if (eloSlider && eloDisplay) {
        eloSlider.addEventListener('input', (e) => {
            eloDisplay.textContent = e.target.value;
        });
    }

    function initPlayEngine() {
        if (!playEngine) {
            playEngine = new Engine((data) => {
                if (!isGameActive) return;

                let displayScore = data.score;
                const turn = playLogic.turn();
                // If it's black's turn to move, engine score needs to be flipped for global absolute evaluation
                if (turn === 'b') displayScore = -displayScore;

                updatePlayEvalUI(displayScore, data.isMate);
            });
        }
    }

    function requestLiveEval() {
        if (!isGameActive) return;
        clearTimeout(evalDebounce);

        // If bot is moving, don't run continuous evals since it uses the same worker
        if (!isPlayerTurn && playLogic.turn() !== playerColor) return;

        // Use a fast depth for continuous evaluations
        evalDebounce = setTimeout(() => {
            playEngine.evaluate(playLogic.fen(), 10);
        }, 100);
    }

    function updatePlayEvalUI(score, isMate) {
        if (!playEvalFill || !playEvalLabel) return;
        let pct = 50;
        if (isMate) {
            pct = score > 0 ? 98 : 2;
        } else {
            pct = 50 + (Math.tanh(score / 4) * 48);
        }

        // If the player is black, flip the bar visually so their side is at bottom
        if (playerColor === 'b') pct = 100 - pct;

        playEvalFill.style.height = pct + '%';
        playEvalLabel.textContent = isMate
            ? (score > 0 ? '+' : '-') + 'M' + Math.abs(score)
            : (score > 0 ? '+' : '') + score.toFixed(1);
    }

    function eloToSkill(elo) {
        if (elo <= 400) return 0;
        if (elo <= 800) return 3;
        if (elo <= 1200) return 6;
        if (elo <= 1600) return 10;
        if (elo <= 2000) return 14;
        if (elo <= 2500) return 18;
        return 20;
    }

    function eloToDepth(elo) {
        if (elo <= 400) return 1;
        if (elo <= 800) return 2;
        if (elo <= 1200) return 4;
        if (elo <= 1600) return 6;
        if (elo <= 2000) return 10;
        if (elo <= 2500) return 14;
        return 20;
    }

    function onDragStart(source, piece, position, orientation) {
        if (!isGameActive) return false;
        if (!isPlayerTurn) return false;
        if (playLogic.game_over()) return false;

        // Only allow picking up player's pieces
        if (piece.charAt(0) !== playerColor) return false;

        // Remove old hints
        removeGreySquares();

        // Get list of possible moves for this square
        const moves = playLogic.moves({
            square: source,
            verbose: true
        });

        if (moves.length === 0) return false;

        // Draw move hints
        for (let i = 0; i < moves.length; i++) {
            greySquare(moves[i].to, moves[i].captured);
        }
    }

    // UI Helpers for move hints
    function removeGreySquares() {
        $('#play-board .square-55d63').find('.move-hint-dot, .move-hint-capture').remove();
    }

    function greySquare(square, isCapture) {
        const squareEl = $('#play-board .square-' + square);

        // Add absolute child to the square
        if (isCapture) {
            squareEl.append('<div class="move-hint-capture"></div>');
        } else {
            squareEl.append('<div class="move-hint-dot"></div>');
        }
    }

    function onDrop(source, target) {
        removeGreySquares();
        if (!isGameActive) return 'snapback';

        // See if the move is legal
        const move = playLogic.move({
            from: source,
            to: target,
            promotion: 'q' // NOTE: always promote to a queen for simplicity
        });

        if (move === null) return 'snapback';

        isPlayerTurn = false;

        renderLiveMoves();
        requestLiveEval();
        updateStatus();

        // Let bot move after a short delay to feel more natural
        if (isGameActive && !playLogic.game_over()) {
            setTimeout(makeBotMove, 800);
        } else {
            checkGameOver();
        }
    }

    function onSnapEnd() {
        playBoard.position(playLogic.fen());
    }

    // Initialize board
    function initPlayBoard() {
        if (!playBoard) {
            playBoard = Chessboard('play-board', {
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                draggable: true,
                position: 'start',
                onDragStart: onDragStart,
                onDrop: onDrop,
                onSnapEnd: onSnapEnd
            });
            $(window).on('resize', () => {
                if (playBoard) playBoard.resize();
            });
        }
    }

    function renderLiveMoves() {
        if (!playMoveBody || !playMovesScroll) return;
        playMoveBody.innerHTML = '';

        // Here we format the move history of `playLogic.history()` 
        const moves = playLogic.history();

        for (let i = 0; i < moves.length; i += 2) {
            const tr = document.createElement('tr');

            // Move number
            const tdNum = document.createElement('td');
            tdNum.textContent = (i / 2 + 1) + '.';
            tr.appendChild(tdNum);

            // White move
            const tdWhite = document.createElement('td');
            tdWhite.className = 'move-cell';
            tdWhite.textContent = moves[i];
            if (i === moves.length - 1) tdWhite.classList.add('active');
            tr.appendChild(tdWhite);

            // Black move
            if (i + 1 < moves.length) {
                const tdBlack = document.createElement('td');
                tdBlack.className = 'move-cell';
                tdBlack.textContent = moves[i + 1];
                if (i + 1 === moves.length - 1) tdBlack.classList.add('active');
                tr.appendChild(tdBlack);
            } else {
                tr.appendChild(document.createElement('td'));
            }

            playMoveBody.appendChild(tr);
        }

        const active = playMoveBody.querySelector('.active');
        if (active) {
            active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
            playMovesScroll.scrollTop = playMovesScroll.scrollHeight;
        }
    }

    function makeBotMove() {
        if (!isGameActive || playLogic.game_over()) return;

        initPlayEngine();
        const skill = eloToSkill(botElo);
        playEngine.setOption('Skill Level', skill);

        statusMsg.textContent = "Cheshire is thinking...";

        // We use evalAsync to get the best move
        const depth = eloToDepth(botElo);
        playEngine.evalAsync(playLogic.fen(), depth).then((data) => {
            if (!isGameActive) return; // if user resigned during think

            if (data && data.bestMove) {
                const moveStr = data.bestMove;
                const from = moveStr.substring(0, 2);
                const to = moveStr.substring(2, 4);
                const promo = moveStr.length > 4 ? moveStr[4] : undefined;

                playLogic.move({
                    from: from,
                    to: to,
                    promotion: promo
                });

                playBoard.position(playLogic.fen());
                isPlayerTurn = true;

                renderLiveMoves();
                requestLiveEval();
                updateStatus();
                checkGameOver();
            }
        });
    }

    function updateStatus() {
        if (!isGameActive) return;

        let status = '';
        let moveColor = (playLogic.turn() === 'w') ? 'White' : 'Black';

        if (playLogic.in_checkmate()) {
            status = `Game over, ${moveColor} is in checkmate.`;
        } else if (playLogic.in_draw()) {
            status = 'Game over, drawn position';
        } else {
            status = (playLogic.turn() === playerColor) ? "Your turn" : "Cheshire is thinking...";
            if (playLogic.in_check()) {
                status += `, ${moveColor} is in check`;
            }
        }
        statusMsg.textContent = status;
    }

    function checkGameOver() {
        if (playLogic.game_over()) {
            isGameActive = false;
            let result = '*';
            if (playLogic.in_checkmate()) {
                result = (playLogic.turn() === playerColor) ? '0-1' : '1-0'; // Player's turn means player was checkmated
            } else if (playLogic.in_draw()) {
                result = '1/2-1/2';
            }
            playLogic.header('Result', result);
            setTimeout(endGameAndReview, 1000);
        }
    }

    function endGameAndReview() {
        isGameActive = false;

        // generate PGN with headers
        const wTeam = playerColor === 'w' ? playerUsername : 'Cheshire';
        const bTeam = playerColor === 'b' ? playerUsername : 'Cheshire';
        const wEloStr = playerColor === 'w' ? '?' : botElo.toString();
        const bEloStr = playerColor === 'b' ? '?' : botElo.toString();

        playLogic.header('White', wTeam);
        playLogic.header('Black', bTeam);
        playLogic.header('WhiteElo', wEloStr);
        playLogic.header('BlackElo', bEloStr);
        playLogic.header('Event', 'Play vs Cheshire');
        playLogic.header('Site', 'Chess Kittens');
        const date = new Date().toISOString().split('T')[0].replace(/-/g, '.');
        playLogic.header('Date', date);

        const pgn = playLogic.pgn();

        // Use app.js exposed showScreen and loadGame
        if (window.appScreens && window.loadGame) {
            // Note: passing false for autoAnalyze so the user clicks Analyze manually
            window.loadGame(pgn, wTeam, bTeam, false);
        }
    }

    startPlayBtn.addEventListener('click', () => {
        botElo = parseInt(eloSlider.value, 10);
        const randomNum = Math.floor(1000 + Math.random() * 9000);
        playerUsername = `Anon#${randomNum}`;

        const cSel = colorSelect.value;
        if (cSel === 'random') {
            playerColor = Math.random() < 0.5 ? 'w' : 'b';
        } else {
            playerColor = cSel === 'white' ? 'w' : 'b';
        }

        if (playerColor === 'w') {
            playBlackName.textContent = `Cheshire (${botElo})`;
            playWhiteName.textContent = playerUsername;
        } else {
            playBlackName.textContent = playerUsername;
            playWhiteName.textContent = `Cheshire (${botElo})`;
        }

        playLogic.reset();
        isPlayerTurn = (playerColor === 'w');
        isGameActive = true;

        // Reset Eval UI
        if (playEvalFill && playEvalLabel) {
            playEvalFill.style.height = '50%';
            playEvalLabel.textContent = '0.0';
        }

        renderLiveMoves();

        initPlayBoard();
        initPlayEngine(); // <== We must initialize the engine so we can run evals
        playBoard.position('start');
        playBoard.orientation(playerColor === 'w' ? 'white' : 'black');

        if (window.appScreens) {
            window.appScreens.show(playScreen);
            setTimeout(() => { if (playBoard) playBoard.resize(); }, 120);
        }

        updateStatus();
        requestLiveEval();

        // If bot is white, it must move first
        if (!isPlayerTurn) {
            setTimeout(makeBotMove, 600);
        }
    });

    playBackBtn.addEventListener('click', () => {
        if (isGameActive && !playLogic.game_over()) {
            if (confirm("Are you sure you want to resign and exit? You will lose the game.")) {
                playLogic.header('Result', (playerColor === 'w') ? '0-1' : '1-0'); // Player resigns, so bot wins
                endGameAndReview();
            }
        } else {
            if (window.appScreens) {
                window.appScreens.show(window.appScreens.landing);
            }
        }
    });


    resignBtn.addEventListener('click', () => {
        if (isGameActive && !playLogic.game_over()) {
            if (confirm("Are you sure you want to resign? You will lose the game.")) {
                playLogic.header('Result', (playerColor === 'w') ? '0-1' : '1-0'); // Player resigns, so bot wins
                endGameAndReview();
            }
        }
    });

})();
