# Nest GraphQL MCP Module

This module provides integration between NestJS, GraphQL, and the Model Context Protocol (MCP).

If you have a mature GraphQL environment, this module allows you to expose specific queries and mutations to AI agents as MCP tools by using your existing schema types and documentation directly.

## Installation

```sh
npm install nest-graphql-mcp @modelcontextprotocol/sdk zod
```

## Module Registration

Import `NestGraphqlMcpModule.forRoot()` in your root `AppModule`:

```ts
import { Module } from '@nestjs/common';
import { NestGraphqlMcpModule } from 'nest-graphql-mcp';

@Module({
  imports: [
    NestGraphqlMcpModule.forRoot({
      path: '/mcp/stateless', // Endpoint for AI agents
    }),
    // ... GraphQLModule import (see Code-First or Schema-First setup below)
  ],
})
export class AppModule {}
```

## Code-First Approach

Use TypeScript decorators to generate the GraphQL schema and register the MCP directive.

Pass `MCP_DIRECTIVE_DEFINITION` to buildSchemaOptions.directives:

```ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { NestGraphqlMcpModule, MCP_DIRECTIVE_DEFINITION } from 'nest-graphql-mcp';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      buildSchemaOptions: {
        directives: [MCP_DIRECTIVE_DEFINITION],
      },
    }),
    NestGraphqlMcpModule.forRoot(),
  ],
})
export class AppModule {}
```

Attach the `@ExposeMcp()` decorator to any GraphQL Query or Mutation you want to expose to AI agents. You can optionally pass agent-specific prompt instructions.

```ts
import { Resolver, Query, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ExposeMcp } from 'nest-graphql-mcp';
import { AuthGuard } from './auth.guard';
import { User } from './user.model';

@Resolver(() => User)
export class UserResolver {
  @Query(() => User, {
    description: 'Fetches user details by ID.',
  })
  @ExposeMcp('Prefer looking up users by UUID. Do not call in a loop for bulk queries.')
  @UseGuards(AuthGuard)
  async userById(@Args('id') id: string) {
    return this.userService.findById(id);
  }

  @Query(() => [User])
  // Standard GQL query hidden from MCP tools because @ExposeMcp() is omitted
  async internalAdminSearch() {
    return this.userService.findAll();
  }
}
```

## Schema-First Approach

In the Schema-First approach, you define your GraphQL types and directives inside .graphql SDL files. This module automatically reads the compiled GraphQL AST at startup to discover fields annotated with `@mcp`.

```ts
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { NestGraphqlMcpModule, MCP_DIRECTIVE_DEFINITION } from 'nest-graphql-mcp';

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      typePaths: ['./**/*.graphql'],
      definitions: {
        path: join(process.cwd(), 'src/graphql.ts'),
      },
    }),
    NestGraphqlMcpModule.forRoot(),
  ],
})
export class AppModule {}
```

Add the `@mcp` directive definition to your .graphql schema file and annotate fields directly:

```graphql
" Directive to expose operations as MCP Tools to AI agents. "
directive @mcp(instructions: String) on FIELD_DEFINITION

type User {
  id: ID!
  name: String!
  email: String!
}

type Query {
  me: User @mcp

  # Exposing to MCP with custom agent instructions
  userById(id: ID!): User @mcp(instructions: "Prefer looking up users by UUID. Do not call in a loop for bulk queries.")

  # Hidden from MCP tools
  internalAdminSearch: [User!]!
}
```

Import your `.graphql` files as usual. No special directive configuration is needed in Typescript.

## Authentication & Context Forwarding

When an AI agent calls an MCP tool over HTTP, `nest-graphql-mcp` forwards the incoming `Authorization` header directly into GraphQL's execution context:

```
[AI Agent]
    │
    │  HTTP POST /mcp/stateless
    │  Header: Authorization: Bearer <SERVICE_ACCOUNT_JWT>
    ▼
[nest-graphql-mcp]
    │
    │  Executes query with contextValue: { req: { headers: { authorization } } }
    ▼
[NestJS Resolvers / @UseGuards()]
```

This ensures your existing NestJS Guards, Role Checks, and Field-level permissions continue to execute for AI service accounts.

## Agent Setup & Testing

### Cursor / Claude / Standard MCP Setup

Add the endpoint and service account JWT to your mcp.json config:

```ts
{
  "mcpServers": {
    "nestjs-api": {
      "url": "http://localhost:3000/mcp/stateless",
      "transport": "http",
      "headers": {
        "Authorization": "Bearer YOUR_SERVICE_ACCOUNT_JWT"
      }
    }
  }
}
```

### Inspectiing Tools via Curl

You can verify that exposed tools and JSON Schemas are generated correctly by sending a JSON-RPC request:

```sh
# List Tools
curl -X POST http://localhost:3000/api/mcp/stateless \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_SERVICE_ACCOUNT_JWT" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

```sh
# Execute Tool
curl -s -X POST http://localhost:3000/api/mcp/stateless \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "Authorization: Bearer YOUR_SERVICE_ACCOUNT_JWT" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "query_getUser",
      "arguments": {
        "id": "usr_123"
      }
    }
  }'
```

## License

MIT, see the included [LICENSE](LICENSE.md) file.
