import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { WorkspaceProvider } from './lib/WorkspaceContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
);
