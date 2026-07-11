import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, CheckCircle, Droplet, UserCheck, Inbox, FileText, ConciergeBell } from 'lucide-react';
import { WaiterRequest } from '../../types';

interface CallWaiterModalProps {
  onClose: () => void;
}

export const CallWaiterModal: React.FC<CallWaiterModalProps> = ({ onClose }) => {
  const { callWaiter, tableId } = useApp();
  const [submitted, setSubmitted] = useState(false);
  const [selectedType, setSelectedType] = useState<WaiterRequest['requestType'] | null>(null);

  const requestOptions: { type: WaiterRequest['requestType']; label: string; icon: React.ReactNode; desc: string }[] = [
    { 
      type: 'Water', 
      label: 'Need Water', 
      icon: <Droplet className="text-blue-500" size={24} />,
      desc: 'Request table water glass refills' 
    },
    { 
      type: 'Cutlery', 
      label: 'Need Cutlery', 
      icon: <Inbox className="text-orange-500" size={24} />,
      desc: 'Spoons, forks, knives, or chopsticks' 
    },
    { 
      type: 'Tissue', 
      label: 'Need Tissue', 
      icon: <FileText className="text-purple-500" size={24} />,
      desc: 'Napkins, tissues, or wet wipes' 
    },
    { 
      type: 'Call Waiter', 
      label: 'Call Waiter', 
      icon: <UserCheck className="text-emerald-500" size={24} />,
      desc: 'Paging a waiter to your table' 
    },
    { 
      type: 'Request Bill', 
      label: 'Request Bill', 
      icon: <ConciergeBell className="text-rose-500" size={24} />,
      desc: 'Check out and get printed receipt' 
    },
  ];

  const handleRequest = async (type: WaiterRequest['requestType']) => {
    setSelectedType(type);
    await callWaiter(type);
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in">
      <div className="absolute inset-0" onClick={onClose}></div>

      <div className="relative w-full max-w-[400px] bg-white rounded-3xl overflow-hidden shadow-2xl p-6 z-10 animate-slide-up">
        {/* Close Button */}
        {!submitted && (
          <button 
            onClick={onClose} 
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors"
          >
            <X size={16} />
          </button>
        )}

        {!submitted ? (
          <div>
            <h2 className="text-xl font-bold text-brand-text mb-1 flex items-center gap-2">
              <ConciergeBell className="text-primary" />
              <span>Table {tableId} Services</span>
            </h2>
            <p className="text-gray-500 text-sm mb-6">How can we assist you today?</p>

            <div className="space-y-3">
              {requestOptions.map((opt) => (
                <button
                  key={opt.type}
                  onClick={() => handleRequest(opt.type)}
                  className="w-full flex items-center gap-4 p-4 border border-gray-100 bg-gray-50 hover:bg-white hover:border-primary/20 rounded-2xl text-left transition-all active:scale-[0.98]"
                >
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    {opt.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-brand-text text-sm">{opt.label}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <div className="w-20 h-20 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-5 animate-pulse">
              <CheckCircle size={48} fill="rgba(16, 185, 129, 0.1)" />
            </div>
            <h2 className="text-2xl font-bold text-brand-text mb-2">Request Sent!</h2>
            <p className="text-gray-500 text-sm leading-relaxed max-w-[280px] mx-auto mb-6">
              Your request for <strong className="text-brand-text">"{selectedType}"</strong> has been dispatched to the waiters. Someone will attend to Table {tableId} shortly.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-primary text-white font-bold py-3.5 px-6 rounded-full hover:bg-primary-hover transition-colors shadow-lg shadow-primary/10"
            >
              Back to Menu
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
