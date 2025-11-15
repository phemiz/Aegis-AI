declare module "@modelcontextprotocol/sdk/server/mcp" {
  export class McpServer {
    constructor(serverInfo: any, options?: any);
    registerTool(name: string, config: any, cb: (args: any, extra: any) => any): any;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    sendToolListChanged(): void;
  }
}

declare module "@modelcontextprotocol/sdk/server/stdio" {
  export class StdioServerTransport {
    constructor();
  }
}

declare module "@modelcontextprotocol/sdk/dist/esm/server/mcp.js" {
  export class McpServer {
    constructor(serverInfo: any, options?: any);
    registerTool(name: string, config: any, cb: (args: any, extra: any) => any): any;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    sendToolListChanged(): void;
  }
}

declare module "@modelcontextprotocol/sdk/dist/esm/server/stdio.js" {
  export class StdioServerTransport {
    constructor();
  }
}

declare module "../node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js" {
  export class McpServer {
    constructor(serverInfo: any, options?: any);
    registerTool(name: string, config: any, cb: (args: any, extra: any) => any): any;
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    sendToolListChanged(): void;
  }
}

declare module "../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js" {
  export class StdioServerTransport {
    constructor();
  }
}
