package repo

import (
	"codewiki/internal/biz"
	"codewiki/internal/biz/model"
	"context"
	"fmt"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"time"
)

type codeNeo4jRepo struct {
	neo4jDriver neo4j.DriverWithContext
}

func NewCodeNeo4jRepo(neo4jDriver neo4j.DriverWithContext) biz.CodeRepo {
	return &codeNeo4jRepo{neo4jDriver: neo4jDriver}
}
func (code *codeNeo4jRepo) SaveRelations(ctx context.Context, relations []*model.Relation) error {

	// 将 Relation 结构体转换为 Neo4j 支持的格式
	relMaps := make(map[model.RelationType][]map[string]interface{})
	for _, rel := range relations {
		relMaps[rel.Type] = append(relMaps[rel.Type], map[string]interface{}{
			"type":       rel.Type,
			"sourceID":   rel.SourceID,
			"targetID":   rel.TargetID,
			"confidence": rel.Confidence,
		})
	}
	session := code.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	for Type, params := range relMaps {

		query := getCreateQueryCypher(Type)
		if len(query) == 0 {
			continue
		}
		// 执行当前批次的写入操作
		if _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			result, err := tx.Run(ctx, query, map[string]interface{}{"rels": params})
			if err != nil {
				return nil, err
			}
			return result, nil
		}); err != nil {
			return err
		}

	}

	return nil
}
func (code *codeNeo4jRepo) GetFunctionByFileId(ctx context.Context, fileId string) (functions []*model.Function, err error) {
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := code.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (fn:Function {ent_id: $fileId})
        RETURN fn`
		result, err := tx.Run(ctx, query, map[string]any{"fileId": fileId})
		if err != nil {
			return nil, err
		}
		for result.Next(ctx) {
			rec := result.Record()
			node, _ := rec.Get("fn")
			if n, ok := node.(neo4j.Node); ok {
				fn := &model.Function{}
				if v, ok := n.Props["id"].(string); ok {
					fn.ID = v
				}
				if v, ok := n.Props["name"].(string); ok {
					fn.Name = v
				}
				if v, ok := n.Props["receiver"].(string); ok {
					fn.Receiver = v
				}
				if v, ok := n.Props["ent_id"].(string); ok {
					fn.FileId = v
				}
				functions = append(functions, fn)
			}
		}
		return nil, result.Err()
	})
	return functions, err
}
func (code *codeNeo4jRepo) GetImplementByEntityId(ctx context.Context, entityID string) (entities []*model.Entity, err error) {
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := code.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	query := `MATCH (e1:Entity)-[:Implement]->(e2:Entity{id: $entity_id})
			OPTIONAL MATCH (e1)-[:HasMethod]->(f:Function)
			RETURN e1.id as entity_id, 
			   e1.name as entity_name,
			   e1.file_id as entity_fileId,
			   COLLECT({
				   id: f.id,
				   fileId: f.ent_id,
				   name: f.name,
				   receiver: f.receiver
			   }) AS functions`

	result, err := session.Run(ctx, query, map[string]interface{}{"entity_id": entityID},
		func(config *neo4j.TransactionConfig) {

		})
	if err != nil {
		return nil, err
	}
	for result.Next(context.Background()) {
		record := result.Record()

		// 获取实体基本信息
		entityId, _ := record.Get("entity_id")
		entityName, _ := record.Get("entity_name")
		entityFileId, _ := record.Get("entity_fileId")
		functions, _ := record.Get("functions")
		entity := &model.Entity{
			ID:     entityId.(string),
			Name:   entityName.(string),
			FileID: entityFileId.(string),
		}
		// 转换函数列表
		if functions != nil {
			for _, f := range functions.([]interface{}) {
				fMap := f.(map[string]interface{})
				entity.AddMethod(&model.Function{
					ID:       fMap["id"].(string),
					FileId:   fMap["fileId"].(string),
					Name:     fMap["name"].(string),
					Receiver: fMap["receiver"].(string),
				})
			}
		}
		// 构建 Entity 对象
		entities = append(entities, entity)
	}

	if err := result.Err(); err != nil {
		return nil, fmt.Errorf("result processing error: %w", err)
	}
	return entities, nil
}
func (code *codeNeo4jRepo) SaveFunctions(ctx context.Context, functions []*model.Function) error {
	query := `
        UNWIND $batch AS fn
		MERGE (f:Function {id: fn.id})
		ON CREATE SET 
			f.name = fn.name,
			f.document = fn.document,
			f.comment = fn.comment,
			f.pkg_id = fn.pkg_id,
			f.scope = fn.scope,
			f.receiver = fn.receiver,
			f.ent_id = fn.ent_id,
			f.file_id = fn.file_id
		`
	var params []map[string]any
	for _, f := range functions {
		params = append(params, map[string]interface{}{
			"id":       f.ID,
			"name":     f.Name,
			"document": f.Document,
			"comment":  f.Comment,
			"pkg_id":   f.PkgID,
			"scope":    f.Scope,
			"receiver": f.Receiver,
			"ent_id":   f.EntId,
			"file_id":  f.FileId,
		})
	}
	session := code.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}

func (code *codeNeo4jRepo) QueryCallRelations(ctx context.Context, projectId string, limit int) ([]*model.CallRelation, error) {
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := code.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	callQuery := "Call*"
	if limit > 0 {
		callQuery = fmt.Sprintf(":Call*1..%d", limit)
	}
	query := `MATCH path = (start:Function {id: $id})-[%s]->(end:Function)
        UNWIND relationships(path) AS rel
        WITH startNode(rel) AS caller, endNode(rel) AS callee
        RETURN caller.id AS callerID, caller.name AS callerName,
               callee.id AS calleeID, callee.name AS calleeName,
               callee.file_id AS calleeFileID, caller.file_id AS callerFileID,
               callee.scope AS calleeScope, caller.scope AS callerScope,
               callee.ent_id AS calleeEntId, caller.ent_id AS callerEntId`
	query = fmt.Sprintf(query, callQuery)

	result, err := session.Run(ctx, query, map[string]interface{}{"id": projectId},
		func(config *neo4j.TransactionConfig) {

		})
	if err != nil {
		return nil, err
	}
	var relationships []*model.CallRelation
	rs, err := result.Collect(ctx)
	if err != nil {
		return nil, err
	}
	uniqueRelations := make(map[string]bool)
	for _, v := range rs {
		relationKey := fmt.Sprintf("%s->%s", v.Values[0].(string), v.Values[3].(string))
		if uniqueRelations[relationKey] {
			continue
		}
		uniqueRelations[relationKey] = true
		relationships = append(relationships, &model.CallRelation{
			CallerId:       v.Values[0].(string),
			CallerName:     v.Values[1].(string),
			CalleeId:       v.Values[2].(string),
			CalleeName:     v.Values[3].(string),
			CalleeFileId:   v.Values[4].(string),
			CallerFileId:   v.Values[5].(string),
			CalleeScope:    v.Values[6].(int64),
			CallerScope:    v.Values[7].(int64),
			CalleeEntityId: v.Values[8].(string),
			CallerEntityId: v.Values[9].(string),
		})
	}
	return relationships, nil
}
func getCreateQueryCypher(Type model.RelationType) string {
	switch Type {
	case model.DeclareEntity:
		return `
        UNWIND $rels AS rel
        MATCH (p:Package {id: rel.sourceID}), (e:Entity {id: rel.targetID})
        MERGE (p)-[:DeclareEntity]->(e)
        `
	case model.ContainsFile:
		return `
        UNWIND $rels AS rel
        MATCH (p:Package {id: rel.sourceID}), (f:File {id: rel.targetID})
        MERGE (p)-[:ContainsFile]->(f)
        `
	case model.DeclareFunc:
		return `
        UNWIND $rels AS rel
        MATCH (f:File {id: rel.sourceID}), (fn:Function {id: rel.targetID})
        MERGE (f)-[:DeclareFunc]->(fn)
        `
	case model.HasMethod:
		return `
        UNWIND $rels AS rel
        MATCH (e:Entity {id: rel.sourceID}), (f:Function {id: rel.targetID})
        MERGE (e)-[:HasMethod]->(f)
        `
	case model.HasFields:
		return `
        UNWIND $rels AS rel
        MATCH (e:Entity {id: rel.sourceID}), (fd:Field {id: rel.targetID})
        MERGE (e)-[:HasFields]->(fd)
        `
	case model.Implement:
		return `
        UNWIND $rels AS rel
        MATCH (e1:Entity {id: rel.sourceID}), (e2:Entity {id: rel.targetID})
        MERGE (e1)-[:Implement]->(e2)
        `
	case model.Call:
		return `
        UNWIND $rels AS rel
        MATCH (f1:Function {id: rel.sourceID}), (f2:Function {id: rel.targetID})
        MERGE (f1)-[:Call]->(f2)
        `
	case model.Contains:
		return `
        UNWIND $rels AS rel
        MATCH (p1:Package {id: rel.sourceID}), (p2:Package {id: rel.targetID})
        MERGE (p1)-[:Contains]->(p2)
        `
	case model.Extends:
		return `
        UNWIND $rels AS rel
        MATCH (e1:Entity {id: rel.sourceID}), (e2:Entity {id: rel.targetID})
        MERGE (e1)-[:Extends]->(e2)
        `
	}
	return ""
}
