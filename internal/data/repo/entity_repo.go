package repo

import (
	v1 "codewiki/api/codewiki/v1"
	"codewiki/internal/biz"
	"context"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"time"
)

type projectRepo struct {
	neo4jDriver neo4j.DriverWithContext
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
	/*	methods := getMethods(entities)
		if err := batchSaveFunction(ctx, session, methods); err != nil {
			return err
		}*/
	fields := getFields(entities)
	if err := batchSaveField(ctx, session, fields); err != nil {
		return err
	}
	return batchSaveRelation(ctx, projectRepo.neo4jDriver, project.Relations)
}

// ===== Repo management =====
func (projectRepo *projectRepo) CreateRepo(ctx context.Context, req *RepoModel) (string, error) {
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `CREATE (r:Repo {id: $id, name: $name, repo_type: $repo_type, path: $path, target: $target, token: $token, description: $description})`
		_, err := tx.Run(ctx, query, map[string]any{
			"id":          req.ID,
			"name":        req.Name,
			"repo_type":   req.RepoType,
			"path":        req.Path,
			"target":      req.Target,
			"token":       req.Token,
			"description": req.Description,
		})
		return nil, err
	})
	if err != nil {
		return "", err
	}
	return req.ID, nil
}

func (projectRepo *projectRepo) ListRepos(ctx context.Context) ([]*v1.Repo, error) {
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	var repos []*v1.Repo
	_, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (r:Repo) RETURN r`
		result, err := tx.Run(ctx, query, nil)
		if err != nil {
			return nil, err
		}
		for result.Next(ctx) {
			rec := result.Record()
			node, _ := rec.Get("r")
			if n, ok := node.(neo4j.Node); ok {
				repo := &v1.Repo{}
				if v, ok := n.Props["id"].(string); ok {
					repo.Id = v
				}
				if v, ok := n.Props["name"].(string); ok {
					repo.Name = v
				}
				if v, ok := n.Props["repo_type"].(int64); ok {
					repo.RepoType = v1.RepoType(v)
				}
				if v, ok := n.Props["path"].(string); ok {
					repo.Path = v
				}
				if v, ok := n.Props["target"].(string); ok {
					repo.Target = v
				}
				if v, ok := n.Props["token"].(string); ok {
					repo.Token = v
				}
				if v, ok := n.Props["description"].(string); ok {
					repo.Description = v
				}
				repos = append(repos, repo)
			}
		}
		return nil, result.Err()
	})
	return repos, err
}

func (projectRepo *projectRepo) GetRepo(ctx context.Context, id string) (*v1.Repo, error) {
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	var repo *v1.Repo
	_, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (r:Repo {id: $id}) RETURN r`
		result, err := tx.Run(ctx, query, map[string]any{"id": id})
		if err != nil {
			return nil, err
		}
		if result.Next(ctx) {
			rec := result.Record()
			node, _ := rec.Get("r")
			if n, ok := node.(neo4j.Node); ok {
				r := &v1.Repo{}
				if v, ok := n.Props["id"].(string); ok {
					r.Id = v
				}
				if v, ok := n.Props["name"].(string); ok {
					r.Name = v
				}
				if v, ok := n.Props["repo_type"].(int64); ok {
					r.RepoType = v1.RepoType(v)
				}
				if v, ok := n.Props["path"].(string); ok {
					r.Path = v
				}
				if v, ok := n.Props["target"].(string); ok {
					r.Target = v
				}
				if v, ok := n.Props["token"].(string); ok {
					r.Token = v
				}
				if v, ok := n.Props["description"].(string); ok {
					r.Description = v
				}
				repo = r
			}
		}
		return nil, result.Err()
	})
	return repo, err
}

func (projectRepo *projectRepo) DeleteRepo(ctx context.Context, id string) error {
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (root:Package {parent_id: $id}) DETACH DELETE root`
		_, err := tx.Run(ctx, query, map[string]any{"id": id})
		return nil, err
	})
	return err
}

func (projectRepo *projectRepo) BindRepoRoot(ctx context.Context, repoId, rootPkgId string) error {
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		query := `MATCH (r:Repo {id: $rid}), (p:Package {id: $pid}) MERGE (r)-[:ROOT_PACKAGE]->(p)`
		_, err := tx.Run(ctx, query, map[string]any{"rid": repoId, "pid": rootPkgId})
		return nil, err
	})
	return err
}

func (projectRepo *projectRepo) GetRepoTree(ctx context.Context, id string) (packages []*v1.PackageNode, files []*v1.FileNode, err error) {
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
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
				pn := &v1.PackageNode{}
				if v, ok := n.Props["id"].(string); ok {
					pn.Id = v
				}
				if v, ok := n.Props["name"].(string); ok {
					pn.Name = v
				}
				if v, ok := n.Props["parent_id"].(string); ok {
					pn.ParentId = v
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
				fn := &v1.FileNode{}
				if v, ok := n.Props["id"].(string); ok {
					fn.Id = v
				}
				if v, ok := n.Props["name"].(string); ok {
					fn.Name = v
				}
				if v, ok := n.Props["pkg_id"].(string); ok {
					fn.PkgId = v
				}
				files = append(files, fn)
			}
		}
		return nil, result.Err()
	})
	return
}

func getEntities(files []*biz.File) []*biz.Entity {
	var entities []*biz.Entity
	for _, file := range files {
		entities = append(entities, file.GetEntities()...)
	}
	return entities
}
func getFunctions(files []*biz.File) []*biz.Function {
	var functions []*biz.Function
	for _, file := range files {
		functions = append(functions, file.GetFunctions()...)
		for _, entity := range file.GetEntities() {
			functions = append(functions, entity.GetMethods()...)
		}
	}
	return functions
}

/*
	func getMethods(entities []*biz.Entity) []*biz.Function {
		var functions []*biz.Function
		for _, entity := range entities {
			functions = append(functions, entity.GetFunctions()...)
		}
		return functions
	}
*/
func getFields(entities []*biz.Entity) []*biz.Field {
	var fields []*biz.Field
	for _, entity := range entities {
		fields = append(fields, entity.GetFields()...)
	}
	return fields
}
func getImports(files []*biz.File) []*biz.Import {
	var imports []*biz.Import
	for _, file := range files {
		imports = append(imports, file.GetImports()...)
	}
	return imports
}

func (projectRepo *projectRepo) QueryCallChain(ctx context.Context, id string) ([]*v1.CallRelationship, error) {
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	query := `MATCH path = (start:Function {id: $id})-[:Call*]->(end:Function)
        UNWIND relationships(path) AS rel
        WITH startNode(rel) AS caller, endNode(rel) AS callee
        RETURN caller.id AS callerID, caller.name AS callerName,
               callee.id AS calleeID, callee.name AS calleeName,
               callee.ent_id AS calleeFileID, caller.ent_id AS callerFileID,
               callee.scope AS calleeScope, caller.scope AS callerScope`

	result, err := session.Run(ctx, query, map[string]interface{}{"id": id},
		func(config *neo4j.TransactionConfig) {

		})
	if err != nil {
		return nil, err
	}
	var relationships []*v1.CallRelationship
	rs, err := result.Collect(ctx)
	if err != nil {
		return nil, err
	}
	for _, v := range rs {
		relationships = append(relationships, &v1.CallRelationship{
			CallerId:     v.Values[0].(string),
			CallerName:   v.Values[1].(string),
			CalleeId:     v.Values[2].(string),
			CalleeName:   v.Values[3].(string),
			CalleeFileId: v.Values[4].(string),
			CallerFileId: v.Values[5].(string),
			CalleeScope:  v.Values[6].(int64),
			CallerScope:  v.Values[7].(int64),
		})
	}
	return relationships, nil
}
func (projectRepo *projectRepo) GetFunctionByFileId(ctx context.Context,
	fileId string) ([]*v1.Function, error) {
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	var functions []*v1.Function
	_, err := session.ExecuteRead(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
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
				fn := &v1.Function{}
				if v, ok := n.Props["id"].(string); ok {
					fn.Id = v
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
