import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Architectural Invariants & Renderer Isolation', () => {
  const rootDir = path.resolve(__dirname, '../../');

  it('packages/contracts must not depend on Electron, NestJS, React, or TypeORM', () => {
    const contractsPkgPath = path.join(rootDir, 'packages/contracts/package.json');
    const pkg = JSON.parse(fs.readFileSync(contractsPkgPath, 'utf-8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
      ...(pkg.peerDependencies || {}),
    };

    expect(allDeps['electron']).toBeUndefined();
    expect(allDeps['typeorm']).toBeUndefined();
    expect(allDeps['better-sqlite3']).toBeUndefined();
    expect(allDeps['@nestjs/core']).toBeUndefined();
    expect(allDeps['react']).toBeUndefined();
  });

  it('apps/renderer must not import TypeORM, better-sqlite3, or Node fs/path/child_process', () => {
    const rendererSrcDir = path.join(rootDir, 'apps/renderer/src');
    const files = fs
      .readdirSync(rendererSrcDir)
      .filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(rendererSrcDir, file), 'utf-8');
      expect(content).not.toMatch(/from\s+['"]typeorm['"]/);
      expect(content).not.toMatch(/from\s+['"]better-sqlite3['"]/);
      expect(content).not.toMatch(/from\s+['"]@bakery\/database['"]/);
      expect(content).not.toMatch(/from\s+['"]node:fs['"]/);
      expect(content).not.toMatch(/from\s+['"]node:child_process['"]/);
    }
  });

  it('apps/renderer package.json must not list database or electron dependencies', () => {
    const rendererPkgPath = path.join(rootDir, 'apps/renderer/package.json');
    const pkg = JSON.parse(fs.readFileSync(rendererPkgPath, 'utf-8'));
    const allDeps = {
      ...(pkg.dependencies || {}),
    };

    expect(allDeps['@rz-crm/database']).toBeUndefined();
    expect(allDeps['better-sqlite3']).toBeUndefined();
    expect(allDeps['typeorm']).toBeUndefined();
    expect(allDeps['electron']).toBeUndefined();
  });
});
