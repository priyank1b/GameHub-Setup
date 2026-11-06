import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { NavigationProvider } from './context/NavigationContext';
import { CardSizeProvider } from './context/CardSizeContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <NavigationProvider>
      <CardSizeProvider>
        <App />
      </CardSizeProvider>
    </NavigationProvider>
  </React.StrictMode>
);
