/**
 * Stockfish Engine Web Worker wrapper.
 * Supports both live evaluation and batch position analysis.
 */
class Engine {
    constructor(onUpdate) {
        this.onUpdate = onUpdate;
        this.ready = false;
        this.worker = null;
        this._currentBestMove = null;
        this._currentPv = null;
        this._currentScore = null;
        this._currentDepth = 0;
        this._currentIsMate = false;
        this._resolveEval = null;   // for promise-based batch eval
        this._targetDepth = 14;
        this._init();
    }

    _init() {
        try {
            this.worker = new Worker('js/stockfish-worker.js');
            this.worker.addEventListener('message', (e) => this._onMessage(e.data));
            this.worker.addEventListener('error', (err) => {
                console.error('Stockfish worker error:', err.message || err);
            });
            setTimeout(() => {
                if (this.worker) this.worker.postMessage('uci');
            }, 500);
        } catch (err) {
            console.error('Could not create Stockfish worker:', err);
        }
    }

    _onMessage(line) {
        if (typeof line !== 'string') return;

        if (line === 'uciok') {
            this.worker.postMessage('isready');
        }

        if (line === 'readyok') {
            this.ready = true;
            console.log('Stockfish engine ready.');
        }

        if (line.startsWith('info') && line.includes(' score ')) {
            const depthMatch = line.match(/\bdepth\s+(\d+)/);
            const cpMatch = line.match(/\bscore\s+cp\s+(-?\d+)/);
            const mateMatch = line.match(/\bscore\s+mate\s+(-?\d+)/);
            const pvMatch = line.match(/\bpv\s+(.*)$/);

            if (!depthMatch) return;
            const depth = parseInt(depthMatch[1]);

            let score = 0;
            let isMate = false;

            if (cpMatch) {
                score = parseInt(cpMatch[1]) / 100;
            } else if (mateMatch) {
                score = parseInt(mateMatch[1]);
                isMate = true;
            } else {
                return;
            }

            const pv = pvMatch ? pvMatch[1].trim() : null;
            const bestMove = pv ? pv.split(' ')[0] : null;

            this._currentDepth = depth;
            this._currentScore = score;
            this._currentIsMate = isMate;
            if (bestMove) this._currentBestMove = bestMove;
            if (pv) this._currentPv = pv;

            // Live callback
            if (this.onUpdate) {
                this.onUpdate({ depth, score, isMate, bestMove: bestMove || '—', pv: pv || '' });
            }
        }

        // "bestmove" signals the engine finished searching
        if (line.startsWith('bestmove')) {
            const bm = line.split(' ')[1];
            if (bm && bm !== '(none)') this._currentBestMove = bm;

            // ONLY resolve the promise if this bestmove was triggered by evalAsync
            // We use a flag to track if we're in an async search vs continuous eval
            if (this._isAsyncSearch && this._resolveEval) {
                const resolve = this._resolveEval;
                this._resolveEval = null;
                this._isAsyncSearch = false;
                if (this._evalTimeout) { clearTimeout(this._evalTimeout); this._evalTimeout = null; }
                resolve({
                    depth: this._currentDepth,
                    score: this._currentScore,
                    isMate: this._currentIsMate,
                    bestMove: this._currentBestMove,
                    pv: this._currentPv
                });
            }
        }
    }

    /** Live evaluation (fire and forget, results via onUpdate callback) */
    evaluate(fen, depth = 14) {
        if (!this.worker) return;
        if (!this.ready) {
            const self = this;
            const check = setInterval(() => {
                if (self.ready) { clearInterval(check); self._doEval(fen, depth); }
            }, 200);
            return;
        }
        this._doEval(fen, depth);
    }

    _doEval(fen, depth) {
        this.worker.postMessage('stop');
        this.worker.postMessage('position fen ' + fen);
        this.worker.postMessage('go depth ' + depth);
    }

    evalAsync(fen, depth = 12) {
        return new Promise((resolve) => {
            const waitReady = () => {
                this._isAsyncSearch = true; // Mark this as a blocking search
                this._resolveEval = resolve;
                this._currentBestMove = null;
                this._currentScore = 0;
                this._currentIsMate = false;
                this._currentDepth = 0;

                // Safety timeout — resolve with whatever we have after 10s
                this._evalTimeout = setTimeout(() => {
                    if (this._resolveEval) {
                        const r = this._resolveEval;
                        this._resolveEval = null;
                        this._isAsyncSearch = false;
                        this.worker.postMessage('stop');
                        r({
                            depth: this._currentDepth,
                            score: this._currentScore,
                            isMate: this._currentIsMate,
                            bestMove: this._currentBestMove,
                            pv: this._currentPv
                        });
                    }
                }, 10000);

                this.worker.postMessage('stop');
                this.worker.postMessage('position fen ' + fen);
                this.worker.postMessage('go depth ' + depth);
            };

            if (!this.ready) {
                const check = setInterval(() => {
                    if (this.ready) { clearInterval(check); waitReady(); }
                }, 200);
            } else {
                waitReady();
            }
        });
    }

    stop() {
        if (this.worker) this.worker.postMessage('stop');
    }

    setOption(name, value) {
        if (this.worker) this.worker.postMessage(`setoption name ${name} value ${value}`);
    }
}
