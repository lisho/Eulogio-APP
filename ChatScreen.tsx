
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, AppView, BeforeInstallPromptEvent } from '../types'; 
import SendIcon from './icons/SendIcon';
import LoadingDots from './LoadingDots';
import MicrophoneIcon from './icons/MicrophoneIcon';
import CopyIcon from './icons/CopyIcon';
import CheckIcon from './icons/CheckIcon';
import InstallPwaButton from './InstallPwaButton'; 

interface ChatScreenProps {
  messages: ChatMessage[];
  onSendMessage: (messageText: string) => void;
  isLoading: boolean; // True when bot is processing a user message
  currentView: AppView;
  deferredInstallPrompt: BeforeInstallPromptEvent | null; 
  onInstallPrompted: () => void; 
  isStandalone: boolean; 
}

const MAX_TEXTAREA_HEIGHT = 120;

interface IWindow extends Window {
  SpeechRecognition: any;
  webkitSpeechRecognition: any;
}
declare var window: IWindow;

const GENERATE_CASE_STUDY_PROMPT = `Necesito que elabores un supuesto práctico realista y exhaustivo centrado en un tema específico que te proporcionaré. Este supuesto está destinado a la preparación de un examen práctico para una oposición de Trabajadores Sociales de Base del Ayuntamiento de León (primer nivel de intervención - CEAS ) en el ámbito de los Servicios Sociales de Castilla y León, España

El objetivo es que el supuesto describa una situación compleja de forma objetiva y detallada, pero sin resolver todas las incógnitas ni agotar todas las posibilidades, permitiendo así el análisis y la toma de decisiones por parte del opositor.

El supuesto debe enmarcarse en entorno urbano e incluir los siguientes elementos clave:

- Descripción de la situación inicial: Presenta de forma narrativa y sin juicios de valor los elementos esenciales del caso (datos sociodemográficos relevantes, contexto familiar y social, problemática detectada, etc.). Sé creativo al plantear la situación, utilizando un lenguaje que evoque una escena real sin ser excesivamente dramático.
- Cauce de entrada del caso al servicio: Especifica cómo llega la situación a conocimiento de los Servicios Sociales (por ejemplo, derivación de otro recurso, demanda espontánea, aviso de terceros, detección en programas específicos, etc.).
- Primeros contactos e interacciones: Detalla las primeras comunicaciones con la persona o personas afectadas y, si se han producido, con otros recursos o profesionales implicados en la fase inicial. Incluye diálogos o extractos que reflejen la comunicación inicial.
- Demanda inicial de la persona usuaria: Articula claramente lo que la persona o familia solicita en este primer momento, aunque esta demanda pueda no coincidir con la necesidad detectada o la intervención posterior.
- Tema del supuesto: A tu elección

Por favor, mantén un tono profesional y un lenguaje técnico apropiado para el ámbito del Trabajo Social. La idea es que el supuesto sea un punto de partida sólido para desarrollar una intervención profesional. No estructures la presentación del caso en apartados diferenciados, simplemente redacta la exposición del caso.`;


const ChatScreen: React.FC<ChatScreenProps> = ({ 
  messages, 
  onSendMessage, 
  isLoading, 
  currentView,
  deferredInstallPrompt,
  onInstallPrompted,
  isStandalone
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const speechRecognitionRef = useRef<any>(null);
  const initialTextBeforeDictationRef = useRef<string>(''); 

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const speechRecognitionSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

  // Determine if the initial greeting is loading
  const isInitialGreetingLoading = 
    messages.length === 1 && 
    messages[0]?.id.startsWith('bot-greeting-') && 
    messages[0]?.isStreaming === true;

  useEffect(() => {
    if (!speechRecognitionSupported) {
      console.warn("Speech recognition not supported by this browser.");
      return;
    }

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognitionInstance = new SpeechRecognitionAPI();
    recognitionInstance.continuous = true;
    recognitionInstance.interimResults = true;
    recognitionInstance.lang = 'es-ES';

    recognitionInstance.onresult = (event: any) => {
      let final_transcript = '';
      let interim_transcript = '';
      
      for (let i = 0; i < event.results.length; i++) {
          const transcriptPart = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
              final_transcript += transcriptPart;
          } else {
              interim_transcript = transcriptPart; 
          }
      }
      let currentDictatedText = final_transcript + interim_transcript;

      let newTextValue = initialTextBeforeDictationRef.current;
      if (newTextValue && currentDictatedText.trim()) {
        if (!newTextValue.endsWith(' ')) newTextValue += ' '; 
      }
      newTextValue += currentDictatedText;
      
      setInputText(newTextValue);
    };

    recognitionInstance.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error, event.message);
      let detailedError = event.error;
      if (event.error === 'no-speech') {
        detailedError = 'No se detectó voz. Intenta de nuevo.';
      } else if (event.error === 'audio-capture') {
        detailedError = 'Error al capturar audio. Revisa tu micrófono.';
      } else if (event.error === 'not-allowed') {
        detailedError = 'Permiso denegado para el micrófono.';
      } else if (event.error === 'aborted') {
        detailedError = 'Dictado interrumpido.';
      } else {
        detailedError = event.message || detailedError;
      }
      setSpeechError(`Error: ${detailedError}`);
      setIsListening(false);
    };

    recognitionInstance.onend = () => {
      setIsListening(false); 
      initialTextBeforeDictationRef.current = textareaRef.current?.value || '';
    };

    speechRecognitionRef.current = recognitionInstance;

    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.stop();
      }
    };
  }, [speechRecognitionSupported]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const newHeight = Math.min(textareaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT);
      textareaRef.current.style.height = `${newHeight}px`;
      textareaRef.current.style.overflowY = textareaRef.current.scrollHeight > MAX_TEXTAREA_HEIGHT ? 'auto' : 'hidden';
    }
  }, [inputText]);

  useEffect(() => {
    if (currentView === AppView.CHAT && !isLoading && !isInitialGreetingLoading && textareaRef.current && !isListening) {
      textareaRef.current.focus();
    }
  }, [isLoading, isInitialGreetingLoading, messages, currentView, isListening]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
     if (!isListening) { 
        initialTextBeforeDictationRef.current = e.target.value;
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const textToSend = inputText.trim();
    if (speechRecognitionRef.current && isListening) {
      speechRecognitionRef.current.stop(); 
    }
    setIsListening(false);

    if (textToSend) {
      onSendMessage(textToSend);
      setInputText('');
      initialTextBeforeDictationRef.current = ''; 
    }
  };
  
  const handleToggleListening = () => {
    if (!speechRecognitionSupported) {
      setSpeechError("El reconocimiento de voz no es compatible con este navegador.");
      return;
    }
    if ((isLoading && messages[messages.length-1]?.sender === 'user') && !isListening) return; 
    if (isInitialGreetingLoading) return;


    if (isListening) {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop(); 
      }
    } else {
      setSpeechError(null); 
      if (speechRecognitionRef.current) {
        initialTextBeforeDictationRef.current = textareaRef.current?.value || ''; 
        try {
          speechRecognitionRef.current.start();
          setIsListening(true); 
        } catch (error: any) {
          console.error("Error starting speech recognition:", error);
          setSpeechError(`No se pudo iniciar: ${error.message || "Verifica permisos."}`);
          setIsListening(false); 
        }
      } else {
        setSpeechError("El servicio de reconocimiento de voz no está inicializado.");
        setIsListening(false);
      }
    }
  };

  const handleCopyToClipboard = async (messageId: string, htmlText: string) => {
    if (!navigator.clipboard) {
      console.warn('Clipboard API not available');
      return;
    }
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlText;
      const plainText = tempDiv.textContent || tempDiv.innerText || "";
      
      await navigator.clipboard.writeText(plainText);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleGenerateCaseStudyClick = () => {
    onSendMessage(GENERATE_CASE_STUDY_PROMPT);
  };


  return (
    <div className="flex flex-col h-full w-full bg-white shadow-2xl sm:rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-primary-dark text-white p-4 flex items-center justify-between space-x-3 rounded-t-none sm:rounded-t-xl shadow-md flex-shrink-0">
        <div className="flex items-center space-x-3">
          <img
            src="/avatar-eulogio.jpg"
            alt="Eulogio Avatar"
            className="w-10 h-10 rounded-full border-2 border-rose-200"
          />
          <h2 className="text-xl font-semibold">Asistente Virtual</h2>
        </div>
        <InstallPwaButton
            deferredInstallPrompt={deferredInstallPrompt}
            onInstallPrompted={onInstallPrompted}
            isStandalone={isStandalone}
            className="flex items-center space-x-1.5 bg-white/20 hover:bg-white/30 text-white font-medium py-1.5 px-3 rounded-md text-xs"
            buttonText="Instalar"
            iconClassName="w-4 h-4"
        />
      </div>

      {/* Messages Area */}
      <div className="flex-grow p-4 sm:p-6 space-y-4 overflow-y-auto custom-scrollbar bg-rose-50">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex group ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start items-start space-x-2'
            }`}
          >
            <div
              className={`py-2 px-4 rounded-xl shadow max-w-[85%] md:max-w-[80%] break-words ${
                msg.sender === 'user'
                  ? 'bg-primary-dark text-white rounded-br-none'
                  : 'bg-rose-100 text-primary-dark rounded-bl-none' 
              }`}
            >
              {msg.sender === 'user' ? (
                msg.text.split('\n').map((line, index) => (
                  <React.Fragment key={index}>
                    {line}
                    {index < msg.text.split('\n').length - 1 && <br />}
                  </React.Fragment>
                ))
              ) : (
                (msg.isStreaming && !msg.text) 
                  ? <LoadingDots /> 
                  : <div className="bot-message-content" dangerouslySetInnerHTML={{ __html: msg.text }} />
              )}
            </div>
            {msg.sender === 'bot' && msg.text && !(msg.isStreaming && !msg.text) && (
              <button
                onClick={() => handleCopyToClipboard(msg.id, msg.text)}
                className="p-1.5 text-gray-400 hover:text-primary-dark rounded-full hover:bg-rose-100 opacity-0 group-hover:opacity-100 transition-opacity duration-200 focus:outline-none focus:ring-1 focus:ring-primary-dark self-center"
                aria-label={copiedMessageId === msg.id ? "Copiado" : "Copiar respuesta"}
                title={copiedMessageId === msg.id ? "Copiado al portapapeles" : "Copiar respuesta"}
                disabled={!navigator.clipboard}
              >
                {copiedMessageId === msg.id ? (
                  <CheckIcon />
                ) : (
                  <CopyIcon />
                )}
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {speechError && (
          <div className="p-2 bg-red-100 text-red-700 text-xs text-center flex-shrink-0">
              {speechError}
          </div>
      )}

      {/* Generate Case Study Button Area */}
      <div className="p-3 sm:p-4 border-t border-b sm:border-b-0 border-rose-200 bg-white flex-shrink-0">
        <button
          type="button"
          onClick={handleGenerateCaseStudyClick}
          className="w-full bg-teal-500 hover:bg-teal-600 text-white font-medium py-2.5 px-4 rounded-lg shadow hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 ring-offset-2 ring-teal-500 disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={
            isInitialGreetingLoading ||
            (isLoading && messages[messages.length - 1]?.sender === 'user')
          }
          aria-label="Generar un nuevo supuesto práctico"
        >
          Generar Supuesto Práctico
        </button>
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-3 sm:p-4 border-t border-rose-200 bg-white rounded-b-none sm:rounded-b-xl flex items-end space-x-2 sm:space-x-3 flex-shrink-0"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          placeholder="Escribe tu mensaje o usa el micrófono..."
          aria-label="Escribe tu mensaje"
          className="flex-grow p-3 border border-rose-300 rounded-lg focus:ring-2 focus:ring-primary-dark focus:border-transparent outline-none transition-shadow resize-none overflow-y-hidden"
          style={{ maxHeight: `${MAX_TEXTAREA_HEIGHT}px`}}
          disabled={
            isInitialGreetingLoading || 
            (isLoading && messages[messages.length-1]?.sender === 'user')
          }
        />
        <button
          type="button"
          onClick={handleToggleListening}
          className={`p-3 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform transition-transform hover:scale-105 self-end mb-px ${
            isListening ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-primary-dark'
          }`}
          disabled={
            isInitialGreetingLoading || 
            (isLoading && messages[messages.length-1]?.sender === 'user') || 
            !speechRecognitionSupported
          } 
          aria-label={isListening ? "Detener dictado" : "Comenzar dictado"}
          title={isListening ? "Detener dictado" : "Comenzar dictado"}
        >
          <MicrophoneIcon className="w-5 h-5 sm:w-6 sm:h-6" isListening={isListening} />
        </button>
        <button
          type="submit"
          className="bg-primary-dark hover:bg-primary-dark-hover text-white p-3 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transform transition-transform hover:scale-105 self-end mb-px"
          disabled={
            isInitialGreetingLoading || 
            (isLoading && messages[messages.length-1]?.sender === 'user') || 
            !inputText.trim()
          }
          aria-label="Enviar mensaje"
        >
          <SendIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>
      </form>
    </div>
  );
};

export default ChatScreen;
