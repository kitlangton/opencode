import { AlibabaPlugin } from "./alibaba"
import { AmazonBedrockPlugin } from "./amazon-bedrock"
import { AnthropicPlugin } from "./anthropic"
import { AzureCognitiveServicesPlugin, AzurePlugin } from "./azure"
import { CerebrasPlugin } from "./cerebras"
import { CloudflareAIGatewayPlugin } from "./cloudflare-ai-gateway"
import { CloudflareWorkersAIPlugin } from "./cloudflare-workers-ai"
import { CoherePlugin } from "./cohere"
import { DeepInfraPlugin } from "./deepinfra"
import { DynamicProviderPlugin } from "./dynamic"
import { GatewayPlugin } from "./gateway"
import { GitLabPlugin } from "./gitlab"
import { GithubCopilotPlugin } from "./github-copilot"
import { GooglePlugin } from "./google"
import { GoogleVertexAnthropicPlugin, GoogleVertexPlugin } from "./google-vertex"
import { GroqPlugin } from "./groq"
import { MistralPlugin } from "./mistral"
import { OpenAIPlugin } from "./openai"
import { OpenAICompatiblePlugin } from "./openai-compatible"
import { OpencodePlugin } from "./opencode"
import { OpenRouterPlugin } from "./openrouter"
import { PerplexityPlugin } from "./perplexity"
import { SapAICorePlugin } from "./sap-ai-core"
import { TogetherAIPlugin } from "./togetherai"
import { VercelPlugin } from "./vercel"
import { VenicePlugin } from "./venice"
import { XAIPlugin } from "./xai"

export const ProviderPlugins = [
  AlibabaPlugin,
  AmazonBedrockPlugin,
  AnthropicPlugin,
  AzureCognitiveServicesPlugin,
  AzurePlugin,
  CerebrasPlugin,
  CloudflareAIGatewayPlugin,
  CloudflareWorkersAIPlugin,
  CoherePlugin,
  DeepInfraPlugin,
  GatewayPlugin,
  GitLabPlugin,
  GithubCopilotPlugin,
  GooglePlugin,
  GoogleVertexAnthropicPlugin,
  GoogleVertexPlugin,
  GroqPlugin,
  MistralPlugin,
  OpencodePlugin,
  OpenAICompatiblePlugin,
  OpenAIPlugin,
  OpenRouterPlugin,
  PerplexityPlugin,
  SapAICorePlugin,
  TogetherAIPlugin,
  VercelPlugin,
  VenicePlugin,
  XAIPlugin,
  DynamicProviderPlugin,
]
