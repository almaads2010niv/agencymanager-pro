import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, variant = 'primary', isLoading, icon, className = '', ...props 
}) => {
  
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0B1121] disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variants = {
    primary: "bg-primary text-black hover:bg-primary-glow shadow-glow-primary border border-transparent focus:ring-primary",
    secondary: "bg-surface/50 text-white border border-white/10 hover:bg-surface hover:border-white/20 focus:ring-gray-500",
    danger: "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 focus:ring-danger",
    ghost: "bg-transparent text-gray-400 hover:text-white hover:bg-white/5",
    icon: "p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full"
  };

  const sizes = variant === 'icon' ? '' : 'px-4 py-2.5 text-sm';

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
      ) : icon ? (
        <span className={children ? "ml-2" : ""}>{icon}</span>
      ) : null}
      {children}
    </button>
  );
};