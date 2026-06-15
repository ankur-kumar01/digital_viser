import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MessageSquare } from 'lucide-react';
import { gamesAPI } from '../api';

const BOT_USERNAMES = [
  'AviatorKing', 'Sanjay_99', 'RocketGirl', 'MaxBet_Pro', 'LuckyPriya', 
  'Challenger', 'FlightPro', 'WinSeeker', 'StormRider', 'HyperFlyer'
];

const getUserColor = (username: string) => {
  if (username === 'System') return 'var(--accent-primary)';
  const colors = [
    '#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', 
    '#f43f5e', '#06b6d4', '#14b8a6', '#a855f7', '#fb923c'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const AviatorChatWidget: React.FC = () => {
  const [dbChats, setDbChats] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const timeOutsRef = useRef<any[]>([]);

  useEffect(() => {
    // Initial system message
    const now = new Date();
    setChatMessages([
      {
        id: 'system-init',
        username: 'System',
        text: 'Welcome to Aviator Live Chat! ✈️',
        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'system'
      }
    ]);

    gamesAPI.getAviatorChats().then(setDbChats).catch(console.error);

    return () => {
      timeOutsRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const addMessage = useCallback(() => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let text = 'is baar flying high jayega 🚀';
    let botUser = BOT_USERNAMES[Math.floor(Math.random() * BOT_USERNAMES.length)];
    
    if (dbChats && dbChats.length > 0) {
      const randomChat = dbChats[Math.floor(Math.random() * dbChats.length)];
      text = randomChat.message_text;
      botUser = randomChat.user_name;
    }

    setChatMessages(prev => {
      const newMsgs = [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        username: botUser,
        text,
        time: timeStr,
        type: 'bot'
      }];
      return newMsgs.slice(-30); // keep last 30
    });
  }, [dbChats]);

  useEffect(() => {
    if (dbChats.length === 0) return;
    
    const interval = setInterval(() => {
      addMessage();
    }, 2500 + Math.random() * 2000); // 2.5s to 4.5s
    
    return () => clearInterval(interval);
  }, [dbChats, addMessage]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollTop = chatEndRef.current.scrollHeight;
    }
  }, [chatMessages]);

  return (
    <div style={{ marginTop: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <MessageSquare size={20} color="#f59e0b" />
        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0 }}>Aviator Live Chat</h3>
      </div>
      
      <div className="glass-card glow-card" style={{ 
        padding: 0, 
        overflow: 'hidden', 
        height: '300px', 
        display: 'flex', 
        flexDirection: 'column',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-glass)'
      }}>
        {/* Chat Header */}
        <div style={{ 
          padding: '12px 16px', 
          borderBottom: '1px solid var(--border-glass)',
          background: 'rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ 
            width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-secondary)', 
            boxShadow: '0 0 8px var(--accent-secondary)', animation: 'pulse 2s infinite' 
          }}></span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Live Players ({Math.floor(800 + Math.random() * 200)})</span>
        </div>

        {/* Chat Messages */}
        <div 
          ref={chatEndRef}
          style={{ 
            flex: 1, 
            overflowY: 'auto', 
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}
        >
          {chatMessages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ 
                  color: getUserColor(msg.username), 
                  fontWeight: 700, 
                  fontSize: '0.85rem',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}>
                  {msg.username}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>{msg.time}</span>
              </div>
              <div style={{ 
                background: msg.type === 'system' ? 'rgba(34, 197, 94, 0.1)' : 'var(--bg-tertiary)', 
                padding: '8px 12px', 
                borderRadius: '0 12px 12px 12px',
                fontSize: '0.9rem',
                color: msg.type === 'system' ? 'var(--accent-secondary)' : 'var(--text-primary)',
                border: msg.type === 'system' ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid var(--border-glass)',
                width: 'fit-content',
                maxWidth: '90%',
                wordBreak: 'break-word'
              }}>
                {msg.text}
              </div>
            </div>
          ))}
        </div>
        
        {/* Fake Chat Input */}
        <div style={{ 
          padding: '12px', 
          borderTop: '1px solid var(--border-glass)',
          background: 'rgba(0,0,0,0.2)'
        }}>
          <div style={{ 
            background: 'var(--bg-tertiary)', 
            border: '1px solid var(--border-glass)',
            padding: '10px 16px',
            borderRadius: '20px',
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            Join the game to chat...
          </div>
        </div>
      </div>
    </div>
  );
};
