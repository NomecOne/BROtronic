
import React from 'react';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

const CompareModule: React.FC = () => {
  return (
    <div className="flex-1 p-6 flex flex-col items-center justify-center relative z-10 text-slate-500">
      <PageID id="06" />
      <div className="max-w-md text-center space-y-4">
        <svg className="w-16 h-16 mx-auto opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <h2 className="text-xl font-black uppercase italic tracking-widest">Binary Differential Analysis</h2>
        <p className="text-sm">Compare module is currently under hardware evaluation.</p>
      </div>
    </div>
  );
};

export default CompareModule;
