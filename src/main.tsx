import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { NavigationProvider } from './context/NavigationContext';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <NavigationProvider>
      <App />
    </NavigationProvider>
  </React.StrictMode>
);
