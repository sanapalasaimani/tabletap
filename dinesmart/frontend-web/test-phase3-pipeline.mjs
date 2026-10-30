/**
 * Automated Verification Suite for Phase 3:
 * 1. Okapi BM25 Lexical Search
 * 2. Dense Semantic Vector Cosine Similarity
 * 3. Reciprocal Rank Fusion (RRF with k = 60)
 * 4. Cross-Feature Relevance Reranking
 * 5. Full Hybrid Retrieval Across Menus & Policies
 */

import assert from 'assert';
import { executeAdvancedHybridRetrieval, tokenize } from './src/services/rag/hybridEngine.ts';

console.log('====================================================');
console.log(' RUNNING PHASE 3 HYBRID RETRIEVAL VERIFICATION');
console.log('====================================================\n');

// Test 1: Tokenizer & Stopword stripping
console.log('--- 1. Testing Tokenizer ---');
const sampleText = "What is the Goods and Services Tax (GST) rate for dining?";
const tokens = tokenize(sampleText);
console.log('Tokens:', tokens);
assert(tokens.includes('goods'), 'Should include "goods"');
assert(tokens.includes('services'), 'Should include "services"');
assert(tokens.includes('tax'), 'Should include "tax"');
assert(tokens.includes('gst'), 'Should include "gst"');
assert(!tokens.includes('what'), 'Should exclude stopword "what"');
assert(!tokens.includes('is'), 'Should exclude stopword "is"');
console.log('✓ Tokenizer & stopword stripping verified');

// Test 2: Policy Retrieval via Hybrid Search (GST Tax Rate)
console.log('\n--- 2. Testing Hybrid Retrieval: Tax Policy ---');
const taxResult = executeAdvancedHybridRetrieval("What is our dining GST rate and tax policy?", { topK: 3 });
console.log('Top Hit ID:', taxResult.citations[0]?.sourceId);
console.log('Top Hit Title:', taxResult.citations[0]?.title);
assert.strictEqual(taxResult.citations[0]?.sourceId, 'POL-TAX-01', 'Top hit should be POL-TAX-01');
assert(taxResult.formattedContext.includes('5%'), 'Context should verify 5% GST');
console.log('✓ Tax policy correctly retrieved with top rank');

// Test 3: Allergen Protocol Retrieval
console.log('\n--- 3. Testing Hybrid Retrieval: Allergen Protocols ---');
const allergenResult = executeAdvancedHybridRetrieval("What is our policy for guests with peanut or gluten allergies?", { topK: 3 });
console.log('Top Hit ID:', allergenResult.citations[0]?.sourceId);
console.log('Top Hit Title:', allergenResult.citations[0]?.title);
assert.strictEqual(allergenResult.citations[0]?.sourceId, 'POL-ALG-04', 'Top hit should be POL-ALG-04');
assert(allergenResult.formattedContext.includes('FSSAI'), 'Context should reference FSSAI allergen regulations');
console.log('✓ Allergen safety protocol correctly retrieved');

// Test 4: Menu Catalog Retrieval (Masala Dosa)
console.log('\n--- 4. Testing Hybrid Retrieval: Menu Item ---');
const menuResult = executeAdvancedHybridRetrieval("Tell me about Masala Dosa, its price, calories, and description", { topK: 3 });
console.log('Top Hit ID:', menuResult.citations[0]?.sourceId);
console.log('Top Hit Title:', menuResult.citations[0]?.title);
assert.strictEqual(menuResult.citations[0]?.sourceId, 'MENU-BF1', 'Top hit should be MENU-BF1');
assert(menuResult.formattedContext.includes('90'), 'Should contain price ₹90');
console.log('✓ Masala Dosa menu chunk retrieved with top rank');

// Test 5: SOP Retrieval (Kitchen Expediter / Rush Hour)
console.log('\n--- 5. Testing Hybrid Retrieval: Kitchen Expediter SOP ---');
const sopResult = executeAdvancedHybridRetrieval("What are the responsibilities of the kitchen expediter during rush hours?", { topK: 3 });
console.log('Top Hit ID:', sopResult.citations[0]?.sourceId);
console.log('Top Hit Title:', sopResult.citations[0]?.title);
assert.strictEqual(sopResult.citations[0]?.sourceId, 'SOP-KTN-02', 'Top hit should be SOP-KTN-02');
console.log('✓ Kitchen Expediter SOP correctly retrieved');

// Test 6: Verify Citations Structure
console.log('\n--- 6. Testing Citations Structure ---');
const firstCitation = taxResult.citations[0];
assert(firstCitation.sourceId, 'Citation must have sourceId');
assert(firstCitation.sourceType, 'Citation must have sourceType');
assert(firstCitation.title, 'Citation must have title');
assert(firstCitation.confidence > 0.6, 'Confidence should be > 0.6');
console.log('Citation sample:', firstCitation);
console.log('✓ Citations schema conforms to production standard');

console.log('\n====================================================');
console.log(' ALL PHASE 3 HYBRID RETRIEVAL TESTS PASSED (100%)');
console.log('====================================================');

