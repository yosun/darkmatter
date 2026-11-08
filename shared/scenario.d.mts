export type AgentId = 'spielberg' | 'ebert' | 'lucas' | 'bohr';
export interface Agent { id: AgentId; name: string; role: string; color: string }
export interface Finding { title: string; detail: string }
export interface CameraPose { position: number[]; quaternion: number[]; target: number[]; up: number[]; fovY: number; aspect: number; layers?: string[] }
export interface Artifact {
  id: string;
  kind: 'image' | 'video' | 'world' | 'report';
  title: string;
  caption?: string;
  url?: string;
  poster?: string;
  text?: string;
  agent?: AgentId;
  viewer?: 'splat';
  preset?: string;
  camera?: CameraPose;
  provenance?: { transport: 'agentverse'; address: string; sessionId: string; phase: string; task: string };
  annotation?: { x: number; y: number; w: number; h: number; label: string };
}
export const AGENTS: readonly Agent[];
export const MEDIA: Record<'opening' | 'reconstruction' | 'front' | 'side' | 'back', string>;
export const STEPS: readonly { agent: AgentId; to: AgentId | null; title: string; instruction: string }[];
export const REPLAY: readonly { message: string; artifact?: Artifact; finding?: Finding; findings?: Finding[] }[];
