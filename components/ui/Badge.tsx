import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'primary';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const styles = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
    info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    primary: "bg-primary/10 text-primary border-primary/20",
    neutral: "bg-gray-700/30 text-gray-400 border-gray-700/50",
  };

  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-semibold border ${styles[variant]} ${className} whitespace-nowrap`}>
      {children}
    </span>
  );
};