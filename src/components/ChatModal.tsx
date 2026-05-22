import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Send, X, MessageSquare, ShieldAlert } from 'lucide-react';

interface Message {
  id: string;
  item_id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  created_at: string;
}

interface ChatModalProps {
  itemId: string;
  itemTitle: string;
  reporterId: string;
  reporterName: string;
  currentUser: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ChatModal({
  itemId,
  itemTitle,
  reporterId,
  reporterName,
  currentUser,
  isOpen,
  onClose
}: ChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isSandbox = currentUser?.uid === 'demo-student-123';

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  // Load Messages
  useEffect(() => {
    if (!isOpen || !itemId) return;

    setLoading(true);

    if (isSandbox) {
      // LocalStorage Sandbox Flow
      const localMsgs = localStorage.getItem(`lostlink_chat_${itemId}`);
      if (localMsgs) {
        setMessages(JSON.parse(localMsgs));
      } else {
        // Initial welcome message from the reporter
        const welcomeMsg: Message = {
          id: 'welcome-msg',
          item_id: itemId,
          sender_id: reporterId,
          sender_name: reporterName,
          content: `Hi! Thanks for reaching out regarding "${itemTitle}". Let's coordinate here.`,
          created_at: new Date().toISOString()
        };
        setMessages([welcomeMsg]);
        localStorage.setItem(`lostlink_chat_${itemId}`, JSON.stringify([welcomeMsg]));
      }
      setLoading(false);
      
      // Setup local storage polling / listening for sandbox coordination
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === `lostlink_chat_${itemId}` && e.newValue) {
          setMessages(JSON.parse(e.newValue));
        }
      };
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    } else {
      // Live Supabase Flow
      const fetchMessages = async () => {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('item_id', itemId)
          .order('created_at', { ascending: true });

        if (!error && data) {
          setMessages(data);
        }
        setLoading(false);
      };

      fetchMessages();

      // Subscribe to real-time chat updates
      const channel = supabase
        .channel(`chat-${itemId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `item_id=eq.${itemId}`
        }, (payload: any) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, itemId, isSandbox, reporterId, reporterName, itemTitle]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const currentMsgContent = newMessage.trim();
    setNewMessage('');

    if (isSandbox) {
      // Sandbox implementation
      const newMsg: Message = {
        id: `sandbox-${Date.now()}`,
        item_id: itemId,
        sender_id: currentUser.uid,
        sender_name: currentUser.displayName || 'Demo Student',
        content: currentMsgContent,
        created_at: new Date().toISOString()
      };
      
      const updatedMsgs = [...messages, newMsg];
      setMessages(updatedMsgs);
      localStorage.setItem(`lostlink_chat_${itemId}`, JSON.stringify(updatedMsgs));

      // Simulate a quick AI reply in Sandbox Mode if user sent a message
      if (currentUser.uid !== reporterId) {
        setTimeout(() => {
          const aiReplies = [
            "Sure! Where and when would you like to meet?",
            "Sounds good, I will head over there now.",
            "Awesome, thank you so much for returning it!",
            "I'm at the Library building right now if you are free.",
          ];
          const randomReply = aiReplies[Math.floor(Math.random() * aiReplies.length)];
          const replyMsg: Message = {
            id: `sandbox-reply-${Date.now()}`,
            item_id: itemId,
            sender_id: reporterId,
            sender_name: reporterName,
            content: randomReply,
            created_at: new Date().toISOString()
          };
          const finalMsgs = [...updatedMsgs, replyMsg];
          setMessages(finalMsgs);
          localStorage.setItem(`lostlink_chat_${itemId}`, JSON.stringify(finalMsgs));
        }, 1200);
      }
    } else {
      // Live Supabase implementation
      const newMsg = {
        item_id: itemId,
        sender_id: currentUser.uid,
        sender_name: currentUser.displayName || 'Anonymous',
        content: currentMsgContent
      };

      const { error } = await supabase
        .from('messages')
        .insert([newMsg]);

      if (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-3xl w-full max-w-lg h-[600px] flex flex-col shadow-2xl border border-natural-light overflow-hidden animate-scale-up">
        
        {/* Header */}
        <div className="p-5 border-b border-natural-light bg-natural-cream flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-sage/10 p-2.5 rounded-xl text-sage">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-natural-dark text-base leading-tight truncate max-w-[260px]">{itemTitle}</h3>
              <p className="text-xs text-natural-muted">Coordinating with <span className="font-semibold text-sage">{reporterName}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-natural-muted hover:text-natural-dark p-2 hover:bg-natural-light rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sandbox Indicator Banner */}
        {isSandbox && (
          <div className="bg-sage/10 text-sage-dark px-5 py-2 text-xs font-semibold flex items-center gap-1.5 border-b border-sage/10">
            <ShieldAlert className="w-4 h-4 text-sage" />
            Demo Sandbox Mode Active: Simulated messaging.
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#f8f6f0]">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-sage border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-natural-muted">
              <MessageSquare className="w-10 h-10 mb-2 opacity-50 text-sage" />
              <p className="text-sm font-semibold">No messages yet.</p>
              <p className="text-xs">Start coordinating the return below!</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isCurrentUser = msg.sender_id === currentUser?.uid;
              return (
                <div 
                  key={msg.id}
                  className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-natural-muted mb-1 px-1">{msg.sender_name}</span>
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                    isCurrentUser 
                      ? 'bg-sage text-white rounded-tr-none' 
                      : 'bg-white text-natural-dark border border-natural-light rounded-tl-none'
                  }`}>
                    <p className="leading-normal break-words">{msg.content}</p>
                    <span className={`block text-[9px] text-right mt-1.5 ${
                      isCurrentUser ? 'text-sage-light' : 'text-natural-muted'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form onSubmit={handleSendMessage} className="p-4 border-t border-natural-light bg-white flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message to coordinate..."
            className="flex-1 px-4 py-3 rounded-xl border border-natural-light text-sm focus:outline-none focus:border-sage focus:ring-1 focus:ring-sage bg-natural-cream text-natural-dark transition-shadow"
          />
          <button
            type="submit"
            className="bg-sage text-white p-3 rounded-xl hover:bg-sage-dark transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
            disabled={!newMessage.trim()}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>

      </div>
    </div>
  );
}
