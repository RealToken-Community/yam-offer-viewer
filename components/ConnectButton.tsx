import React from 'react';
import { useWallet } from '../contexts/WalletContext';

export function ConnectButton() {
  const { isConnected, account, connectWallet, disconnectWallet } = useWallet();

  const shortenAddress = (address: string): string => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isConnected && account) {
    return (
      <div className="flex items-center gap-2">
        <span className="px-4 py-2 bg-gray-800 text-white font-semibold rounded-lg">
          {shortenAddress(account)}
        </span>
        <button 
          onClick={disconnectWallet} 
          className="px-4 py-2 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <button 
      onClick={connectWallet} 
      className="px-4 py-2 bg-[#F2A91E] text-gray-950 font-semibold rounded-lg hover:opacity-90 transition-colors"
    >
      Connect Wallet
    </button>
  )
}
