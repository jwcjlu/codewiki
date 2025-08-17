package repo

import (
	"codewiki/internal/biz"
	"codewiki/internal/conf"
	"context"
	"fmt"
	"github.com/milvus-io/milvus/client/v2/entity"
	"strings"

	"github.com/milvus-io/milvus/client/v2/column"
	"github.com/milvus-io/milvus/client/v2/milvusclient"
)

type Milvus struct {
	client     *milvusclient.Client
	milvusAddr string
}

func NewMilvus(data *conf.Data) biz.IndexerRepo {
	if data.Embedding == nil && len(data.Embedding.ApiURL) > 0 {
		return nil
	}
	client, err := milvusclient.New(context.Background(), &milvusclient.ClientConfig{
		Address: data.Embedding.ApiURL,
	})
	if err != nil {
		panic(err)
	}
	return &Milvus{client: client}
}

func (m *Milvus) SaveCodeChunk(ctx context.Context, projectName, partition string, codeChunks []*biz.CodeChunk) error {
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
	if err != nil {
		fmt.Println(err)
	}
	return err
}

// SearchCodeChunk 搜索代码块
func (m *Milvus) SearchCodeChunk(ctx context.Context, req *biz.SearchCodeChunksReq) ([]*biz.CodeChunk, error) {
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
	var results []*biz.CodeChunk
	for _, resultSet := range resultSets {
		var result []*biz.CodeChunk
		err = resultSet.Unmarshal(&result)
		if err != nil {
			return nil, err
		}
		results = append(results, result...)
	}
	return results, nil
}
