import React from 'react';
import { Navigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import OtpVerifyPage from './pages/OtpVerifyPage';
import CreatePasswordPage from './pages/CreatePasswordPage';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import NewPasswordPage from './pages/NewPasswordPage';
import DashboardPage from './pages/DashboardPage';
import FilesPage from './pages/FilesPage';
import TrashPage from './pages/TrashPage';
import SettingsPage from './pages/SettingsPage';
import LandingPage from './pages/LandingPage';
import CompilerPage from './pages/CompilerPage';
import SharePage from './pages/SharePage';

export interface RouteConfig {
  name: string;
  path: string;
  element: React.ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: 'Home',             path: '/',                    element: <LandingPage />,         public: true },
  { name: 'Login',            path: '/login',               element: <LoginPage />,           public: true },
  { name: 'Register',         path: '/register',            element: <RegisterPage />,        public: true },
  { name: 'Register OTP',     path: '/register/otp',        element: <OtpVerifyPage />,       public: true },
  { name: 'Create Password',  path: '/register/password',   element: <CreatePasswordPage />,  public: true },
  { name: 'Forgot Password',  path: '/forgot-password',     element: <ForgotPasswordPage />,  public: true },
  { name: 'Reset OTP',        path: '/forgot-password/otp', element: <OtpVerifyPage />,       public: true },
  { name: 'New Password',     path: '/forgot-password/new', element: <NewPasswordPage />,     public: true },
  { name: 'Share',            path: '/share/:token',        element: <SharePage />,           public: true },
  { name: 'Dashboard',        path: '/dashboard',           element: <DashboardPage /> },
  { name: 'Files',            path: '/files',               element: <FilesPage /> },
  { name: 'Compiler',         path: '/compiler',            element: <CompilerPage /> },
  { name: 'Trash',            path: '/trash',               element: <TrashPage /> },
  { name: 'Settings',         path: '/settings',            element: <SettingsPage /> },
  { name: 'Not Found',        path: '*',                    element: <Navigate to="/" replace />, public: true },
];

