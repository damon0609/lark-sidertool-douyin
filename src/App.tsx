import React from 'react';
import CookiesModule from './components/CookiesModule';
import BatchCollectionModule from './components/BatchCollectionModule';
import { BitableProvider } from './contexts/BitableContext';

export default function App() {
  return (
    <BitableProvider>
      <div className="min-h-screen bg-[#f8fafc] p-8 font-sans">
        <div className="max-w-2xl mx-auto space-y-8">
          <CookiesModule />
          <BatchCollectionModule />
        </div>
      </div>
    </BitableProvider>
  );
}
