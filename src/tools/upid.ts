import {
  type PublicClient,
  type Address,
  parseAbi,
  keccak256,
  labelhash,
  namehash,
} from "viem";

const UPID_REGISTRY = "0x091D00004f21eb2Fc30964A8a4995692d9b49628" as Address;

const ENS_ABI = parseAbi([
  "function resolver(bytes32 node) view returns (address)",
  "function addr(bytes32 node) view returns (address)",
  "function name(bytes32 node) view returns (string)",
  "function text(bytes32 node, string key) view returns (string)",
  "function contenthash(bytes32 node) view returns (bytes)",
]);

const RESOLVER_ABI = parseAbi([
  "function addr(bytes32 node) view returns (address)",
  "function name(bytes32 node) view returns (string)",
  "function text(bytes32 node, string key) view returns (string)",
  "function contenthash(bytes32 node) view returns (bytes)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
]);

export function registerUpIdTools(
  mcpServer: any,
  publicClient: PublicClient
) {
  mcpServer.tool(
    "giwa_upid_resolve",
    "Resolve a UP ID (username.up.id) to an Ethereum address on GIWA. UP ID is GIWA's ENS-based naming system by Upbit.",
    {
      name: {
        type: "string",
        description: "UP ID name (e.g., 'alice' or 'alice.up.id')",
      },
    },
    async ({ name }: { name: string }) => {
      const fullName = name.includes(".") ? name : `${name}.up.id`;
      const node = namehash(fullName);

      const resolver = (await publicClient.readContract({
        address: UPID_REGISTRY,
        abi: ENS_ABI,
        functionName: "resolver",
        args: [node],
      })) as Address;

      if (resolver === "0x0000000000000000000000000000000000000000") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  name: fullName,
                  found: false,
                  message: "No resolver found for this name",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const address = (await publicClient.readContract({
        address: resolver,
        abi: RESOLVER_ABI,
        functionName: "addr",
        args: [node],
      })) as Address;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                name: fullName,
                address,
                resolver,
                found:
                  address !==
                  "0x0000000000000000000000000000000000000000",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  mcpServer.tool(
    "giwa_upid_reverse",
    "Reverse-resolve an Ethereum address to a UP ID name on GIWA",
    {
      address: {
        type: "string",
        description: "Ethereum address to look up",
      },
    },
    async ({ address }: { address: string }) => {
      const reverseNode = namehash(
        `${address.toLowerCase().slice(2)}.addr.reverse`
      );

      const resolver = (await publicClient.readContract({
        address: UPID_REGISTRY,
        abi: ENS_ABI,
        functionName: "resolver",
        args: [reverseNode],
      })) as Address;

      if (resolver === "0x0000000000000000000000000000000000000000") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  address,
                  name: null,
                  found: false,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const name = (await publicClient.readContract({
          address: resolver,
          abi: RESOLVER_ABI,
          functionName: "name",
          args: [reverseNode],
        })) as string;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  address,
                  name: name || null,
                  found: !!name,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  address,
                  name: null,
                  found: false,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  mcpServer.tool(
    "giwa_upid_get_text",
    "Get a text record for a UP ID name on GIWA (e.g., avatar, email, url, description)",
    {
      name: {
        type: "string",
        description: "UP ID name (e.g., 'alice.up.id')",
      },
      key: {
        type: "string",
        description: "Text record key (e.g., 'avatar', 'email', 'url', 'com.twitter')",
      },
    },
    async ({ name, key }: { name: string; key: string }) => {
      const fullName = name.includes(".") ? name : `${name}.up.id`;
      const node = namehash(fullName);

      const resolver = (await publicClient.readContract({
        address: UPID_REGISTRY,
        abi: ENS_ABI,
        functionName: "resolver",
        args: [node],
      })) as Address;

      if (resolver === "0x0000000000000000000000000000000000000000") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { name: fullName, key, value: null, found: false },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const value = (await publicClient.readContract({
          address: resolver,
          abi: RESOLVER_ABI,
          functionName: "text",
          args: [node, key],
        })) as string;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  name: fullName,
                  key,
                  value: value || null,
                  found: !!value,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { name: fullName, key, value: null, found: false },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );

  mcpServer.tool(
    "giwa_upid_get_contenthash",
    "Get the contenthash for a UP ID name (for decentralized websites)",
    {
      name: {
        type: "string",
        description: "UP ID name (e.g., 'alice.up.id')",
      },
    },
    async ({ name }: { name: string }) => {
      const fullName = name.includes(".") ? name : `${name}.up.id`;
      const node = namehash(fullName);

      const resolver = (await publicClient.readContract({
        address: UPID_REGISTRY,
        abi: ENS_ABI,
        functionName: "resolver",
        args: [node],
      })) as Address;

      if (resolver === "0x0000000000000000000000000000000000000000") {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { name: fullName, contenthash: null, found: false },
                null,
                2
              ),
            },
          ],
        };
      }

      try {
        const contenthash = (await publicClient.readContract({
          address: resolver,
          abi: RESOLVER_ABI,
          functionName: "contenthash",
          args: [node],
        })) as `0x${string}`;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  name: fullName,
                  contenthash: contenthash || null,
                  found:
                    !!contenthash &&
                    contenthash !==
                      "0x0000000000000000000000000000000000000000000000000000000000000000",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { name: fullName, contenthash: null, found: false },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );
}
