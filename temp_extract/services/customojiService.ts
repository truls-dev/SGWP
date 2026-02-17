import { renderFromTemplateSrc } from './bitmojiService';

export interface TemplateEntry {
  comic_id: string | number;
  src: string;
  tags: string[];
  alt_text?: string;
  descriptive_alt_text?: string;
}

interface TagMatch {
  tag: string;
  entry: TemplateEntry;
}

let catalog: TemplateEntry[] = [];
let exactTagMap = new Map<string, TemplateEntry>();
let flattenedPrefixTags: TagMatch[] = [];
let isLoaded = false;
let isInitializing = false;

/**
 * Initializes the sticker catalog by fetching the templates.json file.
 * Builds an optimized lookup map for instant responses.
 */
export const initCatalog = async () => {
  if (isLoaded || isInitializing) return;
  isInitializing = true;
  
  try {
    const response = await fetch('templates.json');
    if (!response.ok) throw new Error("Templates catalog not found at root.");
    
    const data = await response.json();
    catalog = data.imoji || [];
    
    exactTagMap.clear();
    flattenedPrefixTags = [];

    catalog.forEach(entry => {
      entry.tags.forEach(tag => {
        const lowerTag = tag.toLowerCase().trim();
        // 1. Map for exact matches (highest priority)
        // Note: Map keys are unique, so first entry for a tag wins.
        if (!exactTagMap.has(lowerTag)) {
            exactTagMap.set(lowerTag, entry);
        }
        // 2. List for prefix/partial matches
        flattenedPrefixTags.push({ tag: lowerTag, entry });
      });
    });

    // Sort by tag length descending: ensures "thank you" matches before "thank" in prefix searches
    flattenedPrefixTags.sort((a, b) => b.tag.length - a.tag.length);
    
    isLoaded = true;
    isInitializing = false;
  } catch (e) {
    isInitializing = false;
    console.error("CustomojiService: Initialization failed.", e);
  }
};

/**
 * Searches for a sticker suggestion based on the user's input.
 * Priority Logic:
 * 1. Exact full input match (e.g. "thank you" -> Thanks)
 * 2. Exact last word match (e.g. "yes!" -> Yes)
 * 3. Prefix match for last word (e.g. "than" -> Thanks)
 */
export const findCustomojiSuggestion = (input: string): TemplateEntry | null => {
  if (!isLoaded) {
    if (!isInitializing) initCatalog();
    return null;
  }

  // Normalize input: lower case, trim, and strip trailing punctuation/emojis for matching
  const rawInput = input.toLowerCase();
  const cleanInput = rawInput.trim().replace(/[^a-z0-9\s]+$/gu, '');
  
  if (cleanInput.length < 2) return null;

  const words = cleanInput.split(/\s+/);
  const lastWord = words[words.length - 1];

  // --- 1. FULL INPUT EXACT MATCH ---
  if (exactTagMap.has(cleanInput)) {
    return exactTagMap.get(cleanInput)!;
  }

  // --- 2. LAST WORD EXACT MATCH ---
  // If typing "yes!", we want to match "yes" exactly, not prefix-match "yesterday"
  if (exactTagMap.has(lastWord)) {
    return exactTagMap.get(lastWord)!;
  }

  // --- 3. PREFIX MATCH (For typing flow) ---
  // Only trigger for words 3 chars or longer to avoid frequent false positives on short words like "h", "y", "no"
  if (lastWord.length >= 3) {
    for (const match of flattenedPrefixTags) {
      if (match.tag.startsWith(lastWord)) {
        return match.entry;
      }
    }
  }

  // --- 4. FALLBACK: Phrase Substring Search ---
  // If input contains a known multi-word tag anywhere
  for (const match of flattenedPrefixTags) {
    if (match.tag.length > 5 && cleanInput.includes(match.tag)) {
      return match.entry;
    }
  }

  return null;
};

export const getCustomojiUrl = (template: TemplateEntry, avatarIdA: string, avatarIdB?: string): string => {
  // Always use the user specified renderFromTemplateSrc to ensure %s substitution
  return renderFromTemplateSrc(template.src, avatarIdA, avatarIdB);
};

export const preloadImage = (url: string) => {
  const img = new Image();
  img.src = url;
};
