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

export enum RepoType {
  Local = 0,
  Github = 1
}

export enum Language {
  Golang = 0,
  Java = 1,
  Python = 2,
  Rust = 3
}

export enum FunScope {
  Default = 0,
  Struct = 1,
  Interface = 2,
  Constant = 3,
  Variable = 4
}

export interface Repo {
  id: string;
  name: string;
  repoType: RepoType;
  path?: string;
  target?: string;
  description?: string;
  excludes?: string;
  language: Language;
}

export interface CreateRepoReq {
  name: string;
  repoType: RepoType;
  path?: string;
  target?: string;
  token?: string;
  description?: string;
  excludes?: string;
  language: Language;
}

export interface ListReposResp {
  ret: BaseResp;
  body: {
    repo: Repo[];
  };
}

export interface GetRepoResp {
  ret: BaseResp;
  body: {
    repo: Repo;
  };
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
  ret: BaseResp;
  body: {
    packages: PackageNode[];
    files: FileNode[];
  };
}

export interface ApiResponse {
  ret: BaseResp;
  body?: any;
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

// 新增：代码搜索相关的类型定义
export interface SearchCodeReq {
  repoId: string;
  query: string;
  limit?: number;
  similarity_threshold?: number;
}

export interface SearchResult {
  id: string;
  path: string;
  content: string;
  document: string;
  logic: string;
  scope: string;
  similarity_score: number;
  highlights: string[];
}

export interface SearchCodeResp {
  code: number;
  msg: string;
  results: SearchResult[];
}

// 更新：使用后端已存在的Answer接口
export interface AnswerReq {
  id: string; // 项目ID
  question: string;
}

export interface AnswerResp {
  answer: string;
  is_streaming?: boolean;  // 是否为流式响应
  is_complete?: boolean;   // 是否完成
  chunk?: string;          // 流式数据块
  chunk_index?: number;    // 数据块索引
  error?: string;          // 错误信息
}



// 新增：基础响应结构
export interface BaseResp {
  code: number;
  reason: string;
  msg: string;
}

// 更新：调用链响应
export interface CallChainResp {
  ret: BaseResp;
  body: {
    callRelations: CallRelation[];
  };
}

// 更新：创建仓库响应
export interface CreateRepoResp {
  ret: BaseResp;
  body: {
    id: string;
  };
}

// 新增：删除仓库请求和响应
export interface DeleteRepoReq {
  id: string;
}

export interface DeleteRepoResp {
  ret: BaseResp;
}

// 新增：分析仓库请求
export interface AnalyzeRepoReq {
  id: string;
  forceUpdate: boolean;
}

export interface AnalyzeResp {
  ret: BaseResp;
}

// 新增：获取仓库树请求
export interface GetRepoTreeReq {
  id: string;
}

export interface GetRepoTreeResp {
  ret: BaseResp;
  body: {
    packages: PackageNode[];
    files: FileNode[];
  };
}

// 新增：调用链请求
export interface CallChainReq {
  id: string;
}

// 新增：查看文件请求
export interface ViewFileReq {
  repoId: string;
  id: string;
}

export interface ViewFileResp {
  ret: BaseResp;
  body: {
    Content: string;
    language: Language;
    functions: Function[];
  };
}

// 新增：获取实现请求
export interface GetImplementReq {
  id: string;
}

export interface GetImplementResp {
  ret: BaseResp;
  body: {
    entities: Entity[];
  };
}

// 新增：实体定义
export interface Entity {
  name: string;
  fileId: string;
  id: string;
  functions: Function[];
}

// 新增：函数定义
export interface Function {
  id: string;
  fileId: string;
  name: string;
  receiver: string;
}

// 新增：调用关系定义
export interface CallRelationship {
  callerId: string;
  callerName: string;
  calleeId: string;
  calleeName: string;
  calleeFileId: string;
  callerFileId: string;
  calleeScope: number;
  callerScope: number;
  calleeEntityId: string;
  callerEntityId: string;
}
