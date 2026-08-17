// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { X, Award, Star, Zap, Heart, Users, Loader2 } from 'lucide-react';
import { supabase } from '../../utils/supabase';

interface Profile {
  id: string;
  full_name: string;
  company_code?: string;
}

interface GiveKudosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CATEGORIES = [
  { name: 'Teamwork', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
  { name: 'Excellence', icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  { name: 'Integrity', icon: Award, color: 'text-purple-500', bg: 'bg-purple-50' },
  { name: 'Innovation', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' },
];

const GiveKudosModal: React.FC<GiveKudosModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    receiver_id: '',
    message: '',
    category: 'Teamwork',
  });
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_code')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        setCurrentProfile(profile);
        const { data: colleagues } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('company_code', profile.company_code)
          .neq('id', profile.id)
          .order('full_name');
        
        setProfiles(colleagues || []);
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.receiver_id || !formData.message || !currentProfile) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from('hr_kudos').insert([
        {
          sender_id: currentProfile.id,
          receiver_id: formData.receiver_id,
          message: formData.message,
          category: formData.category,
          company_code: currentProfile.company_code,
        },
      ]);

      if (error) throw error;
      onSuccess();
    } catch (error) {
      console.error('Error submitting kudos:', error);
      alert('Failed to send kudos. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-dark-surface w-full max-w-lg rounded-[2.5rem] border border-gray-100 dark:border-dark-border shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="p-8 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50 dark:bg-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#ff6a00]/10 flex items-center justify-center text-[#ff6a00]">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[#333] dark:text-white">Give Kudos</h2>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Recognize a colleague's impact</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl transition-colors text-gray-400"
            title="Close"
            aria-label="Close"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Receiver Selection */}
          <div className="space-y-2">
            <label htmlFor="colleague-select" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Select Colleague</label>
            <select
              id="colleague-select"
              title="Select colleague to recognize"
              required
              value={formData.receiver_id}
              onChange={(e) => setFormData({ ...formData, receiver_id: e.target.value })}
              className="w-full px-5 py-4 bg-gray-50 dark:bg-white/5 border border-transparent focus:border-[#ff6a00]/30 rounded-2xl outline-none text-sm font-bold text-[#333] dark:text-white transition-all appearance-none"
            >
              <option value="">Choose someone...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Choose a Vibe</label>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  title={`Select ${cat.name} category`}
                  onClick={() => setFormData({ ...formData, category: cat.name })}
                  className={`p-4 rounded-2xl border-2 transition-all flex items-center gap-3 ${
                    formData.category === cat.name
                      ? 'border-[#ff6a00] bg-[#ff6a00]/5'
                      : 'border-transparent bg-gray-50 dark:bg-white/5 opacity-50'
                  }`}
                >
                  <cat.icon size={20} className={cat.color} aria-hidden="true" />
                  <span className={`text-xs font-black uppercase tracking-tighter ${formData.category === cat.name ? 'text-[#ff6a00]' : 'text-gray-400'}`}>
                    {cat.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <label htmlFor="kudos-message" className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Your Message</label>
            <textarea
              id="kudos-message"
              title="Enter recognitions message"
              required
              placeholder="Tell them why they're awesome..."
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              rows={4}
              className="w-full px-5 py-4 bg-gray-50 dark:bg-white/5 border border-transparent focus:border-[#ff6a00]/30 rounded-2xl outline-none text-sm font-medium text-[#333] dark:text-white transition-all resize-none shadow-inner"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex gap-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-6 py-4 rounded-2xl border border-gray-200 dark:border-dark-border text-gray-500 font-black text-xs uppercase tracking-widest hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
              title="Cancel and close"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !formData.receiver_id || !formData.message}
              className="flex-[2] py-4 bg-[#ff6a00] text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#ff6a00]/30 hover:shadow-[#ff6a00]/50 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
              title="Send Recognition"
            >
              {submitting ? <Loader2 className="animate-spin" size={16} aria-hidden="true" /> : <Heart size={16} className="group-hover:scale-125 transition-transform" aria-hidden="true" />}
              Send Recognition
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default GiveKudosModal;
