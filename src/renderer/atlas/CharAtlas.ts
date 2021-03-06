/**
 * Copyright (c) 2017 The xterm.js authors. All rights reserved.
 * @license MIT
 */

import { ITerminal } from '../../Types';
import { IColorSet } from '../Types';
import { ICharAtlasConfig } from '../../shared/atlas/Types';
import { generateCharAtlas } from '../../shared/atlas/CharAtlasGenerator';
import { generateConfig, configEquals } from './CharAtlasUtils';

interface ICharAtlasCacheEntry {
  bitmap: HTMLCanvasElement | Promise<ImageBitmap>;
  config: ICharAtlasConfig;
  ownedBy: ITerminal[];
}

let charAtlasCache: ICharAtlasCacheEntry[] = [];

/**
 * Acquires a char atlas, either generating a new one or returning an existing
 * one that is in use by another terminal.
 * @param terminal The terminal.
 * @param colors The colors to use.
 */
export function acquireCharAtlas(terminal: ITerminal, colors: IColorSet, scaledCharWidth: number, scaledCharHeight: number): HTMLCanvasElement | Promise<ImageBitmap> {
  const newConfig = generateConfig(scaledCharWidth, scaledCharHeight, terminal, colors);

  // TODO: Currently if a terminal changes configs it will not free the entry reference (until it's disposed)

  // Check to see if the terminal already owns this config
  for (let i = 0; i < charAtlasCache.length; i++) {
    const entry = charAtlasCache[i];
    const ownedByIndex = entry.ownedBy.indexOf(terminal);
    if (ownedByIndex >= 0) {
      if (configEquals(entry.config, newConfig)) {
        return entry.bitmap;
      } else {
        // The configs differ, release the terminal from the entry
        if (entry.ownedBy.length === 1) {
          charAtlasCache.splice(i, 1);
        } else {
          entry.ownedBy.splice(ownedByIndex, 1);
        }
        break;
      }
    }
  }

  // Try match a char atlas from the cache
  for (let i = 0; i < charAtlasCache.length; i++) {
    const entry = charAtlasCache[i];
    if (configEquals(entry.config, newConfig)) {
      // Add the terminal to the cache entry and return
      entry.ownedBy.push(terminal);
      return entry.bitmap;
    }
  }

  const canvasFactory = (width: number, height: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  };

  const newEntry: ICharAtlasCacheEntry = {
    bitmap: generateCharAtlas(window, canvasFactory, newConfig),
    config: newConfig,
    ownedBy: [terminal]
  };
  charAtlasCache.push(newEntry);
  return newEntry.bitmap;
}

/**
 * Removes a terminal reference from the cache, allowing its memory to be freed.
 * @param terminal The terminal to remove.
 */
export function removeTerminalFromCache(terminal: ITerminal): void {
  for (let i = 0; i < charAtlasCache.length; i++) {
    const index = charAtlasCache[i].ownedBy.indexOf(terminal);
    if (index !== -1) {
      if (charAtlasCache[i].ownedBy.length === 1) {
        // Remove the cache entry if it's the only terminal
        charAtlasCache.splice(i, 1);
      } else {
        // Remove the reference from the cache entry
        charAtlasCache[i].ownedBy.splice(index, 1);
      }
      break;
    }
  }
}
