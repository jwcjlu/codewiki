package repo

import (
	"codewiki/internal/biz"
	"codewiki/internal/biz/model"
	"codewiki/internal/conf"
	"context"
	"github.com/milvus-io/milvus/client/v2/entity"
	"strings"

	"github.com/milvus-io/milvus/client/v2/column"
	"github.com/milvus-io/milvus/client/v2/milvusclient"
)

type indexerMilvus struct {
	client     *milvusclient.Client
	milvusAddr string
}

func NewIndexerRepo(data *conf.Data) biz.IndexerRepo {
	if data.Embedding == nil && len(data.Embedding.ApiURL) > 0 {
		return nil
	}
	client, err := milvusclient.New(context.Background(), &milvusclient.ClientConfig{
		Address: data.Embedding.ApiURL,
	})
	if err != nil {
		panic(err)
	}
	return &indexerMilvus{client: client}
}

func (m *indexerMilvus) SaveCodeChunk(ctx context.Context, projectName, partition string, codeChunks []*model.CodeChunk) error {
	var paths []string
	var contents []string
	var documents []string
	var logics []string
	var scopes []string
	var ids []string
	var codeVectors [][]float32
	projectName = strings.ReplaceAll(projectName, "-", "")
	for _, codeChunk := range codeChunks {
		paths = append(paths, codeChunk.Path)
		contents = append(contents, codeChunk.Content)
		documents = append(documents, codeChunk.Document)
		logics = append(logics, codeChunk.Logic)
		scopes = append(scopes, string(codeChunk.Scope))
		ids = append(ids, codeChunk.Id)
		codeVectors = append(codeVectors, codeChunk.CodeVector())
	}
	idColumn := column.NewColumnVarChar("id", ids)
	pathColumn := column.NewColumnVarChar("path", paths)
	contentColumn := column.NewColumnVarChar("content", contents)
	documentColumn := column.NewColumnVarChar("document", documents)
	logicColumn := column.NewColumnVarChar("logic", logics)
	scopeColumn := column.NewColumnVarChar("scope", scopes)
	codeVectorColumn := column.NewColumnFloatVector("vector", 1024, codeVectors)

	_, err := m.client.Insert(context.WithoutCancel(ctx), milvusclient.NewColumnBasedInsertOption(projectName,
		idColumn,
		pathColumn,
		contentColumn,
		documentColumn,
		logicColumn,
		scopeColumn,
		codeVectorColumn,
	))
	return err
}

// SearchCodeChunk 搜索代码块
func (m *indexerMilvus) SearchCodeChunk(ctx context.Context, req *biz.SearchCodeChunksReq) ([]*model.CodeChunk, error) {
	projectName := strings.ReplaceAll(req.ProjectName, "-", "")
	resultSets, err := m.client.Search(context.WithoutCancel(ctx), milvusclient.NewSearchOption(
		projectName,
		req.Limit,
		[]entity.Vector{entity.FloatVector(req.QueryVector)},
	).WithANNSField("vector").
		WithOutputFields(
			"id",
			"path",
			"content",
			"document",
			"logic",
			"scope"))
	if err != nil {
		return nil, err
	}
	var results []*model.CodeChunk
	for _, resultSet := range resultSets {

		for index := 0; index < resultSet.ResultCount; index++ {
			result := &model.CodeChunk{}
			if value, err := resultSet.GetColumn("content").GetAsString(index); err != nil {
				return nil, err
			} else {
				result.Content = value
			}
			if value, err := resultSet.GetColumn("path").GetAsString(index); err != nil {
				return nil, err
			} else {
				result.Path = value
			}
			if value, err := resultSet.GetColumn("id").GetAsString(index); err != nil {
				return nil, err
			} else {
				result.Id = value
			}
			results = append(results, result)
		}

	}
	return results, nil
}

func (m *indexerMilvus) SearchCodeChunkByIds(ctx context.Context, collectionName string, ids []string, limit int) ([]*model.CodeChunk, error) {
	projectName := strings.ReplaceAll(collectionName, "-", "")
	resultSet, err := m.client.Query(ctx, milvusclient.NewQueryOption(projectName).
		WithLimit(limit).
		WithConsistencyLevel(entity.ClStrong).
		WithIDs(column.NewColumnVarChar("id", ids)).
		WithOutputFields("path",
			"content",
			"document",
			"logic",
			"scope"))
	if err != nil {
		return nil, err
	}
	var results []*model.CodeChunk

	for index := 0; index < resultSet.ResultCount; index++ {
		result := &model.CodeChunk{}
		if value, err := resultSet.GetColumn("content").GetAsString(index); err != nil {
			return nil, err
		} else {
			result.Content = value
		}
		if value, err := resultSet.GetColumn("path").GetAsString(index); err != nil {
			return nil, err
		} else {
			result.Path = value
		}

		results = append(results, result)
	}
	return results, nil
}
