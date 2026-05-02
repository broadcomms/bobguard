# BobGuard MCP Server

Custom Model Context Protocol server for HIPAA compliance enforcement.

## Tools (Phase 3a)

- **controls.lookup** - Returns full control object from HIPAA catalogs
- **controls.scan** - Scans diffs for HIPAA violations using regex patterns

## Development

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run mcp:dev

# Build for production
npm run mcp:build

# Run tests
npm test
```

## Usage

The MCP server is auto-discovered by Bob via `.bob/mcp.json`. After building, the server will appear in Bob's MCP panel with a green indicator.

## Architecture

- **Separate package** - Not an npm workspace, has its own node_modules
- **Stdio transport** - Communicates with Bob via stdin/stdout
- **Catalog caching** - Loads HIPAA control catalogs once at startup
- **256KB diff cap** - Protects stdio buffer from overflow

Built with Bob in Code mode (see `bob_sessions/03a-mcp-controls.md`).