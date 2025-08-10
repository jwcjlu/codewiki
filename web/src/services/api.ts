import { CallRelation, ApiResponse, CreateRepoReq, ListReposResp, GetRepoResp, RepoTreeResp, ViewFileResp } from '../types';

const API_BASE_URL = 'http://localhost:8000/v1/api';

// ---- Mock for call graph (kept) ----
const mockData: CallRelation[] = [
  { callerId: 'main', callerName: 'main', calleeId: 'processData', calleeName: 'processData', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'main', callerName: 'main', calleeId: 'validateInput', calleeName: 'validateInput', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'processData', callerName: 'processData', calleeId: 'parseData', calleeName: 'parseData', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'processData', callerName: 'processData', calleeId: 'transformData', calleeName: 'transformData', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'validateInput', callerName: 'validateInput', calleeId: 'checkFormat', calleeName: 'checkFormat', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'parseData', callerName: 'parseData', calleeId: 'extractFields', calleeName: 'extractFields', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'transformData', callerName: 'transformData', calleeId: 'applyRules', calleeName: 'applyRules', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'checkFormat', callerName: 'checkFormat', calleeId: 'validateSchema', calleeName: 'validateSchema', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'extractFields', callerName: 'extractFields', calleeId: 'parseJson', calleeName: 'parseJson', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'applyRules', callerName: 'applyRules', calleeId: 'calculateMetrics', calleeName: 'calculateMetrics', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'parseJson', callerName: 'parseJson', calleeId: 'decodeString', calleeName: 'decodeString', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'calculateMetrics', callerName: 'calculateMetrics', calleeId: 'computeAverage', calleeName: 'computeAverage', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
  { callerId: 'validateSchema', callerName: 'validateSchema', calleeId: 'checkRequired', calleeName: 'checkRequired', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main' },
];

export const fetchFunctionCalls = async (functionId: string): Promise<CallRelation[]> => {
  if (!functionId || typeof functionId !== 'string') {
    throw new Error('Invalid function ID');
  }

  if (functionId === 'test' || functionId === 'main') {
    return mockData;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/functions/${encodeURIComponent(functionId)}/calls`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      credentials: 'include'
    });

    if (!response.ok) throw new Error('Failed to fetch function calls');
    const data: ApiResponse = await response.json();
    if (data.code !== 0 || !data.callRelations) throw new Error(data.msg || 'Failed to fetch function calls');
    return data.callRelations;
  } catch (error) {
    return mockData;
  }
};

// ---- Repo Management APIs ----

export async function createRepo(req: CreateRepoReq): Promise<string> {
  const res = await fetch(`${API_BASE_URL}/repos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error('Create repo failed');
  const data = await res.json();
  return (data.id ?? data?.data?.id) as string;
}

export async function listRepos(): Promise<ListReposResp> {
  const res = await fetch(`${API_BASE_URL}/repos`, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error('List repos failed');
  const raw = await res.json();
  const payload = raw?.repos ? raw : raw?.data ? raw.data : { repos: [] };
  return payload as ListReposResp;
}

export async function getRepo(id: string): Promise<GetRepoResp> {
  const res = await fetch(`${API_BASE_URL}/repos/${encodeURIComponent(id)}`, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error('Get repo failed');
  const raw = await res.json();
  return (raw?.repo ? raw : raw?.data ? raw.data : raw) as GetRepoResp;
}

export async function deleteRepo(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/repos/${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
  if (!res.ok) throw new Error('Delete repo failed');
}

export async function analyzeRepo(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/repos/${encodeURIComponent(id)}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({})
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Analyze repo failed${text ? `: ${text}` : ''}`);
  }
}

export async function getRepoTree(id: string): Promise<RepoTreeResp> {
  const res = await fetch(`${API_BASE_URL}/repos/${encodeURIComponent(id)}/tree`, { headers: { 'Accept': 'application/json' }, credentials: 'include' });
  if (!res.ok) throw new Error('Get repo tree failed');
  const raw = await res.json();
  const payload = raw?.packages || raw?.files ? raw : raw?.data ? raw.data : {};
  return {
    packages: Array.isArray(payload.packages) ? payload.packages : [],
    files: Array.isArray(payload.files) ? payload.files : []
  };
}

export async function viewFileContent(repoId: string, fileId: string): Promise<ViewFileResp> {
  const res = await fetch(`${API_BASE_URL}/${encodeURIComponent(repoId)}/file/${encodeURIComponent(fileId)}/view`, { 
    headers: { 'Accept': 'application/json' }, 
    credentials: 'include' 
  });
  if (!res.ok) throw new Error('View file content failed');
  const raw = await res.json();
  const payload = raw?.Content ? raw : raw?.data ? raw.data : {};
  return {
    Content: payload.Content || '',
    language: payload.language || 'Golang',
    functions: payload.functions || []
  };
}
