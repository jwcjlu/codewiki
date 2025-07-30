package repo

import (
	"codewiki/internal/biz"
	"context"
	"fmt"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"time"
)

type projectRepo struct {
	neo4jDriver neo4j.DriverWithContext
}

func NewProjectRepo(driver neo4j.DriverWithContext) biz.ProjectRepo {
	return &projectRepo{neo4jDriver: driver}
}
func (projectRepo *projectRepo) SaveProject(ctx context.Context, project *biz.Project) error {
	// 保存Package节点
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	pkgs := project.GetPackages()
	if err := batchSavePackage(ctx, session, pkgs); err != nil {
		return err
	}
	files := project.GetFiles()
	if err := batchSaveFile(ctx, session, files); err != nil {
		return err
	}
	imports := getImports(files)
	if err := batchSaveImport(ctx, session, imports); err != nil {
		return err
	}
	entities := getEntities(files)
	if err := batchSaveEntity(ctx, session, entities); err != nil {
		return err
	}
	functions := getFunctions(files)
	if err := batchSaveFunction(ctx, session, functions); err != nil {
		return err
	}
	methods := getMethods(entities)
	if err := batchSaveFunction(ctx, session, methods); err != nil {
		return err
	}
	fields := getFields(entities)
	if err := batchSaveField(ctx, session, fields); err != nil {
		return err
	}
	return batchSaveRelation(ctx, session, project.Relations)
}

func getEntities(files []*biz.File) []*biz.Entity {
	var entities []*biz.Entity
	for _, file := range files {
		entities = append(entities, file.Entities...)
	}
	return entities
}
func getFunctions(files []*biz.File) []*biz.Function {
	var functions []*biz.Function
	for _, file := range files {
		functions = append(functions, file.Functions...)
	}
	return functions
}
func getMethods(entities []*biz.Entity) []*biz.Function {
	var functions []*biz.Function
	for _, entity := range entities {
		functions = append(functions, entity.Functions...)
	}
	return functions
}
func getFields(entities []*biz.Entity) []*biz.Field {
	var fields []*biz.Field
	for _, entity := range entities {
		fields = append(fields, entity.Fields...)
	}
	return fields
}
func getImports(files []*biz.File) []*biz.Import {
	var imports []*biz.Import
	for _, file := range files {
		imports = append(imports, file.Imports...)
	}
	return imports
}

func savePackages(ctx context.Context, session neo4j.SessionWithContext, pkg *biz.Package) error {

	if err := savePackage(ctx, session, pkg); err != nil {
		return err
	}
	for _, file := range pkg.Files {
		if err := addFile(ctx, session, file); err != nil {
			return err
		}
		for _, entity := range file.Entities {
			if err := addEntity(ctx, session, entity); err != nil {
				return err
			}
			for _, field := range entity.Fields {
				if err := addField(ctx, session, field, entity.ID); err != nil {
					return err
				}
			}
			for _, fun := range entity.Functions {
				if err := addFunction(ctx, session, fun, file.ID); err != nil {
					return err
				}
			}
		}
		for _, function := range file.Functions {
			if err := addFunction(ctx, session, function, file.ID); err != nil {
				return err
			}
		}
	}
	for _, subPkg := range pkg.Packages {
		if err := savePackages(ctx, session, subPkg); err != nil {
			return err
		}
		if err := savePackageRelations(ctx, session, subPkg); err != nil {
			return err
		}
	}
	return nil
}

func savePackage(ctx context.Context, session neo4j.SessionWithContext, pkg *biz.Package) error {

	query := `
        MERGE (p:Package {id: $id})
        SET p.name = $name, p.path = $path, p.parent_id = $parent_id
        RETURN p`

	params := map[string]any{
		"id":        pkg.ID,
		"name":      pkg.Name,
		"path":      pkg.Path,
		"parent_id": pkg.ParentID,
	}
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}
func savePackageRelations(ctx context.Context, session neo4j.SessionWithContext, pkg *biz.Package) error {

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
func addFile(ctx context.Context, session neo4j.SessionWithContext, file *biz.File) error {
	query := `
        MERGE (f:File {id: $id})
        SET f.name = $name, f.pkg_id = $pkg_id
        WITH f
        MATCH (p:Package {id: $pkg_id})
        MERGE (p)-[:CONTAINS]->(f)
        RETURN f`

	params := map[string]interface{}{
		"id":     file.ID,
		"name":   file.Name,
		"pkg_id": file.PkgID,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}
func addEntity(ctx context.Context, session neo4j.SessionWithContext, e *biz.Entity) error {

	labels := "Entity" + e.Type.Type()
	query := fmt.Sprintf(`
        MERGE (e:Entity {id: $id})
        SET e:%s, e.name = $name, e.type = $type, e.file_id = $file_id, 
            e.pkg_id = $pkg_id, e.definition = $definition,
            e.comment = $comment, e.document = $document
        WITH e
        MATCH (f:File {id: $file_id})
        MERGE (f)-[:DECLARES]->(e)
        RETURN e`, labels)

	params := map[string]interface{}{
		"id":         e.ID,
		"name":       e.Name,
		"type":       e.Type,
		"file_id":    e.FileID,
		"pkg_id":     e.PkgID,
		"definition": e.Definition,
		"comment":    e.Comment,
		"document":   e.Document,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

func addFunction(ctx context.Context, session neo4j.SessionWithContext, f *biz.Function, fileId string) error {

	query := `
        MERGE (fn:Function {id: $id})
        SET fn.name = $name, fn.document = $document, 
            fn.comment = $comment, fn.pkg_id = $pkg_id,
            fn.scope = $scope, fn.receiver = $receiver,
            fn.ent_id = $ent_id
        WITH fn
        MATCH (f:File {id: $file_id})
        MERGE (f)-[:DECLARES]->(fn)
        RETURN fn`

	params := map[string]interface{}{
		"id":       f.ID,
		"name":     f.Name,
		"document": f.Document,
		"comment":  f.Comment,
		"pkg_id":   f.PkgID,
		"scope":    f.Scope,
		"receiver": f.Receiver,
		"ent_id":   f.EntId,
		"file_id":  fileId,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

func addField(ctx context.Context, session neo4j.SessionWithContext, f *biz.Field, entityID string) error {

	query := `
        MERGE (fd:Field {id: $id})
        SET fd.name = $name, fd.type = $type
        WITH fd
        MATCH (e:Entity {id: $entity_id})
        MERGE (e)-[:HAS_FIELD]->(fd)
        RETURN fd`

	// 生成唯一ID，例如 entityID + fieldName
	fieldID := fmt.Sprintf("%s_%s", entityID, f.Name)

	params := map[string]interface{}{
		"id":        fieldID,
		"name":      f.Name,
		"type":      f.ObjType,
		"entity_id": entityID,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}

func saveExtendRelation(ctx context.Context, session neo4j.SessionWithContext, sourceId, targetID string) error {

	query := `
        MATCH (e1:Entity {id: $source_id}), (e2:Entity {id: $target_id})
        MERGE (e1)-[:EXTENDS]->(e2)`

	params := map[string]interface{}{
		"source_id": sourceId,
		"target_id": targetID,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}

func saveBelongTo(ctx context.Context, session neo4j.SessionWithContext, f *biz.Function) error {

	query := `
            MATCH (fn:Function {id: $func_id}), (e:Entity {id: $entity_id})
            MERGE (fn)-[:BELONGS_TO]->(e)`

	params := map[string]interface{}{
		"func_id":   f.ID,
		"entity_id": f.EntId,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}

/*
	func (f *Function) saveParamOrResult(session neo4j.Session, field *Field, relType string) error {
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
func saveImport(ctx context.Context, session neo4j.SessionWithContext, i *biz.Import, fileID string) error {

	query := `
        MERGE (imp:Import {path: $path})
        SET imp.name = $name
        WITH imp
        MATCH (f:File {id: $file_id})
        MERGE (f)-[:IMPORTS]->(imp)
        RETURN imp`

	params := map[string]interface{}{
		"path":    i.Path,
		"name":    i.Name,
		"file_id": fileID,
	}

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, params); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}
