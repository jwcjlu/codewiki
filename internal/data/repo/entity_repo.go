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

func (projectRepo *projectRepo) QueryCallChain(ctx context.Context, startFunctionName string) ([]*v1.CallRelationship, error) {
	ctx, _ = context.WithTimeout(ctx, 5*time.Minute)
	session := projectRepo.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	query := `MATCH path = (start:Function {name: $startFunctionName})-[:Call*]->(end:Function)
        UNWIND relationships(path) AS rel
        WITH startNode(rel) AS caller, endNode(rel) AS callee
        RETURN caller.id AS callerID, caller.name AS callerName,
               callee.id AS calleeID, callee.name AS calleeName`

	result, err := session.Run(ctx, query, map[string]interface{}{"startFunctionName": startFunctionName},
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
			CallerId:   v.Values[0].(string),
			CallerName: v.Values[1].(string),
			CalleeId:   v.Values[2].(string),
			CalleeName: v.Values[3].(string),
		})
	}
	return relationships, nil
}
