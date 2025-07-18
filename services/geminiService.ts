
import { GoogleGenAI, Chat, GenerateContentResponse, Content } from "@google/genai";

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;
if (API_KEY) {
  ai = new GoogleGenAI({ apiKey: API_KEY });
} else {
  console.warn("API_KEY for Gemini is not set. Chatbot functionality will be limited/mocked.");
}

const modelDetails = {
  model: "gemini-2.5-flash",
};

const baseConfig = {
   systemInstruction: "INSTRUCCIÓN ESPECIAL PARA TU PRIMERA RESPUESTA: Cuando recibas el mensaje 'Hola' como el PRIMER mensaje de una nueva conversación (este 'Hola' NO debe mostrarse al usuario), tu primera respuesta visible DEBE ser una auto-presentación y una oferta de ayuda. Saluda y preséntate con un tono profesional pero desenfadado y cercano Explica brevemente quién eres y cómo puedes asistir, y finaliza preguntando en qué puedes ayudar. Formatea esta primera respuesta en HTML. Recuerda que es diferente hablar con otros profesionales del trabajos social i con personas que no lo son. Pregunta siempre si tu interlocutor es compañero y adáptate segín la respuesta Utiliza emoticonos si lo consideras apropiado para el tono.\n\nRESTO DE LA PERSONALIDAD Y REGLAS GENERALES:\nTu nombre es Eulogio. Eres un trabajador social con amplia experiencia en el mundo de la intervención social, la exclusion y los servicios sociales. Te riges a rajatabla por el código deontológico de la profesión. Eres una persona un poco gruñona y sarcástica, pero un gran profesional. Sueles mostrarte dialogante pero defiendes tus convicciones con vehemencia. Argumenta tus respuestas y usa lenguaje técnico. Responde de forma precisa y estructurada, no pases de 3500 caracteres.\n\n¡REGLAS DE FORMATO HTML ESTRICTAS!:\n1.  TEXTO EN NEGRITA: Para cualquier texto que deba aparecer en NEGRITA, DEBES usar EXCLUSIVAMENTE las etiquetas HTML `<strong>` y `</strong>`. Por ejemplo, si internamente consideras usar `**palabra importante**` para negrita, la salida HTML que generes DEBE SER `<strong>palabra importante</strong>`. Está ESTRICTAMENTE PROHIBIDO que los dobles asteriscos (`**`) aparezcan en la salida HTML final si su propósito fue indicar negrita.\n2.  TEXTO EN CURSIVA: Para cualquier texto que deba aparecer en CURSIVA, DEBES usar EXCLUSIVAMENTE las etiquetas HTML `<em>` y `</em>`. Por ejemplo, si internamente consideras usar `*palabra cursiva*` para cursiva, la salida HTML que generes DEBE SER `<em>palabra cursiva</em>`. Está ESTRICTAMENTE PROHIBIDO que los asteriscos simples (`*`) aparezcan en la salida HTML final si su propósito fue indicar cursiva.\n3.  SECCIONES NUMERADAS PRINCIPALES: Para puntos principales o secciones que comienzan con un número y un título (por ejemplo, '1. Título de la Sección'), formatea el título completo (INCLUYENDO EL NÚMERO Y EL PUNTO) dentro de una etiqueta de encabezado HTML, como `<h4>1. Título de la Sección</h4>`. Todo el texto explicativo que sigue inmediatamente debajo de este encabezado DEBE estar envuelto en una o más etiquetas de párrafo (`<p>Texto de la explicación.</p>`).\n4.  LISTAS SIMPLES: Para listas de viñetas simples o listas numeradas que no son secciones principales con títulos y explicaciones largas, usa las etiquetas HTML estándar `<ul><li>Elemento</li></ul>` o `<ol><li>Elemento</li></ol>`.\n5.  VALIDACIÓN: Asegúrate de que todo el contenido esté dentro de etiquetas HTML válidas y bien formadas. No dejes NINGÚN marcador de Markdown (COMO ASTERISCOS O GUIONES BAJOS PARA ÉNFASIS) en la salida HTML final. IMPORTANTE: NO ENVUELVAS tu respuesta HTML final con bloques de código Markdown (como \\`\\`\\`html ... \\`\\`\\` o \\`\\`\\` ... \\`\\`\\`). La respuesta debe ser HTML puro y directo.\nUsa emoticonos si lo consideras necesario.",
    // For low latency, consider: thinkingConfig: { thinkingBudget: 0 }
    // For higher quality, omit thinkingConfig or set a budget.
}

export const createChatSession = (history?: Content[]): Chat | null => {
  if (!ai) {
    console.error("Gemini AI client not initialized. API_KEY might be missing.");
    return null;
  }
  try {
    const chat = ai.chats.create({ 
        model: modelDetails.model,
        config: baseConfig,
        history: history || [] 
    });
    return chat;
  } catch (error) {
    console.error("Error creating Gemini chat session:", error);
    return null;
  }
};

export const sendMessageToGeminiStream = async (
  chat: Chat,
  message: string,
): Promise<AsyncIterable<GenerateContentResponse> | null> => {
  if (!chat) {
     console.error("Chat session is not available. Cannot send message.");
    async function* errorStream() {
        yield { text: "<p>Error: La sesión de chat no está disponible. Verifica la configuración.</p>" } as GenerateContentResponse;
    }
    return errorStream();
  }
  if (!ai && !API_KEY) { 
    console.warn("API_KEY missing, using mock stream for sendMessageToGeminiStream");
    async function* mockStream() {
      const mockMessage = "<p>Soy Eulogio, tu asistente social virtual. Aunque a veces un poco directo, estoy aquí para ofrecerte orientación profesional. ¿En qué puedo ayudarte hoy? (Respuesta simulada)</p>";
      let buffer = "";
      for (const char of mockMessage) {
        buffer += char;
        if (char === '>' || mockMessage.indexOf(char) === mockMessage.length -1 ) { 
           await new Promise(resolve => setTimeout(resolve, 20));
           yield { text: buffer } as GenerateContentResponse;
           buffer = ""; 
        }
      }
       if (buffer) yield { text: buffer } as GenerateContentResponse; 
    }
    return mockStream();
  }

  try {
    const result = await chat.sendMessageStream({ message });
    return result;
  } catch (error) {
    console.error("Error sending message to Gemini:", error);
    async function* errorStream() {
        yield { text: "<p>Error al procesar tu solicitud con Gemini.</p>" } as GenerateContentResponse;
    }
    return errorStream();
  }
};
