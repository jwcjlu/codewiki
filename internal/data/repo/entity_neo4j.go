package repo

import (
	"codewiki/internal/biz"
	"codewiki/internal/biz/model"
	"context"
	"fmt"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type entityNeo4jRepo struct {
	neo4jDriver neo4j.DriverWithContext
}

func NewEntityRepo(neo4jDriver neo4j.DriverWithContext) biz.EntityRepo {
	return &entityNeo4jRepo{neo4jDriver: neo4jDriver}
}
func (entity *entityNeo4jRepo) SavePackages(ctx context.Context, pkgs []*model.Package) error {
	query := `
      UNWIND $batch AS pkg
		MERGE (p:Package {id: pkg.id})
		SET p.name = pkg.name,
			p.parent_id = pkg.parent_id,
			p.path = pkg.path`
	var params []map[string]any
	for _, pkg := range pkgs {
		params = append(params, map[string]any{
			"id":        pkg.ID,
			"name":      pkg.Name,
			"path":      pkg.Path,
			"parent_id": pkg.ParentID,
		})
	}
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err

}
func (entity *entityNeo4jRepo) SaveFiles(ctx context.Context, files []*model.File) error {
	query := `
        UNWIND $batch AS file
        MERGE (f:File {id: file.id})
		SET	f.id= file.id,
			f.name= file.name,
			f.pkg_id=file.pkg_id
		`
	var params []map[string]any
	for _, file := range files {
		params = append(params, map[string]any{
			"id":     file.ID,
			"name":   file.Name,
			"pkg_id": file.PkgID,
		})
	}
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}
func (entity *entityNeo4jRepo) SaveEntities(ctx context.Context, entities []*model.Entity) error {
	query := fmt.Sprintf(`
   UNWIND $batch AS ent
   MERGE (e:Entity {id: ent.id})
   SET e.name = ent.name,
       e.type= ent.type,
       e.name= ent.name,
       e.file_id= ent.file_id,
       e.pkg_id=ent.pkg_id,
       e.definition=ent.definition,
       e.comment=ent.comment,
       e.document= ent.document
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
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}
func (entity *entityNeo4jRepo) QueryPkgAndFileByProjectId(ctx context.Context, id string) (packages []model.Package, files []model.File, err error) {
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	// packages
	_, err = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (root:Package {parent_id: $id})
                  OPTIONAL MATCH (root)-[:Contains*0..]->(p:Package)
                  RETURN DISTINCT p`
		result, err := tx.Run(ctx, query, map[string]any{"id": id})
		if err != nil {
			return nil, err
		}
		for result.Next(ctx) {
			rec := result.Record()
			node, _ := rec.Get("p")
			if n, ok := node.(neo4j.Node); ok {
				pn := model.Package{}
				if v, ok := n.Props["id"].(string); ok {
					pn.ID = v
				}
				if v, ok := n.Props["name"].(string); ok {
					pn.Name = v
				}
				if v, ok := n.Props["parent_id"].(string); ok {
					pn.ParentID = v
				}
				packages = append(packages, pn)
			}
		}
		return nil, result.Err()
	})
	if err != nil {
		return
	}
	// files
	_, err = session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (root:Package {parent_id: $id})
                  OPTIONAL MATCH (p:Package)-[:ContainsFile]->(f:File)
                  WHERE p.id STARTS WITH root.id
                  RETURN DISTINCT f`
		result, err := tx.Run(ctx, query, map[string]any{"id": id})
		if err != nil {
			return nil, err
		}
		for result.Next(ctx) {
			rec := result.Record()
			node, _ := rec.Get("f")
			if n, ok := node.(neo4j.Node); ok {
				fn := model.File{}
				if v, ok := n.Props["id"].(string); ok {
					fn.ID = v
				}
				if v, ok := n.Props["name"].(string); ok {
					fn.Name = v
				}
				if v, ok := n.Props["pkg_id"].(string); ok {
					fn.PkgID = v
				}
				files = append(files, fn)
			}
		}
		return nil, result.Err()
	})
	return
}

func (entity *entityNeo4jRepo) SaveImports(ctx context.Context, imports []*model.Import) error {
	query := `
        UNWIND $batch AS imp
        MERGE (i:Import {id: imp.id})
        SET i.name = imp.name,
            i.path=imp.path,
            i.file_id=imp.file_id
		`
	var params []map[string]any
	for _, i := range imports {
		params = append(params, map[string]interface{}{
			"path":    i.Path,
			"name":    i.Name,
			"file_id": i.FileId,
		})

	}
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}
func (entity *entityNeo4jRepo) SaveFields(ctx context.Context, fields []*model.Field) error {
	query := `
        UNWIND $batch AS fd
        MERGE (f:Field {id: fd.id})
		SET f.name = fd.name,
		f.type=fd.type,
		f.entity_id=fd.entity_id
	
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
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		if _, err := tx.Run(ctx, query, map[string]interface{}{"batch": params}); err != nil {
			return nil, err
		}
		return nil, nil
	})

	return err
}
