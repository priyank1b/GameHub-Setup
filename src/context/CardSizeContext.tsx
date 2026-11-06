import React, { createContext, useContext, useState } from 'react';

export const MIN_CARD_SIZE = 140;
export const MAX_CARD_SIZE = 280;
export const DEFAULT_CARD_SIZE = 180;

export interface CardSizePreset {
  label: string;
  size: number;
  description: string;
}

export const CARD_SIZE_PRESETS: CardSizePreset[] = [
  { label: 'Compact', size: 140, description: 'More cards per row' },
  { label: 'Standard', size: 180, description: 'Balanced view' },
  { label: 'Large', size: 230, description: 'Larger artwork' },
  { label: 'Extra Large', size: 280, description: 'Maximum showcase' },
];

interface CardSizeContextType {
  cardSize: number;
  setCardSize: (size: number) => void;
  resetCardSize: () => void;
  minCardSize: number;
  maxCardSize: number;
  presets: CardSizePreset[];
}

const CardSizeContext = createContext<CardSizeContextType>({
  cardSize: DEFAULT_CARD_SIZE,
  setCardSize: () => {},
  resetCardSize: () => {},
  minCardSize: MIN_CARD_SIZE,
  maxCardSize: MAX_CARD_SIZE,
  presets: CARD_SIZE_PRESETS,
});

export const CardSizeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cardSize, setCardSizeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('omniplay_card_size');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_CARD_SIZE && parsed <= MAX_CARD_SIZE) {
          return parsed;
        }
      }
    } catch {
      // fallback to default
    }
    return DEFAULT_CARD_SIZE;
  });

  const setCardSize = (size: number) => {
    const clamped = Math.max(MIN_CARD_SIZE, Math.min(MAX_CARD_SIZE, Math.round(size)));
    setCardSizeState(clamped);
    try {
      localStorage.setItem('omniplay_card_size', clamped.toString());
    } catch {
      // ignore local storage errors
    }
  };

  const resetCardSize = () => {
    setCardSize(DEFAULT_CARD_SIZE);
  };

  return (
    <CardSizeContext.Provider
      value={{
        cardSize,
        setCardSize,
        resetCardSize,
        minCardSize: MIN_CARD_SIZE,
        maxCardSize: MAX_CARD_SIZE,
        presets: CARD_SIZE_PRESETS,
      }}
    >
      {children}
    </CardSizeContext.Provider>
  );
};

export const useCardSize = () => useContext(CardSizeContext);
