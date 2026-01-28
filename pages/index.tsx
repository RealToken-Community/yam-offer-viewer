import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Search, ShoppingCart, AlertCircle, Check, X, ExternalLink } from 'lucide-react';
import { BigNumber, ethers } from 'ethers';

import { useWallet } from '../contexts/WalletContext';
import { ConnectButton } from '../components/ConnectButton';

// Environment variables
const YAM_API_URL = process.env.NEXT_PUBLIC_API_URL;
if (!YAM_API_URL) {
  throw new Error('Missing NEXT_PUBLIC_API_URL env variable')
}

// RPC Configuration
const GNOSIS_RPC_URL = process.env.NEXT_PUBLIC_GNOSIS_RPC_URL || 'https://rpc.gnosischain.com';
const ETHEREUM_RPC_URL = process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';

// Stablecoins
const STABLE_TOKENS: Record<
  'gnosis' | 'ethereum',
  Record<string, { symbol: string; decimals: number; name?: string }>
> = {
  gnosis: {
    '0xe91d153e0b41518a2ce8dd3d7944fa863463a97d': { symbol: 'WXDAI', decimals: 18, name: 'Wrapped xDAI' },
    '0xddafbb505ad214d7b80b1f830fccc89b60fb7a83': { symbol: 'USDC', decimals: 6 },
    '0x0ca4f5554dd9da6217d62d8df2816c82bba4157b': { symbol: 'armmv3WXDAI', decimals: 18 },
    '0xed56f76e9cbc6a64b821e9c016eafbd3db5436d1': { symbol: 'armmv3USDC', decimals: 6 },
  },
  ethereum: {
    // '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
    // '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
  },
};

const getStableMeta = (
  chain: 'gnosis' | 'ethereum',
  tokenAddress?: string
): { symbol: string; decimals: number; name?: string } | undefined => {
  if (!tokenAddress) return undefined;
  return STABLE_TOKENS[chain][tokenAddress.toLowerCase()];
};

const isStableToken = (chain: 'gnosis' | 'ethereum', tokenAddress?: string): boolean =>
  !!getStableMeta(chain, tokenAddress);

// Contract addresses
const YAM_CONTRACT_ADDRESS_GNOSIS = process.env.NEXT_PUBLIC_YAM_CONTRACT_GNOSIS || '0xC759AA7f9dd9720A1502c104DaE4F9852bb17C14';
const YAM_CONTRACT_ADDRESS_ETHEREUM = process.env.NEXT_PUBLIC_YAM_CONTRACT_ETHEREUM || '0x0E801D84Fa97b50751Dbf25036d067dCf18858bF';

// ABI minimal to retrieve an offer
const YAM_CONTRACT_ABI = [
  'function getOfferCount() view returns (uint256)',
  'function showOffer(uint256) view returns (address,address,address,address,uint256,uint256)',
  'function tokenInfo(address) view returns (uint8,string,string)',
  'function getTokenType(address) view returns (uint8)',
  'function buy(uint256,uint256,uint256)'
];

const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)'
];


// Types
interface RealToken {
  uuid: string;
  shortName: string;
  fullName: string;
  tokenAddress: string;
  chainId: number;
  ethereumContract?: string;
  xDaiContract?: string;
  gnosisContract?: string;
  totalTokens: number;
  tokenPrice: number;
  netRentYear?: number;
  imageLink?: string[];
  image?: string;
  marketplaceLink?: string;
  realtLink?: string;
  website?: string;
  rentStartDate?: {
    date: string;
  };
}

interface YamOffer {
  offerId: string;
  buyerTokenAddress: string;
  offerTokenAddress: string;
  buyerAddress: string;
  price: string;
  amount: string;
  type: number;
  createdAt: string;
  removedAt?: string;
  offerTokenDecimals?: number;
  buyerTokenDecimals?: number;
}

interface Offer {
  id: string;
  price: string;
  reversePrice: string;
  amount: string;
  seller: string;
  status: 'active' | 'sold' | 'cancelled';
  createdAt: string;
  chain: 'gnosis' | 'ethereum';
  tokenDetails?: RealToken;
  offerAddress: string;
  offerDecimals?: number;
  offerSymbol: string;
  buyerAddress?: string;
  buyerDecimals?: number;
  buyerSymbol?: string;
  officialPriceUsd?: number;
  priceDiff?: number;
  priceDiffPct?: number;
  offerYieldPct?: number;
  officialYieldPct?: number;
  offerYieldDiff?: number;
  offerYieldDiffPct?: number;
}

// API Services
class RealTokenAPI {
  // Cache en mémoire pour éviter les appels répétés dans la même session
  private static cache: Map<string, RealToken | null> = new Map();
  private static cacheTimestamp: number | null = null;
  private static CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
  private static initializationPromise: Promise<void> | null = null;

  // Initialiser le cache uniquement via l'API backend
  static initializeCache(): Promise<void> {
    // Si déjà chargé et pas périmé (<24h), ne rien faire
    if (this.cacheTimestamp && Date.now() - this.cacheTimestamp < this.CACHE_MAX_AGE_MS) {
      return Promise.resolve();
    }

    // Si une initialisation est déjà en cours, retourner la promesse existante
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    // Sinon, démarrer une nouvelle initialisation
    this.initializationPromise = (async () => {
      try {
        console.log('🔄 Fetching token cache from backend API...');
        // Appeler l'API backend qui gère tout (cache + API communautaire si nécessaire)
        const response = await fetch('/api/token');
        
        if (response.ok) {
          const cacheData = await response.json();
          
          if (cacheData?.tokens) {
            this.cache.clear();
            Object.values(cacheData.tokens).forEach((token: any) => {
              if (token.tokenAddress) {
                this.cache.set(token.tokenAddress.toLowerCase(), token as RealToken);
              }
            });
            this.cacheTimestamp = cacheData.lastUpdated || Date.now();
            console.log(`✅ Cache loaded with ${this.cache.size} tokens`);
          } else {
            console.warn('⚠️ Token cache is empty:', cacheData?.error || 'No tokens in response');
            this.cacheTimestamp = Date.now();
          }
        } else {
          console.warn('⚠️ API token endpoint returned error:', response.status);
          this.cacheTimestamp = Date.now();
        }
      } catch (err) {
        console.warn('⚠️ Error loading token cache:', err);
        this.cacheTimestamp = Date.now(); // Marquer comme tenté pour éviter des re-essais infinis
      } finally {
        // Une fois terminé (succès ou échec), réinitialiser la promesse pour permettre de futures mises à jour après expiration
        this.initializationPromise = null;
      }
    })();
    
    return this.initializationPromise;
  }

  static async getTokenDetails(tokenAddress: string): Promise<RealToken | null> {
    try {
      await this.initializeCache();
      const addressLower = tokenAddress.toLowerCase();
      return this.cache.get(addressLower) || null;
    } catch (err) {
      console.error('Error getting token details:', err);
      return null;
    }
  }
}

// ERC20 helper (fallback quand ce n'est pas un RealToken/Property dans l'API)
const ERC20_META_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
];

const getErc20Meta = async (
  tokenAddress: string,
  chain: 'gnosis' | 'ethereum'
): Promise<{ name?: string; symbol?: string }> => {
  try {
    const rpcUrl = chain === 'gnosis' ? GNOSIS_RPC_URL : ETHEREUM_RPC_URL;
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const erc20 = new ethers.Contract(tokenAddress, ERC20_META_ABI, provider);
    const [name, symbol] = await Promise.all([
      erc20.name().catch(() => undefined),
      erc20.symbol().catch(() => undefined),
    ]);
    return { name, symbol };
  } catch {
    return {};
  }
};

// Fonction RPC pour récupérer une offre
// Basée sur l'implémentation du projet realtoken-yam-interface
const fetchOfferRpc = async (
  offerId: string,
  chainId: number = 100 // Par défaut Gnosis
): Promise<YamOffer | null> => {
  try {
    // Sélectionner le provider RPC selon la chaîne
    const rpcUrl = chainId === 100 ? GNOSIS_RPC_URL : ETHEREUM_RPC_URL;
    const contractAddress = chainId === 100 
      ? YAM_CONTRACT_ADDRESS_GNOSIS 
      : YAM_CONTRACT_ADDRESS_ETHEREUM;

    // Créer le provider
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    
    // Créer l'instance du contrat
    const contract = new ethers.Contract(contractAddress, YAM_CONTRACT_ABI, provider);

    const offerIdNum = Number(offerId);
    if (!Number.isFinite(offerIdNum) || offerIdNum < 0) return null;

    // Validation optionnelle: getOfferCount()
    try {
      const offerCountBN: ethers.BigNumber = await contract.getOfferCount();
      const offerCount = offerCountBN.toNumber();
      if (offerIdNum >= offerCount) return null;
    } catch {
      // Si le RPC/contrat ne supporte pas getOfferCount, on continue quand même.
    }

    // Récupérer l'offre via RPC: showOffer(offerId)
    // Le projet d'origine a observé (sur Gnosis): [token0, token1, seller, buyer, price, amount]
    const offerData: any = await contract.showOffer(offerIdNum);
    const value0 = offerData?.[0];
    const value1 = offerData?.[1];
    const seller = offerData?.[2];
    const buyer = offerData?.[3];
    const priceBN: ethers.BigNumber = offerData?.[4];
    const amountBN: ethers.BigNumber = offerData?.[5];

    // Mapping des tokens retournés par `showOffer`:
    // [token0, token1, seller, buyer, price, amount]
    //
    // Dans YAM, `amount` représente la quantité du token vendu (la propriété / RealToken),
    // et `price` est exprimé dans le token d'échange (stablecoin) par unité de propriété.
    //
    // En pratique, cela correspond à:
    // - offerToken (vendu) = token0
    // - buyerToken (payé / stablecoin) = token1
    const offerToken = value0;
    const buyerToken = value1;

    // ERC20 fallback: récupérer decimals via ERC20
    const ERC20_ABI = ['function decimals() view returns (uint8)'];
    const getDecimals = async (tokenAddress: string): Promise<number> => {
      try {
        const erc20 = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const d: number = await erc20.decimals();
        return Number(d);
      } catch {
        return 18;
      }
    };

    const [offerTokenDecimals, buyerTokenDecimals] = await Promise.all([
      offerToken ? getDecimals(offerToken) : Promise.resolve(18),
      buyerToken ? getDecimals(buyerToken) : Promise.resolve(18),
    ]);

    const yamOffer: YamOffer = {
      offerId: offerId,
      buyerTokenAddress: buyerToken || '',
      offerTokenAddress: offerToken || '',
      buyerAddress: seller || '', // seller est l'adresse qui crée l'offre
      price: priceBN ? priceBN.toString() : '0',
      amount: amountBN ? amountBN.toString() : '0',
      type: 0, // À déterminer selon la logique métier (peut nécessiter des appels supplémentaires)
      createdAt: '0', // showOffer ne retourne pas createdAt; le projet d'origine met 0 sans events
      removedAt: undefined,
      offerTokenDecimals,
      buyerTokenDecimals,
    };

    return yamOffer;
  } catch (error) {
    console.error('Error fetching offer via RPC:', error);
    // Si l'erreur indique que l'offre n'existe pas, retourner null
    if (error instanceof Error && error.message.includes('revert')) {
      return null;
    }
    return null;
  }
};

class YamAPI {
  // Récupération de l'offre via RPC
  static async getOffer(offerId: string, chainId: number = 100): Promise<YamOffer | null> {
    try {
      const offer = await fetchOfferRpc(offerId, chainId);
      return offer;
    } catch (error) {
      console.error('Error fetching YAM offer:', error);
      return null;
    }
  }

  // Vérifie si un utilisateur est whitelisté sur un token
  static async checkWhitelistStatus(userAddress: string): Promise<boolean> {
    try {
      const response = await fetch(YAM_API_URL || '', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          operationName: 'getWlProperties',
          variables: {},
          query: `query getWlProperties {
  realTokenGnosis {
    account(id: "${userAddress}") {
      userIds {
        userId
        attributeKeys
        trustedIntermediary {
          address
          weight
          __typename
        }
        __typename
      }
      __typename
    }
    __typename
  }
}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // Vérifie si l'utilisateur a des userIds (est whitelisté)
      return (
        data?.data?.realTokenGnosis?.account?.userIds?.length > 0
      );
    } catch (error) {
      console.error('Error checking whitelist status:', error);
      return false;
    }
  }
}

// Helper functions
const getChainFromOffer = (yamOffer: YamOffer): 'gnosis' | 'ethereum' => {
  return 'gnosis';
};

const getStatusFromOffer = (yamOffer: YamOffer): 'active' | 'sold' | 'cancelled' => {
  if (yamOffer.removedAt) {
    return 'cancelled';
  }
  if (parseFloat(yamOffer.amount) === 0) {
    return 'sold';
  }
  return 'active';
};

const shortenAddress = (address: string): string => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const combineOfferData = async (yamOffer: YamOffer): Promise<Offer> => {
  // Déterminer quel token est la "propriété" (RealToken) vs token d'échange (stablecoin)
  const chain = getChainFromOffer(yamOffer);

  // Optimisation: si un token est stable connu, inutile d'appeler l'API RealToken pour lui
  const offerIsStable = isStableToken(chain, yamOffer.offerTokenAddress);
  const buyerIsStable = isStableToken(chain, yamOffer.buyerTokenAddress);

  let offerTokenDetails: RealToken | null = null;
  let buyerTokenDetails: RealToken | null = null;

  try {
    [offerTokenDetails, buyerTokenDetails] = await Promise.all([
      offerIsStable ? Promise.resolve(null) : RealTokenAPI.getTokenDetails(yamOffer.offerTokenAddress),
      buyerIsStable ? Promise.resolve(null) : RealTokenAPI.getTokenDetails(yamOffer.buyerTokenAddress),
    ]);
  } catch (err) {
    console.warn('Error fetching token details, continuing with limited info:', err);
  }

  // On traite toujours l'offerToken comme la propriété (ce qui est vendu)
  // et le buyerToken comme la monnaie d'échange (ce qui est demandé).
  const offerAddress = yamOffer.offerTokenAddress;
  const buyerAddress = yamOffer.buyerTokenAddress;
  const tokenDetails = offerTokenDetails;

  // Si le "propertyToken" n'est pas trouvé, on considère qu'on est sur un token d'échange (stablecoin) côté propertyToken
  // et on affiche au moins le symbole du token d'échange détecté (ex: WXDAI)
  const exchangeStableMeta = getStableMeta(chain, buyerAddress);
  const exchangeMeta = exchangeStableMeta
    ? { name: exchangeStableMeta.name, symbol: exchangeStableMeta.symbol }
    : (buyerAddress ? await getErc20Meta(buyerAddress, chain) : {});

  const offerTokenDecimals = yamOffer.offerTokenDecimals ?? 18;
  const buyerTokenDecimals = yamOffer.buyerTokenDecimals ?? 18;

  // Prix/quantité formatés
  const priceNum = Number(ethers.utils.formatUnits(yamOffer.price || '0', buyerTokenDecimals));
  const amountNum = Number(ethers.utils.formatUnits(yamOffer.amount || '0', offerTokenDecimals));
  const reversePriceNum = 1 / priceNum;

  // Symbole du prix: si token d'échange stable connu => son symbol, sinon fallback ERC20, sinon '$'
  const priceSymbol = exchangeStableMeta?.symbol || exchangeMeta.symbol || '$';


  // Différence vs prix officiel (USD) si dispo (tokenDetails.tokenPrice est supposé en USD)
  const officialPriceUsd = tokenDetails?.tokenPrice || 1;
  const priceDiff = priceNum - (officialPriceUsd ?? 0);
  const priceDiffPct =
    typeof officialPriceUsd === 'number' && officialPriceUsd > 0
      ? (priceDiff / officialPriceUsd) * 100
      : undefined;

  // Rendement: netRentYear / prix
  const officialYieldPct =
    typeof tokenDetails?.netRentYear === 'number' &&
    typeof officialPriceUsd === 'number' &&
    officialPriceUsd > 0
      ? (tokenDetails.netRentYear / tokenDetails.totalTokens / officialPriceUsd) * 100
      : undefined;
  const offerYieldPct =
    typeof tokenDetails?.netRentYear === 'number' && priceNum > 0
      ? (tokenDetails.netRentYear / tokenDetails.totalTokens / priceNum) * 100
      : undefined;

  const offerYieldDiff = offerYieldPct !== undefined ? offerYieldPct - (officialYieldPct ?? 0) : undefined;
  const offerYieldDiffPct =
    typeof officialYieldPct === 'number' && offerYieldDiff !== undefined
      ? (offerYieldDiff / officialYieldPct) * 100
      : undefined;

  let offerSymbol = tokenDetails?.shortName || tokenDetails?.fullName;
  if (!offerSymbol) {
    const stableMeta = getStableMeta(chain, offerAddress);
    if (stableMeta) {
        offerSymbol = stableMeta.name || stableMeta.symbol;
    } else {
      const erc20Meta = await getErc20Meta(offerAddress, chain);
      offerSymbol = erc20Meta.name || erc20Meta.symbol || 'Unknown property';
    }
  }
  
  return {
    id: yamOffer.offerId,
    price: priceNum.toFixed(2),
    reversePrice: reversePriceNum.toFixed(2),
    // Les RealTokens utilisent souvent une granularité fine; afficher 6 décimales
    // pour éviter les écarts visibles vs d'autres interfaces (ex: 26.031567).
    amount: amountNum.toFixed(6),
    seller: yamOffer.buyerAddress,
    status: getStatusFromOffer(yamOffer),
    createdAt: yamOffer.createdAt && yamOffer.createdAt !== '0'
    ? new Date(parseInt(yamOffer.createdAt) * 1000).toISOString()
    : new Date().toISOString(),
    chain,
    tokenDetails: tokenDetails || undefined,
    offerAddress: offerAddress,
    offerDecimals: offerTokenDecimals,
    offerSymbol: offerSymbol,
    buyerAddress,
    buyerDecimals: buyerTokenDecimals,
    buyerSymbol: exchangeMeta.symbol,
    officialPriceUsd,
    priceDiff,
    priceDiffPct,
    offerYieldPct,
    officialYieldPct,
    offerYieldDiff,
    offerYieldDiffPct,
  };
};

export default function Home() {
  const router = useRouter();
  const { id } = router.query;
  
  const [searchId, setSearchId] = useState('');
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState('');
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [mounted, setMounted] = useState(false);
  const [allowance, setAllowance] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));
  const [isAllowanceLoading, setIsAllowanceLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [balance, setBalance] = useState<ethers.BigNumber>(ethers.BigNumber.from(0));

  const { isConnected, signer } = useWallet();

  // Éviter l'erreur d'hydratation
  useEffect(() => {
    setMounted(true);
  }, []);

  const loadOffer = async (id: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const yamOffer = await YamAPI.getOffer(id);
      
      if (yamOffer) {
        const combinedOffer = await combineOfferData(yamOffer);
        setOffer(combinedOffer);
        setSearchId(id);
      } else {
        setError(`Offer #${id} not found`);
        setOffer(null);
      }
    } catch (err) {
      console.error('Error loading offer:', err);
      setError(`Error loading offer #${id}`);
      setOffer(null);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    if (router.isReady) {
      const offerId = Array.isArray(id) ? id[0] : id;
      if (offerId) {
        loadOffer(offerId);
      } else {
        setOffer(null);
        setError(null);
      }
    }
  }, [router.isReady, id]);

  const handleSearch = () => {
    if (searchId.trim()) {
      router.push(`/?id=${searchId.trim()}`, undefined, { shallow: true });
    }
  };

  useEffect(() => {
    if (showBuyModal && signer && offer) {
      updateBuyModalData();
    }
  }, [showBuyModal, signer, offer]);

  const updateBuyModalData = async () => {
    if (!signer || !offer || !offer.buyerAddress) return;
    setIsAllowanceLoading(true); // Re-using this loading state for all modal data
    try {
      const userAddress = await signer.getAddress();
      const spenderAddress = offer.chain === 'gnosis' ? YAM_CONTRACT_ADDRESS_GNOSIS : YAM_CONTRACT_ADDRESS_ETHEREUM;
      const tokenContract = new ethers.Contract(offer.buyerAddress, ERC20_ABI, signer);
      
      const [currentAllowance, userBalance] = await Promise.all([
        tokenContract.allowance(userAddress, spenderAddress),
        tokenContract.balanceOf(userAddress)
      ]);
      
      setAllowance(currentAllowance);
      setBalance(userBalance);
    } catch (err) {
      console.error('Error fetching modal data:', err);
      setAllowance(ethers.BigNumber.from(0));
      setBalance(ethers.BigNumber.from(0));
    }
    setIsAllowanceLoading(false);
  };

  const handleApprove = async () => {
    if (!signer || !offer || !offer.buyerAddress || !buyAmount) return;

    setIsApproving(true);
    setTxStatus('pending');
    try {
      const spenderAddress = offer.chain === 'gnosis' ? YAM_CONTRACT_ADDRESS_GNOSIS : YAM_CONTRACT_ADDRESS_ETHEREUM;
      const tokenContract = new ethers.Contract(offer.buyerAddress, ERC20_ABI, signer);
      
      const decimals = offer.buyerDecimals || 18;
      const totalCost = parseFloat(buyAmount) * parseFloat(offer.price);
      
      // Round to avoid issues with floating point arithmetic
      const totalCostRounded = parseFloat(totalCost.toFixed(decimals));
      const amountToApprove = ethers.utils.parseUnits(totalCostRounded.toString(), decimals);

      const tx = await tokenContract.approve(spenderAddress, amountToApprove);
      await tx.wait();
      
      await updateBuyModalData();
      setTxStatus('idle');
    } catch (err: any) {
      console.error('Error approving token:', err);
      const message = err.reason || err.message || 'An unknown error occurred';
      setTxError(`Error approving token: ${message}`);
      setTxStatus('error');
    }
    setIsApproving(false);
  };

  const handleSetMaxAmount = () => {
    if (!offer || !balance) return;

    const PRECISION = 6;
    // const decimals = offer.exchangeTokenDecimals || 18;
    
    // const userBalanceNum = parseFloat(ethers.utils.formatUnits(balance, decimals));
    // const offerPriceNum = parseFloat(offer.price);

    // let maxAmountFromBalance = 0;
    // if (offerPriceNum > 0) {
    //   maxAmountFromBalance = userBalanceNum / offerPriceNum;
    // }

    // const maxAmount = Math.min(parseFloat(offer.amount), maxAmountFromBalance);

    // balance est déjà un BigNumber (ex: wei)
    const balanceBN: BigNumber = balance;

    // Prix converti en BigNumber avec 6 décimales
    const priceBN = ethers.utils.parseUnits(offer.price, PRECISION);

    // On upscale le balance pour garder la précision
    const balanceScaled = balanceBN.mul(
      BigNumber.from(10).pow(PRECISION)
    );

    // Division entière → floor automatique
    const maxAmountFromBalanceBN = balanceScaled.div(priceBN);

    // offer.amount en BigNumber avec la même précision
    const offerAmountBN = ethers.utils.parseUnits(
      offer.amount,
      PRECISION
    );

    // Minimum entre les deux
    const maxAmountBN = maxAmountFromBalanceBN.lt(offerAmountBN)
      ? maxAmountFromBalanceBN
      : offerAmountBN;

    // Pour affichage uniquement
    const maxAmount = ethers.utils.formatUnits(
      maxAmountBN,
      PRECISION
    );
    
    setBuyAmount(maxAmount);
  };

  const handleBuy = async () => {
    if (!isConnected || !signer) {
      alert('Please connect your wallet');
      return;
    }

    if (!buyAmount || parseFloat(buyAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (parseFloat(buyAmount) > parseFloat(offer!.amount)) {
      alert('Amount exceeds available quantity');
      return;
    }

    setTxStatus('pending');

    try {
      const contractAddress = offer?.chain === 'gnosis' 
        ? YAM_CONTRACT_ADDRESS_GNOSIS 
        : YAM_CONTRACT_ADDRESS_ETHEREUM;

      const contract = new ethers.Contract(contractAddress, YAM_CONTRACT_ABI, signer);

      const tx = await contract.buy(
        Number(offer!.id),
        ethers.utils.parseUnits(offer!.price, offer!.buyerDecimals || 18),
        ethers.utils.parseUnits(buyAmount, offer!.offerDecimals || 18)
      );

      await tx.wait();

      setTxStatus('success');
      setTimeout(() => {
        setShowBuyModal(false);
        setTxStatus('idle');
        setBuyAmount('');
        loadOffer(offer!.id);
      }, 2000);

    } catch (err: any) {
      console.error('Error buying token:', err);
      const message = err.reason || err.message || 'An unknown error occurred';
      setTxError(`Error buying token: ${message}`);
      setTxStatus('error');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      sold: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    
    const labels = {
      active: 'Active',
      sold: 'Sold',
      cancelled: 'Cancelled'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  // Éviter le rendu côté serveur pour éviter les erreurs d'hydratation
  if (!mounted) {
    return (
      <>
        <Head>
          <title>RealToken Offer Viewer</title>
          <meta name="description" content="View and buy RealToken YAM offers" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>RealToken Offer Viewer - {offer ? `Offer #${offer.id}` : 'Search an offer'}</title>
        <meta name="description" content="View and buy RealToken YAM offers" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-950 text-gray-100">
        <header className="bg-gray-900 shadow-sm border-b border-gray-800">
          <div className="max-w-6xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <a href="/" target="_self" rel="noreferrer">
                    <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[#F2A91E] rounded-lg flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-100">RealToken YAM</h1>
                            <p className="text-sm text-gray-400">Offer Viewer</p>
                        </div>
                    </div>
                </a>
              </div>
              <ConnectButton />
            </div>
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-md p-6 mb-8">
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter the offer ID"
                  className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-[#F2A91E] focus:border-transparent"
                />
              </div>
              <button
                onClick={handleSearch}
                className="px-6 py-3 bg-[#F2A91E] text-gray-950 font-semibold rounded-lg hover:opacity-90 transition-colors"
              >
                Search
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              💡 Enter a YAM offer ID to view details
            </p>
          </div>

          {loading && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-md p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-300">Loading offer...</p>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-950/30 border border-red-900 rounded-xl p-6">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-200">{error}</h3>
                  <p className="text-sm text-red-200/80 mt-1">Please check the ID and try again.</p>
                </div>
              </div>
            </div>
          )}

          {offer && !loading && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-[#F2A91E] to-amber-500 p-6 text-gray-950">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <a
                        href={`https://yam.realtoken.network/offer/${offer.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-2xl font-bold hover:underline transition-colors"
                        title="Open on YAM"
                      >
                        <span>Offer #{offer.id}</span>
                        <ExternalLink className="w-5 h-5" />
                      </a>
                      {getStatusBadge(offer.status)}
                    </div>
                    <p className="text-gray-900/70 text-sm">
                      Created on {new Date(offer.createdAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-900/70 mb-1">Network</div>
                    <div className="px-3 py-1 bg-black/10 rounded-full text-sm font-medium">
                      {offer.chain === 'gnosis' ? '🟢 Gnosis' : '⟠ Ethereum'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  {/* Col 1: Title + Link */}
                  <div className="min-w-0">
                    {offer.tokenDetails?.marketplaceLink || offer.tokenDetails?.realtLink || offer.tokenDetails?.website ? (
                      <a
                        href={(offer.tokenDetails.marketplaceLink || offer.tokenDetails.realtLink || offer.tokenDetails.website) as string}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center mt-2 gap-2 text-xl font-semibold text-gray-100 hover:underline transition-colors"
                        title="Open on the official website"
                      >
                        <span>{offer.offerSymbol}</span>
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    ) : (
                      <div className="mt-2 text-xl font-semibold text-gray-100">
                        {offer.offerSymbol}
                      </div>
                    )}
                    {offer.tokenDetails && (
                      <div className="mt-1 text-sm text-gray-400 truncate">
                        {offer.tokenDetails.fullName}
                      </div>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* Col 2: Image */}
                    {(offer.tokenDetails?.imageLink?.[0] || offer.tokenDetails?.image) ? (
                      <img
                        src={(offer.tokenDetails.imageLink?.[0] || offer.tokenDetails.image) as string}
                        alt={offer.offerSymbol}
                        className="w-150 h-150 rounded-xl object-cover border border-gray-800"
                        loading="lazy"
                      />
                    ) : (
                      <div></div>
                    )}

                    {/* Col 3: Yield / Price table + Token details */}
                    <div>
                      <div className="bg-gray-950 border border-gray-800 rounded-lg p-4 mb-4">
                        <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                          Yield / Price (Original vs Offer)
                        </label>
                        <div className="grid grid-cols-4 gap-2 text-sm">
                          <div className="text-gray-500"> </div>
                          <div className="text-gray-400 font-medium">Original</div>
                          <div className="text-gray-400 font-medium">Offer</div>
                          <div className="text-gray-400 font-medium">Diff</div>
                          <div className="text-gray-200 font-medium">Price</div>
                          <div className="text-gray-100">{offer.officialPriceUsd?.toFixed(2)}$</div>
                          <div className="text-gray-100">{offer.price}$</div>
                          <div className={`font-semibold ${offer.priceDiffPct !== undefined && offer.priceDiffPct < 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {offer.priceDiff?.toFixed(2)}$ ({offer.priceDiffPct?.toFixed(2)}%)
                          </div>
                          <div className="text-gray-200 font-medium">Yield</div>
                          <div className="text-gray-100">{offer.officialYieldPct?.toFixed(2)}%</div>
                          <div className="text-gray-100">{offer.offerYieldPct?.toFixed(2)}%</div>
                          <div className={`font-semibold ${offer.offerYieldDiffPct !== undefined && offer.offerYieldDiffPct > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {offer.offerYieldDiff?.toFixed(2)}% ({offer.offerYieldDiffPct?.toFixed(2)}%)
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                        <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                          Offer
                        </label>

                        {/* <div className="flex justify-between items-center">
                          <span className="text-gray-200 font-medium">Offer quantity</span>
                          <span className="text-xl font-bold text-[#F2A91E]">
                            {offer.amount} tokens
                          </span>
                        </div> */}

                        <div className="flex justify-between items-center">
                          <span className="text-gray-200 font-medium">Available quantity</span>
                          <span className="text-xl font-bold text-[#F2A91E]">
                            {offer.amount} {offer.offerSymbol}
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-200 font-medium">Total offer value</span>
                          <span className="text-2xl font-bold text-[#F2A91E]">
                            {/* TODO : TEST SYMBOL */}
                            {(parseFloat(offer.price) * parseFloat(offer.amount)).toFixed(2)} {offer.buyerSymbol || '$'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                      Seller token
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full"></div>
                      <a
                        href={"https://gnosisscan.io/token/" + offer.offerAddress}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center mt-2 gap-2 text-xl font-semibold text-gray-100 hover:underline transition-colors"
                        title="Open on Debank"
                      >
                        <span>{offer.offerSymbol}</span>
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                      Buyer token
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full"></div>
                      <a
                        href={"https://gnosisscan.io/token/" + offer.buyerAddress}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center mt-2 gap-2 text-xl font-semibold text-gray-100 hover:underline transition-colors"
                        title="Open on Debank"
                      >
                        <span>{offer.buyerSymbol}</span>
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-400 uppercase tracking-wider">
                      Seller
                    </label>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full"></div>
                      <a
                        href={"https://debank.com/profile/" + offer.seller}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center mt-2 gap-2 text-xl font-semibold text-gray-100 hover:underline transition-colors"
                        title="Open on Debank"
                      >
                        <span>{shortenAddress(offer.seller)}</span>
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    </div>
                  </div>
                </div>

                {/* (moved) Total value + Yield/Price are displayed above in a 2-col grid */}

                {offer.status === 'active' && (
                  <button
                    onClick={() => setShowBuyModal(true)}
                    className="w-full py-4 bg-[#F2A91E] text-gray-950 font-semibold rounded-lg hover:opacity-90 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                    disabled={!isConnected}
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Buy this offer
                  </button>
                )}

                {offer.status !== 'active' && (
                  <div className="w-full py-4 bg-gray-950 border border-gray-800 text-gray-400 font-semibold rounded-lg text-center">
                    This offer is no longer available
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {showBuyModal && offer && (() => {
          let needsApproval = false;
          let amountNeeded = ethers.BigNumber.from(0);
          let calculationError: string | null = null;

          if (buyAmount && parseFloat(buyAmount) > 0) {
            try {
              const decimals = offer.buyerDecimals || 18;
              const totalCost = parseFloat(buyAmount) * parseFloat(offer.price);

              if (isNaN(totalCost)) {
                calculationError = "Invalid amount";
              } else {
                // Round to avoid floating point issues.
                const totalCostRounded = parseFloat(totalCost.toFixed(decimals));
                amountNeeded = ethers.utils.parseUnits(totalCostRounded.toString(), decimals);

                if (allowance.lt(amountNeeded)) {
                  needsApproval = true;
                }
              }
            } catch (e: any) {
              if (e.code === 'NUMERIC_FAULT') {
                calculationError = "Invalid amount: value has too many decimal places.";
              } else {
                calculationError = "Invalid amount.";
              }
              console.error('Calculation error:', e);
            }
          }

          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-gray-900 border border-gray-800 rounded-xl max-w-md w-full p-6 text-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-100">Buy tokens</h3>
                  <button onClick={() => setShowBuyModal(false)} className="text-gray-400 hover:text-gray-200">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Amount to buy
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        placeholder="0"
                        min="0"
                        max={offer.amount}
                        step="0.01"
                        className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-lg focus:ring-2 focus:ring-[#F2A91E] focus:border-transparent pr-16"
                        disabled={txStatus === 'pending' || isApproving}
                      />
                      <button
                        onClick={handleSetMaxAmount}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md"
                      >
                        Max
                      </button>
                    </div>
                    <div className="flex justify-between mt-2 text-sm text-gray-400">
                      <span>Maximum: {offer.amount} tokens available</span>
                      <span>Balance: {parseFloat(ethers.utils.formatUnits(balance, offer.buyerDecimals || 18)).toFixed(4)} {offer.buyerSymbol}</span>
                    </div>
                  </div>

                  {buyAmount && parseFloat(buyAmount) > 0 && !calculationError && (
                    <div className="bg-gray-950 border border-gray-800 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Unit price</span>
                        <span className="font-semibold text-gray-100">1 {offer.buyerSymbol || '$'} = {offer.price} {offer.offerSymbol}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Reverse price</span>
                        <span className="font-semibold text-gray-100">1 {offer.offerSymbol} = {offer.reversePrice} {offer.buyerSymbol || '$'}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Amount</span>
                        <span className="font-semibold text-gray-100">{buyAmount}</span>
                      </div>
                      <div className="border-t border-gray-800 mt-2 pt-2 flex justify-between">
                        <span className="font-semibold text-gray-200">Total value</span>
                        <span className="text-xl font-bold text-[#F2A91E]">
                            {/* TODO : TEST SYMBOL */}
                          {(parseFloat(offer.price) * parseFloat(buyAmount)).toFixed(6)} {offer.offerSymbol || '$'}
                        </span>
                      </div>
                    </div>
                  )}

                  {calculationError && (
                    <div className="bg-yellow-950/50 border border-yellow-800 rounded-lg p-4 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-yellow-400" />
                      <span className="text-sm text-yellow-300">{calculationError}</span>
                    </div>
                  )}

                  {txStatus === 'pending' && (
                    <div className="bg-blue-950/50 border border-blue-800 rounded-lg p-4 flex items-center gap-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-400 border-t-transparent"></div>
                      <span className="text-sm text-blue-300">{isApproving ? 'Approving token...' : 'Confirm transaction in your wallet...'}</span>
                    </div>
                  )}

                  {txStatus === 'success' && (
                    <div className="bg-green-950/50 border border-green-800 rounded-lg p-4 flex items-center gap-3">
                      <Check className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-green-300">Purchase successful!</span>
                    </div>
                  )}

                  {txStatus === 'error' && txError && (
                    <div className="bg-red-950/50 border border-red-800 rounded-lg p-4 flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-1" />
                      <span className="text-sm text-red-300 break-words">{txError}</span>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowBuyModal(false)}
                      className="flex-1 px-4 py-3 border border-gray-800 text-gray-200 font-medium rounded-lg hover:bg-gray-950 transition-colors"
                      disabled={isApproving || txStatus === 'pending'}
                    >
                      Cancel
                    </button>
                    {needsApproval ? (
                      <button
                        onClick={handleApprove}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={isApproving || txStatus === 'pending' || isAllowanceLoading || !buyAmount || parseFloat(buyAmount) <= 0 || !!calculationError}
                      >
                        {isAllowanceLoading ? 'Checking...' : (isApproving ? 'Approving...' : `Approve ${offer.buyerSymbol}`)}
                      </button>
                    ) : (
                      <button
                        onClick={handleBuy}
                        className="flex-1 px-4 py-3 bg-[#F2A91E] text-gray-950 font-semibold rounded-lg hover:opacity-90 transition-colors disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={!buyAmount || parseFloat(buyAmount) <= 0 || isApproving || txStatus === 'pending' || needsApproval || !!calculationError}
                      >
                        {txStatus === 'pending' && !isApproving ? 'Buying...' : 'Confirm'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })()}
      </div>
    </>
  );
}