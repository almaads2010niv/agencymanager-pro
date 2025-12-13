import React from 'react';

const baseInputStyles = "w-full bg-[#0B1121] border border-white/10 rounded-lg p-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all duration-200";

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
    <input className={`${baseInputStyles} ${className}`} {...props} />
  </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
    <select className={`${baseInputStyles} appearance-none ${className}`} {...props}>
      {children}
    </select>
  </div>
);

export const Textarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }> = ({ label, className = '', ...props }) => (
  <div className="space-y-1.5">
    {label && <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</label>}
    <textarea className={`${baseInputStyles} min-h-[100px] ${className}`} {...props} />
  </div>
);

export const Checkbox: React.FC<{ label: string; checked: boolean; onChange: (checked: boolean) => void }> = ({ label, checked, onChange }) => (
  <label className="flex items-center space-x-3 space-x-reverse cursor-pointer group">
    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${checked ? 'bg-primary border-primary' : 'bg-[#0B1121] border-gray-700 group-hover:border-gray-500'}`}>
      {checked && <svg className="w-3.5 h-3.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
    </div>
    <span className={`text-sm ${checked ? 'text-white' : 'text-gray-400 group-hover:text-gray-300'}`}>{label}</span>
    <input type="checkbox" className="hidden" checked={checked} onChange={e => onChange(e.target.checked)} />
  </label>
);