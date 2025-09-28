import React, { useEffect, useRef, useState } from 'react';

function App() {
  const [randomNumber, setRandomNumber] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [money, setMoney] = useState(5000);
  const [currentToken, setCurrentToken] = useState(100);
  const [bets, setBets] = useState({}); // { 'number': { amount: number, token: number } }
  const [winModal, setWinModal] = useState({ open: false, amount: 0, bets: [] });
  const [lossModal, setLossModal] = useState({ open: false, amount: 0 });
  const [history, setHistory] = useState([]); // queue of last 10 results
  const [showHistory, setShowHistory] = useState(false);
  const [muted, setMuted] = useState(false);
  const [winSoundReady, setWinSoundReady] = useState(false);
  const [lossSoundReady, setLossSoundReady] = useState(false);

  // Audio refs for win/loss sounds
  const winAudioRef = useRef(null);
  const lossAudioRef = useRef(null);

  // Initialize audio objects once and configure
  useEffect(() => {
    let disposed = false;

    const setup = async () => {
      try {
        const [winOk, lossOk] = await Promise.all([
          fetch('/sounds/win.mp3', { method: 'HEAD' }).then(r => r.ok).catch(() => false),
          fetch('/sounds/loss.mp3', { method: 'HEAD' }).then(r => r.ok).catch(() => false)
        ]);
        if (disposed) return;

        // Set up WIN audio if present
        if (winOk) {
          const winAudio = new Audio('/sounds/win.mp3');
          winAudio.preload = 'auto';
          winAudio.volume = 0.7;
          const onWinReady = () => setWinSoundReady(true);
          const onWinError = () => setWinSoundReady(false);
          winAudio.addEventListener('canplaythrough', onWinReady, { once: true });
          winAudio.addEventListener('error', onWinError);
          winAudioRef.current = winAudio;
        } else {
          setWinSoundReady(false);
          winAudioRef.current = null;
        }

        // Set up LOSS audio if present
        if (lossOk) {
          const lossAudio = new Audio('/sounds/loss.mp3');
          lossAudio.preload = 'auto';
          lossAudio.volume = 0.6;
          const onLossReady = () => setLossSoundReady(true);
          const onLossError = () => setLossSoundReady(false);
          lossAudio.addEventListener('canplaythrough', onLossReady, { once: true });
          lossAudio.addEventListener('error', onLossError);
          lossAudioRef.current = lossAudio;
        } else {
          setLossSoundReady(false);
          lossAudioRef.current = null;
        }
      } catch (_) {
        // If HEAD fails (offline, dev server not ready), keep refs null
        setWinSoundReady(false);
        setLossSoundReady(false);
        winAudioRef.current = null;
        lossAudioRef.current = null;
      }
    };

    setup();

    // Cleanup on unmount
    return () => {
      disposed = true;
      if (winAudioRef.current) {
        winAudioRef.current.pause();
      }
      if (lossAudioRef.current) {
        lossAudioRef.current.pause();
      }
    };
  }, []);

  // Web Audio API fallback beep when mp3s are unavailable
  const playBeep = (type) => {
    try {
      if (muted) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      // Different pitch for win/loss
      o.frequency.value = type === 'win' ? 880 : 220; // A5 vs A3
      g.gain.value = 0.001;
      o.connect(g);
      g.connect(ctx.destination);
      const now = ctx.currentTime;
      // Simple short envelope
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      o.start(now);
      o.stop(now + 0.22);
      // Close context shortly after to free resources
      setTimeout(() => ctx.close(), 300);
    } catch (_) { /* no-op */ }
  };

  // Roulette numbers in the correct layout with 2 to 1 on the right
  const rouletteNumbers = [
    [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, '2 to 1 (1st)'],
    [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35, '2 to 1 (2nd)'],
    [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, '2 to 1 (3rd)']
  ];
  
  // Zero is a special case that will be positioned to the left of number 2

  const getNumberColor = (num) => {
    if (num === 0 || (typeof num === 'string' && num.startsWith('2 to 1'))) return 'green';
    const redNumbers = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    return redNumbers.includes(num) ? 'red' : 'black';
  };

  const placeBet = (selection) => {
    if (money < currentToken) return; // Not enough money
    
    const newBets = { ...bets };
    
    if (newBets[selection]) {
      // If already has a bet, increase it
      newBets[selection].amount += currentToken;
    } else {
      // New bet
      newBets[selection] = {
        amount: currentToken,
        token: currentToken
      };
    }
    
    setBets(newBets);
    setMoney(prev => prev - currentToken);
  };
  
  const removeBet = (selection) => {
    if (!bets[selection]) return;
    
    const newBets = { ...bets };
    const returnedAmount = newBets[selection].amount;
    delete newBets[selection];
    
    setBets(newBets);
    setMoney(prev => prev + returnedAmount);
  };
  
  const toggleSelection = (selection) => {
    // Prevent changing bets while the wheel is spinning
    if (isGenerating) return;
    const newSelections = new Set(selectedNumbers);
    
    if (bets[selection]) {
      // If already has a bet, remove it
      removeBet(selection);
      newSelections.delete(selection);
    } else {
      // For outside bets, first remove any other selections in the same category
      const outsideBets = [
        '1st 12', '2nd 12', '3rd 12',
        '1-18', '19-36',
        'EVEN', 'ODD',
        'RED', 'BLACK'
      ];
      
      // Remove any other outside bet in the same category
      if (outsideBets.includes(selection)) {
        outsideBets.forEach(bet => {
          if (bet !== selection && bets[bet]) {
            removeBet(bet);
            newSelections.delete(bet);
          }
        });
      }
      
      // Place new bet
      placeBet(selection);
      newSelections.add(selection);
    }
    
    setSelectedNumbers(newSelections);
  };
  
  const isSelected = (selection) => selectedNumbers.has(selection);
  const isNumberSelected = (number) => selectedNumbers.has(number);
  
  // Calculate total bet amount
  const totalBet = Object.values(bets).reduce((sum, bet) => sum + bet.amount, 0);
  
  // Handle win/loss
  const checkWin = (number) => {
    // winnings represents the TOTAL returned for winning bets (stake + profit)
    // Since stakes are deducted when placing bets, adding total returns here yields correct net results.
    let winnings = 0;
    const winningBets = [];
    
    // Check each bet
    Object.entries(bets).forEach(([bet, { amount }]) => {
      // Reset per-bet multiplier to avoid carry-over
      let multiplier = 0;

      if (bet === number.toString()) { // Direct hit
        multiplier = 36; // total return 36x for straight up (35:1)
      } 
      // Check for 2:1 column bets (total return 3x)
      else if (
        (bet === '2 to 1 (1st)' && [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].includes(number)) ||
        (bet === '2 to 1 (2nd)' && [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].includes(number)) ||
        (bet === '2 to 1 (3rd)' && [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].includes(number))
      ) {
        multiplier = 3; // total return 3x for column bets
      }
      // Check for 12-number bets (1st/2nd/3rd 12) total return 3x
      else if (
        (bet === '1st 12' && number >= 1 && number <= 12) ||
        (bet === '2nd 12' && number >= 13 && number <= 24) ||
        (bet === '3rd 12' && number >= 25 && number <= 36)
      ) {
        multiplier = 3; // total return 3x for 12-number bets
      }
      // Check for even money bets (total return 2x)
      else if (
        (bet === 'RED' && getNumberColor(number) === 'red') ||
        (bet === 'BLACK' && getNumberColor(number) === 'black') ||
        (bet === 'EVEN' && number % 2 === 0 && number !== 0) ||
        (bet === 'ODD' && number % 2 === 1) ||
        (bet === '1-18' && number >= 1 && number <= 18) ||
        (bet === '19-36' && number >= 19 && number <= 36)
      ) {
        multiplier = 2; // total return 2x for even money bets (1:1)
      }

      if (multiplier > 0) {
        const winAmount = amount * multiplier; // total return (stake + profit)
        winnings += winAmount;
        winningBets.push(`${bet} (₹${winAmount})`);
      }
    });
    
    // Record into history queue (last 10)
    const historyEntry = {
      timestamp: new Date().toLocaleString(),
      spin: number,
      totalBet,
      winnings,
      outcome: winnings > 0 ? 'WIN' : 'LOSS',
      bets: Object.entries(bets).map(([bet, { amount }]) => `${bet}: ₹${amount}`)
    };
    setHistory((prev) => {
      const next = [historyEntry, ...prev];
      return next.slice(0, 10);
    });
    
    // Update money
    setMoney(prev => prev + winnings);
    
    // Show winning bets if any via modal; otherwise show a loss modal
    if (winnings > 0) {
      // Play win sound (only if loaded/ready), else fallback beep
      if (!muted && winAudioRef.current && winSoundReady) {
        try { winAudioRef.current.currentTime = 0; winAudioRef.current.play(); } catch (e) { /* no-op */ }
      } else {
        playBeep('win');
      }
      setWinModal({ open: true, amount: winnings, bets: winningBets });
    } else {
      // Play loss sound (only if loaded/ready), else fallback beep
      if (!muted && lossAudioRef.current && lossSoundReady) {
        try { lossAudioRef.current.currentTime = 0; lossAudioRef.current.play(); } catch (e) { /* no-op */ }
      } else {
        playBeep('loss');
      }
      setLossModal({ open: true, amount: totalBet });
    }
    
    // Clear all bets
    setBets({});
    setSelectedNumbers(new Set());
  };
  
  // Generate random number and check for wins
  const generateRandomNumber = () => {
    if (totalBet === 0) {
      alert('Please place a bet first!');
      return;
    }
    
    setIsGenerating(true);
    // Clear previous number to build suspense
    setRandomNumber(null);
    setTimeout(() => {
      const newNumber = Math.floor(Math.random() * 37); // 0-36 inclusive
      setRandomNumber(newNumber);
      // After revealing the number, wait 1500ms before showing win/loss
      setTimeout(() => {
        checkWin(newNumber);
        setIsGenerating(false);
      }, 1500);
    }, 3000);
  };

  return (
    <div className="app">
      {/* Floating Mute Button (top-right) */}
      <button
        className={`mute-btn ${muted ? 'muted' : ''}`}
        onClick={() => setMuted(m => !m)}
        aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
        title={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
      <div className="money-display">
        <h2>Money: ₹{money}</h2>
        <div className="token-selector">
          <h3>Select Token:</h3>
          {[20, 50, 100, 200, 250, 500, 1000].map(token => (
            <button
              key={token}
              className={`token-btn ${currentToken === token ? 'active' : ''}`}
              onClick={() => setCurrentToken(token)}
            >
              ₹{token}
            </button>
          ))}
        </div>
        <div className="current-bet">
          <h3>Current Bet: ₹{currentToken}</h3>
          <h4>Total Bet: ₹{totalBet}</h4>
        </div>
      </div>
      <h1>Roulette</h1>
      
      <div className="roulette-table">
        <div className="number-grid">
          {rouletteNumbers.map((row, rowIndex) => (
            <div key={rowIndex} className="number-row">
              {rowIndex === 1 && (
                <div 
                  className={`number-cell zero ${isNumberSelected(0) ? 'selected' : ''}`}
                  onClick={() => toggleSelection(0)}
                >
                  0
                  {isNumberSelected(0) && (
                    <div className="selection-tick">
                      <svg viewBox="0 0 24 24" width="24" height="24">
                        <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                      </svg>
                    </div>
                  )}
                </div>
              )}
              {rowIndex !== 1 && <div className="empty-zero-cell"></div>}
              {row.map((number, colIndex) => {
                const isSelected = isNumberSelected(number);
                const color = getNumberColor(number);
                const isTwoToOne = typeof number === 'string' && number.startsWith('2 to 1');
                const displayNumber = isTwoToOne ? '2:1' : number;
                
                return (
                  <div 
                    key={`${rowIndex}-${colIndex}`}
                    className={`number-cell ${color} ${isSelected ? 'selected' : ''} ${
                      isTwoToOne ? 'two-to-one' : ''
                    }`}
                    onClick={() => toggleSelection(number)}
                  >
                    {displayNumber}
                    {isSelected && (
                      <div className="selection-tick">
                        <svg viewBox="0 0 24 24" width="24" height="24">
                          <path fill="currentColor" d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="outside-bets">
          <div 
            className={`outside-bet ${isSelected('1st 12') ? 'selected' : ''}`}
            onClick={() => toggleSelection('1st 12')}
          >1st 12</div>
          <div 
            className={`outside-bet ${isSelected('2nd 12') ? 'selected' : ''}`}
            onClick={() => toggleSelection('2nd 12')}
          >2nd 12</div>
          <div 
            className={`outside-bet ${isSelected('3rd 12') ? 'selected' : ''}`}
            onClick={() => toggleSelection('3rd 12')}
          >3rd 12</div>
          <div 
            className={`outside-bet ${isSelected('1-18') ? 'selected' : ''}`}
            onClick={() => toggleSelection('1-18')}
          >1-18</div>
          <div 
            className={`outside-bet ${isSelected('EVEN') ? 'selected' : ''}`}
            onClick={() => toggleSelection('EVEN')}
          >EVEN</div>
          <div 
            className={`outside-bet red ${isSelected('RED') ? 'selected' : ''}`}
            onClick={() => toggleSelection('RED')}
          >🔴</div>
          <div 
            className={`outside-bet black ${isSelected('BLACK') ? 'selected' : ''}`}
            onClick={() => toggleSelection('BLACK')}
          >⚫</div>
          <div 
            className={`outside-bet ${isSelected('ODD') ? 'selected' : ''}`}
            onClick={() => toggleSelection('ODD')}
          >ODD</div>
          <div 
            className={`outside-bet ${isSelected('19-36') ? 'selected' : ''}`}
            onClick={() => toggleSelection('19-36')}
          >19-36</div>
        </div>
      </div>
      
      <div className="generator-section">
        <div className={`number-display ${isGenerating ? 'generating' : ''}`} style={{ color: getNumberColor(randomNumber) }}>
          {randomNumber !== null ? randomNumber : '?'}
        </div>
        <button 
          className="generate-btn"
          onClick={generateRandomNumber}
          disabled={isGenerating}
        >
          {isGenerating ? '🎰 Spinning... 🎰' : '🎡 SPIN THE WHEEL 🎡'}
        </button>
        <button
          className="history-btn"
          onClick={() => setShowHistory(true)}
        >
          📜 History
        </button>
        {selectedNumbers.size > 0 && (
          <div className="selected-numbers">
            <p>Selected: {Array.from(selectedNumbers).join(', ')}</p>
          </div>
        )}
      </div>
      {/* Win modal */}
      {winModal.open && (
        <div className="modal-overlay" onClick={() => setWinModal({ open: false, amount: 0, bets: [] })}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Congratulations! 🎉</h3>
            <p className="win-amount">You won ₹{winModal.amount}</p>
            {winModal.bets?.length > 0 && (
              <p className="win-detail">Winning bets: {winModal.bets.join(', ')}</p>
            )}
            <button
              className="modal-btn"
              onClick={() => setWinModal({ open: false, amount: 0, bets: [] })}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Loss modal */}
      {lossModal.open && (
        <div className="modal-overlay" onClick={() => setLossModal({ open: false, amount: 0 })}>
          <div className="modal loss" onClick={(e) => e.stopPropagation()}>
            <h3>Better luck next time ❗</h3>
            <p className="loss-amount">You lost ₹{lossModal.amount}</p>
            <p className="win-detail">No win this time. Better luck next time!</p>
            <button
              className="modal-btn"
              onClick={() => setLossModal({ open: false, amount: 0 })}
            >
              OK
            </button>
          </div>
        </div>
      )}
      
      {/* History modal */}
      {showHistory && (
        <div className="modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="modal history" onClick={(e) => e.stopPropagation()}>
            <h3>Bet History (Last 10)</h3>
            {history.length === 0 ? (
              <p className="win-detail">No bets yet.</p>
            ) : (
              <ul className="history-list">
                {history.map((h, idx) => (
                  <li key={idx} className={`history-item ${h.outcome.toLowerCase()}`}>
                    <div className="history-row">
                      <span className="history-time">{h.timestamp}</span>
                      <span className="history-spin">Spin: {h.spin}</span>
                    </div>
                    <div className="history-row">
                      <span>Bet: ₹{h.totalBet}</span>
                      <span>Winnings: ₹{h.winnings}</span>
                      <span className={`history-outcome ${h.outcome.toLowerCase()}`}>{h.outcome}</span>
                    </div>
                    {h.bets?.length > 0 && (
                      <div className="history-bets">Bets: {h.bets.join(', ')}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <button className="modal-btn" onClick={() => setShowHistory(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
