package repo

import (
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
	methods := getMethods(entities)
	if err := batchSaveFunction(ctx, session, methods); err != nil {
		return err
	}
	fields := getFields(entities)
	if err := batchSaveField(ctx, session, fields); err != nil {
		return err
	}
	return batchSaveRelation(ctx, projectRepo.neo4jDriver, project.Relations)
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
