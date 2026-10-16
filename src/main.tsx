import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './components/ErrorBoundary.tsx';
import './index.css';
import './styles/admin-light.generated.css';

console.log('🚀 Next Star Soccer Web App Starting...');
console.log('📍 Environment:', import.meta.env.MODE);
console.log('🔧 Checking environment variables...');

// Log environment variable status (without exposing values)
const requiredEnvVars = [
  'VITE_APPWRITE_ENDPOINT',
  'VITE_APPWRITE_PROJECT_ID',
  'VITE_APPWRITE_DATABASE_ID',
];

requiredEnvVars.forEach(envVar => {
  const exists = !!import.meta.env[envVar];
  console.log(`${exists ? '✅' : '❌'} ${envVar}: ${exists ? 'Set' : 'Missing'}`);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
