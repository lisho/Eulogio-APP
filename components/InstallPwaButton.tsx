import React from 'react';
import { BeforeInstallPromptEvent } from '../types'; // Import the type
import DownloadIcon from './icons/DownloadIcon';

interface InstallPwaButtonProps {
  deferredInstallPrompt: BeforeInstallPromptEvent | null;
  onInstallPrompted: () => void; // Callback to clear the prompt in App.tsx
  isStandalone: boolean;
  className?: string;
  buttonText?: string;
  iconClassName?: string;
}

const InstallPwaButton: React.FC<InstallPwaButtonProps> = ({
  deferredInstallPrompt,
  onInstallPrompted,
  isStandalone,
  className,
  buttonText = "Instalar App",
  iconClassName
}) => {
  const handleInstallClick = async () => {
    if (!deferredInstallPrompt) {
      return;
    }
    deferredInstallPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, clear it.
    onInstallPrompted();
  };

  if (isStandalone || !deferredInstallPrompt) {
    return null; // Don't render if already standalone or no prompt available
  }

  return (
    <button
      onClick={handleInstallClick}
      className={className || "flex items-center justify-center space-x-2 bg-primary-dark hover:bg-primary-dark-hover text-white font-medium py-2 px-4 rounded-lg shadow hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 ring-offset-2 ring-primary-dark"}
      title="Instalar aplicación"
    >
      <DownloadIcon className={iconClassName || "w-5 h-5"} />
      <span>{buttonText}</span>
    </button>
  );
};

export default InstallPwaButton;
