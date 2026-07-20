import {
  type PublicClient,
  type WalletClient,
  type Address,
  type Hex,
  parseAbi,
  encodePacked,
  keccak256,
  toBytes,
} from "viem";

const DOJANG_EAS_ADDRESS = "0x4200000000000000000000000000000000000021" as Address;

const EAS_ABI = parseAbi([
  "function attest(tuple(bytes32 schema, tuple(address recipient, uint64 expirationTime, bool revocable, bytes32 refUID, bytes data, uint256 value) data)) returns (bytes32)",
  "function getAttestation(bytes32 uid) view returns (tuple(bytes32 uid, bytes32 schema, uint64 time, uint64 expirationTime, bool revocable, bytes32 refUID, address recipient, address attester, bool valid, bytes data))",
  "function isAttestationValid(bytes32 uid) view returns (bool)",
  "function revoke(tuple(bytes32 schema, tuple(bytes32 uid, uint256 value) data))",
]);

const KNOWN_SCHEMAS = {
  verifiedAddress: "0xverified_address_schema_uid",
  balanceRoot: "0xbalance_root_schema_uid",
  verifiedBalance: "0xverified_balance_schema_uid",
  verifiedCode: "0xverified_code_schema_uid",
} as const;

export function registerDojangTools(
  mcpServer: any,
  publicClient: PublicClient,
  getWallet: () => WalletClient | null
) {
  mcpServer.tool(
    "giwa_dojang_get_attestation",
    "Get a Dojang attestation by UID. Dojang is GIWA's on-chain attestation system built on EAS, issued by UPbit.",
    {
      uid: { type: "string", description: "Attestation UID (0x...)" },
    },
    async ({ uid }: { uid: string }) => {
      const attestation = (await publicClient.readContract({
        address: DOJANG_EAS_ADDRESS,
        abi: EAS_ABI,
        functionName: "getAttestation",
        args: [uid as Hex],
      })) as {
        uid: Hex;
        schema: Hex;
        recipient: Address;
        attester: Address;
        time: bigint;
        expirationTime: bigint;
        revocable: boolean;
        valid: boolean;
        data: Hex;
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                uid: attestation.uid,
                schema: attestation.schema,
                recipient: attestation.recipient,
                attester: attestation.attester,
                time: new Date(Number(attestation.time) * 1000).toISOString(),
                expirationTime: attestation.expirationTime.toString(),
                revocable: attestation.revocable,
                valid: attestation.valid,
                data: attestation.data,
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
    "giwa_dojang_is_valid",
    "Check if a Dojang attestation is currently valid on GIWA",
    {
      uid: { type: "string", description: "Attestation UID (0x...)" },
    },
    async ({ uid }: { uid: string }) => {
      const isValid = await publicClient.readContract({
        address: DOJANG_EAS_ADDRESS,
        abi: EAS_ABI,
        functionName: "isAttestationValid",
        args: [uid as Hex],
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                uid,
                valid: isValid,
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
    "giwa_dojang_attest",
    "Create a new Dojang attestation on GIWA (requires PRIVATE_KEY). Uses EAS protocol.",
    {
      schema: { type: "string", description: "Schema UID (0x...)" },
      recipient: {
        type: "string",
        description: "Recipient address",
      },
      data: {
        type: "string",
        description: "Attestation data (hex-encoded, 0x...)",
      },
      revocable: {
        type: "boolean",
        description: "Whether attestation can be revoked (default: true)",
      },
    },
    async ({
      schema,
      recipient,
      data,
      revocable = true,
    }: {
      schema: string;
      recipient: string;
      data: string;
      revocable?: boolean;
    }) => {
      const wallet = getWallet();
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PRIVATE_KEY not set. Cannot create attestations.",
            },
          ],
        };
      }

      const { request } = await publicClient.simulateContract({
        address: DOJANG_EAS_ADDRESS,
        abi: EAS_ABI,
        functionName: "attest",
        args: [
          {
            schema: schema as Hex,
            data: {
              recipient: recipient as Address,
              expirationTime: 0n,
              revocable,
              refUID:
                "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
              data: data as Hex,
              value: 0n,
            },
          },
        ],
        account: wallet.account!,
      });

      const hash = await wallet.writeContract(request);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                txHash: hash,
                schema,
                recipient,
                explorer: `https://sepolia-explorer.giwa.io/tx/${hash}`,
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
    "giwa_dojang_revoke",
    "Revoke a Dojang attestation on GIWA (requires PRIVATE_KEY, must be original attester)",
    {
      schema: { type: "string", description: "Schema UID (0x...)" },
      uid: { type: "string", description: "Attestation UID to revoke" },
    },
    async ({ schema, uid }: { schema: string; uid: string }) => {
      const wallet = getWallet();
      if (!wallet) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: PRIVATE_KEY not set.",
            },
          ],
        };
      }

      const { request } = await publicClient.simulateContract({
        address: DOJANG_EAS_ADDRESS,
        abi: EAS_ABI,
        functionName: "revoke",
        args: [
          {
            schema: schema as Hex,
            data: {
              uid: uid as Hex,
              value: 0n,
            },
          },
        ],
        account: wallet.account!,
      });

      const hash = await wallet.writeContract(request);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                txHash: hash,
                revokedUid: uid,
                explorer: `https://sepolia-explorer.giwa.io/tx/${hash}`,
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
    "giwa_dojang_list_schemas",
    "List known Dojang attestation schemas on GIWA",
    {},
    async () => {
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                schemas: {
                  verifiedAddress: {
                    description:
                      "Proves a blockchain address is owned by a verified individual (KYC). Issued by UPbit Korea.",
                    uid: KNOWN_SCHEMAS.verifiedAddress,
                  },
                  balanceRoot: {
                    description:
                      "Merkle root of an address's token holdings at a point in time.",
                    uid: KNOWN_SCHEMAS.balanceRoot,
                  },
                  verifiedBalance: {
                    description:
                      "Proves a specific token balance of a verified address.",
                    uid: KNOWN_SCHEMAS.verifiedBalance,
                  },
                  verifiedCode: {
                    description:
                      "Confirms smart contract source code matches deployed bytecode.",
                    uid: KNOWN_SCHEMAS.verifiedCode,
                  },
                },
                note: "These are the known Dojang schemas. Custom schemas can also be created via EAS.",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
