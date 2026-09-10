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

/**
 * Strips HTML tags from text and decodes entities.
 * Converts HTML content to plain text for display in snippets.
 * @param {string} html - HTML string to convert
 * @returns {string} - Plain text with entities decoded
 */
export function stripHTML(html) {
  if (!html || typeof html !== 'string') return html;
  
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;
  
  // Get text content (automatically strips tags)
  let text = temp.textContent || temp.innerText || '';
  
  // Clean up extra whitespace
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}
