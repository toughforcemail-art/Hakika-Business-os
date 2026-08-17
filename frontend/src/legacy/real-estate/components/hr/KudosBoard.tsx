// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Award, Heart, Star, Zap, Trash2, Send } from 'lucide-react';
import { supabase } from '../../utils/supabase';
import GiveKudosModal from './GiveKudosModal';

interface Kudos {
  id: string;
  sender_id: string;
  receiver_id: string;
  message: string;
  category: string;
  created_at: string;
  sender: { full_name: string; avatar_url: string };
  receiver: { full_name: string; avatar_url: string };
}

const KudosBoard: React.FC = () => {
  const [kudosList, setKudosList] = useState<Kudos[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
    fetchKudos();

    const channel = supabase
      .channel('kudos_updates')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'hr_kudos' },
        () => fetchKudos()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchKudos = async () => {
    try {
      const { data, error } = await supabase
        .from('hr_kudos')
        .select(`
          *,
          sender:profiles!hr_kudos_sender_id_fkey(full_name, avatar_url),
          receiver:profiles!hr_kudos_receiver_id_fkey(full_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setKudosList(data || []);
    } catch (error) {
      console.error('Error fetching kudos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Teamwork': return <Users size={16} className="text-blue-500" />;
      case 'Excellence': return <Star size={16} className="text-yellow-500" />;
      case 'Integrity': return <Award size={16} className="text-purple-500" />;
      case 'Innovation': return <Zap size={16} className="text-orange-500" />;
      default: return <Heart size={16} className="text-rose-500" />;
    }
  };

  return (
    <div className="bg-white dark:bg-dark-surface rounded-[2.5rem] border border-gray-100 dark:border-dark-border shadow-sm overflow-hidden">
      <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[#333] dark:text-white flex items-center gap-2">
            <Award className="text-[#ff6a00]" size={24} />
            Peer Recognition Board
          </h2>
          <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">Celebrating our team's excellence</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-[#ff6a00] text-white text-xs font-black uppercase tracking-tight shadow-lg shadow-[#ff6a00]/30 hover:shadow-[#ff6a00]/50 transition-all"
        >
          <Send size={14} /> Give Kudos
        </button>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ff6a00]"></div>
          </div>
        ) : kudosList.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-gray-100 dark:border-white/5 rounded-[2rem]">
            <Heart size={48} className="mx-auto text-gray-200 mb-4" />
            <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No kudos recorded yet. Be the first to recognize a colleague!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {kudosList.map((kudo) => (
              <div key={kudo.id} className="relative group bg-gray-50/50 dark:bg-white/5 p-6 rounded-[2rem] border border-transparent hover:border-[#ff6a00]/20 transition-all">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white dark:bg-dark-surface border border-gray-100 dark:border-white/10 flex items-center justify-center text-[#ff6a00] font-black text-lg shadow-sm">
                    {kudo.receiver?.full_name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-black text-[#ff6a00] uppercase tracking-tighter">To: {kudo.receiver?.full_name}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{new Date(kudo.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="px-2.5 py-1 rounded-full bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                        {getCategoryIcon(kudo.category)}
                        {kudo.category}
                      </span>
                    </div>
                    <p className="text-sm text-[#333] dark:text-gray-300 italic font-medium">"{kudo.message}"</p>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 flex items-center gap-2">
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">From:</span>
                       <span className="text-[10px] font-black text-gray-600 dark:text-gray-400 uppercase">{kudo.sender?.full_name}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isModalOpen && (
        <GiveKudosModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          onSuccess={() => {
            fetchKudos();
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

// Internal Users import for getCategoryIcon
const Users = ({ size, className }: { size: number; className?: string }) => <Award size={size} className={className} />;

export default KudosBoard;
