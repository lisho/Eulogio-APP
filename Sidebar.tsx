
import React from 'react';
import { StoredConversation } from '../types';
import ChevronLeftIcon from './icons/ChevronLeftIcon'; 
import PlusIcon from './icons/PlusIcon';
import TrashIcon from './icons/TrashIcon'; 

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void; 
  onNewConversation: () => Promise<void>;
  previousConversations: StoredConversation[];
  onLoadConversation: (conversationId: string) => Promise<void>;
  currentConversationId: string | null;
  onDeleteConversation: (conversationId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onNewConversation,
  previousConversations,
  onLoadConversation,
  currentConversationId,
  onDeleteConversation,
}) => {
  return (
    <>
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-72 flex-shrink-0 transform flex-col border-r border-rose-200 bg-white shadow-lg transition-transform duration-300 ease-in-out 
                  ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Barra lateral de conversaciones"
      >
        {/* Header */}
        <div className="flex items-center justify-end p-4 border-b border-rose-100 bg-primary-dark text-white flex-shrink-0 h-[68px]">
          <button
            onClick={onToggle}
            className="p-1 text-white hover:bg-white/20 rounded-full focus:outline-none"
            aria-label="Contraer menú lateral"
          >
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Avatar and Name Section */}
        <div className="flex flex-col items-center p-4 pt-6 flex-shrink-0 border-b border-rose-100">
          <img
            src="/avatar-eulogio.jpg"
            alt="Eulogio Avatar"
            className="w-32 h-32 rounded-full mb-2 border-2 border-rose-200 shadow-sm"
          />
          <span className="text-lg font-semibold text-primary-dark mb-3">Eulogio</span>
        </div>

        {/* New Conversation Button */}
        <div className="p-4 flex-shrink-0">
          <button
            onClick={async () => {
              await onNewConversation();
            }}
            className="w-full flex items-center justify-center space-x-2 bg-primary-dark hover:bg-primary-dark-hover text-white font-medium py-2.5 px-4 rounded-lg shadow hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 ring-offset-2 ring-primary-dark"
          >
            <PlusIcon className="w-5 h-5"/>
            <span>Nueva Conversación</span>
          </button>
        </div>

        {/* Previous Conversations List */}
        <nav className="flex-grow p-4 pt-2 space-y-1 overflow-y-auto custom-scrollbar">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Historial</h3>
          {previousConversations.length === 0 && (
            <p className="text-sm text-gray-400 px-2">No hay conversaciones anteriores.</p>
          )}
          {previousConversations.sort((a, b) => b.timestamp - a.timestamp).map((conv) => {
            const convDate = new Date(conv.timestamp).toLocaleDateString('es-ES', {
              day: 'numeric', // '2-digit' or 'numeric'
              month: 'short', // 'short' (e.g., "jul.") or 'long' or 'numeric'
              year: 'numeric' // 'numeric' or '2-digit'
            });
            const convTime = new Date(conv.timestamp).toLocaleTimeString('es-ES', {
              hour: '2-digit',
              minute: '2-digit'
            });
            const fallbackName = `Chat (${convDate}, ${convTime})`;

            return (
              <div key={conv.id} className="flex items-center justify-between group space-x-1">
                <button
                  onClick={async () => {
                    await onLoadConversation(conv.id);
                  }}
                  className={`flex-grow text-left px-3 py-2 rounded-md transition-colors duration-150 w-full overflow-hidden min-w-0 ${
                    conv.id === currentConversationId
                      ? 'bg-rose-100 text-primary-dark'
                      : 'text-gray-700 hover:bg-rose-50 hover:text-primary-dark'
                  }`}
                  title={`${conv.name || fallbackName} - ${convDate} ${convTime}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">
                      {conv.name || fallbackName}
                    </span>
                    <span className={`text-xs mt-0.5 ${
                       conv.id === currentConversationId ? 'text-primary-dark/80' : 'text-gray-500 group-hover:text-primary-dark/70'
                    }`}>
                      {convDate} - {convTime}
                    </span>
                  </div>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation(); 
                    onDeleteConversation(conv.id);
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-100 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 ml-1 flex-shrink-0 self-center"
                  aria-label={`Borrar conversación: ${conv.name || fallbackName }`}
                  title={`Borrar conversación: ${conv.name || fallbackName }`}
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </nav>

        {/* Footer/Placeholder */}
        <div className="p-4 border-t border-rose-100 mt-auto flex-shrink-0">
          <p className="text-xs text-gray-400 text-center">&copy; Asistente Virtual</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
