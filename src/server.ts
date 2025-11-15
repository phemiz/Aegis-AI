import { config as loadEnv } from "dotenv";
import { McpServer } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js";
import { StdioServerTransport } from "../node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js";
import { z } from "zod";
import type { MemoryCore } from "./memoryCore.js";
import { SqliteMemory } from "./memory/sqliteMemory.js";
import type { WebAutomation } from "./webAutomation.js";
import { PlaywrightWebAutomation } from "./playwrightWebAutomation.js";
import { loadConfigFromEnv } from "./config.js";
import { logger } from "./logger.js";
import { startHttpServer } from "./httpServer.js";

process.on("uncaughtException", (err) => {
  logger.error("uncaughtException", { error: String(err) });
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandledRejection", { reason: String(reason) });
});

loadEnv();
const config = loadConfigFromEnv();

function createMemoryCore(): MemoryCore {
  logger.info("Using SqliteMemory backend", {
    path: config.SQLITE_MEMORY_PATH,
  });
  return new SqliteMemory(config.SQLITE_MEMORY_PATH);
}

const memoryCore: MemoryCore = createMemoryCore();

function createWebAutomation(): WebAutomation {
  logger.info("Using PlaywrightWebAutomation backend");
  return new PlaywrightWebAutomation();
}

const webAutomation: WebAutomation = createWebAutomation();

const mcpServer = new McpServer(
  { name: "aegis-mcp", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
    },
  }
);

function registerTool(
  name: string,
  description: string,
  argsSchema: Record<string, z.ZodTypeAny>,
  handler: (input: any) => Promise<any>
) {
  const inputSchema = z.object(argsSchema);
  mcpServer.registerTool(
    name,
    {
      description,
      inputSchema,
    },
    async (args: any) => {
      const result = await handler(args);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    }
  );
}

// Web tools
registerTool(
  "web.search",
  "Perform a web search and return structured results.",
  {
    query: z.string(),
    maxResults: z.number().int().min(1).max(20).optional(),
  },
  async (input) => {
    const results = await webAutomation.search(
      input.query,
      input.maxResults ?? 5
    );
    return { results };
  }
);

registerTool(
  "web.navigate",
  "Open a URL and return a page handle.",
  {
    url: z.string().url(),
  },
  async (input) => {
    return webAutomation.navigate(input.url);
  }
);

registerTool(
  "web.click",
  "Click an element on a page.",
  {
    pageId: z.string(),
    selector: z.string(),
    waitForNavigation: z.boolean().optional(),
  },
  async (input) => {
    return webAutomation.click(
      input.pageId,
      input.selector,
      input.waitForNavigation ?? true
    );
  }
);

registerTool(
  "web.extract",
  "Extract content from a page element.",
  {
    pageId: z.string(),
    selector: z.string(),
    format: z.enum(["text", "html"]).optional(),
  },
  async (input) => {
    return webAutomation.extract(
      input.pageId,
      input.selector,
      (input.format ?? "text") as "text" | "html"
    );
  }
);

// Additional web automation tools
registerTool(
  "web.find_form_fields",
  "Detect and describe form fields on a page for autofill.",
  {
    pageId: z.string(),
  },
  async (input) => {
    const fields = await webAutomation.findFormFields(input.pageId);
    return { fields };
  }
);

registerTool(
  "web.screenshot",
  "Take a screenshot of the given page and return it as a base64-encoded image.",
  {
    pageId: z.string(),
    fullPage: z.boolean().optional(),
  },
  async (input) => {
    const result = await webAutomation.screenshot(input.pageId, {
      fullPage: input.fullPage ?? true,
    });
    return result;
  }
);

registerTool(
  "web.set_value",
  "Set the value of an input field on a web page.",
  {
    pageId: z.string(),
    selector: z.string(),
    value: z.string(),
  },
  async (input) => {
    const result = await webAutomation.setValue(
      input.pageId,
      input.selector,
      input.value
    );
    return result;
  }
);

// Memory tools
registerTool(
  "memory.get_profile",
  "Get the user profile used for personalization (tone, LinkedIn, etc).",
  {
    userId: z.string(),
  },
  async (input) => {
    const profile = await memoryCore.getUserProfile(input.userId);
    return { profile };
  }
);

registerTool(
  "memory.read",
  "Read a specific memory item by key.",
  {
    userId: z.string(),
    key: z.string(),
  },
  async (input) => {
    const item = await memoryCore.getItem(input.userId, input.key);
    return { item };
  }
);

registerTool(
  "memory.query",
  "Query memory items by type/tags/text for the given user (simple filter).",
  {
    userId: z.string(),
    type: z.string().optional(),
    tags: z.array(z.string()).optional(),
    text: z.string().optional(),
    limit: z.number().int().min(1).max(50).optional(),
  },
  async (input) => {
    const items = await memoryCore.queryItems(input.userId, {
      type: input.type,
      tags: input.tags,
      text: input.text,
      limit: input.limit ?? 10,
    });
    return { items };
  }
);

registerTool(
  "memory.write",
  "Write a new memory item for the user.",
  {
    userId: z.string(),
    type: z.string(),
    key: z.string(),
    data: z.record(z.unknown()),
    tags: z.array(z.string()).optional(),
  },
  async (input) => {
    const createdAt = new Date().toISOString();
    await memoryCore.writeItem(input.userId, {
      key: input.key,
      type: input.type,
      data: input.data,
      createdAt,
      tags: input.tags ?? [],
    });
    return { success: true };
  }
);

registerTool(
  "memory.delete",
  "Delete a specific memory item by key.",
  {
    userId: z.string(),
    key: z.string(),
  },
  async (input) => {
    await memoryCore.deleteItem(input.userId, input.key);
    return { success: true };
  }
);

registerTool(
  "memory.list",
  "List memory item keys and metadata for the user (optionally filtered by type).",
  {
    userId: z.string(),
    type: z.string().optional(),
  },
  async (input) => {
    const items = await memoryCore.listItems(input.userId, {
      type: input.type,
    });
    return { items };
  }
);

// Data source tools (stubs)
registerTool(
  "stock_api",
  "Fetch stock data for a given symbol. Replace stub with a real market data API.",
  {
    query: z.string(),
  },
  async (input) => {
    // Stub: return a fake stock snapshot.
    return {
      symbol: input.query,
      price: 100,
      changePercent: 0,
      raw: null,
    };
  }
);

registerTool(
  "news_api",
  "Fetch recent news articles for a topic. Replace stub with a real news API.",
  {
    query: z.string(),
  },
  async (input) => {
    return {
      query: input.query,
      articles: [],
    };
  }
);

// Google Analytics tool (stub)
registerTool(
  "ga.get_report",
  "Fetch a Google Analytics report. Replace stub with a real GA API integration.",
  {
    viewId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    metrics: z.array(z.string()).optional(),
    dimensions: z.array(z.string()).optional(),
  },
  async (input) => {
    // Stub: return an empty GA-like structure.
    return {
      viewId: input.viewId,
      startDate: input.startDate,
      endDate: input.endDate,
      metrics: input.metrics ?? [],
      dimensions: input.dimensions ?? [],
      rows: [],
    };
  }
);

// CRM sales tool (stub)
registerTool(
  "crm.get_sales",
  "Fetch CRM sales data. Replace stub with a real CRM API integration.",
  {
    accountId: z.string(),
    startDate: z.string(),
    endDate: z.string(),
  },
  async (input) => {
    return {
      accountId: input.accountId,
      startDate: input.startDate,
      endDate: input.endDate,
      totalRevenue: 0,
      deals: [],
    };
  }
);

// Social mentions tool (stub)
registerTool(
  "social.get_mentions",
  "Fetch top social media mentions. Replace stub with a real social listening integration.",
  {
    handles: z.array(z.string()),
    startDate: z.string(),
    endDate: z.string(),
    limit: z.number().int().min(1).max(100).optional(),
  },
  async (input) => {
    return {
      handles: input.handles,
      startDate: input.startDate,
      endDate: input.endDate,
      limit: input.limit ?? 20,
      mentions: [],
    };
  }
);

// Google Docs tool (stub)
registerTool(
  "gdocs.create_document",
  "Create a Google Doc with the provided title and body. Replace stub with a real Google Docs API integration.",
  {
    title: z.string(),
    body: z.string(),
    folderId: z.string().optional(),
  },
  async (input) => {
    // Stub: return a fake doc id and URL.
    const id = `doc_${Date.now()}`;
    return {
      id,
      url: `https://docs.example.com/${encodeURIComponent(id)}`,
      title: input.title,
      folderId: input.folderId ?? null,
    };
  }
);

// Notification / channel tools (stubs)
registerTool(
  "whatsapp.send",
  "Send a WhatsApp message to the user. Replace stub with a real WhatsApp Business API integration.",
  {
    userId: z.string(),
    message: z.string(),
    subject: z.string().optional(),
  },
  async (input) => {
    // Stub: pretend the message was sent.
    return {
      success: true,
      channel: "whatsapp",
      userId: input.userId,
    };
  }
);

registerTool(
  "email.send",
  "Send an email to the user. Replace stub with a real email provider integration.",
  {
    userId: z.string(),
    message: z.string(),
    subject: z.string().optional(),
  },
  async (input) => {
    return {
      success: true,
      channel: "email",
      userId: input.userId,
    };
  }
);

// Start MCP server over stdio using the official MCP SDK
async function main() {
  // Start optional HTTP transport (health/metrics)
  startHttpServer();

  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
}

main().catch((err) => {
  console.error("Failed to start MCP server", err);
  process.exit(1);
});
