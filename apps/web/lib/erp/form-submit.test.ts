import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// O Button do sistema vem com type="button": dentro de um <form>, clicar nele não envia
// (só o Enter enviava). Todo formulário precisa de um botão com type="submit".
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' ? [] : files(path);
    return path.endsWith('.tsx') && !path.endsWith('.test.tsx') ? [path] : [];
  });
}

describe('formulários enviam ao clicar no botão', () => {
  it('todo <form> com botão tem um type="submit"', () => {
    const root = join(__dirname, '..', '..');
    const problems: string[] = [];
    for (const file of [...files(join(root, 'components')), ...files(join(root, 'app'))]) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/<form\b/g)) {
        const end = source.indexOf('</form>', match.index);
        if (end < 0) continue;
        const block = source.slice(match.index, end);
        if (/<Button\b|<button\b/.test(block) && !/type=["']submit["']/.test(block))
          problems.push(
            `${file.slice(root.length + 1)}:${source.slice(0, match.index).split('\n').length}`,
          );
      }
    }
    expect(problems).toEqual([]);
  });
});
