
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppView, ChatMessage, StoredConversation, BeforeInstallPromptEvent } from './types'; // Added BeforeInstallPromptEvent
import WelcomeScreen from './components/WelcomeScreen';
import ChatScreen from './components/ChatScreen';
import Sidebar from './components/Sidebar';
import { createChatSession, sendMessageToGeminiStream } from './services/geminiService';
import { Chat, Content } from '@google/genai';
import MenuIcon from './components/icons/MenuIcon';

const GREETING_PLACEHOLDER_HTML = "<p><em>Eulogio está pensando... <span class='inline-bouncing-dots'><span></span><span></span><span></span></span></em></p>";

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.WELCOME);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatSession, setChatSession] = useState<Chat | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState<boolean>(!process.env.API_KEY);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => window.innerWidth >= 768);
  const [previousConversations, setPreviousConversations] = useState<StoredConversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  
  const chatSessionRef = useRef<Chat | null>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  // PWA Install State
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);

  useEffect(() => {
    chatSessionRef.current = chatSession;
  }, [chatSession]);

  useEffect(() => {
    const handleResize = () => {
      const mobileCheck = window.innerWidth < 768;
      setIsMobile(mobileCheck);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check if running in standalone mode on initial load
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsStandalone(true);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault(); // Prevent the mini-infobar
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
      console.log('`beforeinstallprompt` event was fired.');
    };

    const handleAppInstalled = () => {
      console.log('PWA was installed');
      setDeferredInstallPrompt(null); // Clear the saved prompt
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);


  useEffect(() => {
    if (!process.env.API_KEY) {
      setApiKeyMissing(true);
      console.warn("API_KEY for Gemini is not set. Live chat functionality will be stubbed.");
    }
    const stored = localStorage.getItem('chatConversations');
    if (stored) {
      try {
        setPreviousConversations(JSON.parse(stored));
      } catch (error) {
        console.error("Error parsing stored conversations:", error);
        localStorage.removeItem('chatConversations'); // Clear corrupted data
      }
    }
  }, []);

  useEffect(() => {
    if (previousConversations.length > 0 || localStorage.getItem('chatConversations')) {
        localStorage.setItem('chatConversations', JSON.stringify(previousConversations));
    }
  }, [previousConversations]);

  const stripMarkdownCodeFence = (rawText: string): string => {
    let textToClean = rawText.trim(); 
  
    const fullFenceRegex = /^```(\w*)\s*\n?(.*?)\n?\s*```$/s; 
    const fullMatch = textToClean.match(fullFenceRegex);
    if (fullMatch && typeof fullMatch[2] === 'string') { 
      return fullMatch[2].trim(); 
    }
  
    const leadingFenceStartRegex = /^(```(?:html|json)?\s*\n)/i;
    textToClean = textToClean.replace(leadingFenceStartRegex, '');
    
    return textToClean; 
  };

  const mapMessagesToApiHistory = useCallback((msgs: ChatMessage[]): Content[] => {
    return msgs.map(msg => ({
      role: msg.sender === 'bot' ? 'model' : 'user',
      parts: [{ text: msg.text }],
    })).filter(msg => {
        const text = msg.parts[0].text.trim();
        return text !== '' && text !== 'Hola' && text !== GREETING_PLACEHOLDER_HTML;
    });
  },[]);

  const saveCurrentConversation = useCallback(async (convId: string | null, currentMessages: ChatMessage[]) => {
    if (!convId || currentMessages.length === 0) return;

    const messagesToSave = currentMessages.filter(msg => {
        const isPlaceholder = msg.sender === 'bot' && msg.text === GREETING_PLACEHOLDER_HTML;
        // Don't save if it's the placeholder and it's still streaming (meaning greeting didn't complete)
        // Or if it's the placeholder and the only message (even if not streaming, if nothing else happened)
        if (isPlaceholder && (msg.isStreaming || currentMessages.length === 1)) {
            return false;
        }
        return true;
    });

    if (messagesToSave.length === 0) return;

    let historyForAPI: Content[] = [];
    try {
      if (chatSessionRef.current) {
        const historySnapshot = await chatSessionRef.current.getHistory();
        historyForAPI = historySnapshot.filter(entry => entry.parts[0].text !== GREETING_PLACEHOLDER_HTML);
      }
    } catch (e) {
      console.warn("Could not get history from chat session, using mapped messages:", e);
    }
    
    if (historyForAPI.length === 0 || (historyForAPI.length === 1 && historyForAPI[0]?.parts[0]?.text === "Hola")) { 
        historyForAPI = mapMessagesToApiHistory(messagesToSave);
    }
    
    if (historyForAPI.length >= 2 && historyForAPI[0].role === 'user' && historyForAPI[0].parts[0].text === 'Hola' && historyForAPI[1].role === 'model') {
        historyForAPI = historyForAPI.slice(1); 
    }
    
    historyForAPI = historyForAPI.filter(entry => entry.parts[0].text !== GREETING_PLACEHOLDER_HTML);

    const firstUserMessage = messagesToSave.find(m => m.sender === 'user' && m.text.trim() !== 'Hola');
    const conversationName = firstUserMessage 
                             ? firstUserMessage.text.substring(0, 30) + (firstUserMessage.text.length > 30 ? '...' : '')
                             : "Chat";

    setPreviousConversations(prev => {
      const existingIndex = prev.findIndex(c => c.id === convId);
      if (existingIndex !== -1) {
        const updatedConversations = [...prev];
        updatedConversations[existingIndex] = { 
            ...prev[existingIndex], 
            messages: messagesToSave, 
            name: conversationName, // Consistently use the newly derived name
            timestamp: Date.now(), 
            chatHistoryForAPI: historyForAPI 
        };
        return updatedConversations.sort((a, b) => b.timestamp - a.timestamp);
      } else {
        return [{ id: convId, name: conversationName, messages: messagesToSave, timestamp: Date.now(), chatHistoryForAPI: historyForAPI }, ...prev.filter(c => c.id !== convId)].sort((a, b) => b.timestamp - a.timestamp);
      }
    });
  }, [mapMessagesToApiHistory]);

  const initializeNewChat = useCallback(async (isWelcomeStart = false) => {
    if (currentConversationId && messages.length > 0) {
      const messagesToSaveBeforeNew = messages.filter(msg => !(msg.sender === 'bot' && msg.text === GREETING_PLACEHOLDER_HTML && msg.isStreaming));
      if (messagesToSaveBeforeNew.length > 0 && !(messagesToSaveBeforeNew.length === 1 && messagesToSaveBeforeNew[0].text.includes("Error"))) {
         await saveCurrentConversation(currentConversationId, messagesToSaveBeforeNew);
      }
    }

    const newId = Date.now().toString();
    setCurrentConversationId(newId);
    
    const initialBotGreetingId = `bot-greeting-${newId}`;
    const placeholderGreetingMessage: ChatMessage = {
      id: initialBotGreetingId,
      text: GREETING_PLACEHOLDER_HTML, 
      sender: 'bot',
      timestamp: Date.now(),
      isStreaming: true,
    };
    setMessages([placeholderGreetingMessage]);
    
    const newSession = createChatSession();
    setChatSession(newSession); 
    
    if (!newSession && process.env.API_KEY) {
        setApiKeyMissing(true);
        console.error("Failed to initialize chat session even with API_KEY.");
        const errorMsg = { 
            id: `bot-error-init-${newId}`, 
            text: "<p>Error crítico al iniciar la sesión de IA. Por favor, revisa la consola.</p>", 
            sender: 'bot' as const, 
            timestamp: Date.now(), 
            isStreaming: false 
        };
        setMessages([errorMsg]); // Replace placeholder with error
        await saveCurrentConversation(newId, [errorMsg]);
        return;
    }
    
    setCurrentView(AppView.CHAT);
    if (isMobile && isWelcomeStart) setIsSidebarOpen(false); 
    else if (isMobile) setIsSidebarOpen(false);
    setIsLoading(false); 

    if (newSession) {
      try {
        const stream = await sendMessageToGeminiStream(newSession, "Hola");
        let accumulatedGreeting = '';
        let firstChunkReceived = false;

        if (stream) {
          for await (const chunk of stream) {
            if (!firstChunkReceived && chunk.text.trim() !== '') {
              accumulatedGreeting = chunk.text;
              firstChunkReceived = true;
            } else if (firstChunkReceived) {
              accumulatedGreeting += chunk.text;
            }
            if (accumulatedGreeting.trim() !== '') {
                setMessages(prevMsgs => prevMsgs.map(msg => 
                msg.id === initialBotGreetingId ? { ...msg, text: stripMarkdownCodeFence(accumulatedGreeting) } : msg
                ));
            }
          }
        }
        
        let finalUserVisibleText = stripMarkdownCodeFence(accumulatedGreeting);
        if (!finalUserVisibleText.trim() || finalUserVisibleText === GREETING_PLACEHOLDER_HTML) { 
            finalUserVisibleText = "<p>No se pudo obtener el saludo inicial o la respuesta fue vacía. Por favor, intenta enviar un mensaje.</p>";
        }
        const finalGreetingMessage = { ...placeholderGreetingMessage, text: finalUserVisibleText, isStreaming: false };
        setMessages([finalGreetingMessage]);
        
        if (finalGreetingMessage.text !== GREETING_PLACEHOLDER_HTML && !finalGreetingMessage.text.includes("Error")) {
           await saveCurrentConversation(newId, [finalGreetingMessage]);
        }

      } catch (error) {
        console.error("Error streaming initial AI greeting:", error);
        const errorMsgObject = { 
            id: `bot-error-greeting-${newId}`, 
            text: "<p>Error al cargar el saludo del asistente. Intenta enviar un mensaje.</p>", 
            sender: 'bot' as const, 
            timestamp: Date.now(), 
            isStreaming: false 
        };
        setMessages([errorMsgObject]);
        await saveCurrentConversation(newId, [errorMsgObject]);
      }
    } else if (!process.env.API_KEY) { 
        const mockStream = await sendMessageToGeminiStream(newSession as any, "Hola"); 
        let accumulatedGreeting = '';
        if (mockStream) {
            for await (const chunk of mockStream) {
                 accumulatedGreeting += chunk.text;
                 setMessages(prevMsgs => prevMsgs.map(msg => 
                    msg.id === initialBotGreetingId ? { ...msg, text: stripMarkdownCodeFence(accumulatedGreeting) } : msg
                ));
            }
        }
        const finalGreetingMessage = { ...placeholderGreetingMessage, text: stripMarkdownCodeFence(accumulatedGreeting), isStreaming: false };
        setMessages([finalGreetingMessage]);
        await saveCurrentConversation(newId, [finalGreetingMessage]);
    }
  }, [currentConversationId, messages, isMobile, saveCurrentConversation, apiKeyMissing]);

  const handleStartChatFromWelcome = useCallback(async () => {
    await initializeNewChat(true);
  }, [initializeNewChat]);

  const handleLoadConversation = useCallback(async (conversationId: string) => {
    const conversationToLoad = previousConversations.find(c => c.id === conversationId);
    if (conversationToLoad) {
      if (currentConversationId && currentConversationId !== conversationId && messages.length > 0) {
        const messagesToSaveBeforeLoad = messages.filter(msg => !(msg.sender === 'bot' && msg.text === GREETING_PLACEHOLDER_HTML && msg.isStreaming));
        if (messagesToSaveBeforeLoad.length > 0) {
          await saveCurrentConversation(currentConversationId, messagesToSaveBeforeLoad);
        }
      }

      setMessages(conversationToLoad.messages);
      setCurrentConversationId(conversationToLoad.id);
      const historyForLoadedChat = conversationToLoad.chatHistoryForAPI.filter(entry => entry.parts[0].text !== GREETING_PLACEHOLDER_HTML);
      const session = createChatSession(historyForLoadedChat);
      setChatSession(session);

      if (!session && process.env.API_KEY) setApiKeyMissing(true);
      
      setCurrentView(AppView.CHAT);
      if (isMobile) setIsSidebarOpen(false);
      setIsLoading(false);
    }
  }, [previousConversations, messages, currentConversationId, isMobile, saveCurrentConversation, apiKeyMissing]);

  const handleSendMessage = useCallback(async (text: string) => {
    const newUserMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text,
      sender: 'user',
      timestamp: Date.now(),
    };
    
    let messagesWithUser;
    setMessages(prevMsgs => {
        if (prevMsgs.length === 1 && prevMsgs[0].id.startsWith('bot-greeting-') && prevMsgs[0].isStreaming) {
            messagesWithUser = [newUserMessage];
        } else {
            messagesWithUser = [...prevMsgs, newUserMessage];
        }
        return messagesWithUser;
    });

    setIsLoading(true); 

    const currentChatSessionForSend = chatSessionRef.current;

    if (!currentChatSessionForSend) {
      const errorText = apiKeyMissing ? "<p>Configuración de API key incompleta. No se puede enviar mensaje.</p>" : "<p>Error: Sesión de chat no iniciada. No se puede enviar mensaje.</p>";
      const botErrorResponse: ChatMessage = {
        id: `bot-error-${Date.now()}`, text: errorText, sender: 'bot', timestamp: Date.now() + 1, isStreaming: false
      };
      setMessages(prev => [...prev, botErrorResponse]); 
      setIsLoading(false);
      if (currentConversationId) await saveCurrentConversation(currentConversationId, [...(messagesWithUser || messages), botErrorResponse]);
      return;
    }
    
    const botMessageId = `bot-stream-${Date.now()}`;
    const streamingBotMessage: ChatMessage = {
      id: botMessageId, text: '', sender: 'bot', timestamp: Date.now() + 1, isStreaming: true,
    };
    setMessages((prevMessages) => [...prevMessages, streamingBotMessage]);

    try {
      const stream = await sendMessageToGeminiStream(currentChatSessionForSend, text);
      let accumulatedText = '';
      if (stream) {
        for await (const chunk of stream) {
          accumulatedText += chunk.text;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === botMessageId ? { ...msg, text: stripMarkdownCodeFence(accumulatedText) } : msg
            )
          );
        }
      } else { 
         accumulatedText = "<p>Error al obtener respuesta del stream de Gemini.</p>";
      }
      
      if (accumulatedText === GREETING_PLACEHOLDER_HTML) accumulatedText = "<p>Respuesta vacía del asistente.</p>";

      const finalBotMessage = { ...streamingBotMessage, text: stripMarkdownCodeFence(accumulatedText), isStreaming: false };
      
      let finalMessagesForSave: ChatMessage[] = [];
      setMessages((prev) => {
        const msgIndex = prev.findIndex(m => m.id === botMessageId);
        if (msgIndex !== -1) {
          const updated = [...prev];
          updated[msgIndex] = finalBotMessage;
          finalMessagesForSave = updated;
          return updated;
        }
        finalMessagesForSave = [...prev.filter(m => m.id !== botMessageId), finalBotMessage]; 
        return finalMessagesForSave;
      });

      if (currentConversationId) await saveCurrentConversation(currentConversationId, finalMessagesForSave);

    } catch (error) {
      console.error('Error streaming message to Gemini:', error);
      const errorBotMessage = { ...streamingBotMessage, text: '<p>Hubo un error al obtener la respuesta de Gemini.</p>', isStreaming: false };
      let finalMessagesForSaveOnError: ChatMessage[] = [];
      setMessages((prev) => {
         const updatedOnError = prev.map((msg) =>
          msg.id === botMessageId ? errorBotMessage : msg
        );
        finalMessagesForSaveOnError = updatedOnError;
        return updatedOnError;
      });
       if (currentConversationId) {
         await saveCurrentConversation(currentConversationId, finalMessagesForSaveOnError);
       }
    } finally {
      setIsLoading(false);
    }
  }, [messages, apiKeyMissing, currentConversationId, saveCurrentConversation, chatSessionRef]);

  const handleDeleteConversation = useCallback(async (conversationIdToDelete: string) => {
    setPreviousConversations(prev => prev.filter(conv => conv.id !== conversationIdToDelete));
    if (currentConversationId === conversationIdToDelete) {
      setCurrentConversationId(null); 
      setMessages([]); 
      await initializeNewChat(false); 
    }
  }, [currentConversationId, initializeNewChat]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  if (currentView === AppView.WELCOME) {
    return <WelcomeScreen 
              onStartChat={handleStartChatFromWelcome} 
              deferredInstallPrompt={deferredInstallPrompt}
              onInstallPrompted={() => setDeferredInstallPrompt(null)}
              isStandalone={isStandalone}
            />;
  }

  return (
    <div className="flex h-screen bg-rose-50 overflow-hidden">
      {!isSidebarOpen && currentView === AppView.CHAT && (
        <button
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 bg-primary-dark text-white rounded-full shadow-lg hover:bg-primary-dark-hover focus:outline-none focus:ring-2 focus:ring-primary-dark focus:ring-opacity-75"
          aria-label="Abrir menú lateral"
        >
          <MenuIcon className="w-6 h-6" />
        </button>
      )}

      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={toggleSidebar}
        onNewConversation={async () => {
          await initializeNewChat(); 
        }}
        previousConversations={previousConversations}
        onLoadConversation={async (id) => {
            await handleLoadConversation(id);
        }}
        currentConversationId={currentConversationId}
        onDeleteConversation={handleDeleteConversation}
      />
      
      <main className={`flex-1 flex flex-col h-full transition-all duration-300 ease-in-out ${isSidebarOpen && !isMobile ? 'md:ml-72' : 'ml-0'}`}>
        <div className="w-full max-w-7xl mx-auto h-full p-0 sm:p-4 flex">
             <ChatScreen
                messages={messages}
                onSendMessage={handleSendMessage}
                isLoading={isLoading}
                currentView={currentView}
                deferredInstallPrompt={deferredInstallPrompt}
                onInstallPrompted={() => setDeferredInstallPrompt(null)}
                isStandalone={isStandalone}
              />
        </div>
      </main>
      
       {isSidebarOpen && isMobile && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={toggleSidebar}
            aria-hidden="true"
          ></div>
        )}
    </div>
  );
};

export default App;
