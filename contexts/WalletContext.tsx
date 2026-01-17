// contexts/WalletContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ethers } from 'ethers';
import { createAppKit, useAppKit, useAppKitAccount, useAppKitProvider, useDisconnect } from '@reown/appkit/react';
import { Ethers5Adapter } from '@reown/appkit-adapter-ethers5';
import { mainnet, gnosis } from '@reown/appkit/networks';

interface WalletContextType {
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
  account: string | null;
  isConnected: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};

interface WalletProviderProps {
  children: ReactNode;
}

// 1. Get projectId
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

// 2. Create metadata
const metadata = {
  name: 'RealToken Offer Viewer',
  description: 'View and buy RealToken YAM offers',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://realtoken.community',
  icons: ['https://avatars.githubusercontent.com/u/37784886']
};

// 3. Create AppKit
createAppKit({
  adapters: [new Ethers5Adapter()],
  networks: [gnosis, mainnet],
  metadata,
  projectId,
  features: {
    analytics: true
  }
});

export const WalletProvider = ({ children }: WalletProviderProps) => {
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const { address, isConnected: isAppKitConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider('eip155');
  const { open } = useAppKit();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    if (isAppKitConnected && walletProvider && address) {
      const web3Provider = new ethers.providers.Web3Provider(walletProvider as any);
      const web3Signer = web3Provider.getSigner();

      setProvider(web3Provider);
      setSigner(web3Signer);
      setAccount(address);
      setIsConnected(true);
    } else {
      setProvider(null);
      setSigner(null);
      setAccount(null);
      setIsConnected(false);
    }
  }, [isAppKitConnected, walletProvider, address]);

  const connectWallet = useCallback(async () => {
    await open();
  }, [open]);

  const disconnectWallet = useCallback(() => {
    disconnect();
  }, [disconnect]);

  const value = {
    provider,
    signer,
    account,
    isConnected,
    connectWallet,
    disconnectWallet,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};
