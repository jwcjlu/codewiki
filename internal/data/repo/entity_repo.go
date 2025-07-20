package repo

import (
	"codewiki/internal/biz"
	"context"
	"fmt"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

type entityRepo struct {
	neo4jDriver neo4j.DriverWithContext
}

func NewEntityRepo(neo4jDriver neo4j.DriverWithContext) biz.EntityRepo {
	return &entityRepo{}
}
func (entity *entityRepo) BatchSaveEntities(ctx context.Context, entities []*biz.Entity) error {
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)

	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		for _, entity := range entities {
			if err := ctx.Err(); err != nil {
				return nil, err
			}

			_, err := tx.Run(ctx, `
				MERGE (e:Entity {id: $id})
				SET e.type = $type,
					e.name = $name,
					e.filePath = $filePath,
					e.position = $position,
					e.definition = $definition,
					e.embeddings = $embeddings
			`, map[string]any{
				"id":   entity.ID,
				"type": string(entity.Type),
				"name": entity.Name,
				//"filePath":   entity.FilePath,
				"position":   fmt.Sprintf("%s:%d:%d", entity.Position.Filename, entity.Position.Line, entity.Position.Column),
				"definition": entity.Definition,
				"embeddings": entity.Embeddings,
			})
			if err != nil {
				return nil, err
			}
		}
		return nil, nil
	})
	return err
	return err
}

func (entity *entityRepo) BatchSaveRelation(ctx context.Context, relations []*biz.Relation) error {
	session := entity.neo4jDriver.NewSession(ctx, neo4j.SessionConfig{})
	defer session.Close(ctx)
	_, err := session.ExecuteWrite(ctx, func(tx neo4j.ManagedTransaction) (any, error) {
		for _, rel := range relations {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			_, err := tx.Run(ctx, `
				MATCH (source:Entity {id: $sourceId})
				MATCH (target:Entity {id: $targetId})
				MERGE (source)-[r:`+rel.Type+`]->(target)
				SET r.confidence = $confidence
			`, map[string]any{
				"sourceId":   rel.SourceID,
				"targetId":   rel.TargetID,
				"confidence": rel.Confidence,
			})
			if err != nil {
				return nil, err
			}
		}
		return nil, nil
	})
	return err
}
