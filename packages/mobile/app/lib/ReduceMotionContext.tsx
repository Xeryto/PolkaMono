import React, { createContext, useContext, ReactNode } from 'react';
import { useReducedMotion, ReduceMotion } from 'react-native-reanimated';

interface MotionContextType {
  reduceMotion: boolean;
}

const MotionContext = createContext<MotionContextType>({ reduceMotion: false });

export const MotionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <MotionContext.Provider value={{ reduceMotion }}>
      {children}
    </MotionContext.Provider>
  );
};

export const useMotion = () => useContext(MotionContext);

export const withReducedMotion = (duration: number, reduceMotion: boolean): number =>
  reduceMotion ? 0 : duration;

export const LAYOUT_REDUCE_MOTION = ReduceMotion.System;
