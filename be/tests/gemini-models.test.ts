// Unit tests for Gemini model ranking / memory (pure, no network).
import { describe, expect, test } from 'bun:test';
import { rankGeminiModels, isRetiredModelError, geminiMemory } from '../src/services/gemini-models';

const LIST = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-preview-tts',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.8-flash',
  'gemini-3.8-flash-lite',
  'gemini-3.8-pro-preview',
  'text-embedding-004',
  'gemini-2.0-flash-exp-image-generation',
];

describe('rankGeminiModels', () => {
  test('newest stable flash first, aliases last, non-chat models dropped', () => {
    expect(rankGeminiModels(LIST)).toEqual([
      'gemini-3.8-flash',
      'gemini-3.8-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
      'gemini-3.8-pro-preview',
      'gemini-flash-latest',
      'gemini-flash-lite-latest',
    ]);
  });
});

describe('isRetiredModelError', () => {
  test('retired vs temporary overload', () => {
    expect(isRetiredModelError('This model models/gemini-2.5-flash is no longer available to new users.')).toBe(true);
    expect(isRetiredModelError('This model is currently experiencing high demand.')).toBe(false);
  });
});

describe('geminiMemory.plan', () => {
  test('retired models are skipped and the last good model goes first', () => {
    const key = 'test-key-abcdefghijkl';
    geminiMemory.retire(key, 'gemini-3.8-flash');
    geminiMemory.remember(key, 'gemini-flash-lite-latest');
    expect(geminiMemory.plan(key, LIST)).toEqual([
      'gemini-flash-lite-latest',
      'gemini-3.8-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.5-pro',
    ]);
  });
  test('an explicitly chosen model is tried first', () => {
    expect(geminiMemory.plan('other-key-123456789012', LIST, 'gemini-2.5-pro')[0]).toBe('gemini-2.5-pro');
  });
});
