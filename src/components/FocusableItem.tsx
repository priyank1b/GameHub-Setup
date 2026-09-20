import React from 'react';
import { useFocusable, UseFocusableOptions } from '../hooks/useFocusable';

interface FocusableItemProps extends UseFocusableOptions {
  children: (props: {
    ref: React.RefObject<any>;
    isFocused: boolean;
    setFocus: () => void;
  }) => React.ReactNode;
}

export const FocusableItem: React.FC<FocusableItemProps> = ({ children, ...options }) => {
  const { ref, isFocused, setFocus } = useFocusable(options);
  return <>{children({ ref, isFocused, setFocus })}</>;
};
