import { describe, it, expect } from 'vitest';
import { spawn } from 'child_process';

// Use ts-node to run the TypeScript CLI entrypoint directly
const CLI_CMD = 'npx';
const CLI_ARGS = ['ts-node', 'src/cli/commands/resources/templates.tsx'];

describe('TemplatesList CLI (E2E)', () => {
  it('paginates to next page with real input', async () => {
    const cli = spawn(CLI_CMD, CLI_ARGS, {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let output = '';
    let resolved = false;

    await new Promise<void>((resolve, reject) => {
      cli.stdout.on('data', (data) => {
        output += data.toString();

        // Wait for the first page to render, then send 'n'
        if (output.includes('Page 1') && !resolved) {
          cli.stdin.write('n');
        }

        // Wait for the second page, then assert and quit
        if (output.includes('Template #11') && !resolved) {
          expect(output).toContain('Template #20');
          cli.stdin.write('q');
          resolved = true;
          cli.kill();
          resolve();
        }
      });

      cli.on('error', (err) => {
        if (!resolved) {
          resolved = true;
          reject(err);
        }
      });

      cli.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`CLI exited with code ${code}`));
        }
      });
    });
  });
});
