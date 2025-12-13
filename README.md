# Storage Service

A standalone microservice for file storage and asset management with support for multiple storage providers (Local, MinIO, AWS S3), image processing, variants, and analytics.

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Setup environment
cp apps/storage-service/env.example apps/storage-service/.env

# Start the service
nx serve storage-service
```

The service will be available at:

- **HTTP API**: http://localhost:4000/api
- **TCP Microservice**: localhost:4001

## 📚 Documentation

- **[USAGE_GUIDE.md](./USAGE_GUIDE.md)** - Complete usage guide with examples
- **[STORAGE_CLIENT_EXAMPLE.md](./STORAGE_CLIENT_EXAMPLE.md)** - Integration examples for other microservices
- **[QUICK_START.md](./QUICK_START.md)** - Development setup guide
- **[README.docker.md](./README.docker.md)** - Docker setup guide

## 🔌 Integration

The storage service can be used in two ways:

1. **HTTP REST API** - For any language/framework
2. **TCP Microservice** - For NestJS services (recommended)

See [STORAGE_CLIENT_EXAMPLE.md](./STORAGE_CLIENT_EXAMPLE.md) for integration examples.

## 📋 Features

- ✅ Multiple storage providers (Local, MinIO, AWS S3)
- ✅ File upload and management
- ✅ Image processing and variants
- ✅ Signed URLs for secure access
- ✅ Download analytics
- ✅ Both HTTP REST API and TCP microservice interfaces
- ✅ Standalone service - no gateway needed

## 🛠️ Development

<a alt="Nx logo" href="https://nx.dev" target="_blank" rel="noreferrer"><img src="https://raw.githubusercontent.com/nrwl/nx/master/images/nx-logo.png" width="45"></a>

This is an [Nx workspace](https://nx.dev). [Learn more about this workspace setup](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or run `npx nx graph` to visually explore the project.

## Finish your CI setup

[Click here to finish setting up your workspace!](https://cloud.nx.app/connect/jqA31d4zsM)

## Run tasks

To run the dev server for your app, use:

```sh
npx nx serve storage-service
```

To create a production bundle:

```sh
npx nx build storage-service
```

To see all available targets to run for a project, run:

```sh
npx nx show project storage-service
```

These targets are either [inferred automatically](https://nx.dev/concepts/inferred-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) or defined in the `project.json` or `package.json` files.

[More about running tasks in the docs &raquo;](https://nx.dev/features/run-tasks?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Add new projects

While you could add new projects to your workspace manually, you might want to leverage [Nx plugins](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) and their [code generation](https://nx.dev/features/generate-code?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) feature.

Use the plugin's generator to create new projects.

To generate a new application, use:

```sh
npx nx g @nx/node:app demo
```

To generate a new library, use:

```sh
npx nx g @nx/node:lib mylib
```

You can use `npx nx list` to get a list of installed plugins. Then, run `npx nx list <plugin-name>` to learn about more specific capabilities of a particular plugin. Alternatively, [install Nx Console](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) to browse plugins and generators in your IDE.

[Learn more about Nx plugins &raquo;](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects) | [Browse the plugin registry &raquo;](https://nx.dev/plugin-registry?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

[Learn more about Nx on CI](https://nx.dev/ci/intro/ci-with-nx#ready-get-started-with-your-provider?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Install Nx Console

Nx Console is an editor extension that enriches your developer experience. It lets you run tasks, generate code, and improves code autocompletion in your IDE. It is available for VSCode and IntelliJ.

[Install Nx Console &raquo;](https://nx.dev/getting-started/editor-setup?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

## Useful links

Learn more:

- [Learn more about this workspace setup](https://nx.dev/nx-api/node?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Learn about Nx on CI](https://nx.dev/ci/intro/ci-with-nx?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [Releasing Packages with Nx release](https://nx.dev/features/manage-releases?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
- [What are Nx plugins?](https://nx.dev/concepts/nx-plugins?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)

And join the Nx community:

- [Discord](https://go.nx.dev/community)
- [Follow us on X](https://twitter.com/nxdevtools) or [LinkedIn](https://www.linkedin.com/company/nrwl)
- [Our Youtube channel](https://www.youtube.com/@nxdevtools)
- [Our blog](https://nx.dev/blog?utm_source=nx_project&utm_medium=readme&utm_campaign=nx_projects)
