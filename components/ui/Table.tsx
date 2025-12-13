import React from 'react';

export const Table: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="w-full overflow-hidden">
    <div className="overflow-x-auto">
      <table className="w-full text-right border-collapse">
        {children}
      </table>
    </div>
  </div>
);

export const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <thead className="border-b border-white/10 bg-white/5">
    <tr>{children}</tr>
  </thead>
);

export const TableHead: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right whitespace-nowrap">
    {children}
  </th>
);

export const TableBody: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tbody className="divide-y divide-white/5">
    {children}
  </tbody>
);

export const TableRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <tr className="group hover:bg-white/[0.02] transition-colors duration-150">
    {children}
  </tr>
);

export const TableCell: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <td className={`p-4 text-sm text-gray-300 group-hover:text-white transition-colors ${className}`}>
    {children}
  </td>
);