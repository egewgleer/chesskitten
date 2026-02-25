/**
 * App — main controller.
 * Handles UI, board, engine, API, full-game analysis, SVG overlays, and move classifications.
 */
(function () {
    'use strict';

    // ── Random Wallpaper (Auto-detects additions) ──
    // Uses a quick fetch to parse http-server's directory index, finding any .jpg/.png
    async function setRandomWallpaper() {
        let wps = ['wallpapers/bg1.jpg', 'wallpapers/bg2.jpg', 'wallpapers/bg3.jpg']; // Fallbacks
        try {
            const res = await fetch('wallpapers/');
            if (res.ok) {
                const text = await res.text();
                const matches = text.match(/href="([^"]+\.(?:jpg|jpeg|png|webp|gif))"/gi);
                if (matches) {
                    const parsed = matches.map(m => {
                        const file = m.split('"')[1].split('/').pop();
                        return `wallpapers/${file}`;
                    });
                    wps = [...new Set(parsed)];
                }
            }
        } catch (e) {
            console.warn('Could not auto-detect wallpapers, using defaults.');
        }

        const randomBg = wps[Math.floor(Math.random() * wps.length)];
        document.documentElement.style.setProperty('--bg-image', `url('${randomBg}')`);
    }
    setRandomWallpaper();

    // ── Classification colors ──
    const CLASS_COLORS = {
        brilliant: '#1baaa7',
        great: '#5c8bb0',
        best: '#96bc4b',
        good: '#96bc4b',
        book: '#a88764',
        inaccuracy: '#e6a835',
        mistake: '#e68a35',
        blunder: '#ca3431',
    };

    const CLASS_ICONS = {
        brilliant: 'brilliance_v2/128x/brilliant_128x.png',
        great: 'brilliance_v2/128x/great_find_128x.png',
        best: 'brilliance_v2/128x/best_128x.png',
        good: 'brilliance_v2/128x/good_128x.png',
        book: 'brilliance_v2/128x/book_128x.png',
        inaccuracy: 'brilliance_v2/128x/inaccuracy_128x.png',
        mistake: 'brilliance_v2/128x/mistake_128x.png',
        blunder: 'brilliance_v2/128x/blunder_128x.png',
    };

    // ── Screens ──
    const landingScreen = document.getElementById('landing-screen');
    const analysisScreen = document.getElementById('analysis-screen');

    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
        screen.classList.add('active');
        if (screen === analysisScreen && board) {
            setTimeout(() => { board.resize(); setupOverlay(); }, 80);
        }
    }

    // ── Instances ──
    const logic = new ChessLogic();
    const api = new ChessAPI();

    // ── Board ──
    let board = null;
    let isFlipped = false;

    function initBoard() {
        board = Chessboard('board', {
            pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
            position: 'start',
            showNotation: true,
            draggable: false,
            appearSpeed: 150,
            moveSpeed: 150
        });
        $(window).on('resize', () => {
            if (board) { board.resize(); setupOverlay(); }
        });
    }

    // ═══════════════════════════════════
    //  SVG OVERLAY SYSTEM
    // ═══════════════════════════════════
    let svgOverlay = null;

    function setupOverlay() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;

        // Remove old overlay
        const old = boardEl.querySelector('.board-overlay');
        if (old) old.remove();

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'board-overlay');
        svg.setAttribute('viewBox', '0 0 800 800');
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10;';

        boardEl.style.position = 'relative';
        boardEl.appendChild(svg);
        svgOverlay = svg;
    }

    function clearOverlay() {
        if (svgOverlay) svgOverlay.innerHTML = '';
    }

    /** Convert algebraic square to SVG coordinates (800x800 viewBox) */
    function squareToCoords(sq) {
        const file = sq.charCodeAt(0) - 97;
        const rank = parseInt(sq[1]) - 1;
        let x, y;
        if (isFlipped) {
            x = (7 - file) * 100 + 50;
            y = rank * 100 + 50;
        } else {
            x = file * 100 + 50;
            y = (7 - rank) * 100 + 50;
        }
        return { x, y };
    }

    /** Highlight a square by directly styling the chessboard.js square element */
    function drawSquareHighlight(sq, color, opacity) {
        opacity = opacity || 0.42;
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        const squareEl = boardEl.querySelector('[data-square="' + sq + '"]');
        if (squareEl) {
            squareEl.style.boxShadow = 'inset 0 0 0 100px ' + color + Math.round(opacity * 255).toString(16).padStart(2, '0');
        }
    }

    /** Remove all square highlights and board icons */
    function clearSquareHighlights() {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        boardEl.querySelectorAll('[data-square]').forEach(el => {
            el.style.boxShadow = '';
        });
        // Remove any classification icons
        boardEl.querySelectorAll('.board-cls-icon').forEach(el => el.remove());
    }

    /** Place a classification icon at the top-right corner of a square (like chess.com) */
    function placeIconOnSquare(sq, iconSrc) {
        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        const squareEl = boardEl.querySelector('[data-square="' + sq + '"]');
        if (!squareEl) return;

        // Make square position relative for absolute child
        squareEl.style.position = 'relative';
        squareEl.style.overflow = 'visible';

        const img = document.createElement('img');
        img.className = 'board-cls-icon';
        img.src = iconSrc;
        img.style.cssText = `
            position: absolute;
            top: -8px; right: -8px;
            width: 26px; height: 26px;
            z-index: 20;
            pointer-events: none;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5));
        `;
        squareEl.appendChild(img);
    }

    /** Draw a chess.com-style arrow (thick, rounded, solid green) */
    function drawArrow(fromSq, toSq, color, opacity) {
        if (!svgOverlay || !fromSq || !toSq) return;
        opacity = opacity || 0.8;

        const boardEl = document.getElementById('board');
        if (!boardEl) return;
        const fromEl = boardEl.querySelector('[data-square="' + fromSq + '"]');
        const toEl = boardEl.querySelector('[data-square="' + toSq + '"]');
        if (!fromEl || !toEl) return;

        const boardRect = boardEl.getBoundingClientRect();
        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const svgW = 800;
        const scaleX = svgW / boardRect.width;
        const scaleY = svgW / boardRect.height;

        const fx = (fromRect.left - boardRect.left + fromRect.width / 2) * scaleX;
        const fy = (fromRect.top - boardRect.top + fromRect.height / 2) * scaleY;
        const tx = (toRect.left - boardRect.left + toRect.width / 2) * scaleX;
        const ty = (toRect.top - boardRect.top + toRect.height / 2) * scaleY;

        const dx = tx - fx;
        const dy = ty - fy;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;

        const ux = dx / len;
        const uy = dy / len;
        // Perpendicular
        const px = -uy;
        const py = ux;

        // Arrow shaft width and head size
        const sw = 12;  // shaft half-width
        const headW = 30; // arrowhead half-width
        const headL = 35; // arrowhead length

        // Points along the shaft
        const shaftEnd = len - headL;

        // Build path: shaft rectangle + triangular head
        const points = [
            // Start left side of shaft
            fx + px * sw, fy + py * sw,
            // End left side of shaft (where head begins)
            fx + ux * shaftEnd + px * sw, fy + uy * shaftEnd + py * sw,
            // Left wing of arrowhead
            fx + ux * shaftEnd + px * headW, fy + uy * shaftEnd + py * headW,
            // Tip
            tx, ty,
            // Right wing of arrowhead
            fx + ux * shaftEnd - px * headW, fy + uy * shaftEnd - py * headW,
            // End right side of shaft
            fx + ux * shaftEnd - px * sw, fy + uy * shaftEnd - py * sw,
            // Start right side of shaft
            fx - px * sw, fy - py * sw,
        ];

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('opacity', String(opacity));

        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        let pointsStr = '';
        for (let i = 0; i < points.length; i += 2) {
            pointsStr += points[i].toFixed(1) + ',' + points[i + 1].toFixed(1) + ' ';
        }
        polygon.setAttribute('points', pointsStr.trim());
        polygon.setAttribute('fill', color);
        g.appendChild(polygon);
        svgOverlay.appendChild(g);
    }

    /** Render board overlays for current position */
    function renderOverlays() {
        clearSquareHighlights();
        clearOverlay();
        setupOverlay();
        if (logic.idx === 0) return;

        const cls = logic.currentClassification();
        const sq = logic.currentMoveSquares();

        // 1. Colored square highlights for the played move
        if (sq && cls) {
            const clr = CLASS_COLORS[cls.key] || '#f7ec59';
            drawSquareHighlight(sq.from, clr, 0.45);
            drawSquareHighlight(sq.to, clr, 0.45);
        } else if (sq) {
            drawSquareHighlight(sq.from, '#f7ec59', 0.3);
            drawSquareHighlight(sq.to, '#f7ec59', 0.3);
        }

        // 2. Classification icon on the destination square (chess.com style)
        if (sq && cls && CLASS_ICONS[cls.key]) {
            placeIconOnSquare(sq.to, CLASS_ICONS[cls.key]);
        }

        // 3. Engine best-move arrow (only for suboptimal moves — skip brilliant/great)
        const skipArrow = cls && ['brilliant', 'great'].includes(cls.key);
        if (cls && cls.engineBest && !skipArrow) {
            const bf = cls.engineBest.substring(0, 2);
            const bt = cls.engineBest.substring(2, 4);
            if (/^[a-h][1-8]$/.test(bf) && /^[a-h][1-8]$/.test(bt)) {
                drawArrow(bf, bt, '#96bc4b', 0.8);
            }
        }
    }

    // ═══════════════════════════════════
    //  ENGINE (live eval)
    // ═══════════════════════════════════
    let evalDebounce = null;
    let isAnalyzing = false;

    const engine = new Engine(function onEval(data) {
        if (isAnalyzing) return; // suppress live updates during batch analysis

        let displayScore = data.score;
        const turn = logic.turn();
        if (turn === 'b') displayScore = -displayScore;

        updateEvalUI(displayScore, data.isMate);

        document.getElementById('engine-depth').textContent = data.depth;
        document.getElementById('engine-eval').textContent =
            data.isMate ? (displayScore > 0 ? '+' : '') + 'M' + Math.abs(data.score)
                : (displayScore > 0 ? '+' : '') + displayScore.toFixed(1);
        document.getElementById('engine-best').textContent = data.bestMove;

        if (data.depth >= 12) {
            document.getElementById('engine-spinner').classList.remove('active');
        }
    });

    function requestEval() {
        if (isAnalyzing) return;
        clearTimeout(evalDebounce);
        document.getElementById('engine-spinner').classList.add('active');
        document.getElementById('engine-depth').textContent = '…';
        document.getElementById('engine-eval').textContent = '…';
        document.getElementById('engine-best').textContent = '…';

        evalDebounce = setTimeout(() => {
            engine.evaluate(logic.fen(), 14);
        }, 200);
    }

    function updateEvalUI(score, isMate) {
        const fill = document.getElementById('eval-fill');
        const label = document.getElementById('eval-label');
        let pct = 50;
        if (isMate) {
            pct = score > 0 ? 98 : 2;
        } else {
            pct = 50 + (Math.tanh(score / 4) * 48);
        }
        fill.style.height = pct + '%';
        label.textContent = isMate
            ? (score > 0 ? '+' : '-') + 'M' + Math.abs(score)
            : (score > 0 ? '+' : '') + score.toFixed(1);
    }

    // ═══════════════════════════════════
    //  FULL GAME ANALYSIS
    // ═══════════════════════════════════
    async function runFullAnalysis() {
        if (isAnalyzing) return;
        isAnalyzing = true;

        const progressBar = document.getElementById('analysis-progress');
        const progressFill = document.getElementById('analysis-progress-fill');
        const progressText = document.getElementById('analysis-progress-text');
        if (progressBar) progressBar.style.display = 'block';

        try {
            const depthSelect = document.getElementById('engine-depth-select');
            const targetDepth = depthSelect ? parseInt(depthSelect.value, 10) : 14;

            // Generate a unique cache key based on the exact move sequence and requested depth
            // We include "v1" in case we want to safely bust the cache in future updates.
            const movesStr = logic.sans.join('|');
            const cacheKey = `chess_analysis_v1_${targetDepth}_${movesStr}`;

            const cachedData = localStorage.getItem(cacheKey);

            if (cachedData) {
                if (progressText) progressText.textContent = 'Loading cached analysis...';
                logic.classifications = JSON.parse(cachedData);
            } else {
                const classifications = await analyzeFullGame(engine, logic, targetDepth, (i, total) => {
                    const pct = Math.round((i / total) * 100);
                    if (progressFill) progressFill.style.width = pct + '%';
                    if (progressText) progressText.textContent = `Analyzing… ${i}/${total} half-moves`;
                });

                logic.classifications = classifications;

                // Save to cache so we don't have to analyze this exact game at this depth again
                try {
                    localStorage.setItem(cacheKey, JSON.stringify(classifications));
                } catch (storeErr) {
                    console.warn('Failed to save analysis to localStorage (might be full):', storeErr);
                }
            }

            renderMoves();
            renderOverlays();
            renderSummary();

            if (progressText) progressText.textContent = 'Analysis complete ✓';
            setTimeout(() => { if (progressBar) progressBar.style.display = 'none'; }, 2000);
        } catch (e) {
            console.error('Analysis error:', e);
            if (progressText) progressText.textContent = 'Analysis failed';
        } finally {
            isAnalyzing = false;
            requestEval();
        }
    }
    // ═══════════════════════════════════
    //  GAME SUMMARY
    // ═══════════════════════════════════
    function renderSummary() {
        const panel = document.getElementById('summary-panel');
        if (!panel || logic.classifications.length === 0) return;

        const cats = ['brilliant', 'great', 'best', 'inaccuracy', 'mistake', 'blunder'];
        const catLabels = {
            brilliant: '!!  Brilliant',
            great: '!  Great',
            best: '★  Best',
            inaccuracy: '?!  Inaccuracy',
            mistake: '?  Mistake',
            blunder: '??  Blunder'
        };

        // Count per side
        const white = {}, black = {};
        let wLoss = 0, bLoss = 0, wCount = 0, bCount = 0;
        cats.forEach(c => { white[c] = 0; black[c] = 0; });

        logic.classifications.forEach((cls, i) => {
            const isWhite = (i % 2 === 0);
            const bucket = isWhite ? white : black;
            // Map 'good' and 'book' into nearby categories
            const key = (cls.key === 'good') ? 'best' : (cls.key === 'book') ? 'best' : cls.key;
            if (bucket[key] !== undefined) bucket[key]++;

            // Count engine-aligned moves for accuracy
            const aligned = ['brilliant', 'great', 'best', 'good', 'book'].includes(cls.key);
            if (isWhite) { wCount++; if (aligned) wLoss++; }
            else { bCount++; if (aligned) bLoss++; }
        });

        // Accuracy = % of moves that matched the engine
        const wAcc = wCount > 0 ? (wLoss / wCount * 100).toFixed(1) : '—';
        const bAcc = bCount > 0 ? (bLoss / bCount * 100).toFixed(1) : '—';

        document.getElementById('summary-white-name').textContent =
            document.getElementById('white-name').textContent;
        document.getElementById('summary-black-name').textContent =
            document.getElementById('black-name').textContent;
        document.getElementById('summary-white-acc').textContent = wAcc;
        document.getElementById('summary-black-acc').textContent = bAcc;

        // Display Overall Opening Name
        const opening = logic.getGameOpening();
        const openingDiv = document.getElementById('summary-opening-name');
        if (openingDiv) {
            openingDiv.textContent = opening ? `Opening: ${opening.name.charAt(0).toUpperCase() + opening.name.slice(1)}` : '';
        }

        // Build rows
        const rowsEl = document.getElementById('summary-rows');
        rowsEl.innerHTML = '';
        cats.forEach(cat => {
            const row = document.createElement('div');
            row.className = 'summary-row';
            row.innerHTML = `
                <span class="sr-count">${white[cat]}</span>
                <span class="sr-label" style="color:${CLASS_COLORS[cat]}">
                    <span class="sr-dot" style="background:${CLASS_COLORS[cat]}"></span>
                    ${catLabels[cat]}
                </span>
                <span class="sr-count">${black[cat]}</span>
            `;
            rowsEl.appendChild(row);
        });

        panel.style.display = 'block';
    }

    // ═══════════════════════════════════
    //  MOVE HISTORY
    // ═══════════════════════════════════
    function renderMoves() {
        const body = document.getElementById('move-body');
        body.innerHTML = '';
        const moves = logic.moves();

        for (let i = 0; i < moves.length; i += 2) {
            const tr = document.createElement('tr');

            // Move number
            const tdNum = document.createElement('td');
            tdNum.textContent = (i / 2 + 1) + '.';
            tr.appendChild(tdNum);

            // White move
            appendMoveCell(tr, moves[i], i, i + 1);

            // Black move
            if (i + 1 < moves.length) {
                appendMoveCell(tr, moves[i + 1], i + 1, i + 2);
            } else {
                tr.appendChild(document.createElement('td'));
            }

            body.appendChild(tr);
        }

        const active = body.querySelector('.active');
        if (active) active.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function appendMoveCell(tr, san, moveIdx, fenIdx) {
        const td = document.createElement('td');
        td.className = 'move-cell';

        const cls = logic.getMoveClassification(moveIdx);

        // Classification badge (chess.com icon)
        if (cls && CLASS_ICONS[cls.key]) {
            const badge = document.createElement('img');
            badge.className = 'move-badge';
            badge.src = CLASS_ICONS[cls.key];
            badge.alt = cls.key;
            badge.title = cls.key.charAt(0).toUpperCase() + cls.key.slice(1);
            td.appendChild(badge);
        }

        const text = document.createSpan ? document.createSpan() : document.createElement('span');
        text.textContent = san;
        td.appendChild(text);

        // Left-border color
        if (cls) {
            td.style.borderLeftColor = CLASS_COLORS[cls.key];
        }

        td.onclick = () => goToIndex(fenIdx);
        if (logic.idx === fenIdx) td.classList.add('active');

        tr.appendChild(td);
    }

    // ═══════════════════════════════════
    //  NAVIGATION
    // ═══════════════════════════════════
    function goToIndex(i) {
        logic.goTo(i);
        refresh();
    }

    function renderExplanation() {
        const expPanel = document.getElementById('explanation-panel');
        const expText = document.getElementById('explanation-text');
        const mascotImg = document.getElementById('reviewer-mascot-img');
        if (!expPanel || !expText) return;

        const cls = logic.currentClassification();
        if (cls && logic.idx > 0) {
            const moveSan = logic.sans[logic.idx - 1];
            const exp = ExplanationGenerator.generateExplanation(moveSan, cls);
            if (exp) {
                expText.innerHTML = exp;
                expPanel.style.display = 'flex';

                if (mascotImg) {
                    if (['inaccuracy', 'mistake', 'blunder'].includes(cls.key)) {
                        mascotImg.src = 'angry_cheshire.png';
                    } else {
                        mascotImg.src = 'cheshire.png';
                    }
                }
                return;
            }
        }
        expPanel.style.display = 'none';
    }

    function refresh() {
        board.position(logic.fen(), true);
        renderMoves();
        renderOverlays();
        renderExplanation();
        requestEval();
    }

    // Expose screens for other modules
    window.appScreens = {
        landing: landingScreen,
        analysis: analysisScreen,
        show: showScreen
    };

    // ── Load a game ──
    const btnRunAnalysis = document.getElementById('btn-run-analysis');
    if (btnRunAnalysis) {
        btnRunAnalysis.addEventListener('click', () => {
            btnRunAnalysis.style.display = 'none';
            runFullAnalysis();
        });
    }

    function loadGame(pgn, whiteName, blackName, autoAnalyze = true) {
        if (!logic.loadPGN(pgn)) {
            alert('Could not parse PGN. Make sure it is valid.');
            return;
        }
        // Clear previous game's summary
        const summaryPanel = document.getElementById('summary-panel');
        if (summaryPanel) summaryPanel.style.display = 'none';
        logic.classifications = [];

        // Parse ELO from PGN if available, unless playing against Cheshire
        let wElo = '', bElo = '';
        if (whiteName !== 'Cheshire' && blackName !== 'Cheshire') {
            const wMatch = pgn.match(/\[WhiteElo "(.*?)"\]/);
            const bMatch = pgn.match(/\[BlackElo "(.*?)"\]/);
            if (wMatch && wMatch[1] && wMatch[1] !== '?') wElo = ` (${wMatch[1]})`;
            if (bMatch && bMatch[1] && bMatch[1] !== '?') bElo = ` (${bMatch[1]})`;
        }

        document.getElementById('white-name').textContent = (whiteName || 'White') + wElo;
        document.getElementById('black-name').textContent = (blackName || 'Black') + bElo;
        showScreen(analysisScreen);
        refresh();

        // Show / hide the manual analyze button
        if (btnRunAnalysis) {
            btnRunAnalysis.style.display = autoAnalyze ? 'none' : 'flex';
        }

        // Start full analysis automatically if requested
        if (autoAnalyze) {
            setTimeout(() => runFullAnalysis(), 500);
        } else {
            setTimeout(() => { requestEval(); }, 500);
        }
    }

    // Expose loadGame for play mode
    window.loadGame = loadGame;

    // ── Tab switching ──
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // ── Paste PGN ──
    document.getElementById('analyze-pgn-btn').addEventListener('click', () => {
        const pgn = document.getElementById('pgn-input').value.trim();
        if (!pgn) return alert('Please paste a PGN first.');
        loadGame(pgn, 'White', 'Black');
    });

    // ── Fetch Games ──
    const fetchBtn = document.getElementById('fetch-btn');
    const gamesList = document.getElementById('games-list');
    const platformSelect = document.getElementById('platform-select');

    let loadedGames = [];
    let displayedCount = 0;
    let currentUsername = '';

    function renderGamesListBatch() {
        const batch = loadedGames.slice(displayedCount, displayedCount + 8);
        if (batch.length === 0) return;

        batch.forEach(g => {
            const w = g.white?.username || '?';
            const b = g.black?.username || '?';
            const wResult = g.white?.result || '';
            const bResult = g.black?.result || '';
            const tc = g.time_class || '';
            const date = g.end_time ? new Date(g.end_time * 1000).toLocaleDateString() : '';

            const uLower = currentUsername.toLowerCase();
            const isWhite = w.toLowerCase() === uLower;
            const userResult = isWhite ? wResult : bResult;
            const drawResults = ['agreed', 'stalemate', 'repetition', 'insufficient', '50move', 'timevsinsufficient'];

            let resultClass, resultText;
            if (userResult === 'win') {
                resultClass = 'win'; resultText = 'Win';
            } else if (drawResults.includes(userResult) || drawResults.includes(wResult)) {
                resultClass = 'draw'; resultText = 'Draw';
            } else {
                resultClass = 'loss'; resultText = 'Loss';
            }

            const card = document.createElement('div');
            card.className = 'game-card';
            card.innerHTML = `
                <div class="gc-players">${w} vs ${b}</div>
                <div class="gc-meta">${tc} · ${date} · <span class="gc-result ${resultClass}">${resultText}</span></div>
            `;
            card.addEventListener('click', () => loadGame(g.pgn, w, b));
            gamesList.appendChild(card);
        });

        displayedCount += batch.length;

        // "Load More" button management
        const existingBtn = document.getElementById('load-more-btn');
        if (existingBtn) existingBtn.remove(); // Remove existing to put at bottom

        if (displayedCount < loadedGames.length) {
            const moreBtn = document.createElement('button');
            moreBtn.id = 'load-more-btn';
            moreBtn.className = 'btn-primary';
            moreBtn.style.marginTop = '8px';
            moreBtn.style.padding = '6px';
            moreBtn.textContent = 'Load More';
            moreBtn.onclick = renderGamesListBatch;
            gamesList.appendChild(moreBtn);
        }
    }

    fetchBtn.addEventListener('click', async () => {
        const username = document.getElementById('username-input').value.trim();
        if (!username) return;

        fetchBtn.disabled = true;
        fetchBtn.textContent = '…';
        gamesList.innerHTML = '<p class="muted-text">Loading…</p>';

        try {
            const platform = platformSelect.value;
            let games = [];

            if (platform === 'lichess') {
                games = await api.fetchLichess(username);
            } else {
                games = await api.fetchRecent(username);
            }

            if (games.length === 0) {
                gamesList.innerHTML = '<p class="muted-text">No recent games found.</p>';
                return;
            }
            gamesList.innerHTML = '';

            // Store fetch results for pagination
            loadedGames = games;
            displayedCount = 0;
            currentUsername = username;

            renderGamesListBatch();

        } catch (e) {
            gamesList.innerHTML = `<p class="muted-text" style="color:var(--red)">Error: ${e.message}</p>`;
        } finally {
            fetchBtn.disabled = false;
            fetchBtn.textContent = 'Fetch';
        }
    });

    // ── Nav buttons ──
    document.getElementById('btn-start').addEventListener('click', () => { logic.goStart(); refresh(); });
    document.getElementById('btn-prev').addEventListener('click', () => { logic.goPrev(); refresh(); });
    document.getElementById('btn-next').addEventListener('click', () => { logic.goNext(); refresh(); });
    document.getElementById('btn-end').addEventListener('click', () => { logic.goEnd(); refresh(); });
    document.getElementById('btn-flip').addEventListener('click', () => {
        board.flip();
        isFlipped = !isFlipped;
        // Swap player name bars
        const topName = document.getElementById('black-name');
        const botName = document.getElementById('white-name');
        const tmp = topName.textContent;
        topName.textContent = botName.textContent;
        botName.textContent = tmp;
        renderOverlays();
    });
    document.getElementById('btn-back').addEventListener('click', () => {
        clearOverlay();
        showScreen(landingScreen);
    });

    // ── Keyboard nav ──
    document.addEventListener('keydown', e => {
        if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
        if (e.key === 'ArrowLeft') { logic.goPrev(); refresh(); }
        if (e.key === 'ArrowRight') { logic.goNext(); refresh(); }
        if (e.key === 'Home') { logic.goStart(); refresh(); }
        if (e.key === 'End') { logic.goEnd(); refresh(); }
    });

    // ── Settings ──
    const depthSelect = document.getElementById('engine-depth-select');
    if (depthSelect) {
        depthSelect.addEventListener('change', () => {
            if (logic.fens.length > 1 && !isAnalyzing) {
                runFullAnalysis();
            }
        });
    }

    // ── Init ──
    initBoard();
})();
