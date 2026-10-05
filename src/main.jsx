import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import './styles/global.css';
import './styles/premium-backgrounds.css';
import './styles/required-fields.css';
import { installFormValidationMessages, installDefaultInputLimits } from './utils/formValidation';

installFormValidationMessages();
installDefaultInputLimits();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <ConfirmProvider>
              <MotionConfig reducedMotion="user">
                <App />
              </MotionConfig>
            </ConfirmProvider>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);