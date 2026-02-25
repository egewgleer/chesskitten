/**
 * ChessAPI — fetch recent games from the free Chess.com public API.
 */
class ChessAPI {
    /**
     * Returns an array of game objects from the player's most recent month.
     */
    async fetchRecent(username) {
        username = username.trim().toLowerCase();
        if (!username) throw new Error('Empty username');

        // 1. Find available archives (no-store to prevent browser caching stale lists)
        const archRes = await fetch(`https://api.chess.com/pub/player/${username}/games/archives`, { cache: 'no-store' });
        if (!archRes.ok) throw new Error('Player not found');
        const { archives } = await archRes.json();
        if (!archives || archives.length === 0) return [];

        // 2. Fetch latest month (no-store so users actually see today's games)
        const gamesRes = await fetch(archives[archives.length - 1], { cache: 'no-store' });
        if (!gamesRes.ok) throw new Error('Failed to load games');
        const { games } = await gamesRes.json();
        const results = games || [];
        return results.sort((a, b) => b.end_time - a.end_time);
    }

    /**
     * Returns an array of recent game objects from Lichess.
     */
    async fetchLichess(username) {
        username = username.trim().toLowerCase();
        if (!username) throw new Error('Empty username');

        // Fetch last 50 games from Lichess API (NDJSON format)
        const res = await fetch(`https://lichess.org/api/games/user/${username}?max=50&pgnInJson=true&clocks=false&evals=false`, {
            headers: { 'Accept': 'application/x-ndjson' }
        });

        if (!res.ok) throw new Error('Lichess player not found or no games available');

        const text = await res.text();
        const games = [];

        // NDJSON is newline-delimited JSON
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        for (const line of lines) {
            try {
                const g = JSON.parse(line);
                // Map Lichess format to match our expected Chess.com-like format
                games.push({
                    pgn: g.pgn,
                    time_class: g.speed,
                    end_time: g.createdAt / 1000,
                    white: {
                        username: g.players.white.user ? g.players.white.user.name : 'Anonymous',
                        result: g.winner === 'white' ? 'win' : (g.status === 'draw' || g.status === 'stalemate' ? 'agreed' : 'loss')
                    },
                    black: {
                        username: g.players.black.user ? g.players.black.user.name : 'Anonymous',
                        result: g.winner === 'black' ? 'win' : (g.status === 'draw' || g.status === 'stalemate' ? 'agreed' : 'loss')
                    }
                });
            } catch (e) {
                console.error('Error parsing Lichess game row', e);
            }
        }
        return games.sort((a, b) => b.end_time - a.end_time);
    }
}
