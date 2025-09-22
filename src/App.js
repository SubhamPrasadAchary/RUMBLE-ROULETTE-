import React, { useState } from 'react';

function App() {
  const [randomNumber, setRandomNumber] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedNumbers, setSelectedNumbers] = useState(new Set());
  const [money, setMoney] = useState(5000);
  const [currentToken, setCurrentToken] = useState(100);
  const [bets, setBets] = useState({}); // { 'number': { amount: number, token: number } }
  const [winModal, setWinModal] = useState({ open: false, amount: 0, bets: [] });
  const [lossModal, setLossModal] = useState({ open: false, amount: 0 });

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
    let winnings = 0;
    const winningBets = [];
    let multiplier = 0;
    
    // Check each bet
    Object.entries(bets).forEach(([bet, { amount }]) => {
      if (bet === number.toString()) { // Direct hit
        multiplier = 35; // 35:1 for straight up
      } 
      // Check for 2:1 bets
      else if (
        (bet === '2 to 1 (1st)' && [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36].includes(number)) ||
        (bet === '2 to 1 (2nd)' && [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35].includes(number)) ||
        (bet === '2 to 1 (3rd)' && [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34].includes(number))
      ) {
        multiplier = 2; // 2:1 for column bets
      }
      // Check for 12-number bets (1st/2nd/3rd 12)
      else if (
        (bet === '1st 12' && number >= 1 && number <= 12) ||
        (bet === '2nd 12' && number >= 13 && number <= 24) ||
        (bet === '3rd 12' && number >= 25 && number <= 36)
      ) {
        multiplier = 2; // 2:1 for 12-number bets
      }
      // Check for even money bets
      else if (
        (bet === 'RED' && getNumberColor(number) === 'red') ||
        (bet === 'BLACK' && getNumberColor(number) === 'black') ||
        (bet === 'EVEN' && number % 2 === 0 && number !== 0) ||
        (bet === 'ODD' && number % 2 === 1) ||
        (bet === '1-18' && number >= 1 && number <= 18) ||
        (bet === '19-36' && number >= 19 && number <= 36)
      ) {
        multiplier = 1; // 1:1 for even money bets
      }
      
      if (multiplier > 0) {
        const winAmount = amount * (multiplier + 1);
        winnings += winAmount;
        winningBets.push(`${bet} (${winAmount})`);
      }
    });
    
    // Update money
    setMoney(prev => prev + winnings);
    
    // Show winning bets if any via modal; otherwise show a loss modal
    if (winnings > 0) {
      setWinModal({ open: true, amount: winnings, bets: winningBets });
    } else {
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
    setTimeout(() => {
      const newNumber = Math.floor(Math.random() * 37); // 0-36 inclusive
      setRandomNumber(newNumber);
      checkWin(newNumber);
      setIsGenerating(false);
    }, 500);
  };

  return (
    <div className="app">
      <div className="money-display">
        <h2>Money: ₹{money}</h2>
        <div className="token-selector">
          <h3>Select Token:</h3>
          {[100, 200, 500].map(token => (
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
        <div className="number-display" style={{ color: getNumberColor(randomNumber) }}>
          {randomNumber !== null ? randomNumber : '?'}
        </div>
        <button 
          className="generate-btn"
          onClick={generateRandomNumber}
          disabled={isGenerating}
        >
          {isGenerating ? '🎰 Spinning... 🎰' : '🎡 SPIN THE WHEEL 🎡'}
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
    </div>
  );
}

export default App;
