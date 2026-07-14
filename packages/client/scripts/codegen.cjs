#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const contracts = JSON.parse(fs.readFileSync(path.join(root, 'contracts.json'), 'utf8'));

function pascal(key) {
  if (/^[A-Z0-9_]+$/.test(key)) {
    return key
      .toLowerCase()
      .split('_')
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
  }
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function tsConstObject(name, obj) {
  const body = Object.entries(obj)
    .map(([k, v]) => `  ${k}: ${typeof v === 'number' ? v : JSON.stringify(v)},`)
    .join('\n');
  return `export const ${name} = {\n${body}\n} as const;`;
}

const ts = `/* AUTO-GENERATED from contracts.json - do not edit by hand. Run: pnpm run codegen */
${tsConstObject('PORTS', contracts.ports)}

export const INJECTION_TOKEN = ${JSON.stringify(contracts.injectionToken)} as const;
export const DOCKER_IMAGE = ${JSON.stringify(contracts.dockerImage)} as const;
export const SERVICE_NAME = ${JSON.stringify(contracts.name)} as const;

${tsConstObject('ENV_KEYS', contracts.env)}
${tsConstObject('PATTERNS', contracts.patterns)}
${tsConstObject('HTTP_PATHS', contracts.httpPaths)}
${tsConstObject('TOPICS', contracts.topics)}
${tsConstObject('EVENT_TYPES', contracts.eventTypes)}

export type StoragePattern = (typeof PATTERNS)[keyof typeof PATTERNS];
export type StorageTopic = (typeof TOPICS)[keyof typeof TOPICS];
export type StorageEventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
export type StorageHttpPath = (typeof HTTP_PATHS)[keyof typeof HTTP_PATHS];

export const StorageService = {
  name: SERVICE_NAME,
  token: INJECTION_TOKEN,
  image: DOCKER_IMAGE,
  ports: PORTS,
  env: ENV_KEYS,
  patterns: PATTERNS,
  httpPaths: HTTP_PATHS,
  topics: TOPICS,
  eventTypes: EVENT_TYPES,
} as const;
`;

const csEntries = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => {
      const lit = typeof v === 'number' ? v.toString() : `"${String(v).replace(/"/g, '\\"')}"`;
      const typ = typeof v === 'number' ? 'int' : 'string';
      return `        public const ${typ} ${pascal(k)} = ${lit};`;
    })
    .join('\n');

const cs = `// AUTO-GENERATED from contracts.json - do not edit by hand.
namespace Yaghmori.StorageService;

public static class StorageService
{
    public const string Name = "${contracts.name}";
    public const string InjectionToken = "${contracts.injectionToken}";
    public const string DockerImage = "${contracts.dockerImage}";

    public static class Ports
    {
${csEntries(contracts.ports)}
    }

    public static class Env
    {
${csEntries(contracts.env)}
    }

    public static class Patterns
    {
${csEntries(contracts.patterns)}
    }

    public static class HttpPaths
    {
${csEntries(contracts.httpPaths)}
    }

    public static class Topics
    {
${csEntries(contracts.topics)}
    }

    public static class EventTypes
    {
${csEntries(contracts.eventTypes)}
    }
}
`;

fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(path.join(root, 'src', 'generated.ts'), ts);

const dotnetDir = path.join(root, '..', '..', 'sdk', 'dotnet', 'Yaghmori.StorageService');
fs.mkdirSync(dotnetDir, { recursive: true });
fs.writeFileSync(path.join(dotnetDir, 'StorageService.g.cs'), cs);

console.log('codegen: TS + C# (storage)');
