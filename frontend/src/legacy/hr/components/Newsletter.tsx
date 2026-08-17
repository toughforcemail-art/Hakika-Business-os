// @ts-nocheck
import React, { useState } from 'react';
import { Mail, Send, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendMarketingEmail } from '../services/marketingInbox';

const Newsletter: React.FC = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      await sendMarketingEmail({
        subject: 'New HAKIKA newsletter subscriber',
        fields: [
          { label: 'Subscriber Email', value: email },
          { label: 'Source', value: 'Website footer newsletter' },
        ],
      });
      setStatus('success');
      setEmail('');
      setTimeout(() => setStatus('idle'), 3000);
    } catch (error) {
      console.error('Newsletter signup failed:', error);
      setStatus('error');
      setErrorMessage('We could not capture your subscription right now. Please try again or use the contact page.');
    }
  };

  return (
    <div className="w-full py-20 bg-gray-50 dark:bg-[#0b1b2b] relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-white/10 to-transparent"></div>
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[400px] h-[400px] bg-brand-purple/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] bg-pink-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-12 bg-white dark:bg-dark-surface p-8 md:p-12 rounded-[40px] shadow-2xl border border-gray-100 dark:border-white/5">
          <div className="flex-1 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-purple/10 text-brand-purple text-[10px] font-black uppercase tracking-widest mb-6">
              <Sparkles size={14} />
              Stay in the flow
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900 dark:text-white mb-4 leading-tight">
              Operational intelligence, delivered <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-purple to-pink-600">to your inbox.</span>
            </h2>
            <p className="text-gray-600 dark:text-gray-400 font-medium">
              Join 5,000+ operations leaders receiving curated insights on HR, Security, and Hub automation.
            </p>
          </div>

          <div className="w-full md:w-auto min-w-[320px]">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-purple transition-colors" />
                <input 
                  type="email" 
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-brand-purple outline-none text-sm transition-all text-gray-900 dark:text-white"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={status === 'loading'}
                className="w-full group relative overflow-hidden bg-gray-900 dark:bg-white text-white dark:text-black py-4 rounded-2xl font-black text-xs uppercase tracking-[2px] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-brand-purple/20 disabled:opacity-70"
              >
                <div className="absolute inset-0 bg-brand-purple opacity-0 group-hover:opacity-10 transition-opacity"></div>
                <div className="relative flex items-center justify-center gap-3">
                  <AnimatePresence mode="wait">
                    {status === 'idle' && (
                      <motion.div 
                        key="idle" 
                        initial={{ opacity: 0, y: 10 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        exit={{ opacity: 0, y: -10 }}
                        className="flex items-center gap-2"
                      >
                        Subscribe Now <Send size={16} />
                      </motion.div>
                    )}
                    {status === 'loading' && (
                      <motion.div 
                        key="loading" 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        className="flex items-center gap-2"
                      >
                         <Loader2 size={16} className="animate-spin" /> Processing...
                      </motion.div>
                    )}
                    {status === 'success' && (
                      <motion.div 
                        key="success" 
                        initial={{ opacity: 0, scale: 0.8 }} 
                        animate={{ opacity: 1, scale: 1 }} 
                        className="flex items-center gap-2 text-green-500"
                      >
                        <CheckCircle2 size={16} /> Subscribed!
                      </motion.div>
                    )}
                    {status === 'error' && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 text-red-500"
                      >
                        Try again <Send size={16} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </button>
              {errorMessage && (
                <p className="text-center text-xs font-medium text-red-500">{errorMessage}</p>
              )}
              
              <p className="text-[10px] text-center text-gray-400 font-bold uppercase tracking-wider">
                NO SPAM. ONLY PURE VALUE. UNSUBSCRIBE ANYTIME.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Newsletter;
