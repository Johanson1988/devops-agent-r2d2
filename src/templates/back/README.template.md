# {{name}} Backend API

Express API built with TypeScript featuring a `/health` endpoint for GitOps demo.

## Development

```sh
npm install
npm run dev  # Development mode with ts-node
```

## Production Build

```sh
npm install
npm run build
npm start
```

## Health Check

GET `/health` → `{ status: "ok", version: "0.0.1", timestamp: "2026-02-18T..." }`
