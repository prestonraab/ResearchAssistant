import { jest } from '@jest/globals';

export const existsSync = jest.fn(() => false);
export const readFileSync = jest.fn(() => '');
export const writeFileSync = jest.fn();
export const readdirSync = jest.fn(() => []);
export const mkdirSync = jest.fn();
export const unlinkSync = jest.fn();
export const statSync = jest.fn(() => ({ isFile: () => true, isDirectory: () => false }));
export const readFile = jest.fn((path: any, callback: any) => callback(null, ''));
export const writeFile = jest.fn((path: any, data: any, callback: any) => callback(null));
export const mkdir = jest.fn((path: any, callback: any) => callback(null));
export const unlink = jest.fn((path: any, callback: any) => callback(null));
export const stat = jest.fn((path: any, callback: any) => callback(null, { isFile: () => true }));

export const promises = {
  readFile: jest.fn(async () => ''),
  writeFile: jest.fn(async () => undefined),
  mkdir: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
  stat: jest.fn(async () => ({ isFile: () => true }))
};
