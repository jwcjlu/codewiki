export interface CallRelation {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  callerFileId: string;
  calleeFileId: string;
  callerScope: string;
  calleeScope: string;
  calleeEntityId?: string;
  callerEntityId?: string;
}

export type RepoType = 'Local' | 'Github';

export interface Repo {
  id: string;
  name: string;
  repoType: RepoType | number;
  path?: string;
  target: string;
  token?: string;
  description?: string;
  language?: string;
  excludes?: string[];
}

export interface CreateRepoReq {
  name: string;
  repoType: RepoType | number;
  path?: string;
  target: string;
  token?: string;
  description?: string;
  language?: string;
  excludes?: string[];
}

export interface ListReposResp {
  repos: Repo[];
}

export interface GetRepoResp {
  repo: Repo;
}

export interface PackageNode {
  id: string;
  name: string;
  parentId?: string;
}

export interface FileNode {
  id: string;
  name: string;
  pkgId: string;
}

export interface RepoTreeResp {
  packages: PackageNode[];
  files: FileNode[];
}

export interface ApiResponse {
  code: number;
  msg: string;
  callRelations?: CallRelation[];
}

export interface Node {
  id: string;
  name: string;
  type: 'caller' | 'callee';
  level: number;
  expanded: boolean;
  children: Set<string>;
  parents: Set<string>;
  fileId?: string; // 添加文件ID字段
  scope?: string; // 添加作用域字段
  entityId?: string; // 添加实体ID字段
  implementationChainId?: string; // 标识节点属于哪个实现调用链
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface GraphState {
  nodes: Map<string, Node>;
  visibleNodes: Set<string>;
  nodePositions: Map<string, NodePosition>;
  allRelationships: CallRelation[];
}

export interface Function {
  id: string;
  fileId: string;
  name: string;
  receiver: string;
}

export interface ViewFileReq {
  repoId: string;
  id: string;
}

export interface ViewFileResp {
  Content: string;
  language: string;
  functions: Function[];
}

// 新增：实现接口相关类型
export interface GetImplementReq {
  id: string;
}

export interface GetImplementResp {
  entities: Entity[];
}

export interface Entity {
  name: string;
  fileId: string;
  id: string;
  functions: Function[];
}
