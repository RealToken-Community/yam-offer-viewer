import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

// Champs minimaux à stocker dans le cache
interface CachedToken {
  tokenAddress: string;
  shortName?: string;
  fullName?: string;
  tokenPrice?: number;
  netRentYear?: number;
  imageLink?: string[];
  marketplaceLink?: string;
  totalTokens?: number;
  rentStartDate?: {
    date: string;
  };
}

interface CacheFile {
  lastUpdated: number; // timestamp
  tokens: Record<string, CachedToken>; // keyed by tokenAddress (lowercase)
}

const CACHE_FILE_PATH = path.join(process.cwd(), 'data', 'tokens-cache.json');
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 heures

// Créer le répertoire data s'il n'existe pas
async function ensureDataDir() {
  const dataDir = path.dirname(CACHE_FILE_PATH);
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Lire le cache depuis le fichier
async function readCache(): Promise<CacheFile | null> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(CACHE_FILE_PATH, 'utf-8');
    return JSON.parse(content) as CacheFile;
  } catch (error) {
    // Fichier n'existe pas encore ou erreur de lecture
    return null;
  }
}

// Écrire le cache dans le fichier
async function writeCache(tokens: Record<string, CachedToken>) {
  await ensureDataDir();
  const cache: CacheFile = {
    lastUpdated: Date.now(),
    tokens,
  };
  await fs.writeFile(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
}

// Vérifier si le cache est encore valide (< 24h)
function isCacheValid(cache: CacheFile | null): boolean {
  if (!cache) return false;
  const age = Date.now() - cache.lastUpdated;
  return age < CACHE_MAX_AGE_MS;
}

// Récupérer toutes les propriétés depuis l'API RealToken
async function fetchAllTokens(): Promise<Record<string, CachedToken>> {
  const baseUrl =
    process.env.NEXT_PUBLIC_COMMUNITY_API_URI || process.env.COMMUNITY_API_URI;
  if (!baseUrl) {
    console.error('❌ Missing COMMUNITY API base URL');
    throw new Error('Missing COMMUNITY API base URL');
  }

  const apiKey = process.env.COMMUNITY_API_KEY;
  if (!apiKey) {
    console.error('❌ Missing COMMUNITY_API_KEY');
    throw new Error('Missing COMMUNITY_API_KEY');
  }

  console.log('📡 Fetching tokens from:', baseUrl);
  console.log('🔑 Using API key:', apiKey.substring(0, 10) + '...');

  try {
    // Appel à l'endpoint qui liste tous les tokens
    // Essayer plusieurs endpoints possibles selon l'API RealToken
    let allTokens: any[] = [];
    let lastError: Error | null = null;

    // Essayer /tokens d'abord
    try {
      console.log('🔄 Trying /tokens endpoint...');
      const response = await fetch(`${baseUrl}/tokens`, {
        headers: {
          'X-AUTH-REALT-TOKEN': apiKey,
          'Content-Type': 'application/json',
        },
        redirect: 'follow', // Suivre les redirections automatiquement
      });

      console.log('📥 Response status:', response.status, response.statusText);

      // Lire le contenu de la réponse
      const data = await response.json();
      
      // L'API peut retourner 301 mais quand même envoyer les données
      if (response.ok || (response.status === 301 && Array.isArray(data))) {
        // L'API retourne directement un tableau, pas un objet
        if (Array.isArray(data)) {
          allTokens = data;
          console.log('✅ Successfully fetched', allTokens.length, 'tokens from /tokens');
        } else {
          console.error('❌ Expected array but got:', typeof data);
          throw new Error('API did not return an array');
        }
      } else if (response.status === 404) {
        console.log('⚠️ /tokens not found (404)...');
      } else {
        const errorText = await response.text();
        console.error('❌ /tokens error:', errorText.substring(0, 100));
        throw new Error(`API error: ${response.status}`);
      }
    } catch (error: any) {
      lastError = error;
      console.error('❌ Error with /tokens endpoint:', error.message);
    }

    if (!Array.isArray(allTokens)) {
      console.error('❌ API did not return an array:', typeof allTokens);
      throw new Error('API did not return an array of tokens');
    }

    console.log('🔄 Processing', allTokens.length, 'tokens...');

    // Extraire seulement les champs nécessaires
    const cachedTokens: Record<string, CachedToken> = {};
    for (const token of allTokens) {
      // L'API peut retourner 'ethereumContract', 'xDaiContract', 'gnosisContract' ou 'tokenAddress'
      const address = 
        token.tokenAddress || 
        token.address || 
        token.contractAddress ||
        token.ethereumContract ||
        token.xDaiContract ||
        token.gnosisContract;
        
      if (!address) {
        console.warn('⚠️ Token without address:', token.shortName || token.symbol || 'unknown');
        continue;
      }

      cachedTokens[address.toLowerCase()] = {
        tokenAddress: address,
        shortName: token.shortName,
        fullName: token.fullName,
        tokenPrice: token.tokenPrice,
        netRentYear: token.netRentYear,
        imageLink: token.imageLink,
        marketplaceLink: token.marketplaceLink,
        totalTokens: token.totalTokens,
        rentStartDate: token.rentStartDate,
      };
    }

    console.log('✅ Processed', Object.keys(cachedTokens).length, 'tokens into cache');
    return cachedTokens;
  } catch (error: any) {
    console.error('❌ Error fetching all tokens:', error.message || error);
    throw error;
  }
}

// Route API pour récupérer/mettre à jour le cache
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('\n🚀 API /api/token called');
  console.log('🔹 Method:', req.method);
  console.log('🔹 Query:', req.query);
  
  if (req.method !== 'GET') {
    console.log('❌ Method not allowed:', req.method);
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Lire le cache existant
    console.log('📂 Reading cache from:', CACHE_FILE_PATH);
    let cache = await readCache();
    const forceRefresh = req.query.refresh === 'true';
    
    if (cache) {
      console.log('📄 Existing cache found, last updated:', new Date(cache.lastUpdated).toISOString());
      console.log('📄 Cache contains', Object.keys(cache.tokens).length, 'tokens');
      console.log('🕒 Cache age:', Math.round((Date.now() - cache.lastUpdated) / 1000 / 60), 'minutes');
    } else {
      console.log('⚠️ No existing cache found');
    }

    // Si on a un cache valide, le retourner immédiatement
    if (isCacheValid(cache) && !forceRefresh) {
      console.log('✅ Returning valid cache');
      res.status(200).json(cache);
      return;
    }

    // Si le cache n'est pas valide ou si on force le refresh, essayer de le régénérer
    if (!isCacheValid(cache) || forceRefresh) {
      console.log('🔄 Cache needs refresh (forceRefresh:', forceRefresh, ')');
      console.log('🔄 Refreshing tokens cache...');
      try {
        const tokens = await fetchAllTokens();
        console.log('💾 Writing cache to disk...');
        await writeCache(tokens);
        cache = {
          lastUpdated: Date.now(),
          tokens,
        };
        console.log('✅ Cache refreshed with', Object.keys(tokens).length, 'tokens');
        res.status(200).json(cache);
        return;
      } catch (fetchError) {
        console.error('❌ Error refreshing cache:', fetchError instanceof Error ? fetchError.message : String(fetchError));
        // Si on a un vieux cache, le retourner quand même
        if (cache) {
          console.warn('⚠️ Returning stale cache due to refresh error');
          res.status(200).json(cache);
          return;
        }
        throw fetchError; // Sinon, propager l'erreur
      }
    }

    // Retourner le cache
    console.log('✅ Returning cache');
    res.status(200).json(cache);
  } catch (error) {
    console.error('❌ Error in /api/token:', error);
    
    // En dernier recours, essayer de retourner n'importe quel cache existant
    const staleCache = await readCache();
    if (staleCache) {
      console.warn('⚠️ Returning any available cache due to error');
      res.status(200).json(staleCache);
      return;
    }

    // Si vraiment aucun cache n'est disponible, retourner un cache vide plutôt qu'une erreur
    console.warn('⚠️ No cache available, returning empty cache');
    res.status(200).json({ 
      lastUpdated: Date.now(),
      tokens: {},
      error: 'Cache temporarily unavailable'
    });
  }
}

