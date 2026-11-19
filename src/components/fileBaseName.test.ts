import { it, expect } from 'vitest';
import { fileBaseName } from './fileBaseName';

it('drops the extension', () => { expect(fileBaseName('prompts--bias.csv')).toBe('prompts--bias'); });
it('keeps inner dots', () => { expect(fileBaseName('data.v2.csv')).toBe('data.v2'); });
it('keeps a name without extension', () => { expect(fileBaseName('README')).toBe('README'); });
it('keeps a name that is only an extension', () => { expect(fileBaseName('.env')).toBe('.env'); });
it('drops only the last extension', () => { expect(fileBaseName('archive.tar.gz')).toBe('archive.tar'); });
