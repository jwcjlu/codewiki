import { CallRelation, ApiResponse, CreateRepoReq, ListReposResp, GetRepoResp, RepoTreeResp, ViewFileResp, GetImplementResp } from '../types';

const API_BASE_URL = 'http://localhost:8000/v1/api';

// ---- Mock for call graph (kept) ----
const mockData: CallRelation[] = [
  { callerId: 'main', callerName: 'main', calleeId: 'processData', calleeName: 'processData', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'main_entity', calleeEntityId: 'process_data_entity' },
  { callerId: 'main', callerName: 'main', calleeId: 'validateInput', calleeName: 'validateInput', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'main_entity', calleeEntityId: 'validate_input_entity' },
  { callerId: 'processData', callerName: 'processData', calleeId: 'parseData', calleeName: 'parseData', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'process_data_entity', calleeEntityId: 'parse_data_entity' },
  { callerId: 'processData', callerName: 'processData', calleeId: 'transformData', calleeName: 'transformData', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'process_data_entity', calleeEntityId: 'transform_data_entity' },
  { callerId: 'validateInput', callerName: 'validateInput', calleeId: 'checkFormat', calleeName: 'checkFormat', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'validate_input_entity', calleeEntityId: 'check_format_entity' },
  { callerId: 'parseData', callerName: 'parseData', calleeId: 'extractFields', calleeName: 'extractFields', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'parse_data_entity', calleeEntityId: 'extract_fields_entity' },
  { callerId: 'transformData', callerName: 'transformData', calleeId: 'applyRules', calleeName: 'applyRules', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'transform_data_entity', calleeEntityId: 'apply_rules_entity' },
  { callerId: 'checkFormat', callerName: 'checkFormat', calleeId: 'validateSchema', calleeName: 'validateSchema', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'check_format_entity', calleeEntityId: 'validate_schema_entity' },
  { callerId: 'extractFields', callerName: 'extractFields', calleeId: 'parseJson', calleeName: 'parseJson', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'extract_fields_entity', calleeEntityId: 'parse_json_entity' },
  { callerId: 'applyRules', callerName: 'applyRules', calleeId: 'calculateMetrics', calleeName: 'calculateMetrics', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'apply_rules_entity', calleeEntityId: 'calculate_metrics_entity' },
  { callerId: 'parseJson', callerName: 'parseJson', calleeId: 'decodeString', calleeName: 'decodeString', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'parse_json_entity', calleeEntityId: 'decode_string_entity' },
  { callerId: 'calculateMetrics', callerName: 'calculateMetrics', calleeId: 'computeAverage', calleeName: 'computeAverage', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'calculate_metrics_entity', calleeEntityId: 'compute_average_entity' },
  { callerId: 'validateSchema', callerName: 'validateSchema', calleeId: 'checkRequired', calleeName: 'checkRequired', callerFileId: 'main.go', calleeFileId: 'main.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'validate_schema_entity', calleeEntityId: 'check_required_entity' },
  // 新增：接口类型的调用关系，用于测试"选择实现"功能
  { callerId: 'main', callerName: 'main', calleeId: 'dataProcessor', calleeName: 'DataProcessor', callerFileId: 'main.go', calleeFileId: 'interface.go', callerScope: 'main', calleeScope: '3', callerEntityId: 'main_entity', calleeEntityId: 'data_processor_interface' },
  { callerId: 'processData', callerName: 'processData', calleeId: 'dataProcessor', calleeName: 'DataProcessor', callerFileId: 'main.go', calleeFileId: 'interface.go', callerScope: 'main', calleeScope: '3', callerEntityId: 'process_data_entity', calleeEntityId: 'data_processor_interface' },
  { callerId: 'validateInput', callerName: 'validateInput', calleeId: 'validator', calleeName: 'Validator', callerFileId: 'main.go', calleeFileId: 'interface.go', callerScope: 'main', calleeScope: '3', callerEntityId: 'validate_input_entity', calleeEntityId: 'validator_interface' },
];

export const fetchFunctionCalls = async (functionId: string, entityName?: string): Promise<CallRelation[]> => {
  if (!functionId || typeof functionId !== 'string') {
    throw new Error('Invalid function ID');
  }
  
  // 如果提供了 entityName，可以在日志中记录，或者用于其他逻辑
  if (entityName) {
    console.log(`Fetching function calls for entity: ${entityName} (ID: ${functionId})`);
  }

  // 为接口实现类添加专门的 mock 数据
  if (functionId === 'json_processor_impl') {
    return [
      { callerId: 'JSONDataProcessor.Process', callerName: 'Process', calleeId: 'parseJSON', calleeName: 'parseJSON', callerFileId: 'json_processor.go', calleeFileId: 'json_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'json_processor_impl', calleeEntityId: 'parse_json_func' },
      { callerId: 'JSONDataProcessor.Process', callerName: 'Process', calleeId: 'validateJSON', calleeName: 'validateJSON', callerFileId: 'json_processor.go', calleeFileId: 'json_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'json_processor_impl', calleeEntityId: 'validate_json_func' },
      { callerId: 'parseJSON', callerName: 'parseJSON', calleeId: 'decodeJSON', calleeName: 'decodeJSON', callerFileId: 'json_processor.go', calleeFileId: 'json_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'parse_json_func', calleeEntityId: 'decode_json_func' },
      { callerId: 'validateJSON', callerName: 'validateJSON', calleeId: 'checkSchema', calleeName: 'checkSchema', callerFileId: 'json_processor.go', calleeFileId: 'json_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'validate_json_func', calleeEntityId: 'check_schema_func' },
    ];
  }

  if (functionId === 'xml_processor_impl') {
    return [
      { callerId: 'XMLDataProcessor.Process', callerName: 'Process', calleeId: 'parseXML', calleeName: 'parseXML', callerFileId: 'xml_processor.go', calleeFileId: 'xml_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'xml_processor_impl', calleeEntityId: 'parse_xml_func' },
      { callerId: 'XMLDataProcessor.Process', callerName: 'Process', calleeId: 'validateXML', calleeName: 'validateXML', callerFileId: 'xml_processor.go', calleeFileId: 'xml_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'xml_processor_impl', calleeEntityId: 'validate_xml_func' },
      { callerId: 'parseXML', callerName: 'parseXML', calleeId: 'decodeXML', calleeName: 'decodeXML', callerFileId: 'xml_processor.go', calleeFileId: 'xml_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'parse_xml_func', calleeEntityId: 'decode_xml_func' },
      { callerId: 'validateXML', callerName: 'validateXML', calleeId: 'checkDTD', calleeName: 'checkDTD', callerFileId: 'xml_processor.go', calleeFileId: 'xml_processor.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'validate_xml_func', calleeEntityId: 'check_dtd_func' },
    ];
  }

  if (functionId === 'string_validator_impl') {
    return [
      { callerId: 'StringValidator.Validate', callerName: 'Validate', calleeId: 'checkLength', calleeName: 'checkLength', callerFileId: 'string_validator.go', calleeFileId: 'string_validator.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'string_validator_impl', calleeEntityId: 'check_length_func' },
      { callerId: 'StringValidator.Validate', callerName: 'Validate', calleeId: 'checkFormat', calleeName: 'checkFormat', callerFileId: 'string_validator.go', calleeFileId: 'string_validator.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'string_validator_impl', calleeEntityId: 'check_format_func' },
      { callerId: 'checkLength', callerName: 'checkLength', calleeId: 'isValidRange', calleeName: 'isValidRange', callerFileId: 'string_validator.go', calleeFileId: 'string_validator.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'check_length_func', calleeEntityId: 'is_valid_range_func' },
      { callerId: 'checkFormat', callerName: 'checkFormat', calleeId: 'matchPattern', calleeName: 'matchPattern', callerFileId: 'string_validator.go', calleeFileId: 'string_validator.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'check_format_func', calleeEntityId: 'match_pattern_func' },
      // 添加一个接口调用，用于测试递归的接口实现选择
      { callerId: 'matchPattern', callerName: 'matchPattern', calleeId: 'regexEngine', calleeName: 'RegexEngine', callerFileId: 'string_validator.go', calleeFileId: 'regex_engine.go', callerScope: 'main', calleeScope: '3', callerEntityId: 'match_pattern_func', calleeEntityId: 'regex_engine_interface' },
    ];
  }

  if (functionId === 'standard_regex_impl') {
    return [
      { callerId: 'StandardRegexEngine.Compile', callerName: 'Compile', calleeId: 'parseRegex', calleeName: 'parseRegex', callerFileId: 'standard_regex.go', calleeFileId: 'standard_regex.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'standard_regex_impl', calleeEntityId: 'parse_regex_func' },
      { callerId: 'StandardRegexEngine.Match', callerName: 'Match', calleeId: 'executeRegex', calleeName: 'executeRegex', callerFileId: 'standard_regex.go', calleeFileId: 'standard_regex.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'standard_regex_impl', calleeEntityId: 'execute_regex_func' },
      { callerId: 'parseRegex', callerName: 'parseRegex', calleeId: 'buildAST', calleeName: 'buildAST', callerFileId: 'standard_regex.go', calleeFileId: 'standard_regex.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'parse_regex_func', calleeEntityId: 'build_ast_func' },
      { callerId: 'executeRegex', callerName: 'executeRegex', calleeId: 'matchString', calleeName: 'matchString', callerFileId: 'standard_regex.go', calleeFileId: 'standard_regex.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'execute_regex_func', calleeEntityId: 'match_string_func' },
    ];
  }

  // 为 AllocVMAdaptSvc.GetNormalVMNode 添加 mock 数据
  if (functionId.includes('AllocVMAdaptSvc.GetNormalVMNode')) {
    return [
      { callerId: 'AllocVMAdaptSvc.GetNormalVMNode', callerName: 'GetNormalVMNode', calleeId: 'vmManager.GetVM', calleeName: 'GetVM', callerFileId: 'get_vm_adapt.go', calleeFileId: 'vm_manager.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'alloc_vm_adapt_svc', calleeEntityId: 'vm_manager' },
      { callerId: 'AllocVMAdaptSvc.GetNormalVMNode', callerName: 'GetNormalVMNode', calleeId: 'vmValidator.Validate', calleeName: 'Validate', callerFileId: 'get_vm_adapt.go', calleeFileId: 'vm_validator.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'alloc_vm_adapt_svc', calleeEntityId: 'vm_validator' },
      { callerId: 'vmManager.GetVM', callerName: 'GetVM', calleeId: 'vmRepository.Query', calleeName: 'Query', callerFileId: 'vm_manager.go', calleeFileId: 'vm_repository.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'vm_manager', calleeEntityId: 'vm_repository' },
      { callerId: 'vmValidator.Validate', callerName: 'Validate', calleeId: 'vmPolicy.Check', calleeName: 'Check', callerFileId: 'vm_validator.go', calleeFileId: 'vm_policy.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'vm_validator', calleeEntityId: 'vm_policy' },
      // 添加一个接口调用，用于测试递归的接口实现选择
      { callerId: 'vmPolicy.Check', callerName: 'Check', calleeId: 'vmRuleEngine', calleeName: 'VMRuleEngine', callerFileId: 'vm_policy.go', calleeFileId: 'vm_rule_engine.go', callerScope: 'main', calleeScope: '3', callerEntityId: 'vm_policy', calleeEntityId: 'vm_rule_engine_interface' },
    ];
  }

  // 为 vm_rule_engine_interface 的实现类添加调用链数据
  if (functionId === 'check_vm_rule') {
    return [
      { callerId: 'StandardVMRuleEngine.Check', callerName: 'Check', calleeId: 'ruleParser.Parse', calleeName: 'Parse', callerFileId: 'standard_vm_rule.go', calleeFileId: 'rule_parser.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'standard_vm_rule_impl', calleeEntityId: 'rule_parser' },
      { callerId: 'StandardVMRuleEngine.Check', callerName: 'Check', calleeId: 'ruleEvaluator.Evaluate', calleeName: 'Evaluate', callerFileId: 'standard_vm_rule.go', calleeFileId: 'rule_evaluator.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'standard_vm_rule_impl', calleeEntityId: 'rule_evaluator' },
    ];
  }

  if (functionId === 'check_advanced_vm_rule') {
    return [
      { callerId: 'AdvancedVMRuleEngine.Check', callerName: 'Check', calleeId: 'advancedRuleParser.Parse', calleeName: 'Parse', callerFileId: 'advanced_vm_rule.go', calleeFileId: 'advanced_rule_parser.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'advanced_vm_rule_impl', calleeEntityId: 'advanced_rule_parser' },
      { callerId: 'AdvancedVMRuleEngine.Check', callerName: 'Check', calleeId: 'aiRuleEngine.Analyze', calleeName: 'Analyze', callerFileId: 'advanced_vm_rule.go', calleeFileId: 'ai_rule_engine.go', callerScope: 'main', calleeScope: 'main', callerEntityId: 'advanced_vm_rule_impl', calleeEntityId: 'ai_rule_engine' },
    ];
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

// 新增：获取实现接口
export async function getImplement(entityId: string): Promise<GetImplementResp> {
  // 添加 mock 数据用于测试
  if (entityId === 'data_processor_interface') {
    return {
      entities: [
        {
          id: 'json_processor_impl',
          name: 'JSONDataProcessor',
          fileId: 'json_processor.go',
          functions: [
            { id: 'process_json', name: 'Process', receiver: 'JSONDataProcessor', fileId: 'json_processor.go' },
            { id: 'validate_json', name: 'Validate', receiver: 'JSONDataProcessor', fileId: 'json_processor.go' }
          ]
        },
        {
          id: 'xml_processor_impl',
          name: 'XMLDataProcessor',
          fileId: 'xml_processor.go',
          functions: [
            { id: 'process_xml', name: 'Process', receiver: 'XMLDataProcessor', fileId: 'xml_processor.go' },
            { id: 'validate_xml', name: 'Validate', receiver: 'XMLDataProcessor', fileId: 'xml_processor.go' }
          ]
        }
      ]
    };
  }
  
  if (entityId === 'validator_interface') {
    return {
      entities: [
        {
          id: 'string_validator_impl',
          name: 'StringValidator',
          fileId: 'string_validator.go',
          functions: [
            { id: 'validate_string', name: 'Validate', receiver: 'StringValidator', fileId: 'string_validator.go' }
          ]
        }
      ]
    };
  }

  if (entityId === 'regex_engine_interface') {
    return {
      entities: [
        {
          id: 'standard_regex_impl',
          name: 'StandardRegexEngine',
          fileId: 'standard_regex.go',
          functions: [
            { id: 'compile_regex', name: 'Compile', receiver: 'StandardRegexEngine', fileId: 'standard_regex.go' },
            { id: 'match_regex', name: 'Match', receiver: 'StandardRegexEngine', fileId: 'standard_regex.go' }
          ]
        }
      ]
    };
  }

  // 为 vm_rule_engine_interface 添加实现数据
  if (entityId === 'vm_rule_engine_interface') {
    return {
      entities: [
        {
          id: 'standard_vm_rule_impl',
          name: 'StandardVMRuleEngine',
          fileId: 'standard_vm_rule.go',
          functions: [
            { id: 'check_vm_rule', name: 'Check', receiver: 'StandardVMRuleEngine', fileId: 'standard_vm_rule.go' },
            { id: 'apply_vm_rule', name: 'Apply', receiver: 'StandardVMRuleEngine', fileId: 'standard_vm_rule.go' }
          ]
        },
        {
          id: 'advanced_vm_rule_impl',
          name: 'AdvancedVMRuleEngine',
          fileId: 'advanced_vm_rule.go',
          functions: [
            { id: 'check_advanced_vm_rule', name: 'Check', receiver: 'AdvancedVMRuleEngine', fileId: 'advanced_vm_rule.go' },
            { id: 'apply_advanced_vm_rule', name: 'Apply', receiver: 'AdvancedVMRuleEngine', fileId: 'advanced_vm_rule.go' }
          ]
        }
      ]
    };
  }

  try {
    const res = await fetch(`${API_BASE_URL}/entity/${encodeURIComponent(entityId)}/implements`, { 
      headers: { 'Accept': 'application/json' }, 
      credentials: 'include' 
    });
    if (!res.ok) throw new Error('Get implement failed');
    const raw = await res.json();
    const payload = raw?.entities ? raw : raw?.data ? raw.data : {};
    return {
      entities: Array.isArray(payload.entities) ? payload.entities : []
    };
  } catch (error) {
    // 如果 API 调用失败，返回空数组
    return { entities: [] };
  }
}
