import React from 'react';
import { tokens } from '../../design/tokens';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
  hoverEffect?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, className = '', noPadding = false, hoverEffect = false }) => {
  return (
    <div className={`
      rounded-2xl 
      ${tokens.effects.glass} 
      ${hoverEffect ? 'hover:scale-[1.01] hover:shadow-lg transition-transform duration-300' : ''}
      ${noPadding ? '' : tokens.layout.cardPadding}
      ${className}
    `}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({ title, subtitle, action }) => (
  <div className="flex justify-between items-start mb-6">
    <div>
      <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
      {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);
