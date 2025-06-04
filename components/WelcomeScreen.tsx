
import React from 'react';
import CheckIcon from './icons/CheckIcon';
import InstallPwaButton from './InstallPwaButton'; // Import the new component
import { BeforeInstallPromptEvent } from '../types'; // Import the type

interface WelcomeScreenProps {
  onStartChat: () => Promise<void>;
  deferredInstallPrompt: BeforeInstallPromptEvent | null; // New prop
  onInstallPrompted: () => void; // New prop
  isStandalone: boolean; // New prop
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ 
  onStartChat, 
  deferredInstallPrompt,
  onInstallPrompted,
  isStandalone 
}) => {
  const features = [
    "Respuestas Rápidas",
    "24/7 Disponible",
    "Multi-idioma",
  ];

  const handleButtonClick = async () => {
    await onStartChat();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-rose-50 relative"> {/* Added relative for positioning context if needed, though FAB is fixed */}
      <div className="bg-white rounded-xl shadow-xl p-8 md:p-12 max-w-lg w-full text-center">
        <img
          src="/avatar-eulogio.jpg" 
          alt="Asistente Virtual Eulogio Avatar"
          className="w-28 h-28 rounded-full mx-auto mb-6 border-2 border-rose-100 shadow-md"
        />
        <h1 className="text-3xl md:text-4xl font-bold text-primary-dark mb-4">
          ¡Bienvenido a tu Asistente Virtual!
        </h1>
        <p className="text-gray-700 mb-8 text-sm md:text-base"> 
          Soy Eulogio, trabajador social con experiencia. Estoy aquí para ofrecerte orientación profesional en el ámbito social. ¿Qué necesitas consultar?
        </p>        
        <button
          onClick={handleButtonClick}
          className="w-full bg-primary-dark hover:bg-primary-dark-hover text-white font-semibold py-3 px-6 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-opacity-50 text-lg mb-6" // Increased mb slightly
        >
          Comenzar Chat
        </button>
        
        <div className="text-center">
          <div className="flex flex-col items-center sm:flex-row sm:justify-center sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center text-sm text-gray-700 whitespace-nowrap"> 
                <CheckIcon /> 
                <span className="ml-1.5">{feature}</span> 
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PWA Install Button as FAB */}
      <InstallPwaButton 
          deferredInstallPrompt={deferredInstallPrompt}
          onInstallPrompted={onInstallPrompted}
          isStandalone={isStandalone}
          className="fixed bottom-6 right-6 flex items-center justify-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white font-medium p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-150 focus:outline-none focus:ring-2 ring-offset-2 ring-teal-500"
          buttonText="Instalar App"
          iconClassName="w-5 h-5" // Icon size can be adjusted if needed
      />
    </div>
  );
};

export default WelcomeScreen;
