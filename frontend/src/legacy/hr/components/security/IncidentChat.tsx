// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Clock, Image as ImageIcon, X } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Message {
  id: string;
  incident_id: string;
  sender_id: string;
  message: string;
  media_url?: string;
  created_at: string;
  profiles?: {
    full_name: string;
    avatar_url: string;
  };
}

interface IncidentChatProps {
  incidentId: string;
  onClose?: () => void;
}

const IncidentChat: React.FC<IncidentChatProps> = ({ incidentId, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel(`incident_chat_${incidentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sec_incident_messages',
          filter: `incident_id=eq.${incidentId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          // Fetch profile for the new message
          fetchMessageWithProfile(newMessage.id).then((msg) => {
            if (msg) setMessages((prev) => [...prev, msg]);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidentId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('sec_incident_messages')
        .select('*, profiles(full_name, avatar_url)')
        .eq('incident_id', incidentId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageWithProfile = async (messageId: string) => {
    const { data } = await supabase
      .from('sec_incident_messages')
      .select('*, profiles(full_name, avatar_url)')
      .eq('id', messageId)
      .single();
    return data;
  };

  const handleSendMessage = async (e?: React.FormEvent | React.MouseEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !currentUserId) return;

    try {
      const { error } = await supabase.from('sec_incident_messages').insert([
        {
          incident_id: incidentId,
          sender_id: currentUserId,
          message: newMessage.trim(),
        },
      ]);

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  return (
    <div className="flex flex-col h-[500px] bg-white dark:bg-dark-surface rounded-2xl border border-gray-100 dark:border-dark-border shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Tactical Comms</h3>
            <p className="text-[10px] text-gray-500 uppercase font-black">Incident ID: {incidentId.slice(0, 8)}</p>
          </div>
        </div>
        {onClose && (
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-xl transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30 dark:bg-transparent">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-30 text-center px-8">
            <Send size={48} className="mb-4" />
            <p className="text-xs font-bold uppercase tracking-widest">No messages yet. Start the coordination.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] ${msg.sender_id === currentUserId ? 'order-2' : ''}`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-black text-gray-400 uppercase">{msg.profiles?.full_name || 'Officer'}</span>
                  <span className="text-[8px] text-gray-300 font-mono">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className={`p-3 rounded-2xl text-sm ${
                  msg.sender_id === currentUserId 
                    ? 'bg-rose-500 text-white rounded-tr-none shadow-lg shadow-rose-500/20' 
                    : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-200 rounded-tl-none border border-gray-200 dark:border-white/10'
                }`}>
                  {msg.message}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/5">
        <div className="flex items-center gap-2 bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 shadow-inner">
          <button 
              className="p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              title="Attach Image"
              aria-label="Attach Image"
            >
              <ImageIcon size={20} aria-hidden="true" />
            </button>
          <input
              id="chat-input"
              title="Type a message"
              aria-label="Type a message"
              type="text"
              placeholder="Type a message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 text-gray-900 dark:text-white placeholder-gray-400"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:grayscale transition-all"
              title="Send Message"
              aria-label="Send Message"
            >
              <Send size={18} aria-hidden="true" />
            </button>
        </div>
      </form>
    </div>
  );
};

export default IncidentChat;
