const Worker = require('worker_threads').Worker;
const path = require('path');
const fs = require('fs');

const stockfishSrc = fs.readFileSync(path.join(__dirname, 'js/stockfish.js'), 'utf8');

const workerSrc = `
  ${stockfishSrc}
  const stockfish = new WebAssembly.Memory({ initial: 32 }); // Mock simply to start
  Stockfish().then((engine) => {
    engine.addMessageListener((msg) => {
      require('worker_threads').parentPort.postMessage(msg);
    });
    require('worker_threads').parentPort.on('message', (msg) => {
      engine.postMessage(msg);
    });
  });
`;

// It's going to be tricky to run Stockfish in Node without a proper harness.
// Instead, let's just create a test HTML file and log to browser console, then I'll look at the console.
