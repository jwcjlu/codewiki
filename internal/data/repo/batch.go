package repo

import (
	"codewiki/internal/biz"
	"context"
	"fmt"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

func batchSavePackage(ctx context.Context, session neo4j.SessionWithContext, pkgs []*biz.Package) error {
	query := `
       UNWIND $batch AS pkg
		CREATE (p:Package {
			id: pkg.id,
			name: pkg.name,
			parent_id: pkg.parent_id,
			path: pkg.path
		})`
	var params []map[string]any
	for _, pkg := range pkgs {
		params = append(params, map[string]any{
			"id":        pkg.ID,
			"name":      pkg.Name,
			"path":      pkg.Path,
			"parent_id": pkg.ParentID,
		})
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

/*
func batchSavePackageRelations(ctx context.Context, session neo4j.SessionWithContext, pkg *biz.Package) error {

		query := `
	            MATCH (p1:Package {id: $parent_id}), (p2:Package {id: $child_id})
	            MERGE (p1)-[:CONTAINS]->(p2)`

		params := map[string]interface{}{
			"parent_id": pkg.ParentID,
			"child_id":  pkg.ID,
		}
		_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			if _, err := tx.Run(ctx, query, params); err != nil {
				return nil, err
			}
			return nil, nil
		})

		return err

}
*/
func batchSaveFile(ctx context.Context, session neo4j.SessionWithContext, files []*biz.File) error {
	query := `
        UNWIND $batch AS file
		CREATE (f:File {
			id: file.id,
			name: file.name,
			pkg_id: file.pkg_id
		})`
	var params []map[string]any
	for _, file := range files {
		params = append(params, map[string]any{
			"id":     file.ID,
			"name":   file.Name,
			"pkg_id": file.PkgID,
		})
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}
func batchSaveEntity(ctx context.Context, session neo4j.SessionWithContext, entities []*biz.Entity) error {

	query := fmt.Sprintf(`
   UNWIND $batch AS ent
	CREATE (e:Entity {
		id: ent.id,
		type: ent.type,
		name: ent.name,
		file_id: ent.file_id,
		pkg_id: ent.pkg_id,
		definition: ent.definition,
		comment: ent.comment,
		document: ent.document
	})
	`)
	var params []map[string]any
	for _, e := range entities {
		params = append(params, map[string]interface{}{
			"id":         e.ID,
			"name":       e.Name,
			"type":       e.Type,
			"file_id":    e.FileID,
			"pkg_id":     e.PkgID,
			"definition": e.Definition,
			"comment":    e.Comment,
			"document":   e.Document,
		})
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

func batchSaveFunction(ctx context.Context, session neo4j.SessionWithContext, functions []*biz.Function) error {
	query := `
        UNWIND $batch AS fn
		CREATE (f:Function {
			id: fn.id,
			name: fn.name,
			document: fn.document,
			comment: fn.comment,
			pkg_id: fn.pkg_id,
			scope: fn.scope,
			receiver: fn.receiver,
			ent_id: fn.ent_id
		})
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
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

func batchSaveField(ctx context.Context, session neo4j.SessionWithContext, fields []*biz.Field) error {

	query := `
        UNWIND $batch AS fd
		CREATE (f:Field {
                id: fd.id,
				name: fd.name,
				type: fd.type,
                entity_id: fd.entity_id
		})
		`

	// 生成唯一ID，例如 entityID + fieldName
	var params []map[string]any
	for _, f := range fields {
		fieldID := fmt.Sprintf("%s_%s", f.StructID, f.Name)
		if len(f.Name) == 0 {
			fieldID = fmt.Sprintf("%s_%s", f.StructID, f.ObjType)
		}
		params = append(params, map[string]interface{}{
			"id":        fieldID,
			"name":      f.Name,
			"type":      f.ObjType,
			"entity_id": f.StructID,
		})
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

/*
	func (f *Function) batchSaveParamOrResult(session neo4j.Session, field *Field, relType string) error {
		// 这里简化处理，实际应用中需要根据Field.Type解析出对应的Entity ID
		// 假设我们已经有一个方法可以将类型表达式转换为Entity ID
		entityID, err := resolveTypeToEntityID(field.Type)
		if err != nil {
			return err
		}

		if entityID == "" {
			return nil
		}

		_, err = session.WriteTransaction(func(tx neo4j.Transaction) (interface{}, error) {
			query := fmt.Sprintf(`
	        MATCH (fn:Function {id: $func_id}), (e:Entity {id: $entity_id})
	        MERGE (fn)-[:%s]->(e)`, relType)

			params := map[string]interface{}{
				"func_id":   f.ID,
				"entity_id": entityID,
			}

			result, err := tx.Run(query, params)
			if err != nil {
				return nil, err
			}
			return result.Consume()
		})

		return err
	}
*/
func batchSaveImport(ctx context.Context, session neo4j.SessionWithContext, imports []*biz.Import) error {

	query := `
        UNWIND $batch AS imp
		CREATE (i:Import {
			path: imp.path,
			name: imp.name,
            file_id: imp.file_id
		})
		`
	var params []map[string]any
	for _, i := range imports {
		params = append(params, map[string]interface{}{
			"path":    i.Path,
			"name":    i.Name,
			"file_id": i.FileId,
		})

	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}
func batchSaveRelation(ctx context.Context, session neo4j.SessionWithContext, relations []*biz.Relation) error {

	// 将 Relation 结构体转换为 Neo4j 支持的格式
	relMaps := make(map[string][]map[string]interface{})
	for _, rel := range relations {
		relMaps[rel.Type] = append(relMaps[rel.Type], map[string]interface{}{
			"type":       rel.Type,
			"sourceID":   rel.SourceID,
			"targetID":   rel.TargetID,
			"confidence": rel.Confidence,
		})
	}

	for Type, params := range relMaps {
		query := getCreateQueryCypher(Type)
		if len(query) == 0 {
			continue
		}
		if _, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
			if _, err := tx.Run(ctx, query, map[string]interface{}{"rels": params}); err != nil {
				return nil, err
			}
			return nil, nil
		}); err != nil {
			return err
		}
	}

	return nil
}

func getCreateQueryCypher(Type string) string {
	switch Type {
	case biz.DeclareEntity:
		return `
        UNWIND $rels AS rel
        MATCH (p:Package {id: rel.sourceID}), (e:Entity {id: rel.targetID})
        MERGE (p)-[:DeclareEntity]->(e)
        RETURN count(*) AS relationshipCount
        `
	case biz.ContainsFile:
		return `
        UNWIND $rels AS rel
        MATCH (p:Package {id: rel.sourceID}), (f:File {id: rel.targetID})
        MERGE (p)-[:ContainsFile]->(f)
        RETURN count(*) AS relationshipCount
        `
	case biz.DeclareFunc:
		return `
        UNWIND $rels AS rel
        MATCH (f:File {id: rel.sourceID}), (fn:Function {id: rel.targetID})
        MERGE (f)-[:DeclareFunc]->(fn)
        RETURN count(*) AS relationshipCount
        `
	case biz.HasMethod:
		return `
        UNWIND $rels AS rel
        MATCH (e:Entity {id: rel.sourceID}), (f:Function {id: rel.targetID})
        MERGE (e)-[:HasMethod]->(f)
        RETURN count(*) AS relationshipCount
        `
	case biz.HasFields:
		return `
        UNWIND $rels AS rel
        MATCH (e:Entity {id: rel.sourceID}), (fd:Field {id: rel.targetID})
        MERGE (e)-[:HasFields]->(fd)
        RETURN count(*) AS relationshipCount
        `
	case biz.Implement:
		return `
        UNWIND $rels AS rel
        MATCH (e1:Entity {id: rel.sourceID}), (e2:Entity {id: rel.targetID})
        MERGE (e1)-[:Implement]->(e2)
        RETURN count(*) AS relationshipCount
        `
	case biz.Call:
		return `
        UNWIND $rels AS rel
        MATCH (f1:Function {id: rel.sourceID}), (f2:Function {id: rel.targetID})
        MERGE (f1)-[:Call]->(f2)
        RETURN count(*) AS relationshipCount
        `
	case biz.Contains:
		return `
        UNWIND $rels AS rel
        MATCH (p1:Package {id: rel.sourceID}), (p2:Package {id: rel.targetID})
        MERGE (p1)-[:Contains]->(p2)
        RETURN count(*) AS relationshipCount
        `
	case biz.Extends:
		return `
        UNWIND $rels AS rel
        MATCH (e1:Entity {id: rel.sourceID}), (e2:Entity {id: rel.targetID})
        MERGE (e1)-[:Extends]->(e2)
        RETURN count(*) AS relationshipCount
        `
	}
	return ""
}
