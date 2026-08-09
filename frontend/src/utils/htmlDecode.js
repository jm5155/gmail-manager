/**
 * htmlDecode.js — HTML Entity Decoder Utility
 * Decodes HTML entities (&#39;, &quot;, &amp;, etc.) to their character equivalents.
 * Prevents raw entity codes from leaking into rendered email subjects/snippets.
 */

/**
 * Decodes HTML entities in a string to their corresponding characters.
 * @param {string} text - Text potentially containing HTML entities
 * @returns {string} - Decoded text
 */
export function decodeHTMLEntities(text) {
  if (!text || typeof text !== 'string') return text;
  
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

/**
 * Decodes common HTML entities without DOM manipulation (lighter alternative)
 * @param {string} text - Text potentially containing HTML entities
 * @returns {string} - Decoded text
 */
export function decodeCommonEntities(text) {
  if (!text || typeof text !== 'string') return text;
  
  const entities = {
    '&#39;': "'",
    '&quot;': '"',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&nbsp;': ' ',
  };
  
  return text.replace(/&#?\w+;/g, match => entities[match] || match);
}
